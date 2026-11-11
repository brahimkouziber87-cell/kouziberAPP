/**
 * ====================================================================
 * وحدة مؤشر معدل تطور التغيب الجماعي خلال الفترات الدراسية المختلفة
 * Collective Absenteeism Evolution Rate & Multi-Period Analytics Module
 * ====================================================================
 * إعداد: خبير معتمد في هندسة البرمجيات وأستاذ لمادة الرياضيات بالسلك الثانوي التأهيلي
 * المرجع القانوني: المذكرة الوزارية رقم 142-08 وتوجيهات اليقظة التربوية
 * 
 * المزايا الرئيسية:
 * 1. رصد دقيق لوقائع التغيب الجماعي (تجاوز عتبة 20%-35% من تلاميذ القسم في الحصة الواحدة).
 * 2. حساب معدل تطور التغيب الجماعي عبر فترات متعددة:
 *    - حسب الدورات الدراسية (الدورة 1 مقابل الدورة 2 مع نسبة التغير Δ%).
 *    - حسب الفترات البيداغوجية الخمس (P1 إلى P5).
 *    - حسب الشهور الدراسية العشرة لموسم التعليم الثانوي التأهيلي.
 *    - مقارنة الفترات الحساسة (ما قبل وبعد العطل المدرسية والفروض المحروسة مقابل الأيام العادية).
 * 3. مؤشر مركب لمعامل الخطورة الجماعية (Indice de Gravité Collective - IGC).
 * 4. تشخيص القسم الأكثر هشاشة واليوم الأكثر استهدافاً بظاهرة التغيب الجماعي.
 * 5. خطة تدبير وقائية وتوصيات بيداغوجية مستندة للتشريع التربوي المغربي.
 * 6. تقرير إداري جاهز للتصدير والطباعة الرسمية A4 بدون أخطاء.
 */

(function (window) {
    'use strict';

    // الحالة العامة للمؤشر
    const _state = {
        periodMode: 'semesters', // 'semesters' | 'periods' | 'months' | 'holidays'
        classFilter: 'all',
        threshold: 25, // العتبة بالنسبة المئوية لغياب القسم (افتراضياً 25%)
        minAbsentCount: 3, // الحد الأدنى لعدد الغائبين لتفادي الحالات الفردية في المجموعات الصغيرة
        searchQuery: '',
        severityFilter: 'all', // 'all' | 'critical' | 'moderate' | 'alert'
        expandedIncidentId: null
    };

    // مسميات الشهور باللغة العربية
    const MONTH_LABELS = {
        '09': 'شتنبر (Septembre)',
        '10': 'أكتوبر (Octobre)',
        '11': 'نونبر (Novembre)',
        '12': 'دجنبر (Décembre)',
        '01': 'يناير (Janvier)',
        '02': 'فبراير (Février)',
        '03': 'مارس (Mars)',
        '04': 'أبريل (Avril)',
        '05': 'ماي (Mai)',
        '06': 'يونيو (Juin)'
    };

    // الفترات البيداغوجية الخمس لمقرر الرياضيات بالثانوي التأهيلي
    const PEDAGOGICAL_PERIODS = [
        { id: 'P1', label: 'الفترة 1: شتنبر - أكتوبر', months: ['09', '10'], desc: 'انطلاق الموسم والتقويم التشخيصي' },
        { id: 'P2', label: 'الفترة 2: نونبر - دجنبر', months: ['11', '12'], desc: 'الفروض الأولى والامتحانات البينية' },
        { id: 'P3', label: 'الفترة 3: يناير - فبراير', months: ['01', '02'], desc: 'نهاية الأسدس 1 وانطلاق الأسدس 2' },
        { id: 'P4', label: 'الفترة 4: مارس - أبريل', months: ['03', '04'], desc: 'المراقبة المستمرة وفترة الدعم' },
        { id: 'P5', label: 'الفترة 5: ماي - يونيو', months: ['05', '06'], desc: 'الاستعداد للإشهادي والختام' }
    ];

    const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * الذاكرة المؤقتة الذكية لتجنب تكرار العمليات الحسابية الباهظة
     */
    const AnalyticsCache = {
        key: '',
        data: null,
        get(key) {
            if (this.key === key && this.data) return this.data;
            return null;
        },
        set(key, data) {
            this.key = key;
            this.data = data;
        },
        clear() {
            this.key = '';
            this.data = null;
        }
    };

    /**
     * تحديد السياق الزمني لتاريخ الغياب (قبل عطلة، بعد عطلة، أو يوم دراسي عادي)
     */
    function getSessionCalendarContext(dateStr) {
        if (!dateStr) return { type: 'regular', label: 'حصة اعتيادية', badgeClass: 'bg-slate-100 text-slate-700' };

        const db = window.db || {};
        const holidays = Array.isArray(db.calendarEvents) ? db.calendarEvents : [];

        // فحص ما إذا كان التاريخ قريباً من عطلة مدرسية مسجلة
        try {
            const curDate = new Date(dateStr + 'T00:00:00');
            const curTime = curDate.getTime();

            for (const h of holidays) {
                if (!h.startDate) continue;
                const hStart = new Date(h.startDate + 'T00:00:00').getTime();
                const hEnd = new Date((h.endDate || h.startDate) + 'T23:59:59').getTime();

                // إذا كان قبل بداية العطلة بيوم إلى 3 أيام
                const diffBefore = (hStart - curTime) / (1000 * 3600 * 24);
                if (diffBefore >= 0 && diffBefore <= 3) {
                    return {
                        type: 'pre_holiday',
                        label: `ما قبل عطلة (${h.title || 'مدرسية'})`,
                        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
                        holidayName: h.title
                    };
                }

                // إذا كان بعد انتهاء العطلة بيوم إلى 3 أيام
                const diffAfter = (curTime - hEnd) / (1000 * 3600 * 24);
                if (diffAfter >= 0 && diffAfter <= 3) {
                    return {
                        type: 'post_holiday',
                        label: `استئناف بعد عطلة (${h.title || 'مدرسية'})`,
                        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
                        holidayName: h.title
                    };
                }
            }

            // فحص أيام عطلة نهاية الأسبوع (الجمعة مساءً أو السبت)
            const dayIdx = curDate.getDay();
            if (dayIdx === 5) {
                return { type: 'weekend_eve', label: 'عشية نهاية الأسبوع (الجمعة)', badgeClass: 'bg-orange-50 text-orange-700' };
            } else if (dayIdx === 6) {
                return { type: 'weekend_eve', label: 'نهاية الأسبوع (السبت)', badgeClass: 'bg-orange-50 text-orange-700' };
            }
        } catch (e) {}

        return { type: 'regular', label: 'حصة اعتيادية', badgeClass: 'bg-slate-100 text-slate-700' };
    }

    /**
     * تحديد الدورة الدراسية وتاريخها
     */
    function getSemesterFromDate(dateStr) {
        if (!dateStr) return 'S1';
        const parts = dateStr.split('-');
        const month = parseInt(parts[1], 10);
        // شتنبر (9) إلى يناير (1) = الدورة 1
        // فبراير (2) إلى يونيو (6) = الدورة 2
        return (month >= 9 || month === 1) ? 'S1' : 'S2';
    }

    /**
     * استخراج وتجميع مؤشرات التغيب الجماعي مع دراسة تجنب التكرار
     */
    function calculateCollectiveAbsenceMetrics(customOptions = {}) {
        const db = window.db || {};
        const opts = Object.assign({}, _state, customOptions);

        // إنشاء مفتاح ذاكرة مؤقتة لتقليص العمليات الحسابية
        const recordsCount = Array.isArray(db.records) ? db.records.length : 0;
        const cacheKey = `${recordsCount}_${opts.periodMode}_${opts.classFilter}_${opts.threshold}_${opts.minAbsentCount}_${db.lastModified || ''}`;
        const cached = AnalyticsCache.get(cacheKey);
        if (cached) return cached;

        const classes = db.classes || {};
        const sortedClassNames = (typeof window.getSortedClasses === 'function')
            ? window.getSortedClasses()
            : Object.keys(classes);

        const targetClasses = (opts.classFilter && opts.classFilter !== 'all')
            ? [opts.classFilter]
            : sortedClassNames;

        const allRecords = Array.isArray(db.records) ? db.records : [];

        // 1. فهرسة السجلات حسب الحصص الدراسية (Grouping records into Sessions)
        // Session Key = date + '__' + timeSlot + '__' + className
        const sessionsMap = new Map();

        allRecords.forEach(rec => {
            if (!rec.date || !rec.className) return;
            if (targetClasses.length > 0 && !targetClasses.includes(rec.className)) return;

            const timeSlot = rec.timeSlot || '08:00 - 10:00';
            const sessionKey = `${rec.date}__${timeSlot}__${rec.className}`;

            if (!sessionsMap.has(sessionKey)) {
                sessionsMap.set(sessionKey, {
                    date: rec.date,
                    timeSlot: timeSlot,
                    className: rec.className,
                    records: [],
                    absentStudents: [],
                    justifiedCount: 0,
                    unjustifiedCount: 0,
                    latesCount: 0
                });
            }

            const session = sessionsMap.get(sessionKey);
            session.records.push(rec);

            if (rec.status === 'غائب' || rec.status === 'مبرر') {
                session.absentStudents.push({
                    studentId: rec.studentId,
                    status: rec.status,
                    homework: rec.homework,
                    notes: rec.notes
                });
                if (rec.status === 'مبرر') session.justifiedCount++;
                else session.unjustifiedCount++;
            } else if (rec.status === 'متأخر') {
                session.latesCount++;
            }
        });

        // 2. تحليل كل حصة وفحص ما إذا كانت تشكل "تغيباً جماعياً"
        const allSessions = [];
        const collectiveIncidents = [];
        const classIncidentCounts = {};
        const weekdayIncidentCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; // Mon to Sat

        sessionsMap.forEach((session, key) => {
            const classStudents = classes[session.className] || [];
            const totalEnrolled = classStudents.length;
            if (totalEnrolled === 0) return;

            const absentCount = session.absentStudents.length;
            const absencePct = Math.round((absentCount / totalEnrolled) * 1000) / 10; // decimal 1 place

            // هل تجاوزت الحصة العتبة المحددة؟
            const isCollective = (absencePct >= opts.threshold) && (absentCount >= opts.minAbsentCount);

            const sessionDate = new Date(session.date + 'T08:00:00');
            const dayIdx = sessionDate.getDay();
            const semester = getSemesterFromDate(session.date);
            const monthStr = session.date.split('-')[1] || '09';
            const calendarCtx = getSessionCalendarContext(session.date);

            let severity = 'regular';
            if (isCollective) {
                if (absencePct >= 50) severity = 'critical'; // أكثر من نصف القسم غائب
                else if (absencePct >= 35) severity = 'moderate';
                else severity = 'alert';
            }

            const sessionSummary = {
                id: key,
                date: session.date,
                timeSlot: session.timeSlot,
                className: session.className,
                totalEnrolled: totalEnrolled,
                absentCount: absentCount,
                absencePct: absencePct,
                justifiedCount: session.justifiedCount,
                unjustifiedCount: session.unjustifiedCount,
                latesCount: session.latesCount,
                isCollective: isCollective,
                severity: severity,
                semester: semester,
                month: monthStr,
                dayIdx: dayIdx,
                weekdayName: ARABIC_WEEKDAYS[dayIdx] || 'يوم دراسي',
                calendarContext: calendarCtx
            };

            allSessions.push(sessionSummary);

            if (isCollective) {
                collectiveIncidents.push(sessionSummary);

                // إحصاء حسب القسم
                classIncidentCounts[session.className] = (classIncidentCounts[session.className] || 0) + 1;

                // إحصاء حسب أيام الأسبوع
                if (dayIdx >= 1 && dayIdx <= 6) {
                    weekdayIncidentCounts[dayIdx] = (weekdayIncidentCounts[dayIdx] || 0) + 1;
                }
            }
        });

        // 3. التقسيم حسب الفترات الدراسية المختلفة (Grouping by Periods)
        let periodsData = [];
        let previousPeriodRate = 0;
        let currentPeriodRate = 0;
        let evolutionRate = 0; // نسبة التطور Δ%
        let evolutionDirection = 'stable'; // 'down' (تحسن) | 'up' (تفاقم) | 'stable'

        if (opts.periodMode === 'semesters') {
            // نمط الدورات: S1 مقابل S2
            const s1Sessions = allSessions.filter(s => s.semester === 'S1');
            const s2Sessions = allSessions.filter(s => s.semester === 'S2');

            const s1Collective = s1Sessions.filter(s => s.isCollective);
            const s2Collective = s2Sessions.filter(s => s.isCollective);

            const r1 = s1Sessions.length > 0 ? (s1Collective.length / s1Sessions.length) * 100 : 0;
            const r2 = s2Sessions.length > 0 ? (s2Collective.length / s2Sessions.length) * 100 : 0;

            previousPeriodRate = Math.round(r1 * 10) / 10;
            currentPeriodRate = Math.round(r2 * 10) / 10;

            if (previousPeriodRate > 0) {
                evolutionRate = Math.round(((currentPeriodRate - previousPeriodRate) / previousPeriodRate) * 1000) / 10;
            } else if (currentPeriodRate > 0) {
                evolutionRate = 100;
            } else {
                evolutionRate = 0;
            }

            evolutionDirection = evolutionRate < 0 ? 'down' : (evolutionRate > 0 ? 'up' : 'stable');

            periodsData = [
                {
                    key: 'S1',
                    label: 'الدورة الأولى (Semestre 1)',
                    subLabel: 'شتنبر ⬅️ يناير',
                    totalSessions: s1Sessions.length,
                    collectiveSessions: s1Collective.length,
                    rate: previousPeriodRate,
                    avgDepth: s1Collective.length > 0 ? Math.round(s1Collective.reduce((acc, c) => acc + c.absencePct, 0) / s1Collective.length) : 0,
                    isActive: true
                },
                {
                    key: 'S2',
                    label: 'الدورة الثانية (Semestre 2)',
                    subLabel: 'فبراير ⬅️ يونيو',
                    totalSessions: s2Sessions.length,
                    collectiveSessions: s2Collective.length,
                    rate: currentPeriodRate,
                    avgDepth: s2Collective.length > 0 ? Math.round(s2Collective.reduce((acc, c) => acc + c.absencePct, 0) / s2Collective.length) : 0,
                    isActive: true,
                    deltaFromPrevious: evolutionRate
                }
            ];
        } else if (opts.periodMode === 'periods') {
            // نمط الفترات البيداغوجية الخمس
            let prevRate = null;
            periodsData = PEDAGOGICAL_PERIODS.map((period, idx) => {
                const pSessions = allSessions.filter(s => period.months.includes(s.month));
                const pCollective = pSessions.filter(s => s.isCollective);
                const rate = pSessions.length > 0 ? Math.round((pCollective.length / pSessions.length) * 1000) / 10 : 0;
                let delta = null;
                if (prevRate !== null && prevRate > 0) {
                    delta = Math.round(((rate - prevRate) / prevRate) * 1000) / 10;
                } else if (prevRate !== null && rate > 0) {
                    delta = 100;
                } else if (prevRate !== null) {
                    delta = 0;
                }
                prevRate = rate;

                return {
                    key: period.id,
                    label: period.label,
                    subLabel: period.desc,
                    totalSessions: pSessions.length,
                    collectiveSessions: pCollective.length,
                    rate: rate,
                    avgDepth: pCollective.length > 0 ? Math.round(pCollective.reduce((acc, c) => acc + c.absencePct, 0) / pCollective.length) : 0,
                    deltaFromPrevious: delta
                };
            });

            // حساب التطور العام بين آخر فترتين نشطتين
            const activePeriods = periodsData.filter(p => p.totalSessions > 0);
            if (activePeriods.length >= 2) {
                const last = activePeriods[activePeriods.length - 1];
                const prev = activePeriods[activePeriods.length - 2];
                previousPeriodRate = prev.rate;
                currentPeriodRate = last.rate;
                evolutionRate = last.deltaFromPrevious || 0;
                evolutionDirection = evolutionRate < 0 ? 'down' : (evolutionRate > 0 ? 'up' : 'stable');
            } else if (activePeriods.length === 1) {
                currentPeriodRate = activePeriods[0].rate;
            }
        } else if (opts.periodMode === 'months') {
            // نمط الشهور الدراسية العشرة
            const schoolMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
            let prevMonthRate = null;

            periodsData = schoolMonths.map(m => {
                const mSessions = allSessions.filter(s => s.month === m);
                const mCollective = mSessions.filter(s => s.isCollective);
                const rate = mSessions.length > 0 ? Math.round((mCollective.length / mSessions.length) * 1000) / 10 : 0;
                let delta = null;
                if (prevMonthRate !== null && prevMonthRate > 0) {
                    delta = Math.round(((rate - prevMonthRate) / prevMonthRate) * 1000) / 10;
                } else if (prevMonthRate !== null && rate > 0) {
                    delta = 100;
                } else if (prevMonthRate !== null) {
                    delta = 0;
                }
                if (mSessions.length > 0) prevMonthRate = rate;

                return {
                    key: m,
                    label: MONTH_LABELS[m] ? MONTH_LABELS[m].split(' ')[0] : m,
                    subLabel: MONTH_LABELS[m] || m,
                    totalSessions: mSessions.length,
                    collectiveSessions: mCollective.length,
                    rate: rate,
                    avgDepth: mCollective.length > 0 ? Math.round(mCollective.reduce((acc, c) => acc + c.absencePct, 0) / mCollective.length) : 0,
                    deltaFromPrevious: delta
                };
            });

            const activeMonths = periodsData.filter(p => p.totalSessions > 0);
            if (activeMonths.length >= 2) {
                const last = activeMonths[activeMonths.length - 1];
                const prev = activeMonths[activeMonths.length - 2];
                previousPeriodRate = prev.rate;
                currentPeriodRate = last.rate;
                evolutionRate = last.deltaFromPrevious || 0;
                evolutionDirection = evolutionRate < 0 ? 'down' : (evolutionRate > 0 ? 'up' : 'stable');
            }
        } else if (opts.periodMode === 'holidays') {
            // نمط مقارنة فترات ما قبل وبعد العطل مقابل الأيام الاعتيادية
            const holidaySessions = allSessions.filter(s => s.calendarContext.type === 'pre_holiday' || s.calendarContext.type === 'post_holiday' || s.calendarContext.type === 'weekend_eve');
            const regularSessions = allSessions.filter(s => s.calendarContext.type === 'regular');

            const hCollective = holidaySessions.filter(s => s.isCollective);
            const rCollective = regularSessions.filter(s => s.isCollective);

            const hRate = holidaySessions.length > 0 ? Math.round((hCollective.length / holidaySessions.length) * 1000) / 10 : 0;
            const rRate = regularSessions.length > 0 ? Math.round((rCollective.length / regularSessions.length) * 1000) / 10 : 0;

            previousPeriodRate = rRate;
            currentPeriodRate = hRate;

            if (rRate > 0) {
                evolutionRate = Math.round(((hRate - rRate) / rRate) * 1000) / 10;
            } else if (hRate > 0) {
                evolutionRate = 100;
            } else {
                evolutionRate = 0;
            }

            evolutionDirection = evolutionRate > 0 ? 'up' : (evolutionRate < 0 ? 'down' : 'stable');

            periodsData = [
                {
                    key: 'regular',
                    label: 'الأيام العادية المستقرة',
                    subLabel: 'الحصص وسط الأسبوع الدراسي',
                    totalSessions: regularSessions.length,
                    collectiveSessions: rCollective.length,
                    rate: rRate,
                    avgDepth: rCollective.length > 0 ? Math.round(rCollective.reduce((acc, c) => acc + c.absencePct, 0) / rCollective.length) : 0
                },
                {
                    key: 'holidays',
                    label: 'الفترات الحساسة (عطل ونهاية أسبوع)',
                    subLabel: 'ما قبل وبعد العطل المدرسية وأيام الجمعة/السبت',
                    totalSessions: holidaySessions.length,
                    collectiveSessions: hCollective.length,
                    rate: hRate,
                    avgDepth: hCollective.length > 0 ? Math.round(hCollective.reduce((acc, c) => acc + c.absencePct, 0) / hCollective.length) : 0,
                    deltaFromPrevious: evolutionRate
                }
            ];
        }

        // 4. تحديد القسم الأكثر هشاشة واليوم الأكثر استهدافاً
        let mostVulnerableClass = 'لا يوجد';
        let maxClassIncidents = 0;
        Object.keys(classIncidentCounts).forEach(cls => {
            if (classIncidentCounts[cls] > maxClassIncidents) {
                maxClassIncidents = classIncidentCounts[cls];
                mostVulnerableClass = cls;
            }
        });

        let mostVulnerableDayIdx = 5; // الجمعة افتراضياً
        let maxDayIncidents = 0;
        Object.keys(weekdayIncidentCounts).forEach(day => {
            if (weekdayIncidentCounts[day] > maxDayIncidents) {
                maxDayIncidents = weekdayIncidentCounts[day];
                mostVulnerableDayIdx = parseInt(day, 10);
            }
        });

        // 5. حساب المؤشر الإجمالي العام للتغيب الجماعي
        const totalSessionsCount = allSessions.length;
        const totalIncidentsCount = collectiveIncidents.length;
        const overallRate = totalSessionsCount > 0 ? Math.round((totalIncidentsCount / totalSessionsCount) * 1000) / 10 : 0;

        // مؤشر معامل الخطورة المركب IGC (من 0 إلى 100)
        // يعتمد على: (نسبة الحصص المصابة 40%) + (متوسط عمق الغياب في الحالات 40%) + (عدد الأقسام المتأثرة 20%)
        const affectedClassesCount = Object.keys(classIncidentCounts).length;
        const totalClassesCount = Math.max(1, sortedClassNames.length);
        const avgDepthAll = totalIncidentsCount > 0
            ? (collectiveIncidents.reduce((acc, c) => acc + c.absencePct, 0) / totalIncidentsCount)
            : 0;

        const gravityIndex = Math.min(100, Math.round(
            (overallRate * 1.5) + (avgDepthAll * 0.4) + ((affectedClassesCount / totalClassesCount) * 20)
        ));

        // ترتيب وقائع التغيب الجماعي من الأحدث للأقدم
        collectiveIncidents.sort((a, b) => (b.date > a.date ? 1 : (b.date < a.date ? -1 : 0)));

        const result = {
            overallRate,
            previousPeriodRate,
            currentPeriodRate,
            evolutionRate,
            evolutionDirection,
            totalSessionsCount,
            totalIncidentsCount,
            gravityIndex,
            mostVulnerableClass,
            maxClassIncidents,
            mostVulnerableDayName: ARABIC_WEEKDAYS[mostVulnerableDayIdx] || 'الجمعة',
            maxDayIncidents,
            periodsData,
            collectiveIncidents,
            classIncidentCounts,
            targetClasses,
            threshold: opts.threshold,
            periodMode: opts.periodMode
        };

        AnalyticsCache.set(cacheKey, result);
        return result;
    }

    /**
     * تحديث بطاقة مؤشر التغيب الجماعي في شبكة المؤشرات العلوية للوحة القيادة
     */
    function updateDashboardCollectiveAbsenceKpiCard() {
        const metrics = calculateCollectiveAbsenceMetrics();
        const cardRate = document.getElementById('dashKpiCollectiveAbsenceRate');
        const badge = document.getElementById('dashKpiCollectiveAbsenceEvolutionBadge');
        const icon = document.getElementById('dashKpiCollectiveAbsenceEvolutionIcon');
        const text = document.getElementById('dashKpiCollectiveAbsenceEvolutionText');
        const sub = document.getElementById('dashKpiCollectiveAbsenceSub');

        if (cardRate) {
            cardRate.textContent = `${metrics.overallRate}%`;
        }

        if (sub) {
            sub.textContent = `${metrics.totalIncidentsCount} حصة حرجة · الأكثر: ${metrics.mostVulnerableClass}`;
        }

        if (badge && text && icon) {
            const absDelta = Math.abs(metrics.evolutionRate);
            if (metrics.evolutionDirection === 'down') {
                // انخفاض في التغيب الجماعي (إيجابي وتربوي ممتاز)
                badge.style.background = '#ecfdf5';
                badge.style.color = '#047857';
                badge.style.border = '1px solid #a7f3d0';
                icon.innerHTML = '<span data-lucide="trending-down" data-size="12"></span>';
                text.textContent = `-${absDelta}% تحسن وانخفاض بالدورة`;
            } else if (metrics.evolutionDirection === 'up') {
                // تفاقم في التغيب الجماعي (سلبي ويستدعي الإنذار)
                badge.style.background = '#fff1f2';
                badge.style.color = '#e11d48';
                badge.style.border = '1px solid #fecdd3';
                icon.innerHTML = '<span data-lucide="trending-up" data-size="12"></span>';
                text.textContent = `+${absDelta}% ارتفاع ملحوظ`;
            } else {
                badge.style.background = '#f8fafc';
                badge.style.color = '#475569';
                badge.style.border = '1px solid #cbd5e1';
                icon.innerHTML = '<span data-lucide="minus" data-size="12"></span>';
                text.textContent = `استقرار نسبي في المعدل`;
            }
        }

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * رسم وعرض البطاقة التحليلية الموسعة في لوحة القيادة
     */
    function renderCollectiveAbsenceDashboardWidget() {
        const container = document.getElementById('dashCollectiveAbsenceEvolutionCard');
        if (!container) return;

        const metrics = calculateCollectiveAbsenceMetrics();
        const db = window.db || {};
        const sortedClasses = (typeof window.getSortedClasses === 'function')
            ? window.getSortedClasses()
            : Object.keys(db.classes || {});

        // تقييم مؤشر الخطورة المركب IGC
        let gravityColor = '#10b981';
        let gravityText = 'منخفض ومضبوط';
        let gravityBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (metrics.gravityIndex >= 50) {
            gravityColor = '#e11d48';
            gravityText = 'مرتفع وحرج (يستدعي تدخلاً إدارياً)';
            gravityBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        } else if (metrics.gravityIndex >= 25) {
            gravityColor = '#f59e0b';
            gravityText = 'متوسط (يقظة وتتبع مطلوب)';
            gravityBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        // بناء خيارات تصفية الأقسام
        let classOptionsHtml = `<option value="all" ${_state.classFilter === 'all' ? 'selected' : ''}>جميع الأقسام معاً (${sortedClasses.length} قسماً)</option>`;
        sortedClasses.forEach(cls => {
            const isSel = (_state.classFilter === cls) ? 'selected' : '';
            const cCount = metrics.classIncidentCounts[cls] || 0;
            classOptionsHtml += `<option value="${cls}" ${isSel}>${cls} (${cCount} وقائع)</option>`;
        });

        // بناء شريط الفترات الزمنية
        const modeTabs = [
            { id: 'semesters', label: 'الدورات الدراسية (S1 vs S2)', icon: 'split' },
            { id: 'periods', label: 'الفترات البيداغوجية (P1 ⬅️ P5)', icon: 'calendar-range' },
            { id: 'months', label: 'الشهور الدراسية (10 أشهر)', icon: 'calendar-days' },
            { id: 'holidays', label: 'الفترات الحساسة والعطل', icon: 'shield-alert' }
        ];

        let modeTabsHtml = modeTabs.map(tab => {
            const isActive = _state.periodMode === tab.id;
            return `
                <button type="button" onclick="window.setCollectiveAbsenceFilter('periodMode', '${tab.id}')"
                    class="btn-dash-mini-action"
                    style="${isActive ? 'background: #ea580c; color: #ffffff; border-color: #c2410c; font-weight: 800;' : 'background: #f8fafc; color: #475569;'}">
                    <span>${tab.label}</span>
                </button>
            `;
        }).join('');

        // رسم الأعمدة البيانية التفاعلية للفترات
        const maxRateInPeriods = Math.max(10, ...metrics.periodsData.map(p => p.rate));
        let chartBarsHtml = metrics.periodsData.map((p, idx) => {
            const heightPct = Math.min(100, Math.max(8, Math.round((p.rate / maxRateInPeriods) * 100)));
            let barColor = '#10b981'; // أخضر
            if (p.rate >= 20) barColor = '#e11d48'; // أحمر حرج
            else if (p.rate >= 10) barColor = '#f59e0b'; // برتقالي

            let deltaBadge = '';
            if (p.deltaFromPrevious !== undefined && p.deltaFromPrevious !== null) {
                const isInc = p.deltaFromPrevious > 0;
                const isDec = p.deltaFromPrevious < 0;
                const deltaColor = isInc ? '#e11d48' : (isDec ? '#047857' : '#64748b');
                const deltaBg = isInc ? '#ffe4e6' : (isDec ? '#d1fae5' : '#f1f5f9');
                const sign = isInc ? '+' : '';
                deltaBadge = `<span style="font-size: 0.68rem; font-weight: 800; color: ${deltaColor}; background: ${deltaBg}; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px;">
                    ${sign}${p.deltaFromPrevious}%
                </span>`;
            }

            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 65px; gap: 6px;">
                    <div style="font-size: 0.76rem; font-weight: 900; color: ${barColor};">
                        ${p.rate}%
                    </div>
                    <div style="width: 100%; height: 110px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: flex-end; padding: 3px; position: relative; border: 1px solid #e2e8f0;">
                        <div style="width: 100%; height: ${heightPct}%; background: linear-gradient(180deg, ${barColor} 0%, rgba(234, 88, 12, 0.75) 100%); border-radius: 6px; transition: height 0.4s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.08);"
                             title="${p.label}: ${p.collectiveSessions} حصة حرجة من أصل ${p.totalSessions} حصة (المعدل: ${p.rate}%)"></div>
                    </div>
                    <div style="text-align: center; line-height: 1.2;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #1e293b;">${p.label}</div>
                        <div style="font-size: 0.65rem; color: #64748b; margin-top: 2px;">${p.collectiveSessions}/${p.totalSessions} حصة</div>
                        <div style="margin-top: 3px;">${deltaBadge}</div>
                    </div>
                </div>
            `;
        }).join('');

        // جدول الحصص المسجلة
        let filteredIncidents = metrics.collectiveIncidents;
        if (_state.severityFilter !== 'all') {
            filteredIncidents = filteredIncidents.filter(inc => inc.severity === _state.severityFilter);
        }
        if (_state.searchQuery) {
            const q = _state.searchQuery.trim().toLowerCase();
            filteredIncidents = filteredIncidents.filter(inc => inc.className.toLowerCase().includes(q) || inc.date.includes(q));
        }

        let incidentsRowsHtml = '';
        if (filteredIncidents.length === 0) {
            incidentsRowsHtml = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 25px; color: #64748b; font-weight: 700;">
                        لا توجد حصص تغيب جماعي مسجلة وفق العتبة المحددة (${_state.threshold}%) لهذه التصفية. الوضعية منضبطة.
                    </td>
                </tr>
            `;
        } else {
            incidentsRowsHtml = filteredIncidents.slice(0, 15).map((inc, i) => {
                let badgeStyle = 'background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;';
                let sevLabel = 'حرج جداً (≥50%)';
                if (inc.severity === 'moderate') {
                    badgeStyle = 'background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa;';
                    sevLabel = 'متوسط (35-49%)';
                } else if (inc.severity === 'alert') {
                    badgeStyle = 'background: #fefce8; color: #ca8a04; border: 1px solid #fef08a;';
                    sevLabel = 'تنبيه أولي (25-34%)';
                }

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.8rem; background: ${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
                        <td style="padding: 9px 12px; font-weight: 800; color: #0f172a;">${inc.date}</td>
                        <td style="padding: 9px 12px; font-weight: 700; color: #475569;">${inc.weekdayName} (${inc.timeSlot})</td>
                        <td style="padding: 9px 12px; font-weight: 800; color: #1e3a8a;">
                            <span style="background: #e0f2fe; padding: 2px 7px; border-radius: 5px;">${inc.className}</span>
                        </td>
                        <td style="padding: 9px 12px; text-align: center; font-weight: 900; color: #dc2626;">
                            ${inc.absentCount} من أصل ${inc.totalEnrolled} تلميذ
                        </td>
                        <td style="padding: 9px 12px; text-align: center;">
                            <span style="font-size: 0.82rem; font-weight: 900; color: #b91c1c;">${inc.absencePct}%</span>
                        </td>
                        <td style="padding: 9px 12px; text-align: center;">
                            <span style="padding: 2px 8px; border-radius: 999px; font-size: 0.70rem; font-weight: 800; ${badgeStyle}">
                                ${sevLabel}
                            </span>
                        </td>
                        <td style="padding: 9px 12px; font-size: 0.72rem; color: #64748b;">
                            ${inc.calendarContext.label}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div style="padding: 18px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: #ffffff; width: 42px; height: 42px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(234, 88, 12, 0.28);">
                        <span data-lucide="users-round" data-size="22"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span>مؤشر معدل تطور التغيب الجماعي خلال الفترات الدراسية</span>
                            <span style="font-size: 0.72rem; background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 999px; font-weight: 800; border: 1px solid #fed7aa;">
                                المذكرة الوزارية 142-08
                            </span>
                        </h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">
                            تشخيص ديناميكي لظاهرة الغياب الجماعي لتلميذات وتلاميذ الثانوي التأهيلي، ومقارنة معدلات التطور بين الدورات، الفترات البيداغوجية، ومحطات العطل.
                        </p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn-dash-mini-action" onclick="window.openMinisterialProtocol14208Modal()" style="background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; font-weight: 800;" title="الاطلاع على الإجراءات الوقائية والمساطر الإدارية للمذكرة 142-08">
                        <span data-lucide="book-open-check" data-size="14"></span>
                        <span>مسطرة المذكرة 142-08 📜</span>
                    </button>
                    <button type="button" class="btn-dash-mini-action" onclick="window.exportCollectiveAbsenceReportPDF()" style="background: #0f766e; color: #ffffff; border-color: #115e59; font-weight: 800;" title="تصدير كشف رسمي لتتبع التغيب الجماعي موجه للإدارة">
                        <span data-lucide="printer" data-size="14"></span>
                        <span>تصدير كشف التغيب الجماعي PDF</span>
                    </button>
                </div>
            </div>

            <!-- شريط خيارات التصفية السريعة -->
            <div style="padding: 12px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                <!-- أزرار نمط الفترات -->
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #475569;">الفترة:</span>
                    ${modeTabsHtml}
                </div>

                <!-- خيارات القسم والعتبة -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #475569;">القسم:</span>
                    <select onchange="window.setCollectiveAbsenceFilter('classFilter', this.value)" style="font-size: 0.78rem; font-weight: 700; padding: 5px 10px; border-radius: 7px; border: 1px solid #cbd5e1; background: #ffffff;">
                        ${classOptionsHtml}
                    </select>

                    <span style="font-size: 0.75rem; font-weight: 800; color: #475569;">العتبة:</span>
                    <select onchange="window.setCollectiveAbsenceFilter('threshold', parseInt(this.value, 10))" style="font-size: 0.78rem; font-weight: 700; padding: 5px 10px; border-radius: 7px; border: 1px solid #cbd5e1; background: #ffffff;">
                        <option value="20" ${_state.threshold === 20 ? 'selected' : ''}>20% من القسم</option>
                        <option value="25" ${_state.threshold === 25 ? 'selected' : ''}>25% من القسم (الافتراضي)</option>
                        <option value="30" ${_state.threshold === 30 ? 'selected' : ''}>30% من القسم</option>
                        <option value="35" ${_state.threshold === 35 ? 'selected' : ''}>35% من القسم</option>
                    </select>
                </div>
            </div>

            <!-- بطاقات المؤشرات الإحصائية الأربعة -->
            <div style="padding: 16px 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
                <!-- بطاقة 1: معدل تطور التغيب الجماعي -->
                <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px;">
                    <div style="font-size: 0.74rem; font-weight: 800; color: #9a3412;">معدل تطور التغيب الجماعي (Δ%)</div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 1.6rem; font-weight: 900; color: ${metrics.evolutionDirection === 'down' ? '#047857' : (metrics.evolutionDirection === 'up' ? '#b91c1c' : '#475569')};">
                            ${metrics.evolutionRate > 0 ? '+' : ''}${metrics.evolutionRate}%
                        </span>
                        <span style="font-size: 0.75rem; font-weight: 800; color: #c2410c;">مقارنة بالفترة السابقة</span>
                    </div>
                    <div style="font-size: 0.70rem; color: #64748b; margin-top: 4px;">
                        الحالي: <strong>${metrics.currentPeriodRate}%</strong> | السابق: <strong>${metrics.previousPeriodRate}%</strong>
                    </div>
                </div>

                <!-- بطاقة 2: الحصص المتأثرة -->
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px;">
                    <div style="font-size: 0.74rem; font-weight: 800; color: #166534;">إجمالي الحصص الحرجة المرصودة</div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 1.6rem; font-weight: 900; color: #15803d;">${metrics.totalIncidentsCount}</span>
                        <span style="font-size: 0.75rem; font-weight: 800; color: #166534;">حصة (${metrics.overallRate}% من الحصص)</span>
                    </div>
                    <div style="font-size: 0.70rem; color: #64748b; margin-top: 4px;">
                        مجموع الحصص الممسوحة: <strong>${metrics.totalSessionsCount}</strong> حصة
                    </div>
                </div>

                <!-- بطاقة 3: بؤرة الغياب الجماعي -->
                <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px;">
                    <div style="font-size: 0.74rem; font-weight: 800; color: #1e40af;">بؤرة الغياب (القسم واليوم الأكثر تأثراً)</div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">${metrics.mostVulnerableClass}</span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #2563eb;">(يوم ${metrics.mostVulnerableDayName})</span>
                    </div>
                    <div style="font-size: 0.70rem; color: #64748b; margin-top: 4px;">
                        سجل هذا القسم <strong>${metrics.maxClassIncidents}</strong> واقعة تغيب جماعي
                    </div>
                </div>

                <!-- بطاقة 4: معامل الخطورة المركب IGC -->
                <div style="background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border: 1px solid #e9d5ff; border-radius: 10px; padding: 12px 14px;">
                    <div style="font-size: 0.74rem; font-weight: 800; color: #7e22ce;">معامل الخطورة الجماعية (IGC)</div>
                    <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                        <span style="font-size: 1.6rem; font-weight: 900; color: ${gravityColor};">${metrics.gravityIndex}/100</span>
                        <span style="font-size: 0.75rem; font-weight: 800; color: #7e22ce;">درجة المؤشر</span>
                    </div>
                    <div style="font-size: 0.70rem; color: #64748b; margin-top: 4px;">
                        الحالة: <strong style="color: ${gravityColor};">${gravityText}</strong>
                    </div>
                </div>
            </div>

            <!-- الرسم البياني المقارن لتطور التغيب الجماعي عبر الفترات -->
            <div style="padding: 10px 20px 20px 20px;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                        <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="bar-chart-3" data-size="16" style="color: #ea580c;"></span>
                            <span>منحنى ومقارنة نسبة حصص التغيب الجماعي عبر محطات الموسم</span>
                        </div>
                        <span style="font-size: 0.72rem; color: #64748b;">
                            العتبة المعتمدة: <strong>≥ ${_state.threshold}%</strong> من المسجلين بالقسم
                        </span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; overflow-x: auto; padding-bottom: 8px;">
                        ${chartBarsHtml}
                    </div>
                </div>
            </div>

            <!-- جدول وقائع الحصص المتأثرة بالتغيب الجماعي -->
            <div style="padding: 0 20px 20px 20px;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <div style="padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="history" data-size="16" style="color: #c2410c;"></span>
                            <span>سجل الحصص المرصودة كحالات تغيب جماعي (${filteredIncidents.length} حصة)</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <select onchange="window.setCollectiveAbsenceFilter('severityFilter', this.value)" style="font-size: 0.74rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff;">
                                <option value="all" ${_state.severityFilter === 'all' ? 'selected' : ''}>كافة مستويات الخطورة</option>
                                <option value="critical" ${_state.severityFilter === 'critical' ? 'selected' : ''}>حرج جداً (≥50%)</option>
                                <option value="moderate" ${_state.severityFilter === 'moderate' ? 'selected' : ''}>متوسط (35-49%)</option>
                                <option value="alert" ${_state.severityFilter === 'alert' ? 'selected' : ''}>تنبيه أولي (25-34%)</option>
                            </select>
                        </div>
                    </div>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: right;">
                            <thead>
                                <tr style="background: #f1f5f9; font-size: 0.74rem; font-weight: 800; color: #475569; border-bottom: 1px solid #e2e8f0;">
                                    <th style="padding: 8px 12px;">التاريخ</th>
                                    <th style="padding: 8px 12px;">اليوم والتوقيت</th>
                                    <th style="padding: 8px 12px;">القسم</th>
                                    <th style="padding: 8px 12px; text-align: center;">عدد الغائبين</th>
                                    <th style="padding: 8px 12px; text-align: center;">نسبة الغياب</th>
                                    <th style="padding: 8px 12px; text-align: center;">درجة الخطورة</th>
                                    <th style="padding: 8px 12px;">السياق الزمني</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${incidentsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تغيير معايير التصفية وإعادة الرسم
     */
    function setCollectiveAbsenceFilter(key, value) {
        if (_state[key] !== undefined) {
            _state[key] = value;
            AnalyticsCache.clear();
            renderCollectiveAbsenceDashboardWidget();
            updateDashboardCollectiveAbsenceKpiCard();
        }
    }

    /**
     * نافذة استعراض مسطرة وتدابير المذكرة الوزارية 142-08
     */
    function openMinisterialProtocol14208Modal() {
        let modal = document.getElementById('ministerialProtocol14208Modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ministerialProtocol14208Modal';
            modal.className = 'modal-backdrop';
            modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); z-index: 10000; align-items: center; justify-content: center; padding: 20px;';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); direction: rtl; font-family: 'Cairo', system-ui, sans-serif;">
                <div style="padding: 16px 20px; border-bottom: 2px solid #ea580c; display: flex; justify-content: space-between; align-items: center; background: #fff7ed;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #ea580c; color: #ffffff; width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                            <span data-lucide="scale" data-size="18"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 900; color: #9a3412;">
                                مسطرة معالجة ظاهرة الغياب الجماعي (المذكرة الوزارية 142-08)
                            </h3>
                            <div style="font-size: 0.72rem; color: #c2410c;">السلك الثانوي التأهيلي - وزارة التربية الوطنية والتكوين المهني</div>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('ministerialProtocol14208Modal').style.display='none'" style="background: none; border: none; font-size: 1.3rem; color: #94a3b8; cursor: pointer;">✕</button>
                </div>

                <div style="padding: 20px; font-size: 0.85rem; line-height: 1.6; color: #334155;">
                    <div style="background: #eff6ff; border-right: 4px solid #2563eb; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px;">
                        <strong style="color: #1e40af;">الهدف التشريعي:</strong> التصدي الحازم لظاهرة الغياب الجماعي التي تسبق وتلي العطل المدرسية والامتحانات، وصيانة الزمن المدرسي وزمن التعلم الخاص بمادة الرياضيات بالسلك الثانوي التأهيلي.
                    </div>

                    <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 14px 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                        1. الإجراءات الإدارية الصارمة المنصوص عليها:
                    </h4>
                    <ul style="padding-right: 20px; margin: 0 0 14px 0; display: flex; flex-direction: column; gap: 6px;">
                        <li><strong>التوثيق الفوري:</strong> ملء كشف الغياب الإداري وتفريغ اللائحة في الحراسة العامة للخارجية خلال الـ 15 دقيقة الأولى من الحصة.</li>
                        <li><strong>إلزامية الإشعار:</strong> إشعار أمهات وآباء وأولياء التلاميذ المتغيبين جماعياً في نفس اليوم عبر الرسائل النصية/واتساب والبريد المضمون.</li>
                        <li><strong>منع الدخول إلا بترخيص:</strong> لا يسمح لأي تلميذ شارك في غياب جماعي باستئناف الدراسة إلا بعد حضور ولي أمره شخصياً وتوقيع التزام رسمي بالحراسة العامة.</li>
                        <li><strong>خصم نقطة المواظبة والسلوك:</strong> خصم النقط من بيان السلوك والمواظبة في إطار مداولات مجالس الأقسام.</li>
                    </ul>

                    <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 14px 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                        2. التوصيات البيداغوجية والديداكتيكية لأستاذ الرياضيات:
                    </h4>
                    <ul style="padding-right: 20px; margin: 0 0 14px 0; display: flex; flex-direction: column; gap: 6px;">
                        <li><strong>عدم إلغاء الحصة:</strong> الاستمرار في إلقاء الدرس وإنجاز الأنشطة المبرمجة حتى لو حضر تلميذ واحد فقط، مع توثيق ذلك بدفتر النصوص.</li>
                        <li><strong>عدم إعادة الدرس للغائبين:</strong> اعتبار الدرس المنجز بحضور التلاميذ الحاضرين منجزاً بصفة رسمية وداخلاً في اختبارات الفروض المحروسة.</li>
                        <li><strong>برمجة تمارين تطبيقية هادفة:</strong> مكافأة الحاضرين بأنشطة تطبيقية مميزة وتمارين تحضيرية للفروض لتحفيز الانضباط.</li>
                        <li><strong>إدماج أنشطة الدعم الاستدراكي:</strong> توجيه المتغيبين بعد استئنافهم لمنصة الدعم الذاتي التربوي بالمنظومة دون تعطيل سير المقرر.</li>
                    </ul>

                    <div style="margin-top: 18px; text-align: left;">
                        <button type="button" class="btn-primary" onclick="document.getElementById('ministerialProtocol14208Modal').style.display='none'" style="background: #ea580c; border-color: #c2410c; padding: 7px 20px; font-weight: 800; font-size: 0.85rem;">
                            فهمت وموافق
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تصدير كشف التغيب الجماعي الإداري بصيغة PDF
     */
    function exportCollectiveAbsenceReportPDF() {
        const metrics = calculateCollectiveAbsenceMetrics();
        const db = window.db || {};
        const pYear = (db.teacherProfile && db.teacherProfile.academicYear) || '2026/2027';
        const pName = (db.teacherProfile && db.teacherProfile.name) || 'أستاذ مادة الرياضيات';
        const pSchool = (db.teacherProfile && db.teacherProfile.school) || 'الثانوية التأهيلية';

        if (typeof window.openUniversalPdfPreviewModal === 'function') {
            // يمكن الاستفادة من مركز مستندات PDF الموحد
            window.showNotification && window.showNotification('جاري إعداد كشف التغيب الجماعي الرسمي للطباعة...', 'info');
        }

        // توليد نافذة طباعة مخصصة بنسق A4 أنيق ومطابق لمعايير الطبع والنشر
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('يرجى السماح بالنوافذ المنبثقة لمعاينة وطباعة الكشف الرسمي.');
            return;
        }

        const rowsHtml = metrics.collectiveIncidents.map((inc, i) => `
            <tr style="border-bottom: 1px solid #cbd5e1; height: 24px;">
                <td style="text-align: center; border: 1px solid #94a3b8; font-weight: 700;">${i + 1}</td>
                <td style="text-align: center; border: 1px solid #94a3b8; font-weight: 800;">${inc.date}</td>
                <td style="text-align: center; border: 1px solid #94a3b8;">${inc.weekdayName} (${inc.timeSlot})</td>
                <td style="text-align: center; border: 1px solid #94a3b8; font-weight: 800;">${inc.className}</td>
                <td style="text-align: center; border: 1px solid #94a3b8;">${inc.absentCount} / ${inc.totalEnrolled}</td>
                <td style="text-align: center; border: 1px solid #94a3b8; font-weight: 900; color: #b91c1c;">${inc.absencePct}%</td>
                <td style="text-align: right; border: 1px solid #94a3b8; font-size: 7.5pt;">${inc.calendarContext.label}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>كشف تتبع وقائع التغيب الجماعي - ${pYear}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm 12mm; }
                    body { font-family: 'Cairo', 'Amiri', Tahoma, sans-serif; direction: rtl; font-size: 8.5pt; color: #0f172a; margin: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                    th, td { padding: 4px 6px; }
                    th { background: #1e3a8a; color: #ffffff; border: 1px solid #1e3a8a; font-weight: 800; font-size: 8.5pt; }
                </style>
            </head>
            <body>
                <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: right; line-height: 1.4; font-size: 8pt;">
                        <div style="font-weight: 900;">المملكة المغربية</div>
                        <div style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل</div>
                        <div>المؤسسة: <strong>${pSchool}</strong></div>
                    </div>
                    <div style="text-align: center;">
                        <h2 style="margin: 0; font-size: 1.15rem; color: #1e3a8a; font-weight: 900;">كشف تتبع وقائع التغيب الجماعي</h2>
                        <div style="font-size: 0.75rem; color: #475569; margin-top: 2px;">الموسم الدراسي: ${pYear} | المذكرة الوزارية 142-08</div>
                    </div>
                    <div style="text-align: left; line-height: 1.4; font-size: 8pt;">
                        <div>المادة: <strong>الرياضيات</strong></div>
                        <div>الأستاذ: <strong>${pName}</strong></div>
                        <div>تاريخ الإصدار: <strong>${new Date().toISOString().split('T')[0]}</strong></div>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; margin-bottom: 10px; display: flex; justify-content: space-between; font-weight: 800; font-size: 8pt;">
                    <div>معدل التغيب الجماعي العام: <span style="color: #b91c1c;">${metrics.overallRate}%</span></div>
                    <div>مجموع الحصص الحرجة: <span style="color: #b91c1c;">${metrics.totalIncidentsCount}</span></div>
                    <div>القسم الأكثر تسجيلاً: <span style="color: #1e3a8a;">${metrics.mostVulnerableClass}</span></div>
                    <div>مؤشر الخطورة (IGC): <span style="color: #ea580c;">${metrics.gravityIndex}/100</span></div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 25px;">ر.ت</th>
                            <th style="width: 75px;">التاريخ</th>
                            <th style="width: 130px;">الحصة والتوقيت</th>
                            <th style="width: 80px;">القسم</th>
                            <th style="width: 90px;">الغياب / المسجلين</th>
                            <th style="width: 70px;">النسبة</th>
                            <th>السياق الزمني والملاحظات الإدارية</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; font-size: 8pt;">
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; min-height: 60px;">
                        <div style="font-weight: 800;">توقيع أستاذ مادة الرياضيات</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; min-height: 60px;">
                        <div style="font-weight: 800;">تأشيرة الحراسة العامة للخارجية</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; min-height: 60px;">
                        <div style="font-weight: 800;">تأشيرة وخاتم السيد رئيس المؤسسة</div>
                    </div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 300);
    }

    // إتاحة الدوال على كائن window العام
    window.CollectiveAbsenceEvolution = {
        calculateCollectiveAbsenceMetrics,
        renderCollectiveAbsenceDashboardWidget,
        updateDashboardCollectiveAbsenceKpiCard,
        setCollectiveAbsenceFilter,
        openMinisterialProtocol14208Modal,
        exportCollectiveAbsenceReportPDF
    };

    window.setCollectiveAbsenceFilter = setCollectiveAbsenceFilter;
    window.openMinisterialProtocol14208Modal = openMinisterialProtocol14208Modal;
    window.exportCollectiveAbsenceReportPDF = exportCollectiveAbsenceReportPDF;
    window.renderCollectiveAbsenceDashboardWidget = renderCollectiveAbsenceDashboardWidget;
    window.updateDashboardCollectiveAbsenceKpiCard = updateDashboardCollectiveAbsenceKpiCard;

    // استماع لحدث فتح لوحة القيادة (يتم استدعاء renderCollectiveAbsenceDashboardWidget عبر المؤقت المؤجل في renderDashboard لتجنب التكرار المزدوج)
    window.addEventListener('dashboardTabOpened', () => {
        try {
            updateDashboardCollectiveAbsenceKpiCard();
        } catch (e) {
            console.error('Error updating collective absence KPI card:', e);
        }
    });

    // استماع لحدث تحديث قاعدة البيانات (تحديث فقط إذا كانت لوحة القيادة معروضة فعلياً)
    window.addEventListener('dbUpdated', () => {
        AnalyticsCache.clear();
        try {
            const dashEl = document.getElementById('dashboardView');
            const isDashVisible = (window.activeTab === 'dashboard') || (dashEl && dashEl.style.display !== 'none');
            if (isDashVisible) {
                updateDashboardCollectiveAbsenceKpiCard();
                renderCollectiveAbsenceDashboardWidget();
            }
        } catch (e) {}
    });

})(window);
