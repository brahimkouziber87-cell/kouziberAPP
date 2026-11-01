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
    window.addQuickSession = function (targetClass, prefillData) {
        const modal = document.getElementById('quickSessionModal');
        if (!modal) return;
        const prefill = (prefillData && typeof prefillData === 'object') ? prefillData : {};

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
        if (dateInput) dateInput.value = prefill.date || todayStr;

        // 3. حساب رقم الحصة تلقائياً للقسم المختار
        if (numInput) {
            const classLogs = (db.lessonLogs && selectedClass && db.lessonLogs[selectedClass]) 
                ? db.lessonLogs[selectedClass] 
                : [];
            numInput.value = classLogs.length + 1;
        }

        // 4. ضبط المدخلات والتوقيت الافتراضي (الربط التلقائي بتوقيت الحصة الحالية إن وجد)
        const currentTimetableSession = window.detectCurrentTimetableSession ? window.detectCurrentTimetableSession() : null;
        if (prefill.timeSlot && timeSlotSelect) {
            // إذا لم يكن الخيار موجوداً في القائمة نضيفه ديناميكياً
            const exists = Array.from(timeSlotSelect.options).some(o => o.value === prefill.timeSlot);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = prefill.timeSlot;
                opt.textContent = prefill.timeSlot;
                timeSlotSelect.insertBefore(opt, timeSlotSelect.firstChild);
            }
            timeSlotSelect.value = prefill.timeSlot;
            if (durationSelect && prefill.duration) durationSelect.value = String(prefill.duration);
        } else if (currentTimetableSession && timeSlotSelect) {
            const slotStr = `${currentTimetableSession.startTime} - ${currentTimetableSession.endTime}`;
            const exists = Array.from(timeSlotSelect.options).some(o => o.value === slotStr);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = slotStr;
                opt.textContent = slotStr;
                timeSlotSelect.insertBefore(opt, timeSlotSelect.firstChild);
            }
            timeSlotSelect.value = slotStr;
            if (durationSelect) durationSelect.value = String(currentTimetableSession.durationHours || 2);
        } else {
            if (timeSlotSelect && !timeSlotSelect.value) timeSlotSelect.value = '08:00 - 10:00';
            if (durationSelect && !durationSelect.value) durationSelect.value = '2';
        }

        if (typeSelect) typeSelect.value = prefill.sessionType || 'cours';
        if (titleInput) titleInput.value = prefill.title || '';
        if (summaryInput) summaryInput.value = prefill.summary || '';
        if (homeworkInput) homeworkInput.value = prefill.homework || '';
        if (notesInput) notesInput.value = prefill.notes || '';

        // استحضار آخر عنوان درس لهذا القسم كمقترح للمتابعة
        if (selectedClass && db.lessonLogs && db.lessonLogs[selectedClass] && db.lessonLogs[selectedClass].length > 0) {
            const lastLog = db.lessonLogs[selectedClass][db.lessonLogs[selectedClass].length - 1];
            const hintBox = document.getElementById('quickSessionLastLessonHint');
            if (hintBox && lastLog) {
                hintBox.innerHTML = `
                    <div style="font-size: 0.78rem; color: #475569; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
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
        const timeSlot = timeSlotSelect ? timeSlotSelect.value : '08:00 - 10:00';
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
    // 3. INTERACTIVE TEACHING MODE (وضع التدريس التفاعلي ومساعد التنشيط الصفي الذكي)
    // =========================================================================

    // المراحل الديداكتيكية المعيارية لحصة الرياضيات بالتعليم الثانوي التأهيلي
    const DIDACTIC_PHASES = [
        { id: 'warmup', icon: '📋', title: 'الغياب وتصحيح الواجب', shortTitle: 'تمهيد وغياب', ratio: 0.10, desc: 'ضبط الحضور وتصحيح التمرين المنزلي أو التذكير بالمكتسبات القبلية' },
        { id: 'activity', icon: '🔍', title: 'نشاط استكشافي / انطلاق', shortTitle: 'نشاط بنائي', ratio: 0.25, desc: 'طرح وضعية الانطلاق ومرافقة التلاميذ في البحث واستنتاج المفهوم' },
        { id: 'concept', icon: '📐', title: 'بناء المفهوم والبرهان', shortTitle: 'المفهوم والبرهان', ratio: 0.25, desc: 'صياغة التعاريف والمبرهنات الرياضية وتدوين البرهان والملخص' },
        { id: 'practice', icon: '✏️', title: 'تمرين تطبيقي وتصحيح', shortTitle: 'تطبيق وتمرن', ratio: 0.30, desc: 'إنجاز تمرين تطبيقي وتصحيحه جماعياً على السبورة بمشاركة التلاميذ' },
        { id: 'wrapup', icon: '🎯', title: 'تركيب الحصة والواجب', shortTitle: 'تقويم وواجب', ratio: 0.10, desc: 'تثبيت الحصيلة المعرفية وتعيين تمارين البحث للواجب المنزلي' }
    ];

    const teachingState = {
        isActive: false,
        isPaused: false,
        isMinimized: false,
        isProjectorMode: false, // وضع شاشة العرض المكبرة للقسم (Data Show HUD)
        activeTab: 'phases',    // 'phases' | 'picker' | 'subtimer' | 'board'
        className: '',
        room: '',
        slotLabel: '',
        startTimeStr: '08:00',
        endTimeStr: '10:00',
        durationHours: 2,
        isAutoDetectedLive: false,
        totalSeconds: 2 * 3600,
        remainingSeconds: 2 * 3600,
        intervalId: null,
        soundEnabled: true,
        sessionTopic: '',
        boardNote: '',          // سبورة التذكير السريع ورقم التمرين الجاري
        homeworkNote: '',       // الواجب المنزلي المقترح للحصة القادمة
        activePhaseIndex: 0,
        manualPhaseLock: false, // إذا اختار الأستاذ المرحلة يدوياً لا نغيرها تلقائياً
        completedPhases: new Set([0]),
        // مؤقت التمارين الفرعي (Sub-timer for classroom exercises)
        subTimerTotalSeconds: 300,
        subTimerRemainingSeconds: 0,
        subTimerRunning: false,
        subTimerLabel: 'بحث فردي في التمرين التطبيقي',
        // القرعة البيداغوجية وتقييم المشاركة
        pickedStudent: null,
        pickerFilter: 'all_present', // 'all_present' | 'unpicked' | 'struggling'
        pickedStudentIdsToday: new Set(),
        sessionParticipations: [] // [{ studentId, name, badge, points, time }]
    };

    /**
     * فحص واكتشاف الحصة الجارية حالياً (أو الحصة القادمة اليوم) في جدول الحصص الأسبوعي
     * يدعم صيغ الأيام بالهمزة وبدونها والتوقيت الرسمي (08:00 - 13:00 و 13:00 - 18:00)
     * @returns {Object|null} بيانات الحصة الجارية أو القادمة
     */
    window.detectCurrentTimetableSession = function () {
        const db = window.db || {};
        if (!db.timetable || typeof db.timetable !== 'object') return null;

        const dayMap = [
            ['الأحد', 'الاحد'],
            ['الإثنين', 'الاثنين'],
            ['الثلاثاء'],
            ['الأربعاء', 'الاربعاء'],
            ['الخميس'],
            ['الجمعة'],
            ['السبت']
        ];
        const todayVariants = dayMap[new Date().getDay()] || ['الإثنين'];
        let dayData = null;
        let matchedDayLabel = todayVariants[0];

        for (const variant of todayVariants) {
            if (db.timetable[variant] && typeof db.timetable[variant] === 'object') {
                dayData = db.timetable[variant];
                matchedDayLabel = variant;
                break;
            }
        }
        if (!dayData) return null;

        const now = new Date();
        const curMinutes = now.getHours() * 60 + now.getMinutes();

        const slots = [
            { key: 'm1', label: 'الحصة الصباحية 1', timeProp: 'm1_time', oldTimeProp: 'morningTime1', hrsProp: 'm1_hrs', oldHrsProp: 'morningHours1', classProp: 'm1_class', oldClassProp: 'morningClass1', roomProp: 'm1_room', defTime: '08:00', defHrs: 2 },
            { key: 'm2', label: 'الحصة الصباحية 2', timeProp: 'm2_time', oldTimeProp: 'morningTime2', hrsProp: 'm2_hrs', oldHrsProp: 'morningHours2', classProp: 'm2_class', oldClassProp: 'morningClass2', roomProp: 'm2_room', defTime: '10:00', defHrs: 2 },
            { key: 'm3', label: 'الحصة الصباحية 3', timeProp: 'm3_time', hrsProp: 'm3_hrs', classProp: 'm3_class', roomProp: 'm3_room', defTime: '12:00', defHrs: 1 },
            { key: 'e1', label: 'الحصة المسائية 1', timeProp: 'e1_time', oldTimeProp: 'eveningTime1', hrsProp: 'e1_hrs', oldHrsProp: 'eveningHours1', classProp: 'e1_class', oldClassProp: 'eveningClass1', roomProp: 'e1_room', defTime: '13:00', defHrs: 2 },
            { key: 'e2', label: 'الحصة المسائية 2', timeProp: 'e2_time', oldTimeProp: 'eveningTime2', hrsProp: 'e2_hrs', oldHrsProp: 'eveningHours2', classProp: 'e2_class', oldClassProp: 'eveningClass2', roomProp: 'e2_room', defTime: '15:00', defHrs: 2 },
            { key: 'e3', label: 'الحصة المسائية 3', timeProp: 'e3_time', hrsProp: 'e3_hrs', classProp: 'e3_class', roomProp: 'e3_room', defTime: '17:00', defHrs: 1 }
        ];

        let upcomingCandidate = null;

        for (const s of slots) {
            const className = dayData[s.classProp] || (s.oldClassProp ? dayData[s.oldClassProp] : '') || '';
            if (!className || className.trim() === '') continue;

            const startTimeStr = dayData[s.timeProp] || (s.oldTimeProp ? dayData[s.oldTimeProp] : '') || s.defTime;
            const durationHrs = parseFloat(dayData[s.hrsProp] || (s.oldHrsProp ? dayData[s.oldHrsProp] : '') || s.defHrs) || 2;
            const room = (s.roomProp && dayData[s.roomProp]) ? dayData[s.roomProp] : '';

            const [sh, sm] = startTimeStr.split(':').map(Number);
            const startM = (sh || 0) * 60 + (sm || 0);
            const endM = startM + Math.round(durationHrs * 60);

            const endH = Math.floor(endM / 60);
            const endMin = endM % 60;
            const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

            // 1. إذا كان التوقيت الحالي يقع داخل فترة هذه الحصة (أو قبلها بـ 10 دقائق)
            if (curMinutes >= (startM - 10) && curMinutes < endM) {
                const remainingMinutes = Math.max(1, Math.min(Math.round(durationHrs * 60), endM - curMinutes));
                return {
                    day: matchedDayLabel,
                    slotKey: s.key,
                    slotLabel: s.label,
                    className: className.trim(),
                    room: room,
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    durationHours: durationHrs,
                    remainingSeconds: remainingMinutes * 60,
                    totalSeconds: Math.round(durationHrs * 3600),
                    isLiveNow: true
                };
            }

            // 2. الاحتفاظ بأقرب حصة قادمة في نفس اليوم
            if (curMinutes < startM && !upcomingCandidate) {
                upcomingCandidate = {
                    day: matchedDayLabel,
                    slotKey: s.key,
                    slotLabel: `${s.label} (قادمة)`,
                    className: className.trim(),
                    room: room,
                    startTime: startTimeStr,
                    endTime: endTimeStr,
                    durationHours: durationHrs,
                    remainingSeconds: Math.round(durationHrs * 3600),
                    totalSeconds: Math.round(durationHrs * 3600),
                    isLiveNow: false
                };
            }
        }

        return upcomingCandidate;
    };

    /**
     * تشغيل نغمة تنبيه صوتية باستخدام Web Audio API
     * @param {'session_end'|'subtimer_end'|'phase_change'|'student_pick'} [type='session_end']
     */
    window.playTeachingSessionChime = function (type = 'session_end') {
        if (!teachingState.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();

            let notes = [];
            if (type === 'subtimer_end') {
                // نغمة تنبيه انتهاء وقت التمرين التطبيقي (ثنائية واضحة)
                notes = [
                    { f: 587.33, time: 0.0, dur: 0.22 }, // D5
                    { f: 880.00, time: 0.24, dur: 0.35 }, // A5
                    { f: 587.33, time: 0.65, dur: 0.22 }, // D5
                    { f: 880.00, time: 0.89, dur: 0.45 }  // A5
                ];
            } else if (type === 'phase_change') {
                // نغمة لطيفة للانتقال بين مراحل الدرس
                notes = [
                    { f: 523.25, time: 0.0, dur: 0.18 },
                    { f: 659.25, time: 0.18, dur: 0.28 }
                ];
            } else if (type === 'student_pick') {
                // نغمة اختيار تلميذ في القرعة البيداغوجية
                notes = [
                    { f: 440.00, time: 0.0, dur: 0.12 },
                    { f: 554.37, time: 0.12, dur: 0.12 },
                    { f: 659.25, time: 0.24, dur: 0.28 }
                ];
            } else {
                // نغمات جرس المدرسة الرباعي (Harmonic School Chime)
                notes = [
                    { f: 523.25, time: 0.0, dur: 0.35 },
                    { f: 659.25, time: 0.3, dur: 0.35 },
                    { f: 783.99, time: 0.6, dur: 0.40 },
                    { f: 1046.50, time: 0.95, dur: 0.85 }
                ];
            }

            notes.forEach(n => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(n.f, ctx.currentTime + n.time);

                gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
                gain.gain.exponentialRampToValueAtTime(0.26, ctx.currentTime + n.time + 0.04);
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
     * حساب إحصائيات حضور القسم لليوم الجاري
     */
    function getClassTodayAttendanceSummary(className) {
        const db = window.db || {};
        const students = (db.classes && db.classes[className])
            ? (Array.isArray(db.classes[className]) ? db.classes[className] : (db.classes[className].students || []))
            : [];
        const total = students.length;
        const todayStr = (typeof window.formatLocalDate === 'function')
            ? window.formatLocalDate()
            : new Date().toISOString().split('T')[0];

        const absentIds = new Set();
        const lateIds = new Set();

        (db.records || []).forEach(r => {
            if (r && r.className === className && r.date === todayStr) {
                if (r.status === 'غائب' || r.status === 'مبرر' || (r.status && r.status.includes('غائب'))) {
                    absentIds.add(r.studentId);
                } else if (r.status === 'متأخر') {
                    lateIds.add(r.studentId);
                }
            }
        });

        const absentCount = absentIds.size;
        const lateCount = lateIds.size;
        const presentCount = Math.max(0, total - absentCount);

        return {
            total,
            presentCount,
            absentCount,
            lateCount,
            absentIds,
            lateIds,
            students
        };
    }

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
            const dur = parseFloat(forcedDurationHours) || 2;
            teachingState.durationHours = dur;
            teachingState.totalSeconds = Math.round(dur * 3600);
            teachingState.remainingSeconds = teachingState.totalSeconds;
            teachingState.startTimeStr = '08:00';
            teachingState.endTimeStr = dur === 1 ? '09:00' : '10:00';
            teachingState.slotLabel = `حصة مخصصة (${dur} س)`;
            teachingState.isAutoDetectedLive = false;
        } else if (detected) {
            teachingState.className = detected.className;
            teachingState.room = detected.room || '';
            teachingState.durationHours = detected.durationHours || 2;
            teachingState.totalSeconds = detected.totalSeconds;
            teachingState.remainingSeconds = detected.remainingSeconds;
            teachingState.startTimeStr = detected.startTime;
            teachingState.endTimeStr = detected.endTime;
            teachingState.slotLabel = `${detected.day} • ${detected.startTime} - ${detected.endTime}${detected.room ? ' (' + detected.room + ')' : ''}`;
            teachingState.isAutoDetectedLive = !!detected.isLiveNow;
        } else {
            teachingState.className = window.currentClass || availableClasses[0] || 'حصة عامة';
            teachingState.durationHours = 2;
            teachingState.totalSeconds = 2 * 3600;
            teachingState.remainingSeconds = 2 * 3600;
            teachingState.startTimeStr = '08:00';
            teachingState.endTimeStr = '10:00';
            teachingState.slotLabel = 'حصة دراسية (ساعتان)';
            teachingState.isAutoDetectedLive = false;
        }

        // جلب آخر موضوع درس لهذا القسم
        loadClassTopicForTeachingState(teachingState.className);

        // إنشاء أو إظهار العنصر العائم وبناء الهيكل
        ensureFloatingTimerDom();
        renderFloatingTimerStructure();

        if (teachingState.intervalId) clearInterval(teachingState.intervalId);
        teachingState.intervalId = setInterval(onTeachingTimerTick, 1000);

        // تحديث زر الهيدر
        const btn = document.getElementById('headerTeachingModeBtn');
        const badge = document.getElementById('headerTeachingModeBadge');
        if (btn) {
            btn.style.background = 'linear-gradient(135deg, #312e81, #4f46e5)';
            btn.style.borderColor = '#fbbf24';
            btn.style.color = '#ffffff';
        }
        if (badge) {
            badge.style.display = 'inline-block';
            badge.style.background = '#d97706';
            badge.textContent = teachingState.className || 'نشط';
        }

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`⏱️ تم تفعيل وضع التدريس التفاعلي لقسم [${teachingState.className}]!`, 'success');
        }
    };

    function loadClassTopicForTeachingState(className) {
        const db = window.db || {};
        if (className && db.lessonLogs && db.lessonLogs[className] && db.lessonLogs[className].length > 0) {
            const logs = db.lessonLogs[className];
            const last = logs[logs.length - 1];
            teachingState.sessionTopic = last.number || last.title || '';
        } else {
            teachingState.sessionTopic = '';
        }
    }

    /**
     * إيقاف وإنهاء وضع التدريس التفاعلي
     */
    window.stopInteractiveTeachingMode = function () {
        teachingState.isActive = false;
        teachingState.isProjectorMode = false;
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

    /**
     * حساب المرحلة الديداكتيكية المقترحة بناءً على نسبة الوقت المنقضي
     */
    function computeSuggestedPhaseIndex() {
        if (teachingState.totalSeconds <= 0) return 0;
        const elapsedRatio = Math.min(1, Math.max(0, (teachingState.totalSeconds - teachingState.remainingSeconds) / teachingState.totalSeconds));
        let acc = 0;
        for (let i = 0; i < DIDACTIC_PHASES.length; i++) {
            acc += DIDACTIC_PHASES[i].ratio;
            if (elapsedRatio <= acc) return i;
        }
        return DIDACTIC_PHASES.length - 1;
    }

    /**
     * التحديث الدوري كل ثانية (يحدث العناصر النصية وشريط التقدم فقط دون إعادة بناء الـ DOM!)
     */
    function onTeachingTimerTick() {
        if (!teachingState.isActive) return;

        // 1. تحديث المؤقت الرئيسي للحصة
        if (!teachingState.isPaused && teachingState.remainingSeconds > 0) {
            teachingState.remainingSeconds--;

            // فحص الانتقال التلقائي بين مراحل الدرس إن لم يكن مقفلاً يدوياً
            if (!teachingState.manualPhaseLock) {
                const suggestedIdx = computeSuggestedPhaseIndex();
                if (suggestedIdx !== teachingState.activePhaseIndex) {
                    teachingState.activePhaseIndex = suggestedIdx;
                    teachingState.completedPhases.add(suggestedIdx);
                    window.playTeachingSessionChime('phase_change');
                    renderFloatingTimerStructure();
                }
            }

            // عندما ينتهي الوقت القانوني للحصة
            if (teachingState.remainingSeconds === 0) {
                window.playTeachingSessionChime('session_end');
                renderFloatingTimerStructure();
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`⏰ انتهى وقت الحصة القانوني لقسم [${teachingState.className}]! اضغط لتوثيق الحصة في دفتر النصوص.`, 'warning');
                }
            }
        }

        // 2. تحديث مؤقت التمارين الفرعي (Sub-Timer)
        if (teachingState.subTimerRunning && teachingState.subTimerRemainingSeconds > 0) {
            teachingState.subTimerRemainingSeconds--;
            if (teachingState.subTimerRemainingSeconds === 0) {
                teachingState.subTimerRunning = false;
                window.playTeachingSessionChime('subtimer_end');
                renderFloatingTimerStructure();
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`⌛ انتهى الوقت المخصص للتمرين (${teachingState.subTimerLabel})!`, 'info');
                }
            }
        }

        // تحديث العناصر النصية فقط بدون تدمير القوائم المنسدلة أو الحقول
        updateFloatingTimerTickDOM();
    }

    /**
     * تحديث القيم المتغيرة كل ثانية فقط (العداد وشريط التقدم)
     */
    function updateFloatingTimerTickDOM() {
        const timeStr = formatTime(teachingState.remainingSeconds);
        const percent = teachingState.totalSeconds > 0 
            ? Math.min(100, Math.max(0, Math.round(((teachingState.totalSeconds - teachingState.remainingSeconds) / teachingState.totalSeconds) * 100))) 
            : 0;
        const isTimeUp = teachingState.remainingSeconds <= 0;
        const isWarning = !isTimeUp && teachingState.remainingSeconds < 300;

        const clockEl = document.getElementById('teachingTimerClockText');
        if (clockEl) {
            clockEl.textContent = timeStr;
            clockEl.style.color = isTimeUp ? '#ef4444' : (isWarning ? '#fbbf24' : '#38bdf8');
        }

        const progEl = document.getElementById('teachingTimerProgressBar');
        if (progEl) {
            progEl.style.width = `${percent}%`;
        }

        const progLabelEl = document.getElementById('teachingTimerProgressLabel');
        if (progLabelEl) {
            progLabelEl.textContent = `${percent}% من زمن الحصة`;
        }

        const subClockEl = document.getElementById('teachingSubTimerClockText');
        if (subClockEl) {
            subClockEl.textContent = formatTime(teachingState.subTimerRemainingSeconds);
            subClockEl.style.color = teachingState.subTimerRemainingSeconds === 0
                ? '#94a3b8'
                : (teachingState.subTimerRemainingSeconds <= 30 ? '#f87171' : '#fbbf24');
        }

        const subProgEl = document.getElementById('teachingSubTimerProgressBar');
        if (subProgEl && teachingState.subTimerTotalSeconds > 0) {
            const subPct = Math.min(100, Math.max(0, Math.round(((teachingState.subTimerTotalSeconds - teachingState.subTimerRemainingSeconds) / teachingState.subTimerTotalSeconds) * 100)));
            subProgEl.style.width = `${subPct}%`;
        }
    }

    window.toggleTeachingTimerPause = function () {
        teachingState.isPaused = !teachingState.isPaused;
        renderFloatingTimerStructure();
    };

    window.extendTeachingTimer = function (extraMinutes = 5) {
        teachingState.remainingSeconds = Math.max(60, teachingState.remainingSeconds + extraMinutes * 60);
        teachingState.totalSeconds = Math.max(teachingState.remainingSeconds, teachingState.totalSeconds + extraMinutes * 60);
        renderFloatingTimerStructure();
        if (typeof window.showAppToast === 'function') {
            const label = extraMinutes > 0 ? `➕ تمت إضافة ${extraMinutes} دقائق للحصة` : `➖ تم إنقاص ${Math.abs(extraMinutes)} دقائق من المؤقت`;
            window.showAppToast(label, 'info');
        }
    };

    window.setTeachingDurationPreset = function (minutes) {
        const mins = parseInt(minutes, 10) || 60;
        teachingState.totalSeconds = mins * 60;
        teachingState.remainingSeconds = mins * 60;
        teachingState.durationHours = +(mins / 60).toFixed(1);
        teachingState.isPaused = false;
        renderFloatingTimerStructure();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`⏱️ تم ضبط مؤقت الحصة على ${mins} دقيقة`, 'info');
        }
    };

    window.toggleTeachingSound = function () {
        teachingState.soundEnabled = !teachingState.soundEnabled;
        if (teachingState.soundEnabled) {
            window.playTeachingSessionChime('phase_change');
        }
        renderFloatingTimerStructure();
    };

    window.toggleTeachingTimerMinimize = function () {
        teachingState.isMinimized = !teachingState.isMinimized;
        if (teachingState.isMinimized) teachingState.isProjectorMode = false;
        renderFloatingTimerStructure();
    };

    window.toggleTeachingProjectorMode = function () {
        teachingState.isProjectorMode = !teachingState.isProjectorMode;
        if (teachingState.isProjectorMode) teachingState.isMinimized = false;
        renderFloatingTimerStructure();
    };

    window.switchTeachingHudTab = function (tabName) {
        teachingState.activeTab = tabName || 'phases';
        renderFloatingTimerStructure();
    };

    window.selectTeachingDidacticPhase = function (idx) {
        const phaseIdx = parseInt(idx, 10);
        if (isNaN(phaseIdx) || phaseIdx < 0 || phaseIdx >= DIDACTIC_PHASES.length) return;
        teachingState.activePhaseIndex = phaseIdx;
        teachingState.manualPhaseLock = true;
        teachingState.completedPhases.add(phaseIdx);
        window.playTeachingSessionChime('phase_change');
        renderFloatingTimerStructure();
    };

    window.setTeachingSessionClass = function (newClass) {
        if (!newClass) return;
        teachingState.className = newClass;
        teachingState.pickedStudent = null;
        loadClassTopicForTeachingState(newClass);

        const badge = document.getElementById('headerTeachingModeBadge');
        if (badge && teachingState.isActive) {
            badge.textContent = newClass;
        }
        renderFloatingTimerStructure();
    };

    window.updateTeachingSessionTopicLive = function (val) {
        teachingState.sessionTopic = val || '';
    };

    window.updateTeachingBoardNoteLive = function (val) {
        teachingState.boardNote = val || '';
    };

    window.updateTeachingHomeworkLive = function (val) {
        teachingState.homeworkNote = val || '';
    };

    window.insertTeachingMathSymbol = function (sym) {
        const input = document.getElementById('teachingBoardNoteInput');
        if (!input) return;
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        const text = input.value;
        input.value = text.substring(0, start) + sym + text.substring(end);
        teachingState.boardNote = input.value;
        input.focus();
        input.selectionStart = input.selectionEnd = start + sym.length;
    };

    // --- دوال مؤقت التمارين الفرعي (Exercise Sprint Sub-Timer) ---
    window.startTeachingSubTimer = function (minutes, label) {
        const mins = parseFloat(minutes) || 5;
        teachingState.subTimerTotalSeconds = Math.round(mins * 60);
        teachingState.subTimerRemainingSeconds = teachingState.subTimerTotalSeconds;
        teachingState.subTimerRunning = true;
        if (label) teachingState.subTimerLabel = label;
        teachingState.activeTab = 'subtimer';
        renderFloatingTimerStructure();
    };

    window.toggleTeachingSubTimerPause = function () {
        if (teachingState.subTimerRemainingSeconds <= 0) {
            teachingState.subTimerRemainingSeconds = teachingState.subTimerTotalSeconds || 300;
            teachingState.subTimerRunning = true;
        } else {
            teachingState.subTimerRunning = !teachingState.subTimerRunning;
        }
        renderFloatingTimerStructure();
    };

    window.resetTeachingSubTimer = function () {
        teachingState.subTimerRunning = false;
        teachingState.subTimerRemainingSeconds = 0;
        renderFloatingTimerStructure();
    };

    // --- دوال القرعة البيداغوجية وتقييم المشاركة الفورية ---
    window.setTeachingPickerFilter = function (filterMode) {
        teachingState.pickerFilter = filterMode || 'all_present';
        renderFloatingTimerStructure();
    };

    window.pickRandomStudentForTeaching = function () {
        const cls = teachingState.className;
        const summary = getClassTodayAttendanceSummary(cls);
        if (summary.students.length === 0) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('⚠️ لا توجد لائحة تلاميذ مسجلة لهذا القسم بعد.', 'warning');
            }
            return;
        }

        // استبعاد التلاميذ الغائبين اليوم تلقائياً
        let candidates = summary.students.filter(s => s && !summary.absentIds.has(s.id));
        if (candidates.length === 0) {
            candidates = summary.students.slice();
        }

        if (teachingState.pickerFilter === 'unpicked') {
            const unpicked = candidates.filter(s => !teachingState.pickedStudentIdsToday.has(s.id));
            if (unpicked.length > 0) {
                candidates = unpicked;
            } else {
                teachingState.pickedStudentIdsToday.clear();
            }
        } else if (teachingState.pickerFilter === 'struggling') {
            const struggling = candidates.filter(s => {
                if (typeof window.getStudentPedagogicalProfile === 'function') {
                    const prof = window.getStudentPedagogicalProfile(cls, s.id);
                    return prof && (prof.academicLevel === 'struggling' || prof.academicLevel === 'critical' || (prof.avg !== null && prof.avg < 10));
                }
                return false;
            });
            if (struggling.length > 0) {
                candidates = struggling;
            }
        }

        // تجنب تكرار نفس التلميذ مرتين متتاليتين إن أمكن
        if (candidates.length > 1 && teachingState.pickedStudent) {
            const filtered = candidates.filter(s => s.id !== teachingState.pickedStudent.id);
            if (filtered.length > 0) candidates = filtered;
        }

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        teachingState.pickedStudent = chosen;
        teachingState.pickedStudentIdsToday.add(chosen.id);

        // توثيق مشاركة التلميذ في الحصة تلقائياً بصورة إيجابية وعادلة دون أي تمييز
        if (!teachingState.sessionParticipations.some(p => String(p.studentId) === String(chosen.id))) {
            teachingState.sessionParticipations.push({
                studentId: chosen.id,
                name: chosen.name,
                badge: 'مشاركة على السبورة',
                points: 1,
                time: new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })
            });

            const cls = teachingState.className;
            const db = window.db || {};
            if (cls && db.classes && db.classes[cls]) {
                const todayStr = (typeof window.formatLocalDate === 'function')
                    ? window.formatLocalDate()
                    : new Date().toISOString().split('T')[0];
                if (!Array.isArray(db.positiveBehaviors)) db.positiveBehaviors = [];
                db.positiveBehaviors.push({
                    id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    className: cls,
                    studentId: chosen.id,
                    studentName: chosen.name,
                    date: todayStr,
                    type: 'مشاركة على السبورة',
                    points: 1,
                    topic: teachingState.sessionTopic || ''
                });
                if (typeof window.saveDB === 'function') window.saveDB();
            }
        }

        window.playTeachingSessionChime('student_pick');
        renderFloatingTimerStructure();
    };

    /**
     * مكافأة التلميذ المختار أو توثيق مشاركته على السبورة
     */
    window.rewardTeachingStudentParticipation = function (studentId, rewardType) {
        const cls = teachingState.className;
        const db = window.db || {};
        if (!cls || !studentId || !db.classes || !db.classes[cls]) return;

        const students = Array.isArray(db.classes[cls]) ? db.classes[cls] : (db.classes[cls].students || []);
        const std = students.find(s => String(s.id) === String(studentId));
        if (!std) return;

        const todayStr = (typeof window.formatLocalDate === 'function')
            ? window.formatLocalDate()
            : new Date().toISOString().split('T')[0];

        if (!db.behaviors) db.behaviors = {};
        if (!db.behaviors[cls]) db.behaviors[cls] = {};
        if (!db.behaviors[cls][std.id]) db.behaviors[cls][std.id] = { status: 'منضبط', note: '' };

        let badgeLabel = '🌟 تميز وإجابة صحيحة على السبورة';
        let points = 1;
        if (rewardType === 'excellence') {
            badgeLabel = '🌟 تميز وبرهان سليم على السبورة';
            points = 1;
            db.behaviors[cls][std.id].status = 'متميز';
        } else if (rewardType === 'good_try') {
            badgeLabel = '👍 مشاركة إيجابية ومحاولة جيدة';
            points = 0.5;
        } else if (rewardType === 'needs_support') {
            badgeLabel = '💡 صعوبة مرصودة تحتاج دعماً وتوجيهاً';
            points = 0;
        }

        const prevNote = db.behaviors[cls][std.id].note || '';
        const newNoteSnippet = `[${todayStr}] ${badgeLabel}${teachingState.sessionTopic ? ' (' + teachingState.sessionTopic + ')' : ''}`;
        if (!prevNote.includes(newNoteSnippet)) {
            db.behaviors[cls][std.id].note = prevNote ? `${prevNote} | ${newNoteSnippet}` : newNoteSnippet;
        }

        if (points > 0) {
            if (!Array.isArray(db.positiveBehaviors)) db.positiveBehaviors = [];
            db.positiveBehaviors.push({
                id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                className: cls,
                studentId: std.id,
                studentName: std.name,
                date: todayStr,
                type: badgeLabel,
                points: points,
                topic: teachingState.sessionTopic || ''
            });
        }

        teachingState.sessionParticipations.push({
            studentId: std.id,
            name: std.name,
            badge: badgeLabel,
            points: points,
            time: new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })
        });

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderStudents === 'function') window.renderStudents();

        renderFloatingTimerStructure();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`✅ تم توثيق (${badgeLabel}) للتلميذ(ة): ${std.name}`, 'success');
        }
    };

    window.openAttendanceForTeachingClass = function () {
        const cls = teachingState.className;
        if (typeof window.switchMainTab === 'function') {
            window.switchMainTab('attendance');
        }
        const classSelect = document.getElementById('classSelect');
        if (classSelect && cls) {
            classSelect.value = cls;
            if (typeof window.onClassChange === 'function') {
                window.onClassChange();
            } else if (typeof window.renderStudents === 'function') {
                window.currentClass = cls;
                window.renderStudents();
            }
        }
        if (teachingState.isProjectorMode) {
            teachingState.isProjectorMode = false;
            renderFloatingTimerStructure();
        }
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

    /**
     * بناء الهيكل الكامل لويدجت التدريس التفاعلي (يُستدعى عند تغيير التبويب أو الحالة، وليس كل ثانية)
     */
    function renderFloatingTimerStructure() {
        const widget = document.getElementById('floatingTeachingTimerWidget');
        if (!widget) return;

        if (!teachingState.isActive) {
            widget.style.display = 'none';
            return;
        }
        widget.style.display = 'block';

        const timeStr = formatTime(teachingState.remainingSeconds);
        const percent = teachingState.totalSeconds > 0 
            ? Math.min(100, Math.max(0, Math.round(((teachingState.totalSeconds - teachingState.remainingSeconds) / teachingState.totalSeconds) * 100))) 
            : 0;

        const isTimeUp = teachingState.remainingSeconds <= 0;
        const isWarning = !isTimeUp && teachingState.remainingSeconds < 300;

        const db = window.db || {};
        const classes = Object.keys(db.classes || {}).sort();
        const attendance = getClassTodayAttendanceSummary(teachingState.className);
        const currentPhase = DIDACTIC_PHASES[teachingState.activePhaseIndex] || DIDACTIC_PHASES[0];

        // 1. الوضع المصغر (Minimized Pill)
        if (teachingState.isMinimized) {
            widget.style.position = 'fixed';
            widget.style.inset = '';
            widget.style.top = widget.dataset.savedTop || '78px';
            widget.style.left = widget.dataset.savedLeft || '20px';
            widget.style.width = 'auto';
            widget.style.height = 'auto';
            widget.className = 'floating-teaching-timer-minimized';
            widget.innerHTML = `
                <div onclick="toggleTeachingTimerMinimize()" style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 16px; background: linear-gradient(135deg, #1e1b4b, #312e81); border: 2px solid ${isTimeUp ? '#ef4444' : '#d4af37'}; border-radius: 999px; color: #fff; box-shadow: 0 12px 28px rgba(15, 23, 42, 0.45); font-weight: 800;">
                    <span style="font-size: 1.1rem;">${isTimeUp ? '⏰' : (teachingState.isPaused ? '⏸️' : '⏱️')}</span>
                    <span id="teachingTimerClockText" style="color: ${isTimeUp ? '#f87171' : '#38bdf8'}; font-size: 1.05rem; font-family: monospace, sans-serif; letter-spacing: 1px;">${timeStr}</span>
                    ${teachingState.subTimerRunning ? `<span style="background: rgba(251,191,36,0.2); border: 1px solid #fbbf24; color: #fde68a; padding: 1px 7px; border-radius: 999px; font-size: 0.75rem; font-family: monospace;">⏳ <span id="teachingSubTimerClockText">${formatTime(teachingState.subTimerRemainingSeconds)}</span></span>` : ''}
                    <span style="font-size: 0.76rem; background: rgba(212, 175, 55, 0.2); color: #fde68a; border: 1px solid rgba(212, 175, 55, 0.45); padding: 2px 8px; border-radius: 6px; font-family: 'Cairo', sans-serif;">${escapeHtml(teachingState.className)}</span>
                    <span style="font-size: 0.72rem; color: #cbd5e1; font-family: 'Cairo', sans-serif;">${currentPhase.icon} ${currentPhase.shortTitle}</span>
                </div>
            `;
            return;
        }

        // ضبط التموضع بين الوضع العائم ووضع شاشة العرض الكاملة (Data Show)
        if (teachingState.isProjectorMode) {
            widget.dataset.savedTop = widget.style.top || '78px';
            widget.dataset.savedLeft = widget.style.left || '20px';
            widget.style.position = 'fixed';
            widget.style.top = '0';
            widget.style.left = '0';
            widget.style.width = '100vw';
            widget.style.height = '100vh';
            widget.style.background = 'rgba(15, 23, 42, 0.88)';
            widget.style.backdropFilter = 'blur(8px)';
            widget.style.display = 'flex';
            widget.style.alignItems = 'center';
            widget.style.justifyContent = 'center';
            widget.style.padding = '18px';
        } else {
            widget.style.position = 'fixed';
            widget.style.width = 'auto';
            widget.style.height = 'auto';
            widget.style.background = 'transparent';
            widget.style.backdropFilter = 'none';
            widget.style.padding = '0';
            widget.style.top = widget.dataset.savedTop || widget.style.top || '72px';
            widget.style.left = widget.dataset.savedLeft || widget.style.left || '20px';
        }

        // محتوى التبويبات الفرعية الأربعة داخل الويدجت
        let tabBodyHtml = '';

        if (teachingState.activeTab === 'phases') {
            tabBodyHtml = `
                <div style="background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.76rem; font-weight: 800; color: #fde68a;">🧭 المراحل الديداكتيكية للحصة:</span>
                        <span style="font-size: 0.68rem; color: #94a3b8;">${teachingState.manualPhaseLock ? 'تحكم يدوي' : 'تدرج تلقائي ذكي'}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        ${DIDACTIC_PHASES.map((p, idx) => {
                            const isCurrent = idx === teachingState.activePhaseIndex;
                            const isDone = teachingState.completedPhases.has(idx) && !isCurrent;
                            const phaseMins = Math.max(5, Math.round((teachingState.totalSeconds / 60) * p.ratio));
                            return `
                                <div onclick="selectTeachingDidacticPhase(${idx})" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: ${isCurrent ? 'linear-gradient(90deg, rgba(212, 175, 55, 0.25), rgba(79, 70, 229, 0.25))' : (isDone ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.5)')}; border: 1px solid ${isCurrent ? '#fbbf24' : (isDone ? 'rgba(16, 185, 129, 0.35)' : 'rgba(71, 85, 105, 0.4)')};">
                                    <div style="display: flex; align-items: center; gap: 7px;">
                                        <span style="font-size: 0.9rem;">${isCurrent ? '▶️' : (isDone ? '✅' : p.icon)}</span>
                                        <div>
                                            <div style="font-size: ${teachingState.isProjectorMode ? '0.92rem' : '0.78rem'}; font-weight: ${isCurrent ? '900' : '700'}; color: ${isCurrent ? '#fef08a' : (isDone ? '#a7f3d0' : '#e2e8f0')};">${p.title}</div>
                                            ${isCurrent ? `<div style="font-size: 0.68rem; color: #cbd5e1; margin-top: 1px;">${p.desc}</div>` : ''}
                                        </div>
                                    </div>
                                    <span style="font-size: 0.7rem; font-weight: 800; color: ${isCurrent ? '#fbbf24' : '#94a3b8'}; background: rgba(15,23,42,0.6); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">~${phaseMins} د</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (teachingState.activeTab === 'picker') {
            const picked = teachingState.pickedStudent;

            tabBodyHtml = `
                <div style="background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                        <span style="font-size: 0.76rem; font-weight: 800; color: #fde68a;">🎲 القرعة البيداغوجية (يستثني الغائبين تلقائياً):</span>
                        <select onchange="setTeachingPickerFilter(this.value)" style="background: #0f172a; color: #e2e8f0; border: 1px solid #475569; border-radius: 6px; padding: 2px 6px; font-size: 0.72rem; font-weight: 700; font-family: inherit;">
                            <option value="all_present" ${teachingState.pickerFilter === 'all_present' ? 'selected' : ''}>جميع الحاضرين (${attendance.presentCount})</option>
                            <option value="unpicked" ${teachingState.pickerFilter === 'unpicked' ? 'selected' : ''}>لم يشاركوا بعد اليوم</option>
                            <option value="struggling" ${teachingState.pickerFilter === 'struggling' ? 'selected' : ''}>فئة الدعم والتعثر</option>
                        </select>
                    </div>

                    <button type="button" onclick="pickRandomStudentForTeaching()" style="width: 100%; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; border: 1px solid #a78bfa; padding: 8px 12px; border-radius: 8px; font-weight: 900; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3); margin-bottom: 8px;">
                        <span>🎲 اختيار تلميذ(ة) للإجابة على السبورة</span>
                    </button>

                    ${picked ? `
                        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 27, 75, 0.95)); border: 1.5px solid #fbbf24; border-radius: 12px; padding: 12px 14px; text-align: center; box-shadow: 0 8px 20px -4px rgba(0,0,0,0.45);">
                            <div style="font-size: ${teachingState.isProjectorMode ? '0.92rem' : '0.76rem'}; color: #fde68a; font-weight: 700; margin-bottom: 6px;">🎯 التلميذ(ة) المنتقى للمشاركة على السبورة:</div>
                            <div style="font-size: ${teachingState.isProjectorMode ? '2.15rem' : '1.42rem'}; font-weight: 900; color: #ffffff; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
                                <span style="letter-spacing: 0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">🎓 ${escapeHtml(picked.name)}</span>
                                ${picked.orderNum ? `<span style="background: rgba(30, 41, 59, 0.9); color: #fef08a; border: 1px solid rgba(251, 191, 36, 0.45); font-size: ${teachingState.isProjectorMode ? '1.05rem' : '0.8rem'}; padding: 2px 8px; border-radius: 6px; font-weight: 800;">رقم ${escapeHtml(picked.orderNum)}</span>` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap;">
                                <span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.45); border-radius: 999px; padding: 3px 12px; font-size: ${teachingState.isProjectorMode ? '0.92rem' : '0.76rem'}; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
                                    <span>✅</span> <span>تم توثيق مشاركة التلميذ(ة) على السبورة</span>
                                </span>
                                <button type="button" onclick="pickRandomStudentForTeaching()" style="background: rgba(255, 255, 255, 0.1); color: #fde68a; border: 1px solid rgba(251, 191, 36, 0.45); border-radius: 8px; padding: 4px 10px; font-size: ${teachingState.isProjectorMode ? '0.88rem' : '0.74rem'}; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="اختيار تلميذ آخر بالقرعة">
                                    <span>🎲 اختيار تلميذ آخر</span>
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div style="text-align: center; font-size: 0.74rem; color: #94a3b8; padding: 6px;">
                            اضغط على زر القرعة لاختيار تلميذ حاضر بشكل عشوائي وعادل.
                        </div>
                    `}

                    ${teachingState.sessionParticipations.length > 0 ? `
                        <div style="margin-top: 8px; border-top: 1px solid rgba(148,163,184,0.2); padding-top: 6px; font-size: 0.72rem; color: #cbd5e1;">
                            <div style="font-weight: 800; color: #a7f3d0; margin-bottom: 3px;">📋 المشاركون على السبورة في هذه الحصة (${teachingState.sessionParticipations.length}):</div>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap; max-height: 54px; overflow-y: auto;">
                                ${teachingState.sessionParticipations.map(p => `<span style="background: rgba(15,23,42,0.75); border: 1px solid #334155; padding: 1px 6px; border-radius: 4px; font-size: 0.68rem;">${escapeHtml(p.name)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (teachingState.activeTab === 'subtimer') {
            const subPct = teachingState.subTimerTotalSeconds > 0
                ? Math.min(100, Math.max(0, Math.round(((teachingState.subTimerTotalSeconds - teachingState.subTimerRemainingSeconds) / teachingState.subTimerTotalSeconds) * 100)))
                : 0;
            tabBodyHtml = `
                <div style="background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 0.76rem; font-weight: 800; color: #fde68a;">⏳ مؤقت التمارين والبحث الفردي:</span>
                        <span style="font-size: 0.7rem; color: #cbd5e1;">${escapeHtml(teachingState.subTimerLabel)}</span>
                    </div>

                    <!-- أزرار الضبط السريع لمؤقت التمرين -->
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 8px;">
                        ${[2, 3, 5, 10, 15].map(m => `
                            <button type="button" onclick="startTeachingSubTimer(${m}, 'تمرين تطبيقي (${m} دقائق)')" style="background: rgba(15, 23, 42, 0.8); color: #38bdf8; border: 1px solid #334155; border-radius: 6px; padding: 5px 4px; font-size: 0.74rem; font-weight: 800; cursor: pointer;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#334155'">
                                ${m} د
                            </button>
                        `).join('')}
                    </div>

                    <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid ${teachingState.subTimerRunning ? '#fbbf24' : '#334155'}; border-radius: 8px; padding: 8px; text-align: center; margin-bottom: 8px;">
                        <div id="teachingSubTimerClockText" style="font-size: ${teachingState.isProjectorMode ? '2.4rem' : '1.65rem'}; font-weight: 900; font-family: monospace; color: ${teachingState.subTimerRemainingSeconds > 0 ? '#fbbf24' : '#94a3b8'}; line-height: 1.1;">
                            ${formatTime(teachingState.subTimerRemainingSeconds)}
                        </div>
                        <div style="width: 88%; margin: 6px auto 0 auto; background: #1e293b; height: 5px; border-radius: 999px; overflow: hidden;">
                            <div id="teachingSubTimerProgressBar" style="background: linear-gradient(90deg, #f59e0b, #fbbf24); width: ${subPct}%; height: 100%; transition: width 0.4s;"></div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="toggleTeachingSubTimerPause()" style="flex: 1; background: ${teachingState.subTimerRunning ? '#475569' : '#0284c7'}; color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                            ${teachingState.subTimerRunning ? '⏸️ إيقاف مؤقت للتمرين' : '▶️ تشغيل مؤقت التمرين'}
                        </button>
                        <button type="button" onclick="resetTeachingSubTimer()" style="background: #334155; color: #cbd5e1; border: 1px solid #475569; border-radius: 6px; padding: 6px 10px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
                            🔄 تصفير
                        </button>
                    </div>
                </div>
            `;
        } else if (teachingState.activeTab === 'board') {
            const mathSyms = ['√', 'π', '∞', '≤', '≥', '≠', '∈', 'ℝ', '⇒', '⇔', '∑', '∫', 'Δ'];
            tabBodyHtml = `
                <div style="background: rgba(30, 41, 59, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 10px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 0.76rem; font-weight: 800; color: #fde68a;">📐 سبورة التمرين والملخص الرياضي السريع:</span>
                        <span style="font-size: 0.68rem; color: #94a3b8;">يُدمج في دفتر النصوص</span>
                    </div>
                    <div style="display: flex; gap: 3px; flex-wrap: wrap; margin-bottom: 6px;">
                        ${mathSyms.map(sym => `
                            <button type="button" onclick="insertTeachingMathSymbol('${sym}')" style="background: #0f172a; color: #38bdf8; border: 1px solid #334155; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; font-family: monospace; font-weight: 800; cursor: pointer;">${sym}</button>
                        `).join('')}
                    </div>
                    <textarea id="teachingBoardNoteInput" rows="2" oninput="updateTeachingBoardNoteLive(this.value)" placeholder="اكتب رقم التمرين والصفحة أو الخاصية الرياضية لعرضها أمام التلاميذ وتوثيقها..." style="width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 7px; padding: 6px 8px; font-size: ${teachingState.isProjectorMode ? '1rem' : '0.78rem'}; font-family: inherit; resize: vertical; margin-bottom: 6px;">${escapeHtml(teachingState.boardNote)}</textarea>
                    <input type="text" oninput="updateTeachingHomeworkLive(this.value)" value="${escapeHtml(teachingState.homeworkNote)}" placeholder="🏠 الواجب المنزلي للحصة القادمة (مثال: تمرين 5 و 6 ص 72)..." style="width: 100%; background: #0f172a; color: #fde68a; border: 1px solid #475569; border-radius: 7px; padding: 5px 8px; font-size: 0.76rem; font-family: inherit;">
                </div>
            `;
        }

        widget.className = 'floating-teaching-timer-expanded';
        const cardWidth = teachingState.isProjectorMode ? 'min(920px, 96vw)' : '385px';

        widget.innerHTML = `
            <div style="background: linear-gradient(160deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 27, 75, 0.98) 100%); backdrop-filter: blur(14px); border: 2px solid ${isTimeUp ? '#ef4444' : '#d4af37'}; border-radius: 18px; width: ${cardWidth}; max-width: 96vw; padding: ${teachingState.isProjectorMode ? '22px' : '15px'}; box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.65); color: #f8fafc; font-family: 'Cairo', sans-serif;">
                
                <!-- Header (Drag Handle) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 8px; cursor: ${teachingState.isProjectorMode ? 'default' : 'move'};" id="teachingTimerDragHandle">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="background: rgba(212, 175, 55, 0.18); border: 1px solid rgba(212, 175, 55, 0.5); color: #fbbf24; width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.05rem;">⏱️</span>
                        <div>
                            <div style="font-weight: 900; font-size: ${teachingState.isProjectorMode ? '1.1rem' : '0.88rem'}; color: #ffffff; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <span>وضع التدريس التفاعلي</span>
                                <span style="background: ${teachingState.isAutoDetectedLive ? '#059669' : '#4f46e5'}; color: #fff; font-size: 0.64rem; padding: 1px 7px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25);">
                                    ${teachingState.isAutoDetectedLive ? '🟢 مرتبط بجدول الحصص' : '⚡ نشط'}
                                </span>
                            </div>
                            <div style="font-size: 0.71rem; color: #cbd5e1;">${escapeHtml(teachingState.slotLabel)}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button type="button" onclick="toggleTeachingProjectorMode()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; color: #fde68a; cursor: pointer; padding: 4px 7px; font-size: 0.74rem; font-weight: 800;" title="${teachingState.isProjectorMode ? 'العودة للوضع العائم' : 'تكبير للعرض على السبورة / Data Show'}">
                            ${teachingState.isProjectorMode ? '🗗 عائم' : '🖥️ Data Show'}
                        </button>
                        <button type="button" onclick="toggleTeachingTimerMinimize()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #cbd5e1; cursor: pointer; padding: 4px 7px; font-size: 0.75rem;" title="تصغير المؤقت إلى شريط عائم">
                            🗕
                        </button>
                        <button type="button" onclick="stopInteractiveTeachingMode()" style="background: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; color: #fca5a5; cursor: pointer; padding: 4px 7px; font-weight: bold; font-size: 0.75rem;" title="إغلاق وضع التدريس التفاعلي">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Class Selector + Live Attendance Snapshot -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; padding: 6px 10px; margin-bottom: 8px; gap: 8px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 150px;">
                        <span style="color: #fde68a; font-size: 0.76rem; font-weight: 800; white-space: nowrap;">القسم:</span>
                        <select onchange="window.setTeachingSessionClass(this.value)" style="flex: 1; background: #0f172a; color: #38bdf8; border: 1px solid #475569; padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 0.8rem; font-family: inherit;">
                            ${classes.map(c => `<option value="${escapeHtml(c)}" ${c === teachingState.className ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                        </select>
                    </div>
                    <div onclick="openAttendanceForTeachingClass()" style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; cursor: pointer; background: rgba(30, 41, 59, 0.9); padding: 3px 8px; border-radius: 6px; border: 1px solid #334155;" title="اضغط للانتقال إلى سجل الغياب لهذا القسم">
                        <span style="color: #6ee7b7; font-weight: 800;">حاضر: ${attendance.presentCount}/${attendance.total}</span>
                        <span style="color: ${attendance.absentCount > 0 ? '#fca5a5' : '#94a3b8'}; font-weight: 800;">• غائب: ${attendance.absentCount}</span>
                    </div>
                </div>

                <!-- Editable Lesson Topic Input -->
                <div style="margin-bottom: 10px;">
                    <input type="text" value="${escapeHtml(teachingState.sessionTopic)}" oninput="updateTeachingSessionTopicLive(this.value)" placeholder="📖 عنوان الدرس أو المحور الجاري (يُرحّل تلقائياً لدفتر النصوص)..." style="width: 100%; background: rgba(15, 23, 42, 0.75); color: #f8fafc; border: 1px solid rgba(212, 175, 55, 0.35); border-radius: 8px; padding: 6px 10px; font-size: ${teachingState.isProjectorMode ? '0.95rem' : '0.78rem'}; font-weight: 700; font-family: inherit;">
                </div>

                <!-- Main Countdown Digital Display + Phase Indicator -->
                <div style="text-align: center; margin-bottom: 10px; background: ${isTimeUp ? 'rgba(239, 68, 68, 0.18)' : 'rgba(15, 23, 42, 0.75)'}; border: 1.5px solid ${isTimeUp ? '#ef4444' : 'rgba(212, 175, 55, 0.4)'}; border-radius: 12px; padding: 10px 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #cbd5e1; margin-bottom: 4px;">
                        <span style="color: #fde68a; font-weight: 800;">${currentPhase.icon} ${currentPhase.title}</span>
                        <span id="teachingTimerProgressLabel" style="color: #94a3b8; font-weight: 700;">${percent}% من زمن الحصة</span>
                    </div>

                    <div id="teachingTimerClockText" style="font-size: ${teachingState.isProjectorMode ? '3.8rem' : '2.35rem'}; font-weight: 900; font-family: monospace, sans-serif; letter-spacing: 2px; color: ${isTimeUp ? '#ef4444' : (isWarning ? '#fbbf24' : '#38bdf8')}; line-height: 1.05;">
                        ${timeStr}
                    </div>

                    <!-- Progress bar -->
                    <div style="width: 92%; margin: 8px auto 6px auto; background: #1e293b; height: 7px; border-radius: 999px; overflow: hidden;">
                        <div id="teachingTimerProgressBar" style="background: ${isTimeUp ? '#ef4444' : 'linear-gradient(90deg, #d4af37, #38bdf8)'}; width: ${percent}%; height: 100%; border-radius: 999px; transition: width 0.5s;"></div>
                    </div>

                    <!-- Quick Duration Presets (55m, 60m, 110m, 120m) -->
                    <div style="display: flex; justify-content: center; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap;">
                        <span style="font-size: 0.66rem; color: #94a3b8;">مدة الحصة:</span>
                        ${[
                            { m: 55, l: '55 د' },
                            { m: 60, l: '1 س' },
                            { m: 110, l: '1س50' },
                            { m: 120, l: '2 س' }
                        ].map(preset => `
                            <button type="button" onclick="setTeachingDurationPreset(${preset.m})" style="background: rgba(51, 65, 85, 0.6); color: #e2e8f0; border: 1px solid #475569; border-radius: 5px; padding: 1px 6px; font-size: 0.66rem; font-weight: 700; cursor: pointer;">${preset.l}</button>
                        `).join('')}
                    </div>
                </div>

                <!-- Interactive Pedagogical Sub-Tabs Bar -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; background: rgba(15, 23, 42, 0.7); padding: 4px; border-radius: 9px; border: 1px solid rgba(148, 163, 184, 0.2);">
                    <button type="button" onclick="switchTeachingHudTab('phases')" style="background: ${teachingState.activeTab === 'phases' ? 'linear-gradient(135deg, #d4af37, #b45309)' : 'transparent'}; color: ${teachingState.activeTab === 'phases' ? '#fff' : '#cbd5e1'}; border: none; border-radius: 6px; padding: 5px 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer; font-family: inherit;">
                        🧭 المراحل
                    </button>
                    <button type="button" onclick="switchTeachingHudTab('picker')" style="background: ${teachingState.activeTab === 'picker' ? 'linear-gradient(135deg, #d4af37, #b45309)' : 'transparent'}; color: ${teachingState.activeTab === 'picker' ? '#fff' : '#cbd5e1'}; border: none; border-radius: 6px; padding: 5px 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer; font-family: inherit;">
                        🎲 القرعة (${teachingState.sessionParticipations.length})
                    </button>
                    <button type="button" onclick="switchTeachingHudTab('subtimer')" style="background: ${teachingState.activeTab === 'subtimer' ? 'linear-gradient(135deg, #d4af37, #b45309)' : 'transparent'}; color: ${teachingState.activeTab === 'subtimer' ? '#fff' : '#cbd5e1'}; border: none; border-radius: 6px; padding: 5px 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer; font-family: inherit;">
                        ⏳ تمرين ${teachingState.subTimerRunning ? '🟢' : ''}
                    </button>
                    <button type="button" onclick="switchTeachingHudTab('board')" style="background: ${teachingState.activeTab === 'board' ? 'linear-gradient(135deg, #d4af37, #b45309)' : 'transparent'}; color: ${teachingState.activeTab === 'board' ? '#fff' : '#cbd5e1'}; border: none; border-radius: 6px; padding: 5px 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer; font-family: inherit;">
                        📐 السبورة
                    </button>
                </div>

                <!-- Active Sub-Tab Body -->
                <div style="margin-bottom: 10px;">
                    ${tabBodyHtml}
                </div>

                <!-- Main Timer Controls Toolbar -->
                <div style="display: flex; gap: 6px; justify-content: center; align-items: center; margin-bottom: 8px;">
                    <button type="button" onclick="toggleTeachingTimerPause()" style="flex: 1; background: ${teachingState.isPaused ? '#10b981' : '#334155'}; color: #fff; border: 1px solid ${teachingState.isPaused ? '#34d399' : '#475569'}; padding: 7px 10px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
                        <span>${teachingState.isPaused ? '▶️ استئناف الحصة' : '⏸️ إيقاف مؤقت'}</span>
                    </button>
                    <button type="button" onclick="extendTeachingTimer(5)" style="background: #1e293b; color: #f8fafc; border: 1px solid #475569; padding: 7px 9px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer;" title="إضافة 5 دقائق للحصة">
                        +5 د
                    </button>
                    <button type="button" onclick="extendTeachingTimer(-5)" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; padding: 7px 9px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer;" title="إنقاص 5 دقائق من المؤقت">
                        -5 د
                    </button>
                    <button type="button" onclick="toggleTeachingSound()" style="background: #1e293b; color: ${teachingState.soundEnabled ? '#fbbf24' : '#94a3b8'}; border: 1px solid #475569; padding: 7px 10px; border-radius: 8px; font-size: 0.82rem; cursor: pointer;" title="تفعيل/تعطيل التنبيه الصوتي">
                        ${teachingState.soundEnabled ? '🔔' : '🔕'}
                    </button>
                </div>

                <!-- Finish Session & Auto-Document in Cahier de Textes -->
                <button type="button" onclick="finishTeachingSession()" style="width: 100%; background: linear-gradient(135deg, #d4af37, #b45309); color: #ffffff; border: 1px solid #fde68a; padding: 9px 12px; border-radius: 9px; font-weight: 900; font-size: 0.84rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 14px rgba(212, 175, 55, 0.35);">
                    <span>✍️ إنهاء الحصة وتوثيقها تلقائياً في دفتر النصوص ⚡</span>
                </button>
            </div>
        `;

        setupTimerDrag();
    }

    // إبقاء الاسم القديم متوافقاً مع أي استدعاء خارجي
    const updateFloatingTimerDisplay = renderFloatingTimerStructure;

    function setupTimerDrag() {
        const handle = document.getElementById('teachingTimerDragHandle');
        const widget = document.getElementById('floatingTeachingTimerWidget');
        if (!handle || !widget || handle._dragAttached || teachingState.isProjectorMode) return;
        handle._dragAttached = true;

        let isDragging = false;
        let startX = 0, startY = 0;
        let startLeft = 0, startTop = 0;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
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
            const newLeft = `${Math.max(10, Math.min(window.innerWidth - 360, startLeft + dx))}px`;
            const newTop = `${Math.max(10, Math.min(window.innerHeight - 100, startTop + dy))}px`;
            widget.style.left = newLeft;
            widget.style.top = newTop;
            widget.dataset.savedLeft = newLeft;
            widget.dataset.savedTop = newTop;
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

    /**
     * إنهاء الحصة التفاعلية وتعبئة نافذة دفتر النصوص تلقائياً بكل ما تم إنجازه خلال الحصة
     */
    window.finishTeachingSession = function () {
        const cls = teachingState.className;
        const completedPhaseTitles = Array.from(teachingState.completedPhases)
            .sort((a, b) => a - b)
            .map(idx => DIDACTIC_PHASES[idx] ? DIDACTIC_PHASES[idx].title : '')
            .filter(Boolean);

        const summaryParts = [];
        if (completedPhaseTitles.length > 0) {
            summaryParts.push(`• المراحل الديداكتيكية المنجزة: ${completedPhaseTitles.join(' ← ')}.`);
        }
        if (teachingState.boardNote && teachingState.boardNote.trim() !== '') {
            summaryParts.push(`• الأنشطة والتمارين المعالجة على السبورة: ${teachingState.boardNote.trim()}`);
        }
        if (summaryParts.length === 0 && teachingState.sessionTopic) {
            summaryParts.push(`• إنجاز أنشطة وفقرات درس (${teachingState.sessionTopic}) مع تمارين تطبيقية.`);
        }

        const participantNames = Array.from(new Set(teachingState.sessionParticipations.map(p => p.name)));
        const notesParts = [];
        if (participantNames.length > 0) {
            notesParts.push(`المشاركون على السبورة (${participantNames.length}): ${participantNames.join('، ')}`);
        }

        const prefillData = {
            title: teachingState.sessionTopic || '',
            timeSlot: (teachingState.startTimeStr && teachingState.endTimeStr)
                ? `${teachingState.startTimeStr} - ${teachingState.endTimeStr}`
                : '08:00 - 10:00',
            duration: String(teachingState.durationHours || 2),
            summary: summaryParts.join('\n'),
            homework: teachingState.homeworkNote || '',
            notes: notesParts.join(' | ')
        };

        window.stopInteractiveTeachingMode();
        window.addQuickSession(cls, prefillData);
    };

    function ensureFloatingTimerDom() {
        let el = document.getElementById('floatingTeachingTimerWidget');
        if (!el) {
            el = document.createElement('div');
            el.id = 'floatingTeachingTimerWidget';
            el.style.position = 'fixed';
            el.style.top = '72px';
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
