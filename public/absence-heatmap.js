/**
 * absence-heatmap.js
 * وحدة رسم الخريطة الحرارية (Heatmap) لأيام وأسابيع السنة الدراسية في تبويب التقارير
 * تشخيص بؤر الغياب وتوليد القرارات والتدابير الوقائية الاستباقية للأستاذ
 */
(function (window) {
    'use strict';

    let _heatmapState = {
        className: '',
        dateFrom: '',
        dateTo: '',
        metric: 'hours', // 'hours' or 'count'
        viewMode: 'weeks', // 'weeks' (مصفوفة الأسابيع) or 'periods' (كثافة الحصص)
        periodFilter: 'all', // 'all', 'term1', 'term2', 'currentReport'
        selectedCellDate: null
    };

    const MOROCCAN_WEEKDAYS = [
        { idx: 1, name: 'الإثنين', short: 'إثن' },
        { idx: 2, name: 'الثلاثاء', short: 'ثلا' },
        { idx: 3, name: 'الأربعاء', short: 'أرب' },
        { idx: 4, name: 'الخميس', short: 'خمي' },
        { idx: 5, name: 'الجمعة', short: 'جمع' },
        { idx: 6, name: 'السبت', short: 'سبت' }
    ];

    const STANDARD_PERIODS = [
        { id: 'p1', label: '08:00 - 09:00', name: 'الحصة 1 (ص)' },
        { id: 'p2', label: '09:00 - 10:00', name: 'الحصة 2 (ص)' },
        { id: 'p3', label: '10:00 - 11:00', name: 'الحصة 3 (ص)' },
        { id: 'p4', label: '11:00 - 12:00', name: 'الحصة 4 (ص)' },
        { id: 'p5', label: '12:00 - 13:00', name: 'الحصة 5 (ص)' },
        { id: 'p6', label: '13:00 - 14:00', name: 'الحصة 6 (م)' },
        { id: 'p7', label: '14:00 - 15:00', name: 'الحصة 7 (م)' },
        { id: 'p8', label: '15:00 - 16:00', name: 'الحصة 8 (م)' },
        { id: 'p9', label: '16:00 - 17:00', name: 'الحصة 9 (م)' },
        { id: 'p10', label: '17:00 - 18:00', name: 'الحصة 10 (م)' }
    ];

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * حساب بداية ونهاية الموسم الدراسي
     */
    function getAcademicYearDates() {
        const now = (typeof getAppNow === 'function') ? getAppNow() : new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1; // 1-12
        const startYear = (curMonth >= 8) ? curYear : curYear - 1;
        const endYear = startYear + 1;

        // البداية: 1 شتنبر، النهاية: 10 يوليوز
        return {
            startYear,
            endYear,
            startDateStr: `${startYear}-09-01`,
            endDateStr: `${endYear}-07-10`,
            term1EndStr: `${endYear}-01-31`,
            term2StartStr: `${endYear}-02-01`
        };
    }

    let _cachedWeeksByStartYear = {};

    /**
     * توليد هيكل أسابيع السنة الدراسية مع تواريخها وأيامها (مع تخزين مؤقت لمنع إعادة الحساب المتكرر)
     */
    function generateAcademicWeeks(academicYear) {
        const yrKey = academicYear && academicYear.startYear ? String(academicYear.startYear) : 'default';
        if (_cachedWeeksByStartYear[yrKey]) {
            return _cachedWeeksByStartYear[yrKey];
        }

        const weeks = [];
        const start = new Date(academicYear.startYear, 8, 1); // 1 شتنبر
        
        // محاذاة إلى أول يوم إثنين في الموسم
        const dayOfWeek = start.getDay(); // 0 is Sunday, 1 is Monday...
        const diffToMonday = (dayOfWeek === 0) ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
        const firstMonday = new Date(start);
        firstMonday.setDate(start.getDate() + diffToMonday);

        const endDate = new Date(academicYear.endYear, 6, 12); // منتصف يوليوز

        let currentMonday = new Date(firstMonday);
        let weekIndex = 1;

        while (currentMonday <= endDate && weekIndex <= 42) {
            const weekDays = [];
            const weekStartDate = new Date(currentMonday);
            
            // إضافة أيام الإثنين إلى السبت (6 أيام دراسة)
            for (let d = 0; d < 6; d++) {
                const dayDate = new Date(weekStartDate);
                dayDate.setDate(weekStartDate.getDate() + d);
                
                const yyyy = dayDate.getFullYear();
                const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
                const dd = String(dayDate.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const dayIdx = dayDate.getDay(); // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

                weekDays.push({
                    dayIdx: dayIdx,
                    dateStr: dateStr,
                    dayNumber: dayDate.getDate(),
                    monthNumber: dayDate.getMonth() + 1,
                    year: yyyy,
                    dateObj: dayDate
                });
            }

            const monthOfMonday = currentMonday.getMonth() + 1;
            const monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
            
            weeks.push({
                weekNum: weekIndex,
                monthName: monthNames[monthOfMonday],
                monthNumber: monthOfMonday,
                startMondayStr: weekDays[0].dateStr,
                endSaturdayStr: weekDays[5].dateStr,
                days: weekDays
            });

            currentMonday.setDate(currentMonday.getDate() + 7);
            weekIndex++;
        }

        _cachedWeeksByStartYear[yrKey] = weeks;
        return weeks;
    }

    function getSharedAcademicWeeks() {
        const ay = getAcademicYearDates();
        return { academicYear: ay, weeks: generateAcademicWeeks(ay) };
    }
    window.getAcademicYearDates = getAcademicYearDates;
    window.getSharedAcademicWeeks = getSharedAcademicWeeks;

    /**
     * تحديد لون ومستوى كثافة الخلية
     */
    function getHeatLevel(val, maxVal) {
        if (!val || val <= 0) return { level: 0, bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' };
        
        // تدرج ديناميكي نسبي ومطلق
        if (val >= 10 || (maxVal > 0 && val >= maxVal * 0.75)) {
            return { level: 4, bg: '#dc2626', color: '#ffffff', border: '#b91c1c', badge: 'ذروة حرجة' };
        } else if (val >= 6 || (maxVal > 0 && val >= maxVal * 0.5)) {
            return { level: 3, bg: '#f87171', color: '#ffffff', border: '#ef4444', badge: 'مرتفع' };
        } else if (val >= 3 || (maxVal > 0 && val >= maxVal * 0.25)) {
            return { level: 2, bg: '#fed7aa', color: '#9a3412', border: '#fdba74', badge: 'معتدل' };
        } else {
            return { level: 1, bg: '#fef3c7', color: '#92400e', border: '#fde68a', badge: 'خفيف' };
        }
    }

    /**
     * تحديث ورسم الخريطة الحرارية لقسم معين
     */
    function updateAbsenceHeatmap(className, dateFrom, dateTo) {
        const card = document.getElementById('absenceHeatmapCard');
        if (!card) return;

        // Auto-detect className if not provided
        if (!className) {
            const selectEl = document.getElementById('reportClassSelect');
            if (selectEl && selectEl.value) {
                className = selectEl.value;
            } else if (typeof window.currentClass !== 'undefined' && window.currentClass) {
                className = window.currentClass;
            }
        }

        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            const availableClasses = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];
            if (availableClasses.length > 0) {
                className = availableClasses[0];
                const selectEl = document.getElementById('reportClassSelect');
                if (selectEl && !selectEl.value) {
                    selectEl.value = className;
                }
            } else {
                card.style.display = 'block';
                const gridContainer = document.getElementById('heatmapGridContainer');
                if (gridContainer) {
                    gridContainer.innerHTML = '<div style="text-align: center; padding: 24px; color: #64748b; font-weight: 700;">يرجى تحديد أو إضافة قسم لعرض الشبكة الحرارية للغياب للسنة الدراسية كاملة.</div>';
                }
                return;
            }
        }

        _heatmapState.className = className;
        _heatmapState.dateFrom = dateFrom || '';
        _heatmapState.dateTo = dateTo || '';

        // Synchronize period selector if needed
        const periodSel = document.getElementById('heatmapPeriodSelect');
        if (periodSel && _heatmapState.periodFilter) {
            periodSel.value = _heatmapState.periodFilter;
        }

        // تصفية تسجيلات الغياب لهذا القسم عبر الفهرس السريع مع استبعاد العطل الرسمية والرخص الإدارية
        const rawClassRecords = (typeof window.getClassRecordsFast === 'function')
            ? window.getClassRecordsFast(className)
            : ((window.db && window.db.records) ? window.db.records.filter(r => r.className === className) : []);
        const isProtectedFn = (typeof window.isRecordProtectedHolidayOrLeave === 'function')
            ? window.isRecordProtectedHolidayOrLeave
            : null;
        const allRecords = rawClassRecords.filter(r =>
            (r.status === 'غائب' || r.status === 'مبرر' || r.status === 'متأخر') &&
            (!isProtectedFn || !isProtectedFn(r))
        );

        card.style.display = 'block';

        const academicYear = getAcademicYearDates();
        const weeks = generateAcademicWeeks(academicYear);

        // تصفية الأسابيع حسب محدد الفترة
        let filteredWeeks = weeks;
        if (_heatmapState.periodFilter === 'term1') {
            filteredWeeks = weeks.filter(w => w.startMondayStr <= academicYear.term1EndStr);
        } else if (_heatmapState.periodFilter === 'term2') {
            filteredWeeks = weeks.filter(w => w.startMondayStr >= academicYear.term2StartStr);
        } else if (_heatmapState.periodFilter === 'currentReport' && dateFrom && dateTo) {
            filteredWeeks = weeks.filter(w => w.endSaturdayStr >= dateFrom && w.startMondayStr <= dateTo);
            if (filteredWeeks.length === 0) filteredWeeks = weeks; // احتراز
        }

        // بناء خريطة البيانات التاريخية باليوم
        const dateMap = {}; // { 'YYYY-MM-DD': { hours, count, justified, unjustified, late, studentsSet, records: [] } }
        
        allRecords.forEach(r => {
            if (!r.date) return;
            if (!dateMap[r.date]) {
                dateMap[r.date] = {
                    hours: 0,
                    count: 0,
                    justified: 0,
                    unjustified: 0,
                    late: 0,
                    studentsSet: new Set(),
                    records: []
                };
            }
            const item = dateMap[r.date];
            item.records.push(r);
            if (r.studentId) item.studentsSet.add(r.studentId);

            if (r.status === 'غائب' || r.status === 'مبرر') {
                const h = (typeof window.getRecordAbsenceDuration === 'function')
                    ? window.getRecordAbsenceDuration(r)
                    : (r.part === 'h1' || r.part === 'h2' ? 1 : (parseFloat(r.hours || r.duration) || 1));
                item.hours += h;
                item.count += 1;
                if (r.status === 'مبرر') item.justified += h;
                else item.unjustified += h;
            } else if (r.status === 'متأخر') {
                item.late += 1;
            }
        });

        // العثور على القيمة القصوى للمقياس المعتمد
        let maxVal = 0;
        let weekdayAggregates = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        let weekdayCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        let weekAggregates = {};

        filteredWeeks.forEach(w => {
            weekAggregates[w.weekNum] = 0;
            w.days.forEach(d => {
                const dayData = dateMap[d.dateStr];
                if (dayData) {
                    const val = (_heatmapState.metric === 'hours') ? dayData.hours : dayData.count;
                    if (val > maxVal) maxVal = val;
                    if (d.dayIdx >= 1 && d.dayIdx <= 6) {
                        weekdayAggregates[d.dayIdx] += val;
                        weekdayCounts[d.dayIdx] += 1;
                    }
                    weekAggregates[w.weekNum] += val;
                }
            });
        });

        // تحليل بؤر الذروة
        let peakDayIdx = 5; // الجمعة افتراضياً
        let peakDayVal = -1;
        let totalVal = 0;
        for (let idx = 1; idx <= 6; idx++) {
            totalVal += weekdayAggregates[idx];
            if (weekdayAggregates[idx] > peakDayVal) {
                peakDayVal = weekdayAggregates[idx];
                peakDayIdx = idx;
            }
        }

        let peakWeekNum = 1;
        let peakWeekVal = -1;
        Object.keys(weekAggregates).forEach(wNum => {
            if (weekAggregates[wNum] > peakWeekVal) {
                peakWeekVal = weekAggregates[wNum];
                peakWeekNum = parseInt(wNum, 10);
            }
        });

        const peakDayObj = MOROCCAN_WEEKDAYS.find(wd => wd.idx === peakDayIdx) || MOROCCAN_WEEKDAYS[4];
        const peakDayPercent = totalVal > 0 ? Math.round((peakDayVal / totalVal) * 100) : 0;

        // حفظ البيانات المحسوبة لإعادة استخدامها الفوري عند نقر خلية دون إعادة الحساب
        _heatmapState.cachedFilteredWeeks = filteredWeeks;
        _heatmapState.cachedDateMap = dateMap;
        _heatmapState.cachedMaxVal = maxVal;

        // رسم مؤشرات KPI العلوية
        renderHeatmapKPIs(peakDayObj, peakDayVal, peakDayPercent, peakWeekNum, peakWeekVal, totalVal);

        // رسم الشبكة حسب نمط العرض
        if (_heatmapState.viewMode === 'weeks') {
            renderWeeksHeatmapGrid(filteredWeeks, dateMap, maxVal);
        } else {
            renderPeriodsHeatmapGrid(allRecords);
        }

        // توليد القرارات والتدابير الوقائية الذكية
        renderPreventiveDecisions(className, peakDayObj, peakDayVal, peakDayPercent, peakWeekNum, peakWeekVal, totalVal);

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * رسم مؤشرات KPIs التحليلية
     */
    function renderHeatmapKPIs(peakDayObj, peakDayVal, peakDayPercent, peakWeekNum, peakWeekVal, totalVal) {
        const row = document.getElementById('heatmapKPIsRow');
        if (!row) return;

        const isHours = _heatmapState.metric === 'hours';
        const unit = isHours ? 'ساعة' : 'حالة';

        if (totalVal === 0) {
            row.innerHTML = `
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="color: #15803d; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                        🌟 حالة المواظبة
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #15803d;">
                        حضور تام 100%
                    </div>
                    <div style="font-size: 0.72rem; color: #16a34a; font-weight: 700; margin-top: 2px;">
                        انضباط نموذجي عبر كامل السنة
                    </div>
                </div>

                <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="color: #1e40af; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                        📅 النطاق الزمني المرصود
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">
                        كامل السنة الدراسية
                    </div>
                    <div style="font-size: 0.72rem; color: #3b82f6; font-weight: 700; margin-top: 2px;">
                        36 أسبوعاً دراسياً مبرمجاً
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="color: #475569; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                        📊 إجمالي ساعات الغياب
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #334155;">
                        0 <span style="font-size: 0.8rem;">ساعة</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; font-weight: 700; margin-top: 2px;">
                        لا توجد أي غيابات مسجلة
                    </div>
                </div>

                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
                    <div style="color: #166534; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                        🛡️ التوجيه الوقائي
                    </div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: #15803d; margin-top: 3px;">
                        تثمين الانضباط والتحفيز
                    </div>
                    <div style="font-size: 0.72rem; color: #16a34a; font-weight: 700; margin-top: 2px;">
                        مواصلة التشجيع الإيجابي
                    </div>
                </div>
            `;
            return;
        }

        row.innerHTML = `
            <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="color: #c2410c; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                    🚨 اليوم الأكثر هشاشة
                </div>
                <div style="font-size: 1.15rem; font-weight: 900; color: #9a3412;">
                    يوم ${peakDayObj.name}
                </div>
                <div style="font-size: 0.72rem; color: #ea580c; font-weight: 700; margin-top: 2px;">
                    ${peakDayVal} ${unit} (${peakDayPercent}% من غياب القسم)
                </div>
            </div>

            <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="color: #991b1b; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                    ⚠️ أسبوع الذروة الحرج
                </div>
                <div style="font-size: 1.15rem; font-weight: 900; color: #b91c1c;">
                    الأسبوع ${peakWeekNum}
                </div>
                <div style="font-size: 0.72rem; color: #dc2626; font-weight: 700; margin-top: 2px;">
                    ${peakWeekVal} ${unit} مسجلة
                </div>
            </div>

            <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="color: #1e40af; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                    📊 إجمالي الرصد المدروس
                </div>
                <div style="font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">
                    ${totalVal} <span style="font-size: 0.8rem;">${unit}</span>
                </div>
                <div style="font-size: 0.72rem; color: #3b82f6; font-weight: 700; margin-top: 2px;">
                    ضمن النطاق الزمني المحدد
                </div>
            </div>

            <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
                <div style="color: #166534; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                    🛡️ نمط الغياب الغالب
                </div>
                <div style="font-size: 0.95rem; font-weight: 800; color: #15803d; margin-top: 3px;">
                    ${peakDayPercent >= 35 ? 'غياب دوري منتظم' : 'تشتت نسبي متوازن'}
                </div>
                <div style="font-size: 0.72rem; color: #16a34a; font-weight: 700; margin-top: 2px;">
                    ${peakDayPercent >= 35 ? 'يستوجب خطة وقائية موجهة' : 'معدلات مقبولة'}
                </div>
            </div>
        `;
    }

    function getRecordHours(r) {
        if (!r) return 0;
        if (typeof window.getRecordAbsenceDuration === 'function') {
            return window.getRecordAbsenceDuration(r);
        }
        return (r.part === 'h1' || r.part === 'h2') ? 1 : (parseFloat(r.hours || r.duration) || 1);
    }

    function getLessonForClassAndDate(className, dateStr) {
        if (!window.db || !dateStr) return null;
        const logs = Array.isArray(window.db.textbook) ? window.db.textbook : (Array.isArray(window.db.lessonLog) ? window.db.lessonLog : []);
        const matched = logs.find(entry => {
            if (!entry || entry.date !== dateStr) return false;
            if (!className || className === 'ALL') return true;
            return entry.className === className || entry.class === className;
        });
        if (!matched) return null;
        return {
            title: matched.title || matched.lesson || matched.topic || matched.content || 'حصة دراسية مسجلة',
            axis: matched.axis || matched.unit || matched.chapter || '',
            type: matched.sessionType || matched.type || 'درس',
            notes: matched.content || matched.notes || ''
        };
    }

    function getHighAbsenceDaysList(weeks, dateMap, maxVal, isHours) {
        const daysList = [];
        (weeks || []).forEach(w => {
            (w.days || []).forEach(d => {
                const dayData = dateMap ? dateMap[d.dateStr] : null;
                if (!dayData) return;
                const val = isHours ? dayData.hours : dayData.count;
                if (val <= 0 && (!dayData.late || dayData.late <= 0)) return;
                const wdObj = MOROCCAN_WEEKDAYS.find(wd => wd.idx === d.dayIdx) || { name: 'يوم', short: '' };
                const heat = getHeatLevel(val, maxVal || 1);
                daysList.push({
                    dateStr: d.dateStr,
                    dayName: wdObj.name,
                    weekNum: w.weekNum,
                    val: val,
                    hours: dayData.hours,
                    count: dayData.count,
                    late: dayData.late || 0,
                    studentCount: dayData.studentsSet ? dayData.studentsSet.size : dayData.count,
                    heat: heat,
                    records: dayData.records || []
                });
            });
        });
        daysList.sort((a, b) => (b.val - a.val) || (b.studentCount - a.studentCount) || b.dateStr.localeCompare(a.dateStr));
        return daysList;
    }

    /**
     * رسم شبكة الخريطة الحرارية (مصفوفة الأسابيع والأيام)
     */
    function renderWeeksHeatmapGrid(weeks, dateMap, maxVal) {
        const container = document.getElementById('heatmapGridContainer');
        if (!container) return;

        const isHours = _heatmapState.metric === 'hours';
        const unit = isHours ? 'س' : 'ح';

        // استخراج الأيام ذات الغياب المرتفع لتمكين النقر المباشر وعرض الغائبين في مكتبة الموارد
        const rankedDays = getHighAbsenceDaysList(weeks, dateMap, maxVal, isHours);
        const highAbsenceDays = rankedDays.filter(d => d.heat.level >= 2);
        const topSpots = (highAbsenceDays.length > 0 ? highAbsenceDays : rankedDays).slice(0, 8);

        let highAbsenceStripHtml = '';
        if (topSpots.length > 0) {
            highAbsenceStripHtml = `
                <div style="margin-bottom: 10px; background: linear-gradient(135deg, #fff7ed 0%, #fef2f2 100%); border: 1.5px solid #fed7aa; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="font-size: 0.76rem; font-weight: 800; color: #9a3412; display: flex; align-items: center; gap: 6px;">
                            <span>🔥 الأيام التي تشهد ذروة الغياب (انقر على أي يوم لعرض تفاصيل الغائبين):</span>
                        </div>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${topSpots.map(spot => `
                            <button type="button"
                                onclick="window.onHeatmapCellClick('${spot.dateStr}', '${escapeHtml(spot.dayName)}', ${spot.weekNum})"
                                title="انقر لعرض تفاصيل الغائبين ليوم ${escapeHtml(spot.dayName)} (${spot.dateStr})"
                                style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; border: 1.5px solid ${spot.heat.border}; background: ${spot.heat.bg}; color: ${spot.heat.color}; font-family: inherit; font-size: 0.72rem; font-weight: 800; cursor: pointer; transition: transform 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.06);"
                                onmouseenter="this.style.transform='translateY(-1px)';"
                                onmouseleave="this.style.transform='none';"
                            >
                                <span>📅 ${escapeHtml(spot.dayName)} ${spot.dateStr}</span>
                                <span style="background: rgba(255,255,255,0.28); padding: 1px 6px; border-radius: 4px; font-size: 0.68rem;">
                                    ${spot.studentCount} غائب (${spot.val} ${unit})
                                </span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        let html = `
            <div style="min-width: 820px; direction: rtl; font-family: inherit;">
                ${highAbsenceStripHtml}
                <!-- شريط الشهور العلوي -->
                <div style="display: grid; grid-template-columns: 80px repeat(${weeks.length}, minmax(28px, 1fr)); gap: 3px; margin-bottom: 4px; font-size: 0.72rem; color: #64748b; font-weight: 700; text-align: center;">
                    <div style="text-align: right; padding-right: 4px; color: #94a3b8;">اليوم / الأسبوع</div>
                    ${weeks.map(w => `<div title="الأسبوع ${w.weekNum} (${w.monthName})" style="font-size: 0.65rem; color: #475569; background: #f1f5f9; border-radius: 3px; padding: 1px 0;">أ${w.weekNum}</div>`).join('')}
                </div>

                <!-- صفوف الأيام الستة (الإثنين إلى السبت) -->
                ${MOROCCAN_WEEKDAYS.map(wd => {
                    return `
                        <div style="display: grid; grid-template-columns: 80px repeat(${weeks.length}, minmax(28px, 1fr)); gap: 3px; margin-bottom: 3px; align-items: center;">
                            <!-- عنوان اليوم -->
                            <div style="font-size: 0.74rem; font-weight: 800; color: #334155; display: flex; align-items: center; justify-content: space-between; padding-left: 6px;">
                                <span>${wd.name}</span>
                                <span style="font-size: 0.62rem; color: #94a3b8; font-weight: 600;">${wd.short}</span>
                            </div>

                            <!-- خلايا الأسابيع لهذا اليوم -->
                            ${weeks.map(w => {
                                const dayObj = w.days.find(d => d.dayIdx === wd.idx);
                                if (!dayObj) {
                                    return `<div style="height: 28px; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 4px;"></div>`;
                                }

                                const dateStr = dayObj.dateStr;
                                const dayData = dateMap[dateStr];
                                const val = dayData ? (isHours ? dayData.hours : dayData.count) : 0;
                                const heat = getHeatLevel(val, maxVal);
                                const isSelected = (_heatmapState.selectedCellDate === dateStr);
                                const activeBorder = isSelected ? '2px solid #000000; transform: scale(1.1); z-index: 5;' : `1px solid ${heat.border}`;

                                const studentCount = dayData ? dayData.studentsSet.size : 0;
                                const tooltipText = dayData 
                                    ? `${wd.name} ${dayObj.dayNumber}/${dayObj.monthNumber} (${dateStr}): ${val} ${unit} غياب (${studentCount} تلاميذ) — انقر لعرض قائمة الغائبين وفتحها في مكتبة الموارد` 
                                    : `${wd.name} ${dayObj.dayNumber}/${dayObj.monthNumber}: 0 غياب`;

                                return `
                                    <div 
                                        onclick="window.showHeatmapCellDetails('${dateStr}', '${wd.name}', ${w.weekNum})"
                                        title="${escapeHtml(tooltipText)}"
                                        style="
                                            height: 28px; 
                                            background: ${heat.bg}; 
                                            color: ${heat.color}; 
                                            border: ${activeBorder}; 
                                            border-radius: 4px; 
                                            display: flex; 
                                            flex-direction: column;
                                            align-items: center; 
                                            justify-content: center; 
                                            cursor: pointer; 
                                            font-size: 0.65rem; 
                                            font-weight: 800;
                                            position: relative;
                                            transition: all 0.15s ease;
                                            box-sizing: border-box;
                                        "
                                        onmouseenter="this.style.boxShadow='0 2px 6px rgba(0,0,0,0.15)'; this.style.transform='scale(1.08)';"
                                        onmouseleave="this.style.boxShadow='none'; this.style.transform='${isSelected ? 'scale(1.1)' : 'scale(1)'}';"
                                    >
                                        ${val > 0 ? `<span>${val}</span>` : `<span style="opacity: 0.25; font-size: 0.55rem;">-</span>`}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * رسم شبكة كثافة الحصص اليومية (أيام الأسبوع × فترات الحصص)
     */
    function renderPeriodsHeatmapGrid(records) {
        const container = document.getElementById('heatmapGridContainer');
        if (!container) return;

        const isHours = _heatmapState.metric === 'hours';
        const unit = isHours ? 'س' : 'ح';

        // تجميع الحصص حسب (اليوم: 1-6) × (الحصة: p1-p8)
        const periodMatrix = {};
        MOROCCAN_WEEKDAYS.forEach(wd => {
            periodMatrix[wd.idx] = {};
            STANDARD_PERIODS.forEach(p => {
                periodMatrix[wd.idx][p.id] = { hours: 0, count: 0, records: [] };
            });
        });

        let maxPeriodVal = 0;

        records.forEach(r => {
            if (!r.date) return;
            const d = new Date(r.date + 'T00:00:00');
            if (isNaN(d.getTime())) return;
            const dayIdx = d.getDay();
            if (dayIdx < 1 || dayIdx > 6) return;

            // تحديد الحصة من نص التسجيل وتوافقها مع التوقيت الموحد (08:00 إلى 18:00)
            let matchedPeriodId = 'p1';
            const sessionText = (r.session || r.period || '').toLowerCase();
            const timeMatch = sessionText.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                let h = parseInt(timeMatch[1], 10);
                if (sessionText.includes('مساء') && h < 12) h += 12;
                if (h <= 8) matchedPeriodId = 'p1';
                else if (h === 9) matchedPeriodId = 'p2';
                else if (h === 10) matchedPeriodId = 'p3';
                else if (h === 11) matchedPeriodId = 'p4';
                else if (h === 12) matchedPeriodId = 'p5';
                else if (h === 13) matchedPeriodId = 'p6';
                else if (h === 14) matchedPeriodId = 'p7';
                else if (h === 15) matchedPeriodId = 'p8';
                else if (h === 16) matchedPeriodId = 'p9';
                else matchedPeriodId = 'p10';
            } else {
                if (sessionText.includes('مساء')) matchedPeriodId = 'p7';
                else matchedPeriodId = 'p1';
            }

            const cell = periodMatrix[dayIdx][matchedPeriodId];
            if (cell && (r.status === 'غائب' || r.status === 'مبرر')) {
                const h = getRecordHours(r);
                cell.hours += h;
                cell.count += 1;
                cell.records.push(r);
                const v = isHours ? cell.hours : cell.count;
                if (v > maxPeriodVal) maxPeriodVal = v;
            }
        });
        _heatmapState.cachedPeriodMatrix = periodMatrix;

        let html = `
            <div style="min-width: 680px; direction: rtl; font-family: inherit;">
                <div style="margin-bottom: 8px; font-size: 0.78rem; color: #475569; font-weight: 700;">
                    ⏰ توزيع كثافة الغياب حسب فترات وحصص اليوم الدراسي (انقر على أي فترة لعرض التلاميذ الغائبين وفتحهم في مكتبة الموارد):
                </div>
                <!-- الترويسة الأفقية للحصص -->
                <div style="display: grid; grid-template-columns: 85px repeat(${STANDARD_PERIODS.length}, 1fr); gap: 4px; margin-bottom: 4px; text-align: center; font-size: 0.7rem; font-weight: 800; color: #475569;">
                    <div style="text-align: right; padding-right: 4px; color: #94a3b8;">اليوم / الحصة</div>
                    ${STANDARD_PERIODS.map(p => `
                        <div style="background: #f1f5f9; border-radius: 4px; padding: 4px 2px;" title="${p.label}">
                            <div>${p.name}</div>
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 600;">${p.label}</div>
                        </div>
                    `).join('')}
                </div>

                <!-- الصفوف للأيام -->
                ${MOROCCAN_WEEKDAYS.map(wd => {
                    return `
                        <div style="display: grid; grid-template-columns: 85px repeat(${STANDARD_PERIODS.length}, 1fr); gap: 4px; margin-bottom: 4px; align-items: center;">
                            <div style="font-size: 0.76rem; font-weight: 800; color: #1e293b;">
                                ${wd.name}
                            </div>
                            ${STANDARD_PERIODS.map(p => {
                                const cell = periodMatrix[wd.idx][p.id];
                                const val = cell ? (isHours ? cell.hours : cell.count) : 0;
                                const heat = getHeatLevel(val, maxPeriodVal);

                                return `
                                    <div 
                                        onclick="window.showHeatmapPeriodDetails(${wd.idx}, '${p.id}', '${escapeHtml(wd.name)}', '${escapeHtml(p.name)}', '${escapeHtml(p.label)}')"
                                        style="
                                            height: 38px;
                                            background: ${heat.bg};
                                            color: ${heat.color};
                                            border: 1px solid ${heat.border};
                                            border-radius: 6px;
                                            display: flex;
                                            flex-direction: column;
                                            align-items: center;
                                            justify-content: center;
                                            font-size: 0.72rem;
                                            font-weight: 800;
                                            cursor: pointer;
                                            transition: transform 0.15s ease;
                                        "
                                        title="${wd.name} - ${p.name} (${p.label}): ${val} ${unit} غياب — انقر لعرض التلاميذ الغائبين"
                                        onmouseenter="this.style.transform='scale(1.05)';"
                                        onmouseleave="this.style.transform='scale(1)';"
                                    >
                                        <span>${val > 0 ? `${val} ${unit}` : '-'}</span>
                                        ${val > 0 ? `<span style="font-size: 0.58rem; opacity: 0.9;">(${cell.records.length} سجل)</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;
    }

    function showHeatmapPeriodDetails(dayIdx, periodId, dayName, periodName, periodLabel) {
        const detailsContainer = document.getElementById('heatmapSelectedCellDetails');
        if (!detailsContainer || !_heatmapState.cachedPeriodMatrix) return;
        const cell = (_heatmapState.cachedPeriodMatrix[dayIdx] || {})[periodId];
        const records = cell ? (cell.records || []) : [];
        const totalHours = records.reduce((s, r) => s + getRecordHours(r), 0);

        // استخراج أحدث تاريخ في هذه الفترة لفتحه في مكتبة الموارد
        const uniqueDates = Array.from(new Set(records.map(r => r.date).filter(Boolean))).sort().reverse();
        const latestDate = uniqueDates[0] || '';

        let recordsHtml = '';
        if (records.length > 0) {
            recordsHtml = `
                <div style="margin-top: 8px; max-height: 190px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: right;">
                        <thead>
                            <tr style="background: #e2e8f0; color: #334155;">
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">التلميذ</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">التاريخ</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">الحالة</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">المدة</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">استدراك في المكتبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map(r => {
                                const std = ((window.db && window.db.classes && window.db.classes[_heatmapState.className]) || []).find(s => s.id === r.studentId);
                                const stdName = std ? std.name : (r.studentName || 'تلميذ');
                                const isUnjustified = r.status === 'غائب';
                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${escapeHtml(stdName)}</td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0; direction: ltr;">${escapeHtml(r.date || '-')}</td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">
                                            <span style="background: ${isUnjustified ? '#fee2e2' : '#dbeafe'}; color: ${isUnjustified ? '#dc2626' : '#2563eb'}; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">${escapeHtml(r.status)}</span>
                                        </td>
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${getRecordHours(r)} س</td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-size: 0.72rem; color: #64748b;">${escapeHtml(r.notes || r.note || r.justification || '—')}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            recordsHtml = `<div style="color: #16a34a; font-weight: bold; padding: 8px; text-align: center; background: #f0fdf4; border-radius: 6px; margin-top: 6px;">✓ لا توجد غيابات مسجلة في هذه الفترة الزمنية.</div>`;
        }

        detailsContainer.style.display = 'block';
        detailsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
                <strong style="color: #1e293b; font-size: 0.86rem;">⏰ تفاصيل فترة ${escapeHtml(dayName)} - ${escapeHtml(periodName)} (${escapeHtml(periodLabel)})</strong>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.74rem; background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                        المجموع: ${totalHours} س (${records.length} حالة)
                    </span>
                    <button type="button" onclick="window.closeHeatmapCellDetails()" style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #64748b; padding: 0 4px;">✕</button>
                </div>
            </div>
            ${recordsHtml}
        `;
    }

    /**
     * عرض بطاقة تفاصيل الخلية المنقورة
     */
    function showHeatmapCellDetails(dateStr, dayName, weekNum) {
        _heatmapState.selectedCellDate = dateStr;
        const detailsContainer = document.getElementById('heatmapSelectedCellDetails');

        const isProtectedFn = typeof window.isRecordProtectedHolidayOrLeave === 'function'
            ? window.isRecordProtectedHolidayOrLeave
            : null;

        const rawDayRecords = (typeof window.getClassDateRecordsFast === 'function')
            ? window.getClassDateRecordsFast(_heatmapState.className, dateStr)
            : ((window.db && window.db.records) ? window.db.records : []).filter(r => r.className === _heatmapState.className && r.date === dateStr);

        const dayRecords = rawDayRecords.filter(r => !isProtectedFn || !isProtectedFn(r));
        const absentRecords = dayRecords.filter(r => r.status === 'غائب' || r.status === 'مبرر');
        const lateRecords = dayRecords.filter(r => r.status === 'متأخر');
        const totalHours = absentRecords.reduce((s, r) => s + getRecordHours(r), 0);
        const lessonInfo = getLessonForClassAndDate(_heatmapState.className, dateStr);

        if (!detailsContainer) return;

        let recordsListHtml = '';
        if (absentRecords.length > 0 || lateRecords.length > 0) {
            const combinedRecords = [...absentRecords, ...lateRecords];
            recordsListHtml = `
                ${lessonInfo ? `
                    <div style="margin-top: 6px; padding: 6px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 0.76rem; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
                        <span>📖 <strong>الدرس المنجز في هذا اليوم:</strong> ${escapeHtml(lessonInfo.title)} ${lessonInfo.axis ? `(${escapeHtml(lessonInfo.axis)})` : ''}</span>
                    </div>
                ` : ''}
                <div style="margin-top: 8px; max-height: 180px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: right;">
                        <thead>
                            <tr style="background: #e2e8f0; color: #334155;">
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">التلميذ</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">النوع</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">الحصة</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">المدة</th>
                                <th style="padding: 4px 6px; border: 1px solid #cbd5e1;">المبرر / ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${combinedRecords.map(r => {
                                const std = ((window.db && window.db.classes && window.db.classes[_heatmapState.className]) || []).find(s => s.id === r.studentId);
                                const stdName = std ? std.name : (r.studentName || 'تلميذ');
                                const isUnjustified = r.status === 'غائب';
                                const isLate = r.status === 'متأخر';
                                const badgeColor = isUnjustified ? '#dc2626' : (isLate ? '#b45309' : '#2563eb');
                                const badgeBg = isUnjustified ? '#fee2e2' : (isLate ? '#fef3c7' : '#dbeafe');

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${escapeHtml(stdName)}</td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">
                                            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">
                                                ${escapeHtml(r.status)}
                                            </span>
                                        </td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${escapeHtml(r.session || r.period || 'حصة الرياضيات')}</td>
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${isLate ? 'تأخر' : `${getRecordHours(r)} س`}</td>
                                        <td style="padding: 4px 6px; color: #64748b; border: 1px solid #e2e8f0;">${escapeHtml(r.note || (isUnjustified ? 'غير مبرر' : (isLate ? 'تأخر مسجل' : 'مبرر مسلم')))}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            recordsListHtml = `
                <div style="color: #16a34a; font-weight: bold; padding: 8px; text-align: center; background: #f0fdf4; border-radius: 6px; margin-top: 6px;">
                    ✓ لم تسجل أي حالة غياب في هذا اليوم. حضور تام للقسم!
                </div>
            `;
        }

        detailsContainer.style.display = 'block';
        detailsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: #ea580c; color: white; width: 24px; height: 24px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">
                        📅
                    </span>
                    <strong style="color: #1e293b; font-size: 0.88rem;">
                        تفاصيل يوم ${escapeHtml(dayName)} (${dateStr}) - الأسبوع الدراسي ${weekNum}
                    </strong>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 0.74rem; background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                        مجموع الغياب: ${totalHours} س (${absentRecords.length} حالة)
                    </span>
                    <button type="button" onclick="window.closeHeatmapCellDetails()" style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #64748b; padding: 0 4px;" title="إغلاق التفاصيل">✕</button>
                </div>
            </div>
            ${recordsListHtml}
        `;

        // إعادة تنشيط الإطار في الشبكة بالاعتماد على البيانات المخزنة مؤقتاً دون إعادة الحساب أو فقدان فلتر الفترة
        if (_heatmapState.viewMode === 'weeks' && _heatmapState.cachedFilteredWeeks && _heatmapState.cachedDateMap) {
            renderWeeksHeatmapGrid(
                _heatmapState.cachedFilteredWeeks,
                _heatmapState.cachedDateMap,
                _heatmapState.cachedMaxVal || 1
            );
        }
    }

    function closeHeatmapCellDetails() {
        _heatmapState.selectedCellDate = null;
        const detailsContainer = document.getElementById('heatmapSelectedCellDetails');
        if (detailsContainer) detailsContainer.style.display = 'none';
    }

    /**
     * توليد القرارات والتدابير البيداغوجية الوقائية الذكية
     */
    function renderPreventiveDecisions(className, peakDayObj, peakDayVal, peakDayPercent, peakWeekNum, peakWeekVal, totalVal) {
        const container = document.getElementById('heatmapPreventiveList');
        if (!container) return;

        const decisions = [];

        if (totalVal === 0) {
            decisions.push({
                icon: '👏',
                title: 'مواظبة ممتازة وانضباط تام لكافة تلاميذ القسم:',
                desc: 'لم يُسجل أي غياب في هذا القسم خلال السنة الدراسية كاملة. يُوصى بمواصلة التشجيع وتثمين التزام التلاميذ.',
                badge: 'انضباط 100%',
                badgeColor: '#16a34a'
            });
            decisions.push({
                icon: '📱',
                title: 'تواصل إيجابي مع الأسر:',
                desc: 'إرسال رسائل تشجيعية عبر WhatsApp للإشادة بالمواظبة النموذجية والحرص على حضور حصص الرياضيات.',
                badge: 'تثمين',
                badgeColor: '#0284c7'
            });
        }

        // 1. تدبير وقائي خاص باليوم الأكثر غياباً
        if (peakDayVal > 0) {
            let dayTip = '';
            if (peakDayObj.idx === 5) { // الجمعة
                dayTip = 'لوحظ أن يوم الجمعة يمثل النسبة الأكبر من الغياب؛ يُوصى بجدولة تمارين وأنشطة الدعم التطبيقي التفاعلي يوم الجمعة، وتجنب مراكمة الفروض المفاجئة يوم الإثنين لتقليل ظاهرة تمديد عطلة نهاية الأسبوع.';
            } else if (peakDayObj.idx === 6) { // السبت
                dayTip = 'يوم السبت يشهد أعلى معدل تسرب؛ يُستحسن اعتماد تقويمات تكوينية سريعة وجذابة وحساب نقط المشاركة الاستباقية لرفع دافعية الحضور.';
            } else if (peakDayObj.idx === 1) { // الإثنين
                dayTip = 'بداية الأسبوع (الإثنين) تسجل ذروة ملحوظة؛ يُنصح ببدء الحصص بتمهيد تشويقي ومراجعات خفيفة تعيد إدماج التلاميذ في وتيرة التحصيل الدراسي.';
            } else {
                dayTip = `يسجل يوم ${peakDayObj.name} تركيزاً مرتفعاً للغياب بنسبة (${peakDayPercent}%)؛ يُوصى بإجراء استطلاع سريع لسبب الغياب الدوري في هذا اليوم (تعارض حصص، ظروف تنقل، أو صعوبة المادة).`;
            }

            decisions.push({
                icon: '🛡️',
                title: `إجراء وقائي لتثبيت الحضور في يوم ${peakDayObj.name}:`,
                desc: dayTip,
                badge: `تركيز ${peakDayPercent}%`,
                badgeColor: '#ea580c'
            });
        }

        // 2. تدبير وقائي خاص بأسابيع الذروة ومواسم ما قبل العطل
        if (peakWeekVal > 0) {
            decisions.push({
                icon: '⚠️',
                title: `استباق بؤرة الأسبوع ${peakWeekNum} (أعلى أسبوع غياب بالموسم):`,
                desc: `سجل الأسبوع ${peakWeekNum} ذروة قدرها ${peakWeekVal} ساعة غياب. يُوصى بالتنسيق مع الحراسة العامة وإدارة المؤسسة لإرسال إشعار مبكر للتلاميذ وأولياء الأمور بأن الدروس مستمرة وفق المقرر الوزاري لقطع دابر الغياب الجماعي.`,
                badge: 'استباق دوري',
                badgeColor: '#dc2626'
            });
        }

        // 3. تدبير وقائي للتواصل والشراكة مع أولياء الأمور
        decisions.push({
            icon: '📱',
            title: 'تفعيل التواصل الرقمي الاستباقي مع أولياء الأمور:',
            desc: `استثمار قناة WhatsApp لإرسال رسائل توعوية تربوية مهذبة لأولياء الأمور قبل أيام الذروة للتذكير بأهمية المواظبة وتأثيرها المباشر على نتائج الرياضيات.`,
            badge: 'تواصل إيجابي',
            badgeColor: '#16a34a'
        });

        // 4. تدبير بيداغوجي للتحفيز وتثمين المواظبة
        decisions.push({
            icon: '⭐',
            title: 'مكافأة المواظبة النموذجية (ميثاق القسم):',
            desc: `تخصيص "وسام التلميذ المواظب" وشارات تميز في مادة الرياضيات للتلاميذ الذين حافظوا على انضباط تام دون أي تغيب خلال شهور الذروة لتحفيز باقي الزملاء.`,
            badge: 'تحفيز تربوي',
            badgeColor: '#2563eb'
        });

        container.innerHTML = decisions.map(d => `
            <div style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <span style="font-size: 1.2rem; flex-shrink: 0; line-height: 1;">${d.icon}</span>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 3px;">
                        <strong style="color: #9a3412; font-size: 0.82rem;">${escapeHtml(d.title)}</strong>
                        <span style="font-size: 0.68rem; font-weight: 800; background: #fff7ed; color: ${d.badgeColor}; border: 1px solid ${d.badgeColor}; padding: 1px 6px; border-radius: 4px;">
                            ${escapeHtml(d.badge)}
                        </span>
                    </div>
                    <p style="margin: 0; font-size: 0.76rem; color: #475569; line-height: 1.45;">
                        ${escapeHtml(d.desc)}
                    </p>
                </div>
            </div>
        `).join('');
    }

    /**
     * تغيير مقياس الخريطة (ساعات / عدد حالات)
     */
    function setHeatmapMetric(metric) {
        _heatmapState.metric = metric;
        const btnH = document.getElementById('btnHeatmapMetricHours');
        const btnC = document.getElementById('btnHeatmapMetricCount');
        if (btnH && btnC) {
            if (metric === 'hours') {
                btnH.style.background = '#ffffff';
                btnH.style.color = '#ea580c';
                btnH.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
                btnC.style.background = 'transparent';
                btnC.style.color = '#64748b';
                btnC.style.boxShadow = 'none';
            } else {
                btnC.style.background = '#ffffff';
                btnC.style.color = '#ea580c';
                btnC.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
                btnH.style.background = 'transparent';
                btnH.style.color = '#64748b';
                btnH.style.boxShadow = 'none';
            }
        }
        if (_heatmapState.className) {
            updateAbsenceHeatmap(_heatmapState.className, _heatmapState.dateFrom, _heatmapState.dateTo);
        }
    }

    /**
     * تغيير نمط عرض الخريطة (أسابيع وأيام / كثافة الحصص)
     */
    function setHeatmapMode(mode) {
        _heatmapState.viewMode = mode;
        const btnW = document.getElementById('btnHeatmapModeWeeks');
        const btnP = document.getElementById('btnHeatmapModePeriods');
        if (btnW && btnP) {
            if (mode === 'weeks') {
                btnW.style.background = '#ea580c';
                btnW.style.color = '#ffffff';
                btnP.style.background = 'transparent';
                btnP.style.color = '#64748b';
            } else {
                btnP.style.background = '#ea580c';
                btnP.style.color = '#ffffff';
                btnW.style.background = 'transparent';
                btnW.style.color = '#64748b';
            }
        }
        if (_heatmapState.className) {
            updateAbsenceHeatmap(_heatmapState.className, _heatmapState.dateFrom, _heatmapState.dateTo);
        }
    }

    /**
     * تغيير فترة التصفية
     */
    function onHeatmapFilterChange() {
        const sel = document.getElementById('heatmapPeriodSelect');
        if (sel) {
            _heatmapState.periodFilter = sel.value;
            if (_heatmapState.className) {
                updateAbsenceHeatmap(_heatmapState.className, _heatmapState.dateFrom, _heatmapState.dateTo);
            }
        }
    }

    /**
     * فتح نافذة رسالة التوعية الوقائية لأولياء الأمور
     */
    function openHeatmapPreventiveMessageModal() {
        let modal = document.getElementById('heatmapPreventiveModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'heatmapPreventiveModal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.background = 'rgba(15, 23, 42, 0.65)';
            modal.style.backdropFilter = 'blur(4px)';
            modal.style.zIndex = '99999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '16px';
            document.body.appendChild(modal);
        }

        const className = _heatmapState.className || 'القسم';
        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'أستاذ(ة) الرياضيات';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school) || '';

        const sampleMessage = `السلام عليكم ورحمة الله وبركاته،\n\nالسادة أولياء أمور تلميذات وتلاميذ قسم (${className}) المحترمين،\n\nتحية تربوية طيبة، وبعد:\nفي إطار التتبع الدوري والمستمر لمواظبة التلاميذ في مادة الرياضيات، وحرصاً على ضمان تحصيلهم الأكاديمي المتميز واستعدادهم الجيد للاستحقاقات التقويمية، نهيب بكم تشجيع أبنائكم وبناتكم على المواظبة التامة والحضور المنتظم لكافة الحصص الدراسية.\n\nإن الحضور المستمر هو الركيزة الأساسية لاستيعاب مفاهيم الرياضيات وتفادي أي تعثر دراسي.\n\nشاكرين لكم حسن تعاونكم الدائم ومرافقتكم المستمرة.\n\n👨‍🏫 *أستاذ(ة) المادة:* ${teacherName}\n🏫 *المؤسسة:* ${schoolName || 'المؤسسة التعليمية'}`;

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 12px; width: 100%; max-width: 540px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); border: 1.5px solid #fed7aa; overflow: hidden; direction: rtl; font-family: inherit;">
                <div style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: white; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2rem;">📱</span>
                        <strong style="font-size: 0.95rem;">رسالة توعية وقائية لأولياء أمور قسم ${escapeHtml(className)}</strong>
                    </div>
                    <button type="button" onclick="window.closeHeatmapPreventiveMessageModal()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
                <div style="padding: 18px;">
                    <p style="font-size: 0.8rem; color: #475569; margin-top: 0; margin-bottom: 10px;">
                        يمكنك نسخ هذه الرسالة التوجيهية الجاهزة ومشاركتها في مجموعة أولياء الأمور على WhatsApp لتشجيع المواظبة في أيام الذروة:
                    </p>
                    <textarea id="heatmapPreventiveTextarea" style="width: 100%; height: 190px; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; font-family: inherit; font-size: 0.82rem; line-height: 1.5; box-sizing: border-box; resize: vertical;">${escapeHtml(sampleMessage)}</textarea>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; gap: 8px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="window.copyHeatmapPreventiveText()" style="background: #2563eb; font-size: 0.8rem; padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px;">
                            📋 نسخ نص الرسالة
                        </button>
                        <button type="button" class="btn-primary" onclick="window.sendHeatmapPreventiveWhatsApp()" style="background: #16a34a; font-size: 0.8rem; padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px;">
                            💬 فتح WhatsApp
                        </button>
                        <button type="button" onclick="window.closeHeatmapPreventiveMessageModal()" style="background: #e2e8f0; color: #475569; border: none; padding: 8px 14px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;">
                            إلغاء
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    function closeHeatmapPreventiveMessageModal() {
        const modal = document.getElementById('heatmapPreventiveModal');
        if (modal) modal.style.display = 'none';
    }

    function copyHeatmapPreventiveText() {
        const ta = document.getElementById('heatmapPreventiveTextarea');
        if (!ta) return;
        const text = ta.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (typeof showNotification === 'function') {
                    showNotification('تم نسخ نص الرسالة الوقائية بنجاح!', 'success');
                } else if (typeof window.showToast === 'function') {
                    window.showToast('تم نسخ نص الرسالة الوقائية بنجاح!', 'success');
                }
            }).catch(() => {
                ta.select();
                document.execCommand('copy');
            });
        } else {
            ta.select();
            document.execCommand('copy');
        }
    }

    function sendHeatmapPreventiveWhatsApp() {
        const ta = document.getElementById('heatmapPreventiveTextarea');
        if (!ta) return;
        const text = ta.value;
        copyHeatmapPreventiveText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }

    /**
     * طباعة تقرير الخريطة الحرارية والقرارات الوقائية عبر نافذة المعاينة والطباعة الرسمية
     */
    function printHeatmapReport() {
        if (typeof window.openUniversalPdfPreviewModal === 'function') {
            window.openUniversalPdfPreviewModal('heatmap');
        } else {
            window.print();
        }
    }

    /**
     * ============================================================================
     * الخريطة الحرارية التفاعلية للغياب المدمجة داخل مكتبة الموارد (#libraryView)
     * تتيح للأستاذ النقر على الأيام التي تشهد غياباً مرتفعاً لعرض قائمة التلاميذ الغائبين
     * في ذلك اليوم مباشرة داخل مكتبة الموارد وإرسال الموارد التعويضية لهم.
     * ============================================================================
     */
    const _libHeatmapState = {
        className: 'ALL',
        periodFilter: 'all',
        selectedDate: null,
        selectedDayName: '',
        selectedWeekNum: null,
        showFullGrid: true
    };

    function toggleHeatmapAutoOpenLibrary(checked) {
        _heatmapState.autoOpenInLibrary = !!checked;
    }

    function openHeatmapDayInLibrary() {}

    function openLibraryAbsenceHeatmapPanel() {}

    function onLibHeatmapClassChange(val) {
        _libHeatmapState.className = val || 'ALL';
        _libHeatmapState.selectedDate = null;
        renderLibraryInteractiveHeatmap(_libHeatmapState.className, null);
    }

    function onLibHeatmapPeriodChange(val) {
        _libHeatmapState.periodFilter = val || 'all';
        renderLibraryInteractiveHeatmap(_libHeatmapState.className, _libHeatmapState.selectedDate);
    }

    function toggleLibHeatmapGrid() {
        _libHeatmapState.showFullGrid = !_libHeatmapState.showFullGrid;
        renderLibraryInteractiveHeatmap(_libHeatmapState.className, _libHeatmapState.selectedDate);
    }

    function selectLibraryHeatmapDay(dateStr, dayName, weekNum) {
        _libHeatmapState.selectedDate = dateStr;
        _libHeatmapState.selectedDayName = dayName || '';
        _libHeatmapState.selectedWeekNum = weekNum || null;
        renderLibraryInteractiveHeatmap(_libHeatmapState.className, dateStr);
        setTimeout(() => {
            const listEl = document.getElementById('libHeatmapSelectedDayInspector');
            if (listEl) {
                listEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 40);
    }

    function filterLibraryByHeatmapDay(className, lessonTitle) {
        const searchInput = document.getElementById('libSearch');
        const levelSelect = document.getElementById('libFilterLevel');
        if (levelSelect && className && className !== 'ALL') {
            const hasOption = Array.from(levelSelect.options).some(opt => opt.value === className);
            if (hasOption) {
                levelSelect.value = className;
            }
        }
        if (searchInput && lessonTitle) {
            searchInput.value = lessonTitle;
        }
        if (typeof window.renderLibrary === 'function') {
            window.renderLibrary();
        }
        const libGrid = document.getElementById('libraryContainer');
        if (libGrid) {
            libGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof window.showToast === 'function') {
            window.showToast('تمت تصفية موارد المكتبة لعرض الموارد المطابقة لليوم الدراسي المختار 📚', 'success');
        }
    }

    function getSelectedLibraryResourceItem() {
        const sel = document.getElementById('libCompensatoryResourceSelect');
        if (!sel || !sel.value || !window.db || !Array.isArray(window.db.library)) return null;
        return window.db.library.find(item => String(item.id || item.title) === String(sel.value)) || null;
    }

    function shareLibraryResourceWithStudent(studentName, studentClass, dateStr, phone) {
        const resItem = getSelectedLibraryResourceItem();
        const lessonInfo = getLessonForClassAndDate(studentClass, dateStr);
        const lessonTitle = lessonInfo ? lessonInfo.title : (resItem ? resItem.title : 'حصة الرياضيات');
        const resTitle = resItem ? resItem.title : lessonTitle;
        const resUrl = (resItem && resItem.url && !String(resItem.url).startsWith('data:')) ? `\n📎 رابط المورد التربوي: ${resItem.url}` : '';

        const msg = `السلام عليكم ورحمة الله،\nإشعار تربوي خاص بالتلميذ(ة): *${studentName}* (${studentClass})\nنظراً لتغيبكم يوم *${dateStr}*، نشارك معكم المورد التعليمي لاستدراك الحصة الفائتة:\n📘 الدرس/المورد: *${resTitle}*${resUrl}\nنرجو مراجعة الدرس وإنجاز التمارين المرتبطة به.`;

        const cleanPhone = String(phone || '').replace(/[^0-9+]/g, '');
        const waUrl = cleanPhone
            ? `https://wa.me/${cleanPhone.replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`
            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, '_blank');
    }

    function copyAbsentStudentsWithResourceSummary(dateStr, className) {
        const isProtectedFn = typeof window.isRecordProtectedHolidayOrLeave === 'function'
            ? window.isRecordProtectedHolidayOrLeave
            : null;
        const allRecords = (window.db && Array.isArray(window.db.records)) ? window.db.records : [];
        const dayRecords = allRecords.filter(r =>
            r.date === dateStr &&
            (className === 'ALL' || !className || r.className === className) &&
            (r.status === 'غائب' || r.status === 'مبرر' || r.status === 'متأخر') &&
            (!isProtectedFn || !isProtectedFn(r))
        );
        const resItem = getSelectedLibraryResourceItem();
        const lessonInfo = getLessonForClassAndDate(className, dateStr);
        const names = dayRecords.map((r, idx) => {
            const std = ((window.db && window.db.classes && window.db.classes[r.className]) || []).find(s => s.id === r.studentId);
            const stdName = std ? std.name : (r.studentName || 'تلميذ');
            return `${idx + 1}. ${stdName} (${r.className} - ${r.status})`;
        }).join('\n');

        const summary = `📋 قائمة التلاميذ الغائبين ليوم ${dateStr} (${className === 'ALL' ? 'جميع الأقسام' : className}):\n` +
            (lessonInfo ? `📖 الدرس المنجز: ${lessonInfo.title}\n` : '') +
            (resItem ? `📚 المورد التربوي للاستدراك: ${resItem.title}${resItem.url && !String(resItem.url).startsWith('data:') ? ' - ' + resItem.url : ''}\n` : '') +
            `----------------------------\n${names || 'لا يوجد غياب'}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(summary).then(() => {
                if (typeof window.showToast === 'function') {
                    window.showToast('تم نسخ قائمة التلاميذ الغائبين مع المورد التربوي بنجاح 📋', 'success');
                }
            });
        }
    }

    function renderLibraryInteractiveHeatmap(targetClassName, selectedDateStr) {
        const container = document.getElementById('libInteractiveHeatmapWidget');
        if (container) container.innerHTML = '';
        return;

        const classesObj = (window.db && window.db.classes) ? window.db.classes : {};
        const classNames = Object.keys(classesObj);

        if (targetClassName !== undefined && targetClassName !== null && targetClassName !== '') {
            _libHeatmapState.className = targetClassName;
        } else if (!_libHeatmapState.className) {
            _libHeatmapState.className = classNames[0] || 'ALL';
        }
        if (selectedDateStr !== undefined) {
            _libHeatmapState.selectedDate = selectedDateStr;
        }

        const activeClass = _libHeatmapState.className;
        const isProtectedFn = typeof window.isRecordProtectedHolidayOrLeave === 'function'
            ? window.isRecordProtectedHolidayOrLeave
            : null;

        const rawRecords = (window.db && Array.isArray(window.db.records)) ? window.db.records : [];
        const filteredRecords = rawRecords.filter(r =>
            (activeClass === 'ALL' || r.className === activeClass) &&
            (r.status === 'غائب' || r.status === 'مبرر' || r.status === 'متأخر') &&
            (!isProtectedFn || !isProtectedFn(r))
        );

        const academicYear = getAcademicYearDates();
        const weeks = generateAcademicWeeks(academicYear);
        let filteredWeeks = weeks;
        if (_libHeatmapState.periodFilter === 'term1') {
            filteredWeeks = weeks.filter(w => w.startMondayStr <= academicYear.term1EndStr);
        } else if (_libHeatmapState.periodFilter === 'term2') {
            filteredWeeks = weeks.filter(w => w.startMondayStr >= academicYear.term2StartStr);
        }

        const dateMap = {};
        filteredRecords.forEach(r => {
            if (!r.date) return;
            if (!dateMap[r.date]) {
                dateMap[r.date] = {
                    hours: 0,
                    count: 0,
                    justified: 0,
                    unjustified: 0,
                    late: 0,
                    studentsSet: new Set(),
                    records: []
                };
            }
            const item = dateMap[r.date];
            item.records.push(r);
            if (r.studentId) item.studentsSet.add(r.studentId);
            if (r.status === 'غائب' || r.status === 'مبرر') {
                const h = getRecordHours(r);
                item.hours += h;
                item.count += 1;
                if (r.status === 'مبرر') item.justified += h;
                else item.unjustified += h;
            } else if (r.status === 'متأخر') {
                item.late += 1;
            }
        });

        let maxVal = 0;
        filteredWeeks.forEach(w => {
            w.days.forEach(d => {
                const dayData = dateMap[d.dateStr];
                if (dayData && dayData.count > maxVal) {
                    maxVal = dayData.count;
                }
            });
        });

        const rankedDays = getHighAbsenceDaysList(filteredWeeks, dateMap, maxVal || 1, false);
        const highAbsenceDays = rankedDays.filter(d => d.heat.level >= 2);
        const hotDaysToDisplay = (highAbsenceDays.length > 0 ? highAbsenceDays : rankedDays).slice(0, 12);

        // اختيار تلقائي لأعلى يوم غياب إذا لم يكن هناك يوم محدد بعد
        if (!_libHeatmapState.selectedDate && hotDaysToDisplay.length > 0) {
            _libHeatmapState.selectedDate = hotDaysToDisplay[0].dateStr;
            _libHeatmapState.selectedDayName = hotDaysToDisplay[0].dayName;
            _libHeatmapState.selectedWeekNum = hotDaysToDisplay[0].weekNum;
        }

        const activeDate = _libHeatmapState.selectedDate;
        const activeDayData = activeDate ? dateMap[activeDate] : null;
        const activeRecords = activeDayData ? activeDayData.records : [];
        const activeLesson = activeDate ? getLessonForClassAndDate(activeClass === 'ALL' ? null : activeClass, activeDate) : null;

        // تجهيز قائمة الموارد المتاحة في المكتبة لإرسالها للتلاميذ الغائبين
        const libraryItems = (window.db && Array.isArray(window.db.library)) ? window.db.library : [];

        // بناء جدول التلاميذ الغائبين في اليوم المحدد مباشرة داخل مكتبة الموارد
        let selectedDayInspectorHtml = '';
        if (activeDate) {
            const dObj = new Date(activeDate + 'T00:00:00');
            const wdObj = !isNaN(dObj.getTime()) ? (MOROCCAN_WEEKDAYS.find(w => w.idx === dObj.getDay()) || { name: _libHeatmapState.selectedDayName || 'يوم دراسي' }) : { name: _libHeatmapState.selectedDayName || 'يوم دراسي' };
            const absentOnly = activeRecords.filter(r => r.status === 'غائب' || r.status === 'مبرر');
            const lateOnly = activeRecords.filter(r => r.status === 'متأخر');
            const totalDayHours = absentOnly.reduce((s, r) => s + getRecordHours(r), 0);

            selectedDayInspectorHtml = `
                <div id="libHeatmapSelectedDayInspector" style="margin-top: 12px; background: #ffffff; border: 2px solid #fdba74; border-radius: 10px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.08);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1.5px solid #ffedd5; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: #ea580c; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 900;">
                                📅 قائمة الغائبين ليوم ${escapeHtml(wdObj.name)} (${escapeHtml(activeDate)})
                            </span>
                            <span style="background: #fee2e2; color: #b91c1c; padding: 3px 9px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; border: 1px solid #fecaca;">
                                🚨 ${absentOnly.length} غائب (${totalDayHours} س)
                            </span>
                            ${lateOnly.length > 0 ? `
                                <span style="background: #fef3c7; color: #b45309; padding: 3px 9px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; border: 1px solid #fde68a;">
                                    ⏱️ ${lateOnly.length} متأخر
                                </span>
                            ` : ''}
                            ${activeLesson ? `
                                <span style="background: #eff6ff; color: #1d4ed8; padding: 3px 10px; border-radius: 999px; font-size: 0.74rem; font-weight: 800; border: 1px solid #bfdbfe;">
                                    📖 الدرس المنجز: ${escapeHtml(activeLesson.title)}
                                </span>
                            ` : ''}
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <select id="libCompensatoryResourceSelect" style="padding: 5px 10px; border-radius: 6px; border: 1.5px solid #93c5fd; font-size: 0.76rem; font-weight: 700; color: #1e3a8a; background: #eff6ff; max-width: 240px;">
                                <option value="">-- اختر مورداً من المكتبة لإرساله للغائبين --</option>
                                ${libraryItems.map(item => `
                                    <option value="${escapeHtml(String(item.id || item.title))}">${escapeHtml(item.title || 'مورد تعليمي')} (${escapeHtml(item.level || 'عام')})</option>
                                `).join('')}
                            </select>
                            <button type="button" onclick="window.filterLibraryByHeatmapDay('${escapeHtml(activeClass)}', '${escapeHtml(activeLesson ? activeLesson.title : '')}')" style="background: #2563eb; color: #ffffff; border: none; border-radius: 6px; padding: 5px 10px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">
                                🔍 تصفية موارد المكتبة لهذا اليوم
                            </button>
                            <button type="button" onclick="window.copyAbsentStudentsWithResourceSummary('${escapeHtml(activeDate)}', '${escapeHtml(activeClass)}')" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">
                                📋 نسخ لائحة الغائبين والمورد
                            </button>
                        </div>
                    </div>

                    ${activeRecords.length > 0 ? `
                        <div style="max-height: 230px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: right;">
                                <thead>
                                    <tr style="background: #f8fafc; color: #334155; position: sticky; top: 0;">
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">#</th>
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">اسم التلميذ(ة) الغائب</th>
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">القسم</th>
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">الحالة</th>
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">الحصة والمدة</th>
                                        <th style="padding: 6px 8px; border-bottom: 1px solid #cbd5e1;">إرسال مورد الاستدراك</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${activeRecords.map((r, idx) => {
                                        const stdList = (window.db && window.db.classes && window.db.classes[r.className]) || [];
                                        const std = stdList.find(s => s.id === r.studentId);
                                        const stdName = std ? std.name : (r.studentName || 'تلميذ');
                                        const phone = std ? (std.guardianPhone || std.phone || '') : '';
                                        const isUnjustified = r.status === 'غائب';
                                        const isLate = r.status === 'متأخر';
                                        const badgeBg = isUnjustified ? '#fee2e2' : (isLate ? '#fef3c7' : '#dbeafe');
                                        const badgeColor = isUnjustified ? '#dc2626' : (isLate ? '#b45309' : '#2563eb');
                                        return `
                                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                                <td style="padding: 6px 8px; color: #64748b; font-weight: 700;">${idx + 1}</td>
                                                <td style="padding: 6px 8px; font-weight: 800; color: #0f172a;">${escapeHtml(stdName)}</td>
                                                <td style="padding: 6px 8px; font-weight: 700; color: #475569;">${escapeHtml(r.className || '')}</td>
                                                <td style="padding: 6px 8px;">
                                                    <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800;">
                                                        ${escapeHtml(r.status)}
                                                    </span>
                                                </td>
                                                <td style="padding: 6px 8px; color: #334155; font-weight: 700;">
                                                    ${escapeHtml(r.session || r.period || 'حصة الرياضيات')} (${isLate ? 'تأخر' : `${getRecordHours(r)} س`})
                                                </td>
                                                <td style="padding: 6px 8px;">
                                                    <button type="button" onclick="window.shareLibraryResourceWithStudent('${escapeHtml(stdName)}', '${escapeHtml(r.className || '')}', '${escapeHtml(activeDate)}', '${escapeHtml(phone)}')" style="background: #16a34a; color: #ffffff; border: none; border-radius: 6px; padding: 3px 9px; font-size: 0.72rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                                        <span>💬</span>
                                                        <span>إرسال الدرس/التمرين</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div style="padding: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #15803d; font-weight: 800; font-size: 0.8rem; text-align: center;">
                            ✓ لم يسجل أي غياب في يوم ${escapeHtml(activeDate)} لهذا القسم. انقر على أحد الأيام الملونة في الخريطة الحرارية أعلاه لعرض الغائبين.
                        </div>
                    `}
                </div>
            `;
        }

        // بناء شبكة الخريطة الحرارية التفاعلية المدمجة داخل المكتبة
        let interactiveMatrixHtml = '';
        if (_libHeatmapState.showFullGrid) {
            interactiveMatrixHtml = `
                <div style="margin-top: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; overflow-x: auto;">
                    <div style="min-width: 760px; direction: rtl;">
                        <div style="display: grid; grid-template-columns: 75px repeat(${filteredWeeks.length}, minmax(24px, 1fr)); gap: 2px; margin-bottom: 3px; font-size: 0.65rem; color: #64748b; font-weight: 700; text-align: center;">
                            <div style="text-align: right; color: #94a3b8;">اليوم / أسبوع</div>
                            ${filteredWeeks.map(w => `<div title="الأسبوع ${w.weekNum} (${w.monthName})" style="background: #f8fafc; border-radius: 3px;">أ${w.weekNum}</div>`).join('')}
                        </div>
                        ${MOROCCAN_WEEKDAYS.map(wd => `
                            <div style="display: grid; grid-template-columns: 75px repeat(${filteredWeeks.length}, minmax(24px, 1fr)); gap: 2px; margin-bottom: 2px; align-items: center;">
                                <div style="font-size: 0.72rem; font-weight: 800; color: #334155;">${wd.name}</div>
                                ${filteredWeeks.map(w => {
                                    const dayObj = w.days.find(d => d.dayIdx === wd.idx);
                                    if (!dayObj) return `<div style="height: 24px; background: #f8fafc; border-radius: 3px;"></div>`;
                                    const dateStr = dayObj.dateStr;
                                    const dayData = dateMap[dateStr];
                                    const val = dayData ? dayData.count : 0;
                                    const heat = getHeatLevel(val, maxVal || 1);
                                    const isSel = (activeDate === dateStr);
                                    const stdCount = dayData ? dayData.studentsSet.size : 0;
                                    return `
                                        <div
                                            onclick="window.selectLibraryHeatmapDay('${dateStr}', '${wd.name}', ${w.weekNum})"
                                            title="${wd.name} ${dateStr}: ${stdCount} تلميذ غائب (${val} حصة) — انقر لعرض قائمة التلاميذ الغائبين في مكتبة الموارد"
                                            style="
                                                height: 24px;
                                                background: ${heat.bg};
                                                color: ${heat.color};
                                                border: ${isSel ? '2px solid #0f172a; transform: scale(1.1); z-index: 4;' : `1px solid ${heat.border}`};
                                                border-radius: 4px;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                font-size: 0.63rem;
                                                font-weight: 800;
                                                cursor: pointer;
                                            "
                                        >
                                            ${val > 0 ? val : '<span style="opacity:0.25;">-</span>'}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: #ea580c; color: #ffffff; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem;">🔥</span>
                    <div>
                        <h4 style="margin: 0; font-size: 0.94rem; font-weight: 900; color: #9a3412;">
                            الخريطة الحرارية التفاعلية للغياب واستدراك التلاميذ الغائبين (داخل مكتبة الموارد)
                        </h4>
                        <p style="margin: 1px 0 0 0; font-size: 0.74rem; color: #64748b;">
                            انقر على أي يوم يشهد غياباً مرتفعاً في الشريط أو في الخريطة الحرارية لعرض قائمة التلاميذ الغائبين في ذلك اليوم ومشاركة موارد الدرس معهم
                        </p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <select id="libHeatmapClassSelect" onchange="window.onLibHeatmapClassChange(this.value)" style="padding: 5px 10px; border-radius: 7px; border: 1.5px solid #fdba74; font-size: 0.78rem; font-weight: 800; color: #9a3412; background: #ffffff;">
                        <option value="ALL" ${activeClass === 'ALL' ? 'selected' : ''}>جميع الأقسام (${rawRecords.length} سجل)</option>
                        ${classNames.map(c => `<option value="${escapeHtml(c)}" ${activeClass === c ? 'selected' : ''}>قسم: ${escapeHtml(c)}</option>`).join('')}
                    </select>
                    <select id="libHeatmapPeriodSelect" onchange="window.onLibHeatmapPeriodChange(this.value)" style="padding: 5px 10px; border-radius: 7px; border: 1px solid #cbd5e1; font-size: 0.76rem; font-weight: 700; color: #334155; background: #ffffff;">
                        <option value="all" ${_libHeatmapState.periodFilter === 'all' ? 'selected' : ''}>كامل الموسم الدراسي</option>
                        <option value="term1" ${_libHeatmapState.periodFilter === 'term1' ? 'selected' : ''}>الأسدس الأول (د1)</option>
                        <option value="term2" ${_libHeatmapState.periodFilter === 'term2' ? 'selected' : ''}>الأسدس الثاني (د2)</option>
                    </select>
                    <button type="button" onclick="window.toggleLibHeatmapGrid()" style="padding: 5px 10px; border-radius: 7px; border: 1px solid #fdba74; background: #fff7ed; color: #c2410c; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                        ${_libHeatmapState.showFullGrid ? '🔼 طي شبكة الأسابيع' : '🗺️ عرض شبكة الخريطة الحرارية'}
                    </button>
                </div>
            </div>

            <!-- شريط الأيام التي تشهد غياباً مرتفعاً للوصول السريع بنقرة واحدة -->
            <div style="margin-top: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="font-size: 0.75rem; font-weight: 800; color: #b91c1c;">🚨 الأيام ذات الغياب المرتفع:</span>
                ${hotDaysToDisplay.length > 0 ? hotDaysToDisplay.map(spot => {
                    const isSelected = (activeDate === spot.dateStr);
                    return `
                        <button type="button"
                            onclick="window.selectLibraryHeatmapDay('${spot.dateStr}', '${escapeHtml(spot.dayName)}', ${spot.weekNum})"
                            style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: ${isSelected ? '2px solid #0f172a' : `1.5px solid ${spot.heat.border}`}; background: ${spot.heat.bg}; color: ${spot.heat.color}; font-family: inherit; font-size: 0.72rem; font-weight: 800; cursor: pointer; box-shadow: ${isSelected ? '0 2px 6px rgba(0,0,0,0.2)' : 'none'};"
                        >
                            <span>${escapeHtml(spot.dayName)} ${spot.dateStr}</span>
                            <span style="background: rgba(255,255,255,0.28); padding: 0 6px; border-radius: 999px; font-size: 0.68rem;">
                                ${spot.studentCount} تلميذ (${spot.hours} س)
                            </span>
                        </button>
                    `;
                }).join('') : `<span style="font-size: 0.74rem; color: #16a34a; font-weight: 700;">لا توجد أيام غياب مرتفع مسجلة حالياً ضمن هذا الفلتر.</span>`}
            </div>

            ${interactiveMatrixHtml}
            ${selectedDayInspectorHtml}
        `;
    }

    // تصدير الوظائف للواجهة العامة
    window.updateAbsenceHeatmap = updateAbsenceHeatmap;
    window.setHeatmapMetric = setHeatmapMetric;
    window.setHeatmapMode = setHeatmapMode;
    window.onHeatmapFilterChange = onHeatmapFilterChange;
    window.showHeatmapCellDetails = showHeatmapCellDetails;
    window.showHeatmapPeriodDetails = showHeatmapPeriodDetails;
    window.closeHeatmapCellDetails = closeHeatmapCellDetails;
    window.openHeatmapPreventiveMessageModal = openHeatmapPreventiveMessageModal;
    window.closeHeatmapPreventiveMessageModal = closeHeatmapPreventiveMessageModal;
    window.copyHeatmapPreventiveText = copyHeatmapPreventiveText;
    window.sendHeatmapPreventiveWhatsApp = sendHeatmapPreventiveWhatsApp;
    window.printHeatmapReport = printHeatmapReport;
    window.toggleHeatmapAutoOpenLibrary = toggleHeatmapAutoOpenLibrary;
    window.openHeatmapDayInLibrary = openHeatmapDayInLibrary;
    window.openLibraryAbsenceHeatmapPanel = openLibraryAbsenceHeatmapPanel;
    window.renderLibraryInteractiveHeatmap = renderLibraryInteractiveHeatmap;
    window.onLibHeatmapClassChange = onLibHeatmapClassChange;
    window.onLibHeatmapPeriodChange = onLibHeatmapPeriodChange;
    window.toggleLibHeatmapGrid = toggleLibHeatmapGrid;
    window.selectLibraryHeatmapDay = selectLibraryHeatmapDay;
    window.filterLibraryByHeatmapDay = filterLibraryByHeatmapDay;
    window.shareLibraryResourceWithStudent = shareLibraryResourceWithStudent;
    window.copyAbsentStudentsWithResourceSummary = copyAbsentStudentsWithResourceSummary;

    // استماع لتحميل الصفحة (يتم الرسم فقط إذا كان تبويب التقارير مرئياً)
    function _initHeatmapIfVisible() {
        const reportsView = document.getElementById('reportsView');
        if (reportsView && reportsView.style.display !== 'none' && document.getElementById('absenceHeatmapCard')) {
            updateAbsenceHeatmap();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initHeatmapIfVisible);
    } else {
        _initHeatmapIfVisible();
    }

})(window);
