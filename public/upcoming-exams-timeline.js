/**
 * upcoming-exams-timeline.js
 * =========================================================================
 * وحدة جدولة مواعيد الفروض القادمة والجدول الزمني المصغر المطور (تبويب التقارير)
 * Advanced Upcoming Exams Scheduling & Interactive Mini-Timeline Engine
 * - برمجة مفردة أو جماعية متعددة الأقسام مع التصفية التراتبية بالمستوى
 * - شرائح دروس المقرر الرسمي للرياضيات حسب المستوى الدراسي (TCS / 1BAC / 2BAC / الإعدادي)
 * - كاشف فوري للتعارض مع العطل الرسمية والرخص الإدارية وتزاحم الفروض في نفس اليوم
 * - مؤشر جاهزية وتنفيذ الفرض من 5 مراحل (0% -> 100%): الرقن، سلم التنقيط، الطبع، الإجراء، التصحيح ومسك مسار
 * - شريط خط زمني مصغر أفقي تفاعلي (Horizontal Mini-Timeline Strip) + بطاقات زمنية عمودية مفصلة
 * - ربط مباشر بتقرير الفرض المحروس، دفتر النقط، إشعار واتساب الرسمي، ومزامنة التقويم السنوي (.ics / Google Calendar)
 * =========================================================================
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'smart_school_upcoming_exams_v2';
    let currentFilterClass = 'all';
    let currentFilterStatus = 'all'; // 'all' | 'upcoming' | 'completed'
    let currentFilterSemester = 'all'; // 'all' | 's1' | 's2'
    let editingExamId = null;
    let isMultiClassMode = false;

    const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const ARABIC_MONTHS = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
        'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
    ];

    // شرائح دروس الرياضيات الرسمية حسب المستويات والمسالك الدراسية المغربية بالتعليم الثانوي التأهيلي
    const MATH_CURRICULUM_BY_LEVEL = {
        TCS: {
            label: 'مقرر الجذع المشترك العلمي والتكنولوجي (TCS / TCT)',
            topics: [
                'المجموعات IN, Z, D, Q, IR', 'الحساب المتجهي في المستوى', 'الإسقاط في المستوى',
                'الترتيب في المجموعة IR', 'المستقيم في المستوى', 'الحدوديات',
                'المعادلات والمتراجحات والنظمات', 'الحساب المثلثي (الجزء 1)', 'الحساب المثلثي (الجزء 2)',
                'الإحصاء', 'الدوال العددية (عموميات)', 'التحويلات الاعتيادية في المستوى', 'الجداء السلمي', 'الهندسة الفضائية'
            ]
        },
        TCL: {
            label: 'مقرر الجذع المشترك للآداب والعلوم الإنسانية والتعليم الأصيل (TCL)',
            topics: [
                'الحساب العددي والتناسبية', 'المعادلات والمتراجحات والنظمات',
                'الإحصاء', 'الدوال العددية (عموميات وتمثيل مبياني)'
            ]
        },
        '1BAC': {
            label: 'مقرر الأولى باكالوريا علوم تجريبية وتكنولوجيات (1BAC)',
            topics: [
                'مبادئ في المنطق', 'عموميات حول الدوال العددية', 'المرجح في المستوى',
                'الجداء السلمي وتطبيقاته', 'المتتاليات العددية', 'الحساب المثلثي',
                'نهاية دالة عددية', 'الدوران في المستوى', 'الاشتقاق وتطبيقاته',
                'دراسة الدوال وتمثيلها المبياني', 'المتجهات في الفضاء وتحليلية الفضاء', 'الجداء السلمي في الفضاء والفلكة والجداء المتجهي'
            ]
        },
        '1BAC_EXP': {
            label: 'مقرر الأولى باكالوريا علوم تجريبية وتكنولوجيات (1BAC SE/STE/STM)',
            topics: [
                'مبادئ في المنطق', 'عموميات حول الدوال العددية', 'المرجح في المستوى',
                'الجداء السلمي وتطبيقاته', 'المتتاليات العددية', 'الحساب المثلثي',
                'نهاية دالة عددية', 'الدوران في المستوى', 'الاشتقاق وتطبيقاته',
                'دراسة الدوال وتمثيلها المبياني', 'المتجهات في الفضاء وتحليلية الفضاء', 'الجداء السلمي في الفضاء والفلكة والجداء المتجهي'
            ]
        },
        '1BAC_SM': {
            label: 'مقرر الأولى باكالوريا علوم رياضية (1BAC SM)',
            topics: [
                'مبادئ في المنطق', 'المجموعات والتطبيقات', 'عموميات حول الدوال العددية',
                'المرجح في المستوى', 'الجداء السلمي في المستوى وتطبيقاته', 'الحساب المثلثي',
                'المتتاليات العددية', 'نهاية دالة عددية', 'الدوران في المستوى',
                'الاشتقاق وتطبيقاته', 'دراسة الدوال وتمثيلها المبياني', 'الحسابيات في Z',
                'التعداد', 'المتجهات في الفضاء وتحليلية الفضاء', 'الجداء السلمي في الفضاء والفلكة والجداء المتجهي'
            ]
        },
        '1BAC_ECO': {
            label: 'مقرر الأولى باكالوريا علوم اقتصادية وتدبير (1BAC ECO)',
            topics: [
                'مبادئ في المنطق', 'المعادلات والمتراجحات والنظمات', 'عموميات حول الدوال العددية',
                'المتتاليات العددية', 'المصفوفات والعمليات عليها', 'اللوغاريتم العشري',
                'التعداد', 'نهاية دالة عددية', 'الاشتقاق', 'دراسة الدوال وتمثيلها المبياني'
            ]
        },
        '1BAC_LSH': {
            label: 'مقرر الأولى باكالوريا آداب وعلوم إنسانية (1BAC LSH - الامتحان الجهوي)',
            topics: [
                'مبادئ في المنطق (العبارات والمكممات)', 'الحساب العددي والتناسبية (النسب المئوية)',
                'المعادلات والمتراجحات والنظمات', 'عموميات حول الدوال العددية', 'المتتاليات الحسابية والهندسية',
                'التعداد (المبدأ الأساسي، الترتيبات، التأليفات)', 'نهاية دالة عددية', 'الاشتقاق ومعادلة المماس', 'دراسة الدوال وتمثيلها المبياني'
            ]
        },
        '2BAC': {
            label: 'مقرر الثانية باكالوريا علوم (PC / SVT / STE / STM)',
            topics: [
                'الاتصال والنهايات', 'الاشتقاق ودراسة الدوال', 'المتتاليات العددية',
                'الدوال الأصلية', 'الدوال اللوغاريتمية', 'الأعداد العقدية (الجزء 1)',
                'الدوال الأسية', 'الأعداد العقدية (الجزء 2)', 'المعادلات التفاضلية',
                'الحساب التكاملي', 'الهندسة الفضائية (الجداء السلمي والمتجهي)', 'حساب الاحتمالات'
            ]
        },
        '2BAC_EXP': {
            label: 'مقرر الثانية باكالوريا علوم تجريبية وتكنولوجيات (PC / SVT / STE / STM)',
            topics: [
                'الاتصال والنهايات', 'الاشتقاق ودراسة الدوال', 'المتتاليات العددية',
                'الدوال الأصلية', 'الدوال اللوغاريتمية', 'الأعداد العقدية (الجزء 1)',
                'الدوال الأسية', 'الأعداد العقدية (الجزء 2)', 'المعادلات التفاضلية',
                'الحساب التكاملي', 'الهندسة الفضائية (الجداء السلمي والمتجهي)', 'حساب الاحتمالات'
            ]
        },
        '2BAC_SM': {
            label: 'مقرر الثانية باكالوريا علوم رياضية (أ / ب)',
            topics: [
                'النهايات والاتصال', 'الاشتقاق ودراسة الدوال (مبرهنة رول والتزايدات المنتهية)',
                'المتتاليات العددية', 'الدوال الأصلية', 'الدوال اللوغاريتمية والأسية',
                'الأعداد العقدية', 'الحساب التكاملي', 'المعادلات التفاضلية',
                'الحسابيات في Z', 'البنيات الجبرية (الزمر، الحلقات، الأجسام، الفضاءات المتجهية)', 'حساب الاحتمالات'
            ]
        },
        '2BAC_ECO': {
            label: 'مقرر الثانية باكالوريا علوم اقتصادية وتدبير (ECO / SGC)',
            topics: [
                'الاتصال والنهايات', 'الاشتقاق ودراسة الدوال', 'المتتاليات العددية',
                'الدوال الأصلية', 'الدوال اللوغاريتمية', 'الدوال الأسية',
                'الحساب التكاملي', 'حساب الاحتمالات والمتغيرات العشوائية'
            ]
        },
        '2BAC_LSH': {
            label: 'مقرر الثانية باكالوريا آداب وعلوم إنسانية (2BAC LSH)',
            topics: [
                'المتتاليات العددية (الرتابة والنهايات)', 'نهايات الدوال العددية والاشتقاق',
                'دراسة الدوال اللوغاريتمية النبيرية', 'دراسة الدوال الأسية النبيرية', 'حساب الاحتمالات'
            ]
        },
        all: {
            label: 'محاور الرياضيات المشتركة بالسلك الثانوي التأهيلي',
            topics: [
                'الاتصال والاشتقاق', 'دراسة الدوال العددية', 'المتتاليات العددية',
                'الدوال اللوغاريتمية والأسية', 'الأعداد العقدية', 'الحساب التكاملي',
                'الحساب المتجهي والمرجح', 'الجداء السلمي', 'الحساب المثلثي',
                'المعادلات والمتراجحات', 'الترتيب في IR', 'حساب الاحتمالات والإحصاء'
            ]
        }
    };

    // مراحل الجاهزية الخمس للفرض المحروس
    const PREP_STAGES = [
        { key: 'drafted', label: 'الرقن والصياغة', shortLabel: '📝 النص', icon: '📝' },
        { key: 'scaleReady', label: 'سلم التنقيط', shortLabel: '📐 السلم', icon: '📐' },
        { key: 'printed', label: 'الطبع والنسخ', shortLabel: '🖨️ الطبع', icon: '🖨️' },
        { key: 'conducted', label: 'التمرير بالقسم', shortLabel: '⏱️ الإجراء', icon: '⏱️' },
        { key: 'graded', label: 'التصحيح ومسار', shortLabel: '📊 التصحيح', icon: '📊' }
    ];

    // مراحل الدورة البيداغوجية الخمس للفرض المنزلي (يُنجز بالمنزل ويُصحح في القسم ولا تُمسك نقطته في مسار)
    const PREP_STAGES_HOMEWORK = [
        { key: 'drafted', label: 'إعداد سلسلة الفرض المنزلي', shortLabel: '📝 إعداد السلسلة', icon: '📝' },
        { key: 'scaleReady', label: 'شبكة التصحيح والتوجيهات', shortLabel: '📐 شبكة التصحيح', icon: '📐' },
        { key: 'printed', label: 'تسليم الفرض للتلاميذ (للحل بالمنزل)', shortLabel: '📤 تسليم للمنزل', icon: '📤' },
        { key: 'conducted', label: 'جمع أوراق الفرض المنزلي من التلاميذ', shortLabel: '📥 جمع الأوراق', icon: '📥' },
        { key: 'graded', label: 'حصة التصحيح الجماعي في القسم (بدون مسار)', shortLabel: '👨‍🏫 تصحيح بالقسم', icon: '👨‍🏫' }
    ];

    function isHomeworkExam(exam) {
        if (!exam) return false;
        return Boolean(
            exam.isHomework ||
            exam.massarExempt ||
            exam.type === 'فرض منزلي' ||
            exam.examNumber === 'dm1' ||
            (exam.title && String(exam.title).includes('فرض منزلي'))
        );
    }

    function getPrepStagesForExam(exam) {
        return isHomeworkExam(exam) ? PREP_STAGES_HOMEWORK : PREP_STAGES;
    }

    /**
     * الحصول على تاريخ اليوم بصيغة YYYY-MM-DD
     */
    function getTodayISO() {
        if (typeof window.formatLocalDate === 'function') {
            return window.formatLocalDate(new Date());
        }
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * إضافة أيام لتاريخ بصيغة YYYY-MM-DD
     */
    function addDaysISO(dateStr, days) {
        const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
        if (isNaN(base.getTime())) return getTodayISO();
        base.setDate(base.getDate() + days);
        const y = base.getFullYear();
        const m = String(base.getMonth() + 1).padStart(2, '0');
        const d = String(base.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * استنتاج المستوى والمسلك الدراسي من اسم القسم بالتعليم الثانوي التأهيلي
     */
    function detectLevelFromClassName(className) {
        if (!className || className === 'جميع الأقسام') return 'all';
        if (typeof window.getCurriculumLevelForClass === 'function') {
            const exactTrack = window.getCurriculumLevelForClass(className);
            if (exactTrack && MATH_CURRICULUM_BY_LEVEL[exactTrack]) {
                return exactTrack;
            }
        }
        const c = String(className).toUpperCase();
        if (c.includes('TCL') || c.includes('TCO') || c.includes('جذع مشترك آداب') || c.includes('مشترك اداب')) {
            return 'TCL';
        }
        if (c.includes('TCS') || c.includes('TCT') || c.includes('TC') || c.includes('جذع') || c.includes('جدع') || c.includes('مشترك')) {
            return 'TCS';
        }
        if (c.includes('2BAC') || c.includes('2B') || c.includes('ثانية باك') || c.includes('2 باك') || c.includes('PC') || c.includes('SVT') || c.includes('SM-B') || c.includes('2علوم')) {
            return '2BAC_EXP';
        }
        if (c.includes('1BAC') || c.includes('1B') || c.includes('أولى باك') || c.includes('1 باك') || c.includes('1علوم')) {
            return '1BAC_EXP';
        }
        return 'all';
    }

    /**
     * الحصول على عدد تلاميذ القسم من قاعدة البيانات
     */
    function getClassStudentCount(className) {
        if (!className || className === 'جميع الأقسام') return 0;
        if (window.db && window.db.classes && Array.isArray(window.db.classes[className])) {
            return window.db.classes[className].length;
        }
        return 0;
    }

    /**
     * ضمان تهيئة مصفوفة الفروض في قاعدة البيانات والتخزين المحلي
     */
    function ensureExamsArray() {
        const dbObj = window.db || (typeof db !== 'undefined' ? db : null);
        if (dbObj && Array.isArray(dbObj.upcomingExams) && dbObj.upcomingExams.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(dbObj.upcomingExams));
            } catch (e) { /* ignore */ }
            return dbObj.upcomingExams;
        }

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    if (dbObj) dbObj.upcomingExams = parsed;
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('تعذر قراءة مواعيد الفروض المحفوظة:', e);
        }

        const initial = [];
        if (dbObj) dbObj.upcomingExams = initial;
        return initial;
    }

    /**
     * حفظ قائمة الفروض وتحديث قاعدة البيانات مع التزامن الآلي التام مع التقويم السنوي وجدول الحصص
     */
    function saveExamsArray(list) {
        const dbObj = window.db || (typeof db !== 'undefined' ? db : null);
        if (dbObj) {
            dbObj.upcomingExams = list;
            if (!Array.isArray(dbObj.calendarEvents)) dbObj.calendarEvents = [];
            if (!Array.isArray(dbObj.academicMilestones)) dbObj.academicMilestones = [];
            if (!Array.isArray(dbObj.agenda)) dbObj.agenda = [];

            const activeIds = new Set(list.map(ex => 'upexam_sync_' + ex.id));
            // إزالة الأحداث المرتبطة بفروض تم حذفها
            dbObj.calendarEvents = dbObj.calendarEvents.filter(ev => !String(ev.id || '').startsWith('upexam_sync_') || activeIds.has(ev.id));

            list.forEach(ex => {
                if (!ex || !ex.date) return;
                const syncId = 'upexam_sync_' + ex.id;
                const isHW = isHomeworkExam(ex);
                const eventPayload = {
                    id: syncId,
                    milestoneId: ex.milestoneId || syncId,
                    title: `${isHW ? '🏠 ' : ''}${ex.title} - ${ex.className || 'عام'}${isHW ? ' (لا يُمسك في مسار)' : ''}`,
                    date: ex.date,
                    endDate: ex.correctionDate || ex.date,
                    type: 'exam',
                    category: 'exam',
                    className: ex.className || 'جميع الأقسام',
                    notes: isHW
                        ? `فرض منزلي يُحل بالمنزل (تسليم: ${ex.distributionDate || '--'} • جمع: ${ex.date} • تصحيح بالقسم: ${ex.correctionDate || '--'}) — لا تُمسك نقطته في مسار`
                        : (ex.topics || ''),
                    timeSlot: ex.timeSlot || '',
                    isHomework: isHW,
                    massarExempt: isHW
                };
                const existingIdx = dbObj.calendarEvents.findIndex(ev => ev.id === syncId);
                if (existingIdx !== -1) {
                    dbObj.calendarEvents[existingIdx] = eventPayload;
                } else {
                    dbObj.calendarEvents.push(eventPayload);
                }
            });
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (e) {
            console.warn('تعذر حفظ مواعيد الفروض في التخزين المحلي:', e);
        }
        if (typeof window.saveData === 'function') {
            try { window.saveData(); } catch (e) { /* ignore */ }
        }
        if (typeof window.saveDB === 'function') {
            try { window.saveDB(); } catch (e) { /* ignore */ }
        }
        if (typeof window.renderCalendar === 'function') {
            try { window.renderCalendar(); } catch (e) { /* ignore */ }
        }
        if (typeof window.renderAgendaList === 'function') {
            try { window.renderAgendaList(); } catch (e) { /* ignore */ }
        }
    }

    /**
     * حساب فرق الأيام بين تاريخ الفرض وتاريخ اليوم
     */
    function getDaysDiff(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || isNaN(parts[0])) return null;
        const examDate = new Date(parts[0], parts[1] - 1, parts[2]);
        examDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffMs = examDate.getTime() - today.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    /**
     * تنسيق التاريخ بالعربية
     */
    function formatArabicDate(dateStr) {
        if (!dateStr) return 'غير محدد';
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || isNaN(parts[0])) return dateStr;
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayName = ARABIC_DAYS[dateObj.getDay()] || '';
        const monthName = ARABIC_MONTHS[parts[1] - 1] || parts[1];
        return `${dayName} ${parts[2]} ${monthName} ${parts[0]}`;
    }

    function formatShortArabicDate(dateStr) {
        if (!dateStr) return '--';
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3 || isNaN(parts[0])) return dateStr;
        const monthName = ARABIC_MONTHS[parts[1] - 1] || parts[1];
        return `${parts[2]} ${monthName}`;
    }

    /**
     * حساب نسبة جاهزية الفرض (0% -> 100%)
     */
    function computePrepProgress(exam) {
        const prep = exam.prep || {};
        if (exam.status === 'completed') {
            return {
                percent: 100,
                completedStages: 5,
                prep: { drafted: true, scaleReady: true, printed: true, conducted: true, graded: true },
                isReadyToPass: true
            };
        }
        let count = 0;
        PREP_STAGES.forEach(st => {
            if (prep[st.key]) count++;
        });
        const percent = Math.round((count / PREP_STAGES.length) * 100);
        const isReadyToPass = Boolean(prep.drafted && prep.printed);
        return {
            percent,
            completedStages: count,
            prep: {
                drafted: Boolean(prep.drafted),
                scaleReady: Boolean(prep.scaleReady),
                printed: Boolean(prep.printed),
                conducted: Boolean(prep.conducted),
                graded: Boolean(prep.graded)
            },
            isReadyToPass
        };
    }

    /**
     * بناء شارة العد التنازلي والألوان حسب القرب الزمني وحالة الفرض
     */
    function getUrgencyMeta(exam) {
        const days = getDaysDiff(exam.date);
        const isCompleted = exam.status === 'completed' || (exam.prep && exam.prep.graded);

        if (isCompleted) {
            return {
                badgeText: '✅ منجز ومصحح',
                badgeBg: '#dcfce7',
                badgeColor: '#15803d',
                badgeBorder: '#86efac',
                dotColor: '#10b981',
                cardBorder: '#bbf7d0',
                cardBg: '#f0fdf4',
                pulse: false,
                days
            };
        }

        if (exam.prep && exam.prep.conducted && !exam.prep.graded) {
            return {
                badgeText: '✍️ بانتظار التصحيح ومسك النقط',
                badgeBg: '#dbeafe',
                badgeColor: '#1d4ed8',
                badgeBorder: '#93c5fd',
                dotColor: '#2563eb',
                cardBorder: '#93c5fd',
                cardBg: '#eff6ff',
                pulse: true,
                days
            };
        }

        if (days === null) {
            return {
                badgeText: 'غير محدد',
                badgeBg: '#f1f5f9',
                badgeColor: '#475569',
                badgeBorder: '#cbd5e1',
                dotColor: '#64748b',
                cardBorder: '#e2e8f0',
                cardBg: '#ffffff',
                pulse: false,
                days: 999
            };
        }

        if (days < 0) {
            return {
                badgeText: `⚠️ مضى عليه ${Math.abs(days)} يوم (بانتظار التأشير)`,
                badgeBg: '#fee2e2',
                badgeColor: '#b91c1c',
                badgeBorder: '#fca5a5',
                dotColor: '#ef4444',
                cardBorder: '#fecaca',
                cardBg: '#fff5f5',
                pulse: false,
                days
            };
        }

        if (days === 0) {
            return {
                badgeText: '🔥 يُجرى اليوم!',
                badgeBg: '#fef2f2',
                badgeColor: '#dc2626',
                badgeBorder: '#f87171',
                dotColor: '#dc2626',
                cardBorder: '#f87171',
                cardBg: '#fff1f2',
                pulse: true,
                days
            };
        }

        if (days === 1) {
            return {
                badgeText: '⚡ غداً!',
                badgeBg: '#fff7ed',
                badgeColor: '#c2410c',
                badgeBorder: '#fdba74',
                dotColor: '#ea580c',
                cardBorder: '#fed7aa',
                cardBg: '#fffaf5',
                pulse: true,
                days
            };
        }

        if (days <= 3) {
            return {
                badgeText: `⏳ بعد ${days} أيام (قريب جداً)`,
                badgeBg: '#fffbeb',
                badgeColor: '#b45309',
                badgeBorder: '#fcd34d',
                dotColor: '#f59e0b',
                cardBorder: '#fde68a',
                cardBg: '#fffdf7',
                pulse: true,
                days
            };
        }

        if (days <= 7) {
            return {
                badgeText: `📅 بعد ${days} أيام (هذا الأسبوع)`,
                badgeBg: '#eff6ff',
                badgeColor: '#1d4ed8',
                badgeBorder: '#93c5fd',
                dotColor: '#3b82f6',
                cardBorder: '#bfdbfe',
                cardBg: '#f8fbff',
                pulse: false,
                days
            };
        }

        return {
            badgeText: `🗓️ متبقي ${days} يوماً`,
            badgeBg: '#f5f3ff',
            badgeColor: '#6d28d9',
            badgeBorder: '#ddd6fe',
            dotColor: '#8b5cf6',
            cardBorder: '#e2e8f0',
            cardBg: '#ffffff',
            pulse: false,
            days
        };
    }

    /**
     * الحصول على قائمة الأقسام المسندة من قاعدة البيانات
     */
    function getAvailableClasses(levelFilter) {
        const dbObj = window.db || (typeof db !== 'undefined' ? db : null);
        let classes = [];
        if (dbObj && dbObj.classes && typeof dbObj.classes === 'object') {
            classes = Object.keys(dbObj.classes).filter(Boolean);
        }
        if (levelFilter && levelFilter !== 'all') {
            classes = classes.filter(cls => {
                const detected = detectLevelFromClassName(cls);
                if (detected === levelFilter) return true;
                if (levelFilter === '1BAC' && detected.startsWith('1BAC')) return true;
                if (levelFilter === '2BAC' && detected.startsWith('2BAC')) return true;
                return false;
            });
        }
        return classes;
    }

    /**
     * تحديث قوائم الأقسام في استمارة الإضافة وفي شريط التصفية وصينية الأقسام المتعددة
     */
    function populateClassSelectors() {
        const allClasses = getAvailableClasses('all');
        const levelSelect = document.getElementById('upcomingExamLevelFilter');
        const selectedLevel = levelSelect ? levelSelect.value : 'all';
        const filteredClassesForForm = getAvailableClasses(selectedLevel);

        const formClassSelect = document.getElementById('upcomingExamClassSelect');
        const filterClassSelect = document.getElementById('upcomingTimelineClassFilter');
        const reportClassSelect = document.getElementById('reportClassSelect');
        const activeReportClass = reportClassSelect && reportClassSelect.value && reportClassSelect.value !== '__ALL__'
            ? reportClassSelect.value
            : '';

        if (formClassSelect) {
            const prevVal = formClassSelect.value;
            let html = '<option value="جميع الأقسام">🌐 جميع الأقسام المسندة</option>';
            filteredClassesForForm.forEach(cls => {
                const count = getClassStudentCount(cls);
                const countSuffix = count > 0 ? ` (${count} تلميذ)` : '';
                html += `<option value="${cls}">${cls}${countSuffix}</option>`;
            });
            formClassSelect.innerHTML = html;

            if (prevVal && (filteredClassesForForm.includes(prevVal) || prevVal === 'جميع الأقسام')) {
                formClassSelect.value = prevVal;
            } else if (activeReportClass && filteredClassesForForm.includes(activeReportClass)) {
                formClassSelect.value = activeReportClass;
            } else if (filteredClassesForForm.length > 0) {
                formClassSelect.value = filteredClassesForForm[0];
            }
        }

        // تحديث صينية تحديد عدة أقسام
        const multiTrayBox = document.getElementById('upcomingExamMultiClassCheckboxes');
        if (multiTrayBox) {
            if (filteredClassesForForm.length === 0) {
                multiTrayBox.innerHTML = '<span style="font-size:0.75rem; color:#64748b;">لا توجد أقسام مسندة مطابقة لهذا المستوى حالياً.</span>';
            } else {
                multiTrayBox.innerHTML = filteredClassesForForm.map(cls => {
                    const count = getClassStudentCount(cls);
                    return `
                        <label style="display:inline-flex; align-items:center; gap:5px; background:#faf5ff; border:1px solid #d8b4fe; padding:4px 10px; border-radius:6px; font-size:0.76rem; font-weight:800; color:#581c87; cursor:pointer;">
                            <input type="checkbox" class="upcoming-exam-multiclass-cb" value="${cls}">
                            <span>${cls}</span>
                            ${count > 0 ? `<span style="font-size:0.68rem; color:#7e22ce; background:#f3e8ff; padding:0 5px; border-radius:4px;">${count}</span>` : ''}
                        </label>
                    `;
                }).join('');
            }
        }

        if (filterClassSelect) {
            const prevFilter = filterClassSelect.value || currentFilterClass;
            let html = '<option value="all">كل الأقسام (' + allClasses.length + ')</option>';
            allClasses.forEach(cls => {
                html += `<option value="${cls}">${cls}</option>`;
            });
            filterClassSelect.innerHTML = html;
            if (prevFilter && (prevFilter === 'all' || allClasses.includes(prevFilter))) {
                filterClassSelect.value = prevFilter;
            }
        }

        // تحديث شرائح الدروس حسب المستوى أو القسم المختار
        const currentTargetClass = formClassSelect ? formClassSelect.value : '';
        const detectedLevel = selectedLevel !== 'all' ? selectedLevel : detectLevelFromClassName(currentTargetClass);
        renderCurriculumTopicChips(detectedLevel);
    }

    /**
     * عرض شرائح دروس الرياضيات التفاعلية حسب المستوى والمسلك الرسمي
     */
    function renderCurriculumTopicChips(levelKey) {
        const container = document.getElementById('upcomingExamCurriculumChips');
        const labelEl = document.getElementById('upcomingExamLevelCurriculumLabel');
        if (!container) return;

        let curr = MATH_CURRICULUM_BY_LEVEL[levelKey] || MATH_CURRICULUM_BY_LEVEL.all;
        if (window.MOROCCAN_SECONDARY_MATH_CURRICULUM && window.MOROCCAN_SECONDARY_MATH_CURRICULUM[levelKey]) {
            const officialLvl = window.MOROCCAN_SECONDARY_MATH_CURRICULUM[levelKey];
            const s1Lessons = (officialLvl.semesters?.s1?.lessons || []).map(l => l.title);
            const s2Lessons = (officialLvl.semesters?.s2?.lessons || []).map(l => l.title);
            const combined = [...s1Lessons, ...s2Lessons];
            if (combined.length > 0) {
                curr = {
                    label: `${officialLvl.name} (${officialLvl.weeklyHours}س/أسبوع • معامل ${officialLvl.coefficient})`,
                    topics: combined
                };
            }
        }
        if (labelEl) {
            labelEl.textContent = curr.label;
        }

        const topicsInput = document.getElementById('upcomingExamTopicsInput');
        const currentText = topicsInput ? topicsInput.value : '';

        container.innerHTML = curr.topics.map(topic => {
            const isSelected = currentText.includes(topic);
            const bg = isSelected ? '#7e22ce' : '#f3e8ff';
            const color = isSelected ? '#ffffff' : '#6b21a8';
            const border = isSelected ? '#6b21a8' : '#d8b4fe';
            const safeTopic = topic.replace(/'/g, "\\'");
            return `
                <button type="button" onclick="window.toggleExamTopicChip('${safeTopic}')"
                    style="background:${bg}; color:${color}; border:1px solid ${border}; padding:2px 8px; border-radius:999px; font-size:0.71rem; font-weight:700; cursor:pointer; transition:all 0.15s;">
                    ${isSelected ? '✓ ' : '+ '}${topic}
                </button>
            `;
        }).join('');
    }

    /**
     * إضافة أو إزالة درس من حقل الدروس المقررة عند النقر على الشريحة
     */
    window.toggleExamTopicChip = function (topic) {
        const input = document.getElementById('upcomingExamTopicsInput');
        if (!input) return;

        let parts = input.value
            .split(/[,،|]+/)
            .map(s => s.trim())
            .filter(Boolean);

        const idx = parts.findIndex(p => p === topic);
        if (idx !== -1) {
            parts.splice(idx, 1);
        } else {
            parts.push(topic);
        }

        input.value = parts.join(' ، ');

        const levelSelect = document.getElementById('upcomingExamLevelFilter');
        const formClassSelect = document.getElementById('upcomingExamClassSelect');
        const levelKey = (formClassSelect && formClassSelect.value && formClassSelect.value !== 'جميع الأقسام')
            ? detectLevelFromClassName(formClassSelect.value)
            : ((levelSelect && levelSelect.value !== 'all') ? levelSelect.value : 'all');
        renderCurriculumTopicChips(levelKey);
    };

    /**
     * عند تغيير المستوى الدراسي في استمارة البرمجة
     */
    window.onUpcomingExamLevelChange = function (levelVal) {
        populateClassSelectors();
        renderCurriculumTopicChips(levelVal || 'all');
    };

    /**
     * عند تغيير القسم المستهدف في استمارة البرمجة (مواءمة المدة والدروس مع المذكرة 142-08)
     */
    window.onUpcomingExamClassChange = function (classVal) {
        const levelSelect = document.getElementById('upcomingExamLevelFilter');
        const levelKey = (classVal && classVal !== 'جميع الأقسام')
            ? detectLevelFromClassName(classVal)
            : ((levelSelect && levelSelect.value !== 'all') ? levelSelect.value : 'all');
        renderCurriculumTopicChips(levelKey);

        // مواءمة المدة الزمنية للفرض المحروس وفق المذكرة 142-08 (1h للأدبي، 2h للعلمي/التقني/الاقتصاد)
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const durSelect = document.getElementById('upcomingExamDurationSelect');
        const isHW = typeSelect && typeSelect.value === 'فرض منزلي';
        if (!isHW && durSelect && window.MOROCCAN_SECONDARY_MATH_CURRICULUM && window.MOROCCAN_SECONDARY_MATH_CURRICULUM[levelKey]) {
            const officialDur = window.MOROCCAN_SECONDARY_MATH_CURRICULUM[levelKey].examDuration;
            if (officialDur === 1) durSelect.value = '1h';
            else if (officialDur === 2) durSelect.value = '2h';
        }

        const dateInput = document.getElementById('upcomingExamDateInput');
        if (dateInput && dateInput.value) {
            window.onUpcomingExamDateInputChange(dateInput.value);
        }
    };

    /**
     * تفعيل / إخفاء وضع تحديد عدة أقسام دفعة واحدة
     */
    window.toggleUpcomingMultiClassMode = function (forceState) {
        const tray = document.getElementById('upcomingExamMultiClassTray');
        const btn = document.getElementById('btnToggleMultiClassExam');
        if (!tray) return;

        isMultiClassMode = typeof forceState === 'boolean' ? forceState : !isMultiClassMode;
        tray.style.display = isMultiClassMode ? 'block' : 'none';
        if (btn) {
            btn.textContent = isMultiClassMode ? '✕ العودة لقسم واحد' : '+ تحديد عدة أقسام';
        }
    };

    window.selectAllMultiClassExam = function (selectAll) {
        document.querySelectorAll('.upcoming-exam-multiclass-cb').forEach(cb => {
            cb.checked = Boolean(selectAll);
        });
    };

    /**
     * تحديث واجهة الاستمارة ديناميكياً عند اختيار "فرض منزلي" (عرض دورة التسليم للحل بالمنزل -> جمع الأوراق -> التصحيح بالقسم، وتنبيه عدم المسك في مسار)
     */
    function syncHomeworkFormUI() {
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const numSelect = document.getElementById('upcomingExamNumberSelect');
        const durSelect = document.getElementById('upcomingExamDurationSelect');
        const banner = document.getElementById('upcomingHomeworkWorkflowBanner');
        const distBox = document.getElementById('upcomingExamDistributionDateBox');
        const distInput = document.getElementById('upcomingExamDistributionDateInput');
        const dateInput = document.getElementById('upcomingExamDateInput');
        const corrInput = document.getElementById('upcomingExamCorrectionDateInput');
        const dateLabel = document.getElementById('upcomingExamDateLabel');
        const corrLabel = document.getElementById('upcomingExamCorrectionDateLabel');

        const isHW = (typeSelect && typeSelect.value === 'فرض منزلي') || (numSelect && numSelect.value === 'dm1');

        if (banner) banner.style.display = isHW ? 'block' : 'none';
        if (distBox) distBox.style.display = isHW ? 'block' : 'none';

        if (isHW) {
            if (dateLabel) dateLabel.innerHTML = '📥 تاريخ إرجاع وجمع الأوراق من التلاميذ <span style="color:#ef4444;">*</span>:';
            if (corrLabel) corrLabel.innerHTML = '👨‍🏫 تاريخ حصة التصحيح الجماعي في القسم:';
            if (distInput && !distInput.value) {
                distInput.value = getTodayISO();
            }
            if (dateInput && distInput && distInput.value && (!dateInput.value || dateInput.value <= distInput.value)) {
                dateInput.value = addDaysISO(distInput.value, 7);
            }
            if (corrInput && dateInput && dateInput.value) {
                corrInput.value = addDaysISO(dateInput.value, 2);
            }
            if (durSelect && (durSelect.value === '2h' || durSelect.value === '1h')) {
                durSelect.value = 'أسبوع';
            }
        } else {
            if (dateLabel) dateLabel.innerHTML = '📅 تاريخ إجراء الفرض <span style="color:#ef4444;">*</span>:';
            if (corrLabel) corrLabel.innerHTML = '✍️ تاريخ التصحيح المرتقب بالقسم:';
        }

        // تحديث تسميات مراحل الجاهزية الخمس في الاستمارة
        const lblDrafted = document.getElementById('lblPrep_drafted');
        const lblScale = document.getElementById('lblPrep_scaleReady');
        const lblPrinted = document.getElementById('lblPrep_printed');
        const lblConducted = document.getElementById('lblPrep_conducted');
        const lblGraded = document.getElementById('lblPrep_graded');

        if (isHW) {
            if (lblDrafted) lblDrafted.textContent = '📝 تم إعداد وطبع سلسلة الفرض المنزلي';
            if (lblScale) lblScale.textContent = '📐 شبكة التصحيح والتوجيهات جاهزة';
            if (lblPrinted) lblPrinted.textContent = '📤 تم تسليم الفرض للتلاميذ (للحل في المنزل)';
            if (lblConducted) lblConducted.textContent = '📥 تم جمع أوراق الفرض المنزلي من التلاميذ';
            if (lblGraded) lblGraded.textContent = '👨‍🏫 تم التصحيح الجماعي في القسم (بدون مسك مسار)';
        } else {
            if (lblDrafted) lblDrafted.textContent = '📝 تم رقن وصياغة الموضوع';
            if (lblScale) lblScale.textContent = '📐 سلم التنقيط والباريم جاهز';
            if (lblPrinted) lblPrinted.textContent = '🖨️ تم الطبع والنسخ للتلاميذ';
            if (lblConducted) lblConducted.textContent = '⏱️ تم إجراء الفرض في القسم';
            if (lblGraded) lblGraded.textContent = '📊 تم التصحيح ومسك النقط بمسار';
        }
    }

    window.onUpcomingExamTypeChange = function (typeVal) {
        const numSelect = document.getElementById('upcomingExamNumberSelect');
        if (typeVal === 'فرض منزلي' && numSelect && numSelect.value !== 'dm1') {
            numSelect.value = 'dm1';
        } else if (typeVal === 'فرض محروس' && numSelect && numSelect.value === 'dm1') {
            numSelect.value = '1';
        }
        syncHomeworkFormUI();
    };

    window.onUpcomingExamNumberChange = function (numVal) {
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        if (numVal === 'dm1' && typeSelect && typeSelect.value !== 'فرض منزلي') {
            typeSelect.value = 'فرض منزلي';
        } else if (numVal !== 'dm1' && typeSelect && typeSelect.value === 'فرض منزلي') {
            typeSelect.value = 'فرض محروس';
        }
        syncHomeworkFormUI();
    };

    window.onUpcomingDistributionDateChange = function (distDateStr) {
        if (!distDateStr) return;
        const dateInput = document.getElementById('upcomingExamDateInput');
        const corrInput = document.getElementById('upcomingExamCorrectionDateInput');
        if (dateInput && (!dateInput.value || dateInput.value <= distDateStr)) {
            dateInput.value = addDaysISO(distDateStr, 7);
        }
        if (corrInput && dateInput && dateInput.value) {
            corrInput.value = addDaysISO(dateInput.value, 2);
        }
        if (dateInput && dateInput.value && typeof window.onUpcomingExamDateInputChange === 'function') {
            window.onUpcomingExamDateInputChange(dateInput.value);
        }
    };

    /**
     * فحص تاريخ الفرض للتنبيه الفوري حول العطل الرسمية أو الرخص أو التزاحم
     */
    window.onUpcomingExamDateInputChange = function (dateStr) {
        const alertBox = document.getElementById('upcomingExamDateAlertBox');
        const corrInput = document.getElementById('upcomingExamCorrectionDateInput');
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const isHW = typeSelect && typeSelect.value === 'فرض منزلي';

        // اقتراح تاريخ التصحيح تلقائياً (+2 يوم للفرض المنزلي بعد جمع الأوراق، أو +7 أيام للفرض المحروس) إذا كان فارغاً
        if (dateStr && corrInput && !corrInput.value) {
            corrInput.value = addDaysISO(dateStr, isHW ? 2 : 7);
        }

        if (!alertBox) return;
        if (!dateStr) {
            alertBox.style.display = 'none';
            return;
        }

        const warnings = [];
        let isCritical = false;

        // 1. فحص يوم الأحد
        const parts = dateStr.split('-').map(Number);
        if (parts.length === 3) {
            const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
            if (dObj.getDay() === 0) {
                warnings.push('⚠️ التاريخ المختار يصادف يوم الأحد (عطلة أسبوعية).');
                isCritical = true;
            }
        }

        // 2. فحص العطل الرسمية المغربية
        if (typeof window.getOfficialHolidayForDate === 'function') {
            const holiday = window.getOfficialHolidayForDate(dateStr);
            if (holiday) {
                warnings.push(`🏖️ تنبيه عطلة رسمية: يصادف هذا التاريخ "${holiday.title || holiday.name || 'عطلة مدرسية رسمية'}".`);
                isCritical = true;
            }
        }

        // 3. فحص الرخص الإدارية أو المرضية للأستاذ
        if (typeof window.getTeacherLeaveForDate === 'function') {
            const leave = window.getTeacherLeaveForDate(dateStr);
            if (leave) {
                warnings.push(`🏥 تنبيه رخصة مسجلة: لديك رخصة (${leave.type || 'إدارية/طبية'}) خلال هذا التاريخ.`);
                isCritical = true;
            }
        }

        // 4. فحص تزاحم الفروض في نفس اليوم
        const exams = ensureExamsArray();
        const sameDayExams = exams.filter(e => e.date === dateStr && e.id !== editingExamId);
        if (sameDayExams.length > 0) {
            const classesList = sameDayExams.map(e => `${e.title} (${e.className})`).join(' ، ');
            warnings.push(`📌 ملاحظة التزاحم: لديك ${sameDayExams.length} فرض آخر مبرمج في نفس اليوم: ${classesList}.`);
        }

        if (warnings.length === 0) {
            alertBox.style.display = 'block';
            alertBox.style.background = '#f0fdf4';
            alertBox.style.border = '1px solid #86efac';
            alertBox.style.color = '#15803d';
            alertBox.innerHTML = `✅ التاريخ متاح ومناسب لإجراء الفرض (${formatArabicDate(dateStr)}) — لا يتعارض مع أي عطلة رسمية أو رخصة مسجلة.`;
        } else {
            alertBox.style.display = 'block';
            alertBox.style.background = isCritical ? '#fef2f2' : '#fffbeb';
            alertBox.style.border = isCritical ? '1.5px solid #fca5a5' : '1.5px solid #fde68a';
            alertBox.style.color = isCritical ? '#b91c1c' : '#b45309';
            alertBox.innerHTML = warnings.map(w => `<div style="margin-bottom:2px;">${w}</div>`).join('');
        }
    };

    /**
     * بناء الشريط الزمني المصغر الأفقي السريع (Horizontal Mini-Timeline Strip)
     */
    function renderHorizontalMiniStrip(filteredExams) {
        const stripEl = document.getElementById('upcomingExamsHorizontalMiniStrip');
        if (!stripEl) return;

        if (!filteredExams || filteredExams.length === 0) {
            stripEl.style.display = 'none';
            stripEl.innerHTML = '';
            return;
        }

        // ترتيب الفروض زمنياً من الأقدم إلى الأحدث للعرض الأفقي
        const chronological = [...filteredExams].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        stripEl.style.display = 'block';
        let html = `
            <div style="background: linear-gradient(90deg, #faf5ff 0%, #f8fafc 50%, #eff6ff 100%); border: 1px solid #e9d5ff; border-radius: 10px; padding: 10px 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.75rem; font-weight: 900; color: #581c87; display: flex; align-items: center; gap: 6px;">
                        <span>🛤️ المسار الزمني المصغر للاستحقاقات (${chronological.length} محطة):</span>
                    </span>
                    <span style="font-size: 0.68rem; color: #64748b;">انقر على أي محطة للانتقال إليها في القائمة التفصيلية</span>
                </div>
                <div style="display: flex; align-items: stretch; gap: 10px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin;">
        `;

        chronological.forEach((exam, idx) => {
            const meta = getUrgencyMeta(exam);
            const prepInfo = computePrepProgress(exam);
            const shortDate = formatShortArabicDate(exam.date);
            const isDone = exam.status === 'completed' || prepInfo.percent === 100;
            const isHW = isHomeworkExam(exam);
            const shortDistDate = exam.distributionDate ? formatShortArabicDate(exam.distributionDate) : '';
            const shortCorrDate = exam.correctionDate ? formatShortArabicDate(exam.correctionDate) : '';

            html += `
                <div onclick="window.scrollToUpcomingExamCard('${exam.id}')"
                    style="min-width: ${isHW ? '210px' : '170px'}; max-width: ${isHW ? '235px' : '200px'}; flex-shrink: 0; background: ${isHW ? '#fffbeb' : '#ffffff'}; border: 1.5px solid ${isHW ? '#fcd34d' : meta.cardBorder}; border-top: 3.5px solid ${isHW ? '#d97706' : meta.dotColor}; border-radius: 8px; padding: 8px 10px; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; box-shadow: 0 2px 5px rgba(15,23,42,0.04);"
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 12px rgba(147,51,234,0.12)';"
                    onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 5px rgba(15,23,42,0.04)';">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px; margin-bottom: 4px;">
                        <span style="font-size: 0.67rem; font-weight: 900; background: ${isHW ? '#fef3c7' : '#f3e8ff'}; color: ${isHW ? '#92400e' : '#6b21a8'}; padding: 1px 6px; border-radius: 4px;">${exam.className || 'عام'}</span>
                        <span style="font-size: 0.67rem; font-weight: 800; color: ${isHW ? '#b45309' : meta.badgeColor};">${isHW ? '📥 ' + shortDate : shortDate}</span>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; ${isDone ? 'text-decoration: line-through; color:#64748b;' : ''}">
                        ${idx + 1}. ${exam.title}
                    </div>
                    ${isHW ? `
                    <div style="display:flex; flex-direction:column; gap:2px; margin-bottom:4px;">
                        <span style="font-size:0.62rem; font-weight:900; background:#fde68a; color:#78350f; padding:1px 5px; border-radius:4px; display:inline-block; width:fit-content;">🚫 تكويني — لا يُمسك في مسار</span>
                        <span style="font-size:0.62rem; color:#92400e; font-weight:700;">📤 منزل:${shortDistDate || '--'} ← 📥 جمع:${shortDate} ← 👨‍🏫 قِسم:${shortCorrDate || '--'}</span>
                    </div>
                    ` : `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.66rem; color: #64748b; margin-bottom: 4px;">
                        <span>${meta.days === 0 ? '🔥 اليوم' : (meta.days > 0 ? `بعد ${meta.days} ي` : (isDone ? '✅ منجز' : `مضى ${Math.abs(meta.days || 0)} ي`))}</span>
                        <span style="font-weight: 800; color: ${prepInfo.percent === 100 ? '#15803d' : '#7e22ce'};">جاهزية ${prepInfo.percent}%</span>
                    </div>
                    `}
                    <div style="background: #f1f5f9; height: 4px; border-radius: 2px; overflow: hidden;">
                        <div style="background: ${prepInfo.percent === 100 ? '#10b981' : (isHW ? '#d97706' : '#9333ea')}; width: ${prepInfo.percent}%; height: 100%;"></div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
        stripEl.innerHTML = html;
    }

    /**
     * التمرير السلس لبطاقة فرض معينة في القائمة التفصيلية مع وميض بصري
     */
    window.scrollToUpcomingExamCard = function (examId) {
        const card = document.getElementById('upcomingExamCardItem_' + examId);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const origShadow = card.style.boxShadow;
        card.style.boxShadow = '0 0 0 3px #9333ea, 0 8px 20px rgba(147, 51, 234, 0.25)';
        setTimeout(() => {
            card.style.boxShadow = origShadow;
        }, 1600);
    };

    /**
     * رسم الخط الزمني المصغر وبطاقات الفروض القادمة
     */
    window.renderUpcomingExamsTimeline = function () {
        populateClassSelectors();

        const exams = ensureExamsArray();
        const container = document.getElementById('upcomingExamsTimelineList');
        const totalBadge = document.getElementById('upcomingExamTotalCountBadge');
        const upcomingBadge = document.getElementById('upcomingExamUpcomingCountBadge');
        const readyBadge = document.getElementById('upcomingExamReadyCountBadge');
        const completedBadge = document.getElementById('upcomingExamCompletedCountBadge');
        const nextExamHighlight = document.getElementById('upcomingExamNextBadgeBox');

        if (!container) return;

        // تصفية حسب القسم المحدد
        let classFiltered = exams;
        if (currentFilterClass && currentFilterClass !== 'all') {
            classFiltered = exams.filter(e => e.className === currentFilterClass || e.className === 'جميع الأقسام');
        }

        // تصفية حسب الدورة
        if (currentFilterSemester && currentFilterSemester !== 'all') {
            classFiltered = classFiltered.filter(e => (e.semester || 's1') === currentFilterSemester);
        }

        // إحصائيات سريعة
        const totalCount = classFiltered.length;
        const completedCount = classFiltered.filter(e => e.status === 'completed' || (e.prep && e.prep.graded)).length;
        const upcomingCount = totalCount - completedCount;
        const readyCount = classFiltered.filter(e => {
            const p = computePrepProgress(e);
            return e.status !== 'completed' && p.isReadyToPass;
        }).length;

        if (totalBadge) totalBadge.textContent = totalCount;
        if (upcomingBadge) upcomingBadge.textContent = upcomingCount;
        if (readyBadge) readyBadge.textContent = readyCount;
        if (completedBadge) completedBadge.textContent = completedCount;

        // تصفية حسب الحالة (الكل / القادمة / المنجزة)
        let finalExams = classFiltered.slice();
        if (currentFilterStatus === 'upcoming') {
            finalExams = finalExams.filter(e => e.status !== 'completed');
        } else if (currentFilterStatus === 'completed') {
            finalExams = finalExams.filter(e => e.status === 'completed');
        }

        // ترتيب الفروض: القادمة أولاً مرتبة تصاعدياً بالتاريخ، ثم المنجزة تنازلياً
        finalExams.sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === 'completed' ? 1 : -1;
            }
            const dateA = a.date || '9999-12-31';
            const dateB = b.date || '9999-12-31';
            return a.status === 'completed'
                ? dateB.localeCompare(dateA)
                : dateA.localeCompare(dateB);
        });

        // تحديث شارة "أقرب فرض قادم"
        if (nextExamHighlight) {
            const upcomingSorted = classFiltered
                .filter(e => e.status !== 'completed' && getDaysDiff(e.date) !== null && getDaysDiff(e.date) >= 0)
                .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            if (upcomingSorted.length > 0) {
                const nextExam = upcomingSorted[0];
                const dDiff = getDaysDiff(nextExam.date);
                const whenText = dDiff === 0 ? 'اليوم!' : (dDiff === 1 ? 'غداً!' : `بعد ${dDiff} أيام`);
                nextExamHighlight.innerHTML = `
                    <span style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:3px 10px; border-radius:999px; font-size:0.74rem; font-weight:800;">
                        <span>🎯 الموعد الأقرب:</span>
                        <strong>${nextExam.title} (${nextExam.className || 'عام'})</strong>
                        <span style="background:#2563eb; color:#fff; padding:1px 7px; border-radius:999px; font-size:0.68rem;">${whenText}</span>
                    </span>
                `;
            } else {
                nextExamHighlight.innerHTML = `
                    <span style="font-size:0.74rem; color:#64748b; font-weight:600;">لا توجد مواعيد قادمة مجدولة حالياً</span>
                `;
            }
        }

        // تحديث الشريط الزمني المصغر الأفقي
        renderHorizontalMiniStrip(finalExams);

        // حالة عدم وجود أي فروض
        if (finalExams.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 28px 16px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">🗓️</div>
                    <div style="font-weight: 800; color: #334155; font-size: 0.92rem; margin-bottom: 4px;">
                        لا توجد مواعيد فروض مطابقة للتصفية الحالية
                    </div>
                    <p style="font-size: 0.78rem; margin: 0 0 12px 0; color: #64748b;">
                        يمكنك إضافة موعد فرض جديد للأقسام المسندة أو تحميل برمجة استرشادية آلية بنقرة واحدة.
                    </p>
                    <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                        <button type="button" onclick="window.toggleUpcomingExamForm(true)" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>➕</span> برمجة فرض جديد
                        </button>
                        <button type="button" onclick="window.loadDefaultExamsPreset()" style="background: #ffffff; color: #475569; border: 1.5px solid #cbd5e1; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>✨</span> توليد جدول فروض استرشادي
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // بناء الخط الزمني المصغر التفصيلي
        let html = `<div class="mini-exams-timeline" style="position: relative; padding: 6px 18px 6px 4px;">`;
        html += `<div style="position: absolute; top: 14px; bottom: 14px; right: 13px; width: 3px; background: linear-gradient(180deg, #8b5cf6 0%, #3b82f6 50%, #10b981 100%); border-radius: 4px; opacity: 0.3;"></div>`;

        finalExams.forEach((exam) => {
            const meta = getUrgencyMeta(exam);
            const prepInfo = computePrepProgress(exam);
            const formattedDate = formatArabicDate(exam.date);
            const isDone = exam.status === 'completed';
            const isHW = isHomeworkExam(exam);
            const activeStages = getPrepStagesForExam(exam);
            const studentCount = getClassStudentCount(exam.className);
            const semesterLabel = (exam.semester === 's2') ? 'الدورة 2' : 'الدورة 1';
            const durationLabel = exam.duration || (isHW ? 'أسبوع بالمنزل' : '2h');
            const roomLabel = exam.room ? `🚪 ${exam.room}` : '';
            const distDateFormatted = exam.distributionDate ? formatShortArabicDate(exam.distributionDate) : '';
            const correctionDateFormatted = exam.correctionDate ? formatShortArabicDate(exam.correctionDate) : '';

            // فحص ما إذا كان التاريخ يصادف عطلة رسمية
            let holidayWarningBadge = '';
            if (!isDone && typeof window.getOfficialHolidayForDate === 'function' && exam.date) {
                const hol = window.getOfficialHolidayForDate(exam.date);
                if (hol) {
                    holidayWarningBadge = `<span style="background:#fef2f2; color:#dc2626; border:1px solid #fca5a5; padding:1px 7px; border-radius:6px; font-size:0.68rem; font-weight:800;">⚠️ يصادف عطلة: ${hol.title || hol.name}</span>`;
                }
            }

            // شريط المراحل الخمس التفاعلي للفرض (مخصص للفرض المحروس أو الفرض المنزلي)
            const prepStepsHtml = activeStages.map(st => {
                const done = prepInfo.prep[st.key];
                const stepBg = done ? '#dcfce7' : '#f8fafc';
                const stepColor = done ? '#15803d' : '#64748b';
                const stepBorder = done ? '#86efac' : '#e2e8f0';
                return `
                    <button type="button" onclick="window.toggleExamPrepStage('${exam.id}', '${st.key}')"
                        title="انقر لتبديل حالة: ${st.label}"
                        style="background:${stepBg}; color:${stepColor}; border:1px solid ${stepBorder}; padding:2px 8px; border-radius:6px; font-size:0.7rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:3px; transition:all 0.15s;">
                        <span>${done ? '☑️' : '⬜'}</span>
                        <span>${st.shortLabel}</span>
                    </button>
                `;
            }).join('<span style="color:#cbd5e1; font-size:0.7rem;">←</span>');

            html += `
                <div id="upcomingExamCardItem_${exam.id}" style="position: relative; margin-bottom: 12px; padding-right: 22px; transition: box-shadow 0.3s; border-radius: 11px;">
                    <!-- عقدة الخط الزمني الدائرية -->
                    <span style="position: absolute; right: 1px; top: 16px; width: 15px; height: 15px; border-radius: 50%; background: ${isHW ? '#d97706' : meta.dotColor}; border: 3px solid #ffffff; box-shadow: 0 0 0 2px ${isHW ? '#d9770644' : meta.dotColor + '44'}; z-index: 2; ${meta.pulse ? 'animation: pulse 1.6s infinite;' : ''}"></span>

                    <!-- بطاقة الفرض -->
                    <div style="background: ${isHW && !isDone ? '#fffdf5' : meta.cardBg}; border: 1.5px solid ${isHW && !isDone ? '#fde68a' : meta.cardBorder}; border-right: 4px solid ${isHW && !isDone ? '#d97706' : meta.dotColor}; border-radius: 10px; padding: 12px 14px; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                            <!-- معلومات الفرض الأساسية -->
                            <div style="flex: 1; min-width: 240px;">
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px;">
                                    <span style="font-weight: 900; font-size: 0.94rem; color: ${isDone ? '#64748b' : '#0f172a'}; ${isDone ? 'text-decoration: line-through;' : ''}">
                                        ${isHW ? '🏠 ' : ''}${exam.title || 'فرض محروس'}
                                    </span>
                                    <span style="background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; padding: 1px 8px; border-radius: 6px; font-size: 0.73rem; font-weight: 900;">
                                        🏫 ${exam.className || 'جميع الأقسام'}${studentCount > 0 ? ` (${studentCount} تلميذ)` : ''}
                                    </span>
                                    <span style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 1px 7px; border-radius: 6px; font-size: 0.7rem; font-weight: 800;">
                                        ${semesterLabel}
                                    </span>
                                    <span style="background: ${isHW ? '#fef3c7' : '#f0f9ff'}; color: ${isHW ? '#92400e' : '#0369a1'}; border: 1px solid ${isHW ? '#fcd34d' : '#bae6fd'}; padding: 1px 7px; border-radius: 6px; font-size: 0.7rem; font-weight: 800;">
                                        ${exam.type || 'مراقبة مستمرة'} • ⏱️ ${durationLabel}
                                    </span>
                                    ${isHW ? `
                                    <span style="background: linear-gradient(135deg, #fef3c7, #fde68a); color: #78350f; border: 1.5px solid #f59e0b; padding: 2px 9px; border-radius: 999px; font-size: 0.71rem; font-weight: 900; box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);" title="الفرض المنزلي تقويم تكويني ودعم بيداغوجي يحله التلميذ في المنزل ويصحح في القسم، ولا تمسك نقطته في منظومة مسار">
                                        🚫 تقويم تكويني — لا تُمسك نقطته في مسار
                                    </span>
                                    ` : ''}
                                    ${roomLabel ? `<span style="background:#fdf4ff; color:#7e22ce; border:1px solid #e9d5ff; padding:1px 7px; border-radius:6px; font-size:0.7rem; font-weight:700;">${roomLabel}</span>` : ''}
                                    <span style="background: ${meta.badgeBg}; color: ${meta.badgeColor}; border: 1px solid ${meta.badgeBorder}; padding: 2px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">
                                        ${isHW && exam.prep && exam.prep.conducted && !exam.prep.graded ? '👨‍🏫 بانتظار حصة التصحيح بالقسم' : meta.badgeText}
                                    </span>
                                    ${holidayWarningBadge}
                                </div>

                                ${isHW ? `
                                <!-- المسار البيداغوجي ثلاثي المراحل للفرض المنزلي (منزل -> جمع -> تصحيح بالقسم) -->
                                <div style="background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 50%, #f5f3ff 100%); border: 1px solid #fcd34d; border-radius: 8px; padding: 6px 10px; margin-bottom: 7px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.74rem;">
                                    <span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#92400e;">
                                        <span>📤 1. تسليم للتلميذ (للحل بالمنزل):</span>
                                        <strong style="background:#fff; padding:1px 6px; border-radius:4px; border:1px solid #fde68a;">${distDateFormatted || 'محدد'}</strong>
                                    </span>
                                    <span style="color:#d97706; font-weight:900;">⬅️</span>
                                    <span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#b45309;">
                                        <span>📥 2. جمع الأوراق:</span>
                                        <strong style="background:#fff; padding:1px 6px; border-radius:4px; border:1px solid #fcd34d;">${formattedDate}</strong>
                                    </span>
                                    <span style="color:#7c3aed; font-weight:900;">⬅️</span>
                                    <span style="display:inline-flex; align-items:center; gap:4px; font-weight:800; color:#5b21b6;">
                                        <span>👨‍🏫 3. حصة التصحيح الجماعي بالقسم:</span>
                                        <strong style="background:#fff; padding:1px 6px; border-radius:4px; border:1px solid #ddd6fe;">${correctionDateFormatted || 'تحدد لاحقاً'}</strong>
                                    </span>
                                </div>
                                ` : `
                                <!-- التاريخ والتوقيت وتاريخ التصحيح المرتقب للفرض المحروس -->
                                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 0.76rem; color: #475569; margin-bottom: 6px;">
                                    <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #1e293b;">
                                        <span>📅 الإجراء:</span> ${formattedDate}
                                    </span>
                                    ${exam.timeSlot ? `
                                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #0369a1; font-weight: 700;">
                                        <span>⏰</span> ${exam.timeSlot}
                                    </span>` : ''}
                                    ${correctionDateFormatted ? `
                                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #7e22ce; font-weight: 700;">
                                        <span>✍️ التصحيح المرتقب:</span> ${correctionDateFormatted}
                                    </span>` : ''}
                                    ${exam.subject ? `
                                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #047857; font-weight: 700;">
                                        <span>📐</span> ${exam.subject}
                                    </span>` : ''}
                                </div>
                                `}

                                <!-- الدروس المقررة والمحاور -->
                                ${exam.topics ? `
                                <div style="background: rgba(255,255,255,0.9); border: 1px dashed #cbd5e1; border-radius: 6px; padding: 5px 9px; font-size: 0.75rem; color: #334155; margin-bottom: 8px; line-height: 1.5;">
                                    <strong style="color: #6d28d9;">📖 الدروس والمحاور المقومة:</strong> ${exam.topics}
                                </div>` : ''}

                                <!-- شريط مراحل الإعداد والتنفيذ التفاعلي -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; margin-top: 4px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 5px;">
                                        <span style="font-size: 0.7rem; font-weight: 800; color: #475569;">${isHW ? '🏠 تتبع مراحل الفرض المنزلي (بدون مسك مسار — انقر للتأشير):' : '🛠️ تتبع مراحل الإعداد والإنجاز (انقر للتأشير):'}</span>
                                        <span style="font-size: 0.7rem; font-weight: 900; color: ${prepInfo.percent === 100 ? '#15803d' : (isHW ? '#b45309' : '#7e22ce')};">${prepInfo.percent}% مكتمل (${prepInfo.completedStages}/5)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 5px;">
                                        ${prepStepsHtml}
                                    </div>
                                    <div style="background: #f1f5f9; height: 5px; border-radius: 3px; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, ${isHW ? '#d97706, #10b981' : '#9333ea, #10b981'}); width: ${prepInfo.percent}%; height: 100%; transition: width 0.25s;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- أزرار التحكم والربط البيداغوجي السريع -->
                            <div style="display: flex; flex-direction: column; gap: 5px; align-items: flex-end;">
                                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                    ${isHW ? `
                                    <button type="button" onclick="window.markHomeworkCorrectedInClass('${exam.id}')" title="تأشير إنجاز حصة التصحيح الجماعي للفرض المنزلي في القسم وتوثيقها (نقطة الفرض المنزلي لا تمسك في مسار)" style="background: #fffbeb; color: #92400e; border: 1px solid #f59e0b; padding: 4px 9px; border-radius: 6px; font-size: 0.71rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        <span>👨‍🏫</span> تصحيح بالقسم (بدون مسار)
                                    </button>
                                    ` : `
                                    <button type="button" onclick="window.PrefillExamReportFromTimeline('${exam.id}')" title="تعبئة بطاقة تقرير الفرض المحروس بمعطيات هذا الفرض" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; padding: 4px 8px; border-radius: 6px; font-size: 0.71rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                                        <span>📝</span> تقرير الفرض
                                    </button>
                                    <button type="button" onclick="window.jumpToGradebookFromExam('${exam.id}')" title="الانتقال إلى رصد النقط لهذا القسم" style="background: #f0fdf4; color: #15803d; border: 1px solid #86efac; padding: 4px 8px; border-radius: 6px; font-size: 0.71rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                                        <span>📊</span> رصد النقط
                                    </button>
                                    `}
                                    <button type="button" onclick="window.shareUpcomingExamWhatsApp('${exam.id}')" title="نسخ أو إرسال إشعار رسمي بالفرض للتلاميذ وأولياء الأمور عبر واتساب" style="background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; padding: 4px 8px; border-radius: 6px; font-size: 0.71rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;">
                                        <span>📲</span> إشعار واتساب
                                    </button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
                                    <button type="button" onclick="window.toggleUpcomingExamStatus('${exam.id}')" title="${isDone ? 'إعادة لوضع قادم' : 'تأشير الفرض كمنجز ومصحح بالكامل'}" style="background: ${isDone ? '#f1f5f9' : '#dcfce7'}; color: ${isDone ? '#475569' : '#15803d'}; border: 1px solid ${isDone ? '#cbd5e1' : '#86efac'}; padding: 4px 8px; border-radius: 6px; font-size: 0.71rem; font-weight: 800; cursor: pointer;">
                                        ${isDone ? '↩️ استرجاع' : '✓ تأشير كمنجز'}
                                    </button>
                                    <button type="button" onclick="window.duplicateUpcomingExam('${exam.id}')" title="استنساخ الفرض لقسم آخر" style="background: #faf5ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 4px 7px; border-radius: 6px; font-size: 0.71rem; font-weight: 700; cursor: pointer;">
                                        📋 نسخ
                                    </button>
                                    <button type="button" onclick="window.editUpcomingExam('${exam.id}')" title="تعديل موعد ومعطيات الفرض" style="background: #f8fafc; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 7px; border-radius: 6px; font-size: 0.71rem; font-weight: 700; cursor: pointer;">
                                        ✏️ تعديل
                                    </button>
                                    <button type="button" onclick="window.deleteUpcomingExam('${exam.id}')" title="حذف الموعد" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 7px; border-radius: 6px; font-size: 0.71rem; font-weight: 700; cursor: pointer;">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    };

    /**
     * تبديل مرحلة من مراحل الجاهزية الخمس للفرض مباشرة من البطاقة
     */
    window.toggleExamPrepStage = function (examId, stageKey) {
        const exams = ensureExamsArray();
        const target = exams.find(e => e.id === examId);
        if (!target) return;

        if (!target.prep || typeof target.prep !== 'object') {
            target.prep = {
                drafted: false,
                scaleReady: false,
                printed: false,
                conducted: false,
                graded: false
            };
        }

        target.prep[stageKey] = !target.prep[stageKey];

        // منطق ذكي مترابط: إذا تم تأشير "التصحيح ومسك مسار" نعتبر الفرض قد أُجري أيضاً ومكتمل
        if (stageKey === 'graded' && target.prep.graded) {
            target.prep.conducted = true;
            target.status = 'completed';
        } else if (stageKey === 'graded' && !target.prep.graded) {
            target.status = 'upcoming';
        }

        saveExamsArray(exams);
        window.renderUpcomingExamsTimeline();
    };

    /**
     * فتح أو إغلاق استمارة إضافة / تعديل فرض
     */
    window.toggleUpcomingExamForm = function (forceOpen) {
        const formWrap = document.getElementById('upcomingExamFormContainer');
        if (!formWrap) return;

        const isHidden = formWrap.style.display === 'none' || !formWrap.style.display;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

        if (shouldOpen) {
            populateClassSelectors();
            const dateInput = document.getElementById('upcomingExamDateInput');
            if (dateInput && !dateInput.value) {
                dateInput.value = addDaysISO(getTodayISO(), 7);
                window.onUpcomingExamDateInputChange(dateInput.value);
            }
            formWrap.style.display = 'block';
            const titleInput = document.getElementById('upcomingExamTitleInput');
            if (titleInput) titleInput.focus();
        } else {
            formWrap.style.display = 'none';
            resetExamForm();
        }
    };

    /**
     * إعادة ضبط حقول الاستمارة
     */
    function resetExamForm() {
        editingExamId = null;
        window.toggleUpcomingMultiClassMode(false);
        const titleInput = document.getElementById('upcomingExamTitleInput');
        const dateInput = document.getElementById('upcomingExamDateInput');
        const distDateInput = document.getElementById('upcomingExamDistributionDateInput');
        const corrDateInput = document.getElementById('upcomingExamCorrectionDateInput');
        const timeInput = document.getElementById('upcomingExamTimeInput');
        const roomInput = document.getElementById('upcomingExamRoomInput');
        const topicsInput = document.getElementById('upcomingExamTopicsInput');
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const semesterSelect = document.getElementById('upcomingExamSemesterSelect');
        const numberSelect = document.getElementById('upcomingExamNumberSelect');
        const durationSelect = document.getElementById('upcomingExamDurationSelect');
        const submitBtn = document.getElementById('btnSubmitUpcomingExam');
        const formHeader = document.getElementById('upcomingExamFormHeaderTitle');
        const alertBox = document.getElementById('upcomingExamDateAlertBox');

        if (titleInput) titleInput.value = '';
        if (distDateInput) distDateInput.value = getTodayISO();
        if (dateInput) dateInput.value = addDaysISO(getTodayISO(), 7);
        if (corrDateInput) corrDateInput.value = addDaysISO(getTodayISO(), 14);
        if (timeInput) timeInput.value = '';
        if (roomInput) roomInput.value = '';
        if (topicsInput) topicsInput.value = '';
        if (typeSelect) typeSelect.value = 'فرض محروس';
        if (semesterSelect) semesterSelect.value = 's1';
        if (numberSelect) numberSelect.value = '1';
        if (durationSelect) durationSelect.value = '2h';
        if (alertBox) alertBox.style.display = 'none';

        PREP_STAGES.forEach(st => {
            const cb = document.getElementById('chkPrep_' + st.key);
            if (cb) cb.checked = false;
        });

        syncHomeworkFormUI();
        if (submitBtn) submitBtn.innerHTML = '<span>💾</span> حفظ وبرمجة الفرض';
        if (formHeader) formHeader.innerHTML = '<span>➕</span> برمجة موعد فرض جديد في المخطط الزمني';
        renderCurriculumTopicChips('all');
    }

    /**
     * حفظ موعد فرض جديد أو تحديث موعد قائم (يدعم البرمجة المفردة أو الجماعية لعدة أقسام + دورة الفرض المنزلي والمزامنة مع التقويم وجدول الحصص)
     */
    window.handleSaveUpcomingExam = function (e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const titleInput = document.getElementById('upcomingExamTitleInput');
        const classSelect = document.getElementById('upcomingExamClassSelect');
        const distDateInput = document.getElementById('upcomingExamDistributionDateInput');
        const dateInput = document.getElementById('upcomingExamDateInput');
        const corrDateInput = document.getElementById('upcomingExamCorrectionDateInput');
        const timeInput = document.getElementById('upcomingExamTimeInput');
        const subjectInput = document.getElementById('upcomingExamSubjectInput');
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const topicsInput = document.getElementById('upcomingExamTopicsInput');
        const semesterSelect = document.getElementById('upcomingExamSemesterSelect');
        const numberSelect = document.getElementById('upcomingExamNumberSelect');
        const durationSelect = document.getElementById('upcomingExamDurationSelect');
        const roomInput = document.getElementById('upcomingExamRoomInput');

        const title = titleInput ? titleInput.value.trim() : '';
        const className = classSelect ? classSelect.value : 'جميع الأقسام';
        const distributionDate = distDateInput ? distDateInput.value : '';
        const date = dateInput ? dateInput.value : '';
        const correctionDate = corrDateInput ? corrDateInput.value : '';
        const timeSlot = timeInput ? timeInput.value.trim() : '';
        const subject = subjectInput ? subjectInput.value.trim() : 'الرياضيات';
        const type = typeSelect ? typeSelect.value : 'فرض محروس';
        const topics = topicsInput ? topicsInput.value.trim() : '';
        const semester = semesterSelect ? semesterSelect.value : 's1';
        const examNumber = numberSelect ? numberSelect.value : '1';
        const duration = durationSelect ? durationSelect.value : '2h';
        const room = roomInput ? roomInput.value.trim() : '';
        const isHomework = (type === 'فرض منزلي' || examNumber === 'dm1');

        if (!title) {
            if (typeof window.showToast === 'function') {
                window.showToast('⚠️ يرجى إدخال عنوان الفرض (مثال: الفرض المحروس رقم 1 أو الفرض المنزلي رقم 1)', 'warning');
            }
            if (titleInput) titleInput.focus();
            return;
        }

        if (!date) {
            if (typeof window.showToast === 'function') {
                window.showToast(isHomework ? '⚠️ يرجى تحديد تاريخ إرجاع وجمع أوراق الفرض المنزلي' : '⚠️ يرجى تحديد تاريخ إجراء الفرض', 'warning');
            }
            if (dateInput) dateInput.focus();
            return;
        }

        const prepObj = {};
        PREP_STAGES.forEach(st => {
            const cb = document.getElementById('chkPrep_' + st.key);
            prepObj[st.key] = cb ? Boolean(cb.checked) : false;
        });

        const exams = ensureExamsArray();

        if (editingExamId) {
            const idx = exams.findIndex(item => item.id === editingExamId);
            if (idx !== -1) {
                exams[idx] = {
                    ...exams[idx],
                    title,
                    className,
                    distributionDate: isHomework ? (distributionDate || getTodayISO()) : '',
                    date,
                    correctionDate,
                    timeSlot,
                    subject,
                    type,
                    topics,
                    semester,
                    examNumber,
                    duration,
                    room,
                    isHomework,
                    massarExempt: isHomework,
                    prep: prepObj,
                    status: prepObj.graded ? 'completed' : exams[idx].status,
                    updatedAt: new Date().toISOString()
                };
            }
            if (typeof window.showToast === 'function') {
                window.showToast(isHomework ? '✅ تم تحديث الفرض المنزلي (تذكير: لا تُمسك نقطته في مسار)' : '✅ تم تحديث موعد ومعطيات الفرض بنجاح', 'success');
            }
        } else {
            let targetClasses = [className];
            if (isMultiClassMode) {
                const checkedBoxes = Array.from(document.querySelectorAll('.upcoming-exam-multiclass-cb:checked')).map(cb => cb.value);
                if (checkedBoxes.length > 0) {
                    targetClasses = checkedBoxes;
                }
            }

            targetClasses.forEach((cls, cIdx) => {
                exams.push({
                    id: 'exam_' + Date.now() + '_' + cIdx + '_' + Math.random().toString(36).substring(2, 6),
                    title,
                    className: cls,
                    distributionDate: isHomework ? (distributionDate || getTodayISO()) : '',
                    date,
                    correctionDate,
                    timeSlot,
                    subject,
                    type,
                    topics,
                    semester,
                    examNumber,
                    duration,
                    room,
                    isHomework,
                    massarExempt: isHomework,
                    prep: { ...prepObj },
                    status: prepObj.graded ? 'completed' : 'upcoming',
                    createdAt: new Date().toISOString()
                });
            });

            if (typeof window.showToast === 'function') {
                const msg = isHomework
                    ? '🏠 تمت برمجة الفرض المنزلي بنجاح (يُحل بالمنزل ويُصحح بالقسم — لا يُمسك في مسار)'
                    : (targetClasses.length > 1
                        ? `✅ تمت برمجة الفرض لـ ${targetClasses.length} أقسام دفعة واحدة بنجاح`
                        : '✅ تمت إضافة موعد الفرض إلى الجدول الزمني');
                window.showToast(msg, 'success');
            }
        }

        saveExamsArray(exams);
        resetExamForm();
        window.toggleUpcomingExamForm(false);
        window.renderUpcomingExamsTimeline();
    };

    /**
     * تعديل موعد فرض موجود
     */
    window.editUpcomingExam = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        editingExamId = exam.id;
        window.toggleUpcomingMultiClassMode(false);
        populateClassSelectors();

        const titleInput = document.getElementById('upcomingExamTitleInput');
        const classSelect = document.getElementById('upcomingExamClassSelect');
        const distDateInput = document.getElementById('upcomingExamDistributionDateInput');
        const dateInput = document.getElementById('upcomingExamDateInput');
        const corrDateInput = document.getElementById('upcomingExamCorrectionDateInput');
        const timeInput = document.getElementById('upcomingExamTimeInput');
        const subjectInput = document.getElementById('upcomingExamSubjectInput');
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const topicsInput = document.getElementById('upcomingExamTopicsInput');
        const semesterSelect = document.getElementById('upcomingExamSemesterSelect');
        const numberSelect = document.getElementById('upcomingExamNumberSelect');
        const durationSelect = document.getElementById('upcomingExamDurationSelect');
        const roomInput = document.getElementById('upcomingExamRoomInput');
        const submitBtn = document.getElementById('btnSubmitUpcomingExam');
        const formHeader = document.getElementById('upcomingExamFormHeaderTitle');
        const formWrap = document.getElementById('upcomingExamFormContainer');

        if (titleInput) titleInput.value = exam.title || '';
        if (classSelect) {
            if (!Array.from(classSelect.options).some(opt => opt.value === exam.className)) {
                const opt = document.createElement('option');
                opt.value = exam.className;
                opt.textContent = exam.className;
                classSelect.appendChild(opt);
            }
            classSelect.value = exam.className || 'جميع الأقسام';
        }
        if (distDateInput) distDateInput.value = exam.distributionDate || '';
        if (dateInput) dateInput.value = exam.date || '';
        if (corrDateInput) corrDateInput.value = exam.correctionDate || '';
        if (timeInput) timeInput.value = exam.timeSlot || '';
        if (subjectInput) subjectInput.value = exam.subject || 'الرياضيات';
        if (typeSelect) typeSelect.value = exam.type || 'فرض محروس';
        if (topicsInput) topicsInput.value = exam.topics || '';
        if (semesterSelect) semesterSelect.value = exam.semester || 's1';
        if (numberSelect) numberSelect.value = exam.examNumber || (isHomeworkExam(exam) ? 'dm1' : '1');
        if (durationSelect) durationSelect.value = exam.duration || '2h';
        if (roomInput) roomInput.value = exam.room || '';

        syncHomeworkFormUI();

        const prepInfo = computePrepProgress(exam);
        PREP_STAGES.forEach(st => {
            const cb = document.getElementById('chkPrep_' + st.key);
            if (cb) cb.checked = Boolean(prepInfo.prep[st.key]);
        });

        if (submitBtn) submitBtn.innerHTML = '<span>💾</span> حفظ التعديلات';
        if (formHeader) formHeader.innerHTML = '<span>✏️</span> تعديل موعد ومعطيات الفرض المحدد';

        renderCurriculumTopicChips(detectLevelFromClassName(exam.className));
        if (exam.date) window.onUpcomingExamDateInputChange(exam.date);

        if (formWrap) {
            formWrap.style.display = 'block';
            formWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    /**
     * استنساخ فرض لقسم آخر بسرعة
     */
    window.duplicateUpcomingExam = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        window.editUpcomingExam(id);
        editingExamId = null; // تحويله إلى إضافة جديدة بدلاً من تعديل
        const submitBtn = document.getElementById('btnSubmitUpcomingExam');
        const formHeader = document.getElementById('upcomingExamFormHeaderTitle');
        if (submitBtn) submitBtn.innerHTML = '<span>💾</span> حفظ النسخة الجديدة';
        if (formHeader) formHeader.innerHTML = '<span>📋</span> استنساخ الفرض لقسم آخر أو تاريخ جديد';
        if (typeof window.showToast === 'function') {
            window.showToast('📋 تم نسخ بيانات الفرض للاستمارة — اختر القسم الجديد ثم اضغط حفظ', 'info');
        }
    };

    /**
     * تبديل حالة الفرض (قادم / منجز)
     */
    window.toggleUpcomingExamStatus = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        exam.status = exam.status === 'completed' ? 'upcoming' : 'completed';
        if (!exam.prep) exam.prep = {};
        if (exam.status === 'completed') {
            exam.prep.conducted = true;
            exam.prep.graded = true;
        } else {
            exam.prep.graded = false;
        }
        saveExamsArray(exams);
        window.renderUpcomingExamsTimeline();

        if (typeof window.showToast === 'function') {
            window.showToast(
                exam.status === 'completed' ? '✅ تم تأشير الفرض كمنجز ومصحح' : '↩️ تمت إعادة الفرض إلى قائمة المواعيد القادمة',
                'info'
            );
        }
    };

    /**
     * حذف موعد فرض
     */
    window.deleteUpcomingExam = function (id) {
        const exams = ensureExamsArray();
        const filtered = exams.filter(item => item.id !== id);
        saveExamsArray(filtered);
        window.renderUpcomingExamsTimeline();
        if (typeof window.showToast === 'function') {
            window.showToast('🗑️ تم حذف موعد الفرض من الجدول الزمني', 'info');
        }
    };

    /**
     * تعبئة بطاقة "تقرير الفرض المحروس" (#examReportCard) مباشرة من بطاقة الخط الزمني
     */
    window.PrefillExamReportFromTimeline = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        // إذا كان للفرض قسم محدد، نضبط فلتر القسم في أعلى تبويب التقارير عليه
        const reportClassSelect = document.getElementById('reportClassSelect');
        if (reportClassSelect && exam.className && exam.className !== 'جميع الأقسام') {
            if (Array.from(reportClassSelect.options).some(o => o.value === exam.className)) {
                reportClassSelect.value = exam.className;
                if (typeof window.renderReport === 'function') {
                    window.renderReport();
                }
            }
        }

        const semEl = document.getElementById('examReportSemester');
        const numEl = document.getElementById('examReportNumber');
        const passDateEl = document.getElementById('examReportPassDate');
        const corrDateEl = document.getElementById('examReportCorrectionDate');
        const durEl = document.getElementById('examReportDuration');
        const topicsEl = document.getElementById('examReportTopics');

        if (semEl && exam.semester) semEl.value = exam.semester;
        if (numEl && exam.examNumber && ['1', '2', '3', '4'].includes(String(exam.examNumber))) {
            numEl.value = String(exam.examNumber);
        }
        if (passDateEl && exam.date) passDateEl.value = exam.date;
        if (corrDateEl) corrDateEl.value = exam.correctionDate || addDaysISO(exam.date, 7);
        if (durEl && exam.duration && ['1h', '2h'].includes(exam.duration)) {
            durEl.value = exam.duration;
        }
        if (topicsEl && exam.topics) {
            topicsEl.value = exam.topics;
        }

        if (typeof window.autoCalculateExamStats === 'function') {
            try { window.autoCalculateExamStats(false); } catch (e) { /* ignore */ }
        }

        const reportCard = document.getElementById('examReportCard');
        if (reportCard) {
            reportCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`📝 تم نقل معطيات "${exam.title}" إلى بطاقة تقرير الفرض المحروس`, 'success');
        }
    };

    /**
     * تأشير إنجاز حصة التصحيح الجماعي للفرض المنزلي في القسم (مع التذكير بأن نقطة الفرض المنزلي لا تمسك في مسار)
     */
    window.markHomeworkCorrectedInClass = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        if (!exam.prep) exam.prep = {};
        exam.prep.drafted = true;
        exam.prep.scaleReady = true;
        exam.prep.printed = true;
        exam.prep.conducted = true;
        exam.prep.graded = true;
        exam.status = 'completed';

        saveExamsArray(exams);
        window.renderUpcomingExamsTimeline();

        if (typeof window.showToast === 'function') {
            window.showToast(`👨‍🏫 تم توثيق إنجاز حصة التصحيح الجماعي لـ "${exam.title}" في القسم (نقطة الفرض المنزلي تكوينية ولا تُمسك في مسار)`, 'success');
        }
    };

    /**
     * الانتقال المباشر إلى دفتر النقط للقسم المعني بالفرض (مع منع مسك نقطة الفرض المنزلي في مسار)
     */
    window.jumpToGradebookFromExam = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        if (isHomeworkExam(exam)) {
            if (typeof window.showToast === 'function') {
                window.showToast('🚫 تنبيه تربوي: نقطة الفرض المنزلي تقويم تكويني ودعم فقط ولا تُمسك في منظومة مسار', 'warning');
            }
            return;
        }

        // التبديل إلى تبويب لوحة الأداء السنوي / النقط أو القسم الرئيسي
        if (typeof window.switchTab === 'function') {
            window.switchTab('annual');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`📊 تم الانتقال إلى لوحة النقط والأداء السنوي لقسم: ${exam.className || 'جميع الأقسام'}`, 'info');
        }
    };

    /**
     * توليد وإرسال إشعار واتساب رسمي للتلاميذ أو أولياء الأمور بموعد الفرض والدروس المقررة (مخصص للفرض المحروس أو الفرض المنزلي)
     */
    window.shareUpcomingExamWhatsApp = function (id) {
        const exams = ensureExamsArray();
        const exam = exams.find(item => item.id === id);
        if (!exam) return;

        const isHW = isHomeworkExam(exam);
        const formattedDate = formatArabicDate(exam.date);
        const distDateStr = exam.distributionDate ? formatArabicDate(exam.distributionDate) : '';
        const corrDateStr = exam.correctionDate ? formatArabicDate(exam.correctionDate) : '';
        const days = getDaysDiff(exam.date);
        const remainingNote = days !== null && days >= 0
            ? (days === 0 ? 'اليوم' : (days === 1 ? 'غداً' : `بعد ${days} أيام`))
            : '';

        const msgLines = isHW ? [
            `🏠 *إعلان تربوي - فرض منزلي في مادة الرياضيات*`,
            `━━━━━━━━━━━━━━━━━━`,
            `🏫 *القسم:* ${exam.className || 'جميع الأقسام'}`,
            `📝 *الموضوع:* ${exam.title} (فرض منزلي للحل بالمنزل)`,
            distDateStr ? `📤 *تاريخ التسليم للتلاميذ:* ${distDateStr}` : null,
            `📥 *آخر أجل لإرجاع وجمع الأوراق:* ${formattedDate}${remainingNote ? ` (${remainingNote})` : ''}`,
            corrDateStr ? `👨‍🏫 *تاريخ حصة التصحيح الجماعي في القسم:* ${corrDateStr}` : null,
            `📖 *الدروس والمحاور المستهدفة:*`,
            `${exam.topics || 'جميع الدروس المنجزة إلى غاية آخر حصة'}`,
            `━━━━━━━━━━━━━━━━━━`,
            `💡 *توجيه بيداغوجي:* يُمنح هذا الفرض المنزلي لإنجازه في المنزل بجدية واستقلالية استعداداً للفروض المحروسة، وسيتم تصحيحه جماعياً في القسم (تقويم تكويني ودعم بيداغوجي). بالتوفيق للجميع!`
        ].filter(Boolean).join('\n') : [
            `📢 *إعلان تربوي هام - مادة الرياضيات*`,
            `━━━━━━━━━━━━━━━━━━`,
            `🏫 *القسم:* ${exam.className || 'جميع الأقسام'}`,
            `📝 *الاستحقاق:* ${exam.title} (${exam.type || 'فرض محروس'})`,
            `📅 *تاريخ الإجراء:* ${formattedDate}${remainingNote ? ` (${remainingNote})` : ''}`,
            exam.timeSlot ? `⏰ *التوقيت:* ${exam.timeSlot}` : null,
            exam.duration ? `⏱️ *مدة الإنجاز:* ${exam.duration}` : null,
            exam.room ? `🚪 *القاعة:* ${exam.room}` : null,
            `📖 *الدروس والمحاور المقررة:*`,
            `${exam.topics || 'جميع الدروس المنجزة إلى غاية آخر حصة'}`,
            `📐 *الوسائل المسموحة:* ${exam.subject || 'الأدوات الهندسية + آلة حاسبة علمية غير قابلة للبرمجة'}`,
            `━━━━━━━━━━━━━━━━━━`,
            `💡 *توجيه بيداغوجي:* يُرجى مراجعة الدروس وإنجاز التمارين التطبيقية المنجزة في الدفتر استعداداً الجيد للفرض. بالتوفيق والنجاح للجميع!`
        ].filter(Boolean).join('\n');

        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(msgLines).catch(() => {});
        }

        const encoded = encodeURIComponent(msgLines);
        const waUrl = `https://wa.me/?text=${encoded}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');

        if (typeof window.showToast === 'function') {
            window.showToast('📲 تم نسخ نص الإشعار الرسمي وفتح واتساب للمشاركة', 'success');
        }
    };

    /**
     * مزامنة الفروض القادمة مع التقويم السنوي والشهري للمنظومة
     */
    window.syncUpcomingExamsToAnnualCalendar = function () {
        const exams = ensureExamsArray();
        if (exams.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('ℹ️ لا توجد فروض مبرمجة لمزامنتها حالياً', 'info');
            }
            return;
        }

        const dbObj = window.db || (typeof db !== 'undefined' ? db : null);
        if (dbObj) {
            if (!Array.isArray(dbObj.calendarEvents)) dbObj.calendarEvents = [];
            let syncedCount = 0;

            exams.forEach(ex => {
                const syncId = 'upexam_sync_' + ex.id;
                const existingIdx = dbObj.calendarEvents.findIndex(ev => ev.id === syncId);
                const eventPayload = {
                    id: syncId,
                    title: `${ex.title} - ${ex.className || 'عام'}`,
                    date: ex.date,
                    type: 'exam',
                    category: 'exam',
                    className: ex.className || 'جميع الأقسام',
                    notes: ex.topics || '',
                    timeSlot: ex.timeSlot || ''
                };
                if (existingIdx !== -1) {
                    dbObj.calendarEvents[existingIdx] = eventPayload;
                } else {
                    dbObj.calendarEvents.push(eventPayload);
                }
                syncedCount++;
            });

            if (typeof window.saveData === 'function') {
                try { window.saveData(); } catch (e) { /* ignore */ }
            }
            if (typeof window.syncMilestonesWithCalendarEvents === 'function') {
                try { window.syncMilestonesWithCalendarEvents(false); } catch (e) { /* ignore */ }
            }

            if (typeof window.showToast === 'function') {
                window.showToast(`🔄 تمت مزامنة ${syncedCount} موعد فرض مع التقويم السنوي والشهري بنجاح`, 'success');
            }
        }
    };

    /**
     * تصدير مواعيد الفروض القادمة بصيغة تقويم قياسي (.ics) للهاتف أو Google Calendar
     */
    window.exportUpcomingExamsICS = function () {
        const exams = ensureExamsArray();
        if (exams.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('⚠️ لا توجد مواعيد فروض لتصديرها', 'warning');
            }
            return;
        }

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//SmartSchoolMath//UpcomingExams//AR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        exams.forEach(ex => {
            if (!ex.date) return;
            const cleanDate = ex.date.replace(/-/g, '');
            const nextDay = addDaysISO(ex.date, 1).replace(/-/g, '');
            const summary = `${ex.title} (${ex.className || 'جميع الأقسام'})`;
            const desc = `القسم: ${ex.className || 'عام'}\\nالنوع: ${ex.type || 'فرض محروس'}\\nالمدة: ${ex.duration || '2h'}\\nالدروس المقررة: ${ex.topics || 'غير محدد'}`;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${ex.id}@smartschool.ma`);
            lines.push(`DTSTART;VALUE=DATE:${cleanDate}`);
            lines.push(`DTEND;VALUE=DATE:${nextDay}`);
            lines.push(`SUMMARY:${summary}`);
            lines.push(`DESCRIPTION:${desc}`);
            if (ex.room) lines.push(`LOCATION:${ex.room}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');

        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `جدولة_الفروض_الرياضيات_${getTodayISO()}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof window.showToast === 'function') {
            window.showToast('📲 تم تحميل ملف التقويم (.ics) — يمكنك فتحه لإضافته لتقويم الهاتف أو Google Calendar', 'success');
        }
    };

    /**
     * تغيير فلتر الدورة الدراسية
     */
    window.onTimelineSemesterFilterChange = function (semVal) {
        currentFilterSemester = semVal || 'all';
        window.renderUpcomingExamsTimeline();
    };

    /**
     * تغيير فلتر القسم في الخط الزمني
     */
    window.onTimelineClassFilterChange = function (val) {
        currentFilterClass = val || 'all';
        window.renderUpcomingExamsTimeline();
    };

    /**
     * تغيير فلتر الحالة (الكل / القادمة / المنجزة)
     */
    window.onTimelineStatusFilterChange = function (status) {
        currentFilterStatus = status || 'all';
        ['all', 'upcoming', 'completed'].forEach(st => {
            const btn = document.getElementById('btnUpcomingStatus_' + st);
            if (btn) {
                if (st === currentFilterStatus) {
                    btn.style.background = '#7c3aed';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#6d28d9';
                } else {
                    btn.style.background = '#ffffff';
                    btn.style.color = '#475569';
                    btn.style.borderColor = '#cbd5e1';
                }
            }
        });
        window.renderUpcomingExamsTimeline();
    };

    /**
     * أزرار الاختصارات السريعة لتعبئة قالب الفرض في الاستمارة
     */
    window.setExamPreset = function (titleText, typeText, semesterCode, examNumCode, durationCode) {
        const titleInput = document.getElementById('upcomingExamTitleInput');
        const typeSelect = document.getElementById('upcomingExamTypeSelect');
        const semSelect = document.getElementById('upcomingExamSemesterSelect');
        const numSelect = document.getElementById('upcomingExamNumberSelect');
        const durSelect = document.getElementById('upcomingExamDurationSelect');

        if (titleInput) titleInput.value = titleText;
        if (typeSelect && typeText) typeSelect.value = typeText;
        if (semSelect && semesterCode) semSelect.value = semesterCode;
        if (numSelect && examNumCode) numSelect.value = examNumCode;
        if (durSelect && durationCode) durSelect.value = durationCode;
        syncHomeworkFormUI();
    };

    /**
     * أزرار سريعة لضبط تاريخ الفرض (بعد 3 أيام، أسبوع، أسبوعين)
     */
    window.setExamDateOffset = function (daysOffset) {
        const dateInput = document.getElementById('upcomingExamDateInput');
        if (dateInput) {
            dateInput.value = addDaysISO(getTodayISO(), daysOffset);
            window.onUpcomingExamDateInputChange(dateInput.value);
        }
    };

    /**
     * تحميل برمجة استرشادية آلية للفروض القادمة حسب الأقسام المسندة ومستوياتها
     */
    window.loadDefaultExamsPreset = function () {
        const classes = getAvailableClasses('all');
        const reportClassSelect = document.getElementById('reportClassSelect');
        const activeClass = (reportClassSelect && reportClassSelect.value && reportClassSelect.value !== '__ALL__')
            ? reportClassSelect.value
            : (classes[0] || 'جميع الأقسام');

        const secondClass = classes[1] || activeClass;
        const today = getTodayISO();
        const level1 = detectLevelFromClassName(activeClass);
        const level2 = detectLevelFromClassName(secondClass);
        const topics1 = (MATH_CURRICULUM_BY_LEVEL[level1] || MATH_CURRICULUM_BY_LEVEL.all).topics.slice(0, 2).join(' ، ');
        const topics2 = (MATH_CURRICULUM_BY_LEVEL[level2] || MATH_CURRICULUM_BY_LEVEL.all).topics.slice(2, 4).join(' ، ');

        const presets = [
            {
                id: 'exam_preset_1_' + Date.now(),
                title: 'الفرض المحروس رقم 1',
                className: activeClass,
                date: addDaysISO(today, 4),
                correctionDate: addDaysISO(today, 11),
                timeSlot: '08:30 - 10:30',
                subject: 'الرياضيات (آلة حاسبة علمية مسموحة)',
                type: 'فرض محروس',
                semester: 's1',
                examNumber: '1',
                duration: '2h',
                room: 'القاعة 12',
                topics: topics1,
                isHomework: false,
                massarExempt: false,
                prep: { drafted: true, scaleReady: true, printed: true, conducted: false, graded: false },
                status: 'upcoming',
                createdAt: new Date().toISOString()
            },
            {
                id: 'exam_preset_2_' + Date.now(),
                title: 'الفرض المنزلي رقم 1 (يُحل بالمنزل ويُصحح في القسم)',
                className: activeClass,
                distributionDate: addDaysISO(today, 2),
                date: addDaysISO(today, 9),
                correctionDate: addDaysISO(today, 12),
                timeSlot: 'جمع الأوراق وتصحيح جماعي بالقسم',
                subject: 'الرياضيات',
                type: 'فرض منزلي',
                semester: 's1',
                examNumber: 'dm1',
                duration: 'أسبوع',
                room: '',
                topics: topics1 + ' (تمارين توليفية داعمة — لا تُمسك النقطة في مسار)',
                isHomework: true,
                massarExempt: true,
                prep: { drafted: true, scaleReady: true, printed: true, conducted: false, graded: false },
                status: 'upcoming',
                createdAt: new Date().toISOString()
            },
            {
                id: 'exam_preset_3_' + Date.now(),
                title: 'الفرض المحروس رقم 2',
                className: secondClass,
                date: addDaysISO(today, 18),
                correctionDate: addDaysISO(today, 25),
                timeSlot: '10:30 - 12:30',
                subject: 'الرياضيات (آلة حاسبة علمية مسموحة)',
                type: 'فرض محروس',
                semester: 's1',
                examNumber: '2',
                duration: '2h',
                room: 'القاعة 14',
                topics: topics2,
                prep: { drafted: false, scaleReady: false, printed: false, conducted: false, graded: false },
                status: 'upcoming',
                createdAt: new Date().toISOString()
            }
        ];

        const existing = ensureExamsArray();
        const combined = [...existing, ...presets];
        saveExamsArray(combined);
        window.renderUpcomingExamsTimeline();

        if (typeof window.showToast === 'function') {
            window.showToast('✨ تمت إضافة جدولة فروض استرشادية للأقسام المسندة بنجاح', 'success');
        }
    };

    /**
     * طباعة جدول مواعيد الفروض القادمة في وثيقة رسمية منسقة A4
     */
    window.printUpcomingExamsTimeline = function () {
        const exams = ensureExamsArray();
        let filtered = exams.slice();
        if (currentFilterClass && currentFilterClass !== 'all') {
            filtered = filtered.filter(e => e.className === currentFilterClass || e.className === 'جميع الأقسام');
        }
        if (currentFilterSemester && currentFilterSemester !== 'all') {
            filtered = filtered.filter(e => (e.semester || 's1') === currentFilterSemester);
        }
        filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const st = (window.db && window.db.settings) ? window.db.settings : {};
        const teacherName = tp.name || st.teacherName || 'أستاذ(ة) مادة الرياضيات';
        const schoolName = tp.school || st.schoolName || 'المؤسسة التعليمية';
        const academyName = tp.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const directorateName = tp.directorate || 'المديرية الإقليمية';
        const schoolYear = tp.year || tp.academicYear || st.schoolYear || '2026/2027';
        const classLabel = (currentFilterClass && currentFilterClass !== 'all') ? currentFilterClass : 'جميع الأقسام المسندة';

        const totalCount = filtered.length;
        const doneCount = filtered.filter(e => {
            const p = computePrepProgress(e);
            return p.percent === 100 || e.status === 'done';
        }).length;
        const readyCount = filtered.filter(e => {
            const p = computePrepProgress(e);
            return p.percent >= 50 && p.percent < 100;
        }).length;
        const avgReadiness = totalCount > 0
            ? Math.round(filtered.reduce((acc, e) => acc + computePrepProgress(e).percent, 0) / totalCount)
            : 0;

        const rowsHtml = filtered.length > 0 ? filtered.map((e, i) => {
            const meta = getUrgencyMeta(e);
            const prep = computePrepProgress(e);
            const stepsLabels = [
                e.prepDrafted ? '✓ الموضوع' : '○ الموضوع',
                e.prepPrinted ? '✓ الطبع' : '○ الطبع',
                e.prepPassed ? '✓ التمرير' : '○ التمرير',
                e.prepCorrected ? '✓ التصحيح' : '○ التصحيح'
            ].join(' | ');
            return `
                <tr style="background:${i % 2 === 1 ? '#f8fafc' : '#ffffff'}; page-break-inside:avoid;">
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center; font-weight:800;">${i + 1}</td>
                    <td style="padding:7px 9px; border:1px solid #cbd5e1; font-weight:800; color:#1e1b4b;">${e.title || ''}</td>
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center; font-weight:800; color:#4f46e5;">${e.className || 'عام'}</td>
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${(e.semester === 's2') ? 'الأسدس 2' : 'الأسدس 1'}</td>
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center; font-weight:700;">${formatArabicDate(e.date)}</td>
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">${e.duration || '2h'}${e.timeSlot ? `<br><small style="color:#475569;">${e.timeSlot}</small>` : ''}</td>
                    <td style="padding:7px 9px; border:1px solid #cbd5e1; font-size:11.5px;">${e.topics || '-'}</td>
                    <td style="padding:7px; border:1px solid #cbd5e1; text-align:center;">
                        <div style="font-weight:800; color:${prep.percent >= 75 ? '#059669' : (prep.percent >= 50 ? '#d97706' : '#dc2626')};">${prep.percent}% — ${meta.badgeText}</div>
                        <div style="font-size:10px; color:#64748b; margin-top:2px;">${stepsLabels}</div>
                    </td>
                </tr>
            `;
        }).join('') : `<tr><td colspan="8" style="padding:18px; text-align:center; font-weight:700; color:#64748b;">لا توجد فروض مبرمجة ضمن الفلتر الحالي</td></tr>`;

        const htmlDoc = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>جدولة_مواعيد_الفروض_المحروسة_${classLabel}</title>
                <style>
                    body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; direction: rtl; margin: 0; padding: 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                    th { background: #1e1b4b; color: #ffffff; padding: 8px; border: 1px solid #1e1b4b; font-weight: 800; }
                </style>
            </head>
            <body>
                <div style="border: 2px solid #1e1b4b; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; background: #f8fafc; display: grid; grid-template-columns: 1fr 1.3fr 1fr; align-items: center; gap: 10px;">
                    <div style="font-size: 11.5px; line-height: 1.5; font-weight: 700; color: #1e293b;">
                        <div>المملكة المغربية</div>
                        <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div>${academyName}</div>
                        <div>${directorateName}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="display:inline-block; background:#1e1b4b; color:#fff; padding:5px 16px; border-radius:6px; font-weight:900; font-size:14px;">جدولة مواعيد الفروض المحروسة والمراقبة المستمرة</div>
                        <div style="font-size:11.5px; color:#475569; margin-top:5px; font-weight:700;">الأقسام المعنية: ${classLabel} | الموسم الدراسي: ${schoolYear}</div>
                    </div>
                    <div style="text-align: left; font-size: 11.5px; line-height: 1.5; font-weight: 700; color: #1e293b;">
                        <div>المؤسسة: ${schoolName}</div>
                        <div>الأستاذ(ة): ${teacherName}</div>
                        <div>المادة: الرياضيات</div>
                        <div>تاريخ الاستخراج: ${formatArabicDate(getTodayISO())}</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px;">
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background: #fff;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 700;">إجمالي الفروض المبرمجة</div>
                        <div style="font-size: 16px; font-weight: 900; color: #1e1b4b;">${totalCount} فروض</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background: #fff;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 700;">فروض جاهزة / قيد التمرير</div>
                        <div style="font-size: 16px; font-weight: 900; color: #0284c7;">${readyCount}</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background: #fff;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 700;">فروض منجزة ومصححة</div>
                        <div style="font-size: 16px; font-weight: 900; color: #059669;">${doneCount}</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; background: #fff;">
                        <div style="font-size: 11px; color: #64748b; font-weight: 700;">مؤشر الجاهزية العام</div>
                        <div style="font-size: 16px; font-weight: 900; color: #7c3aed;">${avgReadiness}%</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width:34px;">ر.ت</th>
                            <th>عنوان الفرض المحروس</th>
                            <th style="width:85px;">القسم</th>
                            <th style="width:65px;">الدورة</th>
                            <th style="width:95px;">تاريخ الإجراء</th>
                            <th style="width:85px;">المدة والتوقيت</th>
                            <th>الدروس والمحاور المقررة</th>
                            <th style="width:170px;">الجاهزية ومراحل الإنجاز</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>

                <div style="margin-top:22px; display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; font-size:12px; font-weight:700; color:#1e293b; page-break-inside:avoid;">
                    <div style="border: 1px dashed #94a3b8; border-radius: 8px; padding: 10px; min-height: 64px; text-align: center;">توقيع الأستاذ(ة):<br><br>.................................</div>
                    <div style="border: 1px dashed #94a3b8; border-radius: 8px; padding: 10px; min-height: 64px; text-align: center;">تأشيرة السيد(ة) المدير(ة) / الناظر(ة):<br><br>.................................</div>
                    <div style="border: 1px dashed #94a3b8; border-radius: 8px; padding: 10px; min-height: 64px; text-align: center;">تأشيرة السيد(ة) المفتش(ة) التربوي(ة):<br><br>.................................</div>
                </div>
            </body>
            </html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlDoc, {
                title: `جدولة_مواعيد_الفروض_المحروسة_${classLabel}`,
                orientation: 'portrait',
                subtitle: 'وثيقة رسمية لبرمجة وتتبع إنجاز الفروض المحروسة والمراقبة المستمرة'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(htmlDoc, `جدولة_مواعيد_الفروض_${classLabel}`, 'portrait');
        }
    };

    /**
     * ربط تلقائي مع تغيير القسم في تبويب التقارير
     */
    function hookReportClassChange() {
        const reportSelect = document.getElementById('reportClassSelect');
        if (reportSelect && !reportSelect.dataset.upcomingTimelineHooked) {
            reportSelect.dataset.upcomingTimelineHooked = 'true';
            reportSelect.addEventListener('change', function () {
                const val = reportSelect.value;
                const timelineFilter = document.getElementById('upcomingTimelineClassFilter');
                if (val && val !== '__ALL__') {
                    currentFilterClass = val;
                    if (timelineFilter) timelineFilter.value = val;
                } else {
                    currentFilterClass = 'all';
                    if (timelineFilter) timelineFilter.value = 'all';
                }
                window.renderUpcomingExamsTimeline();
            });
        }
    }

    // التهيئة عند تحميل الصفحة
    function initUpcomingExamsTimeline() {
        hookReportClassChange();
        window.renderUpcomingExamsTimeline();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initUpcomingExamsTimeline, 250));
    } else {
        setTimeout(initUpcomingExamsTimeline, 250);
    }
})();
