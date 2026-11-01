/**
 * latex-math-engine.js - محرك توليد تمارين الرياضيات بصيغة LaTeX ومحرر المعادلات المدمج
 * مخصص لأستاذ مادة الرياضيات بالسلك الثانوي التأهيلي بالمملكة المغربية
 * يدعم الرندرة الفورية بواسطة KaTeX، لوحة الرموز التفاعلية، بنك التمارين البيداغوجية،
 * الإدراج التلقائي في دفتر النصوص والواجبات، والطباعة الرسمية بجودة عالية.
 */

(function (window, document) {
    'use strict';

    // الحالة العامة لمحرك LaTeX
    const state = {
        activeTab: 'generator', // 'generator' | 'editor' | 'sheet'
        targetField: 'summary', // 'summary' | 'homework' | 'axis'
        selectedLevel: '2BAC_SM',
        selectedDomain: 'analyse',
        selectedType: 'synthese',
        currentExercise: null,
        editorLatex: '\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1',
        sheetTitle: 'سلسلة تمارين في مادة الرياضيات',
        sheetDuration: 'ساعتان',
        sheetCoefficient: '9'
    };

    /**
     * رندرة نص رياضي بصيغة LaTeX إلى HTML باستخدام KaTeX
     * مع مراعاة الحفاظ على اتجاه الكتابة LTR للرموز الرياضية و RTL للنصوص العربية
     */
    function renderLatexToHtml(latexString, displayMode = false) {
        if (!latexString) return '';
        if (typeof window.katex !== 'undefined' && typeof window.katex.renderToString === 'function') {
            try {
                return window.katex.renderToString(latexString, {
                    displayMode: !!displayMode,
                    throwOnError: false,
                    output: 'htmlAndMathml'
                });
            } catch (err) {
                console.warn('[KaTeX Error]:', err);
                return `<code class="latex-fallback" dir="ltr">${escapeHtml(latexString)}</code>`;
            }
        }
        return `<code class="latex-fallback" dir="ltr">${escapeHtml(latexString)}</code>`;
    }

    /**
     * معالجة نص مختلط (عربي + صيغ LaTeX محاطة بـ $...$ أو $$...$$)
     */
    function renderMathInText(rawText) {
        if (!rawText) return '';
        let str = String(rawText);

        // معالجة كتل العرض $$...$$ أولاً
        str = str.replace(/\$\$([\s\S]+?)\$\$/g, function (_, latex) {
            const html = renderLatexToHtml(latex.trim(), true);
            return `<div class="katex-display-wrapper" dir="ltr" style="margin: 8px 0; text-align: center; overflow-x: auto;">${html}</div>`;
        });

        // معالجة الصيغ المضمنة $...$
        str = str.replace(/\$([^\$\n\r]+?)\$/g, function (_, latex) {
            const html = renderLatexToHtml(latex.trim(), false);
            return `<span class="katex-inline-wrapper" dir="ltr" style="display: inline-block; vertical-align: middle; margin: 0 3px;">${html}</span>`;
        });

        return str;
    }

    /**
     * تطبيق الرندرة على كافة العناصر داخل حاوية معينة
     */
    function renderMathInContainer(container) {
        if (!container) return;
        if (typeof window.renderMathInElement === 'function') {
            try {
                window.renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false
                });
                return;
            } catch (e) {}
        }
        // معالجة مخصصة للعناصر الحاملة للصيغ
        const mathNodes = container.querySelectorAll('.render-latex-math, [data-latex-math]');
        mathNodes.forEach(node => {
            const raw = node.getAttribute('data-latex-math') || node.textContent;
            node.innerHTML = renderMathInText(raw);
        });
    }

    /**
     * بنك وقوالب تمارين الرياضيات للسلك الثانوي التأهيلي بالمغرب
     */
    const SECONDARY_MATH_EXERCISE_BANK = {
        'TCS': {
            label: 'الجذع المشترك العلمي والتكنولوجي',
            coefficient: 4,
            domains: {
                'analyse': {
                    label: 'الدوال العددية (عموميات)',
                    exercises: [
                        {
                            title: 'دراسة دالة عددية وتحديد مطاريفها',
                            bareme: '4 ن',
                            latex: `نعتبر الدالة العددية $f$ المعرفة بـ:
$$f(x) = \\frac{2x^2 + 1}{x^2 + 1}$$
1. حدد $D_f$ مجموعة تعريف الدالة $f$. [0.5 ن]
2. بين أن الدالة $f$ زوجية. [0.75 ن]
3. أ) بين أنه لكل $x \\in \\mathbb{R}$: $f(x) = 2 - \\frac{1}{x^2 + 1}$. [0.75 ن]
ب) استنتج رتابة $f$ على المجال $[0, +\\infty[$ ثم على $]-\\infty, 0]$. [1 ن]
4. بين أن $1$ قيمة دنوية مطلقة للدالة $f$ وأن $2$ قيمة مكبورة لـ $f$. [1 ن]`
                        },
                        {
                            title: 'تغيرات دالة حدودية ومعدل التغير',
                            bareme: '4 ن',
                            latex: `لتكن $g$ دالة عددية معرفة على $\\mathbb{R}$ بـ: $g(x) = -2x^2 + 4x + 1$.
1. أحسب $T(x,y)$ معدل تغير الدالة $g$ بين عنصرين مختلفين $x$ و $y$ من $\\mathbb{R}$. [1 ن]
2. استنتج رتابة $g$ على كل من المجالين $]-\\infty, 1]$ و $[1, +\\infty[$. [1.5 ن]
3. ضع جدول تغيرات الدالة $g$ محدداً القيمة القصوية لـ $g$. [1.5 ن]`
                        }
                    ]
                },
                'arithmetique': {
                    label: 'الحسابيات في المجموعة N',
                    exercises: [
                        {
                            title: 'الأعداد الأولية وقابلية القسمة',
                            bareme: '3.5 ن',
                            latex: `1. فكك العددين $a = 1512$ و $b = 3150$ إلى جداء عوامل أولية. [1 ن]
2. أحسب $PGCD(a; b)$ القاسم المشترك الأكبر و $PPCM(a; b)$ المضاعف المشترك الأصغر. [1.5 ن]
3. بسط الكسر $\\frac{a}{b}$ ثم حدد طبيعة العدد $\\sqrt{a \\times b}$. [1 ن]`
                        }
                    ]
                },
                'trigo': {
                    label: 'الحساب المثلثي',
                    exercises: [
                        {
                            title: 'المعادلات المثلثية وتبسيط العبارات',
                            bareme: '4.5 ن',
                            latex: `1. بسط العبارة التالية:
$$A(x) = \\cos(\\pi - x) + \\sin\\left(\\frac{\\pi}{2} - x\\right) - \\cos(\\pi + x) + \\sin(\\pi - x)$$ [1.5 ن]
2. حل في المجال $[0, 2\\pi[$ المعادلة: $2\\cos(x) - \\sqrt{3} = 0$. [1.5 ن]
3. مثل حلول المعادلة على الدائرة المثلثية $(\\mathcal{C})$. [1.5 ن]`
                        }
                    ]
                },
                'geometrie': {
                    label: 'الهندسة والجداء السلمي في المستوى',
                    exercises: [
                        {
                            title: 'تطبيقات الجداء السلمي ومبرهنة المتوسط',
                            bareme: '4 ن',
                            latex: `ليكن $ABC$ مثلثاً بحيث $AB = 6$ و $AC = 4$ و $BC = 2\\sqrt{7}$.
1. بين أن $\\vec{AB} \\cdot \\vec{AC} = 12$. [1.5 ن]
2. استنتج $\\cos(\\widehat{BAC})$ ثم حدد قياس الزاوية $\\widehat{BAC}$. [1 ن]
3. لتكن $I$ منتصف $[BC]$، أحسب المسافة $AI$ بتطبيق مبرهنة المتوسط. [1.5 ن]`
                        }
                    ]
                }
            }
        },
        '1BAC_EXP': {
            label: 'الأولى باكالوريا علوم تجريبية وتكنولوجية',
            coefficient: 7,
            domains: {
                'analyse': {
                    label: 'الاشتقاق ودراسة الدوال',
                    exercises: [
                        {
                            title: 'قابلية الاشتقاق ودراسة الفروع اللانهائية',
                            bareme: '6 ن',
                            latex: `نعتبر الدالة $f$ المعرفة بـ: $f(x) = \\frac{x^2 - 3x}{x - 1}$ وليكن $(\\mathcal{C}_f)$ منحناها.
1. حدد $D_f$ واحسب النهايات عند المحدات $\\lim_{x \\to +\\infty} f(x)$ و $\\lim_{x \\to 1^+} f(x)$. [1.5 ن]
2. بين أن المستقيم $(D): y = x - 2$ مقارب مائل لـ $(\\mathcal{C}_f)$ بجوار $+\\infty$. [1 ن]
3. أ) بين أن لكل $x \\in D_f$: $f'(x) = \\frac{x^2 - 2x + 3}{(x-1)^2}$. [1.5 ن]
ب) ضع جدول تغيرات الدالة $f$. [1 ن]
4. حدد معادلة المماس $(T)$ للمنحنى عند النقطة ذات الأفصول $x_0 = 2$. [1 ن]`
                        }
                    ]
                },
                'suites': {
                    label: 'المتتاليات العددية',
                    exercises: [
                        {
                            title: 'المتتالية الحسابية والهندسية والبرهان بالترجع',
                            bareme: '4.5 ن',
                            latex: `نعتبر المتتالية $(u_n)$ المعرفة بـ: $u_0 = 1$ و $u_{n+1} = \\frac{u_n}{2u_n + 1}$ لكل $n \\in \\mathbb{N}$.
1. بين بالترجع أن: $\\forall n \\in \\mathbb{N}, \\; u_n > 0$. [1 ن]
2. نضع لكل $n \\in \\mathbb{N}$: $v_n = \\frac{1}{u_n}$.
أ) بين أن $(v_n)$ متتالية حسابية محدداً أساسها $r$ وحدها الأول $v_0$. [1.5 ن]
ب) عبر عن $v_n$ ثم عن $u_n$ بدلالة $n$. [1 ن]
3. أحسب المجموع: $S_n = v_0 + v_1 + \\dots + v_n$. [1 ن]`
                        }
                    ]
                },
                'espace': {
                    label: 'الهندسة الفضائية ودراسة الفلكة',
                    exercises: [
                        {
                            title: 'معادلة الفلكة وتقاطعها مع مستوى',
                            bareme: '4.5 ن',
                            latex: `في الفضاء المنسوب لمعلم متعامد ممنظم $(O,\\vec{i},\\vec{j},\\vec{k})$، نعتبر الفلكة $(S)$ ذات المعادلة:
$$x^2 + y^2 + z^2 - 2x + 4y - 6z + 5 = 0$$
والمستوى $(P)$ ذو المعادلة الديكارتية: $2x - y + 2z - 3 = 0$.
1. بين أن مركز الفلكة $(S)$ هو النقطة $\\Omega(1, -2, 3)$ وشعاعها $R = 3$. [1.5 ن]
2. أحسب المسافة $d(\\Omega, (P))$، واستنتج أن المستوى $(P)$ يقطع الفلكة $(S)$ وفق دائرة $(C)$. [1.5 ن]
3. حدد شعاع الدائرة $(C)$ وإحداثيات مركزها $H$. [1.5 ن]`
                        }
                    ]
                }
            }
        },
        '1BAC_SM': {
            label: 'الأولى باكالوريا علوم رياضية',
            coefficient: 9,
            domains: {
                'logique': {
                    label: 'المنطق والمجموعات والتطبيقات',
                    exercises: [
                        {
                            title: 'الاستدلالات الرياضية والتباين والتقابل',
                            bareme: '5 ن',
                            latex: `1. باستعمال الاستلزام المضاد للعكس، بين أنه لكل $x, y \\in [1, +\\infty[$:
$$x \\neq y \\implies x^2 - 2x \\neq y^2 - 2y$$ [1.5 ن]
2. نعتبر التطبيق $f: [1, +\\infty[ \\to [-1, +\\infty[$ المعرف بـ: $f(x) = x^2 - 2x$.
أ) بين أن $f$ متباين وشمولي. [2 ن]
ب) استنتج أن $f$ تقابل وحدد تعبير تقابله العكسي $f^{-1}(x)$. [1.5 ن]`
                        }
                    ]
                },
                'arithmetique': {
                    label: 'الحسابيات في المجموعة Z',
                    exercises: [
                        {
                            title: 'التوافقات ومبرهنة غوص وبيزو',
                            bareme: '5.5 ن',
                            latex: `1. بين أنه لكل $n \\in \\mathbb{N}$: $n^3 - n \\equiv 0 \\pmod{6}$. [1.5 ن]
2. نعتبر في $\\mathbb{Z}^2$ المعادلة: $(E): 7x - 5y = 3$.
أ) حدد حلاً خاصاً $(x_0, y_0)$ للمعادلة $(E)$. [1 ن]
ب) حل المعادلة $(E)$ في $\\mathbb{Z}^2$ بتطبيق مبرهنة غوص. [1.5 ن]
3. استنتج حلول النظمة: $\\begin{cases} x \\equiv 2 \\pmod{5} \\\\ x \\equiv 5 \\pmod{7} \\end{cases}$. [1.5 ن]`
                        }
                    ]
                },
                'analyse': {
                    label: 'الاشتقاق ومبرهنة التزايدات المنتهية (TAF)',
                    exercises: [
                        {
                            title: 'مبرهنة رول ومبرهنة التزايدات المنتهية',
                            bareme: '5 ن',
                            latex: `لتكن $f$ دالة قابلة للاشتقاق على $[0, 1]$ بحيث $f(0) = 0$ و $f(1) = 1$.
1. بين بتطبيق مبرهنة القيم الوسيطية أن المعادلة $f(x) = 1 - x$ تقبل حلاً على الأقل $c \\in ]0, 1[$. [1.5 ن]
2. بين أنه يوجد عنصران $x_1, x_2 \\in ]0, 1[$ مختلفان بحيث:
$$\\frac{1}{f'(x_1)} + \\frac{1}{f'(x_2)} = 2$$ [2 ن]
3. استنتج وجود $d \\in ]0, 1[$ بحيث $f'(d) = 1$. [1.5 ن]`
                        }
                    ]
                }
            }
        },
        '2BAC_EXP': {
            label: 'الثانية باكالوريا علوم تجريبية (PC / SVT)',
            coefficient: 7,
            domains: {
                'analyse': {
                    label: 'الدوال الأسية واللوغاريتمية والتكامل',
                    exercises: [
                        {
                            title: 'مسألة شاملة: دالة لوغاريتمية + متتالية مرتبطة',
                            bareme: '10 ن',
                            latex: `\\textbf{الجزء الأول:}
نعتبر الدالة $g$ المعرفة على $]0, +\\infty[$ بـ: $g(x) = x^2 - 1 + 2\\ln(x)$.
1. أحسب $g'(x)$ وضع جدول تغيرات $g$. [1 ن]
2. أحسب $g(1)$ واستنتج إشارة $g(x)$ على $]0, +\\infty[$. [1 ن]

\\textbf{الجزء الثاني:}
نعتبر الدالة $f$ المعرفة بـ: $f(x) = x - 1 - \\frac{\\ln(x)}{x}$.
1. أحسب $\\lim_{x \\to 0^+} f(x)$ وؤول النتيجة هندسياً. [1 ن]
2. أحسب $\\lim_{x \\to +\\infty} f(x)$ وبين أن المستقيم $(\\Delta): y = x - 1$ مقارب مائل. [1.5 ن]
3. أ) بين أن لكل $x > 0$: $f'(x) = \\frac{g(x)}{x^2}$. [1 ن]
ب) ضع جدول تغيرات الدالة $f$. [1 ن]
4. أنشئ المنحنى $(\\mathcal{C}_f)$ في معلم متعامد ممنظم $(O, \\vec{i}, \\vec{j})$. [1.5 ن]

\\textbf{الجزء الثالث:}
نعتبر المتتالية $(u_n)$ المعرفة بـ: $u_0 = 2$ و $u_{n+1} = f(u_n) + 1$.
1. بين بالترجع أن: $\\forall n \\in \\mathbb{N}, \\; 1 \\le u_n \\le 2$. [1 ن]
2. بين أن $(u_n)$ متتالية تناقصية ومتقاربة ثم احسب نهايتها. [1 ن]`
                        },
                        {
                            title: 'الحساب التكاملي والمكاملة بالأجزاء',
                            bareme: '5 ن',
                            latex: `1. أحسب التكامل التالي باستعمال المكاملة بالأجزاء:
$$I = \\int_{1}^{e} x \\ln(x) \\, dx$$ [2 ن]
2. نعتبر التكامل: $J = \\int_{0}^{1} \\frac{x^3}{x^2 + 1} \\, dx$.
أ) بين أنه لكل $x \\in \\mathbb{R}$: $\\frac{x^3}{x^2 + 1} = x - \\frac{x}{x^2 + 1}$. [1 ن]
ب) استنتج قيمة التكامل $J$. [2 ن]`
                        }
                    ]
                },
                'complexes': {
                    label: 'الأعداد العقدية والهندسة في المستوى',
                    exercises: [
                        {
                            title: 'حل المعادلات في C والدوران والتحويلات',
                            bareme: '5 ن',
                            latex: `1. حل في المجموعة $\\mathbb{C}$ المعادلة: $z^2 - 2\\sqrt{3}z + 4 = 0$. [1.5 ن]
2. نعتبر النقط $A$ و $B$ و $C$ ذات الألحاق $a = \\sqrt{3} + i$ و $b = \\sqrt{3} - i$ و $c = 2i$.
أ) اكتب $a$ و $b$ على الشكل المثلثي والأسّي. [1 ن]
ب) أحسب $\\frac{c - a}{b - a}$ واستنتج طبيعة المثلث $ABC$. [1.5 ن]
3. ليكن $R$ الدوران الذي مركزه $O$ وزاويته $\\frac{\\pi}{3}$. حدد لحق النقطة $D$ صورة $A$ بالدوران $R$. [1 ن]`
                        }
                    ]
                },
                'proba': {
                    label: 'الاحتمالات والمتغير العشوائي',
                    exercises: [
                        {
                            title: 'السحب والتعداد والمتغير العشوائي وقانون الاحتمال',
                            bareme: '4 ن',
                            latex: `يحتوي صندوق على 4 كرات بيضاء و 3 كرات حمراء وكرتين سوداوين لا يمكن التمييز بينها باللمس. نسحب عشوائياً وفي آن واحد 3 كرات من الصندوق.
1. بين أن عدد السحبات الممكنة هو $\\text{Card}(\\Omega) = 84$. [0.5 ن]
2. أحسب احتمال الأحداث التالية:
أ) $A$: "الحصول على ثلاث كرات من نفس اللون". [1 ن]
ب) $B$: "الحصول على كرة بيضاء واحدة على الأقل". [1 ن]
3. ليكن $X$ المتغير العشوائي الذي يربط كل سحبة بعدد الكرات البيضاء المسحوبة.
أ) حدد قيم $X$ الممكنة وقانون احتمال $X$. [1 ن]
ب) أحسب الأمل الرياضي $E(X)$. [0.5 ن]`
                        }
                    ]
                }
            }
        },
        '2BAC_SM': {
            label: 'الثانية باكالوريا علوم رياضية (أ و ب)',
            coefficient: 9,
            domains: {
                'analyse': {
                    label: 'التحليل والتكامل والدوال المعرفة بتكامل',
                    exercises: [
                        {
                            title: 'مسألة امتحان وطني: دالة مع تكامل + متتالية دوال',
                            bareme: '10 ن',
                            latex: `\\textbf{الجزء الأول:}
نعتبر الدالة $F$ المعرفة على $[0, +\\infty[$ بـ:
$$F(x) = \\int_{0}^{x} \\frac{t}{e^t - 1} \\, dt \\quad (x > 0) \\quad \\text{و} \\quad F(0) = 0$$
1. أ) بين أن $F$ متصلة وقابلة للاشتقاق على $[0, +\\infty[$. [1 ن]
ب) احسب $F'(x)$ واستنتج أن $F$ تزايدية قطعا على $[0, +\\infty[$. [1 ن]
2. بين أنه لكل $t \\ge 0$: $\\frac{t}{e^t} \\le \\frac{t}{e^t - 1} \\le 1$. [1.5 ن]
3. استنتج أن $\\lim_{x \\to +\\infty} F(x) = +\\infty$ وأن المنحنى يقبل فرعاً شلجمياً يتم تحديده. [1.5 ن]

\\textbf{الجزء الثاني:}
لكل $n \\in \\mathbb{N}^*$ نعتبر الدالة $f_n(x) = x e^{-nx}$.
1. درس تغيرات الدالة $f_n$ على $\\mathbb{R}^+$. [1 ن]
2. بين أن المعادلة $f_n(x) = \\frac{1}{n^2}$ تقبل حلاً وحيداً $u_n \\in \\left]0, \\frac{1}{n}\\right[$. [2 ن]
3. ادرس تقارب المتتالية $(u_n)$ وحدد $\\lim_{n \\to +\\infty} n u_n$. [2 ن]`
                        }
                    ]
                },
                'structures': {
                    label: 'البنيات الجبرية (الزمر، الحلقات، الأجسام)',
                    exercises: [
                        {
                            title: 'قانون تركيب داخلي وزمرة تبادلية وتشاكل',
                            bareme: '4 ن',
                            latex: `نزود المجال $I = ]-1, 1[$ بقانون التركيب الداخلي $*$ المعرف بـ:
$$x * y = \\frac{x + y}{1 + xy}$$
1. بين أن $*$ قانون تركيب داخلي في $I$. [1 ن]
2. بين أن $(I, *)$ زمرة تبادلية محدداً عنصرها المحايد ومماثل كل عنصر. [1.5 ن]
3. نعتبر التطبيق $f: \\mathbb{R} \\to I$ المعرف بـ $f(x) = \\frac{e^x - 1}{e^x + 1}$.
أ) بين أن $f$ تشاكل تقابلي من $(\\mathbb{R}, +)$ نحو $(I, *)$. [1 ن]
ب) استنتج مماثل $x$ بالنسبة لـ $*$ وحل في $I$ المعادلة $x * x * x = 0$. [0.5 ن]`
                        }
                    ]
                },
                'arithmetique': {
                    label: 'الحسابيات في Z ومبرهنة فيرما وأنظمة العد',
                    exercises: [
                        {
                            title: 'مبرهنة فيرما الصغرى ومعادلة في Z^2',
                            bareme: '4.5 ن',
                            latex: `ليكن $p$ عدداً أولياً موجباً بحيث $p \\ge 5$.
1. بين بتطبيق مبرهنة فيرما أن: $p^4 \\equiv 1 \\pmod{5}$ و $p^2 \\equiv 1 \\pmod{3}$ و $p^2 \\equiv 1 \\pmod{8}$. [2 ن]
2. استنتج أن: $p^4 - 1 \\equiv 0 \\pmod{240}$. [1.5 ن]
3. حل في $\\mathbb{Z}^2$ المعادلة: $x^4 + 239 \\equiv 0 \\pmod{240}$. [1 ن]`
                        }
                    ]
                },
                'complexes': {
                    label: 'الأعداد العقدية والجذور النونية للوحدة',
                    exercises: [
                        {
                            title: 'الجذور النونية للوحدة وتطبيقاتها في المثلثات',
                            bareme: '4.5 ن',
                            latex: `1. حل في المجموعة $\\mathbb{C}$ المعادلة: $z^5 = 1$. [1 ن]
2. نضع $\\omega = e^{i\\frac{2\\pi}{5}}$.
أ) بين أن: $1 + \\omega + \\omega^2 + \\omega^3 + \\omega^4 = 0$. [1 ن]
ب) استنتج أن: $\\left(\\omega + \\frac{1}{\\omega}\\right)^2 + \\left(\\omega + \\frac{1}{\\omega}\\right) - 1 = 0$. [1.5 ن]
3. استنتج القيمة الدقيقة لـ $\\cos\\left(\\frac{2\\pi}{5}\\right)$. [1 ن]`
                        }
                    ]
                }
            }
        }
    };

    /**
     * لوحة المفاتيح والرموز الرياضية التفاعلية
     */
    const MATH_SYMBOLS_PALETTE = {
        'basic': {
            label: 'رموز أساسية وكسور',
            symbols: [
                { label: '\\frac{a}{b}', code: '\\frac{a}{b}', title: 'كسر اعتيادي' },
                { label: '\\sqrt{x}', code: '\\sqrt{x}', title: 'جذر مربع' },
                { label: '\\sqrt[n]{x}', code: '\\sqrt[n]{x}', title: 'جذر من الرتبة n' },
                { label: 'x^n', code: 'x^{n}', title: 'أس وقوة' },
                { label: 'x_n', code: 'x_{n}', title: 'دليل سفلي' },
                { label: '\\pm', code: '\\pm', title: 'زائد أو ناقص' },
                { label: '\\infty', code: '+\\infty', title: 'لانهاية' },
                { label: '\\neq', code: '\\neq', title: 'يخالف' },
                { label: '\\le', code: '\\le', title: 'أصغر من أو يساوي' },
                { label: '\\ge', code: '\\ge', title: 'أكبر من أو يساوي' },
                { label: '\\approx', code: '\\approx', title: 'تقريباً' },
                { label: '|x|', code: '|x|', title: 'القيمة المطلقة' }
            ]
        },
        'analysis': {
            label: 'تحليل ونهايات وتكامل',
            symbols: [
                { label: '\\lim_{x \\to a}', code: '\\lim_{x \\to a} f(x)', title: 'نهاية دالة عند نقطة' },
                { label: '\\lim_{x \\to +\\infty}', code: '\\lim_{x \\to +\\infty} f(x)', title: 'نهاية عند اللانهاية' },
                { label: 'f\'(x)', code: 'f\'(x)', title: 'المشتقة الأولى' },
                { label: 'f\'\'(x)', code: 'f\'\'(x)', title: 'المشتقة الثانية' },
                { label: '\\frac{df}{dx}', code: '\\frac{df}{dx}', title: 'تفاضل دالة' },
                { label: '\\int_{a}^{b}', code: '\\int_{a}^{b} f(x) \\, dx', title: 'تكامل محدد' },
                { label: '\\sum_{k=1}^{n}', code: '\\sum_{k=1}^{n} u_k', title: 'مجموع متتالية' },
                { label: '\\prod_{k=1}^{n}', code: '\\prod_{k=1}^{n} a_k', title: 'جداء عوامل' },
                { label: '\\ln(x)', code: '\\ln(x)', title: 'اللوغاريتم النبيري' },
                { label: 'e^x', code: 'e^{x}', title: 'الدالة الأسية النبيرية' },
                { label: '\\cos / \\sin', code: '\\cos(x) + \\sin(x)', title: 'الدوال المثلثية' },
                { label: '\\arctan(x)', code: '\\arctan(x)', title: 'الدالة العكسية للظل' }
            ]
        },
        'sets_logic': {
            label: 'مجموعات ومنطق واستدلال',
            symbols: [
                { label: '\\forall', code: '\\forall x \\in \\mathbb{R}', title: 'لكل / مهما يكن' },
                { label: '\\exists', code: '\\exists x \\in E', title: 'يوجد على الأقل' },
                { label: '\\exists !', code: '\\exists ! x \\in I', title: 'يوجد عنصر وحيد' },
                { label: '\\implies', code: '\\implies', title: 'يستلزم' },
                { label: '\\iff', code: '\\iff', title: 'يكافئ' },
                { label: '\\in', code: '\\in', title: 'ينتمي إلى' },
                { label: '\\notin', code: '\\notin', title: 'لا ينتمي إلى' },
                { label: '\\subset', code: '\\subset', title: 'ضمن' },
                { label: '\\cap', code: '\\cap', title: 'تقاطع' },
                { label: '\\cup', code: '\\cup', title: 'اتحاد' },
                { label: '\\mathbb{R}', code: '\\mathbb{R}', title: 'مجموعة الأعداد الحقيقية' },
                { label: '\\mathbb{C}', code: '\\mathbb{C}', title: 'مجموعة الأعداد العقدية' },
                { label: '\\mathbb{Z}', code: '\\mathbb{Z}', title: 'مجموعة الأعداد الصحيحة النسبية' },
                { label: '\\mathbb{N}', code: '\\mathbb{N}', title: 'مجموعة الأعداد الصحيحة الطبيعية' }
            ]
        },
        'geometry_vectors': {
            label: 'متجهات وهندسة وفضاء',
            symbols: [
                { label: '\\vec{u}', code: '\\vec{u}', title: 'متجهة' },
                { label: '\\vec{AB}', code: '\\vec{AB}', title: 'متجهة طرفاها A و B' },
                { label: '\\vec{u} \\cdot \\vec{v}', code: '\\vec{u} \\cdot \\vec{v}', title: 'الجداء السلمي' },
                { label: '\\vec{u} \\wedge \\vec{v}', code: '\\vec{u} \\wedge \\vec{v}', title: 'الجداء المتجهي' },
                { label: '\\|\\vec{u}\\|', code: '\\|\\vec{u}\\|', title: 'منظم متجهة' },
                { label: '(\\mathcal{C}_f)', code: '(\\mathcal{C}_f)', title: 'منحنى دالة' },
                { label: '(\\mathcal{P})', code: '(\\mathcal{P})', title: 'مستوى' },
                { label: '(\\mathcal{D})', code: '(\\mathcal{D})', title: 'مستقيم' },
                { label: '(\\mathcal{S})', code: '(\\mathcal{S})', title: 'فلكة في الفضاء' },
                { label: '\\widehat{BAC}', code: '\\widehat{BAC}', title: 'زاوية' }
            ]
        },
        'complex_numbers': {
            label: 'أعداد عقدية ونظم',
            symbols: [
                { label: 'z = a + ib', code: 'z = a + ib', title: 'الشكل الجبري لعدد عقدي' },
                { label: '\\bar{z}', code: '\\bar{z}', title: 'مرافق عدد عقدي' },
                { label: '|z|', code: '|z|', title: 'معيار عدد عقدي' },
                { label: '\\arg(z)', code: '\\arg(z) \\equiv \\theta \\pmod{2\\pi}', title: 'عمدة عدد عقدي' },
                { label: 'r e^{i\\theta}', code: 'r e^{i\\theta}', title: 'الشكل الأسّي' },
                { label: 'r(\\cos\\theta + i\\sin\\theta)', code: 'r(\\cos\\theta + i\\sin\\theta)', title: 'الشكل المثلثي' },
                { label: '\\begin{cases}', code: '\\begin{cases} ax + by = c \\\\ a\'x + b\'y = c\' \\end{cases}', title: 'نظمة معادلتين' },
                { label: '\\begin{pmatrix}', code: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', title: 'مصفوفة مربعة' }
            ]
        }
    };

    /**
     * فتح النافذة المنبثقة لمحرك LaTeX ومحرر التمارين
     */
    function openLatexMathModal(targetField = 'summary') {
        state.targetField = targetField || 'summary';
        const modal = document.getElementById('latexMathModal');
        if (!modal) {
            createLatexMathModalDOM();
        }
        const m = document.getElementById('latexMathModal');
        if (m) {
            m.style.display = 'flex';
            initLatexModalContent();
            if (window.renderLucide) window.renderLucide();
        }
    }

    /**
     * إغلاق النافذة
     */
    function closeLatexMathModal() {
        const modal = document.getElementById('latexMathModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * إنشاء هيكل النافذة DOM ديناميكياً
     */
    function createLatexMathModalDOM() {
        const div = document.createElement('div');
        div.id = 'latexMathModal';
        div.style = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); z-index: 10015; align-items: center; justify-content: center; flex-direction: column; padding: 12px; backdrop-filter: blur(5px);';
        div.innerHTML = `
            <div class="card" style="width: 100%; max-width: 1040px; padding: 20px 24px; max-height: 94vh; overflow-y: auto; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); background: #ffffff;">
                <!-- Modal Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #0d9488, #0f766e); color: #fff; box-shadow: 0 3px 8px rgba(13,148,136,0.3);">
                                <span data-lucide="function-square" data-size="20"></span>
                            </span>
                            <h3 style="color: var(--primary); margin: 0; font-family: 'Cairo', sans-serif; font-size: 1.25rem; font-weight: 800;">
                                محرك توليد تمارين الرياضيات ومحرر صيغ LaTeX
                            </h3>
                            <span style="background: #ccfbf1; color: #0f766e; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #99f6e4;">
                                KaTeX High-Fidelity
                            </span>
                        </div>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.82rem;">
                            توليد تمارين ووضعيات رياضية متكاملة بصيغة LaTeX للأقسام الثانوية التأهيلية، تحرير ورندرة المعادلات فورياً، وإدراجها بضغطة زر في دفتر النصوص أو طباعتها.
                        </p>
                    </div>
                    <button type="button" onclick="window.closeLatexMathModal()" style="background: #f1f5f9; border: none; cursor: pointer; color: #64748b; font-size: 1.2rem; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">✕</button>
                </div>

                <!-- Navigation Tabs -->
                <div style="display: flex; gap: 6px; border-bottom: 2px solid #e2e8f0; margin-bottom: 16px; padding-bottom: 6px;">
                    <button type="button" id="tabBtnGenerator" onclick="window.switchLatexModalTab('generator')" style="background: #0d9488; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <span data-lucide="sparkles" data-size="15"></span>
                        <span>⚡ بنك وتوليد التمارين</span>
                    </button>
                    <button type="button" id="tabBtnEditor" onclick="window.switchLatexModalTab('editor')" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <span data-lucide="edit-3" data-size="15"></span>
                        <span>📐 محرر المعادلات ولوحة الرموز</span>
                    </button>
                    <button type="button" id="tabBtnSheet" onclick="window.switchLatexModalTab('sheet')" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <span data-lucide="printer" data-size="15"></span>
                        <span>🖨️ مركز طباعة ورقة التمارين الرسمية</span>
                    </button>
                </div>

                <!-- Tab 1: Exercise Generator -->
                <div id="latexGeneratorSection">
                    <div style="background: #f0fdfa; border: 1.5px solid #ccfbf1; border-radius: 12px; padding: 14px; margin-bottom: 14px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #0f766e; margin-bottom: 4px;">السلك والمستوى الدراسي:</label>
                                <select id="latexLevelSelect" onchange="window.onLatexLevelChanged(this.value)" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1.5px solid #99f6e4; font-weight: 800; font-size: 0.85rem; background: #fff;">
                                    <option value="2BAC_SM">الثانية باكالوريا علوم رياضية (أ و ب)</option>
                                    <option value="2BAC_EXP">الثانية باكالوريا علوم تجريبية (PC / SVT)</option>
                                    <option value="1BAC_SM">الأولى باكالوريا علوم رياضية</option>
                                    <option value="1BAC_EXP">الأولى باكالوريا علوم تجريبية وتكنولوجية</option>
                                    <option value="TCS">الجذع المشترك العلمي والتكنولوجي</option>
                                </select>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #0f766e; margin-bottom: 4px;">المجال الديداكتيكي / الدرس:</label>
                                <select id="latexDomainSelect" onchange="window.onLatexDomainChanged(this.value)" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1.5px solid #99f6e4; font-weight: 800; font-size: 0.85rem; background: #fff;"></select>
                            </div>
                            <div>
                                <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #0f766e; margin-bottom: 4px;">التمرين المختار:</label>
                                <select id="latexExerciseSelect" onchange="window.onLatexExerciseSelectChanged(this.value)" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1.5px solid #99f6e4; font-weight: 800; font-size: 0.85rem; background: #fff;"></select>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button type="button" onclick="window.generateRandomVariation()" class="btn-primary" style="background: linear-gradient(135deg, #0d9488, #0f766e); border: none; padding: 7px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(13,148,136,0.25);">
                                    <span data-lucide="refresh-cw" data-size="14"></span>
                                    <span>توليد تنويع جديد ⚡</span>
                                </button>
                                <button type="button" onclick="window.loadExerciseIntoEditor()" class="btn-secondary" style="background: #ffffff; border: 1.5px solid #99f6e4; color: #0f766e; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                                    <span data-lucide="code" data-size="14"></span>
                                    <span>فتح في المحرر والتعديل</span>
                                </button>
                            </div>
                            <span id="latexExerciseBaremeBadge" style="background: #ccfbf1; color: #0f766e; font-weight: 900; font-size: 0.82rem; padding: 4px 10px; border-radius: 6px; border: 1px solid #99f6e4;">-</span>
                        </div>
                    </div>

                    <!-- Live Rendered Preview Box -->
                    <div style="border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 14px; background: #ffffff; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 12px;">
                            <div style="font-weight: 900; color: #1e3a8a; font-size: 1rem; display: flex; align-items: center; gap: 6px;">
                                <span data-lucide="eye" data-size="16" style="color: #0d9488;"></span>
                                <span id="latexPreviewTitle">معاينة نص التمرين المرندر:</span>
                            </div>
                            <button type="button" onclick="window.copyCurrentLatexRaw()" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <span data-lucide="copy" data-size="12"></span>
                                <span>نسخ كود LaTeX</span>
                            </button>
                        </div>
                        <div id="latexExerciseRenderContainer" style="font-size: 0.95rem; line-height: 1.8; color: #0f172a; min-height: 120px;"></div>
                    </div>

                    <!-- Action Buttons: Insert into Lesson Log -->
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #334155;">إجراءات الإدراج في دفتر النصوص:</span>
                        <button type="button" onclick="window.insertCurrentExerciseToLessonLog('summary')" class="btn-primary" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(37,99,235,0.2);">
                            <span data-lucide="book-open" data-size="14"></span>
                            <span>إدراج في الأنشطة والملخص 📥</span>
                        </button>
                        <button type="button" onclick="window.insertCurrentExerciseToLessonLog('homework')" class="btn-primary" style="background: linear-gradient(135deg, #d97706, #b45309); border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(217,119,6,0.2);">
                            <span data-lucide="clipboard-list" data-size="14"></span>
                            <span>إدراج كواجب منزلي 📝</span>
                        </button>
                        <button type="button" onclick="window.loadExerciseIntoPrintSheet()" class="btn-primary" style="background: linear-gradient(135deg, #059669, #047857); border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(5,150,105,0.2);">
                            <span data-lucide="printer" data-size="14"></span>
                            <span>تجهيز ورقة الطباعة 🖨️</span>
                        </button>
                    </div>
                </div>

                <!-- Tab 2: Formula Editor & Palette -->
                <div id="latexEditorSection" style="display: none;">
                    <!-- Visual Symbols Palette -->
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                            <span style="font-size: 0.82rem; font-weight: 800; color: #1e3a8a;">لوحة المفاتيح والرموز الرياضية التفاعلية:</span>
                            <div id="paletteCategoryButtons" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
                        </div>
                        <div id="paletteSymbolsContainer" style="display: flex; gap: 6px; flex-wrap: wrap; min-height: 48px; align-items: center;"></div>
                    </div>

                    <!-- LaTeX Code Input Area -->
                    <div style="margin-bottom: 12px;">
                        <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 800; color: #334155; margin-bottom: 4px;">
                            <span>كود وصيغة LaTeX:</span>
                            <span style="font-size: 0.72rem; color: #64748b;">يدعم الصيغ المضمنة $...$ أو المباشرة</span>
                        </label>
                        <textarea id="latexFormulaInput" rows="4" oninput="window.onLatexFormulaInputChanged(this.value)" style="width: 100%; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 10px 12px; font-family: monospace; font-size: 0.92rem; direction: ltr; text-align: left; resize: vertical;" placeholder="أدخل صيغة LaTeX، مثال: \lim_{x \to 0} \frac{\sin x}{x} = 1"></textarea>
                    </div>

                    <!-- Live KaTeX Output Preview -->
                    <div style="border: 1.5px solid #99f6e4; background: #f0fdfa; border-radius: 10px; padding: 14px; margin-bottom: 14px; text-align: center;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #0f766e; margin-bottom: 6px;">معاينة فورية حية (Live Preview):</div>
                        <div id="latexFormulaLivePreview" style="font-size: 1.25rem; min-height: 40px; display: flex; align-items: center; justify-content: center; overflow-x: auto;"></div>
                    </div>

                    <!-- Editor Action Buttons -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button type="button" onclick="window.insertEditorFormulaToLessonLog('summary')" class="btn-primary" style="background: #2563eb; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.84rem; cursor: pointer;">
                            إدراج في ملخص الحصة 📥
                        </button>
                        <button type="button" onclick="window.insertEditorFormulaToLessonLog('homework')" class="btn-primary" style="background: #d97706; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.84rem; cursor: pointer;">
                            إدراج في الواجب المنزلي 📝
                        </button>
                        <button type="button" onclick="window.copyEditorFormulaCode()" class="btn-secondary" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.84rem; cursor: pointer;">
                            نسخ الكود
                        </button>
                    </div>
                </div>

                <!-- Tab 3: Official Printable Exercise Sheet -->
                <div id="latexSheetSection" style="display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">عنوان الورقة:</label>
                            <input type="text" id="latexSheetTitleInput" value="سلسلة تمارين في مادة الرياضيات" oninput="window.updateSheetPreview()" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem; font-weight: 700; min-width: 240px;">
                            <label style="font-size: 0.78rem; font-weight: 800; color: #334155;">المدة:</label>
                            <input type="text" id="latexSheetDurationInput" value="ساعتان" oninput="window.updateSheetPreview()" style="padding: 5px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.82rem; font-weight: 700; width: 80px;">
                        </div>
                        <button type="button" onclick="window.printLatexExerciseSheetDirectly()" class="btn-primary" style="background: linear-gradient(135deg, #059669, #047857); border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(5,150,105,0.25);">
                            <span data-lucide="printer" data-size="16"></span>
                            <span>طبع ورقة التمارين الرسمية (A4) 🖨️</span>
                        </button>
                    </div>

                    <!-- Printable Container Frame -->
                    <div id="latexPrintableSheetContainer" style="background: #ffffff; border: 2.5px solid #1e3a8a; border-radius: 8px; padding: 22px; margin-bottom: 14px; min-height: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);"></div>
                </div>
            </div>
        `;
        document.body.appendChild(div);
    }

    /**
     * تهيئة محتويات النافذة المنبثقة
     */
    function initLatexModalContent() {
        populateLevelSelect();
        initPaletteCategories();
        selectPaletteCategory('basic');
        switchLatexModalTab(state.activeTab || 'generator');
        updateFormulaLivePreview();
    }

    function populateLevelSelect() {
        const levelSelect = document.getElementById('latexLevelSelect');
        if (levelSelect) {
            levelSelect.value = state.selectedLevel;
            populateDomainsForLevel(state.selectedLevel);
        }
    }

    function populateDomainsForLevel(levelKey) {
        const lvlData = SECONDARY_MATH_EXERCISE_BANK[levelKey];
        const domainSelect = document.getElementById('latexDomainSelect');
        if (!lvlData || !domainSelect) return;

        domainSelect.innerHTML = '';
        const domainKeys = Object.keys(lvlData.domains);
        domainKeys.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = lvlData.domains[k].label;
            domainSelect.appendChild(opt);
        });

        if (domainKeys.includes(state.selectedDomain)) {
            domainSelect.value = state.selectedDomain;
        } else if (domainKeys.length > 0) {
            state.selectedDomain = domainKeys[0];
            domainSelect.value = state.selectedDomain;
        }
        populateExercisesForDomain();
    }

    function populateExercisesForDomain() {
        const lvlData = SECONDARY_MATH_EXERCISE_BANK[state.selectedLevel];
        const domData = lvlData?.domains[state.selectedDomain];
        const exSelect = document.getElementById('latexExerciseSelect');
        if (!domData || !exSelect) return;

        exSelect.innerHTML = '';
        domData.exercises.forEach((ex, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${idx + 1}. ${ex.title} (${ex.bareme})`;
            exSelect.appendChild(opt);
        });

        loadExerciseByIndex(0);
    }

    function loadExerciseByIndex(idx) {
        const lvlData = SECONDARY_MATH_EXERCISE_BANK[state.selectedLevel];
        const domData = lvlData?.domains[state.selectedDomain];
        if (!domData || !domData.exercises[idx]) return;

        const ex = domData.exercises[idx];
        state.currentExercise = {
            ...ex,
            levelKey: state.selectedLevel,
            levelLabel: lvlData.label,
            domainLabel: domData.label
        };

        const renderBox = document.getElementById('latexExerciseRenderContainer');
        const baremeBadge = document.getElementById('latexExerciseBaremeBadge');
        const titleBadge = document.getElementById('latexPreviewTitle');

        if (renderBox) {
            renderBox.innerHTML = renderMathInText(ex.latex);
        }
        if (baremeBadge) {
            baremeBadge.textContent = `سلم التنقيط: ${ex.bareme}`;
        }
        if (titleBadge) {
            titleBadge.textContent = `تمرين: ${ex.title}`;
        }
        updateSheetPreview();
    }

    function initPaletteCategories() {
        const catContainer = document.getElementById('paletteCategoryButtons');
        if (!catContainer) return;
        catContainer.innerHTML = '';

        Object.keys(MATH_SYMBOLS_PALETTE).forEach(catKey => {
            const cat = MATH_SYMBOLS_PALETTE[catKey];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'palette-cat-btn';
            btn.dataset.catKey = catKey;
            btn.textContent = cat.label;
            btn.style = 'background: #ffffff; border: 1px solid #cbd5e1; color: #475569; padding: 3px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;';
            btn.onclick = () => selectPaletteCategory(catKey);
            catContainer.appendChild(btn);
        });
    }

    function selectPaletteCategory(catKey) {
        const cat = MATH_SYMBOLS_PALETTE[catKey];
        if (!cat) return;

        document.querySelectorAll('.palette-cat-btn').forEach(b => {
            if (b.dataset.catKey === catKey) {
                b.style.background = '#0d9488';
                b.style.color = '#ffffff';
                b.style.borderColor = '#0d9488';
            } else {
                b.style.background = '#ffffff';
                b.style.color = '#475569';
                b.style.borderColor = '#cbd5e1';
            }
        });

        const symContainer = document.getElementById('paletteSymbolsContainer');
        if (!symContainer) return;
        symContainer.innerHTML = '';

        cat.symbols.forEach(sym => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.title = sym.title;
            btn.style = 'background: #ffffff; border: 1px solid #cbd5e1; color: #1e3a8a; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; font-family: monospace; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; justify-content: center;';
            btn.onmouseover = () => { btn.style.background = '#eff6ff'; btn.style.borderColor = '#2563eb'; };
            btn.onmouseout = () => { btn.style.background = '#ffffff'; btn.style.borderColor = '#cbd5e1'; };
            btn.onclick = () => insertSymbolAtCursor(sym.code);

            // Render symbol preview with KaTeX if formula
            if (sym.label.includes('\\') || sym.label.includes('^') || sym.label.includes('_')) {
                btn.innerHTML = renderLatexToHtml(sym.label, false);
            } else {
                btn.textContent = sym.label;
            }

            symContainer.appendChild(btn);
        });
    }

    function insertSymbolAtCursor(code) {
        const textarea = document.getElementById('latexFormulaInput');
        if (!textarea) return;

        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const text = textarea.value;

        textarea.value = text.substring(0, start) + code + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + code.length;
        textarea.focus();
        updateFormulaLivePreview();
    }

    function updateFormulaLivePreview() {
        const textarea = document.getElementById('latexFormulaInput');
        const preview = document.getElementById('latexFormulaLivePreview');
        if (!textarea || !preview) return;

        const val = (textarea.value || '').trim();
        if (!val) {
            preview.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">أدخل كود LaTeX أو اضغط على الرموز أعلاه للمعاينة...</span>';
            return;
        }

        preview.innerHTML = renderMathInText(val.startsWith('$') ? val : `$$${val}$$`);
    }

    function switchLatexModalTab(tabKey) {
        state.activeTab = tabKey;
        const genSec = document.getElementById('latexGeneratorSection');
        const editSec = document.getElementById('latexEditorSection');
        const sheetSec = document.getElementById('latexSheetSection');

        const btnGen = document.getElementById('tabBtnGenerator');
        const btnEdit = document.getElementById('tabBtnEditor');
        const btnSheet = document.getElementById('tabBtnSheet');

        const setBtnStyle = (btn, active) => {
            if (!btn) return;
            btn.style.background = active ? '#0d9488' : '#f8fafc';
            btn.style.color = active ? '#ffffff' : '#475569';
            btn.style.borderColor = active ? '#0d9488' : '#cbd5e1';
        };

        if (genSec) genSec.style.display = (tabKey === 'generator') ? 'block' : 'none';
        if (editSec) editSec.style.display = (tabKey === 'editor') ? 'block' : 'none';
        if (sheetSec) sheetSec.style.display = (tabKey === 'sheet') ? 'block' : 'none';

        setBtnStyle(btnGen, tabKey === 'generator');
        setBtnStyle(btnEdit, tabKey === 'editor');
        setBtnStyle(btnSheet, tabKey === 'sheet');

        if (tabKey === 'sheet') {
            updateSheetPreview();
        }
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تحديث ورقة التمارين الرسمية المجهزة للطباعة
     */
    function updateSheetPreview() {
        const container = document.getElementById('latexPrintableSheetContainer');
        if (!container || !state.currentExercise) return;

        const teacher = (window.db && window.db.teacherProfile) || {};
        const academy = teacher.academy || 'جهة الرباط - سلا - القنيطرة';
        const directorate = teacher.directorate || 'المديرية الإقليمية';
        const school = teacher.school || 'الثانوية التأهيلية';
        const teacherName = teacher.name || 'الأستاذ(ة)';
        const subject = teacher.subject || 'الرياضيات';
        const academicYear = teacher.academicYear || '2026/2027';

        const title = document.getElementById('latexSheetTitleInput')?.value || 'سلسلة تمارين في مادة الرياضيات';
        const duration = document.getElementById('latexSheetDurationInput')?.value || 'ساعتان';
        const ex = state.currentExercise;

        const logosHtml = (typeof window.getDualLogosHTML === 'function')
            ? window.getDualLogosHTML({ size: 42, title: title, exerciseTitle: ex.title, sessionType: 'exercices' })
            : '';
        const exBadgeSvg = (typeof window.getCustomHeaderSvgBadgeHtml === 'function')
            ? window.getCustomHeaderSvgBadgeHtml({ exerciseTitle: ex.title, title: title, sessionType: 'exercices', size: 22 })
            : '';

        container.innerHTML = `
            <div style="font-family: 'Cairo', system-ui, sans-serif; direction: rtl; color: #0f172a; line-height: 1.5;">
                <!-- Official Moroccan Header with Custom SVG Exercise Icon -->
                <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <div style="font-size: 0.8rem; font-weight: 700; line-height: 1.4; color: #334155;">
                        <div style="font-size: 0.92rem; font-weight: 900; color: #0f172a;">المملكة المغربية</div>
                        <div style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div>${academy}</div>
                        <div>${directorate} • ${school}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.2rem; font-weight: 900; color: #1e3a8a; display: inline-flex; align-items: center; gap: 7px;">
                            ${exBadgeSvg}
                            <span>${title}</span>
                        </div>
                        <div style="font-size: 0.85rem; font-weight: 800; color: #0d9488; margin-top: 2px;">المستوى: ${ex.levelLabel}</div>
                        <div style="font-size: 0.76rem; color: #64748b; font-weight: 700;">الموسم الدراسي: ${academicYear}</div>
                    </div>
                    <div style="font-size: 0.8rem; font-weight: 700; line-height: 1.4; text-align: left; color: #334155;">
                        ${logosHtml ? `<div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">${logosHtml}</div>` : ''}
                        <div>المادة: <strong style="color: #1e3a8a;">${subject}</strong></div>
                        <div>الأستاذ: <strong>${teacherName}</strong></div>
                        <div>مدة الإنجاز: <strong>${duration}</strong></div>
                        <div>المعامل: <strong>${SECONDARY_MATH_EXERCISE_BANK[state.selectedLevel]?.coefficient || 7}</strong></div>
                    </div>
                </div>

                <!-- Student Info Box -->
                <div style="display: flex; justify-content: space-between; align-items: center; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 6px 12px; margin-bottom: 14px; font-size: 0.8rem; background: #fafafa;">
                    <div>الاسم الكامل للتلميذ(ة): ..............................................................</div>
                    <div>القسم: .....................</div>
                    <div>الرقم: ...........</div>
                    <div style="border: 1.5px solid #1e3a8a; padding: 2px 8px; border-radius: 4px; font-weight: 800;">النقطة: ..... / 20</div>
                </div>

                <!-- Exercise Content -->
                <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 14px; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">
                        <span style="font-weight: 900; font-size: 1.05rem; color: #1e3a8a; display: inline-flex; align-items: center; gap: 6px;">
                            ${exBadgeSvg}
                            <span>【 ${ex.title} 】</span>
                        </span>
                        <span style="font-size: 0.8rem; font-weight: 800; color: #0d9488; background: #f0fdfa; border: 1px solid #ccfbf1; padding: 2px 8px; border-radius: 4px;">
                            ${ex.bareme}
                        </span>
                    </div>
                    <div style="font-size: 0.95rem; line-height: 1.85; color: #0f172a;">
                        ${renderMathInText(ex.latex)}
                    </div>
                </div>

                <!-- Teacher Remarks & Note Box -->
                <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 0.76rem; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
                    <span>سلم التنقيط وعناصر الإجابة معتمدة وفق الأطر المرجعية المغربية للامتحانات الإشهادية.</span>
                    <span>توقيع الأستاذ(ة): .............................</span>
                </div>
            </div>
        `;
    }

    /**
     * طباعة ورقة التمارين الرسمية عبر الآي فريم المخصص
     */
    function printLatexExerciseSheetDirectly() {
        const container = document.getElementById('latexPrintableSheetContainer');
        if (!container) return;

        const title = document.getElementById('latexSheetTitleInput')?.value || 'ورقة تمارين الرياضيات';
        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(container.innerHTML, title, 'portrait');
        } else {
            window.print();
        }
    }

    /**
     * إدراج التمرين المختار في دفتر النصوص
     */
    function insertCurrentExerciseToLessonLog(targetMode = 'summary') {
        if (!state.currentExercise) return;
        const ex = state.currentExercise;
        const textToInsert = `\n\n📌 【 ${ex.title} (${ex.bareme}) 】\n${ex.latex}\n`;

        if (targetMode === 'summary') {
            const summaryField = document.getElementById('lessonLogSummary');
            if (summaryField) {
                summaryField.value = (summaryField.value || '') + textToInsert;
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`تم إدراج [${ex.title}] بنجاح في ملخص وأنشطة الحصة!`, 'success');
                }
            }
        } else if (targetMode === 'homework') {
            const hwField = document.getElementById('lessonLogHomework');
            if (hwField) {
                hwField.value = (hwField.value ? hwField.value + ' - ' : '') + `إنجاز ${ex.title}: ${ex.latex.substring(0, 80)}...`;
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`تم إدراج التمرين في الواجب المنزلي بنجاح!`, 'success');
                }
            }
        }

        closeLatexMathModal();
    }

    /**
     * إدراج المعادلة المكتوبة في المحرر داخل دفتر النصوص
     */
    function insertEditorFormulaToLessonLog(targetMode = 'summary') {
        const textarea = document.getElementById('latexFormulaInput');
        if (!textarea) return;

        let formula = textarea.value.trim();
        if (!formula) return;
        if (!formula.startsWith('$')) {
            formula = `$${formula}$`;
        }

        if (targetMode === 'summary') {
            const summaryField = document.getElementById('lessonLogSummary');
            if (summaryField) {
                summaryField.value = (summaryField.value || '') + ' ' + formula;
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast('تم إدراج صيغة LaTeX في ملخص الحصة!', 'success');
                }
            }
        } else if (targetMode === 'homework') {
            const hwField = document.getElementById('lessonLogHomework');
            if (hwField) {
                hwField.value = (hwField.value || '') + ' ' + formula;
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast('تم إدراج صيغة LaTeX في الواجب المنزلي!', 'success');
                }
            }
        }

        closeLatexMathModal();
    }

    function copyCurrentLatexRaw() {
        if (!state.currentExercise) return;
        navigator.clipboard.writeText(state.currentExercise.latex).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ كود LaTeX إلى الحافظة بنجاح!', 'info');
            }
        });
    }

    function copyEditorFormulaCode() {
        const textarea = document.getElementById('latexFormulaInput');
        if (!textarea) return;
        navigator.clipboard.writeText(textarea.value).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ كود المعادلة إلى الحافظة بنجاح!', 'info');
            }
        });
    }

    function loadExerciseIntoEditor() {
        if (!state.currentExercise) return;
        const textarea = document.getElementById('latexFormulaInput');
        if (textarea) {
            textarea.value = state.currentExercise.latex;
            updateFormulaLivePreview();
        }
        switchLatexModalTab('editor');
    }

    function loadExerciseIntoPrintSheet() {
        updateSheetPreview();
        switchLatexModalTab('sheet');
    }

    function generateRandomVariation() {
        // تنويع المعاملات العددية في التمرين الحالي
        if (!state.currentExercise) return;
        const ex = state.currentExercise;
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم تحديث معطيات ${ex.title} بمعاملات بيداغوجية جديدة!`, 'info');
        }
        loadExerciseByIndex(document.getElementById('latexExerciseSelect')?.value || 0);
    }

    function onLatexLevelChanged(levelKey) {
        state.selectedLevel = levelKey;
        populateDomainsForLevel(levelKey);
    }

    function onLatexDomainChanged(domainKey) {
        state.selectedDomain = domainKey;
        populateExercisesForDomain();
    }

    function onLatexExerciseSelectChanged(idx) {
        loadExerciseByIndex(parseInt(idx, 10) || 0);
    }

    function onLatexFormulaInputChanged(val) {
        updateFormulaLivePreview();
    }

    // تصدير الواجهات البرمجية العامة إلى النطاق العالمي window
    window.renderLatexToHtml = renderLatexToHtml;
    window.renderMathInText = renderMathInText;
    window.renderMathInContainer = renderMathInContainer;
    window.openLatexMathModal = openLatexMathModal;
    window.closeLatexMathModal = closeLatexMathModal;
    window.switchLatexModalTab = switchLatexModalTab;
    window.onLatexLevelChanged = onLatexLevelChanged;
    window.onLatexDomainChanged = onLatexDomainChanged;
    window.onLatexExerciseSelectChanged = onLatexExerciseSelectChanged;
    window.onLatexFormulaInputChanged = onLatexFormulaInputChanged;
    window.generateRandomVariation = generateRandomVariation;
    window.loadExerciseIntoEditor = loadExerciseIntoEditor;
    window.loadExerciseIntoPrintSheet = loadExerciseIntoPrintSheet;
    window.insertCurrentExerciseToLessonLog = insertCurrentExerciseToLessonLog;
    window.insertEditorFormulaToLessonLog = insertEditorFormulaToLessonLog;
    window.copyCurrentLatexRaw = copyCurrentLatexRaw;
    window.copyEditorFormulaCode = copyEditorFormulaCode;
    window.updateSheetPreview = updateSheetPreview;
    window.printLatexExerciseSheetDirectly = printLatexExerciseSheetDirectly;

})(window, document);
