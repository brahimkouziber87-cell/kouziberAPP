/**
 * ====================================================================
 * دليل المذكرات الوزارية والنصوص التنظيمية لمادة الرياضيات + محرك الربط الذكي
 * Moroccan Secondary Math - Curated Ministerial Decrees & Smart Legal Linker
 * ====================================================================
 * يتيح للأستاذ:
 * 1. تصفح، بحث، ونسخ السند القانوني والتربوي بنقرة زر واحدة.
 * 2. الربط الذكي والتلقائي لكل حصة دراسية في دفتر النصوص بالسند القانوني،
 *    المذكرة الوزارية، التوجيهات التربوية، والإطار المرجعي استناداً إلى عنوان الدرس،
 *    المستوى/الشعبة (بما فيها 1BAC SH / 1BAC LSH)، وطبيعة الحصة.
 */

(function (window) {
    'use strict';

    const MINISTERIAL_DECREES = [
        {
            id: 'note_cahier_textes',
            number: 'المذكرة الوزارية رقم 155',
            date: '17 نونبر 2011',
            title: 'العناية بدفاتر النصوص وتدبير وتوثيق الحصص الدراسية',
            category: 'التوثيق الديداكتيكي والتفتيش',
            color: '#059669',
            summary: 'تؤطر مسك وتدوين دفتر النصوص بانتظام باعتباره وثيقة رسمية تعكس السيرورة البيداغوجية للفصل، وتحدد مسؤوليات الأستاذ والإدارة التربوية والمفتش التربوي.',
            keyArticles: [
                {
                    title: 'حجية وإلزامية دفتر النصوص',
                    text: 'دفتر النصوص وثيقة رسمية وتعاقدية تعكس السيرورة البيداغوجية المنجزة فعلياً داخل الفصل، ويجب تدوين تاريخ كل حصة، عنوان الدرس، المحاور والفقرات، الأنشطة المنجزة، والواجبات المنزلية بدقة وانتظام.'
                },
                {
                    title: 'مطابقة التوزيع السنوي والتوجيهات الرسمية',
                    text: 'يتعين أن تعكس التدوينات المسجلة بدفتر النصوص التدرج البيداغوجي المعتمد في التوزيع السنوي الرسمي لمادة الرياضيات والغلاف الزمني المخصص لكل درس.'
                },
                {
                    title: 'التأشير الإداري والتأطير التربوي',
                    text: 'يخضع دفتر النصوص للتأشير الدوري من طرف رئيس المؤسسة (المدير / الناظر) وتأشيرة السيد المفتش التربوي أثناء الزيارات الصفية لمواكبة تنفيذ المنهاج.'
                }
            ]
        },
        {
            id: 'note_orientations_2007',
            number: 'التوجيهات التربوية والبرامج الرسمية (نونبر 2007)',
            date: 'نونبر 2007',
            title: 'التوجيهات التربوية والبرامج الخاصة بتدريس مادة الرياضيات بسلك التعليم الثانوي التأهيلي',
            category: 'المنهاج والتوجيهات البيداغوجية',
            color: '#0284c7',
            summary: 'الوثيقة المرجعية الأساسية الصادرة عن مديرية المناهج لتأطير تدريس الرياضيات بالثانوي التأهيلي؛ تحدد الكفايات المستهدفة، القدرات المنتظرة، الغلاف الزمني الرسمي لكل درس، والاختيارات الديداكتيكية.',
            keyArticles: [
                {
                    title: 'المقاربة بالكفايات وبناء المفاهيم عبر وضعيات-مسائل',
                    text: 'يتم تقديم وبناء المفاهيم الرياضية انطلاقاً من أنشطة تمهيدية ووضعيات-مسائل دالة تستحضر المكتسبات القبلية وتُشرك المتعلم في البحث والتجريب والتخمين والبرهان.'
                },
                {
                    title: 'احترام الغلاف الزمني والتدرج البيداغوجي للدرس',
                    text: 'يلتزم الأستاذ باحترام الغلاف الزمني الرسمي المحدد لكل درس ومفصل في التوزيع السنوي، مع الموازنة بين بناء المفهوم، التمارين التطبيقية، والمسائل التوليفية.'
                },
                {
                    title: 'تنمية الاستدلال الرياضي والتواصل العلمي',
                    text: 'تستهدف حصص الرياضيات تدريب المتعلمين على أنماط الاستدلال المنطقي (الاستنتاجي، الترجع، الخلف، فصل الحالات، المثال المضاد) وتحرير البراهين بلغة رياضية سليمة.'
                }
            ]
        },
        {
            id: 'note_142_08',
            number: 'المذكرة الوزارية رقم 142-08',
            date: '04 نونبر 2008',
            title: 'التقويم التربوي بالسلك الثانوي التأهيلي - مادة الرياضيات',
            category: 'التقويم والمراقبة المستمرة',
            color: '#1e3a8a',
            summary: 'تحدد المذكرة أوزان ومواصفات المراقبة المستمرة لمادة الرياضيات بجميع شعب ومسالك الثانوي التأهيلي، وعدد الفروض المحروسة والمنزلية ومدتها الزمنية وحصص التصحيح والدعم.',
            keyArticles: [
                {
                    title: 'المعدل الدوري للمراقبة المستمرة (منظومة مسار)',
                    text: 'يُحتسب المعدل الدوري للمراقبة المستمرة في مادة الرياضيات حصراً من المعدل الحسابي لنقط الفروض المحروسة المنجزة حضورياً خلال الدورة الدراسية.'
                },
                {
                    title: 'وثيرة وعدد الفروض المحروسة حسب الشعب',
                    text: 'يُجرى في كل دورة: 4 فروض محروسة (2س) لشعبة العلوم الرياضية، و3 فروض محروسة (2س) لشعب العلوم التجريبية والتكنولوجيات والاقتصاد والتدبير والجذع العلمي، وفرضان محروسان (1س) لشعبة الآداب والعلوم الإنسانية (1BAC SH / LSH و 2BAC LSH) والجذع الأدبي.'
                },
                {
                    title: 'حصة التصحيح والدعم المندمج',
                    text: 'تُبرمج وجوباً حصة لتصحيح كل فرض محروس داخل الفصل بمعية التلاميذ، وتُستثمر في تحليل الأخطاء المتكررة وتشخيص التعثرات وتقديم دعم تربوي مندمج.'
                },
                {
                    title: 'الفروض المنزلية ومسطرة الفروض التعويضية',
                    text: 'يُكلَف التلاميذ بفروض منزلية منتظمة تُصحح جماعياً لترسيخ التعلمات، ويستفيد التلميذ المتغيب بمبرر قانوني من فرض تعويضي مكافئ تفادياً لمنحه نقطة الصفر.'
                }
            ]
        },
        {
            id: 'note_cadre_national_142_10',
            number: 'المذكرة الوزارية رقم 142-10 (الأطر المرجعية للبكالوريا)',
            date: '2010 / محينة',
            title: 'الأطر المرجعية للامتحان الوطني الموحد لنيل شهادة البكالوريا - مادة الرياضيات',
            category: 'الأطر المرجعية للامتحانات الإشهادية',
            color: '#4338ca',
            summary: 'تضبط المجالات الرئيسية والفرعية، القدرات المنتظرة، ونسب الأهمية المئوية لكل مجال في الامتحان الوطني الموحد للسنة الثانية بكالوريا بجميع الشعب العلمية والاقتصادية والأدبية.',
            keyArticles: [
                {
                    title: 'نسب الأهمية لشعبتي العلوم التجريبية والتكنولوجيات',
                    text: 'مجال التحليل (55%: الاتصال والاشتقاق ودراسة الدوال والتكامل والمعادلات التفاضلية 40% + المتتاليات العددية 15%)، ومجال الجبر والهندسة والاحتمالات (45%: الأعداد العقدية 15% + الهندسة الفضائية 15% + حساب الاحتمالات 15%).'
                },
                {
                    title: 'نسب الأهمية لشعبة العلوم الرياضية (A و B)',
                    text: 'مجال التحليل (50%: النهايات والاتصال والاشتقاق والتكامل والمعادلات التفاضلية 35% + المتتاليات 15%)، ومجال الجبر والاحتمالات (50%: الحسابيات في Z والبنيات الجبرية 25% + الأعداد العقدية 12.5% + الاحتمالات 12.5%).'
                },
                {
                    title: 'نسب الأهمية لشعبة الاقتصاد والتدبير وشعبة الآداب (LSH)',
                    text: 'في الاقتصاد والتدبير: التحليل 65% (الدوال والتكامل 50% + المتتاليات 15%) والاحتمالات 35%. وفي شعبة الآداب والعلوم الإنسانية (2BAC LSH): المتتاليات والدوال اللوغاريتمية والأسية (65%) وحساب الاحتمالات (35%).'
                }
            ]
        },
        {
            id: 'note_cadre_regional_1bac',
            number: 'المذكرة الوزارية للأطر المرجعية للامتحان الجهوي الموحد (1BAC)',
            date: 'أبريل 2010 / محينة',
            title: 'الإطار المرجعي للامتحان الجهوي الموحد للسنة الأولى بكالوريا (شعبة الآداب والعلوم الإنسانية 1BAC SH / LSH)',
            category: 'الأطر المرجعية للامتحانات الإشهادية',
            color: '#d97706',
            summary: 'الوثيقة المرجعية المؤطرة لمضامين ومهارات الامتحان الجهوي الموحد لمادة الرياضيات بالسنة الأولى بكالوريا شعبة الآداب والعلوم الإنسانية (1BAC SH / 1BAC LSH) والتعليم الأصيل.',
            keyArticles: [
                {
                    title: 'بنية ومكونات الإطار المرجعي للامتحان الجهوي (1BAC SH / LSH)',
                    text: 'يغطي الامتحان الجهوي الموحد للسنة الأولى بكالوريا آداب وعلوم إنسانية أربعة مجالات أساسية: المعادلات والمتراجحات والنظمات والنسب المئوية (25%)، المتتاليات العددية الحسابية والهندسية (20%)، التعداد (20%)، والاشتقاق ودراسة وتمثيل الدوال العددية (35%).'
                },
                {
                    title: 'توجيهات التقويم وبناء الوضعيات الاختبارية',
                    text: 'تُبنى تمارين الفروض المحروسة والامتحان الجهوي لشعبة الآداب والعلوم الإنسانية بشكل مباشر ومتدرج يركز على التطبيق السليم للقواعد الرياضية والتأويل المبياني والعددي.'
                }
            ]
        },
        {
            id: 'note_diagnostic_soutien',
            number: 'مقرر تنظيم السنة الدراسية والمذكرة 142-08 (التشخيص والدعم)',
            date: 'مقرر سنوي متجدد',
            title: 'تأطير التقويم التشخيصي والدعم التربوي المندمج والاستدراكي بمادة الرياضيات',
            category: 'التقويم التشخيصي والدعم البيداغوجي',
            color: '#7c3aed',
            summary: 'يحدد الإجراءات التنظيمية لتمرير روائز التقويم التشخيصي في مطلع الموسم الدراسي، واستثمار نتائجها في تفييء المتعلمين وبرمجة حصص المراجعة والدعم المندمج والاستدراكي.',
            keyArticles: [
                {
                    title: 'إلزامية التقويم التشخيصي وتوثيقه بدفتر النصوص',
                    text: 'تُخصص الحصص الأولى من الموسم الدراسي لتمرير وتصحيح رائز التقويم التشخيصي لقياس درجة تملك المستلزمات الدراسية القبلية، مع تدوين محاور التشخيص والدعم الاستدراكي في دفتر النصوص.'
                },
                {
                    title: 'الدعم التربوي المندمج والاستدراكي والعلاجي',
                    text: 'يُبرمج الدعم التربوي بناءً على نتائج الفروض المحروسة لتجاوز التعثرات المرصودة، سواء في إطار الدعم المندمج داخل الغلاف الزمني الرسمي أو حصص الدعم الإضافية بالتنسيق مع الإدارة التربوية.'
                }
            ]
        },
        {
            id: 'note_absence_discipline',
            number: 'المذكرة الوزارية رقم 43',
            date: '22 مارس 2006',
            title: 'تنظيم المراقبة التربوية وتتبع الغياب والمواظبة بالثانوي التأهيلي',
            category: 'المواظبة والانضباط',
            color: '#be123c',
            summary: 'إجراءات رصد وضبط الغياب غير المبرر، إشعار أولياء الأمور، ومسطرة الإحالة على مجالس الانضباط وتوجيه الإنذارات.',
            keyArticles: [
                {
                    title: 'التوثيق الفوري في ورقة الغياب وسجل الحصة',
                    text: 'يلتزم الأستاذ بتسجيل المتغيبين والمتأخرين بدقة في ورقة الغياب عند بداية كل حصة دراسية، وعدم قبول أي تلميذ متغيب في حصة سابقة إلا بإذن دخول قانوني من الحراسة العامة.'
                },
                {
                    title: 'عتبات الإنذار بالغياب والتتبع التربوي',
                    text: 'تتخذ الإدارة التدابير القانونية عند بلوغ الغياب غير المبرر 10 ساعات فأكثر، مع توجيه إشعارات متدرجة للولي وتفعيل المواكبة التربوية.'
                }
            ]
        },
        {
            id: 'note_councils_orientation',
            number: 'المقرر الوزاري والقرار رقم 2385-06',
            date: '16 أكتوبر 2006',
            title: 'تنظيم مجالس المؤسسة وإجراءات التوجيه وإعادة التوجيه',
            category: 'مجالس الأقسام والتوجيه',
            color: '#6d28d9',
            summary: 'مهام مجالس الأقسام في حصر النتائج الدورية، تحديد قرارات التوجيه، التفييئ، واقتراح خطط الدعم للمتعثرين.',
            keyArticles: [
                {
                    title: 'صلاحيات مجلس القسم في تحليل نتائج الرياضيات',
                    text: 'يجتمع مجلس القسم في نهاية كل دورة دراسية للنظر في نتائج التلاميذ وتحصيلهم الدراسي في مادة الرياضيات وسائر المواد، وتحديد المتفوقين وقرارات الدعم والمواكبة.'
                },
                {
                    title: 'معايير التوجيه نحو الشعب العلمية والرياضية',
                    text: 'يعتمد التوجيه نحو الشعب العلمية والعلوم الرياضية أساساً على مؤهلات المتعلم في مادة الرياضيات والقدرة على التجريد والاستدلال المنطقي والاستقرار الإيجابي للأداء الصفي.'
                }
            ]
        }
    ];

    /**
     * تطبيع النص العربي للمطابقة الذكية مع عناوين الدروس
     */
    function normalizeArabicForLegalMatch(str) {
        if (!str) return '';
        return String(str)
            .trim()
            .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
            .replace(/[إأآا]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * البحث الذكي عن الدرس في المقرر الوزاري الرسمي واستخراج مجاله في الإطار المرجعي
     */
    function findCurriculumLessonAndDomain(levelKey, levelData, rawLessonTitle) {
        if (!levelData || !rawLessonTitle) return null;
        const normInput = normalizeArabicForLegalMatch(rawLessonTitle);
        if (!normInput || normInput.length < 2) return null;

        let matchedLesson = null;
        let matchedSemester = null;

        // 1. مطابقة مباشرة أو جزئية مع عناوين الدروس الرسمية أو محاورها
        if (levelData.semesters) {
            for (const [semKey, sem] of Object.entries(levelData.semesters)) {
                if (!sem || !Array.isArray(sem.lessons)) continue;
                for (const l of sem.lessons) {
                    const normTitle = normalizeArabicForLegalMatch(l.title);
                    if (normTitle && (normTitle === normInput || normTitle.includes(normInput) || normInput.includes(normTitle))) {
                        matchedLesson = l;
                        matchedSemester = { key: semKey, name: sem.name };
                        break;
                    }
                    // تحقق من الكلمات المفتاحية المميزة في عنوان الدرس الرسمي
                    const titleWords = normTitle.split(' ').filter(w => w.length >= 4 && !['حول', 'في', 'من', 'على', 'الي', 'عامه', 'عموميات', 'درس', 'مبادئ'].includes(w));
                    const hitWords = titleWords.filter(w => normInput.includes(w));
                    if (hitWords.length >= 2 || (titleWords.length === 1 && hitWords.length === 1)) {
                        matchedLesson = l;
                        matchedSemester = { key: semKey, name: sem.name };
                        break;
                    }
                    // تحقق من المحاور الداخلية للدرس
                    if (Array.isArray(l.axes)) {
                        const axisHit = l.axes.some(ax => {
                            const normAx = normalizeArabicForLegalMatch(ax.title);
                            return normAx && normAx.length >= 5 && (normInput.includes(normAx) || normAx.includes(normInput));
                        });
                        if (axisHit) {
                            matchedLesson = l;
                            matchedSemester = { key: semKey, name: sem.name };
                            break;
                        }
                    }
                }
                if (matchedLesson) break;
            }
        }

        // 2. إذا لم يتم العثور عبر التطابق النصي المباشر، نستخدم القاموس الدلالي لمفاهيم الرياضيات
        if (!matchedLesson && levelData.semesters) {
            const topicClusters = [
                { keywords: ['منطق', 'عبار', 'مكمم', 'استلزام', 'تكافؤ', 'ترجع', 'خلف'], target: ['منطق'] },
                { keywords: ['تناسب', 'نسب مئوي', 'سلم', 'تخفيض', 'زياده'], target: ['تناسب', 'حساب عددي'] },
                { keywords: ['معادل', 'متراجح', 'نظم', 'درجه ثانيه', 'مميز', 'كثير حدود', 'حدوديات'], target: ['معادل', 'حدوديات'] },
                { keywords: ['متتالي', 'حسابي', 'هندسي', 'رتابه متتالي', 'نهايه متتالي'], target: ['متتالي'] },
                { keywords: ['تعداد', 'ترتيب', 'تبديل', 'تاليف', 'مبدا اساسي', 'شجره اختيارات', 'سحب'], target: ['تعداد', 'احتمال'] },
                { keywords: ['احتمال', 'عشوائي', 'حدث', 'استقلال', 'برنولي', 'ثنائي حدانية'], target: ['احتمال'] },
                { keywords: ['احصاء', 'معدل حسابي', 'انحراف', 'مبيان', 'حصيص', 'منوال'], target: ['احصاء'] },
                { keywords: ['نهايات', 'نهايه', 'فرع لانهائي', 'مقارب', 'عدم تعيين'], target: ['نهايات', 'اتصال', 'دراسه الدوال'] },
                { keywords: ['اتصال', 'قيم وسيطيه', 'تقابل', 'داله عكسيه', 'جذر نوني'], target: ['اتصال'] },
                { keywords: ['اشتقاق', 'مشتق', 'مماس', 'رتابه داله', 'تقعر', 'انعطاف', 'مطارف', 'تغيرات داله'], target: ['اشتقاق', 'دراسه الدوال'] },
                { keywords: ['لوغاريتم', 'اسيه', 'ln', 'exp', 'نيبير'], target: ['لوغاريتم', 'اسيه', 'دراسه الدوال'] },
                { keywords: ['اصليه', 'تكامل', 'مكامله بالاجزاء', 'مساحه حيز'], target: ['اصلي', 'تكامل'] },
                { keywords: ['تفاضلي', 'y\'', 'y\'\''], target: ['تفاضلي'] },
                { keywords: ['عقدي', 'تخيلي', 'مرافق', 'عمده', 'معيار', 'مثلثي لعدد عقدي'], target: ['عقدي'] },
                { keywords: ['حسابيات', 'قسمه اقليديه', 'موافق', 'اولي', 'قاسم مشترك', 'مضاعف', 'بيزو', 'كوص', 'مجموعه n'], target: ['حسابيات', 'مجموعه الاعداد الصحيحه'] },
                { keywords: ['بنيات', 'زمره', 'حلقه', 'جسم', 'قانون تركيب', 'مصفوف'], target: ['بنيات'] },
                { keywords: ['مرجح', 'نقط متزنه', 'صيغه الاختزال'], target: ['مرجح'] },
                { keywords: ['جداء سلمي', 'جداء متجهي', 'فلكه', 'مستوي في الفضاء', 'هندسه فضائيه', 'مستقيم في المستوي'], target: ['جداء سلمي', 'فضاء', 'فلكه', 'تحليليه'] },
                { keywords: ['مثلثي', 'cos', 'sin', 'tan', 'افصول منحني', 'راديان'], target: ['مثلثي'] },
                { keywords: ['تحويلات', 'ازاحه', 'تحاكي', 'دوران', 'تماثل'], target: ['تحويلات', 'دوران'] },
                { keywords: ['مجموعات', 'تطبيقات', 'تبايني', 'شمولي', 'تقابلي'], target: ['مجموعات', 'تطبيقات'] },
                { keywords: ['ترتيب في r', 'مجالات', 'قيمه مطلقه', 'مقاربه'], target: ['ترتيب'] },
                { keywords: ['عموميات حول الدوال', 'مجموعه تعريف', 'زوجيه', 'فرديه', 'معدل تغير'], target: ['عموميات حول الدوال', 'دوال عدديه'] }
            ];

            for (const cluster of topicClusters) {
                if (cluster.keywords.some(kw => normInput.includes(normalizeArabicForLegalMatch(kw)))) {
                    for (const [semKey, sem] of Object.entries(levelData.semesters)) {
                        if (!sem || !Array.isArray(sem.lessons)) continue;
                        const found = sem.lessons.find(l => {
                            const nt = normalizeArabicForLegalMatch(l.title);
                            return cluster.target.some(t => nt.includes(normalizeArabicForLegalMatch(t)));
                        });
                        if (found) {
                            matchedLesson = found;
                            matchedSemester = { key: semKey, name: sem.name };
                            break;
                        }
                    }
                    if (matchedLesson) break;
                }
            }
        }

        // 3. استنتاج المجال الفرعي ونسبة الأهمية من الإطار المرجعي (Cadre Référentiel) إن وجد
        let matchedDomain = null;
        const searchTarget = normalizeArabicForLegalMatch((matchedLesson ? matchedLesson.title : '') + ' ' + rawLessonTitle);
        if (levelData.cadreReferentiel && Array.isArray(levelData.cadreReferentiel.domains)) {
            for (const dom of levelData.cadreReferentiel.domains) {
                const normDom = normalizeArabicForLegalMatch(dom.domain);
                if (
                    (searchTarget.includes('متتالي') && normDom.includes('متتالي')) ||
                    ((searchTarget.includes('تعداد') || searchTarget.includes('سحب') || searchTarget.includes('ترتيب') || searchTarget.includes('تاليف')) && normDom.includes('تعداد')) ||
                    ((searchTarget.includes('احتمال') || searchTarget.includes('عشوائي')) && normDom.includes('احتمال')) ||
                    ((searchTarget.includes('عقدي')) && normDom.includes('عقدي')) ||
                    ((searchTarget.includes('فضاء') || searchTarget.includes('فلكه') || searchTarget.includes('متجهي')) && normDom.includes('فضائي')) ||
                    ((searchTarget.includes('حسابيات') || searchTarget.includes('بنيات') || searchTarget.includes('زمره')) && (normDom.includes('حسابيات') || normDom.includes('بنيات'))) ||
                    ((searchTarget.includes('معادل') || searchTarget.includes('متراجح') || searchTarget.includes('نظم') || searchTarget.includes('تناسب')) && (normDom.includes('معادل') || normDom.includes('نظم'))) ||
                    ((searchTarget.includes('دوال') || searchTarget.includes('نهايات') || searchTarget.includes('اتصال') || searchTarget.includes('اشتقاق') || searchTarget.includes('لوغاريتم') || searchTarget.includes('اسيه') || searchTarget.includes('تكامل') || searchTarget.includes('تفاضلي') || searchTarget.includes('اصلي')) && (normDom.includes('دوال') || normDom.includes('تحليل') || normDom.includes('اشتقاق') || normDom.includes('لوغاريتم')))
                ) {
                    matchedDomain = dom;
                    break;
                }
            }
        }

        // تحديد المجال الرياضي العام في حال عدم وجود إطار امتحاني إشهادي
        let generalMathBranch = 'التحليل والدوال العددية';
        if (/منطق|مجموعات|تطبيقات|حسابيات|بنيات|معادل|متراجح|نظم|حدوديات|ترتيب|تناسب/.test(searchTarget)) {
            generalMathBranch = 'الجبر والمنطق والحساب العددي';
        } else if (/تعداد|احتمال|احصاء/.test(searchTarget)) {
            generalMathBranch = 'الإحصاء والتعداد وحساب الاحتمالات';
        } else if (/هندسه|مرجح|جداء|متجه|تحويلات|مثلثي|دوران|فلكه|مستقيم|اسقاط/.test(searchTarget)) {
            generalMathBranch = 'الهندسة المستوية والفضائية والحساب المتجهي';
        } else if (/عقدي/.test(searchTarget)) {
            generalMathBranch = 'الجبر والهندسة (الأعداد العقدية)';
        } else if (/متتالي/.test(searchTarget)) {
            generalMathBranch = 'التحليل (المتتاليات العددية)';
        }

        return {
            matchedLesson,
            matchedSemester,
            matchedDomain,
            generalMathBranch
        };
    }

    /**
     * المحرك الذكي لربط كل حصة دراسية بالسند القانوني والمذكرة الوزارية والإطار المرجعي
     * استناداً إلى عنوان الدرس، القسم/المستوى، وطبيعة الحصة
     */
    function resolveLessonLegalReference(className, lessonInput, sessionTypeOverride) {
        const isObj = lessonInput && typeof lessonInput === 'object';
        const rawTitle = isObj
            ? (lessonInput.number || lessonInput.title || '')
            : String(lessonInput || '');
        const cleanTitle = (typeof window.cleanPedagogicalLogText === 'function')
            ? window.cleanPedagogicalLogText(rawTitle, true)
            : String(rawTitle || '').trim();
        const sessionType = sessionTypeOverride || (isObj ? (lessonInput.sessionType || 'cours') : 'cours');
        const isRemedialFlag = isObj && !!(lessonInput.isExtraSession || lessonInput.isRemedial || lessonInput.outOfSchedule);

        // 1. تحديد المستوى والشعبة من اسم القسم (يدعم 1BAC SH / 1BAC LSH وكافة الشعب)
        const levelKey = (typeof window.getCurriculumLevelForClass === 'function')
            ? window.getCurriculumLevelForClass(className || '')
            : 'TCS';
        const curriculumMap = window.MOROCCAN_SECONDARY_MATH_CURRICULUM || {};
        const levelData = curriculumMap[levelKey] || curriculumMap.TCS || {};
        const levelName = levelData.name || className || 'التعليم الثانوي التأهيلي';
        const weeklyHours = levelData.weeklyHours || 5;
        const coefficient = levelData.coefficient || 4;
        const note142Summary = levelData.note142Summary || 'تنظيم فروض المراقبة المستمرة وفق المذكرة الوزارية رقم 142-08.';

        // 2. مطابقة عنوان الدرس مع المنهاج الرسمي والأطر المرجعية
        const currMatch = findCurriculumLessonAndDomain(levelKey, levelData, cleanTitle);
        const matchedLesson = currMatch ? currMatch.matchedLesson : null;
        const matchedSemester = currMatch ? currMatch.matchedSemester : null;
        const matchedDomain = currMatch ? currMatch.matchedDomain : null;
        const generalBranch = currMatch ? currMatch.generalMathBranch : 'مقرر الرياضيات الرسمي';

        const normTitle = normalizeArabicForLegalMatch(cleanTitle);

        // 3. كشف السياق البيداغوجي الخاص من عنوان الدرس أو نوع الحصة
        const isDiagnostic = /تقويم تشخيصي|رائز تشخيصي|تشخيص المكتسبات|مراجعه المكتسبات القبليه|تشخيص تعلمات/.test(normTitle);
        const isExamSession = sessionType === 'controle' || /فرض محروس|مراقبه مستمره|اختبار محروس/.test(normTitle);
        const isCorrectionSession = sessionType === 'correction' || /تصحيح الفرض|تصحيح فرض/.test(normTitle);
        const isHomeworkSession = sessionType === 'homework' || /فرض منزلي|واجب منزلي|تصحيح الواجب/.test(normTitle);
        const isSupportSession = isRemedialFlag || sessionType === 'soutien' || sessionType === 'rattrapage' || sessionType === 'examen_prep' || /حصه دعم|دعم تربوي|دعم واستدراك|استدراكيه|تحضير للامتحان/.test(normTitle);

        const isCertificative1Bac = (levelKey === '1BAC_LSH' || levelKey === '1BAC_ECO');
        const isCertificative2Bac = levelKey.startsWith('2BAC_');

        let decreeId = 'note_orientations_2007';
        let decreeNumber = 'التوجيهات التربوية الرسمية (نونبر 2007) + المذكرة الوزارية رقم 155';
        let decreeDate = 'نونبر 2007 / 17 نونبر 2011';
        let decreeTitle = 'التوجيهات التربوية والبرامج الخاصة بتدريس مادة الرياضيات ومسك دفاتر النصوص';
        let secondaryDecreeNumber = 'المذكرة الوزارية رقم 142-08';
        let secondaryDecreeTitle = 'التقويم التربوي والمراقبة المستمرة لمادة الرياضيات (04 نونبر 2008)';
        let color = '#1d4ed8';
        let bg = '#eff6ff';
        let border = '#bfdbfe';
        let contextLabel = 'بناء التعلمات وتنفيذ المنهاج الرسمي';

        if (isDiagnostic) {
            decreeId = 'note_diagnostic_soutien';
            decreeNumber = 'مقرر تنظيم السنة الدراسية + المذكرة الوزارية رقم 142-08';
            decreeDate = 'مطلع الموسم الدراسي';
            decreeTitle = 'تأطير روائز التقويم التشخيصي وتفييء المتعلمين والدعم الاستدراكي الوقائي';
            secondaryDecreeNumber = 'المذكرة الوزارية رقم 155 (17 نونبر 2011)';
            secondaryDecreeTitle = 'توثيق حصص التشخيص والاستدراك بدفتر النصوص البيداغوجي';
            color = '#7c3aed';
            bg = '#faf5ff';
            border = '#ddd6fe';
            contextLabel = 'تقويم تشخيصي للمستلزمات الدراسية';
        } else if (isExamSession) {
            decreeId = 'note_142_08';
            decreeNumber = 'المذكرة الوزارية رقم 142-08 (04 نونبر 2008)';
            decreeDate = '04 نونبر 2008';
            decreeTitle = 'التقويم التربوي والمراقبة المستمرة لمادة الرياضيات بالثانوي التأهيلي';
            secondaryDecreeNumber = 'المذكرة الوزارية رقم 155 (17 نونبر 2011)';
            secondaryDecreeTitle = 'إلزامية تدوين مواضيع ومحاور الفروض المحروسة في دفتر النصوص';
            color = '#be123c';
            bg = '#fff1f2';
            border = '#fecdd3';
            contextLabel = 'محطة تقويمية إشهادية صفية (فرض محروس)';
        } else if (isCorrectionSession) {
            decreeId = 'note_142_08';
            decreeNumber = 'المذكرة الوزارية رقم 142-08 (مادة التصحيح والدعم المندمج)';
            decreeDate = '04 نونبر 2008';
            decreeTitle = 'إلزامية برمجة حصة تصحيح الفرض المحروس وتحليل الأخطاء ومعالجة التعثرات';
            secondaryDecreeNumber = 'التوجيهات التربوية الرسمية (نونبر 2007)';
            secondaryDecreeTitle = 'استثمار أخطاء المتعلمين في البناء الديداكتيكي والدعم التربوي المندمج';
            color = '#059669';
            bg = '#ecfdf5';
            border = '#a7f3d0';
            contextLabel = 'تصحيح الفرض المحروس والدعم التربوي المندمج';
        } else if (isHomeworkSession) {
            decreeId = 'note_142_08';
            decreeNumber = 'المذكرة الوزارية رقم 142-08 + المذكرة الوزارية رقم 155';
            decreeDate = '04 نونبر 2008 / 17 نونبر 2011';
            decreeTitle = 'تأطير الفروض والواجبات المنزلية واستثمارها في التقويم التكويني وتثبيت التعلمات';
            secondaryDecreeNumber = 'التوجيهات التربوية الرسمية (نونبر 2007)';
            secondaryDecreeTitle = 'تنمية الاستقلالية والبحث الشخصي لدى المتعلم خارج الفصل';
            color = '#d97706';
            bg = '#fffbeb';
            border = '#fde68a';
            contextLabel = 'تقويم تكويني ومناقشة الأعمال المنزلية';
        } else if (isSupportSession) {
            decreeId = 'note_diagnostic_soutien';
            decreeNumber = 'المذكرة الوزارية رقم 142-08 + القرار الوزاري 2385-06';
            decreeDate = '04 نونبر 2008 / 16 أكتوبر 2006';
            decreeTitle = 'تنظيم حصص الدعم التربوي المندمج والاستدراكي وتثبيت المكتسبات الرياضية';
            secondaryDecreeNumber = isCertificative2Bac
                ? 'المذكرة الوزارية رقم 142-10 (الأطر المرجعية للبكالوريا)'
                : (isCertificative1Bac ? 'المذكرة الوزارية للأطر المرجعية للامتحان الجهوي (1BAC)' : 'المذكرة الوزارية رقم 155 (دفتر النصوص)');
            secondaryDecreeTitle = 'التحضير المنهجي للاستحقاقات التقويمية والامتحانات الموحدة';
            color = '#7c3aed';
            bg = '#faf5ff';
            border = '#ddd6fe';
            contextLabel = 'دعم بيداغوجي واستدراك وتثبيت التعلمات';
        } else {
            // حصة درس / تمارين / مسائل اعتيادية مرتبطة بعنوان الدرس
            if (isCertificative2Bac) {
                decreeId = 'note_cadre_national_142_10';
                decreeNumber = 'التوجيهات التربوية (2007) + المذكرة 142-10 (الإطار المرجعي الوطني)';
                decreeDate = 'نونبر 2007 / 2010';
                decreeTitle = 'المنهاج الرسمي لمادة الرياضيات والأطر المرجعية للامتحان الوطني الموحد للبكالوريا';
                secondaryDecreeNumber = 'المذكرة الوزارية رقم 155 + المذكرة 142-08';
                secondaryDecreeTitle = 'توثيق إنجاز المقرر بدفتر النصوص واحترام التوزيع السنوي وفروض المراقبة المستمرة';
            } else if (isCertificative1Bac) {
                decreeId = 'note_cadre_regional_1bac';
                decreeNumber = 'التوجيهات التربوية (2007) + مذكرة الإطار المرجعي للامتحان الجهوي (1BAC)';
                decreeDate = 'نونبر 2007 / 2010';
                decreeTitle = 'المنهاج الرسمي والأطر المرجعية للامتحان الجهوي الموحد للسنة الأولى بكالوريا';
                secondaryDecreeNumber = 'المذكرة الوزارية رقم 155 + المذكرة 142-08';
                secondaryDecreeTitle = 'مسك دفتر النصوص وضوابط الفروض المحروسة والمنزلية بالثانوي التأهيلي';
            } else {
                decreeId = 'note_orientations_2007';
                decreeNumber = 'التوجيهات التربوية الرسمية (نونبر 2007) + المذكرة الوزارية رقم 155';
                decreeDate = 'نونبر 2007 / 17 نونبر 2011';
                decreeTitle = 'التوجيهات التربوية والبرامج الخاصة بتدريس الرياضيات ومسك دفتر النصوص';
                secondaryDecreeNumber = 'المذكرة الوزارية رقم 142-08 (04 نونبر 2008)';
                secondaryDecreeTitle = 'تأطير التقويم التربوي والمراقبة المستمرة لمادة الرياضيات';
            }

            if (sessionType === 'exercices' || sessionType === 'problemes') {
                color = '#0284c7';
                bg = '#f0f9ff';
                border = '#bae6fd';
                contextLabel = sessionType === 'problemes'
                    ? 'مسائل توليفية وإدماج الكفايات (التوجيهات التربوية)'
                    : 'تطبيقات وتمارين ترييضية لتثبيت المفاهيم';
            }
        }

        // 4. بناء بيانات المطابقة المنهجية للدرس والغلاف الزمني والقدرات المنتظرة
        const lessonOrder = matchedLesson ? matchedLesson.order : null;
        const officialHours = matchedLesson ? matchedLesson.hours : null;
        const competency = matchedLesson
            ? matchedLesson.competency
            : (isExamSession
                ? 'تقويم مدى تملك المتعلمين للكفايات والقدرات المستهدفة في الدروس المنجزة وفق مواصفات المذكرة 142-08.'
                : (isCorrectionSession
                    ? 'تشخيص الأخطاء الشائعة وتحليل مصادرها الديداكتيكية وبناء معالجة فورية مندمجة.'
                    : 'بناء وترسيخ المفاهيم الرياضية المستهدفة في الحصة وتنمية الاستدلال الرياضي السليم.'));
        const semesterName = matchedSemester ? matchedSemester.name : 'التوزيع السنوي الرسمي للدورة';

        const examFrameworkTitle = levelData.cadreReferentiel ? levelData.cadreReferentiel.examType : null;
        const domainName = matchedDomain ? matchedDomain.domain : generalBranch;
        const domainWeight = matchedDomain ? `${matchedDomain.weight}%` : null;

        // 5. بناء الصيغة الرسمية المختصرة والملخص القانوني الكامل للاستشهاد والنسخ والطباعة
        const curriculumPositionStr = matchedLesson
            ? `الدرس رقم ${lessonOrder} بالمنهاج الرسمي (${matchedLesson.title}) — ${semesterName} — الغلاف الزمني الرسمي: ${officialHours} ساعات`
            : `الدرس: ${cleanTitle || 'درس مبرمج'} — المجال: ${domainName} (${levelName})`;

        const examFrameworkStr = examFrameworkTitle
            ? (domainWeight
                ? `${examFrameworkTitle} — المجال: ${domainName} (نسبة الأهمية: ${domainWeight})`
                : `${examFrameworkTitle} — المجال: ${domainName}`)
            : `المنهاج الرسمي لمادة الرياضيات (${levelName} • ${weeklyHours}س أسبوعياً • المعامل ${coefficient})`;

        const shortBadgeText = matchedLesson
            ? `${decreeNumber} • الدرس #${lessonOrder} (${officialHours}س رسمية)${domainWeight ? ` • وزن الإطار المرجعي: ${domainWeight}` : ''}`
            : `${decreeNumber}${domainWeight ? ` • وزن الإطار المرجعي: ${domainWeight}` : ` • ${contextLabel}`}`;

        const legalSummaryText = `السند التنظيمي: ${decreeNumber} | التأطير المنهاجي: ${curriculumPositionStr} | ${examFrameworkStr}.`;

        const fullCitationText = [
            `⚖️ السند القانوني والمرجعي للحصة الدراسية (${className || levelName}):`,
            `• المذكرة والنص التنظيمي المؤطر: ${decreeNumber} — ${decreeTitle}.`,
            `• المرجع التربوي الموازي: ${secondaryDecreeNumber} (${secondaryDecreeTitle}).`,
            `• الموقع في التوزيع السنوي الرسمي: ${curriculumPositionStr}.`,
            `• الإطار المرجعي والتقويمي: ${examFrameworkStr}.`,
            `• القدرات المنتظرة والكفايات المستهدفة: ${competency}`,
            `• ضوابط المراقبة المستمرة للشعبة (المذكرة 142-08): ${note142Summary}`
        ].join('\n');

        return {
            decreeId,
            decreeNumber,
            decreeDate,
            decreeTitle,
            secondaryDecreeNumber,
            secondaryDecreeTitle,
            contextLabel,
            levelKey,
            levelName,
            weeklyHours,
            coefficient,
            matchedLessonTitle: matchedLesson ? matchedLesson.title : (cleanTitle || 'حصة رياضيات'),
            isOfficialCurriculumMatch: !!matchedLesson,
            lessonOrder,
            officialHours,
            semesterName,
            competency,
            examFrameworkTitle,
            domainName,
            domainWeight,
            note142StreamRule: note142Summary,
            curriculumPositionStr,
            examFrameworkStr,
            shortBadgeText,
            legalSummaryText,
            fullCitationText,
            color,
            bg,
            border
        };
    }

    /**
     * توليد شريط/بطاقة السند القانوني والمذكرة الوزارية لعرضها في أرشيف دفتر النصوص أو نافذة المعاينة أو الطباعة
     */
    function renderSessionLegalReferenceHtml(className, log, mode = 'card') {
        if (!log) return '';
        const ref = resolveLessonLegalReference(className, log, log.sessionType);
        if (!ref) return '';

        const safeDecreeNum = String(ref.decreeNumber || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeCurrPos = String(ref.curriculumPositionStr || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeExamStr = String(ref.examFrameworkStr || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeComp = String(ref.competency || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeClass = String(className || '').replace(/'/g, "\\'");
        const safeLogId = String(log.id || '').replace(/'/g, "\\'");
        const safeDecreeId = String(ref.decreeId || '').replace(/'/g, "\\'");

        if (mode === 'print_compact') {
            return `
                <div style="margin-top: 4px; padding: 3px 6px; background: #f8fafc; border-right: 2.5px solid #1e3a8a; border-radius: 3px; font-size: 0.67rem; color: #334155; line-height: 1.35;">
                    <strong style="color: #1e3a8a;">⚖️ السند القانوني:</strong> ${safeDecreeNum}
                    ${ref.lessonOrder ? ` | <strong>المقرر:</strong> الدرس #${ref.lessonOrder} (${ref.officialHours}س)` : ''}
                    ${ref.domainWeight ? ` | <strong>الإطار المرجعي:</strong> ${ref.domainName} (${ref.domainWeight})` : ''}
                </div>
            `;
        }

        if (mode === 'print_slip') {
            return `
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-right: 4px solid #1e3a8a; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 0.8rem; line-height: 1.5;">
                    <div style="font-weight: 900; color: #1e3a8a; margin-bottom: 3px;">⚖️ السند القانوني والتأطير المرجعي للحصة (ربط تلقائي بالمنهاج والمذكرات الوزارية):</div>
                    <div><strong>• المذكرة والنص التنظيمي:</strong> ${safeDecreeNum} — ${ref.secondaryDecreeNumber}</div>
                    <div><strong>• المطابقة مع التوزيع السنوي:</strong> ${safeCurrPos}</div>
                    <div><strong>• الإطار المرجعي والتقويمي:</strong> ${safeExamStr}</div>
                    <div><strong>• القدرات المنتظرة المستهدفة:</strong> ${safeComp}</div>
                </div>
            `;
        }

        if (mode === 'modal') {
            return `
                <div style="background: linear-gradient(135deg, #ffffff 0%, ${ref.bg} 100%); border: 1.5px solid ${ref.border}; border-right: 4px solid ${ref.color}; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 7px;">
                            <span style="background: ${ref.color}; color: #fff; width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem;">⚖️</span>
                            <span style="font-weight: 900; font-size: 0.88rem; color: #0f172a;">السند القانوني والمذكرة الوزارية المؤطرة للحصة</span>
                            <span style="background: #ffffff; color: ${ref.color}; border: 1px solid ${ref.border}; font-size: 0.72rem; font-weight: 800; padding: 1px 8px; border-radius: 999px;">
                                ${ref.isOfficialCurriculumMatch ? '✓ مطابق للمقرر الوزاري' : '✓ مؤطر تنظيمياً'}
                            </span>
                        </div>
                        <button type="button" onclick="window.openMinisterialDecreesModal('${safeDecreeId}')" style="background: #ffffff; border: 1px solid ${ref.border}; color: ${ref.color}; padding: 3px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">
                            📖 عرض نص المذكرة
                        </button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 8px; font-size: 0.8rem; color: #1e293b;">
                        <div style="background: rgba(255,255,255,0.85); border: 1px solid #e2e8f0; border-radius: 7px; padding: 7px 10px;">
                            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">المذكرة الوزارية المرجعية:</div>
                            <div style="font-weight: 800; color: ${ref.color};">${safeDecreeNum}</div>
                            <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">${ref.secondaryDecreeNumber}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.85); border: 1px solid #e2e8f0; border-radius: 7px; padding: 7px 10px;">
                            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">الموقع في المنهاج والتوزيع السنوي:</div>
                            <div style="font-weight: 800; color: #0f172a;">${safeCurrPos}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.85); border: 1px solid #e2e8f0; border-radius: 7px; padding: 7px 10px;">
                            <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">الإطار المرجعي ونسبة الأهمية:</div>
                            <div style="font-weight: 800; color: #0f172a;">${safeExamStr}</div>
                        </div>
                    </div>
                    <div style="margin-top: 8px; font-size: 0.78rem; color: #334155; background: rgba(255,255,255,0.85); border: 1px dashed ${ref.border}; border-radius: 7px; padding: 6px 10px;">
                        <strong style="color: ${ref.color};">🎯 القدرات المنتظرة (التوجيهات التربوية):</strong> ${safeComp}
                    </div>
                </div>
            `;
        }

        // Default: 'card' mode for Lesson Log archive cards
        return `
            <div style="background: linear-gradient(135deg, #ffffff 0%, ${ref.bg} 100%); border: 1px solid ${ref.border}; border-right: 4px solid ${ref.color}; border-radius: 9px; padding: 8px 12px; margin-bottom: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="background: ${ref.color}; color: #ffffff; font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;">
                            <span>⚖️ السند القانوني والمرجعي</span>
                        </span>
                        <span style="font-weight: 800; font-size: 0.78rem; color: #0f172a;">
                            ${safeDecreeNum}
                        </span>
                        ${ref.lessonOrder ? `
                            <span style="background: #ffffff; color: #0369a1; border: 1px solid #bae6fd; font-size: 0.71rem; font-weight: 800; padding: 1px 7px; border-radius: 5px;">
                                📘 الدرس #${ref.lessonOrder} بالمنهاج (${ref.officialHours}س رسمية)
                            </span>
                        ` : ''}
                        ${ref.domainWeight ? `
                            <span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.71rem; font-weight: 800; padding: 1px 7px; border-radius: 5px;">
                                🎯 الإطار المرجعي: ${ref.domainName} (${ref.domainWeight})
                            </span>
                        ` : `
                            <span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 0.71rem; font-weight: 700; padding: 1px 7px; border-radius: 5px;">
                                📂 ${ref.domainName}
                            </span>
                        `}
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <button type="button" onclick="window.copySessionCardLegalReference('${safeClass}', '${safeLogId}')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e3a8a; padding: 2px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="نسخ السند القانوني الكامل لهذه الحصة">
                            <span>📋 نسخ السند</span>
                        </button>
                        <button type="button" onclick="window.openMinisterialDecreesModal('${safeDecreeId}')" style="background: #ffffff; border: 1px solid ${ref.border}; color: ${ref.color}; padding: 2px 8px; border-radius: 5px; font-size: 0.7rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="فتح المذكرة الوزارية ذات الصلة">
                            <span>⚖️ المذكرة</span>
                        </button>
                    </div>
                </div>
                <div style="margin-top: 5px; font-size: 0.74rem; color: #475569; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; border-top: 1px dashed ${ref.border}; padding-top: 4px;">
                    <span><strong style="color: #1e3a8a;">🎯 القدرات المنتظرة:</strong> ${safeComp}</span>
                </div>
            </div>
        `;
    }

    /**
     * تحديث بطاقة الربط الذكي الفوري في نموذج تدوين الحصة (#lessonLogSmartLegalLinkCard)
     * وفي نافذة التدوين السريع (#quickSessionSmartLegalBanner)
     */
    function updateLessonLogSmartLegalCard() {
        const card = document.getElementById('lessonLogSmartLegalLinkCard');
        const className = document.getElementById('lessonLogClassSelect')?.value || '';
        const lessonTitle = document.getElementById('lessonLogNumber')?.value || '';
        const sessionType = document.getElementById('lessonLogSessionType')?.value || 'cours';
        const outOfSchedule = document.getElementById('lessonLogOutOfScheduleCheck')?.checked || false;

        if (card) {
            if (!className && !lessonTitle.trim()) {
                card.style.display = 'none';
            } else {
                const ref = resolveLessonLegalReference(
                    className,
                    { number: lessonTitle || 'حصة رياضيات', sessionType, outOfSchedule },
                    sessionType
                );
                card.style.display = 'block';
                card.style.background = `linear-gradient(135deg, #ffffff 0%, ${ref.bg} 100%)`;
                card.style.border = `1.5px solid ${ref.border}`;
                card.style.borderRight = `4px solid ${ref.color}`;

                const safeDecreeId = String(ref.decreeId || '').replace(/'/g, "\\'");

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 7px; background: ${ref.color}; color: #ffffff; font-size: 0.85rem; font-weight: 900; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                ⚖️
                            </span>
                            <div>
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                    <span style="font-size: 0.8rem; font-weight: 900; color: #0f172a;">الربط القانوني والمرجعي التلقائي للحصة:</span>
                                    <span style="background: ${ref.color}; color: #ffffff; font-size: 0.72rem; font-weight: 800; padding: 1px 8px; border-radius: 6px;">
                                        ${ref.decreeNumber}
                                    </span>
                                    <span style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; font-size: 0.7rem; font-weight: 800; padding: 1px 7px; border-radius: 6px;">
                                        ${ref.secondaryDecreeNumber}
                                    </span>
                                    ${ref.lessonOrder ? `
                                        <span style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-size: 0.71rem; font-weight: 800; padding: 1px 8px; border-radius: 6px;">
                                            📘 الدرس #${ref.lessonOrder} بـ${ref.semesterName} (${ref.officialHours} ساعات رسمية)
                                        </span>
                                    ` : ''}
                                    ${ref.domainWeight ? `
                                        <span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.71rem; font-weight: 800; padding: 1px 8px; border-radius: 6px;">
                                            🎯 وزن الإطار المرجعي (${ref.domainName}): ${ref.domainWeight}
                                        </span>
                                    ` : `
                                        <span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 0.71rem; font-weight: 700; padding: 1px 8px; border-radius: 6px;">
                                            📂 المجال: ${ref.domainName}
                                        </span>
                                    `}
                                </div>
                                <div style="font-size: 0.75rem; color: #334155; margin-top: 4px; line-height: 1.45;">
                                    <strong style="color: ${ref.color};">🎯 القدرات المنتظرة (التوجيهات التربوية):</strong> ${ref.competency}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                            <button type="button" onclick="window.insertLegalReferenceIntoLessonNotes()" style="background: #ffffff; border: 1px solid ${ref.border}; color: ${ref.color}; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="إدراج السند القانوني والمذكرة الوزارية تلقائياً في خانة ملاحظات الحصة">
                                <span>📌 إدراج في ملاحظات الحصة</span>
                            </button>
                            <button type="button" onclick="window.copyCurrentFormLegalReference()" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e3a8a; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="نسخ السند القانوني الكامل للحافظة">
                                <span>📋 نسخ السند</span>
                            </button>
                            <button type="button" onclick="window.openMinisterialDecreesModal('${safeDecreeId}')" style="background: ${ref.color}; border: none; color: #ffffff; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="فتح المذكرة الوزارية ذات الصلة">
                                <span>⚖️ عرض المذكرة</span>
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        // تحديث شريط الربط القانوني في نافذة التدوين السريع إن كانت مفتوحة
        const quickBanner = document.getElementById('quickSessionSmartLegalBanner');
        if (quickBanner) {
            const qClass = document.getElementById('quickSessionClassSelect')?.value || document.getElementById('quickSessionClass')?.value || className;
            const qTitle = document.getElementById('quickSessionTitle')?.value || document.getElementById('quickSessionNumber')?.value || '';
            const qType = document.getElementById('quickSessionType')?.value || 'cours';
            const qRef = resolveLessonLegalReference(qClass, { number: qTitle || 'حصة رياضيات', sessionType: qType }, qType);
            quickBanner.style.display = 'block';
            quickBanner.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <div>
                        <strong style="color: ${qRef.color};">⚖️ السند التلقائي:</strong> ${qRef.decreeNumber}
                        ${qRef.lessonOrder ? ` • <span style="color:#0369a1;font-weight:800;">الدرس #${qRef.lessonOrder} (${qRef.officialHours}س)</span>` : ''}
                        ${qRef.domainWeight ? ` • <span style="color:#92400e;font-weight:800;">الإطار المرجعي: ${qRef.domainWeight}</span>` : ''}
                    </div>
                    <span style="font-size: 0.7rem; color: #475569;">يُرفق تلقائياً بالحصة عند الحفظ ✓</span>
                </div>
            `;
        }
    }

    /**
     * نسخ السند القانوني الكامل من النموذج الحالي
     */
    function copyCurrentFormLegalReference() {
        const className = document.getElementById('lessonLogClassSelect')?.value || '';
        const lessonTitle = document.getElementById('lessonLogNumber')?.value || '';
        const sessionType = document.getElementById('lessonLogSessionType')?.value || 'cours';
        const outOfSchedule = document.getElementById('lessonLogOutOfScheduleCheck')?.checked || false;
        const ref = resolveLessonLegalReference(className, { number: lessonTitle, sessionType, outOfSchedule }, sessionType);
        copyRawTextWithToast(ref.fullCitationText, '📋 تم نسخ السند القانوني والمذكرة الوزارية المرتبطة بالدرس بنجاح!');
    }

    /**
     * إدراج السند القانوني والمذكرة الوزارية تلقائياً في ملاحظات الحصة
     */
    function insertLegalReferenceIntoLessonNotes() {
        const className = document.getElementById('lessonLogClassSelect')?.value || '';
        const lessonTitle = document.getElementById('lessonLogNumber')?.value || '';
        const sessionType = document.getElementById('lessonLogSessionType')?.value || 'cours';
        const outOfSchedule = document.getElementById('lessonLogOutOfScheduleCheck')?.checked || false;
        const ref = resolveLessonLegalReference(className, { number: lessonTitle, sessionType, outOfSchedule }, sessionType);

        const notesInput = document.getElementById('lessonLogNotes');
        if (!notesInput) return;

        const legalLine = `⚖️ السند التنظيمي: ${ref.decreeNumber} | ${ref.curriculumPositionStr}${ref.domainWeight ? ` | الإطار المرجعي: ${ref.domainName} (${ref.domainWeight})` : ''}.`;
        const currentVal = notesInput.value.trim();
        if (currentVal.includes(ref.decreeNumber)) {
            const toastFn = window.showAppToast || window.showToast;
            if (typeof toastFn === 'function') toastFn('ℹ️ السند القانوني مدرج بالفعل في ملاحظات هذه الحصة.', 'info');
            return;
        }
        notesInput.value = currentVal ? `${currentVal}\n${legalLine}` : legalLine;
        const toastFn = window.showAppToast || window.showToast;
        if (typeof toastFn === 'function') {
            toastFn('📌 تم إدراج السند القانوني والمذكرة الوزارية في ملاحظات الحصة بنجاح!', 'success');
        }
    }

    /**
     * نسخ السند القانوني لحصة محفوظة في الأرشيف
     */
    function copySessionCardLegalReference(className, logId) {
        const logs = (window.db && window.db.lessonLogs && window.db.lessonLogs[className]) ? window.db.lessonLogs[className] : [];
        const log = logs.find(l => String(l.id) === String(logId));
        if (!log) return;
        const ref = resolveLessonLegalReference(className, log, log.sessionType);
        copyRawTextWithToast(ref.fullCitationText, '📋 تم نسخ السند القانوني والمذكرة الوزارية للحصة إلى الحافظة!');
    }

    function copyRawTextWithToast(text, successMsg) {
        const notify = () => {
            const toastFn = window.showAppToast || window.showToast;
            if (typeof toastFn === 'function') {
                toastFn(successMsg || '📋 تم نسخ السند القانوني للحافظة بنجاح!', 'success');
            }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(notify).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (e) {}
                document.body.removeChild(ta);
                notify();
            });
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            notify();
        }
    }

    /**
     * نسخ السند القانوني إلى الحافظة بنقرة واحدة من داخل نافذة المذكرات
     */
    function copyLegalCitation(decreeNumber, articleTitle, articleText) {
        const citation = `السند القانوني التنظيمي (${decreeNumber} - مادة: ${articleTitle}):\n«${articleText}»`;
        copyRawTextWithToast(citation, '📋 تم نسخ السند القانوني للحافظة بنجاح للاستشهاد به في تقاريرك!');
    }

    /**
     * بناء محتوى نافذة المذكرات الوزارية
     */
    function buildDecreesContentHTML(filterText = '') {
        const query = (filterText || '').trim().toLowerCase();
        const filtered = MINISTERIAL_DECREES.filter(d => {
            if (!query) return true;
            return d.id.toLowerCase() === query ||
                   d.number.toLowerCase().includes(query) ||
                   d.title.toLowerCase().includes(query) ||
                   d.category.toLowerCase().includes(query) ||
                   d.summary.toLowerCase().includes(query) ||
                   d.keyArticles.some(a => a.title.toLowerCase().includes(query) || a.text.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #64748b;">لا توجد نصوص أو مذكرات مطابقة لبحثك.</div>';
        }

        return filtered.map(d => `
        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-right: 5px solid ${d.color}; border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                <div>
                    <span style="background: #f1f5f9; color: ${d.color}; font-weight: 900; font-size: 0.76rem; padding: 3px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">${d.category}</span>
                    <h4 style="margin: 6px 0 2px 0; color: #0f172a; font-size: 1.05rem; font-weight: 900;">${d.number}: ${d.title}</h4>
                    <div style="font-size: 0.74rem; color: #64748b;">تاريخ الصدور الرسمي: ${d.date}</div>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: #334155; line-height: 1.5; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 8px;">
                ${d.summary}
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
                ${d.keyArticles.map(art => `
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="font-weight: 800; color: ${d.color}; font-size: 0.82rem; margin-bottom: 4px;">📌 ${art.title}</div>
                            <div style="font-size: 0.76rem; color: #475569; line-height: 1.45; margin-bottom: 8px;">${art.text}</div>
                        </div>
                        <button type="button" onclick="window.copyLegalCitation('${d.number.replace(/'/g, "\\'")}', '${art.title.replace(/'/g, "\\'")}', '${art.text.replace(/'/g, "\\'")}')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #1e3a8a; padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px; align-self: flex-start; transition: all 0.2s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#f8fafc'">
                            <span>📋 نسخ السند للاستشهاد به</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
        `).join('');
    }

    /**
     * فتح نافذة دليل المذكرات الوزارية (مع إمكانية تمرير معرف مذكرة أو نص للفلترة المباشرة)
     */
    function openMinisterialDecreesModal(initialFilter = '') {
        let modal = document.getElementById('ministerialDecreesLibraryModal');
        if (!modal) {
            modal = createDecreesModalElement();
            document.body.appendChild(modal);
        }

        const searchInp = document.getElementById('decreesSearchInput');
        let filterVal = '';
        if (initialFilter && typeof initialFilter === 'string') {
            const matchedById = MINISTERIAL_DECREES.find(d => d.id === initialFilter);
            filterVal = matchedById ? matchedById.number : initialFilter;
        }
        if (searchInp) {
            searchInp.value = filterVal;
        }

        const container = document.getElementById('decreesModalCardsContainer');
        if (container) {
            container.innerHTML = buildDecreesContentHTML(filterVal);
        }

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    function closeMinisterialDecreesModal() {
        const modal = document.getElementById('ministerialDecreesLibraryModal');
        if (modal) modal.style.display = 'none';
    }

    function createDecreesModalElement() {
        const m = document.createElement('div');
        m.id = 'ministerialDecreesLibraryModal';
        m.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 10080; align-items: center; justify-content: center; padding: 14px;';
        m.onclick = (e) => { if (e.target === m) closeMinisterialDecreesModal(); };

        m.innerHTML = `
        <div class="card" style="width: 100%; max-width: 1050px; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
            <div style="padding: 14px 20px; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #1e3a8a, #4338ca); color: #fff;">
                        <span data-lucide="scale" data-size="20"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">دليل المذكرات والنصوص التنظيمية الوزارية (مادة الرياضيات)</h3>
                        <div style="font-size: 0.76rem; color: #64748b; font-weight: 600;">المرجعيات القانونية والديداكتيكية الرسمية للمراقبة المستمرة، دفاتر النصوص، الأطر المرجعية، ومجالس الأقسام</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="text" id="decreesSearchInput" placeholder="بحث سريع في المذكرات والمواد..." oninput="window.onDecreesSearch(this.value)" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.82rem; outline: none; width: 220px;">
                    <button type="button" onclick="document.getElementById('decreesSearchInput').value=''; window.onDecreesSearch('');" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 6px 10px; border-radius: 8px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">عرض الكل</button>
                    <button type="button" onclick="window.closeMinisterialDecreesModal()" style="background: #f1f5f9; border: none; color: #64748b; width: 32px; height: 32px; border-radius: 8px; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
            </div>
            <div id="decreesModalCardsContainer" style="flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc;"></div>
        </div>
        `;
        return m;
    }

    window.onDecreesSearch = function (val) {
        const container = document.getElementById('decreesModalCardsContainer');
        if (container) {
            container.innerHTML = buildDecreesContentHTML(val);
        }
    };

    window.MINISTERIAL_DECREES = MINISTERIAL_DECREES;
    window.resolveLessonLegalReference = resolveLessonLegalReference;
    window.renderSessionLegalReferenceHtml = renderSessionLegalReferenceHtml;
    window.updateLessonLogSmartLegalCard = updateLessonLogSmartLegalCard;
    window.copyCurrentFormLegalReference = copyCurrentFormLegalReference;
    window.insertLegalReferenceIntoLessonNotes = insertLegalReferenceIntoLessonNotes;
    window.copySessionCardLegalReference = copySessionCardLegalReference;
    window.copyLegalCitation = copyLegalCitation;
    window.openMinisterialDecreesModal = openMinisterialDecreesModal;
    window.closeMinisterialDecreesModal = closeMinisterialDecreesModal;

})(window);
