/**
 * ====================================================================
 * نظام التنبيهات البيداغوجي الذكي للفروض المحروسة والغيابات المتكررة
 * Smart Pre-Exam Alert & Frequent Absence Detection System
 * ====================================================================
 * يقوم بإخطار الأستاذ آلياً قبل يومين من موعد أي فرض محروس مسجل في
 * التقويم السنوي، مع تحليل بيانات الأقسام واقتراح قائمة بالتلاميذ
 * الذين لديهم غيابات متكررة لتنظيم دعم استدراكي وإشعار أسرهم.
 */

(function (window) {
    'use strict';

    let currentSelectedExamId = null;
    let smartAlertsCache = null;

    /**
     * استخراج كافة الفروض المحروسة والامتحانات المسجلة في التقويم السنوي
     */
    function getRegisteredExams() {
        const exams = [];
        const seenIds = new Set();

        // 1. من المحطات التربوية المعتمدة في التقويم السنوي
        let milestones = [];
        if (typeof window.getAcademicMilestones === 'function') {
            milestones = window.getAcademicMilestones();
        } else if (window.db && Array.isArray(window.db.academicMilestones)) {
            milestones = window.db.academicMilestones;
        }

        milestones.forEach(ms => {
            const isExamCategory = ms.category === 'exam' || ms.category === 'certification' || ms.category === 'assessment';
            const isExamTitle = /فرض|امتحان|اختبار|évaluation|contrôle/i.test(ms.title || '');
            if ((isExamCategory || isExamTitle) && !seenIds.has(ms.id)) {
                seenIds.add(ms.id);
                exams.push({
                    id: ms.id,
                    title: ms.title,
                    startDate: ms.startDate,
                    endDate: ms.endDate || ms.startDate,
                    category: ms.category || 'exam',
                    semester: ms.semester || 's1',
                    semesterLabel: ms.semesterLabel || (ms.semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول'),
                    targetLevels: ms.targetLevels || 'جميع الأقسام والمستويات',
                    description: ms.description || '',
                    source: 'milestone'
                });
            }
        });

        // 2. من أحداث الأجندة والتقويم الشهري (calendarEvents)
        if (window.db && Array.isArray(window.db.calendarEvents)) {
            window.db.calendarEvents.forEach(ev => {
                const isExamType = ev.type === 'exam' || /فرض|امتحان/i.test(ev.title || '');
                if (isExamType && ev.date && !seenIds.has('ev_' + ev.id)) {
                    seenIds.add('ev_' + ev.id);
                    exams.push({
                        id: 'ev_' + (ev.id || Math.random().toString(36).substring(2, 9)),
                        title: ev.title || 'فرض محروس',
                        startDate: ev.date,
                        endDate: ev.date,
                        category: 'exam',
                        semester: 's1',
                        semesterLabel: 'التقويم المدرسي',
                        targetLevels: ev.className || 'جميع الأقسام',
                        description: ev.description || '',
                        source: 'event'
                    });
                }
            });
        }

        // 3. من المفكرة والمواعيد البيداغوجية المسجلة (agenda)
        if (window.db && Array.isArray(window.db.agenda)) {
            window.db.agenda.forEach(ag => {
                const isExamType = ag.type === 'exam' || /فرض|امتحان|contrôle|test/i.test(ag.title || ag.topic || '');
                const examDate = ag.date || ag.deadline;
                if (isExamType && examDate && !seenIds.has('ag_' + ag.id)) {
                    seenIds.add('ag_' + ag.id);
                    exams.push({
                        id: 'ag_' + (ag.id || Math.random().toString(36).substring(2, 9)),
                        title: ag.title || ag.topic || 'فرض محروس',
                        startDate: examDate,
                        endDate: examDate,
                        category: 'exam',
                        semester: ag.semester || 's1',
                        semesterLabel: 'المفكرة التربوية',
                        targetLevels: ag.className || 'جميع الأقسام',
                        description: ag.notes || ag.description || '',
                        source: 'agenda'
                    });
                }
            });
        }

        // 4. من الفروض القادمة المسجلة في تبويب التقارير (upcomingExams)
        if (window.db && Array.isArray(window.db.upcomingExams)) {
            window.db.upcomingExams.forEach(ue => {
                if (ue.date && ue.status !== 'completed' && !seenIds.has('ue_' + ue.id)) {
                    seenIds.add('ue_' + ue.id);
                    exams.push({
                        id: 'ue_' + ue.id,
                        title: ue.title || 'فرض محروس',
                        startDate: ue.date,
                        endDate: ue.date,
                        category: 'exam',
                        semester: ue.semester || 's1',
                        semesterLabel: 'الفروض المبرمجة',
                        targetLevels: ue.className || 'جميع الأقسام',
                        description: ue.topics || ue.subject || '',
                        source: 'upcoming_exams'
                    });
                }
            });
        }

        // فرز الفروض ترتيباً زمنياً تصاعدياً
        exams.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
        return exams;
    }

    /**
     * حساب الفرق بالأيام بين تاريخين
     */
    function diffInDays(targetDateStr, baseDate) {
        if (!targetDateStr) return 999;
        const base = baseDate instanceof Date ? baseDate : (typeof window.getAppNow === 'function' ? window.getAppNow() : new Date());
        
        // استخراج أجزاء التاريخ المحلي لتفادي مشاكل فروق التوقيت
        const baseParts = [base.getFullYear(), base.getMonth(), base.getDate()];
        const targetParts = targetDateStr.split('-').map(Number);
        if (targetParts.length !== 3) return 999;

        const dBase = new Date(baseParts[0], baseParts[1], baseParts[2]);
        const dTarget = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
        
        const diffMs = dTarget.getTime() - dBase.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    let _cachedNextExam = null;
    let _cachedNextExamTime = 0;

    if (typeof window !== 'undefined') {
        window.addEventListener('dbUpdated', () => {
            _cachedNextExamTime = 0;
        });
    }

    /**
     * استخراج أقرب فرض محروس قادم زمنياً ومخزن في التقويم (مع تخزين مؤقت ذكي لتخفيف المعالجة)
     */
    function getNextUpcomingExam() {
        const nowMs = Date.now();
        if (_cachedNextExamTime && (nowMs - _cachedNextExamTime < 20000)) {
            return _cachedNextExam;
        }
        const exams = getRegisteredExams();
        if (!exams || exams.length === 0) {
            _cachedNextExam = null;
            _cachedNextExamTime = nowMs;
            return null;
        }
        
        const now = typeof window.getAppNow === 'function' ? window.getAppNow() : new Date();
        const todayStr = (window.formatLocalDate ? window.formatLocalDate() : now.toLocaleDateString('en-CA'));
        
        // الفروض القادمة (اليوم أو في المستقبل)
        const upcoming = exams.filter(ex => {
            if (!ex.startDate) return false;
            if (ex.startDate > todayStr) return true;
            if (ex.startDate === todayStr) {
                const endToday = new Date(`${todayStr}T18:00:00`);
                return now <= endToday;
            }
            return false;
        });

        if (upcoming.length > 0) {
            upcoming.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
            _cachedNextExam = upcoming[0];
        } else {
            _cachedNextExam = exams[0] || null;
        }
        _cachedNextExamTime = nowMs;
        return _cachedNextExam;
    }

    /**
     * حساب العد التنازلي الدقيق (أيام، ساعات، دقائق، ثوانٍ) لأي موعد فرض
     */
    function getExamCountdown(exam) {
        if (!exam || !exam.startDate) return null;
        const now = typeof window.getAppNow === 'function' ? window.getAppNow() : new Date();
        const todayStr = (window.formatLocalDate ? window.formatLocalDate() : now.toLocaleDateString('en-CA'));
        
        const timeStr = exam.time || '08:30:00';
        let target = new Date(`${exam.startDate}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}`);
        if (isNaN(target.getTime())) {
            target = new Date(`${exam.startDate}T08:30:00`);
        }
        
        const isToday = (exam.startDate === todayStr);
        let diffMs = target.getTime() - now.getTime();
        let isLiveNow = false;
        let isPast = false;
        
        if (diffMs <= 0) {
            if (isToday) {
                const endOfDay = new Date(`${exam.startDate}T18:00:00`);
                if (now <= endOfDay) {
                    isLiveNow = true;
                    diffMs = endOfDay.getTime() - now.getTime();
                } else {
                    isPast = true;
                    diffMs = 0;
                }
            } else {
                isPast = true;
                diffMs = 0;
            }
        }
        
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        return {
            exam,
            diffMs,
            days,
            hours,
            minutes,
            seconds,
            isToday,
            isLiveNow,
            isPast,
            daysLeft: days,
            isCritical: (days < 2 && !isPast),
            formattedClock: `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        };
    }

    /**
     * بناء وسم HTML مرئي وتفاعلي للعد التنازلي للفرض القادم
     */
    function buildExamCountdownWidgetHtml(exam, opts = {}) {
        if (!exam) return '';
        const cd = getExamCountdown(exam);
        if (!cd) return '';
        const { days, hours, minutes, seconds, isCritical, isToday, isLiveNow, isPast } = cd;
        const { compact = false, showHeader = true, idPrefix = 'banner' } = opts;
        
        if (isPast) {
            return `
                <div class="smart-exam-countdown-card" data-exam-id="${exam.id}" data-exam-date="${exam.startDate}" style="display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 10px; font-size: 0.74rem; color: #64748b; font-weight: 700;">
                    <span data-lucide="check-circle" data-size="14"></span>
                    <span>انقضت محطة الفرض</span>
                </div>
            `;
        }

        const borderCol = isLiveNow ? '#dc2626' : isCritical ? '#ea580c' : '#2563eb';
        const bgCol = isLiveNow ? '#fef2f2' : isCritical ? '#fff7ed' : '#eff6ff';
        const numCol = isLiveNow ? '#dc2626' : isCritical ? '#c2410c' : '#1e3a8a';
        
        return `
        <div class="smart-exam-countdown-card" id="${idPrefix}_exam_cd_card_${exam.id}" data-exam-id="${exam.id}" data-exam-date="${exam.startDate}" style="background: ${bgCol}; border: 1.5px solid ${borderCol}55; border-radius: 12px; padding: ${compact ? '6px 12px' : '8px 14px'}; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            ${showHeader ? `
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="background: ${borderCol}; color: #ffffff; width: ${compact ? '26px' : '30px'}; height: ${compact ? '26px' : '30px'}; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <span data-lucide="${isLiveNow ? 'flame' : isCritical ? 'alert-triangle' : 'hourglass'}" data-size="${compact ? 13 : 16}"></span>
                </div>
                <div>
                    <span style="font-size: ${compact ? '0.72rem' : '0.78rem'}; font-weight: 800; color: ${numCol}; display: block; line-height: 1.2;">
                        ${isLiveNow ? '🚨 موعد الفرض جارٍ اليوم!' : isCritical ? '⚠️ اقتراب موعد الفرض (أقل من 48 ساعة):' : '⏱️ العد التنازلي لموعد الفرض القادم:'}
                    </span>
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 600;">
                        ${escapeHtml(exam.title)} (${exam.startDate})
                    </span>
                </div>
            </div>
            ` : ''}
            <div class="smart-exam-digits-display" id="${idPrefix}_digits_${exam.id}" style="display: inline-flex; align-items: center; gap: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; direction: ltr;">
                <div style="background: #ffffff; border: 1px solid ${borderCol}33; border-radius: 7px; padding: 2px 7px; text-align: center; min-width: 36px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span class="exam-cd-val-days" style="font-size: ${compact ? '0.86rem' : '1.05rem'}; color: ${numCol}; font-weight: 900;">${cd.days}</span>
                    <span style="font-size: 0.58rem; color: #64748b; display: block; line-height: 1; font-family: 'Cairo', sans-serif;">يوم</span>
                </div>
                <span style="color: ${borderCol}; font-weight: 900; font-size: 0.9rem;">:</span>
                <div style="background: #ffffff; border: 1px solid ${borderCol}33; border-radius: 7px; padding: 2px 7px; text-align: center; min-width: 36px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span class="exam-cd-val-hours" style="font-size: ${compact ? '0.86rem' : '1.05rem'}; color: ${numCol}; font-weight: 900;">${String(cd.hours).padStart(2, '0')}</span>
                    <span style="font-size: 0.58rem; color: #64748b; display: block; line-height: 1; font-family: 'Cairo', sans-serif;">ساعة</span>
                </div>
                <span style="color: ${borderCol}; font-weight: 900; font-size: 0.9rem;">:</span>
                <div style="background: #ffffff; border: 1px solid ${borderCol}33; border-radius: 7px; padding: 2px 7px; text-align: center; min-width: 36px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span class="exam-cd-val-mins" style="font-size: ${compact ? '0.86rem' : '1.05rem'}; color: ${numCol}; font-weight: 900;">${String(cd.minutes).padStart(2, '0')}</span>
                    <span style="font-size: 0.58rem; color: #64748b; display: block; line-height: 1; font-family: 'Cairo', sans-serif;">دقيقة</span>
                </div>
                <span style="color: ${borderCol}; font-weight: 900; font-size: 0.9rem;">:</span>
                <div style="background: #ffffff; border: 1px solid ${borderCol}33; border-radius: 7px; padding: 2px 7px; text-align: center; min-width: 36px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span class="exam-cd-val-secs" style="font-size: ${compact ? '0.86rem' : '1.05rem'}; color: ${isLiveNow ? '#dc2626' : isCritical ? '#ea580c' : '#2563eb'}; font-weight: 900;">${String(cd.seconds).padStart(2, '0')}</span>
                    <span style="font-size: 0.58rem; color: ${isLiveNow ? '#dc2626' : isCritical ? '#ea580c' : '#2563eb'}; display: block; line-height: 1; font-family: 'Cairo', sans-serif;">ثانية</span>
                </div>
            </div>
        </div>
        `;
    }

    /**
     * تحديث نبضات العد التنازلي التلقائي لجميع شاشات العرض كل ثانية (محسن للأداء)
     */
    function tickExamCountdownDisplays() {
        if (typeof document !== 'undefined' && document.hidden) return;
        const nextExam = getNextUpcomingExam();
        if (!nextExam) return;
        
        const cd = getExamCountdown(nextExam);
        if (!cd) return;
        
        // 1. تحديث زر وشارة شريط الهيدر بدون إعادة بناء الـ DOM وبصيغة مدمجة
        const headerPill = document.getElementById('headerSmartExamCountdownPill');
        if (headerPill) {
            if (headerPill.style.display !== 'inline-block') headerPill.style.display = 'inline-block';
            const newText = `${cd.days}ي ${String(cd.hours).padStart(2, '0')}س`;
            if (headerPill.textContent !== newText) {
                headerPill.textContent = newText;
            }
            const newTitle = `العد التنازلي لموعد ${nextExam.title} (${nextExam.startDate}): ${cd.days} يوم و ${cd.hours} ساعة و ${cd.minutes} دقيقة`;
            if (headerPill.title !== newTitle) {
                headerPill.title = newTitle;
            }
        }

        // 2. تحديث العدادات الحية المرئية فقط بالصفحة
        const cards = document.querySelectorAll('.smart-exam-countdown-card');
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (card.offsetParent === null) continue;
            const examId = card.getAttribute('data-exam-id');
            const examDate = card.getAttribute('data-exam-date');
            let thisCd = cd;
            if (examId && examId !== nextExam.id) {
                thisCd = getExamCountdown({ id: examId, startDate: examDate });
            }
            if (!thisCd) continue;
            
            const daysEl = card.querySelector('.exam-cd-val-days');
            const hoursEl = card.querySelector('.exam-cd-val-hours');
            const minsEl = card.querySelector('.exam-cd-val-mins');
            const secsEl = card.querySelector('.exam-cd-val-secs');
            
            if (daysEl && daysEl.textContent !== String(thisCd.days)) daysEl.textContent = thisCd.days;
            const hStr = String(thisCd.hours).padStart(2, '0');
            if (hoursEl && hoursEl.textContent !== hStr) hoursEl.textContent = hStr;
            const mStr = String(thisCd.minutes).padStart(2, '0');
            if (minsEl && minsEl.textContent !== mStr) minsEl.textContent = mStr;
            const sStr = String(thisCd.seconds).padStart(2, '0');
            if (secsEl && secsEl.textContent !== sStr) secsEl.textContent = sStr;
        }
    }

    // إطلاق مؤقت العد التنازلي الحي بالثواني
    if (typeof window !== 'undefined' && !window._smartExamCountdownInterval) {
        window._smartExamCountdownInterval = setInterval(tickExamCountdownDisplays, 1000);
    }

    /**
     * فحص التنبيهات الذكية للفروض التي يحل موعدها بعد يومين (أو اليوم / غداً)
     */
    function checkSmartExamAlerts() {
        const exams = getRegisteredExams();
        const now = typeof window.getAppNow === 'function' ? window.getAppNow() : new Date();
        const nextExam = getNextUpcomingExam();

        // البحث عن الفروض التي يتبقى على بدايتها ما بين 0 و 2 يوم
        // (أي: قبل يومين بالتحديد، أو غداً، أو اليوم)
        const criticalAlertExams = [];
        const upcomingExams = [];

        exams.forEach(exam => {
            const daysLeft = diffInDays(exam.startDate, now);
            exam.daysLeft = daysLeft;

            if (daysLeft >= 0 && daysLeft <= 2) {
                // هذا هو شرط التنبيه الذكي المطلوب: قبل يومين من موعد الفرض
                criticalAlertExams.push(exam);
            } else if (daysLeft > 2) {
                upcomingExams.push(exam);
            }
        });

        smartAlertsCache = {
            criticalAlertExams,
            upcomingExams,
            allExams: exams,
            nextUpcomingExam: nextExam,
            hasActiveAlert: criticalAlertExams.length > 0,
            primaryExam: criticalAlertExams[0] || nextExam || upcomingExams[0] || exams[0] || null
        };

        // تحديث شارات وتنبيهات الواجهة
        updateSmartAlertsUI();
        tickExamCountdownDisplays();

        // إطلاق التنبيه الصوتي الذكي في حال وجود فرض حرج خلال 48 ساعة (مع مراعاة فترة التهدئة)
        if (criticalAlertExams.length > 0 && typeof triggerExamAlertSound === 'function') {
            const firstExam = criticalAlertExams[0];
            triggerExamAlertSound(firstExam.title, firstExam.daysLeft, false);
        }

        return smartAlertsCache;
    }

    /**
     * استخراج التلاميذ الذين لديهم غيابات متكررة في الأقسام المعنية بالفرض
     */
    function getHighAbsenceStudentsForExam(exam) {
        if (!window.db || !window.db.classes) return [];

        const targetLevels = (exam && exam.targetLevels) ? exam.targetLevels.toLowerCase() : '';
        const allClasses = Object.keys(window.db.classes);
        let relevantClasses = allClasses;

        // مطابقة الأقسام إذا كانت المحطة محددة لقسم معين
        if (targetLevels && !targetLevels.includes('جميع')) {
            const matched = allClasses.filter(c => targetLevels.includes(c.toLowerCase()));
            if (matched.length > 0) relevantClasses = matched;
        }

        const absenceThreshold = (window.db.absenceThreshold || 10);
        // معيار الغياب المتكرر: 4 ساعات فأكثر أو 3 غيابات فأكثر، أو إخلال متكرر بالواجب
        const FREQUENT_ABSENCE_MIN_HOURS = 4;

        const results = [];

        relevantClasses.forEach(className => {
            const students = window.db.classes[className] || [];
            students.forEach(std => {
                let totalAbsent = 0;
                let unjustifiedHours = 0;
                let justifiedHours = 0;
                let lateCount = 0;
                let missedHw = 0;
                const absenceDates = [];

                if (Array.isArray(window.db.records)) {
                    window.db.records.forEach(r => {
                        if (r.studentId === std.id && r.className === className) {
                            const dur = r.duration || 1;
                            if (r.status === 'غائب') {
                                totalAbsent += dur;
                                unjustifiedHours += dur;
                                absenceDates.push({ date: r.date, session: r.session, type: 'غائب', dur });
                            } else if (r.status === 'مبرر') {
                                totalAbsent += dur;
                                justifiedHours += dur;
                                absenceDates.push({ date: r.date, session: r.session, type: 'مبرر', dur });
                            } else if (r.status === 'متأخر') {
                                lateCount++;
                            }
                            if (r.homework === 'لم ينجز') {
                                missedHw++;
                            }
                        }
                    });
                }

                // حساب درجات الفروض السابقة إن وجدت
                let previousExamAvg = null;
                if (typeof window.getStudentGradesBySemester === 'function') {
                    const s1Grades = window.getStudentGradesBySemester(className, std.id, 's1');
                    const s2Grades = window.getStudentGradesBySemester(className, std.id, 's2');
                    const gradesList = [];
                    ['f1', 'f2', 'f3'].forEach(k => {
                        if (s1Grades && s1Grades[k] !== undefined && s1Grades[k] !== '') gradesList.push(Number(s1Grades[k]));
                        if (s2Grades && s2Grades[k] !== undefined && s2Grades[k] !== '') gradesList.push(Number(s2Grades[k]));
                    });
                    if (gradesList.length > 0) {
                        previousExamAvg = (gradesList.reduce((a, b) => a + b, 0) / gradesList.length).toFixed(2);
                    }
                }

                // تقييم مستوى الخطورة البيداغوجية
                let riskLevel = 'none';
                let riskLabel = 'عادي';
                let riskBadgeColor = '#10b981';
                let riskBg = '#ecfdf5';

                if (totalAbsent >= 8 || totalAbsent >= absenceThreshold) {
                    riskLevel = 'critical';
                    riskLabel = 'حرج جداً (خطر تعثر كبير)';
                    riskBadgeColor = '#dc2626';
                    riskBg = '#fee2e2';
                } else if (totalAbsent >= FREQUENT_ABSENCE_MIN_HOURS || unjustifiedHours >= 4) {
                    riskLevel = 'high';
                    riskLabel = 'غياب متكرر مقلق';
                    riskBadgeColor = '#ea580c';
                    riskBg = '#ffedd5';
                } else if (totalAbsent >= 2 || missedHw >= 3) {
                    riskLevel = 'medium';
                    riskLabel = 'تنبيه ومتابعة وقائية';
                    riskBadgeColor = '#d97706';
                    riskBg = '#fef3c7';
                }

                if (riskLevel !== 'none') {
                    results.push({
                        id: std.id,
                        name: std.name,
                        phone: std.phone || '',
                        massar: std.massar || '-',
                        orderNum: std.orderNum || '',
                        className: className,
                        totalAbsent,
                        unjustifiedHours,
                        justifiedHours,
                        lateCount,
                        missedHw,
                        previousExamAvg,
                        absenceDates,
                        riskLevel,
                        riskLabel,
                        riskBadgeColor,
                        riskBg
                    });
                }
            });
        });

        // فرز التلاميذ تنازلياً حسب مجموع ساعات الغياب
        results.sort((a, b) => b.totalAbsent - a.totalAbsent || b.unjustifiedHours - a.unjustifiedHours);
        return results;
    }

    /**
     * تحديث شارات التنبيه في زر تبويب لوحة القيادة في الهيدر والبار العلوي
     */
    function updateDashboardTabExamBadge(count) {
        ['tabDashboard', 'tabDashboardTab', 'headerDashboardBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            let badge = btn.querySelector('.smart-exam-tab-badge');
            if (count > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'smart-exam-tab-badge';
                    badge.style.cssText = 'background: #dc2626; color: #ffffff; font-size: 0.68rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; margin-right: 6px; box-shadow: 0 2px 5px rgba(220, 38, 38, 0.4);';
                    btn.appendChild(badge);
                }
                badge.textContent = `🚨 ${count}`;
                badge.style.display = 'inline-block';
            } else if (badge) {
                badge.style.display = 'none';
            }
        });
    }

    /**
     * تحديث شارات التنبيه في الهيدر والبانرات الرئيسية
     */
    function updateSmartAlertsUI() {
        if (!smartAlertsCache) smartAlertsCache = checkSmartExamAlerts();
        const { criticalAlertExams, upcomingExams, primaryExam, hasActiveAlert } = smartAlertsCache;

        // 1. زر الهيدر
        const headerBtn = document.getElementById('headerSmartExamAlertBtn');
        const headerBadge = document.getElementById('headerSmartExamBadge');
        if (headerBtn) {
            if (hasActiveAlert) {
                headerBtn.style.display = 'inline-flex';
                if (headerBadge) {
                    headerBadge.textContent = criticalAlertExams.length;
                    headerBadge.style.display = 'inline-block';
                }
            } else {
                headerBtn.style.display = 'inline-flex';
                headerBtn.style.opacity = '0.85';
                if (headerBadge) {
                    headerBadge.textContent = '0';
                    headerBadge.style.display = 'none';
                }
            }
        }

        // 2. حصر التنبيهات المنبثقة حصرياً في تبويب التقويم وفق طلب الأستاذ
        const homeBanner = document.getElementById('homeSmartExamAlertBanner');
        if (homeBanner) {
            homeBanner.style.display = 'none';
        }

        // 3. تعطيل البانر في تبويب الغياب لمنع التشويش أثناء رصد الحضور
        const absenceBanner = document.getElementById('absenceSmartExamAlertBanner');
        if (absenceBanner) {
            absenceBanner.style.display = 'none';
        }

        // 3-ب. تفعيل البانر حصرياً داخل مركز تنبيهات تبويب التقويم
        const calBanner = document.getElementById('calendarSmartExamAlertBanner');
        if (calBanner) {
            const isCalActive = (typeof window.activeTab !== 'undefined' && window.activeTab === 'calendar');
            if (isCalActive && hasActiveAlert) {
                renderExamAlertBannerHtml(calBanner, primaryExam, hasActiveAlert);
            } else {
                calBanner.style.display = 'none';
            }
        }

        // 4. البانر وقسم الإشعارات الذكي في لوحة القيادة (dashboard)
        const dashContainer = document.getElementById('dashSmartExamAlertsSection') || document.getElementById('dashSmartExamAlertBanner');
        if (dashContainer) {
            renderDashboardExamAlerts(dashContainer, smartAlertsCache);
        }

        // 5. بطاقة مؤشرات KPI في لوحة القيادة (الفروض القادمة)
        const kpiCount = document.getElementById('dashKpiUpcomingExamsCount');
        const kpiDays = document.getElementById('dashKpiUpcomingExamsDaysLeft');
        const kpiText = document.getElementById('dashKpiUpcomingExamsText');
        if (kpiCount) {
            const count = (criticalAlertExams.length > 0) ? criticalAlertExams.length : (upcomingExams.length || 0);
            kpiCount.textContent = count;
        }
        if (kpiDays) {
            if (primaryExam) {
                const d = primaryExam.daysLeft;
                if (d === 0) kpiDays.textContent = 'اليوم!';
                else if (d === 1) kpiDays.textContent = 'غداً (24س)';
                else if (d === 2) kpiDays.textContent = 'بعد يومين (48س)';
                else if (d > 2) kpiDays.textContent = `بعد ${d} أيام`;
                else kpiDays.textContent = primaryExam.startDate;
            } else {
                kpiDays.textContent = 'لا توجد فروض قريبة';
            }
        }
        if (kpiText && primaryExam) {
            kpiText.textContent = primaryExam.title;
        }

        // 6. شارة تنبيه على زر تبويب لوحة القيادة
        updateDashboardTabExamBadge(criticalAlertExams.length);

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * ====================================================================
     * محرك التذكير الصوتي المتقدم (Notification Sound Engine)
     * ====================================================================
     * يعتمد على Web Audio API لتوليد نغمات تنبيه نقية وفورية
     * دون أي اعتماد على ملفات mp3 خارجية أو مشاكل في شبكة الإنترنت.
     */
    function playBellStrike(ctx, dest, f1, f2, startTime, duration, vol) {
        [f1, f2, f1 * 2].forEach((freq, idx) => {
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = idx === 1 ? 'sine' : (idx === 2 ? 'triangle' : 'sine');
                osc.frequency.setValueAtTime(freq, startTime);
                
                const noteVol = (idx === 0 ? 0.65 : (idx === 1 ? 0.35 : 0.15)) * vol;
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(noteVol, startTime + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
                
                osc.connect(gain);
                gain.connect(dest);
                osc.start(startTime);
                osc.stop(startTime + duration + 0.05);
            } catch(e) {}
        });
    }

    function playSineNote(ctx, dest, freq, startTime, duration, vol) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.5 * vol, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            osc.connect(gain);
            gain.connect(dest);
            osc.start(startTime);
            osc.stop(startTime + duration + 0.05);
        } catch(e) {}
    }

    function playWarmNote(ctx, dest, freq, startTime, duration, vol) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.65 * vol, startTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            osc.connect(gain);
            gain.connect(dest);
            osc.start(startTime);
            osc.stop(startTime + duration + 0.05);
        } catch(e) {}
    }

    function playDigitalBeep(ctx, dest, freq, startTime, duration, vol) {
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.55 * vol, startTime + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            osc.connect(gain);
            gain.connect(dest);
            osc.start(startTime);
            osc.stop(startTime + duration + 0.02);
        } catch(e) {}
    }

    function playResonantPing(ctx, dest, fBase, fHarmonic, startTime, duration, vol) {
        [fBase, fHarmonic].forEach((freq, idx) => {
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = idx === 0 ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime((idx === 0 ? 0.7 : 0.3) * vol, startTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
                osc.connect(gain);
                gain.connect(dest);
                osc.start(startTime);
                osc.stop(startTime + duration + 0.05);
            } catch(e) {}
        });
    }

    function playUrgentPulse(ctx, dest, startTime, vol) {
        [880, 1174.66].forEach(freq => {
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.22 * vol, startTime + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);
                osc.connect(gain);
                gain.connect(dest);
                osc.start(startTime);
                osc.stop(startTime + 0.18);
            } catch(e) {}
        });
    }

    const SmartAudioAlert = {
        ctx: null,
        lastExamTriggerTime: 0,
        lastSessionTriggerTime: 0,

        tones: {
            'school_bell': {
                name: 'جرس الحصة المدرسي (School Bell)',
                desc: 'رنين مدرسي كلاسيكي مزدوج متناغم ونقي',
                badge: '🔔 مدرسي',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    playBellStrike(ctx, dest, 587.33, 880, now, 1.2, vol);
                    playBellStrike(ctx, dest, 659.25, 987.77, now + 0.28, 1.4, vol);
                }
            },
            'gentle_chime': {
                name: 'رنين بلوري هادئ (Crystal Chime)',
                desc: 'نغمات بلورية متصاعدة ناعمة ودافئة',
                badge: '✨ بلوري',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    const notes = [1046.5, 1318.5, 1567.98, 2093.0];
                    notes.forEach((freq, idx) => {
                        playSineNote(ctx, dest, freq, now + (idx * 0.11), 1.0, vol * 0.8);
                    });
                }
            },
            'pedagogical': {
                name: 'نغمة تربوية محفزة (Pedagogical Melody)',
                desc: 'لحن ماريمبا بيداغوجي تشجيعي مبهج',
                badge: '🎵 بيداغوجي',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    const freqs = [698.46, 880.0, 1046.5, 1396.91];
                    freqs.forEach((freq, idx) => {
                        playWarmNote(ctx, dest, freq, now + (idx * 0.09), 0.9, vol);
                    });
                }
            },
            'digital_alert': {
                name: 'تنبيه إلكتروني حديث (Modern Beep)',
                desc: 'رنين رقمي ذكي ثلاثي النغمات سريع',
                badge: '📟 إلكتروني',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    const freqs = [880, 1174.66, 1760];
                    freqs.forEach((freq, idx) => {
                        playDigitalBeep(ctx, dest, freq, now + (idx * 0.08), 0.2, vol);
                    });
                }
            },
            'radar_ping': {
                name: 'رادار التنبيه الهادئ (Sonar Ping)',
                desc: 'صدى رنان متلاشٍ للفت الانتباه بسلاسة',
                badge: '🛎️ رادار',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    playResonantPing(ctx, dest, 523.25, 1567.98, now, 1.8, vol);
                }
            },
            'urgent_alarm': {
                name: 'تنبيه استثنائي متتابع (Alert Pulse)',
                desc: 'نبضات مزدوجة واضحة للحالات الحرجة (خلال 24 ساعة)',
                badge: '🚨 متتابع',
                play: function(ctx, dest, vol) {
                    const now = ctx.currentTime;
                    playUrgentPulse(ctx, dest, now, vol);
                    playUrgentPulse(ctx, dest, now + 0.22, vol);
                    playUrgentPulse(ctx, dest, now + 0.44, vol);
                }
            }
        },

        initContext: function() {
            if (!this.ctx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        },

        getConfig: function() {
            let cfg = {
                enabled: true,
                tone: 'school_bell',
                volume: 0.85,
                soundOnExamAlert: true,
                soundOnClassReminder: true
            };
            try {
                if (window.db && window.db.settings && window.db.settings.smartAlertAudio) {
                    cfg = Object.assign(cfg, window.db.settings.smartAlertAudio);
                } else {
                    const saved = localStorage.getItem('smart_alert_sound_config');
                    if (saved) {
                        cfg = Object.assign(cfg, JSON.parse(saved));
                    }
                }
            } catch(e) {}
            return cfg;
        },

        saveConfig: function(updates) {
            const current = this.getConfig();
            const newCfg = Object.assign(current, updates);
            try {
                if (!window.db) window.db = {};
                if (!window.db.settings) window.db.settings = {};
                window.db.settings.smartAlertAudio = newCfg;
                if (typeof window.saveDB === 'function') window.saveDB();
                localStorage.setItem('smart_alert_sound_config', JSON.stringify(newCfg));
            } catch(e) {}
            return newCfg;
        },

        play: function(toneKey, customVolume) {
            const cfg = this.getConfig();
            if (!cfg.enabled && typeof customVolume !== 'number') return;
            const ctx = this.initContext();
            if (!ctx) return;

            const selectedToneKey = toneKey || cfg.tone || 'school_bell';
            const toneObj = this.tones[selectedToneKey] || this.tones['school_bell'];
            const vol = typeof customVolume === 'number' ? customVolume : (cfg.volume !== undefined ? cfg.volume : 0.85);

            try {
                const masterGain = ctx.createGain();
                masterGain.gain.setValueAtTime(vol, ctx.currentTime);
                masterGain.connect(ctx.destination);
                toneObj.play(ctx, masterGain, vol);
            } catch(err) {
                console.warn('SmartAudioAlert play error:', err);
            }
        }
    };

    function renderSoundNotificationToolbar() {
        const cfg = SmartAudioAlert.getConfig();
        const tones = SmartAudioAlert.tones;
        const currentTone = cfg.tone || 'school_bell';
        const isEnabled = cfg.enabled !== false;
        const volPercent = Math.round((cfg.volume !== undefined ? cfg.volume : 0.85) * 100);

        let toneOptionsHtml = '';
        Object.keys(tones).forEach(key => {
            const t = tones[key];
            const isSel = (key === currentTone) ? 'selected' : '';
            toneOptionsHtml += `<option value="${key}" ${isSel}>${t.name}</option>`;
        });

        return `
            <div style="background: rgba(255,255,255,0.92); backdrop-filter: blur(8px); border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <!-- Sound Toggle Pill -->
                    <button type="button" onclick="toggleNotificationSoundMaster()" style="background: ${isEnabled ? '#ecfdf5' : '#f1f5f9'}; border: 1.5px solid ${isEnabled ? '#86efac' : '#cbd5e1'}; color: ${isEnabled ? '#15803d' : '#64748b'}; padding: 6px 12px; border-radius: 9999px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;" title="انقر لتشغيل أو كتم التنبيه الصوتي">
                        <span data-lucide="${isEnabled ? 'volume-2' : 'volume-x'}" data-size="15"></span>
                        <span>${isEnabled ? 'التنبيه الصوتي: مفعل 🔊' : 'التنبيه الصوتي: صامت 🔇'}</span>
                    </button>

                    <!-- Tone Customization Selector -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">تخصيص النغمة:</span>
                        <select id="smartAlertToneSelect" onchange="setNotificationSoundTone(this.value)" style="background: #ffffff; border: 1.5px solid #93c5fd; color: #1e3a8a; padding: 5px 10px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; outline: none; cursor: pointer;">
                            ${toneOptionsHtml}
                        </select>
                    </div>

                    <!-- Test Preview Button -->
                    <button type="button" id="btnPreviewSoundAlert" onclick="previewNotificationSound()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 6px 13px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(37,99,235,0.25);" title="استماع إلى النغمة المحددة الآن وتجربتها">
                        <span data-lucide="play" data-size="13"></span>
                        <span>تجربة النغمة</span>
                    </button>
                </div>

                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <!-- Volume Slider -->
                    <div style="display: flex; align-items: center; gap: 6px;" title="مستوى الصوت">
                        <span data-lucide="volume-1" data-size="15" style="color: #64748b;"></span>
                        <input type="range" id="smartAlertVolumeSlider" min="0" max="1" step="0.05" value="${cfg.volume !== undefined ? cfg.volume : 0.85}" oninput="setNotificationSoundVolume(this.value)" style="width: 80px; accent-color: #2563eb; cursor: pointer;">
                        <span id="smartAlertVolumeText" style="font-size: 0.75rem; font-weight: 800; color: #475569; min-width: 32px;">${volPercent}%</span>
                    </div>

                    <!-- Triggers Checkboxes -->
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 0.76rem; color: #334155;">
                        <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-weight: 600;">
                            <input type="checkbox" id="checkSoundExamAlert" ${cfg.soundOnExamAlert !== false ? 'checked' : ''} onchange="toggleExamAlertSound(this.checked)" style="accent-color: #2563eb; cursor: pointer;">
                            <span>تنبيه الفروض</span>
                        </label>
                        <span style="color: #cbd5e1;">|</span>
                        <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font-weight: 600;">
                            <input type="checkbox" id="checkSoundClassReminder" ${cfg.soundOnClassReminder !== false ? 'checked' : ''} onchange="toggleSessionAlertSound(this.checked)" style="accent-color: #2563eb; cursor: pointer;">
                            <span>تنبيه الحصص اليوم</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    function toggleNotificationSoundMaster() {
        const cfg = SmartAudioAlert.getConfig();
        const newEnabled = !cfg.enabled;
        SmartAudioAlert.saveConfig({ enabled: newEnabled });
        if (newEnabled) {
            SmartAudioAlert.play(null, 0.8);
            if (typeof window.showToast === 'function') {
                window.showToast('تم تفعيل التنبيه الصوتي بنجاح 🔊', 'success');
            }
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast('تم كتم التنبيه الصوتي 🔇', 'info');
            }
        }
        updateSmartAlertsUI();
    }
    window.toggleNotificationSoundMaster = toggleNotificationSoundMaster;

    function setNotificationSoundTone(toneKey) {
        SmartAudioAlert.saveConfig({ tone: toneKey });
        SmartAudioAlert.play(toneKey);
        const t = SmartAudioAlert.tones[toneKey];
        if (typeof window.showToast === 'function') {
            window.showToast(`تم تعيين النغمة: ${t ? t.name : toneKey} 🎵`, 'info');
        }
    }
    window.setNotificationSoundTone = setNotificationSoundTone;

    function setNotificationSoundVolume(vol) {
        const v = parseFloat(vol);
        SmartAudioAlert.saveConfig({ volume: v });
        const textEl = document.getElementById('smartAlertVolumeText');
        if (textEl) textEl.textContent = `${Math.round(v * 100)}%`;
    }
    window.setNotificationSoundVolume = setNotificationSoundVolume;

    function toggleExamAlertSound(enabled) {
        SmartAudioAlert.saveConfig({ soundOnExamAlert: !!enabled });
    }
    window.toggleExamAlertSound = toggleExamAlertSound;

    function toggleSessionAlertSound(enabled) {
        SmartAudioAlert.saveConfig({ soundOnClassReminder: !!enabled });
    }
    window.toggleSessionAlertSound = toggleSessionAlertSound;

    function previewNotificationSound(toneKey) {
        const cfg = SmartAudioAlert.getConfig();
        const tKey = toneKey || cfg.tone || 'school_bell';
        SmartAudioAlert.play(tKey);
        const t = SmartAudioAlert.tones[tKey];
        const btn = document.getElementById('btnPreviewSoundAlert');
        if (btn) {
            btn.style.transform = 'scale(0.96)';
            setTimeout(() => { if (btn) btn.style.transform = 'scale(1)'; }, 150);
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`استماع تجريبي للنغمة: ${t ? t.name : tKey} 🔊`, 'info');
        }
    }
    window.previewNotificationSound = previewNotificationSound;

    function triggerExamAlertSound(examTitle, daysLeft, force) {
        // حصر التنبيهات الصوتية المباغتة فقط في تبويب التقويم
        if (!force && typeof window.activeTab !== 'undefined' && window.activeTab !== 'calendar') return;

        const cfg = SmartAudioAlert.getConfig();
        if (!cfg.enabled && !force) return;
        if (!cfg.soundOnExamAlert && !force) return;

        const now = Date.now();
        if (!force && (now - SmartAudioAlert.lastExamTriggerTime < 15 * 60 * 1000)) {
            return;
        }
        SmartAudioAlert.lastExamTriggerTime = now;

        const toneToPlay = (daysLeft <= 1 && cfg.tone === 'urgent_alarm') ? 'urgent_alarm' : cfg.tone;
        SmartAudioAlert.play(toneToPlay);

        const daysText = (daysLeft === 0) ? 'اليوم' : (daysLeft === 1 ? 'غداً' : `بعد ${daysLeft} يوم`);
        if (typeof window.showToast === 'function') {
            window.showToast(`🚨 تنبيه صوتي: اقتراب موعد ${examTitle || 'الفرض المحروس'} (${daysText})`, 'warning');
        }
    }
    window.triggerExamAlertSound = triggerExamAlertSound;

    function triggerClassReminderSound(className, timeStr, force) {
        // حصر التنبيهات الصوتية المباغتة فقط في تبويب التقويم
        if (!force && typeof window.activeTab !== 'undefined' && window.activeTab !== 'calendar') return;

        const cfg = SmartAudioAlert.getConfig();
        if (!cfg.enabled && !force) return;
        if (!cfg.soundOnClassReminder && !force) return;

        const now = Date.now();
        if (!force && (now - SmartAudioAlert.lastSessionTriggerTime < 5 * 60 * 1000)) {
            return;
        }
        SmartAudioAlert.lastSessionTriggerTime = now;

        SmartAudioAlert.play(cfg.tone || 'school_bell');

        if (typeof window.showToast === 'function') {
            window.showToast(`🔔 تذكير صوتي باقتراب الحصة: قسم ${className || ''} (${timeStr || ''})`, 'info');
        }
    }
    window.triggerClassReminderSound = triggerClassReminderSound;

    /**
     * بناء قسم الإشعارات الذكي التفاعلي داخل لوحة القيادة
     */
    function renderDashboardExamAlerts(container, cache) {
        if (!container) return;
        const { criticalAlertExams, upcomingExams, primaryExam } = cache;
        const alertsToDisplay = (criticalAlertExams.length > 0) ? criticalAlertExams : (upcomingExams.slice(0, 3));

        if (!alertsToDisplay || alertsToDisplay.length === 0) {
            container.style.display = 'block';
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;">
                    ${renderSoundNotificationToolbar()}
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 6px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: #e2e8f0; color: #475569; width: 36px; height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                                <span data-lucide="calendar-check" data-size="18"></span>
                            </span>
                            <div>
                                <div style="font-size: 0.88rem; font-weight: 800; color: #1e293b;">التقويم السنوي للفروض: لا توجد فروض محروسة قريبة في الأيام القادمة</div>
                                <div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">يمكنك الاطلاع على مواعيد الفروض أو تعديلها وبرمجتها مباشرة في التقويم السنوي، أو تجربة النغمات أعلاه.</div>
                            </div>
                        </div>
                        <button type="button" onclick="switchTab('calendar')" style="background: #ffffff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.8rem; font-weight: 700; padding: 6px 14px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="calendar" data-size="14"></span>
                            <span>فتح التقويم السنوي</span>
                        </button>
                    </div>
                </div>
            `;
            if (window.renderLucide) window.renderLucide();
            return;
        }

        const isCritical = criticalAlertExams.length > 0;
        const mainHeaderBg = isCritical ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
        const mainBorderColor = isCritical ? '#ea580c' : '#2563eb';
        const mainIconColor = isCritical ? '#c2410c' : '#1d4ed8';

        let cardsHtml = '';
        alertsToDisplay.forEach(exam => {
            const highAbsenceStudents = getHighAbsenceStudentsForExam(exam);
            const count = highAbsenceStudents.length;
            const daysLeft = exam.daysLeft;

            let countdownBadgeText = '';
            let countdownBadgeStyle = '';
            if (daysLeft === 0) {
                countdownBadgeText = '🚨 اليوم موعد إجراء الفرض!';
                countdownBadgeStyle = 'background: #dc2626; color: #fff;';
            } else if (daysLeft === 1) {
                countdownBadgeText = '⚠️ غداً (متبقي 24 ساعة فقط)!';
                countdownBadgeStyle = 'background: #e11d48; color: #fff;';
            } else if (daysLeft === 2) {
                countdownBadgeText = '📢 بعد يومين (48 ساعة)!';
                countdownBadgeStyle = 'background: #ea580c; color: #fff;';
            } else {
                countdownBadgeText = `📅 بعد ${daysLeft} يوماً (${exam.startDate})`;
                countdownBadgeStyle = 'background: #2563eb; color: #fff;';
            }

            cardsHtml += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-right: 4px solid ${daysLeft <= 2 ? '#ea580c' : '#3b82f6'}; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1; min-width: 250px;">
                        <span style="background: #f8fafc; border: 1px solid #cbd5e1; color: #1e293b; font-weight: 800; font-size: 0.78rem; padding: 3px 8px; border-radius: 6px; white-space: nowrap; margin-top: 2px;">
                            ${escapeHtml(exam.targetLevels || 'جميع الأقسام')}
                        </span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                <strong style="font-size: 0.9rem; color: #0f172a;">${escapeHtml(exam.title)}</strong>
                                <span style="font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 999px; ${countdownBadgeStyle}">
                                    ${countdownBadgeText}
                                </span>
                            </div>
                            <div style="font-size: 0.78rem; color: #475569; margin-top: 4px;">
                                ${count > 0 
                                    ? `<span style="color: #dc2626; font-weight: 700;">⚠️ تم رصد ${count} تلاميذ لديهم غيابات متكررة أو تعثر بيداغوجي بالقسم</span>` 
                                    : `<span style="color: #059669; font-weight: 700;">✅ لا توجد غيابات مقلقة بالقسم المعني</span>`}
                            </div>
                            <div style="margin-top: 6px;">
                                ${buildExamCountdownWidgetHtml(exam, { compact: true, showHeader: false, idPrefix: 'dash_item' })}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <button type="button" onclick="triggerExamAlertSound('${escapeHtml(exam.title)}', ${daysLeft}, true)" style="background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; font-size: 0.78rem; font-weight: 800; padding: 6px 10px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="تشغيل رنين التنبيه الصوتي لهذا الفرض">
                            <span data-lucide="volume-2" data-size="13"></span>
                            <span>رنين التنبيه</span>
                        </button>
                        <button type="button" onclick="openSmartExamAlertModal('${exam.id}')" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color: #ffffff; border: none; font-size: 0.78rem; font-weight: 800; padding: 7px 12px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25);">
                            <span data-lucide="users" data-size="14"></span>
                            <span>خطة الدعم الاستدراكي (${count})</span>
                        </button>
                        <button type="button" onclick="switchTab('grades')" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-size: 0.78rem; font-weight: 700; padding: 6px 10px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="الانتقال لجدول نقط الفروض">
                            <span data-lucide="award" data-size="13"></span>
                            <span>جدول النقط</span>
                        </button>
                    </div>
                </div>
            `;
        });

        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: ${mainHeaderBg}; border: 1.5px solid ${mainBorderColor}55; border-right: 5px solid ${mainBorderColor}; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; box-shadow: 0 3px 10px rgba(0,0,0,0.05);">
                <!-- Sound Customization and Control Bar -->
                ${renderSoundNotificationToolbar()}

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; border-bottom: 1px solid ${mainBorderColor}33; padding-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: ${mainBorderColor}; color: #ffffff; width: 36px; height: 36px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                            <span data-lucide="bell-ring" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 0.98rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                <span>نظام الإشعارات والتذكير الذكي بالفروض المحروسة</span>
                                <span style="background: ${mainBorderColor}; color: #fff; font-size: 0.72rem; padding: 2px 8px; border-radius: 999px; font-weight: 800;">
                                    ${alertsToDisplay.length} محطة قادمة
                                </span>
                            </h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #475569;">
                                تذكير بيداغوجي استباقي مستند إلى <strong>التقويم السنوي</strong> مع تنبيه صوتي مخصص لتنظيم المراجعة، حصر الغيابات، وتفعيل الدعم الاستدراكي قبل موعد الاختبار.
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" onclick="openSmartExamAlertModal()" style="background: #ffffff; color: ${mainIconColor}; border: 1.5px solid ${mainBorderColor}; font-size: 0.78rem; font-weight: 800; padding: 6px 12px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span data-lucide="calendar" data-size="14"></span>
                            <span>تفاصيل جميع المحطات</span>
                        </button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${cardsHtml}
                </div>
            </div>
        `;
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * بناء HTML للبانر التنبيهي
     */
    function renderExamAlertBannerHtml(container, exam, hasActiveAlert) {
        if (!exam) {
            container.style.display = 'none';
            return;
        }

        const highAbsenceStudents = getHighAbsenceStudentsForExam(exam);
        const count = highAbsenceStudents.length;
        const daysLeft = exam.daysLeft;

        let bannerClass = 'smart-alert-notice';
        let borderColor = '#f59e0b';
        let bgGradient = 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)';
        let badgeBg = '#f59e0b';
        let countdownText = '';

        if (daysLeft === 0) {
            countdownText = 'اليوم هو موعد إجراء الفرض المحروس!';
            borderColor = '#dc2626';
            bgGradient = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
            badgeBg = '#dc2626';
        } else if (daysLeft === 1) {
            countdownText = 'متبقي يوم واحد فقط (غداً) على موعد الفرض المحروس!';
            borderColor = '#e11d48';
            bgGradient = 'linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%)';
            badgeBg = '#e11d48';
        } else if (daysLeft === 2) {
            countdownText = 'تنبيه ذكي مسبق: موعد الفرض المحروس بعد يومين (48 ساعة)!';
            borderColor = '#ea580c';
            bgGradient = 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)';
            badgeBg = '#ea580c';
        } else if (daysLeft > 2) {
            countdownText = `موعد الفرض المحروس القادم: بعد ${daysLeft} يوماً (${exam.startDate})`;
            borderColor = '#3b82f6';
            bgGradient = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
            badgeBg = '#2563eb';
        } else {
            countdownText = `تم تسجيل الفرض بتاريخ: ${exam.startDate}`;
            borderColor = '#64748b';
            bgGradient = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
            badgeBg = '#64748b';
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: ${bgGradient}; border-right: 5px solid ${borderColor}; border: 1.5px solid ${borderColor}44; border-radius: 12px; padding: 12px 18px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 280px;">
                    <div style="background: ${badgeBg}; color: #fff; width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 8px rgba(0,0,0,0.18);">
                        <span data-lucide="bell-ring" data-size="22"></span>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="background: ${badgeBg}; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">
                                ${countdownText}
                            </span>
                            <span style="font-size: 0.8rem; font-weight: 700; color: #475569;">
                                ${exam.title} (${exam.startDate})
                            </span>
                        </div>
                        <div style="font-size: 0.84rem; color: #1e293b; margin-top: 4px; font-weight: 700; line-height: 1.4;">
                            ${count > 0 
                                ? `تم رصد <strong style="color: #dc2626;">${count} تلاميذ</strong> لديهم غيابات متكررة بأقسام الفرض، مما قد يعرضهم للتعثر الدراسي.`
                                : `جميع التلاميذ في الأقسام المعنية ملتزمون بالمواظبة ولا توجد غيابات مقلقة.`}
                        </div>
                        <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">
                            الأقسام المعنية: <strong>${escapeHtml(exam.targetLevels)}</strong> • الدورة: <strong>${escapeHtml(exam.semesterLabel)}</strong>
                        </div>
                        <div style="margin-top: 8px;">
                            ${buildExamCountdownWidgetHtml(exam, { compact: false, showHeader: true, idPrefix: container.id })}
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;">
                    <button type="button" onclick="openSmartExamAlertModal('${exam.id}')" style="background: ${badgeBg}; color: #ffffff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: opacity 0.2s;">
                        <span data-lucide="users" data-size="15"></span>
                        <span>معاينة قائمة التلاميذ وإجراءات الدعم (${count})</span>
                    </button>
                    <button type="button" onclick="dismissSmartAlertBanner('${container.id}')" style="background: #ffffff; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 12px; font-size: 0.78rem; font-weight: 600; cursor: pointer;" title="إخفاء مؤقت">
                        <span>إخفاء</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * إخفاء بانر مؤقتاً
     */
    function dismissSmartAlertBanner(bannerId) {
        const el = document.getElementById(bannerId);
        if (el) el.style.display = 'none';
    }
    window.dismissSmartAlertBanner = dismissSmartAlertBanner;

    /**
     * فتح نافذة نظام التنبيهات الذكي المنبثقة
     */
    function openSmartExamAlertModal(examId) {
        let modal = document.getElementById('smartExamAlertModal');
        if (!modal) {
            createSmartExamAlertModalHtml();
            modal = document.getElementById('smartExamAlertModal');
        }

        const exams = getRegisteredExams();
        if (exams.length === 0) {
            alert('لا توجد فروض أو محطات امتحانات مسجلة في التقويم السنوي حالياً.');
            return;
        }

        // اختيار الفرض المستهدف
        let targetExam = exams.find(e => e.id === examId);
        if (!targetExam) {
            // اختيار أقرب فرض أو أول فرض في القائمة
            if (smartAlertsCache && smartAlertsCache.primaryExam) {
                targetExam = smartAlertsCache.primaryExam;
            } else {
                targetExam = exams[0];
            }
        }

        currentSelectedExamId = targetExam.id;

        // تعبئة القائمة المنسدلة لاختيار أي فرض للمعاينة والمحاكاة
        const selectEl = document.getElementById('smartExamSelectDropdown');
        if (selectEl) {
            selectEl.innerHTML = exams.map(ex => {
                const days = diffInDays(ex.startDate);
                let timeBadge = '';
                if (days === 0) timeBadge = ' [اليوم]';
                else if (days === 1) timeBadge = ' [غداً]';
                else if (days === 2) timeBadge = ' [بعد يومين 🚨]';
                else if (days > 2) timeBadge = ` [بعد ${days} يوم]`;
                else timeBadge = ' [مضى]';
                return `<option value="${ex.id}" ${ex.id === targetExam.id ? 'selected' : ''}>${escapeHtml(ex.title)} - ${ex.startDate}${timeBadge}</option>`;
            }).join('');
        }

        renderSmartAlertModalContent(targetExam);
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }
    window.openSmartExamAlertModal = openSmartExamAlertModal;

    /**
     * عند تغيير الفرض في القائمة المنسدلة داخل النافذة
     */
    function onSmartExamSelectionChange() {
        const selectEl = document.getElementById('smartExamSelectDropdown');
        if (!selectEl) return;
        const examId = selectEl.value;
        const exams = getRegisteredExams();
        const exam = exams.find(e => e.id === examId);
        if (exam) {
            currentSelectedExamId = exam.id;
            renderSmartAlertModalContent(exam);
            if (window.renderLucide) window.renderLucide();
        }
    }
    window.onSmartExamSelectionChange = onSmartExamSelectionChange;

    /**
     * إغلاق نافذة التنبيهات الذكية
     */
    function closeSmartExamAlertModal() {
        const modal = document.getElementById('smartExamAlertModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeSmartExamAlertModal = closeSmartExamAlertModal;

    /**
     * رسم تفاصيل محتوى نافذة التنبيه الذكي
     */
    function renderSmartAlertModalContent(exam) {
        const daysLeft = diffInDays(exam.startDate);
        const students = getHighAbsenceStudentsForExam(exam);

        // بطاقة العد التنازلي والمحطة
        const headerInfo = document.getElementById('smartExamModalHeaderInfo');
        if (headerInfo) {
            let statusPill = '';
            if (daysLeft === 0) {
                statusPill = '<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 3px 10px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">🚨 اليوم هو موعد الفرض!</span>';
            } else if (daysLeft === 1) {
                statusPill = '<span style="background: #fee2e2; color: #e11d48; border: 1px solid #fca5a5; padding: 3px 10px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">⚠️ متبقي يوم واحد (غداً)</span>';
            } else if (daysLeft === 2) {
                statusPill = '<span style="background: #ffedd5; color: #ea580c; border: 1px solid #fdba74; padding: 3px 10px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">🔔 تنبيه ذكي: متبقي يومان (48 ساعة)!</span>';
            } else if (daysLeft > 2) {
                statusPill = `<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 3px 10px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">📅 متبقي ${daysLeft} يوماً على الموعد</span>`;
            } else {
                statusPill = '<span style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 0.78rem;">محطة سابقة</span>';
            }

            headerInfo.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            ${statusPill}
                            <span style="font-weight: 800; color: #0f172a; font-size: 1rem;">${escapeHtml(exam.title)}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                            <span>تاريخ الإجراء: <strong>${exam.startDate}</strong></span>
                            <span>الأقسام المعنية: <strong>${escapeHtml(exam.targetLevels)}</strong></span>
                            <span>الدورة: <strong>${escapeHtml(exam.semesterLabel)}</strong></span>
                        </div>
                        <div style="margin-top: 8px;">
                            ${buildExamCountdownWidgetHtml(exam, { compact: false, showHeader: true, idPrefix: 'modal' })}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="exportExamAlertStudentsToExcel('${exam.id}')" style="background: #059669; color: #fff; border: none; padding: 6px 12px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                            <span data-lucide="file-spreadsheet" data-size="14"></span> تصدير لائحة التلاميذ (Excel)
                        </button>
                        <button type="button" onclick="printExamAlertReport('${exam.id}')" style="background: #1e293b; color: #fff; border: none; padding: 6px 12px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                            <span data-lucide="printer" data-size="14"></span> طباعة الكشف
                        </button>
                    </div>
                </div>
            `;
        }

        // إحصائيات سريعة
        const statsContainer = document.getElementById('smartExamModalStats');
        if (statsContainer) {
            const criticalCount = students.filter(s => s.riskLevel === 'critical').length;
            const highCount = students.filter(s => s.riskLevel === 'high').length;
            const totalHours = students.reduce((acc, s) => acc + s.totalAbsent, 0);

            statsContainer.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;">
                    <div style="background: #fff; border: 1px solid #fee2e2; border-right: 4px solid #dc2626; border-radius: 8px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #991b1b; font-weight: 700;">حالات حرجة (غياب مرتفع)</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #dc2626;">${criticalCount}</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #ffedd5; border-right: 4px solid #ea580c; border-radius: 8px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #9a3412; font-weight: 700;">تنبيه ومتابعة متكررة</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #ea580c;">${highCount}</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #e0e7ff; border-right: 4px solid #4f46e5; border-radius: 8px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #3730a3; font-weight: 700;">إجمالي ساعات الغياب المرصودة</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #4338ca;">${totalHours} س</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-right: 4px solid #0284c7; border-radius: 8px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #0369a1; font-weight: 700;">إجمالي التلاميذ المقترحين</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: #0284c7;">${students.length} تلميذ</div>
                    </div>
                </div>
            `;
        }

        // جدول وتوصيات التلاميذ
        const listContainer = document.getElementById('smartExamStudentsListTable');
        if (listContainer) {
            if (students.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 35px 20px; color: #166534; background: #f0fdf4; border-radius: 10px; border: 1.5px dashed #86efac;">
                        <div style="margin-bottom: 8px;">
                            <span data-lucide="check-check" data-size="36" style="color: #16a34a;"></span>
                        </div>
                        <h4 style="font-weight: 800; font-size: 1rem; margin: 0 0 6px 0;">وضع المواظبة سليم وممتاز!</h4>
                        <p style="font-size: 0.82rem; color: #166534; margin: 0;">لم يتم رصد أي غيابات متكررة غير مبررة للتلاميذ في الأقسام المحددة لهذا الفرض.</p>
                    </div>
                `;
                return;
            }

            let rowsHtml = '';
            students.forEach((std, idx) => {
                const waText = encodeURIComponent(
                    `السلام عليكم ورحمة الله، ولي أمر التلميذ(ة) ${std.name} (${std.className}).\nنحيطكم علماً باقتراب موعد إجراء "${exam.title}" يوم ${exam.startDate}.\nنظراً لتسجيل غياب متكرر بلغ (${std.totalAbsent} ساعة منها ${std.unjustifiedHours} غير مبررة)، نرجو حث التلميذ(ة) على مضاعفة المراجعة واستدراك الدروس السابقة لتحقيق نتائج إيجابية وموفقة.\n- أستاذ مادة الرياضيات.`
                );

                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                        <td style="padding: 10px 12px; font-weight: 700; color: #64748b; font-size: 0.8rem; text-align: center;">${idx + 1}</td>
                        <td style="padding: 10px 12px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                <span>${escapeHtml(std.name)}</span>
                            </div>
                            <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                                مسار: <strong>${escapeHtml(std.massar)}</strong> ${std.orderNum ? `• رقم: ${std.orderNum}` : ''}
                            </div>
                        </td>
                        <td style="padding: 10px 12px; font-size: 0.82rem; font-weight: 800; color: #334155;">
                            ${escapeHtml(std.className)}
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span style="font-weight: 800; font-size: 0.88rem; color: #dc2626; background: #fee2e2; padding: 2px 8px; border-radius: 6px;">
                                ${std.totalAbsent} س
                            </span>
                            <div style="font-size: 0.7rem; color: #64748b; margin-top: 2px;">
                                (${std.unjustifiedHours} غير مبرر + ${std.justifiedHours} مبرر)
                            </div>
                        </td>
                        <td style="padding: 10px 12px; text-align: center; font-size: 0.8rem;">
                            ${std.missedHw > 0 
                                ? `<span style="color: #b45309; font-weight: 700; background: #fef3c7; padding: 2px 7px; border-radius: 5px;">${std.missedHw} مرات</span>` 
                                : '<span style="color: #10b981; font-size: 0.75rem;">منضبط</span>'}
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span style="background: ${std.riskBg}; color: ${std.riskBadgeColor}; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; border: 1px solid ${std.riskBadgeColor}44;">
                                ${std.riskLabel}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <div style="display: inline-flex; align-items: center; gap: 5px;">
                                <a href="${(std.phone && window.cleanWhatsAppNumber) ? `https://wa.me/${window.cleanWhatsAppNumber(std.phone)}?text=${waText}` : `https://wa.me/?text=${waText}`}" target="_blank" rel="noopener noreferrer" style="background: #25d366; color: #fff; padding: 5px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;" title="إرسال تنبيه واستدعاء عبر واتساب">
                                    <span data-lucide="message-circle" data-size="12"></span> واتساب
                                </a>
                                <button type="button" onclick="addStudentToTutoringDirect('${escapeHtml(std.className)}', '${escapeHtml(std.id)}')" style="background: #f97316; color: #fff; border: none; padding: 5px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="إدراج في حصة الدعم والاستدراك">
                                    <span data-lucide="graduation-cap" data-size="12"></span> دعم استدراكي
                                </button>
                                <button type="button" onclick="closeSmartExamAlertModal(); openStudentDigitalPortfolio('${escapeHtml(std.className)}', '${escapeHtml(std.id)}')" style="background: #6366f1; color: #fff; border: none; padding: 5px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="فتح ملف الإنجاز الرقمي للتلميذ">
                                    <span data-lucide="folder-kanban" data-size="12"></span> ملف الإنجاز
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            listContainer.innerHTML = `
                <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; font-weight: 700; color: #334155;">
                    <div>قائمة التلاميذ المقترحين للدعم والمتابعة المسبقة (${students.length} تلميذ):</div>
                    <div style="font-size: 0.74rem; color: #64748b;">مرتبون حسب خطورة وتكرار الغياب</div>
                </div>
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right; background: #ffffff;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 0.78rem; color: #475569;">
                                <th style="padding: 10px 12px; text-align: center; width: 40px;">#</th>
                                <th style="padding: 10px 12px;">اسم التلميذ(ة)</th>
                                <th style="padding: 10px 12px;">القسم</th>
                                <th style="padding: 10px 12px; text-align: center;">مجموع الغياب</th>
                                <th style="padding: 10px 12px; text-align: center;">إهمال الواجبات</th>
                                <th style="padding: 10px 12px; text-align: center;">مستوى الخطر</th>
                                <th style="padding: 10px 12px; text-align: center;">إجراءات بيداغوجية مقترحة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    /**
     * إدراج تلميذ سريعاً في حصص الدعم والمواكبة
     */
    function addStudentToTutoringDirect(className, studentId) {
        if (!window.db) return;
        if (!Array.isArray(window.db.tutoringStudents)) {
            window.db.tutoringStudents = [];
        }

        const existing = window.db.tutoringStudents.find(s => s.studentId === studentId && s.className === className);
        if (existing) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('التلميذ مسجل بالفعل في لائحة الدعم والاستدراك', 'info');
            } else {
                alert('التلميذ مسجل بالفعل في لائحة الدعم والاستدراك');
            }
            return;
        }

        const studentObj = (window.db.classes[className] || []).find(s => s.id === studentId);
        const name = studentObj ? studentObj.name : 'تلميذ';

        window.db.tutoringStudents.push({
            id: 'tut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            studentId,
            className,
            name,
            reason: 'غياب متكرر وقائي قبل الفرض المحروس',
            targetExamId: currentSelectedExamId,
            enrolledAt: new Date().toISOString(),
            status: 'active'
        });

        if (typeof window.saveDB === 'function') window.saveDB();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`تم إدراج التلميذ "${name}" في لائحة الدعم والاستدراك بنجاح`, 'success');
        } else {
            alert(`تم إدراج التلميذ "${name}" في لائحة الدعم والاستدراك بنجاح`);
        }
    }
    window.addStudentToTutoringDirect = addStudentToTutoringDirect;

    /**
     * تصدير لائحة التلاميذ المقترحين إلى ملف Excel
     */
    function exportExamAlertStudentsToExcel(examId) {
        const exams = getRegisteredExams();
        const exam = exams.find(e => e.id === examId) || exams[0];
        if (!exam) return;

        const students = getHighAbsenceStudentsForExam(exam);
        if (students.length === 0) {
            alert('لا يوجد تلاميذ لتصديرهم في هذا الفرض.');
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('مكتبة معالجة Excel غير متوفرة حالياً.');
            return;
        }

        const data = [
            ['تقرير التنبيه البيداغوجي الذكي - اقتراب الفرض المحروس والتلاميذ ذوي الغياب المتكرر'],
            ['اسم الفرض / المحطة:', exam.title],
            ['تاريخ الإجراء:', exam.startDate],
            ['الأقسام المعنية:', exam.targetLevels],
            ['تاريخ استخراج التقرير:', new Date().toLocaleDateString('ar-MA')],
            [],
            ['#', 'الاسم الكامل', 'القسم', 'رقم مسار', 'ساعات الغياب الإجمالية', 'غير مبرر', 'مبرر', 'إهمال الواجب', 'مستوى الخطورة']
        ];

        students.forEach((s, idx) => {
            data.push([
                idx + 1,
                s.name,
                s.className,
                s.massar,
                s.totalAbsent,
                s.unjustifiedHours,
                s.justifiedHours,
                s.missedHw,
                s.riskLabel
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'غيابات_الفرض');
        XLSX.writeFile(wb, `تنبيه_فرض_${exam.startDate}_غيابات_متكررة.xlsx`);
    }
    window.exportExamAlertStudentsToExcel = exportExamAlertStudentsToExcel;

    /**
     * طباعة كشف التنبيه المسبق للفروض بصيغة A4 رسمية
     */
    function printExamAlertReport(examId) {
        const exams = getRegisteredExams();
        const exam = exams.find(e => e.id === examId) || exams[0];
        if (!exam) return;

        const students = getHighAbsenceStudentsForExam(exam);
        const headerHtml = typeof window.buildOfficialMoroccanHeader === 'function'
            ? window.buildOfficialMoroccanHeader(`كشف التنبيه المسبق والتتبع الوقائي قبل الفرض: ${exam.title}`, exam.targetLevels || 'الأقسام المعنية', exam.startDate)
            : `<h2 style="text-align:center;color:#0f172a;font-family:'Cairo',sans-serif;">كشف التنبيه المسبق قبل الفرض: ${exam.title}</h2>`;
        const visasHtml = typeof window.buildOfficialVisasSection === 'function' ? window.buildOfficialVisasSection({ optVisas: true }) : '';

        const htmlDoc = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>كشف التنبيه المسبق للفروض — ${exam.title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: 'Cairo', sans-serif; direction: rtl; color: #0f172a; background: #fff; margin: 0; padding: 8mm; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
        th { background: #1e293b; color: #fff; font-weight: 800; }
    </style>
</head>
<body>
    ${headerHtml}
    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:11px;font-weight:700;">
        📌 المحطة التقويمية: <strong>${exam.title}</strong> | تاريخ الإجراء: <strong dir="ltr">${exam.startDate}</strong> | الأقسام المعنية: <strong>${exam.targetLevels || 'جميع الأقسام'}</strong> | عدد التلاميذ المرصودين: <strong>${students.length}</strong>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:5%;text-align:center;">#</th>
                <th style="width:28%;text-align:right;">الاسم الكامل للتلميذ(ة)</th>
                <th style="width:12%;text-align:center;">القسم</th>
                <th style="width:14%;text-align:center;">رقم مسار</th>
                <th style="width:11%;text-align:center;">إجمالي الغياب</th>
                <th style="width:10%;text-align:center;">غير مبرر</th>
                <th style="width:10%;text-align:center;">إهمال الواجب</th>
                <th style="width:10%;text-align:center;">مستوى الخطورة</th>
            </tr>
        </thead>
        <tbody>
            ${students.map((s, idx) => `
                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                    <td style="text-align:center;font-weight:800;">${idx + 1}</td>
                    <td style="font-weight:800;">${s.name}</td>
                    <td style="text-align:center;font-weight:700;">${s.className}</td>
                    <td style="text-align:center;font-family:monospace;">${s.massar || '-'}</td>
                    <td style="text-align:center;font-weight:900;color:#b91c1c;">${s.totalAbsent} س</td>
                    <td style="text-align:center;font-weight:800;color:#dc2626;">${s.unjustifiedHours} س</td>
                    <td style="text-align:center;font-weight:700;">${s.missedHw} مرات</td>
                    <td style="text-align:center;font-weight:800;">${s.riskLabel}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ${visasHtml}
</body>
</html>`;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlDoc, {
                title: `كشف_التنبيه_المسبق_${exam.title}`,
                orientation: 'portrait',
                subtitle: 'لائحة التلاميذ ذوي الغياب المتكرر المستهدفين بالدعم الوقائي قبل الفرض المحروس'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(htmlDoc, `كشف التنبيه المسبق - ${exam.title}`, 'portrait');
        }
    }
    window.printExamAlertReport = printExamAlertReport;

    /**
     * إنشاء هيكل النافذة المنبثقة إذا لم تكن موجودة في HTML
     */
    function createSmartExamAlertModalHtml() {
        if (document.getElementById('smartExamAlertModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'smartExamAlertModal';
        modalDiv.className = 'modal-backdrop-smart-alert';
        modalDiv.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 12px; overflow-y: auto;';

        modalDiv.innerHTML = `
            <div class="card smart-alert-card" style="width: 100%; max-width: 950px; max-height: 90vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; padding: 0; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); border: 1.5px solid #cbd5e1;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #dc2626;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; width: 36px; height: 36px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4);">
                            <span data-lucide="bell-ring" data-size="18"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #fff;">
                                نظام التنبيهات البيداغوجي الذكي - اقتراب موعد الفرض المحروس
                            </h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #cbd5e1;">
                                إخطار استباقي قبل 48 ساعة من موعد الفرض، مع رصد التلاميذ ذوي الغياب المتكرر لاقتراح تدابير الدعم والاستدراك
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 8px;">
                            <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">محاكاة / اختيار الفرض:</span>
                            <select id="smartExamSelectDropdown" onchange="onSmartExamSelectionChange()" style="background: #ffffff; color: #0f172a; font-size: 0.78rem; font-weight: 700; border-radius: 6px; padding: 4px 8px; border: none; outline: none; cursor: pointer; max-width: 240px;"></select>
                        </div>
                        <button type="button" onclick="closeSmartExamAlertModal()" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="إغلاق">
                            <span data-lucide="x" data-size="20"></span>
                        </button>
                    </div>
                </div>

                <!-- Body -->
                <div style="padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">
                    <!-- Milestone & Countdown Summary -->
                    <div id="smartExamModalHeaderInfo"></div>

                    <!-- Statistics KPIs -->
                    <div id="smartExamModalStats"></div>

                    <!-- Actionable Guidance Box -->
                    <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-right: 5px solid #16a34a; border-radius: 10px; padding: 12px 16px; font-size: 0.82rem; color: #166534; line-height: 1.5;">
                        <strong style="display: block; margin-bottom: 3px; font-size: 0.86rem; color: #14532d;">
                            💡 تدابير وتوصيات بيداغوجية وقائية قبل موعد الفرض:
                        </strong>
                        <ul style="margin: 0; padding-right: 20px; font-size: 0.8rem;">
                            <li>حث التلاميذ المتغيبين على استدراك دفاتر الدروس وإنجاز التمارين التطبيقية المحورية.</li>
                            <li>تخصيص حصة دعم أو ورشة حل نماذج امتحانات سابقة للتلاميذ المعنيين.</li>
                            <li>إشعار أسر المتعلمين عبر رسائل واتساب للاطلاع على مستوى المواظبة وتشجيع أبنائهم على المراجعة.</li>
                        </ul>
                    </div>

                    <!-- Students List Table -->
                    <div id="smartExamStudentsListTable"></div>
                </div>

                <!-- Footer -->
                <div style="padding: 12px 22px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.74rem; color: #64748b;">
                        * يتم تحديث نسب الغياب والمواظبة بشكل حي ومباشر فور تسجيل حصص الغياب في المنظومة.
                    </div>
                    <button type="button" onclick="closeSmartExamAlertModal()" style="padding: 7px 20px; border: 1px solid #cbd5e1; background: #ffffff; color: #334155; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // تصدير الدوال إلى window
    window.checkSmartExamAlerts = checkSmartExamAlerts;
    window.getRegisteredExams = getRegisteredExams;
    window.getNextUpcomingExam = getNextUpcomingExam;
    window.getExamCountdown = getExamCountdown;
    window.buildExamCountdownWidgetHtml = buildExamCountdownWidgetHtml;
    window.tickExamCountdownDisplays = tickExamCountdownDisplays;
    window.getHighAbsenceStudentsForExam = getHighAbsenceStudentsForExam;
    window.updateSmartAlertsUI = updateSmartAlertsUI;
    window.SmartAudioAlert = SmartAudioAlert;
    window.previewNotificationSound = previewNotificationSound;
    window.setNotificationSoundTone = setNotificationSoundTone;
    window.setNotificationSoundVolume = setNotificationSoundVolume;
    window.toggleNotificationSoundMaster = toggleNotificationSoundMaster;
    window.toggleExamAlertSound = toggleExamAlertSound;
    window.toggleSessionAlertSound = toggleSessionAlertSound;
    window.triggerExamAlertSound = triggerExamAlertSound;
    window.triggerClassReminderSound = triggerClassReminderSound;

    // تهيئة فورية وتكرار الفحص
    setTimeout(() => {
        createSmartExamAlertModalHtml();
        checkSmartExamAlerts();
    }, 400);

})(window);
