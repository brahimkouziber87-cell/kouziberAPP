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
        { id: 'p1', label: '08:30 - 09:30', name: 'الحصة 1 (ص)' },
        { id: 'p2', label: '09:30 - 10:30', name: 'الحصة 2 (ص)' },
        { id: 'p3', label: '10:30 - 11:30', name: 'الحصة 3 (ص)' },
        { id: 'p4', label: '11:30 - 12:30', name: 'الحصة 4 (ص)' },
        { id: 'p5', label: '14:30 - 15:30', name: 'الحصة 5 (م)' },
        { id: 'p6', label: '15:30 - 16:30', name: 'الحصة 6 (م)' },
        { id: 'p7', label: '16:30 - 17:30', name: 'الحصة 7 (م)' },
        { id: 'p8', label: '17:30 - 18:30', name: 'الحصة 8 (م)' }
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

    /**
     * توليد هيكل أسابيع السنة الدراسية مع تواريخها وأيامها
     */
    function generateAcademicWeeks(academicYear) {
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

        return weeks;
    }

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

        // تصفية تسجيلات الغياب لهذا القسم
        const allRecords = ((window.db && window.db.records) ? window.db.records : []).filter(r => 
            r.className === className && (r.status === 'غائب' || r.status === 'مبرر' || r.status === 'متأخر')
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
                const h = parseFloat(r.hours || r.duration) || 1;
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

    /**
     * رسم شبكة الخريطة الحرارية (مصفوفة الأسابيع والأيام)
     */
    function renderWeeksHeatmapGrid(weeks, dateMap, maxVal) {
        const container = document.getElementById('heatmapGridContainer');
        if (!container) return;

        const isHours = _heatmapState.metric === 'hours';
        const unit = isHours ? 'س' : 'ح';

        // تجميع الشهور لتنسيق الترويسة العلوية
        const monthSpans = [];
        let curMonth = null;
        let curCount = 0;

        weeks.forEach((w, idx) => {
            if (curMonth === null) {
                curMonth = w.monthName;
                curCount = 1;
            } else if (curMonth === w.monthName) {
                curCount++;
            } else {
                monthSpans.push({ name: curMonth, span: curCount });
                curMonth = w.monthName;
                curCount = 1;
            }
            if (idx === weeks.length - 1) {
                monthSpans.push({ name: curMonth, span: curCount });
            }
        });

        let html = `
            <div style="min-width: 820px; direction: rtl; font-family: inherit;">
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
                                    ? `${wd.name} ${dayObj.dayNumber}/${dayObj.monthNumber}: ${val} ${unit} غياب (${studentCount} تلاميذ)` 
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

            // تحديد الحصة من نص التسجيل
            let matchedPeriodId = 'p1';
            const sessionText = (r.session || r.period || '').toLowerCase();
            
            if (sessionText.includes('14') || sessionText.includes('15:30') || sessionText.includes('الخامسة')) matchedPeriodId = 'p5';
            else if (sessionText.includes('15:30') || sessionText.includes('16:30') || sessionText.includes('السادسة')) matchedPeriodId = 'p6';
            else if (sessionText.includes('16') || sessionText.includes('17:30') || sessionText.includes('السابعة')) matchedPeriodId = 'p7';
            else if (sessionText.includes('17') || sessionText.includes('18') || sessionText.includes('الثامنة')) matchedPeriodId = 'p8';
            else if (sessionText.includes('09:30') || sessionText.includes('10:30') || sessionText.includes('الثانية')) matchedPeriodId = 'p2';
            else if (sessionText.includes('10:30') || sessionText.includes('11:30') || sessionText.includes('الثالثة')) matchedPeriodId = 'p3';
            else if (sessionText.includes('11:30') || sessionText.includes('12') || sessionText.includes('الرابعة')) matchedPeriodId = 'p4';
            else matchedPeriodId = 'p1'; // الافتراضي صباحاً

            const cell = periodMatrix[dayIdx][matchedPeriodId];
            if (cell) {
                const h = parseFloat(r.hours || r.duration) || 1;
                cell.hours += h;
                cell.count += 1;
                cell.records.push(r);
                const v = isHours ? cell.hours : cell.count;
                if (v > maxPeriodVal) maxPeriodVal = v;
            }
        });

        let html = `
            <div style="min-width: 680px; direction: rtl; font-family: inherit;">
                <div style="margin-bottom: 8px; font-size: 0.78rem; color: #475569; font-weight: 700;">
                    ⏰ توزيع كثافة الغياب حسب فترات وحصص اليوم الدراسي (صباحاً ومساءً):
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
                                        title="${wd.name} - ${p.name} (${p.label}): ${val} ${unit} غياب"
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

    /**
     * عرض بطاقة تفاصيل الخلية المنقورة
     */
    function showHeatmapCellDetails(dateStr, dayName, weekNum) {
        _heatmapState.selectedCellDate = dateStr;
        const detailsContainer = document.getElementById('heatmapSelectedCellDetails');
        if (!detailsContainer) return;

        const records = (window.db && window.db.records) ? window.db.records : [];
        const dayRecords = records.filter(r => r.className === _heatmapState.className && r.date === dateStr);

        const isHours = _heatmapState.metric === 'hours';
        const absentRecords = dayRecords.filter(r => r.status === 'غائب' || r.status === 'مبرر');
        const lateRecords = dayRecords.filter(r => r.status === 'متأخر');
        const totalHours = absentRecords.reduce((s, r) => s + (parseFloat(r.hours || r.duration) || 1), 0);

        let recordsListHtml = '';
        if (absentRecords.length > 0) {
            recordsListHtml = `
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
                            ${absentRecords.map(r => {
                                const std = (window.db.classes[_heatmapState.className] || []).find(s => s.id === r.studentId);
                                const stdName = std ? std.name : (r.studentName || 'تلميذ');
                                const isUnjustified = r.status === 'غائب';
                                const badgeColor = isUnjustified ? '#dc2626' : '#2563eb';
                                const badgeBg = isUnjustified ? '#fee2e2' : '#dbeafe';

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0;">
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${escapeHtml(stdName)}</td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">
                                            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.7rem;">
                                                ${r.status}
                                            </span>
                                        </td>
                                        <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${escapeHtml(r.session || r.period || 'حصة الرياضيات')}</td>
                                        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #e2e8f0;">${parseFloat(r.hours || r.duration) || 1} س</td>
                                        <td style="padding: 4px 6px; color: #64748b; border: 1px solid #e2e8f0;">${escapeHtml(r.note || (isUnjustified ? 'غير مبرر' : 'مبرر مسلم'))}</td>
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
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: #ea580c; color: white; width: 24px; height: 24px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold;">
                        📅
                    </span>
                    <strong style="color: #1e293b; font-size: 0.88rem;">
                        تفاصيل يوم ${dayName} (${dateStr}) - الأسبوع الدراسي ${weekNum}
                    </strong>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 0.74rem; background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                        مجموع الغياب: ${totalHours} س (${absentRecords.length} حالة)
                    </span>
                    <button type="button" onclick="window.closeHeatmapCellDetails()" style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #64748b; padding: 0 4px;" title="إغلاق التفاصيل">✕</button>
                </div>
            </div>
            ${recordsListHtml}
        `;

        // إعادة تنشيط الإطار في الشبكة
        if (_heatmapState.viewMode === 'weeks') {
            const academicYear = getAcademicYearDates();
            const weeks = generateAcademicWeeks(academicYear);
            // Re-render to update the active border highlight
            const recordsFiltered = records.filter(r => r.className === _heatmapState.className && (r.status === 'غائب' || r.status === 'مبرر'));
            const dateMap = {};
            recordsFiltered.forEach(r => {
                if (!r.date) return;
                if (!dateMap[r.date]) dateMap[r.date] = { hours: 0, count: 0, studentsSet: new Set() };
                dateMap[r.date].hours += parseFloat(r.hours || r.duration) || 1;
                dateMap[r.date].count += 1;
                if (r.studentId) dateMap[r.date].studentsSet.add(r.studentId);
            });
            renderWeeksHeatmapGrid(weeks, dateMap, 10);
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
                } else {
                    alert('تم نسخ نص الرسالة بنجاح.');
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

    // تصدير الوظائف للواجهة العامة
    window.updateAbsenceHeatmap = updateAbsenceHeatmap;
    window.setHeatmapMetric = setHeatmapMetric;
    window.setHeatmapMode = setHeatmapMode;
    window.onHeatmapFilterChange = onHeatmapFilterChange;
    window.showHeatmapCellDetails = showHeatmapCellDetails;
    window.closeHeatmapCellDetails = closeHeatmapCellDetails;
    window.openHeatmapPreventiveMessageModal = openHeatmapPreventiveMessageModal;
    window.closeHeatmapPreventiveMessageModal = closeHeatmapPreventiveMessageModal;
    window.copyHeatmapPreventiveText = copyHeatmapPreventiveText;
    window.sendHeatmapPreventiveWhatsApp = sendHeatmapPreventiveWhatsApp;
    window.printHeatmapReport = printHeatmapReport;

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
