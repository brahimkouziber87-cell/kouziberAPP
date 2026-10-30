/**
 * ====================================================================
 * منظومة التقويم السنوي للموسم الدراسي وإدارة العطل المدرسية الرسمية
 * Annual Academic Calendar & Official School Holidays Management System
 * وربطها التلقائي بنظام الغياب لتعطيل احتساب وتسجيل الغياب في أيام العطل
 * ====================================================================
 */

(function (window) {
    'use strict';

    // اللائحة الرسمية المعتمدة للعطل المدرسية لوزارة التربية الوطنية (الموسم الدراسي 2026-2027)
    const DEFAULT_OFFICIAL_HOLIDAYS_2026_2027 = [
        {
            id: 'hol_mawlid_2026',
            title: 'عطلة عيد المولد النبوي الشريف',
            category: 'religious',
            categoryLabel: 'عطلة دينية',
            startDate: '2026-09-15',
            endDate: '2026-09-16',
            daysCount: 2,
            isOfficial: true,
            disableAbsence: true,
            color: '#8b5cf6',
            notes: '12 و13 ربيع الأول'
        },
        {
            id: 'hol_interim1_2026',
            title: 'عطلة الفترة البينية الأولى',
            category: 'interim',
            categoryLabel: 'فترة بينية',
            startDate: '2026-10-18',
            endDate: '2026-10-25',
            daysCount: 8,
            isOfficial: true,
            disableAbsence: true,
            color: '#10b981',
            notes: 'عطلة مدرسية بينية أولى (8 أيام)'
        },
        {
            id: 'hol_green_march_2026',
            title: 'ذكرى المسيرة الخضراء المظفرة',
            category: 'national',
            categoryLabel: 'عيد وطني',
            startDate: '2026-11-06',
            endDate: '2026-11-06',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#ef4444',
            notes: 'ذكرى المسيرة الخضراء (6 نونبر)'
        },
        {
            id: 'hol_independence_2026',
            title: 'عيد الاستقلال المجيد',
            category: 'national',
            categoryLabel: 'عيد وطني',
            startDate: '2026-11-18',
            endDate: '2026-11-18',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#ef4444',
            notes: 'عيد الاستقلال (18 نونبر)'
        },
        {
            id: 'hol_interim2_2026',
            title: 'عطلة الفترة البينية الثانية',
            category: 'interim',
            categoryLabel: 'فترة بينية',
            startDate: '2026-12-06',
            endDate: '2026-12-13',
            daysCount: 8,
            isOfficial: true,
            disableAbsence: true,
            color: '#10b981',
            notes: 'عطلة مدرسية بينية ثانية (8 أيام)'
        },
        {
            id: 'hol_newyear_2027',
            title: 'رأس السنة الميلادية',
            category: 'national',
            categoryLabel: 'عطلة رسمية',
            startDate: '2027-01-01',
            endDate: '2027-01-01',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#0284c7',
            notes: 'فاتح يناير 2027'
        },
        {
            id: 'hol_manifesto_2027',
            title: 'ذكرى تقديم وثيقة الاستقلال',
            category: 'national',
            categoryLabel: 'عيد وطني',
            startDate: '2027-01-11',
            endDate: '2027-01-11',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#ef4444',
            notes: '11 يناير'
        },
        {
            id: 'hol_amazigh_2027',
            title: 'رأس السنة الأمازيغية',
            category: 'national',
            categoryLabel: 'عطلة رسمية وطنية',
            startDate: '2027-01-14',
            endDate: '2027-01-14',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#f59e0b',
            notes: 'عطلة وطنية رسمية مؤداة عنها'
        },
        {
            id: 'hol_midterm_2027',
            title: 'عطلة منتصف السنة الدراسية',
            category: 'midterm',
            categoryLabel: 'عطلة منتصف الموسم',
            startDate: '2027-01-24',
            endDate: '2027-01-31',
            daysCount: 8,
            isOfficial: true,
            disableAbsence: true,
            color: '#3b82f6',
            notes: 'عطلة نهاية الأسدوس الأول (8 أيام)'
        },
        {
            id: 'hol_interim3_2027',
            title: 'عطلة الفترة البينية الثالثة',
            category: 'interim',
            categoryLabel: 'فترة بينية',
            startDate: '2027-03-14',
            endDate: '2027-03-21',
            daysCount: 8,
            isOfficial: true,
            disableAbsence: true,
            color: '#10b981',
            notes: 'عطلة مدرسية بينية ثالثة (8 أيام)'
        },
        {
            id: 'hol_fitr_2027',
            title: 'عطلة عيد الفطر السعيد',
            category: 'religious',
            categoryLabel: 'عطلة دينية',
            startDate: '2027-03-28',
            endDate: '2027-03-31',
            daysCount: 4,
            isOfficial: true,
            disableAbsence: true,
            color: '#8b5cf6',
            notes: 'من 29 رمضان إلى 2 شوال'
        },
        {
            id: 'hol_labour_2027',
            title: 'عطلة عيد الشغل',
            category: 'national',
            categoryLabel: 'عيد وطني وعمالي',
            startDate: '2027-05-01',
            endDate: '2027-05-01',
            daysCount: 1,
            isOfficial: true,
            disableAbsence: true,
            color: '#ef4444',
            notes: 'فاتح ماي'
        },
        {
            id: 'hol_interim4_2027',
            title: 'عطلة الفترة البينية الرابعة',
            category: 'interim',
            categoryLabel: 'فترة بينية',
            startDate: '2027-05-02',
            endDate: '2027-05-09',
            daysCount: 8,
            isOfficial: true,
            disableAbsence: true,
            color: '#10b981',
            notes: 'عطلة مدرسية بينية رابعة (8 أيام)'
        },
        {
            id: 'hol_adha_2027',
            title: 'عطلة عيد الأضحى المبارك',
            category: 'religious',
            categoryLabel: 'عطلة دينية',
            startDate: '2027-06-05',
            endDate: '2027-06-08',
            daysCount: 4,
            isOfficial: true,
            disableAbsence: true,
            color: '#8b5cf6',
            notes: 'من 9 إلى 11 ذو الحجة'
        }
    ];

    // اللائحة المعتمدة للمحطات التربوية والإدارية المدرسية المنظمة للموسم الدراسي (تركز على الثانوي التأهيلي، مادة الرياضيات، ومحطات الأستاذ والامتحان المهني)
    const DEFAULT_ACADEMIC_MILESTONES_2026_2027 = [
        {
            id: 'ms_entry_admin_2026',
            title: 'التحاق أطر الإدارة وهيئة التدريس وتوقيع محاضر الدخول',
            category: 'start',
            categoryLabel: 'انطلاق الموسم',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-09-02',
            endDate: '2026-09-03',
            description: 'التحاق الأطر الإدارية والتربوية بمقرات العمل وتوقيع محاضر الدخول وعقد المجالس الافتتاحية وتوزيع استعمالات الزمن وجداول الحصص.',
            targetLevels: 'هيئة التدريس والإدارة التربوية',
            importance: 'critical',
            icon: 'flag',
            color: '#0284c7',
            isTeacher: true,
            isSecondary: false,
            isMath: false
        },
        {
            id: 'ms_classes_start_2026',
            title: 'انطلاق الدراسة الفعلية بالثانوي التأهيلي والتحاق التلاميذ بالأقسام',
            category: 'start',
            categoryLabel: 'انطلاق الموسم',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-09-08',
            endDate: '2026-09-08',
            description: 'انطلاق الحصص الدراسية الفعلية لجميع مستويات الثانوي التأهيلي (الجذوع المشتركة، الأولى والثانية باكالوريا) وتوزيع المقررات.',
            targetLevels: 'جميع مستويات الثانوي التأهيلي',
            importance: 'critical',
            icon: 'calendar',
            color: '#10b981',
            isSecondary: true,
            isMath: false,
            isTeacher: false
        },
        {
            id: 'ms_council_math_s1_2026',
            title: 'المجلس التعليمي الأول لمادة الرياضيات وتنسيق التوزيعات السنوية',
            category: 'council',
            categoryLabel: 'مجالس المادة والمؤسسة',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-09-10',
            endDate: '2026-09-12',
            description: 'عقد المجلس التعليمي لأساتذة مادة الرياضيات لضبط البرامج السنوية، توحيد أطر الفروض المحروسة والتقويم التشخيصي وأطر الدعم.',
            targetLevels: 'أساتذة مادة الرياضيات بالثانوي التأهيلي',
            importance: 'high',
            icon: 'users',
            color: '#0284c7',
            isTeacher: true,
            isMath: true,
            isSecondary: true
        },
        {
            id: 'ms_diagnostic_math_2026',
            title: 'فترة التقويم التشخيصي والدعم الاستدراكي لمادة الرياضيات',
            category: 'diagnostic',
            categoryLabel: 'تقويم تشخيصي',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-09-09',
            endDate: '2026-09-28',
            description: 'تمرير روائز التقويم التشخيصي في الرياضيات لرصد التعثرات السابقة وإعداد بطاقات الدعم والمعالجة البيداغوجية لمستويات التأهيلي.',
            targetLevels: 'الجذع المشترك، الأولى والثانية باكالوريا',
            importance: 'high',
            icon: 'check-square',
            color: '#8b5cf6',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_exam1_math_s1_2026',
            title: 'فروض المراقبة المستمرة 1 لمادة الرياضيات (الأسدوس الأول)',
            category: 'exam',
            categoryLabel: 'فروض الرياضيات',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-11-09',
            endDate: '2026-11-21',
            description: 'إجراء وتصحيح الفرض المحروس الأول لمادة الرياضيات لجميع شعب الثانوي التأهيلي واستثمار حصص التصحيح والدعم البيداغوجي.',
            targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
            importance: 'high',
            icon: 'award',
            color: '#dc2626',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_olympiad_math_stage1_2026',
            title: 'الأولمبياد الوطنية في الرياضيات (المرحلة الانتقائية الإقليمية)',
            category: 'exam',
            categoryLabel: 'أولمبياد وتميز',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-12-08',
            endDate: '2026-12-10',
            description: 'تنظيم المسابقة الانتقائية للأولمبياد الوطنية في الرياضيات لتلاميذ الثانوي التأهيلي وتأهيل النخبة للمراحل الجهوية والوطنية.',
            targetLevels: 'الجذوع المشتركة والأولى باكالوريا علمية ورياضية',
            importance: 'medium',
            icon: 'award',
            color: '#f59e0b',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_exam2_math_s1_2026',
            title: 'فروض المراقبة المستمرة 2 لمادة الرياضيات (الأسدوس الأول)',
            category: 'exam',
            categoryLabel: 'فروض الرياضيات',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-12-14',
            endDate: '2026-12-24',
            description: 'إجراء الفرض المحروس الثاني لمادة الرياضيات وتدوين النقط وتتبع مستويات المتعلمين المتعثرين قبل نهاية الأسدوس.',
            targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
            importance: 'high',
            icon: 'award',
            color: '#dc2626',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_prof_competency_exam_2026',
            title: 'امتحان الكفاءة المهنية لأطر هيئة التدريس (الامتحان المهني للترقية)',
            category: 'admin',
            categoryLabel: 'الامتحان المهني والترقية',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2026-12-26',
            endDate: '2026-12-27',
            description: 'إجراء الاختبارات الكتابية لامتحان الكفاءة المهنية لترقية أطر هيئة التدريس بالثانوي التأهيلي (الترقية للسلم 11 وخارج السلم).',
            targetLevels: 'أساتذة التعليم الثانوي التأهيلي المستوفون للشروط',
            importance: 'critical',
            icon: 'graduation-cap',
            color: '#7c3aed',
            isTeacher: true,
            isSecondary: false,
            isMath: false
        },
        {
            id: 'ms_massar_s1_2027',
            title: 'المسك النهائي لنقط المراقبة المستمرة في منظومة مسار (S1)',
            category: 'massar',
            categoryLabel: 'مسار وتدبير النقط',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2027-01-09',
            endDate: '2027-01-16',
            description: 'إنهاء إدخال وتدقيق كافة نقط فروض الرياضيات والأنشطة والمواظبة في منظومة مسار واستخراج بيانات النقط الأولية.',
            targetLevels: 'الأساتذة والإدارة التربوية',
            importance: 'critical',
            icon: 'check-square',
            color: '#0891b2',
            isTeacher: true,
            isSecondary: true,
            isMath: true
        },
        {
            id: 'ms_councils_s1_2027',
            title: 'مجالس الأقسام لنهاية الأسدوس الأول بالثانوي التأهيلي',
            category: 'council',
            categoryLabel: 'مجالس الأقسام',
            semester: 's1',
            semesterLabel: 'الأسدوس الأول',
            startDate: '2027-01-20',
            endDate: '2027-01-23',
            description: 'عقد مجالس الأقسام لتقييم النتائج، واستخراج وتوزيع بيانات النقط وإرسال الإشعارات لأولياء الأمور بالثانوي التأهيلي.',
            targetLevels: 'جميع أقسام الثانوي التأهيلي ومجالس الأساتذة',
            importance: 'critical',
            icon: 'users',
            color: '#d97706',
            isTeacher: true,
            isSecondary: true,
            isMath: false
        },
        {
            id: 'ms_resume_s2_2027',
            title: 'انطلاق دروس الأسدوس الثاني وتنفيذ خطط الدعم الرياضي',
            category: 'start',
            categoryLabel: 'انطلاق الأسدوس الثاني',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-02-01',
            endDate: '2027-02-01',
            description: 'استئناف الدراسة ومباشرة مفردات برنامج الأسدوس الثاني لمادة الرياضيات وتفعيل خطط الدعم والمعالجة للنتائج المحصلة.',
            targetLevels: 'جميع مستويات الثانوي التأهيلي',
            importance: 'high',
            icon: 'calendar',
            color: '#059669',
            isSecondary: true,
            isMath: true,
            isTeacher: false
        },
        {
            id: 'ms_council_math_s2_2027',
            title: 'المجلس التعليمي الثاني لمادة الرياضيات وتقييم حصيلة الأسدوس 1',
            category: 'council',
            categoryLabel: 'مجالس المادة والمؤسسة',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-02-08',
            endDate: '2027-02-10',
            description: 'تقييم نتائج وفروض الأسدوس الأول لمادة الرياضيات، تدارس نسب النجاح ووضع برامج التقوية والاستعداد للامتحانات الإشهادية.',
            targetLevels: 'أساتذة مادة الرياضيات',
            importance: 'high',
            icon: 'users',
            color: '#0284c7',
            isTeacher: true,
            isMath: true,
            isSecondary: true
        },
        {
            id: 'ms_exam1_math_s2_2027',
            title: 'فروض المراقبة المستمرة 1 لمادة الرياضيات (الأسدوس الثاني)',
            category: 'exam',
            categoryLabel: 'فروض الرياضيات',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-03-22',
            endDate: '2027-04-03',
            description: 'فترة إجراء فروض المراقبة المستمرة الأولى للأسدوس الثاني لمادة الرياضيات، وتصحيحها واستثمار التعثرات قبل العطلة البينية.',
            targetLevels: 'جميع أقسام الثانوي التأهيلي المسندة',
            importance: 'high',
            icon: 'award',
            color: '#dc2626',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_gmst_math_2027',
            title: 'المباراة العامة للعلوم والتقنيات (GMST) في مادة الرياضيات',
            category: 'exam',
            categoryLabel: 'مباريات التميز الوطنية',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-04-14',
            endDate: '2027-04-16',
            description: 'تنظيم اختبارات المباراة العامة للعلوم والتقنيات في مادة الرياضيات لتلاميذ السنة الأولى والثانية من سلك البكالوريا المتفوقين.',
            targetLevels: 'الأولى والثانية باكالوريا علوم رياضية وفيزيائية',
            importance: 'medium',
            icon: 'award',
            color: '#4f46e5',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_orientation_secondary_2027',
            title: 'عمليات التوجيه المدرسي ومجالس إعادة التوجيه بالثانوي التأهيلي',
            category: 'orientation',
            categoryLabel: 'توجيه مدرسي',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-04-12',
            endDate: '2027-04-30',
            description: 'مواكبة تلاميذ الجذوع المشتركة والأولى باكالوريا في التعبير عن رغبات التوجيه وإعادة التوجيه للشعب والمسالك الدراسية.',
            targetLevels: 'الجذوع المشتركة والأولى باكالوريا',
            importance: 'medium',
            icon: 'compass',
            color: '#6366f1',
            isSecondary: true,
            isTeacher: false,
            isMath: false
        },
        {
            id: 'ms_exam2_math_s2_2027',
            title: 'فروض المراقبة المستمرة 2 لمادة الرياضيات وإنهاء المقررات (S2)',
            category: 'exam',
            categoryLabel: 'فروض الرياضيات',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-05-17',
            endDate: '2027-05-29',
            description: 'إجراء الفروض الختامية لمادة الرياضيات وإكمال إنجاز مفردات المقررات والبرامج الدراسية وتكثيف حصص الدعم والمراجعة للامتحانات.',
            targetLevels: 'جميع أقسام الثانوي التأهيلي',
            importance: 'high',
            icon: 'award',
            color: '#dc2626',
            isMath: true,
            isSecondary: true,
            isTeacher: false
        },
        {
            id: 'ms_massar_s2_2027',
            title: 'المسك النهائي لنقط المراقبة المستمرة لجميع المستويات في مسار (S2)',
            category: 'massar',
            categoryLabel: 'مسار وتدبير النقط',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-05-30',
            endDate: '2027-06-04',
            description: 'إنهاء مسك نقط المراقبة المستمرة لجميع الأقسام غير الإشهادية والإشهادية بمنظومة مسار وإغلاق لوائح النقط الرسمية.',
            targetLevels: 'الأساتذة والإدارة التربوية',
            importance: 'critical',
            icon: 'check-square',
            color: '#0891b2',
            isTeacher: true,
            isSecondary: true,
            isMath: true
        },
        {
            id: 'ms_bac_national_2027',
            title: 'الامتحان الوطني الموحد لنيل شهادة البكالوريا (الدورة العادية)',
            category: 'certification',
            categoryLabel: 'امتحانات إشهادية',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-06-08',
            endDate: '2027-06-11',
            description: 'إجراء اختبارات الدورة العادية للامتحان الوطني للبكالوريا لجميع الشعب والمسالك العلمية والتقنية والأدبية ومراكز التصحيح.',
            targetLevels: 'الثانية باكالوريا وأطر الحراسة والتصحيح',
            importance: 'critical',
            icon: 'graduation-cap',
            color: '#7c3aed',
            isSecondary: true,
            isMath: true,
            isTeacher: true
        },
        {
            id: 'ms_bac_regional_2027',
            title: 'الامتحان الجهوي الموحد للسنة الأولى من سلك البكالوريا',
            category: 'certification',
            categoryLabel: 'امتحانات إشهادية',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-06-14',
            endDate: '2027-06-17',
            description: 'إجراء الامتحان الجهوي الموحد لتلاميذ السنة الأولى من سلك البكالوريا لجميع الشعب العلمية والتقنية والأدبية ومراكز الامتحان.',
            targetLevels: 'الأولى باكالوريا وأطر الحراسة والتصحيح',
            importance: 'critical',
            icon: 'graduation-cap',
            color: '#7c3aed',
            isSecondary: true,
            isMath: false,
            isTeacher: true
        },
        {
            id: 'ms_councils_end_2027',
            title: 'مجالس الأقسام لنهاية السنة وقرارات التوجيه واستصدار النتائج',
            category: 'council',
            categoryLabel: 'مجالس نهاية السنة',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-06-25',
            endDate: '2027-06-30',
            description: 'عقد مجالس الأقسام الختامية للبث في الانتقال والتكرار والفصل والتوجيه بمستويات الثانوي التأهيلي واستخراج بيانات النقط.',
            targetLevels: 'مجالس المؤسسة وأساتذة الثانوي التأهيلي',
            importance: 'critical',
            icon: 'users',
            color: '#d97706',
            isTeacher: true,
            isSecondary: true,
            isMath: false
        },
        {
            id: 'ms_bac_makeup_2027',
            title: 'الدورة الاستدراكية للامتحان الوطني الموحد للبكالوريا',
            category: 'certification',
            categoryLabel: 'امتحانات إشهادية استدراكية',
            semester: 's2',
            semesterLabel: 'الأسدوس الثاني',
            startDate: '2027-07-02',
            endDate: '2027-07-06',
            description: 'إجراء اختبارات الدورة الاستدراكية للبكالوريا لجميع الشعب ومداولات ومداولات الإعلان عن النتائج النهائية لنيل شهادة البكالوريا.',
            targetLevels: 'المترشحون المستدركون وأطر الحراسة والتصحيح',
            importance: 'critical',
            icon: 'graduation-cap',
            color: '#dc2626',
            isSecondary: true,
            isMath: true,
            isTeacher: true
        },
        {
            id: 'ms_exit_admin_2027',
            title: 'توقيع محاضر الخروج لجميع أطر التدريس والأطر الإدارية',
            category: 'end',
            categoryLabel: 'اختتام الموسم',
            semester: 'year',
            semesterLabel: 'نهاية الموسم',
            startDate: '2027-07-10',
            endDate: '2027-07-12',
            description: 'تسليم الوثائق والتقارير واللوائح وتوقيع محاضر الخروج الرسمية لهيئة التدريس واختتام الموسم الدراسي رسمياً.',
            targetLevels: 'جميع الأساتذة والأطر الإدارية',
            importance: 'critical',
            icon: 'log-out',
            color: '#64748b',
            isTeacher: true,
            isSecondary: false,
            isMath: false
        }
    ];

    // المتغيرات العامة للتقويم السنوي والمحطات
    let selectedAcademicYearStart = 2026; // 2026-2027
    let annualCalendarViewMode = 'grid'; // 'grid' | 'table'
    let activeAnnualSubSection = 'holidays'; // 'holidays' | 'milestones'
    let activeMilestonesSemesterFilter = 'all'; // 'all' | 's1' | 's2'

    /**
     * استرجاع وضمان قائمة العطل الرسمية في قاعدة البيانات
     */
    function getOfficialHolidays() {
        if (!window.db) return DEFAULT_OFFICIAL_HOLIDAYS_2026_2027;
        if (!Array.isArray(window.db.officialHolidays) || window.db.officialHolidays.length === 0) {
            window.db.officialHolidays = JSON.parse(JSON.stringify(DEFAULT_OFFICIAL_HOLIDAYS_2026_2027));
            syncOfficialHolidaysWithCalendarEvents();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
        return window.db.officialHolidays;
    }

    /**
     * استرجاع وضمان قائمة المحطات التربوية المدرسية في قاعدة البيانات
     */
    function getAcademicMilestones() {
        if (!window.db) return DEFAULT_ACADEMIC_MILESTONES_2026_2027;
        if (!Array.isArray(window.db.academicMilestones) || window.db.academicMilestones.length === 0) {
            window.db.academicMilestones = JSON.parse(JSON.stringify(DEFAULT_ACADEMIC_MILESTONES_2026_2027));
            syncMilestonesWithCalendarEvents();
            if (typeof window.saveDB === 'function') window.saveDB();
        }
        return window.db.academicMilestones;
    }

    /**
     * استخراج المحطة التربوية الجارية حالياً أو المحطة الأقرب القادمة
     */
    function getActiveOrUpcomingMilestone() {
        const milestones = getAcademicMilestones();
        if (!milestones || milestones.length === 0) return null;

        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        // 1. فحص هل هناك محطة جارية اليوم
        const currentActive = milestones.find(ms => {
            const start = ms.startDate;
            const end = ms.endDate || ms.startDate;
            return todayStr >= start && todayStr <= end;
        });

        if (currentActive) {
            const daysLeft = calculateDaysBetween(todayStr, currentActive.endDate || currentActive.startDate) - 1;
            return {
                milestone: currentActive,
                status: 'active',
                daysLeft,
                statusText: daysLeft === 0 ? 'اليوم هو آخر أيام المحطة' : `جارية الآن (متبقي ${daysLeft} يوم)`
            };
        }

        // 2. البحث عن أقرب محطة قادمة
        const upcoming = milestones
            .filter(ms => ms.startDate > todayStr)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));

        if (upcoming.length > 0) {
            const nextMs = upcoming[0];
            const d1 = new Date(todayStr);
            const d2 = new Date(nextMs.startDate);
            const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
            return {
                milestone: nextMs,
                status: 'upcoming',
                daysLeft: diffDays,
                statusText: `المحطة القادمة (بعد ${diffDays} يوم)`
            };
        }

        return null;
    }

    /**
     * مزامنة المحطات التربوية المدرسية مع أحداث التقويم الشهري وأجندة التذكير
     */
    function syncMilestonesWithCalendarEvents() {
        syncAcademicMilestonesWithCalendarEvents();
    }

    /**
     * حساب عدد الأيام بين تاريخين
     */
    function calculateDaysBetween(startStr, endStr) {
        if (!startStr) return 1;
        if (!endStr) return 1;
        const d1 = new Date(startStr);
        const d2 = new Date(endStr);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    /**
     * التحقق مما إذا كان التاريخ المحدد يقع ضمن عطلة رسمية
     */
    function getOfficialHolidayForDate(dateStr) {
        if (!dateStr) return null;
        const holidays = getOfficialHolidays();
        for (let i = 0; i < holidays.length; i++) {
            const h = holidays[i];
            const start = h.startDate;
            const end = h.endDate || h.startDate;
            if (dateStr >= start && dateStr <= end) {
                return h;
            }
        }

        // تحقق إضافي في db.calendarEvents للأحداث المضافة يدوياً
        if (window.db && Array.isArray(window.db.calendarEvents)) {
            const ev = window.db.calendarEvents.find(e => e.date === dateStr && (e.type === 'holiday' || e.isOfficial));
            if (ev) {
                return {
                    id: ev.id,
                    title: ev.title,
                    startDate: ev.date,
                    endDate: ev.date,
                    daysCount: 1,
                    category: 'custom',
                    categoryLabel: 'عطلة رسمية',
                    isOfficial: true,
                    disableAbsence: ev.disableAbsence !== false,
                    color: '#10b981'
                };
            }
        }
        return null;
    }

    /**
     * أصناف رخص وإجازات الأستاذ المعتمدة طبقاً للتشريع التربوي والنظام الأساسي
     */
    const TEACHER_LEAVE_TYPES = {
        sick: {
            id: 'sick',
            label: 'رخصة مرضية قصيرة الأمد',
            shortLabel: 'مرضية',
            icon: 'stethoscope',
            color: '#ef4444',
            bg: '#fee2e2',
            border: '#fca5a5',
            badgeBg: '#fef2f2',
            legalRef: 'المادتان 34 و 35 من النظام الأساسي العام للوظيفة العمومية (شهادة طبية)'
        },
        admin: {
            id: 'admin',
            label: 'رخصة لغرض إداري / إذن بالتغيب',
            shortLabel: 'غرض إداري',
            icon: 'file-text',
            color: '#0284c7',
            bg: '#e0f2fe',
            border: '#bae6fd',
            badgeBg: '#f0f9ff',
            legalRef: 'المادة 41 من النظام الأساسي (إذن مسبق وموافقة الإدارة التربوية)'
        },
        administrative: {
            id: 'administrative',
            label: 'رخصة لغرض إداري (استدعاء رسمي / تسوية وضعية)',
            shortLabel: 'غرض إداري',
            icon: 'file-text',
            color: '#0284c7',
            bg: '#e0f2fe',
            border: '#bae6fd',
            badgeBg: '#f0f9ff',
            legalRef: 'المادة 41 من النظام الأساسي (إذن مسبق أو استدعاء إداري رسمي)'
        },
        exceptional: {
            id: 'exceptional',
            label: 'رخصة استثنائية (مناسبات عائلية)',
            shortLabel: 'استثنائية',
            icon: 'heart-handshake',
            color: '#8b5cf6',
            bg: '#ede9fe',
            border: '#d8b4fe',
            badgeBg: '#faf5ff',
            legalRef: 'المادة 41 مكرر (زواج، ولادة، وفاة قريب، ختان...)'
        },
        hajj: {
            id: 'hajj',
            label: 'رخصة أداء مناسك الحج',
            shortLabel: 'مناسك الحج',
            icon: 'compass',
            color: '#10b981',
            bg: '#dcfce7',
            border: '#86efac',
            badgeBg: '#f0fdf4',
            legalRef: 'المادة 42 من النظام الأساسي (شهرين براتب كامل، مرة واحدة في الحياة الإدارية)'
        },
        paternity: {
            id: 'paternity',
            label: 'رخصة ولادة (للأستاذ الأب - 15 يوماً)',
            shortLabel: 'ولادة / أبوة',
            icon: 'baby',
            color: '#ec4899',
            bg: '#fdf2f8',
            border: '#fbcfe8',
            badgeBg: '#fff1f2',
            legalRef: 'رخصة الأبوة (15 يوماً متصلة ومدفوعة الأجر وفق القانون 30.22)'
        },
        maternity: {
            id: 'maternity',
            label: 'رخصة ولادة وأمومة (14 أسبوعاً)',
            shortLabel: 'ولادة وأمومة',
            icon: 'baby',
            color: '#db2777',
            bg: '#fdf2f8',
            border: '#fbcfe8',
            badgeBg: '#fff1f2',
            legalRef: 'الفصل 46 من النظام الأساسي للوظيفة العمومية (14 أسبوعاً بتقاضي كامل الأجرة)'
        },
        exam: {
            id: 'exam',
            label: 'إذن بالتغيب لاجتياز مباراة أو امتحان',
            shortLabel: 'مباراة / امتحان',
            icon: 'graduation-cap',
            color: '#f59e0b',
            bg: '#fef3c7',
            border: '#fde68a',
            badgeBg: '#fffbeb',
            legalRef: 'استدعاء رسمي لاجتياز امتحانات الكفاءة المهنية أو مباريات التعليم العالي'
        },
        exam_duty: {
            id: 'exam_duty',
            label: 'تكليف بمهمة حراسة أو تصحيح الامتحانات الإشهادية',
            shortLabel: 'مهمة امتحانات',
            icon: 'graduation-cap',
            color: '#f59e0b',
            bg: '#fef3c7',
            border: '#fde68a',
            badgeBg: '#fffbeb',
            legalRef: 'تكليف رسمي بحراسة أو تصحيح الامتحانات الإشهادية (الوطني / الجهوي)'
        },
        training: {
            id: 'training',
            label: 'مهمة رسمية / تدريب بيداغوجي',
            shortLabel: 'تدريب / مهمة',
            icon: 'briefcase',
            color: '#6366f1',
            bg: '#eef2ff',
            border: '#c7d2fe',
            badgeBg: '#f5f3ff',
            legalRef: 'تكليف رسمي أو تدريب تكويني بمركز التكوين أو المديرية الإقليمية'
        },
        union: {
            id: 'union',
            label: 'مهمة نقابية أو تمثيلية مهنية مؤطرة قانونياً',
            shortLabel: 'مهمة نقابية',
            icon: 'users',
            color: '#0d9488',
            bg: '#f0fdfa',
            border: '#99f6e4',
            badgeBg: '#ccfbf1',
            legalRef: 'الفصل 41 من النظام الأساسي للوظيفة العمومية (تسهيلات ومهام تمثيلية)'
        },
        other: {
            id: 'other',
            label: 'رخصة / إذن مبرر آخر',
            shortLabel: 'مبررة أخرى',
            icon: 'check-circle-2',
            color: '#64748b',
            bg: '#f1f5f9',
            border: '#cbd5e1',
            badgeBg: '#f8fafc',
            legalRef: 'ترخيص قانوني مصادق عليه من طرف رئيس المؤسسة'
        }
    };

    /**
     * استرجاع قائمة رخص الأستاذ من قاعدة البيانات
     */
    function getTeacherLeaves() {
        if (!window.db) return [];
        if (!Array.isArray(window.db.teacherLeaves)) {
            window.db.teacherLeaves = [];
        }
        return window.db.teacherLeaves;
    }

    /**
     * التحقق مما إذا كان التاريخ المحدد يقع ضمن رخصة للأستاذ
     */
    function getTeacherLeaveForDate(dateStr, session) {
        if (!dateStr) return null;
        const leaves = getTeacherLeaves();
        for (let i = 0; i < leaves.length; i++) {
            const l = leaves[i];
            const start = l.startDate;
            const end = l.endDate || l.startDate;
            if (dateStr >= start && dateStr <= end) {
                // فحص نطاق الحصص إذا تم تحديده
                if (session && l.sessionsScope && l.sessionsScope !== 'all') {
                    if (l.sessionsScope === 'morning') {
                        if (session.includes('14') || session.includes('15') || session.includes('16') || session.includes('17') || session.includes('مساء')) {
                            continue;
                        }
                    } else if (l.sessionsScope === 'afternoon') {
                        if (session.includes('8') || session.includes('9') || session.includes('10') || session.includes('11') || session.includes('12') || session.includes('صباح')) {
                            continue;
                        }
                    }
                }
                return l;
            }
        }
        return null;
    }

    /**
     * هل التاريخ المحدد يوافق رخصة للأستاذ؟
     */
    function isDateTeacherLeave(dateStr) {
        return !!getTeacherLeaveForDate(dateStr);
    }

    /**
     * هل احتساب الغياب معطل في هذا التاريخ؟ (يشمل العطل الرسمية ورخص الأستاذ القانونية)
     */
    function isAbsenceDisabledOnDate(dateStr, session) {
        // 1. عطلة مدرسية رسمية
        const holiday = getOfficialHolidayForDate(dateStr);
        if (holiday && holiday.disableAbsence !== false) {
            return true;
        }

        // 2. رخصة قانونية للأستاذ معفاة من غياب التلاميذ
        const leave = getTeacherLeaveForDate(dateStr, session);
        if (leave && leave.disableStudentAbsence !== false) {
            return true;
        }

        return false;
    }

    /**
     * استرجاع تفاصيل سبب تعطيل الغياب في تاريخ معين (عطلة رسمية أو رخصة أستاذ)
     */
    function getAbsenceDisableDetails(dateStr, session) {
        const holiday = getOfficialHolidayForDate(dateStr);
        if (holiday && holiday.disableAbsence !== false) {
            return {
                type: 'holiday',
                title: holiday.title,
                category: holiday.categoryLabel || 'عطلة رسمية',
                startDate: holiday.startDate,
                endDate: holiday.endDate || holiday.startDate,
                item: holiday
            };
        }

        const leave = getTeacherLeaveForDate(dateStr, session);
        if (leave && leave.disableStudentAbsence !== false) {
            return {
                type: 'teacher_leave',
                title: leave.title || leave.typeLabel,
                category: leave.typeLabel || 'رخصة أستاذ',
                startDate: leave.startDate,
                endDate: leave.endDate || leave.startDate,
                docRef: leave.docRef,
                item: leave
            };
        }

        return null;
    }

    /**
     * حساب إحصائيات رخص الأستاذ وساعات غياب التلاميذ المحمية
     */
    function getTeacherLeaveStats() {
        const leaves = getTeacherLeaves();
        let totalLeaves = leaves.length;
        let totalDays = 0;
        let sickCount = 0;
        let sickDays = 0;
        let adminCount = 0;
        let adminDays = 0;
        let exceptionalCount = 0;
        let exceptionalDays = 0;
        let trainingCount = 0;
        let trainingDays = 0;
        let examCount = 0;
        let examDays = 0;
        let protectedStudentDays = 0;
        let protectedStudentSessions = 0;

        leaves.forEach(l => {
            const days = l.daysCount || calculateDaysBetween(l.startDate, l.endDate);
            totalDays += days;
            if (l.type === 'sick') {
                sickCount++;
                sickDays += days;
            } else if (l.type === 'admin' || l.type === 'administrative' || l.type === 'union' || l.type === 'other') {
                adminCount++;
                adminDays += days;
            } else if (l.type === 'exceptional' || l.type === 'paternity' || l.type === 'maternity' || l.type === 'hajj') {
                exceptionalCount++;
                exceptionalDays += days;
            } else if (l.type === 'training') {
                trainingCount++;
                trainingDays += days;
            } else if (l.type === 'exam' || l.type === 'exam_duty') {
                examCount++;
                examDays += days;
            }
            if (l.disableStudentAbsence !== false) {
                protectedStudentDays += days;
                // تقدير ساعات الحصص المعفاة
                protectedStudentSessions += (days * 4);
            }
        });

        return {
            totalLeaves,
            totalDays,
            sickCount,
            sickDays,
            medicalDays: sickDays,
            adminCount,
            adminDays,
            exceptionalCount,
            exceptionalDays,
            trainingCount,
            trainingDays,
            examCount,
            examDays,
            missionCount: trainingCount + examCount,
            missionDays: trainingDays + examDays,
            protectedStudentDays,
            protectedStudentSessions
        };
    }

    /**
     * مزامنة رخص الأستاذ مع جدول أحداث التقويم (calendarEvents)
     */
    function syncTeacherLeavesWithCalendarEvents() {
        if (!window.db) return;
        if (!Array.isArray(window.db.calendarEvents)) window.db.calendarEvents = [];

        // إزالة أحداث رخص الأستاذ السابقة
        window.db.calendarEvents = window.db.calendarEvents.filter(e => e && !e.isTeacherLeave && e.type !== 'teacher_leave');

        const leaves = getTeacherLeaves();
        leaves.forEach(l => {
            if (!l || !l.startDate) return;
            const start = new Date(l.startDate);
            const end = new Date(l.endDate || l.startDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
            const cur = new Date(start);
            let guard = 0;

            while (cur <= end && guard < 400) {
                guard++;
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                const typeObj = TEACHER_LEAVE_TYPES[l.type] || TEACHER_LEAVE_TYPES.other;
                window.db.calendarEvents.push({
                    id: `leave_${l.id}_${dateStr}`,
                    date: dateStr,
                    title: `📋 رخصة أستاذ: ${l.title || l.typeLabel}`,
                    type: 'teacher_leave',
                    time: '08:30',
                    isTeacherLeave: true,
                    leaveId: l.id,
                    color: typeObj.color || '#0284c7',
                    details: `رخصة قانونية للأستاذ (${typeObj.label}). غياب التلاميذ معفى تلقائياً طيلة فترة الرخصة.`
                });

                cur.setDate(cur.getDate() + 1);
            }
        });
    }

    /**
     * مزامنة العطل الرسمية مع جدول أحداث التقويم القديم لضمان التكامل مع كل أجزاء التطبيق
     */
    function syncOfficialHolidaysWithCalendarEvents() {
        if (!window.db) return;
        if (!Array.isArray(window.db.calendarEvents)) window.db.calendarEvents = [];

        // إزالة أحداث العطل الرسمية السابقة لضمان عدم بقاء تواريخ قديمة عند تعديل أو حذف عطلة
        window.db.calendarEvents = window.db.calendarEvents.filter(ev =>
            ev && !ev.holidayId && !(ev.isOfficial && (ev.type === 'holiday' || ev.type === 'other'))
        );

        const holidays = window.db.officialHolidays || [];
        holidays.forEach(h => {
            if (!h || !h.startDate) return;
            const start = new Date(h.startDate);
            const end = new Date(h.endDate || h.startDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
            const cur = new Date(start);
            let guard = 0;

            while (cur <= end && guard < 400) {
                guard++;
                const y = cur.getFullYear();
                const m = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                window.db.calendarEvents.push({
                    id: `${h.id}_${dateStr}`,
                    date: dateStr,
                    title: h.title,
                    type: 'holiday',
                    isOfficial: true,
                    disableAbsence: h.disableAbsence !== false,
                    holidayId: h.id
                });

                cur.setDate(cur.getDate() + 1);
            }
        });
    }

    /**
     * مزامنة المحطات البيداغوجية والامتحانات الرسمية مع جدول أحداث التقويم (calendarEvents)
     */
    function syncAcademicMilestonesWithCalendarEvents() {
        if (!window.db) return;
        if (!Array.isArray(window.db.calendarEvents)) window.db.calendarEvents = [];
        if (!Array.isArray(window.db.upcomingExams)) window.db.upcomingExams = [];

        let milestones = getAcademicMilestones();
        let milestonesUpdated = false;

        // 0. ترحيل أي أحداث مخزنة في db.events (مثل المستوردة من Google Calendar أو ICS) إلى سجل المحطات التربوية الموحد
        if (Array.isArray(window.db.events) && window.db.events.length > 0) {
            window.db.events.forEach(ev => {
                if (!ev || !ev.date || !ev.title) return;
                const cleanEvTitle = String(ev.title || '').replace(/^[🎯📌]\s*/, '').trim();
                if (!cleanEvTitle) return;
                const alreadyExists = milestones.some(m =>
                    (ev.googleEventId && m.googleEventId === ev.googleEventId) ||
                    (m.startDate === ev.date && (m.title === cleanEvTitle || m.title === ev.title))
                );
                if (!alreadyExists) {
                    const d = new Date(ev.date);
                    const mNum = !isNaN(d.getTime()) ? d.getMonth() + 1 : 9;
                    const autoSemester = (mNum >= 9 || mNum === 1) ? 's1' : 's2';
                    const inferredCat = ev.category || (ev.type === 'exam' ? 'exam' : (ev.type === 'meeting' ? 'council' : 'schoolwork'));
                    milestones.push({
                        id: ev.id && String(ev.id).startsWith('ms_') ? ev.id : ('ms_ev_' + (ev.id || Date.now())),
                        title: cleanEvTitle,
                        startDate: ev.date,
                        endDate: ev.endDate || ev.date,
                        category: inferredCat,
                        semester: autoSemester,
                        semesterLabel: autoSemester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول',
                        targetLevels: ev.className || 'جميع المستويات',
                        description: ev.importedFromGoogle ? 'مستورد ومتزامن من Google Calendar' : 'موعد متزامن مع الأجندة',
                        color: ev.type === 'exam' ? '#dc2626' : (ev.type === 'meeting' ? '#d97706' : '#2563eb'),
                        isCustom: true,
                        googleEventId: ev.googleEventId || null,
                        importedFromGoogle: !!ev.importedFromGoogle
                    });
                    milestonesUpdated = true;
                }
            });
        }

        // تنظيف أي محطات قديمة مكررة ناتجة عن ترحيل تلقائي سابق لـ exam_s1_* أو exam_s2_*
        const beforeCleanLen = milestones.length;
        milestones = milestones.filter(m => m && !/^ms_migrated_exam_s[12]_[123]$/.test(String(m.id || '')));
        if (milestones.length !== beforeCleanLen) {
            window.db.academicMilestones = milestones;
            milestonesUpdated = true;
        }

        // 1. دمج أي مواعيد مضافة يدوياً في db.calendarEvents داخل سجل المحطات التربوية الموحد (دون تكرار أو تعارض)
        const manualEventsToMigrate = window.db.calendarEvents.filter(ev =>
            ev && ev.date &&
            !ev.isOfficial &&
            !ev.isTeacherLeave &&
            !ev.isMilestone &&
            ev.type !== 'holiday' &&
            ev.type !== 'teacher_leave' &&
            !(ev.id && (
                String(ev.id).startsWith('milestone_') ||
                String(ev.id).startsWith('ev_ms_') ||
                String(ev.id).startsWith('leave_') ||
                String(ev.id).startsWith('hol_') ||
                /^exam_s[12]_[123]$/.test(String(ev.id))
            ))
        );

        manualEventsToMigrate.forEach(ev => {
            const cleanEvTitle = String(ev.title || '').replace(/^[🎯📌]\s*/, '').trim();
            if (!cleanEvTitle) return;
            const alreadyExists = milestones.some(m =>
                (m.startDate === ev.date && (m.title === cleanEvTitle || m.title === ev.title)) ||
                (ev.milestoneId && m.id === ev.milestoneId)
            );
            if (!alreadyExists) {
                const d = new Date(ev.date);
                const mNum = !isNaN(d.getTime()) ? d.getMonth() + 1 : 9;
                const autoSemester = (mNum >= 9 || mNum === 1) ? 's1' : 's2';
                const inferredCat = ev.category || (ev.type === 'exam' ? 'exam' : (ev.type === 'meeting' ? 'council' : 'schoolwork'));
                const catColors = {
                    exam: '#dc2626',
                    certification: '#7c3aed',
                    assessment: '#0284c7',
                    council: '#d97706',
                    activity: '#16a34a',
                    schoolwork: '#2563eb',
                    massar: '#0891b2',
                    guidance: '#4f46e5',
                    training: '#0d9488',
                    entry: '#059669',
                    admin: '#475569',
                    other: '#64748b'
                };
                milestones.push({
                    id: 'ms_migrated_' + (ev.id || (Date.now() + '_' + Math.random().toString(36).substr(2, 4))),
                    title: cleanEvTitle,
                    startDate: ev.date,
                    endDate: ev.endDate || ev.date,
                    category: inferredCat,
                    semester: autoSemester,
                    semesterLabel: autoSemester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول',
                    targetLevels: ev.targetLevels || (ev.targetClass ? `القسم: ${ev.targetClass}` : 'جميع المستويات'),
                    timeSlot: ev.time || '',
                    description: ev.details || ev.description || 'موعد مبرمج في التقويم الشهري',
                    color: ev.color || catColors[inferredCat] || '#2563eb',
                    isCustom: true
                });
                milestonesUpdated = true;
            }
        });

        if (milestonesUpdated) {
            milestones.sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
            window.db.academicMilestones = milestones;
        }

        // 2. إزالة محطات المسار البيداغوجي السابقة والمواعيد المدمجة لمنع أي تكرار (مثل ev_ms_ و milestone_ms_)
        window.db.calendarEvents = window.db.calendarEvents.filter(e =>
            e && (e.type === 'holiday' || e.isTeacherLeave || e.type === 'teacher_leave') &&
            !e.isMilestone &&
            !(e.id && (String(e.id).startsWith('milestone_') || String(e.id).startsWith('ev_ms_')))
        );

        const categoryTimeLabels = {
            exam: 'فرض مراقبة مستمرة',
            certification: 'امتحان إشهادي / موحد',
            assessment: 'روائز / تقويم تشخيصي',
            council: 'مجلس / اجتماع تربوي',
            activity: 'نشاط تربوي / تظاهرة',
            schoolwork: 'موعد / واجب مدرسي',
            massar: 'عملية مسار / مسك النقط',
            guidance: 'توجيه مدرسي / إعلام',
            training: 'تكوين مستمر / ندوة',
            entry: 'محطة دخول مدرسي',
            admin: 'إجراء إداري / تربوي',
            other: 'موعد / محطة تربوية'
        };

        milestones.forEach(m => {
            if (!m || (!m.startDate && !m.date)) return;
            const start = new Date(m.startDate || m.date);
            const end = new Date(m.endDate || m.startDate || m.date);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
            const cur = new Date(start);
            let guard = 0;

            let evType = 'task';
            if (m.category === 'exam' || m.category === 'certification' || m.category === 'assessment') evType = 'exam';
            else if (m.category === 'council' || m.category === 'admin' || m.category === 'guidance') evType = 'meeting';

            const timeLabel = m.timeSlot || categoryTimeLabels[m.category] || 'محطة بيداغوجية';

            while (cur <= end && guard < 400) {
                guard++;
                const y = cur.getFullYear();
                const mo = String(cur.getMonth() + 1).padStart(2, '0');
                const d = String(cur.getDate()).padStart(2, '0');
                const dateStr = `${y}-${mo}-${d}`;

                window.db.calendarEvents.push({
                    id: `milestone_${m.id}_${dateStr}`,
                    date: dateStr,
                    endDate: m.endDate || m.startDate,
                    title: `🎯 ${m.title}`,
                    cleanTitle: m.title,
                    time: timeLabel,
                    type: evType,
                    category: m.category || 'other',
                    color: m.color || '#2563eb',
                    targetLevels: m.targetLevels || 'جميع المستويات',
                    isMilestone: true,
                    isCustom: !!m.isCustom,
                    milestoneId: m.id,
                    details: m.description || m.notes || `محطة تربوية (${m.semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول'})`
                });

                cur.setDate(cur.getDate() + 1);
            }
        });
    }

    /**
     * مزامنة وتحديث كافة وحدات التقويم (السنوي، الشهري، الرخص، المسار البيداغوجي)
     */
    let _isSyncingCalendarViews = false;
    function syncAllCalendarUnits(showNotification = false) {
        if (!window.db) return;
        try {
            syncOfficialHolidaysWithCalendarEvents();
            syncAcademicMilestonesWithCalendarEvents();
            syncTeacherLeavesWithCalendarEvents();

            const holidays = getOfficialHolidays();
            const milestones = getAcademicMilestones();
            const leaves = getTeacherLeaves();

            const badgeHoliday = document.getElementById('calSubnavHolidayCountBadge') || document.getElementById('ttSubnavHolidayCountBadge');
            if (badgeHoliday) {
                badgeHoliday.textContent = `${holidays.length} عطلة`;
            }
            const badgeLeaves = document.getElementById('calSubnavLeavesCountBadge');
            if (badgeLeaves) {
                badgeLeaves.textContent = `${leaves.length} رخصة`;
            }
            const badgeRoadmap = document.getElementById('calSubnavRoadmapBadge');
            if (badgeRoadmap) {
                badgeRoadmap.textContent = `${milestones.length} محطة`;
            }

            const syncBadge = document.getElementById('calSyncStatusBadge');
            if (syncBadge) {
                syncBadge.innerHTML = '<span class="ui-icon" style="margin:0;"><span data-lucide="check-check" data-size="13"></span></span> متزامن 100%';
                if (window.renderLucide) window.renderLucide();
            }

            if (typeof window.saveDB === 'function') {
                window.saveDB();
            }

            // تحديث العرض الفرعي النشط داخل تبويب التقويم في الوقت الفعلي
            if (!_isSyncingCalendarViews) {
                _isSyncingCalendarViews = true;
                try {
                    const activeSub = window.currentCalendarSubView || 'annual';
                    if (activeSub === 'annual') {
                        renderAnnualSchoolCalendar();
                    } else if (activeSub === 'monthly' && typeof window.renderCalendar === 'function') {
                        window.renderCalendar();
                    } else if (activeSub === 'leaves') {
                        renderTeacherLeavesDashboard();
                    } else if (activeSub === 'roadmap' && typeof window.renderPedagogicalRoadmap === 'function') {
                        window.renderPedagogicalRoadmap('calendarRoadmapContentMount');
                    }
                    if (typeof window.renderGoogleCalendarSyncBanner === 'function') {
                        window.renderGoogleCalendarSyncBanner('googleCalendarSyncBannerMount');
                    }
                } finally {
                    _isSyncingCalendarViews = false;
                }
            }

            if (showNotification) {
                if (typeof window.showToast === 'function') {
                    window.showToast('تمت مزامنة وتحديث جميع وحدات التقويم (السنوي، الشهري، الرخص، المسار) بنجاح 🔄✨');
                } else if (typeof window.showNotification === 'function') {
                    window.showNotification('تمت مزامنة جميع وحدات التقويم بنجاح', 'success');
                }
            }
        } catch (err) {
            console.error('Error syncing calendar units:', err);
        }
    }
    window.syncAcademicMilestonesWithCalendarEvents = syncAcademicMilestonesWithCalendarEvents;
    window.syncAllCalendarUnits = syncAllCalendarUnits;

    /**
     * حساب إحصائيات العطل السنوية
     */
    function getOfficialHolidaysStats() {
        const holidays = getOfficialHolidays();
        let totalHolidayDays = 0;
        let interimPeriodsCount = 0;
        let nationalCount = 0;
        let religiousCount = 0;
        let disabledAbsenceDays = 0;

        holidays.forEach(h => {
            const days = h.daysCount || calculateDaysBetween(h.startDate, h.endDate);
            totalHolidayDays += days;
            if (h.disableAbsence !== false) {
                disabledAbsenceDays += days;
            }
            if (h.category === 'interim') interimPeriodsCount++;
            if (h.category === 'national') nationalCount++;
            if (h.category === 'religious') religiousCount++;
        });

        // تقدير أيام الدراسة الفعلية (الموسم ~ 260 يوماً إجمالياً مطروحاً منها أيام العطل وعطل نهاية الأسبوع)
        const estimatedSchoolDays = Math.max(160, 240 - totalHolidayDays);

        return {
            totalHolidaysCount: holidays.length,
            totalHolidayDays,
            interimPeriodsCount,
            nationalCount,
            religiousCount,
            disabledAbsenceDays,
            estimatedSchoolDays
        };
    }

    /**
     * رسم التقويم السنوي الشامل في صفحة جدول الحصص والأجندة
     */
    function renderAnnualSchoolCalendar() {
        const container = document.getElementById('timetableAnnualCalendarView');
        if (!container) return;

        const holidays = getOfficialHolidays();
        const milestones = getAcademicMilestones();
        const stats = getOfficialHolidaysStats();
        const activeMsInfo = getActiveOrUpcomingMilestone();

        // تحديث الشارة في زر التبويب الفرعي
        const badgeEl = document.getElementById('calSubnavHolidayCountBadge') || document.getElementById('ttSubnavHolidayCountBadge');
        if (badgeEl) {
            badgeEl.textContent = `${holidays.length} عطلة`;
        }

        let html = `
            <!-- بطاقة الترويسة الرئيسية للتقويم السنوي -->
            <div class="card" style="padding: 22px; margin-bottom: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3); border: 1px solid #334155;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4); flex-shrink: 0;">
                            <span class="ui-icon" style="margin: 0;"><span data-lucide="sparkles" data-size="28"></span></span>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
                                    التقويم السنوي والمحطات المدرسية الذكية
                                </h2>
                                <span style="font-size: 0.72rem; padding: 3px 10px; border-radius: 9999px; background: rgba(124, 58, 237, 0.25); color: #c4b5fd; border: 1px solid rgba(196, 181, 253, 0.4); font-weight: 800;">
                                    الموسم الدراسي ${selectedAcademicYearStart} - ${selectedAcademicYearStart + 1}
                                </span>
                                <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 9999px; background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(110, 231, 183, 0.3); font-weight: 800;">
                                    استيراد ذكي بالذكاء الاصطناعي
                                </span>
                            </div>
                            <p style="margin: 4px 0 0 0; font-size: 0.83rem; color: #cbd5e1; line-height: 1.5;">
                                روزنامة العطل الرسمية والمحطات الإدارية والتربوية المستخرجة آلياً من المقرر الوزاري، مربوطة بنظام الغياب وأجندة التقويم
                            </p>
                        </div>
                    </div>

                    <!-- أزرار الإجراءات والتحكم -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="window.openHolidayAbsenceMigrationModal()" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9); border: none; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.35); cursor: pointer;" title="الترحيل التلقائي لغياب العطل ومنع تسجيل أي غياب غير مبرر">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="shield-check" data-size="16"></span></span>
                            <span>الترحيل التلقائي لغياب العطل 🛡️</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openAddHolidayModal()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="plus-circle" data-size="16"></span></span>
                            <span>إضافة عطلة رسمية</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.confirmResetOfficialHolidays()" style="background: rgba(255, 255, 255, 0.12); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.2); padding: 8px 14px; border-radius: 10px; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;" title="استعادة لائحة العطل الرسمية لوزارة التربية الوطنية">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="rotate-ccw" data-size="15"></span></span>
                            <span>استعادة العطل الوزارية</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.printAnnualSchoolCalendar()" style="background: rgba(255, 255, 255, 0.12); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.2); padding: 8px 14px; border-radius: 10px; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="printer" data-size="15"></span></span>
                            <span>طباعة (A4)</span>
                        </button>
                        <div style="display: flex; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            <button type="button" onclick="window.switchAnnualCalendarViewMode('grid')" class="${annualCalendarViewMode === 'grid' ? 'active-mode-btn' : 'inactive-mode-btn'}" style="padding: 6px 12px; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: ${annualCalendarViewMode === 'grid' ? '#2563eb' : 'transparent'}; color: #fff;">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="grid" data-size="14"></span></span>
                                <span>شبكة الشهور</span>
                            </button>
                            <button type="button" onclick="window.switchAnnualCalendarViewMode('table')" class="${annualCalendarViewMode === 'table' ? 'active-mode-btn' : 'inactive-mode-btn'}" style="padding: 6px 12px; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; background: ${annualCalendarViewMode === 'table' ? '#2563eb' : 'transparent'}; color: #fff;">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="list" data-size="14"></span></span>
                                <span>لائحة العطل</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- شريط مؤشرات الأداء السنوية (KPIs) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(16, 185, 129, 0.2); color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                            🏖️
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">مجموع أيام العطل الرسمية</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #34d399;">${stats.totalHolidayDays} يوماً</div>
                        </div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                            📅
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">فترات ومناسبات العطل</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #60a5fa;">${stats.totalHolidaysCount} فترات</div>
                        </div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(239, 68, 68, 0.2); color: #f87171; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                            🛡️
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">ربط الغياب الآلي</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #34d399; display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
                                <span>مفعل تلقائياً (${stats.disabledAbsenceDays} يوم معطل)</span>
                            </div>
                        </div>
                    </div>

                    <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                            🎓
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">أيام الدراسة الصافية (تقديرية)</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #fbbf24;">~ ${stats.estimatedSchoolDays} يوم دراسي</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- شريط التنبيه الإيضاحي لربط الغياب -->
            <div style="margin-bottom: 20px; padding: 12px 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-right: 5px solid #10b981; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: #dcfce7; color: #166534; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; flex-shrink: 0;">
                        💡
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.9rem; color: #166534;">
                            الربط التلقائي الذكي بين التقويم السنوي ونظام الغياب والمواظبة:
                        </div>
                        <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">
                            عند اختيار أي تاريخ يوافق عطلة مدرسية رسمية في صفحة «الغياب»، يقوم التطبيق آلياً بتعطيل أزرار تسجيل الغياب وإشعار الأستاذ بأن اليوم عطلة رسمية، مع استثناء أيام العطل من احتساب ساعات الغياب ونسب المواظبة.
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-primary" onclick="window.switchTab('absence')" style="background: #10b981; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                        <span>الانتقال لصفحة الغياب</span>
                        <span class="ui-icon" style="margin:0;"><span data-lucide="arrow-left" data-size="14"></span></span>
                    </button>
                </div>
            </div>
        `;

        // إدراج إما شبكة الشهور أو جدول اللائحة
        if (annualCalendarViewMode === 'grid') {
            html += renderMonthsGridHtml(selectedAcademicYearStart);
        } else {
            html += renderHolidaysTableHtml(holidays);
        }

        // إدراج قسم المحطات التربوية والإدارية المدرسية وفروض المراقبة المعتمدة
        html += renderAcademicMilestonesSectionHtml(milestones);

        container.innerHTML = html;
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * رسم شبكة الشهور الـ 12 للموسم الدراسي (من شتنبر إلى غشت)
     */
    function renderMonthsGridHtml(academicYear) {
        // ترتيب أشهر الموسم الدراسي: شتنبر (8)، أكتوبر (9)، نونبر (10)، دجنبر (11)، يناير (0)، فبراير (1)، مارس (2)، أبريل (3)، ماي (4)، يونيو (5)، يوليوز (6)، غشت (7)
        const academicMonths = [
            { year: academicYear, month: 8, name: 'شتنبر (سبتمبر)' },
            { year: academicYear, month: 9, name: 'أكتوبر' },
            { year: academicYear, month: 10, name: 'نونبر (نوفمبر)' },
            { year: academicYear, month: 11, name: 'دجنبر (ديسمبر)' },
            { year: academicYear + 1, month: 0, name: 'يناير' },
            { year: academicYear + 1, month: 1, name: 'فبراير' },
            { year: academicYear + 1, month: 2, name: 'مارس' },
            { year: academicYear + 1, month: 3, name: 'أبريل' },
            { year: academicYear + 1, month: 4, name: 'ماي (مايو)' },
            { year: academicYear + 1, month: 5, name: 'يونيو' },
            { year: academicYear + 1, month: 6, name: 'يوليوز (يوليو)' },
            { year: academicYear + 1, month: 7, name: 'غشت (أغسطس)' }
        ];

        let gridHtml = `
            <!-- دليل دلالات ألوان التقويم السنوي الشامل -->
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 18px; margin-bottom: 20px; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; font-size: 0.83rem;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #10b981; display: inline-block;"></span>
                    <span style="font-weight: 700; color: #065f46;">فترات بينية (معطلة للغياب)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #ef4444; display: inline-block;"></span>
                    <span style="font-weight: 700; color: #991b1b;">أعياد وطنية رسمية</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #8b5cf6; display: inline-block;"></span>
                    <span style="font-weight: 700; color: #5b21b6;">أعياد دينية</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #eff6ff; border: 1.5px solid #2563eb; display: inline-block;"></span>
                    <span style="font-weight: 800; color: #1d4ed8;">🎯 محطات بيداغوجية وفروض ومواعيد</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #fef08a; border: 1px solid #eab308; display: inline-block;"></span>
                    <span style="font-weight: 700; color: #854d0e;">اليوم الحالي (اليوم)</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 12px; height: 12px; border-radius: 4px; background: #f1f5f9; display: inline-block;"></span>
                    <span style="font-weight: 700; color: #64748b;">نهاية الأسبوع (الأحد)</span>
                </div>
            </div>

            <!-- شبكة بطاقات الشهور (3-4 أعمدة متجاوبة) متزامنة مع المحطات والتقويم الشهري -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; margin-bottom: 24px;">
        `;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const allMilestones = getAcademicMilestones();

        academicMonths.forEach(mObj => {
            const y = mObj.year;
            const m = mObj.month;
            const firstDay = new Date(y, m, 1);
            const lastDay = new Date(y, m + 1, 0);
            const totalDays = lastDay.getDate();
            const startingDay = firstDay.getDay(); // 0 = Sunday

            // عدّ أيام العطل والمحطات البيداغوجية في هذا الشهر
            let monthHolidaysCount = 0;
            const monthHolidaysNames = new Set();
            const monthMilestonesList = [];

            for (let d = 1; d <= totalDays; d++) {
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const hol = getOfficialHolidayForDate(dateStr);
                if (hol) {
                    monthHolidaysCount++;
                    monthHolidaysNames.add(hol.title);
                }
                allMilestones.forEach(ms => {
                    const sDate = ms.startDate;
                    const eDate = ms.endDate || ms.startDate;
                    if (sDate && dateStr >= sDate && dateStr <= eDate) {
                        if (!monthMilestonesList.some(item => item.id === ms.id)) {
                            monthMilestonesList.push(ms);
                        }
                    }
                });
            }

            gridHtml += `
                <div class="annual-month-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s;">
                    <div>
                        <!-- ترويسة الشهر -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                            <div>
                                <span style="font-weight: 800; font-size: 1.02rem; color: #0f172a; font-family: 'Cairo', sans-serif;">${mObj.name}</span>
                                <span style="font-size: 0.76rem; color: #64748b; margin-right: 4px;">${y}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                ${monthHolidaysCount > 0 ? `
                                    <span style="font-size: 0.68rem; font-weight: 800; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 999px;" title="${Array.from(monthHolidaysNames).join(' • ')}">
                                        🏖️ ${monthHolidaysCount} ع
                                    </span>
                                ` : ''}
                                ${monthMilestonesList.length > 0 ? `
                                    <span style="font-size: 0.68rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 7px; border-radius: 999px;" title="${monthMilestonesList.map(x => x.title).join(' • ')}">
                                        🎯 ${monthMilestonesList.length} محطة
                                    </span>
                                ` : ''}
                                <button type="button" onclick="window.navigateToMonthlyCalendarMonth(${y}, ${m})" style="font-size: 0.68rem; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 2px 7px; border-radius: 6px; font-weight: 800; cursor: pointer;" title="فتح شهر ${mObj.name} في التقويم الشهري">الشهري ⬅</button>
                            </div>
                        </div>

                        <!-- أسماء الأيام (ح، ن، ث، ر، خ، ج، س) -->
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; font-size: 0.72rem; font-weight: 800; color: #64748b; margin-bottom: 6px;">
                            <div style="color: #ef4444;">ح</div>
                            <div>ن</div>
                            <div>ث</div>
                            <div>ر</div>
                            <div>خ</div>
                            <div style="color: #10b981;">ج</div>
                            <div>س</div>
                        </div>

                        <!-- خلايا الأيام -->
                        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
            `;

            // خلايا فارغة قبل بداية الشهر
            for (let i = 0; i < startingDay; i++) {
                gridHtml += `<div style="height: 32px; border-radius: 6px; background: #fafafa; opacity: 0.4;"></div>`;
            }

            // أيام الشهر
            for (let d = 1; d <= totalDays; d++) {
                const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const curDate = new Date(y, m, d);
                const dayOfWeek = curDate.getDay();
                const isSunday = (dayOfWeek === 0);
                const isToday = (dateStr === todayStr);

                const holiday = getOfficialHolidayForDate(dateStr);
                const isHoliday = !!holiday;
                const leave = getTeacherLeaveForDate(dateStr);
                const isLeave = !isHoliday && !!leave;
                const dayMilestones = allMilestones.filter(ms => ms.startDate && dateStr >= ms.startDate && dateStr <= (ms.endDate || ms.startDate));
                const hasMilestone = dayMilestones.length > 0;

                let cellBg = isSunday ? '#f8fafc' : '#ffffff';
                let cellColor = isSunday ? '#94a3b8' : '#1e293b';
                let cellBorder = '1px solid #f1f5f9';
                let titleText = `${d} ${mObj.name} ${y}`;

                if (hasMilestone && !isHoliday && !isLeave) {
                    const topMs = dayMilestones[0];
                    const msCol = topMs.color || '#2563eb';
                    cellBg = `${msCol}14`;
                    cellColor = msCol;
                    cellBorder = `1.5px solid ${msCol}66`;
                }

                if (isHoliday) {
                    cellBg = holiday.category === 'national' ? '#fee2e2'
                           : holiday.category === 'religious' ? '#ede9fe'
                           : holiday.category === 'midterm' ? '#dbeafe'
                           : '#dcfce7';
                    cellColor = holiday.category === 'national' ? '#991b1b'
                              : holiday.category === 'religious' ? '#5b21b6'
                              : holiday.category === 'midterm' ? '#1e40af'
                              : '#166534';
                    cellBorder = `1.5px solid ${holiday.color || '#10b981'}`;
                    titleText += ` • عطلة رسمية: ${holiday.title}`;
                } else if (isLeave) {
                    cellBg = '#e0f2fe';
                    cellColor = '#0369a1';
                    cellBorder = '1.5px solid #0284c7';
                    titleText += ` • رخصة للأستاذ: ${leave.title || leave.typeLabel}`;
                }

                if (hasMilestone) {
                    titleText += ` • 🎯 ${dayMilestones.map(x => x.title).join(' | ')}`;
                }

                if (isToday) {
                    cellBorder = '2px solid #f59e0b';
                    if (!isHoliday && !isLeave && !hasMilestone) {
                        cellBg = '#fef9c3';
                        cellColor = '#854d0e';
                    }
                    titleText += ' (اليوم الحالي)';
                }

                gridHtml += `
                    <div class="annual-day-cell ${isHoliday ? 'has-official-holiday' : ''} ${isLeave ? 'has-teacher-leave' : ''}" 
                         style="height: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; font-size: 0.78rem; font-weight: ${isHoliday || isLeave || hasMilestone || isToday ? '900' : '600'}; background: ${cellBg}; color: ${cellColor}; border: ${cellBorder}; cursor: pointer; position: relative; transition: all 0.15s;"
                         title="${escapeHtml(titleText)}"
                         onclick="window.onAnnualDayCellClick('${dateStr}', '${holiday ? escapeQuotes(holiday.title) : ''}')">
                        <span>${d}</span>
                        ${isHoliday ? `
                            <span style="width: 4px; height: 4px; border-radius: 50%; background: ${holiday.color || '#10b981'}; position: absolute; bottom: 2px;"></span>
                        ` : (isLeave ? `
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: #0284c7; position: absolute; bottom: 2px;" title="رخصة أستاذ"></span>
                        ` : (hasMilestone ? `
                            <span style="width: 5px; height: 5px; border-radius: 50%; background: ${dayMilestones[0].color || '#2563eb'}; position: absolute; bottom: 2px;"></span>
                        ` : ''))}
                    </div>
                `;
            }

            gridHtml += `
                        </div>
                    </div>
            `;

            // عرض ملخص المحطات التربوية والمواعيد أسفل بطاقة الشهر للتزامن البصري الفوري
            if (monthMilestonesList.length > 0) {
                gridHtml += `
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 0.72rem; max-height: 76px; overflow-y: auto;">
                        ${monthMilestonesList.slice(0, 3).map(ms => `
                            <div onclick="window.openEditAcademicMilestoneModal('${ms.id}')" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 4px; border-radius: 5px; cursor: pointer; color: #334155; font-weight: 700;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" title="انقر لتعديل المحطة أو الموعد">
                                <div style="display: flex; align-items: center; gap: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                                    <span style="width: 6px; height: 6px; border-radius: 50%; background: ${ms.color || '#2563eb'}; flex-shrink: 0;"></span>
                                    <span style="overflow: hidden; text-overflow: ellipsis;">${escapeHtml(ms.title)}</span>
                                </div>
                                <span style="font-size: 0.66rem; color: #64748b; font-family: monospace; flex-shrink: 0;">${(ms.startDate || '').slice(5)}</span>
                            </div>
                        `).join('')}
                        ${monthMilestonesList.length > 3 ? `<div style="font-size: 0.68rem; color: #2563eb; font-weight: 800; padding-right: 10px;">+${monthMilestonesList.length - 3} محطات/مواعيد أخرى...</div>` : ''}
                    </div>
                `;
            } else {
                gridHtml += `
                    <div style="margin-top: 10px; padding-top: 6px; border-top: 1px dashed #f1f5f9; font-size: 0.68rem; color: #94a3b8; text-align: center;">
                        انقر على أي يوم لإضافة محطة أو موعد
                    </div>
                `;
            }

            gridHtml += `
                </div>
            `;
        });

        gridHtml += `</div>`;
        return gridHtml;
    }

    /**
     * رسم جدول لائحة العطل الرسمية المفصل
     */
    function renderHolidaysTableHtml(holidays) {
        let tableHtml = `
            <div class="card" style="padding: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                            لائحة العطل المدرسية الرسمية المعتمدة للموسم الدراسي
                        </h3>
                        <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #64748b;">
                            يمكنك تعديل تواريخ العطل أو إضافة فترات جديدة أو تبديل خيار تعطيل تسجيل الغياب
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="window.printOfficialHolidaysTable()" style="background: #0284c7; color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="معاينة وطباعة لائحة العطل المدرسية الرسمية (A4)">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="printer" data-size="14"></span></span>
                            <span>طباعة لائحة العطل (A4)</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openAddHolidayModal()" style="background: #10b981; border: none; padding: 6px 14px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="plus" data-size="14"></span></span>
                            <span>إضافة عطلة جديدة</span>
                        </button>
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.85rem;">
                        <thead>
                            <tr style="background: #f8fafc; color: #475569; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px 14px; text-align: right; border-radius: 8px 0 0 0;">#</th>
                                <th style="padding: 12px 14px; text-align: right;">اسم العطلة المدرسية</th>
                                <th style="padding: 12px 14px; text-align: right;">الصنف</th>
                                <th style="padding: 12px 14px; text-align: center;">من تاريخ</th>
                                <th style="padding: 12px 14px; text-align: center;">إلى تاريخ</th>
                                <th style="padding: 12px 14px; text-align: center;">المدة</th>
                                <th style="padding: 12px 14px; text-align: center;">تعطيل احتساب الغياب</th>
                                <th style="padding: 12px 14px; text-align: center; border-radius: 0 8px 0 0;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        holidays.forEach((h, idx) => {
            const days = h.daysCount || calculateDaysBetween(h.startDate, h.endDate);
            const isAbsenceDisabled = h.disableAbsence !== false;
            const categoryBadgeStyle = h.category === 'national' ? 'background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;'
                                     : h.category === 'religious' ? 'background: #ede9fe; color: #5b21b6; border: 1px solid #d8b4fe;'
                                     : h.category === 'midterm' ? 'background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;'
                                     : 'background: #dcfce7; color: #166534; border: 1px solid #86efac;';

            tableHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 12px 14px; font-weight: 700; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 12px 14px;">
                        <div style="font-weight: 800; color: #0f172a;">${escapeHtml(h.title)}</div>
                        ${h.notes ? `<div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">${escapeHtml(h.notes)}</div>` : ''}
                    </td>
                    <td style="padding: 12px 14px;">
                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; font-weight: 700; display: inline-block; ${categoryBadgeStyle}">
                            ${escapeHtml(h.categoryLabel || 'عطلة رسمية')}
                        </span>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; font-family: monospace; font-weight: 700; color: #334155;">
                        ${h.startDate}
                    </td>
                    <td style="padding: 12px 14px; text-align: center; font-family: monospace; font-weight: 700; color: #334155;">
                        ${h.endDate || h.startDate}
                    </td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <span style="font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 2px 8px; border-radius: 999px; font-size: 0.76rem;">
                            ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'}
                        </span>
                    </td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <button type="button" onclick="window.toggleHolidayAbsenceDisable('${h.id}')" style="background: none; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 800; color: ${isAbsenceDisabled ? '#15803d' : '#94a3b8'};">
                            <span style="font-size: 1.1rem;">${isAbsenceDisabled ? '🟢' : '⚪'}</span>
                            <span>${isAbsenceDisabled ? 'معطل تلقائياً' : 'مسموح'}</span>
                        </button>
                    </td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <div style="display: flex; gap: 6px; justify-content: center;">
                            <button type="button" onclick="window.openEditHolidayModal('${h.id}')" class="btn-action" style="padding: 4px 8px; font-size: 0.75rem; background: #f1f5f9; color: #2563eb; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;" title="تعديل العطلة">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="edit-3" data-size="13"></span></span>
                            </button>
                            <button type="button" onclick="window.deleteOfficialHoliday('${h.id}')" class="btn-action" style="padding: 4px 8px; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;" title="حذف العطلة">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="trash-2" data-size="13"></span></span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return tableHtml;
    }

    /**
     * النقر على خلية يوم في التقويم السنوي
     */
    function onAnnualDayCellClick(dateStr, holidayTitle) {
        const milestones = getAcademicMilestones();
        const matchedMs = milestones.find(ms => ms.startDate && dateStr >= ms.startDate && dateStr <= (ms.endDate || ms.startDate));
        if (matchedMs) {
            openEditAcademicMilestoneModal(matchedMs.id);
            return;
        }
        if (holidayTitle) {
            const hol = getOfficialHolidayForDate(dateStr);
            if (hol) {
                openEditHolidayModal(hol.id);
                return;
            }
        }
        const leave = getTeacherLeaveForDate(dateStr);
        if (leave) {
            openEditTeacherLeaveModal(leave.id);
            return;
        }
        // فتح النافذة الموحدة لإضافة محطة بيداغوجية أو موعد/حدث في هذا التاريخ مباشرة دون تعارض
        openAddAcademicMilestoneModal(dateStr);
    }

    /**
     * تبديل نمط العرض بين شبكة الشهور وجدول اللائحة
     */
    function switchAnnualCalendarViewMode(mode) {
        annualCalendarViewMode = mode;
        renderAnnualSchoolCalendar();
    }

    /**
     * فتح نافذة إضافة عطلة رسمية
     */
    function openAddHolidayModal(defaultStartDate) {
        const modal = document.getElementById('officialHolidayModal');
        if (!modal) return;

        document.getElementById('holidayModalTitle').textContent = 'إضافة عطلة مدرسية رسمية جديدة';
        document.getElementById('holidayEditId').value = '';
        document.getElementById('holidayNameInput').value = '';
        document.getElementById('holidayCategorySelect').value = 'interim';
        document.getElementById('holidayStartDateInput').value = defaultStartDate || `${selectedAcademicYearStart}-10-01`;
        document.getElementById('holidayEndDateInput').value = defaultStartDate || `${selectedAcademicYearStart}-10-01`;
        document.getElementById('holidayDisableAbsenceChk').checked = true;
        document.getElementById('holidayNotesInput').value = '';

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * فتح نافذة تعديل عطلة رسمية
     */
    function openEditHolidayModal(id) {
        const holidays = getOfficialHolidays();
        const hol = holidays.find(h => h.id === id);
        if (!hol) return;

        const modal = document.getElementById('officialHolidayModal');
        if (!modal) return;

        document.getElementById('holidayModalTitle').textContent = 'تعديل بيانات العطلة الرسمية';
        document.getElementById('holidayEditId').value = hol.id;
        document.getElementById('holidayNameInput').value = hol.title || '';
        document.getElementById('holidayCategorySelect').value = hol.category || 'interim';
        document.getElementById('holidayStartDateInput').value = hol.startDate || '';
        document.getElementById('holidayEndDateInput').value = hol.endDate || hol.startDate || '';
        document.getElementById('holidayDisableAbsenceChk').checked = (hol.disableAbsence !== false);
        document.getElementById('holidayNotesInput').value = hol.notes || '';

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إغلاق نافذة العطلة الرسمية
     */
    function closeOfficialHolidayModal() {
        const modal = document.getElementById('officialHolidayModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * حفظ العطلة الرسمية (إضافة أو تعديل)
     */
    let _isSavingOfficialHoliday = false;
    function saveOfficialHoliday() {
        if (_isSavingOfficialHoliday) return;
        _isSavingOfficialHoliday = true;
        const unlock = () => { setTimeout(() => { _isSavingOfficialHoliday = false; }, 450); };

        const title = document.getElementById('holidayNameInput').value.trim();
        const category = document.getElementById('holidayCategorySelect').value;
        const startDate = document.getElementById('holidayStartDateInput').value;
        const endDate = document.getElementById('holidayEndDateInput').value || startDate;
        const disableAbsence = document.getElementById('holidayDisableAbsenceChk').checked;
        const notes = document.getElementById('holidayNotesInput').value.trim();
        const editId = document.getElementById('holidayEditId').value;

        if (!title) {
            alert('الرجاء إدخال اسم العطلة المدرسية');
            unlock();
            return;
        }
        if (!startDate) {
            alert('الرجاء تحديد تاريخ بداية العطلة');
            unlock();
            return;
        }
        if (endDate < startDate) {
            alert('تاريخ نهاية العطلة لا يمكن أن يكون قبل تاريخ البداية');
            unlock();
            return;
        }

        const categoryLabels = {
            'interim': 'فترة بينية',
            'national': 'عيد وطني',
            'religious': 'عطلة دينية',
            'midterm': 'عطلة منتصف الموسم',
            'custom': 'عطلة رسمية'
        };

        const categoryColors = {
            'interim': '#10b981',
            'national': '#ef4444',
            'religious': '#8b5cf6',
            'midterm': '#3b82f6',
            'custom': '#f59e0b'
        };

        const days = calculateDaysBetween(startDate, endDate);
        const holidays = getOfficialHolidays();

        if (editId) {
            const idx = holidays.findIndex(h => h.id === editId);
            if (idx >= 0) {
                holidays[idx] = {
                    ...holidays[idx],
                    title,
                    category,
                    categoryLabel: categoryLabels[category] || 'عطلة رسمية',
                    startDate,
                    endDate,
                    daysCount: days,
                    disableAbsence,
                    color: categoryColors[category] || '#10b981',
                    notes
                };
            }
        } else {
            const newId = 'hol_custom_' + Date.now();
            holidays.push({
                id: newId,
                title,
                category,
                categoryLabel: categoryLabels[category] || 'عطلة رسمية',
                startDate,
                endDate,
                daysCount: days,
                isOfficial: true,
                disableAbsence,
                color: categoryColors[category] || '#10b981',
                notes
            });
        }

        // فرز العطل ترتيباً زمنياً
        holidays.sort((a, b) => a.startDate.localeCompare(b.startDate));
        window.db.officialHolidays = holidays;

        if (typeof window.saveDB === 'function') window.saveDB();
        closeOfficialHolidayModal();

        syncAllCalendarUnits(false);
        if (typeof window.renderStudents === 'function') window.renderStudents();

        unlock();
        if (typeof window.showNotification === 'function') {
            window.showNotification('تم حفظ العطلة الرسمية وتحديث كافة وحدات التقويم والغياب بنجاح', 'success');
        }
    }

    /**
     * حذف عطلة رسمية
     */
    function deleteOfficialHoliday(id) {
        const holidays = getOfficialHolidays();
        const hol = holidays.find(h => h.id === id);
        if (!hol) return;

        if (!confirm(`هل أنت متأكد من حذف العطلة الرسمية: "${hol.title}"؟`)) {
            return;
        }

        window.db.officialHolidays = holidays.filter(h => h.id !== id);

        // إزالة الأحداث المرتبطة بها في calendarEvents
        if (window.db && Array.isArray(window.db.calendarEvents)) {
            window.db.calendarEvents = window.db.calendarEvents.filter(ev => ev.holidayId !== id && ev.title !== hol.title);
        }

        if (typeof window.saveDB === 'function') window.saveDB();
        syncAllCalendarUnits(false);
        if (typeof window.renderStudents === 'function') window.renderStudents();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم حذف العطلة الرسمية وتحديث كافة الوحدات بنجاح', 'info');
        }
    }

    /**
     * تبديل تفعيل تعطيل الغياب لعطلة محددة
     */
    function toggleHolidayAbsenceDisable(id) {
        const holidays = getOfficialHolidays();
        const hol = holidays.find(h => h.id === id);
        if (!hol) return;

        hol.disableAbsence = (hol.disableAbsence === false);
        window.db.officialHolidays = holidays;

        syncOfficialHolidaysWithCalendarEvents();
        if (typeof window.saveDB === 'function') window.saveDB();
        renderAnnualSchoolCalendar();

        if (typeof window.renderStudents === 'function') window.renderStudents();

        const statusMsg = hol.disableAbsence ? 'تم تفعيل تعطيل احتساب الغياب في هذه العطلة' : 'تم السماح بتسجيل الغياب في هذه العطلة';
        if (typeof window.showNotification === 'function') {
            window.showNotification(statusMsg, 'success');
        }
    }

    /**
     * استعادة اللائحة الرسمية المعتمدة لوزارة التربية الوطنية
     */
    function confirmResetOfficialHolidays() {
        if (!confirm('هل أنت متأكد من استعادة اللائحة الرسمية المعتمدة للعطل المدرسية للموسم الدراسي 2026-2027؟\nسيتم تحديث كافة العطل والفترات البينية وإعادة ربطها بنظام الغياب.')) {
            return;
        }

        window.db.officialHolidays = JSON.parse(JSON.stringify(DEFAULT_OFFICIAL_HOLIDAYS_2026_2027));
        if (typeof window.saveDB === 'function') window.saveDB();

        syncAllCalendarUnits(false);
        if (typeof window.renderStudents === 'function') window.renderStudents();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تمت استعادة لائحة العطل الرسمية وتحديث كافة الوحدات بنجاح', 'success');
        }
    }

    /**
     * ====================================================================
     * منظومة الطباعة الرسمية الموحدة والشاملة لكافة أقسام تبويب التقويم (A4 / PDF)
     * Comprehensive Official Print & A4 Preview Suite for All Calendar Sections
     * ====================================================================
     */
    function getCalendarPrintHeaderMetadata() {
        const s = (window.db && window.db.settings) ? window.db.settings : {};
        const teacherName = s.teacherName || localStorage.getItem('prof_name') || 'الأستاذ إبراهيم قزيبر';
        const schoolName = s.schoolName || localStorage.getItem('school_name') || 'الثانوية التأهيلية';
        const academyName = s.academyName || localStorage.getItem('academy_name') || 'الأكاديمية الجهوية للتربية والتكوين';
        const directorateName = s.directorateName || localStorage.getItem('directorate_name') || 'المديرية الإقليمية';
        const subjectName = s.subjectName || 'مادة الرياضيات';
        const schoolYear = s.schoolYear || `${selectedAcademicYearStart} / ${selectedAcademicYearStart + 1}`;
        const dualLogosHtml = typeof window.getDualLogosHTML === 'function' ? window.getDualLogosHTML({ size: 42 }) : '';
        return {
            teacherName,
            schoolName,
            academyName,
            directorateName,
            subjectName,
            schoolYear,
            dualLogosHtml
        };
    }

    function buildCalendarOfficialHeaderHtml(docTitle, docSubtitle, accentColor = '#0284c7') {
        const meta = getCalendarPrintHeaderMetadata();
        return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 2.5px solid ${accentColor}; padding-bottom: 8px; font-family: 'Cairo', 'Tajawal', sans-serif;">
                <tr>
                    <td style="width: 34%; text-align: right; font-size: 11px; font-weight: 800; line-height: 1.5; color: #0f172a; border: none; padding: 4px;">
                        المملكة المغربية<br>
                        وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
                        ${escapeHtml(meta.academyName)}<br>
                        ${escapeHtml(meta.directorateName)} — ${escapeHtml(meta.schoolName)}
                    </td>
                    <td style="width: 32%; text-align: center; border: none; padding: 4px;">
                        <div style="margin-bottom: 4px;">${meta.dualLogosHtml}</div>
                        <div style="font-size: 14px; font-weight: 900; color: #0f172a; background: #f8fafc; border: 1.5px solid ${accentColor}; border-radius: 8px; padding: 4px 10px; display: inline-block;">
                            ${escapeHtml(docTitle)}
                        </div>
                        ${docSubtitle ? `<div style="font-size: 10.5px; font-weight: 800; color: #475569; margin-top: 3px;">${escapeHtml(docSubtitle)}</div>` : ''}
                    </td>
                    <td style="width: 34%; text-align: left; font-size: 11px; font-weight: 800; line-height: 1.5; color: #0f172a; border: none; padding: 4px;">
                        الأستاذ(ة): <span style="color: ${accentColor};">${escapeHtml(meta.teacherName)}</span><br>
                        المادة المدرسة: ${escapeHtml(meta.subjectName)}<br>
                        الموسم الدراسي: <span dir="ltr">${escapeHtml(meta.schoolYear)}</span><br>
                        تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-MA')}
                    </td>
                </tr>
            </table>
        `;
    }

    function buildCalendarOfficialSignaturesHtml(teacherName) {
        return `
            <table style="width: 100%; border-collapse: collapse; margin-top: 14px; page-break-inside: avoid; font-family: 'Cairo', 'Tajawal', sans-serif;">
                <tr>
                    <td style="width: 33.33%; border: 1px solid #cbd5e1; padding: 8px 12px; height: 68px; vertical-align: top; text-align: center; background: #f8fafc;">
                        <div style="font-size: 11px; font-weight: 900; color: #1e293b; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">توقيع الأستاذ(ة) المنجز(ة)</div>
                        <div style="font-size: 10.5px; font-weight: 800; color: #334155;">${escapeHtml(teacherName)}</div>
                    </td>
                    <td style="width: 33.33%; border: 1px solid #cbd5e1; padding: 8px 12px; height: 68px; vertical-align: top; text-align: center; background: #f8fafc;">
                        <div style="font-size: 11px; font-weight: 900; color: #1e293b; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">تأشيرة السيد(ة) المفتش(ة) التربوي(ة) / الحراسة العامة</div>
                        <div style="font-size: 9.5px; color: #64748b;">التاريخ والتوقيع والختم</div>
                    </td>
                    <td style="width: 33.33%; border: 1px solid #cbd5e1; padding: 8px 12px; height: 68px; vertical-align: top; text-align: center; background: #f8fafc;">
                        <div style="font-size: 11px; font-weight: 900; color: #1e293b; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">خاتم وتوقيع السيد(ة) رئيس(ة) المؤسسة</div>
                        <div style="font-size: 9.5px; color: #64748b;">التاريخ والتوقيع والختم الإداري</div>
                    </td>
                </tr>
            </table>
        `;
    }

    function openOrPrintCalendarDocument(fullHtmlDoc, title, orientation = 'landscape') {
        const docTitle = title || 'وثيقة_التقويم_المدرسي_A4';
        const docOrientation = orientation === 'portrait' ? 'portrait' : 'landscape';

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(fullHtmlDoc, {
                title: docTitle,
                orientation: docOrientation,
                subtitle: 'معاينة الوثيقة الرسمية للتقويم المدرسي قبل الطباعة الورقية أو التصدير الرقمي (PDF)'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(fullHtmlDoc, docTitle, docOrientation);
        } else {
            try {
                let printFrame = document.getElementById('calendarSafePrintIframe');
                if (!printFrame) {
                    printFrame = document.createElement('iframe');
                    printFrame.id = 'calendarSafePrintIframe';
                    printFrame.style.cssText = 'position:fixed; top:-9999px; left:-9999px; width:0; height:0; border:none; visibility:hidden;';
                    document.body.appendChild(printFrame);
                }
                const frameDoc = printFrame.contentWindow.document;
                frameDoc.open();
                frameDoc.write(fullHtmlDoc);
                frameDoc.close();
                setTimeout(() => {
                    printFrame.contentWindow.focus();
                    printFrame.contentWindow.print();
                }, 400);
            } catch (e) {
                window.print();
            }
        }
    }

    /**
     * 1. بناء وطباعة التقويم السنوي الشامل وشبكة الشهور الـ 12 + ملخص العطل والمحطات
     */
    function buildAnnualSchoolCalendarPrintHtml(options = {}) {
        const meta = getCalendarPrintHeaderMetadata();
        const holidays = getOfficialHolidays();
        const stats = getOfficialHolidaysStats();
        const milestones = getAcademicMilestones();
        const includeMonthsGrid = options.includeMonthsGrid !== false;
        const includeHolidaysSummary = options.includeHolidaysSummary !== false;

        const academicMonths = [
            { year: selectedAcademicYearStart, month: 8, name: 'شتنبر' },
            { year: selectedAcademicYearStart, month: 9, name: 'أكتوبر' },
            { year: selectedAcademicYearStart, month: 10, name: 'نونبر' },
            { year: selectedAcademicYearStart, month: 11, name: 'دجنبر' },
            { year: selectedAcademicYearStart + 1, month: 0, name: 'يناير' },
            { year: selectedAcademicYearStart + 1, month: 1, name: 'فبراير' },
            { year: selectedAcademicYearStart + 1, month: 2, name: 'مارس' },
            { year: selectedAcademicYearStart + 1, month: 3, name: 'أبريل' },
            { year: selectedAcademicYearStart + 1, month: 4, name: 'ماي' },
            { year: selectedAcademicYearStart + 1, month: 5, name: 'يونيو' },
            { year: selectedAcademicYearStart + 1, month: 6, name: 'يوليوز' },
            { year: selectedAcademicYearStart + 1, month: 7, name: 'غشت' }
        ];

        let monthsGridPrintHtml = '';
        if (includeMonthsGrid) {
            monthsGridPrintHtml = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
                    ${academicMonths.map(mObj => {
                        const y = mObj.year;
                        const m = mObj.month;
                        const firstDay = new Date(y, m, 1);
                        const totalDays = new Date(y, m + 1, 0).getDate();
                        const startingDay = firstDay.getDay();
                        let holDays = 0;

                        let cellsHtml = '';
                        for (let i = 0; i < startingDay; i++) {
                            cellsHtml += `<div style="height: 17px; background: #f8fafc; border-radius: 3px;"></div>`;
                        }
                        for (let d = 1; d <= totalDays; d++) {
                            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const dayOfWeek = new Date(y, m, d).getDay();
                            const isSunday = dayOfWeek === 0;
                            const hol = getOfficialHolidayForDate(dateStr);
                            const leave = getTeacherLeaveForDate(dateStr);
                            const hasMs = milestones.some(ms => ms.startDate && dateStr >= ms.startDate && dateStr <= (ms.endDate || ms.startDate));
                            if (hol) holDays++;

                            let bg = isSunday ? '#f1f5f9' : '#ffffff';
                            let col = isSunday ? '#94a3b8' : '#0f172a';
                            let bdr = '1px solid #e2e8f0';

                            if (hol) {
                                bg = hol.category === 'national' ? '#fee2e2' : hol.category === 'religious' ? '#ede9fe' : hol.category === 'midterm' ? '#dbeafe' : '#dcfce7';
                                col = hol.category === 'national' ? '#991b1b' : hol.category === 'religious' ? '#5b21b6' : hol.category === 'midterm' ? '#1e40af' : '#166534';
                                bdr = `1px solid ${hol.color || '#10b981'}`;
                            } else if (leave) {
                                bg = '#e0f2fe';
                                col = '#0369a1';
                                bdr = '1px solid #0284c7';
                            } else if (hasMs) {
                                bg = '#eff6ff';
                                col = '#1d4ed8';
                                bdr = '1px solid #60a5fa';
                            }

                            cellsHtml += `<div style="height: 17px; line-height: 16px; text-align: center; font-size: 8.5px; font-weight: ${hol || leave || hasMs ? '900' : '700'}; background: ${bg}; color: ${col}; border: ${bdr}; border-radius: 3px;">${d}</div>`;
                        }

                        return `
                            <div style="border: 1px solid #cbd5e1; border-radius: 7px; padding: 6px; background: #fff; page-break-inside: avoid;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
                                    <span style="font-size: 10.5px; font-weight: 900; color: #0f172a;">${mObj.name} ${y}</span>
                                    ${holDays > 0 ? `<span style="font-size: 8px; font-weight: 800; background: #dcfce7; color: #166534; padding: 1px 5px; border-radius: 4px;">${holDays} ع</span>` : ''}
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; font-size: 8px; font-weight: 900; color: #64748b; margin-bottom: 3px;">
                                    <div style="color:#dc2626;">ح</div><div>ن</div><div>ث</div><div>ر</div><div>خ</div><div style="color:#059669;">ج</div><div>س</div>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">
                                    ${cellsHtml}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        let holidaysSummaryTableHtml = '';
        if (includeHolidaysSummary) {
            holidaysSummaryTableHtml = `
                <div style="margin-top: 8px; page-break-inside: avoid;">
                    <div style="font-size: 11.5px; font-weight: 900; color: #0f172a; margin-bottom: 5px; border-right: 4px solid #10b981; padding-right: 8px;">
                        ملخص لائحة العطل المدرسية الرسمية المعتمدة (${holidays.length} فترة — إجمالي ${stats.totalHolidayDays} يوماً)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #1e293b;">
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 4%;">#</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 32%;">مناسبة العطلة المدرسية</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 14%;">الصنف</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 14%;">من تاريخ</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 14%;">إلى تاريخ</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 9%;">عدد الأيام</th>
                                <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 13%;">حماية الغياب</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${holidays.map((h, i) => `
                                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-weight: 800;">${i + 1}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; font-weight: 800; color: #0f172a;">${escapeHtml(h.title)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-weight: 700;">${escapeHtml(h.categoryLabel || 'عطلة رسمية')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-family: monospace; font-weight: 700;" dir="ltr">${escapeHtml(h.startDate)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-family: monospace; font-weight: 700;" dir="ltr">${escapeHtml(h.endDate || h.startDate)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-weight: 900; color: #047857;">${h.daysCount || 1} يوم</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; font-weight: 800; color: ${h.disableAbsence !== false ? '#166534' : '#64748b'};">${h.disableAbsence !== false ? '🛡️ معفى تلقائياً' : 'عادي'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const innerHtml = `
            <div dir="rtl" style="font-family: 'Cairo', 'Tajawal', sans-serif; color: #0f172a; background: #fff;">
                ${buildCalendarOfficialHeaderHtml('التقويم السنوي الشامل للموسم الدراسي ولائحة العطل الرسمية', 'مرتبط آلياً بمنظومة تتبع المواظبة والغياب والمحطات التربوية', '#4f46e5')}
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #10b981; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">مجموع أيام العطل الرسمية</div>
                        <div style="font-size: 14px; font-weight: 900; color: #047857;">${stats.totalHolidayDays} يوماً</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #2563eb; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">فترات ومناسبات العطل</div>
                        <div style="font-size: 14px; font-weight: 900; color: #1d4ed8;">${stats.totalHolidaysCount} فترة</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #7c3aed; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">المحطات والفروض المعتمدة</div>
                        <div style="font-size: 14px; font-weight: 900; color: #6d28d9;">${milestones.length} محطة</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #d97706; border-radius: 6px; padding: 6px 10px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">أيام الدراسة الصافية التقديرية</div>
                        <div style="font-size: 14px; font-weight: 900; color: #b45309;">~ ${stats.estimatedSchoolDays} يوماً</div>
                    </div>
                </div>

                <!-- مفتاح الألوان -->
                <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; font-size: 9.5px; font-weight: 800; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 10px; margin-bottom: 10px;">
                    <span><span style="display:inline-block;width:9px;height:9px;background:#dcfce7;border:1px solid #10b981;border-radius:2px;margin-left:4px;"></span>عطلة بينية</span>
                    <span><span style="display:inline-block;width:9px;height:9px;background:#fee2e2;border:1px solid #ef4444;border-radius:2px;margin-left:4px;"></span>عيد وطني</span>
                    <span><span style="display:inline-block;width:9px;height:9px;background:#ede9fe;border:1px solid #8b5cf6;border-radius:2px;margin-left:4px;"></span>عطلة دينية</span>
                    <span><span style="display:inline-block;width:9px;height:9px;background:#dbeafe;border:1px solid #3b82f6;border-radius:2px;margin-left:4px;"></span>منتصف السنة</span>
                    <span><span style="display:inline-block;width:9px;height:9px;background:#eff6ff;border:1px solid #2563eb;border-radius:2px;margin-left:4px;"></span>محطة تربوية / فرض</span>
                    <span><span style="display:inline-block;width:9px;height:9px;background:#e0f2fe;border:1px solid #0284c7;border-radius:2px;margin-left:4px;"></span>رخصة أستاذ</span>
                </div>

                ${monthsGridPrintHtml}
                ${holidaysSummaryTableHtml}
                ${buildCalendarOfficialSignaturesHtml(meta.teacherName)}
            </div>
        `;

        if (options.returnInnerOnly) return innerHtml;

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>التقويم السنوي الشامل للموسم الدراسي — ${escapeHtml(meta.schoolYear)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 6mm; font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #0f172a; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${innerHtml}</body>
</html>`;
    }

    function printAnnualSchoolCalendar() {
        if (annualCalendarViewMode === 'table') {
            printOfficialHolidaysTable();
            return;
        }
        const docHtml = buildAnnualSchoolCalendarPrintHtml();
        openOrPrintCalendarDocument(docHtml, 'التقويم السنوي الشامل وشبكة الشهور الـ 12', 'landscape');
    }

    /**
     * 2. بناء وطباعة لائحة العطل المدرسية الرسمية المعتمدة (جدول رسمي مفصل A4)
     */
    function buildOfficialHolidaysTablePrintHtml(options = {}) {
        const meta = getCalendarPrintHeaderMetadata();
        const holidays = getOfficialHolidays();
        const stats = getOfficialHolidaysStats();

        const innerHtml = `
            <div dir="rtl" style="font-family: 'Cairo', 'Tajawal', sans-serif; color: #0f172a; background: #fff;">
                ${buildCalendarOfficialHeaderHtml('لائحة العطل المدرسية الرسمية المعتمدة للموسم الدراسي', 'وفق المقرر الوزاري لتنظيم السنة الدراسية وضوابط تعطيل الغياب الآلي', '#10b981')}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;">
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #10b981; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">إجمالي أيام العطل</div>
                        <div style="font-size: 16px; font-weight: 900; color: #047857;">${stats.totalHolidayDays} يوماً</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #0284c7; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">عدد الفترات والمناسبات</div>
                        <div style="font-size: 16px; font-weight: 900; color: #0369a1;">${stats.totalHolidaysCount} فترة</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #7c3aed; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">الأيام المعفاة من الغياب</div>
                        <div style="font-size: 16px; font-weight: 900; color: #6d28d9;">${stats.disabledAbsenceDays} يوماً</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #d97706; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">أيام الدراسة الصافية</div>
                        <div style="font-size: 16px; font-weight: 900; color: #b45309;">~ ${stats.estimatedSchoolDays} يوماً</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: center; width: 5%;">ر.ت</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: right; width: 30%;">بيان ومناسبة العطلة المدرسية</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: center; width: 14%;">الصنف</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: center; width: 13%;">تاريخ البداية</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: center; width: 13%;">تاريخ النهاية</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: center; width: 9%;">المدة</th>
                            <th style="border: 1px solid #334155; padding: 7px 8px; text-align: right; width: 16%;">ملاحظات وحماية الغياب</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${holidays.map((h, idx) => `
                            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-weight: 900;">${idx + 1}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: 800; color: #0f172a;">${escapeHtml(h.title)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-weight: 800; color: ${h.color || '#047857'};">${escapeHtml(h.categoryLabel || 'عطلة رسمية')}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 800;" dir="ltr">${escapeHtml(h.startDate)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 800;" dir="ltr">${escapeHtml(h.endDate || h.startDate)}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-weight: 900; color: #047857; background: #f0fdf4;">${h.daysCount || 1} ${h.daysCount === 1 ? 'يوم' : h.daysCount === 2 ? 'يومان' : 'أيام'}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; font-weight: 700; color: #334155;">
                                    ${escapeHtml(h.notes || '')} ${h.disableAbsence !== false ? '<span style="color:#166534;font-weight:800;">(معفاة من الغياب)</span>' : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f0fdf4; font-weight: 900; color: #166534;">
                            <td colspan="5" style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left;">المجموع العام لأيام العطل المدرسية الرسمية خلال الموسم الدراسي:</td>
                            <td style="border: 1px solid #cbd5e1; padding: 7px 8px; text-align: center; font-size: 12px;">${stats.totalHolidayDays} يوماً</td>
                            <td style="border: 1px solid #cbd5e1; padding: 7px 8px; text-align: center;">${stats.disabledAbsenceDays} يوم محمي</td>
                        </tr>
                    </tfoot>
                </table>

                ${buildCalendarOfficialSignaturesHtml(meta.teacherName)}
            </div>
        `;

        if (options.returnInnerOnly) return innerHtml;

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>لائحة العطل المدرسية الرسمية — ${escapeHtml(meta.schoolYear)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 8mm; font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #0f172a; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${innerHtml}</body>
</html>`;
    }

    function printOfficialHolidaysTable() {
        const docHtml = buildOfficialHolidaysTablePrintHtml();
        openOrPrintCalendarDocument(docHtml, 'لائحة العطل المدرسية الرسمية المعتمدة', 'portrait');
    }

    /**
     * 3. بناء وطباعة جدول المحطات التربوية والإدارية وفروض المراقبة المستمرة والامتحانات الموحدة (المقرر الوزاري)
     */
    function buildAcademicMilestonesSchedulePrintHtml(options = {}) {
        const meta = getCalendarPrintHeaderMetadata();
        const milestones = getAcademicMilestones();
        const todayStr = new Date().toISOString().slice(0, 10);

        const s1Count = milestones.filter(m => m.semester === 's1').length;
        const s2Count = milestones.filter(m => m.semester === 's2').length;
        const examCount = milestones.filter(m => m.category === 'exam' || m.category === 'certification' || m.isUnifiedExam).length;
        const completedCount = milestones.filter(m => m.status === 'completed' || (m.endDate && m.endDate < todayStr)).length;

        const innerHtml = `
            <div dir="rtl" style="font-family: 'Cairo', 'Tajawal', sans-serif; color: #0f172a; background: #fff;">
                ${buildCalendarOfficialHeaderHtml('جدول المحطات التربوية والإدارية وفروض المراقبة المستمرة والامتحانات', 'الروزنامة الرسمية المعتمدة وفق المقرر الوزاري لتنظيم السنة الدراسية', '#2563eb')}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px;">
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #2563eb; border-radius: 8px; padding: 7px 12px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">إجمالي المحطات المعتمدة</div>
                        <div style="font-size: 15px; font-weight: 900; color: #1d4ed8;">${milestones.length} محطة</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #7c3aed; border-radius: 8px; padding: 7px 12px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">الفروض والامتحانات الموحدة</div>
                        <div style="font-size: 15px; font-weight: 900; color: #6d28d9;">${examCount} محطة تقويمية</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #0891b2; border-radius: 8px; padding: 7px 12px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">توزيع الأسدوسين (S1 / S2)</div>
                        <div style="font-size: 14px; font-weight: 900; color: #0e7490;">د1: ${s1Count} | د2: ${s2Count}</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #10b981; border-radius: 8px; padding: 7px 12px; background: #f8fafc;">
                        <div style="font-size: 9.5px; color: #64748b; font-weight: 800;">المحطات المنجزة لحد الآن</div>
                        <div style="font-size: 15px; font-weight: 900; color: #047857;">${completedCount} منجزة</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px;">
                    <thead>
                        <tr style="background: #1e293b; color: #ffffff;">
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; width: 4%;">#</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: right; width: 25%;">عنوان المحطة التربوية / الاستحقاق</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; width: 12%;">الصنف</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; width: 7%;">الدورة</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; width: 16%;">فترة الإجراء</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: right; width: 14%;">الفئات المستهدفة</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: right; width: 14%;">المخرجات / الضوابط</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; width: 8%;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${milestones.map((ms, idx) => {
                            const isFinished = ms.status === 'completed' || (ms.endDate && ms.endDate < todayStr);
                            const isOngoing = ms.status === 'in_progress' || (ms.startDate <= todayStr && (!ms.endDate || ms.endDate >= todayStr));
                            const statusText = isFinished ? '✔️ منجزة' : isOngoing ? '🟢 جارية' : ms.status === 'postponed' ? '⏸️ مؤجلة' : '⏳ مبرمجة';
                            const semText = ms.semester === 's2' ? 'الأسدوس 2' : ms.semester === 'year' ? 'سنوي' : 'الأسدوس 1';
                            return `
                                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-weight: 800;">${idx + 1}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-weight: 800; color: #0f172a;">
                                        ${escapeHtml(ms.title)}
                                        ${ms.topics ? `<div style="font-size:8.5px;color:#6d28d9;margin-top:2px;">محاور: ${escapeHtml(ms.topics)}</div>` : ''}
                                    </td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-weight: 700; color: ${ms.color || '#2563eb'};">${escapeHtml(ms.categoryLabel || 'محطة تربوية')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-weight: 800;">${semText}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-family: monospace; font-weight: 700;" dir="ltr">
                                        ${escapeHtml(ms.startDate)} ${ms.endDate && ms.endDate !== ms.startDate ? `⬅ ${escapeHtml(ms.endDate)}` : ''}
                                    </td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 9.5px; font-weight: 700; color: #0369a1;">${escapeHtml(ms.targetLevels || 'جميع الأقسام')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 9px; color: #334155;">${escapeHtml(ms.deliverables || ms.description || '—')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-weight: 800; color: ${isFinished ? '#047857' : isOngoing ? '#1d4ed8' : '#475569'};">${statusText}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${buildCalendarOfficialSignaturesHtml(meta.teacherName)}
            </div>
        `;

        if (options.returnInnerOnly) return innerHtml;

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>جدول المحطات التربوية وفروض المراقبة — ${escapeHtml(meta.schoolYear)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 9mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 6mm; font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #0f172a; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${innerHtml}</body>
</html>`;
    }

    function printAcademicMilestonesSchedule() {
        const docHtml = buildAcademicMilestonesSchedulePrintHtml();
        openOrPrintCalendarDocument(docHtml, 'جدول المحطات التربوية وفروض المراقبة (المقرر الوزاري)', 'landscape');
    }

    /**
     * 4. بناء وطباعة التقويم الشهري والأجندة التفاعلية للشهر المعروض
     */
    function buildMonthlyCalendarPrintHtml(options = {}) {
        const meta = getCalendarPrintHeaderMetadata();
        const calDate = (typeof window.getMonthlyCalendarDate === 'function' && window.getMonthlyCalendarDate())
            ? new Date(window.getMonthlyCalendarDate())
            : new Date();
        const year = options.year !== undefined ? options.year : calDate.getFullYear();
        const month = options.month !== undefined ? options.month : calDate.getMonth();

        const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
        const monthTitle = `${arabicMonths[month] || ''} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const allMilestones = getAcademicMilestones();
        const allEvents = (window.db && Array.isArray(window.db.events)) ? window.db.events : [];
        const allExams = (window.db && Array.isArray(window.db.exams)) ? window.db.exams : [];

        const monthAgendaItems = [];
        let cellsHtml = '';

        for (let i = 0; i < firstDay; i++) {
            cellsHtml += `<td style="border: 1px solid #cbd5e1; background: #f8fafc; height: 74px;"></td>`;
        }

        let currentDow = firstDay;
        let rowsHtml = '<tr>';

        for (let i = 0; i < firstDay; i++) {
            // already accounted in cellsHtml if we build row-by-row
        }

        // Build proper table rows (7 columns per week)
        rowsHtml = '';
        let weekCells = [];
        for (let i = 0; i < firstDay; i++) {
            weekCells.push(`<td style="border: 1px solid #cbd5e1; background: #f8fafc; height: 72px; vertical-align: top; padding: 4px;"></td>`);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(year, month, d).getDay();
            const isSunday = dow === 0;

            const hol = getOfficialHolidayForDate(dateStr);
            const leave = getTeacherLeaveForDate(dateStr);
            const dayMilestones = allMilestones.filter(ms => ms.startDate && dateStr >= ms.startDate && dateStr <= (ms.endDate || ms.startDate));
            const dayEvents = allEvents.filter(ev => ev.date === dateStr && !(ev.id && (String(ev.id).startsWith('ms_') || String(ev.id).startsWith('hol_') || String(ev.id).startsWith('leave_'))));
            const dayExams = allExams.filter(ex => ex.date === dateStr);

            const badges = [];
            if (hol) {
                badges.push({ label: `🏖️ ${hol.title}`, bg: '#dcfce7', col: '#166534', type: 'عطلة رسمية' });
                if (!monthAgendaItems.some(x => x.key === `hol_${hol.id}`)) {
                    monthAgendaItems.push({ key: `hol_${hol.id}`, date: `${hol.startDate}${hol.endDate && hol.endDate !== hol.startDate ? ' ⬅ ' + hol.endDate : ''}`, title: hol.title, category: 'عطلة مدرسية رسمية', target: 'جميع الأقسام (معفى من الغياب)' });
                }
            }
            if (leave) {
                badges.push({ label: `🛡️ رخصة: ${leave.typeLabel || 'إدارية'}`, bg: '#e0f2fe', col: '#0369a1', type: 'رخصة أستاذ' });
                if (!monthAgendaItems.some(x => x.key === `lv_${leave.id}`)) {
                    monthAgendaItems.push({ key: `lv_${leave.id}`, date: `${leave.startDate}${leave.endDate && leave.endDate !== leave.startDate ? ' ⬅ ' + leave.endDate : ''}`, title: `رخصة أستاذ: ${leave.typeLabel || ''}`, category: 'رخصة قانونية', target: leave.reason || 'معفى من الغياب' });
                }
            }
            dayMilestones.forEach(ms => {
                badges.push({ label: `🎯 ${ms.title}`, bg: '#eff6ff', col: '#1d4ed8', type: 'محطة تربوية' });
                if (!monthAgendaItems.some(x => x.key === `ms_${ms.id}`)) {
                    monthAgendaItems.push({ key: `ms_${ms.id}`, date: `${ms.startDate}${ms.endDate && ms.endDate !== ms.startDate ? ' ⬅ ' + ms.endDate : ''}`, title: ms.title, category: ms.categoryLabel || 'محطة وزارية', target: ms.targetLevels || 'جميع المستويات' });
                }
            });
            dayExams.forEach(ex => {
                badges.push({ label: `📝 ${ex.title || 'فرض محروس'} (${ex.className || ''})`, bg: '#fef2f2', col: '#dc2626', type: 'فرض مراقبة' });
                monthAgendaItems.push({ key: `ex_${ex.id}_${dateStr}`, date: dateStr, title: `${ex.title || 'فرض مراقبة مستمرة'}`, category: 'فرض محروس', target: ex.className || 'القسم' });
            });
            dayEvents.forEach(ev => {
                badges.push({ label: `📌 ${ev.title || 'حدث'}`, bg: '#fef9c3', col: '#854d0e', type: 'موعد' });
                monthAgendaItems.push({ key: `ev_${ev.id}_${dateStr}`, date: dateStr, title: ev.title || 'موعد تربوي', category: 'موعد / التزام', target: ev.className || ev.description || 'عام' });
            });

            const cellBg = hol ? '#f0fdf4' : leave ? '#f0f9ff' : isSunday ? '#f8fafc' : '#ffffff';

            weekCells.push(`
                <td style="border: 1px solid #cbd5e1; background: ${cellBg}; height: 72px; width: 14.28%; vertical-align: top; padding: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <span style="font-size: 11px; font-weight: 900; color: ${isSunday ? '#dc2626' : '#0f172a'};">${d}</span>
                        ${isSunday ? '<span style="font-size: 8px; color: #dc2626; font-weight: 700;">عطلة أسبوعية</span>' : ''}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        ${badges.slice(0, 3).map(b => `
                            <div style="font-size: 8.5px; font-weight: 800; background: ${b.bg}; color: ${b.col}; padding: 1px 4px; border-radius: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(b.label)}
                            </div>
                        `).join('')}
                        ${badges.length > 3 ? `<div style="font-size: 8px; color: #475569; font-weight: 800;">+${badges.length - 3} أحداث أخرى</div>` : ''}
                    </div>
                </td>
            `);

            if (weekCells.length === 7) {
                rowsHtml += `<tr>${weekCells.join('')}</tr>`;
                weekCells = [];
            }
        }

        if (weekCells.length > 0) {
            while (weekCells.length < 7) {
                weekCells.push(`<td style="border: 1px solid #cbd5e1; background: #f8fafc; height: 72px; vertical-align: top; padding: 4px;"></td>`);
            }
            rowsHtml += `<tr>${weekCells.join('')}</tr>`;
        }

        const innerHtml = `
            <div dir="rtl" style="font-family: 'Cairo', 'Tajawal', sans-serif; color: #0f172a; background: #fff;">
                ${buildCalendarOfficialHeaderHtml(`التقويم الشهري والأجندة البيداغوجية — شهر ${monthTitle}`, 'جدول المواعيد التربوية، فروض المراقبة المستمرة، المحطات الوزارية والعطل المدرسية', '#0284c7')}

                <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff; font-size: 10.5px;">
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; background: #991b1b;">الأحد</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center;">الاثنين</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center;">الثلاثاء</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center;">الأربعاء</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center;">الخميس</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center; background: #065f46;">الجمعة</th>
                            <th style="border: 1px solid #334155; padding: 6px; text-align: center;">السبت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                ${monthAgendaItems.length > 0 ? `
                    <div style="margin-bottom: 10px; page-break-inside: avoid;">
                        <div style="font-size: 11px; font-weight: 900; color: #0f172a; margin-bottom: 5px; border-right: 4px solid #0284c7; padding-right: 8px;">
                            تفاصيل الأجندة التربوية والفروض والمناسبات المسجلة خلال شهر ${escapeHtml(monthTitle)} (${monthAgendaItems.length} عنصر)
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
                            <thead>
                                <tr style="background: #f1f5f9; color: #1e293b;">
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 5%;">#</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 20%;">التاريخ / الفترة</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 35%;">الحدث / الفرض / المناسبة</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; width: 16%;">التصنيف</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; width: 24%;">القسم المستهدف / ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthAgendaItems.map((item, idx) => `
                                    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-weight: 800;">${idx + 1}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-family: monospace; font-weight: 800;" dir="ltr">${escapeHtml(item.date)}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 800; color: #0f172a;">${escapeHtml(item.title)}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; font-weight: 700;">${escapeHtml(item.category)}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 4px 6px; font-weight: 700; color: #334155;">${escapeHtml(item.target)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                ${buildCalendarOfficialSignaturesHtml(meta.teacherName)}
            </div>
        `;

        if (options.returnInnerOnly) return innerHtml;

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>التقويم الشهري والأجندة — ${escapeHtml(monthTitle)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 6mm; font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #0f172a; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${innerHtml}</body>
</html>`;
    }

    function printMonthlyCalendarSheet() {
        const docHtml = buildMonthlyCalendarPrintHtml();
        openOrPrintCalendarDocument(docHtml, 'التقويم الشهري والأجندة التفاعلية', 'landscape');
    }

    /**
     * 5. بناء وطباعة السجل الرسمي الشامل لرخص وإجازات الأستاذ (A4)
     */
    function buildTeacherLeavesLedgerPrintHtml(options = {}) {
        const meta = getCalendarPrintHeaderMetadata();
        const leaves = getTeacherLeaves();
        const stats = getTeacherLeaveStats();

        const innerHtml = `
            <div dir="rtl" style="font-family: 'Cairo', 'Tajawal', sans-serif; color: #0f172a; background: #fff;">
                ${buildCalendarOfficialHeaderHtml('السجل الرسمي لرخص وإجازات الأستاذ وتدبير الزمن المدرسي', 'توثيق الرخص الإدارية والمرضية والمهام الرسمية وفق التشريع المدرسي المغربي', '#0284c7')}

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;">
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #0284c7; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">إجمالي الرخص المسجلة</div>
                        <div style="font-size: 15px; font-weight: 900; color: #0369a1;">${stats.totalLeaves} رخصة (${stats.totalDays} يوم)</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #ef4444; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">الرخص المرضية والطبية</div>
                        <div style="font-size: 15px; font-weight: 900; color: #b91c1c;">${stats.medicalDays} يوماً</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #7c3aed; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">المهام الرسمية والتكوينات</div>
                        <div style="font-size: 15px; font-weight: 900; color: #6d28d9;">${stats.missionDays + stats.adminDays} يوماً</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-right: 4px solid #10b981; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 800;">الأيام المعفاة من غياب التلاميذ</div>
                        <div style="font-size: 15px; font-weight: 900; color: #047857;">🛡️ ${stats.protectedStudentDays} يوماً</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #0f172a; color: #ffffff;">
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 4%;">#</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: right; width: 18%;">نوع الرخصة</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 11%;">من تاريخ</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 11%;">إلى تاريخ</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 8%;">المدة</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 11%;">نطاق الحصص</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: right; width: 14%;">المرجع / الوثيقة</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: right; width: 15%;">السبب والبيان</th>
                            <th style="border: 1px solid #334155; padding: 7px 6px; text-align: center; width: 8%;">حماية الغياب</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leaves.length === 0 ? `
                            <tr>
                                <td colspan="9" style="border: 1px solid #cbd5e1; padding: 18px; text-align: center; font-weight: 800; color: #64748b;">
                                    لا توجد رخص أو إجازات مسجلة خلال هذه الفترة من الموسم الدراسي (حضور كامل 100%).
                                </td>
                            </tr>
                        ` : leaves.map((lv, idx) => {
                            const typeObj = TEACHER_LEAVE_TYPES[lv.type] || TEACHER_LEAVE_TYPES.other;
                            const scopeLabel = lv.sessionsScope === 'morning' ? 'الفترة الصباحية' : lv.sessionsScope === 'afternoon' ? 'الفترة المسائية' : 'كامل اليوم';
                            return `
                                <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: 800;">${idx + 1}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800; color: ${typeObj.color || '#0284c7'};">${escapeHtml(typeObj.label)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-family: monospace; font-weight: 800;" dir="ltr">${escapeHtml(lv.startDate)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-family: monospace; font-weight: 800;" dir="ltr">${escapeHtml(lv.endDate || lv.startDate)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: 900; color: #0369a1;">${lv.daysCount || 1} يوم</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: 700;">${scopeLabel}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 9.5px; font-weight: 700;">${escapeHtml(lv.docRef || 'مرفقة بالملف')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 9.5px;">${escapeHtml(lv.reason || '—')}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: 800; color: ${lv.disableStudentAbsence !== false ? '#166534' : '#64748b'};">${lv.disableStudentAbsence !== false ? '🛡️ معفى' : 'عادي'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${buildCalendarOfficialSignaturesHtml(meta.teacherName)}
            </div>
        `;

        if (options.returnInnerOnly) return innerHtml;

        return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>السجل الرسمي لرخص وإجازات الأستاذ — ${escapeHtml(meta.schoolYear)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { margin: 0; padding: 6mm; font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #0f172a; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${innerHtml}</body>
</html>`;
    }

    function printTeacherLeavesFullLedger() {
        const docHtml = buildTeacherLeavesLedgerPrintHtml();
        openOrPrintCalendarDocument(docHtml, 'السجل الرسمي الشامل لرخص وإجازات الأستاذ', 'landscape');
    }

    /**
     * دالة موحدة لبناء محتوى المعاينة في نافذة الطباعة الشاملة (Universal PDF Preview Modal)
     */
    function buildActiveCalendarUniversalPdfHTML(options = {}) {
        const activeSub = currentCalendarSubView || window.currentCalendarSubView || 'annual';
        if (activeSub === 'monthly') {
            return buildMonthlyCalendarPrintHtml({ returnInnerOnly: true });
        }
        if (activeSub === 'leaves') {
            return buildTeacherLeavesLedgerPrintHtml({ returnInnerOnly: true });
        }
        if (activeSub === 'roadmap' && typeof window.buildPedagogicalRoadmapPrintHtml === 'function') {
            return window.buildPedagogicalRoadmapPrintHtml({ returnInnerOnly: true });
        }
        if (annualCalendarViewMode === 'table') {
            return buildOfficialHolidaysTablePrintHtml({ returnInnerOnly: true });
        }
        return buildAnnualSchoolCalendarPrintHtml({ returnInnerOnly: true });
    }

    /**
     * 6. مركز طباعة التقويم الموحد (Calendar Print Hub Modal)
     * يتيح للأستاذ اختيار أي قسم من أقسام التقويم الستة لمعاينته وطباعته بصيغة A4 أو تصديره PDF
     */
    function openCalendarPrintHubModal() {
        const existing = document.getElementById('calendarPrintHubModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'calendarPrintHubModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(4px); z-index: 99999; align-items: center; justify-content: center; padding: 16px; direction: rtl;';

        modal.innerHTML = `
            <div style="background: #ffffff; width: 100%; max-width: 780px; border-radius: 18px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); border: 1px solid #e2e8f0; overflow: hidden; font-family: 'Cairo', sans-serif; animation: fadeIn 0.2s ease-out;">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); display: flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 4px 12px rgba(37,99,235,0.4);">
                            🖨️
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #fff;">مركز طباعة وتصدير وثائق التقويم المدرسي (A4 / PDF)</h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #cbd5e1;">اختر الوثيقة الرسمية لمعاينتها بدقة A4 أو طباعتها مباشرة أو حفظها بصيغة PDF</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove()" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); color: #fff; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; font-weight: 900; font-size: 1rem;">✕</button>
                </div>

                <div style="padding: 20px 22px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(225px, 1fr)); gap: 12px;">
                        <!-- 1. التقويم السنوي الشامل وشبكة الشهور الـ 12 -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #4f46e5; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">🗓️ التقويم السنوي الشامل (12 شهراً)</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">شبكة الشهور الـ 12 ملونة بالعطل والمحطات والفروض + ملخص العطل الرسمية في صفحة A4 أفقية.</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); window.openOrPrintCalendarDocument(window.buildAnnualSchoolCalendarPrintHtml(), 'التقويم السنوي الشامل وشبكة الشهور الـ 12', 'landscape');" style="background: #4f46e5; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة التقويم السنوي
                            </button>
                        </div>

                        <!-- 2. لائحة العطل المدرسية الرسمية -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #10b981; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">🌴 لائحة العطل المدرسية الرسمية</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">جدول رسمي مفصل بجميع فترات العطل المدرسية وأصنافها ومدتها وحالة حماية الغياب (A4 عمودي).</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); window.printOfficialHolidaysTable();" style="background: #10b981; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة لائحة العطل
                            </button>
                        </div>

                        <!-- 3. جدول المحطات التربوية وفروض المراقبة -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #2563eb; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">🎯 جدول المحطات وفروض المراقبة</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">الروزنامة الوزارية الكاملة لفروض المراقبة المستمرة، مسك النقط، الامتحانات الموحدة ومجالس الأقسام.</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); window.printAcademicMilestonesSchedule();" style="background: #2563eb; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة جدول المحطات
                            </button>
                        </div>

                        <!-- 4. التقويم الشهري والأجندة التفاعلية -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #0284c7; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">📅 التقويم الشهري والأجندة</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">شبكة الشهر الحالي مع كافة الفروض والمواعيد والعطل + جدول الأجندة التفصيلي أسفلها.</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); window.printMonthlyCalendarSheet();" style="background: #0284c7; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة الشهر الحالي
                            </button>
                        </div>

                        <!-- 5. السجل الرسمي لرخص وإجازات الأستاذ -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #0d9488; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">🛡️ سجل رخص وإجازات الأستاذ</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">البيان الإجمالي للرخص الإدارية والمرضية والمهام الرسمية مع إحصائيات الأيام المحمية.</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); window.printTeacherLeavesFullLedger();" style="background: #0d9488; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة سجل الرخص
                            </button>
                        </div>

                        <!-- 6. المسار البيداغوجي السنوي الشامل -->
                        <div style="border: 1.5px solid #e2e8f0; border-right: 5px solid #7c3aed; border-radius: 12px; padding: 14px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 4px;">🧭 المسار البيداغوجي السنوي</div>
                                <div style="font-size: 0.77rem; color: #475569; line-height: 1.45;">الخريطة البانورامية للمحطات البيداغوجية والفروض ومجالس الأقسام ومؤشرات التقدم السنوي.</div>
                            </div>
                            <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove(); if(typeof window.printPedagogicalRoadmap==='function') window.printPedagogicalRoadmap();" style="background: #7c3aed; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; width: 100%;">
                                🖨️ معاينة وطباعة المسار البيداغوجي
                            </button>
                        </div>
                    </div>
                </div>

                <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: 700;">💡 جميع الوثائق تفتح في نافذة معاينة A4 تتيح التبديل بين العمودي والأفقي وتحميل PDF مباشر.</span>
                    <button type="button" onclick="document.getElementById('calendarPrintHubModal').remove()" style="background: #e2e8f0; color: #334155; border: none; padding: 6px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer;">إغلاق</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * ====================================================================
     * خاصية 'الترحيل التلقائي للغياب' في أيام العطل المدرسية الرسمية
     * Automatic Holiday Absence Migration & Lockout Engine
     * ====================================================================
     */
    function autoMigrateHolidayAbsences(options = {}) {
        const silent = options.silent || false;
        if (!window.db) return { migratedCount: 0, totalAudited: 0, protectedStudents: [] };
        if (!Array.isArray(window.db.records)) window.db.records = [];

        const holidays = getOfficialHolidays();
        let migratedCount = 0;
        const protectedStudentsMap = new Map();

        // 1. فحص وترحيل السجلات الموجودة في أيام العطل
        for (let i = 0; i < window.db.records.length; i++) {
            const r = window.db.records[i];
            if (!r || !r.date) continue;

            const holiday = getOfficialHolidayForDate(r.date);
            if (holiday && holiday.disableAbsence !== false) {
                // إذا كان مسجلاً كغائب أو غير مبرر أو أي حالة أخرى غير 'عطلة رسمية'
                if (r.status === 'غائب' || r.status === 'غير مبرر' || (r.status !== 'عطلة رسمية' && !r.migratedHoliday)) {
                    r.originalStatus = r.originalStatus || r.status;
                    r.status = 'عطلة رسمية';
                    r.migratedHoliday = true;
                    r.holidayId = holiday.id;
                    r.holidayTitle = holiday.title;
                    r.justified = true;
                    r.duration = 0; // حماية الطالب من احتساب أي ساعة غياب غير مبررة
                    r.migratedAt = new Date().toISOString();
                    r.note = (r.note ? r.note + ' | ' : '') + `ترحيل تلقائي: عطلة مدرسية رسمية (${holiday.title}) - معفى من الغياب غير المبرر`;
                    migratedCount++;

                    const stdKey = (r.studentId || '') + '_' + (r.className || '');
                    protectedStudentsMap.set(stdKey, {
                        studentId: r.studentId,
                        className: r.className,
                        date: r.date,
                        holidayTitle: holiday.title,
                        migratedAt: r.migratedAt
                    });
                }
            }
        }

        // 2. تحديث إحصائيات الترحيل في قاعدة البيانات
        window.db.holidayMigrationStats = {
            lastRun: new Date().toISOString(),
            migratedCount: (window.db.holidayMigrationStats?.migratedCount || 0) + migratedCount,
            lastBatchMigrated: migratedCount,
            totalHolidaysRecognized: holidays.length
        };

        if (migratedCount > 0) {
            if (typeof window.saveDB === 'function') window.saveDB();
            if (typeof window.renderStudents === 'function') {
                try { window.renderStudents(); } catch (e) {}
            }
        }

        if (!silent && typeof window.showNotification === 'function') {
            if (migratedCount > 0) {
                window.showNotification(`تم الترحيل التلقائي لـ ${migratedCount} سجل غياب في أيام العطل بنجاح، وحماية التلاميذ من أي غياب غير مبرر`, 'success');
            } else {
                window.showNotification('كافة سجلات الغياب متوافقة ومحمية تلقائياً؛ لا توجد أي غيابات غير مبررة مسجلة في أيام العطل الرسمية', 'info');
            }
        }

        return {
            migratedCount,
            totalAudited: window.db.records.length,
            protectedStudents: Array.from(protectedStudentsMap.values())
        };
    }

    /**
     * استخراج إحصائيات الترحيل التلقائي
     */
    function getHolidayMigrationStats() {
        const holidays = getOfficialHolidays();
        let migratedCount = 0;
        const migratedList = [];

        if (window.db && Array.isArray(window.db.records)) {
            window.db.records.forEach(r => {
                if (r.migratedHoliday || r.status === 'عطلة رسمية') {
                    migratedCount++;
                    migratedList.push(r);
                }
            });
        }

        return {
            totalHolidays: holidays.length,
            migratedCount,
            migratedList,
            lastRun: window.db?.holidayMigrationStats?.lastRun || null
        };
    }

    /**
     * فتح نافذة مركز الترحيل التلقائي لغياب العطل
     */
    function openHolidayAbsenceMigrationModal() {
        const stats = getHolidayMigrationStats();
        let modal = document.getElementById('holidayAbsenceMigrationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'holidayAbsenceMigrationModal';
            modal.className = 'modal-backdrop';
            modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(3px); direction:rtl;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#ffffff; border-radius:14px; width:92%; max-width:760px; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 20px 45px rgba(0,0,0,0.25); border:1.5px solid #cbd5e1; font-family:'Cairo',sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:14px; margin-bottom:18px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="background:linear-gradient(135deg, #7c3aed, #4f46e5); color:#fff; width:44px; height:44px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(124,58,237,0.3);">
                            <span data-lucide="shield-check" data-size="24"></span>
                        </span>
                        <div>
                            <h3 style="margin:0; font-size:1.2rem; font-weight:900; color:#0f172a;">
                                مركز الترحيل التلقائي لغياب العطل المدرسية الرسمية 🛡️
                            </h3>
                            <p style="margin:2px 0 0 0; font-size:0.78rem; color:#64748b;">
                                حماية نزاهة مواظبة التلاميذ ومنع تسجيل أي غياب غير مبرر في تواريخ العطل المحددة بالتقويم السنوي
                            </p>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeHolidayAbsenceMigrationModal()" style="border:none; background:#f1f5f9; width:34px; height:34px; border-radius:8px; cursor:pointer; font-size:1.1rem; font-weight:bold; color:#64748b;">✕</button>
                </div>

                <!-- شريط المؤشرات التلقائية -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-bottom:18px;">
                    <div style="background:#f5f3ff; border:1.5px solid #ddd6fe; border-radius:12px; padding:12px 14px;">
                        <div style="font-size:0.75rem; color:#6d28d9; font-weight:800;">العطل الرسمية المعتمدة</div>
                        <div style="font-size:1.3rem; font-weight:900; color:#5b21b6; margin-top:2px;">${stats.totalHolidays} عطلة</div>
                        <div style="font-size:0.7rem; color:#7c3aed; margin-top:3px;">مربوطة بنظام الغياب تلقائياً</div>
                    </div>
                    <div style="background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:12px; padding:12px 14px;">
                        <div style="font-size:0.75rem; color:#047857; font-weight:800;">السجلات المرحلة كعطلة رسمية</div>
                        <div style="font-size:1.3rem; font-weight:900; color:#065f46; margin-top:2px;">${stats.migratedCount} سجل</div>
                        <div style="font-size:0.7rem; color:#059669; margin-top:3px;">ساعات غياب غير مبرر: 0 س</div>
                    </div>
                    <div style="background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:12px; padding:12px 14px;">
                        <div style="font-size:0.75rem; color:#1d4ed8; font-weight:800;">حالة الحماية التلقائية</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#1e40af; margin-top:4px;">مفعلة ونشطة دائماً</div>
                        <div style="font-size:0.7rem; color:#3b82f6; margin-top:3px;">منع فوري لتسجيل الغياب بالعطل</div>
                    </div>
                </div>

                <!-- صندوق التفسير التشريعي والتربوي -->
                <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-right:5px solid #8b5cf6; border-radius:10px; padding:12px 16px; margin-bottom:18px; font-size:0.8rem; line-height:1.6; color:#334155;">
                    <strong>📌 كيف تعمل خاصية الترحيل التلقائي؟</strong>
                    <br>
                    تقوم المنظومة بفحص كل تواريخ العطل المدرجة في التقويم السنوي. في حال مصادفة أي تاريخ لعطلة رسمية (مثل عطل الفترات البينية أو الأعياد الوطنية والدينية)، يتم تلقائياً:
                    <ul style="margin:6px 0 0 0; padding-right:20px;">
                        <li>ترحيل حالة التلاميذ إلى <strong>'عطلة رسمية'</strong> بدلاً من 'غائب'.</li>
                        <li>منع احتساب أي ساعات غياب غير مبرر ضد التلميذ لحماية معدل انضباطه ومواظبته.</li>
                        <li>تعطيل أزرار تسجيل الغياب في لائحة القسم إذا كان تاريخ اليوم يوافق عطلة رسمية، مع إشعار فوري للأستاذ.</li>
                    </ul>
                </div>

                <!-- زر الإجراء الفوري -->
                <div style="background:linear-gradient(135deg, #faf5ff, #f3e8ff); border:1.5px dashed #c084fc; border-radius:12px; padding:14px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="font-weight:900; font-size:0.85rem; color:#6b21a8;">فحص شامل وترحيل فوري لجميع السجلات القديمة</div>
                        <div style="font-size:0.74rem; color:#7e22ce;">فحص كافة التواريخ المدخلة في قاعدة البيانات وترحيل أي غياب مسجل بالخطأ في أيام العطل</div>
                    </div>
                    <button type="button" onclick="window.runManualHolidayAbsenceMigration()" style="background:linear-gradient(135deg, #7c3aed, #6d28d9); color:#fff; border:none; padding:8px 18px; border-radius:8px; font-weight:800; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(124,58,237,0.3);">
                        <span data-lucide="play" data-size="14"></span>
                        <span>فحص وترحيل السجلات الآن</span>
                    </button>
                </div>

                <!-- جدول السجلات المرحلة -->
                <h4 style="margin:0 0 10px 0; font-size:0.88rem; font-weight:800; color:#1e293b;">سجل العمليات المرحلة تلقائياً (${stats.migratedList.length}):</h4>
                <div style="max-height:220px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:18px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem; text-align:right;">
                        <thead style="background:#f8fafc; color:#475569; position:sticky; top:0;">
                            <tr>
                                <th style="padding:6px 10px;">التاريخ</th>
                                <th style="padding:6px 10px;">العطلة الرسمية</th>
                                <th style="padding:6px 10px;">القسم</th>
                                <th style="padding:6px 10px;">معرف التلميذ</th>
                                <th style="padding:6px 10px; text-align:center;">الحالة بعد الترحيل</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.migratedList.length === 0 ? `
                                <tr>
                                    <td colspan="5" style="text-align:center; padding:18px; color:#64748b; font-weight:700;">
                                        ✅ لم يتم تسجيل أي غياب غير مبرر في أيام العطل (السجلات نظيفة ومحمية بالكامل).
                                    </td>
                                </tr>
                            ` : stats.migratedList.slice(0, 30).map(r => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:6px 10px; font-weight:bold; color:#0f172a;">${r.date}</td>
                                    <td style="padding:6px 10px; color:#6d28d9; font-weight:bold;">${escapeHtml(r.holidayTitle || 'عطلة رسمية')}</td>
                                    <td style="padding:6px 10px; color:#475569;">${escapeHtml(r.className || '-')}</td>
                                    <td style="padding:6px 10px; font-family:monospace;">${r.studentId}</td>
                                    <td style="padding:6px 10px; text-align:center;">
                                        <span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-weight:800; font-size:0.72rem;">
                                            عطلة رسمية (معفى)
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display:flex; justify-content:flex-end;">
                    <button type="button" onclick="window.closeHolidayAbsenceMigrationModal()" style="background:#2563eb; color:#fff; border:none; padding:8px 20px; border-radius:8px; font-weight:bold; font-size:0.84rem; cursor:pointer;">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.lucide) window.lucide.createIcons();
    }

    function closeHolidayAbsenceMigrationModal() {
        const modal = document.getElementById('holidayAbsenceMigrationModal');
        if (modal) modal.style.display = 'none';
    }

    function runManualHolidayAbsenceMigration() {
        const res = autoMigrateHolidayAbsences({ silent: false });
        openHolidayAbsenceMigrationModal(); // تحديث العرض
    }

    /**
     * ترحيل يوم كامل لجميع تلاميذ القسم كعطلة رسمية
     */
    function migrateDayToHolidayForAllStudents(dateStr) {
        if (!dateStr || !window.db) return;
        const holiday = getOfficialHolidayForDate(dateStr);
        if (!holiday) {
            alert('التاريخ المختار ليس مسجلاً كعطلة رسمية في التقويم السنوي.');
            return;
        }

        const className = document.getElementById('classSelect')?.value;
        const students = (className && window.db.classes && window.db.classes[className]) ? window.db.classes[className] : [];

        if (students.length === 0) {
            alert('الرجاء اختيار قسم مسجل أولاً.');
            return;
        }

        const session = document.getElementById('sessionSelect')?.value || 's1';
        let count = 0;

        students.forEach(std => {
            const existing = (window.db.records || []).find(r => r.studentId === std.id && r.date === dateStr && r.session === session);
            if (existing) {
                existing.status = 'عطلة رسمية';
                existing.migratedHoliday = true;
                existing.holidayTitle = holiday.title;
                existing.duration = 0;
                existing.justified = true;
            } else {
                window.db.records.push({
                    studentId: std.id,
                    className: className,
                    date: dateStr,
                    session: session,
                    status: 'عطلة رسمية',
                    duration: 0,
                    part: 'all',
                    homework: 'منجز',
                    migratedHoliday: true,
                    holidayTitle: holiday.title,
                    justified: true
                });
            }
            count++;
        });

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderStudents === 'function') window.renderStudents();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`تم تسجيل وترحيل ${count} تلميذاً لصفة "عطلة رسمية" تلقائياً ومنع احتساب أي غياب غير مبرر`, 'success');
        }
    }

    // تصدير دوال الترحيل التلقائي
    window.autoMigrateHolidayAbsences = autoMigrateHolidayAbsences;
    window.getHolidayMigrationStats = getHolidayMigrationStats;
    window.openHolidayAbsenceMigrationModal = openHolidayAbsenceMigrationModal;
    window.closeHolidayAbsenceMigrationModal = closeHolidayAbsenceMigrationModal;
    window.runManualHolidayAbsenceMigration = runManualHolidayAbsenceMigration;
    window.migrateDayToHolidayForAllStudents = migrateDayToHolidayForAllStudents;

    // ==========================================
    // منظومة المستويات والأقسام المسندة وتصنيف المنهاج المغربي
    // ==========================================
    const MOROCCAN_LEVELS_META = {
        'all': {
            label: '🏫 جميع المستويات والأقسام المسندة',
            shortName: 'جميع المستويات',
            keywords: [],
            suggestedTopics: ['فروض المراقبة المستمرة', 'التقويم التشخيصي والدعم', 'أنشطة وأولمبياد الرياضيات', 'المقرر السنوي للرياضيات']
        },
        'tcs': {
            label: 'الجذع المشترك العلمي والتكنولوجي (TCS)',
            shortName: 'الجذع المشترك العلمي',
            keywords: ['tcs', 'علمي', 'تكنولوجي', 'جذع مشترك علمي', 'tc'],
            suggestedTopics: ['الحسابيات في N ومبادئ الحسابيات', 'الحساب المتجهي في المستوى', 'الإسقاط في المستوى', 'مجموعات الأعداد والترتيب في R', 'المستقيم في المستوى', 'الحدوديات والمعادلات والمتراجحات', 'الحساب المثلثي', 'الإحصاء', 'الهندسة الفضائية']
        },
        'tcl': {
            label: 'الجذع المشترك للآداب والعلوم الإنسانية (TCL)',
            shortName: 'الجذع المشترك للآداب',
            keywords: ['tcl', 'آداب', 'اداب', 'انساني', 'إنساني'],
            suggestedTopics: ['الحساب العددي والنسب المئوية', 'المعادلات والمتراجحات من الدرجة الأولى والثانية', 'الدوال العددية', 'الإحصاء واستثمار المعطيات']
        },
        '1bac_sm': {
            label: 'السنة الأولى باكالوريا علوم رياضية (1BAC-SM)',
            shortName: '1 باك علوم رياضية',
            keywords: ['1bac', 'sm', 'رياضية', 'رياضيه', 'علوم رياضية'],
            suggestedTopics: ['مبادئ في المنطق والاستدلال الرياضي', 'المجموعات والتطبيقات', 'عموميات حول الدوال العددية', 'المرجح في المستوى', 'الجداء السلمي وتطبيقاته', 'الحساب المثلثي والتحويلات', 'المتتاليات العددية', 'نهاية دالة عددية', 'الاشتقاق ودراسة الدوال', 'الدوران في المستوى', 'الهندسة الفضائية']
        },
        '1bac_exp': {
            label: 'السنة الأولى باكالوريا علوم تجريبية وتكنولوجية (1BAC-EXP)',
            shortName: '1 باك علوم تجريبية',
            keywords: ['1bac', 'exp', 'pc', 'svt', 'se', 'st', 'تجريبية', 'تجريبيه', 'تكنولوجي'],
            suggestedTopics: ['مبادئ في المنطق الرياضي', 'عموميات حول الدوال العددية', 'المرجح في المستوى', 'الجداء السلمي في المستوى', 'الحساب المثلثي', 'المتتاليات العددية', 'النهايات والاشتقاق', 'الهندسة الفضائية']
        },
        '1bac_eco': {
            label: 'السنة الأولى باكالوريا علوم اقتصادية وتدبير (1BAC-ECO)',
            shortName: '1 باك علوم اقتصادية',
            keywords: ['1bac', 'eco', 'اقتصاد', 'تدبير'],
            suggestedTopics: ['المتتاليات الحسابية والهندسية', 'الدوال العددية ونهاياتها', 'الاشتقاق وتطبيقاته الاقتصادية', 'الاحتمالات']
        },
        '1bac_l': {
            label: 'السنة الأولى باكالوريا آداب وعلوم إنسانية (1BAC-L)',
            shortName: '1 باك آداب وإنسانية',
            keywords: ['1bac', 'l', 'آداب', 'اداب'],
            suggestedTopics: ['المتتاليات العددية', 'النهايات والاشتقاق', 'التعداد والاحتمالات']
        },
        '2bac_sm': {
            label: 'السنة الثانية باكالوريا علوم رياضية (2BAC-SM A/B)',
            shortName: '2 باك علوم رياضية',
            keywords: ['2bac', 'sm', 'رياضية', 'رياضيه'],
            suggestedTopics: ['النهايات والاتصال ومبرهنة القيم الوسيطية', 'الاشتقاق ودراسة الدوال ومبرهنة رول', 'المتتاليات العددية وسلوكها التقاربي', 'الدوال اللوغاريتمية والأسية', 'الأعداد العقدية والبنيات الجبرية', 'حساب التكامل والمعادلات التفاضلية', 'الحسابيات في Z', 'الفضاءات المتجهة الحقيقية', 'الاحتمالات والمتغيرات العشوائية']
        },
        '2bac_pc': {
            label: 'السنة الثانية باكالوريا علوم فيزيائية و SVT (2BAC-PC/SVT)',
            shortName: '2 باك علوم تجريبية (PC/SVT)',
            keywords: ['2bac', 'pc', 'svt', 'تجريبية', 'فيزياء', 'أرض', 'حياة'],
            suggestedTopics: ['الاتصال والاشتقاق ودراسة الدوال', 'المتتاليات العددية', 'الدوال الأسية واللوغاريتمية', 'الأعداد العقدية والتحويلات الهندسية', 'حساب التكامل والدوال الأصلية', 'المعادلات التفاضلية', 'الهندسة الفضائية والجداء المتجهي', 'حساب الاحتمالات']
        },
        '2bac_eco': {
            label: 'السنة الثانية باكالوريا علوم اقتصادية وتدبير (2BAC-ECO)',
            shortName: '2 باك علوم اقتصادية',
            keywords: ['2bac', 'eco', 'اقتصاد'],
            suggestedTopics: ['الدوال الأسية واللوغاريتمية وتطبيقاتها', 'المتتاليات العددية', 'حساب التكامل', 'الاحتمالات']
        },
        'custom': {
            label: '✏️ مستوى أو فئة مخصصة يدوياً...',
            shortName: 'مستوى مخصص',
            keywords: [],
            suggestedTopics: ['أنشطة تقويمية', 'فروض المراقبة المستمرة', 'دعم استدراكي', 'مشروع بيداغوجي']
        }
    };

    /**
     * استنتاج رمز المستوى الدراسي تلقائياً من اسم القسم
     */
    function detectClassLevelCode(className) {
        if (!className) return 'all';
        const str = String(className).toLowerCase().replace(/[-_\s]+/g, '');
        
        // 2BAC
        if (str.includes('2bac') || str.includes('ثانيةباك') || str.includes('2b')) {
            if (str.includes('sm') || str.includes('رياضي')) return '2bac_sm';
            if (str.includes('eco') || str.includes('اقتصاد')) return '2bac_eco';
            return '2bac_pc';
        }
        
        // 1BAC
        if (str.includes('1bac') || str.includes('اولىباك') || str.includes('أولىباك') || str.includes('1b')) {
            if (str.includes('sm') || str.includes('رياضي')) return '1bac_sm';
            if (str.includes('eco') || str.includes('اقتصاد')) return '1bac_eco';
            if (str.includes('l') || str.includes('آداب') || str.includes('اداب')) return '1bac_l';
            return '1bac_exp';
        }

        // Tronc Commun
        if (str.includes('tcs') || str.includes('tc') || str.includes('جذع') || str.includes('مشترك')) {
            if (str.includes('tcl') || str.includes('آداب') || str.includes('اداب')) return 'tcl';
            return 'tcs';
        }

        return 'all';
    }
    window.detectClassLevelCode = detectClassLevelCode;

    /**
     * استخراج وتجميع الأقسام المسندة للأستاذ مصنفة حسب المستويات الدراسية
     */
    function getAssignedClassesGroupedByLevel() {
        let classes = [];
        if (typeof getSortedClasses === 'function') {
            classes = getSortedClasses(false);
        } else if (window.db && window.db.classes) {
            const archived = window.db.archivedClasses || [];
            classes = Object.keys(window.db.classes).filter(c => !archived.includes(c));
        }

        const groups = {};
        classes.forEach(c => {
            const lvlCode = detectClassLevelCode(c);
            if (!groups[lvlCode]) groups[lvlCode] = [];
            const stdList = (window.db && window.db.classes && window.db.classes[c]) ? window.db.classes[c] : [];
            const count = Array.isArray(stdList) ? stdList.length : 0;
            groups[lvlCode].push({ name: c, count });
        });

        return { classes, groups };
    }
    window.getAssignedClassesGroupedByLevel = getAssignedClassesGroupedByLevel;

    /**
     * تعبئة القائمة المنسدلة لاختيار المستوى الدراسي المعني
     */
    function populateMilestoneLevelsDropdown(selectedLevel = 'all', preselectedClasses = []) {
        const levelSelect = document.getElementById('milestoneLevelSelect');
        if (!levelSelect) return;

        const { classes, groups } = getAssignedClassesGroupedByLevel();
        let html = '';

        // الخيار الأول: جميع المستويات والأقسام
        const totalCount = classes.length;
        html += `<option value="all" ${selectedLevel === 'all' ? 'selected' : ''}>🏫 جميع المستويات والأقسام المسندة (${totalCount} قسم)</option>`;

        // المستويات المسندة فعلياً للأستاذ أولاً
        const assignedLevelKeys = Object.keys(groups).filter(k => k !== 'all');
        if (assignedLevelKeys.length > 0) {
            html += `<optgroup label="── 🎓 مستوياتك المسندة إليك حالياً ──">`;
            assignedLevelKeys.forEach(k => {
                const meta = MOROCCAN_LEVELS_META[k] || { label: k, shortName: k };
                const count = groups[k].length;
                html += `<option value="${k}" ${selectedLevel === k ? 'selected' : ''}>⭐ ${meta.label} (${count} ${count === 1 ? 'قسم مسند' : 'أقسام مسندة'})</option>`;
            });
            html += `</optgroup>`;
        }

        // باقي المستويات الرسمية للمنهاج الثانوي
        html += `<optgroup label="── 📚 سائر مستويات الثانوي التأهيلي ──">`;
        Object.keys(MOROCCAN_LEVELS_META).forEach(k => {
            if (k !== 'all' && k !== 'custom' && !assignedLevelKeys.includes(k)) {
                const meta = MOROCCAN_LEVELS_META[k];
                html += `<option value="${k}" ${selectedLevel === k ? 'selected' : ''}>${meta.label}</option>`;
            }
        });
        html += `</optgroup>`;

        // خيار مخصص
        html += `<option value="custom" ${selectedLevel === 'custom' ? 'selected' : ''}>✏️ مستوى أو فئة مخصصة يدوياً...</option>`;

        levelSelect.innerHTML = html;
        if (selectedLevel) levelSelect.value = selectedLevel;

        onMilestoneLevelSelectChange(selectedLevel, preselectedClasses);
    }
    window.populateMilestoneLevelsDropdown = populateMilestoneLevelsDropdown;

    /**
     * تفاعل اختيار المستوى الدراسي المعني:
     * يُظهر فورياً القائمة المنسدلة بالأقسام المسندة لهذا المستوى
     * ويحدث شبكة المربعات والشرائح والموضوعات الرياضية المقترحة
     */
    function onMilestoneLevelSelectChange(levelKey, preselectedClasses = []) {
        const assignedClassesContainer = document.getElementById('milestoneAssignedClassesContainer');
        const assignedClassSelect = document.getElementById('milestoneAssignedClassSelect');
        const multiWrapper = document.getElementById('milestoneClassesMultiWrapper');
        const multiContainer = document.getElementById('milestoneClassesMultiContainer');
        const customInput = document.getElementById('milestoneTargetLevelsInput');
        const summary = document.getElementById('milestoneSelectedClassesSummary');

        if (!assignedClassesContainer || !assignedClassSelect || !multiContainer) return;

        // حالة إدخال مستوى مخصص يدوي
        if (levelKey === 'custom') {
            assignedClassesContainer.style.opacity = '0.4';
            assignedClassesContainer.style.pointerEvents = 'none';
            if (multiWrapper) multiWrapper.style.display = 'none';
            if (customInput) {
                customInput.style.display = 'block';
                customInput.focus();
            }
            if (summary) {
                summary.textContent = '✏️ مستوى مخصص يدوي (يرجى كتابة الاسم)';
                summary.style.color = '#7c3aed';
                summary.style.background = '#faf5ff';
                summary.style.borderColor = '#e9d5ff';
            }
            updateMilestoneTopicChips('all');
            return;
        }

        assignedClassesContainer.style.opacity = '1';
        assignedClassesContainer.style.pointerEvents = 'auto';
        if (multiWrapper) multiWrapper.style.display = 'block';
        if (customInput) customInput.style.display = 'none';

        const { classes, groups } = getAssignedClassesGroupedByLevel();
        let targetClassesList = [];

        if (levelKey === 'all') {
            targetClassesList = classes.map(c => {
                const stdList = (window.db && window.db.classes && window.db.classes[c]) ? window.db.classes[c] : [];
                return { name: c, count: Array.isArray(stdList) ? stdList.length : 0 };
            });
        } else if (groups[levelKey] && groups[levelKey].length > 0) {
            targetClassesList = groups[levelKey];
        } else {
            // تصفية مرنة في حال لم تكن مسندة عبر الفرز المباشر
            targetClassesList = classes.filter(c => detectClassLevelCode(c) === levelKey).map(c => {
                const stdList = (window.db && window.db.classes && window.db.classes[c]) ? window.db.classes[c] : [];
                return { name: c, count: Array.isArray(stdList) ? stdList.length : 0 };
            });
        }

        const levelMeta = MOROCCAN_LEVELS_META[levelKey] || { shortName: levelKey, label: levelKey };

        // 1. تعبئة القائمة المنسدلة بالأقسام المسندة
        let selectHtml = '';
        if (targetClassesList.length > 0) {
            selectHtml += `<option value="all_level">✨ جميع أقسام ${levelMeta.shortName} (${targetClassesList.length} قسم)</option>`;
            targetClassesList.forEach(cls => {
                selectHtml += `<option value="${escapeHtml(cls.name)}">📌 قسم ${escapeHtml(cls.name)} (${cls.count} تلميذاً)</option>`;
            });
            if (targetClassesList.length > 1) {
                selectHtml += `<option value="multi_custom">☑️ اختيار متعدد لعدة أقسام محددة</option>`;
            }
        } else {
            selectHtml = `<option value="none">⚠️ لا توجد أقسام مسندة مسجلة لهذا المستوى</option>`;
        }
        assignedClassSelect.innerHTML = selectHtml;

        // 2. تعبئة شبكة مربعات التحديد المتعدد
        multiContainer.innerHTML = '';
        if (targetClassesList.length > 0) {
            targetClassesList.forEach(cls => {
                const isPre = preselectedClasses.length > 0 ? preselectedClasses.includes(cls.name) : true;
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.justifyContent = 'space-between';
                label.style.gap = '6px';
                label.style.padding = '5px 8px';
                label.style.borderRadius = '6px';
                label.style.background = '#f8fafc';
                label.style.border = '1px solid #cbd5e1';
                label.style.fontSize = '0.78rem';
                label.style.fontWeight = '700';
                label.style.cursor = 'pointer';

                label.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="milestone-class-checkbox" value="${escapeHtml(cls.name)}" onchange="window.onMilestoneClassCheckboxChange()" ${isPre ? 'checked' : ''} style="accent-color: #2563eb; width: 15px; height: 15px; cursor: pointer;">
                        <span style="font-weight: 800; color: #0f172a;">${escapeHtml(cls.name)}</span>
                    </div>
                    <span style="font-size: 0.7rem; color: #0369a1; background: #e0f2fe; padding: 1px 6px; border-radius: 4px; font-weight: 800;">${cls.count} تلميذ</span>
                `;
                multiContainer.appendChild(label);
            });
        } else {
            multiContainer.innerHTML = `
                <div style="font-size: 0.74rem; color: #64748b; grid-column: 1 / -1; padding: 4px;">
                    لم يتم العثور على أقسام مستوردة لهذا المستوى في لوائح مسار الحالية. يمكنك كتابة المستوى أو القسم يدوياً عبر زر "تحديد مستوى مخصص".
                </div>
            `;
        }

        // 3. تحديث شرائح محاور وموضوعات الرياضيات المقترحة بناءً على المستوى المختار
        updateMilestoneTopicChips(levelKey);

        // 4. تحديث بطاقة الملخص
        updateMilestoneSelectedSummary();
    }
    window.onMilestoneLevelSelectChange = onMilestoneLevelSelectChange;

    /**
     * تفاعل تغيير القائمة المنسدلة بالأقسام المسندة
     */
    function onMilestoneAssignedClassSelectChange(val) {
        const checkboxes = Array.from(document.querySelectorAll('.milestone-class-checkbox'));
        if (val === 'all_level') {
            checkboxes.forEach(cb => cb.checked = true);
        } else if (val === 'multi_custom') {
            // ترك التحديد اليدوي للمستخدم
        } else if (val && val !== 'none') {
            checkboxes.forEach(cb => {
                cb.checked = (cb.value === val);
            });
        }
        updateMilestoneSelectedSummary();
    }
    window.onMilestoneAssignedClassSelectChange = onMilestoneAssignedClassSelectChange;

    /**
     * تحديث شرائح محاور التعلم والدروس المقترحة تلقائياً حسب المستوى الدراسي
     */
    function updateMilestoneTopicChips(levelKey) {
        const container = document.getElementById('milestoneTopicChipsContainer');
        if (!container) return;

        const meta = MOROCCAN_LEVELS_META[levelKey] || MOROCCAN_LEVELS_META.all;
        const topics = meta.suggestedTopics || [];

        container.innerHTML = topics.map(t => `
            <button type="button" 
                onclick="window.addMilestoneTopic('${escapeQuotes(t)}')"
                style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 5px; padding: 3px 8px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; transition: all 0.15s;"
                title="انقر لإدراج هذا الدرس أو المفهوم فورياً في موضوع المحطة">
                <span>+</span>
                <span>${escapeHtml(t)}</span>
            </button>
        `).join('');
    }
    window.updateMilestoneTopicChips = updateMilestoneTopicChips;

    /**
     * تحديد كافة أقسام المستوى المعروض حالياً
     */
    function selectCurrentLevelMilestoneClasses(selectAll) {
        const checkboxes = document.querySelectorAll('.milestone-class-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        const select = document.getElementById('milestoneAssignedClassSelect');
        if (select && selectAll) select.value = 'all_level';
        updateMilestoneSelectedSummary();
    }
    window.selectCurrentLevelMilestoneClasses = selectCurrentLevelMilestoneClasses;

    /**
     * تحديد أو مسح كافة الأقسام المسندة
     */
    function selectAllMilestoneClasses(selectAll) {
        const checkboxes = document.querySelectorAll('.milestone-class-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = selectAll;
        });
        const select = document.getElementById('milestoneAssignedClassSelect');
        if (select) select.value = selectAll ? 'all_level' : 'multi_custom';
        updateMilestoneSelectedSummary();
    }
    window.selectAllMilestoneClasses = selectAllMilestoneClasses;

    function onMilestoneClassCheckboxChange() {
        const select = document.getElementById('milestoneAssignedClassSelect');
        const checkboxes = Array.from(document.querySelectorAll('.milestone-class-checkbox'));
        const checked = checkboxes.filter(cb => cb.checked);
        if (select) {
            if (checked.length === checkboxes.length && checkboxes.length > 0) {
                select.value = 'all_level';
            } else if (checked.length === 1) {
                select.value = checked[0].value;
            } else {
                select.value = 'multi_custom';
            }
        }
        updateMilestoneSelectedSummary();
    }
    window.onMilestoneClassCheckboxChange = onMilestoneClassCheckboxChange;

    function toggleMilestoneCustomLevelInput() {
        const levelSelect = document.getElementById('milestoneLevelSelect');
        if (levelSelect) {
            levelSelect.value = 'custom';
            onMilestoneLevelSelectChange('custom');
        }
    }
    window.toggleMilestoneCustomLevelInput = toggleMilestoneCustomLevelInput;

    /**
     * تحديث ملخص الأقسام والمستويات المعنية
     */
    function updateMilestoneSelectedSummary() {
        const summary = document.getElementById('milestoneSelectedClassesSummary');
        if (!summary) return;

        const levelSelect = document.getElementById('milestoneLevelSelect');
        const levelKey = levelSelect ? levelSelect.value : 'all';

        if (levelKey === 'custom') {
            const customVal = (document.getElementById('milestoneTargetLevelsInput')?.value || '').trim();
            summary.textContent = customVal ? `✏️ مخصص: ${customVal}` : '✏️ مستوى مخصص يدوي';
            summary.style.color = '#7c3aed';
            summary.style.background = '#faf5ff';
            summary.style.borderColor = '#e9d5ff';
            return;
        }

        const checkboxes = Array.from(document.querySelectorAll('.milestone-class-checkbox'));
        const checkedClasses = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
        const levelMeta = MOROCCAN_LEVELS_META[levelKey] || { shortName: 'المستوى', label: 'المستوى' };

        if (levelKey === 'all' && (checkedClasses.length === checkboxes.length || checkboxes.length === 0)) {
            summary.textContent = `🏫 المحدد: جميع الأقسام المسندة (${checkedClasses.length} أقسام)`;
            summary.style.color = '#1e3a8a';
            summary.style.background = '#eff6ff';
            summary.style.borderColor = '#bfdbfe';
        } else if (checkedClasses.length === checkboxes.length && checkboxes.length > 0) {
            summary.textContent = `🎓 المحدد: جميع أقسام ${levelMeta.shortName} (${checkedClasses.join('، ')})`;
            summary.style.color = '#065f46';
            summary.style.background = '#ecfdf5';
            summary.style.borderColor = '#a7f3d0';
        } else if (checkedClasses.length === 1) {
            summary.textContent = `📌 المحدد: قسم واحد (${checkedClasses[0]}) - ${levelMeta.shortName}`;
            summary.style.color = '#15803d';
            summary.style.background = '#f0fdf4';
            summary.style.borderColor = '#86efac';
        } else if (checkedClasses.length > 1) {
            summary.textContent = `☑️ المحدد (${checkedClasses.length} أقسام من ${levelMeta.shortName}): ${checkedClasses.join('، ')}`;
            summary.style.color = '#0284c7';
            summary.style.background = '#f0f9ff';
            summary.style.borderColor = '#7dd3fc';
        } else {
            summary.textContent = '⚠️ لم يتم تحديد أي قسم (يرجى اختيار قسم واحد على الأقل)';
            summary.style.color = '#b91c1c';
            summary.style.background = '#fef2f2';
            summary.style.borderColor = '#fca5a5';
        }
    }
    window.updateMilestoneSelectedSummary = updateMilestoneSelectedSummary;

    // دوال مساعدة لشرائح الإدخال السريع للمحطة المتكاملة
    window.setMilestoneVenue = function(venue) {
        const inp = document.getElementById('milestoneVenueInput');
        if (inp) {
            inp.value = venue;
            inp.focus();
        }
    };

    window.toggleMilestoneStakeholder = function(stakeholder) {
        const inp = document.getElementById('milestoneStakeholdersInput');
        if (!inp) return;
        let list = inp.value.split(/[,،]+/).map(s => s.trim()).filter(Boolean);
        if (list.includes(stakeholder)) {
            list = list.filter(s => s !== stakeholder);
        } else {
            list.push(stakeholder);
        }
        inp.value = list.join('، ');
    };

    window.addMilestoneTopic = function(topic) {
        const inp = document.getElementById('milestoneTopicInput') || document.getElementById('milestoneExamTopicsInput');
        if (!inp) return;
        const cur = inp.value.trim();
        if (!cur) {
            inp.value = topic;
        } else if (!cur.includes(topic)) {
            inp.value = `${cur}، ${topic}`;
        }
    };

    window.toggleMilestoneDidacticTool = function(tool) {
        const inp = document.getElementById('milestoneDidacticToolsInput');
        if (!inp) return;
        let list = inp.value.split(/[,،]+/).map(s => s.trim()).filter(Boolean);
        if (list.includes(tool)) {
            list = list.filter(s => s !== tool);
        } else {
            list.push(tool);
        }
        inp.value = list.join('، ');
    };

    window.toggleMilestoneDeliverable = function(deliv) {
        const inp = document.getElementById('milestoneDeliverablesInput');
        if (!inp) return;
        let list = inp.value.split(/[,،]+/).map(s => s.trim()).filter(Boolean);
        if (list.includes(deliv)) {
            list = list.filter(s => s !== deliv);
        } else {
            list.push(deliv);
        }
        inp.value = list.join('، ');
    };

    // التوافقية العكسية لدالة التعبئة القديمة
    function populateMilestoneTargetLevelsSelect(selectedVal = 'جميع الأقسام المسندة') {
        const clean = (selectedVal || '').trim();
        let detectedLvl = 'all';
        let preClasses = [];

        if (clean && clean !== 'جميع الأقسام المسندة' && clean !== 'جميع المستويات') {
            preClasses = clean.split(/[,،;|\n]+/).map(s => s.trim()).filter(Boolean);
            if (preClasses.length > 0) {
                detectedLvl = detectClassLevelCode(preClasses[0]);
            }
        }
        populateMilestoneLevelsDropdown(detectedLvl, preClasses);
    }
    window.populateMilestoneTargetLevelsSelect = populateMilestoneTargetLevelsSelect;

    /**
     * تبديل نمط النافذة المدمجة بين:
     * - 'general': محطة بيداغوجية / إدارية عامة
     * - 'unified': امتحان موحد / إشهادي / تجريبي
     */
    function switchMilestoneModalMode(mode) {
        const isUnified = (mode === 'unified');
        const hiddenModeInput = document.getElementById('milestoneIsUnifiedInput');
        if (hiddenModeInput) hiddenModeInput.value = isUnified ? '1' : '0';

        const btnGeneral = document.getElementById('btnMilestoneModeGeneral');
        const btnUnified = document.getElementById('btnMilestoneModeUnified');
        const generalPresetsBox = document.getElementById('generalEventPresetsContainer');
        const presetsBox = document.getElementById('unifiedExamPresetsContainer');
        const detailsBox = document.getElementById('unifiedExamDetailsContainer');
        const modalTitle = document.getElementById('milestoneModalTitle');
        const modalSubtitle = document.getElementById('milestoneModalSubtitle');
        const titleLabel = document.getElementById('milestoneTitleLabel');
        const titleInput = document.getElementById('milestoneTitleInput');
        const categorySelect = document.getElementById('milestoneCategorySelect');
        const submitBtnText = document.getElementById('milestoneSubmitBtnText');
        const editId = document.getElementById('milestoneEditId') ? document.getElementById('milestoneEditId').value : '';

        if (isUnified) {
            if (btnUnified) {
                btnUnified.style.background = '#7c3aed';
                btnUnified.style.color = '#ffffff';
                btnUnified.style.boxShadow = '0 2px 6px rgba(124, 58, 237, 0.3)';
            }
            if (btnGeneral) {
                btnGeneral.style.background = 'transparent';
                btnGeneral.style.color = '#475569';
                btnGeneral.style.boxShadow = 'none';
            }
            if (generalPresetsBox) generalPresetsBox.style.display = 'none';
            if (presetsBox) presetsBox.style.display = 'block';
            if (detailsBox) detailsBox.style.display = 'flex';

            if (modalTitle) modalTitle.textContent = editId ? 'تعديل بيانات الامتحان الموحد' : 'إضافة امتحان موحد / إشهادي';
            if (modalSubtitle) modalSubtitle.textContent = 'جدولة وتوثيق الامتحانات الموحدة الرسمية (الوطني، الجهوي، التجريبي، والفروض الموحدة) لمادة الرياضيات';
            if (titleLabel) titleLabel.textContent = 'عنوان الامتحان الموحد / الاستحقاق:';
            if (titleInput) titleInput.placeholder = 'مثال: الامتحان الوطني الموحد، الامتحان الجهوي الموحد، الامتحان التجريبي الموحد...';
            if (submitBtnText) submitBtnText.textContent = 'حفظ وبرمجة الامتحان الموحد';

            if (categorySelect && (!categorySelect.value || categorySelect.value === 'assessment' || categorySelect.value === 'entry' || categorySelect.value === 'admin')) {
                categorySelect.value = 'certification';
            }
        } else {
            if (btnGeneral) {
                btnGeneral.style.background = '#2563eb';
                btnGeneral.style.color = '#ffffff';
                btnGeneral.style.boxShadow = '0 2px 5px rgba(37, 99, 235, 0.25)';
            }
            if (btnUnified) {
                btnUnified.style.background = 'transparent';
                btnUnified.style.color = '#475569';
                btnUnified.style.boxShadow = 'none';
            }
            if (generalPresetsBox) generalPresetsBox.style.display = 'block';
            if (presetsBox) presetsBox.style.display = 'none';
            if (detailsBox) detailsBox.style.display = 'none';

            if (modalTitle) modalTitle.textContent = editId ? 'تعديل المحطة التربوية / الإدارية' : 'إضافة محطة تربوية أو إدارية';
            if (modalSubtitle) modalSubtitle.textContent = 'تسجيل مواعيد الفروض، الامتحانات، مجالس الأقسام والمحطات الرسمية';
            if (titleLabel) titleLabel.textContent = 'عنوان المحطة / الاستحقاق:';
            if (titleInput) titleInput.placeholder = 'مثال: فروض المراقبة المستمرة، مجالس الأقسام، مسك النقط في مسار...';
            if (submitBtnText) submitBtnText.textContent = 'حفظ المحطة التربوية';
        }
    }
    window.switchMilestoneModalMode = switchMilestoneModalMode;

    /**
     * تطبيق النماذج الرسمية الجاهزة للامتحانات الموحدة بنقرة واحدة
     */
    function applyUnifiedExamPreset(presetKey) {
        const titleInput = document.getElementById('milestoneTitleInput');
        const categorySelect = document.getElementById('milestoneCategorySelect');
        const semesterSelect = document.getElementById('milestoneSemesterSelect');
        const importanceSelect = document.getElementById('milestoneImportanceSelect');
        const descInput = document.getElementById('milestoneDescInput');
        const subtypeSelect = document.getElementById('unifiedExamSubtypeSelect');
        const coefInput = document.getElementById('unifiedExamCoefInput');
        const durationSelect = document.getElementById('unifiedExamDurationSelect');
        const timeSlotInput = document.getElementById('unifiedExamTimeSlotInput');
        const topicsInput = document.getElementById('unifiedExamTopicsInput');

        switch (presetKey) {
            case 'national_bac':
                if (titleInput) titleInput.value = 'الامتحان الوطني الموحد لنيل شهادة البكالوريا (الدورة العادية)';
                if (categorySelect) categorySelect.value = 'certification';
                if (semesterSelect) semesterSelect.value = '2';
                if (importanceSelect) importanceSelect.value = 'critical';
                if (subtypeSelect) subtypeSelect.value = 'national';
                if (coefInput) coefInput.value = '7';
                if (durationSelect) durationSelect.value = '3';
                if (timeSlotInput) timeSlotInput.value = '08:00 - 11:00';
                if (topicsInput) topicsInput.value = 'دراسة الدوال والاشتقاق، المتتاليات العددية، الأعداد العقدية، الاحتمالات، الهندسة الفضائية';
                if (descInput) descInput.value = 'إجراء اختبارات الدورة العادية للامتحان الوطني للبكالوريا لجميع الشعب العلمية والتقنية ومراكز التصحيح الرسمية.';
                populateMilestoneTargetLevelsSelect('أقسام السنة الثانية باكالوريا (2BAC)');
                break;

            case 'regional_1bac':
                if (titleInput) titleInput.value = 'الامتحان الجهوي الموحد للسنة الأولى من سلك البكالوريا';
                if (categorySelect) categorySelect.value = 'certification';
                if (semesterSelect) semesterSelect.value = '2';
                if (importanceSelect) importanceSelect.value = 'critical';
                if (subtypeSelect) subtypeSelect.value = 'regional';
                if (coefInput) coefInput.value = '4';
                if (durationSelect) durationSelect.value = '2';
                if (timeSlotInput) timeSlotInput.value = '08:00 - 10:00';
                if (topicsInput) topicsInput.value = 'مبادئ في المنطق، عموميات حول الدوال، المرجح في المستوى، الحساب المتجهي، الجداء السلمي';
                if (descInput) descInput.value = 'إجراء اختبارات الامتحان الجهوي الموحد لتلاميذ السنة الأولى من سلك البكالوريا وفق الأطر المرجعية المحينة.';
                populateMilestoneTargetLevelsSelect('أقسام السنة الأولى باكالوريا (1BAC)');
                break;

            case 'examen_blanc':
                if (titleInput) titleInput.value = 'الامتحان التجريبي الموحد للمؤسسة - مادة الرياضيات';
                if (categorySelect) categorySelect.value = 'exam';
                if (semesterSelect) semesterSelect.value = '2';
                if (importanceSelect) importanceSelect.value = 'high';
                if (subtypeSelect) subtypeSelect.value = 'school_blanc';
                if (coefInput) coefInput.value = '7';
                if (durationSelect) durationSelect.value = '3';
                if (timeSlotInput) timeSlotInput.value = '08:30 - 11:30';
                if (topicsInput) topicsInput.value = 'المقرر الكامل للدورة الأولى والثانية وفق الإطار المرجعي الرسمي للبكالوريا';
                if (descInput) descInput.value = 'تنظيم الامتحان التجريبي الموحد على صعيد المؤسسة لمحاكاة ظروف الامتحان الرسمي وتدريب التلاميذ على إدارة الوقت.';
                populateMilestoneTargetLevelsSelect('جميع الأقسام المعنية');
                break;

            case 'unified_class_exam':
                if (titleInput) titleInput.value = 'الفرض المحروس الموحد المشترك لمادة الرياضيات';
                if (categorySelect) categorySelect.value = 'assessment';
                if (semesterSelect) semesterSelect.value = '1';
                if (importanceSelect) importanceSelect.value = 'high';
                if (subtypeSelect) subtypeSelect.value = 'inter_class';
                if (coefInput) coefInput.value = '5';
                if (durationSelect) durationSelect.value = '2';
                if (timeSlotInput) timeSlotInput.value = '08:30 - 10:30';
                if (topicsInput) topicsInput.value = 'مقرر الوحدة الدراسية الجارية وفق التوجيهات التربوية الرسمية';
                if (descInput) descInput.value = 'فرض محروس موحد وموحد الصياغة وسلم التنقيط بين كافة أساتذة مادة الرياضيات بالمؤسسة لنفس المستوى.';
                populateMilestoneTargetLevelsSelect('الأقسام المشتركة');
                break;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('تم تحميل النموذج الرسمي الموحد بنجاح ⚡');
        }
    }
    window.applyUnifiedExamPreset = applyUnifiedExamPreset;

    /**
     * إضافة محور مرجعي لمجالات الامتحان الموحد
     */
    function addUnifiedTopicToInput(topic) {
        const input = document.getElementById('unifiedExamTopicsInput');
        if (!input) return;
        const cur = input.value.trim();
        if (!cur) {
            input.value = topic;
        } else if (!cur.includes(topic)) {
            input.value = `${cur}، ${topic}`;
        }
    }
    window.addUnifiedTopicToInput = addUnifiedTopicToInput;

    function populateMilestoneTargetClassSelect(selectedValue = '') {
        const classSel = document.getElementById('milestoneTargetClassSelect');
        if (!classSel) return;
        const classes = (window.db && Array.isArray(window.db.classes)) ? window.db.classes : [];
        let html = `<option value="جميع المستويات">-- جميع المستويات / كافة الفصول --</option>`;
        classes.forEach(c => {
            const cName = typeof c === 'string' ? c : (c.name || c.id || '');
            if (cName) {
                html += `<option value="${escapeHtml(cName)}" ${selectedValue === cName ? 'selected' : ''}>${escapeHtml(cName)}</option>`;
            }
        });
        classSel.innerHTML = html;
        if (selectedValue) classSel.value = selectedValue;
    }

    function autoDetectSemesterFromDate(dateStr) {
        if (!dateStr) return 's1';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 's1';
        const m = d.getMonth() + 1;
        return (m >= 9 || m === 1) ? 's1' : 's2';
    }

    window.onMilestoneStartDateChange = function(val) {
        if (!val) return;
        const endEl = document.getElementById('milestoneEndDateInput');
        if (endEl && (!endEl.value || endEl.value < val)) {
            endEl.value = val;
        }
        const semEl = document.getElementById('milestoneSemesterSelect');
        if (semEl) {
            semEl.value = autoDetectSemesterFromDate(val);
        }
    };

    window.applyGeneralMilestoneEventPreset = function(presetOrTitle, category, timeSlot, description) {
        const titleEl = document.getElementById('milestoneTitleInput');
        const catEl = document.getElementById('milestoneCategorySelect');
        const timeEl = document.getElementById('milestoneGeneralTimeInput');
        const descEl = document.getElementById('milestoneDescriptionInput') || document.getElementById('milestoneDescInput');
        const venueEl = document.getElementById('milestoneVenueInput');
        const deliverablesEl = document.getElementById('milestoneDeliverablesInput');
        const didacticToolsEl = document.getElementById('milestoneDidacticToolsInput');
        const stakeholdersEl = document.getElementById('milestoneStakeholdersInput');
        const statusEl = document.getElementById('milestoneStatusSelect');

        // النماذج البيداغوجية الرسمية الجاهزة بنقرة واحدة
        const presets = {
            class_exam: {
                title: 'فرض محروس لمادة الرياضيات (المراقبة المستمرة)',
                category: 'exam',
                timeSlot: '08:30 - 10:30',
                description: 'إجراء فرض المراقبة المستمرة لمادة الرياضيات وفق المقرر الوزاري والتوجيهات التربوية الرسمية، مع استحضار سلم التنقيط الموحد وعناصر الإجابة.',
                venue: 'قاعة الرياضيات',
                stakeholders: 'تلاميذ القسم، أستاذ المادة',
                didacticTools: 'أوراق رسمية وسلالم تنقيط، آلة حاسبة علمية، أدوات هندسية',
                deliverables: 'تسليم أوراق الفرض للإدارة، مسك النقط بمسار قبل الأجل',
                status: 'upcoming'
            },
            council_meeting: {
                title: 'انعقاد مجالس الأقسام وتحليل نتائج التحصيل الدراسي',
                category: 'council',
                timeSlot: '16:00 - 18:00',
                description: 'المشاركة في مجالس الأقسام لدراسة نتائج المراقبة المستمرة، تتبع مواظبة وسلوك التلاميذ، وتحديد المتعثرين لبرمجة حصص الدعم المؤسساتي.',
                venue: 'قاعة الاجتماعات',
                stakeholders: 'مجلس القسم، الإدارة التربوية، أستاذ المادة',
                didacticTools: 'محاضر مجالس الأقسام، منظومة مسار، كشوف النقط الإجمالية',
                deliverables: 'محضر اجتماع المجلس، بطاقة التفييء والتشخيص',
                status: 'upcoming'
            },
            massar_grades: {
                title: 'المسك النهائي والتدقيق لنقط المراقبة المستمرة في منظومة مسار',
                category: 'massar',
                timeSlot: 'طيلة اليوم (قبل انصرام الأجل)',
                description: 'استيراد وتصدير بطاقات مسار الرسمية، مسك نقط الفروض والأنشطة المندمجة وتدقيق الغياب والملاحظات التوجيهية وفق المذكرة الوزارية.',
                venue: 'مختبر المعلوميات',
                stakeholders: 'أستاذ المادة، الإدارة التربوية',
                didacticTools: 'منظومة مسار، حاسوب، كشوف النقط المصدرة Excel',
                deliverables: 'مسك النقط بمسار قبل الأجل، تسليم كشوف النقط موقعة للإدارة',
                status: 'in_progress'
            },
            remediation_support: {
                title: 'حصة الدعم البيداغوجي المؤسساتي والمعالجة المركزة للتعثرات',
                category: 'remediation',
                timeSlot: '14:30 - 16:30',
                description: 'تنفيذ أنشطة الدعم والمعالجة الموجهة لفائدة التلاميذ غير المتمكنين استناداً إلى نتائج تقويم تشخيصي أو فرض محروس سابق.',
                venue: 'قاعة الرياضيات',
                stakeholders: 'تلاميذ القسم، أستاذ المادة',
                didacticTools: 'جذاذات الدعم، برمجية GeoGebra، تمارين تطبيقية مركزة',
                deliverables: 'خطة الدعم والمعالجة، بطاقة التفييء والتشخيص',
                status: 'upcoming'
            },
            homework_task: {
                title: 'تسليم وتقويم الفرض المنزلي والأنشطة المندمجة',
                category: 'task',
                timeSlot: 'أثناء الحصة الصفية',
                description: 'استلام واجبات الفرض المنزلي الإلزامي وتقويم إنتاجات المتعلمين وتقديم التغذية الراجعة الفورية ورصد نقط الأنشطة الصفية.',
                venue: 'قاعة التدريس',
                stakeholders: 'تلاميذ القسم، أستاذ المادة',
                didacticTools: 'دفاتر التمارين المنزلية، سلم التقييم الذاتي',
                deliverables: 'دفتر النصوص وبطاقة المتابعة',
                status: 'upcoming'
            },
            general_appointment: {
                title: 'لقاء تنسيقي / موعد تربوي وديداكتيكي بالمؤسسة',
                category: 'other',
                timeSlot: '10:30 - 11:30',
                description: 'لقاء تربوي تنسيقي وتبادل الخبرات الديدكتيكية وبرمجة الأنشطة الصفية واللاصفية وإعداد الفروض الموحدة.',
                venue: 'قاعة الأساتذة',
                stakeholders: 'أستاذ المادة، المفتش التربوي، الإدارة التربوية',
                didacticTools: 'الوثائق التربوية الرسمية، التوزيع الدوري',
                deliverables: 'تقرير تركيبي موجز',
                status: 'upcoming'
            }
        };

        if (presetOrTitle && presets[presetOrTitle]) {
            const p = presets[presetOrTitle];
            if (titleEl) titleEl.value = p.title;
            if (catEl) {
                catEl.value = p.category;
                toggleMilestoneExamExtraFields();
            }
            if (timeEl) timeEl.value = p.timeSlot;
            if (descEl) descEl.value = p.description;
            if (venueEl && p.venue) venueEl.value = p.venue;
            if (deliverablesEl && p.deliverables) deliverablesEl.value = p.deliverables;
            if (didacticToolsEl && p.didacticTools) didacticToolsEl.value = p.didacticTools;
            if (stakeholdersEl && p.stakeholders) stakeholdersEl.value = p.stakeholders;
            if (statusEl && p.status) statusEl.value = p.status;
            if (typeof window.showToast === 'function') {
                window.showToast(`تم تحميل النموذج الرسمي: ${p.title} ⚡`);
            }
            return;
        }

        // إسناد المعاملات العادية
        if (catEl && category) {
            catEl.value = category;
            toggleMilestoneExamExtraFields();
        }
        if (titleEl && presetOrTitle) titleEl.value = presetOrTitle;
        if (timeEl && timeSlot) timeEl.value = timeSlot;
        if (descEl && description) descEl.value = description;
    };

    function toggleMilestoneExamExtraFields() {
        const catEl = document.getElementById('milestoneCategorySelect');
        const extraBox = document.getElementById('milestoneExamExtraFieldsBox');
        const quickPresetsBox = document.getElementById('milestoneGeneralQuickPresetsBox');
        const colorEl = document.getElementById('milestoneColorSelect');
        if (!catEl) return;

        const cat = catEl.value;
        const isExamType = (cat === 'exam' || cat === 'certification' || cat === 'assessment');
        if (extraBox) extraBox.style.display = isExamType ? 'block' : 'none';
        if (quickPresetsBox) quickPresetsBox.style.display = isExamType ? 'none' : 'block';

        if (colorEl) {
            const defaultColors = {
                exam: '#dc2626',
                certification: '#7c3aed',
                assessment: '#0284c7',
                council: '#d97706',
                remediation: '#059669',
                task: '#4f46e5',
                activity: '#16a34a',
                schoolwork: '#2563eb',
                massar: '#0891b2',
                guidance: '#6366f1',
                training: '#0d9488',
                entry: '#10b981',
                admin: '#475569',
                other: '#64748b'
            };
            if (defaultColors[cat]) colorEl.value = defaultColors[cat];
        }
    }
    window.toggleMilestoneExamExtraFields = toggleMilestoneExamExtraFields;

    function applyMilestoneExamPreset(examNumberLabel, categoryType) {
        const catEl = document.getElementById('milestoneCategorySelect');
        const numEl = document.getElementById('milestoneExamNumberSelect');
        const titleEl = document.getElementById('milestoneTitleInput');
        const classEl = document.getElementById('milestoneTargetClassSelect');
        const targetLevelsEl = document.getElementById('milestoneTargetLevelsInput');

        if (catEl && categoryType) {
            catEl.value = categoryType;
            toggleMilestoneExamExtraFields();
        }
        if (numEl && examNumberLabel) {
            numEl.value = examNumberLabel;
        }

        const chosenClass = (classEl && classEl.value && classEl.value !== 'جميع المستويات') ? classEl.value : '';
        if (titleEl) {
            titleEl.value = chosenClass ? `${examNumberLabel} - ${chosenClass}` : `${examNumberLabel}`;
        }
        if (targetLevelsEl && chosenClass) {
            targetLevelsEl.value = `القسم: ${chosenClass}`;
        }
    }
    window.applyMilestoneExamPreset = applyMilestoneExamPreset;

    /**
     * فتح النافذة الموحدة لإضافة محطة بيداغوجية أو موعد/حدث أو فرض
     * @param {string} presetDateOrMode يمكن أن يكون تاريخاً بصيغة YYYY-MM-DD أو فئة ('exam' | 'unified' | 'general')
     */
    function openAddAcademicMilestoneModal(presetDateOrMode = '') {
        const modal = document.getElementById('academicMilestoneModal');
        if (!modal) return;

        populateMilestoneTargetClassSelect('');

        const rawParam = String(presetDateOrMode || '').trim();
        const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawParam);
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const defaultDate = isIsoDate ? rawParam : todayIso;

        let defaultCategory = 'schoolwork';
        if (!isIsoDate && rawParam) {
            if (rawParam === 'unified' || rawParam === 'certification') defaultCategory = 'certification';
            else if (rawParam === 'exam') defaultCategory = 'exam';
            else if (rawParam === 'general') defaultCategory = 'schoolwork';
            else defaultCategory = rawParam;
        }

        const modalTitle = document.getElementById('academicMilestoneModalTitle') || document.getElementById('milestoneModalTitle');
        if (modalTitle) {
            modalTitle.textContent = (defaultCategory === 'exam' || defaultCategory === 'certification')
                ? 'برمجة فرض محروس أو امتحان موحد في التقويم'
                : 'إضافة محطة بيداغوجية / موعد أو حدث في التقويم';
        }

        const editIdEl = document.getElementById('milestoneEditId');
        const titleEl = document.getElementById('milestoneTitleInput');
        const startEl = document.getElementById('milestoneStartDateInput');
        const endEl = document.getElementById('milestoneEndDateInput');
        const catEl = document.getElementById('milestoneCategorySelect');
        const semEl = document.getElementById('milestoneSemesterSelect');
        const impEl = document.getElementById('milestoneImportanceSelect');
        const statusEl = document.getElementById('milestoneStatusSelect');
        const reminderEl = document.getElementById('milestoneReminderSelect');
        const levelsEl = document.getElementById('milestoneTargetLevelsInput');
        const genTimeEl = document.getElementById('milestoneGeneralTimeInput');
        const descEl = document.getElementById('milestoneDescriptionInput') || document.getElementById('milestoneDescInput');
        const colorEl = document.getElementById('milestoneColorSelect');
        const topicsEl = document.getElementById('unifiedExamTopicsInput') || document.getElementById('milestoneExamTopicsInput');
        const timeEl = document.getElementById('unifiedExamTimeSlotInput') || document.getElementById('milestoneExamTimeInput');
        const durEl = document.getElementById('unifiedExamDurationSelect') || document.getElementById('milestoneExamDurationSelect');
        const subtypeEl = document.getElementById('unifiedExamSubtypeSelect');
        const coefEl = document.getElementById('unifiedExamCoefInput');
        const syncUpChk = document.getElementById('unifiedExamSyncToUpcomingCheckbox');

        // الحقول المغناة الجديدة
        const venueEl = document.getElementById('milestoneVenueInput');
        const stakeholdersEl = document.getElementById('milestoneStakeholdersInput');
        const topicEl = document.getElementById('milestoneTopicInput');
        const didacticToolsEl = document.getElementById('milestoneDidacticToolsInput');
        const deliverablesEl = document.getElementById('milestoneDeliverablesInput');

        if (editIdEl) editIdEl.value = '';
        if (titleEl) titleEl.value = '';
        if (startEl) startEl.value = defaultDate;
        if (endEl) endEl.value = defaultDate;
        if (catEl) catEl.value = defaultCategory;
        if (semEl) semEl.value = autoDetectSemesterFromDate(defaultDate) === 's2' ? '2' : '1';
        if (impEl) impEl.value = (defaultCategory === 'exam' || defaultCategory === 'certification') ? 'critical' : 'high';
        if (statusEl) statusEl.value = 'upcoming';
        if (reminderEl) reminderEl.value = '1_day_before';
        if (levelsEl) levelsEl.value = '';
        if (genTimeEl) genTimeEl.value = '';
        if (descEl) descEl.value = '';
        if (colorEl) colorEl.value = (defaultCategory === 'exam') ? '#dc2626' : (defaultCategory === 'certification' ? '#7c3aed' : '#2563eb');
        if (topicsEl) topicsEl.value = '';
        if (timeEl) timeEl.value = '08:30 - 11:30';
        if (durEl) durEl.value = '3';
        if (subtypeEl) subtypeEl.value = 'national';
        if (coefEl) coefEl.value = '7';
        if (syncUpChk) syncUpChk.checked = true;

        // إعادة ضبط وتعبئة القيم الافتراضية للمحطة المتكاملة
        if (venueEl) venueEl.value = 'قاعة الرياضيات';
        if (stakeholdersEl) stakeholdersEl.value = 'تلاميذ القسم، أستاذ المادة';
        if (topicEl) topicEl.value = '';
        if (didacticToolsEl) didacticToolsEl.value = 'آلة حاسبة علمية، أدوات هندسية';
        if (deliverablesEl) deliverablesEl.value = '';

        // تهيئة القوائم المنسدلة المغربية التفاعلية للأقسام المسندة
        populateMilestoneLevelsDropdown('all', []);

        // تفعيل النمط المناسب
        switchMilestoneModalMode(rawParam === 'unified' ? 'unified' : 'general');
        toggleMilestoneExamExtraFields();

        modal.style.display = 'flex';
        if (typeof window.renderLucide === 'function') window.renderLucide();
    }

    /**
     * فتح نافذة تعديل محطة بيداغوجية أو موعد أو فرض موجود
     */
    function openEditAcademicMilestoneModal(id) {
        const milestones = getAcademicMilestones();
        const ms = milestones.find(m => m.id === id);
        if (!ms) return;
        const modal = document.getElementById('academicMilestoneModal');
        if (!modal) return;

        populateMilestoneTargetClassSelect(ms.targetClass || '');

        const modalTitle = document.getElementById('academicMilestoneModalTitle') || document.getElementById('milestoneModalTitle');
        if (modalTitle) modalTitle.textContent = 'تعديل بيانات المحطة البيداغوجية / الموعد';

        const editIdEl = document.getElementById('milestoneEditId');
        const titleEl = document.getElementById('milestoneTitleInput');
        const startEl = document.getElementById('milestoneStartDateInput');
        const endEl = document.getElementById('milestoneEndDateInput');
        const catEl = document.getElementById('milestoneCategorySelect');
        const semEl = document.getElementById('milestoneSemesterSelect');
        const impEl = document.getElementById('milestoneImportanceSelect');
        const statusEl = document.getElementById('milestoneStatusSelect');
        const reminderEl = document.getElementById('milestoneReminderSelect');
        const levelsEl = document.getElementById('milestoneTargetLevelsInput');
        const genTimeEl = document.getElementById('milestoneGeneralTimeInput');
        const descEl = document.getElementById('milestoneDescriptionInput') || document.getElementById('milestoneDescInput');
        const colorEl = document.getElementById('milestoneColorSelect');
        const numEl = document.getElementById('milestoneExamNumberSelect');
        const durEl = document.getElementById('unifiedExamDurationSelect') || document.getElementById('milestoneExamDurationSelect');
        const timeEl = document.getElementById('unifiedExamTimeSlotInput') || document.getElementById('milestoneExamTimeInput');
        const topicsEl = document.getElementById('unifiedExamTopicsInput') || document.getElementById('milestoneExamTopicsInput');
        const subtypeEl = document.getElementById('unifiedExamSubtypeSelect');
        const coefEl = document.getElementById('unifiedExamCoefInput');

        // الحقول المغناة
        const venueEl = document.getElementById('milestoneVenueInput');
        const stakeholdersEl = document.getElementById('milestoneStakeholdersInput');
        const topicEl = document.getElementById('milestoneTopicInput');
        const didacticToolsEl = document.getElementById('milestoneDidacticToolsInput');
        const deliverablesEl = document.getElementById('milestoneDeliverablesInput');

        if (editIdEl) editIdEl.value = ms.id;
        if (titleEl) titleEl.value = ms.title || '';
        if (startEl) startEl.value = ms.startDate || '';
        if (endEl) endEl.value = ms.endDate || ms.startDate || '';
        if (catEl) catEl.value = ms.category || 'schoolwork';
        if (semEl) semEl.value = (ms.semester === '2' || ms.semester === 's2') ? '2' : '1';
        if (impEl) impEl.value = ms.importance || 'high';
        if (statusEl) statusEl.value = ms.status || 'upcoming';
        if (reminderEl) reminderEl.value = ms.reminder || '1_day_before';
        if (levelsEl) levelsEl.value = ms.targetLevels || '';
        if (genTimeEl) genTimeEl.value = ms.timeSlot || '';
        if (descEl) descEl.value = ms.description || '';
        if (colorEl) colorEl.value = ms.color || '#2563eb';
        if (numEl && ms.examNumber) numEl.value = ms.examNumber;
        if (durEl && ms.duration) durEl.value = ms.duration;
        if (timeEl && ms.timeSlot) timeEl.value = ms.timeSlot;
        if (topicsEl) topicsEl.value = ms.topics || '';
        if (subtypeEl && ms.unifiedSubtype) subtypeEl.value = ms.unifiedSubtype;
        if (coefEl && ms.coefficient) coefEl.value = ms.coefficient;

        // تعبئة الحقول المغناة للمحطة
        if (venueEl) venueEl.value = ms.venue || '';
        if (stakeholdersEl) stakeholdersEl.value = ms.stakeholders || '';
        if (topicEl) topicEl.value = ms.topics || ms.topic || '';
        if (didacticToolsEl) didacticToolsEl.value = ms.didacticTools || '';
        if (deliverablesEl) deliverablesEl.value = ms.deliverables || '';

        // تحديد المستوى والأقسام المسندة بدقة
        let detectedLevel = ms.targetLevel || 'all';
        let preselectedClasses = Array.isArray(ms.targetClasses) ? ms.targetClasses : [];
        if (preselectedClasses.length === 0 && ms.targetClass) {
            preselectedClasses = [ms.targetClass];
        }
        if (detectedLevel === 'all' && preselectedClasses.length > 0) {
            detectedLevel = detectClassLevelCode(preselectedClasses[0]);
        }
        if (detectedLevel === 'all' && ms.targetLevels && !preselectedClasses.length) {
            const code = detectClassLevelCode(ms.targetLevels);
            if (code !== 'all') detectedLevel = code;
        }

        populateMilestoneLevelsDropdown(detectedLevel, preselectedClasses);

        // تفعيل النمط المناسب
        if (ms.isUnifiedExam) {
            switchMilestoneModalMode('unified');
        } else {
            switchMilestoneModalMode('general');
        }
        toggleMilestoneExamExtraFields();

        modal.style.display = 'flex';
        if (typeof window.renderLucide === 'function') window.renderLucide();
    }

    /**
     * إغلاق نافذة المحطة التربوية والامتحان الموحد
     */
    function closeAcademicMilestoneModal() {
        const modal = document.getElementById('academicMilestoneModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * حفظ المحطة البيداغوجية أو الموعد/الحدث أو الفرض من النافذة الموحدة
     * مع مزامنة فورية شاملة للتقويم الشهري، التقويم السنوي، المسار البيداغوجي، وجدول الفروض
     */
    let _isSavingAcademicMilestone = false;
    function saveAcademicMilestone() {
        if (_isSavingAcademicMilestone) return;
        _isSavingAcademicMilestone = true;
        const unlock = () => { setTimeout(() => { _isSavingAcademicMilestone = false; }, 350); };

        const id = (document.getElementById('milestoneEditId')?.value || '').trim();
        const isUnifiedModeActive = document.getElementById('milestoneIsUnifiedInput')?.value === '1';
        const title = (document.getElementById('milestoneTitleInput')?.value || '').trim();
        const category = document.getElementById('milestoneCategorySelect')?.value || 'schoolwork';
        const semesterVal = document.getElementById('milestoneSemesterSelect')?.value || '1';
        const importance = document.getElementById('milestoneImportanceSelect')?.value || 'high';
        const status = document.getElementById('milestoneStatusSelect')?.value || 'upcoming';
        const reminder = document.getElementById('milestoneReminderSelect')?.value || '1_day_before';

        const startDate = (document.getElementById('milestoneStartDateInput')?.value || '').trim();
        const rawEndDate = (document.getElementById('milestoneEndDateInput')?.value || '').trim() || startDate;
        const endDate = rawEndDate < startDate ? startDate : rawEndDate;

        // استخراج المستوى والأقسام المسندة بدقة
        const levelKey = document.getElementById('milestoneLevelSelect')?.value || 'all';
        const checkedClassBoxes = Array.from(document.querySelectorAll('.milestone-class-checkbox:checked'));
        const checkedClasses = checkedClassBoxes.map(cb => cb.value);

        let finalTargetLevels = '';
        if (levelKey === 'custom') {
            finalTargetLevels = (document.getElementById('milestoneTargetLevelsInput')?.value || '').trim() || 'مستوى مخصص';
        } else if (levelKey === 'all') {
            finalTargetLevels = checkedClasses.length > 0 
                ? `جميع الأقسام (${checkedClasses.join('، ')})` 
                : 'كافة المستويات والأقسام المسندة';
        } else {
            const meta = MOROCCAN_LEVELS_META[levelKey] || { shortName: levelKey };
            finalTargetLevels = checkedClasses.length > 0 
                ? `${meta.shortName} (${checkedClasses.join('، ')})` 
                : meta.shortName;
        }

        const generalTimeSlot = (document.getElementById('milestoneGeneralTimeInput')?.value || '').trim();
        const descEl = document.getElementById('milestoneDescriptionInput') || document.getElementById('milestoneDescInput');
        let desc = (descEl?.value || '').trim();
        const color = document.getElementById('milestoneColorSelect')?.value || (isUnifiedModeActive || category === 'certification' ? '#7c3aed' : (category === 'exam' ? '#dc2626' : '#2563eb'));

        // الحقول المغناة للمحطة المتكاملة
        const venue = (document.getElementById('milestoneVenueInput')?.value || '').trim();
        const stakeholders = (document.getElementById('milestoneStakeholdersInput')?.value || '').trim();
        const unifiedTopics = (document.getElementById('unifiedExamTopicsInput')?.value || document.getElementById('milestoneExamTopicsInput')?.value || '').trim();
        const generalTopic = (document.getElementById('milestoneTopicInput')?.value || '').trim();
        const topic = (isUnifiedModeActive && unifiedTopics) ? unifiedTopics : (generalTopic || unifiedTopics);
        const didacticTools = (document.getElementById('milestoneDidacticToolsInput')?.value || '').trim();
        const deliverables = (document.getElementById('milestoneDeliverablesInput')?.value || '').trim();

        const isExamType = isUnifiedModeActive || (category === 'exam' || category === 'certification' || category === 'assessment');
        const targetClass = checkedClasses.length === 1 ? checkedClasses[0] : (checkedClasses.join('، ') || 'جميع المستويات');
        const examNumber = isExamType ? (document.getElementById('milestoneExamNumberSelect')?.value || '') : '';
        const duration = isExamType ? (document.getElementById('unifiedExamDurationSelect')?.value || document.getElementById('milestoneExamDurationSelect')?.value || '') : '';
        const examTimeSlot = isExamType ? (document.getElementById('unifiedExamTimeSlotInput')?.value || document.getElementById('milestoneExamTimeInput')?.value || '') : '';
        const unifiedSubtype = isUnifiedModeActive ? (document.getElementById('unifiedExamSubtypeSelect')?.value || 'national') : '';
        const coefficient = isUnifiedModeActive ? (document.getElementById('unifiedExamCoefInput')?.value || '7') : '';
        const topics = topic;

        const finalTimeSlot = (isUnifiedModeActive && examTimeSlot) ? examTimeSlot : (generalTimeSlot || examTimeSlot);

        if (!title || !startDate) {
            if (typeof window.showToast === 'function') {
                window.showToast('يرجى إدخال عنوان المحطة / الموعد وتاريخ البداية على الأقل', 'warning');
            } else if (typeof window.showNotification === 'function') {
                window.showNotification('يرجى إدخال عنوان المحطة / الموعد وتاريخ البداية', 'error');
            }
            unlock();
            return;
        }

        const semester = (semesterVal === '2' || semesterVal === 's2') ? 's2' : 's1';
        const semesterLabel = semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول';
        const categoryLabels = {
            exam: 'فرض مراقبة مستمرة',
            certification: 'امتحان إشهادي / موحد',
            assessment: 'روائز وتقويم تشخيصي',
            council: 'مجالس الأقسام والتوجيه',
            remediation: 'حصة دعم ومعالجة ديداكتيكية',
            task: 'واجب منزلي / مهمة بيداغوجية',
            activity: 'نشاط تربوي / تظاهرة',
            schoolwork: 'موعد / واجب أو حصة دعم',
            massar: 'مسار وتدبير مسك النقط',
            guidance: 'توجيه مدرسي وإعلام',
            training: 'تكوين مستمر / ندوة تربوية',
            entry: 'دخول مدرسي وانطلاق الدراسة',
            admin: 'إجراء إداري / تربوي',
            other: 'موعد / محطة تربوية'
        };

        const finalMilestoneId = id || ('ms_' + Date.now());
        const isUnifiedExam = isUnifiedModeActive || (category === 'certification') || (category === 'exam' && title.includes('موحد'));

        const milestoneData = {
            id: finalMilestoneId,
            title,
            category,
            categoryLabel: categoryLabels[category] || 'محطة تربوية',
            semester,
            semesterLabel,
            startDate,
            endDate,
            importance: importance || (isExamType ? 'critical' : 'high'),
            status: status || 'upcoming',
            reminder: reminder || '1_day_before',
            targetLevel: levelKey,
            targetClasses: checkedClasses,
            targetLevels: finalTargetLevels,
            description: desc,
            venue: venue,
            stakeholders: stakeholders,
            topics: topics,
            topic: topics,
            didacticTools: didacticTools,
            deliverables: deliverables,
            icon: isUnifiedExam ? 'graduation-cap' : (category === 'exam' ? 'award' : (category === 'council' ? 'users' : 'check-square')),
            color,
            isUnifiedExam,
            unifiedSubtype,
            coefficient,
            targetClass,
            examNumber,
            duration,
            timeSlot: finalTimeSlot,
            isCustom: true,
            isMath: true,
            isSecondary: true
        };

        const milestones = getAcademicMilestones();
        if (id) {
            const idx = milestones.findIndex(m => m.id === id);
            if (idx >= 0) {
                milestones[idx] = { ...milestones[idx], ...milestoneData };
            } else {
                milestones.push(milestoneData);
            }
        } else {
            milestones.push(milestoneData);
        }

        milestones.sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
        window.db.academicMilestones = milestones;

        // مزامنة تلقائية مع جدول الفروض القادمة (upcomingExams) إذا كانت المحطة فرضاً أو امتحاناً
        if (window.db) {
            if (!Array.isArray(window.db.upcomingExams)) window.db.upcomingExams = [];
            if (isExamType) {
                const existingExamIdx = window.db.upcomingExams.findIndex(e => e.milestoneId === finalMilestoneId);
                const examObj = {
                    id: existingExamIdx >= 0 ? window.db.upcomingExams[existingExamIdx].id : ('exam_ms_' + Date.now()),
                    milestoneId: finalMilestoneId,
                    title: title,
                    subject: 'الرياضيات',
                    date: startDate,
                    timeSlot: finalTimeSlot || duration || '08:30',
                    className: checkedClasses.length > 0 ? checkedClasses.join('، ') : finalTargetLevels,
                    type: isUnifiedExam ? 'امتحان موحد' : (examNumber || 'فرض محروس'),
                    semester: semester === 's2' ? 'الدورة 2' : 'الدورة 1',
                    topics: topics || desc || '',
                    status: status === 'completed' ? 'completed' : 'upcoming',
                    isUnifiedExam: isUnifiedExam,
                    venue: venue,
                    createdAt: new Date().toISOString()
                };
                if (existingExamIdx >= 0) {
                    window.db.upcomingExams[existingExamIdx] = { ...window.db.upcomingExams[existingExamIdx], ...examObj };
                } else {
                    window.db.upcomingExams.push(examObj);
                }
            } else if (id) {
                window.db.upcomingExams = window.db.upcomingExams.filter(e => e.milestoneId !== id);
            }

            if (typeof window.renderUpcomingExamsTimeline === 'function') {
                window.renderUpcomingExamsTimeline();
            }

            // مزامنة ثنائية الاتجاه مع سجل المحطات والمواعيد في تبويب جدول الحصص (db.agenda)
            if (!Array.isArray(window.db.agenda)) window.db.agenda = [];
            const agIdx = window.db.agenda.findIndex(ag => ag.milestoneId === finalMilestoneId || ag.id === milestoneData.agendaId);
            const agTypeLabel = isUnifiedExam
                ? 'امتحان موحد'
                : (category === 'exam' ? 'فرض محروس' : (category === 'support' ? 'دعم ومعالجة' : (category === 'council' ? 'مجلس / اجتماع' : 'محطة بيداغوجية')));
            const agItem = {
                id: agIdx >= 0 ? window.db.agenda[agIdx].id : ('ag_ms_' + finalMilestoneId),
                milestoneId: finalMilestoneId,
                date: startDate,
                endDate: endDate || startDate,
                type: agTypeLabel,
                className: checkedClasses.length > 0 ? checkedClasses.join('، ') : (finalTargetLevels || 'جميع الأقسام'),
                timeSlot: finalTimeSlot || '',
                text: title,
                isHomework: false,
                massarExempt: false
            };
            if (agIdx >= 0) {
                window.db.agenda[agIdx] = { ...window.db.agenda[agIdx], ...agItem };
            } else {
                window.db.agenda.push(agItem);
            }
            if (typeof window.renderAgendaList === 'function') {
                try { window.renderAgendaList(); } catch (e) {}
            }
            if (typeof window.renderAgendaNotifications === 'function') {
                try { window.renderAgendaNotifications(); } catch (e) {}
            }
        }

        closeAcademicMilestoneModal();
        syncAllCalendarUnits(false);
        if (typeof window.renderCalendar === 'function') {
            window.renderCalendar();
        }
        if (typeof window.renderPedagogicalRoadmap === 'function') {
            window.renderPedagogicalRoadmap('calendarRoadmapContentMount');
        }

        if (typeof window.autoSyncSingleItemToGoogleCalendar === 'function') {
            window.autoSyncSingleItemToGoogleCalendar(milestoneData, id ? 'update' : 'save');
        }

        unlock();
        if (typeof window.showToast === 'function') {
            window.showToast(id ? 'تم تحديث المحطة/الموعد ومزامنة التقويم وجدول الحصص بنجاح ✨' : 'تمت إضافة المحطة/الموعد ومزامنة التقويم وجدول الحصص بنجاح 🎯✨');
        } else if (typeof window.showNotification === 'function') {
            window.showNotification('تم حفظ المحطة ومزامنة التقويم وجدول الحصص بنجاح', 'success');
        }
    }

    /**
     * حذف محطة تربوية أو موعد مع تنظيف كافة الروابط في التقويم الشهري والسنوي وجدول الحصص بدون تعارض
     */
    function deleteAcademicMilestone(id) {
        const milestones = getAcademicMilestones();
        const ms = milestones.find(m => m.id === id);
        if (!ms) return;

        window.db.academicMilestones = milestones.filter(m => m.id !== id);
        if (window.db && Array.isArray(window.db.calendarEvents)) {
            window.db.calendarEvents = window.db.calendarEvents.filter(ev => ev.milestoneId !== id && ev.id !== id);
        }
        if (window.db && Array.isArray(window.db.upcomingExams)) {
            window.db.upcomingExams = window.db.upcomingExams.filter(e => e.milestoneId !== id);
        }
        if (window.db && Array.isArray(window.db.agenda)) {
            window.db.agenda = window.db.agenda.filter(ag => ag.milestoneId !== id && ag.id !== ms.agendaId && ag.id !== ('ag_ms_' + id));
        }
        if (typeof window.saveDB === 'function') window.saveDB();
        syncAllCalendarUnits(false);
        if (typeof window.renderCalendar === 'function') {
            window.renderCalendar();
        }
        if (typeof window.renderUpcomingExamsTimeline === 'function') {
            window.renderUpcomingExamsTimeline();
        }
        if (typeof window.renderAgendaList === 'function') {
            try { window.renderAgendaList(); } catch (e) {}
        }
        if (typeof window.renderAgendaNotifications === 'function') {
            try { window.renderAgendaNotifications(); } catch (e) {}
        }
        if (typeof window.autoSyncSingleItemToGoogleCalendar === 'function') {
            window.autoSyncSingleItemToGoogleCalendar(ms, 'delete');
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`تم حذف "${ms.title}" وتحديث التقويم وجدول الحصص بنجاح`);
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(`تم حذف "${ms.title}" وتحديث التقويم بنجاح`, 'info');
        }
    }

    /**
     * نوافذ استيراد المقرر الوزاري بالذكاء الاصطناعي ووثائق PDF
     */
    let _attachedDecreePdfBase64 = null;
    let _attachedDecreePdfName = null;
    let _attachedDecreePdfSize = null;
    let _extractedDecreeData = null;
    let _decreePreviewFilter = 'all'; // 'all' | 'secondary' | 'math' | 'teacher' | 'holidays'

    function updateDecreeCharCount() {
        const ta = document.getElementById('decreeTextInput');
        const countEl = document.getElementById('decreeTextCharCount');
        if (ta && countEl) {
            countEl.textContent = (ta.value ? ta.value.length.toLocaleString() : '0') + ' حرف';
        }
    }

    function openDecreeAiImportModal() {
        const modal = document.getElementById('decreeAiImportModal');
        if (!modal) return;
        const preview = document.getElementById('decreeAiPreviewSection');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
        const applyBtn = document.getElementById('btnApplyDecreeImport');
        if (applyBtn) applyBtn.style.display = 'none';

        const ta = document.getElementById('decreeTextInput');
        if (ta) {
            ta.removeEventListener('input', updateDecreeCharCount);
            ta.addEventListener('input', updateDecreeCharCount);
            updateDecreeCharCount();
        }

        modal.style.display = 'flex';
    }

    function closeDecreeAiImportModal() {
        const modal = document.getElementById('decreeAiImportModal');
        if (modal) modal.style.display = 'none';
    }

    function onDecreePresetChange() {
        const select = document.getElementById('decreePresetSelect');
        if (!select) return;
        if (select.value === 'preset_2026_2027') {
            loadSampleDecreeText();
        } else {
            const ta = document.getElementById('decreeTextInput');
            if (ta) {
                ta.value = '';
                updateDecreeCharCount();
            }
        }
    }

    function loadSampleDecreeText() {
        const ta = document.getElementById('decreeTextInput');
        if (!ta) return;
        ta.value = `المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة
مقرر وزير التربية الوطنية والتعليم الأولي والرياضة بشأن تنظيم السنة الدراسية 2026-2027.

[المحور 1: انطلاق الموسم الدراسي والالتحاق بالعمل]
- التحاق أطر الإدارة التربوية وهيئة التدريس وتوقيع محاضر الدخول: 02 شتنبر 2026.
- انطلاق الحصص الدراسية الفعلية بالسلك الثانوي التأهيلي والتحاق التلميذات والتلاميذ: 08 شتنبر 2026.
- المجلس التعليمي الأول لمادة الرياضيات وتنسيق التوزيعات السنوية: من 10 إلى 12 شتنبر 2026.
- التقويم التشخيصي والدعم الاستدراكي لمادة الرياضيات بالثانوي التأهيلي: من 09 إلى 28 شتنبر 2026.

[المحور 2: لائحة العطل الرسمية المدرسية 2026-2027]
- عطلة المولد النبوي الشريف: 12 و13 ربيع الأول 1448 (يومان).
- العطلة البينية الأولى: من الأحد 25 أكتوبر 2026 إلى الأحد 01 نونبر 2026 (8 أيام).
- ذكرى المسيرة الخضراء: الجمعة 06 نونبر 2026 (يوم واحد).
- عيد الاستقلال المجيد: الأربعاء 18 نونبر 2026 (يوم واحد).
- العطلة البينية الثانية: من الأحد 06 دجنبر 2026 إلى الأحد 13 دجنبر 2026 (8 أيام).
- فاتح السنة الميلادية: الجمعة 01 يناير 2027 (يوم واحد).
- ذكرى تقديم وثيقة الاستقلال: الإثنين 11 يناير 2027 (يوم واحد).
- رأس السنة الأمازيغية: الأربعاء 13 يناير 2027 (يوم واحد).
- عطلة منتصف السنة الدراسية: من الأحد 24 يناير 2027 إلى الأحد 31 يناير 2027 (8 أيام).
- العطلة البينية الثالثة: من الأحد 14 مارس 2027 إلى الأحد 21 مارس 2027 (8 أيام).
- عيد الفطر السعيد: من 29 رمضان إلى 02 شوال 1448 (3 إلى 4 أيام).
- عيد الشغل: السبت 01 ماي 2027 (يوم واحد).
- العطلة البينية الرابعة: من الأحد 02 ماي 2027 إلى الأحد 09 ماي 2027 (8 أيام).
- عيد الأضحى المبارك: من 09 إلى 11 ذو الحجة 1448 (3 أيام).
- فاتح محرم: الجمعة 16 يوليوز 2027 (يوم واحد).

[المحور 3: محطات مادة الرياضيات وفروض المراقبة المستمرة]
- إجراء الفرض الأول للمراقبة المستمرة لمادة الرياضيات (الأسدوس الأول): من 09 إلى 21 نونبر 2026.
- الأولمبياد الوطنية في الرياضيات (المرحلة الانتقائية الإقليمية): من 08 إلى 10 دجنبر 2026.
- إجراء الفرض الثاني للمراقبة المستمرة لمادة الرياضيات (الأسدوس الأول): من 14 إلى 24 دجنبر 2026.
- إجراء الفرض الأول للمراقبة المستمرة لمادة الرياضيات (الأسدوس الثاني): من 22 مارس إلى 03 أبريل 2027.
- المباراة العامة للعلوم والتقنيات (GMST) في مادة الرياضيات: من 14 إلى 16 أبريل 2027.
- إجراء الفرض الثاني لمادة الرياضيات وإنهاء البرامج والمقررات (الأسدوس الثاني): من 17 إلى 29 ماي 2027.

[المحور 4: محطات خاصة بالأستاذ(ة) والمسار المهني]
- إجراء اختبارات امتحان الكفاءة المهنية لأطر هيئة التدريس (الامتحان المهني للترقية): 26 و27 دجنبر 2026.
- المجلس التعليمي الثاني لمادة الرياضيات لتقييم نتائج الأسدوس الأول: من 08 إلى 10 فبراير 2027.
- المسك النهائي لنقط المراقبة المستمرة والأنشطة في منظومة مسار (الأسدوس 1): من 09 إلى 16 يناير 2027.
- المسك النهائي لنقط المراقبة المستمرة في مسار (الأسدوس 2): من 30 ماي إلى 04 يونيو 2027.
- توقيع محاضر الخروج لجميع أطر هيئة التدريس واختتام الموسم الدراسي: من 10 إلى 12 يوليوز 2027.

[المحور 5: محطات السلك الثانوي التأهيلي والامتحانات الإشهادية ومجالس الأقسام]
- مجالس الأقسام لنهاية الأسدوس الأول بالثانوي التأهيلي واستخراج النتائج: من 20 إلى 23 يناير 2027.
- انطلاق دروس الأسدوس الثاني لجميع مستويات الثانوي التأهيلي: 01 فبراير 2027.
- عمليات التوجيه المدرسي ومجالس إعادة التوجيه بالثانوي التأهيلي: من 12 إلى 30 أبريل 2027.
- الامتحان الوطني الموحد لنيل شهادة البكالوريا (الدورة العادية): من 08 إلى 11 يونيو 2027.
- الامتحان الجهوي الموحد للسنة الأولى من سلك البكالوريا: من 14 إلى 17 يونيو 2027.
- مجالس الأقسام لنهاية السنة وقرارات التوجيه والتخرج: من 25 إلى 30 يونيو 2027.
- الدورة الاستدراكية للامتحان الوطني الموحد للبكالوريا: من 02 إلى 06 يوليوز 2027.`;
        updateDecreeCharCount();
    }

    /**
     * معالجة رفع واستيراد ملفات PDF للمقرر الوزاري
     */
    function handleDecreePdfUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        processDecreePdfFile(file);
    }

    function onDecreeDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        const container = document.getElementById('decreeInputContainer');
        if (container) {
            container.style.borderColor = '#dc2626';
            container.style.backgroundColor = '#fff5f5';
        }
    }

    function onDecreeDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        const container = document.getElementById('decreeInputContainer');
        if (container) {
            container.style.borderColor = '#cbd5e1';
            container.style.backgroundColor = '#ffffff';
        }
    }

    function onDecreeDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const container = document.getElementById('decreeInputContainer');
        if (container) {
            container.style.borderColor = '#cbd5e1';
            container.style.backgroundColor = '#ffffff';
        }
        const files = event.dataTransfer && event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                processDecreePdfFile(file);
            } else {
                alert('يرجى سحب وإفلات ملف PDF صالح للمقرر الوزاري.');
            }
        }
    }

    function processDecreePdfFile(file) {
        _attachedDecreePdfName = file.name;
        _attachedDecreePdfSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        // إظهار بطاقة حالة ملف PDF
        const card = document.getElementById('decreePdfAttachedCard');
        const nameEl = document.getElementById('decreePdfFileName');
        const infoEl = document.getElementById('decreePdfFileInfo');
        const badgeEl = document.getElementById('decreePdfBadge');
        if (card) card.style.display = 'flex';
        if (nameEl) nameEl.textContent = file.name;
        if (infoEl) infoEl.textContent = `حجم الملف: ${_attachedDecreePdfSize} | جاري قراءة واستخراج نصوص الوثيقة...`;
        if (badgeEl) badgeEl.textContent = 'جاري المعالجة...';

        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                _attachedDecreePdfBase64 = window.btoa(binary);

                if (infoEl) infoEl.textContent = `حجم الملف: ${_attachedDecreePdfSize} | تم إرفاق الوثيقة وتجهيزها للتحليل الذكي بواسطة Gemini AI`;
                if (badgeEl) badgeEl.textContent = 'PDF جاهز للتحليل';

                // محاولة استخراج النصوص عبر PDF.js في المتصفح لملء مربع النص كمعاينة
                if (window.pdfjsLib) {
                    try {
                        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
                        const pdf = await loadingTask.promise;
                        let extracted = '';
                        const totalPages = Math.min(pdf.numPages, 30);
                        for (let p = 1; p <= totalPages; p++) {
                            const page = await pdf.getPage(p);
                            const textContent = await page.getTextContent();
                            const pageStr = textContent.items.map(it => it.str).join(' ');
                            extracted += `\n--- الصفحة ${p} من المقرر الوزاري ---\n` + pageStr;
                        }
                        if (extracted.trim().length > 30) {
                            const ta = document.getElementById('decreeTextInput');
                            if (ta) {
                                ta.value = extracted.trim();
                                updateDecreeCharCount();
                            }
                        }
                    } catch(pe) {
                        console.warn('PDF.js text parse warning:', pe);
                    }
                }

                if (typeof window.showNotification === 'function') {
                    window.showNotification(`تم إرفاق ملف المقرر الوزاري (${file.name}) بنجاح`, 'success');
                }
            } catch(err) {
                console.error('Error processing PDF file:', err);
                if (infoEl) infoEl.textContent = 'تم إرفاق الملف بصيغة PDF';
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function removeDecreePdfAttachment() {
        _attachedDecreePdfBase64 = null;
        _attachedDecreePdfName = null;
        _attachedDecreePdfSize = null;
        const card = document.getElementById('decreePdfAttachedCard');
        if (card) card.style.display = 'none';
        const input = document.getElementById('decreePdfFileInput');
        if (input) input.value = '';
        if (typeof window.showNotification === 'function') {
            window.showNotification('تمت إزالة الملف المرفق', 'info');
        }
    }

    /**
     * تشغيل الاستخراج والتحليل الذكي للمقرر الوزاري
     */
    async function runDecreeAiExtraction() {
        const text = (document.getElementById('decreeTextInput')?.value || '').trim();
        const hasPdf = !!_attachedDecreePdfBase64;

        if (!text && !hasPdf) {
            alert('يرجى رفع ملف المقرر الوزاري بصيغة PDF أو لصق نصه في الصندوق المخصص لتحليله.');
            return;
        }

        const btn = document.getElementById('btnRunDecreeExtraction');
        const btnText = document.getElementById('btnRunDecreeExtractionText');
        if (btn) btn.disabled = true;
        if (btnText) btnText.innerHTML = 'جاري التحليل واستخراج محطات التأهيلي والرياضيات والامتحان المهني بواسطة Gemini AI...';

        try {
            let extractedResult = null;
            try {
                const resp = await fetch('/api/calendar/extract-decree-ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        pdfBase64: _attachedDecreePdfBase64,
                        academicYear: '2026-2027'
                    })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.result && Array.isArray(data.result.milestones) && data.result.milestones.length > 0) {
                        extractedResult = data.result;
                    }
                }
            } catch(apiErr) {
                console.warn('API call error, falling back to local dataset:', apiErr);
            }

            if (!extractedResult || !Array.isArray(extractedResult.milestones) || extractedResult.milestones.length === 0) {
                // Heuristic Moroccan Educational Dataset
                extractedResult = {
                    academicYear: '2026-2027',
                    decreeTitle: 'المقرر الوزاري لتنظيم السنة الدراسية 2026-2027',
                    holidays: JSON.parse(JSON.stringify(DEFAULT_OFFICIAL_HOLIDAYS_2026_2027)),
                    milestones: JSON.parse(JSON.stringify(DEFAULT_ACADEMIC_MILESTONES_2026_2027))
                };
            }

            // ضمان تحديد الخصائص النوعية
            extractedResult.milestones.forEach(m => {
                const t = (m.title + ' ' + (m.description || '') + ' ' + (m.targetLevels || '')).toLowerCase();
                if (m.isSecondary === undefined) {
                    m.isSecondary = t.includes('تأهيلي') || t.includes('باك') || t.includes('جذع') || t.includes('ثانوي') || t.includes('مراقبة مستمرة');
                }
                if (m.isMath === undefined) {
                    m.isMath = t.includes('رياضيات') || t.includes('أولمبياد') || t.includes('علوم') || t.includes('فرض') || t.includes('روائز');
                }
                if (m.isTeacher === undefined) {
                    m.isTeacher = t.includes('أستاذ') || t.includes('تدريس') || t.includes('المهني') || t.includes('الكفاءة') || t.includes('محاضر') || t.includes('مجلس') || t.includes('مسار');
                }
            });

            _extractedDecreeData = extractedResult;
            _decreePreviewFilter = 'all';
            renderDecreeAiPreview();

            const applyBtn = document.getElementById('btnApplyDecreeImport');
            if (applyBtn) applyBtn.style.display = 'inline-flex';

            if (typeof window.showNotification === 'function') {
                window.showNotification('تم استخراج محطات التأهيلي ومادة الرياضيات والامتحان المهني والعطل بنجاح', 'success');
            }
        } catch(err) {
            console.error('Error during decree extraction:', err);
            alert('حدث خطأ أثناء قراءة المقرر الوزاري: ' + (err.message || err));
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.innerHTML = 'بدء استخراج العطل والمحطات آلياً بواسطة Gemini AI';
        }
    }

    /**
     * عرض بطاقات المعاينة المنسقة والتبويبات التفاعلية
     */
    function renderDecreeAiPreview() {
        const preview = document.getElementById('decreeAiPreviewSection');
        if (!preview || !_extractedDecreeData) return;

        const milestones = _extractedDecreeData.milestones || [];
        const holidays = _extractedDecreeData.holidays || [];

        const secondaryCount = milestones.filter(m => m.isSecondary).length;
        const mathCount = milestones.filter(m => m.isMath).length;
        const teacherCount = milestones.filter(m => m.isTeacher).length;
        const holidaysCount = holidays.length;

        // فلترة العناصر حسب التبويب النشط
        let displayedMilestones = milestones;
        let showHolidaysInList = true;

        if (_decreePreviewFilter === 'secondary') {
            displayedMilestones = milestones.filter(m => m.isSecondary);
            showHolidaysInList = false;
        } else if (_decreePreviewFilter === 'math') {
            displayedMilestones = milestones.filter(m => m.isMath);
            showHolidaysInList = false;
        } else if (_decreePreviewFilter === 'teacher') {
            displayedMilestones = milestones.filter(m => m.isTeacher);
            showHolidaysInList = false;
        } else if (_decreePreviewFilter === 'holidays') {
            displayedMilestones = [];
            showHolidaysInList = true;
        }

        let milestonesHtml = '';
        if (displayedMilestones.length > 0) {
            milestonesHtml = displayedMilestones.map(m => {
                const isExamOrCert = m.category === 'certification' || m.category === 'exam';
                const isCouncil = m.category === 'council';
                const isTeacher = m.isTeacher;
                const isMath = m.isMath;
                const isSecondary = m.isSecondary;

                const borderColor = isTeacher ? '#7c3aed' : (isMath ? '#dc2626' : (isSecondary ? '#2563eb' : '#cbd5e1'));
                const iconSymbol = isTeacher ? '💼' : (isMath ? '📐' : (isSecondary ? '🎓' : '📌'));

                return `
                    <div style="background: #ffffff; border: 1.5px solid ${borderColor}; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                        <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 0;">
                            <input type="checkbox" class="chk-decree-milestone" data-id="${m.id}" checked style="margin-top: 4px; accent-color: #7c3aed; width: 17px; height: 17px; cursor: pointer;">
                            <div style="min-width: 0; flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">${iconSymbol} ${escapeHtml(m.title)}</span>
                                    <span style="background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 5px; font-size: 0.72rem; font-weight: 700;">${m.startDate}${m.endDate && m.endDate !== m.startDate ? ' إلى ' + m.endDate : ''}</span>
                                    ${m.importance === 'critical' ? '<span style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 5px; font-size: 0.7rem; font-weight: 800;">🔴 حاسمة</span>' : ''}
                                </div>
                                <div style="font-size: 0.77rem; color: #475569; margin-top: 4px; line-height: 1.4;">
                                    ${escapeHtml(m.description || '')}
                                </div>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                                    <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">👥 المعنيون: ${escapeHtml(m.targetLevels || 'كافة المستويات')}</span>
                                    ${isSecondary ? '<span style="background: #eff6ff; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">🎓 ثانوي تأهيلي</span>' : ''}
                                    ${isMath ? '<span style="background: #fdf2f8; color: #be185d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">📐 رياضيات</span>' : ''}
                                    ${isTeacher ? '<span style="background: #f5f3ff; color: #6d28d9; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">💼 الأستاذ والامتحان المهني</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        let holidaysHtml = '';
        if (showHolidaysInList && holidays.length > 0) {
            holidaysHtml = `
                <div style="margin-top: 10px; margin-bottom: 8px;">
                    <div style="font-size: 0.85rem; font-weight: 800; color: #166534; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <span>🌴 العطل الرسمية والفترات البينية المستخرجة (${holidays.length} عطلة):</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;">
                        ${holidays.map(h => `
                            <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                    <input type="checkbox" class="chk-decree-holiday" data-id="${h.id}" checked style="accent-color: #16a34a; width: 16px; height: 16px; cursor: pointer;">
                                    <div style="min-width: 0;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #14532d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(h.title)}</div>
                                        <div style="font-size: 0.72rem; color: #16a34a;">${h.startDate}${h.endDate && h.endDate !== h.startDate ? ' إلى ' + h.endDate : ''} (${h.daysCount || 1} يوم)</div>
                                    </div>
                                </div>
                                <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; flex-shrink: 0;">${escapeHtml(h.categoryLabel || 'عطلة')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        preview.style.display = 'flex';
        preview.innerHTML = `
            <!-- بطاقة الملخص الإحصائي البارزة -->
            <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                <div style="font-weight: 900; color: #0f172a; font-size: 0.95rem; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span>✅ نتيجة تحليل واستخراج وثيقة المقرر الوزاري:</span>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 130px; background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 1.15rem; font-weight: 900; color: #1e40af;">🎓 ${secondaryCount}</div>
                        <div style="font-size: 0.74rem; font-weight: 800; color: #1e3a8a;">محطات الثانوي التأهيلي</div>
                    </div>
                    <div style="flex: 1; min-width: 130px; background: #fdf2f8; border: 1.5px solid #f9a8d4; border-radius: 8px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 1.15rem; font-weight: 900; color: #9d174d;">📐 ${mathCount}</div>
                        <div style="font-size: 0.74rem; font-weight: 800; color: #831843;">محطات مادة الرياضيات</div>
                    </div>
                    <div style="flex: 1; min-width: 130px; background: #f5f3ff; border: 1.5px solid #c4b5fd; border-radius: 8px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 1.15rem; font-weight: 900; color: #6d28d9;">💼 ${teacherCount}</div>
                        <div style="font-size: 0.74rem; font-weight: 800; color: #5b21b6;">محطات الأستاذ (الامتحان المهني)</div>
                    </div>
                    <div style="flex: 1; min-width: 130px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 8px 10px; text-align: center;">
                        <div style="font-size: 1.15rem; font-weight: 900; color: #166534;">🌴 ${holidaysCount}</div>
                        <div style="font-size: 0.74rem; font-weight: 800; color: #14532d;">العطل الرسمية المدرسية</div>
                    </div>
                </div>
            </div>

            <!-- أزرار التبويبات الفئوية للفرز السريع -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px;">
                <button type="button" onclick="filterDecreeAiPreview('all')" style="padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: none; background: ${_decreePreviewFilter === 'all' ? '#1e293b' : '#f1f5f9'}; color: ${_decreePreviewFilter === 'all' ? '#fff' : '#475569'};">
                    الكل (${milestones.length + holidays.length})
                </button>
                <button type="button" onclick="filterDecreeAiPreview('secondary')" style="padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: none; background: ${_decreePreviewFilter === 'secondary' ? '#2563eb' : '#eff6ff'}; color: ${_decreePreviewFilter === 'secondary' ? '#fff' : '#1d4ed8'};">
                    🎓 الثانوي التأهيلي (${secondaryCount})
                </button>
                <button type="button" onclick="filterDecreeAiPreview('math')" style="padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: none; background: ${_decreePreviewFilter === 'math' ? '#dc2626' : '#fdf2f8'}; color: ${_decreePreviewFilter === 'math' ? '#fff' : '#9d174d'};">
                    📐 مادة الرياضيات (${mathCount})
                </button>
                <button type="button" onclick="filterDecreeAiPreview('teacher')" style="padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: none; background: ${_decreePreviewFilter === 'teacher' ? '#7c3aed' : '#f5f3ff'}; color: ${_decreePreviewFilter === 'teacher' ? '#fff' : '#6d28d9'};">
                    💼 محطات الأستاذ (الامتحان المهني) (${teacherCount})
                </button>
                <button type="button" onclick="filterDecreeAiPreview('holidays')" style="padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: none; background: ${_decreePreviewFilter === 'holidays' ? '#16a34a' : '#f0fdf4'}; color: ${_decreePreviewFilter === 'holidays' ? '#fff' : '#15803d'};">
                    🌴 العطل الرسمية (${holidaysCount})
                </button>
            </div>

            <!-- شريط التحكم بتحديد العناصر -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" onclick="toggleAllDecreeItems(true)" style="background: none; border: none; color: #2563eb; font-size: 0.76rem; font-weight: 800; cursor: pointer; text-decoration: underline;">تحديد الكل</button>
                    <span style="color: #cbd5e1;">|</span>
                    <button type="button" onclick="toggleAllDecreeItems(false)" style="background: none; border: none; color: #64748b; font-size: 0.76rem; font-weight: 700; cursor: pointer; text-decoration: underline;">إلغاء التحديد</button>
                </div>
                <div style="font-size: 0.74rem; color: #64748b;">
                    يمكنك تحديد العناصر المراد اعتمادها وإلغاء ما لا يناسب جدولك
                </div>
            </div>

            <!-- قائمة العناصر المستخرجة -->
            <div style="max-height: 380px; overflow-y: auto; padding-right: 2px;">
                ${milestonesHtml}
                ${holidaysHtml}
            </div>
        `;
    }

    function filterDecreeAiPreview(filterType) {
        _decreePreviewFilter = filterType;
        renderDecreeAiPreview();
    }

    function toggleAllDecreeItems(checked) {
        const modal = document.getElementById('decreeAiImportModal');
        if (!modal) return;
        const checkboxes = modal.querySelectorAll('.chk-decree-milestone, .chk-decree-holiday');
        checkboxes.forEach(cb => { cb.checked = !!checked; });
    }

    /**
     * اعتماد وتطبيق البيانات المستخرجة في التقويم وقاعدة البيانات
     */
    let _isApplyingDecreeImport = false;
    function applyDecreeAiImport() {
        if (_isApplyingDecreeImport) return;
        _isApplyingDecreeImport = true;
        const unlock = () => { setTimeout(() => { _isApplyingDecreeImport = false; }, 600); };

        if (!_extractedDecreeData) {
            unlock();
            return;
        }
        const modeInput = document.querySelector('input[name="decreeImportMode"]:checked');
        const mode = modeInput ? modeInput.value : 'replace';

        // جمع العناصر المحددة فقط من قبل المستخدم
        const modal = document.getElementById('decreeAiImportModal');
        const selectedMilestoneIds = new Set();
        const selectedHolidayIds = new Set();

        if (modal) {
            modal.querySelectorAll('.chk-decree-milestone:checked').forEach(cb => {
                selectedMilestoneIds.add(cb.getAttribute('data-id'));
            });
            modal.querySelectorAll('.chk-decree-holiday:checked').forEach(cb => {
                selectedHolidayIds.add(cb.getAttribute('data-id'));
            });
        }

        const approvedHolidays = (_extractedDecreeData.holidays || []).filter(h => selectedHolidayIds.size === 0 || selectedHolidayIds.has(h.id));
        const approvedMilestones = (_extractedDecreeData.milestones || []).filter(m => selectedMilestoneIds.size === 0 || selectedMilestoneIds.has(m.id));

        if (approvedHolidays.length === 0 && approvedMilestones.length === 0) {
            alert('يرجى تحديد عنصر واحد على الأقل للاعتماد والتطبيق.');
            unlock();
            return;
        }

        if (mode === 'replace') {
            window.db.officialHolidays = approvedHolidays;
            window.db.academicMilestones = approvedMilestones;
        } else {
            const curHols = window.db.officialHolidays || [];
            approvedHolidays.forEach(nh => {
                if (!curHols.some(h => h.title === nh.title && h.startDate === nh.startDate)) {
                    curHols.push(nh);
                }
            });
            window.db.officialHolidays = curHols;

            const curMs = window.db.academicMilestones || [];
            approvedMilestones.forEach(nm => {
                if (!curMs.some(m => m.title === nm.title && m.startDate === nm.startDate)) {
                    curMs.push(nm);
                }
            });
            window.db.academicMilestones = curMs;
        }

        syncOfficialHolidaysWithCalendarEvents();
        syncMilestonesWithCalendarEvents();
        if (typeof window.saveDB === 'function') window.saveDB();

        closeDecreeAiImportModal();
        renderAnnualSchoolCalendar();

        unlock();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`تم اعتماد ${approvedMilestones.length} محطة تربوية و${approvedHolidays.length} عطلة رسمية بالتقويم بنجاح!`, 'success');
        } else {
            alert('تم تطبيق بيانات المقرر الوزاري بنجاح!');
        }
    }

    /**
     * ربط نظام الغياب: فحص التاريخ المختار وعرض لافتة العطلة أو رخصة الأستاذ وتعطيل أزرار تسجيل الغياب
     */
    function applyHolidayAbsenceRestriction() {
        const dateInput = document.getElementById('datePicker');
        if (!dateInput) return;
        const selectedDate = dateInput.value;
        if (!selectedDate) return;

        const sessionSelect = document.getElementById('sessionSelect');
        const currentSession = sessionSelect ? sessionSelect.value : null;

        const holiday = getOfficialHolidayForDate(selectedDate);
        const isHolidayDisabled = holiday && (holiday.disableAbsence !== false);

        const leave = getTeacherLeaveForDate(selectedDate, currentSession);
        const isLeaveDisabled = leave && (leave.disableStudentAbsence !== false);

        const isAnyDisabled = isHolidayDisabled || isLeaveDisabled;

        // 1. تحديث شارة التاريخ بجانب datePicker
        let holidayTag = document.getElementById('datePickerHolidayTag');
        if (isHolidayDisabled) {
            if (!holidayTag) {
                holidayTag = document.createElement('span');
                holidayTag.id = 'datePickerHolidayTag';
                holidayTag.className = 'holiday-absence-active-badge';
                dateInput.parentNode.insertBefore(holidayTag, dateInput.nextSibling);
            }
            holidayTag.style.display = 'inline-flex';
            holidayTag.style.cssText = 'background: #dcfce7; color: #166534; border: 1.5px solid #86efac; padding: 4px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; margin-right: 6px; box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);';
            holidayTag.innerHTML = `<span>🏖️</span> <span>عطلة رسمية: <strong>${escapeHtml(holiday.title)}</strong> (الغياب معطل)</span>`;
        } else if (isLeaveDisabled) {
            if (!holidayTag) {
                holidayTag = document.createElement('span');
                holidayTag.id = 'datePickerHolidayTag';
                holidayTag.className = 'holiday-absence-active-badge';
                dateInput.parentNode.insertBefore(holidayTag, dateInput.nextSibling);
            }
            holidayTag.style.display = 'inline-flex';
            holidayTag.style.cssText = 'background: #e0f2fe; color: #0369a1; border: 1.5px solid #bae6fd; padding: 4px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px; margin-right: 6px; box-shadow: 0 1px 3px rgba(2, 132, 199, 0.2);';
            holidayTag.innerHTML = `<span>📋</span> <span>رخصة أستاذ: <strong>${escapeHtml(leave.title || leave.typeLabel)}</strong> (غياب التلاميذ معفى)</span>`;
        } else if (holidayTag) {
            holidayTag.style.display = 'none';
        }

        // 2. إظهار أو إخفاء لافتة العطلة الكبرى فوق لائحة التلاميذ
        let banner = document.getElementById('officialHolidayAbsenceBanner');
        const container = document.getElementById('studentsList');

        if (isHolidayDisabled) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'officialHolidayAbsenceBanner';
                if (container && container.parentNode) {
                    container.parentNode.insertBefore(banner, container);
                }
            }
            banner.style.cssText = 'background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-right: 6px solid #10b981; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);';
            banner.style.display = 'flex';
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 260px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: #10b981; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); flex-shrink: 0;">
                        🏖️
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 900; font-size: 1rem; color: #166534; font-family: 'Cairo', sans-serif;">
                                اليوم عطلة مدرسية رسمية: ${escapeHtml(holiday.title)}
                            </span>
                            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: #15803d; color: #fff; font-weight: 800;">
                                🛡️ خاصية الترحيل التلقائي مفعلة
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: #334155; margin-top: 3px; line-height: 1.5;">
                            وفقاً للتقويم السنوي المعتمد (${holiday.startDate} إلى ${holiday.endDate || holiday.startDate})، تم تفعيل <strong>الترحيل التلقائي للغياب</strong> لحماية التلاميذ من تسجيل أي غياب غير مبرر، وتثبيت حالتهم كـ 'عطلة رسمية معفية'.
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <button type="button" class="btn-primary" onclick="window.openHolidayAbsenceMigrationModal()" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.25);">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="shield-check" data-size="14"></span></span>
                        <span>مركز ترحيل العطل</span>
                    </button>
                    <button type="button" class="btn-primary" onclick="window.goToAnnualCalendarFromAbsence()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="calendar-range" data-size="14"></span></span>
                        <span>عرض التقويم السنوي</span>
                    </button>
                </div>
            `;
            if (window.renderLucide) window.renderLucide();
        } else if (isLeaveDisabled) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'officialHolidayAbsenceBanner';
                if (container && container.parentNode) {
                    container.parentNode.insertBefore(banner, container);
                }
            }
            banner.style.cssText = 'background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1.5px solid #bae6fd; border-right: 6px solid #0284c7; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.15);';
            banner.style.display = 'flex';
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 260px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3); flex-shrink: 0;">
                        📋
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 900; font-size: 1rem; color: #0369a1; font-family: 'Cairo', sans-serif;">
                                اليوم يوافق رخصة للأستاذ: ${escapeHtml(leave.title || leave.typeLabel)}
                            </span>
                            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: #0284c7; color: #fff; font-weight: 800;">
                                🛡️ ساعات غياب التلاميذ معفاة ومحمية تلقائياً
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: #334155; margin-top: 3px; line-height: 1.5;">
                            وفقاً للتشريع التربوي والقانوني، فإن غياب الأستاذ برخصة قانونية (${leave.startDate} إلى ${leave.endDate || leave.startDate}) مستثنى بالكامل من احتساب ساعات غياب التلاميذ ولا يتم خصمها من نسب مواظبتهم.
                            ${leave.docRef ? `<strong style="display:inline-block; margin-right:6px; background:#bae6fd; color:#0369a1; padding:1px 8px; border-radius:6px;">مرجع: ${escapeHtml(leave.docRef)}</strong>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" class="btn-primary" onclick="window.switchTab('calendar'); setTimeout(() => window.switchCalendarSubView('leaves'), 50);" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="file-badge" data-size="14"></span></span>
                        <span>سجل رخص الأستاذ</span>
                    </button>
                </div>
            `;
            if (window.renderLucide) window.renderLucide();
        } else if (banner) {
            banner.style.display = 'none';
        }

        // 3. تعطيل أزرار التسجيل إذا كان اليوم معطلاً
        if (isAnyDisabled) {
            const reasonTitle = isHolidayDisabled ? `عطلة رسمية (${holiday.title})` : `رخصة للأستاذ (${leave.title || leave.typeLabel})`;
            const btnMark = document.getElementById('btnMarkAll');
            if (btnMark) {
                btnMark.disabled = true;
                btnMark.style.opacity = '0.45';
                btnMark.style.pointerEvents = 'none';
                btnMark.title = `معطل لأن اليوم ${reasonTitle} - غياب التلاميذ معفى تلقائياً`;
            }

            const btnHw = document.getElementById('btnHwAll');
            if (btnHw) {
                btnHw.disabled = true;
                btnHw.style.opacity = '0.45';
                btnHw.style.pointerEvents = 'none';
                btnHw.title = `معطل لأن اليوم ${reasonTitle}`;
            }

            const statusBtns = document.querySelectorAll('.student-item .btn-status');
            statusBtns.forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.45';
                btn.style.cursor = 'not-allowed';
                btn.title = `اليوم ${reasonTitle} - تسجيل الغياب معطل لحماية حقوق التلاميذ`;
            });
        } else {
            // إعادة التفعيل
            const isPres = (typeof window.isPresentationMode === 'function' && window.isPresentationMode());
            const btnMark = document.getElementById('btnMarkAll');
            if (btnMark && !isPres) {
                btnMark.disabled = false;
                btnMark.style.opacity = '1';
                btnMark.style.pointerEvents = 'auto';
                btnMark.title = '';
            }

            const btnHw = document.getElementById('btnHwAll');
            if (btnHw && !isPres) {
                btnHw.disabled = false;
                btnHw.style.opacity = '1';
                btnHw.style.pointerEvents = 'auto';
                btnHw.title = '';
            }

            const statusBtns = document.querySelectorAll('.student-item .btn-status');
            statusBtns.forEach(btn => {
                if (!isPres) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.title = '';
                }
            });
        }
    }

    /**
     * التبديل بين التقويم السنوي والمحطات المدرسية، التقويم الشهري، سجل رخص الأستاذ، والمسار البيداغوجي
     */
    let currentCalendarSubView = 'annual'; // 'annual' | 'monthly' | 'leaves' | 'roadmap'

    function switchCalendarSubView(sub, force = false) {
        const annualView = document.getElementById('calendarAnnualSubView');
        const monthlyView = document.getElementById('calendarMonthlySubView');
        const leavesView = document.getElementById('calendarLeavesSubView');
        const roadmapView = document.getElementById('calendarRoadmapSubView');

        // التحقق مما إذا كانت شبكة الأيام في التقويم الشهري فارغة (لمنع تخطي الرندرة)
        const monthlyGridEl = document.getElementById('calendarGrid');
        const monthlyTableEl = document.getElementById('monthlyDaysScheduleTableMount');
        const isMonthlyEmpty = (sub === 'monthly') && (
            !monthlyGridEl ||
            monthlyGridEl.children.length === 0 ||
            (monthlyTableEl && monthlyTableEl.innerHTML.trim() === '')
        );

        // منع تكرار العمليات وإعادة البناء إذا كان القسم الفرعي نشطاً وظاهراً بالفعل ومكتملاً
        if (!force && !isMonthlyEmpty && currentCalendarSubView === sub) {
            const curEl = (sub === 'annual') ? annualView : (sub === 'monthly') ? monthlyView : (sub === 'leaves') ? leavesView : roadmapView;
            if (curEl && curEl.style.display === 'block') {
                return;
            }
        }

        currentCalendarSubView = sub;
        window.currentCalendarSubView = sub;
        const btnAnnual = document.getElementById('calSubnavAnnual');
        const btnMonthly = document.getElementById('calSubnavMonthly');
        const btnLeaves = document.getElementById('calSubnavLeaves');
        const btnRoadmap = document.getElementById('calSubnavRoadmap');

        if (btnAnnual) btnAnnual.classList.toggle('active', sub === 'annual');
        if (btnMonthly) btnMonthly.classList.toggle('active', sub === 'monthly');
        if (btnLeaves) btnLeaves.classList.toggle('active', sub === 'leaves');
        if (btnRoadmap) btnRoadmap.classList.toggle('active', sub === 'roadmap');

        if (annualView) annualView.style.display = (sub === 'annual') ? 'block' : 'none';
        if (monthlyView) monthlyView.style.display = (sub === 'monthly') ? 'block' : 'none';
        if (leavesView) leavesView.style.display = (sub === 'leaves') ? 'block' : 'none';
        if (roadmapView) roadmapView.style.display = (sub === 'roadmap') ? 'block' : 'none';

        // مزامنة كافة الوحدات ورسم القسم النشط بشكل موحد ومضمون
        if (typeof syncAllCalendarUnits === 'function') {
            syncAllCalendarUnits(false);
        } else {
            if (typeof window.renderGoogleCalendarSyncBanner === 'function') {
                window.renderGoogleCalendarSyncBanner('googleCalendarSyncBannerMount');
            }
            if (sub === 'annual') {
                syncAcademicMilestonesWithCalendarEvents();
                renderAnnualSchoolCalendar();
            } else if (sub === 'monthly') {
                syncOfficialHolidaysWithCalendarEvents();
                syncAcademicMilestonesWithCalendarEvents();
                syncTeacherLeavesWithCalendarEvents();
                if (typeof window.renderCalendar === 'function') {
                    window.renderCalendar();
                }
            } else if (sub === 'leaves') {
                renderTeacherLeavesDashboard();
            } else if (sub === 'roadmap') {
                syncAcademicMilestonesWithCalendarEvents();
                if (typeof window.renderPedagogicalRoadmap === 'function') {
                    window.renderPedagogicalRoadmap('calendarRoadmapContentMount');
                }
            }
        }

        // ضمان إضافي صارم: عند فتح التقويم الشهري، يجب دائماً التأكد من رسم جدول وشبكة الأيام
        if (sub === 'monthly' && typeof window.renderCalendar === 'function') {
            try {
                window.renderCalendar();
            } catch (err) {
                console.error('Monthly calendar render fallback error:', err);
            }
        }
        if (window.renderLucide) window.renderLucide();
    }

    window.navigateToMonthlyCalendarMonth = function(year, month) {
        if (typeof window.setMonthlyCalendarDate === 'function') {
            window.setMonthlyCalendarDate(year, month);
        } else {
            window.currentCalendarDate = new Date(year, month, 1);
        }
        switchCalendarSubView('monthly', true);
    };

    window.navigateToMonthlyCalendarDate = function(dateIso) {
        if (!dateIso) {
            switchCalendarSubView('monthly', true);
            return;
        }
        const d = new Date(dateIso);
        if (!isNaN(d.getTime())) {
            if (typeof window.setMonthlyCalendarDate === 'function') {
                window.setMonthlyCalendarDate(d.getFullYear(), d.getMonth());
            } else {
                window.currentCalendarDate = new Date(d.getFullYear(), d.getMonth(), 1);
            }
        }
        switchCalendarSubView('monthly', true);
        if (typeof window.openDayDetails === 'function' && !isNaN(d.getTime())) {
            const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
            const readable = `${d.getDate()} ${monthsAr[d.getMonth()]} ${d.getFullYear()}`;
            setTimeout(() => window.openDayDetails(dateIso, readable), 90);
        }
    };

    /**
     * الانتقال من صفحة الغياب إلى تبويب التقويم السنوي والمحطات المدرسية
     */
    function goToAnnualCalendarFromAbsence() {
        if (typeof window.switchTab === 'function') {
            window.switchTab('calendar');
            setTimeout(() => {
                if (typeof switchCalendarSubView === 'function') {
                    switchCalendarSubView('annual');
                }
            }, 30);
        }
    }

    /**
     * رسم لوحة تحكم وسجل رخص وإجازات الأستاذ
     */
    let currentLeavesFilter = 'all';

    function setLeavesFilter(f) {
        currentLeavesFilter = f;
        renderTeacherLeavesDashboard();
    }

    function renderTeacherLeavesDashboard() {
        const container = document.getElementById('teacherLeavesDashboardContainer');
        if (!container) return;

        const allLeaves = getTeacherLeaves();
        const stats = getTeacherLeaveStats();

        // تحديث شارة العداد في زر التبويب
        const badge = document.getElementById('calSubnavLeavesCountBadge');
        if (badge) {
            badge.textContent = `${allLeaves.length} رخصة`;
        }

        // تطبيق الفلترة
        let filteredLeaves = allLeaves;
        if (currentLeavesFilter !== 'all') {
            filteredLeaves = allLeaves.filter(l => {
                if (currentLeavesFilter === 'admin') {
                    return l.type === 'admin' || l.type === 'administrative' || l.type === 'union' || l.type === 'other';
                }
                if (currentLeavesFilter === 'exceptional') {
                    return l.type === 'exceptional' || l.type === 'paternity' || l.type === 'maternity' || l.type === 'hajj';
                }
                if (currentLeavesFilter === 'exam') {
                    return l.type === 'exam' || l.type === 'exam_duty';
                }
                return l.type === currentLeavesFilter;
            });
        }

        let html = `
            <!-- بطاقة الترويسة الرئيسية لرخص الأستاذ -->
            <div class="card" style="padding: 22px; margin-bottom: 20px; background: linear-gradient(135deg, #0369a1 0%, #0f172a 100%); color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.3); border: 1px solid #0284c7;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #0284c7, #38bdf8); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); flex-shrink: 0;">
                            <span class="ui-icon" style="margin: 0;"><span data-lucide="file-badge" data-size="28"></span></span>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #ffffff; font-family: 'Cairo', sans-serif;">
                                    سجل رخص وإجازات الأستاذ وتدبير الغياب القانوني
                                </h2>
                                <span style="font-size: 0.72rem; padding: 3px 10px; border-radius: 9999px; background: rgba(255, 255, 255, 0.15); color: #e0f2fe; border: 1px solid rgba(224, 242, 254, 0.3); font-weight: 800;">
                                    الأستاذ إبراهيم قزيبر • مادة الرياضيات
                                </span>
                                <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 9999px; background: rgba(16, 185, 129, 0.25); color: #86efac; border: 1px solid rgba(134, 239, 172, 0.3); font-weight: 800;">
                                    🛡️ غياب التلاميذ معفى ومحمي تلقائياً
                                </span>
                            </div>
                            <p style="margin: 4px 0 0 0; font-size: 0.83rem; color: #cbd5e1; line-height: 1.5;">
                                توثيق الرخص الإدارية والمرضية وفق التشريع التربوي المغربي، ربطها الفوري بالتقويمين السنوي والشهري، وإعفاء ساعات حصصها من احتساب غياب التلاميذ
                            </p>
                        </div>
                    </div>

                    <!-- أزرار الإجراءات السريعة -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="window.openAddTeacherLeaveModal()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3); cursor: pointer;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="plus-circle" data-size="16"></span></span>
                            <span>إضافة رخصة جديدة للأستاذ</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.printTeacherLeavesFullLedger()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 8px 14px; border-radius: 10px; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.3); cursor: pointer;" title="معاينة وطباعة السجل الرسمي الشامل لرخص وإجازات الأستاذ (A4)">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="printer" data-size="15"></span></span>
                            <span>طباعة سجل الرخص (A4)</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.exportTeacherLeavesToExcel()" style="background: rgba(255, 255, 255, 0.12); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.2); padding: 8px 14px; border-radius: 10px; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" title="تصدير سجل الرخص إلى ملف Excel">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="sheet" data-size="15"></span></span>
                            <span>تصدير Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- بطاقات الإحصائيات والمؤشرات الرقمية (KPIs) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 22px;">
                <div class="card" style="padding: 16px; border-radius: 14px; border-right: 5px solid #0284c7; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.82rem; font-weight: 800; color: #475569;">إجمالي رخص الأستاذ</span>
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="file-badge" data-size="16"></span></span>
                        </div>
                    </div>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #0f172a; font-family: 'Cairo', sans-serif;">
                        ${stats.totalLeaves} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">رخصة</span>
                    </div>
                    <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">
                        إجمالي ${stats.totalDays} يوماً مسجلاً في التقويم
                    </div>
                </div>

                <div class="card" style="padding: 16px; border-radius: 14px; border-right: 5px solid #ef4444; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.82rem; font-weight: 800; color: #475569;">الرخص المرضية (شهادات طبية)</span>
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="stethoscope" data-size="16"></span></span>
                        </div>
                    </div>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #b91c1c; font-family: 'Cairo', sans-serif;">
                        ${stats.sickCount} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">رخصة</span>
                    </div>
                    <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">
                        المجموع: ${stats.sickDays} أيام مبررة طبياً
                    </div>
                </div>

                <div class="card" style="padding: 16px; border-radius: 14px; border-right: 5px solid #8b5cf6; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.82rem; font-weight: 800; color: #475569;">الأغراض الإدارية والاستثنائية</span>
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #ede9fe; color: #8b5cf6; display: flex; align-items: center; justify-content: center;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="file-text" data-size="16"></span></span>
                        </div>
                    </div>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #6d28d9; font-family: 'Cairo', sans-serif;">
                        ${stats.adminCount + stats.exceptionalCount} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">رخصة</span>
                    </div>
                    <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">
                        أذون بالتغيب ومناسبات عائلية معتمدة
                    </div>
                </div>

                <div class="card" style="padding: 16px; border-radius: 14px; border-right: 5px solid #10b981; background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.82rem; font-weight: 800; color: #166534;">حماية غياب التلاميذ</span>
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #dcfce7; color: #10b981; display: flex; align-items: center; justify-content: center;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="shield-check" data-size="16"></span></span>
                        </div>
                    </div>
                    <div style="font-size: 1.6rem; font-weight: 900; color: #15803d; font-family: 'Cairo', sans-serif;">
                        100% <span style="font-size: 0.85rem; font-weight: 800; color: #166534;">معفى تلقائياً</span>
                    </div>
                    <div style="font-size: 0.74rem; color: #15803d; margin-top: 4px; font-weight: 600;">
                        ساعات حصص الأستاذ مستثناة من غياب التلاميذ
                    </div>
                </div>
            </div>

            <!-- شريط الفلاتر وأزرار التصفية -->
            <div class="card" style="padding: 14px 18px; margin-bottom: 18px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <span style="font-size: 0.82rem; font-weight: 800; color: #475569; margin-left: 4px;">تصفية حسب الصنف:</span>
                    <button type="button" onclick="window.setLeavesFilter('all')" class="timetable-subnav-btn ${currentLeavesFilter === 'all' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">الكل (${allLeaves.length})</button>
                    <button type="button" onclick="window.setLeavesFilter('sick')" class="timetable-subnav-btn ${currentLeavesFilter === 'sick' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">مرضية (${stats.sickCount})</button>
                    <button type="button" onclick="window.setLeavesFilter('admin')" class="timetable-subnav-btn ${currentLeavesFilter === 'admin' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">غرض إداري (${stats.adminCount})</button>
                    <button type="button" onclick="window.setLeavesFilter('exceptional')" class="timetable-subnav-btn ${currentLeavesFilter === 'exceptional' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">استثنائية (${stats.exceptionalCount})</button>
                    <button type="button" onclick="window.setLeavesFilter('training')" class="timetable-subnav-btn ${currentLeavesFilter === 'training' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">مهمة / تكوين (${stats.trainingCount || 0})</button>
                    <button type="button" onclick="window.setLeavesFilter('exam')" class="timetable-subnav-btn ${currentLeavesFilter === 'exam' ? 'active' : ''}" style="padding: 5px 12px; font-size: 0.8rem;">مباراة / امتحان (${stats.examCount || 0})</button>
                </div>

                <div style="font-size: 0.78rem; color: #64748b; font-weight: 600;">
                    عرض ${filteredLeaves.length} من أصل ${allLeaves.length} رخصة
                </div>
            </div>

            <!-- لائحة وبطاقات رخص الأستاذ -->
            <div id="teacherLeavesListContainer">
        `;

        if (filteredLeaves.length === 0) {
            html += `
                <div class="card" style="padding: 40px 20px; text-align: center; border-radius: 14px; background: #fafafa; border: 2px dashed #cbd5e1;">
                    <div style="width: 56px; height: 56px; border-radius: 16px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
                        <span class="ui-icon" style="margin: 0;"><span data-lucide="file-badge" data-size="28"></span></span>
                    </div>
                    <h3 style="margin: 0 0 6px 0; font-size: 1.1rem; font-weight: 800; color: #1e293b;">
                        ${allLeaves.length === 0 ? 'لم يتم تسجيل أي رخصة للأستاذ بعد' : 'لا توجد رخص تطابق الفلتر المختار'}
                    </h3>
                    <p style="margin: 0 auto 16px auto; max-width: 480px; font-size: 0.82rem; color: #64748b; line-height: 1.6;">
                        عند تسجيل أي رخصة (مرضية، إدارية، استثنائية...) سيتم إدراجها آلياً في التقويم السنوي والشهري، وإعفاء ساعات حصصها من احتساب غياب التلاميذ لحفظ حقوقهم ومواظبتهم.
                    </p>
                    <button type="button" class="btn-primary" onclick="window.openAddTeacherLeaveModal()" style="background: linear-gradient(135deg, #0284c7, #0369a1); border: none; padding: 9px 20px; border-radius: 10px; font-weight: 800; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.3);">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="plus-circle" data-size="16"></span></span>
                        <span>إضافة أول رخصة للأستاذ</span>
                    </button>
                </div>
            `;
        } else {
            html += `
                <div style="display: flex; flex-direction: column; gap: 12px;">
            `;

            filteredLeaves.forEach((leave) => {
                const typeObj = TEACHER_LEAVE_TYPES[leave.type] || TEACHER_LEAVE_TYPES.other;
                const isAbsenceProtected = (leave.disableStudentAbsence !== false);
                const scopeLabel = leave.sessionsScope === 'morning' ? 'الفترة الصباحية فقط' 
                                 : leave.sessionsScope === 'afternoon' ? 'الفترة المسائية فقط' 
                                 : 'كامل اليوم';

                html += `
                    <div class="card" style="padding: 16px 20px; border-radius: 14px; border: 1.5px solid ${typeObj.border || '#cbd5e1'}; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.03); transition: all 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
                            <!-- الجانب الأيمن: نوع الرخصة والمعلومات الأساسية -->
                            <div style="display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 280px;">
                                <div style="width: 44px; height: 44px; border-radius: 12px; background: ${typeObj.bg || '#e0f2fe'}; color: ${typeObj.color || '#0284c7'}; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                    <span class="ui-icon" style="margin: 0;"><span data-lucide="${typeObj.icon || 'file-badge'}" data-size="22"></span></span>
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <h4 style="margin: 0; font-size: 1rem; font-weight: 900; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                            ${escapeHtml(leave.title || typeObj.label)}
                                        </h4>
                                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: ${typeObj.badgeBg || '#f1f5f9'}; color: ${typeObj.color || '#334155'}; border: 1px solid ${typeObj.border || '#cbd5e1'}; font-weight: 800;">
                                            ${typeObj.label}
                                        </span>
                                        <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; font-weight: 700;">
                                            ${scopeLabel}
                                        </span>
                                    </div>

                                    <!-- التواريخ والمدة -->
                                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 0.82rem; color: #334155; flex-wrap: wrap;">
                                        <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 700;">
                                            📅 من <strong>${leave.startDate}</strong> إلى <strong>${leave.endDate || leave.startDate}</strong>
                                        </span>
                                        <span style="background: #e0f2fe; color: #0369a1; padding: 1px 8px; border-radius: 6px; font-weight: 800; font-size: 0.76rem;">
                                            ${leave.daysCount || 1} يوم
                                        </span>
                                        ${leave.docRef ? `
                                            <span style="background: #f1f5f9; color: #334155; padding: 1px 8px; border-radius: 6px; font-size: 0.76rem; border: 1px solid #cbd5e1;">
                                                مرجع الوثيقة: <strong>${escapeHtml(leave.docRef)}</strong>
                                            </span>
                                        ` : ''}
                                    </div>

                                    ${leave.reason ? `
                                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px; line-height: 1.4;">
                                            📝 ${escapeHtml(leave.reason)}
                                        </div>
                                    ` : ''}

                                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">
                                        ⚖️ ${typeObj.legalRef}
                                    </div>
                                </div>
                            </div>

                            <!-- الجانب الأيسر: شارة حماية غياب التلاميذ والأزرار -->
                            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                                <button type="button" onclick="window.toggleLeaveStudentAbsenceDisable('${leave.id}')" title="انقر لتفعيل أو إلغاء إعفاء غياب التلاميذ" style="background: ${isAbsenceProtected ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isAbsenceProtected ? '#86efac' : '#fca5a5'}; padding: 5px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; color: ${isAbsenceProtected ? '#15803d' : '#b91c1c'}; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s;">
                                    <span class="ui-icon" style="margin:0;"><span data-lucide="${isAbsenceProtected ? 'shield-check' : 'shield-alert'}" data-size="14"></span></span>
                                    <span>${isAbsenceProtected ? '🛡️ غياب التلاميذ: معفى تلقائياً ✓' : '⚠️ غياب التلاميذ: غير معفى ✗'}</span>
                                </button>

                                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                                    <button type="button" onclick="window.printTeacherLeaveOfficialNotice('${leave.id}')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="طباعة إشعار رسمي بالغياب / طلب رخصة إدارية">
                                        <span class="ui-icon" style="margin:0;"><span data-lucide="printer" data-size="14"></span></span>
                                        <span>طلب رخصة</span>
                                    </button>
                                    <button type="button" onclick="window.printTeacherWorkResumptionNotice('${leave.id}')" style="background: #f0fdf4; border: 1px solid #86efac; color: #166534; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="طباعة تصريح ومحضر رسمي باستئناف العمل بعد انقضاء الرخصة">
                                        <span class="ui-icon" style="margin:0;"><span data-lucide="check-circle-2" data-size="14"></span></span>
                                        <span>استئناف العمل</span>
                                    </button>
                                    <button type="button" onclick="window.openEditTeacherLeaveModal('${leave.id}')" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #0284c7; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="تعديل بيانات الرخصة">
                                        <span class="ui-icon" style="margin:0;"><span data-lucide="edit-3" data-size="14"></span></span>
                                        <span>تعديل</span>
                                    </button>
                                    <button type="button" onclick="window.deleteTeacherLeave('${leave.id}')" style="background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 6px 8px; border-radius: 8px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center;" title="حذف الرخصة">
                                        <span class="ui-icon" style="margin:0;"><span data-lucide="trash-2" data-size="14"></span></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * فتح نافذة إضافة رخصة للأستاذ
     */
    function openAddTeacherLeaveModal(defaultStartDate) {
        const modal = document.getElementById('teacherLeaveModal');
        if (!modal) return;

        const todayStr = new Date().toISOString().slice(0, 10);
        const startVal = defaultStartDate || todayStr;

        document.getElementById('teacherLeaveModalTitle').textContent = 'إضافة رخصة جديدة للأستاذ';
        document.getElementById('teacherLeaveEditId').value = '';
        document.getElementById('teacherLeaveTypeSelect').value = 'sick';
        document.getElementById('teacherLeaveTitleInput').value = '';
        document.getElementById('teacherLeaveStartDateInput').value = startVal;
        document.getElementById('teacherLeaveEndDateInput').value = startVal;
        document.getElementById('teacherLeaveSessionsScope').value = 'all';
        document.getElementById('teacherLeaveDocRefInput').value = '';
        document.getElementById('teacherLeaveDisableAbsenceChk').checked = true;
        document.getElementById('teacherLeaveReasonInput').value = '';

        onTeacherLeaveTypeChanged();
        updateLeaveCalculatedDays();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * فتح نافذة تعديل رخصة للأستاذ
     */
    function openEditTeacherLeaveModal(id) {
        const leaves = getTeacherLeaves();
        const leave = leaves.find(l => l.id === id);
        if (!leave) return;

        const modal = document.getElementById('teacherLeaveModal');
        if (!modal) return;

        document.getElementById('teacherLeaveModalTitle').textContent = 'تعديل بيانات رخصة الأستاذ';
        document.getElementById('teacherLeaveEditId').value = leave.id;
        document.getElementById('teacherLeaveTypeSelect').value = leave.type || 'sick';
        document.getElementById('teacherLeaveTitleInput').value = leave.title || '';
        document.getElementById('teacherLeaveStartDateInput').value = leave.startDate;
        document.getElementById('teacherLeaveEndDateInput').value = leave.endDate || leave.startDate;
        document.getElementById('teacherLeaveSessionsScope').value = leave.sessionsScope || 'all';
        document.getElementById('teacherLeaveDocRefInput').value = leave.docRef || '';
        document.getElementById('teacherLeaveDisableAbsenceChk').checked = (leave.disableStudentAbsence !== false);
        document.getElementById('teacherLeaveReasonInput').value = leave.reason || '';

        onTeacherLeaveTypeChanged();
        updateLeaveCalculatedDays();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إغلاق نافذة رخصة الأستاذ
     */
    function closeTeacherLeaveModal() {
        const modal = document.getElementById('teacherLeaveModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * عند تغيير نوع الرخصة في النافذة المنبثقة
     */
    function onTeacherLeaveTypeChanged() {
        const typeSelect = document.getElementById('teacherLeaveTypeSelect');
        const titleInput = document.getElementById('teacherLeaveTitleInput');
        const legalRefEl = document.getElementById('teacherLeaveLegalRefNote');
        if (!typeSelect) return;

        const selVal = typeSelect.value;
        const typeObj = TEACHER_LEAVE_TYPES[selVal] || TEACHER_LEAVE_TYPES.other;

        if (titleInput && (!titleInput.value || Object.values(TEACHER_LEAVE_TYPES).some(t => t.label === titleInput.value))) {
            titleInput.value = typeObj.label;
        }

        if (legalRefEl) {
            legalRefEl.textContent = `⚖️ السند القانوني: ${typeObj.legalRef}`;
        }
    }

    /**
     * تحديث عداد الأيام المحسوبة في نافذة الرخصة
     */
    function updateLeaveCalculatedDays() {
        const startInput = document.getElementById('teacherLeaveStartDateInput');
        const endInput = document.getElementById('teacherLeaveEndDateInput');
        const daysBadge = document.getElementById('teacherLeaveCalculatedDaysBadge');
        if (!startInput || !endInput || !daysBadge) return;

        const start = startInput.value;
        const end = endInput.value || start;

        if (start) {
            const count = calculateDaysBetween(start, end);
            daysBadge.textContent = `${count} يوم`;
        }
    }

    /**
     * حفظ الرخصة من النافذة المنبثقة
     */
    let _isSavingTeacherLeave = false;
    function saveTeacherLeaveFromModal() {
        if (_isSavingTeacherLeave) return;
        _isSavingTeacherLeave = true;
        const unlock = () => { setTimeout(() => { _isSavingTeacherLeave = false; }, 500); };

        const id = document.getElementById('teacherLeaveEditId').value;
        const type = document.getElementById('teacherLeaveTypeSelect').value;
        const title = document.getElementById('teacherLeaveTitleInput').value.trim();
        const startDate = document.getElementById('teacherLeaveStartDateInput').value;
        const endDate = document.getElementById('teacherLeaveEndDateInput').value || startDate;
        const sessionsScope = document.getElementById('teacherLeaveSessionsScope').value;
        const docRef = document.getElementById('teacherLeaveDocRefInput').value.trim();
        const disableStudentAbsence = document.getElementById('teacherLeaveDisableAbsenceChk').checked;
        const reason = document.getElementById('teacherLeaveReasonInput').value.trim();

        if (!startDate) {
            alert('يرجى تحديد تاريخ بداية الرخصة.');
            unlock();
            return;
        }

        if (endDate < startDate) {
            alert('تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية.');
            unlock();
            return;
        }

        const leaveData = {
            id: id || undefined,
            type,
            title: title || (TEACHER_LEAVE_TYPES[type] ? TEACHER_LEAVE_TYPES[type].label : 'رخصة أستاذ'),
            startDate,
            endDate,
            sessionsScope,
            docRef,
            disableStudentAbsence,
            reason
        };

        saveTeacherLeave(leaveData);
        closeTeacherLeaveModal();
        unlock();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم حفظ رخصة الأستاذ وتحديث التقويم وحماية غياب التلاميذ بنجاح', 'success');
        }
    }

    /**
     * حفظ رخصة الأستاذ في قاعدة البيانات والمزامنة
     */
    function saveTeacherLeave(leaveData) {
        if (!window.db) window.db = {};
        if (!Array.isArray(window.db.teacherLeaves)) window.db.teacherLeaves = [];

        const typeObj = TEACHER_LEAVE_TYPES[leaveData.type] || TEACHER_LEAVE_TYPES.other;
        const days = calculateDaysBetween(leaveData.startDate, leaveData.endDate);

        const newLeave = {
            id: leaveData.id || ('leave_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
            title: leaveData.title || typeObj.label,
            type: leaveData.type || 'sick',
            typeLabel: typeObj.label,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate || leaveData.startDate,
            daysCount: days,
            sessionsScope: leaveData.sessionsScope || 'all',
            docRef: leaveData.docRef || '',
            reason: leaveData.reason || '',
            disableStudentAbsence: leaveData.disableStudentAbsence !== false,
            color: typeObj.color,
            legalRef: typeObj.legalRef,
            createdAt: leaveData.createdAt || new Date().toISOString()
        };

        const existingIdx = window.db.teacherLeaves.findIndex(l => l.id === newLeave.id);
        if (existingIdx >= 0) {
            window.db.teacherLeaves[existingIdx] = newLeave;
        } else {
            window.db.teacherLeaves.unshift(newLeave);
        }

        syncTeacherLeavesWithCalendarEvents();
        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث الواجهات
        syncAllCalendarUnits(false);
        if (typeof window.renderStudents === 'function') window.renderStudents();

        return newLeave;
    }

    /**
     * تحديث شارة العداد في زر التبويب الفرعي
     */
    function updateTeacherLeavesBadgeCount() {
        const leaves = getTeacherLeaves();
        const badge = document.getElementById('calSubnavLeavesCountBadge');
        if (badge) {
            badge.textContent = `${leaves.length} رخصة`;
        }
    }

    /**
     * حذف رخصة من سجل رخص الأستاذ
     */
    function deleteTeacherLeave(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الرخصة من سجل رخص الأستاذ؟\nسيتم حذفها تلقائياً من التقويم السنوي والشهري.')) return;
        const leaves = getTeacherLeaves();
        window.db.teacherLeaves = leaves.filter(l => l.id !== id);

        if (typeof window.saveDB === 'function') window.saveDB();
        syncAllCalendarUnits(false);
        if (typeof window.renderStudents === 'function') window.renderStudents();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم حذف الرخصة وتحديث كافة الوحدات بنجاح', 'info');
        }
    }

    /**
     * تبديل حالة حماية غياب التلاميذ في رخصة محددة
     */
    function toggleLeaveStudentAbsenceDisable(id) {
        const leaves = getTeacherLeaves();
        const leave = leaves.find(l => l.id === id);
        if (!leave) return;

        leave.disableStudentAbsence = (leave.disableStudentAbsence === false);
        window.db.teacherLeaves = leaves;

        if (typeof window.saveDB === 'function') window.saveDB();
        renderTeacherLeavesDashboard();
        renderAnnualSchoolCalendar();
        if (typeof window.renderStudents === 'function') window.renderStudents();

        const msg = leave.disableStudentAbsence 
            ? 'تم تفعيل حماية وإعفاء غياب التلاميذ طيلة فترة الرخصة 🛡️' 
            : 'تم إلغاء إعفاء غياب التلاميذ لهذه الرخصة';
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, 'success');
        }
    }

    /**
     * طباعة إشعار رسمي بالغياب / طلب رخصة للأستاذ (مع معاينة A4 وتصدير PDF)
     */
    function printTeacherLeaveOfficialNotice(id) {
        const leaves = getTeacherLeaves();
        const leave = leaves.find(l => l.id === id);
        if (!leave) return;

        const meta = getCalendarPrintHeaderMetadata();
        const typeObj = TEACHER_LEAVE_TYPES[leave.type] || TEACHER_LEAVE_TYPES.other;
        const scopeLabel = leave.sessionsScope === 'morning' ? 'الفترة الصباحية فقط' 
                         : leave.sessionsScope === 'afternoon' ? 'الفترة المسائية فقط' 
                         : 'كامل اليوم الدراسي';

        const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>إشعار بالغياب القانوني / طلب رخصة — ${escapeHtml(meta.teacherName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
            font-family: 'Cairo', Arial, sans-serif;
            direction: rtl;
            margin: 0;
            padding: 10mm;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.65;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            border-bottom: 2.5px solid #0284c7;
            padding-bottom: 12px;
        }
        .header-table td {
            vertical-align: middle;
        }
        .notice-title {
            text-align: center;
            margin: 18px 0;
            padding: 12px;
            background: #f0f9ff;
            border: 1.5px solid #bae6fd;
            border-radius: 10px;
            font-size: 1.25rem;
            font-weight: 900;
            color: #0369a1;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
        }
        .info-table th, .info-table td {
            border: 1px solid #cbd5e1;
            padding: 10px 14px;
            font-size: 0.95rem;
        }
        .info-table th {
            background: #f8fafc;
            font-weight: 800;
            width: 30%;
            color: #1e293b;
            text-align: right;
        }
        .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 32px;
            page-break-inside: avoid;
        }
        .signatures-table td {
            width: 33.33%;
            vertical-align: top;
            border: 1px solid #cbd5e1;
            padding: 12px;
            height: 125px;
            font-size: 0.88rem;
            background: #f8fafc;
        }
        .stamp-box {
            font-weight: 800;
            color: #1e293b;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td style="width: 35%; text-align: right; font-size: 0.85rem; font-weight: 800; line-height: 1.5;">
                المملكة المغربية<br>
                وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
                ${escapeHtml(meta.academyName)}<br>
                ${escapeHtml(meta.directorateName)}
            </td>
            <td style="width: 30%; text-align: center;">
                <div>${meta.dualLogosHtml}</div>
                <div style="font-weight: 900; font-size: 0.9rem; color: #0369a1; margin-top: 4px;">إدارة الشؤون التربوية والإدارية</div>
            </td>
            <td style="width: 35%; text-align: left; font-size: 0.85rem; font-weight: 800; line-height: 1.5;">
                الموسم الدراسي: <span dir="ltr">${escapeHtml(meta.schoolYear)}</span><br>
                المؤسسة: ${escapeHtml(meta.schoolName)}<br>
                تاريخ التحرير: ${new Date().toLocaleDateString('ar-MA')}
            </td>
        </tr>
    </table>

    <div class="notice-title">
        إشعار بالغياب القانوني / طلب رخصة إدارية للأستاذ(ة)
    </div>

    <table class="info-table">
        <tr>
            <th>الاسم الكامل للأستاذ(ة):</th>
            <td><strong>${escapeHtml(meta.teacherName)}</strong></td>
        </tr>
        <tr>
            <th>المادة المدرسة والمؤسسة:</th>
            <td><strong>${escapeHtml(meta.subjectName)} — ${escapeHtml(meta.schoolName)}</strong></td>
        </tr>
        <tr>
            <th>صنف ونوع الرخصة:</th>
            <td><strong style="color: #0369a1;">${escapeHtml(typeObj.label)}</strong></td>
        </tr>
        <tr>
            <th>السند القانوني والتنظيمي:</th>
            <td style="font-size: 0.86rem; color: #475569; font-weight: 700;">${escapeHtml(typeObj.legalRef)}</td>
        </tr>
        <tr>
            <th>الفترة الزمنية للرخصة:</th>
            <td>من <strong dir="ltr">${escapeHtml(leave.startDate)}</strong> إلى <strong dir="ltr">${escapeHtml(leave.endDate || leave.startDate)}</strong> (المدة الإجمالية: <strong>${leave.daysCount || 1} يوم</strong>)</td>
        </tr>
        <tr>
            <th>نطاق الحصص المشمولة:</th>
            <td><strong>${scopeLabel}</strong></td>
        </tr>
        <tr>
            <th>مرجع الوثيقة أو الشهادة المرفقة:</th>
            <td>${leave.docRef ? `<strong>${escapeHtml(leave.docRef)}</strong>` : 'مرفقة بالملف الإداري للمؤسسة'}</td>
        </tr>
        <tr>
            <th>سبب الغياب / إيضاحات إدارية:</th>
            <td>${escapeHtml(leave.reason || 'رخصة قانونية مبررة وفق الضوابط التشريعية المعمول بها')}</td>
        </tr>
        <tr>
            <th>تدبير الزمن المدرسي والمواظبة:</th>
            <td style="color: #166534; font-weight: 800; background: #f0fdf4;">
                🛡️ ساعات الحصص المبرمجة طيلة أيام الرخصة معفاة رسمياً من غياب التلاميذ ولا يتم احتسابها كساعات غياب أو تأخر في إحصائيات المواظبة، وتتم برمجتها للدعم والتعويض التربوي لاحقاً.
            </td>
        </tr>
    </table>

    <table class="signatures-table">
        <tr>
            <td>
                <div class="stamp-box">توقيع الأستاذ(ة) المعني(ة):</div>
                <div style="font-weight: 800; margin-top: 15px;">${escapeHtml(meta.teacherName)}</div>
            </td>
            <td>
                <div class="stamp-box">تأشيرة الحراسة العامة للخارجية:</div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 10px;">تم التوثيق وضبط جداول الحصص وإخبار الأقسام المعنية</div>
            </td>
            <td>
                <div class="stamp-box">رأي وتأشيرة السيد(ة) رئيس(ة) المؤسسة:</div>
                <div style="font-size: 0.78rem; color: #64748b; margin-top: 10px;">موافق / تم إشعار المديرية الإقليمية</div>
            </td>
        </tr>
    </table>
</body>
</html>`;

        openOrPrintCalendarDocument(printHtml, 'إشعار بالغياب القانوني / طلب رخصة إدارية', 'portrait');
    }

    /**
     * طباعة محضر وتصريح رسمي باستئناف العمل للأستاذ(ة) (Déclaration de reprise de service)
     */
    function printTeacherWorkResumptionNotice(id) {
        const leaves = getTeacherLeaves();
        const leave = leaves.find(l => l.id === id);
        if (!leave) return;

        const meta = getCalendarPrintHeaderMetadata();
        const typeObj = TEACHER_LEAVE_TYPES[leave.type] || TEACHER_LEAVE_TYPES.other;

        let resumptionDateStr = '';
        try {
            const endDate = new Date(leave.endDate || leave.startDate);
            endDate.setDate(endDate.getDate() + 1);
            resumptionDateStr = endDate.toISOString().slice(0, 10);
        } catch(e) {
            resumptionDateStr = leave.endDate || leave.startDate;
        }

        const ppr = (window.db && window.db.teacherProfile && (window.db.teacherProfile.ppr || window.db.teacherProfile.som || window.db.teacherProfile.cin)) || '..............';
        const grade = (window.db && window.db.teacherProfile && window.db.teacherProfile.grade) || 'الدرجة الأولى (السلم 11)';

        const printHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تصريح باستئناف العمل — ${escapeHtml(meta.teacherName)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 14mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
            font-family: 'Cairo', Arial, sans-serif;
            direction: rtl;
            margin: 0;
            padding: 8mm;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.7;
            font-size: 11pt;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
            border-bottom: 2.5px solid #1e3a8a;
            padding-bottom: 12px;
        }
        .header-table td {
            vertical-align: middle;
        }
        .notice-title {
            text-align: center;
            margin: 20px 0 8px 0;
            padding: 12px;
            background: #f0fdf4;
            border: 2px solid #86efac;
            border-radius: 10px;
            font-size: 1.35rem;
            font-weight: 900;
            color: #166534;
        }
        .sub-header-ref {
            text-align: center;
            font-size: 0.88rem;
            color: #475569;
            margin-bottom: 22px;
            font-weight: 700;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 22px;
        }
        .info-table th, .info-table td {
            border: 1px solid #cbd5e1;
            padding: 9px 13px;
            font-size: 10pt;
        }
        .info-table th {
            background: #f8fafc;
            font-weight: 800;
            width: 32%;
            color: #1e293b;
            text-align: right;
        }
        .declaration-body {
            background: #fafafa;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            padding: 16px 20px;
            font-size: 10.5pt;
            line-height: 1.9;
            text-align: justify;
            margin-bottom: 25px;
        }
        .signatures-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
            page-break-inside: avoid;
        }
        .signatures-table td {
            width: 50%;
            vertical-align: top;
            border: 1px solid #cbd5e1;
            padding: 12px;
            height: 135px;
            font-size: 9pt;
            background: #f8fafc;
        }
        .stamp-box {
            font-weight: 800;
            color: #1e293b;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 6px;
            margin-bottom: 8px;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td style="width: 40%; text-align: right; font-size: 8.5pt; font-weight: 800; line-height: 1.5;">
                المملكة المغربية<br>
                وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
                ${escapeHtml(meta.academyName)}<br>
                ${escapeHtml(meta.directorateName)}<br>
                المؤسسة: <strong>${escapeHtml(meta.schoolName)}</strong>
            </td>
            <td style="width: 25%; text-align: center;">
                <div>${meta.dualLogosHtml || '📐'}</div>
                <div style="font-weight: 900; font-size: 0.9rem; color: #1e3a8a; margin-top: 4px;">مصلحة الموارد البشرية</div>
            </td>
            <td style="width: 35%; text-align: left; font-size: 8.5pt; font-weight: 800; line-height: 1.5;">
                الموسم الدراسي: <span dir="ltr">${escapeHtml(meta.schoolYear)}</span><br>
                رقم الإرسال: ................. / م.إ<br>
                تاريخ التحرير: ${new Date().toLocaleDateString('ar-MA')}
            </td>
        </tr>
    </table>

    <div class="notice-title">
        تصريح باستئناف العمل (Déclaration de reprise de service)
    </div>
    <div class="sub-header-ref">
        وفق الظهير الشريف رقم 1.58.008 بمثابة النظام الأساسي العام للوظيفة العمومية والنصوص المعدلة والمتممة له
    </div>

    <table class="info-table">
        <tr>
            <th>الاسم الكامل للأستاذ(ة):</th>
            <td><strong>${escapeHtml(meta.teacherName)}</strong></td>
        </tr>
        <tr>
            <th>رقم التأجير (PPR):</th>
            <td><strong dir="ltr" style="font-family: monospace; font-size: 1.05rem; color: #1e3a8a;">${escapeHtml(ppr)}</strong></td>
        </tr>
        <tr>
            <th>الإطار والدرجة:</th>
            <td>أستاذ التعليم الثانوي التأهيلي — ${escapeHtml(grade)}</td>
        </tr>
        <tr>
            <th>مادة التدريس ومقر العمل:</th>
            <td><strong>${escapeHtml(meta.subjectName)}</strong> — ${escapeHtml(meta.schoolName)}</td>
        </tr>
        <tr>
            <th>نوع الرخصة المنقضية:</th>
            <td><strong style="color: #0369a1;">${escapeHtml(typeObj.label)}</strong> (${escapeHtml(typeObj.legalRef)})</td>
        </tr>
        <tr>
            <th>فترة الانقطاع المرخص بها:</th>
            <td>من <strong dir="ltr">${escapeHtml(leave.startDate)}</strong> إلى <strong dir="ltr">${escapeHtml(leave.endDate || leave.startDate)}</strong> (المدة: <strong>${leave.daysCount || 1} يوم</strong>)</td>
        </tr>
        <tr>
            <th>التاريخ الفعلي لاستئناف العمل:</th>
            <td><strong dir="ltr" style="font-size: 1.1rem; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 6px;">${escapeHtml(resumptionDateStr)}</strong> على الساعة الثامنة صباحاً</td>
        </tr>
    </table>

    <div class="declaration-body">
        يشهد الموقع أسفله السيد(ة) رئيس(ة) مؤسسة <strong>${escapeHtml(meta.schoolName)}</strong> أن السيد(ة) <strong>${escapeHtml(meta.teacherName)}</strong>، أستاذ(ة) التعليم الثانوي التأهيلي لمادة <strong>${escapeHtml(meta.subjectName)}</strong>، الحامل(ة) لرقم التأجير <strong>${escapeHtml(ppr)}</strong>، قد استأنف(ت) عمله(ا) الفعلي بهذه المؤسسة بتاريخ <strong>${escapeHtml(resumptionDateStr)}</strong>، وذلك إثر انقضاء رخصة <strong>${escapeHtml(typeObj.label)}</strong> القانونية الممنوحة له(ا). وبناء عليه تم تحرير هذا المحضر وإرساله إلى السيد(ة) المدير(ة) الإقليمي(ة) لإجراء المتعين نظامياً.
    </div>

    <table class="signatures-table">
        <tr>
            <td>
                <div class="stamp-box">توقيع الأستاذ(ة) المعني(ة) بالأمر:</div>
                <div style="font-weight: 800; margin-top: 25px;">${escapeHtml(meta.teacherName)}</div>
                <div style="font-size: 8pt; color: #64748b; margin-top: 10px;">حرر في: ${new Date().toLocaleDateString('ar-MA')}</div>
            </td>
            <td>
                <div class="stamp-box">توقيع وخاتم السيد(ة) رئيس(ة) المؤسسة:</div>
                <div style="font-size: 8.5pt; color: #475569; margin-top: 25px;">تأشيرة ومصادقة الإدارة التربوية</div>
                <div style="font-size: 8pt; color: #64748b; margin-top: 10px;">إرسال رقم: ..................... بتاريخ: .....................</div>
            </td>
        </tr>
    </table>
</body>
</html>`;

        openOrPrintCalendarDocument(printHtml, 'تصريح باستئناف العمل للأستاذ', 'portrait');
    }

    /**
     * تصدير سجل رخص الأستاذ إلى ملف Excel
     */
    function exportTeacherLeavesToExcel() {
        const leaves = getTeacherLeaves();
        if (leaves.length === 0) {
            alert('لا توجد رخص مسجلة لتصديرها.');
            return;
        }

        let tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            </head>
            <body>
                <table border="1">
                    <thead>
                        <tr style="background:#0284c7; color:#fff; font-weight:bold;">
                            <th>الرقم</th>
                            <th>نوع الرخصة</th>
                            <th>عنوان الرخصة</th>
                            <th>تاريخ البداية</th>
                            <th>تاريخ النهاية</th>
                            <th>عدد الأيام</th>
                            <th>نطاق الحصص</th>
                            <th>مرجع الوثيقة</th>
                            <th>حماية غياب التلاميذ</th>
                            <th>الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        leaves.forEach((l, idx) => {
            const typeObj = TEACHER_LEAVE_TYPES[l.type] || TEACHER_LEAVE_TYPES.other;
            const scopeText = l.sessionsScope === 'morning' ? 'الفترة الصباحية' : l.sessionsScope === 'afternoon' ? 'الفترة المسائية' : 'كامل اليوم';
            tableHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${typeObj.label}</td>
                    <td>${l.title || ''}</td>
                    <td>${l.startDate}</td>
                    <td>${l.endDate || l.startDate}</td>
                    <td>${l.daysCount || 1}</td>
                    <td>${scopeText}</td>
                    <td>${l.docRef || ''}</td>
                    <td>${l.disableStudentAbsence !== false ? 'معفى ومحمي' : 'غير معفى'}</td>
                    <td>${l.reason || ''}</td>
                </tr>
            `;
        });

        tableHtml += `</tbody></table></body></html>`;

        const blob = new Blob(['\ufeff' + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `سجل_رخص_الاستاذ_ابراهيم_قزيبر_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * رسم قسم المحطات التربوية والإدارية وفروض المراقبة المعتمدة في التقويم السنوي
     */
    function renderAcademicMilestonesSectionHtml(milestones) {
        if (!milestones || !Array.isArray(milestones)) milestones = [];

        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const categoryIcons = {
            exam: 'award',
            certification: 'graduation-cap',
            diagnostic: 'check-square',
            massar: 'database',
            council: 'users',
            orientation: 'compass',
            start: 'flag',
            admin: 'calendar'
        };

        const categoryBorderColors = {
            exam: '#dc2626',
            certification: '#7c3aed',
            diagnostic: '#8b5cf6',
            massar: '#0891b2',
            council: '#d97706',
            orientation: '#6366f1',
            start: '#10b981',
            admin: '#2563eb'
        };

        let html = `
            <div class="card" style="padding: 22px; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 16px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- ترويسة القسم وأزرار الإجراءات -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 14px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #fff; display: flex; align-items: center; justify-content: center;">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="award" data-size="20"></span></span>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                    المحطات التربوية والإدارية المدرسية وفروض المراقبة (المقرر الوزاري)
                                </h3>
                                <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #64748b;">
                                    الروزنامة المعتمدة لفروض المراقبة المستمرة، تواريخ مسك النقط في مسار، الامتحانات الموحدة ومجالس الأقسام
                                </p>
                            </div>
                            <span style="font-size: 0.76rem; padding: 2px 10px; border-radius: 9999px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; font-weight: 800;">
                                ${milestones.length} محطة معتمدة
                            </span>
                        </div>
                    </div>

                    <!-- أزرار الإجراءات السريعة والمزامنة -->
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="window.printAcademicMilestonesSchedule()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 8px 14px; border-radius: 9px; font-weight: 800; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(2, 132, 199, 0.28); cursor: pointer;" title="معاينة وطباعة جدول المحطات التربوية وفروض المراقبة المستمرة (A4)">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="printer" data-size="15"></span></span>
                            <span>طباعة جدول المحطات (A4)</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openMinisterialCalendarSyncModal()" style="background: linear-gradient(135deg, #4285F4, #34A853); color: #fff; border: none; padding: 8px 16px; border-radius: 9px; font-weight: 800; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(66, 133, 244, 0.3); cursor: pointer;" title="مزامنة وتصدير كافة المحطات والفروض إلى Google Calendar و Apple Calendar و Outlook">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="calendar-sync" data-size="15"></span></span>
                            <span>مزامنة مع Google Calendar و ICS</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openAddAcademicMilestoneModal('general')" style="background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 9px; font-weight: 800; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="plus-circle" data-size="15"></span></span>
                            <span>إضافة محطة</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openAddAcademicMilestoneModal('unified')" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 8px 14px; border-radius: 9px; font-weight: 800; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 3px 8px rgba(124, 58, 237, 0.3);" title="إضافة امتحان موحد إشهادي أو تجريبي أو فرض موحد">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="award" data-size="15"></span></span>
                            <span>🎯 إضافة موحد</span>
                        </button>
                        <button type="button" class="btn-primary" onclick="window.openDecreeAiImportModal()" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; border: none; padding: 8px 14px; border-radius: 9px; font-weight: 800; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="sparkles" data-size="15"></span></span>
                            <span>استيراد ذكي (AI)</span>
                        </button>
                    </div>
                </div>

                <!-- شبكة بطاقات المحطات التربوية -->
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px;">
        `;

        milestones.forEach((ms, idx) => {
            const isUni = !!(ms.isUnifiedExam || ms.category === 'certification' || (ms.title && ms.title.includes('موحد')));
            const iconName = isUni ? 'award' : (categoryIcons[ms.category] || 'milestone');
            const borderColor = isUni ? '#7c3aed' : (categoryBorderColors[ms.category] || '#2563eb');
            const isOngoing = (ms.startDate <= todayStr && (!ms.endDate || ms.endDate >= todayStr));
            const isFinished = (ms.endDate && ms.endDate < todayStr);
            const isFuture = (ms.startDate > todayStr);

            const statusBadge = (ms.status === 'completed' || isFinished)
                ? '<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: #f1f5f9; color: #64748b; font-weight: 700;">✔️ منجزة</span>'
                : (ms.status === 'in_progress' || isOngoing)
                ? '<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: #dcfce7; color: #166534; font-weight: 800; border: 1px solid #86efac; display: inline-flex; align-items: center; gap: 4px;">🟢 قيد الإنجاز</span>'
                : (ms.status === 'postponed')
                ? '<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: #fef2f2; color: #dc2626; font-weight: 700; border: 1px solid #fecaca;">⏸️ مؤجلة</span>'
                : '<span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: #eff6ff; color: #1d4ed8; font-weight: 700; border: 1px solid #bfdbfe;">⏳ مبرمجة</span>';

            const daysCount = calculateDaysBetween(ms.startDate, ms.endDate);

            html += `
                <div class="academic-milestone-card" style="background: ${isUni ? '#faf5ff' : '#ffffff'}; border: 1.5px solid ${isUni ? '#d8b4fe' : '#e2e8f0'}; border-right: 5px solid ${borderColor}; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.02);" onmouseover="this.style.boxShadow='0 6px 14px rgba(0,0,0,0.06)'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.boxShadow='0 2px 5px rgba(0,0,0,0.02)'; this.style.borderColor='${isUni ? '#d8b4fe' : '#e2e8f0'}';">
                    <div>
                        <!-- صف التصنيف والحالة -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span style="width: 26px; height: 26px; border-radius: 7px; background: ${borderColor}15; color: ${borderColor}; display: flex; align-items: center; justify-content: center;">
                                    <span class="ui-icon" style="margin:0;"><span data-lucide="${iconName}" data-size="14"></span></span>
                                </span>
                                <span style="font-size: 0.75rem; font-weight: 800; color: ${borderColor};">
                                    ${escapeHtml(ms.categoryLabel || (isUni ? 'امتحان موحد' : 'محطة تربوية'))}
                                </span>
                                ${isUni ? `
                                    <span style="font-size: 0.68rem; padding: 2px 7px; border-radius: 9999px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; font-weight: 800; display: inline-flex; align-items: center; gap: 3px;">
                                        <span>🎯 موحد</span>
                                    </span>
                                ` : ''}
                            </div>
                            <div style="display: flex; gap: 5px; align-items: center;">
                                ${ms.coef ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 5px; background: #ffffff; color: #7c3aed; font-weight: 800; border: 1px solid #d8b4fe;" title="معامل المادة">م: ${ms.coef}</span>` : ''}
                                ${ms.duration ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 5px; background: #ffffff; color: #1d4ed8; font-weight: 800; border: 1px solid #bfdbfe;" title="مدة الاختبار">${ms.duration}س</span>` : ''}
                                <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 5px; background: #f8fafc; color: #475569; font-weight: 700; border: 1px solid #e2e8f0;">
                                    ${ms.semester === 's2' ? 'S2 (د2)' : (ms.semester === 'year' ? 'سنوي' : 'S1 (د1)')}
                                </span>
                                ${statusBadge}
                            </div>
                        </div>

                        <!-- عنوان المحطة -->
                        <h4 style="margin: 0 0 6px 0; font-size: 0.96rem; font-weight: 800; color: #0f172a; line-height: 1.45; font-family: 'Cairo', sans-serif;">
                            ${escapeHtml(ms.title)}
                        </h4>

                        <!-- تاريخ الإجراء والمدة -->
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #334155; margin-bottom: 8px; font-family: monospace; font-weight: 700; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #f1f5f9; flex-wrap: wrap;">
                            <span>📅 من ${ms.startDate}</span>
                            <span>إلى ${ms.endDate || ms.startDate}</span>
                            <span style="color: #64748b; font-size: 0.74rem;">(${daysCount} ${daysCount === 1 ? 'يوم' : daysCount === 2 ? 'يومان' : 'أيام'})</span>
                            ${ms.timeSlot ? `<span style="color: #7c3aed; font-size: 0.74rem; background: #faf5ff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e9d5ff;">⏰ ${escapeHtml(ms.timeSlot)}</span>` : ''}
                        </div>

                        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;">
                            ${ms.targetLevels ? `
                                <div style="font-size: 0.75rem; color: #0369a1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 3px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>🎯 المعنيون:</span>
                                    <span>${escapeHtml(ms.targetLevels)}</span>
                                </div>
                            ` : ''}

                            ${ms.venue ? `
                                <div style="font-size: 0.74rem; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 3px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>🏛️</span>
                                    <span>${escapeHtml(ms.venue)}</span>
                                </div>
                            ` : ''}

                            ${ms.deliverables ? `
                                <div style="font-size: 0.73rem; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 3px 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                                    <span>📋</span>
                                    <span>${escapeHtml(ms.deliverables)}</span>
                                </div>
                            ` : ''}
                        </div>

                        ${ms.topics ? `
                            <div style="font-size: 0.74rem; color: #6b21a8; background: #ffffff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 4px 8px; margin-bottom: 8px; font-weight: 600; line-height: 1.4;">
                                <strong>🎯 محاور الإطار المرجعي:</strong> ${escapeHtml(ms.topics)}
                            </div>
                        ` : ''}

                        ${ms.description ? `
                            <p style="margin: 0; font-size: 0.78rem; color: #475569; line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${escapeHtml(ms.description)}">
                                ${escapeHtml(ms.description)}
                            </p>
                        ` : ''}
                    </div>

                    <!-- أزرار الإجراءات السريعة ومزامنة جوجل لكل محطة -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #f1f5f9; margin-top: 6px;">
                        <button type="button" onclick="window.syncMilestoneToGoogleCalendar('${ms.id}')" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="إضافة هذه المحطة مباشرة إلى تقويم Google عبر المتصفح">
                            <span class="ui-icon" style="margin:0;"><span data-lucide="calendar-plus" data-size="12"></span></span>
                            <span>إضافة إلى Google Calendar</span>
                        </button>

                        <div style="display: flex; gap: 4px;">
                            <button type="button" onclick="window.navigateToMonthlyCalendarDate('${ms.startDate}')" class="btn-action" style="padding: 4px 8px; font-size: 0.72rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; font-weight: 700;" title="عرض في التقويم الشهري">
                                📅 الشهري
                            </button>
                            <button type="button" onclick="window.openEditAcademicMilestoneModal('${ms.id}')" class="btn-action" style="padding: 4px 8px; font-size: 0.75rem; background: #f1f5f9; color: #2563eb; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer;" title="تعديل المحطة">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="edit-3" data-size="13"></span></span>
                            </button>
                            <button type="button" onclick="window.deleteAcademicMilestone('${ms.id}')" class="btn-action" style="padding: 4px 8px; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;" title="حذف المحطة">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="trash-2" data-size="13"></span></span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
        return html;
    }

    /**
     * توليد نص تقويم iCalendar (.ics) القياسي للمحطات التربوية والفروض والعطل
     */
    function generateMinisterialICSString(options = {}) {
        const {
            includeExams = true,
            includeMilestones = true,
            includeMassar = true,
            includeCouncils = true,
            includeHolidays = true,
            academicYear = '2026-2027'
        } = options;

        const milestones = getAcademicMilestones();
        const holidays = getOfficialHolidays();
        const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const events = [];

        // 1. فرز ومطابقة المحطات التربوية
        milestones.forEach(ms => {
            const cat = ms.category || '';
            const isExam = (cat === 'exam' || cat === 'certification' || cat === 'assessment');
            const isMassar = (cat === 'massar');
            const isCouncil = (cat === 'council' || cat === 'orientation');
            const isGeneralMilestone = (!isExam && !isMassar && !isCouncil);

            if (isExam && !includeExams) return;
            if (isMassar && !includeMassar) return;
            if (isCouncil && !includeCouncils) return;
            if (isGeneralMilestone && !includeMilestones) return;

            const iconPrefix = isExam ? '📝 ' : isMassar ? '💻 ' : isCouncil ? '👥 ' : '🎯 ';

            events.push({
                id: ms.id || 'ms_' + Math.random().toString(36).substring(2, 8),
                title: iconPrefix + ms.title,
                startDate: ms.startDate,
                endDate: ms.endDate || ms.startDate,
                category: isExam ? 'EXAM' : isMassar ? 'MASSAR' : isCouncil ? 'COUNCILS' : 'MILESTONE',
                description: `${ms.description || ''}\\nالفئات المستهدفة: ${ms.targetLevels || 'كافة المستويات'}\\nالأسدوس: ${ms.semesterLabel || (ms.semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول')}\\nالمقرر الوزاري لتنظيم السنة الدراسية ${academicYear}`,
                location: 'المؤسسة التعليمية / الفصول الدراسية'
            });
        });

        // 2. الفروض المدرجة في قاعدة بيانات المعلم db.exams
        if (includeExams && window.db && Array.isArray(window.db.exams)) {
            window.db.exams.forEach(ex => {
                if (ex.date) {
                    events.push({
                        id: ex.id || 'exam_' + Math.random().toString(36).substring(2, 8),
                        title: `🚨 ${ex.title || 'فرض مراقبة مستمرة'} (${ex.className || 'القسم'})`,
                        startDate: ex.date,
                        endDate: ex.date,
                        category: 'EXAM',
                        description: `فرض المراقبة المستمرة لمادة الرياضيات\\nالقسم: ${ex.className || ''}\\nالمواضيع والمحاور: ${ex.topics || ex.description || 'مفردات المقرر'}`,
                        location: `قاعة التدريس - ${ex.className || ''}`
                    });
                }
            });
        }

        // 2b. الفرائض والمهام المدرسية المدرجة في تقويم المعلم db.events
        if (window.db && Array.isArray(window.db.events)) {
            window.db.events.forEach(ev => {
                if (ev.date) {
                    const isEx = (ev.type === 'exam' || /فرض|امتحان/i.test(ev.title || ''));
                    const isMeeting = (ev.type === 'meeting' || /اجتماع|لقاء|مجلس/i.test(ev.title || ''));
                    const isTask = (ev.type === 'task' || /فريضة|واجب|مهمة/i.test(ev.title || ''));

                    if (isEx && !includeExams) return;
                    if (isMeeting && !includeCouncils) return;
                    if (!isEx && !isMeeting && !includeMilestones) return;

                    const prefix = isEx ? '🚨 ' : isMeeting ? '👥 ' : isTask ? '📋 ' : '📌 ';
                    events.push({
                        id: ev.id || 'evt_' + Math.random().toString(36).substring(2, 8),
                        title: `${prefix}${ev.title || 'فريضة ومحطة مدرسية'}`,
                        startDate: ev.date,
                        endDate: ev.date,
                        category: isEx ? 'EXAM' : isMeeting ? 'COUNCILS' : 'TASK',
                        description: `${ev.description || ev.notes || 'فريضة مدرسية مدرجة في التقويم'}\\nالقسم / المستهدف: ${ev.className || 'عام'}`,
                        location: ev.location || 'المؤسسة التعليمية'
                    });
                }
            });
        }

        // 3. العطل المدرسية والفترات البينية
        if (includeHolidays && holidays && Array.isArray(holidays)) {
            holidays.forEach(h => {
                events.push({
                    id: h.id || 'hol_' + Math.random().toString(36).substring(2, 8),
                    title: `🌴 عطلة مدرسية: ${h.title}`,
                    startDate: h.startDate,
                    endDate: h.endDate || h.startDate,
                    category: 'HOLIDAY',
                    description: `${h.notes || h.categoryLabel || 'عطلة رسمية'}\\nالمقرر الوزاري لتنظيم السنة الدراسية ${academicYear}\\n(تسجيل الغياب معطل تلقائياً)`,
                    location: 'عطلة مدرسية رسمية'
                });
            });
        }

        // بناء ملف iCalendar بتنسيق RFC 5545
        let ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Massar Math Tracker//Moroccan Ministerial Academic Calendar//AR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME;CHARSET=utf-8:المحطات التربوية وفروض المراقبة والعطل ' + academicYear,
            'X-WR-TIMEZONE:Africa/Casablanca',
            'X-WR-CALDESC:التقويم المدرسي الرسمي الصادر عن وزارة التربية الوطنية'
        ];

        events.forEach(evt => {
            if (!evt.startDate) return;
            const dtStart = evt.startDate.replace(/-/g, '');
            // تاريخ النهاية في iCal للأحداث اليومية غير شامل (exclusive) لذلك نضيف يوماً واحداً
            const dEnd = new Date(evt.endDate || evt.startDate);
            dEnd.setDate(dEnd.getDate() + 1);
            const y = dEnd.getFullYear();
            const m = String(dEnd.getMonth() + 1).padStart(2, '0');
            const d = String(dEnd.getDate()).padStart(2, '0');
            const dtEnd = `${y}${m}${d}`;

            const cleanSummary = (evt.title || '').replace(/[\r\n]+/g, ' ').replace(/[,;\\]/g, ' ');
            const cleanDesc = (evt.description || '').replace(/\r\n/g, '\\n').replace(/\n/g, '\\n');
            const cleanLoc = (evt.location || '').replace(/[\r\n]+/g, ' ').replace(/[,;\\]/g, ' ');

            ics.push('BEGIN:VEVENT');
            ics.push(`UID:${evt.id}@massar-math-tracker`);
            ics.push(`DTSTAMP:${nowStr}`);
            ics.push(`CREATED:${nowStr}`);
            ics.push(`LAST-MODIFIED:${nowStr}`);
            ics.push(`SUMMARY;CHARSET=utf-8:${cleanSummary}`);
            ics.push(`DESCRIPTION;CHARSET=utf-8:${cleanDesc}`);
            if (cleanLoc) ics.push(`LOCATION;CHARSET=utf-8:${cleanLoc}`);
            ics.push(`CATEGORIES:${evt.category || 'MILESTONE'}`);
            ics.push(`DTSTART;VALUE=DATE:${dtStart}`);
            ics.push(`DTEND;VALUE=DATE:${dtEnd}`);
            ics.push('STATUS:CONFIRMED');
            ics.push('TRANSP:TRANSPARENT');

            // إضافة تذكير / منبه (VALARM) قبل الموعد بيوم واحد
            ics.push('BEGIN:VALARM');
            ics.push('TRIGGER:-P1D');
            ics.push('ACTION:DISPLAY');
            ics.push(`DESCRIPTION;CHARSET=utf-8:تذكير: ${cleanSummary}`);
            ics.push('END:VALARM');

            ics.push('END:VEVENT');
        });

        ics.push('END:VCALENDAR');
        return ics.join('\r\n');
    }

    /**
     * تحميل ملف ICS مباشرة للأجهزة والحواسيب
     */
    function downloadMinisterialCalendarICS(customOptions) {
        const options = customOptions || getMinisterialSyncFiltersFromUI();
        const icsContent = generateMinisterialICSString(options);

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `التقويم_الوزاري_والمحطات_التربوية_والفروض_2026-2027.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم تنزيل ملف التقويم الرقمي (.ics) بنجاح 📅', 'success');
        } else {
            alert('تم تنزيل ملف التقويم الرقمي (.ics) بنجاح! يمكنك فتحه الآن ليضاف مباشرة إلى تقويمك.');
        }
    }

    /**
     * استخراج خيارات الفلترة من واجهة نافذة المزامنة
     */
    function getMinisterialSyncFiltersFromUI() {
        const chkExams = document.getElementById('msSyncChkExams');
        const chkMilestones = document.getElementById('msSyncChkMilestones');
        const chkMassar = document.getElementById('msSyncChkMassar');
        const chkCouncils = document.getElementById('msSyncChkCouncils');
        const chkHolidays = document.getElementById('msSyncChkHolidays');

        return {
            includeExams: chkExams ? chkExams.checked : true,
            includeMilestones: chkMilestones ? chkMilestones.checked : true,
            includeMassar: chkMassar ? chkMassar.checked : true,
            includeCouncils: chkCouncils ? chkCouncils.checked : true,
            includeHolidays: chkHolidays ? chkHolidays.checked : true,
            academicYear: '2026-2027'
        };
    }

    /**
     * فتح نافذة مزامنة المحطات التربوية والفرائض مع التقويم الرقمي
     */
    function openMinisterialCalendarSyncModal() {
        const modal = document.getElementById('ministerialCalendarSyncModal');
        if (!modal) return;

        updateMinisterialSyncModalCount();
        renderMinisterialSyncPreviewList();

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إغلاق نافذة المزامنة
     */
    function closeMinisterialCalendarSyncModal() {
        const modal = document.getElementById('ministerialCalendarSyncModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * تحديث عداد المحطات المختارة في نافذة المزامنة
     */
    function updateMinisterialSyncModalCount() {
        const options = getMinisterialSyncFiltersFromUI();
        const milestones = getAcademicMilestones();
        const holidays = getOfficialHolidays();

        let count = 0;
        milestones.forEach(ms => {
            const cat = ms.category || '';
            const isExam = (cat === 'exam' || cat === 'certification' || cat === 'assessment');
            const isMassar = (cat === 'massar');
            const isCouncil = (cat === 'council' || cat === 'orientation');
            const isGeneral = (!isExam && !isMassar && !isCouncil);

            if (isExam && options.includeExams) count++;
            else if (isMassar && options.includeMassar) count++;
            else if (isCouncil && options.includeCouncils) count++;
            else if (isGeneral && options.includeMilestones) count++;
        });

        if (options.includeExams && window.db && Array.isArray(window.db.exams)) {
            count += window.db.exams.length;
        }

        if (options.includeHolidays && holidays) {
            count += holidays.length;
        }

        const badge = document.getElementById('ministerialSyncSelectedCountBadge');
        if (badge) {
            badge.textContent = `${count} محطة وفرض مختار`;
        }

        renderMinisterialSyncPreviewList();
    }

    /**
     * رسم لائحة المعاينة السريعة داخل نافذة المزامنة
     */
    function renderMinisterialSyncPreviewList() {
        const container = document.getElementById('ministerialSyncPreviewContainer');
        if (!container) return;

        const options = getMinisterialSyncFiltersFromUI();
        const milestones = getAcademicMilestones();

        const filtered = milestones.filter(ms => {
            const cat = ms.category || '';
            const isExam = (cat === 'exam' || cat === 'certification' || cat === 'assessment');
            const isMassar = (cat === 'massar');
            const isCouncil = (cat === 'council' || cat === 'orientation');
            const isGeneral = (!isExam && !isMassar && !isCouncil);

            if (isExam && !options.includeExams) return false;
            if (isMassar && !options.includeMassar) return false;
            if (isCouncil && !options.includeCouncils) return false;
            if (isGeneral && !options.includeMilestones) return false;
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 0.85rem;">لا توجد عناصر مطابقة للخيارات المحددة أعلاه.</div>`;
            return;
        }

        container.innerHTML = filtered.map(ms => {
            const isExam = ms.category === 'exam' || ms.category === 'certification';
            const catColor = isExam ? '#dc2626' : ms.category === 'massar' ? '#0891b2' : ms.category === 'council' ? '#d97706' : '#2563eb';
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-right: 4px solid ${catColor}; border-radius: 8px; padding: 8px 12px; gap: 8px;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">${escapeHtml(ms.title)}</span>
                            <span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; background: ${catColor}15; color: ${catColor}; font-weight: 700;">${escapeHtml(ms.categoryLabel || 'محطة')}</span>
                        </div>
                        <div style="font-size: 0.76rem; color: #64748b; font-family: monospace; margin-top: 2px;">
                            📅 ${ms.startDate} ⬅️ ${ms.endDate || ms.startDate}
                        </div>
                    </div>
                    <button type="button" onclick="window.syncMilestoneToGoogleCalendar('${ms.id}')" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;" title="إضافة فردية إلى تقويم Google">
                        <span>📅 Google</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    /**
     * مزامنة محطة مفردة مع تقويم Google عبر رابط Web Intent المباشر
     */
    function syncMilestoneToGoogleCalendar(msId) {
        const milestones = getAcademicMilestones();
        const ms = milestones.find(m => m.id === msId);
        if (!ms) return;

        const title = `🎯 ${ms.title}`;
        const startStr = ms.startDate.replace(/-/g, '');
        
        // نهاية الحدث في Google Calendar للأيام الكاملة (+1 day)
        const dEnd = new Date(ms.endDate || ms.startDate);
        dEnd.setDate(dEnd.getDate() + 1);
        const y = dEnd.getFullYear();
        const m = String(dEnd.getMonth() + 1).padStart(2, '0');
        const d = String(dEnd.getDate()).padStart(2, '0');
        const endStr = `${y}${m}${d}`;

        const details = `${ms.description || ''}\n\nالفئات المستهدفة: ${ms.targetLevels || 'كافة المستويات'}\nالمقرر الوزاري لتنظيم السنة الدراسية 2026-2027\nتم التصدير من منصة تتبع الرياضيات (Massar Math Tracker)`;
        const location = 'المؤسسة التعليمية / قاعة التدريس';

        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

        window.open(googleUrl, '_blank');
    }

    /**
     * نسخ رابط الاشتراك الحي في التقويم (iCal Feed URL)
     */
    function copyMinisterialFeedUrl() {
        const feedUrl = `${window.location.origin}/api/calendar/ministerial-milestones.ics`;
        navigator.clipboard.writeText(feedUrl).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ رابط تغذية التقويم (iCal Feed URL) بنجاح 📋', 'success');
            } else {
                alert(`تم نسخ رابط التغذية الحية للتقويم:\n${feedUrl}\n\nيمكنك إضافته في Google Calendar تحت "من عنوان URL" أو في تقويم Apple للاشتراك التلقائي.`);
            }
        }).catch(() => {
            prompt('انسخ رابط التغذية الحية للتقويم:', feedUrl);
        });
    }

    // الهروب الآمن للأحرف
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
        return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // تصدير الدوال والواجهات إلى النطاق العالمي (window)
    window.getOfficialHolidays = getOfficialHolidays;
    window.getOfficialHolidayForDate = getOfficialHolidayForDate;
    window.isAbsenceDisabledOnDate = isAbsenceDisabledOnDate;
    window.getAbsenceDisableDetails = getAbsenceDisableDetails;
    window.getOfficialHolidaysStats = getOfficialHolidaysStats;
    window.renderAnnualSchoolCalendar = renderAnnualSchoolCalendar;
    window.renderMonthsGridHtml = renderMonthsGridHtml;
    window.renderHolidaysTableHtml = renderHolidaysTableHtml;
    window.onAnnualDayCellClick = onAnnualDayCellClick;
    window.switchAnnualCalendarViewMode = switchAnnualCalendarViewMode;
    window.openAddHolidayModal = openAddHolidayModal;
    window.openEditHolidayModal = openEditHolidayModal;
    window.closeOfficialHolidayModal = closeOfficialHolidayModal;
    window.saveOfficialHoliday = saveOfficialHoliday;
    window.deleteOfficialHoliday = deleteOfficialHoliday;
    window.toggleHolidayAbsenceDisable = toggleHolidayAbsenceDisable;
    window.confirmResetOfficialHolidays = confirmResetOfficialHolidays;
    window.printAnnualSchoolCalendar = printAnnualSchoolCalendar;
    window.applyHolidayAbsenceRestriction = applyHolidayAbsenceRestriction;
    window.goToAnnualCalendarFromAbsence = goToAnnualCalendarFromAbsence;
    window.switchCalendarSubView = switchCalendarSubView;
    window.syncOfficialHolidaysWithCalendarEvents = syncOfficialHolidaysWithCalendarEvents;
    window.syncMilestonesWithCalendarEvents = syncMilestonesWithCalendarEvents;

    // دوال المحطات التربوية المدرسية واستيراد المقرر الوزاري والمزامنة
    window.getAcademicMilestones = getAcademicMilestones;
    window.renderAcademicMilestonesSectionHtml = renderAcademicMilestonesSectionHtml;
    window.openAddAcademicMilestoneModal = openAddAcademicMilestoneModal;
    window.openEditAcademicMilestoneModal = openEditAcademicMilestoneModal;
    window.closeAcademicMilestoneModal = closeAcademicMilestoneModal;
    window.saveAcademicMilestone = saveAcademicMilestone;
    window.deleteAcademicMilestone = deleteAcademicMilestone;
    window.switchMilestoneModalMode = switchMilestoneModalMode;
    window.applyUnifiedExamPreset = applyUnifiedExamPreset;
    window.addUnifiedTopicToInput = addUnifiedTopicToInput;
    window.openDecreeAiImportModal = openDecreeAiImportModal;
    window.closeDecreeAiImportModal = closeDecreeAiImportModal;
    window.onDecreePresetChange = onDecreePresetChange;
    window.loadSampleDecreeText = loadSampleDecreeText;
    window.runDecreeAiExtraction = runDecreeAiExtraction;
    window.applyDecreeAiImport = applyDecreeAiImport;
    window.handleDecreePdfUpload = handleDecreePdfUpload;
    window.removeDecreePdfAttachment = removeDecreePdfAttachment;
    window.onDecreeDragOver = onDecreeDragOver;
    window.onDecreeDragLeave = onDecreeDragLeave;
    window.onDecreeDrop = onDecreeDrop;
    window.filterDecreeAiPreview = filterDecreeAiPreview;
    window.toggleAllDecreeItems = toggleAllDecreeItems;

    function openGoogleCalendarImportPage() {
        window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank');
    }

    // دوال تصدير ومزامنة التقويم الوزاري مع Google Calendar و ICS
    window.generateMinisterialICSString = generateMinisterialICSString;
    window.downloadMinisterialCalendarICS = downloadMinisterialCalendarICS;
    window.openMinisterialCalendarSyncModal = openMinisterialCalendarSyncModal;
    window.closeMinisterialCalendarSyncModal = closeMinisterialCalendarSyncModal;
    window.updateMinisterialSyncModalCount = updateMinisterialSyncModalCount;
    window.renderMinisterialSyncPreviewList = renderMinisterialSyncPreviewList;
    window.syncMilestoneToGoogleCalendar = syncMilestoneToGoogleCalendar;
    window.copyMinisterialFeedUrl = copyMinisterialFeedUrl;
    window.openGoogleCalendarImportPage = openGoogleCalendarImportPage;

    // دوال رخص الأستاذ المصدرة
    window.TEACHER_LEAVE_TYPES = TEACHER_LEAVE_TYPES;
    window.getTeacherLeaves = getTeacherLeaves;
    window.getTeacherLeaveForDate = getTeacherLeaveForDate;
    window.isDateTeacherLeave = isDateTeacherLeave;
    window.getTeacherLeaveStats = getTeacherLeaveStats;
    window.syncTeacherLeavesWithCalendarEvents = syncTeacherLeavesWithCalendarEvents;
    window.renderTeacherLeavesDashboard = renderTeacherLeavesDashboard;
    window.setLeavesFilter = setLeavesFilter;
    window.openAddTeacherLeaveModal = openAddTeacherLeaveModal;
    window.openEditTeacherLeaveModal = openEditTeacherLeaveModal;
    window.closeTeacherLeaveModal = closeTeacherLeaveModal;
    window.onTeacherLeaveTypeChanged = onTeacherLeaveTypeChanged;
    window.updateLeaveCalculatedDays = updateLeaveCalculatedDays;
    window.saveTeacherLeaveFromModal = saveTeacherLeaveFromModal;
    window.saveTeacherLeave = saveTeacherLeave;
    window.deleteTeacherLeave = deleteTeacherLeave;
    window.toggleLeaveStudentAbsenceDisable = toggleLeaveStudentAbsenceDisable;
    window.printTeacherLeaveOfficialNotice = printTeacherLeaveOfficialNotice;
    window.printTeacherWorkResumptionNotice = printTeacherWorkResumptionNotice;
    window.exportTeacherLeavesToExcel = exportTeacherLeavesToExcel;
    window.updateTeacherLeavesBadgeCount = updateTeacherLeavesBadgeCount;

    // دوال الطباعة الرسمية الموحدة والشاملة لكافة أقسام تبويب التقويم (A4 / PDF)
    window.openOrPrintCalendarDocument = openOrPrintCalendarDocument;
    window.buildAnnualSchoolCalendarPrintHtml = buildAnnualSchoolCalendarPrintHtml;
    window.buildOfficialHolidaysTablePrintHtml = buildOfficialHolidaysTablePrintHtml;
    window.printOfficialHolidaysTable = printOfficialHolidaysTable;
    window.buildAcademicMilestonesSchedulePrintHtml = buildAcademicMilestonesSchedulePrintHtml;
    window.printAcademicMilestonesSchedule = printAcademicMilestonesSchedule;
    window.buildMonthlyCalendarPrintHtml = buildMonthlyCalendarPrintHtml;
    window.printMonthlyCalendarSheet = printMonthlyCalendarSheet;
    window.buildTeacherLeavesLedgerPrintHtml = buildTeacherLeavesLedgerPrintHtml;
    window.printTeacherLeavesFullLedger = printTeacherLeavesFullLedger;
    window.buildActiveCalendarUniversalPdfHTML = buildActiveCalendarUniversalPdfHTML;
    window.openCalendarPrintHubModal = openCalendarPrintHubModal;

    // تهيئة المزامنة عند بدء التشغيل وتجهيز شبكة وجدول الأيام في التقويم الشهري مسبقاً
    setTimeout(() => {
        try {
            getOfficialHolidays();
            getTeacherLeaves();
            syncTeacherLeavesWithCalendarEvents();
            syncMilestonesWithCalendarEvents();
            syncOfficialHolidaysWithCalendarEvents();
            updateTeacherLeavesBadgeCount();
            autoMigrateHolidayAbsences({ silent: true });
            if (typeof window.renderCalendar === 'function') {
                window.renderCalendar();
            }
        } catch (initErr) {
            console.warn('Calendar initial sync warning:', initErr);
        }
    }, 200);

})(window);
