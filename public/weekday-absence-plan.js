/**
 * weekday-absence-plan.js
 * وحدة تحليل أيام الأسبوع الأعلى غياباً والخطة الوقائية الذكية في لوحة القيادة
 * Analysis of peak absence days of the week & One-Touch Smart Preventative Plan
 */

(function () {
    'use strict';

    // الحالة العامة للوحدة
    let _selectedWeekdayIdx = null;
    let _isPreventativePlanOpen = false;
    let _preventativePlanTargetDay = null; // dayIdx (0-6) or null for peak day

    const WEEKDAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const SCHOOL_DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0]; // الإثنين إلى الأحد

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
     * حساب إحصائيات الغياب الموزعة عبر أيام الأسبوع
     * @param {string} filterClass 'all' أو اسم القسم
     * @param {string} filterPeriod 'all' | '30days' | 'month'
     */
    function calculateWeekdayAbsenceStats(filterClass = 'all', filterPeriod = 'all') {
        const records = (window.db && window.db.records) ? window.db.records : [];
        const nowObj = (typeof getAppNow === 'function') ? getAppNow() : new Date();

        // حساب بادئات الشتر أو النطاق الزمني
        const curYear = nowObj.getFullYear();
        const curMonthNum = nowObj.getMonth();
        const curMonthPrefix = `${curYear}-${String(curMonthNum + 1).padStart(2, '0')}`;

        const thirtyDaysAgo = new Date(nowObj.getTime() - (30 * 24 * 60 * 60 * 1000));
        const thirtyDaysAgoStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

        // تهيئة هيكل الأيام
        const dayBuckets = {};
        for (let i = 0; i <= 6; i++) {
            dayBuckets[i] = {
                dayIdx: i,
                dayName: WEEKDAY_NAMES_AR[i],
                totalHours: 0,
                unjustifiedHours: 0,
                justifiedHours: 0,
                incidentCount: 0,
                studentsMap: {}, // studentKey -> { id, name, className, hours, count, lastDate, justified, unjustified }
                classesMap: {}   // className -> hours
            };
        }

        let grandTotalHours = 0;
        let grandTotalIncidents = 0;

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (!rec || !rec.date) continue;

            // حساب الغياب فقط (غير مبرر أو مبرر)
            if (rec.status !== 'غائب' && rec.status !== 'مبرر') continue;

            // استثناء أيام العطل والرخص الرسمية المعفاة تلقائياً
            if (typeof isAbsenceDisabledOnDate === 'function' && isAbsenceDisabledOnDate(rec.date, rec.session)) {
                continue;
            }

            // تصفية حسب القسم
            if (filterClass !== 'all' && rec.className !== filterClass) {
                continue;
            }

            // تصفية حسب النطاق الزمني
            if (filterPeriod === 'month' && !rec.date.startsWith(curMonthPrefix)) {
                continue;
            }
            if (filterPeriod === '30days' && rec.date < thirtyDaysAgoStr) {
                continue;
            }

            // تحديد يوم الأسبوع
            const parts = rec.date.split('-');
            if (parts.length !== 3) continue;
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const d = parseInt(parts[2], 10);
            const dt = new Date(y, m, d);
            if (isNaN(dt.getTime())) continue;

            const dayIdx = dt.getDay(); // 0-6
            const dur = (parseFloat(rec.duration) || 1);

            grandTotalHours += dur;
            grandTotalIncidents++;

            const bucket = dayBuckets[dayIdx];
            bucket.totalHours += dur;
            bucket.incidentCount++;

            if (rec.status === 'غائب') {
                bucket.unjustifiedHours += dur;
            } else if (rec.status === 'مبرر') {
                bucket.justifiedHours += dur;
            }

            // توزيع الأقسام
            const cls = rec.className || 'عام';
            bucket.classesMap[cls] = (bucket.classesMap[cls] || 0) + dur;

            // تتبع التلاميذ
            const stdId = rec.studentId || `std_${rec.date}`;
            const stdKey = `${cls}_${stdId}`;
            if (!bucket.studentsMap[stdKey]) {
                let stdName = stdId;
                if (window.db && window.db.classes && window.db.classes[cls]) {
                    const found = window.db.classes[cls].find(s => String(s.id) === String(stdId));
                    if (found && found.name) stdName = found.name;
                }

                bucket.studentsMap[stdKey] = {
                    id: stdId,
                    name: stdName,
                    className: cls,
                    hours: 0,
                    unjustified: 0,
                    justified: 0,
                    count: 0,
                    lastDate: rec.date,
                    dates: []
                };
            }

            const sObj = bucket.studentsMap[stdKey];
            sObj.hours += dur;
            sObj.count++;
            if (rec.status === 'غائب') sObj.unjustified += dur;
            else sObj.justified += dur;
            if (rec.date > sObj.lastDate) sObj.lastDate = rec.date;
            if (!sObj.dates.includes(rec.date)) sObj.dates.push(rec.date);
        }

        // تحويل خريطة التلاميذ لمصفوفات مرتبة وحساب النسب المئوية
        const processedDays = SCHOOL_DAYS_ORDER.map(idx => {
            const b = dayBuckets[idx];
            const pct = grandTotalHours > 0 ? Math.round((b.totalHours / grandTotalHours) * 1000) / 10 : 0;
            const studentsList = Object.values(b.studentsMap).sort((a, b) => (b.hours - a.hours) || (b.count - a.count));

            return {
                dayIdx: idx,
                dayName: b.dayName,
                totalHours: b.totalHours,
                unjustifiedHours: b.unjustifiedHours,
                justifiedHours: b.justifiedHours,
                incidentCount: b.incidentCount,
                uniqueStudentsCount: studentsList.length,
                students: studentsList,
                classesMap: b.classesMap,
                percentOfTotal: pct,
                rank: 0,
                isPeak: false
            };
        });

        // ترتيب الأيام حسب ساعات الغياب لحساب الرتب
        const sortedByHours = [...processedDays].sort((a, b) => (b.totalHours - a.totalHours) || (b.incidentCount - a.incidentCount));
        sortedByHours.forEach((d, rIdx) => {
            const original = processedDays.find(pd => pd.dayIdx === d.dayIdx);
            if (original) {
                original.rank = rIdx + 1;
                original.isPeak = (rIdx === 0 && original.totalHours > 0);
            }
        });

        const peakDay = sortedByHours[0] && sortedByHours[0].totalHours > 0 ? sortedByHours[0] : null;
        const secondPeakDay = sortedByHours[1] && sortedByHours[1].totalHours > 0 ? sortedByHours[1] : null;

        // حساب معدل نهاية الأسبوع (الجمعة + السبت)
        const fri = processedDays.find(d => d.dayIdx === 5);
        const sat = processedDays.find(d => d.dayIdx === 6);
        const weekendHours = (fri ? fri.totalHours : 0) + (sat ? sat.totalHours : 0);
        const weekendRatePct = grandTotalHours > 0 ? Math.round((weekendHours / grandTotalHours) * 1000) / 10 : 0;

        // الأيام النشطة لحساب المتوسط
        const activeDays = processedDays.filter(d => d.totalHours > 0);
        const averageDayHours = activeDays.length > 0 ? Math.round((grandTotalHours / activeDays.length) * 10) / 10 : 0;

        return {
            days: processedDays,
            sortedDays: sortedByHours,
            grandTotalHours,
            grandTotalIncidents,
            peakDay,
            secondPeakDay,
            weekendHours,
            weekendRatePct,
            averageDayHours,
            filterClass,
            filterPeriod
        };
    }

    /**
     * تحديث ورسم قسم تحليل أيام الأسبوع في لوحة القيادة
     */
    function renderWeekdayAbsenceAnalysis() {
        const section = document.getElementById('dashWeekdayAbsenceSection');
        if (!section) return;

        // 1. تحديث قائمة الأقسام في القائمة المنسدلة
        const classFilterEl = document.getElementById('dashWeekdayClassFilter');
        if (classFilterEl) {
            const currentSelected = classFilterEl.value || 'all';
            const classes = Object.keys((window.db && window.db.classes) ? window.db.classes : {});
            let opts = `<option value="all">جميع الأقسام معاً</option>`;
            classes.forEach(c => {
                const isSel = (c === currentSelected) ? 'selected' : '';
                opts += `<option value="${escapeHtml(c)}" ${isSel}>قسم ${escapeHtml(c)}</option>`;
            });
            classFilterEl.innerHTML = opts;
            if (classes.includes(currentSelected) || currentSelected === 'all') {
                classFilterEl.value = currentSelected;
            } else {
                classFilterEl.value = 'all';
            }
        }

        const selectedClass = classFilterEl ? classFilterEl.value : 'all';
        const periodFilterEl = document.getElementById('dashWeekdayPeriodFilter');
        const selectedPeriod = periodFilterEl ? periodFilterEl.value : 'all';

        // 2. احتساب البيانات
        const stats = calculateWeekdayAbsenceStats(selectedClass, selectedPeriod);

        // 3. تحديث شارة الذروة في الترويسة
        const peakBadge = document.getElementById('dashWeekdayPeakBadge');
        if (peakBadge) {
            if (stats.peakDay && stats.peakDay.totalHours > 0) {
                peakBadge.style.background = '#fef2f2';
                peakBadge.style.color = '#dc2626';
                peakBadge.style.borderColor = '#fecaca';
                peakBadge.innerHTML = `🔴 ذروة الغياب: يوم ${stats.peakDay.dayName} (${stats.peakDay.percentOfTotal}%)`;
            } else {
                peakBadge.style.background = '#ecfdf5';
                peakBadge.style.color = '#059669';
                peakBadge.style.borderColor = '#a7f3d0';
                peakBadge.innerHTML = `✅ لا توجد غيابات مسجلة (انضباط تام)`;
            }
        }

        // 4. تحديث بانر الرؤى والتشخيص (Insight Banner)
        const bannerContainer = document.getElementById('dashWeekdayInsightBanner');
        if (bannerContainer) {
            if (stats.grandTotalHours === 0) {
                bannerContainer.innerHTML = `
                    <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-right: 5px solid #16a34a; border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: #16a34a; background: #dcfce7; width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                                <span data-lucide="check-circle" data-size="18"></span>
                            </span>
                            <div>
                                <div style="font-weight: 800; color: #166534; font-size: 0.88rem;">وضعية نموذجية: انضباط وحضور تام لكافة الحصص</div>
                                <div style="font-size: 0.78rem; color: #15803d; margin-top: 2px;">
                                    لم يتم تسجيل أي ساعات غياب في النطاق المحدد (${selectedClass === 'all' ? 'جميع الأقسام' : 'قسم ' + selectedClass}).
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const peak = stats.peakDay;
                const sec = stats.secondPeakDay;
                const ratioVsAvg = (stats.averageDayHours > 0 && peak) ? Math.round((peak.totalHours / stats.averageDayHours) * 10) / 10 : 1;

                // تشخيص نوعي ذكي
                let trendNote = '';
                if (peak.dayIdx === 5 || peak.dayIdx === 6) {
                    trendNote = `ظاهرة 'تمديد عطلة نهاية الأسبوع': يستحوذ يوما (الجمعة/السبت) على <strong>${stats.weekendRatePct}%</strong> من إجمالي ساعات الغياب.`;
                } else if (peak.dayIdx === 1) {
                    trendNote = `ظاهرة 'صعوبة استئناف الأسبوع': يسجل يوم الإثنين أعلى معدل غياب بسبب إرهاق ما بعد العطلة أو تراكم الواجبات.`;
                } else {
                    trendNote = `تركز الغياب في منتصف الأسبوع (يوم ${peak.dayName}) يرتبط غالباً بضغط الحصص المسائية أو كثافة المواد المبرمجة.`;
                }

                bannerContainer.innerHTML = `
                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%); border: 1.5px solid #fed7aa; border-right: 5px solid #ea580c; border-radius: 10px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.06);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                            <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 280px;">
                                <span style="background: #ffedd5; color: #c2410c; width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 5px rgba(194, 65, 12, 0.15);">
                                    <span data-lucide="alert-triangle" data-size="20"></span>
                                </span>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #9a3412;">
                                            تشخيص الذروة: يوم <span style="color: #c2410c; text-decoration: underline;">${peak.dayName}</span> يسجل أعلى معدل غياب أسبوعي
                                        </h4>
                                        <span style="background: #ea580c; color: #fff; font-size: 0.7rem; font-weight: 800; padding: 1px 7px; border-radius: 6px;">
                                            ${peak.totalHours} ساعة (${peak.percentOfTotal}%)
                                        </span>
                                    </div>
                                    <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #7c2d12; line-height: 1.45;">
                                        ${trendNote} معدل غياب يوم ${peak.dayName} أعلى بـ <strong>${ratioVsAvg} أضعاف</strong> مقارنة بمتوسط باقي أيام الأسبوع (${stats.averageDayHours} س/يوم).
                                        ${sec ? `<span style="color: #9a3412;">(يليه يوم ${sec.dayName} بـ ${sec.totalHours} س بنسبة ${sec.percentOfTotal}%).</span>` : ''}
                                    </p>
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 6px; align-self: center;">
                                <button type="button" onclick="toggleDashboardPreventativePlan(${peak.dayIdx})" class="btn-action" style="background: #059669; color: #fff; border: none; font-size: 0.78rem; font-weight: 800; padding: 6px 14px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25); cursor: pointer;" title="عرض الخطة الوقائية المخصصة ليوم ${peak.dayName}">
                                    <span data-lucide="shield-check" data-size="14"></span>
                                    <span>تفعيل خطة يوم ${peak.dayName}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        // 5. رسم بطاقات أيام الأسبوع (Weekday Cards Grid)
        const grid = document.getElementById('dashWeekdayCardsGrid');
        if (grid) {
            let cardsHtml = '';
            // عرض الأيام المدرسية: الإثنين إلى السبت، ثم الأحد إذا كان به تسجيلات
            const daysToShow = stats.days.filter(d => d.dayIdx !== 0 || d.totalHours > 0);

            daysToShow.forEach(day => {
                const isPeak = day.isPeak;
                const isSecond = (day.rank === 2 && day.totalHours > 0);
                const isZero = (day.totalHours === 0);
                const isSelected = (_selectedWeekdayIdx === day.dayIdx);

                // ألوان وبطاقات ذكية
                let borderStyle = 'border: 1px solid #e2e8f0;';
                let headerBg = '#f8fafc';
                let rankBadgeHtml = '';
                let progressColor = '#3b82f6';

                if (isPeak) {
                    borderStyle = 'border: 1.5px solid #f87171; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12);';
                    headerBg = '#fef2f2';
                    progressColor = '#ef4444';
                    rankBadgeHtml = `<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 999px;">#1 ذروة الغياب ⚠️</span>`;
                } else if (isSecond) {
                    borderStyle = 'border: 1.5px solid #fed7aa; box-shadow: 0 3px 10px rgba(249, 115, 22, 0.08);';
                    headerBg = '#fff7ed';
                    progressColor = '#f97316';
                    rankBadgeHtml = `<span style="background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; font-size: 0.65rem; font-weight: 800; padding: 1px 6px; border-radius: 999px;">#2 مرتفع 🟠</span>`;
                } else if (isZero) {
                    progressColor = '#10b981';
                    rankBadgeHtml = `<span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 999px;">انضباط تام ✅</span>`;
                } else {
                    progressColor = '#6366f1';
                    rankBadgeHtml = `<span style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 999px;">#${day.rank}</span>`;
                }

                if (isSelected) {
                    borderStyle += ' outline: 2px solid #2563eb; background: #f0f7ff;';
                }

                cardsHtml += `
                    <div onclick="selectWeekdayForDetails(${day.dayIdx})" style="cursor: pointer; border-radius: 10px; background: #fff; transition: transform 0.15s, box-shadow 0.15s; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; ${borderStyle}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" title="انقر لعرض تفاصيل التلاميذ الغائبين يوم ${day.dayName}">
                        <!-- Top Header -->
                        <div style="background: ${headerBg}; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${day.dayName}</div>
                            <div>${rankBadgeHtml}</div>
                        </div>

                        <!-- Card Body -->
                        <div style="padding: 12px;">
                            <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px;">
                                <span style="font-size: 1.5rem; font-weight: 900; color: ${isPeak ? '#dc2626' : (isSecond ? '#ea580c' : (isZero ? '#16a34a' : '#1e293b'))}; line-height: 1;">
                                    ${day.totalHours}
                                </span>
                                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">ساعة غياب</span>
                            </div>

                            <!-- Progress Bar of total -->
                            <div style="background: #e2e8f0; height: 7px; border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                                <div style="width: ${day.percentOfTotal}%; background: ${progressColor}; height: 100%; border-radius: 999px;"></div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b; margin-bottom: 8px;">
                                <span>النسبة الأسبوعية:</span>
                                <strong style="color: #0f172a;">${day.percentOfTotal}%</strong>
                            </div>

                            <!-- Sub metrics: Unjustified / Justified -->
                            <div style="background: #f8fafc; border-radius: 6px; padding: 6px 8px; font-size: 0.7rem; display: flex; flex-direction: column; gap: 2px; border: 1px solid #f1f5f9;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #ef4444;">غير مبرر:</span>
                                    <strong style="color: #b91c1c;">${day.unjustifiedHours} س</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: #059669;">مبرر:</span>
                                    <strong style="color: #047857;">${day.justifiedHours} س</strong>
                                </div>
                            </div>
                        </div>

                        <!-- Card Footer -->
                        <div style="padding: 7px 12px; background: #fafafa; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: #64748b;">
                            <span>${day.incidentCount} تسجيل</span>
                            <span style="font-weight: 700; color: #3b82f6;">${day.uniqueStudentsCount} تلميذ</span>
                        </div>
                    </div>
                `;
            });

            grid.innerHTML = cardsHtml;
        }

        // 6. رسم تفاصيل اليوم المحدد (إذا تم اختياره)
        renderSelectedDayDetailContainer(stats);

        // 7. رسم صندوق الخطة الوقائية (إذا كانت مفعلة)
        if (_isPreventativePlanOpen) {
            renderPreventativePlanBox(stats);
        } else {
            const planBox = document.getElementById('dashPreventativePlanBox');
            if (planBox) planBox.style.display = 'none';
            const btnText = document.getElementById('btnDashPreventativePlanText');
            if (btnText) btnText.textContent = 'اقتراح الخطة الوقائية (لمسة واحدة)';
        }

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تحديد يوم معين لمعاينة تلاميذه
     */
    function selectWeekdayForDetails(dayIdx) {
        if (_selectedWeekdayIdx === dayIdx) {
            _selectedWeekdayIdx = null; // إغلاق عند النقر المتكرر
        } else {
            _selectedWeekdayIdx = dayIdx;
        }
        renderWeekdayAbsenceAnalysis();
    }

    /**
     * رسم تفاصيل اليوم المحدد
     */
    function renderSelectedDayDetailContainer(stats) {
        const detailContainer = document.getElementById('dashWeekdaySelectedDayDetail');
        if (!detailContainer) return;

        if (_selectedWeekdayIdx === null) {
            detailContainer.style.display = 'none';
            detailContainer.innerHTML = '';
            return;
        }

        const dayData = stats.days.find(d => d.dayIdx === _selectedWeekdayIdx);
        if (!dayData) {
            detailContainer.style.display = 'none';
            return;
        }

        detailContainer.style.display = 'block';

        if (dayData.students.length === 0) {
            detailContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #10b981;"><span data-lucide="check-circle" data-size="16"></span></span>
                        <span style="font-weight: 700; color: #15803d; font-size: 0.84rem;">لا توجد أي غيابات مسجلة يوم ${dayData.dayName}.</span>
                    </div>
                    <button type="button" onclick="selectWeekdayForDetails(null)" style="background: none; border: none; cursor: pointer; color: #64748b; font-weight: 800;">✕ إغلاق</button>
                </div>
            `;
            return;
        }

        let studentsRowsHtml = '';
        dayData.students.forEach((s, idx) => {
            const phone = (window.db && window.db.classes && window.db.classes[s.className])
                ? (window.db.classes[s.className].find(std => String(std.id) === String(s.id))?.phone || '')
                : '';

            studentsRowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 0.78rem;">
                    <td style="padding: 7px 10px; font-weight: 700; text-align: center; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 7px 10px; font-weight: 800; color: #0f172a;">${escapeHtml(s.name)}</td>
                    <td style="padding: 7px 10px; text-align: center;">
                        <span style="background: #eff6ff; color: #1e40af; padding: 2px 7px; border-radius: 6px; font-weight: 700; font-size: 0.73rem;">${escapeHtml(s.className)}</span>
                    </td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #dc2626;">${s.hours} س</td>
                    <td style="padding: 7px 10px; text-align: center; color: #64748b;">${s.count} مرات</td>
                    <td style="padding: 7px 10px; text-align: center;">
                        <span style="font-size: 0.7rem; color: #b91c1c;">${s.unjustified} س غير مبرر</span>
                        ${s.justified > 0 ? `<span style="font-size: 0.7rem; color: #047857;"> | ${s.justified} س مبرر</span>` : ''}
                    </td>
                    <td style="padding: 7px 10px; text-align: center; font-size: 0.72rem; color: #64748b;">
                        ${s.dates.slice(-3).reverse().join(', ')}${s.dates.length > 3 ? '...' : ''}
                    </td>
                    <td style="padding: 7px 10px; text-align: center;">
                        <button type="button" onclick="sendIndividualDayAlertWhatsApp('${escapeHtml(s.name)}', '${escapeHtml(s.className)}', '${phone}', '${dayData.dayName}', ${s.hours})" style="background: #25d366; color: #fff; border: none; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="مراسلة ولي الأمر بنص تنبيهي خاص بيوم ${dayData.dayName}">
                            <span data-lucide="message-circle" data-size="12"></span>
                            <span>واتساب</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        detailContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: #e0f2fe; color: #0369a1; padding: 5px; border-radius: 7px; display: inline-flex;">
                        <span data-lucide="users" data-size="16"></span>
                    </span>
                    <h4 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a;">
                        قائمة التلاميذ الغائبين يوم <span style="color: #2563eb;">${dayData.dayName}</span> (${dayData.students.length} تلميذ • مجموع ${dayData.totalHours} ساعة)
                    </h4>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" onclick="toggleDashboardPreventativePlan(${dayData.dayIdx})" class="btn-action" style="background: #059669; color: #fff; border: none; font-size: 0.74rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                        <span data-lucide="shield-check" data-size="13"></span>
                        <span>اقتراح خطة وقائية ليوم ${dayData.dayName}</span>
                    </button>
                    <button type="button" onclick="selectWeekdayForDetails(null)" style="background: #e2e8f0; border: none; cursor: pointer; color: #475569; font-weight: 800; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem;">✕ إغلاق</button>
                </div>
            </div>

            <div style="max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; font-size: 0.74rem; color: #475569;">
                            <th style="padding: 6px 10px; text-align: center; width: 35px;">#</th>
                            <th style="padding: 6px 10px;">اسم التلميذ</th>
                            <th style="padding: 6px 10px; text-align: center;">القسم</th>
                            <th style="padding: 6px 10px; text-align: center;">ساعات الغياب</th>
                            <th style="padding: 6px 10px; text-align: center;">التكرار</th>
                            <th style="padding: 6px 10px; text-align: center;">طبيعة الغياب</th>
                            <th style="padding: 6px 10px; text-align: center;">آخر التواريخ</th>
                            <th style="padding: 6px 10px; text-align: center;">إجراء سريع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentsRowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * تبديل عرض الخطة الوقائية بلمسة واحدة
     */
    function toggleDashboardPreventativePlan(forcedDayIdx = null) {
        if (forcedDayIdx !== null && forcedDayIdx !== undefined) {
            _preventativePlanTargetDay = forcedDayIdx;
            _isPreventativePlanOpen = true;
        } else {
            _isPreventativePlanOpen = !_isPreventativePlanOpen;
        }

        const classFilterEl = document.getElementById('dashWeekdayClassFilter');
        const selectedClass = classFilterEl ? classFilterEl.value : 'all';
        const periodFilterEl = document.getElementById('dashWeekdayPeriodFilter');
        const selectedPeriod = periodFilterEl ? periodFilterEl.value : 'all';

        const stats = calculateWeekdayAbsenceStats(selectedClass, selectedPeriod);

        const planBox = document.getElementById('dashPreventativePlanBox');
        const btnText = document.getElementById('btnDashPreventativePlanText');

        if (_isPreventativePlanOpen) {
            if (btnText) btnText.textContent = 'إخفاء الخطة الوقائية';
            if (planBox) {
                planBox.style.display = 'block';
                renderPreventativePlanBox(stats);
                // تمرير ناعم نحو الخطة
                if (planBox && typeof planBox.scrollIntoView === 'function') {
                    setTimeout(() => {
                        try { planBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
                    }, 100);
                }
            }
        } else {
            if (btnText) btnText.textContent = 'اقتراح الخطة الوقائية (لمسة واحدة)';
            if (planBox) planBox.style.display = 'none';
        }

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * رسم محتوى الخطة الوقائية في الصندوق المخصص
     */
    function renderPreventativePlanBox(stats) {
        const planBox = document.getElementById('dashPreventativePlanBox');
        if (!planBox) return;

        // تحديد اليوم المستهدف بالخطة
        let targetDay = null;
        if (_preventativePlanTargetDay !== null && _preventativePlanTargetDay !== undefined) {
            targetDay = stats.days.find(d => d.dayIdx === _preventativePlanTargetDay);
        }
        if (!targetDay) {
            targetDay = stats.peakDay || stats.days[0];
        }

        const dayName = targetDay ? targetDay.dayName : 'الذروة الأسبوعية';
        const dayHours = targetDay ? targetDay.totalHours : 0;
        const dayPct = targetDay ? targetDay.percentOfTotal : 0;
        const affectedStudentsCount = targetDay ? targetDay.uniqueStudentsCount : 0;

        // التشخيص النوعي المخصص لليوم
        let diagnosisTitle = '';
        let diagnosisDesc = '';
        let specificTacticsHtml = '';

        if (targetDay && (targetDay.dayIdx === 5 || targetDay.dayIdx === 6)) {
            // الجمعة أو السبت
            diagnosisTitle = `تشخيص متقدم: ظاهرة التمديد غير الرسمي لعطلة نهاية الأسبوع (Weekend Extension Effect)`;
            diagnosisDesc = `أظهر التحليل الإحصائي تركز ما نسبته ${dayPct}% من الغيابات في يوم ${dayName}. يرتبط هذا النمط بسفر بعض الأسر في عطلة نهاية الأسبوع، أو الاسترخاء المبكر للتلاميذ عشية العطلة، أو التكاسل عن حضور حصص ما بعد الزوال يوم الجمعة.`;
            specificTacticsHtml = `
                <li style="margin-bottom: 6px;"><strong>تحويل حصة ${dayName} إلى ورشة تفاعلية جاذبة:</strong> برمجة أنشطة تطبيقية بالأجهزة الرقمية، حل مسائل جماعية، أو ألعاب الرياضيات التنافسية لرفع شغف الحضور بدلاً من التلقين الجاف.</li>
                <li style="margin-bottom: 6px;"><strong>عدم برمجة الفروض الكبرى يوم الإثنين التالي:</strong> حتى لا يقع التلاميذ في فخ التغيب يوم ${dayName} للمراجعة المنزلية غير القانونية.</li>
                <li style="margin-bottom: 6px;"><strong>نظام تحفيز المواظبة الخاص بيوم ${dayName}:</strong> منح "نقطة تميز سلوكية" إضافية في دفتر المواظبة لكل تلميذ يحقق حضوراً كاملاً دون تأخر في جميع حصص ${dayName} طيلة الشهر.</li>
            `;
        } else if (targetDay && targetDay.dayIdx === 1) {
            // الإثنين
            diagnosisTitle = `تشخيص متقدم: صعوبة استئناف الإيقاع المدرسي وتفادي مواجهة الواجبات (Monday Blues)`;
            diagnosisDesc = `يشير تركز الغياب يوم الإثنين بنسبة ${dayPct}% إلى صعوبة استعادة النسق الدراسي بعد يوم الأحد، بالإضافة إلى تغيب بعض التلاميذ تهرباً من المحاسبة على عدم إنجاز الواجبات المنزلية المقررة خلال العطلة الأسبوعية.`;
            specificTacticsHtml = `
                <li style="margin-bottom: 6px;"><strong>افتتاحية حركية مشجعة (10 دقائق أولى):</strong> البدء بنشاط إحماء ذهني خفيف وتجنب التوبيخ الجماعي الفوري، لإعادة دمج التلاميذ نفسياً في جو القسم.</li>
                <li style="margin-bottom: 6px;"><strong>إعادة هيكلة واجبات نهاية الأسبوع:</strong> إسناد واجبات تطبيقية قصيرة وموجهة لا تشكل عبئاً مفرطاً يدفع للتغيب خوفاً من العقاب.</li>
                <li style="margin-bottom: 6px;"><strong>استقبال ترحيبي مع تسجيل الغياب الفوري:</strong> تحفيز الحاضرين والتنسيق مع الحراسة العامة لتسجيل الغياب في الربع ساعة الأولى لإرسال تنبيه مبكر لأولياء الأمور.</li>
            `;
        } else {
            // منتصف الأسبوع
            diagnosisTitle = `تشخيص متقدم: ضغط الحصص المسائية وتزامن التقويمات المستمرة`;
            diagnosisDesc = `تسجيل ذروة الغياب في منتصف الأسبوع (يوم ${dayName}) يرتبط عادة بتراكم الحصص المسائية المتأخرة، أو الإرهاق الذهني من توالي المواد الأساسية، أو تغيب تكتيكي يسبق فروضاً محروسة.`;
            specificTacticsHtml = `
                <li style="margin-bottom: 6px;"><strong>تنويع الإيقاع البيداغوجي:</strong> إدراج فترات استراحة قصيرة وأنشطة تعلم ثنائي (Pair Work) لتقليل الإجهاد في الحصص المسائية.</li>
                <li style="margin-bottom: 6px;"><strong>تنسيق روزنامة الفروض:</strong> الحرص على عدم تزامن تقويمات مادة الرياضيات مع مواد كثيفة في نفس اليوم لتفادي الغياب التكتيكي.</li>
                <li style="margin-bottom: 6px;"><strong>تقويمات تشاركية سريعة:</strong> تنظيم اختبارات سريعة مرحة غير معلنة (Spot Quizzes) بنقاط إيجابية فقط لتحفيز التواجد المستمر.</li>
            `;
        }

        // بطاقات التلاميذ الأكثر استهدافاً
        let topTargetStudentsHtml = '';
        if (targetDay && targetDay.students.length > 0) {
            const topFour = targetDay.students.slice(0, 4);
            topTargetStudentsHtml = `
                <div style="margin-top: 14px; background: #fff; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: #9a3412; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="user-x" data-size="14"></span>
                            أبرز التلاميذ المعنيين بتكرار الغياب في يوم ${dayName} (${targetDay.students.length} تلميذ):
                        </span>
                        <span style="font-size: 0.72rem; color: #ea580c;">ينصح بإنصات فردي وتنبيه ولي الأمر</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
                        ${topFour.map(s => `
                            <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 800; font-size: 0.8rem; color: #0f172a;">${escapeHtml(s.name)}</div>
                                    <div style="font-size: 0.7rem; color: #7c2d12;">${escapeHtml(s.className)} • <strong>${s.hours} ساعة</strong> (${s.count} مرات)</div>
                                </div>
                                <button type="button" onclick="sendIndividualDayAlertWhatsApp('${escapeHtml(s.name)}', '${escapeHtml(s.className)}', '', '${dayName}', ${s.hours})" style="background: #25d366; color: #fff; border: none; border-radius: 6px; padding: 4px 7px; font-size: 0.7rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="مراسلة سريعة لولي الأمر">
                                    <span data-lucide="message-circle" data-size="11"></span>
                                    <span>تنبيه</span>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        planBox.innerHTML = `
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%); border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.08);">
                <!-- Header of the Plan -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1.5px solid #bbf7d0; padding-bottom: 14px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: #10b981; color: #fff; padding: 6px; border-radius: 8px; display: inline-flex; box-shadow: 0 2px 5px rgba(16, 185, 129, 0.3);">
                                <span data-lucide="shield-check" data-size="20"></span>
                            </span>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #065f46;">
                                الخطة الوقائية الاستباقية لتقليص الغياب المدرسي (يوم ${dayName})
                            </h3>
                            <span style="background: #dcfce7; color: #166534; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; border: 1px solid #86efac;">
                                توليد ذكي بلمسة واحدة
                            </span>
                        </div>
                        <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #047857;">
                            خطة عمل بيداغوجية وتنظيمية وتواصلية محكمة تستهدف تقليص معدل غياب يوم <strong>${dayName}</strong> بنسبة <strong>60%</strong> خلال الـ 4 أسابيع القادمة.
                        </p>
                    </div>

                    <!-- Action Buttons Toolbar -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="openWeekdayWhatsAppBroadcastModal('${dayName}')" class="btn-action" style="background: #25d366; color: #fff; border: none; font-weight: 700; font-size: 0.8rem; padding: 7px 13px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.25);" title="مراسلة توعوية استباقية لأولياء الأمور">
                            <span data-lucide="send" data-size="14"></span>
                            <span>رسالة واتساب استباقية للأولياء</span>
                        </button>
                        <button type="button" onclick="openPreventativePlanDocModal('${dayName}')" class="btn-action" style="background: #1e293b; color: #fff; border: none; font-weight: 700; font-size: 0.8rem; padding: 7px 13px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; box-shadow: 0 2px 6px rgba(30, 41, 59, 0.2);" title="طباعة أو تحميل الخطة كوثيقة رسمية للإدارة التربوية">
                            <span data-lucide="printer" data-size="14"></span>
                            <span>طباعة الوثيقة الرسمية (PDF)</span>
                        </button>
                        <button type="button" onclick="copyPreventativePlanText('${dayName}')" class="btn-action" style="background: #4f46e5; color: #fff; border: none; font-weight: 700; font-size: 0.8rem; padding: 7px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="نسخ نص الخطة بالكامل">
                            <span data-lucide="copy" data-size="14"></span>
                            <span>نسخ الخطة</span>
                        </button>
                        <button type="button" onclick="savePreventativePlanToNotes('${dayName}')" class="btn-action" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.8rem; padding: 7px 11px; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" title="تثبيت الخطة في سجل التوجيهات التربوية">
                            <span data-lucide="bookmark-check" data-size="14"></span>
                            <span>تثبيت في السجل</span>
                        </button>
                    </div>
                </div>

                <!-- KPI & Target Box -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px;">
                    <div style="background: #fff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px;">
                        <div style="font-size: 0.72rem; color: #047857; font-weight: 700;">ساعات الغياب المسجلة بيوم ${dayName}</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: #065f46; margin-top: 2px;">${dayHours} ساعة</div>
                        <div style="font-size: 0.68rem; color: #166534;">يمثل ${dayPct}% من مجموع غيابات الأسبوع</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px;">
                        <div style="font-size: 0.72rem; color: #047857; font-weight: 700;">عدد التلاميذ المتأثرين</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: #065f46; margin-top: 2px;">${affectedStudentsCount} تلميذ</div>
                        <div style="font-size: 0.68rem; color: #166534;">في الفصول المشمولة بالتحليل</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px;">
                        <div style="font-size: 0.72rem; color: #047857; font-weight: 700;">الهدف الإجرائي (خلال شهر)</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: #059669; margin-top: 2px;">خَفْض 60%</div>
                        <div style="font-size: 0.68rem; color: #166534;">الوصول إلى أقل من ${Math.max(1, Math.round(dayHours * 0.4))} ساعة</div>
                    </div>
                </div>

                <!-- Context Diagnostic Box -->
                <div style="background: #fff; border-right: 4px solid #059669; border: 1px solid #bbf7d0; border-right-width: 4px; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                    <div style="font-weight: 800; font-size: 0.85rem; color: #065f46; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <span data-lucide="microscope" data-size="15"></span>
                        <span>${diagnosisTitle}</span>
                    </div>
                    <p style="margin: 0; font-size: 0.78rem; color: #334155; line-height: 1.5;">
                        ${diagnosisDesc}
                    </p>
                </div>

                <!-- 4 Action Pillars Grid -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 12px;">
                    <!-- Pillar 1 -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <span style="background: #dbeafe; color: #1d4ed8; padding: 4px; border-radius: 6px; display: inline-flex;"><span data-lucide="sparkles" data-size="14"></span></span>
                            <span>1. التدابير البيداغوجية والصفية الجاذبة</span>
                        </div>
                        <ul style="margin: 0; padding-right: 18px; font-size: 0.76rem; color: #475569; line-height: 1.5;">
                            ${specificTacticsHtml}
                            <li style="margin-bottom: 4px;">توزيع مهام مساعدة الأستاذ والتنظيم الصفي في هذا اليوم على التلاميذ المترددين في الحضور لتعزيز انتمائهم.</li>
                        </ul>
                    </div>

                    <!-- Pillar 2 -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <span style="background: #fef3c7; color: #b45309; padding: 4px; border-radius: 6px; display: inline-flex;"><span data-lucide="check-square" data-size="14"></span></span>
                            <span>2. التدابير التقويمية والتنظيمية</span>
                        </div>
                        <ul style="margin: 0; padding-right: 18px; font-size: 0.76rem; color: #475569; line-height: 1.5;">
                            <li style="margin-bottom: 4px;"><strong>تسجيل الغياب بدقة في الدقائق الأولى:</strong> عدم تأجيل تسجيل الغياب لنهاية الحصة لقطع محاولات التسلل أو التأخر.</li>
                            <li style="margin-bottom: 4px;"><strong>اشتراط مبرر رسمي مكتوب:</strong> إلزام التلميذ الغائب بإحضار إذن دخول نظامي من الحراسة العامة قبل استئناف الحصص.</li>
                            <li style="margin-bottom: 4px;"><strong>تقويمات تكوينية تشاركية:</strong> إدراج أسئلة تقويمية تعتمد على ما تم إنجازه في حصة ${dayName} ضمن الفروض الرسمية.</li>
                        </ul>
                    </div>

                    <!-- Pillar 3 -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <span style="background: #dcfce7; color: #15803d; padding: 4px; border-radius: 6px; display: inline-flex;"><span data-lucide="phone-call" data-size="14"></span></span>
                            <span>3. التواصل والتعبئة مع أولياء الأمور</span>
                        </div>
                        <ul style="margin: 0; padding-right: 18px; font-size: 0.76rem; color: #475569; line-height: 1.5;">
                            <li style="margin-bottom: 4px;"><strong>رسالة تذكير وقائية عشية يوم ${dayName}:</strong> إرسال تنبيه عبر واتساب يذكر بأهمية حصة الغد وتفادي الغياب.</li>
                            <li style="margin-bottom: 4px;"><strong>التواصل الهاتفي العاجل:</strong> الاتصال الفوري بأسرة أي تلميذ يتغيب مرتين متتاليتين في هذا اليوم لتطويق المشكل.</li>
                            <li style="margin-bottom: 4px;"><strong>إشعار الحراسة العامة:</strong> إحالة تقرير بالمتغيبين للإدارة لتوجيه استدعاء رسمي لأولياء الأمور.</li>
                        </ul>
                    </div>

                    <!-- Pillar 4 -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                            <span style="background: #ede9fe; color: #6d28d9; padding: 4px; border-radius: 6px; display: inline-flex;"><span data-lucide="user-check" data-size="14"></span></span>
                            <span>4. التتبع والإنصات الفردي للمتعثرين</span>
                        </div>
                        <ul style="margin: 0; padding-right: 18px; font-size: 0.76rem; color: #475569; line-height: 1.5;">
                            <li style="margin-bottom: 4px;"><strong>جلسة إنصات فردية (5 دقائق):</strong> استفسار التلميذ المداوم على الغياب يوم ${dayName} عن الصعوبات اللوجستية أو النفسية.</li>
                            <li style="margin-bottom: 4px;"><strong>توقيع التزام شرفي للمواظبة:</strong> توقيع عقد شراكة مصغر بين الأستاذ والتلميذ لضمان الحضور الكامل.</li>
                            <li style="margin-bottom: 4px;"><strong>تكريم أسبوعي للمواظبين:</strong> إعلان أسماء التلاميذ الذين أظهروا تحسناً ملموساً في الانضباط أمام زملائهم.</li>
                        </ul>
                    </div>
                </div>

                <!-- Top Targeted Students Box -->
                ${topTargetStudentsHtml}
            </div>
        `;
    }

    /**
     * إرسال تنبيه واتساب فردي لتلميذ خاص بيوم معين
     */
    function sendIndividualDayAlertWhatsApp(studentName, className, phone, dayName, hours) {
        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name)
            ? window.db.teacherProfile.name.trim() : 'أستاذ مادة الرياضيات';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school)
            ? window.db.teacherProfile.school.trim() : '';

        let text = `السلام عليكم ورحمة الله وبركاته،\n`;
        text += `السادة أولياء أمور التلميذ(ة): *${studentName}* (${className})\n\n`;
        text += `نحيطكم علماً بأن التلميذ(ة) قد سجل(ت) تكراراً في الغياب خلال حصص *يوم ${dayName}* بمجموع (*${hours} ساعات*)، مما يؤثر سلباً على مواكبة الدروس والتحضير للفروض.\n\n`;
        text += `نهيب بكم مرافقة ابنكم/ابنتكم والتأكيد على ضرورة المواظبة والحضور التام لحصة *يوم ${dayName}* القادمة حفاظاً على مساره(ا) الدراسي.\n\n`;
        if (schoolName) text += `🏫 *المؤسسة:* ${schoolName}\n`;
        text += `👨‍🏫 *الأستاذ(ة):* ${teacherName}`;

        const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
        let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        if (cleanPhone.length >= 9) {
            let intlPhone = cleanPhone;
            if (cleanPhone.startsWith('0')) intlPhone = '212' + cleanPhone.substring(1);
            url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        }

        window.open(url, '_blank');
        if (typeof showNotification === 'function') {
            showNotification(`تم فتح واتساب ونسخ نص التنبيه الخاص بالتلميذ ${studentName}`, 'success');
        }
    }

    /**
     * نافذة رسالة واتساب التوعوية الاستباقية الجماعية للأولياء
     */
    function openWeekdayWhatsAppBroadcastModal(dayName) {
        let modal = document.getElementById('dashPreventativePlanWaModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dashPreventativePlanWaModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); z-index: 10050; display: flex; align-items: center; justify-content: center; padding: 12px; backdrop-filter: blur(4px);';
            document.body.appendChild(modal);
        }

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name)
            ? window.db.teacherProfile.name.trim() : 'أستاذ(ة) مادة الرياضيات';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school)
            ? window.db.teacherProfile.school.trim() : '';

        let defaultMsg = `📢 *تنبيه تربوي هام بخصوص مواظبة يوم ${dayName}*\n`;
        defaultMsg += `السلام عليكم ورحمة الله وبركاته،\n`;
        defaultMsg += `السادة أولياء الأمور الكرام،\n\n`;
        defaultMsg += `نحيطكم علماً بأن حصة مادة الرياضيات المقررة *يوم ${dayName}* تكتسي أهمية بالغة في بناء المكتسبات وتقديم مفاهيم أساسية تستعد بها الفصول للفروض المحروسة القادمة.\n\n`;
        defaultMsg += `لذا، وإطار خطتنا الوقائية المشتركة للحد من الهدر الزمني، نلتمس منكم التفضل بتشجيع أبنائكم وبناتكم على:\n`;
        defaultMsg += `1️⃣ النوم المبكر والاستعداد الجيد.\n`;
        defaultMsg += `2️⃣ الحرص التام على الحضور والمواظبة في الوقت المحدد وعدم التغيب أو التأخر.\n`;
        defaultMsg += `3️⃣ إحضار الدفاتر والأدوات الهندسية كاملة.\n\n`;
        defaultMsg += `شاكرين لكم حسن تعاونكم الدائم لما فيه مصلحة فلذات أكبادنا.\n`;
        if (schoolName) defaultMsg += `🏫 *المؤسسة:* ${schoolName}\n`;
        defaultMsg += `👨‍🏫 *الأستاذ(ة):* ${teacherName}`;

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 600px; background: #fff; border-radius: 14px; padding: 22px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #25d366; color: #fff; width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                            <span data-lucide="message-circle" data-size="18"></span>
                        </span>
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a;">
                            رسالة تذكير وقائية استباقية لأولياء الأمور (يوم ${dayName})
                        </h4>
                    </div>
                    <button type="button" onclick="closeWeekdayWhatsAppBroadcastModal()" style="background: #f1f5f9; border: none; font-size: 1.1rem; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; color: #64748b;">✕</button>
                </div>

                <p style="font-size: 0.8rem; color: #64748b; margin: 0 0 10px 0;">
                    يمكنك تعديل نص الرسالة أو نسخها وإرسالها فوراً إلى مجموعات أولياء الأمور (WhatsApp) عشية يوم ${dayName}:
                </p>

                <textarea id="dashPreventativeWaTextarea" style="width: 100%; height: 220px; font-family: inherit; font-size: 0.84rem; padding: 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; outline: none; line-height: 1.5; resize: vertical; box-sizing: border-box; background: #fafafa;">${defaultMsg}</textarea>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; flex-wrap: wrap; gap: 8px;">
                    <button type="button" onclick="closeWeekdayWhatsAppBroadcastModal()" class="btn-secondary" style="font-size: 0.8rem; padding: 7px 14px; border-radius: 7px;">إلغاء</button>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="copyWeekdayWhatsAppBroadcastText()" class="btn-action" style="background: #4f46e5; color: #fff; border: none; font-size: 0.8rem; font-weight: 700; padding: 7px 14px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;">
                            <span data-lucide="copy" data-size="13"></span>
                            <span>نسخ النص</span>
                        </button>
                        <button type="button" onclick="sendWeekdayWhatsAppBroadcastDirect()" class="btn-action" style="background: #25d366; color: #fff; border: none; font-size: 0.8rem; font-weight: 800; padding: 7px 16px; border-radius: 7px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(37, 211, 102, 0.3);">
                            <span data-lucide="send" data-size="14"></span>
                            <span>مشاركة في واتساب</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    function closeWeekdayWhatsAppBroadcastModal() {
        const modal = document.getElementById('dashPreventativePlanWaModal');
        if (modal) modal.style.display = 'none';
    }

    function copyWeekdayWhatsAppBroadcastText() {
        const ta = document.getElementById('dashPreventativeWaTextarea');
        if (!ta) return;
        const text = ta.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                if (typeof showNotification === 'function') {
                    showNotification('تم نسخ نص الرسالة الوقائية بنجاح إلى الحافظة', 'success');
                }
            });
        }
    }

    function sendWeekdayWhatsAppBroadcastDirect() {
        const ta = document.getElementById('dashPreventativeWaTextarea');
        if (!ta) return;
        const text = ta.value;
        copyWeekdayWhatsAppBroadcastText();
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        closeWeekdayWhatsAppBroadcastModal();
    }

    /**
     * نسخ نص الخطة الوقائية كاملاً
     */
    function copyPreventativePlanText(dayName) {
        const classFilterEl = document.getElementById('dashWeekdayClassFilter');
        const selectedClass = classFilterEl ? classFilterEl.value : 'all';
        const stats = calculateWeekdayAbsenceStats(selectedClass, 'all');
        const targetDay = stats.days.find(d => d.dayName === dayName) || stats.peakDay;

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name)
            ? window.db.teacherProfile.name.trim() : 'أستاذ مادة الرياضيات';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school)
            ? window.db.teacherProfile.school.trim() : '';

        let md = `=================================================\n`;
        md += `📋 وثيقة الخطة الوقائية لتقليص الغياب المدرسي (يوم ${dayName})\n`;
        md += `=================================================\n`;
        if (schoolName) md += `🏫 المؤسسة: ${schoolName}\n`;
        md += `👨‍🏫 الأستاذ(ة): ${teacherName}\n`;
        md += `📚 المادة: مادة الرياضيات\n`;
        md += `👥 المستهدف: ${selectedClass === 'all' ? 'كافة الأقسام المسندة' : 'قسم ' + selectedClass}\n`;
        md += `🎯 الهدف الإجرائي: خفض نسبة الغياب في يوم ${dayName} بنسبة 60% خلال 4 أسابيع\n`;
        md += `-------------------------------------------------\n\n`;

        md += `📊 أولاً: التشخيص والمعطيات الإحصائية:\n`;
        if (targetDay) {
            md += `- مجموع ساعات الغياب المسجلة بيوم ${dayName}: ${targetDay.totalHours} ساعة.\n`;
            md += `- النسبة من مجموع الغياب الأسبوعي: ${targetDay.percentOfTotal}%.\n`;
            md += `- عدد التلاميذ المتأثرين: ${targetDay.uniqueStudentsCount} تلميذ.\n`;
            md += `- طبيعة الغياب: ${targetDay.unjustifiedHours} س غير مبرر، ${targetDay.justifiedHours} س مبرر.\n\n`;
        }

        md += `💡 ثانياً: التدابير البيداغوجية والصفية الجاذبة:\n`;
        md += `1. افتتاح حصة يوم ${dayName} بنشاط تفاعلي أو مسألة تحدي لمدة 10 دقائق لكسر الروتين.\n`;
        md += `2. اعتماد أسلوب التعلم النشط والمجموعات التعاونية بدلاً من الإلقاء الجاف.\n`;
        md += `3. تخصيص نقطة تميز تحفيزية في المواظبة لكل تلميذ يحقق حضوراً تاماً في هذا اليوم.\n\n`;

        md += `⚖️ ثالثاً: التدابير التقويمية والتنظيمية:\n`;
        md += `1. ضبط وتسجيل الغياب في الدقائق الأولى من الحصة.\n`;
        md += `2. عدم برمجة الفروض المحروسة الكبرى في صبيحة اليوم التالي ليوم الغياب لتفادي الغياب التكتيكي.\n`;
        md += `3. اشتراط مبرر رسمي مؤشر عليه من الإدارة قبل قبول المتغيب في الحصة الموالية.\n\n`;

        md += `📱 رابعاً: خطة التواصل والتعبئة مع أولياء الأمور:\n`;
        md += `1. إرسال رسالة تذكير وتوعية استباقية لأولياء الأمور عشية يوم ${dayName}.\n`;
        md += `2. الاتصال الهاتفي بأسر التلاميذ المتكرر غيابهم لبحث الصعوبات الأسرية أو اللوجستية.\n`;
        md += `3. إشراك الحراسة العامة وإدارة المؤسسة في التتبع الفردي للمتعثرين.\n\n`;

        md += `👥 خامساً: التتبع الفردي للتلاميذ:\n`;
        if (targetDay && targetDay.students.length > 0) {
            targetDay.students.slice(0, 5).forEach((s, idx) => {
                md += `   ${idx + 1}. ${s.name} (${s.className}) - ${s.hours} ساعة غياب\n`;
            });
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(md).then(() => {
                if (typeof showNotification === 'function') {
                    showNotification('تم نسخ الخطة الوقائية كاملة بنجاح', 'success');
                }
            });
        }
    }

    /**
     * حفظ الخطة الوقائية في سجل التوجيهات والملاحظات التربوية
     */
    function savePreventativePlanToNotes(dayName) {
        if (!window.db) return;
        if (!window.db.notes) window.db.notes = {};

        const now = (typeof getAppNow === 'function') ? getAppNow() : new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const classFilterEl = document.getElementById('dashWeekdayClassFilter');
        const selectedClass = classFilterEl ? classFilterEl.value : 'all';

        const stats = calculateWeekdayAbsenceStats(selectedClass, 'all');
        const targetDay = stats.days.find(d => d.dayName === dayName) || stats.peakDay;

        const noteKey = `note_${Date.now()}`;
        const noteTitle = `خطة وقائية لمكافحة غياب يوم ${dayName} (${selectedClass === 'all' ? 'جميع الأقسام' : selectedClass})`;
        const noteContent = `تم اعتماد خطة عمل تربوية واستباقية لتقليص غيابات يوم ${dayName} (إجمالي ${targetDay ? targetDay.totalHours : 0} س، نسبة ${targetDay ? targetDay.percentOfTotal : 0}%). ترتكز الخطة على إدراج وضعيات ديداكتيكية جاذبة، عدم برمجة فروض كبرى في اليوم الموالي، وتنبيه استباقي للأسر.`;

        window.db.notes[noteKey] = {
            id: noteKey,
            title: noteTitle,
            content: noteContent,
            date: dateStr,
            className: selectedClass === 'all' ? 'عام' : selectedClass,
            category: 'توجيه تربوي',
            priority: 'عالية'
        };

        if (typeof saveDb === 'function') saveDb();

        // تسجيل إجراء في الخط الزمني إذا توفر
        if (typeof recordAdminAction === 'function') {
            recordAdminAction({
                actionType: 'preventative_plan',
                title: `اعتماد خطة وقائية استباقية لمكافحة غياب يوم ${dayName}`,
                className: selectedClass === 'all' ? 'جميع الأقسام' : selectedClass,
                details: `تقليص ساعات الغياب المستهدفة (${targetDay ? targetDay.totalHours : 0} س) بنسبة 60% عبر تدابير صفية وتواصلية مع الأسر.`
            });
        }

        if (typeof showNotification === 'function') {
            showNotification('تم تثبيت الخطة الوقائية في سجل الملاحظات والتوجيهات التربوية بنجاح', 'success');
        }
    }

    /**
     * نافذة معاينة وطباعة الوثيقة الرسمية للخطة الوقائية
     */
    function openPreventativePlanDocModal(dayName) {
        let modal = document.getElementById('dashPreventativePlanDocModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dashPreventativePlanDocModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); z-index: 10040; display: flex; align-items: center; justify-content: center; padding: 12px; backdrop-filter: blur(5px);';
            document.body.appendChild(modal);
        }

        const classFilterEl = document.getElementById('dashWeekdayClassFilter');
        const selectedClass = classFilterEl ? classFilterEl.value : 'all';
        const stats = calculateWeekdayAbsenceStats(selectedClass, 'all');
        const targetDay = stats.days.find(d => d.dayName === dayName) || stats.peakDay || stats.days[0];

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name)
            ? window.db.teacherProfile.name.trim() : 'الأستاذ(ة)';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school)
            ? window.db.teacherProfile.school.trim() : 'المؤسسة التعليمية';
        const academicYear = (window.db && window.db.teacherProfile && window.db.teacherProfile.academicYear)
            ? window.db.teacherProfile.academicYear : '2026/2027';
        const todayFormatted = (typeof formatLocalDate === 'function') ? formatLocalDate() : new Date().toISOString().slice(0, 10);

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 950px; background: #fff; border-radius: 14px; padding: 20px 24px; max-height: 94vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.35);">
                <!-- Header Toolbar -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: #1e293b; color: #fff; width: 36px; height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                            <span data-lucide="file-check" data-size="18"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">
                                وثيقة الخطة الوقائية والاستباقية المعتمدة (معاينة وطباعة رسمية)
                            </h3>
                            <div style="font-size: 0.76rem; color: #64748b;">
                                تقرير إداري بيداغوجي رسمي لتقديمه للإدارة التربوية ومجالس الأقسام
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="printPreventativePlanOfficialDoc()" class="btn-primary" style="background: #059669; border: none; font-weight: 800; padding: 7px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span data-lucide="printer" data-size="15"></span>
                            <span>طباعة / حفظ كملف PDF</span>
                        </button>
                        <button type="button" onclick="closePreventativePlanDocModal()" style="background: #f1f5f9; border: none; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; color: #64748b; font-size: 1.1rem;">✕</button>
                    </div>
                </div>

                <!-- Printable Document Container -->
                <div id="preventativePlanPrintableArea" style="background: #ffffff; padding: 25px; border: 1.5px solid #cbd5e1; border-radius: 8px; color: #0f172a; font-family: 'Cairo', sans-serif;">
                    <!-- Official Moroccan Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; text-align: center;">
                        <div style="text-align: right; font-size: 0.8rem; line-height: 1.4; font-weight: 700;">
                            المملكة المغربية<br>
                            وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
                            الأكاديمية الجهوية للتربية والتكوين<br>
                            المديرية الإقليمية<br>
                            مؤسسة: <strong>${escapeHtml(schoolName)}</strong>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.1rem; font-weight: 900; color: #0f172a; border: 2px solid #0f172a; padding: 6px 14px; border-radius: 6px; background: #f8fafc;">
                                وثيقة الخطة الوقائية الاستباقية<br>
                                <span style="font-size: 0.9rem; color: #dc2626;">للحد من ظاهرة الغياب في يوم ${dayName}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: #475569; margin-top: 4px; font-weight: 700;">
                                الموسم الدراسي: ${academicYear}
                            </div>
                        </div>
                        <div style="text-align: left; font-size: 0.8rem; line-height: 1.4; font-weight: 700;">
                            الأستاذ(ة): <strong>${escapeHtml(teacherName)}</strong><br>
                            مادة: <strong>الرياضيات</strong><br>
                            الفصول المستهدفة: <strong>${selectedClass === 'all' ? 'جميع الأقسام المسندة' : selectedClass}</strong><br>
                            التاريخ: <strong>${todayFormatted}</strong>
                        </div>
                    </div>

                    <!-- Weekday Table Summary -->
                    <div style="margin-bottom: 16px;">
                        <div style="font-weight: 800; font-size: 0.86rem; color: #0f172a; margin-bottom: 6px;">
                            1. جدول التشخيص الإحصائي لتوزيع ساعات الغياب عبر أيام الأسبوع:
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: center;">
                            <thead>
                                <tr style="background: #f1f5f9; border: 1px solid #94a3b8;">
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">يوم الأسبوع</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">إجمالي الساعات</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">النسبة المئوية (%)</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">عدد حالات الغياب</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">غير مبرر</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">مبرر</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">تصنيف اليوم</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.days.filter(d => d.dayIdx !== 0 || d.totalHours > 0).map(d => `
                                    <tr style="border: 1px solid #cbd5e1; ${d.dayName === dayName ? 'background: #fef2f2; font-weight: 800;' : ''}">
                                        <td style="border: 1px solid #cbd5e1; padding: 5px;">${d.dayName}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px; color: ${d.isPeak ? '#dc2626' : '#0f172a'};">${d.totalHours} س</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px;">${d.percentOfTotal}%</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px;">${d.incidentCount}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px; color: #b91c1c;">${d.unjustifiedHours} س</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px; color: #047857;">${d.justifiedHours} س</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 5px;">
                                            ${d.isPeak ? '<span style="color: #dc2626; font-weight: 800;">🔴 ذروة الغياب (#1)</span>' : (d.rank === 2 ? '🟠 مرتفع (#2)' : 'عادي')}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Diagnostic & Context -->
                    <div style="margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 0.8rem; line-height: 1.5;">
                        <strong style="color: #0f172a;">2. تشخيص الظاهرة وسياق التدخل:</strong><br>
                        بناءً على الرصد الإحصائي أعلاه، يسجل <strong>يوم ${dayName}</strong> أعلى وتيرة للغياب المدرسي بمجموع <strong>${targetDay ? targetDay.totalHours : 0} ساعة</strong> بنسبة <strong>${targetDay ? targetDay.percentOfTotal : 0}%</strong> من إجمالي غيابات الأسبوع.
                        ويهدف هذا المخطط الإجرائي إلى استعادة الانضباط والحد من الهدر المدرسي عبر تدابير تشاركية تستهدف خفض الغياب في هذا اليوم بنسبة 60% على الأقل.
                    </div>

                    <!-- Operational Plan Pillars -->
                    <div style="margin-bottom: 14px;">
                        <div style="font-weight: 800; font-size: 0.86rem; color: #0f172a; margin-bottom: 6px;">
                            3. المحاور والتدابير الإجرائية المعتمدة في الخطة:
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                            <thead>
                                <tr style="background: #f1f5f9;">
                                    <th style="border: 1px solid #cbd5e1; padding: 6px; width: 22%;">المحور الإجرائي</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">التدابير والحلول العملية المبرمجة</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px; width: 20%;">المسؤول والتتبع</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800; background: #fafafa;">1. التدابير البيداغوجية والصفية الجاذبة</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; line-height: 1.45;">
                                        - افتتاح حصة يوم ${dayName} بورشات تفاعلية، ألعاب رياضية تحديّة، وتطبيقات عملية جاذبة.<br>
                                        - تخصيص نقاط مواظبة وتحفيز إيجابية إضافية في دفتر الأستاذ للتلاميذ الملتزمين بالحضور الكامل.<br>
                                        - إشراك التلاميذ المترددين في مهام صفية قيادية تعزز الانتماء والمسؤولية.
                                    </td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">الأستاذ(ة) داخل القسم</td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800; background: #fafafa;">2. التدابير التقويمية والتنظيمية</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; line-height: 1.45;">
                                        - عدم جدولة الفروض المحروسة الكبرى في صبيحة اليوم التالي ليوم ${dayName} لتفادي الغياب التكتيكي.<br>
                                        - الضبط الصارم للغياب وتسجيله في السجل الرسمي منذ الدقائق العشر الأولى للحصة.<br>
                                        - إلزام المتغيبين بالإدلاء بمبررات قانونية وتوقيع التزام عدم التكرار.
                                    </td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">الأستاذ + الحراسة العامة</td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800; background: #fafafa;">3. التعبئة والشراكة مع الأسر</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; line-height: 1.45;">
                                        - إرسال رسائل تذكير وتوعية استباقية لأولياء الأمور عشية يوم ${dayName} للتأكيد على إلزامية الحضور.<br>
                                        - ربط الاتصال الهاتفي بأولياء أمور التلاميذ المكررين للغياب لمعالجة الأسباب الخاصة (النقل، البعد...).
                                    </td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">الأستاذ + إدارة المؤسسة</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Targeted Student List if available -->
                    ${targetDay && targetDay.students.length > 0 ? `
                        <div style="margin-bottom: 16px;">
                            <div style="font-weight: 800; font-size: 0.86rem; color: #0f172a; margin-bottom: 6px;">
                                4. لائحة التلاميذ المعنيين بالمتابعة الفردية المكثفة (يوم ${dayName}):
                            </div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; text-align: center;">
                                <thead>
                                    <tr style="background: #f1f5f9;">
                                        <th style="border: 1px solid #cbd5e1; padding: 4px; width: 30px;">#</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 4px; text-align: right;">اسم التلميذ</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 4px;">القسم</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 4px;">ساعات الغياب</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 4px;">غير مبرر</th>
                                        <th style="border: 1px solid #cbd5e1; padding: 4px;">الإجراء المقترح</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${targetDay.students.slice(0, 8).map((s, idx) => `
                                        <tr style="border: 1px solid #cbd5e1;">
                                            <td style="border: 1px solid #cbd5e1; padding: 4px;">${idx + 1}</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; font-weight: 700;">${escapeHtml(s.name)}</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 4px;">${escapeHtml(s.className)}</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 4px; font-weight: 800; color: #dc2626;">${s.hours} س</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 4px;">${s.unjustified} س</td>
                                            <td style="border: 1px solid #cbd5e1; padding: 4px;">تنبيه كتابي لولي الأمر + ميثاق شرف</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- Formal Signatures Footer -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 24px; padding-top: 14px; border-top: 1.5px solid #0f172a; text-align: center; font-size: 0.84rem;">
                        <div style="width: 45%;">
                            <strong>توقيع وختم الأستاذ(ة) منجز الخطة:</strong><br><br><br>
                            <span style="font-size: 0.8rem; color: #64748b;">(حرر بتاريخ: ${todayFormatted})</span>
                        </div>
                        <div style="width: 45%;">
                            <strong>تأشيرة الحراسة العامة وإدارة المؤسسة:</strong><br><br><br>
                            <span style="font-size: 0.8rem; color: #64748b;">(خاتم وتأشيرة الإدارة)</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    function closePreventativePlanDocModal() {
        const modal = document.getElementById('dashPreventativePlanDocModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * طباعة الوثيقة الرسمية أو تصديرها كملف PDF
     */
    function printPreventativePlanOfficialDoc() {
        const container = document.getElementById('preventativePlanPrintableArea');
        if (!container) return;

        if (typeof window.html2pdf !== 'undefined') {
            const opt = {
                margin: [8, 8, 8, 8],
                filename: `وثيقة_الخطة_الوقائية_للغياب_${new Date().toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.page-break-avoid'] }
            };

            window.html2pdf().set(opt).from(container).save().then(() => {
                if (typeof showNotification === 'function') {
                    showNotification('تم بنجاح تحميل وثيقة الخطة الوقائية كملف PDF رسمي خالي من الأوراق الفارغة', 'success');
                }
            }).catch(err => {
                console.error('Error generating Preventative Plan PDF:', err);
                printFallbackWindow();
            });
        } else {
            printFallbackWindow();
        }

        function printFallbackWindow() {
            const htmlDoc = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>وثيقة الخطة الوقائية لتقليص الغياب المدرسي</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                    <style>
                        @page { size: A4 portrait; margin: 8mm; }
                        body { font-family: 'Cairo', sans-serif; direction: rtl; margin: 0; padding: 12px; background: #fff; color: #0f172a; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #cbd5e1; }
                        @media print {
                            body { padding: 0; }
                            button { display: none !important; }
                            *:last-child { page-break-after: auto !important; break-after: auto !important; }
                        }
                    </style>
                </head>
                <body>
                    ${container.outerHTML}
                </body>
                </html>
            `;
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(htmlDoc, 'وثيقة الخطة الوقائية لتقليص الغياب المدرسي', 'portrait');
                return;
            }
            window.print();
        }
    }

    // تصدير الدوال للنافذة العامة
    window.calculateWeekdayAbsenceStats = calculateWeekdayAbsenceStats;
    window.renderWeekdayAbsenceAnalysis = renderWeekdayAbsenceAnalysis;
    window.selectWeekdayForDetails = selectWeekdayForDetails;
    window.toggleDashboardPreventativePlan = toggleDashboardPreventativePlan;
    window.openWeekdayWhatsAppBroadcastModal = openWeekdayWhatsAppBroadcastModal;
    window.closeWeekdayWhatsAppBroadcastModal = closeWeekdayWhatsAppBroadcastModal;
    window.copyWeekdayWhatsAppBroadcastText = copyWeekdayWhatsAppBroadcastText;
    window.sendWeekdayWhatsAppBroadcastDirect = sendWeekdayWhatsAppBroadcastDirect;
    window.copyPreventativePlanText = copyPreventativePlanText;
    window.savePreventativePlanToNotes = savePreventativePlanToNotes;
    window.openPreventativePlanDocModal = openPreventativePlanDocModal;
    window.closePreventativePlanDocModal = closePreventativePlanDocModal;
    window.printPreventativePlanOfficialDoc = printPreventativePlanOfficialDoc;
    window.sendIndividualDayAlertWhatsApp = sendIndividualDayAlertWhatsApp;

    // تهيئة عند تحميل المستند
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // سيتم استدعاؤها مع renderDashboard
        });
    }

})();
