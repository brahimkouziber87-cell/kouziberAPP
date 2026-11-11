/**
 * ============================================================================
 * محرك المعادلات والصيغ الرياضية (LaTeX / KaTeX) المدمج لدفتر النصوص
 * وحاسبة وأمر النسخ والطبع (Bon de Tirage) للوثائق والفروض الخارجية
 * ============================================================================
 * مصمم خصيصاً لأساتذة مادة الرياضيات بالتعليم الثانوي التأهيلي (منظومة مسار)
 * ============================================================================
 */

(function () {
    'use strict';

    // Track last focused textarea in Lesson Log (including dynamic axis paragraphs)
    window._lastFocusedLessonLogTextarea = null;

    document.addEventListener('focusin', function (e) {
        const el = e.target;
        if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT')) return;
        if (
            el.id === 'lessonLogSummary' ||
            el.id === 'lessonLogHomework' ||
            el.id === 'lessonLogNotes' ||
            el.classList.contains('paragraph-content-textarea')
        ) {
            window._lastFocusedLessonLogTextarea = el;
        }
    });

    function escapeHtmlSafe(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ------------------------------------------------------------------------
    // 1. دوال تصيير المعادلات الرياضية (KaTeX Rendering Engine)
    // ------------------------------------------------------------------------

    /**
     * تحويل صيغة LaTeX خام إلى HTML مصير بواسطة KaTeX
     */
    window.renderLatexToHtml = function (latexStr, displayMode = false) {
        if (!latexStr) return '';
        if (typeof window.katex !== 'undefined') {
            try {
                return window.katex.renderToString(String(latexStr).trim(), {
                    displayMode: Boolean(displayMode),
                    throwOnError: false,
                    output: 'html',
                    trust: true,
                    strict: false
                });
            } catch (e) {
                console.warn('KaTeX render warning:', e);
            }
        }
        return `<code dir="ltr" style="font-family:'JetBrains Mono',monospace;background:#f1f5f9;padding:2px 6px;border-radius:4px;color:#0f172a;display:inline-block;">${escapeHtmlSafe(latexStr)}</code>`;
    };

    /**
     * تحويل النصوص التي تحتوي على معادلات بصيغة $$...$$ أو $...$ أو \[...\] أو \(...\)
     * إلى HTML آمن ومُصيّر بالكامل (مع حماية النصوص العادية بـ escapeHtmlSafe)
     */
    window.renderMathInText = function (rawText) {
        if (!rawText || typeof rawText !== 'string') return '';

        const tokenRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
        const parts = rawText.split(tokenRegex);

        return parts.map(part => {
            if (!part) return '';
            if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
                const tex = part.slice(2, -2);
                return `<div class="math-block-rendered" dir="ltr" style="margin:6px 0;text-align:center;overflow-x:auto;">${window.renderLatexToHtml(tex, true)}</div>`;
            }
            if (part.startsWith('\\[') && part.endsWith('\\]') && part.length > 4) {
                const tex = part.slice(2, -2);
                return `<div class="math-block-rendered" dir="ltr" style="margin:6px 0;text-align:center;overflow-x:auto;">${window.renderLatexToHtml(tex, true)}</div>`;
            }
            if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                const tex = part.slice(1, -1);
                return `<span class="math-inline-rendered" dir="ltr" style="display:inline-block;padding:0 2px;vertical-align:middle;">${window.renderLatexToHtml(tex, false)}</span>`;
            }
            if (part.startsWith('\\(') && part.endsWith('\\)') && part.length > 4) {
                const tex = part.slice(2, -2);
                return `<span class="math-inline-rendered" dir="ltr" style="display:inline-block;padding:0 2px;vertical-align:middle;">${window.renderLatexToHtml(tex, false)}</span>`;
            }
            return escapeHtmlSafe(part);
        }).join('');
    };

    /**
     * تفعيل التصيير التلقائي داخل حاوية DOM
     */
    window.renderMathInContainer = function (element) {
        if (!element) return;
        if (typeof window.renderMathInElement === 'function') {
            try {
                window.renderMathInElement(element, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.warn('Auto-render KaTeX warning:', e);
            }
        }
    };

    /**
     * معاينة حية للمعادلات أسفل حقول دفتر النصوص (ملخص الحصة والواجب المنزلي)
     */
    window.updateLessonLogLiveMathPreview = function () {
        const fields = [
            { inputId: 'lessonLogSummary', previewId: 'lessonLogSummaryMathPreview', title: 'معاينة الصيغ الرياضية في ملخص الحصة:' },
            { inputId: 'lessonLogHomework', previewId: 'lessonLogHomeworkMathPreview', title: 'معاينة الصيغ الرياضية في الواجب المنزلي:' }
        ];

        fields.forEach(({ inputId, previewId, title }) => {
            const inputEl = document.getElementById(inputId);
            const previewEl = document.getElementById(previewId);
            if (!inputEl || !previewEl) return;

            const val = inputEl.value || '';
            const hasMath = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/.test(val);
            if (!hasMath) {
                previewEl.style.display = 'none';
                previewEl.innerHTML = '';
                return;
            }

            previewEl.style.display = 'block';
            previewEl.innerHTML = `
                <div style="font-size:0.72rem;font-weight:800;color:#4338ca;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;">
                    <span>👁️ ${title}</span>
                    <span style="font-size:0.68rem;color:#64748b;font-weight:600;">تُطبع تلقائياً في دفتر النصوص الرسمي</span>
                </div>
                <div style="font-size:0.86rem;line-height:1.75;color:#0f172a;white-space:pre-wrap;background:#ffffff;padding:8px 10px;border-radius:8px;border:1px solid #e0e7ff;">${window.renderMathInText(val)}</div>
            `;
        });
    };

    // ------------------------------------------------------------------------
    // 2. مكتبة الرموز والبنيات الجبرية والتحليلية والهندسية (8 تصنيفات شاملة)
    // ------------------------------------------------------------------------
    const LATEX_SYMBOL_CATEGORIES = {
        basic: {
            label: 'العمليات والكسور والجذور',
            icon: '➗',
            items: [
                { label: 'كسر اعتيادي', preview: '\\frac{a}{b}', latex: '\\frac{a}{b}' },
                { label: 'كسر كبير (Display)', preview: '\\dfrac{a}{b}', latex: '\\dfrac{a}{b}' },
                { label: 'جذر تربيعي', preview: '\\sqrt{x}', latex: '\\sqrt{x}' },
                { label: 'جذر من الرتبة n', preview: '\\sqrt[n]{x}', latex: '\\sqrt[n]{x}' },
                { label: 'قوة / أس', preview: 'x^{n}', latex: 'x^{n}' },
                { label: 'دليل سفلي', preview: 'u_{n}', latex: 'u_{n}' },
                { label: 'القيمة المطلقة', preview: '|x|', latex: '\\left| x \\right|' },
                { label: 'أقواس مرنة', preview: '(x)', latex: '\\left( x \\right)' },
                { label: 'معقوفتان مرنتان', preview: '[a,b]', latex: '\\left[ a, b \\right]' },
                { label: 'زائد أو ناقص', preview: '\\pm', latex: '\\pm ' },
                { label: 'تخالف', preview: '\\neq', latex: '\\neq ' },
                { label: 'تقارب / تساوي تقريباً', preview: '\\approx', latex: '\\approx ' },
                { label: 'أصغر أو يساوي', preview: '\\leq', latex: '\\leq ' },
                { label: 'أكبر أو يساوي', preview: '\\geq', latex: '\\geq ' }
            ]
        },
        limits_deriv: {
            label: 'النهايات والاشتقاق',
            icon: '📈',
            items: [
                { label: 'نهاية عند x₀', preview: '\\lim_{x \\to x_0}', latex: '\\lim_{x \\to x_0} f(x) = ' },
                { label: 'نهاية عند +∞', preview: '\\lim_{x \\to +\\infty}', latex: '\\lim_{x \\to +\\infty} f(x) = ' },
                { label: 'نهاية عند -∞', preview: '\\lim_{x \\to -\\infty}', latex: '\\lim_{x \\to -\\infty} f(x) = ' },
                { label: 'نهاية على اليمين', preview: '\\lim_{x \\to a^+}', latex: '\\lim_{x \\to a^+} f(x) = ' },
                { label: 'نهاية على اليسار', preview: '\\lim_{x \\to a^-}', latex: '\\lim_{x \\to a^-} f(x) = ' },
                { label: 'معدل التغير', preview: '\\frac{f(x)-f(a)}{x-a}', latex: '\\lim_{x \\to a} \\dfrac{f(x)-f(a)}{x-a} = f\'(a)' },
                { label: 'المشتقة الأولى', preview: 'f\'(x)', latex: 'f\'(x)' },
                { label: 'المشتقة الثانية', preview: 'f\'\'(x)', latex: 'f\'\'(x)' },
                { label: 'تعبير المشتقة', preview: '\\frac{df}{dx}', latex: '\\dfrac{df}{dx}' },
                { label: 'معادلة المماس (T)', preview: 'y=f\'(a)(x-a)+f(a)', latex: '(T): y = f\'(a)(x - a) + f(a)' },
                { label: 'ما لا نهاية', preview: '+\\infty', latex: '+\\infty' },
                { label: 'ناقص ما لا نهاية', preview: '-\\infty', latex: '-\\infty' }
            ]
        },
        integrals_suites: {
            label: 'التكامل والمتتاليات',
            icon: '∫',
            items: [
                { label: 'تكامل محدد', preview: '\\int_{a}^{b} f(x)dx', latex: '\\int_{a}^{b} f(x)\\,dx' },
                { label: 'معقوفتا الدالة الأصلية', preview: '[F(x)]_a^b', latex: '\\left[ F(x) \\right]_{a}^{b}' },
                { label: 'مكاملة بالأجزاء', preview: '\\int u\'v', latex: '\\int_{a}^{b} u\'(x)v(x)\\,dx = \\left[u(x)v(x)\\right]_{a}^{b} - \\int_{a}^{b} u(x)v\'(x)\\,dx' },
                { label: 'متتالية عددية', preview: '(u_n)_{n\\in\\mathbb{N}}', latex: '(u_n)_{n \\in \\mathbb{N}}' },
                { label: 'نهاية متتالية', preview: '\\lim_{n\\to+\\infty} u_n', latex: '\\lim_{n \\to +\\infty} u_n = ' },
                { label: 'المجموع Sigma', preview: '\\sum_{k=0}^{n} u_k', latex: '\\sum_{k=0}^{n} u_k' },
                { label: 'الجداء Pi', preview: '\\prod_{k=1}^{n} u_k', latex: '\\prod_{k=1}^{n} u_k' },
                { label: 'علاقة تراجعية', preview: 'u_{n+1}=f(u_n)', latex: '\\forall n \\in \\mathbb{N},\\; u_{n+1} = f(u_n)' }
            ]
        },
        functions: {
            label: 'الدوال اللوغاريتمية والأسية والمثلثية',
            icon: '𝑓(x)',
            items: [
                { label: 'اللوغاريتم النيبيري', preview: '\\ln(x)', latex: '\\ln(x)' },
                { label: 'الدالة الأسية', preview: 'e^{x}', latex: 'e^{x}' },
                { label: 'اللوغاريتم العشري', preview: '\\log(x)', latex: '\\log(x)' },
                { label: 'جيب التمام cos', preview: '\\cos(x)', latex: '\\cos(x)' },
                { label: 'الجيب sin', preview: '\\sin(x)', latex: '\\sin(x)' },
                { label: 'الظل tan', preview: '\\tan(x)', latex: '\\tan(x)' },
                { label: 'قوس الظل arctan', preview: '\\arctan(x)', latex: '\\arctan(x)' },
                { label: 'العدد π (Pi)', preview: '\\pi', latex: '\\pi' },
                { label: 'دالة معرفة بالاجزاء', preview: 'f(x)=\\{...\\}', latex: 'f(x) = \\begin{cases} x^2 - 1 & ;\\; x \\geq 0 \\\\ 2x + 1 & ;\\; x < 0 \\end{cases}' },
                { label: 'تركيب دالتين', preview: '(g \\circ f)(x)', latex: '(g \\circ f)(x) = g(f(x))' },
                { label: 'الدالة العكسية', preview: 'f^{-1}(x)', latex: 'f^{-1}(x)' }
            ]
        },
        logic_sets: {
            label: 'المنطق والمجموعات',
            icon: '∀∈',
            items: [
                { label: 'مهما يكن (الكمي الكوني)', preview: '\\forall', latex: '\\forall x \\in ' },
                { label: 'يوجد على الأقل', preview: '\\exists', latex: '\\exists x \\in ' },
                { label: 'يوجد عنصر وحيد', preview: '\\exists!', latex: '\\exists! x \\in ' },
                { label: 'يستلزم', preview: '\\implies', latex: '\\implies ' },
                { label: 'يكافئ', preview: '\\iff', latex: '\\iff ' },
                { label: 'ينتمي', preview: '\\in', latex: '\\in ' },
                { label: 'لا ينتمي', preview: '\\notin', latex: '\\notin ' },
                { label: 'ضمن / محتواة', preview: '\\subset', latex: '\\subset ' },
                { label: 'تقاطع', preview: '\\cap', latex: '\\cap ' },
                { label: 'اتحاد', preview: '\\cup', latex: '\\cup ' },
                { label: 'المجموعة الفارغة', preview: '\\emptyset', latex: '\\emptyset' },
                { label: 'مجموعة الأعداد الصحيحة N', preview: '\\mathbb{N}', latex: '\\mathbb{N}' },
                { label: 'مجموعة الأعداد النسبية Z', preview: '\\mathbb{Z}', latex: '\\mathbb{Z}' },
                { label: 'مجموعة الأعداد الحقيقية R', preview: '\\mathbb{R}', latex: '\\mathbb{R}' },
                { label: 'مجموعة الأعداد العقدية C', preview: '\\mathbb{C}', latex: '\\mathbb{C}' },
                { label: 'مجموعة التعريف D_f', preview: 'D_f', latex: 'D_f = \\left\\{ x \\in \\mathbb{R} \\;/\\; x \\neq 0 \\right\\}' }
            ]
        },
        geometry_vectors: {
            label: 'الهندسة الفضائية والمتجهات',
            icon: '📐',
            items: [
                { label: 'متجهة AB', preview: '\\overrightarrow{AB}', latex: '\\overrightarrow{AB}' },
                { label: 'متجهة u', preview: '\\vec{u}', latex: '\\vec{u}' },
                { label: 'منظم متجهة', preview: '\\|\\vec{u}\\|', latex: '\\left\\| \\vec{u} \\right\\|' },
                { label: 'الجداء السلمي', preview: '\\vec{u}\\cdot\\vec{v}', latex: '\\vec{u} \\cdot \\vec{v}' },
                { label: 'الجداء المتجهي', preview: '\\vec{u}\\wedge\\vec{v}', latex: '\\vec{u} \\wedge \\vec{v}' },
                { label: 'إحداثيات متجهة بالفضاء', preview: '\\vec{u}(x;y;z)', latex: '\\vec{u}\\begin{pmatrix} x \\\\ y \\\\ z \\end{pmatrix}' },
                { label: 'زاوية هندسية', preview: '\\widehat{ABC}', latex: '\\widehat{ABC}' },
                { label: 'زاوية موجهة', preview: '(\\vec{u},\\vec{v})', latex: '\\left(\\widehat{\\vec{u}, \\vec{v}}\\right)' },
                { label: 'تعامد', preview: '\\perp', latex: '\\perp ' },
                { label: 'توازي', preview: '\\parallel', latex: '\\parallel ' },
                { label: 'معلم متعامد ممنظم', preview: '(O,\\vec{i},\\vec{j},\\vec{k})', latex: '\\left(O, \\vec{i}, \\vec{j}, \\vec{k}\\right)' },
                { label: 'مسافة نقطة عن مستوى', preview: 'd(M,(P))', latex: 'd\\big(\\Omega, (P)\\big) = \\dfrac{|ax_\\Omega + by_\\Omega + cz_\\Omega + d|}{\\sqrt{a^2+b^2+c^2}}' }
            ]
        },
        complex_matrices: {
            label: 'الأعداد العقدية والنظمات والمصفوفات',
            icon: 'ℂ',
            items: [
                { label: 'مرافق عدد عقدي', preview: '\\overline{z}', latex: '\\overline{z}' },
                { label: 'معيار عدد عقدي', preview: '|z|', latex: '|z| = \\sqrt{a^2 + b^2}' },
                { label: 'عمدة عدد عقدي arg', preview: '\\arg(z)', latex: '\\arg(z) \\equiv \\theta \\;[2\\pi]' },
                { label: 'الجزء الحقيقي Re', preview: '\\text{Re}(z)', latex: '\\text{Re}(z)' },
                { label: 'الجزء التخيلي Im', preview: '\\text{Im}(z)', latex: '\\text{Im}(z)' },
                { label: 'الكتابة الأسية', preview: 're^{i\\theta}', latex: 'z = r e^{i\\theta}' },
                { label: 'الكتابة المثلثية', preview: '[r,\\theta]', latex: 'z = r(\\cos\\theta + i\\sin\\theta)' },
                { label: 'نظمة معادلتين', preview: '\\{ax+by=c', latex: '\\begin{cases} ax + by = c \\\\ a\'x + b\'y = c\' \\end{cases}' },
                { label: 'تمثيل بارامتري لمستقيم', preview: 'x=x_0+at', latex: '(D): \\begin{cases} x = x_0 + at \\\\ y = y_0 + bt \\\\ z = z_0 + ct \\end{cases} \\quad (t \\in \\mathbb{R})' },
                { label: 'مصفوفة 2×2', preview: '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
                { label: 'محددة 2×2', preview: '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}', latex: '\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc' }
            ]
        },
        arith_proba: {
            label: 'الحسابيات والاحتمالات والبنيات',
            icon: '🎲',
            items: [
                { label: 'الموافقة بترديد n', preview: 'a \\equiv b [n]', latex: 'a \\equiv b \\pmod{n}' },
                { label: 'يقسم', preview: 'a \\mid b', latex: 'a \\mid b' },
                { label: 'القاسم المشترك الأكبر', preview: 'a \\wedge b', latex: '\\gcd(a,b) = a \\wedge b' },
                { label: 'المضاعف المشترك الأصغر', preview: 'a \\vee b', latex: '\\text{lcm}(a,b) = a \\vee b' },
                { label: 'التأليفات C_n^p', preview: 'C_n^p', latex: 'C_{n}^{p} = \\dfrac{n!}{p!(n-p)!}' },
                { label: 'الترتيبات A_n^p', preview: 'A_n^p', latex: 'A_{n}^{p} = \\dfrac{n!}{(n-p)!}' },
                { label: 'الاحتمال الشرطي', preview: 'P_A(B)', latex: 'P_{A}(B) = \\dfrac{P(A \\cap B)}{P(A)}' },
                { label: 'الأمل الرياضي E(X)', preview: 'E(X)', latex: 'E(X) = \\sum_{i=1}^{n} x_i P(X = x_i)' },
                { label: 'المغايرة V(X)', preview: 'V(X)', latex: 'V(X) = E(X^2) - \\big[E(X)\\big]^2' },
                { label: 'قانون برنولي / الحدانية', preview: 'P(X=k)', latex: 'P(X = k) = C_{n}^{k} p^{k} (1-p)^{n-k}' }
            ]
        }
    };

    // ------------------------------------------------------------------------
    // 3. بنك الصيغ والعلاقات والمبرهنات الرسمية الجاهزة لدفتر النصوص
    // ------------------------------------------------------------------------
    const LESSON_LOG_FORMULA_BANK = [
        {
            id: 'tvi',
            level: '2BAC',
            category: 'التحليل والاتصال',
            title: 'مبرهنة القيم الوسيطية (TVI)',
            textSnippet: 'مبرهنة القيم الوسيطية: إذا كانت $f$ دالة متصلة على القطعة $[a,b]$ ورتيبة قطعا عليها وكان $f(a) \\times f(b) < 0$، فإن المعادلة $f(x) = 0$ تقبل حلا وحيدا $\\alpha$ في المجال $]a,b[$.',
            latexOnly: 'f \\text{ continue et strictement monotone sur } [a,b] \\text{ et } f(a) \\cdot f(b) < 0 \\implies \\exists! \\alpha \\in ]a,b[ \\;/\\; f(\\alpha) = 0'
        },
        {
            id: 'deriv_inv',
            level: '2BAC',
            category: 'التحليل والاشتقاق',
            title: 'اشتقاق الدالة العكسية في نقطة',
            textSnippet: 'خاصية اشتقاق الدالة العكسية: إذا كانت $f$ قابلة للاشتقاق في $x_0$ و $f\'(x_0) \\neq 0$ فإن $f^{-1}$ قابلة للاشتقاق في $y_0 = f(x_0)$ ولدينا: $$(f^{-1})\'(y_0) = \\dfrac{1}{f\'(x_0)} = \\dfrac{1}{f\'\\big(f^{-1}(y_0)\\big)}$$',
            latexOnly: '(f^{-1})\'(y_0) = \\dfrac{1}{f\'\\big(f^{-1}(y_0)\\big)}'
        },
        {
            id: 'taf',
            level: '2BAC',
            category: 'التحليل والاشتقاق',
            title: 'مبرهنة التزايدات المنتهية (TAF) ومبرهنة رول',
            textSnippet: 'مبرهنة التزايدات المنتهية: إذا كانت $f$ متصلة على $[a,b]$ وقابلة للاشتقاق على $]a,b[$ فإنه: $$\\exists c \\in ]a,b[ \\;:\\quad f(b) - f(a) = f\'(c)(b - a)$$',
            latexOnly: '\\exists c \\in ]a,b[ \\;:\\quad f(b) - f(a) = f\'(c)(b - a)'
        },
        {
            id: 'ln_exp_limits',
            level: '2BAC',
            category: 'النهايات الاعتيادية',
            title: 'النهايات الاعتيادية للدالتين اللوغاريتمية والأسية',
            textSnippet: 'النهايات الاعتيادية الأساسية: $$\\lim_{x \\to +\\infty} \\dfrac{\\ln(x)}{x^n} = 0 \\quad ; \\quad \\lim_{x \\to 0^+} x^n \\ln(x) = 0 \\quad ; \\quad \\lim_{x \\to +\\infty} \\dfrac{e^x}{x^n} = +\\infty \\quad ; \\quad \\lim_{x \\to -\\infty} x^n e^x = 0$$',
            latexOnly: '\\lim_{x \\to +\\infty} \\dfrac{\\ln(x)}{x} = 0 \\; ; \\; \\lim_{x \\to 0} \\dfrac{\\ln(1+x)}{x} = 1 \\; ; \\; \\lim_{x \\to +\\infty} \\dfrac{e^x}{x} = +\\infty \\; ; \\; \\lim_{x \\to 0} \\dfrac{e^x - 1}{x} = 1'
        },
        {
            id: 'area_volume',
            level: '2BAC',
            category: 'الحساب التكاملي',
            title: 'حساب المساحة وحجم مجسم الدوران بالتكامل',
            textSnippet: 'مساحة الحيز المحصور بين $(C_f)$ و $(C_g)$ والمستقيمين $x=a$ و $x=b$: $$\\mathcal{A} = \\left( \\int_{a}^{b} |f(x) - g(x)|\\,dx \\right) \\cdot \\|\\vec{i}\\| \\times \\|\\vec{j}\\|$$ وحجم مجسم الدوران حول محور الأفاصيل: $$\\mathcal{V} = \\left( \\pi \\int_{a}^{b} \\big[f(x)\\big]^2\\,dx \\right) \\cdot \\|\\vec{i}\\|^3$$',
            latexOnly: '\\mathcal{A} = \\int_{a}^{b} |f(x) - g(x)|\\,dx \\cdot u.a \\quad ; \\quad \\mathcal{V} = \\pi \\int_{a}^{b} [f(x)]^2\\,dx \\cdot u.v'
        },
        {
            id: 'diff_eq',
            level: '2BAC',
            category: 'المعادلات التفاضلية',
            title: 'حلول المعادلات التفاضلية من الرتبة الأولى والثانية',
            textSnippet: 'الحل العام للمعادلة التفاضلية $y\' = ay + b$ هو: $$y(x) = k e^{ax} - \\dfrac{b}{a} \\quad (k \\in \\mathbb{R})$$ والحالة $y\'\' + \\omega^2 y = 0$ حلها العام: $$y(x) = \\alpha \\cos(\\omega x) + \\beta \\sin(\\omega x)$$',
            latexOnly: 'y\' = ay + b \\iff y(x) = k e^{ax} - \\dfrac{b}{a}'
        },
        {
            id: 'suites_geo_arith',
            level: '1BAC / 2BAC',
            category: 'المتتاليات العددية',
            title: 'الحد العام ومجموع متتالية حسابية وهندسية',
            textSnippet: 'متتالية حسابية أساسها $r$: $u_n = u_p + (n-p)r$ ومجموعها: $$S_n = \\dfrac{n - p + 1}{2}(u_p + u_n)$$ متتالية هندسية أساسها $q \\neq 1$: $u_n = u_p \\cdot q^{n-p}$ ومجموعها: $$S_n = u_p \\times \\dfrac{1 - q^{n-p+1}}{1 - q}$$',
            latexOnly: 'u_n = u_p \\cdot q^{n-p} \\quad ; \\quad S_n = u_p \\dfrac{1 - q^{n-p+1}}{1 - q}'
        },
        {
            id: 'complex_rot_hom',
            level: '2BAC',
            category: 'الأعداد العقدية',
            title: 'الكتابة العقدية للإزاحة والتحاكي والدوران',
            textSnippet: 'الكتابة العقدية للتحويلات الاعتيادية:\n- الإزاحة ذات المتجهة $\\vec{u}(b)$: $z\' = z + b$\n- التحاكي $h(\\Omega(\\omega), k)$: $z\' - \\omega = k(z - \\omega)$\n- الدوران $R(\\Omega(\\omega), \\theta)$: $$z\' - \\omega = e^{i\\theta}(z - \\omega)$$',
            latexOnly: 'R(\\Omega(\\omega), \\theta) : z\' - \\omega = e^{i\\theta}(z - \\omega)'
        },
        {
            id: 'space_sphere',
            level: '2BAC',
            category: 'الهندسة الفضائية',
            title: 'معادلة الفلكة والوضع النسبي مع مستوى',
            textSnippet: 'المعادلة الديكارتية للفلكة $(S)$ التي مركزها $\\Omega(a,b,c)$ وشعاعها $R$: $$(x - a)^2 + (y - b)^2 + (z - c)^2 = R^2$$ مسافة المركز عن المستوى $(P): ux+vy+wz+d=0$ هي: $$d\\big(\\Omega,(P)\\big) = \\dfrac{|ua+vb+wc+d|}{\\sqrt{u^2+v^2+w^2}}$$',
            latexOnly: '(S): (x - a)^2 + (y - b)^2 + (z - c)^2 = R^2'
        },
        {
            id: 'arith_bezout_gauss',
            level: '2BAC SM / 1BAC SM',
            category: 'الحسابيات في Z',
            title: 'مبرهنة بيزو (Bézout) ومبرهنة غوص (Gauss)',
            textSnippet: 'مبرهنة بيزو: $$a \\wedge b = 1 \\iff \\exists (u,v) \\in \\mathbb{Z}^2 \\;:\\; au + bv = 1$$ مبرهنة غوص: $$\\big( a \\mid bc \\;\\text{ و }\\; a \\wedge b = 1 \\big) \\implies a \\mid c$$',
            latexOnly: 'a \\wedge b = 1 \\iff \\exists (u,v) \\in \\mathbb{Z}^2,\\; au + bv = 1'
        },
        {
            id: 'quadratic_delta',
            level: 'TCS / 1BAC',
            category: 'الجبر والمعادلات',
            title: 'مميز ثلاثية الحدود من الدرجة الثانية والتعميل',
            textSnippet: 'نعتبر ثلاثية الحدود $P(x) = ax^2 + bx + c$ ($a \\neq 0$). المميز هو $\\Delta = b^2 - 4ac$. إذا كان $\\Delta > 0$ فإن للمعادلة حلين متمايزين: $$x_1 = \\dfrac{-b - \\sqrt{\\Delta}}{2a} \\quad ; \\quad x_2 = \\dfrac{-b + \\sqrt{\\Delta}}{2a}$$ والتعميل: $P(x) = a(x - x_1)(x - x_2)$.',
            latexOnly: '\\Delta = b^2 - 4ac \\; ; \\; x_{1,2} = \\dfrac{-b \\pm \\sqrt{\\Delta}}{2a}'
        }
    ];

    // ------------------------------------------------------------------------
    // 4. إنشاء وبناء نافذة محرر معادلات LaTeX لدفتر النصوص + حاسبة السحب والنسخ
    // ------------------------------------------------------------------------

    function ensureLatexModalExists() {
        let modal = document.getElementById('latexMathStudioModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'latexMathStudioModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.72); backdrop-filter:blur(4px); z-index:99999; align-items:center; justify-content:center; padding:14px; overflow-y:auto;';

        modal.innerHTML = `
            <div class="modal-card" style="background:#ffffff; width:100%; max-width:1080px; border-radius:16px; box-shadow:0 25px 50px -12px rgba(15,23,42,0.38); border:1px solid #e2e8f0; overflow:hidden; display:flex; flex-direction:column; max-height:93vh;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #1e293b 100%); color:#ffffff; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #4f46e5;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:42px; height:42px; border-radius:10px; background:rgba(255,255,255,0.14); display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:800; border:1px solid rgba(255,255,255,0.25);">
                            ∑
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:1.08rem; font-weight:800; color:#ffffff; letter-spacing:0.2px;">محرر معادلات وصيغ LaTeX المدمج لدفتر النصوص</h3>
                            <p style="margin:2px 0 0 0; font-size:0.77rem; color:#c7d2fe;">كتابة وإدراج الصيغ الرياضية والعلاقات والمبرهنات مباشرة في فقرات وملخص الحصة والواجب المنزلي (KaTeX)</p>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeLatexMathModal()" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.22); color:#ffffff; width:34px; height:34px; border-radius:8px; cursor:pointer; font-size:1.05rem; font-weight:700; display:flex; align-items:center; justify-content:center;">✕</button>
                </div>

                <!-- Navigation Tabs -->
                <div style="display:flex; gap:8px; padding:10px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" id="latexTabBtn_editor" onclick="window.switchLatexStudioTab('editor')" style="padding:8px 16px; border-radius:8px; border:1px solid #4f46e5; background:#4f46e5; color:#ffffff; font-weight:800; font-size:0.84rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <span>📐</span> محرر المعادلات وبنك صيغ دفتر النصوص (LaTeX)
                        </button>
                        <button type="button" id="latexTabBtn_reprography" onclick="window.switchLatexStudioTab('reprography')" style="padding:8px 16px; border-radius:8px; border:1px solid #cbd5e1; background:#ffffff; color:#334155; font-weight:700; font-size:0.84rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            <span>🖨️</span> حاسبة وأمر النسخ والطبع للوثائق الخارجية (Bon de Tirage)
                        </button>
                    </div>
                    <div id="latexActiveTargetBadge" style="font-size:0.75rem; font-weight:700; color:#4338ca; background:#eef2ff; border:1px solid #c7d2fe; padding:5px 10px; border-radius:6px;">
                        🎯 حقل الإدراج النشط: ملخص وأنشطة الحصة
                    </div>
                </div>

                <!-- Body Content -->
                <div style="padding:16px 20px; overflow-y:auto; flex:1; background:#ffffff;">
                    <!-- TAB 1: EQUATION EDITOR & LESSON LOG FORMULA BANK -->
                    <div id="latexStudioTab_editor" style="display:block;">
                        <!-- Symbol Category Buttons -->
                        <div style="margin-bottom:10px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
                                <label style="font-size:0.8rem; font-weight:800; color:#1e293b;">1. لوحة الرموز والبنيات الرياضية السريعة (انقر لإدراج الرمز عند موضع المؤشر):</label>
                                <span style="font-size:0.72rem; color:#64748b;">تدعم جميع رموز التحليل والجبر والهندسة والاحتمالات</span>
                            </div>
                            <div id="latexCategoryTabs" style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;"></div>
                            <div id="latexSymbolsPaletteGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(128px, 1fr)); gap:6px; background:#f8fafc; padding:10px; border-radius:10px; border:1px solid #e2e8f0; max-height:175px; overflow-y:auto;"></div>
                        </div>

                        <!-- Main LaTeX Input + Live Preview Side-by-Side -->
                        <div style="display:grid; grid-template-columns:1.1fr 0.9fr; gap:14px; margin-bottom:12px;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <label style="font-size:0.8rem; font-weight:800; color:#1e293b;">2. شيفرة المعادلة الرياضية (LaTeX):</label>
                                    <div style="display:flex; gap:6px;">
                                        <button type="button" onclick="window.copyLatexRawCode()" style="background:#eef2ff; border:1px solid #c7d2fe; color:#4338ca; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:700; cursor:pointer;">📋 نسخ الشيفرة</button>
                                        <button type="button" onclick="document.getElementById('latexRawInputArea').value=''; window.updateLiveLatexPreview();" style="background:#fef2f2; border:1px solid #fecaca; color:#dc2626; border-radius:6px; padding:2px 8px; font-size:0.72rem; font-weight:700; cursor:pointer;">مسح</button>
                                    </div>
                                </div>
                                <textarea id="latexRawInputArea" dir="ltr" rows="4" placeholder="\\forall x \\in ]0,+\\infty[, \\quad f'(x) = \\dfrac{1 - \\ln(x)}{x^2}" oninput="window.updateLiveLatexPreview()" style="width:100%; font-family:'JetBrains Mono',monospace; font-size:0.92rem; padding:10px; border-radius:10px; border:1.5px solid #cbd5e1; background:#0f172a; color:#f8fafc; resize:vertical; line-height:1.55;"></textarea>

                                <!-- Insertion Controls -->
                                <div style="margin-top:8px; background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:8px;">
                                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                        <label style="font-size:0.77rem; font-weight:800; color:#334155;">حقل دفتر النصوص المستهدف:</label>
                                        <select id="latexInsertTargetSelect" onchange="window.onLatexTargetSelectChange()" style="padding:5px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.78rem; font-weight:700; background:#ffffff; color:#0f172a; flex:1; min-width:200px;">
                                            <option value="lessonLogSummary">ملخص وأنشطة الحصة (دفتر النصوص)</option>
                                            <option value="lessonLogHomework">الواجب المنزلي / تمارين الدعم</option>
                                            <option value="lessonLogNotes">ملاحظات الحصة</option>
                                            <option value="_focused_paragraph" id="latexOptionFocusedParagraph">الفقرة الفرعية المحددة حالياً في هيكلة الدرس</option>
                                        </select>
                                    </div>
                                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <label style="font-size:0.76rem; font-weight:700; color:#475569; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                                <input type="radio" name="latexWrapMode" value="inline" checked onchange="window.updateLiveLatexPreview()"> مدمجة في السطر ($...$)
                                            </label>
                                            <label style="font-size:0.76rem; font-weight:700; color:#475569; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                                <input type="radio" name="latexWrapMode" value="block" onchange="window.updateLiveLatexPreview()"> معادلة مستقلة في الوسط ($$...$$)
                                            </label>
                                        </div>
                                        <button type="button" onclick="window.insertLatexIntoTargetField()" style="padding:7px 16px; border-radius:8px; border:none; background:linear-gradient(135deg,#4f46e5,#3730a3); color:#ffffff; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 2px 6px rgba(79,70,229,0.28);">
                                            ➕ إدراج المعادلة في دفتر النصوص
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Live KaTeX Preview Box -->
                            <div style="display:flex; flex-direction:column;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <label style="font-size:0.8rem; font-weight:800; color:#1e293b;">المعاينة الفورية عالية الدقة (KaTeX):</label>
                                    <span style="font-size:0.71rem; color:#16a34a; font-weight:700;">✓ مطابقة للطباعة الرسمية</span>
                                </div>
                                <div id="latexLivePreviewBox" dir="ltr" style="flex:1; min-height:145px; padding:16px; border-radius:10px; border:1.5px dashed #94a3b8; background:#f8fafc; display:flex; align-items:center; justify-content:center; overflow-x:auto; font-size:1.15rem; color:#0f172a;"></div>
                            </div>
                        </div>

                        <!-- Ready-made Lesson Log Formula & Theorem Bank -->
                        <div style="border-top:1px solid #e2e8f0; padding-top:12px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                                <div>
                                    <span style="font-size:0.82rem; font-weight:800; color:#1e293b;">📚 بنك الصيغ والعلاقات والمبرهنات الرسمية الجاهزة لدفتر النصوص:</span>
                                    <span style="font-size:0.73rem; color:#64748b; margin-right:6px;">(أدرج المعادلة وحدها أو النص التربوي كاملاً مع الصيغة الرياضية بنقرة واحدة)</span>
                                </div>
                                <input type="text" id="latexFormulaBankSearch" oninput="window.renderLessonLogFormulaBank()" placeholder="🔍 ابحث عن مبرهنة أو صيغة (مثال: القيم الوسيطية، التكامل، الفلكة...)" style="padding:5px 10px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.76rem; width:270px;">
                            </div>
                            <div id="lessonLogFormulaBankGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(310px, 1fr)); gap:8px; max-height:210px; overflow-y:auto; padding:4px;"></div>
                        </div>
                    </div>

                    <!-- TAB 2: REPROGRAPHY & BON DE TIRAGE CALCULATOR FOR EXTERNAL DOCUMENTS -->
                    <div id="latexStudioTab_reprography" style="display:none;">
                        <div style="background:linear-gradient(135deg,#f8fafc,#eef2ff); border:1px solid #c7d2fe; border-radius:12px; padding:14px 16px; margin-bottom:14px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                                <div>
                                    <h4 style="margin:0; font-size:0.94rem; font-weight:800; color:#1e1b4b;">🖨️ حاسبة استهلاك الورق وبطاقة أمر السحب والنسخ (Bon de Tirage)</h4>
                                    <p style="margin:2px 0 0 0; font-size:0.76rem; color:#475569;">مخصصة للفروض المحروسة وسلاسل التمارين والوثائق المنجزة في تطبيقك الخارجي قبل إرسالها لمصلحة النسخ والطبع بالمؤسسة</p>
                                </div>
                                <button type="button" onclick="window.printBonDeTirageSlip()" style="padding:8px 16px; border-radius:8px; border:none; background:#0f172a; color:#ffffff; font-weight:800; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
                                    🖨️ طباعة بطاقة أمر بالسحب (Bon de Tirage)
                                </button>
                            </div>

                            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(185px, 1fr)); gap:10px;">
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">عنوان الوثيقة أو الفرض (لأمر السحب):</label>
                                    <input type="text" id="reproDocTitleInput" value="فرض محروس رقم 1 - الدورة الأولى" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.8rem; font-weight:700; background:#ffffff;">
                                </div>
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">القسم المستهدف (أو مجموع الأقسام):</label>
                                    <select id="reproClassSelect" onchange="window.onReproClassChange()" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.8rem; font-weight:700; background:#ffffff;"></select>
                                </div>
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">عدد التلاميذ الفعلي:</label>
                                    <input type="number" id="reproStudentCount" min="1" max="500" value="36" oninput="window.recalculateReprographyStats()" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.84rem; font-weight:800; background:#ffffff;">
                                </div>
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">نسخ احتياطية وأرشيف الإدارة:</label>
                                    <input type="number" id="reproSpareCopies" min="0" max="50" value="2" oninput="window.recalculateReprographyStats()" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.84rem; font-weight:800; background:#ffffff;">
                                </div>
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">تخطيط الصفحة في ملفك الخارجي:</label>
                                    <select id="reproLayoutMode" onchange="window.recalculateReprographyStats()" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.78rem; font-weight:700; background:#ffffff;">
                                        <option value="2up" selected>ورقتان في صفحة A4 (نصف صفحة A5 - اقتصادي 50%)</option>
                                        <option value="1up">ورقة كاملة A4 لكل تلميذ (1 في الصفحة)</option>
                                        <option value="ab_2up">الموضوع A والموضوع B متجاوران في صفحة A4</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size:0.74rem; font-weight:700; color:#334155; display:block; margin-bottom:3px;">الوجهان (Recto / Verso):</label>
                                    <select id="reproDuplexMode" onchange="window.recalculateReprographyStats()" style="width:100%; padding:7px 9px; border-radius:7px; border:1px solid #cbd5e1; font-size:0.78rem; font-weight:700; background:#ffffff;">
                                        <option value="recto" selected>وجه واحد فقط (Recto)</option>
                                        <option value="duplex">وجه وظهر (Recto-Verso)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Reprography KPI Cards -->
                            <div id="reproStatsSummaryRow" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:10px; margin-top:14px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        renderCategoryButtons('basic');
        window.renderLessonLogFormulaBank();
        return modal;
    }

    function renderCategoryButtons(activeCatKey) {
        const tabsContainer = document.getElementById('latexCategoryTabs');
        const gridContainer = document.getElementById('latexSymbolsPaletteGrid');
        if (!tabsContainer || !gridContainer) return;

        tabsContainer.innerHTML = Object.entries(LATEX_SYMBOL_CATEGORIES).map(([key, cat]) => {
            const isActive = key === activeCatKey;
            return `<button type="button" onclick="window.selectLatexSymbolCategory('${key}')" style="padding:5px 11px; border-radius:7px; border:1px solid ${isActive ? '#4f46e5' : '#cbd5e1'}; background:${isActive ? '#eef2ff' : '#ffffff'}; color:${isActive ? '#3730a3' : '#334155'}; font-weight:${isActive ? '800' : '600'}; font-size:0.76rem; cursor:pointer; display:flex; align-items:center; gap:5px;">
                <span>${cat.icon}</span> ${cat.label}
            </button>`;
        }).join('');

        const activeCat = LATEX_SYMBOL_CATEGORIES[activeCatKey] || LATEX_SYMBOL_CATEGORIES.basic;
        gridContainer.innerHTML = activeCat.items.map((item, idx) => {
            const renderedPreview = window.renderLatexToHtml(item.preview, false);
            return `<button type="button" onclick="window.insertLatexSnippetAtCursor('${activeCatKey}', ${idx})" title="${escapeHtmlSafe(item.latex)}" style="padding:6px 8px; border-radius:8px; border:1px solid #e2e8f0; background:#ffffff; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-height:54px; transition:all 0.15s;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f5f3ff';" onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#ffffff';">
                <div dir="ltr" style="font-size:0.88rem; color:#0f172a; overflow:hidden; max-width:100%;">${renderedPreview}</div>
                <span style="font-size:0.67rem; color:#475569; font-weight:700;">${escapeHtmlSafe(item.label)}</span>
            </button>`;
        }).join('');
    }

    window.selectLatexSymbolCategory = function (catKey) {
        renderCategoryButtons(catKey);
    };

    window.insertLatexSnippetAtCursor = function (catKey, itemIdx) {
        const cat = LATEX_SYMBOL_CATEGORIES[catKey];
        if (!cat || !cat.items[itemIdx]) return;
        const snippet = cat.items[itemIdx].latex;
        const textarea = document.getElementById('latexRawInputArea');
        if (!textarea) return;

        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const val = textarea.value;
        textarea.value = val.substring(0, start) + snippet + val.substring(end);
        textarea.focus();
        const newPos = start + snippet.length;
        textarea.setSelectionRange(newPos, newPos);
        window.updateLiveLatexPreview();
    };

    window.updateLiveLatexPreview = function () {
        const textarea = document.getElementById('latexRawInputArea');
        const previewBox = document.getElementById('latexLivePreviewBox');
        if (!textarea || !previewBox) return;

        const raw = textarea.value.trim();
        if (!raw) {
            previewBox.innerHTML = `<span style="color:#94a3b8; font-size:0.82rem; font-family:'Cairo',sans-serif;">اكتب صيغة LaTeX أو اختر رمزاً/مبرهنة لمعاينتها فوراً...</span>`;
            return;
        }
        const wrapRadio = document.querySelector('input[name="latexWrapMode"]:checked');
        const isBlock = wrapRadio ? wrapRadio.value === 'block' : false;
        previewBox.innerHTML = window.renderLatexToHtml(raw, isBlock);
    };

    window.copyLatexRawCode = function () {
        const textarea = document.getElementById('latexRawInputArea');
        if (!textarea || !textarea.value.trim()) return;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textarea.value.trim());
        }
        if (typeof window.showToast === 'function') {
            window.showToast('تم نسخ شيفرة LaTeX إلى الحافظة', 'success');
        }
    };

    // ------------------------------------------------------------------------
    // 5. بنك الصيغ والعلاقات والمبرهنات لدفتر النصوص
    // ------------------------------------------------------------------------
    window.renderLessonLogFormulaBank = function () {
        const grid = document.getElementById('lessonLogFormulaBankGrid');
        if (!grid) return;
        const searchEl = document.getElementById('latexFormulaBankSearch');
        const query = (searchEl ? searchEl.value : '').trim().toLowerCase();

        const filtered = LESSON_LOG_FORMULA_BANK.filter(item => {
            if (!query) return true;
            return (
                item.title.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                item.level.toLowerCase().includes(query) ||
                item.textSnippet.toLowerCase().includes(query)
            );
        });

        grid.innerHTML = filtered.map(item => `
            <div style="border:1px solid #e2e8f0; border-radius:10px; padding:9px 11px; background:#f8fafc; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
                <div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; margin-bottom:4px;">
                        <span style="font-size:0.77rem; font-weight:800; color:#1e1b4b;">${escapeHtmlSafe(item.title)}</span>
                        <span style="font-size:0.66rem; font-weight:800; color:#4338ca; background:#e0e7ff; padding:1px 6px; border-radius:4px;">${escapeHtmlSafe(item.level)}</span>
                    </div>
                    <div style="font-size:0.75rem; color:#334155; line-height:1.6; background:#ffffff; padding:6px 8px; border-radius:6px; border:1px solid #e2e8f0;">
                        ${window.renderMathInText(item.textSnippet)}
                    </div>
                </div>
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button type="button" onclick="window.loadFormulaBankLatex('${item.id}')" style="padding:4px 9px; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff; color:#1e293b; font-size:0.71rem; font-weight:700; cursor:pointer;">
                        ✏️ تحميل المعادلة للمحرر
                    </button>
                    <button type="button" onclick="window.insertFormulaBankSnippetIntoLessonLog('${item.id}')" style="padding:4px 10px; border-radius:6px; border:none; background:#4f46e5; color:#ffffff; font-size:0.71rem; font-weight:800; cursor:pointer;">
                        ➕ إدراج النص والصيغة في الدفتر
                    </button>
                </div>
            </div>
        `).join('');
    };

    window.loadFormulaBankLatex = function (formulaId) {
        const item = LESSON_LOG_FORMULA_BANK.find(f => f.id === formulaId);
        if (!item) return;
        const textarea = document.getElementById('latexRawInputArea');
        if (textarea) {
            textarea.value = item.latexOnly;
            window.updateLiveLatexPreview();
        }
    };

    window.insertFormulaBankSnippetIntoLessonLog = function (formulaId) {
        const item = LESSON_LOG_FORMULA_BANK.find(f => f.id === formulaId);
        if (!item) return;
        insertTextIntoActiveLessonLogTarget(item.textSnippet, true);
    };

    // ------------------------------------------------------------------------
    // 6. إدراج الصيغ في حقول دفتر النصوص (الملخص، الواجب، أو الفقرات الفرعية)
    // ------------------------------------------------------------------------
    function resolveTargetTextareaElement() {
        const targetSelect = document.getElementById('latexInsertTargetSelect');
        const targetVal = targetSelect ? targetSelect.value : 'lessonLogSummary';

        if (targetVal === '_focused_paragraph' && window._lastFocusedLessonLogTextarea) {
            return window._lastFocusedLessonLogTextarea;
        }
        return document.getElementById(targetVal) || document.getElementById('lessonLogSummary');
    }

    window.onLatexTargetSelectChange = function () {
        const targetEl = resolveTargetTextareaElement();
        const badge = document.getElementById('latexActiveTargetBadge');
        if (!badge || !targetEl) return;

        let label = 'ملخص وأنشطة الحصة';
        if (targetEl.id === 'lessonLogHomework') label = 'الواجب المنزلي / تمارين الدعم';
        else if (targetEl.id === 'lessonLogNotes') label = 'ملاحظات الحصة';
        else if (targetEl.classList.contains('paragraph-content-textarea')) {
            const card = targetEl.closest('.axis-paragraph-card');
            const numInput = card ? card.querySelector('.paragraph-number-input') : null;
            const titleInput = card ? card.querySelector('.paragraph-title-input') : null;
            const numText = numInput && numInput.value ? numInput.value : '';
            const titleText = titleInput && titleInput.value ? titleInput.value : 'فقرة الدرس';
            label = `فقرة الدرس ${numText} (${titleText})`;
        }
        badge.textContent = `🎯 حقل الإدراج النشط: ${label}`;
    };

    function insertTextIntoActiveLessonLogTarget(formattedText, closeAfterInsert = true) {
        const targetEl = resolveTargetTextareaElement();
        if (!targetEl) {
            if (typeof window.showToast === 'function') {
                window.showToast('تعذر العثور على حقل دفتر النصوص المستهدف', 'warning');
            }
            return;
        }

        const start = typeof targetEl.selectionStart === 'number' ? targetEl.selectionStart : targetEl.value.length;
        const end = typeof targetEl.selectionEnd === 'number' ? targetEl.selectionEnd : targetEl.value.length;
        const currentVal = targetEl.value || '';
        const prefix = (start > 0 && !currentVal.substring(0, start).endsWith(' ') && !currentVal.substring(0, start).endsWith('\n')) ? ' ' : '';
        targetEl.value = currentVal.substring(0, start) + prefix + formattedText + ' ' + currentVal.substring(end);
        targetEl.dispatchEvent(new Event('input', { bubbles: true }));

        if (typeof window.updateLessonLogLiveMathPreview === 'function') {
            window.updateLessonLogLiveMathPreview();
        }

        if (typeof window.showToast === 'function') {
            window.showToast('تم إدراج الصيغة الرياضية في دفتر النصوص بنجاح', 'success');
        }
        if (closeAfterInsert) {
            window.closeLatexMathModal();
            setTimeout(() => targetEl.focus(), 80);
        }
    }

    window.insertLatexIntoTargetField = function () {
        const rawArea = document.getElementById('latexRawInputArea');
        if (!rawArea || !rawArea.value.trim()) {
            if (typeof window.showToast === 'function') {
                window.showToast('يرجى كتابة أو اختيار صيغة رياضية أولاً', 'warning');
            }
            return;
        }

        const wrapRadio = document.querySelector('input[name="latexWrapMode"]:checked');
        const isBlock = wrapRadio ? wrapRadio.value === 'block' : false;
        const rawLatex = rawArea.value.trim();
        const formatted = isBlock ? `\n$$${rawLatex}$$\n` : `$${rawLatex}$`;

        insertTextIntoActiveLessonLogTarget(formatted, true);
    };

    /**
     * فتح محرر LaTeX مباشرة لحقل محدد (مثل فقرة فرعية داخل هيكلة الدرس)
     */
    window.openLatexMathModalForElement = function (textareaEl) {
        if (textareaEl && (textareaEl.tagName === 'TEXTAREA' || textareaEl.tagName === 'INPUT')) {
            window._lastFocusedLessonLogTextarea = textareaEl;
        }
        window.openLatexMathModal('editor', textareaEl);
    };

    // ------------------------------------------------------------------------
    // 7. حاسبة النسخ والسحب وبطاقة (Bon de Tirage) للوثائق والفروض الخارجية
    // ------------------------------------------------------------------------

    function populateReproClassesDropdown() {
        const select = document.getElementById('reproClassSelect');
        if (!select) return;

        const classesMap = (window.db && window.db.classes) ? window.db.classes : {};
        const classNames = Object.keys(classesMap);

        let optionsHtml = '';
        let totalAllClasses = 0;

        classNames.forEach(cName => {
            const arr = Array.isArray(classesMap[cName]) ? classesMap[cName] : [];
            totalAllClasses += arr.length;
            optionsHtml += `<option value="${escapeHtmlSafe(cName)}" data-count="${arr.length}">قسم ${escapeHtmlSafe(cName)} (${arr.length} تلميذاً)</option>`;
        });

        if (classNames.length > 1) {
            optionsHtml += `<option value="__ALL__" data-count="${totalAllClasses}">جميع الأقسام المسندة (${totalAllClasses} تلميذاً)</option>`;
        }
        if (!optionsHtml) {
            optionsHtml = `<option value="default" data-count="36">قسم افتراضي (36 تلميذاً)</option>`;
        }

        select.innerHTML = optionsHtml;
        window.onReproClassChange();
    }

    window.onReproClassChange = function () {
        const select = document.getElementById('reproClassSelect');
        const countInput = document.getElementById('reproStudentCount');
        if (!select || !countInput) return;

        const selectedOpt = select.options[select.selectedIndex];
        const count = selectedOpt ? parseInt(selectedOpt.getAttribute('data-count') || '36', 10) : 36;
        if (count > 0) {
            countInput.value = count;
        }
        window.recalculateReprographyStats();
    };

    window.recalculateReprographyStats = function () {
        const stdCount = Math.max(1, parseInt((document.getElementById('reproStudentCount') || {}).value || '36', 10));
        const spareCount = Math.max(0, parseInt((document.getElementById('reproSpareCopies') || {}).value || '2', 10));
        const layoutMode = (document.getElementById('reproLayoutMode') || {}).value || '2up';
        const duplexMode = (document.getElementById('reproDuplexMode') || {}).value || 'recto';

        const totalCopiesNeeded = stdCount + spareCount;
        const isTwoPerSheet = (layoutMode === '2up' || layoutMode === 'ab_2up');
        const sheetsRequired = isTwoPerSheet ? Math.ceil(totalCopiesNeeded / 2) : totalCopiesNeeded;
        const facesPerSheet = duplexMode === 'duplex' ? 2 : 1;
        const totalPassages = sheetsRequired * facesPerSheet;
        const sheetsSaved = isTwoPerSheet ? (totalCopiesNeeded - sheetsRequired) : 0;

        const row = document.getElementById('reproStatsSummaryRow');
        if (!row) return;

        row.innerHTML = `
            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:10px 12px;">
                <div style="font-size:0.72rem; color:#64748b; font-weight:700;">إجمالي أوراق التلاميذ + الاحتياط</div>
                <div style="font-size:1.25rem; font-weight:900; color:#0f172a; margin-top:2px;">${totalCopiesNeeded} <span style="font-size:0.75rem; font-weight:600; color:#475569;">نسخة (${stdCount} + ${spareCount})</span></div>
            </div>
            <div style="background:#eef2ff; border:1.5px solid #6366f1; border-radius:10px; padding:10px 12px;">
                <div style="font-size:0.72rem; color:#3730a3; font-weight:800;">عدد أوراق A4 المطلوب سحبها فعلياً</div>
                <div style="font-size:1.3rem; font-weight:900; color:#1e1b4b; margin-top:2px;">${sheetsRequired} <span style="font-size:0.76rem; font-weight:700; color:#4338ca;">ورقة A4</span></div>
            </div>
            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:10px 12px;">
                <div style="font-size:0.72rem; color:#64748b; font-weight:700;">مجموع الأوجه المطبوعة (Passages)</div>
                <div style="font-size:1.25rem; font-weight:900; color:#0f172a; margin-top:2px;">${totalPassages} <span style="font-size:0.75rem; font-weight:600; color:#475569;">وجه مطبوع</span></div>
            </div>
            <div style="background:${sheetsSaved > 0 ? '#f0fdf4' : '#f8fafc'}; border:1px solid ${sheetsSaved > 0 ? '#86efac' : '#cbd5e1'}; border-radius:10px; padding:10px 12px;">
                <div style="font-size:0.72rem; color:${sheetsSaved > 0 ? '#166534' : '#64748b'}; font-weight:700;">الوفر البيئي والمالي في الورق</div>
                <div style="font-size:1.25rem; font-weight:900; color:${sheetsSaved > 0 ? '#15803d' : '#475569'}; margin-top:2px;">
                    ${sheetsSaved > 0 ? `توفير ${sheetsSaved} ورقة A4 (50%)` : 'بدون اقتصاد (1 في A4)'}
                </div>
            </div>
        `;
    };

    window.printBonDeTirageSlip = function () {
        const info = (window.db && window.db.info) ? window.db.info : {};
        const select = document.getElementById('reproClassSelect');
        const classLabel = (select && select.options[select.selectedIndex]) ? select.options[select.selectedIndex].text : 'القسم المستهدف';
        const stdCount = Math.max(1, parseInt((document.getElementById('reproStudentCount') || {}).value || '36', 10));
        const spareCount = Math.max(0, parseInt((document.getElementById('reproSpareCopies') || {}).value || '2', 10));
        const layoutMode = (document.getElementById('reproLayoutMode') || {}).value || '2up';
        const duplexMode = (document.getElementById('reproDuplexMode') || {}).value || 'recto';
        const docTitle = ((document.getElementById('reproDocTitleInput') || {}).value || 'فرض محروس / وثيقة تربوية').trim();

        const totalCopies = stdCount + spareCount;
        const isTwoPerSheet = (layoutMode === '2up' || layoutMode === 'ab_2up');
        const sheetsRequired = isTwoPerSheet ? Math.ceil(totalCopies / 2) : totalCopies;
        const layoutText = layoutMode === '2up'
            ? 'نصف صفحة A5 (نسختان في ورقة A4 واحدة مع القص)'
            : (layoutMode === 'ab_2up' ? 'الموضوع A والموضوع B متجاوران في ورقة A4' : 'صفحة كاملة A4 لكل تلميذ');
        const duplexText = duplexMode === 'duplex' ? 'وجه وظهر (Recto-Verso)' : 'وجه واحد (Recto)';
        const todayStr = new Date().toLocaleDateString('fr-MA');

        const htmlContent = `
            <div dir="rtl" style="font-family:'Cairo','Tajawal',sans-serif; padding:10mm; color:#0f172a;">
                <div style="border:2px solid #0f172a; border-radius:10px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:14px;">
                        <div style="font-size:0.85rem; font-weight:700; line-height:1.5;">
                            <div>الأكاديمية الجهوية للتربية والتكوين: ${escapeHtmlSafe(info.academy || '....................')}</div>
                            <div>المديرية الإقليمية: ${escapeHtmlSafe(info.province || '....................')}</div>
                            <div>المؤسسة التعليمية: ${escapeHtmlSafe(info.school || '....................')}</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:1.2rem; font-weight:900; background:#0f172a; color:#ffffff; padding:6px 18px; border-radius:6px;">بطاقة أمر بالنسخ والسحب (Bon de Tirage)</div>
                            <div style="font-size:0.8rem; font-weight:700; margin-top:4px;">مصلحة النسخ والطبع والتوثيق التربوي</div>
                        </div>
                        <div style="font-size:0.85rem; font-weight:700; text-align:left; line-height:1.5;">
                            <div>السنة الدراسية: ${escapeHtmlSafe(info.year || '2024/2025')}</div>
                            <div>تاريخ الإيداع: ${todayStr}</div>
                            <div>المادة: الرياضيات</div>
                        </div>
                    </div>

                    <table style="width:100%; border-collapse:collapse; font-size:0.92rem; margin-bottom:16px;">
                        <tbody>
                            <tr>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9; width:28%;">اسم الأستاذ(ة) طالب السحب:</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:700;">${escapeHtmlSafe(info.teacher || 'إبراهيم قزيبر')}</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9; width:22%;">طبيعة الوثيقة:</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:700;">${escapeHtmlSafe(docTitle)}</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9;">القسم / الفئة المستهدفة:</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:700;">${escapeHtmlSafe(classLabel)}</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9;">عدد التلاميذ + الاحتياط:</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800;">${stdCount} تلميذاً + ${spareCount} احتياط = ${totalCopies} نسخة</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9;">نمط الإخراج والتخطيط:</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:700;">${layoutText}</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:800; background:#f1f5f9;">الطباعة (وجه / ظهر):</td>
                                <td style="border:1px solid #0f172a; padding:8px 12px; font-weight:700;">${duplexText}</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #0f172a; padding:10px 12px; font-weight:900; background:#e2e8f0;" colspan="2">إجمالي عدد أوراق A4 المطلوب سحبها من آلة النسخ:</td>
                                <td style="border:1px solid #0f172a; padding:10px 12px; font-weight:900; font-size:1.15rem; background:#e2e8f0;" colspan="2">${sheetsRequired} ورقة A4 صافية</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; text-align:center; font-size:0.88rem; font-weight:800; margin-top:18px;">
                        <div style="border:1px dashed #475569; border-radius:8px; padding:10px; min-height:75px;">توقيع الأستاذ(ة)</div>
                        <div style="border:1px dashed #475569; border-radius:8px; padding:10px; min-height:75px;">تأشيرة الحراسة العامة / الإدارة التربوية</div>
                        <div style="border:1px dashed #475569; border-radius:8px; padding:10px; min-height:75px;">إشهاد المكلف بمصلحة النسخ والطبع</div>
                    </div>
                </div>
            </div>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(htmlContent, {
                title: 'بطاقة أمر بالنسخ والسحب - Bon de Tirage',
                orientation: 'portrait',
                pageSize: 'A4'
            });
        }
    };

    // ------------------------------------------------------------------------
    // 8. التحكم في فتح وإغلاق والتنقل بين تبويبات النافذة
    // ------------------------------------------------------------------------
    window.switchLatexStudioTab = function (tabKey) {
        const tabs = ['editor', 'reprography'];
        tabs.forEach(k => {
            const contentEl = document.getElementById(`latexStudioTab_${k}`);
            const btnEl = document.getElementById(`latexTabBtn_${k}`);
            if (contentEl) contentEl.style.display = (k === tabKey) ? 'block' : 'none';
            if (btnEl) {
                if (k === tabKey) {
                    btnEl.style.background = '#4f46e5';
                    btnEl.style.color = '#ffffff';
                    btnEl.style.borderColor = '#4f46e5';
                } else {
                    btnEl.style.background = '#ffffff';
                    btnEl.style.color = '#334155';
                    btnEl.style.borderColor = '#cbd5e1';
                }
            }
        });

        if (tabKey === 'reprography') {
            populateReproClassesDropdown();
        }
    };

    window.openLatexMathModal = function (defaultTab, targetTextareaEl) {
        ensureLatexModalExists();
        const modal = document.getElementById('latexMathStudioModal');
        if (!modal) return;
        modal.style.display = 'flex';

        let resolvedTab = defaultTab || 'editor';
        const targetSelect = document.getElementById('latexInsertTargetSelect');

        if (defaultTab === 'summary' || defaultTab === 'homework' || defaultTab === 'notes') {
            resolvedTab = 'editor';
            const mappedId = defaultTab === 'summary' ? 'lessonLogSummary' : (defaultTab === 'homework' ? 'lessonLogHomework' : 'lessonLogNotes');
            const mappedEl = document.getElementById(mappedId);
            if (mappedEl) window._lastFocusedLessonLogTextarea = mappedEl;
            if (targetSelect) targetSelect.value = mappedId;
        } else if (targetTextareaEl && (targetTextareaEl.tagName === 'TEXTAREA' || targetTextareaEl.tagName === 'INPUT')) {
            window._lastFocusedLessonLogTextarea = targetTextareaEl;
            if (targetSelect) {
                if (targetTextareaEl.id === 'lessonLogSummary' || targetTextareaEl.id === 'lessonLogHomework' || targetTextareaEl.id === 'lessonLogNotes') {
                    targetSelect.value = targetTextareaEl.id;
                } else {
                    targetSelect.value = '_focused_paragraph';
                }
            }
        } else if (window._lastFocusedLessonLogTextarea && targetSelect) {
            const lastEl = window._lastFocusedLessonLogTextarea;
            if (lastEl.id === 'lessonLogSummary' || lastEl.id === 'lessonLogHomework' || lastEl.id === 'lessonLogNotes') {
                targetSelect.value = lastEl.id;
            } else if (lastEl.classList.contains('paragraph-content-textarea') && document.body.contains(lastEl)) {
                targetSelect.value = '_focused_paragraph';
            }
        }

        window.onLatexTargetSelectChange();
        window.switchLatexStudioTab(resolvedTab === 'reprography' ? 'reprography' : 'editor');

        const rawArea = document.getElementById('latexRawInputArea');
        if (rawArea && !rawArea.value.trim()) {
            rawArea.value = '\\forall x \\in ]0,+\\infty[, \\quad f\'(x) = \\dfrac{1 - \\ln(x)}{x^2}';
        }
        window.updateLiveLatexPreview();
    };

    window.closeLatexMathModal = function () {
        const modal = document.getElementById('latexMathStudioModal');
        if (modal) modal.style.display = 'none';
    };
})();
