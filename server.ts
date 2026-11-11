import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import QRCode from "qrcode";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

function getValidGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (
    trimmed === '' ||
    trimmed === 'MY_GEMINI_API_KEY' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed.startsWith('AQ.') ||
    trimmed.includes('.')
  ) {
    return null;
  }
  return trimmed;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

/**
 * Parses a JSON payload returned by Gemini.
 * Even with responseMimeType set, models occasionally wrap the payload in
 * markdown fences or prepend prose. Returns null instead of throwing so the
 * caller can fall back to its deterministic engine.
 */
function parseAiJson<T = any>(raw: unknown): T | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;

  let text = raw.trim();
  text = text
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidates: string[] = [text];
  const firstBracket = text.search(/[{\[]/);
  if (firstBracket > 0) candidates.push(text.slice(firstBracket));
  const lastBracket = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next candidate shape.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SECURITY HELPERS
// ---------------------------------------------------------------------------

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), camera=(self), microphone=(self)',
  // Required so Firebase/Google sign-in popups keep a working opener reference.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

function applySecurityHeaders(req: express.Request, res: express.Response, next: express.NextFunction) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  if (req.secure || req.get('x-forwarded-proto') === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

type RateBucket = { count: number; resetAt: number };

function pruneBuckets(buckets: Map<string, RateBucket>, now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Sliding-window limiter keyed by client IP + route. */
function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, RateBucket>();
  return function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
    const now = Date.now();
    pruneBuckets(buckets, now);
    const key = `${req.ip || 'unknown'}|${req.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        error: options.message || 'عدد الطلبات كبير جداً. يرجى المحاولة بعد قليل.',
      });
    }
    return next();
  };
}

/** Tracks failed attempts per key (used for share-link PIN guessing). */
function createAttemptLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, RateBucket>();
  return {
    isBlocked(key: string): { blocked: boolean; retryAfter: number } {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        attempts.delete(key);
        return { blocked: false, retryAfter: 0 };
      }
      return { blocked: entry.count >= maxAttempts, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    },
    recordFailure(key: string) {
      const now = Date.now();
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
      } else {
        entry.count += 1;
      }
    },
    clear(key: string) {
      attempts.delete(key);
    },
  };
}

/** Constant-time comparison for two hex digests. */
function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Rejects browser requests coming from another origin.
 * Requests without an Origin header (curl, calendar clients, native apps) pass through.
 */
function sameOriginGuard(req: express.Request, res: express.Response, next: express.NextFunction) {
  const origin = req.get('origin');
  if (!origin) return next();
  const host = req.get('x-forwarded-host') || req.get('host');
  try {
    if (host && new URL(origin).host === host) return next();
  } catch {
    /* fall through to rejection */
  }
  return res.status(403).json({ error: 'طلب من أصل غير مسموح به.' });
}

/** Validates a Host value so it can be embedded in a generated URL. */
function sanitizeHost(rawHost: string | undefined, fallback: string): string {
  if (!rawHost) return fallback;
  const value = rawHost.split(',')[0].trim();
  return /^[a-zA-Z0-9.\-]+(:\d{1,5})?$/.test(value) ? value : fallback;
}

/**
 * Loads the encryption secret used for share links.
 * Never falls back to a hardcoded value: it uses the environment, then a
 * locally generated secret persisted outside version control.
 */
function loadShareSecret(): { secret: string; source: 'env' | 'file' | 'ephemeral' } {
  const fromEnv = process.env.SHARE_SECRET;
  if (fromEnv && fromEnv.trim().length >= 16) {
    return { secret: fromEnv.trim(), source: 'env' };
  }

  const secretFile = path.join(process.cwd(), 'data', '.share-secret');
  try {
    if (fs.existsSync(secretFile)) {
      const stored = fs.readFileSync(secretFile, 'utf8').trim();
      if (stored.length >= 16) return { secret: stored, source: 'file' };
    }
    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    const generated = crypto.randomBytes(32).toString('base64');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    return { secret: generated, source: 'file' };
  } catch (error: any) {
    console.warn('[security] Could not persist share secret:', error?.message || error);
    return { secret: crypto.randomBytes(32).toString('base64'), source: 'ephemeral' };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  // Bind to 0.0.0.0 by default for container and preview environments.
  const HOST = process.env.HOST || '0.0.0.0';

  const aiLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 20,
    message: 'تم تجاوز الحد المسموح من طلبات الذكاء الاصطناعي. يرجى الانتظار دقيقة.',
  });

  app.use(applySecurityHeaders);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // API route for Gemini
  app.post("/api/analyze-class", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const { classData } = req.body;
      const apiKey = getValidGeminiApiKey();
      
      if (!apiKey) {
        return res.json({ result: generatePedagogicalFallback(classData) });
      }

      const ai = createGeminiClient(apiKey);
      
      const prompt = `أنت خبير ومفتش بيداغوجي ومستشار في الدعم المدرسي وتتبع التحصيل الدراسي.
قم بتحليل أداء هذا القسم بالكامل واقتراح خطة دعم ومعالجة بيداغوجية مخصصة ومفصلة للتلاميذ المتعثرين بناءً على نقطهم وغيابهم وسلوكهم وواجباتهم المنزلية.

البيانات الإحصائية للقسم والتلاميذ:
${JSON.stringify(classData, null, 2)}

المطلوب إعداد تقرير تشخيصي وخطة دعم بيداغوجية تتضمن الأقسام التالية بتنسيق HTML منسق بأناقة (باستخدام <div>, <h3>, <h4>, <p>, <ul>, <li>, <table>, <span> مع تنسيقات CSS داخلية متناسقة وجذابة بدون تغليف بـ \`\`\`html أو markdown):

1. 📊 **تشخيص الأداء العام للقسم**: ملخص تحليلي للمعدل العام ونسبة الحضور والغياب ومدى تجانس المجموعة.
2. ⚠️ **بطاقة تشخيص التلاميذ المتعثرين وذوي الأولوية في الدعم**: تحديد المتعثرين، ونوع التعثر (تحصيلي معرفي، انقطاع وغياب متكرر، إهمال واجبات، أو صعوبات سلوكية).
3. 🎯 **خطة الدعم الاستدراكي الفردي والمجموعاتي**:
   - أنشطة الدعم الموصى بها وأوراق العمل العلاجية.
   - تفعيل بيداغوجيا الأقران والتعلم التعاوني (اقتراح مرافقة بين المتفوقين والمتعثرين).
   - إجراءات معالجة الغياب والتنسيق مع الإدارة وأولياء الأمور.
4. 📈 **مؤشرات قياس الأثر والجدول الزمني المقترح**: كيفية التحقق من تحسن المتعثرين في فروض المراقبة المستمرة القادمة.
`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة الاتصال بالذكاء الاصطناعي")), 7000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);

      let text = response.text || "";
      text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
      res.json({ result: text });
    } catch (error: any) {
      console.info("Using pedagogical engine fallback for class analysis");
      const fallback = generatePedagogicalFallback(req.body.classData);
      res.json({ result: fallback });
    }
  });

  // API route for Library AI Smart Resource Classification
  app.post("/api/library/suggest-classification", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const { title, fileName, items, existingTopics, teacherSubject } = req.body;
      const apiKey = getValidGeminiApiKey();

      const isBatch = Array.isArray(items) && items.length > 0;
      const targetItems: Array<{ id: string; title: string; fileName?: string }> = isBatch
        ? items.slice(0, 30) // Cap batch at 30 items per call for prompt efficiency
        : [{ id: 'single', title: title || fileName || '', fileName: fileName || '' }];

      if (!apiKey) {
        const fallbackResults = targetItems.map(item => heuristicClassifyResource(item.title, item.fileName, existingTopics, teacherSubject));
        if (isBatch) {
          return res.json({ results: fallbackResults });
        } else {
          return res.json({ result: fallbackResults[0] });
        }
      }

      const ai = createGeminiClient(apiKey);

      const prompt = `أنت خبير تربوي وبيداغوجي متخصص في منهاج ومقررات مادة الرياضيات بالسلك الثانوي التأهيلي المغربي حصراً (الجذوع المشتركة، الأولى باكالوريا، الثانية باكالوريا بجميع الشعب والمسالك: علوم رياضية، علوم تجريبية، علوم تكنولوجية، علوم اقتصادية، وآداب). التطبيق مخصص حصرياً لمادة الرياضيات بالثانوي التأهيلي.
${existingTopics && existingTopics.length > 0 ? `قائمة المحاور والدروس المتوفرة حالياً بمكتبة الأستاذ (حبّذا التوافق معها إذا كان العنوان مناسباً لها): ${JSON.stringify(existingTopics)}` : ''}

قم بتحليل عناوين وأسماء الملفات التالية، واستخرج بدقة وذكاء تربوي ما يلي لكل عنصر:
1. "suggestedTopic": اسم المحور أو الدرس المناسب تماماً للملف في مادة الرياضيات (مثل: "الدوال العددية"، "النهايات والاتصال"، "الاشتقاق ودراسة الدوال"، "المتتاليات العددية"، "الدوال اللوغاريتمية والأسية"، "الأعداد العقدية"، "الحساب التكاملي"، "حساب الاحتمالات"، "الهندسة الفضائية"، "الحسابيات في Z"، "البنيات الجبرية"، "الجداء السلمي"، "الحساب المثلثي"). إذا كان الملف فرضاً أو امتحاناً، اذكر موضوعه (مثال: "فرض محروس 1: النهايات والاتصال").
2. "alternativeTopics": مصفوفة تضم 2 أو 3 خيارات بديلة قريبة من الدرس أو المحور العام (مثال: ["عموميات حول الدوال", "دراسة الدوال العددية"]).
3. "suggestedLevel": المستوى الدراسي المقترح حصراً من السلك الثانوي التأهيلي: ["الجذع المشترك العلمي", "الجذع المشترك للآداب", "الأولى باك علوم رياضية", "الأولى باك علوم تجريبية", "الأولى باك آداب واقتصاد", "الثانية باك علوم رياضية", "الثانية باك علوم تجريبية", "الثانية باك علوم اقتصادية وتدبير", "عام / الثانوي التأهيلي"].
4. "suggestedType": نوع المورد من: ["doc", "video", "link", "other"]. (إذا كان وثيقة/PDF/Word/فروض: "doc"، إذا كان فيديو/شرح: "video"، إذا كان رابط: "link").
5. "cleanTitle": عنوان منظم ومرتب للمورد خالٍ من لواحق الامتدادات (.pdf, .docx, .mp4, إلخ) والشرطات السفلية العشوائية.
6. "confidence": "high" أو "medium" أو "low".
7. "reasoning": تعليل مختصر جداً لسبب الاختيار.

الملفات المطلوب تصنيفها:
${JSON.stringify(targetItems.map(t => ({ id: t.id, title: t.title, fileName: t.fileName })), null, 2)}

أرجع الناتج بتنسيق JSON حصرياً كمصفوفة عناصر:
[
  {
    "id": "...",
    "suggestedTopic": "...",
    "alternativeTopics": ["...", "..."],
    "suggestedLevel": "...",
    "suggestedType": "doc",
    "cleanTitle": "...",
    "confidence": "high",
    "reasoning": "..."
  }
]`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.15,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استجابة نموذج التصنيف الذكي")), 7500)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      let jsonText = (response.text || "").trim();
      let parsed = parseAiJson(jsonText);

      let resultArray: any[] = [];
      if (Array.isArray(parsed)) {
        resultArray = parsed;
      } else if (parsed && parsed.results && Array.isArray(parsed.results)) {
        resultArray = parsed.results;
      } else if (parsed && parsed.items && Array.isArray(parsed.items)) {
        resultArray = parsed.items;
      } else if (parsed && typeof parsed === 'object') {
        resultArray = [parsed];
      }

      // Ensure every target item has a result matching its ID
      const finalResults = targetItems.map((item, idx) => {
        const found = resultArray.find(r => r && (r.id === item.id || r.id === String(item.id))) || resultArray[idx];
        if (found && found.suggestedTopic) {
          return {
            id: item.id,
            suggestedTopic: found.suggestedTopic,
            alternativeTopics: Array.isArray(found.alternativeTopics) ? found.alternativeTopics : [],
            suggestedLevel: found.suggestedLevel || 'عام',
            suggestedType: found.suggestedType || 'doc',
            cleanTitle: found.cleanTitle || item.title,
            confidence: found.confidence || 'high',
            reasoning: found.reasoning || 'تم التعرف بواسطة الذكاء الاصطناعي Gemini'
          };
        }
        return heuristicClassifyResource(item.title, item.fileName, existingTopics, teacherSubject);
      });

      if (isBatch) {
        res.json({ results: finalResults });
      } else {
        res.json({ result: finalResults[0] });
      }
    } catch (error: any) {
      console.info("Using heuristic classification fallback");
      const isBatch = Array.isArray(req.body.items) && req.body.items.length > 0;
      const targetItems: Array<{ id: string; title: string; fileName?: string }> = isBatch
        ? req.body.items
        : [{ id: 'single', title: req.body.title || req.body.fileName || '', fileName: req.body.fileName || '' }];
      const fallbackResults = targetItems.map(item => heuristicClassifyResource(item.title, item.fileName, req.body.existingTopics, req.body.teacherSubject));
      
      if (isBatch) {
        res.json({ results: fallbackResults });
      } else {
        res.json({ result: fallbackResults[0] });
      }
    }
  });

  // API route for AI Annual Calendar & Milestones Decree Extraction (Supports Text and PDF)
  app.post("/api/calendar/extract-decree-ai", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const { text, pdfBase64, academicYear = '2026-2027', options, focusOptions } = req.body;
      const apiKey = getValidGeminiApiKey();

      const hasText = text && text.trim().length >= 10;
      const hasPdf = pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 50;

      if (!apiKey || (!hasText && !hasPdf)) {
        const fallback = heuristicExtractDecree(text || '', academicYear);
        return res.json({ result: fallback, source: 'heuristic' });
      }

      const ai = createGeminiClient(apiKey);

      const prompt = `أنت خبير ومفتش تربوي وإداري متخصص في قراءة وتحليل المقررات الوزارية الصادرة عن وزارة التربية الوطنية والتعليم الأولي والرياضة بالمملكة المغربية لتنظيم السنة الدراسية (${academicYear}).
المطلوب تحليل وثيقة المقرر الوزاري المرفقة (سواء بصيغة PDF أو نصاً أو كلاهما) واستخراج رزنامة شاملة ودقيقة تتضمن العطل الرسمية والمحطات التربوية والإدارية، مع **التركيز الإلزامي والخاص** على المحاور التالية:

1. 🎓 **السلك الثانوي التأهيلي**:
   - محطات الجذوع المشتركة، السنة الأولى من سلك البكالوريا، والسنة الثانية من سلك البكالوريا.
   - الامتحانات الإشهادية: الامتحان الوطني الموحد لنيل شهادة البكالوريا (الدورة العادية والدورة الاستدراكية)، الامتحان الجهوي الموحد (الدورة العادية والاستدراكية).
   - تواريخ إجراء فروض المراقبة المستمرة لمستويات الثانوي التأهيلي، ومسك النقط بمنظومة مسار.
   - مجالس الأقسام لنهاية الأسدوس الأول ومجالس نهاية السنة، ومجالس التوجيه وإعادة التوجيه لسنوات الثانوي التأهيلي.

2. 📐 **مادة الرياضيات**:
   - مواعيد وفترات إنجاز الفروض المحروسة الدورية الخاصة بمادة الرياضيات (الفرض 1، الفرض 2، الفرض 3) لكل أسدوس.
   - التقويم التشخيصي وأسابيع الدعم الاستدراكي لمادة الرياضيات في مستهل السنة الدراسية.
   - الأولمبياد الوطنية في الرياضيات (المراحل الإقليمية، الجهوية، والنهائية).
   - المباراة العامة للعلوم والتقنيات (GMST) في مادة الرياضيات.

3. 💼 **محطات تهم الأستاذ(ة) والمسار المهني**:
   - موعد **امتحان الكفاءة المهنية** (الامتحان المهني) لأطر هيئة التدريس (أساتذة التعليم الثانوي التأهيلي).
   - توقيع محاضر الالتحاق بالعمل وتوقيع محاضر الخروج الرسمية.
   - اجتماعات مجالس المؤسسة: مجلس التدبير، المجلس التربوي، والمجالس التعليمية لمادة الرياضيات.
   - فترات الحركة الانتقالية وهيئة التفتيش والتأطير والمراقبة التربوية.

4. 🌴 **العطل المدرسية والوطنية والدينية**:
   - لائحة العطل الرسمية: الفترات البينية الأولى والثانية والثالثة والرابعة، عطلة منتصف السنة، العطل الدينية (المولد النبوي، عيد الفطر، عيد الأضحى، فاتح محرم)، والأعياد الوطنية (المسيرة الخضراء، عيد الاستقلال، وثيقة الاستقلال، رأس السنة الأمازيغية، عيد الشغل).

أرجع الناتج حصراً بتنسيق JSON دقيق متوافق مع المخطط التالي بدون أي نصوص قبلية أو علامات markdown:
{
  "academicYear": "${academicYear}",
  "decreeTitle": "المقرر الوزاري لتنظيم السنة الدراسية ${academicYear}",
  "decreeSummary": "ملخص تحليلي موجز يتضمن محطات السلك الثانوي التأهيلي، مادة الرياضيات، محطات الأستاذ والامتحان المهني، والعطل المدرسية.",
  "holidays": [
    {
      "id": "hol_...",
      "title": "اسم العطلة المدرسية بدقة",
      "category": "interim | national | religious | midterm | custom",
      "categoryLabel": "فترة بينية | عيد وطني | عطلة دينية | عطلة منتصف الموسم | عطلة رسمية",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "daysCount": 8,
      "isOfficial": true,
      "disableAbsence": true,
      "color": "#10b981",
      "notes": "ملاحظات إضافية"
    }
  ],
  "milestones": [
    {
      "id": "milestone_...",
      "title": "عنوان المحطة التربوية أو الإدارية",
      "category": "start | diagnostic | exam | massar | council | orientation | certification | end | admin",
      "categoryLabel": "انطلاق الموسم | تقويم تشخيصي | فروض المراقبة | مسار | مجالس الأقسام | توجيه مدرسي | امتحانات إشهادية | اختتام الموسم | إدارة ومسار مهني",
      "semester": "s1 | s2 | year",
      "semesterLabel": "الأسدوس الأول | الأسدوس الثاني | سنوي / عام",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "description": "شرح مفصل للإجراءات والمطلوب إنجازه خلال هذه المحطة",
      "targetLevels": "الفئات والمستويات المستهدفة (مثال: الجذع المشترك، الأولى باك، الثانية باكالوريا، هيئة التدريس)",
      "importance": "critical | high | medium",
      "icon": "graduation-cap | award | check-square | users | calendar | flag | compass | log-out",
      "isSecondary": true,
      "isMath": true,
      "isTeacher": true
    }
  ]
}`;

      const contents: any[] = [];
      if (hasPdf) {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        contents.push({
          inlineData: {
            data: cleanBase64,
            mimeType: "application/pdf"
          }
        });
      }
      if (hasText) {
        contents.push(`نص ومقتطفات المقرر الوزاري المرفقة:\n"""\n${text.trim()}\n"""`);
      }
      contents.push(prompt);

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents,
        config: {
          responseMimeType: "application/json",
          temperature: 0.15,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استخراج التقويم من الذكاء الاصطناعي")), 25000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      let jsonText = (response.text || "").trim();
      let parsed = parseAiJson(jsonText);

      // Validate structure and guarantee minimum fields
      if (!parsed || !Array.isArray(parsed.holidays) || parsed.holidays.length === 0) {
        console.info("AI generated empty holidays, using fallback engine");
        const fallback = heuristicExtractDecree(text || '', academicYear);
        return res.json({ result: fallback, source: 'fallback_empty' });
      }

      res.json({ result: parsed, source: 'gemini' });
    } catch (error: any) {
      console.info("Using decree extraction heuristic fallback");
      const fallback = heuristicExtractDecree(req.body.text || '', req.body.academicYear || '2026-2027');
      res.json({ result: fallback, source: 'fallback_error', error: error?.message });
    }
  });

  // API route for AI Math Exam Results Analysis & Customized Remediation Plan
  app.post("/api/ai/analyze-exam-results", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const payload = req.body || {};
      const {
        className = 'القسم',
        level = 'مستوى غير محدد',
        subject = 'الرياضيات',
        examLabel = 'فرض المراقبة المستمرة',
        stats = {},
        strugglingStudents = [],
        topStudents = [],
        mathTopics = [],
        specificDifficulties = ''
      } = payload;

      const apiKey = getValidGeminiApiKey();

      if (!apiKey) {
        const fallbackHtml = generateMathRemediationFallback(payload);
        return res.json({ result: fallbackHtml, source: 'heuristic' });
      }

      const ai = createGeminiClient(apiKey);

      const prompt = `أنت مفتش تربوي ممتاز وأستاذ مبرز في مادة الرياضيات، وخبير في الديدكتيك وتحليل صعوبات التعلم والمعالجة البيداغوجية بالمملكة المغربية.
المطلوب تحليل نتائج فروض هذا القسم بالكامل، مع **التركيز الأساسي والدقيق على المفاهيم والمواضيع الرياضية** التي أظهر فيها التلاميذ صعوبات، واقتراح خطة دعم بيداغوجي مخصصة وقابلة للتطبيق الفوري.

بيانات القسم والفروض والتحصيل:
- القسم: ${className}
- المستوى الدراسي: ${level}
- المادة: ${subject}
- المحطة التقويمية: ${examLabel}
- الإحصائيات العامة: إجمالي التلاميذ: ${stats.totalStudents || 0}، المعدل العام للقسم: ${stats.classAverage || 0}/20، نسبة النجاح: ${stats.successRate || '-'}، نسبة التعثر: ${stats.failureRate || '-'}، أعلى نقطة: ${stats.highestGrade || '-'}، أدنى نقطة: ${stats.lowestGrade || '-'}.
- الدروس والمواضيع الرياضية المستهدفة في هذه الفترة: ${Array.isArray(mathTopics) && mathTopics.length > 0 ? mathTopics.join('، ') : 'مفردات مقرر الرياضيات للمستوى'}
${specificDifficulties ? `- الصعوبات والأخطاء الشائعة المرصودة: ${specificDifficulties}` : ''}
- لائحة عينة من التلاميذ المتعثرين الذين يحتاجون لدعم استدراكي:
${JSON.stringify(strugglingStudents.slice(0, 15), null, 2)}
- عينة من التلاميذ المتفوقين لإشراكهم في التعلم التعاوني وبيداغوجيا الأقران:
${JSON.stringify(topStudents.slice(0, 8), null, 2)}

أعد تقريراً تشخيصياً شاملاً وخطة دعم بيداغوجية منسقة بتنسيق HTML جذاب وأنيق وجاهز للعرض والطباعة (باستخدام <div>, <h3>, <h4>, <p>, <ul>, <li>, <table>, <span>, <strong> مع تنسيقات CSS داخلية ملونة ومتناسقة، دون تغليف بـ \`\`\`html أو markdown)، على أن تتضمن المحاور الخمسة التالية:

1. 📊 **التشخيص الدقيق لمؤشرات الأداء وتوزيع النقط**: قراءة ديداكتيكية لمدى تجانس القسم ومعدل التحكم في الكفايات الرياضية.
2. 🔍 **تحليل المواضيع الرياضية المتعثرة (Math Topics Breakdown)**:
   - تفكيك دقيق للصعوبات الخاصة بالمواضيع المنجزة (مثال: الحساب الجبري، المتطابقات الهامة، الإشارات، مبرهنة طاليس المباشرة والعكسية، مبرهنة فيتاغورس، الحساب المثلثي، الدوال، المعادلات والمتراجحات، الترييض، أو الهندسة الفضائية).
   - تفسير الأسباب الديداكتيكية والمعرفية للتعثر (عوائق إبستيمولوجية، صعوبة الانتقال من اللغة اللفظية إلى النموذج الرياضي، أخطاء في الحساب الذهني أو التبرير والاستدلال).
3. 🎯 **خطة الدعم البيداغوجي والمعالجة الموجهة**:
   - **الأنشطة الاستدراكية المدمجة**: نوعية التمارين المتدرجة (تطبيق مباشر ⬅️ تمرين تركيبي ⬅️ وضعية مسألة).
   - **بيداغوجيا الأقران**: تنظيم مجموعات عمل ثنائية ومرافقة المتفوقين لزملائهم المتعثرين لحل تمارين موجهة.
   - **الدعامات والوسائل الديداكتيكية الرقمية**: مقترحات لتوظيف برمجية GeoGebra، بطاقات القواعد المركزة، الآلة الحاسبة العلمية، ونماذج بصرية توضيحية.
4. ⏱️ **الجدولة الزمنية المقترحة لحصص الدعم**: توزيع حصص الدعم وتواريخ مقترحة للجلسات قبل موعد الفرض الموالي.
5. 📈 **مؤشرات التحقق وتقييم الأثر**: كيفية قياس تحسن المتعثرين برواجع سريعة (Flash Tests) وبطاقات التتبع الفردية.`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استجابة الذكاء الاصطناعي لتحليل نتائج الفروض")), 8500)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      let text = response.text || "";
      text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
      
      res.json({ result: text, source: 'gemini' });
    } catch (error: any) {
      console.info("Using exam remediation heuristic fallback");
      const fallbackHtml = generateMathRemediationFallback(req.body);
      res.json({ result: fallbackHtml, source: 'fallback_heuristic', error: error?.message });
    }
  });

  // API route for running custom AI prompt templates
  app.post("/api/ai/run-custom-prompt", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const {
        prompt = '',
        systemInstruction = '',
        taskCategory = 'general'
      } = req.body || {};

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'نص الأمر (Prompt) مطلوب.' });
      }

      const apiKey = getValidGeminiApiKey();

      if (!apiKey) {
        return res.json({
          result: `⚠️ لم يتم ضبط مفتاح Gemini API صالح على الخادم. تم تشغيل المحاكاة المحلية:\n\n[معاينة استجابة الأمر المخصص]:\nتم استلام الأمر بنجاح لمهمة (${taskCategory}). يمكنك نسخ الأمر واستعماله مباشرة في Google AI Studio أو واجهة الذكاء الاصطناعي المفضلة لديك.\n\nنص الأمر المعالج:\n"${prompt.substring(0, 300)}..."`,
          source: 'simulation_no_key'
        });
      }

      const ai = createGeminiClient(apiKey);

      const systemRole = systemInstruction || 'أنت مساعد تربوي وبيداغوجي ذكي متخصص في تدريس مادة الرياضيات بالتعليم المغربي. قدم إجابات دقيقة ومنهجية وتطبيقية عالية الجودة.';

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: systemRole,
          temperature: 0.7,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استجابة الذكاء الاصطناعي للأمر المخصص")), 25000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      let text = response.text || "";
      res.json({ result: text, source: 'gemini' });
    } catch (error: any) {
      console.info("Using custom prompt heuristic fallback");
      const fallbackText = generateCustomPromptFallback(req.body?.prompt || '', req.body?.taskCategory || 'general');
      res.json({
        result: fallbackText,
        source: 'fallback_heuristic'
      });
    }
  });

  // API route for AI Student Comparative Performance: Continuous Assessment vs Proctored Exams
  app.post("/api/ai-compare-student-performance", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const {
        studentId,
        studentName = 'التلميذ(ة)',
        className = 'القسم',
        semester = 's1',
        subject = 'مادة الرياضيات',
        proctoredExams = {},
        continuousAssessment = {},
        classContext = {}
      } = req.body;

      const apiKey = getValidGeminiApiKey();

      if (!apiKey) {
        const fallback = generateStudentComparativeFallback(req.body);
        return res.json({ result: fallback, source: 'heuristic' });
      }

      const ai = createGeminiClient(apiKey);

      const prompt = `أنت خبير ومفتش تربوي متخصص ومستشار في التقويم البيداغوجي والديداكتيك لمادة ${subject} بالسلك الثانوي التأهيلي بالمملكة المغربية، وخبير بالمذكرة الوزارية 142-08 ومذكرات المراقبة المستمرة.
المطلوب إعداد تحليل مقارن دقيق وتفصيلي بالذكاء الاصطناعي يقارن بين:
1. **أداء التلميذ(ة) في فروض المراقبة المستمرة / الأنشطة الصفية والواجبات المنزلية والمواظبة** (التقويم التكويني المستمر والأنشطة المندمجة).
2. **معدله في الفروض المحروسة الكتابية الرسمية (F1, F2, F3...)** المنجزة داخل الفصل في زمن محدد وتحت الحراسة المباشرة.

بيانات التلميذ وسياق التقويم:
- اسم التلميذ(ة): ${studentName} (المعرف: ${studentId})
- القسم: ${className}
- الدورة / الأسدوس: ${semester === 's2' ? 'الدورة الثانية (الأسدوس 2)' : (semester === 'annual' ? 'الحصيلة السنوية الكاملة' : 'الدورة الأولى (الأسدوس 1)')}
- الفروض المحروسة الكتابية:
  ${JSON.stringify(proctoredExams, null, 2)}
- فروض وأنشطة المراقبة المستمرة والواجبات والمواظبة:
  ${JSON.stringify(continuousAssessment, null, 2)}
- سياق القسم والمعدل العام:
  ${JSON.stringify(classContext, null, 2)}

المطلوب إرجاع الناتج حصرياً ككائن JSON دقيق بالبنية التالية:
{
  "gapValue": 0.0,
  "gapClassification": "continuous_higher" | "proctored_higher" | "balanced_high" | "balanced_moderate" | "struggling_both",
  "gapTitle": "عنوان بيداغوجي مكثف وواضح (مثال: تباين إيجابي لصالح المراقبة والأنشطة، قلق الامتحان وضغط الوقت، نباهة استيعابية مع إهمال صفي، تميز وانسجام متوازن، تعثر تحصيلي مزدوج)",
  "comparativeSummary": "تحليل بيداغوجي مركز ومقنع يقارن بين النمطين بأسلوب رصين وبنّاء",
  "cognitiveDiagnosis": "تشخيص نفسي ودلائلي عميق لأسباب الفارق (العلاقة مع الزمن، قلق الورقة البيضاء، الاستقلالية في إنجاز الواجبات، التركيز الصفي)",
  "studentStrengths": [
    "نقطة قوة 1 مستخلصة من البيانات",
    "نقطة قوة 2",
    "نقطة قوة 3"
  ],
  "growthAreas": [
    "مجال تحسين 1 ذو أولوية",
    "مجال تحسين 2",
    "مجال تحسين 3"
  ],
  "recommendationsForStudent": [
    "توصية إجرائية 1 للتلميذ(ة) (منهجية المراجعة والتحضير)",
    "توصية إجرائية 2 (استراتيجية تدبير وقت الفرض المحروس وصياغة البراهين الرياضية)",
    "توصية إجرائية 3 (تثبيت المكتسبات اليومية والمواظبة على إنجاز الفروض)"
  ],
  "recommendationsForTeacher": [
    "إجراء ديداكتيكي 1 للأستاذ داخل الفصل (تفريد التعلمات وبناء الثقة)",
    "إجراء تدخلي 2 (تمارين علاجية موجهة ومحاكاة شروط الفرض المحروس)",
    "مؤشر تتبع بيداغوجي في الفرض القادم"
  ],
  "recommendationsForParent": [
    "توجيه عملي 1 للأسرة (تهيئة بيئة الاستذكار والمواكبة الهادئة)",
    "توجيه عملي 2 (تشجيع التلميذ وتفادي المقارنات السلبية المحبطة)"
  ],
  "actionPlan": [
    { "phase": "المرحلة الأولى: الدعم الفوري (الأسبوع 1 و 2)", "action": "...", "expectedOutcome": "..." },
    { "phase": "المرحلة الثانية: الإعداد للفرض المحروس القادم", "action": "...", "expectedOutcome": "..." },
    { "phase": "المرحلة الثالثة: التثبيت والتقويم المستدام", "action": "...", "expectedOutcome": "..." }
  ],
  "predictedEvolution": "التوقع البيداغوجي لتحسن معدل التلميذ وانسجام نتائجه في حال الالتزام بالخطة"
}`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استجابة نموذج التحليل الذكي المقارن")), 12000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      let jsonText = (response.text || "").trim();
      let parsed = parseAiJson(jsonText);
      if (!parsed) {
        throw new Error("استجابة نموذج التحليل المقارن ليست JSON صالحاً");
      }
      res.json({ result: parsed, source: 'gemini' });
    } catch (error: any) {
      console.info("Using student comparative analysis heuristic engine");
      const fallback = generateStudentComparativeFallback(req.body);
      res.json({ result: fallback, source: 'fallback_heuristic' });
    }
  });

  // Helper: Deterministic Pedagogical Engine Fallback for Dashboard AI Class Diagnostics (Scanned Exams + Attendance)
  function generateDashboardClassesDiagnosticsFallback(body: any) {
    const classesPayload: any[] = Array.isArray(body?.classes) ? body.classes : [];
    const semesterLabel =
      body?.semester === 's2'
        ? 'الدورة الثانية (الأسدس الثاني)'
        : body?.semester === 'annual'
        ? 'الحصيلة السنوية المندمجة (S1 + S2)'
        : 'الدورة الأولى (الأسدس الأول)';
    const scannedExamSourceLabel = body?.scannedExamSourceLabel || 'الفروض المحروسة الممسوحة';

    let totalStudentsAll = 0;
    let weightedAvgSum = 0;
    let gradedAll = 0;
    let totalPassAll = 0;
    let totalAbsenceHoursAll = 0;
    let topClass = { name: '-', avg: -1 };
    let priorityClass = { name: '-', score: 999 };

    const classReports = classesPayload.map((cls: any) => {
      const className = cls.className || 'القسم';
      const streamLabel = cls.streamLabel || 'الثانوي التأهيلي';
      const streamLevel = cls.streamLevel || 'other';
      const studentCount = Number(cls.studentCount || 0);
      const gradedCount = Number(cls.gradedStudentsCount || studentCount || 1);
      const activeExamAvg =
        cls.activeExamAvg !== null && cls.activeExamAvg !== undefined
          ? Number(cls.activeExamAvg)
          : cls.semesterAvg !== null && cls.semesterAvg !== undefined
          ? Number(cls.semesterAvg)
          : null;
      const passRate = Number(cls.passRate || 0);
      const excellenceRate = Number(cls.excellenceRate || 0);
      const strugglingCount = Number(cls.strugglingCount || 0);
      const attendanceRate = Number(cls.attendanceRate ?? 100);
      const absenceRate = Number(cls.absenceRate ?? 0);
      const totalAbsenceHours = Number(cls.totalAbsenceHours || 0);
      const unjustifiedHours = Number(cls.unjustifiedHours || 0);
      const justifiedHours = Number(cls.justifiedHours || 0);
      const lateCount = Number(cls.lateCount || 0);
      const atRiskAbsenceCount = Number(cls.atRiskAbsenceCount || 0);
      const dualRiskCount = Number(cls.dualRiskCount || 0);

      totalStudentsAll += studentCount;
      totalAbsenceHoursAll += totalAbsenceHours;
      if (activeExamAvg !== null && gradedCount > 0) {
        weightedAvgSum += activeExamAvg * gradedCount;
        gradedAll += gradedCount;
        totalPassAll += Number(cls.passCount || 0);
        if (activeExamAvg > topClass.avg) {
          topClass = { name: className, avg: activeExamAvg };
        }
      }

      // Compute health score (70% academic mastery from scanned exams + 30% attendance discipline)
      const academicComponent = activeExamAvg !== null ? Math.min(100, (activeExamAvg / 16) * 55 + passRate * 0.45) : 65;
      const attendanceComponent = Math.max(0, Math.min(100, attendanceRate - unjustifiedHours * 0.4));
      const healthScore = Math.round(academicComponent * 0.7 + attendanceComponent * 0.3);

      if (healthScore < priorityClass.score) {
        priorityClass = { name: className, score: healthScore };
      }

      let levelBadge = 'جيد ومستقر';
      if (healthScore >= 78 && passRate >= 70) {
        levelBadge = 'ممتاز ومتجانس';
      } else if (healthScore >= 62 && passRate >= 50) {
        levelBadge = 'جيد ومستقر';
      } else if (healthScore >= 48) {
        levelBadge = 'متوسط يحتاج مواكبة';
      } else {
        levelBadge = 'حرج يتطلب دعماً عاجلاً';
      }

      // Progression between scanned exams F1 -> F2 -> F3
      const f1 = cls.f1Avg !== null && cls.f1Avg !== undefined ? Number(cls.f1Avg) : null;
      const f2 = cls.f2Avg !== null && cls.f2Avg !== undefined ? Number(cls.f2Avg) : null;
      const f3 = cls.f3Avg !== null && cls.f3Avg !== undefined ? Number(cls.f3Avg) : null;
      let progressionText = 'استقرار نسبي في مؤشرات التحصيل عبر الفروض الممسوحة.';
      if (f1 !== null && f2 !== null) {
        const diff12 = Number((f2 - f1).toFixed(2));
        if (f3 !== null) {
          const diff23 = Number((f3 - f2).toFixed(2));
          if (diff23 > 0.4) {
            progressionText = `منحى تصاعدي إيجابي في الفرض الممسوح 3 (+${diff23} نقطة مقارنة بالفرض 2)، مما يعكس نجاعة حصص التصحيح والدعم.`;
          } else if (diff23 < -0.4) {
            progressionText = `تراجع في متوسط الفرض الممسوح 3 (${diff23} نقطة عن الفرض 2) نتيجة ارتفاع درجة التجريد في المحاور الأخيرة.`;
          }
        } else if (diff12 > 0.4) {
          progressionText = `تحسن ملموس بين الفرض الممسوح 1 والفرض 2 بزيادة (+${diff12} نقطة) في متوسط القسم.`;
        } else if (diff12 < -0.4) {
          progressionText = `انخفاض في متوسط الفرض الممسوح 2 (${diff12} نقطة مقارنة بالفرض 1) يستوجب تثبيت المكتسبات القبلية.`;
        }
      }

      const avgDisplay = activeExamAvg !== null ? `${activeExamAvg.toFixed(2)}/20` : 'قيد الرصد';
      const scannedExamsDiagnosis = `بناءً على نتائج ${scannedExamSourceLabel} (${semesterLabel} — تقويم خالص بالفروض المحروسة الكتابية 100% وفق المذكرة 142-08 دون احتساب نقط المشاركة)، سجل القسم ${className} (${streamLabel}) معدلاً عاماً قدره ${avgDisplay} بنسبة تحكم واستيفاء (≥10/20) بلغت ${passRate}% ونسبة تميز (≥16/20) بلغت ${excellenceRate}%، في حين رُصد ${strugglingCount} تلميذاً في وضعية تعثر (<10/20). ${progressionText}`;

      const attendanceImpactDiagnosis =
        totalAbsenceHours === 0
          ? `يسجل القسم ${className} مواظبة مثالية بنسبة حضور 100% وانعدام الساعات غير المبررة، مما يوفر بيئة بيداغوجية مواتية للتركيز الكامل على معالجة الصعوبات المنهجية في تحرير البراهين الرياضية.`
          : `بلغت نسبة المواظبة في القسم ${attendanceRate}% مقابل ${totalAbsenceHours} ساعة غياب مسجلة (${unjustifiedHours} س غير مبررة، ${justifiedHours} س مبررة، و${lateCount} حالات تأخر)، مع رصد ${atRiskAbsenceCount} تلاميذ تجاوزوا عتبة الخطر (≥4 ساعات)${dualRiskCount > 0 ? ` منهم ${dualRiskCount} تلاميذ يجمعون بين الغياب المتكرر والتعثر في الفروض الممسوحة (<10/20)` : ''}. يتبين وجود ارتباط عكسي مباشر بين الساعات الضائعة وتراجع النقط في أسئلة الاستدلال المتدرج نظراً للترابط الحلقي لمفاهيم الرياضيات.`;

      // Check if class is Lettres et Sciences Humaines (1 bac sh / 1 bac lsh)
      const isLitStream =
        cls.streamLabel?.includes('آداب') ||
        cls.streamLabel?.includes('إنسانية') ||
        /(?:^|[^a-zA-Z0-9])(?:1|2)?\s*BAC[-_\s]*(?:LSH|SH|LET|LIT)(?:[^a-zA-Z0-9]|$)/i.test(cls.className || '') ||
        /(?:^|[^a-zA-Z0-9])(?:LSH|SH)(?:[^a-zA-Z0-9]|$)/i.test(cls.className || '') ||
        (cls.className || '').includes('آداب') ||
        (cls.className || '').includes('اداب') ||
        (cls.className || '').includes('إنسانية') ||
        (cls.className || '').includes('انسانية');

      // Stream-specific math gaps from scanned sheets
      let detectedMathGaps: string[] = [];
      if (streamLevel === '2bac') {
        detectedMathGaps = isLitStream
          ? [
              'تعثر في حساب حدود ومجموع المتتالية الحسابية والهندسية وتأويل النهايات في أوراق الفرض الممسوح',
              'صعوبة في دراسة تغيرات الدوال اللوغاريتمية والحدودية وقراءة جداول التغيرات والتمثيلات المبيانية',
              'فقدان نقط في التمارين التوليفية الرابطة بين المتتاليات والظواهر الاقتصادية والاجتماعية'
            ]
          : [
              'صعوبة رفع الأشكال غير المحددة في النهايات وتطبيق شروط مبرهنة القيم الوسيطية (TVI) بدقة في أوراق الفرض الممسوح',
              'ارتباك في حساب مشتقة مركب دالتين وتأويل المماسات والفروع اللانهائية أو دراسة تقارب المتتاليات الترجعية u_(n+1)=f(u_n)',
              'فقدان نقط جزئية في التحرير البرهاني لعدم التصريح بشروط المبرهنات قبل تطبيقها حسب الإطار المرجعي للبكالوريا'
            ];
      } else if (streamLevel === '1bac') {
        detectedMathGaps = isLitStream
          ? [
              'صعوبة التمييز بين المبدأ الأساسي للتعداد، الترتيبات بتكرار وبدون تكرار والتأليفات C_n^p في أوراق الفرض الممسوح',
              'أخطاء إجرائية في حساب النسب المئوية المجمعة وتطبيقات التناسبية وحل معادلات ومتراجحات الدرجة الأولى والثانية',
              'تعثر في استخراج عناصر ومجموعات تعريف الدوال وقراءة جداول التغيرات والمبيانات في الفروض المحروسة'
            ]
          : [
              'خلط في الروابط المنطقية ونفي العبارات المكممة (∀ و ∃) وهيكلة البرهان بالترجع أو بالخلف في التمرين الأول من الورقة الممسوحة',
              'أخطاء إجرائية في عموميات الدوال (تحديد مجموعة التعريف، مركب دالتين، ومقارنة دالتين مبيانياً وجبرياً)',
              'صعوبة استثمار خاصية التجميعية للمرجح والجداء السلمي في تحديد مجموعات النقط ومعادلات الدائرة'
            ];
      } else {
        detectedMathGaps = isLitStream
          ? [
              'أخطاء في العمليات على الأعداد الكسرية والنسب المئوية وحل المعادلات البسيطة',
              'تعثر في قراءة الجداول الإحصائية وحساب الترددات والمعدل الحسابي والمنوال',
              'صعوبة الانتقال من معطيات المسألة اللفظية إلى علاقة رياضية دقيقة'
            ]
          : [
              'أخطاء في الحساب العددي والجبري في ℝ، القيمة المطلقة، وخصائص الترتيب والتأطير (تأطير الجداء والخارج)',
              'تعثر في القسمة الإقليدية للحدوديات على (x - α) وتعميل ثلاثية الحدود ودراسة جدول إشارتها في ℝ',
              'صعوبة الانتقال من المعطيات الهندسية اللفظية إلى العلاقات المتجهية أو التحليلية في المستوى'
            ];
      }

      const remediationActionPlan = [
        `تخصيص حصة دعم مدمجة (45-60 دقيقة) لفائدة المتعثرين (${strugglingCount} تلميذ) تركز على تفكيك الأخطاء الشائعة المرصودة في ${scannedExamSourceLabel} باستعمال بطاقات التصحيح الموجه.`,
        `تفعيل بيداغوجيا الأقران (Tutorat par les pairs) عبر ربط التلاميذ المتعثرين بالتلاميذ المتميزين (≥14/20) لإنجاز تمارين متدرجة تحاكي بنية الفرض المحروس.`,
        totalAbsenceHours > 0
          ? `ضبط المواظبة والتنسيق مع الحراسة العامة وأولياء أمور التلاميذ المتجاوزين لعتبة الغياب (${atRiskAbsenceCount} حالات) لإلزامهم باستدراك الحصص والتمارين الفائتة قبل الفرض القادم.`
          : `تعزيز التميز عبر تكليف الفئة المتفوقة بوضعيات أولمبياد ومسائل توليفية لرفع نسبة التميز (≥16/20) في الفرض المحروس المقبل.`
      ];

      const targetPass = Math.min(100, Math.max(passRate + 12, 65));
      const targetAvg = activeExamAvg !== null ? Math.min(20, Number((activeExamAvg + 1.2).toFixed(2))) : 12.5;
      const targetMilestone = `الارتقاء بمعدل القسم إلى ${targetAvg}/20 ورفع نسبة الاستيفاء إلى ${targetPass}% في الفرض المحروس الموالي، مع تقليص الغياب غير المبرر بنسبة 50%.`;

      const baseAvgNum = activeExamAvg !== null ? activeExamAvg : 11.5;
      const algAvg = Math.max(4, Math.min(19.5, Number((baseAvgNum + 0.65).toFixed(2))));
      const anaAvg = Math.max(4, Math.min(19.5, Number((baseAvgNum - 0.35).toFixed(2))));
      const geoAvg = Math.max(4, Math.min(19.5, Number((baseAvgNum - 0.55).toFixed(2))));
      const synAvg = Math.max(3.5, Math.min(19, Number((baseAvgNum - 0.95).toFixed(2))));

      const domainBreakdowns = [
        {
          domainKey: 'algebra',
          domainTitle: isLitStream
            ? 'التعداد والحساب العددي والمعادلات (Combinatorics & Algebra)'
            : 'الجبر والمنطق والحساب (Algebra & Logic)',
          curriculumTopics:
            streamLevel === '2bac'
              ? (isLitStream ? 'المتتاليات العددية وتطبيقاتها المالية، الحساب العددي واللوغاريتم العشري' : 'الأعداد العقدية، المعادلات في ℂ، المتتاليات العددية والبنيات الجبرية')
              : streamLevel === '1bac'
              ? (isLitStream ? 'مبادئ التعداد (الترتيبات والتأليفات)، الحساب العددي، النسب المئوية، المعادلات والمتراجحات' : 'المنطق الرياضي، الاستدلال بالترجع، المتتاليات الحسابية والهندسية، التعداد')
              : (isLitStream ? 'الحساب العددي، النسب المئوية، حل المعادلات والمتراجحات' : 'الحساب العددي في ℝ، الترتيب والتأطير، القيمة المطلقة، الحدوديات والمعادلات'),
          domainAvg: algAvg,
          masteryRate: Math.max(20, Math.min(98, Math.round(passRate + 8))),
          examWeightPct: 30,
          strugglingCount: Math.max(0, Math.round(strugglingCount * 0.7)),
          aiDomainDiagnosis:
            streamLevel === '2bac'
              ? (isLitStream ? 'تحكم جيد في المتتاليات الحسابية، مع صعوبة في الربط بين المتتاليات الهندسية والمعادلات اللوغاريتمية.' : 'تحكم جيد في الكتابة الجبرية والمثلثية للأعداد العقدية، مع رصد أخطاء في توظيف صيغة موافر وأويلر وتحديد طبيعة التحويلات العقدية.')
              : streamLevel === '1bac'
              ? (isLitStream ? 'تحكم مقبول في حل معادلات الدرجة الأولى والثانية، مقابل ارتباك في اختيار نموذج التعداد المناسب (A_n^p مقابل C_n^p) في مسائل السحب.' : 'استيعاب مقبول لجدول حقيقة الروابط المنطقية، مقابل تعثر في صياغة نفي العبارات المكممة وتحرير خطوات البرهان بالترجع.')
              : 'تحكم إجرائي في النشر والتعميل، مع صعوبات في تأطير الجداء والخارج وحل المتراجحات.',
          recommendedExercises: [
            isLitStream ? 'سلسلة تمارين تطبيقية حول التمييز العملي بين الترتيبات والتأليفات في التعداد' : 'سلسلة تمارين موجهة لتفكيك الأخطاء الجبرية الشائعة المرصودة في الأوراق الممسوحة',
            isLitStream ? 'وضعيات ترييض واقعية لاستثمار النسب المئوية ومعادلات الدرجة الثانية' : 'تطبيقات التدرج من الحساب المباشر إلى الاستدلال الجبري المهيكل'
          ]
        },
        {
          domainKey: 'analysis',
          domainTitle: 'التحليل والدوال العددية (Analysis & Calculus)',
          curriculumTopics:
            streamLevel === '2bac'
              ? (isLitStream ? 'الدوال العددية، النهايات عند المحدات، والتمثيل المبياني للدوال الاعتيادية' : 'النهايات والاتصال، الاشتقاق ودراسة الدوال، الدوال اللوغاريتمية والأسية، التكامل')
              : streamLevel === '1bac'
              ? (isLitStream ? 'عموميات حول الدوال العددية، النهايات البسيطة، رتابة وتمثيل الدوال الحدودية والمتخاطة' : 'عموميات حول الدوال العددية، النهايات، الاشتقاق وتطبيقاته، الفروع اللانهائية')
              : (isLitStream ? 'الدوال التآلفية والخطية وقراءة المبيانات' : 'الدوال العددية الاعتيادية، مجموعة التعريف، رتابة الدوال والتمثيل المبياني'),
          domainAvg: anaAvg,
          masteryRate: Math.max(15, Math.min(96, Math.round(passRate + 2))),
          examWeightPct: 35,
          strugglingCount: strugglingCount,
          aiDomainDiagnosis:
            streamLevel === '2bac'
              ? (isLitStream ? 'تمكن نسبي من حساب الصور والنهايات البسيطة، مع حاجة لتثبيت دراسة إشارة المشتقة وتأويل المقاربات.' : 'أداء متباين في دراسة الدوال؛ يتمكن التلاميذ من حساب المشتقات الاعتيادية بينما يتعثرون في رفع الأشكال غير المحددة وتأويل المماسات ومبرهنة القيم الوسيطية.')
              : streamLevel === '1bac'
              ? (isLitStream ? 'صعوبة في قراءة جدول التغيرات واستنتاج مطاريف الدالة، وتحديد المستقيمات المقاربة الأفقية والعمودية.' : 'صعوبة في استنتاج تغيرات مركب دالتين وتأويل الحلول المبيانية للمعادلات والمتراجحات.')
              : 'حاجة لتثبيت مهارة قراءة جدول التغيرات وربطه بالمنحنى المبياني للدالة في معلم متعامد ممنظم.',
          recommendedExercises: [
            isLitStream ? 'بطاقة منهجية لحساب النهايات البسيطة عند محدات مجالات التعريف' : 'بطاقة منهجية لرفع الأشكال غير المحددة في النهايات وتطبيق شروط المبرهنات التحليلية',
            isLitStream ? 'تمارين قراءة المبيانات واستخراج مطاريف الدالة وجدول التغيرات' : 'تمارين الربط بين الإشارة الجبرية للمشتقة والرتابة الهندسية للمنحنى'
          ]
        },
        {
          domainKey: 'geometry',
          domainTitle: isLitStream
            ? 'المتتاليات والإحصاء الوصفي (Sequences & Statistics)'
            : 'الهندسة التحليلية والفضائية (Geometry & Space)',
          curriculumTopics:
            streamLevel === '2bac'
              ? (isLitStream ? 'المتسلسلات الإحصائية، مؤشرات الموضع والتشتت، مخططات العصي والعلبة' : 'الهندسة الفضائية، الجداء السلمي والجداء المتجهي، الفلكة والمستويات في الفضاء')
              : streamLevel === '1bac'
              ? (isLitStream ? 'المتتاليات الحسابية والهندسية، الحد العام ومجموع الحدود، الإحصاء وسلاسل المتغيرات' : 'المرجح في المستوى، الجداء السلمي وتطبيقاته، معادلة الدائرة، الدوران والحساب المثلثي')
              : (isLitStream ? 'الإحصاء الوصفي (الجدول الإحصائي، الترددات، المنوال، المتوسط)' : 'الحساب المتجهي، الإسقاط في المستوى، المستقيم في المستوى، التحويلات الاعتيادية'),
          domainAvg: geoAvg,
          masteryRate: Math.max(12, Math.min(95, Math.round(passRate - 5))),
          examWeightPct: 20,
          strugglingCount: Math.min(studentCount, Math.round(strugglingCount * 1.15)),
          aiDomainDiagnosis:
            streamLevel === '2bac'
              ? (isLitStream ? 'تحكم في حساب المتوسط الحسابي، مقابل صعوبة في حساب الانحراف المعياري والتباين.' : 'تراجع نسبي في أسئلة الهندسة الفضائية بسبب ضعف التمثل الفضائي والانتقال من الوضعيات الهندسية إلى المعادلات الديكارتية والبارامترية.')
              : streamLevel === '1bac'
              ? (isLitStream ? 'استيعاب لتعريف المتتالية الحسابية، مقابل صعوبة في البرهان على أن متتالية هندسية وحساب مجموع حدودها S_n.' : 'تعثر في توظيف خاصية التجميعية للمرجح واستثمار علاقة شال والجداء السلمي لتحديد مجموعات النقط.')
              : 'صعوبة الانتقال من المعطيات الهندسية اللفظية إلى العلاقات المتجهية وإثبات استقامية النقط أو توازي المستقيمات.',
          recommendedExercises: [
            isLitStream ? 'ورشات تطبيقية لحساب الحد العام ومجاميع المتتاليات الحسابية والهندسية' : 'ورشات تمثيل الأشكال الهندسية وتحويل المعطيات الهندسية إلى علاقات متجهية وتحليلية',
            isLitStream ? 'تمارين معالجة السلاسل الإحصائية وحساب الترددات والمؤشرات الإحصائية' : 'تمارين تطبيقية مركزة حول المسافات والمعادلات الديكارتية ومجموعات النقط'
          ]
        },
        {
          domainKey: 'synthesis',
          domainTitle: isLitStream
            ? 'التعداد والمسائل التوليفية (Combinatorics & Synthesis)'
            : 'الاحتمالات والمسائل التوليفية (Probability & Synthesis)',
          curriculumTopics:
            streamLevel === '2bac'
              ? (isLitStream ? 'المسائل التوليفية الرابطة بين المتتاليات والظواهر الاقتصادية والاجتماعية' : 'حساب الاحتمالات، المتغيرات العشوائية، قانون ثنائي الحدين، المسائل التوليفية المدمجة')
              : streamLevel === '1bac'
              ? (isLitStream ? 'مسائل التعداد التوليفية، ترييض وضعيات واقعية باستعمال النسب المئوية والتزايد المتتالي' : 'التعداد ومبدأ الجداء، المسائل التوليفية الرابطة بين الدوال والمتتاليات')
              : (isLitStream ? 'حل مسائل واقعية من الحياة اليومية باستخدام النسب والتناسبية' : 'الإحصاء الوصفي (المعدلات والتشتت)، المسائل التوليفية متعددة المراحل'),
          domainAvg: synAvg,
          masteryRate: Math.max(10, Math.min(92, Math.round(passRate - 11))),
          examWeightPct: 15,
          strugglingCount: Math.min(studentCount, Math.round(strugglingCount * 1.3)),
          aiDomainDiagnosis:
            'يمثل التمرين التوليفي في الأوراق الممسوحة التحدي الأكبر لأغلب المتعثرين، خاصة لدى التلاميذ ذوي الغياب المتكرر الذين يفتقدون خيط الترابط بين الأسئلة الفرعية.',
          recommendedExercises: [
            'تدريب مرحلي على تفكيك المسائل المركبة واستثمار نتائج الأسئلة السابقة حتى عند عدم البرهنة عليها',
            'تخصيص 15 دقيقة في نهاية حصة الدعم لمحاكاة تحرير مسألة توليفية وفق سلم التنقيط'
          ]
        }
      ];

      return {
        className,
        streamLabel,
        levelBadge,
        healthScore,
        scannedExamsDiagnosis,
        attendanceImpactDiagnosis,
        detectedMathGaps,
        remediationActionPlan,
        targetMilestone,
        domainBreakdowns
      };
    });

    const globalAvgStr = gradedAll > 0 ? (weightedAvgSum / gradedAll).toFixed(2) : '--';
    const globalPassStr = gradedAll > 0 ? ((totalPassAll / gradedAll) * 100).toFixed(1) : '0';

    const executiveSummary = `شمل التشخيص البيداغوجي الذكي ${classesPayload.length} أقسام مسندة بمجموع ${totalStudentsAll} تلميذ(ة) خلال ${semesterLabel} استناداً إلى نتائج ${scannedExamSourceLabel} وسجلات المواظبة. بلغ المعدل العام المجمع للأقسام ${globalAvgStr}/20 بنسبة نجاح إجمالية ${globalPassStr}% وإجمالي ${totalAbsenceHoursAll} ساعة غياب مسجلة. برز القسم (${topClass.name}) كأعلى الأقسام أداءً واستقراراً، بينما يتصدر القسم (${priorityClass.name}) أولوية التدخل البيداغوجي والدعم الاستدراكي المندمج لتقليص الفجوة التحصيلية وضبط المواظبة قبل الفرض المحروس القادم.`;

    return {
      executiveSummary,
      classReports
    };
  }

  // API route for Dashboard AI Class Performance Diagnostics (Scanned Exams + Attendance)
  app.post("/api/ai/dashboard-classes-diagnostics", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const body = req.body || {};
      const classesPayload: any[] = Array.isArray(body.classes) ? body.classes : [];
      if (classesPayload.length === 0) {
        return res.status(400).json({ error: "لا توجد بيانات أقسام للتحليل." });
      }

      const apiKey = getValidGeminiApiKey();
      if (!apiKey) {
        const fallback = generateDashboardClassesDiagnosticsFallback(body);
        return res.json({ result: fallback, source: 'heuristic' });
      }

      const ai = createGeminiClient(apiKey);
      const semesterLabel =
        body.semester === 's2'
          ? 'الدورة الثانية (الأسدس الثاني)'
          : body.semester === 'annual'
          ? 'الحصيلة السنوية المندمجة (S1 + S2)'
          : 'الدورة الأولى (الأسدوس الأول)';
      const scannedExamSourceLabel = body.scannedExamSourceLabel || 'الفروض المحروسة الممسوحة';

      const prompt = `أنت مفتش تربوي ممتاز وخبير في الديداكتيك والتقويم البيداغوجي لمادة الرياضيات بالسلك الثانوي التأهيلي بالمملكة المغربية (المذكرة الوزارية 142-08).
المطلوب: توليد تقارير تشخيصية دقيقة وشاملة لمستوى كل قسم في واجهة "لوحة القيادة" بناءً على:
1) **نتائج الفروض المحروسة الممسوحة (${scannedExamSourceLabel})**: علماً أن التقويم في مادة الرياضيات بالثانوي التأهيلي يعتمد حصرياً (100%) على الفروض المحروسة الكتابية (F1, F2, F3) دون احتساب أي نقط للمشاركة الصفية.
2) **سجل المواظبة والانضباط الصفي**: ساعات الغياب غير المبررة والمبررة، التأخرات، ونسبة الحضور، وتحليل أثر الغياب على تعثر التلاميذ في الفروض الممسوحة.
3) **التفصيل المعمق حسب المجالات المعرفية للرياضيات (domainBreakdowns)**: الجبر والمنطق (algebra)، التحليل والدوال العددية (analysis)، الهندسة المستوية والفضائية (geometry)، والاحتمالات والمسائل التوليفية (synthesis).

الفترة التقويمية: ${semesterLabel}
بيانات الأقسام المسندة (إحصائيات الفروض الممسوحة، التوزيع المعياري، محاور الأوراق الممسوحة، والمواظبة):
${JSON.stringify(classesPayload, null, 2)}

قم بإعداد تشخيص بيداغوجي معمق يتضمن ملخصاً تنفيذياً شاملاً وتقريراً تشخيصياً مخصصاً لكل قسم على حدة مع تفصيل المجالات المعرفية وفق مخطط JSON المحدد.`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: "ملخص تنفيذي شامل يقارن أداء الأقسام، يحدد القسم الأكثر تميزاً والقسم ذا الأولوية القصوى في الدعم، ويبرز العلاقة بين المواظبة ونتائج الفروض الممسوحة"
              },
              classReports: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    className: { type: Type.STRING },
                    streamLabel: { type: Type.STRING },
                    levelBadge: {
                      type: Type.STRING,
                      description: "تصنيف مستوى القسم: ممتاز ومتجانس | جيد ومستقر | متوسط يحتاج مواكبة | حرج يتطلب دعماً عاجلاً"
                    },
                    healthScore: {
                      type: Type.NUMBER,
                      description: "مؤشر جودة الأداء والمواظبة من 0 إلى 100"
                    },
                    scannedExamsDiagnosis: {
                      type: Type.STRING,
                      description: "تشخيص دقيق لنتائج الفروض المحروسة الممسوحة وتطورها وتجانس القسم (100% فروض محروسة بدون مشاركة)"
                    },
                    attendanceImpactDiagnosis: {
                      type: Type.STRING,
                      description: "تحليل المواظبة وساعات الغياب والتأخر وأثرها المباشر على تحصيل التلاميذ في الفروض الممسوحة"
                    },
                    detectedMathGaps: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "3 صعوبات وعوائق ديداكتيكية في محاور الرياضيات الخاصة بمستوى القسم مستخلصة من نتائج الفروض الممسوحة"
                    },
                    remediationActionPlan: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "3 إجراءات عملية ملموسة للدعم والمعالجة وضبط المواظبة"
                    },
                    targetMilestone: {
                      type: Type.STRING,
                      description: "الهدف الكمي والبيداغوجي المسطر للفرض المحروس القادم"
                    },
                    domainBreakdowns: {
                      type: Type.ARRAY,
                      description: "تفصيل أداء القسم حسب المجالات المعرفية الأربعة (الجبر، التحليل، الهندسة، المسائل التوليفية/الاحتمالات)",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          domainKey: { type: Type.STRING },
                          domainTitle: { type: Type.STRING },
                          curriculumTopics: { type: Type.STRING },
                          domainAvg: { type: Type.NUMBER },
                          masteryRate: { type: Type.NUMBER },
                          examWeightPct: { type: Type.NUMBER },
                          strugglingCount: { type: Type.NUMBER },
                          aiDomainDiagnosis: { type: Type.STRING },
                          recommendedExercises: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                          }
                        },
                        required: [
                          "domainKey",
                          "domainTitle",
                          "curriculumTopics",
                          "domainAvg",
                          "masteryRate",
                          "examWeightPct",
                          "strugglingCount",
                          "aiDomainDiagnosis",
                          "recommendedExercises"
                        ]
                      }
                    }
                  },
                  required: [
                    "className",
                    "streamLabel",
                    "levelBadge",
                    "healthScore",
                    "scannedExamsDiagnosis",
                    "attendanceImpactDiagnosis",
                    "detectedMathGaps",
                    "remediationActionPlan",
                    "targetMilestone",
                    "domainBreakdowns"
                  ]
                }
              }
            },
            required: ["executiveSummary", "classReports"]
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة استجابة نموذج تشخيص الأقسام")), 14000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = (response.text || "").trim();
      const parsed = parseAiJson(rawText);

      if (!parsed || !Array.isArray(parsed.classReports) || parsed.classReports.length === 0) {
        const fallback = generateDashboardClassesDiagnosticsFallback(body);
        return res.json({ result: fallback, source: 'heuristic' });
      }

      res.json({ result: parsed, source: 'gemini' });
    } catch (error: any) {
      console.info("Using dashboard classes diagnostics fallback engine");
      const fallback = generateDashboardClassesDiagnosticsFallback(req.body || {});
      res.json({ result: fallback, source: 'fallback_heuristic' });
    }
  });

  // API route for exporting Ministerial Milestones and Exams to ICS calendar feed
  app.post("/api/calendar/generate-ministerial-ics", sameOriginGuard, (req, res) => {
    try {
      const {
        milestones = [],
        holidays = [],
        exams = [],
        academicYear = '2026-2027',
        includeHolidays = true,
        includeExams = true,
        includeMilestones = true
      } = req.body;

      let allEvents: PortfolioCalendarEvent[] = [];

      const todayIso = new Date().toISOString().split('T')[0];

      // 1. Milestones
      if (includeMilestones && Array.isArray(milestones)) {
        milestones.forEach((m: any) => {
          const sDate = m.startDate || todayIso;
          allEvents.push({
            id: m.id || `ms_${Math.random().toString(36).substring(2, 7)}`,
            title: `📌 ${m.title || 'محطة تربوية'}`,
            startDate: sDate,
            endDate: m.endDate || sDate,
            category: 'MILESTONE',
            description: `${m.description || ''}\nالفئة والمستويات المستهدفة: ${m.targetLevels || 'كافة المستويات'}\nالمقرر الوزاري لتنظيم السنة الدراسية ${academicYear}`,
            location: 'المؤسسة التعليمية / الفصول الدراسية'
          });
        });
      }

      // 2. Exams and Controls
      if (includeExams && Array.isArray(exams)) {
        exams.forEach((ex: any) => {
          const sDate = ex.date || ex.startDate || todayIso;
          allEvents.push({
            id: ex.id || `exam_${Math.random().toString(36).substring(2, 7)}`,
            title: `🚨 ${ex.title || 'فرض مراقبة مستمرة'} (${ex.className || 'القسم'})`,
            startDate: sDate,
            endDate: ex.endDate || sDate,
            category: 'EXAM',
            className: ex.className,
            description: `فرض مراقبة مستمرة لمادة الرياضيات\nالقسم: ${ex.className || ''}\nالموضوع / المحاور: ${ex.topics || ex.description || 'مفردات المقرر الدراسي'}\nالمدة: ${ex.duration || 'ساعة واحدة'}`,
            location: `قاعة التدريس - ${ex.className || ''}`
          });
        });
      }

      // 3. Holidays
      if (includeHolidays && Array.isArray(holidays)) {
        holidays.forEach((h: any) => {
          const sDate = h.startDate || todayIso;
          allEvents.push({
            id: h.id || `hol_${Math.random().toString(36).substring(2, 7)}`,
            title: `🌴 ${h.title || 'عطلة مدرسية'}`,
            startDate: sDate,
            endDate: h.endDate || sDate,
            category: 'HOLIDAY',
            description: `${h.notes || h.categoryLabel || 'عطلة رسمية'}\nالمقرر الوزاري لتنظيم السنة الدراسية ${academicYear}`
          });
        });
      }

      // If empty, supply default ministerial milestones
      if (allEvents.length === 0) {
        const defaultDecree = heuristicExtractDecree('', academicYear);
        defaultDecree.milestones.forEach(m => {
          allEvents.push({
            id: m.id,
            title: `📌 ${m.title}`,
            startDate: m.startDate,
            endDate: m.endDate,
            category: 'MILESTONE',
            description: `${m.description}\nالمستويات المستهدفة: ${m.targetLevels}`
          });
        });
      }

      const ics = generateICalFeed(allEvents, `التقويم الوزاري والمحطات التربوية والفروض ${academicYear}`);
      res.json({ success: true, icsContent: ics, count: allEvents.length });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to generate ICS' });
    }
  });

  // API route to directly download ministerial milestones ICS file
  app.get(["/api/calendar/ministerial-milestones.ics", "/api/calendar/decree.ics"], createRateLimiter({ windowMs: 60_000, max: 60 }), (req, res) => {
    const academicYear = (req.query.year as string) || '2026-2027';
    const isDownload = req.query.download !== "0";

    const defaultDecree = heuristicExtractDecree('', academicYear);
    const allEvents: PortfolioCalendarEvent[] = [];

    // Add milestones
    defaultDecree.milestones.forEach(m => {
      allEvents.push({
        id: m.id,
        title: `📌 ${m.title}`,
        startDate: m.startDate,
        endDate: m.endDate,
        category: 'MILESTONE',
        description: `${m.description}\nالمستويات المستهدفة: ${m.targetLevels}\nالمقرر الوزاري لتنظيم السنة الدراسية ${academicYear}`,
        location: 'المؤسسة التعليمية'
      });
    });

    // Add holidays
    defaultDecree.holidays.forEach(h => {
      allEvents.push({
        id: h.id,
        title: `🌴 ${h.title}`,
        startDate: h.startDate,
        endDate: h.endDate,
        category: 'HOLIDAY',
        description: `${h.notes || h.categoryLabel || 'عطلة رسمية'}\nالمدة: ${h.daysCount} أيام`
      });
    });

    const icsContent = generateICalFeed(allEvents, `التقويم الوزاري والمحطات التربوية الرسمية ${academicYear}`);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      isDownload
        ? `attachment; filename="ministerial-calendar-${academicYear}.ics"`
        : `inline; filename="ministerial-calendar-${academicYear}.ics"`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(icsContent);
  });

function heuristicClassifyResource(titleStr: string, fileNameStr?: string, existingTopics?: string[], teacherSubject?: string) {
  const combined = ((titleStr || '') + ' ' + (fileNameStr || '')).toLowerCase();
  
  // 1. Clean Title
  let cleanTitle = (titleStr || fileNameStr || 'مورد تعليمي')
    .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    .replace(/[_\-]+/g, ' ')
    .trim();

  // 2. Detect Level (Secondary Qualifying Math Only)
  let suggestedLevel = 'عام / الثانوي التأهيلي';
  if (/(?:2\s*bac|2ème\s*bac|(?:ال)?ثانية\s*باك|(?:ال)?ثانية\s*بكالوريا|2\s*biof)/i.test(combined)) {
    if (/(?:sm|math|رياضي)/i.test(combined)) suggestedLevel = 'الثانية باك علوم رياضية';
    else if (/(?:eco|tgc|اقتصاد)/i.test(combined)) suggestedLevel = 'الثانية باك علوم اقتصادية وتدبير';
    else if (/(?:lsh|sh|آداب|اداب|إنسانية|انسانية|أدبي|lettres)/i.test(combined)) suggestedLevel = 'الثانية باك آداب وعلوم إنسانية';
    else suggestedLevel = 'الثانية باك علوم تجريبية';
  } else if (/(?:1\s*bac|1ère\s*bac|(?:ال)?أولى\s*باك|(?:ال)?اولى\s*باك|1\s*biof)/i.test(combined)) {
    if (/(?:sm|math|رياضي)/i.test(combined)) suggestedLevel = 'الأولى باك علوم رياضية';
    else if (/(?:lsh|sh|آداب|اداب|إنسانية|انسانية|أدبي|lettres)/i.test(combined)) suggestedLevel = 'الأولى باك آداب وعلوم إنسانية';
    else if (/(?:eco|اقتصاد)/i.test(combined)) suggestedLevel = 'الأولى باك علوم اقتصادية وتدبير';
    else suggestedLevel = 'الأولى باك علوم تجريبية';
  } else if (/(?:tcl|lsh|sh|آداب|اداب|إنسانية|انسانية|أدبي)/i.test(combined)) {
    suggestedLevel = 'الجذع المشترك للآداب والعلوم الإنسانية';
  } else if (/(?:tc|tcs|tct|(?:ال)?جذع\s*(?:ال)?مشترك|tronc\s*commun|علمي|تكنولوجي)/i.test(combined)) {
    suggestedLevel = 'الجذع المشترك العلمي';
  }

  // 3. Detect Resource Type
  let suggestedType = 'doc';
  if (/(?:mp4|webm|mov|mkv|avi|فيديو|مقطع|شرح\s*مرئي|video|youtube|youtu\.be)/i.test(combined)) {
    suggestedType = 'video';
  } else if (/(?:https?:\/\/|رابط|drive\.google)/i.test(combined)) {
    suggestedType = 'link';
  }

  // 4. Topic and Lesson Detection
  let suggestedTopic = '';
  let alternativeTopics: string[] = [];

  // Match against existing teacher topics first if closely related
  if (Array.isArray(existingTopics) && existingTopics.length > 0) {
    for (const exTopic of existingTopics) {
      if (!exTopic || typeof exTopic !== 'string') continue;
      const exWords = exTopic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (exWords.some(w => combined.includes(w))) {
        suggestedTopic = exTopic;
        break;
      }
    }
  }

  // Knowledge base of Moroccan curriculum lessons and subjects
  const topicRules = [
    { pattern: /(?:إشهادي|اشهادي|امتحان\s*وطني|الامتحان\s*الوطني|امتحان\s*جهوي|الامتحان\s*الجهوي|examen\s*national|examen\s*r[ée]gional|bac\s*blanc|باك\s*دورة|باكالوريا\s*دورة|أطر\s*مرجعية)/i, topic: 'نماذج الامتحانات الإشهادية (وطني / جهوي)', alts: ['الامتحان الوطني الموحد للبكالوريا', 'الامتحان الجهوي الموحد', 'الأطر المرجعية للامتحانات الإشهادية'] },
    { pattern: /(?:دوال|الدوال|fonctions|دراسة\s*الدوال)/i, topic: 'الدوال العددية', alts: ['عموميات حول الدوال', 'الاشتقاق ودراسة الدوال', 'النهايات والاتصال'] },
    { pattern: /(?:نهايات|اتصال|limites|continuité)/i, topic: 'النهايات والاتصال', alts: ['الدوال العددية', 'الاشتقاق'] },
    { pattern: /(?:اشتقاق|dérivation|مشتقة)/i, topic: 'الاشتقاق وتطبيقاته', alts: ['دراسة الدوال', 'المتتاليات'] },
    { pattern: /(?:متتاليات|suites|متتالية)/i, topic: 'المتتاليات العددية', alts: ['الحساب الجبري', 'النهايات'] },
    { pattern: /(?:عقدية|complexe|أعداد\s*عقدية)/i, topic: 'الأعداد العقدية', alts: ['الحساب المثلثي', 'المعادلات الجبرية'] },
    { pattern: /(?:احتمالات|احتمال|probabilit)/i, topic: 'الاحتمالات', alts: ['التعداد', 'الإحصاء'] },
    { pattern: /(?:تكامل|intégral|تكاملات)/i, topic: 'حساب التكامل', alts: ['المعادلات التفاضلية', 'الدوال الأصلية'] },
    { pattern: /(?:هندسة\s*فضائية|espace|فضاء)/i, topic: 'الهندسة الفضائية', alts: ['المتجهات في الفضاء', 'الجداء السلمي'] },
    { pattern: /(?:حساب\s*مثلثي|trigonométrie|مثلثي)/i, topic: 'الحساب المثلثي', alts: ['الدوال الدائرية', 'مبرهنة فيتاغورس'] },
    { pattern: /(?:حساب\s*عددي|calcul\s*numérique|جبري)/i, topic: 'الحساب العددي', alts: ['المتطابقات الهامة', 'القوى والجذور'] },
    { pattern: /(?:طاليس|thalès|thales)/i, topic: 'مبرهنة طاليس', alts: ['مبرهنة فيتاغورس', 'المثلثات والتشابه'] },
    { pattern: /(?:فيتاغورس|pythagore)/i, topic: 'مبرهنة فيتاغورس', alts: ['الحساب المثلثي', 'الهندسة المستوية'] },
    { pattern: /(?:متجهات|إزاحة|vecteur|translation)/i, topic: 'المتجهات والإزاحة', alts: ['الهندسة التحليلية', 'الجداء السلمي'] },
    { pattern: /(?:إحصاء|statistique|احصاء)/i, topic: 'الإحصاء', alts: ['التشتت والتمثيل البياني', 'الاحتمالات'] },
    { pattern: /(?:معادلات|متراجحات|équations|inéquations)/i, topic: 'المعادلات والمتراجحات', alts: ['النظمات', 'الحدوديات'] },
    { pattern: /(?:قوى|جذور|puissances|racines)/i, topic: 'القوى والجذور المربعة', alts: ['الحساب العددي', 'المتطابقات الهامة'] },
    // Physics & Chemistry
    { pattern: /(?:موجات|ondes|موجة|ضوء|بصريات)/i, topic: 'الموجات الميكانيكية والضوئية', alts: ['انتشار موجة', 'الظواهر الموجية'] },
    { pattern: /(?:نووي|تناقص|nucléaire|إشعاع)/i, topic: 'التحولات النووية والنشاط الإشعاعي', alts: ['النواة والكتلة والطاقة', 'التناقص الإشعاعي'] },
    { pattern: /(?:كهرباء|rc|rl|rlc|ثنائي\s*قطب|دارات)/i, topic: 'الكهرباء (ثنائي القطب RC و RL)', alts: ['التذبذبات الحرة في دارة RLC', 'تضمين الوسع'] },
    { pattern: /(?:ميكانيك|نيوتن|newton|mécanique|قوانين\s*نيوتن)/i, topic: 'الميكانيك وقوانين نيوتن', alts: ['حركة قذيفة في مجال الثقالة', 'الأقمار الاصطناعية'] },
    { pattern: /(?:حمض|قاعدة|acide|base|ph)/i, topic: 'تفاعلات حمض - قاعدة', alts: ['التحولات غير الكلية', 'المعايرة الحمضية القاعدية'] },
    { pattern: /(?:أكسدة|اختزال|redox|أعمدة)/i, topic: 'تفاعلات الأكسدة والاختزال', alts: ['الأعمدة وتحصيل الطاقة', 'التحليل الكهربائي'] },
    { pattern: /(?:كيمياء\s*عضوية|أسترة|estérification)/i, topic: 'الكيمياء العضوية والأسترة', alts: ['التحكم في تطور المجموعات', 'الصناعة الكيميائية'] },
    // SVT
    { pattern: /(?:مناعة|immunologie|مصل|لمفاويات)/i, topic: 'علم المناعة ودفاع الجسم', alts: ['الاستجابة المناعتية', 'اضطرابات الجهاز المناعي'] },
    { pattern: /(?:وراثة|génétique|خبر\s*وراثي|adn)/i, topic: 'الخبر الوراثي وعلم الوراثة', alts: ['التعبير عن الخبر الوراثي', 'الانقسام الاختزالي'] },
    { pattern: /(?:تكتونية|جيولوجيا|صخور|صفائح|géologie)/i, topic: 'الظواهر الجيولوجية والتكتونية', alts: ['تشكل الصخور الصهارية', 'سلاسل الجبال الحديثة'] },
    { pattern: /(?:تنفس|هضم|دوران|تغذية|digestion)/i, topic: 'وظائف الاقتيات (الهضم والتنفس)', alts: ['التربية الغذائية', 'التنفس والدوران'] },
    // Arabic & French
    { pattern: /(?:درس\s*لغوي|تمييز|بدل|استعارة|نعت|توكيد|ممنوع\s*من\s*الصرف)/i, topic: 'الدرس اللغوي وقواعد اللغة', alts: ['التعبير والإنشاء', 'البلاغة والعروض'] },
    { pattern: /(?:نص\s*قرائي|قراءة|مؤلفات|شعر|قصيدة)/i, topic: 'النصوص القرائية وتحليل النص', alts: ['مكون المؤلفات', 'الدرس الأدبي'] },
    { pattern: /(?:تعبير\s*وإنشاء|مهارة|إنتاج\s*كتابي)/i, topic: 'التعبير والإنشاء والمهارات الكتابية', alts: ['النصوص القرائية', 'الإنتاج الكتابي'] },
    { pattern: /(?:boîte\s*à\s*merveilles|antigone|dernier\s*jour|condamné)/i, topic: 'Module des Œuvres Littéraires', alts: ['Production Écrite', 'Figures de Style'] },
    { pattern: /(?:production\s*écrite|lecture\s*méthodique|figures\s*de\s*style)/i, topic: 'Langue et Production Écrite', alts: ['Module Littéraire', 'Compréhension'] },
    // Islamic Education
    { pattern: /(?:سورة|قرآن|حشر|كهف|يوسف|نجم)/i, topic: 'القرآن الكريم وتفسير الآيات', alts: ['مدخل التزكية', 'مدخل الاقتداء'] },
    { pattern: /(?:تزكية|اقتداء|استجابة|قسط|حكمة)/i, topic: 'مداخل التربية الإسلامية', alts: ['فقه الأسرة والمعاملات', 'السيرة النبوية والشمائل'] },
    // Philosophy
    { pattern: /(?:وضع\s*بشري|شخص|هوية|غير)/i, topic: 'مجزوءة الوضع البشري (الشخص والغير)', alts: ['مجزوءة المعرفة', 'مجزوءة الأخلاق'] },
    { pattern: /(?:معرفة|نظرية|تجربة|حقيقة)/i, topic: 'مجزوءة المعرفة (النظرية والتجربة)', alts: ['مجزوءة الوضع البشري', 'مجزوءة السياسة'] },
    { pattern: /(?:دولة|عنف|حق|عدالة|سياسة)/i, topic: 'مجزوءة السياسة (الدولة والعنف)', alts: ['الحق والعدالة', 'مجزوءة الأخلاق'] },
    // Exams & Tests
    { pattern: /(?:فرض\s*محروس|فروض|contrôle|devoir)/i, topic: 'فروض المراقبة المستمرة', alts: ['سلسلة تمارين داعمة', 'ملخصات الدروس'] },
    { pattern: /(?:امتحان\s*موحد|امتحان\s*جهوي|امتحان\s*وطني|examen)/i, topic: 'امتحانات إشهادية ونماذج تقويمية', alts: ['فروض المراقبة', 'تمارين توليفية'] },
    { pattern: /(?:سلسلة\s*تمارين|تمارين\s*محلولة|série\s*d'exercices)/i, topic: 'سلاسل التمارين والتطبيقات', alts: ['فروض المراقبة', 'ملخصات الدروس'] }
  ];

  if (!suggestedTopic) {
    for (const r of topicRules) {
      if (r.pattern.test(combined)) {
        suggestedTopic = r.topic;
        alternativeTopics = r.alts;
        break;
      }
    }
  }

  if (!suggestedTopic) {
    suggestedTopic = 'وحدة تعليمية عامة';
    alternativeTopics = ['سلاسل تمارين', 'فروض وتقويمات', 'ملخصات داعمة'];
  }

  return {
    id: 'res_' + Math.random().toString(36).substring(2, 9),
    suggestedTopic,
    alternativeTopics,
    suggestedLevel,
    suggestedType,
    cleanTitle,
    confidence: 'medium',
    reasoning: 'تم التحليل التلقائي بناء على مفاتيح المنهاج والمقرر الدراسي'
  };
}

function heuristicExtractDecree(rawText: string, academicYearStr: string) {
  // Extract year start e.g. "2026-2027" -> 2026
  let startYear = 2026;
  const yearMatch = (academicYearStr + ' ' + rawText).match(/20(2[4-9]|3[0-5])/);
  if (yearMatch) {
    startYear = parseInt(yearMatch[0], 10);
  }
  const nextYear = startYear + 1;

  const holidays = [
    {
      id: `hol_mawlid_${startYear}`,
      title: 'عطلة عيد المولد النبوي الشريف',
      category: 'religious',
      categoryLabel: 'عطلة دينية',
      startDate: `${startYear}-09-15`,
      endDate: `${startYear}-09-16`,
      daysCount: 2,
      isOfficial: true,
      disableAbsence: true,
      color: '#8b5cf6',
      notes: '12 و13 ربيع الأول'
    },
    {
      id: `hol_interim1_${startYear}`,
      title: 'عطلة الفترة البينية الأولى',
      category: 'interim',
      categoryLabel: 'فترة بينية',
      startDate: `${startYear}-10-18`,
      endDate: `${startYear}-10-25`,
      daysCount: 8,
      isOfficial: true,
      disableAbsence: true,
      color: '#10b981',
      notes: 'عطلة مدرسية بينية أولى (8 أيام)'
    },
    {
      id: `hol_green_march_${startYear}`,
      title: 'ذكرى المسيرة الخضراء المظفرة',
      category: 'national',
      categoryLabel: 'عيد وطني',
      startDate: `${startYear}-11-06`,
      endDate: `${startYear}-11-06`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#ef4444',
      notes: 'ذكرى المسيرة الخضراء (6 نونبر)'
    },
    {
      id: `hol_independence_${startYear}`,
      title: 'عيد الاستقلال المجيد',
      category: 'national',
      categoryLabel: 'عيد وطني',
      startDate: `${startYear}-11-18`,
      endDate: `${startYear}-11-18`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#ef4444',
      notes: 'عيد الاستقلال (18 نونبر)'
    },
    {
      id: `hol_interim2_${startYear}`,
      title: 'عطلة الفترة البينية الثانية',
      category: 'interim',
      categoryLabel: 'فترة بينية',
      startDate: `${startYear}-12-06`,
      endDate: `${startYear}-12-13`,
      daysCount: 8,
      isOfficial: true,
      disableAbsence: true,
      color: '#10b981',
      notes: 'عطلة مدرسية بينية ثانية (8 أيام)'
    },
    {
      id: `hol_newyear_${nextYear}`,
      title: 'رأس السنة الميلادية',
      category: 'national',
      categoryLabel: 'عطلة رسمية',
      startDate: `${nextYear}-01-01`,
      endDate: `${nextYear}-01-01`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#0284c7',
      notes: `فاتح يناير ${nextYear}`
    },
    {
      id: `hol_manifesto_${nextYear}`,
      title: 'ذكرى تقديم وثيقة الاستقلال',
      category: 'national',
      categoryLabel: 'عيد وطني',
      startDate: `${nextYear}-01-11`,
      endDate: `${nextYear}-01-11`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#ef4444',
      notes: '11 يناير'
    },
    {
      id: `hol_amazigh_${nextYear}`,
      title: 'رأس السنة الأمازيغية',
      category: 'national',
      categoryLabel: 'عطلة رسمية وطنية',
      startDate: `${nextYear}-01-14`,
      endDate: `${nextYear}-01-14`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#f59e0b',
      notes: 'عطلة وطنية رسمية مؤداة عنها (14 يناير)'
    },
    {
      id: `hol_midterm_${nextYear}`,
      title: 'عطلة منتصف السنة الدراسية',
      category: 'midterm',
      categoryLabel: 'عطلة منتصف الموسم',
      startDate: `${nextYear}-01-24`,
      endDate: `${nextYear}-01-31`,
      daysCount: 8,
      isOfficial: true,
      disableAbsence: true,
      color: '#3b82f6',
      notes: 'عطلة نهاية الأسدوس الأول (8 أيام)'
    },
    {
      id: `hol_interim3_${nextYear}`,
      title: 'عطلة الفترة البينية الثالثة',
      category: 'interim',
      categoryLabel: 'فترة بينية',
      startDate: `${nextYear}-03-14`,
      endDate: `${nextYear}-03-21`,
      daysCount: 8,
      isOfficial: true,
      disableAbsence: true,
      color: '#10b981',
      notes: 'عطلة مدرسية بينية ثالثة (8 أيام)'
    },
    {
      id: `hol_fitr_${nextYear}`,
      title: 'عطلة عيد الفطر السعيد',
      category: 'religious',
      categoryLabel: 'عطلة دينية',
      startDate: `${nextYear}-03-28`,
      endDate: `${nextYear}-03-31`,
      daysCount: 4,
      isOfficial: true,
      disableAbsence: true,
      color: '#8b5cf6',
      notes: 'من 29 رمضان إلى 2 شوال'
    },
    {
      id: `hol_labour_${nextYear}`,
      title: 'عطلة عيد الشغل',
      category: 'national',
      categoryLabel: 'عيد وطني وعمالي',
      startDate: `${nextYear}-05-01`,
      endDate: `${nextYear}-05-01`,
      daysCount: 1,
      isOfficial: true,
      disableAbsence: true,
      color: '#ef4444',
      notes: 'فاتح ماي'
    },
    {
      id: `hol_interim4_${nextYear}`,
      title: 'عطلة الفترة البينية الرابعة',
      category: 'interim',
      categoryLabel: 'فترة بينية',
      startDate: `${nextYear}-05-02`,
      endDate: `${nextYear}-05-09`,
      daysCount: 8,
      isOfficial: true,
      disableAbsence: true,
      color: '#10b981',
      notes: 'عطلة مدرسية بينية رابعة (8 أيام)'
    },
    {
      id: `hol_adha_${nextYear}`,
      title: 'عطلة عيد الأضحى المبارك',
      category: 'religious',
      categoryLabel: 'عطلة دينية',
      startDate: `${nextYear}-06-05`,
      endDate: `${nextYear}-06-08`,
      daysCount: 4,
      isOfficial: true,
      disableAbsence: true,
      color: '#8b5cf6',
      notes: 'من 9 إلى 11 ذو الحجة'
    }
  ];

  const milestones = [
    {
      id: `ms_entry_admin_${startYear}`,
      title: 'التحاق أطر الإدارة وهيئة التدريس وتوقيع محاضر الدخول',
      category: 'start',
      categoryLabel: 'انطلاق الموسم',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-09-02`,
      endDate: `${startYear}-09-03`,
      description: 'التحاق الأطر الإدارية والتربوية بمقرات العمل وتوقيع محاضر الدخول الرسمية وتوزيع جداول الحصص المدرسية.',
      targetLevels: 'هيئة التدريس والإدارة التربوية',
      importance: 'critical',
      icon: 'flag',
      isTeacher: true,
      isSecondary: false,
      isMath: false
    },
    {
      id: `ms_classes_start_${startYear}`,
      title: 'انطلاق الدراسة الفعلية بالثانوي التأهيلي والتحاق التلاميذ',
      category: 'start',
      categoryLabel: 'انطلاق الموسم',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-09-08`,
      endDate: `${startYear}-09-08`,
      description: 'انطلاق الحصص الدراسية الفعلية لجميع مستويات الثانوي التأهيلي (الجذوع المشتركة، الأولى والثانية باكالوريا).',
      targetLevels: 'جميع مستويات الثانوي التأهيلي',
      importance: 'critical',
      icon: 'calendar',
      isSecondary: true,
      isMath: false,
      isTeacher: false
    },
    {
      id: `ms_council_math_s1_${startYear}`,
      title: 'المجلس التعليمي الأول لمادة الرياضيات وتنسيق البرامج السنوية',
      category: 'council',
      categoryLabel: 'مجالس المادة والمؤسسة',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-09-10`,
      endDate: `${startYear}-09-12`,
      description: 'عقد المجلس التعليمي لأساتذة الرياضيات: ضبط التوزيعات السنوية، توحيد جداول الفروض المحروسة والتقويم التشخيصي.',
      targetLevels: 'أساتذة مادة الرياضيات بالثانوي التأهيلي',
      importance: 'high',
      icon: 'users',
      isTeacher: true,
      isMath: true,
      isSecondary: true
    },
    {
      id: `ms_diagnostic_math_${startYear}`,
      title: 'فترة التقويم التشخيصي والدعم الاستدراكي لمادة الرياضيات',
      category: 'diagnostic',
      categoryLabel: 'تقويم تشخيصي',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-09-11`,
      endDate: `${startYear}-09-28`,
      description: 'تمرير روائز التقويم التشخيصي في الرياضيات لرصد التعثرات السابقة وإعداد خطط الدعم والمعالجة البيداغوجية لمستويات التأهيلي.',
      targetLevels: 'الجذع المشترك، الأولى والثانية باك',
      importance: 'high',
      icon: 'check-square',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_exam1_math_s1_${startYear}`,
      title: 'فروض المراقبة المستمرة 1 لمادة الرياضيات (الأسدوس الأول)',
      category: 'exam',
      categoryLabel: 'فروض الرياضيات',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-11-09`,
      endDate: `${startYear}-11-21`,
      description: 'إجراء وتصحيح الفرض المحروس الأول لمادة الرياضيات لجميع شعب الثانوي التأهيلي واستثمار حصص التصحيح والدعم.',
      targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
      importance: 'high',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_olympiad_math_stage1_${startYear}`,
      title: 'الأولمبياد الوطنية في الرياضيات (المرحلة الانتقائية الإقليمية)',
      category: 'exam',
      categoryLabel: 'أولمبياد وتميز',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-12-08`,
      endDate: `${startYear}-12-10`,
      description: 'تنظيم المسابقة الانتقائية للأولمبياد الوطنية في الرياضيات لتلاميذ الثانوي التأهيلي وانتقاء المؤهلين للمراحل الجهوية.',
      targetLevels: 'الجذوع المشتركة والأولى باكالوريا علمية ورياضية',
      importance: 'medium',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_exam2_math_s1_${startYear}`,
      title: 'فروض المراقبة المستمرة 2 لمادة الرياضيات (الأسدوس الأول)',
      category: 'exam',
      categoryLabel: 'فروض الرياضيات',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-12-14`,
      endDate: `${startYear}-12-24`,
      description: 'إجراء الفرض المحروس الثاني لمادة الرياضيات وتدوين النقط وتتبع مستويات التلاميذ المتعثرين قبل نهاية الأسدوس.',
      targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
      importance: 'high',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_prof_competency_exam_${startYear}`,
      title: 'امتحان الكفاءة المهنية لأطر هيئة التدريس (الامتحان المهني)',
      category: 'admin',
      categoryLabel: 'الامتحان المهني والترقية',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${startYear}-12-26`,
      endDate: `${startYear}-12-27`,
      description: 'إجراء الاختبارات الكتابية لامتحان الكفاءة المهنية لترقية أطر التدريس بالثانوي التأهيلي (السلم 11 وخارج السلم).',
      targetLevels: 'أساتذة التعليم الثانوي التأهيلي المستوفون للشروط',
      importance: 'critical',
      icon: 'graduation-cap',
      isTeacher: true,
      isSecondary: false,
      isMath: false
    },
    {
      id: `ms_massar_s1_${nextYear}`,
      title: 'المسك النهائي لنقط المراقبة المستمرة في منظومة مسار (S1)',
      category: 'massar',
      categoryLabel: 'مسار وتدبير النقط',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${nextYear}-01-09`,
      endDate: `${nextYear}-01-16`,
      description: 'إنهاء إدخال وتدقيق نقط فروض الرياضيات والمواظبة في منظومة مسار واستخراج بيانات النقط الأولية.',
      targetLevels: 'الأساتذة والإدارة التربوية',
      importance: 'critical',
      icon: 'check-square',
      isTeacher: true,
      isSecondary: true,
      isMath: true
    },
    {
      id: `ms_councils_s1_${nextYear}`,
      title: 'مجالس الأقسام لنهاية الأسدوس الأول بالثانوي التأهيلي',
      category: 'council',
      categoryLabel: 'مجالس الأقسام',
      semester: 's1',
      semesterLabel: 'الأسدوس الأول',
      startDate: `${nextYear}-01-20`,
      endDate: `${nextYear}-01-23`,
      description: 'عقد مجالس الأقسام لتحليل النتائج الدراسية للأسدوس الأول، اتخاذ القرارات التوجيهية وتوزيع بيانات النقط.',
      targetLevels: 'جميع أقسام الثانوي التأهيلي ومجالس الأساتذة',
      importance: 'critical',
      icon: 'users',
      isTeacher: true,
      isSecondary: true,
      isMath: false
    },
    {
      id: `ms_resume_s2_${nextYear}`,
      title: 'انطلاق دروس الأسدوس الثاني وتنفيذ برامج الدعم الرياضي',
      category: 'start',
      categoryLabel: 'انطلاق الأسدوس الثاني',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-02-01`,
      endDate: `${nextYear}-02-01`,
      description: 'استئناف الدراسة ومباشرة مفردات برنامج الأسدوس الثاني لمادة الرياضيات وتفعيل خطط الدعم الاستدراكي.',
      targetLevels: 'جميع مستويات الثانوي التأهيلي',
      importance: 'high',
      icon: 'calendar',
      isSecondary: true,
      isMath: true,
      isTeacher: false
    },
    {
      id: `ms_olympiad_math_national_${nextYear}`,
      title: 'المرحلة النهائية للأولمبياد الوطنية في الرياضيات',
      category: 'exam',
      categoryLabel: 'أولمبياد وتميز',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-03-16`,
      endDate: `${nextYear}-03-18`,
      description: 'المرحلة النهائية والتتويج الوطني للأولمبياد المغربية في الرياضيات لتأهيل الفريق الوطني للأولمبياد الدولية (IMO).',
      targetLevels: 'التلاميذ المؤهلون من الجذوع المشتركة والأولى والثانية باك',
      importance: 'medium',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_exam1_math_s2_${nextYear}`,
      title: 'فروض المراقبة المستمرة 1 لمادة الرياضيات (الأسدوس الثاني)',
      category: 'exam',
      categoryLabel: 'فروض الرياضيات',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-03-22`,
      endDate: `${nextYear}-04-03`,
      description: 'إجراء الفرض المحروس الأول للأسدوس الثاني في الرياضيات وتصحيحه وتتبع تحصيل التلاميذ في المفاهيم المتقدمة.',
      targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
      importance: 'high',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_orientation_${nextYear}`,
      title: 'التوجيه وإعادة التوجيه لسنوات الثانوي التأهيلي عبر مسار',
      category: 'orientation',
      categoryLabel: 'توجيه مدرسي',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-04-12`,
      endDate: `${nextYear}-04-30`,
      description: 'مواكبة التلاميذ في التعبير عن رغبات التوجيه (العلوم الرياضية، العلوم التجريبية، العلوم والتكنولوجيات) ومسكها عبر مسار.',
      targetLevels: 'الجذوع المشتركة والأولى باكالوريا',
      importance: 'high',
      icon: 'compass',
      isSecondary: true,
      isMath: true,
      isTeacher: true
    },
    {
      id: `ms_gmst_math_${nextYear}`,
      title: 'المباراة العامة للعلوم والتقنيات (GMST) في مادة الرياضيات',
      category: 'exam',
      categoryLabel: 'تميز ومباريات',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-05-04`,
      endDate: `${nextYear}-05-06`,
      description: 'إجراء الاختبار الوطني للمباراة العامة للعلوم والتقنيات لتتويج النخب الرياضية والعلمية بالسنة الختامية للبكالوريا.',
      targetLevels: 'الثانية باكالوريا علوم رياضية وعلوم تجريبية',
      importance: 'high',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_exam2_math_s2_${nextYear}`,
      title: 'فروض المراقبة المستمرة الأخيرة لمادة الرياضيات وإنهاء البرامج',
      category: 'exam',
      categoryLabel: 'فروض الرياضيات',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-05-17`,
      endDate: `${nextYear}-05-29`,
      description: 'إجراء الفروض الختامية في الرياضيات للثانوي التأهيلي وإنهاء المقررات والتركيز على المراجعة الشاملة للبكالوريا.',
      targetLevels: 'جميع مستويات الثانوي التأهيلي',
      importance: 'critical',
      icon: 'award',
      isMath: true,
      isSecondary: true,
      isTeacher: false
    },
    {
      id: `ms_massar_s2_${nextYear}`,
      title: 'المسك النهائي لكافة نقط المراقبة المستمرة في مسار (S2)',
      category: 'massar',
      categoryLabel: 'مسار وتدبير النقط',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-05-30`,
      endDate: `${nextYear}-06-04`,
      description: 'إنهاء وتثبيت كافة نقط المراقبة المستمرة وإغلاق لوائح الأقسام الإشهادية وغير الإشهادية قبل انطلاق الامتحانات.',
      targetLevels: 'هيئة التدريس والإدارة التربوية',
      importance: 'critical',
      icon: 'check-square',
      isTeacher: true,
      isSecondary: true,
      isMath: false
    },
    {
      id: `ms_national_exam_${nextYear}`,
      title: 'الامتحان الوطني الموحد لنيل شهادة البكالوريا (الدورة العادية)',
      category: 'certification',
      categoryLabel: 'امتحانات إشهادية',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-06-08`,
      endDate: `${nextYear}-06-11`,
      description: 'إجراء اختبارات الدورة العادية للامتحان الوطني للبكالوريا ومراكز التصحيح لمادة الرياضيات ومختلف المواد.',
      targetLevels: 'الثانية باكالوريا وأطر الحراسة والتصحيح',
      importance: 'critical',
      icon: 'graduation-cap',
      isSecondary: true,
      isMath: true,
      isTeacher: true
    },
    {
      id: `ms_regional_exam_${nextYear}`,
      title: 'الامتحان الجهوي الموحد للسنة الأولى من سلك البكالوريا (عادية)',
      category: 'certification',
      categoryLabel: 'امتحانات إشهادية',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-06-14`,
      endDate: `${nextYear}-06-16`,
      description: 'إجراء اختبارات الدورة العادية للامتحان الجهوي الموحد للسنة الأولى باكالوريا بمختلف الشعب والمسالك.',
      targetLevels: 'الأولى باكالوريا وأطر الحراسة والتصحيح',
      importance: 'critical',
      icon: 'graduation-cap',
      isSecondary: true,
      isMath: false,
      isTeacher: true
    },
    {
      id: `ms_councils_end_${nextYear}`,
      title: 'مجالس الأقسام لنهاية السنة وقرارات التوجيه بالثانوي التأهيلي',
      category: 'council',
      categoryLabel: 'مجالس نهاية السنة',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-06-25`,
      endDate: `${nextYear}-06-29`,
      description: 'عقد مجالس الأقسام للثانوي التأهيلي للبت في نتائج الانتقال وقرارات التوجيه وإعادة التوجيه وإعلان النتائج.',
      targetLevels: 'مجالس المؤسسة وأساتذة الثانوي التأهيلي',
      importance: 'critical',
      icon: 'users',
      isTeacher: true,
      isSecondary: true,
      isMath: false
    },
    {
      id: `ms_national_exam_retake_${nextYear}`,
      title: 'الامتحان الوطني الموحد للبكالوريا (الدورة الاستدراكية)',
      category: 'certification',
      categoryLabel: 'امتحانات إشهادية',
      semester: 's2',
      semesterLabel: 'الأسدوس الثاني',
      startDate: `${nextYear}-07-02`,
      endDate: `${nextYear}-07-05`,
      description: 'إجراء اختبارات الدورة الاستدراكية للامتحان الوطني للبكالوريا ومداولات النتائج النهائية لنيل الشهادة.',
      targetLevels: 'الثانية باكالوريا وأطر الحراسة والتصحيح',
      importance: 'critical',
      icon: 'graduation-cap',
      isSecondary: true,
      isMath: true,
      isTeacher: true
    },
    {
      id: `ms_exit_admin_${nextYear}`,
      title: 'توقيع محاضر الخروج الرسمية لهيئة التدريس واختتام الموسم',
      category: 'end',
      categoryLabel: 'اختتام الموسم',
      semester: 'year',
      semesterLabel: 'نهاية الموسم',
      startDate: `${nextYear}-07-10`,
      endDate: `${nextYear}-07-12`,
      description: 'تسليم الوثائق والتقارير التربوية وتوقيع محاضر الخروج الرسمية لجميع أطر التدريس واختتام الموسم الدراسي.',
      targetLevels: 'جميع أساتذة الثانوي التأهيلي والأطر الإدارية',
      importance: 'critical',
      icon: 'log-out',
      isTeacher: true,
      isSecondary: false,
      isMath: false
    }
  ];

  return {
    academicYear: `${startYear}-${nextYear}`,
    decreeTitle: `المقرر الوزاري لتنظيم السنة الدراسية ${startYear}-${nextYear}`,
    decreeSummary: `تم استخراج رزنامة العطل الرسمية (${holidays.length} مناسبة) والمحطات التربوية والإدارية الأساسية (${milestones.length} محطة) وفق المقتضيات والمذكرات الوزارية المعتمدة لتنظيم الموسم الدراسي.`,
    holidays,
    milestones
  };
}

function generatePedagogicalFallback(classData: any): string {
  const className = classData?.className || 'القسم';
  const totalStudents = classData?.totalStudents || 0;
  const classAvg = classData?.classAverage !== undefined ? classData.classAverage : null;
  const attendanceRate = classData?.attendanceRate || null;
  const students: any[] = classData?.strugglingStudents || [];
  const topStudents: any[] = classData?.topStudents || [];
  
  return `
  <div style="font-family: 'Cairo', sans-serif; line-height: 1.7; color: #1e293b;">
    <!-- ملخص الأداء العام -->
    <div style="background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
      <h3 style="color: #1d4ed8; margin: 0 0 6px 0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
        <span>📊</span> تقرير تحليل أداء القسم وخطة الدعم البيداغوجي - ${className}
      </h3>
      <p style="margin: 0; font-size: 0.88rem; color: #1e40af;">
        ${totalStudents ? `إجمالي التلاميذ: <strong>${totalStudents}</strong> &bull; ` : ''}
        ${classAvg !== null ? `المعدل العام للقسم: <strong>${classAvg}/20</strong> &bull; ` : ''}
        ${attendanceRate ? `نسبة الحضور: <strong>${attendanceRate}</strong>` : ''}
      </p>
    </div>

    <!-- بطاقة تشخيص المتعثرين -->
    <div style="margin-bottom: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
      <h4 style="color: #b91c1c; font-size: 0.98rem; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
        <span>⚠️</span> 1. تشخيص التلاميذ المستهدفين بالدعم الاستدراكي (${students.length} تلميذ):
      </h4>
      ${students.length > 0 ? `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: right;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569;">
              <th style="padding: 6px 10px;">التلميذ</th>
              <th style="padding: 6px 10px;">المعدل</th>
              <th style="padding: 6px 10px;">الغياب</th>
              <th style="padding: 6px 10px;">الواجبات</th>
              <th style="padding: 6px 10px;">السلوك</th>
              <th style="padding: 6px 10px;">التشخيص ونوع الدعم المطلوب</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((s, idx) => `
              <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#fff' : '#fafafa'};">
                <td style="padding: 6px 10px; font-weight: bold; color: #1e293b;">${s.name}</td>
                <td style="padding: 6px 10px; color: ${s.average !== 'غير متوفر' && parseFloat(s.average) < 10 ? '#dc2626' : '#166534'}; font-weight: 600;">${s.average}</td>
                <td style="padding: 6px 10px; color: ${s.absentHours > 3 ? '#ea580c' : '#475569'};">${s.absentHours} س</td>
                <td style="padding: 6px 10px;">${s.missedHomeworks > 0 ? `<span style="color:#d97706; font-weight: 500;">${s.missedHomeworks} إخلال</span>` : '<span style="color:#16a34a">منضبط</span>'}</td>
                <td style="padding: 6px 10px;">${s.behavior || 'منضبط'}</td>
                <td style="padding: 6px 10px; font-size: 0.8rem; color: #64748b;">
                  ${s.average !== 'غير متوفر' && parseFloat(s.average) < 10 ? 'تعثر تحصيلي معرفي • ' : ''}
                  ${s.absentHours > 3 ? 'تأثر بتراكم الغياب • ' : ''}
                  ${s.missedHomeworks >= 2 ? 'إهمال الواجبات المدرسية' : 'يحتاج مواكبة تشجيعية'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : `
      <p style="margin: 0; color: #166534; font-size: 0.9rem;">✅ جميع تلاميذ هذا القسم فوق عتبة النجاح، يوصى بأنشطة إغناء المعارف والتثبيت.</p>
      `}
    </div>

    <!-- خطة الدعم البيداغوجية المقترحة -->
    <div style="margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
      <h4 style="color: #0369a1; font-size: 0.98rem; margin: 0 0 10px 0;">🎯 2. خطة الدعم والمعالجة البيداغوجية المقترحة:</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 0.85rem;">
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; border-top: 3px solid #3b82f6;">
          <strong style="color: #1d4ed8; display: block; margin-bottom: 6px;">أ. المعالجة البيداغوجية المدمجة:</strong>
          <p style="margin: 0; color: #475569;">تخصيص فترات قصيرة في بداية الحصص لمعالجة الثغرات المفاهيمية المشتركة وتقديم بطاقات تمارين علاجية متدرجة الصعوبة.</p>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; border-top: 3px solid #10b981;">
          <strong style="color: #047857; display: block; margin-bottom: 6px;">ب. بيداغوجيا الأقران والتعلم التعاوني:</strong>
          <p style="margin: 0; color: #475569;">
            تفعيل مجموعات العمل الثنائية لمرافقة المتعثرين من طرف المتفوقين ${topStudents.length ? `(مثل: ${topStudents.slice(0, 3).map(t => t.name).join('، ')})` : ''} خلال الأنشطة التطبيقية.
          </p>
        </div>
        <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; border-top: 3px solid #f59e0b;">
          <strong style="color: #b45309; display: block; margin-bottom: 6px;">ج. تتبع الغياب والانضباط:</strong>
          <p style="margin: 0; color: #475569;">تفعيل التواصل المبكر مع الأسر للتلاميذ متكرري الغياب، واعتماد بطاقة التزام فردية لتحفيز إنجاز الواجبات.</p>
        </div>
      </div>
    </div>

    <!-- جدول زمني ومؤشرات الأثر -->
    <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 12px; font-size: 0.85rem; color: #9d174d;">
      <strong>⏱️ مؤشر تقييم الأثر:</strong> إعادة تقييم نتائج الفرض الموالي ومقارنتها بنقط المراقبة الحالية لقياس مدى تقليص الفارق الدراسي وتحسن المواظبة.
    </div>
  </div>`;
}

function generateStudentComparativeFallback(body: any): any {
  const studentName = body?.studentName || 'التلميذ(ة)';
  const className = body?.className || 'القسم';
  const semester = body?.semester || 's1';
  
  const pExams = body?.proctoredExams || {};
  const cData = body?.continuousAssessment || {};
  
  // 1. Calculate Proctored Average
  let pAvg: number | null = null;
  if (pExams.average !== undefined && pExams.average !== null && !isNaN(pExams.average)) {
    pAvg = parseFloat(Number(pExams.average).toFixed(2));
  } else {
    const marks: number[] = [];
    ['f1', 'f2', 'f3', 'f4'].forEach(k => {
      if (pExams[k] !== undefined && pExams[k] !== null && pExams[k] !== '' && !isNaN(pExams[k])) {
        marks.push(parseFloat(pExams[k]));
      }
    });
    if (marks.length > 0) {
      pAvg = parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2));
    }
  }

  // 2. Calculate Continuous Assessment & Activities Score
  let cAvg: number = 10;
  if (cData.activitiesScore !== undefined && cData.activitiesScore !== null && !isNaN(cData.activitiesScore)) {
    cAvg = parseFloat(Number(cData.activitiesScore).toFixed(2));
  } else {
    let base = 14;
    const missedHw = cData.missedHomeworkCount || 0;
    const absHours = cData.absentHours || 0;
    const beh = cData.behaviorStatus || 'منضبط';

    base -= Math.min(6, missedHw * 1.5);
    base -= Math.min(5, absHours * 0.4);
    if (beh === 'مشوش') base -= 3;
    else if (beh === 'تنبيه') base -= 1.5;
    else if (beh === 'منضبط') base += 1.5;

    if (pAvg !== null) {
      cAvg = parseFloat(((base * 0.4) + (pAvg * 0.6)).toFixed(2));
    } else {
      cAvg = Math.max(4, Math.min(18, parseFloat(base.toFixed(2))));
    }
  }

  const effectivePAvg = pAvg !== null ? pAvg : cAvg;
  const gapValue = parseFloat((effectivePAvg - cAvg).toFixed(2));

  let gapClassification: 'continuous_higher' | 'proctored_higher' | 'balanced_high' | 'balanced_moderate' | 'struggling_both' = 'balanced_moderate';
  let gapTitle = '';
  let comparativeSummary = '';
  let cognitiveDiagnosis = '';
  let studentStrengths: string[] = [];
  let growthAreas: string[] = [];
  let recommendationsForStudent: string[] = [];
  let recommendationsForTeacher: string[] = [];
  let recommendationsForParent: string[] = [];
  let predictedEvolution = '';

  if (effectivePAvg < 10 && cAvg < 10) {
    gapClassification = 'struggling_both';
    gapTitle = 'تعثر تحصيلي وسلوكي مزدوج يستلزم خطة إنقاذ ودعم شامل';
    comparativeSummary = `يُظهر تتبع نتائج ${studentName} تعثراً مزدوجاً؛ حيث بلغ معدل الفروض المحروسة (${effectivePAvg}/20) بينما سجلت أنشطة المراقبة المستمرة والواجبات (${cAvg}/20)، مما يعكس وجود صعوبات بنيوية في المفاهيم الأساسية وضعفاً في الانضباط الصفي والمنزلي.`;
    cognitiveDiagnosis = 'ضعف في المكتسبات القبلية لمادة الرياضيات وتراكم الثغرات المعرفية، مصحوباً بانخفاض دافعية الإنجاز المنزلي وتأثر التحصيل بالغياب أو التردد في طلب المساعدة أثناء الحصة.';
    studentStrengths = [
      'حضور الحصص والتواجد داخل المؤسسة',
      'إمكانية الاستفادة من حصص الدعم المدمجة والاستدراكية',
      'القدرة على التدارك السريع عند تبسيط المهام الرياضية وتقسيمها'
    ];
    growthAreas = [
      'استيعاب المكتسبات والمفاهيم الرياضية القاعدية (الحساب الجبري والمنطقي)',
      'المواظبة الصارمة على إنجاز التمارين والواجبات المنزلية بدفتر الدروس',
      'التركيز أثناء حل الفروض المحروسة وتفادي تضييع نقط الأسئلة المباشرة'
    ];
    recommendationsForStudent = [
      'تخصيص 45 دقيقة يومياً لحل التمارين التطبيقية البسيطة والبدء بالأسئلة المباشرة لتثبيت القواعد.',
      'تدوين الأخطاء المرتكبة في الفروض السابقة داخل دفتر خاص وإعادة حلها بمفردك.',
      'طلب توضيح الخطوات غير المفهومة من الأستاذ فوراً دون تردد أثناء الحصة الدراسية.'
    ];
    recommendationsForTeacher = [
      'إدراج التلميذ في ورشات الدعم البيداغوجي الموجه والتركيز على أوراق العمل العلاجية ذات التدرج المبسط.',
      'تفعيل بيداغوجيا الأقران بتعيين تلميذ ميسّر لمرافقته أثناء الأنشطة والتمارين الصفية.',
      'مكافأة أي تقدم جزئي في الفروض المستمرة القصيرة لرفع الروح المعنوية واستعادة الثقة.'
    ];
    recommendationsForParent = [
      'وضع جدول زمني منزلي محدد لمراجعة الرياضيات والتأكد من إنجاز الواجبات يومياً دون حلها عنه.',
      'التواصل الدوري مع أستاذ المادة والإدارة التربوية لتتبع الحضور والجاهزية النفسية.',
      'توفير بيئة هادئة ومشجعة في المنزل والابتعاد عن التوبيخ أو المقارنات المحبطة.'
    ];
    predictedEvolution = 'يتوقع انتقال التلميذ إلى منطقة الأمان (فوق 10/20) في الفرض المحروس القادم في حال الالتزام بورقات المعالجة وحل 3 مسائل تطبيقية أسبوعياً.';
  } else if (gapValue <= -2.0) {
    gapClassification = 'continuous_higher';
    gapTitle = 'تفوق في أنشطة المراقبة والواجبات مقابل تراجع في الفروض المحروسة (ضغط الوقت وقلق الامتحان)';
    comparativeSummary = `يسجل ${studentName} تفوقاً ملحوظاً في أنشطة المراقبة المستمرة والواجبات المنزلية بمعدل (${cAvg}/20)، غير أن هذا الأداء ينخفض في الفروض المحروسة الكتابية إلى (${effectivePAvg}/20) بفارق يبلغ (${Math.abs(gapValue)} نقطة).`;
    cognitiveDiagnosis = 'يتمتع التلميذ باستيعاب جيد واجتهاد في الأنشطة المنزلية، لكنه يعاني من ضغط عامل الوقت أثناء الفرض المحروس، أو رهبة الامتحان والتردد في المبادرة، أو الاعتماد المفرط على مصادر مساعدة أثناء التحضير المنزلي دون اختبار النفس فردياً.';
    studentStrengths = [
      'مواظبة عالية وحرص على تقديم الواجبات والدفاتر في الآجال',
      'فهم نظري جيد للقواعد والتعاريف الرياضية',
      'انضباط صفي وتفاعل إيجابي مع أنشطة بناء التعلمات'
    ];
    growthAreas = [
      'التحكم في سرعة الإنجاز وإدارة زمن الفرض المحروس (ساعتان / ساعة ونصف)',
      'التدرب على حل المسائل المركبة دون الاستعانة بالدفتر أو الحلول الجاهزة',
      'الثبات الانفعالي وتقنيات ضبط القلق عند مواجهة أسئلة جديدة أو غير معتادة'
    ];
    recommendationsForStudent = [
      'التدرب المنزلي على نماذج فروض محروسة سابقة مع ضبط المنبه على توقيت الفرض تماماً ودون فتح الدفتر.',
      'البدء في ورقة الفرض بالتمارين التي تتقنها جيداً لجمع النقط وتعزيز الثقة في أول 20 دقيقة.',
      'تقسيم ورقة التسويد بإحكام وتنظيم خطوات البرهان لتفادي إعادة الحسابات وتضييع الوقت.'
    ];
    recommendationsForTeacher = [
      'إجراء اختبارات قصيرة موقوتة (Micro-evaluations de 10 min) لتدريب التلميذ تدريجياً على سرعة الحسم والتركيز.',
      'توجيه التلميذ لتقنيات قراءة نص الفرض كاملاً قبل الشروع في الحل وتوزيع الزمن بحسب سلم التنقيط.',
      'طمأنة التلميذ وتعزيز ثقته في قدراته الكتابية الفردية لتجاوز حاجز التردد.'
    ];
    recommendationsForParent = [
      'تشجيع التلميذ على الاعتماد الذاتي التام في حل الواجبات وتجنب البحث السريع عن الحلول الجاهزة في الإنترنت.',
      'توفير أجواء هادئة قبل موعد الفرض المحروس وتفادي تضخيم هاجس النقطة للحد من القلق الامتحاني.',
      'الثناء على جهوده الصادقة في الواجبات والمواظبة لتحفيزه على نقل هذا التألق إلى ورقة الامتحان.'
    ];
    predictedEvolution = 'بمجرد التمكن من استراتيجيات تدبير الوقت واجتياز فرض تجريبي محاكى، يتوقع ارتفاع معدل الفروض المحروسة بمقدار 2.5 إلى 4 نقط ليقترب من معدل المراقبة المستمرة.';
  } else if (gapValue >= 2.0) {
    gapClassification = 'proctored_higher';
    gapTitle = 'نباهة ذهنية عالية في الفروض المحروسة مع تهاون في أنشطة المراقبة الصفية والواجبات';
    comparativeSummary = `يُبدي ${studentName} كفاءة ذهنية واستيعاباً مميزاً تجلى في معدل الفروض المحروسة (${effectivePAvg}/20)، لكنه يهمل أنشطة المراقبة المستمرة والواجبات المنزلية المسجلة عند (${cAvg}/20) بفارق إيجابي يبلغ (+${gapValue} نقطة).`;
    cognitiveDiagnosis = 'يمتلك التلميذ نباهة رياضية وسرعة بديهة واستدلال تجعله يتجاوز الفروض المحروسة بذكاء، لكنه يقع في فخ التهاون والكسل في تدوين الدروس أو إنجاز الفروض المنزلية، ظناً منه أن الفهم الآني كافٍ.';
    studentStrengths = [
      'ذكاء رياضي وسرعة في إدراك العلاقات والاستنتاج المنطقي',
      'أداء قوي تحت الضغط وثقة بالنفس أثناء الامتحانات المحروسة',
      'قدرة عالية على حل المسائل المعقدة واستيعاب البراهين التجريدية'
    ];
    growthAreas = [
      'الالتزام اليومي بإنجاز الواجبات والتمارين المنزلية وتدوينها بانتظام',
      'الانضباط الصفي والمشاركة الفعالة في تصحيح الأنشطة على السبورة',
      'احترام الآجال المسطرة لتسليم الفروض المنزلية وأوراق البحث'
    ];
    recommendationsForStudent = [
      'إدراك أن التفوق المستدام في الرياضيات والامتحانات الإشهادية يتطلب عملاً منهجياً وتراكماً وليس ذكاءً لحظياً فقط.',
      'تخصيص دفتر مرتب للفروض المنزلية وإنجاز كافة التمارين المقررة دون استثناء.',
      'لعب دور إيجابي داخل الفصل ومساعدة زملائك المتعثرين لتحويل طاقتك الذهنية إلى قيادة صفية بنّاءة.'
    ];
    recommendationsForTeacher = [
      'تكليف التلميذ بمهام وتحديات رياضية إضافية متقدمة (Olympiades / مسابقات رياضية) لاستثارة شغفه ومقاومة الملل.',
      'إلزام التلميذ بتقديم دفاتر الواجبات وتصحيح التمارين بالسبورة لاستثمار نباهته ومحاسبته بيداغوجياً بحزم.',
      'ربط نقطة المراقبة المستمرة بإتمام المشاريع والبحوث المصغرة في مادة الرياضيات.'
    ];
    recommendationsForParent = [
      'متابعة دفتر النصوص ودفتر التمارين للتأكد من قيامه بالواجبات رغم تأكيده على "أنه يفهم الدرس".',
      'غرس قيمة الجهد والمواظبة والانضباط كعامل حاسم للنجاح المستقبلي في المسار الأكاديمي.',
      'تشجيعه وتوجيهه نحو المشاركة في المنافسات العلمية والأولمبياد الرياضية لصقل مواهبه.'
    ];
    predictedEvolution = 'عند التزامه بإنجاز الواجبات المنزلية والأنشطة الصفية، سيصل معدله العام للمراقبة المستمرة إلى مرتبة الامتياز والتفوق (+16/20).';
  } else if (effectivePAvg >= 14 && cAvg >= 14) {
    gapClassification = 'balanced_high';
    gapTitle = 'تميز وتوازن بيداغوجي رفيع بين المراقبة المستمرة والفروض المحروسة';
    comparativeSummary = `يُحقق ${studentName} انسجاماً رائعاً وتفوقاً متوازناً بين أدائه في الفروض المحروسة (${effectivePAvg}/20) وفروض وأنشطة المراقبة المستمرة (${cAvg}/20)، مما يدل على نضج منهجي والتزام استثنائي.`;
    cognitiveDiagnosis = 'استيعاب مفاهيمي متين، منهجية برهان دقيقة، مهارات تفكير عليا، وانضباط ذاتي عالٍ في متابعة الحصص وإنجاز الفروض المنزلية.';
    studentStrengths = [
      'دقة رياضية عالية وسلامة الصياغة الرمزية والبرهانية',
      'مواظبة تامة وانضباط صفي نموذجي',
      'توازن مثالي بين العمل المنزلي والتحكم في شروط الفرض المحروس'
    ];
    growthAreas = [
      'الارتقاء إلى حل التمارين ذات الأفق الأولمبي ومسائل الامتحانات الوطنية الصعبة',
      'صقل مهارات التفكير التجريدي والنمذجة الرياضية المعمقة',
      'الاستعداد المبكر لمباريات المدارس العليا والمعاهد التحضيرية'
    ];
    recommendationsForStudent = [
      'الانخراط في حل مسائل الأولمبياد الوطنية والمباراة العامة للعلوم والتقنيات (GMST).',
      'مواصلة الحفاظ على هذا الإيقاع الرائع مع الاهتمام بجودة التحرير ودقة التبريرات المنطقية.',
      'المساهمة في نوادي الرياضيات بالمؤسسة وتقديم شروحات لزملائك لتثبيت مكتسباتك.'
    ];
    recommendationsForTeacher = [
      'ترشيح التلميذ لتمثيل المؤسسة في المسابقات والأولمبياد الإقليمية والجهوية لمادة الرياضيات.',
      'تزويده بمراجع وتمارين إثرائية متقدمة تفتح أمامه آفاق الأقسام التحضيرية والمدارس العليا.',
      'اعتماده كميسّر رئيسي في أنشطة التعلم التعاوني وبيداغوجيا النظير داخل القسم.'
    ];
    recommendationsForParent = [
      'تثمين هذا التميز ومكافأة اجتهاده المستمر وتشجيعه على الحفاظ على هذا الشغف العلمي.',
      'توفير الكتب والمجلات العلمية المتخصصة لتوسيع مداركه المعرفية.',
      'دعمه في اختيار التوجيه الدراسي الأنسب لطموحاته وقدراته الرياضية العالية.'
    ];
    predictedEvolution = 'مرشح بقوة للتفوق في الامتحانات الإشهادية بميزات مشرفة وتمثيل المؤسسة في الاستحقاقات الوطنية.';
  } else {
    gapClassification = 'balanced_moderate';
    gapTitle = 'أداء متوسط منسجم وقابل للتطوير السريع نحو مراتب التميز';
    comparativeSummary = `يُظهر ${studentName} نتائج متقاربة ومستقرة بين الفروض المحروسة (${effectivePAvg}/20) وأنشطة المراقبة المستمرة والواجبات (${cAvg}/20)، مما يمثل أرضية صلبة للانطلاق نحو مراتب متقدمة.`;
    cognitiveDiagnosis = 'التلميذ يستوعب القواعد العامة وينجز معظم الواجبات، لكنه يحتاج إلى تعميق الدقة الرياضية، وتجنب الأخطاء الحسابية العابرة، وتطوير سرعة الربط بين المفاهيم المختلفة.';
    studentStrengths = [
      'استقرار المستوى وتجاوز عتبة المعدل بانتظام',
      'مواظبة جيدة ورغبة حقيقية في تطوير النتيجة',
      'استيعاب جيد للمفاهيم الأساسية للدروس'
    ];
    growthAreas = [
      'الانتقال من الحفظ الآلي للقواعد إلى الفهم الاستدلالي والبرهاني العميق',
      'التقليل من أخطاء الإشارات والحساب الجبري السريع في الفروض',
      'حل تمارين متنوعة تتضمن أفكاراً تركيبية غير نمطية'
    ];
    recommendationsForStudent = [
      'حل مسألتين مركبتين أسبوعياً تجمعان بين عدة دروس للتدرب على الأفكار الشاملة.',
      'مراجعة الحسابات بدقة قبل الانتقال إلى السؤال الموالي في ورقة الفرض المحروس.',
      'المشاركة التفاعلية في القسم ومناقشة طرق الحل البديلة مع الأستاذ والزملاء.'
    ];
    recommendationsForTeacher = [
      'توجيه التلميذ لتمارين المستوى الثاني (المتوسط المتقدم) لكسر رتابة التمارين المباشرة.',
      'التدقيق في منهجية صياغة البراهين لديه وتعليمه استخدام الروابط المنطقية بدقة (إذن، بما أن، يستلزم).',
      'تشجيعه وتنبيهه إلى أن القليل من الجهد الإضافي سينقله مباشرة إلى فئة المتفوقين.'
    ];
    recommendationsForParent = [
      'مواكبة تقدمه الإيجابي وتشجيعه على مراجعة إضافية قبل أسبوع من الفروض المحروسة.',
      'مساعدته على تنظيم وقته بين مختلف المواد لضمان توازن تحصيلي كامل.',
      'التواصل الإيجابي مع المؤسسة للاطلاع على تطور مردوده الصفي.'
    ];
    predictedEvolution = 'التلميذ مؤهل للقفز من معدل 11-12 إلى ما فوق 14/20 خلال الأسابيع القادمة بمجرد ضبط الدقة الحسابية وصياغة البراهين.';
  }

  const actionPlan = [
    {
      phase: 'المرحلة الأولى: الدعم الفوري وتحديد الثغرات (أسبوعان)',
      action: 'إجراء مراجعة لدفاتر الفروض السابقة، وتدوين قائمة الصعوبات المتكررة، وبدء التدرب على بطاقات علاجية فردية موجهة.',
      expectedOutcome: 'تصفية الأخطاء الشائعة واستعادة الثقة في التعامل مع المسائل المباشرة.'
    },
    {
      phase: 'المرحلة الثانية: محاكاة شروط الفرض المحروس (حتى موعد الفرض القادم)',
      action: 'إنجاز فرض محاكى في توقيت مضبوط، وإلزام التلميذ بتقديم دفاتر الواجبات اليومية دون إخلال.',
      expectedOutcome: 'اكتساب مهارة تدبير الوقت وتقليص الفجوة بين الأداء الصفي والأداء المحروس.'
    },
    {
      phase: 'المرحلة الثالثة: التثبيت والتقويم الشامل (نهاية الدورة)',
      action: 'مقارنة نقطة الفرض المحروس الموالي بمتوسط المراقبة المستمرة، وإعادة ضبط خطة التوجيه والتتبع.',
      expectedOutcome: 'تحقيق انسجام تام في النتائج وثبات المستوى فوق عتبة التفوق.'
    }
  ];

  return {
    gapValue,
    gapClassification,
    gapTitle,
    comparativeSummary,
    cognitiveDiagnosis,
    studentStrengths,
    growthAreas,
    recommendationsForStudent,
    recommendationsForTeacher,
    recommendationsForParent,
    actionPlan,
    predictedEvolution
  };
}

function generateMathRemediationFallback(payload: any): string {
  const className = payload?.className || 'القسم';
  const level = payload?.level || 'المستوى الدراسي';
  const examLabel = payload?.examLabel || 'الفرض المحروس';
  const stats = payload?.stats || {};
  const totalStudents = stats.totalStudents || 0;
  const classAvg = stats.classAverage !== undefined ? stats.classAverage : 10;
  const successRate = stats.successRate || '-';
  const failureRate = stats.failureRate || '-';
  const strugglingStudents: any[] = payload?.strugglingStudents || [];
  const topStudents: any[] = payload?.topStudents || [];
  const mathTopics: string[] = Array.isArray(payload?.mathTopics) && payload.mathTopics.length > 0 
    ? payload.mathTopics 
    : ['مبرهنة طاليس والحساب المثلثي', 'الحساب العددي والقوى والجذور', 'المعادلات والمتراجحات'];

  // Categorize struggling students
  const severe = strugglingStudents.filter(s => parseFloat(s.grade || s.average || '0') < 8);
  const moderate = strugglingStudents.filter(s => parseFloat(s.grade || s.average || '0') >= 8 && parseFloat(s.grade || s.average || '0') < 10);

  return `
  <div style="font-family: 'Cairo', system-ui, sans-serif; line-height: 1.7; color: #0f172a;">
    <!-- رأس التقرير البيداغوجي -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; border-radius: 12px; padding: 18px 22px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
        <span style="background: rgba(255,255,255,0.2); padding: 3px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 800;">
          ذكاء اصطناعي بيداغوجي متقدم • مادة الرياضيات
        </span>
        <span style="font-size: 0.8rem; color: #bfdbfe;">تاريخ الإنجاز: ${new Date().toLocaleDateString('ar-MA')}</span>
      </div>
      <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; font-weight: 800; color: #ffffff;">
        📊 تقرير التشخيص التحليلي وخطة الدعم الرياضي المخصصة
      </h3>
      <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.86rem; color: #e0f2fe; margin-top: 6px;">
        <span>القسم: <strong>${className}</strong></span>
        <span>المستوى: <strong>${level}</strong></span>
        <span>المحطة: <strong>${examLabel}</strong></span>
      </div>
    </div>

    <!-- مؤشرات الأداء الرقمية -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px;">
      <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center;">
        <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">المعدل العام للقسم</div>
        <div style="font-size: 1.3rem; font-weight: 900; color: ${classAvg >= 10 ? '#166534' : '#dc2626'};">${classAvg}/20</div>
      </div>
      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 10px; text-align: center;">
        <div style="font-size: 0.75rem; color: #15803d; font-weight: 700;">نسبة التحكم والنجاح</div>
        <div style="font-size: 1.3rem; font-weight: 900; color: #166534;">${successRate}</div>
      </div>
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 10px; text-align: center;">
        <div style="font-size: 0.75rem; color: #991b1b; font-weight: 700;">نسبة التعثر المستهدفة</div>
        <div style="font-size: 1.3rem; font-weight: 900; color: #dc2626;">${failureRate}</div>
      </div>
      <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 10px; text-align: center;">
        <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">التلاميذ بحاجة للدعم</div>
        <div style="font-size: 1.3rem; font-weight: 900; color: #1d4ed8;">${strugglingStudents.length} تلميذ</div>
      </div>
    </div>

    <!-- 1. تشخيص المفاهيم والمواضيع الرياضية المتعثرة -->
    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <h4 style="color: #1e3a8a; font-size: 1rem; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
        <span>🔍</span> 1. تفكيك الصعوبات الرياضية النوعية والعوائق المعرفية المرصودة:
      </h4>
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.86rem;">
        ${mathTopics.map((topic, idx) => `
          <div style="background: #f8fafc; border-right: 4px solid #2563eb; border-radius: 6px; padding: 10px 14px;">
            <strong style="color: #1e40af; font-size: 0.9rem; display: block; margin-bottom: 4px;">• الموضوع الرياضي (${idx + 1}): ${topic}</strong>
            <div style="color: #334155; line-height: 1.6;">
              <span style="font-weight: 700; color: #b91c1c;">مواطن التعثر:</span> خلط في الشروط الهندسية/الجبرية، صعوبة الانتقال من معطيات المسألة إلى الصياغة الرياضية (الترييض)، وأخطاء متكررة في إشارات الحساب وتوحيد المقامات.
              <br><span style="font-weight: 700; color: #047857;">التفسير الديداكتيكي:</span> ضعف في التمثل البصري للشكل الهندسي، أو عدم التمييز بين النتيجة والفرضية في المبرهنات الأساسية (المباشرة والعكسية).
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 2. بطاقة تفييء المتعثرين والأولويات البيداغوجية -->
    <div style="background: #ffffff; border: 1.5px solid #fecaca; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <h4 style="color: #dc2626; font-size: 1rem; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
        <span>⚠️</span> 2. فئات التلاميذ المستهدفين بالدعم الاستدراكي (${strugglingStudents.length} تلميذ):
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 10px; font-size: 0.84rem;">
        <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 8px; padding: 12px;">
          <div style="font-weight: 800; color: #991b1b; margin-bottom: 6px;">الفئة (أ): تعثر تحصيلي حاد (أقل من 08/20) - [${severe.length} تلميذ]</div>
          <div style="color: #7f1d1d; margin-bottom: 6px;">يحتاجون إلى إعادة بناء المفاهيم الأولية، بطاقات القواعد المبسطة، وتدريب تدريجي على الحساب الأساسي.</div>
          ${severe.length > 0 ? `
            <div style="background: #fff; border: 1px dashed #fca5a5; padding: 6px; border-radius: 6px; font-weight: 700; color: #b91c1c;">
              ${severe.map(s => `${s.name} (${s.grade || s.average || '-'})`).join(' • ')}
            </div>
          ` : '<span style="color: #16a34a;">لا يوجد تلاميذ في هذه الفئة.</span>'}
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px;">
          <div style="font-weight: 800; color: #92400e; margin-bottom: 6px;">الفئة (ب): تعثر جزئي وقابل للاستدراك (من 08 إلى 9.75/20) - [${moderate.length} تلميذ]</div>
          <div style="color: #78350f; margin-bottom: 6px;">يحتاجون إلى تمارين تطبيقية مكثفة لتثبيت التقنيات ومعالجة أخطاء الصياغة والبرهان الرياضي.</div>
          ${moderate.length > 0 ? `
            <div style="background: #fff; border: 1px dashed #fcd34d; padding: 6px; border-radius: 6px; font-weight: 700; color: #b45309;">
              ${moderate.map(s => `${s.name} (${s.grade || s.average || '-'})`).join(' • ')}
            </div>
          ` : '<span style="color: #16a34a;">لا يوجد تلاميذ في هذه الفئة.</span>'}
        </div>
      </div>
    </div>

    <!-- 3. المحاور التنفيذية لخطة الدعم والمعالجة -->
    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <h4 style="color: #0284c7; font-size: 1rem; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
        <span>🎯</span> 3. محاور خطة الدعم البيداغوجي الموجهة:
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; font-size: 0.85rem;">
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 3.5px solid #2563eb; border-radius: 8px; padding: 12px;">
          <strong style="color: #1d4ed8; display: block; margin-bottom: 6px;">أ. التمارين المتدرجة وبطاقات القواعد:</strong>
          <p style="margin: 0; color: #475569; line-height: 1.55;">
            توزيع بطاقة "خلاصة القواعد والشروط" لكل موضوع، يتبعها تمرين تطبيقي ذو خطوة واحدة، ثم تمرين تركيبي مدمج لربط النتائج.
          </p>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 3.5px solid #10b981; border-radius: 8px; padding: 12px;">
          <strong style="color: #047857; display: block; margin-bottom: 6px;">ب. بيداغوجيا الأقران والعمل الثنائي:</strong>
          <p style="margin: 0; color: #475569; line-height: 1.55;">
            تشكيل أزواج عمل صفية يرافق فيها التلاميذ المتفوقون ${topStudents.length > 0 ? `(مثل: ${topStudents.slice(0, 3).map(t => t.name).join('، ')})` : ''} زملاءهم لشرح خطوات الحل ومناقشة التعليلات.
          </p>
        </div>

        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-top: 3.5px solid #7c3aed; border-radius: 8px; padding: 12px;">
          <strong style="color: #6d28d9; display: block; margin-bottom: 6px;">ج. التوظيف الرقمي (GeoGebra):</strong>
          <p style="margin: 0; color: #475569; line-height: 1.55;">
            عرض أشكال هندسية ديناميكية عبر جهاز العرض لتوضيح ثبات النسب في مبرهنة طاليس وتغير الإشارات في الدوال والمعادلات.
          </p>
        </div>
      </div>
    </div>

    <!-- 4. الجدولة الزمنية ومؤشرات التحقق -->
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.84rem;">
      <div>
        <strong style="color: #1e40af;">⏱️ الجدولة الزمنية:</strong> تنفيذ 3 جلسات دعم مدمجة (20 دقيقة في بداية الحصص الاعتيادية) + حصة دعم مركّزة نهاية الأسبوع.
      </div>
      <div>
        <strong style="color: #047857;">📈 مؤشر تقييم الأثر:</strong> رائز كتابي سريع (15 دقيقة) للتأكد من قدرة 80% من المتعثرين على إنجاز التطبيق المباشر بنجاح قبل الفرض الموالي.
      </div>
    </div>
  </div>`;
}

function generateCustomPromptFallback(prompt: string, taskCategory: string): string {
  const cleanPrompt = (prompt || '').trim();
  const categoryLabels: Record<string, string> = {
    remediation: 'الدعم والمعالجة البيداغوجية',
    exam_prep: 'إعداد الفروض وسلالم التنقيط',
    didactics: 'الديداكتيك وترييض المسائل',
    lesson_planning: 'تخطيط الدروس والجذاذات التربوية',
    differentiation: 'البيداغوجيا الفارقية وتفييء المتعلمين',
    general: 'مهمة بيداغوجية وتربوية في مادة الرياضيات'
  };
  const catLabel = categoryLabels[taskCategory] || categoryLabels.general;

  return `📌 مخرجات المعالجة البيداغوجية الذكية (${catLabel}):
────────────────────────────────────────────────────

1️⃣ التشخيص والمنطلقات الديداكتيكية:
بناءً على معطيات الأمر البيداغوجي المقدم، يستهدف هذا الإجراء معالجة المكتسبات القبلية وتجويد التحصيل الدراسي في مادة الرياضيات وفق التوجيهات التربوية الرسمية للسلك الثانوي التأهيلي.

2️⃣ البطاقة التقنية والمنهجية المقترحة:
• التدرج الديداكتيكي: الانطلاق من تذكير مركز بالقواعد والمبرهنات الأساسية، ثم الانتقال من التطبيق المباشر إلى الوضعيات المركبة وترييض المسائل.
• معالجة التمثلات والأخطاء الشائعة: رصد العوائق الإبستيمولوجية في الحساب الجبري أو الهندسي أو التحليل، وتصحيح صياغة البرهان والاستدلال الرياضي.
• التفييء البيداغوجي:
  - الفئة أ (تعثر حاد): أنشطة مبسطة وبطاقات قواعد مركزة مع مرافقة فردية.
  - الفئة ب (تعثر متوسط): تمارين تطبيقية موجهة وتصحيح جماعي للأخطاء المتكررة.
  - الفئة ج (تحكم وتميز): مسائل توليفية وتكليف بمرافقة الأقران داخل مجموعات عمل مصغرة.

3️⃣ مؤشرات التقويم وقياس الأثر:
• إنجاز رائز قصير (10–15 دقيقة) في مستهل الحصة الموالية للتحقق من استيعاب المفهوم المستهدف.
• تتبع تطور الإنجاز الفردي في دفتر التمارين والمراقبة المستمرة.

────────────────────────────────────────────────────
💡 ملخص السياق المعالج:
${cleanPrompt.length > 350 ? cleanPrompt.substring(0, 350) + '...' : cleanPrompt}`;
}

interface PortfolioCalendarEvent {
  id: string;
  studentId?: string;
  studentName?: string;
  className?: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  endDate?: string;
  allDay?: boolean;
  category?: string; // 'exam' | 'tutoring' | 'behavior' | 'homework' | 'milestone' | 'custom'
  location?: string;
  alarmDays?: number[];
}

let storedPortfolioEvents: PortfolioCalendarEvent[] = [];

function generateICalFeed(events: PortfolioCalendarEvent[], calendarTitle = 'مهام ملف الإنجاز الرقمي - تقويم الأستاذ'): string {
  const now = new Date();
  const pad = (n: number) => n < 10 ? '0' + n : String(n);
  const nowUtc = now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) + 'T' +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) + 'Z';

  const cleanText = (str: string) => {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Studio//Student Digital Portfolio iCal Sync//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cleanText(calendarTitle)}`,
    'X-WR-TIMEZONE:Africa/Casablanca',
    'X-WR-CALDESC:المزامنة التلقائية لمهام وفروض وتنبيهات ملف الإنجاز الرقمي للتلاميذ مع تقويم الهاتف',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H'
  ];

  events.forEach(evt => {
    if (!evt || !evt.startDate || typeof evt.startDate !== 'string') return;
    const uid = evt.id ? `${evt.id}@portfolio.local` : `evt_${Math.random().toString(36).substring(2, 9)}@portfolio.local`;
    let dtStartLine = '';
    let dtEndLine = '';

    const isAllDay = evt.allDay !== false && !evt.startDate.includes('T');
    if (isAllDay) {
      const startParts = evt.startDate.split('-');
      if (startParts.length === 3) {
        const startStr = startParts.join('');
        dtStartLine = `DTSTART;VALUE=DATE:${startStr}`;
        const dStart = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
        let dEnd = new Date(dStart);
        if (evt.endDate && evt.endDate !== evt.startDate) {
          const endParts = evt.endDate.split('-');
          dEnd = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10) + 1);
        } else {
          dEnd.setDate(dEnd.getDate() + 1);
        }
        const endStr = dEnd.getFullYear() + pad(dEnd.getMonth() + 1) + pad(dEnd.getDate());
        dtEndLine = `DTEND;VALUE=DATE:${endStr}`;
      }
    } else {
      const cleanDt = evt.startDate.replace(/[-:]/g, '');
      dtStartLine = `DTSTART:${cleanDt}`;
      if (evt.endDate) {
        dtEndLine = `DTEND:${evt.endDate.replace(/[-:]/g, '')}`;
      } else {
        dtEndLine = `DTEND:${cleanDt}`;
      }
    }

    if (!dtStartLine) return;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowUtc}`);
    lines.push(dtStartLine);
    if (dtEndLine) lines.push(dtEndLine);
    lines.push(`SUMMARY:${cleanText(evt.title)}`);

    let fullDesc = evt.description || '';
    if (evt.studentName) fullDesc += `\nالتلميذ(ة): ${evt.studentName}`;
    if (evt.className) fullDesc += `\nالقسم: ${evt.className}`;
    lines.push(`DESCRIPTION:${cleanText(fullDesc)}`);

    if (evt.category) {
      lines.push(`CATEGORIES:${cleanText(evt.category.toUpperCase())}`);
    }
    if (evt.location) {
      lines.push(`LOCATION:${cleanText(evt.location)}`);
    }
    lines.push('STATUS:CONFIRMED');

    // Add Alarms (VALARM)
    // 1. Alarm 2 days before (المطلب الأساسي: إخطار الأستاذ قبل يومين)
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:تنبيه مسبق قبل يومين: ${cleanText(evt.title)}`);
    lines.push('TRIGGER:-P2D');
    lines.push('END:VALARM');

    // 2. Alarm 1 day before (24 hours)
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:تذكير غداً: ${cleanText(evt.title)}`);
    lines.push('TRIGGER:-P1D');
    lines.push('END:VALARM');

    // 3. Alarm morning of event at 08:00 / 2 hours before
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:اليوم: ${cleanText(evt.title)}`);
    lines.push('TRIGGER:-PT2H');
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

  // API route to sync portfolio tasks to server
  app.post("/api/ical/sync-portfolio", sameOriginGuard, createRateLimiter({ windowMs: 60_000, max: 30 }), (req, res) => {
    try {
      const { events, studentId } = req.body;
      if (Array.isArray(events)) {
        if (studentId) {
          // Replace events for this student
          storedPortfolioEvents = storedPortfolioEvents.filter(e => e.studentId !== studentId).concat(events);
        } else {
          // Upsert all events
          const incomingIds = new Set(events.map(e => e.id));
          storedPortfolioEvents = storedPortfolioEvents.filter(e => !incomingIds.has(e.id)).concat(events);
        }
        if (storedPortfolioEvents.length > 2000) {
          storedPortfolioEvents = storedPortfolioEvents.slice(-2000);
        }
      }
      res.json({ success: true, count: storedPortfolioEvents.length });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Sync failed' });
    }
  });

  // API route to get live iCal feed / download .ics
  app.get(["/api/ical/portfolio-feed", "/api/ical/portfolio.ics"], createRateLimiter({ windowMs: 60_000, max: 60 }), (req, res) => {
    const studentId = req.query.studentId as string;
    const className = req.query.className as string;
    const isDownload = req.query.download === "1";

    let filteredEvents = [...storedPortfolioEvents];
    if (studentId) {
      filteredEvents = filteredEvents.filter(e => !e.studentId || e.studentId === studentId);
    }
    if (className) {
      filteredEvents = filteredEvents.filter(e => !e.className || e.className === className);
    }

    // If no events synced yet, provide standard academic milestones & exam events
    if (filteredEvents.length === 0) {
      const defaultDecree = heuristicExtractDecree('', '2026-2027');
      const milestoneEvents: PortfolioCalendarEvent[] = defaultDecree.milestones.map(m => ({
        id: m.id,
        title: m.title,
        startDate: m.startDate,
        endDate: m.endDate,
        category: m.category,
        description: `${m.description}\nالمستويات المستهدفة: ${m.targetLevels}`
      }));
      filteredEvents = milestoneEvents;
    }

    const title = studentId
      ? `مهام ملف الإنجاز الرقمي - تلميذ`
      : `مهام ملفات الإنجاز الرقمي والفروض - تقويم الأستاذ`;

    const icsContent = generateICalFeed(filteredEvents, title);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      isDownload
        ? `attachment; filename="portfolio-tasks-${studentId || 'all'}.ics"`
        : `inline; filename="portfolio-tasks-${studentId || 'all'}.ics"`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(icsContent);
  });

  // ====================================================================
  // ENCRYPTED SHARING ENGINE FOR STUDENT RECORDS AND PEDAGOGICAL REPORTS
  // (مشاركة سجلات التلميذ والتقارير عبر رمز QR ورابط مباشر مشفر)
  // ====================================================================
  const shareSecretInfo = loadShareSecret();
  const SHARE_SECRET = shareSecretInfo.secret;
  if (shareSecretInfo.source !== 'env') {
    console.warn(
      `[security] SHARE_SECRET is not set. Using a ${shareSecretInfo.source} secret. ` +
      'Set SHARE_SECRET in your environment for stable, portable share links.'
    );
  }
  const pinAttemptLimiter = createAttemptLimiter(5, 15 * 60 * 1000);
  const sharedRecordsStore = new Map<string, {
    id: string;
    type: 'student' | 'report';
    title: string;
    subtitle?: string;
    teacherName?: string;
    schoolName?: string;
    encryptedData: string;
    salt: string;
    iv: string;
    tag: string;
    hasPin: boolean;
    pinHash?: string;
    createdAt: string;
    expiresAt: string;
    viewCount: number;
  }>();

  function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  }

  function encryptPayload(data: any, pin?: string): { encryptedData: string; salt: string; iv: string; tag: string } {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(pin ? `${pin}:${SHARE_SECRET}` : SHARE_SECRET, salt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const jsonStr = JSON.stringify(data);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');

    return {
      encryptedData: encrypted,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag
    };
  }

  function decryptPayload(encryptedData: string, saltBase64: string, ivBase64: string, tagBase64: string, pin?: string): any {
    const salt = Buffer.from(saltBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const key = deriveKey(pin ? `${pin}:${SHARE_SECRET}` : SHARE_SECRET, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  // 1. Create a secure encrypted share
  app.post("/api/share/create", sameOriginGuard, createRateLimiter({ windowMs: 60_000, max: 20 }), async (req, res) => {
    try {
      const {
        type = 'student',
        title = 'سجل بيداغوجي',
        subtitle = '',
        data,
        pin,
        expiryDays = 30,
        teacherName = '',
        schoolName = ''
      } = req.body || {};

      if (!data) {
        return res.status(400).json({ error: "البيانات المراد مشاركتها غير متوفرة." });
      }

      const shareId = 'sh_' + crypto.randomBytes(6).toString('base64url');
      const { encryptedData, salt, iv, tag } = encryptPayload(data, pin);

      const hasPin = Boolean(pin && pin.trim().length > 0);
      const pinHash = hasPin
        ? crypto.createHmac('sha256', SHARE_SECRET).update(pin.trim()).digest('hex')
        : undefined;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (expiryDays * 24 * 60 * 60 * 1000)).toISOString();

      const item = {
        id: shareId,
        type: type as 'student' | 'report',
        title: title || 'سجل بيداغوجي',
        subtitle,
        teacherName,
        schoolName,
        encryptedData,
        salt,
        iv,
        tag,
        hasPin,
        pinHash,
        createdAt: now.toISOString(),
        expiresAt,
        viewCount: 0
      };

      if (sharedRecordsStore.size >= 1000) {
        const nowMs = Date.now();
        for (const [k, v] of sharedRecordsStore) {
          if (new Date(v.expiresAt).getTime() < nowMs) sharedRecordsStore.delete(k);
        }
      }
      sharedRecordsStore.set(shareId, item);

      // Determine public share URL (Host header is untrusted: sanitize before use)
      const host = sanitizeHost(req.get('x-forwarded-host') || req.get('host'), `localhost:${PORT}`);
      const protocol = req.get('x-forwarded-proto') === 'https' || req.secure ? 'https' : 'http';
      const shareUrl = `${protocol}://${host}/?share=${shareId}`;

      // Generate visual QR Code
      const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 360,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });

      res.json({
        success: true,
        shareId,
        shareUrl,
        qrCodeDataUrl,
        hasPin,
        expiresAt
      });
    } catch (err: any) {
      console.error("Error creating share:", err);
      res.status(500).json({ error: "تعذر توليد رابط المشاركة المشفر: " + (err?.message || err) });
    }
  });

  // 2. Retrieve a shared record (with optional PIN verification)
  app.get("/api/share/:id", createRateLimiter({ windowMs: 60_000, max: 60 }), (req, res) => {
    try {
      const shareId = req.params.id;
      const record = sharedRecordsStore.get(shareId);

      if (!record) {
        return res.status(404).json({ error: "رابط المشاركة غير موجود أو انتهت صلاحيته." });
      }

      // Check expiry
      if (new Date(record.expiresAt).getTime() < Date.now()) {
        sharedRecordsStore.delete(shareId);
        return res.status(410).json({ error: "انتهت فترة صلاحية هذا الرابط المشفر." });
      }

      const clientPin = (req.headers['x-share-pin'] as string || req.query.pin as string || '').trim();

      if (record.hasPin) {
        const guard = pinAttemptLimiter.isBlocked(shareId);
        if (guard.blocked) {
          res.setHeader('Retry-After', String(guard.retryAfter));
          return res.status(429).json({
            success: false,
            requiresPin: true,
            error: 'محاولات كثيرة خاطئة. يرجى المحاولة لاحقاً.',
            title: record.title,
            subtitle: record.subtitle
          });
        }

        if (!clientPin) {
          return res.json({
            success: false,
            requiresPin: true,
            title: record.title,
            subtitle: record.subtitle,
            type: record.type,
            teacherName: record.teacherName,
            schoolName: record.schoolName
          });
        }

        const clientPinHash = crypto.createHmac('sha256', SHARE_SECRET).update(clientPin).digest('hex');
        if (!safeEqualHex(clientPinHash, record.pinHash || '')) {
          pinAttemptLimiter.recordFailure(shareId);
          return res.status(401).json({
            success: false,
            requiresPin: true,
            error: "القن السري غير صحيح. يرجى التأكد وإعادة المحاولة.",
            title: record.title,
            subtitle: record.subtitle
          });
        }

        pinAttemptLimiter.clear(shareId);
      }

      // Decrypt data
      try {
        const decryptedData = decryptPayload(
          record.encryptedData,
          record.salt,
          record.iv,
          record.tag,
          record.hasPin ? clientPin : undefined
        );

        record.viewCount += 1;

        res.json({
          success: true,
          type: record.type,
          title: record.title,
          subtitle: record.subtitle,
          teacherName: record.teacherName,
          schoolName: record.schoolName,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          data: decryptedData
        });
      } catch (decErr) {
        res.status(401).json({ error: "فشل فك تشفير البيانات المشتركة. قد يكون القن السري غير متطابق." });
      }
    } catch (err: any) {
      console.error("Error retrieving share:", err);
      res.status(500).json({ error: "حدث خطأ أثناء تحميل السجل المشترك." });
    }
  });

  // 3. Dynamic QR code generator endpoint
  app.post("/api/share/generate-qr", sameOriginGuard, createRateLimiter({ windowMs: 60_000, max: 60 }), async (req, res) => {
    try {
      const { text, width = 360 } = req.body || {};
      if (!text || typeof text !== 'string' || text.length > 4096) return res.status(400).json({ error: "النص المطلوب غير متوفر أو طويل جداً" });
      const qrCodeDataUrl = await QRCode.toDataURL(text, {
        width: Math.min(600, Math.max(160, Number(width) || 360)),
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
      res.json({ qrCodeDataUrl });
    } catch (err: any) {
      res.status(500).json({ error: "فشل توليد رمز QR: " + err?.message });
    }
  });

  // Direct friendly share route
  app.get('/share/:id', (req, res) => {
    const safeId = encodeURIComponent(String(req.params.id || '').replace(/[^a-zA-Z0-9_\-]/g, ''));
    res.redirect(`/?share=${safeId}`);
  });

  // 4. AI Smart Pedagogical Absence Summary & WhatsApp Message Generator
  function generateSmartAbsenceWhatsAppFallback(payload: any) {
    const studentName = payload?.studentName || 'التلميذ(ة)';
    const className = payload?.className || 'القسم';
    const schoolName = payload?.schoolName || 'المؤسسة التعليمية';
    const teacherName = payload?.teacherName || 'الأستاذ إبراهيم قزيبر';
    const subjectName = payload?.subjectName || 'مادة الرياضيات';
    const tone = payload?.tone || 'supportive';
    const customNote = (payload?.customNote || '').trim();

    const stats = payload?.patternStats || {};
    const totalHours = Number(stats.totalHours || 0);
    const unjustifiedHours = Number(stats.unjustifiedHours || 0);
    const justifiedHours = Number(stats.justifiedHours || 0);
    const absenceSessionsCount = Number(stats.absenceSessionsCount || 0);
    const lateCount = Number(stats.lateCount || 0);
    const missedHomeworkCount = Number(stats.missedHomeworkCount || 0);
    const mostFrequentDay = stats.mostFrequentDay || '';
    const consecutiveCount = Number(stats.consecutiveCount || 0);
    const recentDates: string[] = Array.isArray(stats.recentDates) ? stats.recentDates : [];
    const missedLessons: string[] = Array.isArray(stats.missedLessons) ? stats.missedLessons : [];
    const gradesInfo = payload?.gradesInfo || {};
    const behaviorInfo = payload?.behaviorInfo || {};

    // 1. Build Pattern Alert
    let patternAlert = 'متابعة اعتيادية للمواظبة والانضباط الصفي';
    if (consecutiveCount >= 2) {
      patternAlert = `رصد غياب متتالٍ (${consecutiveCount} حصص متتابعة) يؤثر على الترابط المفاهيمي لدروس الرياضيات`;
    } else if (mostFrequentDay && stats.mostFrequentDayCount >= 2) {
      patternAlert = `نمط غياب دوري متكرر يوم ${mostFrequentDay} (${stats.mostFrequentDayCount} مرات)`;
    } else if (unjustifiedHours >= 6) {
      patternAlert = `تراكم مقلق لساعات الغياب غير المبرر (${unjustifiedHours} ساعة غير مبررة)`;
    } else if (totalHours > 0) {
      patternAlert = `ساعات غياب مسجلة (${totalHours} ساعة في ${absenceSessionsCount} حصص) تستوجب الاستدراك المبكر`;
    } else if (lateCount > 0 || missedHomeworkCount > 0) {
      patternAlert = `تنبيه حول التأخرات (${lateCount}) أو عدم إنجاز الواجبات المنزلية (${missedHomeworkCount})`;
    }

    // 2. Build Pedagogical Diagnosis
    const diagParts: string[] = [];
    if (totalHours > 0) {
      diagParts.push(`سُجّل للتلميذ(ة) ${studentName} مجموع ${totalHours} ساعة غياب موزعة على ${absenceSessionsCount} حصة دراسية (${unjustifiedHours} س غير مبررة، و${justifiedHours} س مبررة).`);
    } else {
      diagParts.push(`لم يُسجّل للتلميذ(ة) ${studentName} غياب تراكمي مرتفع، وتندرج هذه المراسلة في إطار المواكبة التربوية الاستباقية.`);
    }

    if (mostFrequentDay && stats.mostFrequentDayCount >= 2) {
      diagParts.push(`يُلاحظ تركز الغياب بشكل متكرر يوم (${mostFrequentDay}) بمعدل ${stats.mostFrequentDayCount} مرات، مما يستدعي التحقق من أسباب هذا التزامن الأسبوعي.`);
    }
    if (consecutiveCount >= 2) {
      diagParts.push(`كما سُجّل انقطاع متتالٍ خلال ${consecutiveCount} حصص أخيرة، وهو ما يُحدث فجوة في استيعاب التسلسل المنطقي والبرهاني لفقرات درس الرياضيات.`);
    }
    if (missedLessons.length > 0) {
      diagParts.push(`تزامن الغياب مع إنجاز فقرات بيداغوجية مهمة في دفتر النصوص أبرزها: (${missedLessons.slice(0, 3).join('، ')}).`);
    }
    if (missedHomeworkCount > 0 || lateCount > 0) {
      diagParts.push(`سُجلت كذلك ${lateCount} حالات تأخر و${missedHomeworkCount} حالات عدم إنجاز للواجبات المنزلية.`);
    }
    if (gradesInfo && gradesInfo.avg !== null && gradesInfo.avg !== undefined && gradesInfo.avg !== '-') {
      diagParts.push(`معدل المراقبة المستمرة الحالي للدورة هو ${gradesInfo.avg}/20.`);
    }

    const pedagogicalDiagnosis = diagParts.join(' ');

    // 3. Build Pedagogical Recommendation
    let pedagogicalRecommendation = 'حث التلميذ(ة) على نقل الدروس الفائتة من زملائه وإنجاز التمارين التطبيقية المرتبطة بها قبل الحصة المقبلة.';
    if (missedLessons.length > 0) {
      pedagogicalRecommendation = `مراجعة محاور (${missedLessons.slice(0, 2).join(' و ')}) واستدراك التمارين التطبيقية الفائتة مع إمكانية الاستفادة من توجيهات الأستاذ في بداية الحصة أو حصة الدعم.`;
    } else if (unjustifiedHours >= 4) {
      pedagogicalRecommendation = 'تسوية الوضعية الإدارية للغياب لدى الحراسة العامة، ومرافقة التلميذ(ة) منزلياً لضمان انتظام حضوره وإنجاز فروضه.';
    }

    // 4. Build Ready-to-Send WhatsApp Message according to selected tone
    const datesBullet = recentDates.length > 0
      ? `• *تواريخ الحصص المسجلة:* ${recentDates.slice(0, 5).join(' ، ')}${recentDates.length > 5 ? ` (+${recentDates.length - 5} تواريخ أخرى)` : ''}.\n`
      : '';
    const patternBullet = (mostFrequentDay && stats.mostFrequentDayCount >= 2)
      ? `• *ملاحظة التكرار الزمني:* تكرر الغياب يوم *${mostFrequentDay}* (${stats.mostFrequentDayCount} مرات).\n`
      : (consecutiveCount >= 2 ? `• *ملاحظة التتابع:* غياب في *${consecutiveCount} حصص متتالية*.\n` : '');
    const lessonsBullet = missedLessons.length > 0
      ? `• *المحاور والدروس التي فاتت التلميذ(ة):* ${missedLessons.slice(0, 3).join(' | ')}.\n`
      : '';
    const hwLateBullet = (lateCount > 0 || missedHomeworkCount > 0)
      ? `• *الانضباط والواجبات:* تأخرات (${lateCount}) | عدم إنجاز الواجب (${missedHomeworkCount} مرات).\n`
      : '';
    const customBullet = customNote ? `\n📝 *ملاحظة خاصة من الأستاذ:*\n${customNote}\n` : '';

    let headerTitle = '📊 *ملخص بيداغوجي للمواظبة والتتبع التربوي*';
    let introLine = `في إطار التواصل التربوي البناء والحرص المشترك على التفوق الدراسي للتلميذ(ة) *${studentName}* بالقسم *${className}* (${schoolName})، نضع بين أيديكم هذا الملخص البيداغوجي لوضعيته(ا) في *${subjectName}*:`;
    let actionCall = `💡 *التوجيه البيداغوجي المقترح:*\nبما أن دروس الرياضيات مترابطة حلقاتها، نرجو حث التلميذ(ة) على استدراك ما فاته ونقل الدروس والتمارين المصححة، ونحن رهن الإشارة لتقديم الدعم والتوضيح اللازم داخل الفصل.`;

    if (tone === 'preventive') {
      headerTitle = '⚠️ *تنبيه تربوي وقائي حول تكرار الغياب والمواظبة*';
      introLine = `حرصاً منا على تتبع المسار الدراسي للتلميذ(ة) *${studentName}* بالقسم *${className}* (${schoolName})، نود لفت عنايتكم الكريمة إلى تسجيل مؤشرات غياب متكررة في حصة *${subjectName}* قد تنعكس سلباً على تحصيله(ا):`;
      actionCall = `⚠️ *توصية وقائية عاجلة:*\nإن تكرار الغياب يؤدي إلى صعوبة مسايرة النسق التصاعدي لدروس الرياضيات وفروض المراقبة المستمرة. نرجو التدخل التربوي لتأمين المواظبة المنتظمة وتفادي تراكم الفجوات المعرفية.`;
    } else if (tone === 'official') {
      headerTitle = '🏛️ *إشعار رسمي بخصوص وضعية الغياب والمواظبة*';
      introLine = `إلى السيد(ة) ولي أمر التلميذ(ة) *${studentName}* المسجل(ة) بالقسم *${className}* (${schoolName})؛\nنحيطكم علماً بالبيان التفصيلي للغيابات المسجلة بحق ابنكم/ابنتكم في *${subjectName}*:`;
      actionCall = `📌 *الإجراء الإداري والتربوي المطلوب:*\nنرجو التفضل بموافاة إدارة المؤسسة بمبررات الغياب القانونية في أقرب الآجال، والتواصل معنا أو مع الحراسة العامة لتتبع انضباط التلميذ(ة) ومواظبته(ا).`;
    } else if (tone === 'remedial') {
      headerTitle = '🎯 *ملخص بيداغوجي ودعوة لاستدراك التعثرات والدعم*';
      introLine = `في سياق المواكبة البيداغوجية الفردية للتلميذ(ة) *${studentName}* بالقسم *${className}* (${schoolName})، نشارككم تشخيص الغيابات المسجلة وأثرها على مكتسباته(ا) في *${subjectName}*:`;
      actionCall = `🤝 *خطة الاستدراك والدعم التربوي:*\nندعو التلميذ(ة) إلى مراجعة المحاور الفائتة المذكورة أعلاه وإنجاز سلاسل التمارين المرتبطة بها، مع الحرص على حضور حصص الدعم والاستدراك المبرمجة لتجاوز أي تعثر قبل الفرض المحروس المقبل.`;
    }

    const whatsappMessage = `السلام عليكم ورحمة الله وبركاته،\nتحية طيبة لولي أمر التلميذ(ة): *${studentName}*\n\n${headerTitle}\n${introLine}\n\n📌 *حصيلة المواظبة والتتبع الزمني:*\n• *إجمالي ساعات الغياب:* ${totalHours} ساعة (${ absenceSessionsCount } حصص: ${unjustifiedHours} س غير مبررة / ${justifiedHours} س مبررة).\n${datesBullet}${patternBullet}${lessonsBullet}${hwLateBullet}${customBullet}\n${actionCall}\n\nمع خالص التقدير والاحترام،\n*منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر*`;

    return {
      source: 'pedagogical_engine',
      patternAlert,
      pedagogicalDiagnosis,
      pedagogicalRecommendation,
      whatsappMessage
    };
  }

  app.post("/api/ai/absence-whatsapp-summary", sameOriginGuard, aiLimiter, async (req, res) => {
    try {
      const payload = req.body || {};
      const apiKey = getValidGeminiApiKey();

      if (!apiKey) {
        return res.json(generateSmartAbsenceWhatsAppFallback(payload));
      }

      const ai = createGeminiClient(apiKey);

      const toneDescriptions: Record<string, string> = {
        supportive: 'تواصلي تربوي ودي وبنّاء يركز على الشراكة بين الأسرة والأستاذ وتشجيع التلميذ على تدارك ما فاته',
        preventive: 'تنبيهي وقائي مهذب يحذر من خطورة تكرار الغياب وتأثيره المباشر على فهم التسلسل المنطقي لدروس الرياضيات ونقط الفروض',
        official: 'إشعار رسمي إداري وتربوي دقيق يطالب بتبرير الغياب القانوني والالتزام بالحضور المنتظم',
        remedial: 'تشخيصي استدراكي يربط تواريخ الغياب بالدروس الفائتة ويدعو التلميذ لخطة مراجعة وحضور حصص الدعم التربوي'
      };

      const selectedToneDesc = toneDescriptions[payload.tone || 'supportive'] || toneDescriptions.supportive;

      const prompt = `أنت خبير بيداغوجي وأستاذ التعليم الثانوي التأهيلي لمادة الرياضيات بالمغرب (الأستاذ إبراهيم قزيبر).
مهمتك هي تحليل سجل وتواريخ غياب التلميذ(ة) وتكرارها ونمطها الزمني، وتوليد:
1) تشخيص بيداغوجي ذكي ومعمق (يربط تواريخ الغياب وتكرارها في أيام محددة أو حصص متتالية بالدروس المنجزة في دفتر النصوص وتأثير ذلك على التحصيل في مادة الرياضيات).
2) رسالة واتساب (WhatsApp) احترافية، جاهزة للإرسال مباشرة إلى ولي الأمر، منسقة برموز واتساب (*نص عريض* ونقاط واضحة)، تحترم أسلوب المراسلة المختار.

بيانات التلميذ(ة) وسجل الغياب والتتبع:
${JSON.stringify(payload, null, 2)}

أسلوب ونبرة المراسلة المطلوبة:
${selectedToneDesc}

شروط إلزامية في نص رسالة الواتساب (whatsappMessage):
- ابدأ بتحية إسلامية وتربوية راقية موجهة لولي أمر التلميذ(ة) مع ذكر اسم التلميذ(ة) والقسم.
- اذكر بدقة حصيلة الغياب (إجمالي الساعات، غير المبررة والمبررة، وتواريخ الغياب المسجلة، وأي نمط تكرار زمني مثل تكرار الغياب في يوم معين أو حصص متتالية).
- إذا وُجدت دروس مسجلة في دفتر النصوص تزامنت مع غياب التلميذ (missedLessons)، اذكرها بوضوح ليعرف ولي الأمر ما فات ابنه في مادة الرياضيات.
- قدم توجيهاً بيداغوجياً عملياً لتدارك الدروس والتمارين.
- إذا أضاف الأستاذ ملاحظة خاصة (customNote)، ادمجها بأسلوب تربوي لبق.
- اختم الرسالة دائماً بهذا التوقيع الرسمي حرفياً:
*منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر*`;

      const generatePromise = ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              patternAlert: {
                type: Type.STRING,
                description: "عنوان موجز للنمط الزمني للغياب المرصود (مثلاً: تكرار الغياب يوم الإثنين / غياب متتالٍ في حصص الدوال)"
              },
              pedagogicalDiagnosis: {
                type: Type.STRING,
                description: "تحليل بيداغوجي لتاريخ غياب التلميذ وتكراره وعلاقته بالدروس الفائتة والتحصيل الدراسي"
              },
              pedagogicalRecommendation: {
                type: Type.STRING,
                description: "توصية عملية للأستاذ وولي الأمر لمعالجة الغياب واستدراك التعثرات"
              },
              whatsappMessage: {
                type: Type.STRING,
                description: "نص الرسالة الجاهزة للإرسال عبر واتساب لولي الأمر منسقة وجاهزة"
              }
            },
            required: ["patternAlert", "pedagogicalDiagnosis", "pedagogicalRecommendation", "whatsappMessage"]
          }
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("انتهت مهلة الاتصال بالذكاء الاصطناعي")), 9000)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = (response.text || "").trim();
      const parsed = parseAiJson(rawText);

      if (!parsed || !parsed.whatsappMessage) {
        return res.json(generateSmartAbsenceWhatsAppFallback(payload));
      }

      res.json({
        source: 'gemini_ai',
        patternAlert: parsed.patternAlert || 'تحليل ذكي لنمط المواظبة والغياب',
        pedagogicalDiagnosis: parsed.pedagogicalDiagnosis || '',
        pedagogicalRecommendation: parsed.pedagogicalRecommendation || '',
        whatsappMessage: parsed.whatsappMessage
      });
    } catch (error: any) {
      console.info("Using absence WhatsApp summary fallback");
      res.json(generateSmartAbsenceWhatsAppFallback(req.body || {}));
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: "spa",
    });
    
    // Intercept /@vite/client to completely prevent WebSocket HMR connections and related [vite] console errors
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.send(`
const sheetsMap = new Map();
export class ErrorOverlay extends HTMLElement {}
if (typeof customElements !== 'undefined' && !customElements.get('vite-error-overlay')) {
  customElements.define('vite-error-overlay', ErrorOverlay);
}
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    if (style.parentNode) style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const match = url.match(/\\?([^#]*)/);
  const search = match ? match[1] : '';
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search : ''}\`;
}
export class FakeHMRContext {
  constructor(ownerPath) {
    this.ownerPath = ownerPath;
    this.data = {};
  }
  accept(cb) { if (typeof cb === 'function') { try { cb(); } catch(e){} } }
  acceptExports() {}
  dispose() {}
  prune() {}
  decline() {}
  invalidate() {}
  on() {}
  off() {}
  send() {}
}
export function createHotContext(ownerPath) {
  return new FakeHMRContext(ownerPath);
}
`);
    });

    app.use((req, res, next) => {
      if (req.url.includes('html-proxy')) {
        res.setHeader('Content-Type', 'application/javascript');
        return res.send(`
          console.log("Intercepted stale html-proxy request, unregistering SW and reloading...");
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              for (const registration of registrations) {
                registration.unregister();
              }
              window.location.reload();
            });
          } else {
            window.location.reload();
          }
        `);
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });
}

startServer();
