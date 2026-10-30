/**
 * ====================================================================
 * نظام توليد الملخص الأسبوعي الآلي للغياب (7 أيام) وإرساله للإدارة
 * Automated Weekly Absence Summary (7 Days) & 1-Click Admin Dispatch
 * ====================================================================
 * يتيح للأستاذ توليد ملخص أسبوعي آلي دقيق يرصد التلاميذ الذين تجاوزوا
 * عتبة غياب محددة خلال آخر 7 أيام، مع استعراض الحصص والمبررات،
 * وخيار إرسال التقرير وتوثيقه رسمياً لدى إدارة المؤسسة بنقرة واحدة.
 */

(function (window) {
    'use strict';

    // الحالة العامة للملخص الأسبوعي
    const _weeklyState = {
        classFilter: 'all',
        threshold: 3, // الافتراضي: 3 ساعات غياب في الأسبوع
        absenceType: 'all', // 'all' | 'unjustified' | 'justified'
        endDate: '', // سيتم ضبطه تلقائياً على تاريخ اليوم
        sort: 'hours_desc' // 'hours_desc' | 'severity' | 'name' | 'class'
    };

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
     * الحصول على تاريخ اليوم بنسق YYYY-MM-DD
     */
    function getTodayIsoDate() {
        const now = (typeof window.getAppNow === 'function') ? window.getAppNow() : new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /**
     * طرح عدد أيام من تاريخ معين بنسق YYYY-MM-DD
     */
    function subtractDaysIso(dateStr, days) {
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            dateObj.setDate(dateObj.getDate() - days);
            const resY = dateObj.getFullYear();
            const resM = String(dateObj.getMonth() + 1).padStart(2, '0');
            const resD = String(dateObj.getDate()).padStart(2, '0');
            return `${resY}-${resM}-${resD}`;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * اسم يوم الأسبوع بالعربية من تاريخ YYYY-MM-DD
     */
    function getArabicDayName(dateStr) {
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return ARABIC_WEEKDAYS[dateObj.getDay()] || '';
        } catch (e) {
            return '';
        }
    }

    /**
     * حساب معطيات الملخص الأسبوعي الآلي (7 أيام)
     */
    function getWeeklyAbsenceSummaryData(customOpts = {}) {
        const db = window.db || {};
        const classes = db.classes || {};
        const records = db.records || [];
        const behaviors = db.behaviors || {};

        const opts = { ..._weeklyState, ...customOpts };
        const endDate = opts.endDate || getTodayIsoDate();
        const startDate = subtractDaysIso(endDate, 6); // 7 أيام كاملة تشمل تاريخ البداية والنهاية
        const threshold = parseFloat(opts.threshold) || 3;
        const classFilter = opts.classFilter || 'all';
        const absenceType = opts.absenceType || 'all';

        const atRiskStudents = [];
        let allStudentsCount = 0;
        let totalPeriodAbsenceHours = 0;
        let unjustifiedHoursSum = 0;
        let justifiedHoursSum = 0;

        const classAbsenceStats = {};
        const weekdayAbsenceMap = {};
        ARABIC_WEEKDAYS.forEach(day => { weekdayAbsenceMap[day] = 0; });

        // تجميع الأقسام المطلوب فحصها
        const targetClasses = (classFilter === 'all')
            ? Object.keys(classes)
            : (classes[classFilter] ? [classFilter] : []);

        targetClasses.forEach(className => {
            classAbsenceStats[className] = {
                totalStudents: (classes[className] || []).length,
                atRiskCount: 0,
                absenceHours: 0
            };
        });

        // خريطة لتسريع البحث عن غيابات التلميذ في فترة الـ 7 أيام
        // studentId_className -> array of records in range
        const studentWeeklyRecords = new Map();

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (!r || !r.date) continue;

            // التحقق من نطاق الـ 7 أيام
            if (r.date < startDate || r.date > endDate) continue;

            // التحقق من حالة الغياب
            const isUnjustified = (r.status === 'غائب');
            const isJustified = (r.status === 'مبرر');
            if (!isUnjustified && !isJustified) continue;

            // فلترة نوع الغياب إذا حُدد
            if (absenceType === 'unjustified' && !isUnjustified) continue;
            if (absenceType === 'justified' && !isJustified) continue;

            // استثناء العطل الرسمية ورخص الأستاذ المعفاة
            if (typeof window.isAbsenceDisabledOnDate === 'function' && window.isAbsenceDisabledOnDate(r.date, r.session)) {
                continue;
            }

            const dur = parseFloat(r.duration) || 1;
            totalPeriodAbsenceHours += dur;
            if (isUnjustified) unjustifiedHoursSum += dur;
            if (isJustified) justifiedHoursSum += dur;

            const dayName = getArabicDayName(r.date);
            if (weekdayAbsenceMap[dayName] !== undefined) {
                weekdayAbsenceMap[dayName] += dur;
            }

            const key = `${r.studentId}_${r.className}`;
            if (!studentWeeklyRecords.has(key)) {
                studentWeeklyRecords.set(key, []);
            }
            studentWeeklyRecords.get(key).push({
                date: r.date,
                dayName,
                session: r.session || '1',
                duration: dur,
                status: r.status,
                justification: r.justification || ''
            });
        }

        // فحص تلاميذ الأقسام المستهدفة
        targetClasses.forEach(className => {
            const studentList = classes[className] || [];
            allStudentsCount += studentList.length;
            const classBehaviors = behaviors[className] || {};

            studentList.forEach(std => {
                const key = `${std.id}_${className}`;
                const weeklyRecs = studentWeeklyRecords.get(key) || [];

                let weeklyUnjustified = 0;
                let weeklyJustified = 0;

                weeklyRecs.forEach(rec => {
                    const dur = parseFloat(rec.duration) || 1;
                    if (rec.status === 'غائب') weeklyUnjustified += dur;
                    else if (rec.status === 'مبرر') weeklyJustified += dur;
                });

                const weeklyTotal = weeklyUnjustified + weeklyJustified;

                // تحديث إحصائيات القسم
                if (classAbsenceStats[className]) {
                    classAbsenceStats[className].absenceHours += weeklyTotal;
                }

                // حساب الغياب التراكمي طيلة الموسم للتلميذ لتقديم سياق بيداغوجي للإدارة
                let allTimeAbsenceHours = 0;
                for (let j = 0; j < records.length; j++) {
                    const r = records[j];
                    if (r.studentId === std.id && r.className === className && (r.status === 'غائب' || r.status === 'مبرر')) {
                        if (typeof window.isRecordProtectedHolidayOrLeave === 'function' && window.isRecordProtectedHolidayOrLeave(r)) continue;
                        allTimeAbsenceHours += (parseFloat(r.duration) || 1);
                    }
                }

                // هل تجاوز التلميذ العتبة المحددة خلال الـ 7 أيام؟
                if (weeklyTotal >= threshold && weeklyTotal > 0) {
                    if (classAbsenceStats[className]) {
                        classAbsenceStats[className].atRiskCount++;
                    }

                    const beh = classBehaviors[std.id] || { status: 'منضبط', note: '' };

                    // تصنيف درجة الخطورة
                    let severity = 'warning'; // 'critical' | 'warning' | 'notice'
                    let severityLabel = 'تنبيه غياب أسبوعي';
                    let severityBadgeColor = '#ea580c';
                    let severityBg = '#fff7ed';

                    if (weeklyTotal >= 4 || weeklyUnjustified >= 4 || (beh.status === 'مشوش')) {
                        severity = 'critical';
                        severityLabel = 'إنذار غياب حرج (إحالة عاجلة)';
                        severityBadgeColor = '#dc2626';
                        severityBg = '#fef2f2';
                    } else if (weeklyTotal >= threshold && weeklyUnjustified >= 2) {
                        severity = 'warning';
                        severityLabel = 'تجاوز عتبة الغياب الأسبوعية';
                        severityBadgeColor = '#c2410c';
                        severityBg = '#fff7ed';
                    } else {
                        severity = 'notice';
                        severityLabel = 'متابعة أسبوعية عادية';
                        severityBadgeColor = '#d97706';
                        severityBg = '#fefce8';
                    }

                    // ترتيب الحصص حسب التاريخ
                    weeklyRecs.sort((a, b) => b.date.localeCompare(a.date));

                    atRiskStudents.push({
                        student: std,
                        id: std.id,
                        name: std.name || 'تلميذ غير مسمى',
                        massar: std.massar || 'غير مسجل',
                        orderNumber: std.orderNum || std.orderNumber || '',
                        phone: std.phone || '',
                        className,
                        weeklyTotalHours: weeklyTotal,
                        weeklyUnjustifiedHours: weeklyUnjustified,
                        weeklyJustifiedHours: weeklyJustified,
                        weeklySessions: weeklyRecs,
                        allTimeAbsenceHours,
                        behaviorStatus: beh.status || 'منضبط',
                        behaviorNote: beh.note || '',
                        severity,
                        severityLabel,
                        severityBadgeColor,
                        severityBg
                    });
                }
            });
        });

        // ترتيب النتائج حسب المحدد
        if (opts.sort === 'hours_desc') {
            atRiskStudents.sort((a, b) => b.weeklyTotalHours - a.weeklyTotalHours || b.weeklyUnjustifiedHours - a.weeklyUnjustifiedHours);
        } else if (opts.sort === 'severity') {
            const rank = { critical: 3, warning: 2, notice: 1 };
            atRiskStudents.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0) || b.weeklyTotalHours - a.weeklyTotalHours);
        } else if (opts.sort === 'name') {
            atRiskStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        } else if (opts.sort === 'class') {
            atRiskStudents.sort((a, b) => (a.className || '').localeCompare(b.className || '', 'ar') || b.weeklyTotalHours - a.weeklyTotalHours);
        }

        // تحديد القسم الأكثر غياباً
        let topClass = 'لا يوجد';
        let maxClassHours = 0;
        Object.keys(classAbsenceStats).forEach(c => {
            if (classAbsenceStats[c].absenceHours > maxClassHours) {
                maxClassHours = classAbsenceStats[c].absenceHours;
                topClass = c;
            }
        });

        // تحديد يوم الذروة في الـ 7 أيام
        let peakDayName = 'لا يوجد';
        let maxDayHours = 0;
        Object.keys(weekdayAbsenceMap).forEach(d => {
            if (weekdayAbsenceMap[d] > maxDayHours) {
                maxDayHours = weekdayAbsenceMap[d];
                peakDayName = d;
            }
        });

        const atRiskAbsenceHours = atRiskStudents.reduce((acc, s) => acc + s.weeklyTotalHours, 0);
        const unjustifiedPercent = totalPeriodAbsenceHours > 0
            ? Math.round((unjustifiedHoursSum / totalPeriodAbsenceHours) * 100)
            : 0;

        return {
            startDate,
            endDate,
            threshold,
            classFilter,
            absenceType,
            sort: opts.sort,
            students: atRiskStudents,
            allStudentsCount,
            totalPeriodAbsenceHours,
            atRiskAbsenceHours,
            unjustifiedHoursSum,
            justifiedHoursSum,
            unjustifiedPercent,
            classAbsenceStats,
            topClass,
            peakDayName,
            periodDaysCount: 7
        };
    }

    /**
     * رسم وعرض بطاقة الملخص الأسبوعي الآلي في لوحة القيادة
     */
    function renderWeeklyAbsenceSummaryCard() {
        const container = document.getElementById('dashWeeklyAbsenceSection');
        if (!container) return;

        // تهيئة تاريخ النهاية إذا لم يكن مضبوطاً
        if (!_weeklyState.endDate) {
            _weeklyState.endDate = getTodayIsoDate();
        }

        const data = getWeeklyAbsenceSummaryData();
        const classes = window.db && window.db.classes ? Object.keys(window.db.classes) : [];

        // خيارات الأقسام
        let classOptionsHtml = `<option value="all" ${data.classFilter === 'all' ? 'selected' : ''}>جميع الأقسام معاً (${classes.length})</option>`;
        classes.forEach(c => {
            classOptionsHtml += `<option value="${escapeHtml(c)}" ${data.classFilter === c ? 'selected' : ''}>${escapeHtml(c)}</option>`;
        });

        const hasStudents = data.students.length > 0;

        let studentsListHtml = '';
        if (!hasStudents) {
            studentsListHtml = `
                <div style="text-align: center; padding: 32px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px dashed #a7f3d0; border-radius: 12px; margin-top: 14px;">
                    <div style="width: 52px; height: 52px; border-radius: 50%; background: #d1fae5; color: #059669; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; box-shadow: 0 4px 10px rgba(5, 150, 105, 0.15);">
                        <span data-lucide="shield-check" data-size="28"></span>
                    </div>
                    <h4 style="margin: 0 0 6px 0; color: #065f46; font-size: 1.05rem; font-weight: 800;">
                        ممتاز! انضباط تام أو عدم تجاوز لعتبة الغياب خلال آخر 7 أيام
                    </h4>
                    <p style="margin: 0 auto; max-width: 580px; font-size: 0.82rem; color: #047857; line-height: 1.6;">
                        لم يتم تسجيل أي تلميذ تجاوز عتبة <strong>${data.threshold} ساعات غياب</strong> في الفترة من <strong>${data.startDate}</strong> إلى <strong>${data.endDate}</strong>.
                        يمكنك خفض العتبة (مثلاً إلى ساعتين أو ساعة واحدة) لرصد الغيابات الطفيفة، أو مراجعة تاريخ نهاية الأسبوع.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 8px; margin-top: 14px; flex-wrap: wrap;">
                        <button type="button" onclick="setWeeklySummaryThreshold(2)" style="background: #ffffff; color: #059669; border: 1px solid #6ee7b7; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>فحص عتبة ساعتين (≥ 2 س)</span>
                        </button>
                        <button type="button" onclick="setWeeklySummaryThreshold(1)" style="background: #ffffff; color: #059669; border: 1px solid #6ee7b7; padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>فحص كافة الغيابات (≥ 1 س)</span>
                        </button>
                    </div>
                </div>
            `;
        } else {
            // توليد جدول وبطاقات التلاميذ المتجاوزين
            const rowsHtml = data.students.map((item, index) => {
                const sessionsBadges = item.weeklySessions.map(s => `
                    <span style="display: inline-flex; align-items: center; gap: 4px; background: ${s.status === 'غائب' ? '#fee2e2' : '#fef3c7'}; color: ${s.status === 'غائب' ? '#b91c1c' : '#b45309'}; border: 1px solid ${s.status === 'غائب' ? '#fca5a5' : '#fde68a'}; font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; margin: 2px;">
                        <span>${escapeHtml(s.dayName)} ${escapeHtml(s.date.slice(5))}: ح${escapeHtml(s.session)} (${escapeHtml(s.duration)}س)</span>
                        <span style="font-size: 0.65rem; opacity: 0.85;">[${escapeHtml(s.status)}]</span>
                    </span>
                `).join('');

                return `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 12px 10px; font-weight: 800; color: #475569; text-align: center; font-size: 0.82rem;">
                            ${index + 1}
                        </td>
                        <td style="padding: 12px 10px;">
                            <div style="font-weight: 800; color: #0f172a; font-size: 0.88rem;">${escapeHtml(item.name)}</div>
                            <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                                <span>مسار: <strong>${escapeHtml(item.massar)}</strong></span>
                                ${item.orderNumber ? `<span>• رقم: ${escapeHtml(item.orderNumber)}</span>` : ''}
                            </div>
                        </td>
                        <td style="padding: 12px 10px;">
                            <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 800; padding: 3px 9px; border-radius: 6px; display: inline-block;">
                                ${escapeHtml(item.className)}
                            </span>
                        </td>
                        <td style="padding: 12px 10px; text-align: center;">
                            <div style="display: inline-flex; align-items: baseline; gap: 4px;">
                                <span style="font-size: 1.15rem; font-weight: 900; color: ${item.severityBadgeColor};">${item.weeklyTotalHours}</span>
                                <span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">س</span>
                            </div>
                            <div style="font-size: 0.68rem; color: #64748b; margin-top: 1px;">
                                <span style="color: #dc2626;">غير مبرر: ${item.weeklyUnjustifiedHours}س</span>
                                ${item.weeklyJustifiedHours > 0 ? ` | <span style="color: #d97706;">مبرر: ${item.weeklyJustifiedHours}س</span>` : ''}
                            </div>
                        </td>
                        <td style="padding: 12px 10px;">
                            <div style="display: flex; flex-wrap: wrap; gap: 3px; max-width: 380px;">
                                ${sessionsBadges}
                            </div>
                        </td>
                        <td style="padding: 12px 10px; text-align: center;">
                            <span style="font-size: 0.82rem; font-weight: 800; color: #475569;">
                                ${item.allTimeAbsenceHours} س
                            </span>
                        </td>
                        <td style="padding: 12px 10px; text-align: center;">
                            <span style="background: ${item.severityBg}; color: ${item.severityBadgeColor}; border: 1px solid ${item.severityBadgeColor}40; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${item.severityBadgeColor};"></span>
                                ${escapeHtml(item.severityLabel)}
                            </span>
                        </td>
                        <td style="padding: 12px 10px; text-align: center;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                                <button type="button" onclick="notifyParentWeeklyAbsence('${escapeHtml(item.id)}', '${escapeHtml(item.className)}')" title="إشعار ولي الأمر عبر WhatsApp بحالات غياب هذا الأسبوع" style="background: #25d366; color: #fff; border: none; border-radius: 7px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                                    <span data-lucide="message-circle" data-size="14"></span>
                                </button>
                                <button type="button" onclick="openStudentPortfolio('${escapeHtml(item.id)}', '${escapeHtml(item.className)}')" title="معاينة الملف التربوي الشامل للتلميذ" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 7px; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                                    <span data-lucide="user" data-size="14"></span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            studentsListHtml = `
                <div style="overflow-x: auto; margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.82rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1.5px solid #e2e8f0; color: #475569; font-weight: 800; font-size: 0.78rem;">
                                <th style="padding: 10px 8px; text-align: center; width: 40px;">#</th>
                                <th style="padding: 10px 10px;">التلميذ ورقم مسار</th>
                                <th style="padding: 10px 10px;">القسم</th>
                                <th style="padding: 10px 10px; text-align: center;">غياب الأسبوع (7 أيام)</th>
                                <th style="padding: 10px 10px;">الحصص المغاب عنها في الأسبوع</th>
                                <th style="padding: 10px 10px; text-align: center;" title="إجمالي غياب التلميذ طيلة الموسم الدراسي">المجموع التراكمي</th>
                                <th style="padding: 10px 10px; text-align: center;">مستوى الإجراء</th>
                                <th style="padding: 10px 8px; text-align: center; width: 80px;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        container.innerHTML = `
            <!-- بطاقة الملخص الأسبوعي الآلي لحالات الغياب (رصد 7 أيام) -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 14px; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); padding: 20px; margin-bottom: 16px;">
                <!-- Header Row -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);">
                            <span data-lucide="file-check-2" data-size="24"></span>
                        </span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h3 style="margin: 0; font-size: 1.12rem; font-weight: 800; color: #0f172a;">
                                    الملخص الأسبوعي الآلي لحالات الغياب (رصد 7 أيام)
                                </h3>
                                <span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 2px 9px; border-radius: 999px; font-weight: 800;">
                                    توليد ذكي ومباشر ⚡
                                </span>
                                ${hasStudents ? `
                                    <span style="font-size: 0.72rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; padding: 2px 9px; border-radius: 999px; font-weight: 800;">
                                        🚨 ${data.students.length} تلميذ تجاوزوا العتبة
                                    </span>
                                ` : `
                                    <span style="font-size: 0.72rem; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 2px 9px; border-radius: 999px; font-weight: 800;">
                                        ✓ انضباط تام
                                    </span>
                                `}
                            </div>
                            <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #64748b;">
                                رصد تلقائي للتلاميذ المتجاوزين لعتبة الغياب خلال آخر 7 أيام 
                                (من <strong style="color: #0369a1;">${data.startDate}</strong> إلى <strong style="color: #0369a1;">${data.endDate}</strong>) 
                                مع خيار إرسال التقرير الرسمي للإدارة التربوية بنقرة واحدة.
                            </p>
                        </div>
                    </div>

                    <!-- Primary Action Button: 1-Click Send to Administration -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" id="btnWeeklySummarySendOneClick" onclick="sendWeeklySummaryToAdminOneClick()" class="btn-action weekly-send-btn-glow" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%); color: #ffffff; border: none; font-weight: 800; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); cursor: pointer; transition: all 0.2s;" title="إرسال التقرير الأسبوعي وتوثيقه فوراً لدى الإدارة والحراسة العامة بنقرة واحدة">
                            <span data-lucide="send" data-size="17"></span>
                            <span>إرسال التقرير للإدارة بنقرة واحدة 🚀</span>
                        </button>
                        <button type="button" onclick="openWeeklyAbsenceSummaryModal()" class="btn-action" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; border: none; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25); cursor: pointer;" title="معاينة وطباعة الوثيقة الرسمية أو تحميلها كملف PDF">
                            <span data-lucide="printer" data-size="15"></span>
                            <span>معاينة وطباعة (PDF)</span>
                        </button>
                        <button type="button" onclick="copyWeeklySummaryAdminText()" class="btn-action" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 5px; padding: 8px 12px; border-radius: 8px; cursor: pointer;" title="نسخ نص التقرير للمراسلات الرسمية أو مسار">
                            <span data-lucide="copy" data-size="14"></span>
                            <span>نسخ الملخص</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Metric Tiles Grid (4 Indicators) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px;">
                    <!-- 1. المتجاوزون للعتبة -->
                    <div style="background: ${hasStudents ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${hasStudents ? '#fecaca' : '#bbf7d0'}; border-radius: 10px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: ${hasStudents ? '#991b1b' : '#166534'};">
                            التلاميذ المتجاوزون للعتبة (≥ ${data.threshold}س)
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                            <span style="font-size: 1.6rem; font-weight: 900; color: ${hasStudents ? '#dc2626' : '#15803d'}; line-height: 1.1;">
                                ${data.students.length}
                            </span>
                            <span style="font-size: 0.78rem; font-weight: 700; color: #64748b;">تلميذ</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                            من أصل ${data.allStudentsCount} تلميذ
                        </div>
                    </div>

                    <!-- 2. إجمالي ساعات غياب الأسبوع للمتعثرين -->
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #1e40af;">
                            ساعات غياب المتجاوزين (7 أيام)
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                            <span style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; line-height: 1.1;">
                                ${data.atRiskAbsenceHours}
                            </span>
                            <span style="font-size: 0.78rem; font-weight: 700; color: #3b82f6;">ساعة</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                            إجمالي كافة الأقسام: ${data.totalPeriodAbsenceHours}س
                        </div>
                    </div>

                    <!-- 3. نسبة الغياب غير المبرر -->
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #9a3412;">
                            نسبة الغياب غير المبرر في الأسبوع
                        </div>
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                            <span style="font-size: 1.6rem; font-weight: 900; color: #ea580c; line-height: 1.1;">
                                ${data.unjustifiedPercent}%
                            </span>
                            <span style="font-size: 0.75rem; font-weight: 700; color: #c2410c;">(${data.unjustifiedHoursSum}س)</span>
                        </div>
                        <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                            المبرر: ${data.justifiedHoursSum}س
                        </div>
                    </div>

                    <!-- 4. القسم الأعلى غياباً ويوم الذروة -->
                    <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 700; color: #6b21a8;">
                            القسم الأعلى تسجيلاً ويوم الذروة
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                            <span style="font-size: 1.05rem; font-weight: 900; color: #7c3aed; line-height: 1.2;">
                                ${escapeHtml(data.topClass)}
                            </span>
                        </div>
                        <div style="font-size: 0.7rem; color: #6b21a8; font-weight: 700; margin-top: 3px;">
                            يوم الذروة: <span style="color: #dc2626;">${escapeHtml(data.peakDayName)}</span>
                        </div>
                    </div>
                </div>

                <!-- Interactive Filters & Parameters Bar -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; flex: 1;">
                        <!-- Class Filter -->
                        <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">القسم:</label>
                            <select id="weeklyFilterClass" onchange="onWeeklySummaryFilterChange('classFilter', this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                                ${classOptionsHtml}
                            </select>
                        </div>

                        <!-- Threshold Selector -->
                        <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">عتبة الغياب خلال 7 أيام:</label>
                            <select id="weeklyFilterThreshold" onchange="onWeeklySummaryFilterChange('threshold', this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                                <option value="2" ${data.threshold === 2 ? 'selected' : ''}>غياب ≥ ساعتان (تنبيه مبكر)</option>
                                <option value="3" ${data.threshold === 3 ? 'selected' : ''}>غياب ≥ 3 ساعات (افتراضي موصى به)</option>
                                <option value="4" ${data.threshold === 4 ? 'selected' : ''}>غياب ≥ 4 ساعات (حرج)</option>
                                <option value="5" ${data.threshold === 5 ? 'selected' : ''}>غياب ≥ 5 ساعات (إنذار أقصى)</option>
                                <option value="1" ${data.threshold === 1 ? 'selected' : ''}>غياب ≥ ساعة واحدة (رصد شامل)</option>
                            </select>
                        </div>

                        <!-- Absence Type Filter -->
                        <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">نوع الغياب:</label>
                            <select id="weeklyFilterType" onchange="onWeeklySummaryFilterChange('absenceType', this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                                <option value="all" ${data.absenceType === 'all' ? 'selected' : ''}>الكل (غير مبرر ومبرر)</option>
                                <option value="unjustified" ${data.absenceType === 'unjustified' ? 'selected' : ''}>غير مبرر فقط 🔴</option>
                                <option value="justified" ${data.absenceType === 'justified' ? 'selected' : ''}>مبرر فقط 🟡</option>
                            </select>
                        </div>

                        <!-- End Date Picker -->
                        <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">تاريخ نهاية الـ 7 أيام:</label>
                            <input type="date" id="weeklyFilterEndDate" value="${data.endDate}" onchange="onWeeklySummaryFilterChange('endDate', this.value)" style="padding: 5px 9px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                        </div>

                        <!-- Sort Selector -->
                        <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: #475569; display: block; margin-bottom: 3px;">الترتيب:</label>
                            <select id="weeklyFilterSort" onchange="onWeeklySummaryFilterChange('sort', this.value)" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.8rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                                <option value="hours_desc" ${data.sort === 'hours_desc' ? 'selected' : ''}>الأكثر غياباً أولاً</option>
                                <option value="severity" ${data.sort === 'severity' ? 'selected' : ''}>الأشد خطورة أولاً</option>
                                <option value="class" ${data.sort === 'class' ? 'selected' : ''}>حسب القسم</option>
                                <option value="name" ${data.sort === 'name' ? 'selected' : ''}>أبجدياً حسب الاسم</option>
                            </select>
                        </div>
                    </div>

                    <!-- Reset to Today / Refresh Button -->
                    <div style="display: flex; align-items: flex-end; gap: 6px; padding-top: 14px;">
                        <button type="button" onclick="resetWeeklySummaryToToday()" title="إعادة تعيين تاريخ الأسبوع إلى اليوم" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <span data-lucide="calendar" data-size="13"></span>
                            <span>أسبوع اليوم</span>
                        </button>
                        <button type="button" onclick="renderWeeklyAbsenceSummaryCard()" title="تحديث الحساب الآن" style="background: #e2e8f0; color: #1e293b; border: none; padding: 6px 10px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <span data-lucide="refresh-cw" data-size="13"></span>
                            <span>تحديث</span>
                        </button>
                    </div>
                </div>

                <!-- Students List Display -->
                ${studentsListHtml}

                <!-- Quick Send Footer Reminder -->
                ${hasStudents ? `
                    <div style="margin-top: 14px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #15803d;"><span data-lucide="check-circle" data-size="18"></span></span>
                            <span style="font-size: 0.82rem; font-weight: 700; color: #166534;">
                                التقرير جاهز ومكتمل البيانات. بالنقر على زر <strong>"إرسال التقرير للإدارة بنقرة واحدة"</strong> سيتم توثيق الكشف فورياً في سجل المراسلات الإدارية وتفعيل متابعة الرد.
                            </span>
                        </div>
                        <button type="button" onclick="sendWeeklySummaryToAdminOneClick()" style="background: #15803d; color: #ffffff; border: none; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; padding: 7px 15px; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 6px rgba(21, 128, 61, 0.3);">
                            <span data-lucide="send" data-size="14"></span>
                            <span>إرسال فوري الآن</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تغيير أحد فلاتر الملخص الأسبوعي
     */
    function onWeeklySummaryFilterChange(key, value) {
        if (key === 'threshold') {
            _weeklyState.threshold = parseFloat(value) || 3;
        } else {
            _weeklyState[key] = value;
        }
        renderWeeklyAbsenceSummaryCard();
    }
    window.onWeeklySummaryFilterChange = onWeeklySummaryFilterChange;

    /**
     * ضبط عتبة الغياب سريعاً
     */
    function setWeeklySummaryThreshold(val) {
        _weeklyState.threshold = parseFloat(val) || 3;
        renderWeeklyAbsenceSummaryCard();
    }
    window.setWeeklySummaryThreshold = setWeeklySummaryThreshold;

    /**
     * إعادة تعيين النطاق الزمني لآخر 7 أيام حتى اليوم
     */
    function resetWeeklySummaryToToday() {
        _weeklyState.endDate = getTodayIsoDate();
        renderWeeklyAbsenceSummaryCard();
    }
    window.resetWeeklySummaryToToday = resetWeeklySummaryToToday;

    // =========================================================================
    // ميزة إرسال التقرير للإدارة بنقرة واحدة (One-Click Administration Dispatch)
    // =========================================================================

    /**
     * إرسال التقرير للإدارة بنقرة واحدة
     */
    function sendWeeklySummaryToAdminOneClick() {
        const data = getWeeklyAbsenceSummaryData();
        const db = window.db || {};

        if (data.students.length === 0) {
            // تنبيه الأستاذ في حال عدم وجود تلاميذ متجاوزين
            const proceed = confirm(
                `لا توجد حالات تجاوزت عتبة ${data.threshold} ساعات في الفترة المحددة (${data.startDate} إلى ${data.endDate}).\n` +
                `هل ترغب بإرسال "تقرير استقرار المواظبة وخلو القسم من الغيابات الحرجة" للإدارة؟`
            );
            if (!proceed) return;
        }

        // 1. توليد رقم إشاري رسمي للتقرير الأسبوعي
        const nowObj = (typeof window.getAppNow === 'function') ? window.getAppNow() : new Date();
        const dateCode = nowObj.toISOString().slice(2, 10).replace(/-/g, '');
        const randomCode = Math.floor(100 + Math.random() * 900);
        const slipNumber = `WK-${dateCode}-${randomCode}`;

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name)
            ? window.db.teacherProfile.name
            : ((window.db && window.db.profile && window.db.profile.name) ? window.db.profile.name : 'أستاذ المادة');
        const targetClassLabel = (data.classFilter === 'all') ? 'كافة الأقسام' : data.classFilter;
        const title = `تقرير الغياب الأسبوعي الآلي (7 أيام: ${data.startDate} إلى ${data.endDate}) - ${targetClassLabel}`;

        // 2. إنشاء كشف المتابعة الإداري وإدراجه في db.adminFollowUpSlips
        if (!window.db.adminFollowUpSlips || !Array.isArray(window.db.adminFollowUpSlips)) {
            window.db.adminFollowUpSlips = [];
        }

        const criticalStudents = data.students.filter(s => s.severity === 'critical');
        const studentsNamesList = data.students.map(s => `${s.name} (${s.className}: ${s.weeklyTotalHours}س)`).join('، ');

        const newSlip = {
            id: 'slip_weekly_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            slipNumber,
            title,
            className: targetClassLabel,
            sentAt: nowObj.toISOString(),
            sentBy: teacherName,
            targetOffice: 'الحراسة العامة للخارجية / إدارة المؤسسة',
            channel: 'إرسال رقمي وإداري فوري (بنقرة واحدة)',
            studentsCount: data.students.length,
            criticalCount: criticalStudents.length,
            urgency: 'high',
            status: 'pending',
            reminderCount: 0,
            remindedAt: null,
            notes: `ملخص أسبوعي آلي (7 أيام: ${data.startDate} إلى ${data.endDate}) - عتبة الاحتساب: ${data.threshold} ساعات. إجمالي ساعات الغياب: ${data.atRiskAbsenceHours}س. التلاميذ المتجاوزون: ${studentsNamesList || 'لا توجد تجاوزات'}.`,
            createdAt: nowObj.toISOString(),
            isWeeklyReport: true,
            period: {
                startDate: data.startDate,
                endDate: data.endDate,
                threshold: data.threshold
            },
            studentsSnapshot: data.students.map(s => ({
                id: s.id,
                name: s.name,
                massar: s.massar,
                className: s.className,
                weeklyHours: s.weeklyTotalHours,
                unjustifiedHours: s.weeklyUnjustifiedHours,
                justifiedHours: s.weeklyJustifiedHours,
                sessionsCount: s.weeklySessions.length,
                severity: s.severity
            }))
        };

        window.db.adminFollowUpSlips.unshift(newSlip);

        // 3. تسجيل الإجراء في السجل الكرونولوجي
        if (typeof window.recordAdminAction === 'function') {
            window.recordAdminAction({
                actionType: 'weekly_admin_report_sent',
                title: 'إرسال الملخص الأسبوعي للغياب للإدارة بنقرة واحدة',
                className: targetClassLabel,
                details: `تم توثيق وإرسال تقرير الغياب الأسبوعي (7 أيام: ${data.startDate} إلى ${data.endDate}) بنقرة واحدة برقم إشاري [${slipNumber}]، متضمناً ${data.students.length} تلميذ تجاوزوا عتبة ${data.threshold}س للإدارة التربوية والحراسة العامة.`
            });
        }

        // 4. حفظ قاعدة البيانات
        if (typeof window.saveDB === 'function') {
            window.saveDB();
        }

        // 5. تحديث مكونات لوحة القيادة التفاعلية
        if (typeof window.renderAdminFollowUpHub === 'function') {
            window.renderAdminFollowUpHub();
        }
        if (typeof window.updateFollowUpBadges === 'function') {
            window.updateFollowUpBadges();
        }
        if (typeof window.renderDashboardTimeline === 'function') {
            window.renderDashboardTimeline();
        }

        // 6. عرض نافذة التأكيد والخيارات السريعة للإرسال الرقمي والطباعة
        showWeeklySummarySendSuccessModal(newSlip, data);
    }
    window.sendWeeklySummaryToAdminOneClick = sendWeeklySummaryToAdminOneClick;

    /**
     * إظهار نافذة تأكيد الإرسال والخيارات الفورية (WhatsApp للإدارة، إيميل، طباعة)
     */
    function showWeeklySummarySendSuccessModal(slip, summaryData) {
        let modal = document.getElementById('weeklySummarySuccessModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'weeklySummarySuccessModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); z-index: 10025; display: flex; align-items: center; justify-content: center; padding: 15px; backdrop-filter: blur(5px);';
            document.body.appendChild(modal);
        }

        const count = summaryData.students.length;
        const criticalCount = summaryData.students.filter(s => s.severity === 'critical').length;

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 640px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); text-align: right; font-family: 'Cairo', sans-serif;">
                <!-- Header Icon -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="width: 44px; height: 44px; border-radius: 12px; background: #dcfce7; color: #15803d; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(22, 101, 52, 0.15);">
                            <span data-lucide="check-check" data-size="24"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">
                                تم إرسال وتوثيق التقرير الأسبوعي للإدارة بنجاح!
                            </h3>
                            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                                تم تسجيل الوثيقة برقم إشاري رسمي وبدء عداد تتبع الرد (48 ساعة)
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="closeWeeklySummarySuccessModal()" style="background: #f1f5f9; border: none; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; color: #64748b; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <!-- Slip Card Info -->
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.82rem;">
                        <div>
                            <span style="color: #64748b; font-size: 0.75rem;">الرقم الإشاري الرسمي:</span>
                            <div style="font-weight: 900; color: #065f46; font-size: 0.95rem;">${escapeHtml(slip.slipNumber)}</div>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.75rem;">الجهة المرسل إليها:</span>
                            <div style="font-weight: 800; color: #0f172a;">${escapeHtml(slip.targetOffice)}</div>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.75rem;">فترة التقرير (7 أيام):</span>
                            <div style="font-weight: 800; color: #1e3a8a;">من ${summaryData.startDate} إلى ${summaryData.endDate}</div>
                        </div>
                        <div>
                            <span style="color: #64748b; font-size: 0.75rem;">عدد الحالات المتضمنة:</span>
                            <div style="font-weight: 900; color: #b91c1c;">${count} تلميذ (${criticalCount} حرج)</div>
                        </div>
                    </div>
                </div>

                <!-- Instant Dispatch Buttons -->
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 0.82rem; font-weight: 800; color: #334155; margin-bottom: 8px;">
                        إجراءات التواصل والمشاركة الفورية المتاحة للإدارة:
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px;">
                        <!-- WhatsApp to Admin -->
                        <button type="button" onclick="sendWeeklySummaryWhatsAppToAdmin()" style="background: #25d366; color: #ffffff; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.84rem; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; box-shadow: 0 3px 8px rgba(37, 211, 102, 0.3);">
                            <span data-lucide="message-circle" data-size="16"></span>
                            <span>إرسال فوري عبر WhatsApp للحارس العام</span>
                        </button>

                        <!-- Print Official PDF -->
                        <button type="button" onclick="openWeeklyAbsenceSummaryModal(); closeWeeklySummarySuccessModal();" style="background: #1e293b; color: #ffffff; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.84rem; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; box-shadow: 0 3px 8px rgba(30, 41, 59, 0.3);">
                            <span data-lucide="printer" data-size="16"></span>
                            <span>معاينة وطباعة الكشف الرسمي (PDF)</span>
                        </button>

                        <!-- Email to Administration -->
                        <button type="button" onclick="sendWeeklySummaryEmailToAdmin()" style="background: #2563eb; color: #ffffff; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 800; font-size: 0.84rem; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);">
                            <span data-lucide="mail" data-size="16"></span>
                            <span>إرسال بريد إلكتروني للإدارة</span>
                        </button>

                        <!-- Copy Text -->
                        <button type="button" onclick="copyWeeklySummaryAdminText()" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; font-weight: 700; font-size: 0.84rem; display: flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer;">
                            <span data-lucide="copy" data-size="16"></span>
                            <span>نسخ نص التقرير للمنظومة الإدارية</span>
                        </button>
                    </div>
                </div>

                <!-- Footer Close -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: flex-end;">
                    <button type="button" onclick="closeWeeklySummarySuccessModal()" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }
    window.showWeeklySummarySendSuccessModal = showWeeklySummarySendSuccessModal;

    function closeWeeklySummarySuccessModal() {
        const modal = document.getElementById('weeklySummarySuccessModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeWeeklySummarySuccessModal = closeWeeklySummarySuccessModal;

    // =========================================================================
    // نافذة معاينة وطباعة التقرير الأسبوعي الرسمي (Print / PDF Official Document)
    // =========================================================================

    /**
     * فتح نافذة معاينة وطباعة التقرير الأسبوعي الرسمي
     */
    function openWeeklyAbsenceSummaryModal() {
        let modal = document.getElementById('weeklyAbsenceSummaryModal');
        if (!modal) {
            console.error('Modal weeklyAbsenceSummaryModal not found in DOM');
            return;
        }

        updateWeeklyAbsenceSummaryPreview();
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }
    window.openWeeklyAbsenceSummaryModal = openWeeklyAbsenceSummaryModal;

    function closeWeeklyAbsenceSummaryModal() {
        const modal = document.getElementById('weeklyAbsenceSummaryModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeWeeklyAbsenceSummaryModal = closeWeeklyAbsenceSummaryModal;

    /**
     * تحديث معاينة الوثيقة الرسمية
     */
    function updateWeeklyAbsenceSummaryPreview() {
        const container = document.getElementById('weeklyAbsenceSummaryPreviewContainer');
        if (!container) return;

        const data = getWeeklyAbsenceSummaryData();
        const db = window.db || {};
        const profile = db.teacherProfile || db.profile || {};
        const teacherName = profile.name || 'أستاذ المادة';
        const subjectName = profile.subject || 'الرياضيات';
        const schoolName = profile.school || profile.institution || 'المؤسسة التعليمية';
        const academy = profile.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const directorate = profile.directorate || 'المديرية الإقليمية';
        const season = profile.academicYear || profile.schoolYear || '2026/2027';
        const printFont = typeof window.getSelectedPrintFontFamily === 'function' ? window.getSelectedPrintFontFamily() : "'Cairo', sans-serif";
        const hwFont = typeof window.getSelectedHandwritingFontFamily === 'function' ? window.getSelectedHandwritingFontFamily() : "'Aref Ruqaa', serif";

        const now = (typeof window.getAppNow === 'function') ? window.getAppNow() : new Date();
        const printDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

        const rows = data.students.map((s, idx) => {
            const sessionsSummary = s.weeklySessions.map(sec => 
                `${sec.dayName} ${sec.date.slice(5)} (ح${sec.session}: ${sec.duration}س - ${sec.status})`
            ).join(' | ');

            return `
                <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
                    <td style="padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 6px; font-weight: bold;">${escapeHtml(s.name)}</td>
                    <td style="padding: 6px; text-align: center; font-family: monospace;">${escapeHtml(s.massar)}</td>
                    <td style="padding: 6px; text-align: center;">${escapeHtml(s.className)}</td>
                    <td style="padding: 6px; text-align: center; font-weight: 900; color: #dc2626;">${s.weeklyTotalHours} س</td>
                    <td style="padding: 6px; text-align: center;">${s.weeklyUnjustifiedHours}س غير مبرر / ${s.weeklyJustifiedHours}س مبرر</td>
                    <td style="padding: 6px; font-size: 10px; color: #334155;">${escapeHtml(sessionsSummary)}</td>
                    <td style="padding: 6px; text-align: center; font-weight: bold;">${s.allTimeAbsenceHours} س</td>
                    <td style="padding: 6px; text-align: center; font-size: 10px;">
                        ${s.severity === 'critical' ? 'استدعاء فوري لولي الأمر وتوقيع التزام' : 'إشعار وتنبيه بالغياب واستفسار كتابي'}
                    </td>
                </tr>
            `;
        }).join('');

        const emptyMessage = data.students.length === 0 ? `
            <tr>
                <td colspan="9" style="text-align: center; padding: 24px; color: #059669; font-weight: bold;">
                    ✓ لم تسجل أي حالة تجاوز لعتبة الغياب المحددة (${data.threshold} ساعات) خلال هذه الفترة (7 أيام: ${data.startDate} إلى ${data.endDate}).
                </td>
            </tr>
        ` : '';

        container.innerHTML = `
            <!-- ورقة الطباعة الرسمية A4 -->
            <div class="weekly-official-sheet" style="background: #ffffff; color: #0f172a; font-family: ${printFont}; line-height: 1.4; padding: 10px;">
                <!-- الترويسة الوزارية الرسمية -->
                <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; text-align: center;">
                        <div style="text-align: right; font-size: 11px; font-weight: 700; width: 33%;">
                            <div>المملكة المغربية</div>
                            <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                            <div>${escapeHtml(academy)}</div>
                            <div>${escapeHtml(directorate)}</div>
                            <div>مؤسسة: <strong>${escapeHtml(schoolName)}</strong></div>
                        </div>
                        <div style="text-align: center; width: 34%;">
                            <div style="font-size: 1.35rem; font-weight: 900; color: #1e3a8a; letter-spacing: -0.5px;">
                                تقرير أسبوعي عن غياب التلاميذ
                            </div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: #b91c1c; margin-top: 3px;">
                                (حالات تجاوز عتبة الغياب خلال 7 أيام)
                            </div>
                            <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">
                                الموسم الدراسي: ${escapeHtml(season)}
                            </div>
                        </div>
                        <div style="text-align: left; font-size: 11px; font-weight: 700; width: 33%;">
                            <div>أستاذ(ة) المادة: <strong>${escapeHtml(teacherName)}</strong></div>
                            <div>مادة التدريس: <strong>${escapeHtml(subjectName)}</strong></div>
                            <div>الفترة المشمولة: <strong>${data.startDate} إلى ${data.endDate}</strong></div>
                            <div>تاريخ التوليد: <strong>${printDate}</strong></div>
                        </div>
                    </div>
                </div>

                <!-- بيانات المرجع والعتبة -->
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                    <div><strong>القسم المستهدف:</strong> ${data.classFilter === 'all' ? 'كافة الأقسام المسندة' : escapeHtml(data.classFilter)}</div>
                    <div><strong>عتبة الاحتساب:</strong> ≥ ${data.threshold} ساعات غياب خلال 7 أيام</div>
                    <div><strong>عدد الحالات المتجاوزة:</strong> <span style="color: #dc2626; font-weight: 900;">${data.students.length} تلميذ</span></div>
                    <div><strong>إجمالي ساعات غياب الأسبوع:</strong> <strong>${data.atRiskAbsenceHours} ساعة</strong></div>
                </div>

                <!-- جدول التلاميذ المتجاوزين -->
                <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #0f172a; margin-bottom: 14px; font-size: 11px;">
                    <thead>
                        <tr style="background: #1e293b; color: #ffffff; font-weight: 800; text-align: center;">
                            <th style="padding: 6px; border: 1px solid #334155; width: 30px;">#</th>
                            <th style="padding: 6px; border: 1px solid #334155; text-align: right;">الاسم الكامل للتلميذ</th>
                            <th style="padding: 6px; border: 1px solid #334155;">رقم مسار</th>
                            <th style="padding: 6px; border: 1px solid #334155;">القسم</th>
                            <th style="padding: 6px; border: 1px solid #334155;">ساعات 7 أيام</th>
                            <th style="padding: 6px; border: 1px solid #334155;">تفصيل الغياب</th>
                            <th style="padding: 6px; border: 1px solid #334155; text-align: right;">الحصص المغاب عنها في الأسبوع</th>
                            <th style="padding: 6px; border: 1px solid #334155;" title="الغياب التراكمي في السنة">التراكمي</th>
                            <th style="padding: 6px; border: 1px solid #334155;">الإجراء الإداري المقترح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        ${emptyMessage}
                    </tbody>
                </table>

                <!-- توصيات وملاحظات الحراسة العامة -->
                <div style="background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 11px; line-height: 1.5;">
                    <div style="font-weight: 800; color: #1e293b; margin-bottom: 4px;">📌 ملاحظات وتوصيات أستاذ المادة الموجهة للحراسة العامة للخارجية:</div>
                    <ul class="teacher-handwritten-note" style="margin: 0; padding-right: 18px; color: #334155; font-family: ${hwFont}; font-size: 12.5px;">
                        <li>يُرجى إشعار أولياء أمور التلاميذ المذكورين أعلاه والتأكد من إدلائهم بالمبررات القانونية للغياب في الآجال المنصوص عليها.</li>
                        <li>التلاميذ المتجاوزون لـ 4 ساعات غياب أسبوعياً يمثلون حالة إنذار عاجلة تتطلب استدعاء فورياً للحراسة العامة لتفادي الهدر المدرسي.</li>
                        <li>إرجاع نسخة مؤشرة من هذا الكشف مع التدابير المتخذة لتوثيقها في ملف المواظبة التربوية.</li>
                    </ul>
                </div>

                <!-- خانات التوقيع والمصادقة الرسمية -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: center; margin-top: 18px; font-size: 11px;">
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 8px; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="font-weight: 800; color: #1e293b;">توقيع وخاتم أستاذ(ة) المادة:</div>
                        <div class="signature-handwritten" style="font-family: ${hwFont}; font-size: 13px; color: #1e3a8a; font-weight: 700; margin-top: 8px;">${escapeHtml(teacherName)}</div>
                        <div style="color: #64748b; font-size: 10px; margin-top: 18px;">(حرر بتاريخ: ${printDate})</div>
                    </div>
                    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 8px; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div style="font-weight: 800; color: #1e293b;">تأشيرة وملاحظات الحراسة العامة / إدارة المؤسسة:</div>
                        <div style="color: #64748b; font-size: 10px; margin-top: 35px;">(تاريخ الاستلام والتوقيع)</div>
                    </div>
                </div>
            </div>
        `;
    }
    window.updateWeeklyAbsenceSummaryPreview = updateWeeklyAbsenceSummaryPreview;

    /**
     * طباعة الوثيقة الرسمية للملخص الأسبوعي
     */
    function printWeeklyAbsenceSummaryOfficialDocument() {
        const container = document.getElementById('weeklyAbsenceSummaryPreviewContainer');
        if (!container) return;

        // تسجيل إجراء الطباعة في السجل الكرونولوجي
        if (typeof window.recordAdminAction === 'function') {
            window.recordAdminAction({
                actionType: 'weekly_report_print',
                title: 'طباعة كشف الغياب الأسبوعي الرسمي (7 أيام)',
                details: 'أمر طباعة مباشر للوثيقة الرسمية الخاصة بالتلاميذ المتجاوزين للعتبة للإدارة التربوية'
            });
        }

        const printContent = container.innerHTML;
        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printContent, 'تقرير الغياب الأسبوعي الرسمي (7 أيام) - الموجه للإدارة', 'portrait');
            return;
        }

        // استخدام iframe مخفي لتفادي حظر window.open في المتصفحات
        let printFrame = document.getElementById('weeklySummaryPrintIframe');
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'weeklySummaryPrintIframe';
            printFrame.style.cssText = 'position: fixed; right: -9999px; bottom: -9999px; width: 0; height: 0; border: none;';
            document.body.appendChild(printFrame);
        }

        const frameDoc = printFrame.contentWindow.document;
        frameDoc.open();
        frameDoc.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تقرير الغياب الأسبوعي الرسمي (7 أيام) - الموجه للإدارة</title>
                <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4 portrait; margin: 12mm 10mm; }
                    body { font-family: 'Cairo', 'Amiri', sans-serif; direction: rtl; margin: 0; padding: 0; color: #000; background: #fff; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #333; padding: 5px 6px; font-size: 11px; }
                    th { background-color: #f1f5f9 !important; color: #000 !important; font-weight: bold; }
                    .weekly-official-sheet { padding: 0; }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
            </html>
        `);
        frameDoc.close();

        setTimeout(() => {
            try {
                const iWin = printFrame.contentWindow;
                iWin.onafterprint = () => {
                    try { iWin.document.body.innerHTML = ''; } catch (e) {}
                };
                iWin.focus();
                iWin.print();
                setTimeout(() => {
                    try { if (iWin && iWin.document && iWin.document.body) iWin.document.body.innerHTML = ''; } catch (e) {}
                }, 45000);
            } catch (err) {
                window.print();
            }
        }, 350);
    }
    window.printWeeklyAbsenceSummaryOfficialDocument = printWeeklyAbsenceSummaryOfficialDocument;

    /**
     * تنزيل كملف PDF
     */
    function downloadWeeklyAbsenceSummaryPdf() {
        const container = document.getElementById('weeklyAbsenceSummaryPreviewContainer');
        if (!container) return;

        if (typeof window.html2pdf === 'function') {
            const data = getWeeklyAbsenceSummaryData();
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `تقرير_الغياب_الأسبوعي_${data.startDate}_إلى_${data.endDate}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            window.html2pdf().set(opt).from(container).save();
        } else {
            // الرجوع إلى أمر الطباعة وتحديد حفظ بتنسيق PDF
            printWeeklyAbsenceSummaryOfficialDocument();
        }
    }
    window.downloadWeeklyAbsenceSummaryPdf = downloadWeeklyAbsenceSummaryPdf;

    // =========================================================================
    // قنوات الإرسال المباشرة (WhatsApp, Email, Copy Text)
    // =========================================================================

    /**
     * تجهيز نص المراسلة الرسمية المنسق
     */
    function generateWeeklyAdminMemoText(data) {
        const db = window.db || {};
        const profile = db.teacherProfile || db.profile || {};
        const teacherName = profile.name || 'أستاذ المادة';
        const schoolName = profile.school || profile.institution || 'المؤسسة';
        const subject = profile.subject || 'الرياضيات';

        let text = `📄 *تقرير الغياب الأسبوعي الآلي (رصد 7 أيام)*\n`;
        text += `🏛️ *المؤسسة:* ${schoolName}\n`;
        text += `👨‍🏫 *الأستاذ:* ${teacherName} (${subject})\n`;
        text += `📅 *الفترة:* من ${data.startDate} إلى ${data.endDate}\n`;
        text += `⚠️ *العتبة المعتمدة:* ≥ ${data.threshold} ساعات غياب\n`;
        text += `👥 *القسم:* ${data.classFilter === 'all' ? 'كافة الأقسام' : data.classFilter}\n`;
        text += `📊 *إجمالي الحالات المتجاوزة:* ${data.students.length} تلميذ\n`;
        text += `⏱️ *ساعات غياب الأسبوع:* ${data.atRiskAbsenceHours} ساعة\n`;
        text += `────────────────────\n`;

        if (data.students.length === 0) {
            text += `✅ *النتيجة:* لا توجد حالات تجاوزت عتبة الغياب المحددة خلال هذا الأسبوع.\n`;
        } else {
            text += `🚨 *لائحة التلاميذ المتجاوزين للعتبة:*\n\n`;
            data.students.forEach((s, idx) => {
                text += `${idx + 1}. *${s.name}* (${s.className})\n`;
                text += `   - مسار: ${s.massar}\n`;
                text += `   - غياب الأسبوع: ${s.weeklyTotalHours}س (${s.weeklyUnjustifiedHours}س غير مبرر)\n`;
                text += `   - الحصص: ${s.weeklySessions.map(sec => `${sec.dayName} ح${sec.session}`).join('، ')}\n`;
                text += `   - المجموع التراكمي: ${s.allTimeAbsenceHours}س\n`;
                text += `   - الإجراء المقترح: ${s.severity === 'critical' ? 'استدعاء فوري لولي الأمر' : 'تنبيه بالغياب واستفسار'}\n\n`;
            });
        }

        text += `────────────────────\n`;
        text += `📌 *المرجو من الحراسة العامة اتخاذ الإجراءات الإدارية وتأكيد الاستلام.*`;
        return text;
    }

    /**
     * إرسال التقرير عبر WhatsApp للحارس العام / الإدارة
     */
    function sendWeeklySummaryWhatsAppToAdmin() {
        const data = getWeeklyAbsenceSummaryData();
        const text = generateWeeklyAdminMemoText(data);
        const encoded = encodeURIComponent(text);
        const url = `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(url, '_blank');
    }
    window.sendWeeklySummaryWhatsAppToAdmin = sendWeeklySummaryWhatsAppToAdmin;

    /**
     * إرسال التقرير عبر البريد الإلكتروني (Gmail / Email) للإدارة
     */
    function sendWeeklySummaryEmailToAdmin() {
        const data = getWeeklyAbsenceSummaryData();
        const text = generateWeeklyAdminMemoText(data);
        const subject = `تقرير الغياب الأسبوعي (${data.startDate} إلى ${data.endDate}) - ${data.classFilter === 'all' ? 'كافة الأقسام' : data.classFilter}`;
        
        // محاولة الفتح المباشر عبر واجهة Gmail على الويب
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        const win = window.open(gmailUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        }
    }
    window.sendWeeklySummaryEmailToAdmin = sendWeeklySummaryEmailToAdmin;

    /**
     * نسخ نص التقرير الإداري للمنظومة
     */
    function copyWeeklySummaryAdminText() {
        const data = getWeeklyAbsenceSummaryData();
        const text = generateWeeklyAdminMemoText(data);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ تم نسخ نص التقرير الأسبوعي بنجاح إلى الحافظة!');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }
    window.copyWeeklySummaryAdminText = copyWeeklySummaryAdminText;

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('✅ تم نسخ نص التقرير الأسبوعي بنجاح!');
        } catch (e) {
            alert('يرجى نسخ النص يدوياً');
        }
        document.body.removeChild(ta);
    }

    /**
     * إشعار ولي الأمر بحالات غياب التلميذ في هذا الأسبوع عبر WhatsApp
     */
    function notifyParentWeeklyAbsence(studentId, className) {
        const db = window.db || {};
        const studentList = (db.classes && db.classes[className]) || [];
        const student = studentList.find(s => s.id === studentId);
        if (!student) return;

        const data = getWeeklyAbsenceSummaryData({ classFilter: className });
        const studentItem = data.students.find(s => s.id === studentId);
        if (!studentItem) return;

        const teacherName = (db.teacherProfile && db.teacherProfile.name) || (db.profile && db.profile.name) || 'أستاذ المادة';
        const sessionsStr = studentItem.weeklySessions.map(sec => `${sec.dayName} ${sec.date} (حصة ${sec.session})`).join('، ');

        let msg = `السلام عليكم ورحمة الله،\n`;
        msg += `نحيطكم علماً بأن ابنكم/ابنتكم التلميذ(ة) *${student.name}* (قسم: ${className}) قد راكم(ت) خلال الأسبوع المنصرم (${data.startDate} إلى ${data.endDate}) ما مجموعه *${studentItem.weeklyTotalHours} ساعات غياب*، وذلك في الحصص التالية:\n`;
        msg += `(${sessionsStr})\n\n`;
        msg += `نرجو منكم الحرص على انضباط التلميذ(ة) وتقديم مبرر الغياب لإدارة المؤسسة تفادياً لأي إجراء إداري قد يؤثر على مساره الدراسي.\n\n`;
        msg += `مع تحيات أستاذ المادة: ${teacherName}`;

        const phone = (student.phone || '').replace(/[^0-9]/g, '');
        const encoded = encodeURIComponent(msg);
        const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
        window.open(url, '_blank');
    }
    window.notifyParentWeeklyAbsence = notifyParentWeeklyAbsence;

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #1e293b; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-size: 0.88rem; font-weight: 700; z-index: 10050; box-shadow: 0 10px 25px rgba(0,0,0,0.25); border: 1px solid #3b82f6;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }

    // تصدير الدوال للنافذة العالمية
    window.renderWeeklyAbsenceSummaryCard = renderWeeklyAbsenceSummaryCard;
    window.getWeeklyAbsenceSummaryData = getWeeklyAbsenceSummaryData;

})(window);
