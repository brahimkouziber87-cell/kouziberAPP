/**
 * interactive-teaching.js
 * 
 * 1. addQuickSession(targetClass):
 *    نافذة سريعة ومختصرة لتدوين وإضافة حصة دراسية جديدة إلى دفتر النصوص (Cahier de Textes)
 *    مبنية على تاريخ اليوم والقسم المختار وحساب رقم الحصة والمدة تلقائياً.
 * 
 * 2. getAbsenceTrends(targetClass, targetMonth):
 *    دالة تحليلية تحسب نسبة الغياب الشهرية للقسم وتولد نصاً ملخصاً يحدد
 *    الأسبوع الذي سجل أعلى عدد غيابات لعرضه في لوحة القيادة (Dashboard).
 * 
 * 3. وضع التدريس التفاعلي (Interactive Teaching Mode):
 *    مؤقت حصة عائم يظهر الوقت المتبقي من الحصة وينبه صوتياً عبر نغمة موسيقية (Web Audio API)
 *    عند نهايتها، مع ربطه بجدول الحصص الأسبوعي للكشف التلقائي عن القسم والحصة الجارية.
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. ADD QUICK SESSION TO CAHIER DE TEXTES (إضافة حصة سريعة لدفتر النصوص)
    // =========================================================================

    /**
     * فتح نافذة إضافة حصة سريعة لدفتر النصوص بناءً على تاريخ اليوم والقسم المختار
     * @param {string} [targetClass] - اسم القسم اختياري، إن لم يُحدد يُؤخذ القسم المختار حالياً
     */
    window.addQuickSession = function (targetClass) {
        const modal = document.getElementById('quickSessionModal');
        if (!modal) return;

        const classSelect = document.getElementById('quickSessionClassSelect');
        const dateInput = document.getElementById('quickSessionDate');
        const numInput = document.getElementById('quickSessionNum');
        const timeSlotSelect = document.getElementById('quickSessionTimeSlot');
        const durationSelect = document.getElementById('quickSessionDuration');
        const typeSelect = document.getElementById('quickSessionType');
        const titleInput = document.getElementById('quickSessionTitle');
        const summaryInput = document.getElementById('quickSessionSummary');
        const homeworkInput = document.getElementById('quickSessionHomework');
        const notesInput = document.getElementById('quickSessionNotes');

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();

        // 1. ملء قائمة الأقسام
        if (classSelect) {
            let opts = '';
            classes.forEach(c => {
                opts += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
            });
            if (classes.length === 0) {
                opts = '<option value="">-- لا توجد أقسام مسجلة --</option>';
            }
            classSelect.innerHTML = opts;

            // تحديد القسم المستهدف
            if (targetClass && classes.includes(targetClass)) {
                classSelect.value = targetClass;
            } else if (window.currentClass && classes.includes(window.currentClass)) {
                classSelect.value = window.currentClass;
            } else {
                const logClassSelect = document.getElementById('lessonLogClassSelect');
                if (logClassSelect && logClassSelect.value && classes.includes(logClassSelect.value)) {
                    classSelect.value = logClassSelect.value;
                }
            }
        }

        const selectedClass = classSelect ? classSelect.value : '';

        // 2. تعبئة التاريخ تلقائياً بتاريخ اليوم
        const todayStr = (typeof window.formatLocalDate === 'function') 
            ? window.formatLocalDate() 
            : new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = todayStr;

        // 3. حساب رقم الحصة تلقائياً للقسم المختار
        if (numInput) {
            const classLogs = (db.lessonLogs && selectedClass && db.lessonLogs[selectedClass]) 
                ? db.lessonLogs[selectedClass] 
                : [];
            numInput.value = classLogs.length + 1;
        }

        // 4. ضبط المدخلات والتوقيت الافتراضي (الربط التلقائي بتوقيت الحصة الحالية إن وجد)
        const currentTimetableSession = window.detectCurrentTimetableSession ? window.detectCurrentTimetableSession() : null;
        if (currentTimetableSession && timeSlotSelect) {
            const slotStr = `${currentTimetableSession.startTime} - ${currentTimetableSession.endTime}`;
            timeSlotSelect.value = slotStr;
            if (durationSelect) durationSelect.value = String(currentTimetableSession.durationHours || 2);
        } else {
            if (timeSlotSelect && !timeSlotSelect.value) timeSlotSelect.value = '08:30 - 10:30';
            if (durationSelect && !durationSelect.value) durationSelect.value = '2';
        }

        if (typeSelect) typeSelect.value = 'cours';
        if (titleInput) titleInput.value = '';
        if (summaryInput) summaryInput.value = '';
        if (homeworkInput) homeworkInput.value = '';
        if (notesInput) notesInput.value = '';

        // استحضار آخر عنوان درس لهذا القسم كمقترح للمتابعة
        if (selectedClass && db.lessonLogs && db.lessonLogs[selectedClass] && db.lessonLogs[selectedClass].length > 0) {
            const lastLog = db.lessonLogs[selectedClass][db.lessonLogs[selectedClass].length - 1];
            const hintBox = document.getElementById('quickSessionLastLessonHint');
            if (hintBox && lastLog) {
                hintBox.innerHTML = `
                    <div style="font-size: 0.78rem; color: #475569; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span>📌 آخر حصة مسجلة (${lastLog.date}): <b>${escapeHtml(lastLog.number || lastLog.title || '')}</b></span>
                        <button type="button" onclick="document.getElementById('quickSessionTitle').value = '${escapeQuotes(lastLog.number || lastLog.title || '')} (تتمة)';" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 5px; padding: 2px 7px; font-size: 0.72rem; font-weight: bold; cursor: pointer;">
                            متابعة نفس الدرس
                        </button>
                    </div>
                `;
                hintBox.style.display = 'block';
            }
        } else {
            const hintBox = document.getElementById('quickSessionLastLessonHint');
            if (hintBox) hintBox.style.display = 'none';
        }

        modal.style.display = 'flex';
        setTimeout(() => {
            if (titleInput) titleInput.focus();
            if (window.renderLucide) window.renderLucide(modal);
        }, 60);
    };

    window.closeQuickSessionModal = function () {
        const modal = document.getElementById('quickSessionModal');
        if (modal) modal.style.display = 'none';
    };

    /**
     * تحديث رقم الحصة والمقترحات عند تغيير القسم في نافذة الحصة السريعة
     */
    window.onQuickSessionClassChange = function () {
        const classSelect = document.getElementById('quickSessionClassSelect');
        const numInput = document.getElementById('quickSessionNum');
        if (!classSelect) return;
        const cls = classSelect.value;
        const db = window.db || {};
        if (numInput && cls) {
            const logs = (db.lessonLogs && db.lessonLogs[cls]) ? db.lessonLogs[cls] : [];
            numInput.value = logs.length + 1;
        }
    };

    let _isSavingQuickSession = false;
    window.saveQuickSession = function () {
        if (_isSavingQuickSession) return;
        const classSelect = document.getElementById('quickSessionClassSelect');
        const dateInput = document.getElementById('quickSessionDate');
        const numInput = document.getElementById('quickSessionNum');
        const timeSlotSelect = document.getElementById('quickSessionTimeSlot');
        const durationSelect = document.getElementById('quickSessionDuration');
        const typeSelect = document.getElementById('quickSessionType');
        const titleInput = document.getElementById('quickSessionTitle');
        const summaryInput = document.getElementById('quickSessionSummary');
        const homeworkInput = document.getElementById('quickSessionHomework');
        const notesInput = document.getElementById('quickSessionNotes');

        const className = classSelect ? classSelect.value : '';
        const date = dateInput ? dateInput.value : '';
        const sessionNum = numInput ? numInput.value.trim() : '1';
        const timeSlot = timeSlotSelect ? timeSlotSelect.value : '08:30 - 10:30';
        const duration = durationSelect ? durationSelect.value : '2';
        const sessionType = typeSelect ? typeSelect.value : 'cours';
        const number = titleInput ? titleInput.value.trim() : '';
        const summary = summaryInput ? summaryInput.value.trim() : '';
        const homework = homeworkInput ? homeworkInput.value.trim() : '';
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!className) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى اختيار القسم أولاً.', 'warning');
            }
            return;
        }
        if (!date) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى تحديد تاريخ الحصة.', 'warning');
            }
            return;
        }
        if (!number && !summary) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى كتابة عنوان الدرس أو ملخص الأنشطة المنجزة.', 'warning');
            }
            if (titleInput) titleInput.focus();
            return;
        }

        _isSavingQuickSession = true;
        const unlock = () => { setTimeout(() => { _isSavingQuickSession = false; }, 450); };

        const db = window.db || {};
        if (!db.lessonLogs) db.lessonLogs = {};
        if (!db.lessonLogs[className]) db.lessonLogs[className] = [];

        // منع تكرار العمليات والحصص المتطابقة
        const cleanSlot = timeSlot.replace(/\s+/g, '');
        const isDuplicate = db.lessonLogs[className].some(l => 
            l && l.date === date && 
            (l.timeSlot || '').replace(/\s+/g, '') === cleanSlot &&
            ((l.number && l.number.trim().toLowerCase() === (number || '').trim().toLowerCase()) ||
             (l.summary && l.summary.trim().toLowerCase() === (summary || '').trim().toLowerCase()))
        );

        if (isDuplicate) {
            _isSavingQuickSession = false;
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('⚠️ تنبيه: توجد حصة مطابقة تماماً بنفس التاريخ والتوقيت والموضوع مسجلة مسبقاً (تم منع تكرار العملية).', 'warning');
            }
            return;
        }

        const newLog = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: date,
            sessionNum: sessionNum || String(db.lessonLogs[className].length + 1),
            timeSlot: timeSlot,
            duration: duration,
            sessionType: sessionType,
            number: number || 'درس مبرمج',
            title: number || '',
            axes: [number || 'المحور الرئيسي'],
            summary: summary || number,
            homework: homework,
            notes: notes,
            createdAt: new Date().toISOString()
        };

        db.lessonLogs[className].push(newLog);

        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث عرض دفتر النصوص إن كان مفتوحاً
        if (typeof window.renderLessonLogs === 'function') {
            const logClassSelect = document.getElementById('lessonLogClassSelect');
            if (logClassSelect) logClassSelect.value = className;
            window.renderLessonLogs();
        }

        window.closeQuickSessionModal();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`✅ تم توثيق الحصة رقم (${newLog.sessionNum}) بقسم [${className}] في دفتر النصوص بنجاح!`, 'success');
        }
        unlock();
    };

    // =========================================================================
    // 2. GET ABSENCE TRENDS (تحليل اتجاهات الغياب الشهري وتحديد الأسبوع الأشد غياباً)
    // =========================================================================

    /**
     * حساب نسبة الغياب الشهرية وتوليد نص ملخص يحدد الأسبوع الأعلى غياباً
     * @param {string} [targetClass] - القسم المختار
     * @param {string} [targetMonth] - الشهر بصيغة YYYY-MM
     * @returns {Object} كائن يحتوي على الإحصائيات، توزيع الأسابيع، الأسبوع الذروة، والنص التلخيصي
     */
    window.getAbsenceTrends = function (targetClass, targetMonth) {
        const db = window.db || {};
        
        // 1. تحديد القسم
        if (!targetClass) {
            targetClass = window.currentClass || 
                (document.getElementById('classSelect') ? document.getElementById('classSelect').value : '') || 
                (document.getElementById('dashAbsenceTrendsClassSelect') ? document.getElementById('dashAbsenceTrendsClassSelect').value : '') ||
                Object.keys(db.classes || {})[0] || '';
        }

        // 2. تحديد الشهر
        if (!targetMonth) {
            targetMonth = (document.getElementById('dashAbsenceTrendsMonthSelect') && document.getElementById('dashAbsenceTrendsMonthSelect').value) ||
                ((typeof window.formatLocalMonth === 'function') ? window.formatLocalMonth() : new Date().toISOString().slice(0, 7));
        }

        const enrolledStudents = (db.classes && db.classes[targetClass]) ? db.classes[targetClass] : [];
        const studentsCount = enrolledStudents.length;

        // استخراج سجلات القسم لهذا الشهر
        const records = (db.records || []).filter(r => 
            r.className === targetClass && 
            r.date && 
            r.date.startsWith(targetMonth)
        );

        // عدد الحصص المنعقدة خلال الشهر للقسم
        const sessionKeys = new Set();
        records.forEach(r => {
            sessionKeys.add(r.date + '_' + (r.session || ''));
        });
        const distinctSessionsCount = sessionKeys.size;

        // تقسيم الشهر إلى 5 أسابيع تقويمية
        const weeklyBreakdown = [
            { weekNum: 1, label: 'الأسبوع الأول', daysRange: '1 - 7', absences: 0, hours: 0 },
            { weekNum: 2, label: 'الأسبوع الثاني', daysRange: '8 - 14', absences: 0, hours: 0 },
            { weekNum: 3, label: 'الأسبوع الثالث', daysRange: '15 - 21', absences: 0, hours: 0 },
            { weekNum: 4, label: 'الأسبوع الرابع', daysRange: '22 - 28', absences: 0, hours: 0 },
            { weekNum: 5, label: 'الأسبوع الخامس', daysRange: '29 - 31', absences: 0, hours: 0 }
        ];

        let totalAbsences = 0;
        let totalAbsenceHours = 0;

        records.forEach(rec => {
            const isAbsent = (rec.status === 'غائب' || (rec.status && rec.status.includes('غائب')));
            if (isAbsent) {
                totalAbsences++;
                const hrs = parseFloat(rec.duration) || 2;
                totalAbsenceHours += hrs;

                const dayOfMonth = parseInt(rec.date.split('-')[2], 10) || 1;
                let targetWeekIdx = 0;
                if (dayOfMonth <= 7) targetWeekIdx = 0;
                else if (dayOfMonth <= 14) targetWeekIdx = 1;
                else if (dayOfMonth <= 21) targetWeekIdx = 2;
                else if (dayOfMonth <= 28) targetWeekIdx = 3;
                else targetWeekIdx = 4;

                weeklyBreakdown[targetWeekIdx].absences++;
                weeklyBreakdown[targetWeekIdx].hours += hrs;
            }
        });

        // حساب نسبة الغياب الشهرية
        // النسبة = (عدد حالات الغياب / (عدد التلاميذ * عدد الحصص المنعقدة)) * 100
        const totalExpectedPresences = studentsCount * Math.max(distinctSessionsCount, 1);
        let monthlyAbsenceRate = 0;
        if (totalExpectedPresences > 0 && totalAbsences > 0) {
            monthlyAbsenceRate = parseFloat(((totalAbsences / totalExpectedPresences) * 100).toFixed(1));
        }

        // تحديد الأسبوع الذي سجل أعلى عدد غيابات (Peak Week)
        let peakWeek = { weekNum: 0, label: 'لا توجد غيابات', daysRange: '', absences: 0, hours: 0 };
        weeklyBreakdown.forEach(w => {
            if (w.absences > peakWeek.absences) {
                peakWeek = { ...w };
            }
        });

        // صياغة النص التلخيصي التفاعلي للعرض في لوحة القيادة
        let summaryString = '';
        if (!targetClass) {
            summaryString = 'يرجى تسجيل وتحديد قسم لعرض اتجاهات الغياب الشهرية.';
        } else if (totalAbsences === 0) {
            summaryString = `سجل مواظبة مثالي لقسم [${targetClass}] خلال شهر ${targetMonth}: لم تُسجل أي حالة غياب حتى الآن (معدل الغياب: 0%).`;
        } else {
            summaryString = `معدل الغياب الشهري لقسم [${targetClass}] لشهر ${targetMonth} يبلغ ${monthlyAbsenceRate}% (بإجمالي ${totalAbsences} غياباً و${totalAbsenceHours} ساعة). الأسبوع الأكثر غياباً هو ${peakWeek.label} (${peakWeek.daysRange}) بمجموع ${peakWeek.absences} حالة غياب.`;
        }

        return {
            className: targetClass,
            month: targetMonth,
            studentsCount: studentsCount,
            distinctSessionsCount: distinctSessionsCount,
            totalAbsences: totalAbsences,
            totalAbsenceHours: totalAbsenceHours,
            monthlyAbsenceRate: monthlyAbsenceRate,
            weeklyBreakdown: weeklyBreakdown,
            peakWeek: peakWeek,
            summaryString: summaryString
        };
    };

    /**
     * ويدجت لوحة القيادة التفاعلي لعرض اتجاهات الغياب الشهرية والأسبوع الذروة
     */
    window.renderDashboardAbsenceTrends = function () {
        const container = document.getElementById('dashAbsenceTrendsCardContainer');
        if (!container) return;

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();
        if (classes.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';

        const currentMonth = (typeof window.formatLocalMonth === 'function') 
            ? window.formatLocalMonth() 
            : new Date().toISOString().slice(0, 7);

        const activeClassSelect = document.getElementById('dashAbsenceTrendsClassSelect');
        const selectedClass = (activeClassSelect && activeClassSelect.value) ? activeClassSelect.value : classes[0];

        const activeMonthInput = document.getElementById('dashAbsenceTrendsMonthSelect');
        const selectedMonth = (activeMonthInput && activeMonthInput.value) ? activeMonthInput.value : currentMonth;

        const trends = window.getAbsenceTrends(selectedClass, selectedMonth);

        // إيجاد أقصى قيمة غياب في الأسابيع لحساب نسب أشرطة التقدم
        const maxWeeklyAbsences = Math.max(...trends.weeklyBreakdown.map(w => w.absences), 1);

        const html = `
            <div class="card dash-widget-card" style="border-top: 4px solid #ea580c; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); padding: 18px 20px; background: #ffffff;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #fff7ed; color: #ea580c; width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #fed7aa; box-shadow: 0 2px 5px rgba(234, 88, 12, 0.15);">
                            <span data-lucide="trending-up" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.08rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                تحليل اتجاهات الغياب الشهري والأسبوع الذروة
                            </h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">
                                رصد إحصائي لتوزيع الغيابات عبر أسابيع الشهر ومعدل المواظبة الصفي
                            </p>
                        </div>
                    </div>

                    <!-- Filter Controls -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <label style="font-size: 0.76rem; font-weight: 700; color: #475569;">القسم:</label>
                            <select id="dashAbsenceTrendsClassSelect" onchange="renderDashboardAbsenceTrends()" style="padding: 5px 10px; border-radius: 7px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 0.8rem; background: #f8fafc; color: #0f172a;">
                                ${classes.map(c => `<option value="${escapeHtml(c)}" ${c === selectedClass ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <label style="font-size: 0.76rem; font-weight: 700; color: #475569;">الشهر:</label>
                            <input type="month" id="dashAbsenceTrendsMonthSelect" value="${selectedMonth}" onchange="renderDashboardAbsenceTrends()" style="padding: 4px 8px; border-radius: 7px; border: 1px solid #cbd5e1; font-size: 0.78rem; font-weight: bold; background: #f8fafc; color: #0f172a; cursor: pointer;">
                        </div>
                    </div>
                </div>

                <!-- Summary Banner -->
                <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border: 1.5px solid #fed7aa; border-right: 5px solid #ea580c; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; box-shadow: 0 2px 6px rgba(234,88,12,0.06);">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span style="color: #ea580c; font-size: 1.25rem; line-height: 1;">📊</span>
                        <div style="flex: 1;">
                            <div style="font-size: 0.86rem; font-weight: 800; color: #9a3412; line-height: 1.5;">
                                ${trends.summaryString}
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap;">
                                <span style="background: #ffffff; color: #c2410c; border: 1px solid #fdba74; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                                    معدل الغياب: ${trends.monthlyAbsenceRate}%
                                </span>
                                <span style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                                    عدد التلاميذ: ${trends.studentsCount}
                                </span>
                                <span style="background: #ffffff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.74rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                                    الحصص المنعقدة: ${trends.distinctSessionsCount}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Weekly Breakdown Graph & Progress Bars -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
                    ${trends.weeklyBreakdown.map(w => {
                        const isPeak = (trends.totalAbsences > 0 && w.absences === trends.peakWeek.absences && w.absences > 0);
                        const percent = trends.totalAbsences > 0 ? Math.round((w.absences / trends.totalAbsences) * 100) : 0;
                        const barFillPercent = Math.round((w.absences / maxWeeklyAbsences) * 100);

                        return `
                            <div style="background: ${isPeak ? '#fff7ed' : '#f8fafc'}; border: 1.5px solid ${isPeak ? '#fdba74' : '#e2e8f0'}; border-radius: 10px; padding: 10px 12px; position: relative;">
                                ${isPeak ? '<span style="position: absolute; top: -8px; left: 8px; background: #ea580c; color: #fff; font-size: 0.65rem; font-weight: 900; padding: 1px 6px; border-radius: 4px;">⚡ الذروة</span>' : ''}
                                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                    <span style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">${w.label}</span>
                                    <span style="font-size: 0.72rem; color: #64748b;">(${w.daysRange})</span>
                                </div>
                                <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px;">
                                    <span style="font-size: 1.25rem; font-weight: 900; color: ${isPeak ? '#c2410c' : '#334155'};">${w.absences}</span>
                                    <span style="font-size: 0.72rem; color: #64748b;">غياب (${w.hours} س)</span>
                                </div>
                                <div style="background: #e2e8f0; height: 6px; border-radius: 999px; overflow: hidden;">
                                    <div style="background: ${isPeak ? 'linear-gradient(90deg, #f97316, #ea580c)' : '#94a3b8'}; width: ${barFillPercent}%; height: 100%; border-radius: 999px; transition: width 0.3s;"></div>
                                </div>
                                <div style="font-size: 0.7rem; color: #64748b; margin-top: 4px; text-align: left;">
                                    ${percent}% من غيابات الشهر
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;
        if (window.renderLucide) window.renderLucide(container);
    };

    // =========================================================================
    // 3. INTERACTIVE TEACHING MODE (وضع التدريس التفاعلي ومؤقت الحصة العائم)
    // =========================================================================

    const teachingState = {
        isActive: false,
        isPaused: false,
        isMinimized: false,
        className: '',
        room: '',
        slotLabel: '',
        totalSeconds: 2 * 3600, // افتراضياً ساعتان
        remainingSeconds: 2 * 3600,
        intervalId: null,
        soundEnabled: true,
        sessionTopic: ''
    };

    /**
     * فحص واكتشاف الحصة الجارية حالياً في جدول الحصص الأسبوعي
     * @returns {Object|null} بيانات الحصة الجارية
     */
    window.detectCurrentTimetableSession = function () {
        const db = window.db || {};
        if (!db.timetable) return null;

        const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const todayDay = dayNames[new Date().getDay()];
        const dayData = db.timetable[todayDay];
        if (!dayData) return null;

        const now = new Date();
        const curMinutes = now.getHours() * 60 + now.getMinutes();

        const slots = [
            { key: 'm1', label: 'الحصة الصباحية 1', timeProp: 'm1_time', oldTimeProp: 'morningTime1', hrsProp: 'm1_hrs', oldHrsProp: 'morningHours1', classProp: 'm1_class', oldClassProp: 'morningClass1', defTime: '08:30', defHrs: 2 },
            { key: 'm2', label: 'الحصة الصباحية 2', timeProp: 'm2_time', oldTimeProp: 'morningTime2', hrsProp: 'm2_hrs', oldHrsProp: 'morningHours2', classProp: 'm2_class', oldClassProp: 'morningClass2', defTime: '10:30', defHrs: 2 },
            { key: 'm3', label: 'الحصة الصباحية 3', timeProp: 'm3_time', hrsProp: 'm3_hrs', classProp: 'm3_class', defTime: '12:30', defHrs: 1 },
            { key: 'e1', label: 'الحصة المسائية 1', timeProp: 'e1_time', oldTimeProp: 'eveningTime1', hrsProp: 'e1_hrs', oldHrsProp: 'eveningHours1', classProp: 'e1_class', oldClassProp: 'eveningClass1', defTime: '14:30', defHrs: 2 },
            { key: 'e2', label: 'الحصة المسائية 2', timeProp: 'e2_time', oldTimeProp: 'eveningTime2', hrsProp: 'e2_hrs', oldHrsProp: 'eveningHours2', classProp: 'e2_class', oldClassProp: 'eveningClass2', defTime: '16:30', defHrs: 2 },
            { key: 'e3', label: 'الحصة المسائية 3', timeProp: 'e3_time', hrsProp: 'e3_hrs', classProp: 'e3_class', defTime: '18:30', defHrs: 1 }
        ];

        for (const s of slots) {
            const className = dayData[s.classProp] || (s.oldClassProp ? dayData[s.oldClassProp] : '') || '';
            if (!className || className.trim() === '') continue;

            const startTimeStr = dayData[s.timeProp] || (s.oldTimeProp ? dayData[s.oldTimeProp] : '') || s.defTime;
            const durationHrs = parseFloat(dayData[s.hrsProp] || (s.oldHrsProp ? dayData[s.oldHrsProp] : '') || s.defHrs) || 2;

            const [sh, sm] = startTimeStr.split(':').map(Number);
            const startM = (sh || 0) * 60 + (sm || 0);
            const endM = startM + Math.round(durationHrs * 60);

            const endH = Math.floor(endM / 60);
            const endMin = endM % 60;
            const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

            // إذا كان التوقيت الحالي يقع داخل فترة هذه الحصة
            if (curMinutes >= startM && curMinutes < endM) {
                const remainingMinutes = endM - curMinutes;
                return {
                    day: todayDay,
                    slotKey: s.key,
                    slotLabel: s.label,
                    className: className,
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    durationHours: durationHrs,
                    remainingSeconds: remainingMinutes * 60,
                    totalSeconds: Math.round(durationHrs * 3600)
                };
            }
        }

        return null;
    };

    /**
     * تشغيل نغمة تنبيه صوتية باستخدام Web Audio API عند انتهاء وقت الحصة
     */
    window.playTeachingSessionChime = function () {
        if (!teachingState.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            // نغمات جرس المدرسة الثلاثي (Harmonic School Chime)
            // C5 (523.25 Hz) -> E5 (659.25 Hz) -> G5 (783.99 Hz) -> C6 (1046.50 Hz)
            const notes = [
                { f: 523.25, time: 0.0, dur: 0.35 },
                { f: 659.25, time: 0.3, dur: 0.35 },
                { f: 783.99, time: 0.6, dur: 0.40 },
                { f: 1046.50, time: 0.95, dur: 0.85 }
            ];

            notes.forEach(n => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.time);

                gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
                gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + n.time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.time + n.dur);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + n.time);
                osc.stop(ctx.currentTime + n.time + n.dur);
            });
        } catch (e) {
            console.warn('Audio chime playback blocked or not supported:', e);
        }
    };

    /**
     * تبديل وتفعيل وضع التدريس التفاعلي
     */
    window.toggleInteractiveTeachingMode = function () {
        if (typeof window.recordRecentAccess === 'function') {
            window.recordRecentAccess('teachingMode');
        }
        if (teachingState.isActive) {
            window.stopInteractiveTeachingMode();
        } else {
            window.startInteractiveTeachingMode();
        }
    };

    /**
     * بدء وضع التدريس التفاعلي والمؤقت
     */
    window.startInteractiveTeachingMode = function (forcedClass, forcedDurationHours) {
        teachingState.isActive = true;
        teachingState.isPaused = false;
        teachingState.isMinimized = false;

        // فحص جدول الحصص
        const detected = window.detectCurrentTimetableSession();

        const db = window.db || {};
        const availableClasses = Object.keys(db.classes || {}).sort();

        if (forcedClass) {
            teachingState.className = forcedClass;
            const dur = forcedDurationHours || 2;
            teachingState.totalSeconds = Math.round(dur * 3600);
            teachingState.remainingSeconds = teachingState.totalSeconds;
            teachingState.slotLabel = `حصة مخصصة (${dur} س)`;
        } else if (detected) {
            teachingState.className = detected.className;
            teachingState.totalSeconds = detected.totalSeconds;
            teachingState.remainingSeconds = detected.remainingSeconds;
            teachingState.slotLabel = `${detected.day} • ${detected.startTime} - ${detected.endTime}`;
        } else {
            teachingState.className = window.currentClass || availableClasses[0] || 'حصة عامة';
            teachingState.totalSeconds = 2 * 3600;
            teachingState.remainingSeconds = 2 * 3600;
            teachingState.slotLabel = 'حصة افتراضية (ساعتان)';
        }

        // جلب آخر موضوع درس لهذا القسم
        if (teachingState.className && db.lessonLogs && db.lessonLogs[teachingState.className]) {
            const logs = db.lessonLogs[teachingState.className];
            if (logs.length > 0) {
                teachingState.sessionTopic = logs[logs.length - 1].number || logs[logs.length - 1].title || '';
            }
        }

        // إنشاء أو إظهار العنصر العائم
        ensureFloatingTimerDom();
        updateFloatingTimerDisplay();

        if (teachingState.intervalId) clearInterval(teachingState.intervalId);
        teachingState.intervalId = setInterval(onTeachingTimerTick, 1000);

        // تحديث زر الهيدر
        const btn = document.getElementById('headerTeachingModeBtn');
        const badge = document.getElementById('headerTeachingModeBadge');
        if (btn) {
            btn.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)';
            btn.style.borderColor = '#a78bfa';
            btn.style.color = '#ffffff';
        }
        if (badge) badge.style.display = 'inline-block';

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`⏱️ تم تفعيل وضع التدريس التفاعلي لقسم [${teachingState.className}]!`, 'success');
        }
    };

    /**
     * إيقاف وإنهاء وضع التدريس التفاعلي
     */
    window.stopInteractiveTeachingMode = function () {
        teachingState.isActive = false;
        if (teachingState.intervalId) {
            clearInterval(teachingState.intervalId);
            teachingState.intervalId = null;
        }

        const widget = document.getElementById('floatingTeachingTimerWidget');
        if (widget) widget.style.display = 'none';

        const btn = document.getElementById('headerTeachingModeBtn');
        const badge = document.getElementById('headerTeachingModeBadge');
        if (btn) {
            btn.style.background = 'rgba(139, 92, 246, 0.15)';
            btn.style.borderColor = '#8b5cf6';
            btn.style.color = '#ddd6fe';
        }
        if (badge) badge.style.display = 'none';
    };

    function onTeachingTimerTick() {
        if (!teachingState.isActive || teachingState.isPaused) return;

        if (teachingState.remainingSeconds > 0) {
            teachingState.remainingSeconds--;
            updateFloatingTimerDisplay();

            // عندما ينتهي الوقت القانوني للحصة
            if (teachingState.remainingSeconds === 0) {
                window.playTeachingSessionChime();

                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`⏰ انتهى وقت الحصة القانوني لقسم [${teachingState.className}]! اضغط لتوثيق الحصة في دفتر النصوص.`, 'warning');
                }
            }
        }
    }

    window.toggleTeachingTimerPause = function () {
        teachingState.isPaused = !teachingState.isPaused;
        updateFloatingTimerDisplay();
    };

    window.extendTeachingTimer = function (extraMinutes = 5) {
        teachingState.remainingSeconds += extraMinutes * 60;
        teachingState.totalSeconds += extraMinutes * 60;
        updateFloatingTimerDisplay();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`➕ تمت إضافة ${extraMinutes} دقائق إضافية للحصة`, 'info');
        }
    };

    window.toggleTeachingSound = function () {
        teachingState.soundEnabled = !teachingState.soundEnabled;
        if (teachingState.soundEnabled) {
            window.playTeachingSessionChime();
        }
        updateFloatingTimerDisplay();
    };

    window.toggleTeachingTimerMinimize = function () {
        teachingState.isMinimized = !teachingState.isMinimized;
        updateFloatingTimerDisplay();
    };

    window.setTeachingSessionClass = function (newClass) {
        if (!newClass) return;
        teachingState.className = newClass;
        const db = window.db || {};
        if (db.lessonLogs && db.lessonLogs[newClass] && db.lessonLogs[newClass].length > 0) {
            const logs = db.lessonLogs[newClass];
            teachingState.sessionTopic = logs[logs.length - 1].number || logs[logs.length - 1].title || '';
        } else {
            teachingState.sessionTopic = '';
        }
        updateFloatingTimerDisplay();
    };

    function formatTime(totalSec) {
        const sec = Math.max(0, totalSec);
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function updateFloatingTimerDisplay() {
        const widget = document.getElementById('floatingTeachingTimerWidget');
        if (!widget) return;

        widget.style.display = 'block';

        const timeStr = formatTime(teachingState.remainingSeconds);
        const percent = teachingState.totalSeconds > 0 
            ? Math.min(100, Math.max(0, Math.round(((teachingState.totalSeconds - teachingState.remainingSeconds) / teachingState.totalSeconds) * 100))) 
            : 0;

        const isTimeUp = teachingState.remainingSeconds <= 0;

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();

        if (teachingState.isMinimized) {
            widget.className = 'floating-teaching-timer-minimized';
            widget.innerHTML = `
                <div onclick="toggleTeachingTimerMinimize()" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px 14px; background: rgba(15, 23, 42, 0.95); border: 2px solid ${isTimeUp ? '#ef4444' : '#8b5cf6'}; border-radius: 30px; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-weight: 800; font-family: monospace, sans-serif;">
                    <span style="font-size: 1.1rem;">${isTimeUp ? '⏰' : (teachingState.isPaused ? '⏸️' : '⏱️')}</span>
                    <span style="color: ${isTimeUp ? '#f87171' : '#38bdf8'}; font-size: 0.95rem;">${timeStr}</span>
                    <span style="font-size: 0.75rem; background: #334155; padding: 2px 6px; border-radius: 4px; font-family: 'Cairo', sans-serif;">${escapeHtml(teachingState.className)}</span>
                </div>
            `;
            return;
        }

        widget.className = 'floating-teaching-timer-expanded';
        widget.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.97); backdrop-filter: blur(12px); border: 2px solid ${isTimeUp ? '#ef4444' : '#8b5cf6'}; border-radius: 16px; width: 330px; padding: 16px; box-shadow: 0 20px 30px -5px rgba(0,0,0,0.5); color: #f8fafc; font-family: 'Cairo', sans-serif;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 8px; cursor: move;" id="teachingTimerDragHandle">
                    <div style="display: flex; align-items: center; gap: 7px;">
                        <span style="color: #a78bfa; font-size: 1.2rem;">⏱️</span>
                        <div>
                            <div style="font-weight: 900; font-size: 0.88rem; color: #f1f5f9; display: flex; align-items: center; gap: 6px;">
                                <span>وضع التدريس التفاعلي</span>
                                <span style="background: #7c3aed; color: #fff; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px;">مباشر</span>
                            </div>
                            <div style="font-size: 0.72rem; color: #94a3b8;">${escapeHtml(teachingState.slotLabel)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button type="button" onclick="toggleTeachingTimerMinimize()" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;" title="تصغير المؤقت">
                            🗕
                        </button>
                        <button type="button" onclick="stopInteractiveTeachingMode()" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 4px; font-weight: bold;" title="إغلاق وضع التدريس التفاعلي">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Active Class Selector Banner -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; border-radius: 8px; padding: 6px 10px; margin-bottom: 12px; font-size: 0.82rem; gap: 6px;">
                    <span style="color: #cbd5e1; white-space: nowrap;">القسم:</span>
                    <select onchange="window.setTeachingSessionClass(this.value)" style="flex: 1; background: #0f172a; color: #38bdf8; border: 1px solid #475569; padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; font-family: inherit;">
                        ${classes.map(c => `<option value="${escapeHtml(c)}" ${c === teachingState.className ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                    </select>
                </div>

                <!-- Countdown Digital Display -->
                <div style="text-align: center; margin-bottom: 12px; background: ${isTimeUp ? 'rgba(239, 68, 68, 0.18)' : 'rgba(30, 41, 59, 0.5)'}; border: 1.5px solid ${isTimeUp ? '#ef4444' : '#334155'}; border-radius: 12px; padding: 10px 0;">
                    <div style="font-size: 0.74rem; color: ${isTimeUp ? '#f87171' : '#94a3b8'}; font-weight: 700; margin-bottom: 2px;">
                        ${isTimeUp ? '⏰ انتهى وقت الحصة القانوني' : (teachingState.isPaused ? 'المؤقت متوقف مؤقتاً' : 'الوقت المتبقي من الحصة')}
                    </div>
                    <div style="font-size: 2.5rem; font-weight: 900; font-family: monospace, sans-serif; letter-spacing: 2px; color: ${isTimeUp ? '#ef4444' : (teachingState.remainingSeconds < 300 ? '#f59e0b' : '#38bdf8')}; line-height: 1;">
                        ${timeStr}
                    </div>

                    <!-- Progress bar -->
                    <div style="width: 85%; margin: 10px auto 0 auto; background: #334155; height: 6px; border-radius: 999px; overflow: hidden;">
                        <div style="background: ${isTimeUp ? '#ef4444' : 'linear-gradient(90deg, #8b5cf6, #38bdf8)'}; width: ${percent}%; height: 100%; border-radius: 999px; transition: width 0.5s;"></div>
                    </div>
                </div>

                <!-- Time Up Action Prompt -->
                ${isTimeUp ? `
                    <div style="background: rgba(220, 38, 38, 0.2); border: 1px solid #ef4444; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; text-align: center; font-size: 0.78rem; color: #fecaca; font-weight: bold;">
                        🔔 رن جرس نهاية الحصة! هل ترغب في توثيق ما تم إنجازه؟
                    </div>
                ` : ''}

                <!-- Lesson Topic Quick Hint -->
                ${teachingState.sessionTopic ? `
                    <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 10px; background: #1e293b; padding: 6px 10px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        📖 موضوع الدرس: <b>${escapeHtml(teachingState.sessionTopic)}</b>
                    </div>
                ` : ''}

                <!-- Action Toolbar -->
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center; margin-bottom: 8px;">
                    <button type="button" onclick="toggleTeachingTimerPause()" style="flex: 1; background: ${teachingState.isPaused ? '#10b981' : '#475569'}; color: #fff; border: none; padding: 8px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
                        <span>${teachingState.isPaused ? '▶️ استئناف' : '⏸️ إيقاف مؤقت'}</span>
                    </button>
                    <button type="button" onclick="extendTeachingTimer(5)" style="background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 8px 10px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer;" title="إضافة 5 دقائق للحصة">
                        +5 د
                    </button>
                    <button type="button" onclick="toggleTeachingSound()" style="background: #334155; color: ${teachingState.soundEnabled ? '#fbbf24' : '#94a3b8'}; border: 1px solid #475569; padding: 8px 10px; border-radius: 8px; font-size: 0.85rem; cursor: pointer;" title="تفعيل/تعطيل الصوت">
                        ${teachingState.soundEnabled ? '🔔' : '🔕'}
                    </button>
                </div>

                <!-- Finish Session & Document in Cahier de Textes -->
                <button type="button" onclick="finishTeachingSession()" style="width: 100%; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; padding: 9px; border-radius: 8px; font-weight: 800; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                    <span>✍️ إنهاء وتوثيق في دفتر النصوص ⚡</span>
                </button>
            </div>
        `;

        setupTimerDrag();
    }

    function setupTimerDrag() {
        const handle = document.getElementById('teachingTimerDragHandle');
        const widget = document.getElementById('floatingTeachingTimerWidget');
        if (!handle || !widget || handle._dragAttached) return;
        handle._dragAttached = true;

        let isDragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = widget.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            widget.style.left = `${Math.max(10, Math.min(window.innerWidth - 340, startLeft + dx))}px`;
            widget.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, startTop + dy))}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
    }

    window.promptChangeTeachingClass = function () {
        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();
        if (classes.length === 0) return;
        const currentIdx = classes.indexOf(teachingState.className);
        const nextIdx = (currentIdx + 1) % classes.length;
        window.setTeachingSessionClass(classes[nextIdx]);
    };

    window.finishTeachingSession = function () {
        const cls = teachingState.className;
        window.stopInteractiveTeachingMode();
        window.addQuickSession(cls);
    };

    function ensureFloatingTimerDom() {
        let el = document.getElementById('floatingTeachingTimerWidget');
        if (!el) {
            el = document.createElement('div');
            el.id = 'floatingTeachingTimerWidget';
            el.style.position = 'fixed';
            el.style.top = '78px';
            el.style.left = '20px';
            el.style.zIndex = '10050';
            el.style.direction = 'rtl';
            document.body.appendChild(el);
        }
    }

    // =========================================================================
    // 4. EXTRA & REMEDIAL SUPPORT SESSIONS (حصص الدعم والاستدراك الاستثنائية خارج الجدول)
    // =========================================================================

    /**
     * فتح نافذة تسجيل حصة دعم إضافية أو استدراكية خارج الجدول الزمني الرسمي
     * @param {string} [targetClass] - القسم المختار
     * @param {Object} [prefillData] - بيانات مسبقة للملء الآلي (مثل خطط الدعم)
     */
    window.openExtraSupportSessionModal = function (targetClass, prefillData = {}) {
        const modal = document.getElementById('extraSupportSessionModal');
        if (!modal) return;

        const classSelect = document.getElementById('extraSessionClassSelect');
        const dateInput = document.getElementById('extraSessionDate');
        const numInput = document.getElementById('extraSessionNum');
        const typeSelect = document.getElementById('extraSessionType');
        const reasonInput = document.getElementById('extraSessionReason');
        const slotSelect = document.getElementById('extraSessionTimeSlot');
        const customTimeInput = document.getElementById('extraSessionCustomTime');
        const durationSelect = document.getElementById('extraSessionDuration');
        const benSelect = document.getElementById('extraSessionBeneficiaries');
        const titleInput = document.getElementById('extraSessionTitle');
        const summaryInput = document.getElementById('extraSessionSummary');
        const homeworkInput = document.getElementById('extraSessionHomework');
        const notesInput = document.getElementById('extraSessionNotes');
        const syncCheck = document.getElementById('extraSessionSyncCalendar');

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();

        // 1. ملء قائمة الأقسام
        if (classSelect) {
            let opts = '';
            classes.forEach(c => {
                opts += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
            });
            if (classes.length === 0) {
                opts = '<option value="">-- لا توجد أقسام مسجلة --</option>';
            }
            classSelect.innerHTML = opts;

            if (targetClass && classes.includes(targetClass)) {
                classSelect.value = targetClass;
            } else if (window.currentClass && classes.includes(window.currentClass)) {
                classSelect.value = window.currentClass;
            } else {
                const logSelect = document.getElementById('lessonLogClassSelect');
                if (logSelect && logSelect.value && classes.includes(logSelect.value)) {
                    classSelect.value = logSelect.value;
                }
            }
        }

        const selectedClass = classSelect ? classSelect.value : '';

        // 2. تعبئة التاريخ تلقائياً بتاريخ اليوم
        const todayStr = (typeof window.formatLocalDate === 'function') 
            ? window.formatLocalDate() 
            : new Date().toISOString().split('T')[0];
        if (dateInput) dateInput.value = prefillData.date || todayStr;

        // 3. اقتراح ترقيم الحصة الاستدراكية
        if (numInput) {
            const classLogs = (db.lessonLogs && selectedClass && db.lessonLogs[selectedClass]) 
                ? db.lessonLogs[selectedClass] 
                : [];
            numInput.value = `${classLogs.length + 1} (استدراك)`;
        }

        // 4. تعبئة الحقول والقيم الافتراضية
        if (typeSelect) typeSelect.value = prefillData.type || 'soutien';
        if (reasonInput) reasonInput.value = prefillData.reason || 'معالجة التعثرات والأخطاء المرصودة في الفرض المحروس';
        if (slotSelect) slotSelect.value = prefillData.timeSlot || 'السبت: 14:30 - 16:30';
        if (customTimeInput) {
            customTimeInput.style.display = 'none';
            customTimeInput.value = '';
        }
        if (durationSelect) durationSelect.value = prefillData.duration || '2';
        if (benSelect) benSelect.value = prefillData.beneficiaries || 'كامل تلميذات وتلاميذ القسم';
        if (titleInput) titleInput.value = prefillData.title || '';
        if (summaryInput) summaryInput.value = prefillData.summary || '';
        if (homeworkInput) homeworkInput.value = prefillData.homework || '';
        if (notesInput) notesInput.value = prefillData.notes || 'حصة استدراكية مبرمجة خارج استعمال الزمن الرسمي';
        if (syncCheck) syncCheck.checked = true;

        modal.style.display = 'flex';
        setTimeout(() => {
            if (titleInput && !titleInput.value) titleInput.focus();
            if (window.renderLucide) window.renderLucide(modal);
        }, 60);
    };

    window.closeExtraSupportSessionModal = function () {
        const modal = document.getElementById('extraSupportSessionModal');
        if (modal) modal.style.display = 'none';
    };

    window.onExtraSessionClassChanged = function () {
        const classSelect = document.getElementById('extraSessionClassSelect');
        const numInput = document.getElementById('extraSessionNum');
        if (!classSelect || !numInput) return;
        const cls = classSelect.value;
        const db = window.db || {};
        const logs = (db.lessonLogs && db.lessonLogs[cls]) ? db.lessonLogs[cls] : [];
        numInput.value = `${logs.length + 1} (استدراك)`;
    };

    window.onExtraSessionTimeSlotChanged = function () {
        const slotSelect = document.getElementById('extraSessionTimeSlot');
        const customInput = document.getElementById('extraSessionCustomTime');
        if (!slotSelect || !customInput) return;
        if (slotSelect.value === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
        } else {
            customInput.style.display = 'none';
        }
    };

    window.insertRemedialTemplateInExtraSession = function () {
        const summaryInput = document.getElementById('extraSessionSummary');
        if (!summaryInput) return;

        const template = `• سياق الاستدراك: معالجة الصعوبات والمفاهيم المتعثرة التي تم رصدها في التقييمات السابقة.
• الأنشطة والمعالجات المنجزة:
  - التذكير بالقواعد الأساسية والمبرهنات الرياضية المستهدفة وتبسيط البراهين.
  - إنجاز تمارين تطبيقية موجهة فردياً وجماعياً على السبورة مع تحليل الأخطاء الشائعة.
  - وضعيات تقويمية تفاعلية للتحقق من تمكن المتعلمين وتثبيت المكتسبات.
• الملاحظات والنتائج: تحسن ملحوظ في التحكم بالحساب الرياضي وتجاوز التعثرات الأولية.`;

        if (summaryInput.value && summaryInput.value.trim() !== '') {
            summaryInput.value += '\n\n' + template;
        } else {
            summaryInput.value = template;
        }
        summaryInput.focus();
    };

    let _isSavingExtraSession = false;
    window.saveExtraSupportSession = function () {
        if (_isSavingExtraSession) return;

        const classSelect = document.getElementById('extraSessionClassSelect');
        const dateInput = document.getElementById('extraSessionDate');
        const numInput = document.getElementById('extraSessionNum');
        const typeSelect = document.getElementById('extraSessionType');
        const reasonInput = document.getElementById('extraSessionReason');
        const slotSelect = document.getElementById('extraSessionTimeSlot');
        const customTimeInput = document.getElementById('extraSessionCustomTime');
        const durationSelect = document.getElementById('extraSessionDuration');
        const benSelect = document.getElementById('extraSessionBeneficiaries');
        const titleInput = document.getElementById('extraSessionTitle');
        const summaryInput = document.getElementById('extraSessionSummary');
        const homeworkInput = document.getElementById('extraSessionHomework');
        const notesInput = document.getElementById('extraSessionNotes');
        const syncCheck = document.getElementById('extraSessionSyncCalendar');

        const className = classSelect ? classSelect.value : '';
        const date = dateInput ? dateInput.value : '';
        const sessionNum = numInput ? numInput.value.trim() : '';
        const sessionType = typeSelect ? typeSelect.value : 'soutien';
        const reason = reasonInput ? reasonInput.value.trim() : '';
        let timeSlot = slotSelect ? slotSelect.value : 'السبت: 14:30 - 16:30';
        if (timeSlot === 'custom') {
            timeSlot = (customTimeInput && customTimeInput.value.trim()) ? customTimeInput.value.trim() : 'توقيت استثنائي مخصص';
        }
        const duration = durationSelect ? durationSelect.value : '2';
        const beneficiaries = benSelect ? benSelect.value : 'كامل تلميذات وتلاميذ القسم';
        const title = titleInput ? titleInput.value.trim() : '';
        const summary = summaryInput ? summaryInput.value.trim() : '';
        const homework = homeworkInput ? homeworkInput.value.trim() : '';
        const notes = notesInput ? notesInput.value.trim() : '';
        const syncCalendar = syncCheck ? syncCheck.checked : true;

        if (!className) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى اختيار القسم أولاً.', 'warning');
            }
            return;
        }
        if (!date) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى تحديد تاريخ الحصة الاستدراكية.', 'warning');
            }
            return;
        }
        if (!title && !summary) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى كتابة عنوان المفهوم أو ملخص الأنشطة المنجزة في حصة الاستدراك.', 'warning');
            }
            if (titleInput) titleInput.focus();
            return;
        }

        _isSavingExtraSession = true;
        const saveBtn = document.getElementById('btnSaveExtraSupportSession');
        let originalBtnHtml = '';
        if (saveBtn) {
            originalBtnHtml = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.innerHTML = '<span class="ui-icon animate-spin">⏳</span> <span>جاري الحفظ والتوثيق بالدفتر...</span>';
        }

        const unlock = () => {
            setTimeout(() => {
                _isSavingExtraSession = false;
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                    saveBtn.innerHTML = originalBtnHtml || '<span data-lucide="sparkles" data-size="16"></span> <span>حفظ وتوثيق كحصة استدراكية بالدفتر 💡</span>';
                    if (window.renderLucide) window.renderLucide(saveBtn);
                }
            }, 450);
        };

        const db = window.db || {};
        if (!db.lessonLogs) db.lessonLogs = {};
        if (!db.lessonLogs[className]) db.lessonLogs[className] = [];

        const defaultNum = `${db.lessonLogs[className].length + 1} (استدراك)`;

        const newLog = {
            id: 'log_remedial_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: date,
            sessionNum: sessionNum || defaultNum,
            timeSlot: timeSlot,
            duration: duration,
            sessionType: sessionType,
            isExtraSession: true,
            isRemedial: true,
            outOfSchedule: true,
            remedialReason: reason || 'حصة دعم ومعالجة بيداغوجية استثنائية',
            remedialBeneficiaries: beneficiaries,
            remedialBadgeTitle: sessionType === 'rattrapage' ? 'حصة استدراكية تعويضية' : 'حصة دعم واستدراك استثنائية',
            number: title || 'حصة دعم واستدراك',
            title: title || 'دعم ومعالجة بيداغوجية',
            axes: [title || 'أنشطة الدعم والاستدراك'],
            summary: summary || title,
            homework: homework,
            notes: notes ? `${notes} (حصة استدراكية خارج الجدول)` : 'حصة استدراكية خارج استعمال الزمن الرسمي',
            createdAt: new Date().toISOString()
        };

        db.lessonLogs[className].push(newLog);

        // المزامنة الاختيارية مع التقويم السنوي ومفكرة الأستاذ
        if (syncCalendar) {
            if (!db.events) db.events = [];
            db.events.push({
                id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: `💡 حصة استدراكية (${className}): ${newLog.number}`,
                date: date,
                time: timeSlot,
                category: 'pedagogical',
                type: 'soutien',
                className: className,
                details: `حصة دعم واستدراك خارج الجدول الرسمي (${timeSlot} - ${duration} س). الفئة المستفيدة: ${beneficiaries}.`,
                status: 'done',
                isRemedial: true
            });
        }

        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث عرض دفتر النصوص إن كان مفتوحاً
        if (typeof window.renderLessonLogs === 'function') {
            const logClassSelect = document.getElementById('lessonLogClassSelect');
            if (logClassSelect) logClassSelect.value = className;
            window.renderLessonLogs();
        }

        // تحديث التقويم إن كان مفتوحاً
        if (syncCalendar && typeof window.renderCalendar === 'function') {
            window.renderCalendar();
        }

        window.closeExtraSupportSessionModal();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`✅ تم توثيق حصة الدعم والاستدراك بقسم [${className}] في دفتر النصوص بنجاح!`, 'success');
        }
        unlock();
    };

    /**
     * فتح نافذة حصة الاستدراك مباشرة من خطة معالجة التعثرات الرياضية
     */
    window.openExtraSupportFromRemediationPlan = function () {
        const cls = window.currentMathRemediationClass || window.currentClass || '';
        const topics = (window.currentMathRemediationTopics && Array.isArray(window.currentMathRemediationTopics) && window.currentMathRemediationTopics.length > 0)
            ? window.currentMathRemediationTopics.join(' و ')
            : 'معالجة التعثرات والمفاهيم الرياضية المستهدفة';

        const strugglingCount = window.currentMathRemediationStrugglingCount || 0;
        const ben = strugglingCount > 0 ? `فئة الدعم ذات الأولوية (${strugglingCount} متعلم)` : 'كامل تلميذات وتلاميذ القسم';

        window.openExtraSupportSessionModal(cls, {
            title: `معالجة واستدراك: ${topics}`,
            reason: 'تنزيل خطة الدعم والمعالجة الرياضية الاستدراكية',
            beneficiaries: ben,
            type: 'soutien',
            summary: `• تنفيذ خطة الدعم والمعالجة الرياضية في موضوع (${topics}).
• استهداف التعثرات المرصودة في أوراق الفروض والأنشطة التقويمية.
• إنجاز تمارين تطبيقية موجهة لتثبيت المفاهيم وبناء الكفايات المستهدفة.`
        });
    };

    // Helper functions
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
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

    // التهيئة التلقائية عند تحميل الصفحة (فقط إذا كانت لوحة القيادة مرئية)
    document.addEventListener('DOMContentLoaded', () => {
        const dashView = document.getElementById('dashboardView');
        const trendsMount = document.getElementById('dashAbsenceTrendsCardContainer');
        if (dashView && dashView.style.display !== 'none' && trendsMount && typeof window.renderDashboardAbsenceTrends === 'function') {
            window.renderDashboardAbsenceTrends();
        }
    });

})();
