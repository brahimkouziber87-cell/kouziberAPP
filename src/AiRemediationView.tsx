import { useState, useMemo } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Brain,
  Target,
  Clock,
  Printer,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  QrCode
} from 'lucide-react';

export interface StudentMetric {
  id: string;
  name: string;
  massar: string;
  className: string;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4?: number | null;
  avg: number | null;
  delta: number | null;
  deltaPercent: number | null;
  trajectory: 'improving' | 'declining' | 'stable' | 'unknown';
  validExamsCount: number;
}

export interface AiRemediationViewProps {
  db: any;
  selectedClass: string;
  semester: 's1' | 's2';
  studentMetrics: StudentMetric[];
  classAverages: any;
}

export interface RemediationActivity {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  commonErrors: string;
  title: string;
  objective: string;
  strategy: string;
  strategyType: 'peer' | 'workshop' | 'digital' | 'individual';
  miniExercise: string;
  durationMinutes: number;
  verificationIndicator: string;
}

// Catalog of didactic math difficulties and customized remediation activities for Moroccan curriculum
const REMEDIATION_CATALOG: Record<string, {
  label: string;
  icon: string;
  commonErrors: string;
  activities: Array<{
    title: string;
    objective: string;
    strategy: string;
    strategyType: 'peer' | 'workshop' | 'digital' | 'individual';
    miniExercise: string;
    duration: number;
    indicator: string;
  }>;
}> = {
  algebra_signs: {
    label: 'الحساب العددي في ℝ والحدوديات والترتيب والمجالات',
    icon: '⚡',
    commonErrors: 'أخطاء في الحساب داخل المجموعة ℝ، القيمة المطلقة والتأطير، القسمة الإقليدية للحدوديات على (x - α)، وتحديد إشارة ثلاثية الحدود ax² + bx + c.',
    activities: [
      {
        title: 'ورشة التحكم في الترتيب في ℝ والقيمة المطلقة والتأطير',
        objective: 'التمكن من قواعد الترتيب والتأطير في ℝ وحل المعادلات والمتراجحات المتضمنة للقيمة المطلقة وتمثيل المجالات.',
        strategy: 'بيداغوجيا الأقران: العمل في ثنائي تعاوني لمراجعة خصائص التأطير وإنجاز وضعيات متدرجة وفق التوجيهات التربوية للسلك الثانوي التأهيلي.',
        strategyType: 'peer',
        miniExercise: '1) ليكن x و y عددين حقيقيين بحيث: 2 ≤ x ≤ 5 و -4 ≤ y ≤ -1.\nأطر التعابير التالية: x + y ، x - y ، x×y ، و x/y.\n2) حل في ℝ المتراجحة: |2x - 3| ≤ 5 ومثل مجموعة الحلول على مستقيم مدرج.',
        duration: 35,
        indicator: 'إنجاز تأطير جداء وخارج عددين حقيقيين وحل متراجحة القيمة المطلقة بنجاح تام في روائز التتبع.'
      },
      {
        title: 'بطاقة الدعم المركز: الحدوديات والقسمة الإقليدية وإشارة ثلاثية الحدود',
        objective: 'التحكم في تقنية القسمة الإقليدية لحدودية P(x) على (x - α) وتعميلها ودراسة إشارتها في ℝ.',
        strategy: 'توجيه فردي موجه: حل وضعيات تدريبية مع التبرير المنهجي لكل مرحلة.',
        strategyType: 'workshop',
        miniExercise: 'لتكن الحدودية: P(x) = 2x³ - 5x² + x + 2.\n1) تحقق أن 2 جذر للحدودية P(x).\n2) أنجز القسمة الإقليدية لـ P(x) على (x - 2) ثم عمّل P(x) إلى جداء حدوديات من الدرجة الأولى.\n3) استنتج حلول المتراجحة P(x) ≥ 0 في ℝ.',
        duration: 35,
        indicator: 'إتقان جدول إشارة ثلاثية الحدود والتعميل بالجذر بنسبة 100%.'
      }
    ]
  },
  thales_trig: {
    label: 'الحساب المثلثي وصيغ التحويل والمعادلات المثلثية',
    icon: '📐',
    commonErrors: 'صعوبة تمثيل الأفاصيل المنحنية الرئيسية على الدائرة المثلثية، الخلط في علاقات التحويل المثلثية، ونسيان الحلول الدورية (+2kπ) في المعادلات المثلثية.',
    activities: [
      {
        title: 'مختبر الدائرة المثلثية: الأفصول المنحني الرئيسي والعلاقات الأساسية',
        objective: 'تحديد الأفصول المنحني الرئيسي لنقطة على الدائرة المثلثية وتوظيف الزوايا المرتبطة (π-x, π+x, π/2-x) لحساب النسب المثلثية.',
        strategy: 'دعامة بصرية رقمية: محاكاة تفاعلية على الدائرة المثلثية ببرمجية GeoGebra لربط التماثل الهندسي بالصيغ الجبرية.',
        strategyType: 'digital',
        miniExercise: '1) حدد الأفصول المنحني الرئيسي للعدد: α = 37π/4 ثم احسب cos(α) و sin(α).\n2) بسط التعبير التالي:\nA(x) = cos(π - x) + sin(π/2 - x) - cos(x + π) + sin(-x).',
        duration: 40,
        indicator: 'حساب القيم المضبوطة للنسب المثلثية وتبسيط تعابير الزوايا المرتبطة بدقة.'
      },
      {
        title: 'عيادة المعادلات والمتراجحات المثلثية وصيغ التحويل',
        objective: 'حل المعادلات المثلثية الأساسية cos(x)=a و sin(x)=a في ℝ وفي مجال محدد مثل [-π, π] أو [0, 2π[.',
        strategy: 'عمل بالمجموعات الصغيرة الموجهة: حل وضعيات متدرجة وتمثيل الحلول على الدائرة المثلثية.',
        strategyType: 'workshop',
        miniExercise: '1) حل في ℝ ثم في المجال [-π, π] المعادلة:\n2cos(x) - √3 = 0\n2) حل في المجال [0, 2π[ المتراجحة:\nsin(x) ≥ 1/2 مع تمثيل القوس الموافق على الدائرة المثلثية.',
        duration: 35,
        indicator: 'تحديد جميع الحلول في المجال المطلوب وتمثيلها على الدائرة المثلثية بدون أخطاء.'
      }
    ]
  },
  equations_modelling: {
    label: 'النهايات والاتصال والاشتقاق ودراسة الدوال العددية',
    icon: '🎯',
    commonErrors: 'صعوبة إزالة الأشكال غير المحددة في النهايات، الخلط في شروط مبرهنة القيم الوسيطية، وأخطاء في حساب مشتقة مركب دالتين وتأويلها الهندسي.',
    activities: [
      {
        title: 'ورشة التحكم في تقنيات حساب النهايات والاتصال ومبرهنة القيم الوسيطية',
        objective: 'رفع الأشكال غير المحددة باستعمال التعميل والمرافق، وتطبيق مبرهنة القيم الوسيطية لإثبات وجود ووحدانية حل المعادلة f(x)=0.',
        strategy: 'ورشة تطبيقية موجهة: تفكيك منهجي لخطوات دراسة الاتصال والنهايات وفق الأطر المرجعية.',
        strategyType: 'workshop',
        miniExercise: '1) احسب النهايتين:\nlim(x→2) (x² - 4)/(√(x+2) - 2)  و  lim(x→+∞) (√(x² + x + 1) - x)\n2) لتكن f(x) = x³ + 3x - 5. بين أن المعادلة f(x) = 0 تقبل حلاً وحيداً α في المجال ]1, 2[.',
        duration: 40,
        indicator: 'صياغة برهان مبرهنة القيم الوسيطية (الاتصال + الرتابة قطعا + شرط الصور) بشكل تام وسليم.'
      },
      {
        title: 'معالجة الاشتقاق ومعادلة المماس وجدول تغيرات دالة عددية',
        objective: 'ضبط قواعد اشتقاق الدوال الجذرية والمركبة واللوغاريتمية والأسية، وتحديد رتابة الدالة من إشارة المشتقة f\'(x).',
        strategy: 'تمرين علاجي فردي مع بطاقة المراقبة الذاتية للتأويلات الهندسية للاشتقاق.',
        strategyType: 'individual',
        miniExercise: 'لتكن الدالة العددية f المعرفة على ℝ\\{1} بـ: f(x) = (x² - x + 2)/(x - 1).\n1) احسب f\'(x) لكل x ≠ 1 وادرس إشارتها.\n2) ضع جدول تغيرات الدالة f وحدد مطاريفها المحلية.\n3) اكتب معادلة المماس (T) للمنحنى (Cf) عند النقطة ذات الأفصول x₀ = 2.',
        duration: 35,
        indicator: 'حساب المشتقة بشكل صحيح واستنتاج جدول التغيرات ومعادلة المماس دون خطأ حسابي.'
      }
    ]
  },
  pythagoras_geometry: {
    label: 'الهندسة الفضائية والجداء السلمي والمتجهي والفلكة',
    icon: '📐',
    commonErrors: 'صعوبة تحديد المتجهة المنظمية لمستوى، الخلط بين التمثيل البارامتري لمستقيم ومعادلة ديكارتية لمستوى، وحساب مسافة نقطة عن مستوى.',
    activities: [
      {
        title: 'ورشة الهندسة التحليلية في الفضاء: المستقيمات والمستويات والفلكة',
        objective: 'تحديد معادلة ديكارتية لمستوى بمعرفة نقطة ومتجهة منظمية، ودراسة الوضع النسبي لمستوى وفلكة في الفضاء.',
        strategy: 'بيداغوجيا الأقران مع تمثيل ثلاثي الأبعاد: تحليل المعطيات الهندسية وتحويلها إلى علاقات سلمية ومتجهية.',
        strategyType: 'peer',
        miniExercise: 'في الفضاء المنسوب إلى معلم متعامد ممنظم مباشر (O,i,j,k)، نعتبر النقطة A(1,2,-1) والمتجهة n(2,-1,2).\n1) حدد معادلة ديكارتية للمستوى (P) المار من A والمنظمية عليه المتجهة n.\n2) احسب مسافة النقطة Ω(3,0,1) عن المستوى (P).\n3) استنتج الوضع النسبي للمستوى (P) والفلكة (S) التي مركزها Ω وشعاعها R = 3.',
        duration: 40,
        indicator: 'تحديد معادلة المستوى وحساب المسافة واستنتاج تقاطع الفلكة والمستوى بدقة.'
      }
    ]
  },
  roots_powers: {
    label: 'المتتاليات العددية والبرهان بالترجع والتقارب',
    icon: '🔢',
    commonErrors: 'ارتباك في صياغة مراحل البرهان بالترجع، الخلط بين المتتالية الحسابية والهندسية، وصعوبة دراسة رتابة وتقارب متتالية ترجعية u_(n+1) = f(u_n).',
    activities: [
      {
        title: 'ورشة المتتاليات العددية: البرهان بالترجع والرتابة والمتتالية المساعدة',
        objective: 'التمكن من إثبات الكبر والصغر بالترجع، دراسة رتابة (u_n) بحساب u_(n+1) - u_n، واستغلال متتالية هندسية مساعدة لتحديد الحد العام ونهاية المتتالية.',
        strategy: 'بيداغوجيا الأقران: حل مسألة متكاملة حول المتتاليات الترجعية وفق منهجية الامتحان الوطني الموحد.',
        strategyType: 'peer',
        miniExercise: 'نعتبر المتتالية (u_n) المعرفة بـ u₀ = 5 ولكل n من ℕ: u_(n+1) = (1/2)u_n + 2.\n1) بين بالترجع أن: (∀n∈ℕ) u_n > 4.\n2) بين أن المتتالية (u_n) تناقصية واستنتج أنها متقاربة.\n3) نضع v_n = u_n - 4؛ بين أن (v_n) متتالية هندسية محدداً أساسها، ثم اكتب u_n بدلالة n واحسب lim u_n.',
        duration: 40,
        indicator: 'تحرير البرهان بالترجع وتحديد الحد العام ونهاية المتتالية بدون أخطاء منهجية.'
      }
    ]
  },
  vectors_analytic: {
    label: 'المرجح في المستوى والجداء السلمي والأعداد العقدية',
    icon: '↗️',
    commonErrors: 'أخطاء في خاصية التجميعية للمرجح، صعوبة تحديد مجموعات النقط في المستوى، والخلط في الشكل المثلثي والجبري لعدد عقدي والتأويل الهندسي.',
    activities: [
      {
        title: 'مختبر المستوى التحليلي والعقدي: المرجح والجداء السلمي والأعداد العقدية',
        objective: 'توظيف خاصية المرجح وعلاقة شال والجداء السلمي أو الأعداد العقدية لتحديد مجموعات النقط والطبيعة الهندسية للمثلثات والتحويلات.',
        strategy: 'نشاط تطبيقي يربط الحساب المتجهي/العقدي بالتأويل الهندسي المباشر.',
        strategyType: 'digital',
        miniExercise: '1) لتكن G مرجح النقطتين المتزنتين (A,2) و (B,1). حدد وأنشئ مجموعة النقط M من المستوى بحيث: ||2MA + MB|| = 6.\n2) في المستوى العقدي، نعتبر النقط A(1+i) و B(3-i) و C(2+2i). احسب (z_C - z_A)/(z_B - z_A) واستنتج طبيعة المثلث ABC.',
        duration: 40,
        indicator: 'ربط سليم بين العلاقة المتجهية/العقدية والخاصية الهندسية الموافقة لها.'
      }
    ]
  },
  proof_reasoning: {
    label: 'المنطق الرياضي وأنماط الاستدلال (الترجع، الخلف، فصل الحالات، التكافؤ)',
    icon: '📝',
    commonErrors: 'الخلط بين الاستلزام P⇒Q والتكافؤ P⇔Q، صعوبة نفي العبارات المكممة (∀ و ∃)، وضعف هيكلة البرهان بالخلف أو بفصل الحالات.',
    activities: [
      {
        title: 'ورشة المنطق والاستدلال الرياضي المهيكل وفق التوجيهات التربوية الرسمية',
        objective: 'تدريب المتعلم على التحكم في المكممات المنطقية ونفيها، واختيار نمط الاستدلال المناسب (التكافؤات المتتالية، البرهان بالخلف، المثال المضاد، الترجع).',
        strategy: 'ملء هياكل البراهين الموجهة (Guided Proof Skeleton) ثم تحرير براهين مستقلة وفق المذكرة 142-08.',
        strategyType: 'workshop',
        miniExercise: '1) أعط نفي العبارة التالية ثم حدد قيمتها الحقيقية:\n(P): (∀x∈ℝ) (∃y∈ℝ) : x + y > 0\n2) باستعمال الاستدلال بالخلف أو التكافؤات المتتالية، بين أنه لكل x و y من ℝ⁺:\n√(x + y) = √x + √y ⇔ (x = 0 أو y = 0).',
        duration: 35,
        indicator: 'تحرير برهان رياضي سليم منطقياً ولغوياً مع توظيف الروابط المنطقية بدقة.'
      }
    ]
  }
};

const CATEGORY_KEYS = Object.keys(REMEDIATION_CATALOG);

// Deterministic heuristic diagnostic to classify student error type based on their marks profile
function diagnoseStudentMathError(std: StudentMetric): string {
  // If student has a sharp drop from F1 to F2 (F1 >= 10 and F2 < 8)
  if (std.f1 !== null && std.f2 !== null && std.f1 >= 10 && std.f2 < 8) {
    return 'thales_trig'; // Geometry & Trig introduced in exam 2
  }

  // If student has consistent very low grade (< 6)
  if (std.avg !== null && std.avg < 6) {
    return 'algebra_signs'; // Foundational algebra & signs issue
  }

  // If student failed exam 1 severely (F1 < 7)
  if (std.f1 !== null && std.f1 < 7) {
    return 'roots_powers';
  }

  // If student has moderate struggling (6 <= avg < 8)
  if (std.avg !== null && std.avg < 8) {
    return 'equations_modelling';
  }

  // If student struggles with 8 <= avg < 10
  if (std.avg !== null && std.avg < 10) {
    // Hash based on student ID to vary pedagogical suggestions across students
    const sumChars = std.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const catList = ['pythagoras_geometry', 'vectors_analytic', 'proof_reasoning', 'thales_trig'];
    return catList[sumChars % catList.length];
  }

  return 'algebra_signs';
}

export interface StrugglingTierPlan {
  tierKey: 'tier_a' | 'tier_b' | 'tier_c' | 'tier_d';
  badgeCode: string;
  title: string;
  thresholdLabel: string;
  headerBg: string;
  borderCls: string;
  badgeCls: string;
  diagnosticSummary: string;
  pedagogicalStrategy: string;
  weeklyAllocation: string;
  groupingMode: string;
  proposedActivities: Array<{
    title: string;
    description: string;
    targetSkill: string;
  }>;
  customExercise: string;
  successIndicator: string;
  students: Array<{
    student: StudentMetric;
    evaluatedScore: number | null;
    diagnosedErrorLabel: string;
  }>;
}

export default function AiRemediationView({
  db,
  selectedClass,
  semester,
  studentMetrics,
  classAverages
}: AiRemediationViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'severe' | 'moderate' | 'mild' | 'declining'>('all');
  const [scannedExamSource, setScannedExamSource] = useState<'all' | 'f1' | 'f2' | 'f3' | 'f4'>('all');
  const [displayMode, setDisplayMode] = useState<'both' | 'cohorts_only' | 'students_only'>('both');
  const [customErrorOverrides, setCustomErrorOverrides] = useState<Record<string, string>>({});
  const [customTierActivityNotes, setCustomTierActivityNotes] = useState<Record<string, string>>({});
  const [editingTierKey, setEditingTierKey] = useState<string | null>(null);
  const [showScannerBreakdownModal, setShowScannerBreakdownModal] = useState(false);
  const [isScanningSimulation, setIsScanningSimulation] = useState(false);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<string>(() => new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }));
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeminiReportHtml, setAiGeminiReportHtml] = useState<string | null>(null);
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [schedulingStudentId, setSchedulingStudentId] = useState<string | null>(null);

  const notifyUser = (msg: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast(msg, type);
    }
  };

  // Helper: Get the score of a student based on the selected scanned exam filter
  const getStudentScannedScore = (s: StudentMetric): number | null => {
    if (scannedExamSource === 'f1') return s.f1;
    if (scannedExamSource === 'f2') return s.f2;
    if (scannedExamSource === 'f3') return s.f3;
    if (scannedExamSource === 'f4') return s.f4 ?? null;
    return s.avg;
  };

  const scannedExamSourceLabel = useMemo(() => {
    if (scannedExamSource === 'f1') return 'الفرض المحروس 1 الممسوح (F1)';
    if (scannedExamSource === 'f2') return 'الفرض المحروس 2 الممسوح (F2)';
    if (scannedExamSource === 'f3') return 'الفرض المحروس 3 الممسوح (F3)';
    if (scannedExamSource === 'f4') return 'الفرض المحروس 4 الممسوح (F4)';
    return `الحصيلة المجمعة للفروض الممسوحة (${semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى'})`;
  }, [scannedExamSource, semester]);

  // Identify struggling students based on the selected scanned exam source or overall trajectory
  const strugglingStudents = useMemo(() => {
    return studentMetrics.filter(s => {
      if (scannedExamSource !== 'all') {
        const examScore = getStudentScannedScore(s);
        return examScore !== null && examScore < 10;
      }
      const isLowAvg = s.avg !== null && s.avg < 10;
      const isLowExams = (s.f1 !== null && s.f1 < 9) || (s.f2 !== null && s.f2 < 9) || (s.f3 !== null && s.f3 < 9);
      const isDropping = s.delta !== null && s.delta <= -1.5;
      return isLowAvg || isLowExams || isDropping;
    });
  }, [studentMetrics, scannedExamSource]);

  // Build full diagnosed activity list for struggling students
  const diagnosedStudents = useMemo(() => {
    return strugglingStudents.map(std => {
      const chosenCatKey = customErrorOverrides[std.id] || diagnoseStudentMathError(std);
      const catInfo = REMEDIATION_CATALOG[chosenCatKey] || REMEDIATION_CATALOG.algebra_signs;
      const refScore = getStudentScannedScore(std);

      // Determine severity
      let severity: 'severe' | 'moderate' | 'mild' | 'declining' = 'moderate';
      let severityLabel = 'الفئة ب: تعثر متوسط (7 إلى 8.99)';
      let severityBadge = 'bg-amber-50 text-amber-700 border-amber-200';

      if (refScore !== null && refScore < 7) {
        severity = 'severe';
        severityLabel = 'الفئة أ: تعثر حاد (< 7/20)';
        severityBadge = 'bg-rose-50 text-rose-700 border-rose-200';
      } else if (refScore !== null && refScore >= 7 && refScore < 9) {
        severity = 'moderate';
        severityLabel = 'الفئة ب: تعثر متوسط (7 إلى 8.99)';
        severityBadge = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (refScore !== null && refScore >= 9 && refScore < 10) {
        severity = 'mild';
        severityLabel = 'الفئة ج: هشاشة على العتبة (9 إلى 9.99)';
        severityBadge = 'bg-blue-50 text-blue-700 border-blue-200';
      } else if (std.delta !== null && std.delta <= -1.5) {
        severity = 'declining';
        severityLabel = 'الفئة د: تراجع مفاجئ في الفرض الممسوح';
        severityBadge = 'bg-purple-50 text-purple-700 border-purple-200';
      }

      // Pick activity (cycle between 0 and 1 based on id)
      const actIndex = (std.id.charCodeAt(std.id.length - 1) || 0) % catInfo.activities.length;
      const act = catInfo.activities[actIndex] || catInfo.activities[0];

      const activity: RemediationActivity = {
        id: `act_${std.id}`,
        categoryKey: chosenCatKey,
        categoryLabel: catInfo.label,
        commonErrors: catInfo.commonErrors,
        title: act.title,
        objective: act.objective,
        strategy: act.strategy,
        strategyType: act.strategyType,
        miniExercise: act.miniExercise,
        durationMinutes: act.duration,
        verificationIndicator: act.indicator
      };

      return {
        student: std,
        evaluatedScore: refScore,
        severity,
        severityLabel,
        severityBadge,
        activity
      };
    });
  }, [strugglingStudents, customErrorOverrides, scannedExamSource]);

  // Automatic generation of 4 Pedagogical Remediation Plans per Struggling Category (الفئات أ، ب، ج، د)
  const autoGeneratedTierPlans: StrugglingTierPlan[] = useMemo(() => {
    const tierAStudents = diagnosedStudents
      .filter(d => d.severity === 'severe')
      .map(d => ({ student: d.student, evaluatedScore: d.evaluatedScore, diagnosedErrorLabel: d.activity.categoryLabel }));

    const tierBStudents = diagnosedStudents
      .filter(d => d.severity === 'moderate')
      .map(d => ({ student: d.student, evaluatedScore: d.evaluatedScore, diagnosedErrorLabel: d.activity.categoryLabel }));

    const tierCStudents = diagnosedStudents
      .filter(d => d.severity === 'mild')
      .map(d => ({ student: d.student, evaluatedScore: d.evaluatedScore, diagnosedErrorLabel: d.activity.categoryLabel }));

    const tierDStudents = diagnosedStudents
      .filter(d => d.severity === 'declining')
      .map(d => ({ student: d.student, evaluatedScore: d.evaluatedScore, diagnosedErrorLabel: d.activity.categoryLabel }));

    return [
      {
        tierKey: 'tier_a',
        badgeCode: 'الفئة أ (أولوية قصوى)',
        title: 'فئة التعثر الحاد والهيكلي (دون 7/20 في الفروض الممسوحة)',
        thresholdLabel: 'النقطة < 7 / 20',
        headerBg: 'from-rose-700 to-red-900',
        borderCls: 'border-rose-200 hover:border-rose-400',
        badgeCls: 'bg-rose-100 text-rose-800 border-rose-300',
        diagnosticSummary: 'وجود عوائق قاعدية في التحكم بالتعلمات الأساس (الحساب العددي والجبري في ℝ، الإشارات، النشر والتعميل، وحل المعادلات البسيطة) تمنع التلميذ من مسايرة بناء المفاهيم الجديدة.',
        pedagogicalStrategy: 'تفريد التعلمات والانغماس العلاجي المكثف عبر بطاقات الخطأ والصواب وتجزيء المهام المركبة.',
        weeklyAllocation: 'حصتان أسبوعياً (2 × 60 دقيقة)',
        groupingMode: 'مجموعة دعم صغرى موجهة من طرف الأستاذ (4 إلى 6 تلاميذ)',
        proposedActivities: [
          {
            title: 'نشاط 1: عيادة الأساسيات الجبرية والحسابية القبلية',
            description: 'مراجعة مركزة لقواعد الإشارات، توحيد المقامات، المتطابقات الهامة، وإشارة حدانية ax+b وثلاثية الحدود ax²+bx+c عبر بطاقات تدريبية متدرجة.',
            targetSkill: 'استرجاع آليات الحساب الجبري السليم بدون أخطاء إشارة'
          },
          {
            title: 'نشاط 2: تفكيك أسئلة الفرض الممسوح إلى مراحل أولية مبسطة',
            description: 'إعادة صياغة التمرين الأول من الفرض المحروس الممسوح بتقسيم كل سؤال إلى أسئلة استرشادية قصيرة مرفقة ببطاقة تذكير بالقاعدة.',
            targetSkill: 'بناء الثقة المنهجية والقدرة على حصد النقط الجزئية في الفرض'
          }
        ],
        customExercise: customTierActivityNotes['tier_a'] || '1) بسط واحسب التعابير الجبرية مع تحديد الإشارة، ثم حل في ℝ المعادلة: x² - 5x + 6 = 0.\n2) لتكن f(x) = 2x - 4؛ حدد جدول إشارة f(x) على ℝ ثم استنتج حلول المتراجحة f(x) ≥ 0.',
        successIndicator: 'ارتفاع نقطة التلميذ في رائز التتبع البعدي إلى 8/20 فأكثر مع انعدام أخطاء الإشارة والتعميل.',
        students: tierAStudents
      },
      {
        tierKey: 'tier_b',
        badgeCode: 'الفئة ب (دعم موجه)',
        title: 'فئة التعثر المتوسط في التطبيق والاستدلال (من 7/20 إلى 8.99/20)',
        thresholdLabel: '7 ≤ النقطة < 9 / 20',
        headerBg: 'from-amber-600 to-orange-800',
        borderCls: 'border-amber-200 hover:border-amber-400',
        badgeCls: 'bg-amber-100 text-amber-900 border-amber-300',
        diagnosticSummary: 'استيعاب نظري مقبول للمفهوم الرياضي مع ارتباك إجرائي عند تطبيق القواعد والمبرهنات (النهايات، الاشتقاق، المتتاليات، الهندسة) في وضعيات الفروض المحروسة.',
        pedagogicalStrategy: 'بيداغوجيا الخطأ والعمل بالمجموعات المتجانسة مع توظيف هياكل البراهين الموجهة (Guided Proof Skeletons).',
        weeklyAllocation: 'حصة دعم أسبوعية (90 دقيقة)',
        groupingMode: 'ورشات تطبيقية موجهة في مجموعات من 6 إلى 8 تلاميذ',
        proposedActivities: [
          {
            title: 'نشاط 1: ورشة هياكل البراهين الرياضية الموجهة وفق الإطار المرجعي',
            description: 'تدريب عملي على تحرير البراهين الكلاسيكية (مبرهنة القيم الوسيطية، الاستدلال بالترجع، رتابة دالة من إشارة المشتقة) عبر قوالب منهجية منظمة.',
            targetSkill: 'الانتقال من الفهم النظري إلى التحرير الرياضي السليم'
          },
          {
            title: 'نشاط 2: معالجة الأخطاء المتكررة في التمرين الثاني والثالث من الفرض الممسوح',
            description: 'تشخيص جماعي للأخطاء المرصودة في أوراق الفرض الممسوح وإنجاز وضعيات متكافئة مع تصحيح تبادلي مباشر.',
            targetSkill: 'التحكم في خطوات حل مسألة تحليلية أو هندسية متكاملة'
          }
        ],
        customExercise: customTierActivityNotes['tier_b'] || 'لتكن الدالة f(x) = x³ - 3x + 1 على ℝ.\n1) احسب نهايتي f عند +∞ و -∞.\n2) احسب f\'(x) وادرس إشارتها ثم ضع جدول تغيرات f.\n3) بين أن المعادلة f(x) = 0 تقبل حلاً وحيداً α في المجال ]0, 1[.',
        successIndicator: 'تجاوز عتبة التحكم (≥ 10/20) في الفرض المحروس الموالي مع تحرير سليم للبراهين الأساسية.',
        students: tierBStudents
      },
      {
        tierKey: 'tier_c',
        badgeCode: 'الفئة ج (تثبيت واستدراك)',
        title: 'فئة الهشاشة على عتبة التحكم (من 9/20 إلى 9.99/20)',
        thresholdLabel: '9 ≤ النقطة < 10 / 20',
        headerBg: 'from-blue-600 to-indigo-800',
        borderCls: 'border-blue-200 hover:border-blue-400',
        badgeCls: 'bg-blue-100 text-blue-900 border-blue-300',
        diagnosticSummary: 'تلاميذ يمتلكون المكتسبات الأساسية غير أنهم يفقدون ما بين نقطة ونقطتين بسبب التسرع في الحساب، أو غياب التعليل الدقيق، أو عدم استكمال التأويل الهندسي.',
        pedagogicalStrategy: 'التعلم بالقرين (Tutorat par les pairs) وأنشطة التثبيت السريع لاقتناص النقط الضائعة.',
        weeklyAllocation: 'حصة تثبيت (45 دقيقة) + مواكبة بالقرين داخل الفصل',
        groupingMode: 'ثنائيات تعاونية (ربط كل تلميذ من الفئة ج بقرين متفوق ≥ 15/20)',
        proposedActivities: [
          {
            title: 'نشاط 1: التصحيح التعاوني بالقرين لأوراق الفرض الممسوح',
            description: 'مقارنة ورقة التلميذ بورقة نموذجية لقرينه المتفوق لرصد مواضع ضياع أنصاف النقط (التعليل، شروط المبرهنة، الوحدات، التمثيل المبياني).',
            targetSkill: 'اكتساب الدقة المنهجية وتفادي الهفوات الشكلية والحسابية'
          },
          {
            title: 'نشاط 2: بطاقات التثبيت السريع والأسئلة الحاسمة',
            description: 'إنجاز 3 وضعيات مركزة قصيرة (15 دقيقة لكل وضعية) تستهدف التأويلات الهندسية واستنتاجات أواخر التمارين.',
            targetSkill: 'الارتقاء الفوري والمستدام فوق عتبة 11/20'
          }
        ],
        customExercise: customTierActivityNotes['tier_c'] || 'نعتبر المتتالية (u_n) المعرفة بـ u₀ = 3 و u_(n+1) = (2u_n + 3)/(u_n + 4).\n1) بين بالترجع أن u_n > 1 لكل n من ℕ مع ذكر جميع شروط الاستدلال.\n2) نضع v_n = (u_n - 1)/(u_n + 3)؛ بين أن (v_n) هندسية وحدد نهاية (u_n).',
        successIndicator: 'الانتقال الفوري إلى فئة المستوفين (11/20 إلى 13/20) واستقرار الأداء في الفروض القادمة.',
        students: tierCStudents
      },
      {
        tierKey: 'tier_d',
        badgeCode: 'الفئة د (استدراك وقائي)',
        title: 'فئة التراجع الظرفي أو التعثر الموضعي في الفرض الممسوح (Δ ≤ -1.5 ن)',
        thresholdLabel: 'انخفاض مفاجئ أو فجوة ذروة',
        headerBg: 'from-purple-700 to-violet-900',
        borderCls: 'border-purple-200 hover:border-purple-400',
        badgeCls: 'bg-purple-100 text-purple-900 border-purple-300',
        diagnosticSummary: 'تلاميذ سبق لهم تحقيق نتائج مرضية أو ذروة تحصيلية جيدة، لكنهم سجلوا تراجعاً ملحوظاً في الفرض الممسوح الأخير مرتبطاً بمحور ديداكتيكي جديد أو غياب ظرفي.',
        pedagogicalStrategy: 'معالجة موضعية حسب المجزوءة (Remédiation ciblée par module) واستثمار فجوة الطاقة الكامنة.',
        weeklyAllocation: 'بطاقة استدراك ذاتية + حصة مراجعة (45 دقيقة)',
        groupingMode: 'مجموعة دعم موضوعاتية حسب المحور المتعثر فيه',
        proposedActivities: [
          {
            title: 'نشاط 1: استدراك موضوعاتي مركز على محور الفرض الممسوح الأخير',
            description: 'تخصيص ملخص مفهومي مكثف مع خريطة ذهنية لأهم العلاقات والقواعد الخاصة بالدرس الذي شهد انخفاض النقطة.',
            targetSkill: 'سد الثغرة المعرفية الظرفية قبل تراكمها في الفروض الموالية'
          },
          {
            title: 'نشاط 2: تفعيل الطاقة الكامنة ومقارنة الذروة الفردية',
            description: 'استثمار أفضل نقطة حققها التلميذ سابقاً لتحفيزه نفسياً ومنهجياً وإعادة ربطه بنسقه التصاعدي.',
            targetSkill: 'استعادة الاستقرار التحصيلي وتقليص فجوة التذبذب بين الفروض'
          }
        ],
        customExercise: customTierActivityNotes['tier_d'] || 'تمرين توليفي استدراكي يربط مكتسبات الفرض السابق بمحور الفرض الحالي (دراسة دالة مركبة أو مسألة هندسية/احتمالية متدرجة).',
        successIndicator: 'استرجاع التلميذ لمعدله المرجعي المعتاد وتقليص الفارق بين الذروة والمعدل العام إلى أقل من نقطة واحدة.',
        students: tierDStudents
      }
    ];
  }, [diagnosedStudents, customTierActivityNotes]);

  // Breakdown of scanned exams by exercises/axes for the optical scanner analyzer
  const scannedExamAxesAnalysis = useMemo(() => {
    const evaluated = studentMetrics.filter(s => getStudentScannedScore(s) !== null);
    const total = Math.max(1, evaluated.length);
    const lowAlgebra = evaluated.filter(s => (getStudentScannedScore(s) ?? 0) < 7).length;
    const lowAnalysis = evaluated.filter(s => {
      const sc = getStudentScannedScore(s) ?? 0;
      return sc >= 7 && sc < 10;
    }).length;
    const mastered = evaluated.filter(s => (getStudentScannedScore(s) ?? 0) >= 10).length;

    return [
      {
        axisTitle: 'التمرين 1 (الورقة الممسوحة): الحساب الجبري، الحدوديات، والمتتاليات',
        masteryPct: Math.round(((total - lowAlgebra) / total) * 100),
        strugglingCount: lowAlgebra,
        targetTier: 'الفئة أ + الفئة ب',
        color: '#e11d48'
      },
      {
        axisTitle: 'التمرين 2 (الورقة الممسوحة): التحليل الرياضي، النهايات، والاشتقاق ودراسة الدوال',
        masteryPct: Math.round(((mastered + Math.floor(lowAnalysis * 0.4)) / total) * 100),
        strugglingCount: lowAnalysis,
        targetTier: 'الفئة ب + الفئة ج',
        color: '#d97706'
      },
      {
        axisTitle: 'التمرين 3 (الورقة الممسوحة): الهندسة التحليلية/الفضائية، العقدية، وترييض المسائل',
        masteryPct: Math.round((mastered / total) * 100),
        strugglingCount: lowAlgebra + lowAnalysis,
        targetTier: 'الفئة ج + الفئة د',
        color: '#4f46e5'
      }
    ];
  }, [studentMetrics, scannedExamSource]);

  // Filtered diagnosed students
  const filteredDiagnosed = useMemo(() => {
    return diagnosedStudents.filter(item => {
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesName = item.student.name.toLowerCase().includes(q);
        const matchesMassar = item.student.massar.toLowerCase().includes(q);
        if (!matchesName && !matchesMassar) return false;
      }

      if (selectedCategoryFilter !== 'all' && item.activity.categoryKey !== selectedCategoryFilter) {
        return false;
      }

      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [diagnosedStudents, searchQuery, selectedCategoryFilter, severityFilter]);

  // Handler: Change error category for a specific student
  const handleCategoryChange = (studentId: string, newCategoryKey: string) => {
    setCustomErrorOverrides(prev => ({
      ...prev,
      [studentId]: newCategoryKey
    }));
  };

  // Handler: Simulate optical exam scan & auto-refresh remediation tiers
  const handleTriggerOpticalExamScan = () => {
    setIsScanningSimulation(true);
    setTimeout(() => {
      setIsScanningSimulation(false);
      setLastScanTimestamp(new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }));
      notifyUser('تم تحليل نتائج الفروض الممسوحة وتحديث خطط المعالجة البيداغوجية المخصصة لكل فئة بنجاح!', 'success');
    }, 650);
  };

  // Handler: Schedule an entire struggling category (Cohort) in Cahier de Textes & Calendar
  const handleScheduleTierCohortSession = (tier: StrugglingTierPlan) => {
    const targetCls = selectedClass === 'all' ? (tier.students[0]?.student.className || Object.keys(db?.classes || {})[0] || '') : selectedClass;
    const studentNames = tier.students.map(s => s.student.name).join('، ');

    const prefillData = {
      title: `حصة معالجة ودعم مخصصة: ${tier.badgeCode} — ${tier.title}`,
      reason: `معالجة بيداغوجية مبنية على نتائج ${scannedExamSourceLabel} (${tier.students.length} تلميذ في هذه الفئة)`,
      beneficiaries: `${tier.badgeCode} (${tier.students.length} تلميذ): ${studentNames || 'تلاميذ الفئة المستهدفة'}`,
      type: 'soutien',
      summary: `• الفئة المستهدفة: ${tier.title} (${tier.thresholdLabel}).\n• التشخيص الديداكتيكي من الفروض الممسوحة: ${tier.diagnosticSummary}\n• استراتيجية المعالجة والتفييء: ${tier.pedagogicalStrategy} (${tier.groupingMode}).\n• أنشطة الدعم المخصصة المنجزة:\n  1) ${tier.proposedActivities[0]?.title}: ${tier.proposedActivities[0]?.description}\n  2) ${tier.proposedActivities[1]?.title}: ${tier.proposedActivities[1]?.description}\n• التمرين التطبيقي المعالج:\n${tier.customExercise}\n• مؤشر التحقق: ${tier.successIndicator}`,
      duration: '2'
    };

    if (typeof (window as any).openExtraSupportSessionModal === 'function') {
      (window as any).openExtraSupportSessionModal(targetCls, prefillData);
      notifyUser(`تم تجهيز حصة الدعم المخصصة لـ [${tier.badgeCode}] في دفتر النصوص`, 'success');
    } else {
      const modal = document.getElementById('extraSupportSessionModal');
      if (modal) modal.style.display = 'flex';
    }
  };

  // Handler: Print a single Struggling Category (Tier) Remediation Plan Sheet (A4)
  const handlePrintSingleTierPlan = (tier: StrugglingTierPlan) => {
    const teacherName = (db?.teacherProfile?.name) || (db?.profile?.name) || 'إبراهيم قزيبر';
    const schoolName = (db?.teacherProfile?.school) || (db?.profile?.school) || 'المؤسسة التعليمية';
    const printDate = new Date().toLocaleDateString('ar-MA');
    const clsName = selectedClass === 'all' ? 'جميع الأقسام' : selectedClass;

    const studentsRowsHtml = tier.students.length > 0
      ? tier.students.map((st, idx) => `
          <tr>
            <td style="padding:5px; text-align:center; border:1px solid #cbd5e1;">${idx + 1}</td>
            <td style="padding:5px 8px; font-weight:800; border:1px solid #cbd5e1;">${st.student.name}</td>
            <td style="padding:5px; text-align:center; border:1px solid #cbd5e1;">${st.student.className}</td>
            <td style="padding:5px; text-align:center; border:1px solid #cbd5e1;">${st.student.f1 ?? '-'}</td>
            <td style="padding:5px; text-align:center; border:1px solid #cbd5e1;">${st.student.f2 ?? '-'}</td>
            <td style="padding:5px; text-align:center; border:1px solid #cbd5e1;">${st.student.f3 ?? '-'}</td>
            <td style="padding:5px; text-align:center; font-weight:900; color:#dc2626; border:1px solid #cbd5e1;">${st.evaluatedScore ?? st.student.avg ?? '-'} / 20</td>
            <td style="padding:5px 8px; border:1px solid #cbd5e1;">${st.diagnosedErrorLabel}</td>
          </tr>
        `).join('')
      : `<tr><td colspan="8" style="padding:10px; text-align:center; border:1px solid #cbd5e1;">لا يوجد تلاميذ مصنفون في هذه الفئة حالياً</td></tr>`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>بطاقة خطة المعالجة البيداغوجية المخصصة - ${tier.badgeCode}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 12mm 10mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0; font-size: 9.5pt; line-height: 1.5; }
        .sheet { border: 1.5px solid #1e3a8a; border-radius: 8px; padding: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 8.5pt; }
        th { background: #1e3a8a; color: #fff; padding: 5px; border: 1px solid #1e3a8a; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; }
    </style>
</head>
<body>
    <div class="sheet">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e3a8a; padding-bottom:8px; margin-bottom:10px;">
            <div>
                <div style="font-weight:900; font-size:10.5pt;">المملكة المغربية</div>
                <div style="font-size:8pt; color:#475569;">وزارة التربية الوطنية والتعليم الأولي والرياضة • ${schoolName}</div>
            </div>
            <div style="text-align:center;">
                <div style="background:#1e3a8a; color:#fff; padding:4px 14px; border-radius:6px; font-weight:900; font-size:11pt;">بطاقة خطة المعالجة البيداغوجية المولدة تلقائياً حسب الفئات</div>
                <div style="font-size:8pt; color:#64748b; margin-top:2px;">بناءً على نتائج: ${scannedExamSourceLabel} • القسم: <b>${clsName}</b></div>
            </div>
            <div style="text-align:left; font-size:8.5pt;">
                <div>الأستاذ: <b>${teacherName}</b></div>
                <div>التاريخ: <b>${printDate}</b></div>
            </div>
        </div>

        <div class="box" style="background:#eff6ff; border-color:#93c5fd;">
            <div style="font-weight:900; font-size:10.5pt; color:#1e3a8a;">🎯 ${tier.badgeCode}: ${tier.title} (${tier.thresholdLabel})</div>
            <div style="margin-top:4px;"><b>• التشخيص الديداكتيكي من الفروض الممسوحة:</b> ${tier.diagnosticSummary}</div>
            <div><b>• استراتيجية التدخل ونمط التفييء:</b> ${tier.pedagogicalStrategy} — (${tier.groupingMode})</div>
            <div><b>• الغلاف الزمني المقترح:</b> ${tier.weeklyAllocation}</div>
        </div>

        <div class="box">
            <div style="font-weight:900; color:#0f172a; margin-bottom:4px;">📚 أنشطة الدعم البيداغوجي المخصصة المقترحة لهذه الفئة:</div>
            ${tier.proposedActivities.map((act, i) => `
                <div style="margin-bottom:4px;">
                    <b>${i + 1}. ${act.title}:</b> ${act.description} <span style="color:#0369a1; font-weight:700;">[الكفاية: ${act.targetSkill}]</span>
                </div>
            `).join('')}
        </div>

        <div class="box" style="background:#fffbeb; border-color:#fde68a;">
            <div style="font-weight:900; color:#92400e; margin-bottom:3px;">📝 النشاط الرياضي التطبيقي المبرمج لحصة الدعم:</div>
            <div style="white-space:pre-wrap; font-weight:700;">${tier.customExercise}</div>
            <div style="margin-top:4px; font-size:8pt; color:#166534;"><b>✓ مؤشر التحقق والتقويم:</b> ${tier.successIndicator}</div>
        </div>

        <div style="font-weight:900; color:#1e3a8a; margin-top:8px;">👥 لائحة التلاميذ المستهدفين في ${tier.badgeCode} (${tier.students.length} تلميذ):</div>
        <table>
            <thead>
                <tr>
                    <th style="width:28px;">#</th>
                    <th style="text-align:right;">اسم التلميذ(ة)</th>
                    <th style="width:65px;">القسم</th>
                    <th style="width:45px;">ف1</th>
                    <th style="width:45px;">ف2</th>
                    <th style="width:45px;">ف3</th>
                    <th style="width:70px;">النقطة/المعدل</th>
                    <th style="text-align:right;">العائق الرياضي المشخص</th>
                </tr>
            </thead>
            <tbody>
                ${studentsRowsHtml}
            </tbody>
        </table>

        <div style="display:flex; justify-content:space-between; margin-top:14px; padding-top:8px; border-top:1px dashed #cbd5e1; font-size:8.5pt;">
            <div>توقيع أستاذ مادة الرياضيات: <b>${teacherName}</b></div>
            <div>تأشيرة السيد(ة) المفتش(ة) التربوي(ة)</div>
            <div>تأشيرة إدارة المؤسسة</div>
        </div>
    </div>
</body>
</html>
    `;

    if (typeof (window as any).printDocumentDirectly === 'function') {
      (window as any).printDocumentDirectly(htmlContent, `خطة دعم ${tier.badgeCode} - ${clsName}`, 'portrait');
      return;
    }
    window.print();
  };

  // Handler: Schedule this activity directly as an Extra Support / Remedial Session in Cahier de Textes
  const handleScheduleExtraSession = (item: typeof diagnosedStudents[0]) => {
    if (schedulingStudentId) return; // Prevent double trigger
    setSchedulingStudentId(item.student.id);

    const targetCls = item.student.className || selectedClass || '';
    const act = item.activity;

    const prefillData = {
      title: `معالجة واستدراك: ${act.title}`,
      reason: `معالجة تعثر التلميذ(ة) ${item.student.name} في [${act.categoryLabel}]`,
      beneficiaries: `التلميذ(ة): ${item.student.name} (${targetCls})`,
      type: 'soutien',
      summary: `• سياق المعالجة البيداغوجية: معالجة الصعوبات المرصودة في الفرض المحروس (${act.categoryLabel}).\n• الهدف التعلمي الإجرائي: ${act.objective}\n• استراتيجية التنزيل: ${act.strategy}\n• الأنشطة والتمارين التطبيقية:\n${act.miniExercise}\n• مؤشر التحقق والتقويم: ${act.verificationIndicator}`,
      duration: '2'
    };

    if (typeof (window as any).openExtraSupportSessionModal === 'function') {
      (window as any).openExtraSupportSessionModal(targetCls, prefillData);
    } else {
      const modal = document.getElementById('extraSupportSessionModal');
      if (modal) modal.style.display = 'flex';
    }

    setTimeout(() => {
      setSchedulingStudentId(null);
    }, 600);
  };

  // Handler: Print individual student remediation worksheet (Fiche de remédiation A4)
  const handlePrintStudentWorksheet = (item: typeof diagnosedStudents[0]) => {
    const std = item.student;
    const act = item.activity;
    const teacherName = (db?.teacherProfile?.name) || (db?.profile?.name) || 'أستاذ مادة الرياضيات';
    const schoolName = (db?.teacherProfile?.school) || (db?.profile?.school) || 'المؤسسة التعليمية';
    const printDate = new Date().toLocaleDateString('ar-MA');
    const marksText = [
      `F1: ${std.f1 ?? '-'}`,
      `F2: ${std.f2 ?? '-'}`,
      std.f3 !== null && std.f3 !== undefined ? `F3: ${std.f3}` : null,
      std.f4 !== null && std.f4 !== undefined ? `F4: ${std.f4}` : null
    ].filter(Boolean).join(' | ');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>بطاقة المعالجة البيداغوجية الفردية - ${std.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 12mm 10mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0; font-size: 10pt; line-height: 1.5; }
        .sheet { max-width: 100%; border: 1.5px solid #1e3a8a; border-radius: 8px; padding: 16px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
        .badge { background: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.85rem; }
        .section-title { font-weight: 800; color: #1e3a8a; font-size: 9.5pt; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        .box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; }
        .exercise-box { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; white-space: pre-wrap; font-family: 'Cairo', sans-serif; font-size: 10pt; line-height: 1.65; }
        .solution-zone { height: 150px; border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 10px; margin-bottom: 12px; background: #ffffff; }
        .footer-sig { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 8.5pt; }
    </style>
</head>
<body>
    <div class="sheet">
        <div class="header">
            <div>
                <div style="font-weight: 900; font-size: 10.5pt;">المملكة المغربية</div>
                <div style="font-size: 8pt; color: #475569;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                <div style="font-size: 8.5pt;">المؤسسة: <strong>${schoolName}</strong></div>
            </div>
            <div style="text-align: center;">
                <div style="background: #1e3a8a; color: #fff; padding: 4px 16px; border-radius: 6px; font-weight: 900; font-size: 11.5pt;">بطاقة المعالجة البيداغوجية الفردية والدعم الرياضي</div>
                <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">المذكرة الوزارية رقم 142-08 • السلك الثانوي التأهيلي</div>
            </div>
            <div style="text-align: left; font-size: 8.5pt;">
                <div>الأستاذ(ة): <strong>${teacherName}</strong></div>
                <div>المادة: <strong>الرياضيات</strong></div>
                <div>التاريخ: <strong>${printDate}</strong></div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">اسم التلميذ(ة)</div>
                <div style="font-weight: 900; font-size: 10pt; color: #0f172a;">${std.name}</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">القسم ورقم مسار</div>
                <div style="font-weight: 800; font-size: 8.5pt;">${std.className} • ${std.massar || '-'}</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">نقط الفروض الممسوحة والمعدل</div>
                <div style="font-weight: 900; font-size: 9pt; color: #dc2626;">${marksText} (${std.avg}/20)</div>
            </div>
            <div class="box">
                <div style="font-size: 7.5pt; color: #64748b;">فئة التعثر</div>
                <div style="font-weight: 800; font-size: 8.5pt; color: #7e22ce;">${item.severityLabel}</div>
            </div>
        </div>

        <div class="section-title">🔍 1. تشخيص نوع الخطأ الرياضي والعائق الديداكتيكي المرصود:</div>
        <div class="box" style="background: #fdf2f8; border-color: #fbcfe8; color: #831843;">
            <strong style="color: #9d174d;">${act.categoryLabel}:</strong> ${act.commonErrors}
        </div>

        <div class="section-title">🎯 2. الهدف البيداغوجي واستراتيجية المعالجة المبرمجة:</div>
        <div class="box">
            <div>• <b>الهدف التعلمي الإجرائي:</b> ${act.objective}</div>
            <div style="margin-top: 3px;">• <b>استراتيجية الإنجاز:</b> ${act.strategy}</div>
            <div style="margin-top: 3px;">• <b>الغلاف الزمني التقديري:</b> ${act.durationMinutes} دقيقة بحصة الدعم الاستدراكية</div>
        </div>

        <div class="section-title">📝 3. النشاط الرياضي التطبيقي المباشر (تمرين المعالجة والاستدراك):</div>
        <div class="exercise-box">${act.miniExercise}</div>

        <div class="section-title">✍️ 4. حيز إنجاز التلميذ(ة) والتحليل الديداكتيكي للحل:</div>
        <div class="solution-zone">
            <span style="color: #94a3b8; font-size: 8pt;">[ يخصص هذا الحيز لإنجاز التلميذ(ة) وملاحظات الأستاذ أثناء الحصة الاستدراكية ]</span>
        </div>

        <div class="box" style="background: #f0fdf4; border-color: #bbf7d0;">
            <div style="font-weight: 800; color: #166534; font-size: 8.5pt;">📈 مؤشر التحقق وتقييم الأثر:</div>
            <div style="font-size: 8pt; color: #14532d;">${act.verificationIndicator}</div>
        </div>

        <div class="footer-sig">
            <div style="text-align: center; width: 45%;">
                <div>توقيع وملاحظة أستاذ مادة الرياضيات</div>
                <div style="height: 32px;"></div>
                <div>الأستاذ(ة): <b>${teacherName}</b></div>
            </div>
            <div style="text-align: center; width: 45%;">
                <div>ملاحظة وتأشيرة ولي أمر التلميذ(ة)</div>
                <div style="height: 32px;"></div>
                <div>اطلعت على خطة المعالجة: .....................</div>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    if (typeof (window as any).printDocumentDirectly === 'function') {
      (window as any).printDocumentDirectly(htmlContent, `بطاقة المعالجة البيداغوجية - ${std.name}`, 'portrait');
      return;
    }
    window.print();
  };

  // Handler: Print Class Full Remediation Schedule (جدول خطة المعالجة الجماعية حسب الفئات + التلاميذ)
  const handlePrintClassRemediationSchedule = () => {
    const teacherName = (db?.teacherProfile?.name) || (db?.profile?.name) || 'إبراهيم قزيبر';
    const schoolName = (db?.teacherProfile?.school) || (db?.profile?.school) || 'المؤسسة التعليمية';
    const printDate = new Date().toLocaleDateString('ar-MA');
    const clsName = selectedClass === 'all' ? 'جميع الأقسام' : selectedClass;

    const tiersSummaryHtml = autoGeneratedTierPlans.map(tier => `
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; background: #f8fafc;">
        <div style="display:flex; justify-content:space-between; font-weight:900; color:#1e3a8a; font-size:9pt; margin-bottom:3px;">
          <span>📌 ${tier.badgeCode}: ${tier.title} (${tier.thresholdLabel})</span>
          <span>عدد التلاميذ: ${tier.students.length} | الحجم الزمني: ${tier.weeklyAllocation}</span>
        </div>
        <div style="font-size:8pt; color:#334155;"><b>أنشطة الدعم المقترحة:</b> ${tier.proposedActivities.map(a => a.title).join(' + ')}</div>
        <div style="font-size:8pt; color:#475569;"><b>الاستراتيجية:</b> ${tier.pedagogicalStrategy} | <b>التلاميذ:</b> ${tier.students.map(s => s.student.name).join('، ') || 'لا يوجد'}</div>
      </div>
    `).join('');

    const rowsHtml = diagnosedStudents.map((d, i) => `
      <tr style="border-bottom: 1px solid #cbd5e1; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'}; font-size: 8.5pt;">
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${i + 1}</td>
          <td style="padding: 6px 10px; font-weight: 800; border: 1px solid #cbd5e1;">${d.student.name}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${d.student.className}</td>
          <td style="padding: 6px; text-align: center; font-weight: 800; color: #dc2626; border: 1px solid #cbd5e1;">${d.evaluatedScore ?? d.student.avg ?? '-'}</td>
          <td style="padding: 6px 8px; font-weight: 800; color: #1e3a8a; border: 1px solid #cbd5e1;">${d.severityLabel}</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #7e22ce; border: 1px solid #cbd5e1;">${d.activity.categoryLabel}</td>
          <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">${d.activity.title}</td>
          <td style="padding: 6px; text-align: center; border: 1px solid #cbd5e1;">${d.activity.durationMinutes} د</td>
      </tr>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>خطة المعالجة البيداغوجية المولدة تلقائياً حسب الفروض الممسوحة - ${clsName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; margin: 0; padding: 0; font-size: 9pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e3a8a; color: #fff; padding: 6px; border: 1px solid #1e3a8a; font-size: 8.5pt; text-align: center; }
    </style>
</head>
<body>
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 8px;">
        <div>
            <div style="font-weight: 900; font-size: 11pt;">المملكة المغربية</div>
            <div style="font-size: 8pt; color: #475569;">وزارة التربية الوطنية والتعليم الأولي والرياضة • ${schoolName}</div>
        </div>
        <div style="text-align: center;">
            <div style="font-weight: 900; font-size: 12.5pt; color: #1e3a8a;">خطة المعالجة البيداغوجية المولدة تلقائياً بناءً على نتائج الفروض الممسوحة (المذكرة 142-08)</div>
            <div style="font-size: 8pt; color: #64748b;">القسم: <b>${clsName}</b> • المرجع: <b>${scannedExamSourceLabel}</b> • إجمالي المتعثرين: <b>${diagnosedStudents.length} تلميذ</b></div>
        </div>
        <div style="text-align: left; font-size: 8pt;">
            <div>الأستاذ: <b>${teacherName}</b></div>
            <div>التاريخ: <b>${printDate}</b></div>
        </div>
    </div>

    <div style="margin-bottom: 8px;">
        <div style="font-weight: 900; color: #0f172a; font-size: 9.5pt; margin-bottom: 4px;">أولاً: مصفوفة أنشطة الدعم المخصصة لكل فئة من المتعثرين:</div>
        ${tiersSummaryHtml}
    </div>

    <div style="font-weight: 900; color: #0f172a; font-size: 9.5pt; margin-top: 6px;">ثانياً: القائمة الاسمية التفصيلية للتلاميذ المتعثرين وأنشطة المعالجة الفردية:</div>
    <table>
        <thead>
            <tr>
                <th style="width: 26px;">#</th>
                <th style="width: 125px; text-align: right;">اسم التلميذ(ة)</th>
                <th style="width: 50px;">القسم</th>
                <th style="width: 48px;">النقطة</th>
                <th style="width: 130px;">فئة التعثر</th>
                <th style="width: 165px; text-align: right;">العائق الديداكتيكي المرصود</th>
                <th style="text-align: right;">نشاط المعالجة البيداغوجي المقترح</th>
                <th style="width: 45px;">المدة</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 8.5pt;">
        <div>توقيع أستاذ(ة) المادة: <b>${teacherName}</b></div>
        <div>تأشيرة الحراسة العامة للخارجية</div>
        <div>تأشيرة وخاتم إدارة المؤسسة</div>
    </div>
</body>
</html>
    `;

    if (typeof (window as any).printDocumentDirectly === 'function') {
      (window as any).printDocumentDirectly(htmlContent, `خطة المعالجة الجماعية - ${clsName}`, 'landscape');
      return;
    }
    window.print();
  };

  // Handler: Run Generative AI (Gemini) via backend proxy
  const handleRunGenerativeAiInspection = async () => {
    if (isGeneratingAi) return;
    setIsGeneratingAi(true);

    try {
      const targetCls = selectedClass === 'all' ? Object.keys(db?.classes || {})[0] || 'القسم' : selectedClass;
      const payload = {
        className: targetCls,
        level: 'مقرر الرياضيات المغربي',
        subject: 'الرياضيات',
        examLabel: `${scannedExamSourceLabel}`,
        stats: {
          totalStudents: studentMetrics.length,
          evaluatedCount: studentMetrics.filter(s => getStudentScannedScore(s) !== null).length,
          classAverage: classAverages.overall || 10,
          strugglingCount: strugglingStudents.length
        },
        strugglingStudents: strugglingStudents.slice(0, 12).map(s => ({
          name: s.name,
          grade: getStudentScannedScore(s) ?? s.avg,
          f1: s.f1,
          f2: s.f2
        })),
        specificDifficulties: Object.values(REMEDIATION_CATALOG).map(c => c.commonErrors).slice(0, 4).join(' • ')
      };

      const res = await fetch('/api/ai/analyze-exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('تعذر استلام تقرير الذكاء الاصطناعي');
      }

      const data = await res.json();
      setAiGeminiReportHtml(data.result || 'تم التحليل بنجاح.');
      setShowGeminiModal(true);
    } catch (e: any) {
      notifyUser('حدث تنبيه أثناء استدعاء محرك الذكاء الاصطناعي: ' + (e.message || 'يرجى المحاولة مجدداً'), 'warning');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Scanned Exams Auto-Remediation Banner */}
      <div className="bg-gradient-to-l from-purple-900 via-indigo-900 to-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-md border border-purple-800/40 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-bold mb-2 border border-purple-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>التوليد التلقائي لخطط المعالجة البيداغوجية بناءً على نتائج الفروض الممسوحة • المذكرة 142-08</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              توليد خطط المعالجة البيداغوجية وأنشطة الدعم المخصصة لكل فئة من المتعثرين
            </h2>
            <p className="text-xs md:text-sm text-purple-200/85 mt-1 max-w-3xl leading-relaxed">
              يحلل النظام نتائج الفروض الممسوحة في تبويب «الأداء السنوي» ويقوم بتفييء التلاميذ المتعثرين تلقائياً إلى 4 فئات بيداغوجية متجانسة (تعثر حاد، تعثر متوسط، هشاشة على العتبة، وتراجع ظرفي) مع اقتراح أنشطة دعم وتمارين رياضية مخصصة لكل فئة قابلة للجدولة والطباعة الفورية.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowScannerBreakdownModal(!showScannerBreakdownModal)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-black border border-emerald-400/40 transition-all cursor-pointer shadow-xs"
              title="فتح محلل الفروض الممسوحة ضوئياً وتفكيك نسب التحكم حسب التمارين"
            >
              <QrCode className="w-4 h-4 text-emerald-300" />
              <span>محلل الفروض الممسوحة ({lastScanTimestamp}) 📸</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof (window as any).openFastGrading === 'function') {
                  (window as any).openFastGrading();
                } else {
                  handleTriggerOpticalExamScan();
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-100 text-xs font-bold border border-indigo-400/40 transition-all cursor-pointer"
              title="فتح ماسح الإدخال السريع والإملاء الصوتي لنقط الفروض"
            >
              <Target className="w-4 h-4 text-amber-300" />
              <span>ماسح النقط السريع ⚡</span>
            </button>

            <button
              type="button"
              onClick={handlePrintClassRemediationSchedule}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-xs"
              title="طباعة خطة المعالجة الشاملة المصنفة حسب الفئات (A4)"
            >
              <Printer className="w-4 h-4 text-purple-200" />
              <span>طباعة الخطة الشاملة (A4)</span>
            </button>

            <button
              type="button"
              onClick={handleRunGenerativeAiInspection}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
              title="تشغيل التحليل التوليدي المعمق عبر Gemini AI"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>جاري التحليل...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 text-amber-100" />
                  <span>تقرير الذكاء الاصطناعي التوليدي ✨</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scanned Exam Source Selector Bar */}
        <div className="relative z-10 mt-4 pt-3.5 border-t border-purple-700/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>مرجع الفرض الممسوح المعتمد في التوليد التلقائي:</span>
            </span>
            {[
              { id: 'all', label: '📊 الحصيلة الشاملة للفروض الممسوحة' },
              { id: 'f1', label: '📄 الفرض المحروس 1 (F1)' },
              { id: 'f2', label: '📄 الفرض المحروس 2 (F2)' },
              { id: 'f3', label: '📄 الفرض المحروس 3 (F3)' },
              ...(classAverages.f4 !== null && classAverages.f4 !== undefined ? [{ id: 'f4', label: '📄 الفرض المحروس 4 (F4)' }] : [])
            ].map(ex => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setScannedExamSource(ex.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  scannedExamSource === ex.id
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-purple-100 border border-white/15'
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-xl border border-white/10">
            {[
              { id: 'both', label: 'الكل (فئات + أفراد)' },
              { id: 'cohorts_only', label: 'خطط الفئات (4 فئات)' },
              { id: 'students_only', label: 'البطاقات الفردية' }
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setDisplayMode(m.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  displayMode === m.id ? 'bg-purple-600 text-white' : 'text-purple-200 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick KPI Strip by Struggling Categories */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-purple-700/40">
          {autoGeneratedTierPlans.map(tier => (
            <div key={tier.tierKey} className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-purple-200 font-bold">{tier.badgeCode}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-amber-300 font-mono">{tier.thresholdLabel}</span>
              </div>
              <div className="text-xl md:text-2xl font-black text-white font-mono mt-1">
                {tier.students.length} <span className="text-xs text-purple-200 font-normal">تلميذ(ة)</span>
              </div>
              <div className="text-[10px] text-purple-300 mt-0.5 truncate" title={tier.pedagogicalStrategy}>
                {tier.weeklyAllocation} • {tier.proposedActivities.length} أنشطة مخصصة
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 1.5 Optional Optical Scanned Exam Breakdown Panel */}
      {showScannerBreakdownModal && (
        <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-md p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                📸
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-900">
                  نتائج المسح الضوئي وتفكيك أوراق الفرض ({scannedExamSourceLabel}) حسب التمارين والمحاور
                </h3>
                <p className="text-xs text-slate-500">
                  تحليل آلي لنسب التحكم في كل تمرين من أوراق الفرض الممسوحة لتوجيه أنشطة الدعم نحو الفئات المتعثرة بدقة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerOpticalExamScan}
                disabled={isScanningSimulation}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningSimulation ? 'animate-spin' : ''}`} />
                <span>{isScanningSimulation ? 'جاري المسح والتحليل...' : 'إعادة فحص الأوراق الممسوحة وتحديث الخطط'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScannerBreakdownModal(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scannedExamAxesAnalysis.map((ax, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">{ax.axisTitle}</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">نسبة التحكم في التمرين:</span>
                  <strong className="font-mono text-sm" style={{ color: ax.color }}>{ax.masteryPct}%</strong>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${ax.masteryPct}%`, backgroundColor: ax.color }} />
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
                  <span>المتعثرون في هذا التمرين: <b>{ax.strugglingCount} تلميذ</b></span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-indigo-700">{ax.targetTier}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. AUTOMATIC COHORT-BASED REMEDIATION PLANS SECTION (خطط المعالجة المولدة تلقائياً لكل فئة من المتعثرين) */}
      {(displayMode === 'both' || displayMode === 'cohorts_only') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>خطط المعالجة البيداغوجية المولدة تلقائياً حسب فئات المتعثرين ({scannedExamSourceLabel})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                يقترح النظام أنشطة دعم مخصصة وتمارين علاجية متدرجة لكل فئة من فئات المتعثرين الأربع مع إمكانية التخصيص والبرمجة المباشرة في دفتر النصوص
              </p>
            </div>
            <div className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
              إجمالي المستهدفين بالدعم: <span className="font-black font-mono">{diagnosedStudents.length}</span> تلميذ(ة)
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {autoGeneratedTierPlans.map(tier => {
              const isEditingThisTier = editingTierKey === tier.tierKey;
              return (
                <div
                  key={tier.tierKey}
                  className={`bg-white rounded-2xl border-2 ${tier.borderCls} shadow-xs overflow-hidden flex flex-col justify-between transition-all`}
                >
                  <div>
                    {/* Cohort Header */}
                    <div className={`bg-gradient-to-l ${tier.headerBg} text-white p-4 flex items-center justify-between gap-3`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                            {tier.badgeCode}
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-200">
                            ({tier.thresholdLabel})
                          </span>
                        </div>
                        <h4 className="text-sm md:text-base font-black mt-1 text-white">
                          {tier.title}
                        </h4>
                      </div>
                      <div className="text-center bg-black/25 px-3 py-1.5 rounded-xl border border-white/15 shrink-0">
                        <div className="text-lg font-black font-mono leading-none">{tier.students.length}</div>
                        <div className="text-[10px] text-white/80 font-bold mt-0.5">تلميذ(ة)</div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Diagnostic & Strategy Box */}
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1.5">
                        <div>
                          <span className="font-black text-slate-800">🔍 التشخيص الديداكتيكي للفئة: </span>
                          <span className="text-slate-600 leading-relaxed">{tier.diagnosticSummary}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold">
                            <Users className="w-3 h-3" /> {tier.groupingMode}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                            <Clock className="w-3 h-3" /> {tier.weeklyAllocation}
                          </span>
                        </div>
                      </div>

                      {/* Customized Support Activities for this Struggling Category */}
                      <div className="space-y-2">
                        <div className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-purple-600" />
                          <span>أنشطة الدعم المخصصة المقترحة لهذه الفئة:</span>
                        </div>
                        {tier.proposedActivities.map((act, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                            <div className="font-extrabold text-purple-900">{act.title}</div>
                            <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{act.description}</div>
                            <div className="text-[10px] font-bold text-indigo-700 mt-1">
                              🎯 المهارة المستهدفة: {act.targetSkill}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Targeted Math Exercise (Editable by Teacher) */}
                      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-black text-amber-950">
                            📝 التمرين التطبيقي المقترح لحصة دعم هذه الفئة:
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingTierKey(isEditingThisTier ? null : tier.tierKey)}
                            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                          >
                            {isEditingThisTier ? 'حفظ التعديل ✓' : 'تخصيص التمرين ✎'}
                          </button>
                        </div>
                        {isEditingThisTier ? (
                          <textarea
                            rows={3}
                            value={tier.customExercise}
                            onChange={e =>
                              setCustomTierActivityNotes(prev => ({
                                ...prev,
                                [tier.tierKey]: e.target.value
                              }))
                            }
                            className="w-full p-2 text-xs font-semibold bg-white border border-amber-300 rounded-lg focus:outline-none"
                          />
                        ) : (
                          <div className="text-[11px] font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {tier.customExercise}
                          </div>
                        )}
                      </div>

                      {/* Students in this Struggling Category */}
                      <div>
                        <div className="text-[11px] font-black text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>👥 تلاميذ هذه الفئة المرصودون من الفروض الممسوحة:</span>
                          <span className="font-mono text-slate-500">{tier.students.length} تلميذ</span>
                        </div>
                        {tier.students.length === 0 ? (
                          <div className="text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 text-center font-bold">
                            ✓ لا يوجد تلاميذ ضمن هذه الفئة في الفرض المحدد حالياً
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                            {tier.students.map(({ student, evaluatedScore }) => (
                              <span
                                key={student.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${tier.badgeCls}`}
                              >
                                <span>{student.name}</span>
                                <span className="font-mono font-black">
                                  ({evaluatedScore !== null ? evaluatedScore : student.avg}/20)
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cohort Action Footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleScheduleTierCohortSession(tier)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black cursor-pointer shadow-2xs"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-300" />
                      <span>برمجة حصة دعم لهذه الفئة بالدفتر 📅</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintSingleTierPlan(tier)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>طباعة بطاقة الفئة (A4)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Filter & Search Controls Toolbar for Individual Student Remediation Cards */}
      {(displayMode === 'both' || displayMode === 'students_only') && (
      <>
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم التلميذ أو رقم مسار في البطاقات الفردية..."
              className="w-full pl-3 pr-9 py-2 text-xs md:text-sm font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:border-purple-500 bg-slate-50 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter by Math Category */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 cursor-pointer focus:outline-hidden focus:border-purple-500"
            >
              <option value="all">جميع العوائق والأخطاء الرياضية</option>
              {CATEGORY_KEYS.map(k => (
                <option key={k} value={k}>{REMEDIATION_CATALOG[k].label}</option>
              ))}
            </select>
          </div>

          {/* Filter by Severity */}
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value as any)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 cursor-pointer focus:outline-hidden focus:border-purple-500"
          >
            <option value="all">جميع فئات المتعثرين (أ، ب، ج، د)</option>
            <option value="severe">الفئة أ: تعثر حاد (&lt; 7/20)</option>
            <option value="moderate">الفئة ب: تعثر متوسط (7 إلى 8.99)</option>
            <option value="mild">الفئة ج: هشاشة على العتبة (9 إلى 9.99)</option>
            <option value="declining">الفئة د: تراجع مفاجئ في الفرض الممسوح</option>
          </select>
        </div>
      </div>

      {/* 4. Students Individual Activities Cards Grid */}
      {filteredDiagnosed.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            لا توجد حالات تعثر مطابقة لمعايير البحث الحالية
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            جميع تلامذة الفئة المحددة حققوا عتبة التمكن (≥ 10/20) أو لم تسجل لديهم أخطاء تعثر حادة في هذا الفلتر.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDiagnosed.map(({ student, evaluatedScore, severityBadge, severityLabel, activity }) => {
            const isScheduling = schedulingStudentId === student.id;

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative group"
              >
                <div>
                  {/* Top Bar: Student info & severity */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 mb-3.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm md:text-base">
                          {student.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {student.className} • {student.massar || 'مسار غير محدد'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                        <span className="text-slate-500">نقط الفروض الممسوحة:</span>
                        <span className="font-bold text-slate-700 font-mono">
                          F1: {student.f1 !== null ? `${student.f1}` : '-'} | F2: {student.f2 !== null ? `${student.f2}` : '-'}
                          {student.f3 !== null ? ` | F3: ${student.f3}` : ''}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-black text-rose-600 font-mono">
                          المعدل: {student.avg !== null ? `${student.avg}/20` : '-'}
                        </span>
                        {student.delta !== null && student.delta <= -1.5 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm">
                            <TrendingDown className="w-3 h-3 mr-0.5" />
                            {student.delta}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap ${severityBadge}`}>
                      {severityLabel}
                    </span>
                  </div>

                  {/* Diagnostic classification & dropdown */}
                  <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-purple-600" />
                        <span>نوع الخطأ والعائق الديداكتيكي المرصود:</span>
                      </div>

                      {/* Dropdown to override category if teacher wants */}
                      <select
                        value={activity.categoryKey}
                        onChange={e => handleCategoryChange(student.id, e.target.value)}
                        className="text-[10px] font-bold text-purple-800 bg-white border border-purple-200 rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-hidden"
                        title="تعديل تصنيف العائق الرياضي لهذا التلميذ"
                      >
                        {CATEGORY_KEYS.map(k => (
                          <option key={k} value={k}>{REMEDIATION_CATALOG[k].label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="text-xs font-extrabold text-purple-950">
                      {activity.categoryLabel}
                    </div>
                    <div className="text-[11px] text-purple-800/80 mt-1 leading-relaxed">
                      {activity.commonErrors}
                    </div>
                  </div>

                  {/* Proposed Remediation Activity Details */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-slate-800">النشاط المقترح: </span>
                        <span className="font-bold text-blue-700">{activity.title}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">الهدف الإجرائي: </span>
                        <span>{activity.objective}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600 text-[11px] leading-relaxed">
                      <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700">صيغة المعالجة: </span>
                        <span>{activity.strategy}</span>
                      </div>
                    </div>

                    {/* Mini Diagnostic Exercise preview */}
                    <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-2.5 mt-2">
                      <div className="text-[10px] font-bold text-amber-900 mb-1 flex items-center justify-between">
                        <span>📝 تمرين المعالجة التطبيقي المخصص:</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{activity.durationMinutes} دقيقة</span>
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {activity.miniExercise}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleScheduleExtraSession({ student, evaluatedScore, severityLabel, severityBadge, activity, severity: 'moderate' })}
                    disabled={isScheduling}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    title="برمجة هذا النشاط العلاجي فوراً كحصة استدراكية في دفتر النصوص وربطها بالقسم"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isScheduling ? 'جاري الفتح...' : 'برمجة كحصة استدراكية بالدفتر ⚡'}</span>
                  </button>

                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrintStudentWorksheet({ student, evaluatedScore, severityLabel, severityBadge, activity, severity: 'moderate' })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                      title="طباعة بطاقة المعالجة الفردية للتلميذ بصيغة A4"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>طباعة بطاقة التلميذ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof (window as any).openShareRecordModal === 'function') {
                          (window as any).openShareRecordModal({
                            type: 'student',
                            className: student.className || selectedClass,
                            studentId: student.id,
                            studentName: student.name
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all cursor-pointer"
                      title="مشاركة سجل التلميذ وخطة المعالجة مع الزملاء عبر رمز QR أو رابط مباشر مشفر"
                    >
                      <QrCode className="w-3.5 h-3.5 text-purple-600" />
                      <span>مشاركة (QR / مشفر)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* 5. Gemini Generative AI Full Report Modal */}
      {showGeminiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-purple-200 overflow-hidden">
            <div className="p-4 md:p-5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-300" />
                <h3 className="font-black text-sm md:text-base">
                  تقرير التفتيش البيداغوجي بالذكاء الاصطناعي وخطة المعالجة الشاملة
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeminiModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto flex-1 text-slate-800 text-sm leading-relaxed">
              {aiGeminiReportHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: aiGeminiReportHtml }}
                  className="prose prose-purple max-w-none"
                />
              ) : (
                <div className="text-center py-10 text-slate-500">لا يوجد محتوى.</div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const html = `
                    <html lang="ar" dir="rtl">
                    <head><title>تقرير التفتيش البيداغوجي وخطة المعالجة (المذكرة 142-08)</title><link href="https://fonts.googleapis.com/css2?family=Cairo&display=swap" rel="stylesheet"><style>body{font-family:'Cairo',sans-serif;padding:16px;}</style></head>
                    <body>${aiGeminiReportHtml || ''}</body>
                    </html>
                  `;
                  if (typeof (window as any).printDocumentDirectly === 'function') {
                    (window as any).printDocumentDirectly(html, 'تقرير التفتيش البيداغوجي وخطة المعالجة', 'portrait');
                  } else {
                    window.print();
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                طباعة هذا التقرير 🖨️
              </button>
              <button
                type="button"
                onClick={() => setShowGeminiModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

