/**
 * منظومة التدبير التربوي - مادة الرياضيات
 * وحدة مكتبة وتنظيم قوالب الذكاء الاصطناعي المخصصة (Custom AI Prompt Templates Component)
 * تتيح تخزين، تصنيف، تخصيص، تجربة، وإعادة استخدام الأوامر الديداكتيكية المحسنة لمختلف المهام البيداغوجية
 */

(function (window) {
    'use strict';

    // فئات وقوائم مهام التدريس البيداغوجي لمادة الرياضيات (قابلة للتخصيص والإضافة)
    const BUILTIN_PROMPT_CATEGORIES = [
        { id: 'all', label: 'كافة القوالب', icon: 'layers', isSystem: true },
        { id: 'massar', label: 'منظومة مسار وإكسيل', icon: 'file-spreadsheet', desc: 'تحليل واستخراج تقارير النقط والغياب من لوائح مسار وملفات Excel' },
        { id: 'exam_prep', label: 'تحضير الفروض', icon: 'award', desc: 'صياغة مواضيع الفروض المحروسة والتقويم وسلم التنقيط' },
        { id: 'lesson_delivery', label: 'تقديم الدروس', icon: 'book-open', desc: 'هندسة الجذاذات ووضعيات الانطلاق والأنشطة البنائية' },
        { id: 'admin_comm', label: 'تواصل إداري', icon: 'mail', desc: 'مراسلات أولياء الأمور والتقارير الإدارية ومجالس الانضباط' },
        { id: 'remediation', label: 'الدعم والمعالجة', icon: 'target', desc: 'معالجة التعثرات الديداكتيكية وخطط الدعم الفارقي' },
        { id: 'didactics', label: 'الديداكتيك والترييض', icon: 'compass', desc: 'ترييض الوضعيات والنمذجة الرياضية' },
        { id: 'lesson_plan', label: 'الجذاذات والمحاور', icon: 'file-spreadsheet', desc: 'التخطيط وتدبير دفتر النصوص' },
        { id: 'student_evaluation', label: 'الملاحظات والتقارير', icon: 'file-text', desc: 'صياغة الملاحظات التوجيهية لدفاتر النصوص وبيانات النقط' },
        { id: 'custom', label: 'قوالبي المخصصة', icon: 'user', isSystem: true }
    ];

    // وظائف استرجاع وحفظ الفئات المخصصة القابلة للتخصيص من قبل الأستاذ
    function getCustomPromptCategories() {
        try {
            if (window.db && Array.isArray(window.db.customPromptCategories)) {
                return window.db.customPromptCategories;
            }
            const stored = localStorage.getItem('ai_prompt_custom_categories');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    if (window.db) window.db.customPromptCategories = parsed;
                    return parsed;
                }
            }
        } catch (e) {}
        return [];
    }

    function saveCustomPromptCategories(cats) {
        try {
            if (!window.db) window.db = {};
            window.db.customPromptCategories = cats;
            localStorage.setItem('ai_prompt_custom_categories', JSON.stringify(cats));
            if (typeof window.saveDB === 'function') window.saveDB();
        } catch (e) {}
    }

    function getAllPromptCategories() {
        const custom = getCustomPromptCategories();
        const allCat = BUILTIN_PROMPT_CATEGORIES.find(c => c.id === 'all');
        const customCat = BUILTIN_PROMPT_CATEGORIES.find(c => c.id === 'custom');
        const middleBuiltins = BUILTIN_PROMPT_CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'custom');
        return [allCat, ...middleBuiltins, ...custom, customCat];
    }

    // التوافق الخلفي
    const PROMPT_CATEGORIES = BUILTIN_PROMPT_CATEGORIES;

    // المتغيرات الديناميكية الشائعة لاقتراح إدراجها بنقرة واحدة
    const COMMON_PROMPT_VARIABLES = [
        { key: 'className', label: 'القسم', desc: 'اسم القسم مثل 2BAC-SM أو TCS-1' },
        { key: 'level', label: 'المستوى', desc: 'المستوى مثل الثانية باك علوم رياضية أو جذع مشترك علمي' },
        { key: 'topic', label: 'الموضوع / الدرس', desc: 'عنوان الدرس أو المفهوم الرياضي' },
        { key: 'prerequisites', label: 'المكتسبات القبلية', desc: 'المفاهيم السابقة المطلوبة' },
        { key: 'strugglingPoints', label: 'نقاط التعثر', desc: 'الصعوبات الملاحظة لدى المتعلمين' },
        { key: 'duration', label: 'المدة الزمنية', desc: 'المدة مثل 55 دقيقة أو ساعتان' },
        { key: 'examPeriod', label: 'الفترة التقويمية', desc: 'الفرض 1 الدورة 1 أو الفرض 2' },
        { key: 'studentName', label: 'اسم التلميذ', desc: 'اسم المتعلم في حالة الملاحظة الفردية' },
        { key: 'average', label: 'المعدل المحصل', desc: 'نقطة الفرض أو المعدل الدوري' },
        { key: 'excelData', label: 'بيانات جدول إكسيل مسار', desc: 'جدول النقط والغياب المنسوخ من ملف إكسيل مسار' },
        { key: 'semester', label: 'الدورة / الأسدوس', desc: 'الدورة الأولى (S1) أو الدورة الثانية (S2)' },
        { key: 'passThreshold', label: 'عتبة النجاح', desc: 'عتبة النجاح مثل 10.00 / 20' },
        { key: 'absenceThreshold', label: 'عتبة إنذار الغياب', desc: 'الحد الأقصى لساعات الغياب مثل 4 ساعات' },
        { key: 'academicYear', label: 'الموسم الدراسي', desc: 'الموسم الدراسي مثل 2025-2026' }
    ];

    // القوالب المرجعية الافتراضية عالية الجودة المطابقة للمنهاج المغربي
    const DEFAULT_PROMPT_TEMPLATES = [
        // ==========================================
        // 1. باقة قوالب منظومة مسار وإكسيل (Massar Suite)
        // ==========================================
        {
            id: 'tpl_massar_grades_analytics',
            title: 'استخراج التقرير الإحصائي الشامل لنقط الفروض من ملف إكسيل مسار',
            category: 'massar',
            categoryLabel: 'منظومة مسار وإكسيل',
            description: 'استخراج فوري لمؤشرات التحصيل الرياضي: أعلى وأدنى نقطة، المعدل العام، نسبة النجاح، وتوزيع النقط حسب المجالات المعيارية لمسار.',
            systemInstruction: 'أنت خبير إحصائي وبيداغوجي متخصص في معالجة لوائح وبيانات منظومة مسار لوزارة التربية الوطنية بالمغرب. تستخرج المؤشرات الرقمية بدقة وتقارنها بالمذكرات التوجيهية وتصيغ تقارير إحصائية جاهزة للطباعة والتسليم للإدارة التربوية.',
            promptText: `أنت خبير إحصائي وتربوي متخصص في تحليل بيانات منظومة مسار (Massar).
المرجو استخراج التقرير الإحصائي الشامل والدقيق لنقط الفروض لمادة الرياضيات لقسم {{className}} (المستوى: {{level}} - الدورة: {{semester}} - الفترة: {{examPeriod}}).

بيانات جدول إكسيل مسار المنسوخة (رقم مسار، الاسم، النقط، الفروض):
{{excelData}}

المطلوب استخراجه وصياغته في تقرير إحصائي بيداغوجي منظم:
1. 📊 المؤشرات الإحصائية العامة:
   - عدد التلاميذ المسجلين والمجتازين للفرض وعدد المتغيبين.
   - أعلى نقطة مسجلة مع اسم التلميذ(ة) إن وجد.
   - أدنى نقطة مسجلة.
   - المعدل الحسابي العام للقسم (Moyenne de la classe).
   - نسبة التلاميذ الحاصلين على المعدل (>= {{passThreshold}}/20) ونسبة المتعثرين (< {{passThreshold}}/20).
   - وسيط النقط (Médiane) والانحراف المعياري التقريبي لمدى تجانس القسم.

2. 📈 التوزيع التكراري للنقط حسب فئات مسار الرسمية:
   - فئة الضعف الحاد [0 إلى 4.99]: العدد + النسبة المئوية.
   - فئة التعثر المتوسط [5 إلى 9.99]: العدد + النسبة المئوية.
   - فئة المتوسط [10 إلى 11.99]: العدد + النسبة المئوية.
   - فئة المستحسن [12 إلى 13.99]: العدد + النسبة المئوية.
   - فئة الحسن [14 إلى 15.99]: العدد + النسبة المئوية.
   - فئة الامتياز [16 إلى 20]: العدد + النسبة المئوية.

3. 🔍 قراءة تشخيصية بيداغوجية:
   - تحليل جودة النتائج وهل المنحنى يميل للإيجاب أو السلب.
   - رصد الفجوة بين التلاميذ المتفوقين وقاعدة المتعثرين.
   - التوصيات الإجرائية الموجهة لمجلس القسم وخطة الدعم المستعجلة.`,
            tags: ['مسار', 'إكسيل', 'إحصائيات', 'نقط الفروض', 'تقارير'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 22,
            createdAt: '2026-09-01T08:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z'
        },
        {
            id: 'tpl_massar_absence_report',
            title: 'استخراج تقرير الغياب والمواظبة والربط بالتعثر الدراسي من إكسيل مسار',
            category: 'massar',
            categoryLabel: 'منظومة مسار وإكسيل',
            description: 'تحليل بيانات الغياب في مسار، فرز المتغيبين بدون عذر وتحديد معامل الارتباط بين ساعات الغياب وتدني نقط الفروض.',
            systemInstruction: 'أنت مستشار في التوجيه التربوي وتتبع المواظبة المدرسية، متخصص في معالجة لوائح غياب منظومة مسار وصياغة الإشعارات والتقارير الإدارية.',
            promptText: `بصفتك خبيراً في تتبع المواظبة واليقظة التربوية بمنظومة مسار، قم بتحليل لائحة الغياب المستخرجة من مسار لقسم {{className}} (المستوى: {{level}} - الدورة: {{semester}}).

بيانات جدول إكسيل مسار للغياب والمواظبة والنقط:
{{excelData}}

المطلوب استخراجه وتحليله:
1. 📋 الحصيلة الرقمية للغياب:
   - مجموع ساعات وحصص الغياب الإجمالية خلال الفترة.
   - نسبة الغياب المبرر بالشهادات مقابل الغياب غير المبرر.
   - متوسط عدد ساعات الغياب لكل تلميذ بالقسم.

2. ⚠️ لائحة الإنذار واليقظة التربوية (الحالات الحرجة):
   - فرز التلاميذ الذين تجاوزوا عتبة الإنذار ({{absenceThreshold}} ساعات فأكثر) مرتبين تنازلياً.
   - تبيان تاريخ ووتيرة الغياب (غياب مستمر أم متقطع في حصص معينة).

3. 🔗 تحليل الارتباط بين الغياب والتحصيل في الرياضيات:
   - رصد أثر غياب كل حالة على نقط الفروض المحروسة ومعدل المراقبة المستمرة.
   - تحديد هل التعثر ناتج عن الانقطاع أم صعوبات تعلم ذاتية.

4. 📝 الإجراءات الإدارية والبيداغوجية المقترحة:
   - صياغة نص إشعار رسمي لولي الأمر مخصص للحالات الحرجة.
   - مقترح استدراكي لتعويض الحصص والدروس الضائعة قبل موعد الفرض القادم.`,
            tags: ['مسار', 'غياب', 'مواظبة', 'إنذار مبكر', 'إكسيل'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 18,
            createdAt: '2026-09-02T08:00:00Z',
            updatedAt: '2026-10-15T11:00:00Z'
        },
        {
            id: 'tpl_massar_excel_audit',
            title: 'تدقيق وتصحيح ملف نقط مسار Excel وكشف الخانات الشاذة والفارغة',
            category: 'massar',
            categoryLabel: 'منظومة مسار وإكسيل',
            description: 'فحص ومطابقة جدول مسار قبل إرساله للإدارة: اكتشاف النقط الخاطئة (>20 أو <0)، الخانات المنسية، وتكرار الأسماء.',
            systemInstruction: 'أنت مدقق بيانات ومنظومات معلوماتية مدرسية متخصص في قواعد بيانات مسار وصيغ إكسيل الرسمية لوزارة التربية الوطنية.',
            promptText: `قم بإجراء فحص وتدقيق تقني وإحصائي صارم لبيانات جدول إكسيل مسار التالي لقسم {{className}} للتأكد من سلامته التامة قبل اعتماده رسمياً وتصديره لمنظومة مسار:

البيانات المنسوخة من ملف إكسيل مسار:
{{excelData}}

المطلوب في تقرير التدقيق:
1. 🚨 كشف الأخطاء الصريحة والشاذة:
   - هل توجد نقط تتجاوز الحد الأقصى (أكبر من 20) أو نقط سالبة؟
   - هل توجد خانات فارغة غير ممسوكة لأي تلميذ في أي فرض مع تحديد اسمه ورقم مسار؟
   - هل هناك تكرار لأرقام مسار أو أخطاء في تنسيق الفاصلة (استخدام النقطة عوض الفاصلة أو العكس)؟

2. 🔎 فحص النقط الشاذة إحصائياً (Outliers):
   - تلاميذ ذوو فروق شاسعة غير مفسرة بين فرض وآخر (مثال: تلميذ حصل على 02/20 في فرض و 19/20 في فرض آخر).
   - حالات الغياب المسجلة بـ (غ / Abs) وهل تم تبريرها أو تعويضها بفرض استدراكي.

3. ✅ جدول البيانات المصححة والجاهزة:
   - تقديم جدول ملخص نظيف وجاهز للنسخ المباشر إلى إكسيل متوافق تماماً مع أعمدة مسار.`,
            tags: ['مسار', 'تدقيق', 'تصحيح', 'جودة البيانات', 'إكسيل'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 14,
            createdAt: '2026-09-03T08:00:00Z',
            updatedAt: '2026-10-16T09:00:00Z'
        },
        {
            id: 'tpl_massar_semesters_comparison',
            title: 'مقارنة نتائج الدورتين (د1 مقابل د2) واستخراج مؤشرات مجالس الأقسام من مسار',
            category: 'massar',
            categoryLabel: 'منظومة مسار وإكسيل',
            description: 'تحليل مقارن لمعدلات الدورة الأولى والثانية المستخرجة من مسار لحساب نسب التطور والتراجع وتحديد المستفيدين من الدعم.',
            systemInstruction: 'أنت منسق مجالس الأقسام ومفتش تربوي لمادة الرياضيات، تتقن استخراج مؤشرات التقدم والنجاح لمجالس نهاية السنة.',
            promptText: `قم بإعداد التقرير المقارن لمجالس الأقسام بين الدورة الأولى والدورة الثانية استناداً إلى بيانات ملف مسار لقسم {{className}} (المستوى: {{level}}).

بيانات جدول مسار المقارن (معدلات د1 ومعدلات د2 والغياب):
{{excelData}}

المطلوب تفصيله في التقرير:
1. 📊 مقارنة المؤشرات العامة بين الأسدسين:
   - تطور المعدل العام للقسم (د1 ⬅️ د2) مع الفارق (+ / -).
   - تطور نسبة النجاح (الحاصلين على >= {{passThreshold}}/20).
   - نسبة التلاميذ في حالة تطور إيجابي (+1 نقطة فأكثر).
   - نسبة التلاميذ في حالة استقرار.
   - نسبة التلاميذ في حالة تراجع (-1 نقطة فأكثر).

2. 🏆 قائمة التميز والتنويه:
   - التلاميذ الذين حققوا أعلى قفزة نوعية في معدل الرياضيات.
   - المتفوقون الأوائل الثابتون في صدارة القسم.

3. ⚠️ رادار الدعم والمواكبة الاستدراكية:
   - لائحة التلاميذ المهددين بتكرار السنة أو الرسوب بسبب الرياضيات.
   - تحديد الخلل الأبرز لكل حالة (غياب مكثف، تراجع مفاجئ في الدورة 2، ضعف تراكمي).

4. 📑 توصيات ومقررات مجلس القسم:
   - القرار المقترح للتوجيه نحو الشعب العلمية أو التقنية المناسبة لقدرات المتعلمين.
   - التوصيات المرفوعة لأستاذ المستوى الموالي للموسم الدراسي القادم.`,
            tags: ['مسار', 'مجالس الأقسام', 'مقارنة الدورات', 'تطور المعدل', 'إكسيل'],
            isBuiltIn: true,
            isFavorite: false,
            usageCount: 17,
            createdAt: '2026-09-04T08:00:00Z',
            updatedAt: '2026-10-16T12:00:00Z'
        },
        {
            id: 'tpl_massar_inspection_report',
            title: 'التقرير البيداغوجي والتربوي الرسمي لنتائج مسار الموجه للمفتش والإدارة',
            category: 'massar',
            categoryLabel: 'منظومة مسار وإكسيل',
            description: 'صياغة التقرير الإداري والتربوي الرسمي المعتمد للتسليم للإدارة التربوية وهيئة التفتيش معززاً بالرسوم والمؤشرات.',
            systemInstruction: 'أنت أستاذ باحث وخبير في التوثيق التربوي لمادة الرياضيات، تصيغ التقارير الرسمية وفق المذكرات الوزارية 142-08 وبطاقات تقييم جودة التعلمات.',
            promptText: `بصفتك أستاذ مادة الرياضيات، قم بإعداد التقرير البيداغوجي والتركيبي الرسمي لنتائج فروض المراقبة المستمرة لقسم {{className}} (المستوى: {{level}} - الدورة: {{semester}} - الفترة: {{examPeriod}}).

بيانات ملف مسار المعتمدة:
{{excelData}}

الهندسة المطلوبة للتقرير الرسمي:
1. 🏛️ التصدير الإداري والسياق العام:
   - المؤسسة، الأكاديمية الجهوية، المديرية الإقليمية، المادة، الأستاذ(ة)، الموسم الدراسي: {{academicYear}}.
   - سياق التقويم ومجالات الدروس المشمولة في الفروض.

2. 📊 جدول الحصيلة الإحصائية التفصيلية:
   - جدول ملخص للأرقام (المسجلون، الحاضرون، الغائبون، أعلى وأدنى معدل، المعدل العام، نسبة التحكم).
   - تفييء المتعلمين وفق الموجهات التربوية.

3. 🧠 التشخيص الديداكتيكي للمكتسبات والتعثرات:
   - الكفايات الرياضية التي أبان المتعلمون عن تملكها بجدارة.
   - الكفايات والمفاهيم التي شكلت عائقاً مشتركاً لدى أغلب المتعلمين (الحساب الجبري، الهندسة الفضائية، الاستدلال المنطقي، دراسة الدوال).

4. 🛠️ خطة الدعم والمعالجة المعتمدة:
   - الإجراءات الصفيّة والدعم المندمج المنفذ لتدارك النقص.
   - التدابير المقترحة بتنسيق مع الإدارة التربوية وأسر التلاميذ.`,
            tags: ['مسار', 'تقرير بيداغوجي', 'مفتش تربوي', 'إدارة تربوية', 'إحصائيات'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 15,
            createdAt: '2026-09-05T08:00:00Z',
            updatedAt: '2026-10-17T08:00:00Z'
        },
        // ==========================================
        // 2. باقة القوالب الديداكتيكية العامة للرياضيات
        // ==========================================
        {
            id: 'tpl_remediation_deep',
            title: 'خطة معالجة ديداكتيكية وتفييء المتعلمين المتعثرين',
            category: 'remediation',
            categoryLabel: 'الدعم والمعالجة',
            description: 'تشخيص العوائق المعرفية في موضوع محدد وبناء أنشطة علاجية متدرجة مع توظيف بيداغوجيا الأقران.',
            systemInstruction: 'أنت مفتش تربوي ممتاز وخبير في الديداكتيك وصعوبات التعلم في مادة الرياضيات بالتعليم المغربي. قدم تحليلاً علمياً دقيقاً وخططاً إجرائية قابلة للتطبيق الفوري في الفصل.',
            promptText: `بصفتك أستاذاً خبيراً في مادة الرياضيات، قم ببناء خطة دعم بيداغوجي ومعالجة ديداكتيكية لمتعلمي قسم {{className}} (المستوى: {{level}}).
الموضوع الرياضي المستهدف: {{topic}}
المدة المخصصة للحصة: {{duration}}
أبرز الأخطاء والصعوبات المرصودة لدى المتعثرين:
{{strugglingPoints}}

المطلوب إعداده وفق التوجيهات التربوية المغربية:
1. التفكيك الديداكتيكي للمفهوم: تحديد العائق الإبستيمولوجي والخلط الشائع (بين الخاصية المباشرة والعكسية، أو قواعد الإشارات، إلخ).
2. نشاط تذكيري علاجي مقتضب (10 دقائق): وضيعة انطلاق صغيرة لإزالة اللبس المفهومي.
3. ورشة عمل فارقية (30 دقيقة): بطاقتان علاجيتان (مستوى 1: بناء الكفاية الأساسية / مستوى 2: تملك تقنيات الحل والبرهان).
4. استثمار بيداغوجيا الأقران: كيفية إشراك التلاميذ المتفوقين في مرافقة زملائهم لضمان التفاعل الإيجابي.
5. شبكة تقويم تكويني سريعة (Flash Evaluation) للتحقق من زوال التعثر.`,
            tags: ['دعم', 'معالجة', 'تفييء', 'ديداكتيك'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 14,
            createdAt: '2026-09-01T08:00:00Z',
            updatedAt: '2026-10-01T10:00:00Z'
        },
        {
            id: 'tpl_exam_generator',
            title: 'صياغة فرض محروس ثلاثي التدرج مع عناصر الإجابة وسلم التنقيط',
            category: 'exam_prep',
            categoryLabel: 'تحضير الفروض',
            description: 'إعداد فرض مراقبة مستمرة متوازن يغطي التطبيق المباشر (50%)، المسائل المركبة (35%)، والوضعيات المفتوحة (15%).',
            systemInstruction: 'أنت خبير في التقويم التربوي وبناء اختبارات مادة الرياضيات وفق الأطر المرجعية التوجيهية بالمملكة المغربية.',
            promptText: `قم بصياغة موضوع فرض محروس لمادة الرياضيات للمستوى {{level}} (الفترة التقويمية: {{examPeriod}}).
الدروس والمحاور المتضمنة في الفرض:
{{topic}}
المدة الزمنية للاختبار: {{duration}}

الشروط والمحددات المنهجية:
- التمارين موزعة بدقة:
  * تمرين 1 (8 نقط): تطبيق مباشر للقواعد والخاصيات (حساب، تبسيط، إنشاءات أولية).
  * تمرين 2 (8 نقط): إدماج وتوليف بين محورين مختلفين والبرهان الرياضي المنظم.
  * تمرين 3 (4 نقط): وضعية مسألة أو سؤال تركيبي يستهدف التحليل والترييض.
- كتابة الصيغ والرموز الرياضية بوضوح تام ودقة مصطلحية (بالعربية مع الرموز اللاتينية المعتمدة).
- إرفاق عناصر الإجابة المفصلة وسلم التنقيط الجزئي (بين 0.25 و 1.00 نقطة لكل خطوة برهان).`,
            tags: ['فرض محروس', 'سلم التنقيط', 'تقويم', 'امتحانات'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 19,
            createdAt: '2026-09-01T08:00:00Z',
            updatedAt: '2026-10-02T11:00:00Z'
        },
        {
            id: 'tpl_didactic_modeling',
            title: 'ترييض وضعية-مسألة واقعية مستوحاة من البيئة اليومية للمتعلم',
            category: 'didactics',
            categoryLabel: 'الديداكتيك والترييض',
            description: 'تحويل وضعية حياتية ملموسة إلى نموذج رياضي لحل المسائل وتنمية التفكير الاستدلالي.',
            systemInstruction: 'أنت ديداكتيكي مبرز في الرياضيات تهتم بإعطاء معنى للمفاهيم الرياضية وربطها بالواقع الحياتي للمتعلمين في المغرب.',
            promptText: `صمم وضعية-مسألة ديداكتيكية واقعية وشائقة موجهة لتلاميذ قسم {{className}} (المستوى: {{level}}).
المفهوم الرياضي المطلوب تعبئته في الحل: {{topic}}
المكتسبات القبلية المفترضة: {{prerequisites}}

عناصر الوضعية المطلوبة:
1. نص الوضعية: سياق ملموس وواقعي (مشروع بناء، مساحة زراعية، توزيع ميزانية، أو تصميم هندسي محلي).
2. السندات والبيانات: معطيات عددية وهندسية دقيقة ومنطقية خالية من التناقض.
3. التعليمات والمهمات: أسئلة متدرجة تقود المتعلم من الفهم الأولي ⬅️ ترييض المعطيات ⬅️ صياغة المعادلة أو المتراجحة أو الشكل ⬅️ الحل والتأويل.
4. التوجيهات الديداكتيكية للأستاذ: شبكة الملاحظة وتدبير عوائق النمذجة الرياضية.`,
            tags: ['ترييض', 'مسائل', 'وضعية ديداكتيكية', 'استدلال'],
            isBuiltIn: true,
            isFavorite: false,
            usageCount: 8,
            createdAt: '2026-09-05T08:00:00Z',
            updatedAt: '2026-09-28T09:00:00Z'
        },
        {
            id: 'tpl_lesson_axes_builder',
            title: 'تصميم جذاذة ومحاور درس تفاعلية وفق المقاربة بالكفايات',
            category: 'lesson_plan',
            categoryLabel: 'الجذاذات والمحاور',
            description: 'هندسة بيداغوجية لمحاور الدرس: الأنشطة الاستكشافية، الصياغة المؤسساتية للقواعد، وتمارين التثبيت.',
            systemInstruction: 'أنت مفتش تربوي في مادة الرياضيات، تساعد الأستاذ على التخطيط الرصين للدروس وتدبير دفتر النصوص باحترافية.',
            promptText: `قم بإعداد تخطيط ديداكتيكي وهندسة محاور متكاملة لدرس: {{topic}} لقسم {{className}} (المستوى: {{level}}).
الغلاف الزمني الإجمالي للدرس: {{duration}}
المكتسبات القبلية الأساسية: {{prerequisites}}

المطلوب تفصيله:
1. القدرات المستهدفة والكفايات الممتدة من التوجيهات التربوية الرسمية.
2. مصفوفة المحاور المتسلسلة (Axes Chronologiques) المناسبة لتدوينها في دفتر النصوص.
3. لكل محور:
   - النشاط الاستكشافي المقترح (مع الهدف الديداكتيكي والمدة).
   - الصياغة الرياضية الدقيقة للخاصية أو المبرهنة (L'institutionnalisation).
   - مثال تطبيقي نموذجي محلول.
   - التمرين التطبيقي الفوري لاختبار الاستيعاب الصفي.
4. مقترح الواجب المنزلي الهادف المرتبط بكل حصة.`,
            tags: ['جذاذة', 'محاور', 'دفتر نصوص', 'تخطيط'],
            isBuiltIn: true,
            isFavorite: false,
            usageCount: 11,
            createdAt: '2026-09-08T08:00:00Z',
            updatedAt: '2026-10-03T14:00:00Z'
        },
        {
            id: 'tpl_student_report_feedback',
            title: 'صياغة ملاحظات تركيبية وبيداغوجية دقيقة لدفاتر التتبع وبيان النقط',
            category: 'student_evaluation',
            categoryLabel: 'الملاحظات والتقارير',
            description: 'صياغة ملاحظات توجيهية محفزة خالية من الوصم السلبي، تحدد مكامن القوة والتوجيهات الدقيقة للتحسن.',
            systemInstruction: 'أنت أستاذ رياضيات تربوي وخبير في التواصل البيداغوجي الإيجابي وصياغة التوجيهات الهادفة على بيانات النقط ومجالس الأقسام.',
            promptText: `اقترح 5 نماذج لملاحظات الأستاذ التوجيهية والتركيبية الخاصة بتلميذ(ة) في المستوى {{level}} (مادة الرياضيات).
بيانات المتعلم(ة):
- الاسم: {{studentName}}
- المعدل المحصل: {{average}} / 20
- طبيعة الأداء والتعثرات الملاحظة: {{strugglingPoints}}

المطلوب:
1. صياغة 3 ملاحظات مقتضبة ملائمة لبطاقة النتائج وبيانات النقط (Bulletin Scolaire).
2. صياغة ملاحظة تركيبية مفصلة موجهة لولي الأمر تتضمن التوصيات العملية للعمل بالمنزل.
3. التوجيه الديداكتيكي الخاص بالاستعداد للفروض القادمة.
(يجب أن تكون الصياغة إيجابية ومحفزة وتركز على السلوك الدراسي وخطوات التحسن).`,
            tags: ['ملاحظات', 'بيان النقط', 'توجيه', 'مجالس الأقسام'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 16,
            createdAt: '2026-09-10T08:00:00Z',
            updatedAt: '2026-10-04T12:00:00Z'
        },
        {
            id: 'tpl_admin_parent_notice',
            title: 'مراسلة إدارية لولي الأمر بشأن الغياب المتكرر وتراجع النتائج في الرياضيات',
            category: 'admin_comm',
            categoryLabel: 'تواصل إداري',
            description: 'صياغة إشعار وتنبيه تربوي وإداري رسمي لولي أمر التلميذ يتضمن رصد حصص الغياب وتدني نقط الفروض مع دعوة لزيارة المؤسسة.',
            systemInstruction: 'أنت أستاذ رياضيات مسؤول وخبير في التواصل التربوي والإداري السليم مع أسر التلاميذ والأطر الإدارية بالمؤسسة.',
            promptText: `قم بصياغة إشعار مراسلة إدارية وتربوية موجهة لولي أمر التلميذ(ة): {{studentName}} المسجل بقسم {{className}} (المستوى: {{level}}).
معطيات الوضعية المرصودة:
- مجموع ساعات الغياب المسجلة: {{strugglingPoints}}
- معدل أو نقطة الفرض الأخير: {{average}} / 20 (الفترة: {{examPeriod}})

عناصر المراسلة الرسمية المطلوبة:
1. ديباجة رسمية ومحترمة تشعر ولي الأمر بالحرص المشترك على مصلحة التلميذ(ة) ومستقبله الدراسي.
2. تبيان دقيق لوضعية المواظبة والغياب غير المبرر وتأثيرها المباشر على التحصيل الرياضي.
3. تفصيل مكامن التعثر في المادة ودعوة الأب/الأم لمرافقة الابن ومتابعة إنجاز واجباته.
4. دعوة للقاء الأستاذ أو الحراسة العامة بالمؤسسة لضبط خطة المواكبة وتوقيع الالتزام.`,
            tags: ['تواصل إداري', 'أولياء الأمور', 'إشعار غياب', 'مراسلات'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 15,
            createdAt: '2026-09-15T08:00:00Z',
            updatedAt: '2026-10-05T10:00:00Z'
        },
        {
            id: 'tpl_admin_council_report',
            title: 'تقرير إداري وتربوي رسمي حول وضعية نتائج القسم والتعثرات لمجلس الانضباط أو الإدارة',
            category: 'admin_comm',
            categoryLabel: 'تواصل إداري',
            description: 'صياغة تقرير تركيبي رسمي مرفوع لإدارة المؤسسة أو المفتش التربوي حول مؤشرات نتائج فروض القسم وحالات التعثر القصوى.',
            systemInstruction: 'أنت أستاذ مادة الرياضيات، تصيغ تقارير إدارية وبيداغوجية رصينة وموضوعية وفق المساطر المعمول بها في وزارة التربية الوطنية.',
            promptText: `قم بصياغة تقرير تربوي وإداري تركيبي حول الوضعية التحصيلية والانضباطية لقسم {{className}} (المستوى: {{level}}).
الفترة التقويمية المستهدفة: {{examPeriod}}
الموضوعات والمفاهيم المعنية: {{topic}}
أبرز الحالات والملاحظات المسجلة:
{{strugglingPoints}}

محاور التقرير الإداري:
1. تشخيص عام لنتائج فروض المراقبة المستمرة (نسبة النجاح، أعلى وأدنى نقطة، والتوجه العام).
2. رصد الحالات الفردية التي تستدعي تدخلاً إدارياً عاجلاً (غياب مزمن، تشويش معرقل، أو انقطاع عن الفروض).
3. الإجراءات البيداغوجية المتخذة من طرف الأستاذ (حصص الدعم، التفييء، التواصل مع الحراسة العامة).
4. التوصيات والمقترحات المرفوعة للإدارة التربوية ولمجلس القسم لتحسين المردودية.`,
            tags: ['تقرير إداري', 'مجالس الأقسام', 'إدارة تربوية', 'مراسلات'],
            isBuiltIn: true,
            isFavorite: false,
            usageCount: 10,
            createdAt: '2026-09-18T08:00:00Z',
            updatedAt: '2026-10-06T11:00:00Z'
        },
        {
            id: 'tpl_lesson_discovery_intro',
            title: 'وضعية انطلاق استكشافية مشوقة لتقديم درس جديد في الرياضيات',
            category: 'lesson_delivery',
            categoryLabel: 'تقديم الدروس',
            description: 'بناء وضعية مشكلة جذابة تحفز الفضول المعرفي وتطرح مفارقة رياضية تقود المتعلمين لاستكشاف المفهوم الجديد.',
            systemInstruction: 'أنت ديداكتيكي متميز في تدريس الرياضيات بالسلك الثانوي التأهيلي، تجيد إثارة شغف المتعلمين عبر وضعيات انطلاق غير تقليدية ونمذجة دقيقة للمفاهيم.',
            promptText: `صمم وضعية انطلاق استكشافية (Situation-Problème Déclenchante) لتقديم درس: {{topic}} لتلاميذ قسم {{className}} (المستوى: {{level}}).
المدة المقترحة للنشاط: 15 إلى 20 دقيقة.
المكتسبات القبلية المفترضة: {{prerequisites}}

المطلوب إعداده ديداكتيكياً:
1. سياق الوضعية: قصة واقعية أو لغز رياضي شيق ومحفز للبحث والتخمين.
2. المهمة الرياضية والتعليمات: صياغة سؤال تحدي محدد يثير نقاشاً صفياً ويدفع لاكتشاف الخاصية أو المبرهنة المستهدفة.
3. التوقعات وتمثلات المتعلمين: العوائق والأخطاء المتوقعة وكيفية استثمارها ديداكتيكياً لبناء التعلم.
4. مرحلة الحوصلة والمأسسة الأولية: الانتقال السلس من الحل التجريبي إلى الصياغة الرياضية الدقيقة للدرس.`,
            tags: ['تقديم الدروس', 'وضعية انطلاق', 'استكشاف', 'ديداكتيك'],
            isBuiltIn: true,
            isFavorite: true,
            usageCount: 13,
            createdAt: '2026-09-20T08:00:00Z',
            updatedAt: '2026-10-07T14:00:00Z'
        }
    ];

    // حالة المكون
    let _activeCategory = 'all';
    let _searchQuery = '';
    let _onlyFavorites = false;
    let _selectedTemplateId = null;
    let _currentVariableValues = {};
    let _lastExecutionResult = null;
    let _isExecutingAI = false;
    let _isGroupedByCategoryView = false;
    try {
        _isGroupedByCategoryView = localStorage.getItem('ai_prompt_grouped_view') === 'true';
    } catch (e) {}

    /**
     * استرجاع كافة القوالب من قاعدة البيانات أو تهيئتها بالافتراضيات
     */
    function getStoredPromptTemplates() {
        if (!window.db) window.db = {};
        if (!Array.isArray(window.db.customPromptTemplates) || window.db.customPromptTemplates.length === 0) {
            window.db.customPromptTemplates = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES));
            if (typeof window.saveDB === 'function') window.saveDB();
        } else {
            // دمج أي قوالب قياسية مدمجة جديدة تلقائياً إذا لم تكن موجودة في التخزين
            let modified = false;
            const existingIds = new Set(window.db.customPromptTemplates.map(t => t.id));
            DEFAULT_PROMPT_TEMPLATES.forEach(defTpl => {
                if (!existingIds.has(defTpl.id)) {
                    window.db.customPromptTemplates.push(JSON.parse(JSON.stringify(defTpl)));
                    modified = true;
                }
            });
            if (modified && typeof window.saveDB === 'function') {
                window.saveDB();
            }
        }
        return window.db.customPromptTemplates;
    }

    /**
     * توليد جدول بيانات مسار نموذجي منسوخ من ملف إكسيل
     */
    function generateSampleMassarExcelData() {
        return [
            ['رقم مسار', 'الاسم والنسب', 'الفرض 1', 'الفرض 2', 'الفرض 3', 'الأنشطة المندمجة', 'المعدل الدوري', 'مجموع ساعات الغياب', 'غياب غير مبرر'],
            ['D135894102', 'ياسين المنصوري', '16.50', '17.00', '15.50', '18.00', '16.75', '0', '0'],
            ['G142098315', 'فاطمة الزهراء العمراني', '14.25', '15.00', '13.50', '16.00', '14.68', '2', '0'],
            ['K130982441', 'محمد أمين التازي', '07.50', '08.00', '06.50', '10.00', '08.00', '8', '6'],
            ['M139044812', 'سارة بنجلون', '18.50', '19.00', '18.00', '19.50', '18.75', '0', '0'],
            ['J134567890', 'حمزة الإدريسي', '05.00', '06.50', '04.00', '08.00', '05.88', '14', '12'],
            ['R140129384', 'مريم الفاسي', '11.00', '12.50', '10.50', '14.00', '12.00', '1', '0'],
            ['D132890123', 'عمر بنكيران', '09.00', '09.50', '08.50', '11.00', '09.50', '6', '4'],
            ['G139821045', 'زينب الوردي', '13.00', '13.50', '12.00', '15.00', '13.38', '0', '0'],
            ['K144019283', 'أنس المرابط', '03.50', '04.00', '03.00', '07.00', '04.38', '18', '16'],
            ['M138402195', 'سلمى العلمي', '15.50', '16.00', '14.50', '17.00', '15.75', '2', '0']
        ].map(row => row.join('\t')).join('\n');
    }

    /**
     * تعبئة بيانات إكسيل مسار النموذجية
     */
    function fillSampleMassarData(targetElementId = null) {
        const sample = generateSampleMassarExcelData();
        _currentVariableValues.excelData = sample;
        if (typeof _testModalVariables !== 'undefined') {
            _testModalVariables.excelData = sample;
        }
        if (targetElementId) {
            const el = document.getElementById(targetElementId);
            if (el) {
                el.value = sample;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        if (typeof renderPromptTemplateDetails === 'function') {
            renderPromptTemplateDetails();
        }
        if (typeof updatePromptTestModalPreview === 'function') {
            updatePromptTestModalPreview();
        }
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم إدراج بيانات جدول مسار إكسيل التجريبية بنجاح 📊', 'success');
        }
    }

    /**
     * استيراد بيانات التلاميذ المسجلين في القسم الحالي وتنسيقها كجدول مسار
     */
    function importActiveStudentsToExcelData(targetElementId = null) {
        let rows = [
            ['رقم مسار', 'الاسم والنسب', 'الفرض 1', 'الفرض 2', 'الفرض 3', 'الأنشطة المندمجة', 'المعدل الدوري', 'مجموع ساعات الغياب', 'غياب غير مبرر']
        ];
        
        let foundStudents = false;
        const activeClass = document.getElementById('lessonLogClassSelect')?.value ||
                           document.getElementById('classSelect')?.value ||
                           (window.db?.classes ? Object.keys(window.db.classes)[0] : '');

        if (activeClass && window.db?.classes && window.db.classes[activeClass]) {
            const classObj = window.db.classes[activeClass];
            const students = Array.isArray(classObj) ? classObj : (classObj.students || []);
            const classGrades = (window.db.grades && window.db.grades[activeClass]) ? window.db.grades[activeClass] : {};
            const allRecords = Array.isArray(window.db.records) ? window.db.records : [];
            if (students.length > 0) {
                students.forEach((st, idx) => {
                    const massarCode = st.massar || st.massarCode || st.id || ('M' + (130000000 + idx * 739));
                    const name = st.name || st.fullName || ('تلميذ ' + (idx + 1));
                    const stGradesRec = classGrades[st.id] || {};
                    const semRec = stGradesRec.s1 || stGradesRec;

                    const pickGrade = (key, fallbackVal) => {
                        if (semRec && semRec[key] !== undefined && semRec[key] !== '' && !isNaN(parseFloat(semRec[key]))) {
                            return Number(parseFloat(semRec[key])).toFixed(2);
                        }
                        return fallbackVal;
                    };

                    const g1 = (st.grades && st.grades[0] !== undefined) ? Number(st.grades[0]).toFixed(2) : pickGrade('f1', (10 + ((idx % 7) * 1.5)).toFixed(2));
                    const g2 = (st.grades && st.grades[1] !== undefined) ? Number(st.grades[1]).toFixed(2) : pickGrade('f2', (11 + ((idx % 6) * 1.4)).toFixed(2));
                    const g3 = (st.grades && st.grades[2] !== undefined) ? Number(st.grades[2]).toFixed(2) : pickGrade('f3', (10.5 + ((idx % 5) * 1.6)).toFixed(2));
                    const act = (st.activityGrade !== undefined) ? Number(st.activityGrade).toFixed(2) : pickGrade('act', '15.00');
                    const avg = ((parseFloat(g1) + parseFloat(g2) + parseFloat(g3) + parseFloat(act)) / 4).toFixed(2);

                    let totalAbsHours = 0;
                    let unexcusedHours = 0;
                    allRecords.forEach(r => {
                        if (r && r.className === activeClass && String(r.studentId) === String(st.id) && r.type !== 'late') {
                            const h = Number(r.hours) || 1;
                            totalAbsHours += h;
                            if (r.status !== 'justified') unexcusedHours += h;
                        }
                    });
                    const abs = st.absenceHours !== undefined ? String(st.absenceHours) : String(totalAbsHours);
                    const unexcused = st.absenceHours !== undefined ? String(Math.floor(parseInt(abs, 10) * 0.7)) : String(unexcusedHours);
                    rows.push([massarCode, name, g1, g2, g3, act, avg, abs, unexcused]);
                });
                foundStudents = true;
            }
        }

        const resultTsv = foundStudents ? rows.map(r => r.join('\t')).join('\n') : generateSampleMassarExcelData();
        _currentVariableValues.excelData = resultTsv;
        if (typeof _testModalVariables !== 'undefined') {
            _testModalVariables.excelData = resultTsv;
        }

        if (targetElementId) {
            const el = document.getElementById(targetElementId);
            if (el) {
                el.value = resultTsv;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        if (typeof renderPromptTemplateDetails === 'function') {
            renderPromptTemplateDetails();
        }
        if (typeof updatePromptTestModalPreview === 'function') {
            updatePromptTestModalPreview();
        }

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(
                foundStudents ? `تم بنجاح تصدير لائحة قسم "${activeClass}" بصيغة إكسيل مسار 📋` : 'تم إدراج بيانات مسار النموذجية (لم يعثر على تلاميذ بالقسم المفتوح)',
                'success'
            );
        }
    }

    /**
     * حفظ مصفوفة القوالب في قاعدة البيانات
     */
    function savePromptTemplatesToDB(templates) {
        if (!window.db) window.db = {};
        window.db.customPromptTemplates = templates;
        if (typeof window.saveDB === 'function') window.saveDB();
    }

    /**
     * استخراج أسماء المتغيرات المحصورة بين {{...}} من نص الأمر
     */
    function extractVariablesFromPrompt(text) {
        if (!text) return [];
        const regex = /\{\{([a-zA-Z0-9_\u0600-\u06FF]+)\}\}/g;
        const matches = new Set();
        let match;
        while ((match = regex.exec(text)) !== null) {
            matches.add(match[1]);
        }
        return Array.from(matches);
    }

    /**
     * فتح نافذة مكتبة وتنظيم قوالب الذكاء الاصطناعي
     */
    function openPromptTemplatesModal(targetCategory = null, prefillVars = {}) {
        const modal = document.getElementById('aiPromptTemplatesModal');
        if (!modal) return;

        if (targetCategory && PROMPT_CATEGORIES.some(c => c.id === targetCategory)) {
            _activeCategory = targetCategory;
        } else {
            _activeCategory = 'all';
        }

        _searchQuery = '';
        _onlyFavorites = false;
        window._onlyFavorites = false;
        _lastExecutionResult = null;
        _currentVariableValues = Object.assign({}, prefillVars);

        // محاولة الاستنتاج التلقائي للمتغيرات الشائعة من السياق الحالي للتطبيق
        autoDetectContextVariables();

        const templates = getStoredPromptTemplates();
        if (templates.length > 0 && !_selectedTemplateId) {
            _selectedTemplateId = templates[0].id;
        }

        modal.style.display = 'flex';
        updateFavoritesToolbarUI();
        renderPromptTemplatesView();

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إغلاق نافذة قوالب الذكاء الاصطناعي
     */
    function closePromptTemplatesModal() {
        const modal = document.getElementById('aiPromptTemplatesModal');
        if (modal) modal.style.display = 'none';
        if (typeof stopPromptVoiceSearch === 'function') {
            stopPromptVoiceSearch();
        }
    }

    /**
     * استنتاج وتعبئة المتغيرات تلقائياً من سياق التطبيق النشط
     */
    function autoDetectContextVariables() {
        const activeClass = document.getElementById('lessonLogClassSelect')?.value ||
                           document.getElementById('classSelect')?.value ||
                           (window.db?.classes ? Object.keys(window.db.classes)[0] : '') || 'القسم';

        if (!_currentVariableValues.className) {
            _currentVariableValues.className = activeClass;
        }

        if (!_currentVariableValues.level) {
            const cLower = activeClass.toLowerCase();
            if (cLower.includes('tcs') || cLower.includes('علمي') || cLower.includes('تكنولوجي')) _currentVariableValues.level = 'الجذع المشترك العلمي والتكنولوجي';
            else if (cLower.includes('tcl') || cLower.includes('آداب') || cLower.includes('إنسانية')) _currentVariableValues.level = 'الجذع المشترك للآداب والعلوم الإنسانية';
            else if (cLower.includes('1bac') && (cLower.includes('sm') || cLower.includes('رياضية'))) _currentVariableValues.level = 'الأولى باكالوريا علوم رياضية';
            else if (cLower.includes('1bac')) _currentVariableValues.level = 'الأولى باكالوريا علوم تجريبية وتكنولوجية';
            else if (cLower.includes('2bac') && (cLower.includes('sm') || cLower.includes('رياضية'))) _currentVariableValues.level = 'الثانية باكالوريا علوم رياضية (أ / ب)';
            else if (cLower.includes('2bac') && (cLower.includes('eco') || cLower.includes('اقتصاد'))) _currentVariableValues.level = 'الثانية باكالوريا علوم اقتصادية وتدبير';
            else if (cLower.includes('2bac')) _currentVariableValues.level = 'الثانية باكالوريا علوم تجريبية (PC / SVT)';
            else _currentVariableValues.level = 'الجذع المشترك العلمي والتكنولوجي';
        }

        if (!_currentVariableValues.topic) {
            _currentVariableValues.topic = 'النهايات والاتصال ودراسة الدوال العددية';
        }

        if (!_currentVariableValues.duration) {
            _currentVariableValues.duration = 'ساعتان (حصة كاملة)';
        }

        if (!_currentVariableValues.examPeriod) {
            _currentVariableValues.examPeriod = 'فرض المراقبة المستمرة الأول - الدورة الأولى';
        }

        if (!_currentVariableValues.strugglingPoints) {
            _currentVariableValues.strugglingPoints = 'أخطاء متكررة في إشارات النشر والتعميل، والخلط بين شروط مبرهنة طاليس المباشرة والعكسية، وصعوبة صياغة البرهان الرياضي الاستنتاجي.';
        }

        if (!_currentVariableValues.prerequisites) {
            _currentVariableValues.prerequisites = 'قواعد الحساب في الأعداد الجذرية، مبرهنة فيتاغورس المباشرة، وحل معادلات الدرجة الأولى بمجهول واحد.';
        }

        if (!_currentVariableValues.semester) {
            _currentVariableValues.semester = 'الدورة الأولى (S1)';
        }

        if (!_currentVariableValues.passThreshold) {
            _currentVariableValues.passThreshold = '10.00';
        }

        if (!_currentVariableValues.absenceThreshold) {
            _currentVariableValues.absenceThreshold = '4';
        }

        if (!_currentVariableValues.academicYear) {
            _currentVariableValues.academicYear = '2025-2026';
        }

        if (!_currentVariableValues.excelData) {
            _currentVariableValues.excelData = generateSampleMassarExcelData();
        }
    }

    /**
     * رسم وتحديث الواجهة الكاملة لمكتبة الأوامر
     */
    function renderPromptTemplatesView() {
        renderCategoryFilterButtons();
        renderPromptTemplatesList();
        renderPromptTemplateDetails();
    }

    /**
     * تبديل نمط العرض: تجميع حسب الفئات أو قائمة مسطحة
     */
    function togglePromptGroupedView() {
        _isGroupedByCategoryView = !_isGroupedByCategoryView;
        try {
            localStorage.setItem('ai_prompt_grouped_view', _isGroupedByCategoryView ? 'true' : 'false');
        } catch (e) {}
        renderPromptTemplatesView();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(_isGroupedByCategoryView ? 'تم تفعيل التجميع المنظم حسب فئات الأوامر 🗂️' : 'تم العودة إلى العرض العادي للقائمة 📋', 'info');
        }
    }
    window.togglePromptGroupedView = togglePromptGroupedView;

    /**
     * فتح نافذة إدارة وتخصيص فئات الأوامر
     */
    function openManagePromptCategoriesModal() {
        let modal = document.getElementById('managePromptCategoriesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'managePromptCategoriesModal';
            modal.className = 'tt-sync-modal-backdrop';
            modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.7); z-index: 10060; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
            modal.innerHTML = `
                <div class="tt-sync-modal-card" style="max-width: 650px; width: 92%; max-height: 88vh; background: #ffffff; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);">
                    <div style="padding: 16px 20px; background: linear-gradient(135deg, #1e1b4b, #312e81); color: #ffffff; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span data-lucide="layers" data-size="20" style="color: #c084fc;"></span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 800;">إدارة وتخصيص فئات قوالب الذكاء الاصطناعي</h4>
                        </div>
                        <button type="button" onclick="window.closeManagePromptCategoriesModal()" style="background: none; border: none; color: #fff; font-size: 1.4rem; cursor: pointer;">&times;</button>
                    </div>
                    <div id="managePromptCategoriesBody" style="padding: 18px 20px; overflow-y: auto; flex: 1;">
                        <!-- يتم التوليد ديناميكياً -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        renderManageCategoriesContent();
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }
    window.openManagePromptCategoriesModal = openManagePromptCategoriesModal;

    function closeManagePromptCategoriesModal() {
        const modal = document.getElementById('managePromptCategoriesModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeManagePromptCategoriesModal = closeManagePromptCategoriesModal;

    function renderManageCategoriesContent() {
        const body = document.getElementById('managePromptCategoriesBody');
        if (!body) return;

        const allCats = getAllPromptCategories().filter(c => c.id !== 'all' && c.id !== 'custom');
        const customCats = getCustomPromptCategories();
        const templates = getStoredPromptTemplates();

        body.innerHTML = `
            <div style="margin-bottom: 18px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px;">
                <h5 style="margin: 0 0 10px 0; font-size: 0.88rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                    <span data-lucide="plus-circle" data-size="16" style="color: #2563eb;"></span>
                    <span>إضافة فئة مخصصة جديدة</span>
                </h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 4px;">اسم الفئة (مثال: أولمبياد الرياضيات):</label>
                        <input type="text" id="newCategoryLabelInput" placeholder="أدخل اسم الفئة..." style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-weight: 600; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 4px;">الأيقونة الرمزية:</label>
                        <select id="newCategoryIconSelect" style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; font-weight: 700; background: #fff; box-sizing: border-box;">
                            <option value="award">🏆 جائزة / أولمبياد (award)</option>
                            <option value="book-open">📖 كتاب / دروس (book-open)</option>
                            <option value="mail">✉️ مراسلة وتواصل (mail)</option>
                            <option value="target">🎯 دعم وهدف (target)</option>
                            <option value="compass">🧭 ديداكتيك وتوجيه (compass)</option>
                            <option value="sparkles">✨ أنشطة وإبداع (sparkles)</option>
                            <option value="file-text">📑 تقارير ووثائق (file-text)</option>
                            <option value="calculator">🧮 حساب وتمارين (calculator)</option>
                            <option value="check-circle-2">✅ تقويم ومراقبة (check-circle-2)</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 4px;">وصف موجز لأهداف الفئة (اختياري):</label>
                    <input type="text" id="newCategoryDescInput" placeholder="وصف محتوى القوالب المندرجة..." style="width: 100%; padding: 7px 10px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-size: 0.8rem; box-sizing: border-box;">
                </div>
                <button type="button" onclick="window.saveNewCustomCategoryFromUI()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; padding: 7px 16px; border-radius: 7px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    <span data-lucide="plus" data-size="14"></span>
                    <span>حفظ الفئة الجديدة</span>
                </button>
            </div>

            <h5 style="margin: 0 0 10px 0; font-size: 0.88rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; justify-content: space-between;">
                <span>قائمة كافة الفئات المتاحة (${allCats.length})</span>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(الفئات الرسمية والمخصصة)</span>
            </h5>

            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${allCats.map(cat => {
                    const count = templates.filter(t => t.category === cat.id).length;
                    const isCustom = cat.isCustom || customCats.some(c => c.id === cat.id);
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; border: 1px solid ${isCustom ? '#bfdbfe' : '#e2e8f0'}; background: ${isCustom ? '#f0f9ff' : '#ffffff'};">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="width: 32px; height: 32px; border-radius: 8px; background: ${isCustom ? '#e0f2fe' : '#f1f5f9'}; color: ${isCustom ? '#0284c7' : '#475569'}; display: inline-flex; align-items: center; justify-content: center;">
                                    <span data-lucide="${cat.icon || 'layers'}" data-size="16"></span>
                                </span>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.84rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                        <span>${cat.label}</span>
                                        ${isCustom ? '<span style="font-size: 0.65rem; background: #bae6fd; color: #0369a1; padding: 1px 6px; border-radius: 4px; font-weight: 700;">مخصصة</span>' : '<span style="font-size: 0.65rem; background: #e2e8f0; color: #475569; padding: 1px 6px; border-radius: 4px;">أساسية</span>'}
                                    </div>
                                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 1px;">${cat.desc || 'فئة تنظيمية لقوالب الرياضيات'}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.74rem; font-weight: 800; color: #475569; background: #e2e8f0; padding: 2px 8px; border-radius: 999px;">${count} قالب</span>
                                ${isCustom ? `
                                    <button type="button" onclick="window.deleteCustomPromptCategory('${cat.id}')" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer;" title="حذف الفئة المخصصة">
                                        حذف
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        if (window.renderLucide) window.renderLucide(body);
    }

    function saveNewCustomCategoryFromUI() {
        const labelInput = document.getElementById('newCategoryLabelInput');
        const iconSelect = document.getElementById('newCategoryIconSelect');
        const descInput = document.getElementById('newCategoryDescInput');

        const label = labelInput?.value?.trim();
        const icon = iconSelect?.value || 'layers';
        const desc = descInput?.value?.trim() || '';

        if (!label) {
            alert('يرجى كتابة اسم الفئة الجديدة.');
            return;
        }

        const customCats = getCustomPromptCategories();
        const id = 'cat_custom_' + Date.now();
        customCats.push({
            id,
            label,
            icon,
            desc,
            isCustom: true
        });

        saveCustomPromptCategories(customCats);
        renderManageCategoriesContent();
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم إنشاء فئة "${label}" بنجاح 📁✨`, 'success');
        }
    }
    window.saveNewCustomCategoryFromUI = saveNewCustomCategoryFromUI;

    function deleteCustomPromptCategory(catId) {
        if (!confirm('هل أنت متأكد من حذف هذه الفئة المخصصة؟ سيتم نقل قوالبها إلى القوالب المخصصة.')) return;

        let customCats = getCustomPromptCategories();
        customCats = customCats.filter(c => c.id !== catId);
        saveCustomPromptCategories(customCats);

        // تحديث القوالب التي كانت تستخدم هذه الفئة
        const templates = getStoredPromptTemplates();
        templates.forEach(t => {
            if (t.category === catId) {
                t.category = 'custom';
                t.categoryLabel = 'قوالبي المخصصة';
            }
        });
        savePromptTemplatesToDB(templates);

        if (_activeCategory === catId) _activeCategory = 'all';

        renderManageCategoriesContent();
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم حذف الفئة المخصصة بنجاح 🗑️', 'info');
        }
    }
    window.deleteCustomPromptCategory = deleteCustomPromptCategory;

    /**
     * رسم أزرار الفئات العلوية وشريط التحكم في التجميع
     */
    function renderCategoryFilterButtons() {
        const container = document.getElementById('promptCategoryFilterContainer');
        if (!container) return;

        const templates = getStoredPromptTemplates();
        const allCategories = getAllPromptCategories();

        const catButtonsHtml = allCategories.map(cat => {
            const isActive = _activeCategory === cat.id;
            let count = 0;
            if (cat.id === 'all') count = templates.length;
            else if (cat.id === 'custom') count = templates.filter(t => !t.isBuiltIn).length;
            else count = templates.filter(t => t.category === cat.id).length;

            return `
                <button type="button" 
                    onclick="window.setPromptActiveCategory('${cat.id}')" 
                    class="prompt-cat-tab-btn ${isActive ? 'active' : ''}"
                    style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; border: 1.5px solid ${isActive ? '#2563eb' : '#cbd5e1'}; background: ${isActive ? '#eff6ff' : '#ffffff'}; color: ${isActive ? '#1d4ed8' : '#475569'}; transition: all 0.15s ease; white-space: nowrap;">
                    <span data-lucide="${cat.icon || 'layers'}" data-size="14"></span>
                    <span>${cat.label}</span>
                    <span style="font-size: 0.7rem; opacity: 0.85; margin-right: 2px;">(${count})</span>
                </button>
            `;
        }).join('');

        const toolbarControlsHtml = `
            <div style="display: flex; align-items: center; gap: 6px; margin-right: auto; padding-right: 10px; border-right: 1.5px solid #e2e8f0;">
                <button type="button" 
                    onclick="window.togglePromptGroupedView()" 
                    style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${_isGroupedByCategoryView ? '#7c3aed' : '#cbd5e1'}; background: ${_isGroupedByCategoryView ? '#f5f3ff' : '#ffffff'}; color: ${_isGroupedByCategoryView ? '#6d28d9' : '#475569'}; transition: all 0.15s ease;"
                    title="تجميع وترتيب القوالب وفق الفئات لتسهيل تصفحها وتنظيمها">
                    <span data-lucide="layers" data-size="14"></span>
                    <span>${_isGroupedByCategoryView ? 'عرض مجمّع بالفئات (نشط) 🗂️' : 'تجميع حسب الفئات 🗂️'}</span>
                </button>
                <button type="button" 
                    onclick="window.openManagePromptCategoriesModal()" 
                    style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; border: 1.5px solid #cbd5e1; background: #ffffff; color: #334155;"
                    title="إدارة وتخصيص الفئات (إضافة فئات جديدة، حذف وتعديل)">
                    <span data-lucide="settings" data-size="14"></span>
                    <span>تخصيص الفئات ⚙️</span>
                </button>
            </div>
        `;

        container.innerHTML = toolbarControlsHtml + catButtonsHtml;

        if (window.renderLucide) window.renderLucide(container);
    }

    /**
     * تعيين الفئة النشطة
     */
    function setPromptActiveCategory(catId) {
        _activeCategory = catId;
        renderPromptTemplatesView();
    }

    // تنظيف وتوحيد النصوص العربية للبحث والتعرف الصوتي
    function normalizeArabicText(str) {
        if (!str) return '';
        return String(str)
            .trim()
            .toLowerCase()
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/[ة]/g, 'ه')
            .replace(/[ى]/g, 'ي')
            .replace(/[ًٌٍَُِّْ]/g, '')
            .replace(/[^\u0600-\u06FFa-zA-Z0-9\s/_-]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    /**
     * تصفية القوالب وفق المعايير الحالية
     */
    function getFilteredTemplates() {
        const templates = getStoredPromptTemplates();
        const rawQ = (window._searchQuery !== undefined ? window._searchQuery : _searchQuery) || '';
        const q = normalizeArabicText(rawQ);

        return templates.filter(tpl => {
            // تصفية حسب الفئة
            if (!_isGroupedByCategoryView || _activeCategory !== 'all') {
                if (_activeCategory === 'custom') {
                    if (tpl.isBuiltIn) return false;
                } else if (_activeCategory !== 'all') {
                    if (tpl.category !== _activeCategory) return false;
                }
            }

            // تصفية المفضلة فقط
            if (_onlyFavorites && !tpl.isFavorite) {
                return false;
            }

            // تصفية البحث النصي
            if (q) {
                const inTitle = normalizeArabicText(tpl.title || '').includes(q);
                const inDesc = normalizeArabicText(tpl.description || '').includes(q);
                const inPrompt = normalizeArabicText(tpl.promptText || '').includes(q);
                const inTags = Array.isArray(tpl.tags) && tpl.tags.some(t => normalizeArabicText(t || '').includes(q));
                if (!inTitle && !inDesc && !inPrompt && !inTags) return false;
            }

            return true;
        });
    }

    /**
     * توليد بطاقة قالب فردية
     */
    function renderSingleTemplateCard(tpl) {
        const isSelected = tpl.id === _selectedTemplateId;
        const vars = extractVariablesFromPrompt(tpl.promptText);

        return `
            <div onclick="window.selectPromptTemplate('${tpl.id}')"
                class="prompt-card-item ${isSelected ? 'selected' : ''}"
                style="padding: 12px 14px; border-radius: 10px; border: 1.5px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}; background: ${isSelected ? '#f8fafc' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease; box-shadow: ${isSelected ? '0 3px 10px rgba(59, 130, 246, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)'}; display: flex; flex-direction: column; gap: 6px;">
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <h4 style="margin: 0; font-size: 0.88rem; font-weight: 800; color: ${isSelected ? '#1e40af' : '#0f172a'}; line-height: 1.4; flex: 1;">
                        ${escapeHtml(tpl.title)}
                    </h4>
                    <button type="button" 
                        onclick="event.stopPropagation(); window.togglePromptFavorite('${tpl.id}')"
                        style="background: ${tpl.isFavorite ? '#fef3c7' : 'transparent'}; border: 1px solid ${tpl.isFavorite ? '#fde68a' : 'transparent'}; border-radius: 6px; cursor: pointer; color: ${tpl.isFavorite ? '#f59e0b' : '#94a3b8'}; padding: 3px 5px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s ease;"
                        title="${tpl.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة ⭐'}">
                        <span data-lucide="star" data-size="16" ${tpl.isFavorite ? 'style="fill: #f59e0b; color: #f59e0b;"' : ''}></span>
                    </button>
                </div>

                <p style="margin: 0; font-size: 0.76rem; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${escapeHtml(tpl.description || '')}
                </p>

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: #64748b; margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-weight: 700; color: #2563eb;">${tpl.categoryLabel || tpl.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>${vars.length} متغيرات</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px; font-weight: 600;">
                        <span data-lucide="check-check" data-size="12"></span>
                        <span>استُعمل ${tpl.usageCount || 0} مرة</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * رسم قائمة بطاقات القوالب في العمود الأيمن (مع دعم التجميع حسب الفئات)
     */
    function renderPromptTemplatesList() {
        const listContainer = document.getElementById('promptTemplatesList');
        if (!listContainer) return;

        const filtered = getFilteredTemplates();

        if (filtered.length === 0) {
            if (_onlyFavorites) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 35px 15px; color: #64748b;">
                        <div style="font-size: 2.2rem; margin-bottom: 8px;">⭐</div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #334155; margin-bottom: 4px;">لا توجد قوالب في المفضلة حالياً</div>
                        <div style="font-size: 0.78rem; line-height: 1.5; color: #64748b;">انقر على أيقونة النجمة ⭐ بجانب أي أمر لإضافته إلى قائمة الوصول السريع المفضلة.</div>
                        <button type="button" onclick="window.togglePromptFavoritesFilter()" style="margin-top: 14px; background: #fef3c7; color: #92400e; border: 1.5px solid #f59e0b; padding: 6px 14px; border-radius: 7px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">
                            عرض كافة القوالب
                        </button>
                    </div>
                `;
            } else {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 35px 15px; color: #64748b;">
                        <div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #334155; margin-bottom: 4px;">لم يتم العثور على قوالب مطابقة</div>
                        <div style="font-size: 0.78rem; line-height: 1.5;">جرب تعديل كلمات البحث أو اختيار فئة أخرى، أو أنشئ قالباً مخصصاً جديداً.</div>
                        <button type="button" onclick="window.openCreatePromptTemplateModal()" style="margin-top: 14px; background: #2563eb; color: #fff; border: none; padding: 7px 14px; border-radius: 7px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
                            + إنشاء قالب جديد الآن
                        </button>
                    </div>
                `;
            }
            return;
        }

        // إذا كان القالب المختار غير موجود في القائمة المصفاة، اختر الأول
        if (!_selectedTemplateId || !filtered.some(t => t.id === _selectedTemplateId)) {
            _selectedTemplateId = filtered[0].id;
        }

        // إذا كان نمط التجميع حسب الفئات مفعلاً وفي وضع عرض كافة القوالب
        if (_isGroupedByCategoryView && _activeCategory === 'all') {
            const allCats = getAllPromptCategories().filter(c => c.id !== 'all' && c.id !== 'custom');
            let groupedHtml = '';

            allCats.forEach(cat => {
                const catTemplates = filtered.filter(t => t.category === cat.id);
                if (catTemplates.length > 0) {
                    groupedHtml += `
                        <div class="prompt-category-group" style="margin-bottom: 12px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                            <div style="background: linear-gradient(to left, #f8fafc, #f1f5f9); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0;">
                                <div style="display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 0.82rem; color: #1e293b;">
                                    <span data-lucide="${cat.icon || 'layers'}" data-size="15" style="color: #4f46e5;"></span>
                                    <span>${cat.label}</span>
                                    ${cat.isCustom ? '<span style="font-size: 0.65rem; background: #dbeafe; color: #1e40af; padding: 1px 5px; border-radius: 4px; font-weight: 700;">مخصصة</span>' : ''}
                                </div>
                                <span style="font-size: 0.72rem; font-weight: 800; background: #e2e8f0; color: #334155; padding: 1px 7px; border-radius: 999px;">${catTemplates.length}</span>
                            </div>
                            <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                                ${catTemplates.map(tpl => renderSingleTemplateCard(tpl)).join('')}
                            </div>
                        </div>
                    `;
                }
            });

            // القوالب المخصصة أو الأخرى التي لا تنتمي للفئات أعلاه
            const customOrOtherTemplates = filtered.filter(t => !allCats.some(c => c.id === t.category));
            if (customOrOtherTemplates.length > 0) {
                groupedHtml += `
                    <div class="prompt-category-group" style="margin-bottom: 12px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                        <div style="background: linear-gradient(to left, #f8fafc, #f1f5f9); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0;">
                            <div style="display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 0.82rem; color: #1e293b;">
                                <span data-lucide="user" data-size="15" style="color: #059669;"></span>
                                <span>قوالبي المخصصة وأخرى</span>
                            </div>
                            <span style="font-size: 0.72rem; font-weight: 800; background: #e2e8f0; color: #334155; padding: 1px 7px; border-radius: 999px;">${customOrOtherTemplates.length}</span>
                        </div>
                        <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                            ${customOrOtherTemplates.map(tpl => renderSingleTemplateCard(tpl)).join('')}
                        </div>
                    </div>
                `;
            }

            listContainer.innerHTML = groupedHtml || '<div style="text-align: center; padding: 20px; color: #64748b;">لا توجد قوالب</div>';
        } else {
            // العرض المسطح المباشر
            listContainer.innerHTML = filtered.map(tpl => renderSingleTemplateCard(tpl)).join('');
        }

        if (window.renderLucide) window.renderLucide(listContainer);
    }

    /**
     * اختيار قالب واستعراض تفاصيله وإمكانية ملء متغيراته وتجربته
     */
    function selectPromptTemplate(templateId) {
        _selectedTemplateId = templateId;
        _lastExecutionResult = null;
        renderPromptTemplatesList();
        renderPromptTemplateDetails();
    }

    /**
     * رسم العمود الأيسر (تفاصيل القالب، ملء المتغيرات، المعاينة الحية، وأزرار التنفيذ والنسخ)
     */
    function renderPromptTemplateDetails() {
        const detailsContainer = document.getElementById('promptTemplateDetailsView');
        if (!detailsContainer) return;

        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _selectedTemplateId);

        if (!tpl) {
            detailsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
                    <div style="font-size: 2.2rem; margin-bottom: 10px;">📋</div>
                    <div style="font-weight: 800; font-size: 1rem; color: #475569;">اختر قالباً من القائمة للاستعراض والتخصيص والنسخ</div>
                </div>
            `;
            return;
        }

        const variables = extractVariablesFromPrompt(tpl.promptText);
        const renderedText = renderPromptTextWithVariables(tpl.promptText);

        const variablesInputsHtml = variables.length > 0 ? `
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 800; font-size: 0.82rem; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
                        <span data-lucide="sliders" data-size="14"></span>
                        <span>تخصيص المتغيرات في هذا الأمر (Dynamic Variables):</span>
                    </div>
                    <button type="button" onclick="window.autoFillPromptVariablesFromActiveContext()" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="استيراد المعطيات تلقائياً من القسم المفتوح حالياً">
                        🔄 استيراد من القسم النشط
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px;">
                    ${variables.map(v => {
                        const val = _currentVariableValues[v] || '';
                        const varMeta = COMMON_PROMPT_VARIABLES.find(cv => cv.key === v) || { label: v, desc: '' };
                        if (v === 'excelData') {
                            return `
                                <div style="grid-column: 1 / -1; background: #ffffff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 10px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                                        <label style="font-size: 0.76rem; font-weight: 800; color: #1e40af; display: flex; align-items: center; gap: 5px;">
                                            <span>📊 {{excelData}}:</span>
                                            <span>${escapeHtml(varMeta.label)} (جدول منسوخ مباشرة من Excel أو مسار)</span>
                                        </label>
                                        <div style="display: flex; gap: 6px;">
                                            <button type="button" onclick="window.fillSampleMassarData('promptVarInput_${v}')" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="تعبئة جدول نموذج مسار للتجربة الفورية">
                                                📊 تعبئة نموذج إكسيل مسار
                                            </button>
                                            <button type="button" onclick="window.importActiveStudentsToExcelData('promptVarInput_${v}')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="توليد جدول مسار من تلاميذ القسم النشط">
                                                👥 استيراد تلاميذ القسم
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        id="promptVarInput_${v}"
                                        rows="6"
                                        oninput="window.onPromptVariableChange('${v}', this.value)"
                                        placeholder="${escapeQuotes(varMeta.desc || 'الصق جدول الإكسيل هنا...')}"
                                        style="width: 100%; padding: 8px; border-radius: 6px; border: 1.5px solid #cbd5e1; font-family: monospace, 'Courier New', sans-serif; font-size: 0.78rem; line-height: 1.45; background: #fafafa; color: #0f172a; resize: vertical; box-sizing: border-box; white-space: pre;">${escapeHtml(val)}</textarea>
                                    <div style="font-size: 0.7rem; color: #64748b; margin-top: 3px;">
                                        💡 نصيحة: يمكنك تحديد الخلايا مباشرة من ملف Excel لمسار ونسخها (Ctrl+C) ولصقها هنا (Ctrl+V) بدون أي تعديل.
                                    </div>
                                </div>
                            `;
                        }
                        return `
                            <div>
                                <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 2px;">
                                    {{${escapeHtml(v)}}}: <span style="font-weight: 600; color: #1e293b;">${escapeHtml(varMeta.label)}</span>
                                </label>
                                <input type="text" 
                                    id="promptVarInput_${v}"
                                    value="${escapeQuotes(val)}" 
                                    oninput="window.onPromptVariableChange('${v}', this.value)"
                                    placeholder="${escapeQuotes(varMeta.desc || 'أدخل القيمة...')}"
                                    style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 600; background: #ffffff;">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        detailsContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
                
                <!-- رأس تفاصيل القالب -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #0f172a;">${escapeHtml(tpl.title)}</h3>
                            <span style="font-size: 0.72rem; font-weight: 800; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 6px;">
                                ${tpl.categoryLabel || tpl.category}
                            </span>
                            ${tpl.isBuiltIn ? '<span style="font-size: 0.7rem; color: #059669; font-weight: 700;">(قالب قياسي معتمد)</span>' : '<span style="font-size: 0.7rem; color: #7c3aed; font-weight: 700;">(قالبك الخاص)</span>'}
                        </div>
                        <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #64748b; line-height: 1.45;">
                            ${escapeHtml(tpl.description || '')}
                        </p>
                    </div>

                    <!-- أزرار الإجراءات الإدارية على القالب -->
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <!-- زر النجمة للمفضلة داخل تفاصيل القالب -->
                        <button type="button" 
                            onclick="window.togglePromptFavorite('${tpl.id}')" 
                            class="btn-math-chip" 
                            style="padding: 5px 11px; font-size: 0.76rem; background: ${tpl.isFavorite ? '#fef3c7' : '#ffffff'}; border-color: ${tpl.isFavorite ? '#f59e0b' : '#cbd5e1'}; color: ${tpl.isFavorite ? '#92400e' : '#475569'}; font-weight: 800;" 
                            title="${tpl.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة ⭐'}">
                            <span data-lucide="star" data-size="13" ${tpl.isFavorite ? 'style="fill: #f59e0b; color: #f59e0b;"' : 'style="color: #64748b;"'}></span>
                            <span>${tpl.isFavorite ? 'مفضل ⭐' : 'نجمة مفضلة'}</span>
                        </button>
                        <!-- زر تجربة سريع علوي -->
                        <button type="button" 
                            onclick="window.openPromptTestModal('${tpl.id}')" 
                            class="btn-math-chip" 
                            style="padding: 5px 11px; font-size: 0.76rem; background: #ecfdf5; border-color: #6ee7b7; color: #065f46; font-weight: 800;" 
                            title="فتح نافذة منبثقة بسيطة لتعبئة المتغيرات وتجربة الأمر">
                            <span data-lucide="play-circle" data-size="13"></span>
                            <span>تجربة 🧪</span>
                        </button>
                        <button type="button" onclick="window.duplicatePromptTemplate('${tpl.id}')" class="btn-math-chip" style="padding: 5px 10px; font-size: 0.76rem;" title="تكرار وإنشاء نسخة مخصصة من هذا القالب">
                            <span data-lucide="copy" data-size="13"></span>
                            <span>نسخ كقالب مخصص</span>
                        </button>
                        <button type="button" onclick="window.openEditPromptTemplateModal('${tpl.id}')" class="btn-math-chip" style="padding: 5px 10px; font-size: 0.76rem;" title="تعديل هذا القالب">
                            <span data-lucide="edit-3" data-size="13"></span>
                            <span>تعديل</span>
                        </button>
                        ${!tpl.isBuiltIn ? `
                            <button type="button" onclick="window.deletePromptTemplate('${tpl.id}')" class="btn-math-chip" style="padding: 5px 10px; font-size: 0.76rem; color: #dc2626; border-color: #fecaca;" title="حذف القالب المخصص">
                                <span data-lucide="trash-2" data-size="13"></span>
                                <span>حذف</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- سياق الدور والنظام (System Prompt) إذا كان محدداً -->
                ${tpl.systemInstruction ? `
                    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 8px 12px; font-size: 0.78rem;">
                        <strong style="color: #6b21a8;">🧠 السياق ودور الذكاء الاصطناعي (System Role):</strong>
                        <div style="color: #475569; margin-top: 2px;">${escapeHtml(tpl.systemInstruction)}</div>
                    </div>
                ` : ''}

                <!-- حقول تعبئة المتغيرات الديناميكية -->
                ${variablesInputsHtml}

                <!-- صندوق معاينة الأمر المولد والجاهز للنسخ أو التنفيذ -->
                <div style="display: flex; flex-direction: column; flex: 1; min-height: 180px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 800; font-size: 0.82rem; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="terminal" data-size="14"></span>
                            <span>نص الأمر بعد تعويض المتغيرات (Ready Prompt):</span>
                        </span>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.74rem; color: #64748b;">
                            <span>${renderedText.length} حرف</span>
                            <span aria-hidden="true">·</span>
                            <span>~${Math.round(renderedText.length / 4)} رمز (Tokens)</span>
                        </div>
                    </div>
                    <textarea id="promptRenderedOutput" readonly style="width: 100%; flex: 1; min-height: 140px; padding: 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #0f172a; font-family: 'Cairo', system-ui, sans-serif; font-size: 0.84rem; line-height: 1.6; resize: vertical; box-sizing: border-box;">${escapeHtml(renderedText)}</textarea>
                </div>

                <!-- شريط أزرار الإجراءات السريعة (تجربة، نسخ، تشغيل بالذكاء) -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1.5px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <!-- زر 'تجربة' داخل تفاصيل القالب يفتح نافذة منبثقة بسيطة تتيح للمستخدم تعبئة المتغيرات ورؤية كيف سيبدو الأمر النهائي قبل نسخه -->
                        <button type="button" 
                            onclick="window.openPromptTestModal('${tpl.id}')" 
                            class="btn-primary" 
                            style="background: linear-gradient(135deg, #059669, #047857); border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(5,150,105,0.25); color: #fff; cursor: pointer;" 
                            title="فتح نافذة منبثقة بسيطة لتعبئة المتغيرات {{...}} ومعاينة كيف سيبدو الأمر النهائي قبل نسخه">
                            <span data-lucide="play-circle" data-size="16"></span>
                            <span>تجربة 🧪</span>
                        </button>

                        <!-- زر النسخ الرئيسي للمتغيرات المعوضة -->
                        <button type="button" onclick="window.copyRenderedPrompt()" class="btn-primary" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(37,99,235,0.25); cursor: pointer;" title="نسخ نص الأمر كاملاً بعد تعويض المتغيرات للصقه في AI Studio أو ChatGPT">
                            <span data-lucide="copy" data-size="15"></span>
                            <span>نسخ الأمر المعوض 📋</span>
                        </button>

                        <!-- زر تشغيل وتجربة الأمر فورياً عبر الذكاء الاصطناعي -->
                        <button type="button" id="btnRunPromptWithAI" onclick="window.runPromptWithAI()" class="btn-primary" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border: none; padding: 8px 18px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(124,58,237,0.28); color: #fff; cursor: pointer;" title="تشغيل الأمر مباشرة باستخدام محرك الذكاء الاصطناعي وعرض النتيجة التفاعلية">
                            <span data-lucide="sparkles" data-size="15"></span>
                            <span>تجربة وتشغيل بالأمر ⚡</span>
                        </button>

                        <!-- نسخ القالب الخام مع الأقواس -->
                        <button type="button" onclick="window.copyRawTemplatePrompt()" class="btn-secondary" style="background: #ffffff; border: 1.5px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer;" title="نسخ القالب بصيغته الأصلية المتضمنة أسماء المتغيرات {{}}">
                            <span data-lucide="code" data-size="14"></span>
                            <span>نسخ القالب الخام</span>
                        </button>
                    </div>

                    <!-- إشارات العلامات والكلمات المفتاحية -->
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${(tpl.tags || []).map(t => `<span style="font-size: 0.7rem; color: #475569; background: #f1f5f9; padding: 2px 7px; border-radius: 4px; font-weight: 600;">#${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>

                <!-- لوحة استعراض نتيجة تشغيل الذكاء الاصطناعي (AI Output Panel) -->
                <div id="promptAiExecutionResultPanel" style="${_lastExecutionResult ? 'display: block;' : 'display: none;'} margin-top: 10px; background: #ffffff; border: 1.5px solid #d8b4fe; border-radius: 10px; padding: 14px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f3e8ff; padding-bottom: 6px;">
                        <span style="font-weight: 800; font-size: 0.85rem; color: #6b21a8; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="bot" data-size="16"></span>
                            <span>استجابة الذكاء الاصطناعي للأمر المخصص:</span>
                        </span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <button type="button" onclick="window.copyPromptAiExecutionResult()" style="background: #faf5ff; color: #7c3aed; border: 1px solid #d8b4fe; border-radius: 6px; padding: 4px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
                                نسخ النتيجة 📋
                            </button>
                            <button type="button" onclick="document.getElementById('promptAiExecutionResultPanel').style.display='none'" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 1.1rem;">✕</button>
                        </div>
                    </div>
                    <div id="promptAiExecutionOutputText" style="max-height: 250px; overflow-y: auto; font-size: 0.84rem; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
                        ${_lastExecutionResult ? escapeHtml(_lastExecutionResult) : ''}
                    </div>
                </div>

            </div>
        `;

        if (window.renderLucide) window.renderLucide(detailsContainer);
    }

    /**
     * استبدال المتغيرات في نص القالب بالقيم الحالية المدخلة
     */
    function renderPromptTextWithVariables(text) {
        if (!text) return '';
        let output = text;
        const variables = extractVariablesFromPrompt(text);
        variables.forEach(v => {
            const val = _currentVariableValues[v] || `{{${v}}}`;
            output = output.split(`{{${v}}}`).join(val);
        });
        return output;
    }

    /**
     * معالج تغيير قيمة متغير في الواجهة
     */
    function onPromptVariableChange(varName, value) {
        _currentVariableValues[varName] = value;
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _selectedTemplateId);
        if (!tpl) return;

        const rendered = renderPromptTextWithVariables(tpl.promptText);
        const outputEl = document.getElementById('promptRenderedOutput');
        if (outputEl) outputEl.value = rendered;
    }

    /**
     * استيراد المتغيرات تلقائياً من سياق القسم المفتوح
     */
    function autoFillPromptVariablesFromActiveContext() {
        autoDetectContextVariables();
        renderPromptTemplateDetails();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم بنجاح تحديث المتغيرات من معطيات القسم النشط 🔄', 'info');
        }
    }

    /**
     * نسخ الأمر بعد تعويض المتغيرات للحافظة
     */
    function copyRenderedPrompt() {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _selectedTemplateId);
        if (!tpl) return;

        const text = renderPromptTextWithVariables(tpl.promptText);
        navigator.clipboard.writeText(text).then(() => {
            tpl.usageCount = (tpl.usageCount || 0) + 1;
            tpl.lastUsedAt = new Date().toISOString();
            savePromptTemplatesToDB(templates);
            renderPromptTemplatesList();

            if (typeof window.showAppToast === 'function') {
                window.showAppToast(`تم بنجاح نسخ أمر "${tpl.title}" جاهزاً للحافظة 📋`, 'success');
            } else {
                alert('تم نسخ نص الأمر بنجاح!');
            }
        }).catch(() => {
            alert('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.');
        });
    }

    /**
     * نسخ القالب الخام مع الأقواس
     */
    function copyRawTemplatePrompt() {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _selectedTemplateId);
        if (!tpl) return;

        navigator.clipboard.writeText(tpl.promptText).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ القالب الخام مع المتغيرات 📋', 'info');
            }
        });
    }

    /**
     * تشغيل وتجربة الأمر مباشرة عبر الذكاء الاصطناعي (Gemini)
     */
    async function runPromptWithAI() {
        if (_isExecutingAI) return;
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _selectedTemplateId);
        if (!tpl) return;

        const promptText = renderPromptTextWithVariables(tpl.promptText);
        const btn = document.getElementById('btnRunPromptWithAI');
        const resultPanel = document.getElementById('promptAiExecutionResultPanel');
        const outputEl = document.getElementById('promptAiExecutionOutputText');

        _isExecutingAI = true;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span><span>جاري المعالجة الذكية...</span>';
        }

        if (resultPanel) resultPanel.style.display = 'block';
        if (outputEl) outputEl.innerHTML = '<div style="color: #64748b; text-align: center; padding: 15px;">جاري تشغيل محرك الذكاء الاصطناعي لمعالجة هذا الأمر المخصص... ⏳</div>';

        try {
            const res = await fetch('/api/ai/run-custom-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptText,
                    systemInstruction: tpl.systemInstruction || '',
                    taskCategory: tpl.category || 'general'
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'تعذر الحصول على استجابة من الذكاء الاصطناعي');
            }

            const data = await res.json();
            const resultText = data.result || 'تم استلام الاستجابة ولكن بدون محتوى.';
            _lastExecutionResult = resultText;

            tpl.usageCount = (tpl.usageCount || 0) + 1;
            tpl.lastUsedAt = new Date().toISOString();
            savePromptTemplatesToDB(templates);
            renderPromptTemplatesList();

            if (outputEl) outputEl.innerText = resultText;
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم توليد الاستجابة بنجاح عبر محرك الذكاء الاصطناعي ✨', 'success');
            }
        } catch (e) {
            console.warn('Warning running custom prompt with AI:', e);
            if (outputEl) {
                outputEl.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px; border-radius: 6px;">
                        <strong>⚠️ تنبيه:</strong> ${escapeHtml(e.message || 'حدث خطأ أثناء الاتصال بخدمة الذكاء الاصطناعي')}.<br>
                        <span style="font-size: 0.76rem;">يمكنك نسخ الأمر المخصص واستخدامه مباشرة في أي منصة ذكاء اصطناعي تفضلها.</span>
                    </div>
                `;
            }
        } finally {
            _isExecutingAI = false;
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span data-lucide="sparkles" data-size="15"></span><span>تجربة وتشغيل بالأمر ⚡</span>';
                if (window.renderLucide) window.renderLucide(btn);
            }
        }
    }

    /**
     * نسخ نتيجة استجابة الذكاء الاصطناعي
     */
    function copyPromptAiExecutionResult() {
        if (!_lastExecutionResult) return;
        navigator.clipboard.writeText(_lastExecutionResult).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ نتيجة الاستجابة بنجاح 📋', 'success');
            }
        });
    }

    /**
     * تبديل حالة المفضلة لقالب معين وتحديث كافة واجهات العرض
     */
    function togglePromptFavorite(id) {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === id);
        if (tpl) {
            tpl.isFavorite = !tpl.isFavorite;
            savePromptTemplatesToDB(templates);
            updateFavoritesToolbarUI();
            renderPromptTemplatesList();
            renderCategoryFilterButtons();
            
            // تحديث بطاقة التفاصيل إذا كان هذا القالب هو المعروض حالياً
            if (_selectedTemplateId === id) {
                renderPromptTemplateDetails();
            }

            if (typeof window.showAppToast === 'function') {
                window.showAppToast(
                    tpl.isFavorite ? `تمت إضافة "${tpl.title}" إلى قائمة المفضلة ⭐` : `تمت إزالة "${tpl.title}" من المفضلة`,
                    tpl.isFavorite ? 'success' : 'info'
                );
            }
        }
    }

    /**
     * تبديل وضع عرض القوالب المفضلة فقط لسرعة الوصول
     */
    function togglePromptFavoritesFilter() {
        _onlyFavorites = !_onlyFavorites;
        window._onlyFavorites = _onlyFavorites;
        updateFavoritesToolbarUI();
        renderPromptTemplatesList();
        renderCategoryFilterButtons();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(
                _onlyFavorites ? 'تم تفعيل عرض القوالب المفضلة فقط ⭐' : 'تم إلغاء تصفية المفضلة وعرض كافة القوالب',
                'info'
            );
        }
    }

    /**
     * تحديث شكل وعداد زر المفضلة في الشريط العلوي للمكتبة
     */
    function updateFavoritesToolbarUI() {
        const btn = document.getElementById('btnTogglePromptFavorites');
        const badge = document.getElementById('badgeTogglePromptFavorites');
        const label = document.getElementById('labelTogglePromptFavorites');
        const icon = document.getElementById('iconTogglePromptFavorites');
        const templates = getStoredPromptTemplates();
        const favCount = templates.filter(t => t.isFavorite).length;

        if (badge) badge.textContent = favCount;

        if (btn) {
            if (_onlyFavorites) {
                btn.style.background = 'linear-gradient(135deg, #fef3c7, #fde68a)';
                btn.style.borderColor = '#f59e0b';
                btn.style.color = '#78350f';
                btn.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.25)';
                if (label) label.textContent = 'المفضلة فقط ⭐';
                if (icon) icon.style.fill = '#f59e0b';
            } else {
                btn.style.background = '#ffffff';
                btn.style.borderColor = '#cbd5e1';
                btn.style.color = '#b45309';
                btn.style.boxShadow = 'none';
                if (label) label.textContent = 'المفضلة';
                if (icon) icon.style.fill = '#f59e0b';
            }
        }
    }

    // ==========================================
    // نافذة تجربة القالب ومعاينة المتغيرات (Test Modal Logic)
    // ==========================================
    let _testModalTemplateId = null;
    let _testModalVariables = {};

    /**
     * فتح نافذة منبثقة بسيطة لتجربة القالب وتعبئة المتغيرات {{...}} ومعاينة الأمر النهائي
     */
    function openPromptTestModal(templateId = null) {
        const templates = getStoredPromptTemplates();
        const targetId = templateId || _selectedTemplateId;
        const tpl = templates.find(t => t.id === targetId);
        if (!tpl) return;

        _testModalTemplateId = tpl.id;
        const modal = document.getElementById('promptTestVariableModal');
        if (!modal) return;

        // تحديث الرأس والشارة
        const titleEl = document.getElementById('promptTestModalTitle');
        if (titleEl) titleEl.textContent = `تجربة القالب: ${tpl.title}`;

        const catBadge = document.getElementById('promptTestModalCategoryBadge');
        if (catBadge) catBadge.textContent = tpl.categoryLabel || tpl.category;

        const descBox = document.getElementById('promptTestModalDescBox');
        if (descBox) {
            descBox.innerHTML = `
                <div style="font-weight: 800; margin-bottom: 2px; color: #14532d; display: flex; align-items: center; gap: 6px;">
                    <span data-lucide="target" data-size="14"></span>
                    <span>الهدف والمحددات البيداغوجية:</span>
                </div>
                <div>${escapeHtml(tpl.description || 'قالب بيداغوجي مخصص لمادة الرياضيات وفق المنهاج المغربي.')}</div>
                ${tpl.systemInstruction ? `
                    <div style="margin-top: 5px; font-size: 0.74rem; color: #15803d; opacity: 0.95;">
                        <strong>سياق الذكاء الاصطناعي (System Prompt):</strong> ${escapeHtml(tpl.systemInstruction)}
                    </div>
                ` : ''}
            `;
        }

        // استخراج المتغيرات المحصورة بين {{...}}
        const vars = extractVariablesFromPrompt(tpl.promptText);
        _testModalVariables = Object.assign({}, _currentVariableValues);

        // تجهيز شبكة حقول الإدخال
        const grid = document.getElementById('promptTestVariablesGrid');
        const emptyNotice = document.getElementById('promptTestNoVariablesNotice');

        if (vars.length === 0) {
            if (grid) grid.innerHTML = '';
            if (emptyNotice) emptyNotice.style.display = 'block';
        } else {
            if (emptyNotice) emptyNotice.style.display = 'none';
            if (grid) {
                grid.innerHTML = vars.map(v => {
                    const currentVal = _testModalVariables[v] || '';
                    const meta = COMMON_PROMPT_VARIABLES.find(cv => cv.key === v) || { label: v, desc: '' };
                    if (v === 'excelData') {
                        return `
                            <div style="grid-column: 1 / -1; background: #ffffff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                                    <label style="font-size: 0.78rem; font-weight: 800; color: #1e40af; display: flex; align-items: center; gap: 5px;">
                                        <span>📊 {{excelData}}:</span>
                                        <span>${escapeHtml(meta.label)} (جدول إكسيل مسار)</span>
                                    </label>
                                    <div style="display: flex; gap: 6px;">
                                        <button type="button" onclick="window.fillSampleMassarData('testVarInput_${v}')" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                                            📊 تعبئة نموذج إكسيل مسار
                                        </button>
                                        <button type="button" onclick="window.importActiveStudentsToExcelData('testVarInput_${v}')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                                            👥 استيراد تلاميذ القسم
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    id="testVarInput_${v}"
                                    rows="6"
                                    oninput="window.onTestModalVariableChange('${v}', this.value)"
                                    placeholder="${escapeQuotes(meta.desc || 'الصق جدول الإكسيل هنا...')}"
                                    style="width: 100%; padding: 8px; border-radius: 6px; border: 1.5px solid #94a3b8; font-family: monospace, 'Courier New', sans-serif; font-size: 0.78rem; line-height: 1.45; background: #fafafa; color: #0f172a; resize: vertical; box-sizing: border-box; white-space: pre;">${escapeHtml(currentVal)}</textarea>
                                <div style="font-size: 0.7rem; color: #64748b;">
                                    💡 الصق جدول الخلايا المنسوخ من ملف Excel أو مسار مباشرة.
                                </div>
                            </div>
                        `;
                    }
                    return `
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-size: 0.76rem; font-weight: 800; color: #1e293b; display: flex; justify-content: space-between; align-items: center;">
                                <span>{{${escapeHtml(v)}}}:</span>
                                <span style="font-size: 0.72rem; color: #2563eb; font-weight: 700;">${escapeHtml(meta.label)}</span>
                            </label>
                            <input type="text"
                                id="testVarInput_${v}"
                                value="${escapeQuotes(currentVal)}"
                                oninput="window.onTestModalVariableChange('${v}', this.value)"
                                placeholder="${escapeQuotes(meta.desc || 'أدخل القيمة هنا...')}"
                                style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #94a3b8; font-size: 0.82rem; font-weight: 600; background: #ffffff; color: #0f172a; box-sizing: border-box;">
                        </div>
                    `;
                }).join('');
            }
        }

        // إخفاء صندوق نتيجة الذكاء الاصطناعي السابقة إن وجد
        const aiBox = document.getElementById('promptTestAiResultBox');
        if (aiBox) aiBox.style.display = 'none';

        // تحديث المعاينة الحية فورياً
        updatePromptTestModalPreview();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    /**
     * إغلاق نافذة تجربة القالب
     */
    function closePromptTestModal() {
        const modal = document.getElementById('promptTestVariableModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * معالج تغيير قيمة متغير داخل نافذة التجربة لتحديث المعاينة في الوقت الحقيقي
     */
    function onTestModalVariableChange(varName, value) {
        _testModalVariables[varName] = value;
        _currentVariableValues[varName] = value; // مزامنة مع المتغيرات العامة
        updatePromptTestModalPreview();

        // مزامنة حقل الإدخال في الواجهة الرئيسية إذا كان نفس القالب
        if (_selectedTemplateId === _testModalTemplateId) {
            const mainVarInput = document.getElementById(`promptVarInput_${varName}`);
            if (mainVarInput) mainVarInput.value = value;
            const mainOutput = document.getElementById('promptRenderedOutput');
            const templates = getStoredPromptTemplates();
            const tpl = templates.find(t => t.id === _selectedTemplateId);
            if (mainOutput && tpl) {
                mainOutput.value = renderPromptTextWithVariables(tpl.promptText);
            }
        }
    }

    /**
     * تحديث نص الأمر النهائي المكتمل والإحصاءات في نافذة التجربة
     */
    function updatePromptTestModalPreview() {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _testModalTemplateId);
        if (!tpl) return;

        let rendered = tpl.promptText;
        const vars = extractVariablesFromPrompt(tpl.promptText);
        vars.forEach(v => {
            const val = _testModalVariables[v] || `{{${v}}}`;
            rendered = rendered.split(`{{${v}}}`).join(val);
        });

        const outputEl = document.getElementById('promptTestFinalOutput');
        if (outputEl) outputEl.value = rendered;

        const statsEl = document.getElementById('promptTestStats');
        if (statsEl) {
            const chars = rendered.length;
            const words = rendered.trim() ? rendered.trim().split(/\s+/).length : 0;
            const tokens = Math.round(chars / 4);
            statsEl.textContent = `${words} كلمة · ${chars} حرف · ~${tokens} رمز (Token)`;
        }
    }

    /**
     * نسخ الأمر النهائي المكتمل من نافذة التجربة مع تسجيل الاستخدام
     */
    function copyPromptTestFinalPrompt() {
        const outputEl = document.getElementById('promptTestFinalOutput');
        if (!outputEl || !outputEl.value) return;

        navigator.clipboard.writeText(outputEl.value).then(() => {
            const templates = getStoredPromptTemplates();
            const tpl = templates.find(t => t.id === _testModalTemplateId);
            if (tpl) {
                tpl.usageCount = (tpl.usageCount || 0) + 1;
                tpl.lastUsedAt = new Date().toISOString();
                savePromptTemplatesToDB(templates);
                renderPromptTemplatesList();
            }

            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم بنجاح نسخ الأمر النهائي وهو جاهز للصق في ChatGPT أو AI Studio 📋✨', 'success');
            } else {
                alert('تم نسخ الأمر النهائي بنجاح!');
            }
        }).catch(() => {
            outputEl.select();
            document.execCommand('copy');
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ الأمر النهائي للحافظة 📋', 'success');
            }
        });
    }

    /**
     * استيراد المتغيرات تلقائياً من سياق القسم المفتوح في نافذة التجربة
     */
    function autoFillPromptTestModalFromContext() {
        autoDetectContextVariables();
        _testModalVariables = Object.assign({}, _currentVariableValues);
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _testModalTemplateId);
        if (tpl) {
            const vars = extractVariablesFromPrompt(tpl.promptText);
            vars.forEach(v => {
                const inp = document.getElementById(`testVarInput_${v}`);
                if (inp) inp.value = _testModalVariables[v] || '';
            });
        }
        updatePromptTestModalPreview();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم استيراد معطيات القسم النشط بنجاح 🔄', 'info');
        }
    }

    /**
     * تفريغ متغيرات نافذة التجربة لإعادة الكتابة من جديد
     */
    function clearPromptTestModalVariables() {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _testModalTemplateId);
        if (tpl) {
            const vars = extractVariablesFromPrompt(tpl.promptText);
            vars.forEach(v => {
                _testModalVariables[v] = '';
                const inp = document.getElementById(`testVarInput_${v}`);
                if (inp) inp.value = '';
            });
        }
        updatePromptTestModalPreview();
    }

    /**
     * تجربة وتشغيل الأمر مباشرة بالذكاء الاصطناعي من داخل نافذة التجربة
     */
    async function runPromptTestWithAI() {
        const outputEl = document.getElementById('promptTestFinalOutput');
        const text = outputEl ? outputEl.value : '';
        if (!text) return;

        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === _testModalTemplateId);

        const btn = document.getElementById('btnTestModalRunAI');
        const resultBox = document.getElementById('promptTestAiResultBox');
        const resultText = document.getElementById('promptTestAiResultText');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border:2px solid #7c3aed;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span> <span>جاري التشغيل...</span>';
        }

        if (resultBox) resultBox.style.display = 'block';
        if (resultText) resultText.textContent = 'جاري إرسال الأمر وتشغيله عبر محرك الذكاء الاصطناعي... ⏳';

        try {
            const res = await fetch('/api/ai/run-custom-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: text,
                    systemInstruction: tpl ? tpl.systemInstruction : '',
                    taskCategory: tpl ? tpl.category : 'general'
                })
            });

            const data = await res.json().catch(() => ({}));
            const out = data.result || 'تم استلام الاستجابة بنجاح.';
            if (resultText) resultText.textContent = out;

            if (tpl) {
                tpl.usageCount = (tpl.usageCount || 0) + 1;
                tpl.lastUsedAt = new Date().toISOString();
                savePromptTemplatesToDB(templates);
                renderPromptTemplatesList();
            }

            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تمت تجربة الأمر بنجاح عبر محرك الذكاء الاصطناعي ✨', 'success');
            }
        } catch (err) {
            if (resultText) resultText.textContent = 'تعذر تشغيل الأمر عبر الخدمة: ' + (err.message || 'خطأ اتصال');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<span data-lucide="sparkles" data-size="14"></span> <span>تجربة بالذكاء الاصطناعي ⚡</span>';
                if (window.renderLucide) window.renderLucide(btn);
            }
        }
    }

    // ==========================================
    // محرك التصنيف التلقائي الذكي بناءً على الكلمات المفتاحية
    // ==========================================
    const CATEGORY_KEYWORDS_DICTIONARY = {
        remediation: {
            label: 'الدعم والمعالجة',
            keywords: [
                'دعم', 'معالجة', 'متعثر', 'متعثرين', 'متعثرة', 'تعثر', 'تعثرات', 'فارقية',
                'علاج', 'علاجية', 'صعوبات', 'صعوبة', 'أخطاء', 'ثغرات', 'سد الثغرات',
                'تفييء', 'مرافقة', 'تقوية', 'إبستيمولوجي', 'خلط', 'تشخيص', 'أقران'
            ],
            suggestedTags: ['دعم', 'معالجة', 'تفييء', 'تشخيص', 'ديداكتيك']
        },
        exam_prep: {
            label: 'تحضير الفروض',
            keywords: [
                'فرض', 'فروض', 'محروس', 'امتحان', 'امتحانات', 'تقويم', 'مراقبة مستمرة',
                'سلم التنقيط', 'عناصر الإجابة', 'تنقيط', 'اختبار', 'توليفي', 'توليفية',
                'إشهادي', 'موحد', 'أطر مرجعية', 'نقطة', 'موضوع فرض'
            ],
            suggestedTags: ['فرض محروس', 'سلم التنقيط', 'تقويم', 'مراقبة مستمرة']
        },
        didactics: {
            label: 'الديداكتيك والترييض',
            keywords: [
                'ديداكتيك', 'ترييض', 'مسألة', 'وضعيات', 'وضعية', 'نمذجة', 'رياضياتية',
                'استدلال', 'برهان', 'مبرهنة', 'خاصية', 'عائق', 'بيداغوجي', 'حل المسائل',
                'هندسة', 'ديداكتيكي', 'طاليس', 'فيتاغورس', 'مبرهنات', 'واقعية'
            ],
            suggestedTags: ['ترييض', 'مسائل', 'وضعية ديداكتيكية', 'استدلال']
        },
        lesson_plan: {
            label: 'الجذاذات والمحاور',
            keywords: [
                'جذاذة', 'جذاذات', 'محاور', 'دفتر نصوص', 'درس', 'تخطيط', 'هندسة الدرس',
                'مؤسساتي', 'كفايات', 'قدرات مستهدفة', 'أنشطة استكشافية', 'أنشطة بنائية',
                'مكتسبات قبلية', 'غلاف زمني', 'مصفوفة المحاور'
            ],
            suggestedTags: ['جذاذة', 'محاور', 'دفتر نصوص', 'تخطيط']
        },
        student_evaluation: {
            label: 'الملاحظات والتقارير',
            keywords: [
                'ملاحظات', 'بيان النقط', 'تقرير', 'مجالس الأقسام', 'توجيه', 'سلوك',
                'معدل', 'نتائج', 'ولي الأمر', 'تتبع فردي', 'تشجيع', 'ملاحظة', 'تقرير تركيبي', 'bulletin'
            ],
            suggestedTags: ['ملاحظات', 'بيان النقط', 'توجيه', 'مجالس الأقسام']
        },
        admin_comm: {
            label: 'تواصل إداري',
            keywords: [
                'مراسلة', 'إشعار', 'ولي الأمر', 'إدارة', 'حراسة عامة', 'تقرير إداري',
                'مجلس انضباط', 'التزام', 'غياب متكرر', 'استدعاء', 'مراسلات', 'إشعار غياب', 'إنذار إداري'
            ],
            suggestedTags: ['تواصل إداري', 'مراسلات', 'أولياء الأمور', 'إدارة']
        },
        lesson_delivery: {
            label: 'تقديم الدروس',
            keywords: [
                'تقديم', 'وضعية انطلاق', 'بناء المفهوم', 'نشاط استكشافي', 'صياغة المبرهنة',
                'ديداكتيك الدرس', 'مأسسة', 'تمهيد', 'استكشاف', 'سيناريو بيداغوجي', 'مدخل ديداكتيكي'
            ],
            suggestedTags: ['تقديم الدروس', 'وضعية انطلاق', 'استكشاف', 'ديداكتيك']
        },
        massar: {
            label: 'منظومة مسار وإكسيل',
            keywords: [
                'مسار', 'إكسيل', 'اكسيل', 'excel', 'massar', 'نقط', 'غياب', 'مواظبة',
                'لوائح', 'لائحة', 'استيراد', 'تصدير', 'مجلس القسم', 'مجالس الأقسام',
                'معدل دوري', 'عتبة النجاح', 'إنذار مبكر', 'تدقيق', 'خانات فارغة',
                'تقرير إحصائي', 'المراقبة المستمرة', 'ملف مسار', 'تفتيش', 'مفتش'
            ],
            suggestedTags: ['مسار', 'إكسيل', 'إحصائيات', 'نقط', 'غياب', 'مراقبة مستمرة']
        }
    };

    /**
     * استنتاج وتصنيف الفئة تلقائياً بناءً على الكلمات المفتاحية في العنوان والنص والوسوم
     */
    function autoClassifyPromptCategory(title = '', content = '', existingTags = []) {
        const textToAnalyze = `${title} ${title} ${title} ${existingTags.join(' ')} ${content}`.toLowerCase();
        
        let bestCategory = 'didactics'; // افتراضي ديداكتيك ورياضيات
        let maxScore = 0;
        let bestMeta = CATEGORY_KEYWORDS_DICTIONARY.didactics;

        for (const [catId, meta] of Object.entries(CATEGORY_KEYWORDS_DICTIONARY)) {
            let score = 0;
            for (const kw of meta.keywords) {
                const regex = new RegExp(kw, 'gi');
                const matches = textToAnalyze.match(regex);
                if (matches) {
                    score += matches.length;
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestCategory = catId;
                bestMeta = meta;
            }
        }

        return {
            category: bestCategory,
            categoryLabel: bestMeta.label,
            confidence: maxScore,
            suggestedTags: bestMeta.suggestedTags
        };
    }

    /**
     * تنفيذ التصنيف التلقائي للقالب المفتوح حالياً داخل محرر الإنشاء / التعديل
     */
    function autoClassifyCurrentEditorPrompt() {
        const title = document.getElementById('editPromptTitle')?.value || '';
        const content = document.getElementById('editPromptText')?.value || '';
        const desc = document.getElementById('editPromptDesc')?.value || '';
        const tagsInput = document.getElementById('editPromptTags');
        const existingTags = tagsInput ? tagsInput.value.split(/[,،]/).map(t => t.trim()).filter(Boolean) : [];

        if (!title && !content) {
            alert('يرجى كتابة عنوان القالب أو نص الأمر أولاً ليتمكن النظام من تحليله وتصنيفه تلقائياً.');
            return;
        }

        const classification = autoClassifyPromptCategory(title, `${desc} ${content}`, existingTags);

        const categorySelect = document.getElementById('editPromptCategory');
        if (categorySelect) {
            categorySelect.value = classification.category;
            categorySelect.style.borderColor = '#7c3aed';
            categorySelect.style.backgroundColor = '#f5f3ff';
            setTimeout(() => {
                categorySelect.style.borderColor = '#cbd5e1';
                categorySelect.style.backgroundColor = '#ffffff';
            }, 1200);
        }

        // دمج واقتراح الوسوم المتبقية
        if (tagsInput) {
            const merged = Array.from(new Set([...existingTags, ...classification.suggestedTags]));
            tagsInput.value = merged.join('، ');
        }

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم التصنيف التلقائي للقالب بنجاح كـ: "${classification.categoryLabel}" 🪄✨`, 'success');
        } else {
            alert(`تم تصنيف القالب تلقائياً كـ: "${classification.categoryLabel}"`);
        }
    }

    /**
     * تصنيف وترتيب كافة قوالب المكتبة تلقائياً بناءً على الكلمات المفتاحية
     */
    function autoClassifyAllPromptTemplates() {
        const templates = getStoredPromptTemplates();
        let updatedCount = 0;

        templates.forEach(tpl => {
            const classification = autoClassifyPromptCategory(tpl.title || '', tpl.promptText || '', tpl.tags || []);
            if (classification.confidence > 0 && tpl.category !== classification.category) {
                tpl.category = classification.category;
                tpl.categoryLabel = classification.categoryLabel;
                if (!tpl.tags || tpl.tags.length === 0) {
                    tpl.tags = classification.suggestedTags;
                }
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            savePromptTemplatesToDB(templates);
            renderPromptTemplatesView();
            if (typeof window.showAppToast === 'function') {
                window.showAppToast(`تم بنجاح تصنيف وترتيب (${updatedCount}) قوالب وفق محتواها وكلماتها المفتاحية 🪄🚀`, 'success');
            } else {
                alert(`تم تصنيف وترتيب (${updatedCount}) قوالب بنجاح!`);
            }
        } else {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('كافة القوالب مصنفة ومرتبة بالفعل بدقة عالية في فئاتها البيداغوجية 🎯', 'info');
            }
        }
    }

    /**
     * تكرار قالب قياسي وإنشاء نسخة مخصصة قابلة للتعديل
     */
    function duplicatePromptTemplate(id) {
        const templates = getStoredPromptTemplates();
        const source = templates.find(t => t.id === id);
        if (!source) return;

        const clone = JSON.parse(JSON.stringify(source));
        clone.id = 'tpl_custom_' + Date.now();
        clone.title = `نسخة مخصصة: ${source.title}`;
        clone.isBuiltIn = false;
        clone.usageCount = 0;
        clone.createdAt = new Date().toISOString();
        clone.updatedAt = new Date().toISOString();

        templates.unshift(clone);
        savePromptTemplatesToDB(templates);

        _selectedTemplateId = clone.id;
        _activeCategory = 'all';
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم إنشاء نسخة مخصصة من القالب بنجاح! يمكنك الآن تعديلها بحرية 📋', 'success');
        }
    }

    /**
     * فتح نموذج إنشاء قالب جديد
     */
    function openCreatePromptTemplateModal() {
        openEditPromptTemplateModal(null);
    }

    /**
     * فتح نموذج تعديل قالب حالي أو إنشاء جديد
     */
    function openEditPromptTemplateModal(templateId = null) {
        const modal = document.getElementById('editPromptTemplateModal');
        if (!modal) return;

        const templates = getStoredPromptTemplates();
        const tpl = templateId ? templates.find(t => t.id === templateId) : null;

        document.getElementById('editPromptId').value = tpl ? tpl.id : '';
        document.getElementById('editPromptTitle').value = tpl ? tpl.title : '';

        // تعبئة قائمة الفئات ديناميكياً لتشمل كافة الفئات المخصصة والرسمية
        const catSelect = document.getElementById('editPromptCategory');
        if (catSelect) {
            const allCats = getAllPromptCategories().filter(c => c.id !== 'all');
            catSelect.innerHTML = allCats.map(c => `
                <option value="${c.id}">${c.isCustom ? '⭐ [مخصصة] ' : ''}${c.label}</option>
            `).join('') + `
                <option value="general">⚙️ عام / غير مصنف</option>
            `;
            catSelect.value = tpl ? (tpl.category || 'general') : (_activeCategory !== 'all' ? _activeCategory : 'exam_prep');
        }

        document.getElementById('editPromptDesc').value = tpl ? tpl.description : '';
        document.getElementById('editPromptSystem').value = tpl ? (tpl.systemInstruction || '') : '';
        document.getElementById('editPromptText').value = tpl ? tpl.promptText : '';
        document.getElementById('editPromptTags').value = tpl && Array.isArray(tpl.tags) ? tpl.tags.join('، ') : '';

        const headerTitle = document.getElementById('editPromptModalHeaderTitle');
        if (headerTitle) {
            headerTitle.textContent = tpl ? 'تعديل قالب أمر ذكاء اصطناعي' : 'إنشاء قالب أمر ذكاء اصطناعي جديد';
        }

        renderEditorVariableQuickChips();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    /**
     * إضافة فئة مخصصة فورية من داخل نموذج التعديل
     */
    function promptNewCategoryForEditor() {
        const catName = prompt('أدخل اسم الفئة المخصصة الجديدة (مثال: أولمبياد الرياضيات أو امتحانات إشهادية):');
        if (!catName || !catName.trim()) return;
        const trimmed = catName.trim();
        const customCats = getCustomPromptCategories();
        const id = 'cat_custom_' + Date.now();
        customCats.push({
            id,
            label: trimmed,
            icon: 'award',
            desc: 'فئة مخصصة للأستاذ',
            isCustom: true
        });
        saveCustomPromptCategories(customCats);
        
        const catSelect = document.getElementById('editPromptCategory');
        if (catSelect) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `⭐ [مخصصة] ${trimmed}`;
            catSelect.appendChild(opt);
            catSelect.value = id;
        }
        renderCategoryFilterButtons();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تمت إضافة واختيار فئة "${trimmed}" بنجاح ✨`, 'success');
        }
    }
    window.promptNewCategoryForEditor = promptNewCategoryForEditor;

    /**
     * إغلاق نموذج التعديل
     */
    function closeEditPromptTemplateModal() {
        const modal = document.getElementById('editPromptTemplateModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * رسم شرائح المتغيرات القابلة للنقر للإدراج السريع في خانة النص
     */
    function renderEditorVariableQuickChips() {
        const container = document.getElementById('editorVariableChipsContainer');
        if (!container) return;

        container.innerHTML = COMMON_PROMPT_VARIABLES.map(v => `
            <button type="button" 
                onclick="window.insertVariableIntoPromptEditor('${v.key}')"
                style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; padding: 3px 8px; font-size: 0.74rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;"
                title="${escapeQuotes(v.desc)}">
                <span>+</span>
                <span>{{${v.key}}}</span>
            </button>
        `).join('');
    }

    /**
     * إدراج متغير عند موضع مؤشر الكتابة داخل محرر النص
     */
    function insertVariableIntoPromptEditor(varName) {
        const textarea = document.getElementById('editPromptText');
        if (!textarea) return;

        const token = `{{${varName}}}`;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const val = textarea.value;

        textarea.value = val.substring(0, start) + token + val.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
    }

    /**
     * حفظ القالب من نموذج التعديل
     */
    function savePromptTemplateForm() {
        const id = document.getElementById('editPromptId')?.value;
        const title = document.getElementById('editPromptTitle')?.value?.trim();
        const category = document.getElementById('editPromptCategory')?.value || 'general';
        const description = document.getElementById('editPromptDesc')?.value?.trim();
        const systemInstruction = document.getElementById('editPromptSystem')?.value?.trim();
        const promptText = document.getElementById('editPromptText')?.value?.trim();
        const tagsRaw = document.getElementById('editPromptTags')?.value || '';

        if (!title) {
            alert('يرجى كتابة عنوان القالب.');
            return;
        }

        if (!promptText) {
            alert('يرجى كتابة نص الأمر (Prompt Template).');
            return;
        }

        let tags = tagsRaw.split(/[,،]/).map(t => t.trim()).filter(Boolean);
        
        // تطبيق التصنيف التلقائي الذكي للكلمات المفتاحية إذا كانت الفئة عام أو غير محددة
        let finalCategory = category;
        let finalCatLabel = (getAllPromptCategories().find(c => c.id === category) || { label: 'عام' }).label;
        if (finalCategory === 'general' || !finalCategory) {
            const autoClass = autoClassifyPromptCategory(title, `${description} ${promptText}`, tags);
            finalCategory = autoClass.category;
            finalCatLabel = autoClass.categoryLabel;
        }

        if (tags.length === 0) {
            const autoClass = autoClassifyPromptCategory(title, `${description} ${promptText}`, []);
            tags = autoClass.suggestedTags;
        }

        const templates = getStoredPromptTemplates();

        if (id) {
            // تعديل قالب موجود
            const idx = templates.findIndex(t => t.id === id);
            if (idx !== -1) {
                templates[idx].title = title;
                templates[idx].category = finalCategory;
                templates[idx].categoryLabel = finalCatLabel;
                templates[idx].description = description;
                templates[idx].systemInstruction = systemInstruction;
                templates[idx].promptText = promptText;
                templates[idx].tags = tags;
                templates[idx].updatedAt = new Date().toISOString();
                _selectedTemplateId = id;
            }
        } else {
            // إنشاء قالب جديد
            const newTpl = {
                id: 'tpl_custom_' + Date.now(),
                title,
                category: finalCategory,
                categoryLabel: finalCatLabel,
                description,
                systemInstruction,
                promptText,
                tags: tags.length > 0 ? tags : ['مخصص'],
                isBuiltIn: false,
                isFavorite: false,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            templates.unshift(newTpl);
            _selectedTemplateId = newTpl.id;
        }

        savePromptTemplatesToDB(templates);
        closeEditPromptTemplateModal();
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم حفظ قالب الذكاء الاصطناعي بنجاح ✅', 'success');
        }
    }

    /**
     * حذف قالب مخصص
     */
    function deletePromptTemplate(id) {
        const templates = getStoredPromptTemplates();
        const tpl = templates.find(t => t.id === id);
        if (!tpl) return;

        if (tpl.isBuiltIn) {
            alert('لا يمكن حذف القوالب القياسية المدمجة.');
            return;
        }

        if (!confirm(`هل أنت متأكد من رغبتك في حذف قالب "${tpl.title}"؟`)) {
            return;
        }

        const updated = templates.filter(t => t.id !== id);
        savePromptTemplatesToDB(updated);

        _selectedTemplateId = updated.length > 0 ? updated[0].id : null;
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم حذف القالب المخصص بنجاح.', 'info');
        }
    }

    /**
     * تصدير حزمة القوالب إلى ملف JSON للمشاركة والنسخ الاحتياطي
     */
    function exportPromptTemplatesJSON() {
        const templates = getStoredPromptTemplates();
        const exportObj = {
            appName: 'منظومة التدبير التربوي لمادة الرياضيات',
            exportType: 'custom_ai_prompt_templates_pack',
            version: '2026.1',
            exportedAt: new Date().toISOString(),
            templatesCount: templates.length,
            templates: templates
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `قوالب_أوامر_الذكاء_الاصطناعي_الرياضيات_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم تصدير حزمة قوالب الذكاء الاصطناعي بنجاح 📁', 'success');
        }
    }

    /**
     * استيراد حزمة قوالب من ملف JSON
     */
    function importPromptTemplatesJSON(fileInput) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                const importedList = parsed.templates || (Array.isArray(parsed) ? parsed : null);

                if (!Array.isArray(importedList) || importedList.length === 0) {
                    throw new Error('الملف لا يحتوي على قوالب صالحة.');
                }

                const current = getStoredPromptTemplates();
                let addedCount = 0;

                importedList.forEach(item => {
                    if (item.title && item.promptText) {
                        const exists = current.some(t => t.id === item.id || t.title === item.title);
                        if (!exists) {
                            current.push({
                                id: item.id || ('tpl_imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
                                title: item.title,
                                category: item.category || 'general',
                                categoryLabel: item.categoryLabel || 'عام',
                                description: item.description || '',
                                systemInstruction: item.systemInstruction || '',
                                promptText: item.promptText,
                                tags: Array.isArray(item.tags) ? item.tags : ['مستورد'],
                                isBuiltIn: false,
                                isFavorite: false,
                                usageCount: 0,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                            addedCount++;
                        }
                    }
                });

                savePromptTemplatesToDB(current);
                renderPromptTemplatesView();

                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`تم بنجاح استيراد وإضافة (${addedCount}) قوالب جديدة إلى مكتبتك 🚀`, 'success');
                } else {
                    alert(`تم بنجاح استيراد (${addedCount}) قوالب جديدة!`);
                }
            } catch (err) {
                alert('فشل في قراءة ملف القوالب: ' + (err.message || 'تنسيق الملف غير صالح'));
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    }

    /**
     * استعادة القوالب المرجعية القياسية
     */
    function resetDefaultPromptTemplates() {
        if (!confirm('هل ترغب في استعادة القوالب المرجعية القياسية المعتمدة للمنهاج المغربي؟ سيتم الحفاظ على قوالبك المخصصة التي أنشأتها.')) {
            return;
        }

        const current = getStoredPromptTemplates();
        const customOnly = current.filter(t => !t.isBuiltIn);
        const defaultsClone = JSON.parse(JSON.stringify(DEFAULT_PROMPT_TEMPLATES));

        const merged = [...defaultsClone, ...customOnly];
        savePromptTemplatesToDB(merged);
        _selectedTemplateId = merged[0].id;
        renderPromptTemplatesView();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تمت استعادة القوالب القياسية المرجعية بنجاح ✨', 'success');
        }
    }

    // دوال مساعدة لمنع الحقن وتجهيز النصوص
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeQuotes(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function onPromptSearchInput(val) {
        _searchQuery = val || '';
        window._searchQuery = _searchQuery;
        renderPromptTemplatesList();
    }

    /* ==========================================================================
       محرك البحث الصوتي الذكي داخل مكتبة قوالب الذكاء الاصطناعي (Prompt Voice Search)
       ========================================================================== */
    const PromptVoiceState = {
        recognition: null,
        isListening: false,
        timeoutId: null,
        successTimerId: null
    };

    const CATEGORY_VOICE_ALIASES = {
        'all': ['كافة القوالب', 'كل القوالب', 'جميع القوالب', 'الكل', 'جميعها', 'كافة', 'كل'],
        'exam_prep': ['تحضير الفروض', 'الفروض', 'فرض', 'فروض', 'امتحان', 'امتحانات', 'سلم التنقيط', 'فروض محروسة', 'مواضيع الفروض', 'تقويم', 'فروض المراقبة', 'المراقبة المستمرة', 'فروض المراقبه'],
        'lesson_delivery': ['تقديم الدروس', 'الدروس', 'درس', 'دروس', 'جذاذة', 'جذاذات', 'وضعية انطلاق', 'بناء المفهوم', 'وضعيات الانطلاق', 'تقديم درس', 'انشطة بنائية', 'جذاذه'],
        'admin_comm': ['تواصل اداري', 'تواصل', 'اداري', 'الادارة', 'مراسلات', 'مراسلة', 'مجلس الانضباط', 'تقرير اداري', 'اولياء الامور', 'ولي الامر', 'مراسلة ولي الامر', 'استدعاء'],
        'remediation': ['الدعم والمعالجة', 'الدعم', 'المعالجة', 'التعثرات', 'معالجة', 'دعم', 'استدراك', 'فارقي', 'خطة دعم', 'تعثر', 'خطة معالجة', 'المتعثرين', 'معالجه'],
        'didactics': ['الديداكتيك والترييض', 'الديداكتيك', 'ديداكتيك', 'الترييض', 'ترييض', 'نمذجة', 'مسالة', 'ترييض المسائل', 'هندسة ديداكتيكية', 'النمذجه', 'مساله'],
        'lesson_plan': ['الجذاذات والمحاور', 'المحاور', 'دفتر النصوص', 'تخطيط', 'دفتر نصوص', 'جذاذة الدرس'],
        'student_evaluation': ['الملاحظات والتقارير', 'الملاحظات', 'ملاحظات', 'بيان النقط', 'تقارير', 'تقييم', 'ملاحظة فردية', 'ملاحظة دفتر النصوص'],
        'massar': ['منظومة مسار', 'مسار', 'اكسيل', 'اكسل', 'إكسيل', 'ملفات مسار', 'نقط مسار', 'غياب مسار', 'تقارير مسار', 'excel', 'massar', 'احصائيات مسار', 'لوائح مسار'],
        'custom': ['قوالبي المخصصة', 'قوالبي', 'المخصصة', 'مخصصة', 'قوالب خاصة', 'قوالب الاستاذ']
    };

    function playPromptVoiceChime(type) {
        if (typeof window.playVoiceAudioChime === 'function') {
            window.playVoiceAudioChime(type);
            return;
        }
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            const now = ctx.currentTime;
            if (type === 'start') {
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'success') {
                osc.frequency.setValueAtTime(587.33, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (e) {}
    }

    function togglePromptVoiceSearch() {
        if (PromptVoiceState.isListening) {
            stopPromptVoiceSearch();
        } else {
            startPromptVoiceSearch();
        }
    }

    function startPromptVoiceSearch() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
        if (!SpeechRecognition) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('متصفحك لا يدعم التعرف الصوتي المباشر. يرجى استخدام متصفح يدعم Web Speech API أو البحث الكتابي.', 'warning');
            } else {
                alert('متصفحك لا يدعم التعرف الصوتي المباشر.');
            }
            return;
        }

        // إيقاف أي جلسة استماع نشطة
        stopPromptVoiceSearch();

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'ar-MA';

            PromptVoiceState.recognition = recognition;
            PromptVoiceState.isListening = true;

            // تحديث المؤشر البصري
            updatePromptVoiceUI(true, 'جاري الاستماع... انطق اسم القالب أو الفئة 🎙️', '');
            playPromptVoiceChime('start');

            recognition.onstart = function () {
                PromptVoiceState.isListening = true;
                updatePromptVoiceUI(true, 'جاري الاستماع... انطق اسم القالب أو الفئة 🎙️', '');
            };

            recognition.onresult = function (event) {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const text = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += text;
                    } else {
                        interimTranscript += text;
                    }
                }

                const currentText = (finalTranscript || interimTranscript).trim();
                if (currentText) {
                    updatePromptVoiceUI(true, 'جاري معالجة الصوت... 🔄', currentText);
                }

                if (finalTranscript) {
                    handlePromptVoiceResult(finalTranscript.trim());
                }
            };

            recognition.onerror = function (event) {
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    if (typeof window.showAppToast === 'function') {
                        window.showAppToast('تعذر التقاط الصوت: ' + event.error, 'error');
                    }
                }
                stopPromptVoiceSearch();
            };

            recognition.onend = function () {
                if (PromptVoiceState.isListening) {
                    stopPromptVoiceSearch();
                }
            };

            recognition.start();

            // مهلة أمان قصوى 14 ثانية
            clearTimeout(PromptVoiceState.timeoutId);
            PromptVoiceState.timeoutId = setTimeout(() => {
                if (PromptVoiceState.isListening) {
                    stopPromptVoiceSearch();
                }
            }, 14000);

        } catch (err) {
            PromptVoiceState.isListening = false;
            updatePromptVoiceUI(false);
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تعذر تشغيل الميكروفون: ' + (err.message || ''), 'error');
            }
        }
    }

    function stopPromptVoiceSearch() {
        clearTimeout(PromptVoiceState.timeoutId);
        PromptVoiceState.isListening = false;

        if (PromptVoiceState.recognition) {
            try {
                PromptVoiceState.recognition.abort();
            } catch (e) {}
            PromptVoiceState.recognition = null;
        }

        updatePromptVoiceUI(false);
    }

    function updatePromptVoiceUI(isListening, statusText = '', liveTranscript = '') {
        const btn = document.getElementById('btnPromptVoiceSearch');
        const banner = document.getElementById('promptVoiceListeningBanner');
        const statusEl = document.getElementById('promptVoiceStatusText');
        const transcriptEl = document.getElementById('promptVoiceLiveTranscript');

        if (btn) {
            btn.classList.toggle('listening', !!isListening);
            btn.title = isListening ? 'الميكروفون نشط: انقر للإيقاف' : 'البحث الصوتي الذكي في القوالب (Alt + V)';
        }

        if (banner) {
            banner.style.display = isListening ? 'block' : 'none';
        }

        if (statusEl && statusText) {
            statusEl.textContent = statusText;
        }

        if (transcriptEl && liveTranscript) {
            transcriptEl.textContent = liveTranscript;
            transcriptEl.style.color = '#1d4ed8';
        } else if (transcriptEl && !liveTranscript) {
            transcriptEl.textContent = 'تحدث الآن باسم القالب (مثل: "صياغة فرض محروس") أو الفئة (مثل: "الديداكتيك")...';
            transcriptEl.style.color = '#64748b';
        }

        if (window.renderLucide && banner && isListening) {
            window.renderLucide(banner);
        }
    }

    function handlePromptVoiceResult(rawText) {
        if (!rawText) return;

        const normSpoken = normalizeArabicText(rawText);
        // إزالة كلمات التوجيه الشائعة
        const cleanSpoken = normSpoken
            .replace(/^(ابحث عن|بحث عن|افتح لي|افتح|وريني|عطيني|اعطيني|بدي|بغيت|نريد|اريد|قالب|فئة|تصنيف|قسم)\s+/g, '')
            .replace(/\s+(قالب|فئة|تصنيف)$/g, '')
            .trim();

        const transcriptEl = document.getElementById('promptVoiceLiveTranscript');
        const statusEl = document.getElementById('promptVoiceStatusText');

        // 1. فحص الفئات (Categories)
        const allCategories = getAllPromptCategories();

        // فحص "المفضلة"
        if (normSpoken.includes('مفضله') || normSpoken.includes('نجمه') || normSpoken.includes('مفضل')) {
            _onlyFavorites = true;
            window._onlyFavorites = true;
            updateFavoritesToolbarUI();
            renderPromptTemplatesView();
            playPromptVoiceChime('success');
            if (statusEl) statusEl.textContent = '✅ تم تفعيل القوالب المفضلة ⭐';
            if (transcriptEl) transcriptEl.textContent = 'عرض القوالب الموسومة بالمفضلة فقط';
            if (typeof window.showAppToast === 'function') window.showAppToast('تم الانتقال إلى: القوالب المفضلة ⭐', 'success');
            finishPromptVoiceSuccess();
            return;
        }

        // فحص الفئات المسجلة
        let matchedCategory = null;
        for (const cat of allCategories) {
            const catNormLabel = normalizeArabicText(cat.label);
            const aliases = CATEGORY_VOICE_ALIASES[cat.id] || [];
            
            if (cleanSpoken === catNormLabel || normSpoken.includes(catNormLabel)) {
                matchedCategory = cat;
                break;
            }

            for (const alias of aliases) {
                const normAlias = normalizeArabicText(alias);
                if (cleanSpoken === normAlias || normSpoken.includes(normAlias)) {
                    matchedCategory = cat;
                    break;
                }
            }
            if (matchedCategory) break;
        }

        if (matchedCategory) {
            setPromptActiveCategory(matchedCategory.id);
            _searchQuery = '';
            window._searchQuery = '';
            const searchInput = document.getElementById('promptSearchInput');
            if (searchInput) searchInput.value = '';
            renderPromptTemplatesList();

            playPromptVoiceChime('success');
            if (statusEl) statusEl.textContent = '✅ تم التوجيه إلى الفئة: ' + matchedCategory.label;
            if (transcriptEl) transcriptEl.textContent = 'تم عرض قوالب فئة "' + matchedCategory.label + '" بنجاح';
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم الانتقال إلى فئة: ' + matchedCategory.label + ' 🗂️', 'success');
            }
            finishPromptVoiceSuccess();
            return;
        }

        // 2. فحص أسماء القوالب (Template Titles)
        const templates = getStoredPromptTemplates();
        let bestTpl = null;
        let bestScore = 0;

        for (const tpl of templates) {
            const normTitle = normalizeArabicText(tpl.title);
            const normDesc = normalizeArabicText(tpl.description || '');
            let score = 0;

            // تطابق دقيق للعنوان
            if (normTitle === cleanSpoken || normTitle === normSpoken) {
                score = 100;
            } else if (normTitle.includes(cleanSpoken) || cleanSpoken.includes(normTitle)) {
                score = 80;
            } else {
                // تقاطع الكلمات الأساسية
                const spokenTokens = cleanSpoken.split(' ').filter(w => w.length > 2);
                let tokenMatches = 0;
                spokenTokens.forEach(tok => {
                    if (normTitle.includes(tok)) tokenMatches += 2;
                    else if (normDesc.includes(tok)) tokenMatches += 1;
                });
                if (spokenTokens.length > 0) {
                    score = (tokenMatches / (spokenTokens.length * 2)) * 60;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestTpl = tpl;
            }
        }

        if (bestTpl && bestScore >= 40) {
            // فتح القالب واختياره
            if (_activeCategory !== 'all' && _activeCategory !== bestTpl.category && !_isGroupedByCategoryView) {
                _activeCategory = bestTpl.category;
                renderCategoryFilterButtons();
            }

            selectPromptTemplate(bestTpl.id);

            const searchInput = document.getElementById('promptSearchInput');
            if (searchInput) searchInput.value = bestTpl.title;
            _searchQuery = bestTpl.title;
            window._searchQuery = bestTpl.title;
            renderPromptTemplatesList();

            // تمرير القائمة للعنصر المختار
            setTimeout(() => {
                const activeCard = document.querySelector('.prompt-card-item.selected');
                if (activeCard && activeCard.scrollIntoView) {
                    activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 60);

            playPromptVoiceChime('success');
            if (statusEl) statusEl.textContent = '🎯 تم فتح القالب مباشرة!';
            if (transcriptEl) transcriptEl.textContent = 'تم اختيار قالب: ' + bestTpl.title;
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم فتح قالب: ' + bestTpl.title + ' 🎯', 'success');
            }
            finishPromptVoiceSuccess();
            return;
        }

        // 3. التصفية النصية المرنة بالكلمات المنطوقة
        const searchInput = document.getElementById('promptSearchInput');
        if (searchInput) searchInput.value = rawText;
        onPromptSearchInput(rawText);

        const filtered = getFilteredTemplates();
        if (filtered.length > 0) {
            selectPromptTemplate(filtered[0].id);
        }

        playPromptVoiceChime('success');
        if (statusEl) statusEl.textContent = '🔍 تصفية حسب البحث الصوتي';
        if (transcriptEl) transcriptEl.textContent = `تم تصفية القوالب بمطابقة "${rawText}" (${filtered.length} نتيجة)`;
        finishPromptVoiceSuccess();
    }

    function finishPromptVoiceSuccess() {
        clearTimeout(PromptVoiceState.successTimerId);
        PromptVoiceState.successTimerId = setTimeout(() => {
            stopPromptVoiceSearch();
        }, 1200);
    }

    // اختصار لوحة المفاتيح Alt + V داخل نافذة القوالب
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'v' || e.key === 'V' || e.key === 'ر')) {
            const modal = document.getElementById('aiPromptTemplatesModal');
            if (modal && modal.style.display !== 'none') {
                e.preventDefault();
                togglePromptVoiceSearch();
            }
        }
    });

    // تصدير واجهة الوحدة للنطاق العام (window)
    window.openPromptTemplatesModal = openPromptTemplatesModal;
    window.closePromptTemplatesModal = closePromptTemplatesModal;
    window.setPromptActiveCategory = setPromptActiveCategory;
    window.selectPromptTemplate = selectPromptTemplate;
    window.onPromptSearchInput = onPromptSearchInput;
    window.renderPromptTemplatesList = renderPromptTemplatesList;
    window.renderPromptTemplatesView = renderPromptTemplatesView;
    window.togglePromptVoiceSearch = togglePromptVoiceSearch;
    window.startPromptVoiceSearch = startPromptVoiceSearch;
    window.stopPromptVoiceSearch = stopPromptVoiceSearch;
    window.handlePromptVoiceResult = handlePromptVoiceResult;
    window.onPromptVariableChange = onPromptVariableChange;
    window.autoFillPromptVariablesFromActiveContext = autoFillPromptVariablesFromActiveContext;
    window.copyRenderedPrompt = copyRenderedPrompt;
    window.copyRawTemplatePrompt = copyRawTemplatePrompt;
    window.runPromptWithAI = runPromptWithAI;
    window.copyPromptAiExecutionResult = copyPromptAiExecutionResult;
    window.togglePromptFavorite = togglePromptFavorite;
    window.togglePromptFavoritesFilter = togglePromptFavoritesFilter;
    window.updateFavoritesToolbarUI = updateFavoritesToolbarUI;
    window.duplicatePromptTemplate = duplicatePromptTemplate;
    window.openCreatePromptTemplateModal = openCreatePromptTemplateModal;
    window.openEditPromptTemplateModal = openEditPromptTemplateModal;
    window.closeEditPromptTemplateModal = closeEditPromptTemplateModal;
    window.insertVariableIntoPromptEditor = insertVariableIntoPromptEditor;
    window.savePromptTemplateForm = savePromptTemplateForm;
    window.deletePromptTemplate = deletePromptTemplate;
    window.exportPromptTemplatesJSON = exportPromptTemplatesJSON;
    window.importPromptTemplatesJSON = importPromptTemplatesJSON;
    window.resetDefaultPromptTemplates = resetDefaultPromptTemplates;

    // دوال نافذة تجربة ومعاينة المتغيرات
    window.openPromptTestModal = openPromptTestModal;
    window.closePromptTestModal = closePromptTestModal;
    window.onTestModalVariableChange = onTestModalVariableChange;
    window.updatePromptTestModalPreview = updatePromptTestModalPreview;
    window.copyPromptTestFinalPrompt = copyPromptTestFinalPrompt;
    window.autoFillPromptTestModalFromContext = autoFillPromptTestModalFromContext;
    window.clearPromptTestModalVariables = clearPromptTestModalVariables;
    window.runPromptTestWithAI = runPromptTestWithAI;

    // دوال التصنيف التلقائي الذكي للكلمات المفتاحية
    window.autoClassifyPromptCategory = autoClassifyPromptCategory;
    window.autoClassifyCurrentEditorPrompt = autoClassifyCurrentEditorPrompt;
    window.autoClassifyAllPromptTemplates = autoClassifyAllPromptTemplates;

    // دوال منظومة مسار وإكسيل
    window.generateSampleMassarExcelData = generateSampleMassarExcelData;
    window.fillSampleMassarData = fillSampleMassarData;
    window.importActiveStudentsToExcelData = importActiveStudentsToExcelData;

})(window);
