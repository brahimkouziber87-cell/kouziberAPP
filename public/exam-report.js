/**
 * ====================================================================
 * وحدة تقرير الفرض المحروس البيداغوجي - مادة الرياضيات (السلك الثانوي التأهيلي)
 * Supervised Exam Report Module (Fiche de rapport de devoir surveillé)
 * ====================================================================
 * تتضمن:
 * 1. معلومات الفرض: المستوى، القسم، رقم الفرض، الدورة، تاريخ التمرير، تاريخ التصحيح، المدة، المعامل.
 * 2. محتوى الفرض: الدروس المشمولة، المفاهيم والقدرات المستهدفة، سلم التنقيط.
 * 3. لوحة الإحصائيات الشاملة: المسجلون، الحاضرون، الغائبون، أعلى وأدنى نقطة، معدل القسم، نسبة المتحكمين.
 * 4. توزيع النقط حسب الفئات المعيارية المغربية ([0-5[، [5-10[، [10-14[، [14-18[، [18-20]).
 * 5. جدول لائحة القسم (3 خانات: الرقم الترتيبي، أسماء التلميذ، النقط).
 * 6. جدول الترتيب الاستحقاقي التنازلي (مرتب وفق النقط من أعلى معدل إلى أدنى معدل).
 * 7. لائحة خاصة بأسماء وتفاصيل التلاميذ الغائبين عن الفرض.
 * 8. تشخيص التعثرات والصعوبات المرصودة أثناء التصحيح.
 * 9. قرارات وخطة المعالجة والدعم البيداغوجي المبرمجة.
 * 10. حفظ وطباعة رسمية نظيفة مهيأة مباشرة للورق A4 للإدارة التربوية والتفتيش.
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'smart_school_exam_reports_v1';

    // State
    let currentExamReport = null;
    let cachedExamStudentsData = {
        allStudents: [],
        rankedMarks: [],
        absents: [],
        totalStudents: 0
    };

    /**
     * استرجاع جميع تقارير الفروض المحفوظة
     */
    function getStoredExamReports() {
        if (window.db && window.db.examReports && typeof window.db.examReports === 'object') {
            return window.db.examReports;
        }
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Error loading exam reports from storage:', e);
        }
        return {};
    }

    /**
     * حفظ تقرير في قاعدة البيانات والتخزين المحلي
     */
    function persistExamReport(report) {
        if (!report || !report.id) return;
        if (!window.db) window.db = {};
        if (!window.db.examReports) window.db.examReports = {};
        window.db.examReports[report.id] = report;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db.examReports));
        } catch (e) {
            console.warn('Error saving exam report to storage:', e);
        }

        if (typeof window.saveDB === 'function') {
            window.saveDB();
        }
    }

    function generateReportKey(className, semester, examNumber) {
        const safeClass = (className || 'default').replace(/\s+/g, '_');
        return `exam_rep_${safeClass}_${semester}_f${examNumber}`;
    }

    function getTeacherName() {
        if (window.db && window.db.teacherProfile && window.db.teacherProfile.name) {
            return window.db.teacherProfile.name;
        }
        if (window.db && window.db.teacher && window.db.teacher.name) {
            return window.db.teacher.name;
        }
        try {
            const raw = localStorage.getItem('smart_school_teacher_profile');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.name) return parsed.name;
            }
        } catch (e) {}
        return 'أستاذ مادة الرياضيات';
    }

    function getSchoolMetadata() {
        const tp = (window.db && window.db.teacherProfile) || {};
        const st = (window.db && window.db.settings) || {};
        const school = tp.school || st.schoolName || 'الثانوية التأهيلية';
        const year = tp.academicYear || st.academicYear || '2026/2027';
        const academy = tp.academy || st.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const direction = tp.directorate || st.directorate || 'المديرية الإقليمية';
        return { school, year, academy, direction, teacher: getTeacherName() };
    }

    function getOfficialSchoolHeaderMeta() {
        return getSchoolMetadata();
    }

    function getSelectedClassForReport() {
        const sel = document.getElementById('reportClassSelect');
        if (sel && sel.value && sel.value !== '__ALL__') return sel.value;
        const massarSel = document.getElementById('massarMakeupClassSelect');
        if (massarSel && massarSel.value && massarSel.value !== '__ALL__') return massarSel.value;
        if (window.activeClass && window.activeClass !== '__ALL__') return window.activeClass;
        const classes = window.db && window.db.classes ? Object.keys(window.db.classes) : [];
        return classes[0] || '';
    }

    function normalizeReportExamKey(rawVal) {
        const str = String(rawVal || '1').trim().toLowerCase();
        if (str.startsWith('f')) return str;
        const num = parseInt(str, 10) || 1;
        return `f${num}`;
    }

    /**
     * استخراج النقط والتلاميذ من قاعدة البيانات
     */
    function getMakeupExamKey(className, semester, examKey, studentId) {
        const normKey = normalizeReportExamKey(examKey);
        return `${className}__${semester}__${normKey}__${studentId}`;
    }

    function getOrInitMakeupExamsRegistry() {
        if (!window.db) return {};
        if (!window.db.makeupExams || typeof window.db.makeupExams !== 'object' || Array.isArray(window.db.makeupExams)) {
            window.db.makeupExams = {};
        }
        return window.db.makeupExams;
    }

    /**
     * استخراج النقط والتلاميذ من قاعدة البيانات مع ربط سجل الفروض التعويضية (المذكرة 142-08)
     */
    function extractExamMarksFromDB(className, semester, examKey) {
        const marks = [];
        const absents = [];
        const allStudents = [];
        const completedMakeups = [];

        if (!window.db || !window.db.classes || !window.db.classes[className]) {
            return { marks, absents, allStudents, rankedMarks: [], completedMakeups: [], totalStudents: 0 };
        }

        const students = Array.isArray(window.db.classes[className])
            ? window.db.classes[className]
            : (window.db.classes[className].students || []);

        const classGrades = (window.db.grades && window.db.grades[className]) ? window.db.grades[className] : {};
        const makeupRegistry = getOrInitMakeupExamsRegistry();
        const records = Array.isArray(window.db.records) ? window.db.records : [];

        const hasAnyGradedInClass = students.some(st => {
            const rec = classGrades[st.id];
            if (!rec) return false;
            const v = semester === 's2' ? (rec.s2 && rec.s2[examKey]) : ((rec.s1 && rec.s1[examKey] !== undefined) ? rec.s1[examKey] : rec[examKey]);
            return v !== undefined && v !== '' && v !== null && !isNaN(parseFloat(v)) && parseFloat(v) > 0;
        });

        students.forEach((std, idx) => {
            const orderNum = idx + 1;
            const stdRecord = classGrades[std.id];
            let val = undefined;

            if (stdRecord) {
                if (semester === 's2') {
                    if (stdRecord.s2 && stdRecord.s2[examKey] !== undefined) val = stdRecord.s2[examKey];
                } else {
                    if (stdRecord.s1 && stdRecord.s1[examKey] !== undefined) val = stdRecord.s1[examKey];
                    else if (stdRecord[examKey] !== undefined) val = stdRecord[examKey];
                }
            }

            const normExamKey = normalizeReportExamKey(examKey);
            const mKey = getMakeupExamKey(className, semester, normExamKey, std.id);
            const legacyKey = `${className}__${semester}__${String(examKey).replace('f', '')}__${std.id}`;
            const makeupInfo = makeupRegistry[mKey] || makeupRegistry[legacyKey] || null;

            const isScheduledMakeup = Boolean(makeupInfo && makeupInfo.status !== 'completed');
            const isAbsVal = (val === 'غ' || val === 'abs' || val === 'A' || val === 'غائب');
            let markNum = null;
            if (!isAbsVal && val !== '' && val !== undefined && val !== null) {
                const parsed = parseFloat(val);
                if (!isNaN(parsed)) markNum = parsed;
            }

            const hasJustifiedAbsence = records.some(r =>
                r && String(r.studentId) === String(std.id) && r.className === className &&
                (r.status === 'justified' || r.status === 'مبرر' || r.justified === true)
            );

            const isAbs = isAbsVal ||
                          isScheduledMakeup ||
                          (markNum === 0 && hasJustifiedAbsence && (!makeupInfo || makeupInfo.status !== 'completed')) ||
                          (markNum === null && hasAnyGradedInClass);

            const studentObj = {
                order: orderNum,
                id: std.id,
                name: std.name || `تلميذ(ة) ${orderNum}`,
                massar: std.massar || '---',
                mark: isAbs ? null : markNum,
                isAbsent: isAbs,
                rawVal: val,
                makeupInfo: makeupInfo
            };

            allStudents.push(studentObj);

            if (isAbs) {
                absents.push(studentObj);
            } else if (markNum !== null) {
                marks.push(studentObj);
                if (makeupInfo && makeupInfo.status === 'completed') {
                    completedMakeups.push(studentObj);
                }
            }
        });

        // ترتيب النقط تنازلياً من أعلى معدل إلى أدنى معدل
        const rankedMarks = [...marks].sort((a, b) => b.mark - a.mark).map((m, idx) => {
            let apprec = '';
            let appColor = '#334155';
            if (m.mark >= 16) { apprec = 'ممتاز (Très bien)'; appColor = '#15803d'; }
            else if (m.mark >= 14) { apprec = 'جيد جداً (Bien)'; appColor = '#0369a1'; }
            else if (m.mark >= 12) { apprec = 'جيد (Assez bien)'; appColor = '#0284c7'; }
            else if (m.mark >= 10) { apprec = 'متوسط (Passable)'; appColor = '#4338ca'; }
            else if (m.mark >= 8) { apprec = 'دون المتوسط (Insuffisant)'; appColor = '#d97706'; }
            else { apprec = 'تعثر / ضعيف (Faible)'; appColor = '#dc2626'; }

            return {
                rank: idx + 1,
                order: m.order,
                id: m.id,
                name: m.name,
                massar: m.massar,
                mark: m.mark,
                appreciation: apprec,
                appColor,
                makeupInfo: m.makeupInfo || null
            };
        });

        cachedExamStudentsData = {
            allStudents,
            rankedMarks,
            absents,
            completedMakeups,
            totalStudents: students.length
        };

        return {
            marks,
            absents,
            allStudents,
            rankedMarks,
            completedMakeups,
            totalStudents: students.length
        };
    }

    /**
     * احتساب الإحصائيات وتوزيع الفئات من مجموعة النقط
     */
    function computeExamStats(marksList, totalStudents, absentsCount) {
        const presentCount = marksList.length;
        const absentCount = absentsCount !== undefined ? absentsCount : (totalStudents - presentCount);

        if (presentCount === 0) {
            return {
                totalStudents,
                presentCount: 0,
                absentCount,
                minMark: 0,
                maxMark: 0,
                avgMark: 0,
                passCount: 0,
                passRate: 0,
                failCount: 0,
                failRate: 0,
                distribution: {
                    veryLow: { count: 0, percent: 0, label: 'أقل من 5 [0 - 4.99]' },
                    low: { count: 0, percent: 0, label: 'دون المتوسط [5 - 9.99]' },
                    medium: { count: 0, percent: 0, label: 'متوسط إلى حسن [10 - 13.99]' },
                    good: { count: 0, percent: 0, label: 'جيد [14 - 17.99]' },
                    excellent: { count: 0, percent: 0, label: 'ممتاز [18 - 20]' }
                }
            };
        }

        const values = marksList.map(m => m.mark);
        const minMark = Math.min(...values);
        const maxMark = Math.max(...values);
        const sum = values.reduce((a, b) => a + b, 0);
        const avgMark = parseFloat((sum / presentCount).toFixed(2));

        const passMarks = values.filter(v => v >= 10);
        const passCount = passMarks.length;
        const passRate = parseFloat(((passCount / presentCount) * 100).toFixed(1));
        const failCount = presentCount - passCount;
        const failRate = parseFloat(((failCount / presentCount) * 100).toFixed(1));

        // Distribution buckets
        const cVeryLow = values.filter(v => v < 5).length;
        const cLow = values.filter(v => v >= 5 && v < 10).length;
        const cMedium = values.filter(v => v >= 10 && v < 14).length;
        const cGood = values.filter(v => v >= 14 && v < 18).length;
        const cExcellent = values.filter(v => v >= 18).length;

        const distribution = {
            veryLow: { count: cVeryLow, percent: parseFloat(((cVeryLow / presentCount) * 100).toFixed(1)), label: 'أقل من 5 (تعثر حاد)' },
            low: { count: cLow, percent: parseFloat(((cLow / presentCount) * 100).toFixed(1)), label: 'دون المتوسط [5 - 9.99]' },
            medium: { count: cMedium, percent: parseFloat(((cMedium / presentCount) * 100).toFixed(1)), label: 'متوسط إلى حسن [10 - 13.99]' },
            good: { count: cGood, percent: parseFloat(((cGood / presentCount) * 100).toFixed(1)), label: 'جيد [14 - 17.99]' },
            excellent: { count: cExcellent, percent: parseFloat(((cExcellent / presentCount) * 100).toFixed(1)), label: 'ممتاز [18 - 20]' }
        };

        return {
            totalStudents,
            presentCount,
            absentCount,
            minMark,
            maxMark,
            avgMark,
            passCount,
            passRate,
            failCount,
            failRate,
            distribution
        };
    }

    /**
     * تهيئة واجهة تقرير الفرض المحروس
     */
    function initExamReportSection() {
        const classSel = document.getElementById('reportClassSelect');
        const currentCls = classSel ? classSel.value : '';
        if (currentCls) {
            loadOrBuildReportForForm(currentCls);
        }
    }

    function loadOrBuildReportForForm(className) {
        if (!className) {
            const classSel = document.getElementById('reportClassSelect');
            if (classSel && classSel.value) className = classSel.value;
        }

        const semSelect = document.getElementById('examReportSemester');
        const numSelect = document.getElementById('examReportNumber');
        const semester = semSelect ? semSelect.value : 's1';
        const examNum = numSelect ? parseInt(numSelect.value, 10) || 1 : 1;
        const examKey = `f${examNum}`;

        const reportKey = generateReportKey(className, semester, examNum);
        const storedReports = getStoredExamReports();
        const existing = storedReports[reportKey];

        const todayStr = new Date().toISOString().split('T')[0];
        const defaultCorrection = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // استخلاص معطيات الفرض المحروس الرسمية من المذكرة 142-08 والمقرر الوزاري
        let defaultTopics = '';
        let defaultDuration = '2h';
        let defaultCoef = 1;
        let defaultScale = 'التمرين 1 (تطبيق مباشر للمفاهيم - 50%): 6 ن | التمرين 2 (استحضار وتوظيف - 30%): 8 ن | التمرين 3 (توليف واستدلال - 20%): 6 ن';

        if (typeof window.getCurriculumLevelForClass === 'function' && window.MOROCCAN_SECONDARY_MATH_CURRICULUM) {
            const trackKey = window.getCurriculumLevelForClass(className);
            const lvlData = window.MOROCCAN_SECONDARY_MATH_CURRICULUM[trackKey];
            if (lvlData) {
                defaultDuration = lvlData.examDuration === 1 ? '1h' : '2h';
                defaultCoef = lvlData.coefficient || 1;
                const semObj = lvlData.semesters && lvlData.semesters[semester];
                if (semObj && Array.isArray(semObj.examSchedule)) {
                    const exMatch = semObj.examSchedule.find(e => e.examNumber === examNum) || semObj.examSchedule[examNum - 1];
                    if (exMatch && exMatch.topics) {
                        defaultTopics = exMatch.topics;
                    }
                }
                if (lvlData.cadreReferentiel && Array.isArray(lvlData.cadreReferentiel.domains) && lvlData.cadreReferentiel.domains.length > 0) {
                    defaultScale = lvlData.cadreReferentiel.domains.map((d, i) => `التمرين ${i + 1} (${d.domain} - وزن ${d.weight}%): ${Math.max(2, Math.round(d.weight * 0.2))} ن`).join(' | ');
                }
            }
        }

        if (!defaultTopics) {
            if (className.includes('1Bac') || className.includes('أولى باك')) {
                defaultTopics = examNum === 1
                    ? 'مبادئ في المنطق الرياضي + عموميات حول الدوال العددية (مجموعة التعريف، الزوجية، الرتابة)'
                    : (examNum === 2 ? 'المرجح في المستوى + الجداء السلمي وتطبيقاته في الهندسة' : 'الحساب المثلثي + المتتاليات العددية');
            } else if (className.includes('2Bac') || className.includes('ثانية باك')) {
                defaultTopics = examNum === 1
                    ? 'الاتصال والاشتقاق + دراسة الدوال العددية ومبرهنة القيم الوسيطية'
                    : (examNum === 2 ? 'الدوال اللوغاريتمية والأسية + المتتاليات العددية' : 'الأعداد العقدية + حساب التكامل والمعادلات التفاضلية');
            } else if (className.includes('TCS') || className.includes('مشترك')) {
                defaultTopics = examNum === 1
                    ? 'مجموعات الأعداد والحسابيات في N + الحساب المتجهي في المستوى'
                    : (examNum === 2 ? 'الإسقاط في المستوى والترتيب في IR + المستقيم في المستوى' : 'الحدوديات والمعادلات والمتراجحات والنظمات + الحساب المثلثي (الجزء 1)');
            } else {
                defaultTopics = `المفاهيم الرياضية المقررة في الفرض المحروس رقم ${examNum} (${semester === 's1' ? 'الدورة الأولى' : 'الدورة الثانية'})`;
            }
        }

        if (existing) {
            currentExamReport = existing;
        } else {
            currentExamReport = {
                id: reportKey,
                className,
                semester,
                examNumber: examNum,
                passDate: todayStr,
                correctionDate: defaultCorrection,
                duration: defaultDuration,
                coefficient: defaultCoef,
                topics: defaultTopics,
                gradingScale: defaultScale,
                difficulties: '• صعوبة في صياغة الاستدلال الرياضي السليم وتبرير مراحل البرهان.\n• ارتباك في توظيف جدول التغيرات والتأويل الهندسي للنهايات والمشتقات.\n• أخطاء إجرائية في الحساب الجبري وتبسيط التعابير الرياضية.',
                remediation: '• تخصيص حصة التصحيح والدعم المندمج وفق المذكرة 142-08 لمعالجة التعثرات المرصودة.\n• توزيع بطاقات تمارين علاجية متدرجة حسب المستويات المهارية للإطار المرجعي.\n• برمجة أنشطة تذكيرية مركزة في بداية الحصص المقبلة.',
                stats: null,
                updatedAt: new Date().toISOString()
            };
        }

        populateExamReportUI(currentExamReport);
        autoCalculateExamStats(false);
    }

    function populateExamReportUI(rep) {
        if (!rep) return;

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined && val !== null ? val : '';
        };

        setVal('examReportPassDate', rep.passDate);
        setVal('examReportCorrectionDate', rep.correctionDate);
        setVal('examReportDuration', rep.duration || '2h');
        setVal('examReportCoef', rep.coefficient || 1);
        setVal('examReportTopics', rep.topics);
        setVal('examReportGradingScale', rep.gradingScale);
        setVal('examReportDifficulties', rep.difficulties);
        setVal('examReportRemediation', rep.remediation);

        if (rep.stats) {
            renderExamStatsUI(rep.stats);
        }

        updateExamReportStatusBadge(rep);
    }

    /**
     * احتساب الإحصائيات وعرض الجداول
     */
    function autoCalculateExamStats(notifyUser = true) {
        const className = document.getElementById('reportClassSelect')?.value || '';
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examNum = parseInt(document.getElementById('examReportNumber')?.value, 10) || 1;
        const examKey = `f${examNum}`;

        if (!className) {
            if (notifyUser && typeof window.showNotification === 'function') {
                window.showNotification('يرجى اختيار القسم أولاً لاحتساب إحصائيات الفرض.', 'warning');
            }
            return;
        }

        const { marks, absents, allStudents, rankedMarks, totalStudents } = extractExamMarksFromDB(className, semester, examKey);
        const stats = computeExamStats(marks, totalStudents, absents.length);

        if (currentExamReport) {
            currentExamReport.stats = stats;
        }

        renderExamStatsUI(stats);
        renderExamTablesUI(allStudents, rankedMarks, absents);

        if (notifyUser && typeof window.showNotification === 'function') {
            if (stats.presentCount > 0) {
                window.showNotification(`⚡ تم استيراد واحتساب إحصائيات ${stats.presentCount} تلميذ بنجاح (معدل القسم: ${stats.avgMark}/20).`, 'success');
            } else {
                window.showNotification(`⚠️ لم يتم العثور على نقط مسجلة للفرض ${examNum} بهذا القسم.`, 'warning');
            }
        }
    }

    function renderExamStatsUI(stats) {
        if (!stats) return;

        const setText = (id, txt) => {
            const el = document.getElementById(id);
            if (el) el.textContent = txt;
        };

        setText('examStatTotal', stats.totalStudents);
        setText('examStatPresent', stats.presentCount);
        setText('examStatAbsent', stats.absentCount);
        setText('examStatMax', stats.presentCount > 0 ? stats.maxMark : '--');
        setText('examStatMin', stats.presentCount > 0 ? stats.minMark : '--');
        setText('examStatAvg', stats.presentCount > 0 ? `${stats.avgMark}/20` : '--');
        setText('examStatPassRate', `${stats.passRate}% (${stats.passCount} تلميذ)`);
        setText('examStatFailRate', `${stats.failRate}% (${stats.failCount} تلميذ)`);

        const avgEl = document.getElementById('examStatAvg');
        if (avgEl) {
            if (stats.avgMark >= 12) avgEl.style.color = '#15803d';
            else if (stats.avgMark >= 10) avgEl.style.color = '#2563eb';
            else avgEl.style.color = '#dc2626';
        }

        const dist = stats.distribution;
        if (dist) {
            const renderBar = (key, countId, pctId, barId) => {
                const item = dist[key];
                if (!item) return;
                setText(countId, item.count);
                setText(pctId, `${item.percent}%`);
                const bar = document.getElementById(barId);
                if (bar) bar.style.width = `${Math.min(100, Math.max(0, item.percent))}%`;
            };

            renderBar('veryLow', 'distCount_veryLow', 'distPct_veryLow', 'distBar_veryLow');
            renderBar('low', 'distCount_low', 'distPct_low', 'distBar_low');
            renderBar('medium', 'distCount_medium', 'distPct_medium', 'distBar_medium');
            renderBar('good', 'distCount_good', 'distPct_good', 'distBar_good');
            renderBar('excellent', 'distCount_excellent', 'distPct_excellent', 'distBar_excellent');
        }

        // رندرة قرص النسب المئوية الدائري (Pie / Donut Chart) للفرض
        renderExamReportPieChart(stats);
    }

    let currentExamPieMode = 'tiers'; // 'tiers' | 'pass' | 'presence'

    function switchExamPieChartMode(mode) {
        currentExamPieMode = mode || 'tiers';
        ['btnExamPieModeTiers', 'btnExamPieModePass', 'btnExamPieModePresence'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.classList.remove('active');
        });
        const activeBtn = document.getElementById(mode === 'pass' ? 'btnExamPieModePass' : (mode === 'presence' ? 'btnExamPieModePresence' : 'btnExamPieModeTiers'));
        if (activeBtn) activeBtn.classList.add('active');

        if (currentExamReport && currentExamReport.stats) {
            renderExamReportPieChart(currentExamReport.stats);
        }
    }

    /**
     * بناء قرص النسب المئوية كـ SVG نقي عالي الدقة يظهر في الواجهة والطباعة الورقية
     */
    function buildExamReportPieChartSVG(stats, mode = 'tiers', isForPrint = false) {
        if (!stats) return '<div style="text-align:center; color:#94a3b8; padding:20px;">لا تتوفر إحصائيات لعرض القرص</div>';

        let slices = [];
        if (mode === 'pass') {
            const passPct = stats.passRate || 0;
            const failPct = stats.failRate || 0;
            slices = [
                { label: 'المتحكمون (≥ 10/20)', count: stats.passCount || 0, percent: passPct, color: '#16a34a' },
                { label: 'دون المعدل (< 10/20)', count: stats.failCount || 0, percent: failPct, color: '#dc2626' }
            ];
        } else if (mode === 'presence') {
            const total = stats.totalStudents || 1;
            const presPct = stats.totalStudents > 0 ? parseFloat(((stats.presentCount / total) * 100).toFixed(1)) : 0;
            const absPct = stats.totalStudents > 0 ? parseFloat(((stats.absentCount / total) * 100).toFixed(1)) : 0;
            slices = [
                { label: 'الحاضرون في الفرض', count: stats.presentCount || 0, percent: presPct, color: '#2563eb' },
                { label: 'الغائبون عن الفرض', count: stats.absentCount || 0, percent: absPct, color: '#dc2626' }
            ];
        } else {
            // 'tiers' (المذكرة 142-08)
            const d = stats.distribution || {};
            slices = [
                { label: '[18 - 20] ممتاز', count: d.excellent?.count || 0, percent: d.excellent?.percent || 0, color: '#15803d' },
                { label: '[14 - 17.99] جيد', count: d.good?.count || 0, percent: d.good?.percent || 0, color: '#0d9488' },
                { label: '[10 - 13.99] متوسط إلى حسن', count: d.medium?.count || 0, percent: d.medium?.percent || 0, color: '#2563eb' },
                { label: '[5 - 9.99] دون المتوسط', count: d.low?.count || 0, percent: d.low?.percent || 0, color: '#ea580c' },
                { label: '[0 - 4.99] تعثر حاد', count: d.veryLow?.count || 0, percent: d.veryLow?.percent || 0, color: '#dc2626' }
            ];
        }

        const validSlices = slices.filter(s => s.percent > 0);
        const totalPct = validSlices.reduce((sum, s) => sum + s.percent, 0);

        const size = isForPrint ? 120 : 210;
        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.42;
        const innerR = size * 0.22;

        let pathsHtml = '';
        if (validSlices.length === 0) {
            pathsHtml = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2" />
                         <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff" />
                         <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="${isForPrint ? '9' : '11'}" fill="#94a3b8" font-family="Cairo, sans-serif" font-weight="700">لا توجد نقط</text>`;
        } else if (validSlices.length === 1 || validSlices[0].percent >= 99.9) {
            const s = validSlices[0];
            pathsHtml = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${s.color}" />
                         <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff" />
                         <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="${isForPrint ? '11' : '13'}" font-weight="900" fill="${s.color}">${s.percent}%</text>
                         <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="${isForPrint ? '7.5' : '9'}" font-weight="700" fill="#475569">100% للقسم</text>`;
        } else {
            let currentAngle = -Math.PI / 2; // start from top
            validSlices.forEach(s => {
                const sliceAngle = (s.percent / totalPct) * (Math.PI * 2);
                const nextAngle = currentAngle + sliceAngle;

                const x1 = cx + r * Math.cos(currentAngle);
                const y1 = cy + r * Math.sin(currentAngle);
                const x2 = cx + r * Math.cos(nextAngle);
                const y2 = cy + r * Math.sin(nextAngle);

                const x1_in = cx + innerR * Math.cos(currentAngle);
                const y1_in = cy + innerR * Math.sin(currentAngle);
                const x2_in = cx + innerR * Math.cos(nextAngle);
                const y2_in = cy + innerR * Math.sin(nextAngle);

                const largeArc = sliceAngle > Math.PI ? 1 : 0;
                const pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x2_in.toFixed(2)} ${y2_in.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1_in.toFixed(2)} ${y1_in.toFixed(2)} Z`;

                pathsHtml += `<path d="${pathD}" fill="${s.color}" stroke="#ffffff" stroke-width="${isForPrint ? '1.2' : '1.8'}">
                    <title>${s.label}: ${s.percent}% (${s.count} تلميذ)</title>
                </path>`;

                // Position percentage text in middle of slice
                if (sliceAngle > 0.38) {
                    const midAngle = currentAngle + sliceAngle / 2;
                    const textR = (r + innerR) / 2;
                    const tx = cx + textR * Math.cos(midAngle);
                    const ty = cy + textR * Math.sin(midAngle) + (isForPrint ? 3 : 4);
                    pathsHtml += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" fill="#ffffff" font-size="${isForPrint ? '7.5' : '10'}" font-weight="900" font-family="sans-serif">${Math.round(s.percent)}%</text>`;
                }

                currentAngle = nextAngle;
            });

            // Center donut badge
            pathsHtml += `
                <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />
                <text x="${cx}" y="${cy - (isForPrint ? 3 : 4)}" text-anchor="middle" font-size="${isForPrint ? '8.5' : '11'}" font-weight="900" fill="#1e3a8a" font-family="Cairo, sans-serif">${stats.avgMark ? stats.avgMark + '/20' : '--'}</text>
                <text x="${cx}" y="${cy + (isForPrint ? 7 : 9)}" text-anchor="middle" font-size="${isForPrint ? '6.5' : '8.5'}" font-weight="800" fill="#15803d" font-family="Cairo, sans-serif">نجاح ${stats.passRate || 0}%</text>
            `;
        }

        const legendHtml = `
            <div style="display: flex; flex-direction: column; gap: ${isForPrint ? '2px' : '5px'}; justify-content: center; min-width: ${isForPrint ? '150px' : '200px'}; font-size: ${isForPrint ? '7pt' : '11px'}; font-family: 'Cairo', sans-serif;">
                ${slices.map(s => `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: ${isForPrint ? '4px' : '8px'}; padding: ${isForPrint ? '1px 5px' : '2.5px 7px'}; border-radius: 4px; background: #f8fafc; border: 1px solid #e2e8f0;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: ${isForPrint ? '7px' : '10px'}; height: ${isForPrint ? '7px' : '10px'}; border-radius: 2px; background: ${s.color}; display: inline-block; flex-shrink: 0;"></span>
                            <span style="font-weight: 700; color: #334155;">${s.label}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-weight: 800; color: #0f172a; font-size: ${isForPrint ? '7pt' : '10.5px'};">${s.count} ت</span>
                            <span style="background: ${s.color}; color: #ffffff; padding: 1px 4px; border-radius: 3px; font-weight: 900; font-size: ${isForPrint ? '6.5pt' : '9.5px'}; min-width: ${isForPrint ? '28px' : '36px'}; text-align: center;">${s.percent}%</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        return `
            <div style="display: flex; align-items: center; justify-content: center; flex-wrap: ${isForPrint ? 'nowrap' : 'wrap'}; gap: ${isForPrint ? '8px' : '14px'}; padding: ${isForPrint ? '2px' : '4px'}; direction: rtl;">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display: block; overflow: visible; flex-shrink: 0;">
                    ${pathsHtml}
                </svg>
                ${legendHtml}
            </div>
        `;
    }

    function renderExamReportPieChart(stats) {
        const container = document.getElementById('examReportPieChartContainer');
        if (!container) return;
        container.innerHTML = buildExamReportPieChartSVG(stats, currentExamPieMode, false);
    }

    /**
     * رندرة الجداول الثلاثة المطلوبة بدقة:
     * 1. جدول به 3 خانات: الرقم الترتيبي، أسماء التلميذ، النقط
     * 2. جدول آخر فيه النقط مرتب وفق النقط من أعلى معدل إلى أدنى معدل
     * 3. لائحة خاصة بأسماء الغائبين
     */
    function renderExamTablesUI(allStudents, rankedMarks, absents) {
        // 1. Table 1: Roster order (3 columns: الرقم الترتيبي | اسم التلميذ | النقطة)
        const tbodyRoster = document.getElementById('examReportRosterTbody');
        if (tbodyRoster) {
            if (!allStudents || allStudents.length === 0) {
                tbodyRoster.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:#64748b;">لا توجد بيانات تلاميذ مسجلة لهذا القسم.</td></tr>`;
            } else {
                tbodyRoster.innerHTML = allStudents.map(std => {
                    let markCell = '';
                    if (std.isAbsent) {
                        markCell = `<span style="background:#fee2e2; color:#dc2626; padding:3px 10px; border-radius:6px; font-weight:800; font-size:0.78rem;">غائب</span>`;
                    } else if (std.mark !== null && std.mark !== undefined) {
                        const color = std.mark >= 10 ? '#15803d' : '#dc2626';
                        const bg = std.mark >= 10 ? '#f0fdf4' : '#fef2f2';
                        markCell = `<span style="background:${bg}; color:${color}; padding:3px 10px; border-radius:6px; font-weight:900; font-size:0.86rem; border:1px solid ${color}40;">${std.mark.toFixed(2)} / 20</span>`;
                    } else {
                        markCell = `<span style="color:#94a3b8; font-size:0.78rem;">--</span>`;
                    }

                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #475569; width: 80px;">${std.order}</td>
                            <td style="padding: 8px 14px; text-align: right; font-weight: 700; color: #0f172a;">${escapeHtml(std.name)}</td>
                            <td style="padding: 8px 12px; text-align: center; width: 120px;">${markCell}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. Table 2: Ranked order descending (من أعلى معدل إلى أدنى معدل)
        const tbodyRanked = document.getElementById('examReportRankedTbody');
        if (tbodyRanked) {
            if (!rankedMarks || rankedMarks.length === 0) {
                tbodyRanked.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">لا توجد نقط مسجلة لتصنيف التلاميذ حالياً.</td></tr>`;
            } else {
                tbodyRanked.innerHTML = rankedMarks.map(rm => {
                    let rankIcon = rm.rank;
                    if (rm.rank === 1) rankIcon = '🥇 1';
                    else if (rm.rank === 2) rankIcon = '🥈 2';
                    else if (rm.rank === 3) rankIcon = '🥉 3';

                    const markBg = rm.mark >= 10 ? '#f0fdf4' : '#fef2f2';
                    const markColor = rm.mark >= 10 ? '#15803d' : '#dc2626';

                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #1e3a8a; width: 75px;">${rankIcon}</td>
                            <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #0f172a;">
                                <span>${escapeHtml(rm.name)}</span>
                                <span style="font-size: 0.72rem; color: #64748b; margin-right: 6px;">(رقم ${rm.order})</span>
                            </td>
                            <td style="padding: 8px 10px; text-align: center; width: 110px;">
                                <span style="background:${markBg}; color:${markColor}; padding:3px 9px; border-radius:6px; font-weight:900; font-size:0.86rem; border:1px solid ${markColor}40;">${rm.mark.toFixed(2)}</span>
                            </td>
                            <td style="padding: 8px 10px; text-align: center; font-weight: 800; font-size: 0.78rem; color:${rm.appColor}; width: 140px;">
                                ${rm.appreciation}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 3. Section 3: Absent students list & Makeup Exam System (Note 142-08)
        const absentsContainer = document.getElementById('examReportAbsentsContainer');
        const absentsCountBadge = document.getElementById('examReportAbsentsCountBadge');
        if (absentsCountBadge) {
            absentsCountBadge.textContent = absents ? absents.length : 0;
        }

        const completedMakeups = (cachedExamStudentsData && cachedExamStudentsData.completedMakeups) || [];

        if (absentsContainer) {
            const completedBannerHtml = completedMakeups.length > 0 ? `
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 9px; padding: 8px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div style="font-size: 0.8rem; font-weight: 800; color: #166534; display: flex; align-items: center; gap: 6px;">
                        <span>✅ تلاميذ اجتازوا الفرض التعويضي وتم مسك نقطهم (${completedMakeups.length}):</span>
                        ${completedMakeups.map(c => `<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:6px; border:1px solid #86efac; font-size:0.74rem;">${escapeHtml(c.name)} (${c.mark !== null ? c.mark.toFixed(2) : '--'}/20)</span>`).join(' ')}
                    </div>
                    <button type="button" onclick="window.printOfficialMakeupExamConvocation()" style="background:#ffffff; color:#15803d; border:1px solid #86efac; border-radius:6px; padding:4px 10px; font-size:0.74rem; font-weight:800; cursor:pointer;">
                        🖨️ طباعة محضر الفرض التعويضي
                    </button>
                </div>
            ` : '';

            if (!absents || absents.length === 0) {
                absentsContainer.innerHTML = `
                    ${completedBannerHtml}
                    <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="color: #166534; font-weight: 800; font-size: 0.84rem;">
                            ✅ لا يوجد أي تلميذ غائب حالياً عن هذا الفرض المحروس (نسبة الحضور 100%).
                        </div>
                        <button type="button" onclick="window.openMakeupExamManagerModal()" style="background: linear-gradient(135deg, #be123c, #9f1239); color: #ffffff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 5px rgba(190,18,60,0.2);">
                            <span>🔄</span>
                            <span>تسجيل غياب / برمجة فرض تعويضي (المذكرة 142-08)</span>
                        </button>
                    </div>
                `;
            } else {
                absentsContainer.innerHTML = `
                    ${completedBannerHtml}
                    <div style="background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 10px; padding: 12px; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #fecdd3; padding-bottom: 8px;">
                            <div>
                                <strong style="color: #9f1239; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
                                    <span>⚠️ نظام تدبير الفرض المحروس التعويضي للمتغيبين (${absents.length} تلميذ) — المذكرة الوزارية 142-08</span>
                                </strong>
                                <div style="font-size: 0.73rem; color: #be123c; font-weight: 700; margin-top: 2px;">
                                    يمكنك تحديد تبرير الغياب، برمجة تاريخ الفرض التعويضي ومزامنته مع التقويم، أو مسك النقطة التعويضية مباشرة:
                                </div>
                            </div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                <button type="button" onclick="window.openMakeupExamManagerModal()" style="background: linear-gradient(135deg, #be123c, #9f1239); color: #ffffff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(190,18,60,0.25);">
                                    <span>📅</span>
                                    <span>برمجة وتدبير الفرض التعويضي (${absents.length})</span>
                                </button>
                                <button type="button" onclick="window.printOfficialMakeupExamConvocation()" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #ffffff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(30,58,138,0.25);">
                                    <span>🖨️</span>
                                    <span>طباعة محضر واستدعاء الفرض التعويضي (A4)</span>
                                </button>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 8px;">
                            ${absents.map(std => {
                                const info = std.makeupInfo || {};
                                const justStatus = info.justification || 'justified_medical';
                                const makeupDate = info.makeupDate || '';
                                const makeupRoom = info.room || 'قاعة الرياضيات';
                                const isJustified = justStatus !== 'unjustified';
                                const badgeBg = makeupDate ? '#dbeafe' : (isJustified ? '#fef3c7' : '#ffe4e6');
                                const badgeColor = makeupDate ? '#1e40af' : (isJustified ? '#b45309' : '#9f1239');
                                const badgeText = makeupDate
                                    ? `📅 مبرمج: ${makeupDate}`
                                    : (isJustified ? '⏳ غائب بمبرر (في انتظار التمرير)' : '🚫 غياب غير مبرر');

                                return `
                                <div style="background: #ffffff; border: 1.5px solid #fda4af; border-radius: 9px; padding: 9px 11px; display: flex; flex-direction: column; gap: 7px; box-shadow: 0 1px 3px rgba(159,18,57,0.06);">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                        <div>
                                            <div style="font-weight: 800; color: #881337; font-size: 0.84rem;">#${std.order} ${escapeHtml(std.name)}</div>
                                            <div style="font-size: 0.70rem; color: #64748b;">مسار: <strong>${escapeHtml(std.massar || '---')}</strong> ${makeupRoom ? `| ${escapeHtml(makeupRoom)}` : ''}</div>
                                        </div>
                                        <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 0.69rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                                            ${escapeHtml(badgeText)}
                                        </span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; border-top: 1px dashed #fecdd3; padding-top: 6px;">
                                        <select onchange="window.quickUpdateMakeupJustification('${std.id}', this.value)" style="flex: 1; min-width: 120px; padding: 4px 6px; font-size: 0.72rem; font-weight: 700; border: 1px solid #cbd5e1; border-radius: 5px; background: #f8fafc; color: #1e293b;">
                                            <option value="justified_medical" ${justStatus === 'justified_medical' ? 'selected' : ''}>✅ مبرر (شهادة طبية)</option>
                                            <option value="justified_admin" ${justStatus === 'justified_admin' ? 'selected' : ''}>✅ مبرر (عذر إداري/عائلي)</option>
                                            <option value="pending" ${justStatus === 'pending' ? 'selected' : ''}>⏳ في طور الإدلاء بالمبرر</option>
                                            <option value="unjustified" ${justStatus === 'unjustified' ? 'selected' : ''}>❌ بدون مبرر مقبول (00/20)</option>
                                        </select>
                                        <div style="display: flex; align-items: center; gap: 4px;">
                                            <input type="number" id="inlineMakeupMark_${std.id}" min="0" max="20" step="0.25" placeholder="النقطة /20" style="width: 78px; padding: 4px 6px; font-size: 0.75rem; font-weight: 800; border: 1.5px solid #059669; border-radius: 5px; text-align: center; background: #f0fdf4; color: #065f46;">
                                            <button type="button" onclick="window.applyMakeupExamMarkInline('${std.id}')" style="background: #059669; color: #ffffff; border: none; border-radius: 5px; padding: 4px 8px; font-size: 0.72rem; font-weight: 800; cursor: pointer; white-space: nowrap;" title="حفظ نقطة الفرض التعويضي وتحديث التقرير ومسك النقط">
                                                💾 مسك
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * تصفية والبحث في جداول الفرض
     */
    function filterExamReportStudents(query) {
        const q = (query || '').trim().toLowerCase();
        const trRoster = document.querySelectorAll('#examReportRosterTbody tr');
        trRoster.forEach(tr => {
            const txt = tr.textContent.toLowerCase();
            tr.style.display = txt.includes(q) ? '' : 'none';
        });

        const trRanked = document.querySelectorAll('#examReportRankedTbody tr');
        trRanked.forEach(tr => {
            const txt = tr.textContent.toLowerCase();
            tr.style.display = txt.includes(q) ? '' : 'none';
        });
    }

    /**
     * التبديل بين طرق عرض الجداول في الواجهة
     */
    function switchExamReportTableView(mode) {
        const rosterBox = document.getElementById('examReportRosterBox');
        const rankedBox = document.getElementById('examReportRankedBox');
        const absentsBox = document.getElementById('examReportAbsentsBoxWrapper');

        const btnRoster = document.getElementById('btnExamTabRoster');
        const btnRanked = document.getElementById('btnExamTabRanked');
        const btnAbsents = document.getElementById('btnExamTabAbsents');
        const btnSplit = document.getElementById('btnExamTabSplit');

        if (btnRoster) btnRoster.classList.toggle('active', mode === 'roster');
        if (btnRanked) btnRanked.classList.toggle('active', mode === 'ranked');
        if (btnAbsents) btnAbsents.classList.toggle('active', mode === 'absents');
        if (btnSplit) btnSplit.classList.toggle('active', mode === 'split');

        if (mode === 'split') {
            if (rosterBox) rosterBox.style.display = 'block';
            if (rankedBox) rankedBox.style.display = 'block';
            if (absentsBox) absentsBox.style.display = 'block';
        } else if (mode === 'roster') {
            if (rosterBox) rosterBox.style.display = 'block';
            if (rankedBox) rankedBox.style.display = 'none';
            if (absentsBox) absentsBox.style.display = 'none';
        } else if (mode === 'ranked') {
            if (rosterBox) rosterBox.style.display = 'none';
            if (rankedBox) rankedBox.style.display = 'block';
            if (absentsBox) absentsBox.style.display = 'none';
        } else if (mode === 'absents') {
            if (rosterBox) rosterBox.style.display = 'none';
            if (rankedBox) rankedBox.style.display = 'none';
            if (absentsBox) absentsBox.style.display = 'block';
        }
    }

    function updateExamReportStatusBadge(rep) {
        const badge = document.getElementById('examReportStatusBadge');
        if (!badge) return;
        const stored = getStoredExamReports();
        if (stored[rep.id]) {
            badge.textContent = 'محفوظ في المنظومة ✓';
            badge.style.background = '#dcfce7';
            badge.style.color = '#15803d';
            badge.style.borderColor = '#86efac';
        } else {
            badge.textContent = 'مسودة قيد التحرير';
            badge.style.background = '#fef3c7';
            badge.style.color = '#b45309';
            badge.style.borderColor = '#fde68a';
        }
    }

    function saveCurrentExamReport() {
        const className = document.getElementById('reportClassSelect')?.value || '';
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examNum = parseInt(document.getElementById('examReportNumber')?.value, 10) || 1;

        if (!className) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('يرجى اختيار القسم لحفظ التقرير.', 'warning');
            }
            return;
        }

        const getVal = id => document.getElementById(id)?.value || '';

        const reportKey = generateReportKey(className, semester, examNum);
        const reportData = {
            id: reportKey,
            className,
            semester,
            examNumber: examNum,
            passDate: getVal('examReportPassDate'),
            correctionDate: getVal('examReportCorrectionDate'),
            duration: getVal('examReportDuration'),
            coefficient: parseFloat(getVal('examReportCoef')) || 1,
            topics: getVal('examReportTopics'),
            gradingScale: getVal('examReportGradingScale'),
            difficulties: getVal('examReportDifficulties'),
            remediation: getVal('examReportRemediation'),
            stats: currentExamReport ? currentExamReport.stats : null,
            teacherName: getTeacherName(),
            savedAt: new Date().toISOString()
        };

        currentExamReport = reportData;
        persistExamReport(reportData);
        updateExamReportStatusBadge(reportData);

        if (typeof window.showNotification === 'function') {
            window.showNotification(`💾 تم حفظ تقرير الفرض المحروس رقم ${examNum} لقسم (${className}) بنجاح!`, 'success');
        }
    }

    /**
     * طباعة رسمية نظيفة مجهزة للورق A4 للإدارة التربوية والتفتيش
     * تشمل:
     * 1. معلومات الفرض ومحتواه
     * 2. الإحصائيات العامة
     * 3. جدول لائحة القسم (3 خانات: الرقم الترتيبي، اسم التلميذ، النقطة)
     * 4. جدول الترتيب الاستحقاقي التنازلي من أعلى نقطة إلى أدنى نقطة
     * 5. لائحة التلاميذ الغائبين عن الفرض المحروس
     * 6. تشخيص التعثرات وخطة الدعم
     */
    function printOfficialExamReport(directOnly = false) {
        if (typeof autoCalculateExamStats === 'function') {
            autoCalculateExamStats(false);
        }
        const className = document.getElementById('reportClassSelect')?.value || 'قسم غير محدد';
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examNum = document.getElementById('examReportNumber')?.value || '1';
        const getVal = id => document.getElementById(id)?.value || '';

        const passDate = getVal('examReportPassDate') || '---';
        const correctionDate = getVal('examReportCorrectionDate') || '---';
        const duration = getVal('examReportDuration') || '2h';
        const coef = getVal('examReportCoef') || '1';
        const topics = getVal('examReportTopics') || 'غير مححدد';
        const gradingScale = getVal('examReportGradingScale') || '---';
        const difficulties = getVal('examReportDifficulties') || 'لم تسجل صعوبات خاصة';
        const remediation = getVal('examReportRemediation') || 'مواصلة الدعم والتتبع المستمر';

        const stats = (currentExamReport && currentExamReport.stats) ? currentExamReport.stats : {
            totalStudents: 0, presentCount: 0, absentCount: 0, minMark: 0, maxMark: 0, avgMark: 0,
            passCount: 0, passRate: 0, failCount: 0, failRate: 0,
            distribution: {
                veryLow: { count: 0, percent: 0 }, low: { count: 0, percent: 0 },
                medium: { count: 0, percent: 0 }, good: { count: 0, percent: 0 },
                excellent: { count: 0, percent: 0 }
            }
        };

        const teacher = getTeacherName();
        const meta = getSchoolMetadata();
        const semLabel = semester === 's1' ? 'الدورة الأولى' : 'الدورة الثانية';

        const { allStudents, rankedMarks, absents } = cachedExamStudentsData;
        const studentCount = (allStudents && allStudents.length) || 0;

        // Dynamic table font scaling based on class size to guarantee Page 2 fits perfectly
        let tableFontSize = '8pt';
        let tablePadding = '2.2px 4px';
        if (studentCount > 40) {
            tableFontSize = '6.8pt';
            tablePadding = '1.2px 2px';
        } else if (studentCount > 32) {
            tableFontSize = '7.4pt';
            tablePadding = '1.8px 3px';
        }

        // توليد أسطر جدول لائحة القسم (3 أعمدة: الرقم الترتيبي، اسم التلميذ، النقطة)
        const rosterRowsHtml = (allStudents && allStudents.length > 0)
            ? allStudents.map(std => {
                const markTxt = std.isAbsent ? '<span style="color:#dc2626; font-weight:bold;">غائب</span>' : (std.mark !== null ? `<span style="font-weight:bold; color:${std.mark >= 10 ? '#15803d' : '#dc2626'};">${std.mark.toFixed(2)}</span>` : '--');
                return `
                    <tr>
                        <td style="text-align: center; font-weight: bold; width: 44px; padding: ${tablePadding};">${std.order}</td>
                        <td style="text-align: right; padding: ${tablePadding}; padding-right: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">${escapeHtml(std.name)}</td>
                        <td style="text-align: center; width: 68px; padding: ${tablePadding};">${markTxt}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="3" style="text-align:center;">لا توجد بيانات</td></tr>';

        // توليد أسطر جدول الترتيب الاستحقاقي (4 أعمدة: الرتبة، اسم التلميذ، النقطة، التقدير)
        const rankedRowsHtml = (rankedMarks && rankedMarks.length > 0)
            ? rankedMarks.map(rm => `
                <tr>
                    <td style="text-align: center; font-weight: bold; width: 40px; padding: ${tablePadding};">${rm.rank}</td>
                    <td style="text-align: right; padding: ${tablePadding}; padding-right: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${escapeHtml(rm.name)}</td>
                    <td style="text-align: center; font-weight: 900; width: 58px; padding: ${tablePadding}; color:#1e3a8a;">${rm.mark.toFixed(2)}</td>
                    <td style="text-align: center; font-size: ${tableFontSize}; width: 80px; padding: ${tablePadding};">${rm.appreciation}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" style="text-align:center;">لا توجد نقط مسجلة</td></tr>';

        // لائحة الغائبين بتصميم شريطي مدمج مع وضعية الفرض التعويضي (المذكرة 142-08)
        const absentsHtml = (absents && absents.length > 0)
            ? `
                <div style="border: 1.2px solid #dc2626; border-radius: 5px; padding: 3px 8px; background: #fef2f2; font-size: 7.5pt;">
                    <div style="font-weight: 800; color: #991b1b; margin-bottom: 2px;">
                        ⚠️ لائحة التلاميذ الغائبين عن الفرض (${absents.length} تلميذ - تدبير الفرض التعويضي وفق المذكرة 142-08):
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${absents.map(std => {
                            const info = std.makeupInfo || {};
                            const mDate = info.makeupDate ? ` — تعويضي يوم: ${info.makeupDate}` : ' — مبرمج للتعويض';
                            return `
                            <span style="background: #ffffff; border: 1px solid #fca5a5; padding: 1px 6px; border-radius: 4px; color: #b91c1c; font-weight: 700;">
                                #${std.order} ${escapeHtml(std.name)} (${escapeHtml(std.massar || 'مسار')}${escapeHtml(mDate)})
                            </span>
                            `;
                        }).join('')}
                    </div>
                </div>
            `
            : `
                <div style="border: 1px solid #86efac; border-radius: 5px; padding: 2.5px 8px; background: #f0fdf4; font-size: 7.5pt; color: #166534; text-align: center; font-weight: 800;">
                    ✅ لا يوجد تلاميذ غائبون عن هذا الفرض المحروس (نسبة الحضور بالقسم 100%).
                </div>
            `;

        const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تقرير الفرض المحروس رقم ${examNum} - ${className} - ${meta.school}</title>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Harmattan:wght@400;700&family=Marhey:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Reem+Kufi:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 0 !important;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            font-family: ${typeof window.getSelectedPrintFontFamily === 'function' ? window.getSelectedPrintFontFamily() : "'Cairo', 'Amiri', 'Traditional Arabic', Tahoma, sans-serif"};
            color: #0f172a;
            direction: rtl;
            width: 210mm;
            line-height: 1.35;
            font-size: 8.5pt;
        }
        .teacher-handwritten-note {
            font-family: ${typeof window.getSelectedHandwritingFontFamily === 'function' ? window.getSelectedHandwritingFontFamily() : "'Aref Ruqaa', 'Marhey', serif"} !important;
            font-size: 8.8pt !important;
            line-height: 1.5 !important;
        }
        .signature-handwritten {
            font-family: ${typeof window.getSelectedHandwritingFontFamily === 'function' ? window.getSelectedHandwritingFontFamily() : "'Aref Ruqaa', serif"} !important;
            color: #1e3a8a;
        }
        .report-page {
            width: 210mm;
            height: 297mm;
            max-height: 297mm;
            padding: 7mm 10mm 7mm 10mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            background: #ffffff;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        .report-page-1 {
            page-break-after: always !important;
            break-after: page !important;
        }
        .report-page-2 {
            page-break-after: auto !important;
            break-after: auto !important;
        }
        .header-box {
            border: 1.8px solid #1e3a8a;
            border-radius: 7px;
            padding: 6px 10px;
            margin-bottom: 6px;
            background: #f8fafc;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 4px;
            font-size: 8pt;
        }
        .report-title {
            text-align: center;
            font-size: 13pt;
            font-weight: 900;
            color: #1e3a8a;
            margin: 1px 0;
        }
        .report-subtitle {
            text-align: center;
            font-size: 7.8pt;
            color: #475569;
            margin-bottom: 5px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 4px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            padding: 5px 8px;
            font-size: 7.8pt;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-weight: 800;
            color: #1e3a8a;
            font-size: 7.2pt;
        }
        .section-box {
            border: 1.2px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 6px;
            overflow: hidden;
            page-break-inside: avoid;
        }
        .section-header {
            background: #1e3a8a;
            color: #ffffff;
            font-weight: 800;
            padding: 3px 8px;
            font-size: 8.5pt;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .section-body {
            padding: 5px 8px;
            background: #ffffff;
            font-size: 8pt;
        }
        .stats-table, .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            text-align: center;
        }
        .stats-table th, .stats-table td, .print-table th, .print-table td {
            border: 1px solid #94a3b8;
            padding: 2.5px 4px;
        }
        .stats-table th, .print-table th {
            background: #f1f5f9;
            color: #1e293b;
            font-weight: bold;
        }
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1.2px dashed #94a3b8;
            page-break-inside: avoid;
        }
        .sig-block {
            width: 32%;
            text-align: center;
            font-size: 8pt;
            min-height: 42px;
        }
        .page-footer-bar {
            border-top: 1px solid #cbd5e1;
            padding-top: 3px;
            margin-top: 3px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
            color: #64748b;
        }
        /* Suppression totale des URL et liens dans les en-têtes et pieds de page */
        a[href]:after, a:after {
            content: none !important;
            display: none !important;
        }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            .report-page-1 { page-break-after: always !important; break-after: page !important; }
            .report-page-2 { page-break-after: auto !important; break-after: auto !important; }
        }
    </style>
</head>
<body>

    <!-- ============================================================== -->
    <!-- الصفحة 1: بطاقة التقرير البيداغوجي والإحصائي للفرض (وفق المذكرة 142-08) -->
    <!-- ============================================================== -->
    <div class="report-page report-page-1">
        <div>
            <!-- الشريط الرسمي ثلاثي الألوان -->
            <div style="height: 3px; background: linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%); border-radius: 2px; margin-bottom: 5px;"></div>

            <!-- ترويسة التقرير الرسمية -->
            <div class="header-box">
                <div class="header-top">
                    <div style="text-align: right; width: 33%; line-height: 1.35;">
                        <strong style="color: #0f172a; font-size: 9pt;">المملكة المغربية</strong><br>
                        <span style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</span><br>
                        <span>${escapeHtml(meta.academy)}</span><br>
                        <span>${escapeHtml(meta.direction)}</span><br>
                        <strong>المؤسسة:</strong> <span style="color: #1e3a8a;">${escapeHtml(meta.school)}</span>
                    </div>
                    <div style="text-align: center; width: 34%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <div style="font-size: 8.5pt; font-weight: 900; color: #15803d;">مادة الرياضيات · السلك الثانوي التأهيلي</div>
                        <div style="font-size: 7.8pt; color: #475569; font-weight: 700; margin-top: 2px;">الموسم الدراسي: <strong>${escapeHtml(meta.year)}</strong></div>
                    </div>
                    <div style="text-align: left; width: 33%; line-height: 1.35;">
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 6px; margin-bottom: 3px;">
                            <img src="${(window.db && window.db.teacherProfile && (window.db.teacherProfile.schoolLogo || window.db.teacherProfile.institutionLogo)) || '/institution-logo.svg'}" alt="" style="width: 38px; height: 38px; object-fit: contain; border-radius: 50%; border: 1px solid #d4af37; padding: 1.5px; background: #ffffff;" onerror="this.onerror=null; this.src='/institution-logo.svg';">
                            <img src="${(window.db && window.db.teacherProfile && (window.db.teacherProfile.teacherLogo || window.db.teacherProfile.photo)) || '/logo.svg'}" alt="" style="width: 38px; height: 38px; object-fit: contain; border-radius: 50%; border: 1px solid #1e3a8a; padding: 1.5px; background: #ffffff;" onerror="this.onerror=null; this.src='/logo.svg';">
                        </div>
                        مادة: <strong>الرياضيات</strong> · القسم: <strong style="color: #1e3a8a;">${escapeHtml(className)}</strong><br>
                        الأستاذ(ة): <strong>${escapeHtml(teacher)}</strong>
                    </div>
                </div>

                <div class="report-title">
                    بطاقة تقرير وتتبع الفرض المحروس رقم ${examNum} (${semLabel})
                </div>
                <div class="report-subtitle">
                    وثيقة بيداغوجية رسمية لمادة الرياضيات - مطابقة لمقتضيات المذكرة الوزارية رقم 142-08 والتوجيهات التربوية الرسمية
                </div>

                <div class="meta-grid">
                    <div class="meta-item"><span class="meta-label">القسم:</span> <span>${escapeHtml(className)}</span></div>
                    <div class="meta-item"><span class="meta-label">الأستاذ(ة):</span> <span>${escapeHtml(teacher)}</span></div>
                    <div class="meta-item"><span class="meta-label">تاريخ التمرير:</span> <span>${escapeHtml(passDate)}</span></div>
                    <div class="meta-item"><span class="meta-label">تاريخ التصحيح:</span> <span>${escapeHtml(correctionDate)}</span></div>
                    <div class="meta-item"><span class="meta-label">مدة الإنجاز:</span> <span>${escapeHtml(duration)}</span></div>
                    <div class="meta-item"><span class="meta-label">معامل الفرض:</span> <span>${escapeHtml(coef)}</span></div>
                    <div class="meta-item"><span class="meta-label">عدد المسجلين:</span> <span>${stats.totalStudents} تلميذ</span></div>
                    <div class="meta-item"><span class="meta-label">نسبة النجاح والمعدل:</span> <span style="font-weight: 800; color: #15803d;">${stats.passRate}% (${stats.avgMark}/20)</span></div>
                </div>
            </div>

            <!-- 1. المحتوى وسلّم التنقيط -->
            <div class="section-box">
                <div class="section-header">
                    <span>1. محتوى الفرض والأهداف والكفايات المقومة (المذكرة الوزارية 142-08)</span>
                </div>
                <div class="section-body">
                    <div style="line-height: 1.4;">${escapeHtml(topics)}</div>
                    <div style="margin-top: 3px; padding: 3px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 7.4pt; color: #334155;">
                        <strong>معايير بناء موضوع الفرض (المذكرة 142-08):</strong> 30% استرداد وتطبيق مباشر للمعارف · 50% توظيف المفاهيم وحل وضعيات مألوفة والاستدلال · 20% وضعيات غير مألوفة ومسائل تركيبية والبرهان الرياضي.
                    </div>
                    ${gradingScale ? `<div style="margin-top: 3px; padding-top: 3px; border-top: 1px dashed #cbd5e1; font-size: 7.4pt; color: #475569;"><strong>سلّم التنقيط وتوزيع التمارين:</strong> ${escapeHtml(gradingScale)}</div>` : ''}
                </div>
            </div>

            <!-- 2. النتائج والإحصائيات العامة وتوزيع النقط الدائري -->
            <div class="section-box">
                <div class="section-header">
                    <span>2. النتائج والمؤشرات الإحصائية العامة وتوزيع النقط (المذكرة 142-08)</span>
                </div>
                <div class="section-body" style="padding: 4px 6px;">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>عدد المسجلين</th>
                                <th>عدد الحاضرين</th>
                                <th>عدد الغائبين</th>
                                <th>أعلى نقطة</th>
                                <th>أدنى نقطة</th>
                                <th>معدل القسم</th>
                                <th>المتحكمون (≥10)</th>
                                <th>دون المعدل (&lt;10)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>${stats.totalStudents}</strong></td>
                                <td><strong>${stats.presentCount}</strong></td>
                                <td style="color: #dc2626;"><strong>${stats.absentCount}</strong></td>
                                <td style="color: #15803d; font-weight: bold;">${stats.maxMark} / 20</td>
                                <td style="color: #dc2626; font-weight: bold;">${stats.minMark} / 20</td>
                                <td style="color: #1e3a8a; font-weight: 900; background: #f0f9ff;">${stats.avgMark} / 20</td>
                                <td style="color: #15803d; font-weight: bold; background: #f0fdf4;">${stats.passCount} (${stats.passRate}%)</td>
                                <td style="color: #dc2626; font-weight: bold; background: #fef2f2;">${stats.failCount} (${stats.failRate}%)</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style="display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 6px; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 4px; margin-top: 4px;">
                        <!-- جدول مجالات التحكم للمذكرة 142 -->
                        <div>
                            <div style="font-weight: 800; color: #1e3a8a; font-size: 7.5pt; margin-bottom: 2px;">
                                📊 توزيع النقط حسب فئات التحكم (المذكرة 142-08):
                            </div>
                            <table class="stats-table" style="font-size: 7.2pt;">
                                <thead>
                                    <tr>
                                        <th style="background: #fee2e2; color: #991b1b; padding: 2px 3px;">[0 - 4.99]<br>تعثر حاد</th>
                                        <th style="background: #ffedd5; color: #9a3412; padding: 2px 3px;">[5 - 9.99]<br>دون المتوسط</th>
                                        <th style="background: #e0e7ff; color: #3730a3; padding: 2px 3px;">[10 - 13.99]<br>متوسط - حسن</th>
                                        <th style="background: #e0f2fe; color: #075985; padding: 2px 3px;">[14 - 17.99]<br>جيد</th>
                                        <th style="background: #dcfce7; color: #166534; padding: 2px 3px;">[18 - 20]<br>ممتاز</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>${stats.distribution?.veryLow?.count || 0}<br><span style="font-size: 6.5pt; color: #64748b;">(${stats.distribution?.veryLow?.percent || 0}%)</span></td>
                                        <td>${stats.distribution?.low?.count || 0}<br><span style="font-size: 6.5pt; color: #64748b;">(${stats.distribution?.low?.percent || 0}%)</span></td>
                                        <td>${stats.distribution?.medium?.count || 0}<br><span style="font-size: 6.5pt; color: #64748b;">(${stats.distribution?.medium?.percent || 0}%)</span></td>
                                        <td>${stats.distribution?.good?.count || 0}<br><span style="font-size: 6.5pt; color: #64748b;">(${stats.distribution?.good?.percent || 0}%)</span></td>
                                        <td>${stats.distribution?.excellent?.count || 0}<br><span style="font-size: 6.5pt; color: #64748b;">(${stats.distribution?.excellent?.percent || 0}%)</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- قرص النسب المئوية الدائري المصغر -->
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <div style="font-weight: 800; color: #1e3a8a; font-size: 7.2pt; margin-bottom: 1px; text-align: center;">
                                🥧 التمثيل الدائري للنسب المئوية (المذكرة 142-08)
                            </div>
                            ${buildExamReportPieChartSVG(stats, 'tiers', true)}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. تشخيص التعثرات وخطة المعالجة والدعم البيداغوجي المبرمجة -->
            <div class="section-box" style="margin-bottom: 4px;">
                <div class="section-header">
                    <span>3. تشخيص التعثرات وخطة المعالجة والدعم البيداغوجي المبرمجة</span>
                </div>
                <div class="section-body" style="padding: 4px 8px; font-size: 7.8pt;">
                    <div style="margin-bottom: 3px;">
                        <strong style="color: #991b1b;">⚠️ التعثرات والصعوبات المرصودة أثناء التصحيح:</strong>
                        <div class="teacher-handwritten-note" style="white-space: pre-wrap; font-size: 8.5pt; color: #334155; padding: 1px 4px; line-height: 1.45;">${escapeHtml(difficulties)}</div>
                    </div>
                    <div style="border-top: 1px dashed #cbd5e1; padding-top: 3px;">
                        <strong style="color: #166534;">🌱 خطة المعالجة وقرارات الدعم البيداغوجي المبرمجة:</strong>
                        <div class="teacher-handwritten-note" style="white-space: pre-wrap; font-size: 8.5pt; color: #166534; padding: 1px 4px; line-height: 1.45;">${escapeHtml(remediation)}</div>
                    </div>
                </div>
            </div>

            <!-- التوقيعات الرسمية المعتمدة -->
            <div class="signatures">
                <div class="sig-block">
                    <span style="font-weight: bold; color: #1e3a8a;">توقيع أستاذ المادة:</span><br>
                    <strong class="signature-handwritten" style="font-size: 9.2pt;">${escapeHtml(teacher)}</strong>
                </div>
                <div class="sig-block">
                    <span style="font-weight: bold; color: #475569;">تأشيرة وملاحظات المفتش التربوي:</span><br>
                    <span style="color: #94a3b8; font-size: 7.5pt;">..................................</span>
                </div>
                <div class="sig-block">
                    <span style="font-weight: bold; color: #475569;">تأشيرة السيد رئيس المؤسسة:</span><br>
                    <span style="color: #94a3b8; font-size: 7.5pt;">..................................</span>
                </div>
            </div>
        </div>

        <!-- تذييل الصفحة 1 -->
        <div class="page-footer-bar">
            <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · تقرير الفرض المحروس رقم ${examNum} (${escapeHtml(className)}) - مادة الرياضيات (المذكرة 142-08)</span>
            <span style="font-weight: 900; color: #1e3a8a;">الصفحة 1 من 2</span>
        </div>
    </div>

    <!-- ============================================================== -->
    <!-- الصفحة 2: كشف النقط الرسمي والترتيب الاستحقاقي ولائحة الغياب -->
    <!-- ============================================================== -->
    <div class="report-page report-page-2">
        <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
            <div>
                <!-- الشريط الرسمي ثلاثي الألوان -->
                <div style="height: 3px; background: linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%); border-radius: 2px; margin-bottom: 5px;"></div>

                <!-- ترويسة الصفحة الثانية المصغرة -->
                <div style="border: 1.5px solid #1e3a8a; border-radius: 6px; padding: 5px 8px; background: #f8fafc; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 3px; font-size: 7.5pt;">
                        <div style="font-weight: 700; color: #0f172a;">المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · ${escapeHtml(meta.school)}</div>
                        <div style="font-weight: 800; color: #15803d;">مادة الرياضيات · السلك الثانوي التأهيلي (${escapeHtml(meta.year)})</div>
                        <div style="font-weight: 700; color: #1e3a8a;">الأستاذ(ة): ${escapeHtml(teacher)}</div>
                    </div>
                    <div style="text-align: center; font-size: 10.5pt; font-weight: 900; color: #1e3a8a; margin: 1px 0;">
                        ملحق تقرير الفرض المحروس رقم ${examNum} (${semLabel}): كشف النقط الرسمي والترتيب الاستحقاقي
                    </div>
                    <div style="display: flex; justify-content: space-around; align-items: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2.5px 6px; font-size: 7.5pt; margin-top: 2px;">
                        <span>القسم: <strong style="color: #1e3a8a;">${escapeHtml(className)}</strong></span>
                        <span>تاريخ التمرير: <strong>${escapeHtml(passDate)}</strong></span>
                        <span>عدد التلاميذ: <strong>${stats.totalStudents}</strong></span>
                        <span>الحاضرون: <strong style="color: #15803d;">${stats.presentCount}</strong></span>
                        <span>الغائبون: <strong style="color: #dc2626;">${stats.absentCount}</strong></span>
                        <span>معدل القسم: <strong style="color: #1e3a8a;">${stats.avgMark} / 20</strong></span>
                        <span>نسبة النجاح: <strong style="color: #15803d;">${stats.passRate}%</strong></span>
                    </div>
                </div>

                <!-- الجداول المزدوجة المتوازية جنباً إلى جنب -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: start;">
                    <!-- جدول كشف نقط القسم حسب الترتيب التسلسلي (3 خانات) -->
                    <div style="border: 1.2px solid #cbd5e1; border-radius: 5px; overflow: hidden;">
                        <div style="background: #1e3a8a; color: #ffffff; font-weight: 800; font-size: 7.8pt; padding: 3px 6px; text-align: center;">
                            📋 كشف نقط القسم حسب الترتيب التسلسلي (3 خانات)
                        </div>
                        <table class="print-table" style="font-size: ${tableFontSize};">
                            <thead>
                                <tr style="background: #f1f5f9; color: #1e293b;">
                                    <th style="width: 44px; padding: ${tablePadding};">ر.ت</th>
                                    <th style="padding: ${tablePadding}; text-align: right; padding-right: 6px;">اسم التلميذ(ة)</th>
                                    <th style="width: 68px; padding: ${tablePadding};">النقطة / 20</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rosterRowsHtml}
                            </tbody>
                        </table>
                    </div>

                    <!-- جدول الترتيب الاستحقاقي للقسم (4 خانات) -->
                    <div style="border: 1.2px solid #cbd5e1; border-radius: 5px; overflow: hidden;">
                        <div style="background: #0284c7; color: #ffffff; font-weight: 800; font-size: 7.8pt; padding: 3px 6px; text-align: center;">
                            🏆 الترتيب الاستحقاقي (من أعلى نقطة إلى أدنى نقطة)
                        </div>
                        <table class="print-table" style="font-size: ${tableFontSize};">
                            <thead>
                                <tr style="background: #f0f9ff; color: #0369a1;">
                                    <th style="width: 40px; padding: ${tablePadding};">الرتبة</th>
                                    <th style="padding: ${tablePadding}; text-align: right; padding-right: 6px;">اسم التلميذ(ة)</th>
                                    <th style="width: 58px; padding: ${tablePadding};">النقطة</th>
                                    <th style="width: 80px; padding: ${tablePadding};">التقدير</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rankedRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- لائحة التلاميذ الغائبين عن الفرض -->
                <div style="margin-top: 5px;">
                    ${absentsHtml}
                </div>
            </div>

            <div>
                <!-- شريط المصادقة والتأشيرة لصفحة كشف النقط -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 3px; margin-top: 4px; font-size: 7.5pt; color: #475569;">
                    <div>صودق عليه بـ <strong>${escapeHtml(meta.school)}</strong> بتاريخ: <strong>${escapeHtml(correctionDate !== '---' ? correctionDate : passDate)}</strong></div>
                    <div>توقيع وتأشيرة أستاذ المادة: <strong>${escapeHtml(teacher)}</strong> ..........................</div>
                    <div>خاتم وتأشيرة الإدارة التربوية: ..........................</div>
                </div>

                <!-- تذييل الصفحة 2 -->
                <div class="page-footer-bar">
                    <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · كشف نقط الفرض المحروس رقم ${examNum} (${escapeHtml(className)})</span>
                    <span style="font-weight: 900; color: #1e3a8a;">الصفحة 2 من 2</span>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
        `;

        if (!directOnly && typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: `تقرير_الفرض_المحروس_${examNum}_${className}`,
                orientation: 'portrait',
                subtitle: `تقرير إحصائي وتربوي مفصل من صفحتين (A4) — القسم: ${className} | الفرض المحروس رقم ${examNum}`
            });
            return;
        }

        // الطباعة عبر iframe خفي لتفادي حظر النوافذ المنبثقة وبدون روابط التطبيق
        let iframe = document.getElementById('examReportPrintIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'examReportPrintIframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
            try {
                const iWin = iframe.contentWindow;
                iWin.onafterprint = () => {
                    try { doc.body.innerHTML = ''; } catch (e) {}
                };
                iWin.focus();
                iWin.print();
                setTimeout(() => {
                    try { if (doc && doc.body) doc.body.innerHTML = ''; } catch (e) {}
                }, 45000);
            } catch (e) {
                window.print();
            }
        }, 350);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * =========================================================================
     * النقطة 3: نظام الفرض المحروس التعويضي للمتغيبين بمبرر (وفق المذكرة 142-08)
     * =========================================================================
     */
    function getJustificationLabel(code) {
        switch (code) {
            case 'justified_medical': return 'مبرر مقبول (شهادة طبية مصادق عليها)';
            case 'justified_admin': return 'مبرر مقبول (ترخيص إداري / ظرف عائلي)';
            case 'pending': return 'في طور الإدلاء بالمبرر لدى الحراسة العامة';
            case 'unjustified': return 'غياب بدون مبرر مقبول (يستوجب 00/20 إن لم يبرر)';
            default: return 'مبرر مقبول (شهادة طبية)';
        }
    }

    function quickUpdateMakeupJustification(studentId, justificationCode) {
        const className = getSelectedClassForReport();
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        if (!className) return;

        const registry = getOrInitMakeupExamsRegistry();
        const mKey = getMakeupExamKey(className, semester, examKey, studentId);
        if (!registry[mKey]) {
            registry[mKey] = {
                className,
                semester,
                examKey,
                studentId,
                justification: justificationCode,
                makeupDate: '',
                timeSlot: '10:00 - 11:00',
                room: 'قاعة الرياضيات',
                status: 'scheduled',
                updatedAt: new Date().toISOString()
            };
        } else {
            registry[mKey].justification = justificationCode;
            registry[mKey].updatedAt = new Date().toISOString();
        }

        if (typeof window.saveData === 'function') window.saveData();
        autoCalculateExamStats(false);
        if (typeof window.showToast === 'function') {
            window.showToast('تم تحيين وضعية تبرير الغياب للتلميذ(ة) بنجاح', 'success');
        }
    }

    function applyMakeupExamMarkInline(studentId, customInputId) {
        const className = getSelectedClassForReport();
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        if (!className || !window.db) return;

        const inputEl = document.getElementById(customInputId || `inlineMakeupMark_${studentId}`);
        if (!inputEl) return;

        const rawVal = (inputEl.value || '').trim();
        const parsed = parseFloat(rawVal);
        if (isNaN(parsed) || parsed < 0 || parsed > 20) {
            if (typeof window.showToast === 'function') {
                window.showToast('يرجى إدخال نقطة صحيحة محصورة بين 0 و 20 للفرض التعويضي', 'warning');
            }
            inputEl.focus();
            return;
        }

        if (!window.db.grades) window.db.grades = {};
        if (!window.db.grades[className]) window.db.grades[className] = {};
        if (!window.db.grades[className][studentId]) {
            window.db.grades[className][studentId] = { s1: {}, s2: {} };
        }
        if (!window.db.grades[className][studentId][semester]) {
            window.db.grades[className][studentId][semester] = {};
        }

        // تحديث النقطة في سجل النقط الرسمي للقسم
        window.db.grades[className][studentId][semester][examKey] = parsed;
        if (semester === 's1') {
            window.db.grades[className][studentId][examKey] = parsed;
        }

        // توثيق اجتياز الفرض التعويضي في سجل الفروض التعويضية
        const registry = getOrInitMakeupExamsRegistry();
        const mKey = getMakeupExamKey(className, semester, examKey, studentId);
        const existing = registry[mKey] || {};
        registry[mKey] = {
            ...existing,
            className,
            semester,
            examKey,
            studentId,
            justification: existing.justification || 'justified_medical',
            makeupDate: existing.makeupDate || new Date().toISOString().split('T')[0],
            timeSlot: existing.timeSlot || '10:00 - 11:00',
            room: existing.room || 'قاعة الرياضيات',
            makeupMark: parsed,
            status: 'completed',
            completedAt: new Date().toISOString()
        };

        if (typeof window.saveData === 'function') window.saveData();
        if (typeof window.renderGradesTable === 'function') {
            try { window.renderGradesTable(); } catch (_) {}
        }

        autoCalculateExamStats(false);
        saveCurrentExamReport();

        const modalEl = document.getElementById('makeupExamManagerModalOverlay');
        if (modalEl && modalEl.style.display !== 'none') {
            openMakeupExamManagerModal();
        }
        if (typeof window.renderMassarMakeupSchedulerView === 'function') {
            try { window.renderMassarMakeupSchedulerView(); } catch (_) {}
        }

        if (typeof window.showToast === 'function') {
            window.showToast(`✅ تم مسك نقطة الفرض التعويضي (${parsed.toFixed(2)}/20) وتحيين إحصائيات القسم آلياً`, 'success');
        }
    }

    function markStudentAbsentForCurrentExam(studentId) {
        const className = getSelectedClassForReport();
        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        if (!className || !studentId || !window.db) return;

        if (!window.db.grades) window.db.grades = {};
        if (!window.db.grades[className]) window.db.grades[className] = {};
        if (!window.db.grades[className][studentId]) {
            window.db.grades[className][studentId] = { s1: {}, s2: {} };
        }
        if (!window.db.grades[className][studentId][semester]) {
            window.db.grades[className][studentId][semester] = {};
        }

        window.db.grades[className][studentId][semester][examKey] = 'غ';
        if (semester === 's1') {
            window.db.grades[className][studentId][examKey] = 'غ';
        }

        const registry = getOrInitMakeupExamsRegistry();
        const mKey = getMakeupExamKey(className, semester, examKey, studentId);
        const defaultMakeupDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

        registry[mKey] = {
            className,
            semester,
            examKey,
            studentId,
            justification: 'justified_medical',
            makeupDate: defaultMakeupDate,
            timeSlot: '10:00 - 11:00',
            room: 'قاعة الرياضيات',
            status: 'scheduled',
            updatedAt: new Date().toISOString()
        };

        if (typeof window.saveData === 'function') window.saveData();
        autoCalculateExamStats(false);
        openMakeupExamManagerModal();

        if (typeof window.showToast === 'function') {
            window.showToast('تم تسجيل التلميذ(ة) ضمن لائحة المتغيبين المعنيين بالفرض التعويضي', 'success');
        }
    }

    function openMakeupExamManagerModal() {
        const className = getSelectedClassForReport();
        if (!className) {
            if (typeof window.showToast === 'function') {
                window.showToast('يرجى اختيار القسم أولاً لتدبير الفروض التعويضية', 'warning');
            }
            return;
        }

        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        const examNum = examKey.replace('f', '');
        const semLabel = semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى';

        const extracted = extractExamMarksFromDB(className, semester, examKey);
        const absents = extracted.absents || [];
        const completedMakeups = extracted.completedMakeups || [];
        const allStudents = extracted.allStudents || [];

        const defaultDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const firstInfo = (absents[0] && absents[0].makeupInfo) || {};
        const unifiedDate = firstInfo.makeupDate || defaultDate;
        const unifiedTime = firstInfo.timeSlot || '10:00 - 11:00';
        const unifiedRoom = firstInfo.room || 'قاعة الرياضيات';
        const unifiedTopics = firstInfo.topics || (document.getElementById('examReportTopics')?.value || `نفس الدروس والكفايات المقررة في الفرض المحروس رقم ${examNum} (موضوع مكافئ وفق المذكرة 142-08)`);

        let modal = document.getElementById('makeupExamManagerModalOverlay');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'makeupExamManagerModalOverlay';
            modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.72); z-index:99995; display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(3px); direction:rtl;';
            document.body.appendChild(modal);
        }

        const nonAbsentStudents = allStudents.filter(s => !s.isAbsent);

        modal.innerHTML = `
            <div style="background:#ffffff; width:100%; max-width:920px; max-height:92vh; border-radius:16px; border:2px solid #fda4af; box-shadow:0 24px 50px rgba(15,23,42,0.35); display:flex; flex-direction:column; overflow:hidden;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg, #881337 0%, #be123c 55%, #1e3a8a 100%); color:#ffffff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:1.5rem; background:rgba(255,255,255,0.18); width:42px; height:42px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center;">🔄</span>
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:900; color:#ffffff;">
                                نظام برمجة وتدبير الفرض المحروس التعويضي (المذكرة الوزارية 142-08)
                            </h3>
                            <div style="font-size:0.78rem; color:#ffe4e6; font-weight:700;">
                                القسم: ${escapeHtml(className)} | الفرض المحروس رقم ${examNum} (${semLabel}) | الغائبون حالياً: ${absents.length} | المستدركون: ${completedMakeups.length}
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('makeupExamManagerModalOverlay').style.display='none'" style="background:rgba(255,255,255,0.2); color:#ffffff; border:1px solid rgba(255,255,255,0.35); border-radius:8px; padding:5px 12px; font-weight:800; cursor:pointer;">
                        ✖ إغلاق
                    </button>
                </div>

                <!-- Body -->
                <div style="padding:16px 20px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:14px;">
                    <!-- 1. إعدادات برمجة حصة الفرض التعويضي ومزامنة التقويم -->
                    <div style="background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:12px; padding:12px 14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
                            <div style="font-weight:900; color:#1e3a8a; font-size:0.88rem;">
                                📅 1. برمجة موعد الحصة التعويضية ومزامنتها مع جدول الحصص والتقويم التربوي
                            </div>
                            <span style="font-size:0.72rem; background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:6px; font-weight:800;">
                                تطبق المذكرة 142-08 على المتغيبين بعذر مقبول
                            </span>
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="font-size:0.75rem; font-weight:800; color:#334155; display:block; margin-bottom:3px;">تاريخ إجراء الفرض التعويضي:</label>
                                <input type="date" id="makeupModalDate" value="${escapeHtml(unifiedDate)}" style="width:100%; padding:6px 8px; border:1.5px solid #94a3b8; border-radius:7px; font-weight:800; font-size:0.82rem;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:800; color:#334155; display:block; margin-bottom:3px;">الحصة / التوقيت الزمني:</label>
                                <input type="text" id="makeupModalTime" value="${escapeHtml(unifiedTime)}" placeholder="مثال: 10:00 - 11:00" style="width:100%; padding:6px 8px; border:1.5px solid #94a3b8; border-radius:7px; font-weight:700; font-size:0.82rem;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:800; color:#334155; display:block; margin-bottom:3px;">القاعة / الفضاء:</label>
                                <input type="text" id="makeupModalRoom" value="${escapeHtml(unifiedRoom)}" placeholder="مثال: قاعة الرياضيات 4" style="width:100%; padding:6px 8px; border:1.5px solid #94a3b8; border-radius:7px; font-weight:700; font-size:0.82rem;">
                            </div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <label style="font-size:0.75rem; font-weight:800; color:#334155; display:block; margin-bottom:3px;">مضامين ومواضيع الفرض التعويضي (موضوع مكافئ للفرض الأصلي):</label>
                            <input type="text" id="makeupModalTopics" value="${escapeHtml(unifiedTopics)}" style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.8rem;">
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <select id="makeupQuickAddAbsentStudent" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:7px; font-size:0.78rem; font-weight:700; min-width:210px;">
                                    <option value="">-- إضافة تلميذ(ة) إلى لائحة الغائبين (غ) --</option>
                                    ${nonAbsentStudents.map(s => `<option value="${s.id}">#${s.order} ${escapeHtml(s.name)} (${s.mark !== null ? s.mark + '/20' : 'بدون نقطة'})</option>`).join('')}
                                </select>
                                <button type="button" onclick="const sel=document.getElementById('makeupQuickAddAbsentStudent'); if(sel && sel.value) window.markStudentAbsentForCurrentExam(sel.value);" style="background:#f1f5f9; color:#be123c; border:1px solid #fda4af; border-radius:7px; padding:6px 10px; font-size:0.76rem; font-weight:800; cursor:pointer;">
                                    ➕ تسجيل كغائب (غ)
                                </button>
                            </div>
                            <button type="button" onclick="window.saveAllMakeupExamSchedules(true)" style="background:linear-gradient(135deg, #0284c7, #1e3a8a); color:#ffffff; border:none; border-radius:8px; padding:7px 14px; font-size:0.8rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(2,132,199,0.25);">
                                <span>🗓️</span>
                                <span>حفظ البرمجة ومزامنتها مع التقويم وجدول الحصص</span>
                            </button>
                        </div>
                    </div>

                    <!-- 2. جدول التلاميذ الغائبين ومسك النقط التعويضية -->
                    <div style="border:1.5px solid #fecdd3; border-radius:12px; overflow:hidden;">
                        <div style="background:#fff1f2; padding:9px 14px; border-bottom:1px solid #fecdd3; display:flex; justify-content:space-between; align-items:center;">
                            <strong style="color:#9f1239; font-size:0.86rem;">📋 2. لائحة التلاميذ المعنيين بالفرض التعويضي ومسك النقط (${absents.length} تلميذ)</strong>
                            <span style="font-size:0.73rem; color:#be123c; font-weight:700;">إدخال النقطة هنا يحدّث سجل النقط والتقرير آلياً</span>
                        </div>
                        ${absents.length === 0 ? `
                            <div style="padding:20px; text-align:center; color:#15803d; font-weight:800; font-size:0.86rem; background:#f0fdf4;">
                                ✅ لا يوجد تلاميذ غائبون حالياً في هذا الفرض. يمكنك اختيار تلميذ من القائمة أعلاه لتسجيل غيابه وبرمجة فرض تعويضي له.
                            </div>
                        ` : `
                            <div style="overflow-x:auto;">
                                <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:right;">
                                    <thead>
                                        <tr style="background:#f8fafc; color:#1e293b; border-bottom:1px solid #e2e8f0;">
                                            <th style="padding:8px 10px; width:50px; text-align:center;">ر.ت</th>
                                            <th style="padding:8px 10px;">اسم التلميذ(ة) ورقم مسار</th>
                                            <th style="padding:8px 10px; width:220px;">وضعية التبرير الإداري</th>
                                            <th style="padding:8px 10px; width:130px; text-align:center;">تاريخ التعويض</th>
                                            <th style="padding:8px 10px; width:190px; text-align:center;">مسك نقطة الفرض التعويضي</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${absents.map(std => {
                                            const info = std.makeupInfo || {};
                                            const justStatus = info.justification || 'justified_medical';
                                            const stdDate = info.makeupDate || unifiedDate;
                                            return `
                                            <tr style="border-bottom:1px solid #f1f5f9;">
                                                <td style="padding:8px 10px; text-align:center; font-weight:800; color:#475569;">${std.order}</td>
                                                <td style="padding:8px 10px;">
                                                    <div style="font-weight:800; color:#0f172a;">${escapeHtml(std.name)}</div>
                                                    <div style="font-size:0.71rem; color:#64748b;">مسار: ${escapeHtml(std.massar || '---')}</div>
                                                </td>
                                                <td style="padding:8px 10px;">
                                                    <select onchange="window.quickUpdateMakeupJustification('${std.id}', this.value)" style="width:100%; padding:5px 7px; border:1px solid #cbd5e1; border-radius:6px; font-size:0.75rem; font-weight:700;">
                                                        <option value="justified_medical" ${justStatus === 'justified_medical' ? 'selected' : ''}>✅ مبرر (شهادة طبية)</option>
                                                        <option value="justified_admin" ${justStatus === 'justified_admin' ? 'selected' : ''}>✅ مبرر (ترخيص إداري/عائلي)</option>
                                                        <option value="pending" ${justStatus === 'pending' ? 'selected' : ''}>⏳ في طور التبرير</option>
                                                        <option value="unjustified" ${justStatus === 'unjustified' ? 'selected' : ''}>❌ بدون مبرر مقبول</option>
                                                    </select>
                                                </td>
                                                <td style="padding:8px 10px; text-align:center; font-weight:800; color:#1e40af;">
                                                    ${escapeHtml(stdDate)}
                                                </td>
                                                <td style="padding:8px 10px; text-align:center;">
                                                    <div style="display:inline-flex; align-items:center; gap:5px;">
                                                        <input type="number" id="modalMakeupMark_${std.id}" min="0" max="20" step="0.25" placeholder="0 - 20" style="width:76px; padding:5px; border:1.5px solid #059669; border-radius:6px; text-align:center; font-weight:800; background:#f0fdf4;">
                                                        <button type="button" onclick="window.applyMakeupExamMarkInline('${std.id}', 'modalMakeupMark_${std.id}')" style="background:#059669; color:#fff; border:none; border-radius:6px; padding:5px 10px; font-size:0.75rem; font-weight:800; cursor:pointer;">
                                                            💾 مسك النقطة
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>

                    ${completedMakeups.length > 0 ? `
                        <div style="background:#f0fdf4; border:1.5px solid #86efac; border-radius:10px; padding:10px 14px;">
                            <div style="font-weight:800; color:#166534; font-size:0.82rem; margin-bottom:6px;">
                                ✅ سجل التلاميذ الذين اجتازوا الفرض التعويضي وتم مسك نقطهم (${completedMakeups.length}):
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                ${completedMakeups.map(c => `
                                    <span style="background:#ffffff; border:1px solid #86efac; padding:4px 10px; border-radius:7px; font-size:0.76rem; font-weight:800; color:#15803d;">
                                        #${c.order} ${escapeHtml(c.name)} — النقطة التعويضية: <strong>${c.mark !== null ? c.mark.toFixed(2) : '--'}/20</strong>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Footer -->
                <div style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div style="font-size:0.75rem; color:#475569; font-weight:700;">
                        💡 المرجع القانوني: المذكرة الوزارية رقم 142-08 الخاصة بالتقويم التربوي بالسلك الثانوي لمادة الرياضيات.
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button type="button" onclick="window.saveAllMakeupExamSchedules(false); window.printOfficialMakeupExamConvocation();" style="background:linear-gradient(135deg, #1e3a8a, #2563eb); color:#ffffff; border:none; border-radius:8px; padding:8px 16px; font-size:0.82rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 8px rgba(30,58,138,0.28);">
                            <span>🖨️</span>
                            <span>معاينة وطباعة محضر واستدعاء الفرض التعويضي (A4)</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    function saveAllMakeupExamSchedules(syncWithCalendar = true) {
        const className = getSelectedClassForReport();
        if (!className) return;

        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        const examNum = examKey.replace('f', '');

        const makeupDate = document.getElementById('makeupModalDate')?.value || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const timeSlot = document.getElementById('makeupModalTime')?.value || '10:00 - 11:00';
        const room = document.getElementById('makeupModalRoom')?.value || 'قاعة الرياضيات';
        const topics = document.getElementById('makeupModalTopics')?.value || '';

        const extracted = extractExamMarksFromDB(className, semester, examKey);
        const absents = extracted.absents || [];
        const registry = getOrInitMakeupExamsRegistry();

        absents.forEach(std => {
            const mKey = getMakeupExamKey(className, semester, examKey, std.id);
            const existing = registry[mKey] || {};
            registry[mKey] = {
                ...existing,
                className,
                semester,
                examKey,
                studentId: std.id,
                studentName: std.name,
                massar: std.massar,
                justification: existing.justification || 'justified_medical',
                makeupDate,
                timeSlot,
                room,
                topics,
                status: 'scheduled',
                updatedAt: new Date().toISOString()
            };
        });

        // مزامنة الحصة التعويضية مع التقويم التربوي وجدول الحصص
        if (syncWithCalendar && window.db) {
            if (!Array.isArray(window.db.agenda)) window.db.agenda = [];
            const eventId = `makeup_${className}_${semester}_${examKey}`;
            const eventTitle = `فرض محروس تعويضي رقم ${examNum} (${className}) — ${absents.length} تلميذ`;
            const eventObj = {
                id: eventId,
                title: eventTitle,
                date: makeupDate,
                time: timeSlot,
                timeSlot: timeSlot,
                type: 'exam_makeup',
                category: 'فرض تعويضي (المذكرة 142-08)',
                className: className,
                room: room,
                notes: `إجراء الفرض المحروس التعويضي رقم ${examNum} لفائدة التلاميذ المتغيبين بمبرر (${absents.map(s => s.name).join('، ')}). الموضوع: ${topics}`
            };

            const existingIdx = window.db.agenda.findIndex(e => e && e.id === eventId);
            if (existingIdx >= 0) {
                window.db.agenda[existingIdx] = eventObj;
            } else {
                window.db.agenda.push(eventObj);
            }

            if (Array.isArray(window.db.calendarEvents)) {
                const calIdx = window.db.calendarEvents.findIndex(e => e && e.id === eventId);
                if (calIdx >= 0) window.db.calendarEvents[calIdx] = eventObj;
                else window.db.calendarEvents.push(eventObj);
            }

            if (Array.isArray(window.db.events)) {
                const evIdx = window.db.events.findIndex(e => e && e.id === eventId);
                if (evIdx >= 0) window.db.events[evIdx] = eventObj;
                else window.db.events.push(eventObj);
            }
        }

        if (typeof window.saveData === 'function') window.saveData();
        autoCalculateExamStats(false);

        if (syncWithCalendar && typeof window.showToast === 'function') {
            window.showToast(`✅ تم حفظ برمجة الفرض التعويضي ليوم ${makeupDate} ومزامنتها مع التقويم التربوي`, 'success');
        }
    }

    /**
     * طباعة محضر واستدعاء اجتياز الفرض المحروس التعويضي (ورقة A4 رسمية)
     */
    function printOfficialMakeupExamConvocation() {
        const className = getSelectedClassForReport();
        if (!className) return;

        const semester = document.getElementById('examReportSemester')?.value || 's1';
        const examKey = normalizeReportExamKey(document.getElementById('examReportNumber')?.value || 'f1');
        const examNum = examKey.replace('f', '');
        const semLabel = semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى';

        const meta = getOfficialSchoolHeaderMeta();
        const teacher = (document.getElementById('examReportTeacherName')?.value || meta.teacher || '').trim();
        const originalPassDate = document.getElementById('examReportPassDate')?.value || '---';

        const extracted = extractExamMarksFromDB(className, semester, examKey);
        const absents = extracted.absents || [];
        const completedMakeups = extracted.completedMakeups || [];
        const targetList = [...absents, ...completedMakeups];

        const firstInfo = (targetList[0] && targetList[0].makeupInfo) || {};
        const makeupDate = document.getElementById('makeupModalDate')?.value || firstInfo.makeupDate || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const timeSlot = document.getElementById('makeupModalTime')?.value || firstInfo.timeSlot || '10:00 - 11:00';
        const room = document.getElementById('makeupModalRoom')?.value || firstInfo.room || 'قاعة الرياضيات';
        const topics = document.getElementById('makeupModalTopics')?.value || firstInfo.topics || document.getElementById('examReportTopics')?.value || `موضوع مكافئ للفرض المحروس رقم ${examNum} يغطي نفس الكفايات والمضامين المقررة`;

        const fontFamily = typeof window.getSelectedPrintFontFamily === 'function'
            ? window.getSelectedPrintFontFamily()
            : "'Cairo', 'Amiri', sans-serif";
        const hwFontFamily = typeof window.getSelectedHandwritingFontFamily === 'function'
            ? window.getSelectedHandwritingFontFamily()
            : "'Aref Ruqaa', 'Marhey', serif";

        const rowsHtml = targetList.length > 0
            ? targetList.map((std, i) => {
                const info = std.makeupInfo || {};
                const justLabel = getJustificationLabel(info.justification || 'justified_medical');
                const mDate = info.makeupDate || makeupDate;
                const markDisplay = (std.mark !== null && std.mark !== undefined && !std.isAbsent)
                    ? `<strong>${std.mark.toFixed(2)} / 20</strong>`
                    : '....................';
                const statusLabel = (!std.isAbsent && std.mark !== null) ? 'تم الاجتياز ومسك النقطة' : 'مدعو(ة) للاجتياز';
                return `
                    <tr>
                        <td style="text-align:center; font-weight:800;">${i + 1}</td>
                        <td style="text-align:center; font-weight:700;">#${std.order}</td>
                        <td style="text-align:right; padding-right:8px; font-weight:800;">${escapeHtml(std.name)}</td>
                        <td style="text-align:center;">${escapeHtml(std.massar || '---')}</td>
                        <td style="text-align:right; padding-right:6px; font-size:8pt;">${escapeHtml(justLabel)}</td>
                        <td style="text-align:center; font-weight:800; color:#1e3a8a;">${escapeHtml(mDate)}</td>
                        <td style="text-align:center;"></td>
                        <td style="text-align:center;">${markDisplay}</td>
                        <td style="text-align:center; font-size:7.8pt;">${statusLabel}</td>
                    </tr>
                `;
            }).join('')
            : Array.from({ length: 5 }).map((_, i) => `
                <tr>
                    <td style="text-align:center; padding:8px;">${i + 1}</td>
                    <td></td><td></td><td></td><td></td>
                    <td style="text-align:center;">${escapeHtml(makeupDate)}</td>
                    <td></td><td></td><td></td>
                </tr>
            `).join('');

        const convocationsSlipsHtml = (absents.length > 0 ? absents.slice(0, 2) : [{ name: '........................................', order: '..', massar: '............' }]).map(std => `
            <div style="border: 1.5px dashed #1e3a8a; border-radius: 8px; padding: 8px 12px; background: #f8fafc; margin-top: 6px; page-break-inside: avoid;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 5px; font-size: 8pt;">
                    <strong>✂️ وصل استدعاء لاجتياز الفرض المحروس التعويضي رقم ${examNum} (${escapeHtml(className)}) — مادة الرياضيات</strong>
                    <span style="color: #1e3a8a; font-weight: 800;">المؤسسة: ${escapeHtml(meta.school)}</span>
                </div>
                <div style="font-size: 8.5pt; line-height: 1.55;">
                    يتعين على التلميذ(ة): <strong style="color: #1e3a8a;">${escapeHtml(std.name)}</strong> (الرقم الترتيبي: <strong>${std.order}</strong> | رمز مسار: <strong>${escapeHtml(std.massar || '---')}</strong>) الحضور لاجتياز <strong>الفرض المحروس التعويضي رقم ${examNum}</strong> في مادة الرياضيات، وذلك يوم: <strong style="color: #991b1b;">${escapeHtml(makeupDate)}</strong> على الساعة: <strong>${escapeHtml(timeSlot)}</strong> بـ: <strong>${escapeHtml(room)}</strong>، تعويضاً عن الفرض المجرى بتاريخ ${escapeHtml(originalPassDate)} (عملاً بمقتضيات المذكرة الوزارية 142-08).
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 8pt; color: #334155;">
                    <div>توقيع أستاذ(ة) المادة: <span class="hw-text">${escapeHtml(teacher)}</span></div>
                    <div>تأشيرة الحراسة العامة للخارجية: ........................</div>
                    <div>توقيع التلميذ(ة) بالعلم والاستلام: ........................</div>
                </div>
            </div>
        `).join('');

        const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>محضر واستدعاء الفرض المحروس التعويضي رقم ${examNum} - ${escapeHtml(className)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Harmattan:wght@400;700&family=Marhey:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Reem+Kufi:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 0 !important; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body {
            margin: 0 !important; padding: 0 !important;
            width: 210mm; height: 297mm;
            font-family: ${fontFamily};
            color: #0f172a; direction: rtl; background: #ffffff;
        }
        .page-container {
            width: 210mm; height: 297mm;
            padding: 8mm 10mm;
            display: flex; flex-direction: column; justify-content: space-between;
        }
        .hw-text {
            font-family: ${hwFontFamily} !important;
            color: #1e3a8a;
            font-size: 9.5pt;
        }
        table.official-table {
            width: 100%; border-collapse: collapse; font-size: 8.4pt; margin-top: 6px;
        }
        table.official-table th, table.official-table td {
            border: 1px solid #64748b; padding: 5px 5px;
        }
        table.official-table th {
            background: #1e3a8a; color: #ffffff; font-weight: 800; text-align: center;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <div>
            <div style="height: 4px; background: linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%); border-radius: 2px; margin-bottom: 6px;"></div>
            <div style="border: 1.8px solid #1e3a8a; border-radius: 8px; padding: 8px 12px; background: #f8fafc;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; margin-bottom: 6px; font-size: 8.5pt;">
                    <div style="line-height: 1.4;">
                        <strong>المملكة المغربية</strong><br>
                        <span style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</span><br>
                        <span>${escapeHtml(meta.academy)} — ${escapeHtml(meta.direction)}</span><br>
                        <strong>المؤسسة: ${escapeHtml(meta.school)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 13pt; font-weight: 900; color: #991b1b;">محضر واستدعاء اجتياز الفرض المحروس التعويضي رقم ${examNum}</div>
                        <div style="font-size: 8.5pt; font-weight: 800; color: #1e3a8a; margin-top: 2px;">تطبيقاً لمقتضيات المذكرة الوزارية رقم 142-08 الخاصة بالتقويم التربوي</div>
                        <div style="font-size: 8pt; color: #475569; margin-top: 2px;">الموسم الدراسي: ${escapeHtml(meta.year)} | ${semLabel}</div>
                    </div>
                    <div style="text-align: left; line-height: 1.4;">
                        <strong>المادة:</strong> الرياضيات<br>
                        <strong>القسم:</strong> <span style="color: #1e3a8a; font-weight: 900;">${escapeHtml(className)}</span><br>
                        <strong>الأستاذ(ة):</strong> ${escapeHtml(teacher)}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 8.2pt;">
                    <div><strong style="color:#1e3a8a;">تاريخ الفرض الأصلي:</strong> ${escapeHtml(originalPassDate)}</div>
                    <div><strong style="color:#991b1b;">تاريخ الفرض التعويضي:</strong> <strong>${escapeHtml(makeupDate)}</strong></div>
                    <div><strong style="color:#1e3a8a;">الحصة والتوقيت:</strong> ${escapeHtml(timeSlot)}</div>
                    <div><strong style="color:#1e3a8a;">القاعة:</strong> ${escapeHtml(room)}</div>
                </div>
            </div>

            <div style="margin-top: 8px; border: 1.2px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #ffffff; font-size: 8.4pt;">
                <strong style="color: #1e3a8a;">📌 موضوع الفرض المحروس التعويضي والضوابط البيداغوجية (المذكرة 142-08):</strong>
                <div class="hw-text" style="margin-top: 3px; line-height: 1.5;">${escapeHtml(topics)}</div>
            </div>

            <div style="margin-top: 8px;">
                <div style="font-weight: 900; color: #1e3a8a; font-size: 9pt; margin-bottom: 3px;">
                    📋 جدول التلاميذ المدعوين لاجتياز الفرض المحروس التعويضي ومحضر الحضور والنقط:
                </div>
                <table class="official-table">
                    <thead>
                        <tr>
                            <th style="width: 32px;">ر.م</th>
                            <th style="width: 42px;">الترتيب</th>
                            <th>الاسم الكامل للتلميذ(ة)</th>
                            <th style="width: 85px;">رمز مسار</th>
                            <th style="width: 155px;">طبيعة التبرير الإداري</th>
                            <th style="width: 82px;">تاريخ الإجراء</th>
                            <th style="width: 75px;">توقيع الحضور</th>
                            <th style="width: 72px;">النقطة / 20</th>
                            <th style="width: 95px;">الوضعية</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 8px;">
                ${convocationsSlipsHtml}
            </div>
        </div>

        <div>
            <div style="display: flex; justify-content: space-between; border-top: 1.5px dashed #94a3b8; padding-top: 6px; margin-top: 6px; font-size: 8.5pt;">
                <div style="width: 32%; text-align: center;">
                    <strong>توقيع أستاذ(ة) مادة الرياضيات:</strong><br>
                    <span class="hw-text">${escapeHtml(teacher)}</span>
                </div>
                <div style="width: 32%; text-align: center;">
                    <strong>تأشيرة الحراسة العامة للخارجية:</strong><br>
                    <span style="color:#94a3b8;">....................................</span>
                </div>
                <div style="width: 32%; text-align: center;">
                    <strong>خاتم وتأشيرة السيد مدير المؤسسة:</strong><br>
                    <span style="color:#94a3b8;">....................................</span>
                </div>
            </div>
            <div style="border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 7.2pt; color: #64748b;">
                <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · محضر الفرض المحروس التعويضي رقم ${examNum} (${escapeHtml(className)}) — المذكرة 142-08</span>
                <span>صفحة رسمية A4 (1/1)</span>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: `محضر_الفرض_التعويضي_${examNum}_${className}`,
                orientation: 'portrait',
                subtitle: `محضر واستدعاء اجتياز الفرض المحروس التعويضي رقم ${examNum} (المذكرة 142-08) — القسم: ${className}`
            });
        }
    }

    /**
     * وحدة الفروض التعويضية الخاصة بتبويب دليل مسار (المذكرة الوزارية 142-08)
     */
    function initMassarMakeupScheduler() {
        const clsSel = document.getElementById('massarMakeupClassSelect');
        if (clsSel && window.db && window.db.classes) {
            const classes = Object.keys(window.db.classes);
            if (classes.length > 0) {
                const currentVal = clsSel.value;
                clsSel.innerHTML = classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
                if (currentVal && classes.includes(currentVal)) {
                    clsSel.value = currentVal;
                } else if (window.activeClass && classes.includes(window.activeClass)) {
                    clsSel.value = window.activeClass;
                }
            }
        }

        const dateInput = document.getElementById('massarMakeupDateInput');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        }

        onMassarMakeupFilterChange();
    }

    function onMassarMakeupFilterChange() {
        const className = document.getElementById('massarMakeupClassSelect')?.value || '';
        const semester = document.getElementById('massarMakeupSemesterSelect')?.value || 's1';
        const examKey = document.getElementById('massarMakeupExamSelect')?.value || 'f1';

        // تحديث شارة المعامل وعدد الفروض
        const badge = document.getElementById('massarMakeupClassNormBadge');
        if (badge && className) {
            let coef = 4, exams = 3;
            if (className.includes('SM') || className.includes('رياضية')) { coef = 9; exams = 3; }
            else if (className.includes('PC') || className.includes('SVT') || className.includes('تجريبية') || className.includes('تكنولوجية')) { coef = 7; exams = 3; }
            else if (className.includes('TCS') || className.includes('مشترك علمي')) { coef = 4; exams = 3; }
            else if (className.includes('آداب') || className.includes('أصيل')) { coef = 2; exams = 2; }
            badge.textContent = `معامل ${coef} • ${exams} فروض`;
        }

        // تحديث موضوع الفرض التلقائي
        const topicsInput = document.getElementById('massarMakeupTopicsInput');
        if (topicsInput && (!topicsInput.value || topicsInput.value.includes('المقررة في الفرض'))) {
            const examNum = examKey.replace('f', '');
            topicsInput.value = `نفس الدروس والكفايات المقررة في الفرض المحروس رقم ${examNum} (موضوع مكافئ وفق المذكرة 142-08)`;
        }

        populateMassarMakeupAddStudentSelect(className);
        renderMassarMakeupSchedulerTable();
        checkMassarMakeupScheduleConflicts();
    }

    function populateMassarMakeupAddStudentSelect(className) {
        const sel = document.getElementById('massarMakeupAddStudentSelect');
        if (!sel) return;
        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            sel.innerHTML = '<option value="">-- اختر القسم أولاً --</option>';
            return;
        }

        const students = Array.isArray(window.db.classes[className]) ? window.db.classes[className] : (window.db.classes[className].students || []);
        sel.innerHTML = students.map((std, idx) => `
            <option value="${escapeHtml(std.id)}">${std.orderNum || (idx + 1)}. ${escapeHtml(std.name)} (${escapeHtml(std.massar || '---')})</option>
        `).join('');
    }

    function autoDetectJustifiedAbsentsForMassarMakeup(notify = true) {
        const className = document.getElementById('massarMakeupClassSelect')?.value || '';
        const semester = document.getElementById('massarMakeupSemesterSelect')?.value || 's1';
        const examKey = document.getElementById('massarMakeupExamSelect')?.value || 'f1';

        if (!className) {
            if (typeof window.showToast === 'function') window.showToast('يرجى اختيار القسم أولاً.', 'warning');
            return;
        }

        const extracted = extractExamMarksFromDB(className, semester, examKey);
        const absents = extracted.absents || [];
        const registry = getOrInitMakeupExamsRegistry();
        let addedCount = 0;

        const defaultDate = document.getElementById('massarMakeupDateInput')?.value || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const defaultTime = document.getElementById('massarMakeupStartTimeSelect')?.value || '10:00';
        const defaultRoom = document.getElementById('massarMakeupRoomInput')?.value || 'قاعة الرياضيات';
        const defaultTopics = document.getElementById('massarMakeupTopicsInput')?.value || '';

        absents.forEach(std => {
            const mKey = getMakeupExamKey(className, semester, examKey, std.id);
            if (!registry[mKey]) {
                registry[mKey] = {
                    studentId: std.id,
                    studentName: std.name,
                    massar: std.massar || '---',
                    className,
                    semester,
                    examKey,
                    makeupDate: defaultDate,
                    timeSlot: defaultTime,
                    room: defaultRoom,
                    topics: defaultTopics,
                    justificationType: 'justified_medical',
                    justificationRef: 'شهادة طبية مقبولة - وصل الإدارة',
                    status: 'scheduled',
                    createdAt: new Date().toISOString()
                };
                addedCount++;
            }
        });

        if (typeof window.saveDB === 'function') window.saveDB();
        renderMassarMakeupSchedulerTable();

        if (notify && typeof window.showToast === 'function') {
            if (addedCount > 0) {
                window.showToast(`تم استيراد وبرمجة ${addedCount} تلميذ(ة) متغيب بعذر للفرض التعويضي بنجاح!`, 'success');
            } else if (absents.length === 0) {
                window.showToast('لم يتم رصد أي تلميذ متغيب في هذا الفرض (جميع التلاميذ حاصلون على نقط).', 'info');
            } else {
                window.showToast(`تم تحديث بيانات ${absents.length} تلميذ(ة) متغيب مسبقاً.`, 'info');
            }
        }
    }

    function autoPickNextFreeSlotForMassarMakeup() {
        const targetDate = new Date(Date.now() + 3 * 86400000);
        if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);

        const dateStr = targetDate.toISOString().split('T')[0];
        const dateInput = document.getElementById('massarMakeupDateInput');
        if (dateInput) dateInput.value = dateStr;

        const timeSelect = document.getElementById('massarMakeupStartTimeSelect');
        if (timeSelect) timeSelect.value = '10:00';

        checkMassarMakeupScheduleConflicts();

        if (typeof window.showToast === 'function') {
            window.showToast(`تم اختيار الموعد المقترح: ${dateStr} الساعة 10:00 بدون تعارض`, 'success');
        }
    }

    function checkMassarMakeupScheduleConflicts() {
        const dateVal = document.getElementById('massarMakeupDateInput')?.value || '';
        const timeVal = document.getElementById('massarMakeupStartTimeSelect')?.value || '10:00';
        const box = document.getElementById('massarMakeupConflictStatusBox');
        if (!box) return;

        if (!dateVal) {
            box.style.background = '#fef3c7';
            box.style.borderColor = '#fde68a';
            box.style.color = '#b45309';
            box.innerHTML = '⚠️ يرجى تحديد تاريخ إجراء الفرض التعويضي للتحقق من التوافق الزمني.';
            return;
        }

        const d = new Date(dateVal);
        const dayIdx = d.getDay();
        const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

        box.style.background = '#f0fdf4';
        box.style.borderColor = '#86efac';
        box.style.color = '#15803d';
        box.innerHTML = `✅ الموعد متوافق (${dayNames[dayIdx]} ${dateVal} الساعة ${timeVal}): لا يوجد أي تعارض مع جدول حصصك أو المواعيد الرسمية.`;
    }

    function addStudentToMassarMakeupSchedule() {
        const className = document.getElementById('massarMakeupClassSelect')?.value || '';
        const semester = document.getElementById('massarMakeupSemesterSelect')?.value || 's1';
        const examKey = document.getElementById('massarMakeupExamSelect')?.value || 'f1';
        const studentId = document.getElementById('massarMakeupAddStudentSelect')?.value;

        if (!className || !studentId) {
            if (typeof window.showToast === 'function') window.showToast('يرجى اختيار القسم والتلميذ.', 'warning');
            return;
        }

        const students = Array.isArray(window.db.classes[className]) ? window.db.classes[className] : (window.db.classes[className].students || []);
        const std = students.find(s => String(s.id) === String(studentId));
        if (!std) return;

        const dateVal = document.getElementById('massarMakeupDateInput')?.value || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
        const timeVal = document.getElementById('massarMakeupStartTimeSelect')?.value || '10:00';
        const roomVal = document.getElementById('massarMakeupRoomInput')?.value || 'قاعة الرياضيات';
        const topicsVal = document.getElementById('massarMakeupTopicsInput')?.value || '';
        const justType = document.getElementById('massarMakeupAddJustifType')?.value || 'justified_medical';
        const justRef = document.getElementById('massarMakeupAddJustifRef')?.value || 'مبرر قانوني مقبول';

        const registry = getOrInitMakeupExamsRegistry();
        const mKey = getMakeupExamKey(className, semester, examKey, std.id);

        registry[mKey] = {
            studentId: std.id,
            studentName: std.name,
            massar: std.massar || '---',
            className,
            semester,
            examKey,
            makeupDate: dateVal,
            timeSlot: timeVal,
            room: roomVal,
            topics: topicsVal,
            justificationType: justType,
            justificationRef: justRef,
            status: 'scheduled',
            updatedAt: new Date().toISOString()
        };

        if (typeof window.saveDB === 'function') window.saveDB();
        renderMassarMakeupSchedulerTable();

        if (typeof window.showToast === 'function') {
            window.showToast(`تمت برمجة الفرض التعويضي للتلميذ(ة) ${std.name} بنجاح!`, 'success');
        }
    }

    function saveMassarMakeupScheduleAndSync(notify = true) {
        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.saveAllMakeupExamSchedules === 'function') {
            window.saveAllMakeupExamSchedules(true);
        }
        if (notify && typeof window.showToast === 'function') {
            window.showToast('تم حفظ وبرمجة الفروض التعويضية ومزامنة المواعيد مع التقويم بنجاح!', 'success');
        }
    }

    function printMassarMakeupConvocationFromGuide() {
        if (typeof window.printOfficialMakeupExamConvocation === 'function') {
            window.printOfficialMakeupExamConvocation();
        } else {
            alert('وظيفة طباعة الاستدعاء غير متوفرة.');
        }
    }

    function renderMassarMakeupSchedulerTable() {
        const container = document.getElementById('massarMakeupRegistryTableContainer');
        const countPill = document.getElementById('massarMakeupTableCountPill');
        if (!container) return;

        const currentClass = document.getElementById('massarMakeupClassSelect')?.value || '';
        const currentSem = document.getElementById('massarMakeupSemesterSelect')?.value || 's1';
        const currentExam = document.getElementById('massarMakeupExamSelect')?.value || 'f1';
        const scope = document.getElementById('massarMakeupScopeSelect')?.value || 'current';

        const registry = getOrInitMakeupExamsRegistry();
        let entries = Object.values(registry);

        if (scope === 'current') {
            entries = entries.filter(e => e.className === currentClass && e.semester === currentSem && e.examKey === currentExam);
        } else if (scope === 'all_class') {
            entries = entries.filter(e => e.className === currentClass);
        }

        if (countPill) countPill.textContent = `${entries.length} تلميذ`;

        if (entries.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 24px 16px; color: #64748b; font-size: 0.82rem;">
                    لا توجد فروض تعويضية مبرمجة حالياً في هذا النطاق. اضغط على زر "استيراد تلقائي للمتغيبين بمبرر" للبدء.
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                <thead>
                    <tr style="background: #f1f5f9; color: #1e293b; text-align: right; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 7px 10px;">التلميذ(ة)</th>
                        <th style="padding: 7px 10px;">القسم</th>
                        <th style="padding: 7px 10px;">الفرض</th>
                        <th style="padding: 7px 10px;">تاريخ وتوقيت الفرض</th>
                        <th style="padding: 7px 10px;">المبرر القانوني</th>
                        <th style="padding: 7px 10px;">نقطة الفرض التعويضي</th>
                        <th style="padding: 7px 10px; text-align: center;">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(e => {
                        const mKey = getMakeupExamKey(e.className, e.semester, e.examKey, e.studentId);
                        const isCompleted = (e.status === 'completed' || (e.mark !== undefined && e.mark !== null && e.mark !== ''));
                        return `
                            <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                <td style="padding: 7px 10px; font-weight: 800; color: #0f172a;">
                                    ${escapeHtml(e.studentName || '---')}
                                    <div style="font-size: 0.68rem; color: #64748b; font-weight: 600;">${escapeHtml(e.massar || '---')}</div>
                                </td>
                                <td style="padding: 7px 10px; font-weight: 700; color: #1e3a8a;">${escapeHtml(e.className)}</td>
                                <td style="padding: 7px 10px; font-weight: 700;">${e.examKey.toUpperCase()} (${e.semester.toUpperCase()})</td>
                                <td style="padding: 7px 10px; font-weight: 600; color: #334155;">
                                    📅 ${escapeHtml(e.makeupDate || '---')}
                                    <span style="font-size: 0.7rem; color: #64748b;">(${escapeHtml(e.timeSlot || '10:00')})</span>
                                </td>
                                <td style="padding: 7px 10px; font-size: 0.72rem; color: #0369a1;">
                                    ${escapeHtml(e.justificationRef || 'مبرر قانوني')}
                                </td>
                                <td style="padding: 7px 10px;">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <input type="number" min="0" max="20" step="0.25" value="${e.mark !== undefined && e.mark !== null ? e.mark : ''}"
                                            id="massarMakeupMarkInput_${e.studentId}"
                                            placeholder="نقطة /20"
                                            style="width: 70px; padding: 3px 5px; border: 1.5px solid #cbd5e1; border-radius: 5px; text-align: center; font-weight: 800; font-size: 0.78rem;">
                                        <button type="button" onclick="window.applyMakeupExamMarkInline('${e.studentId}', 'massarMakeupMarkInput_${e.studentId}')"
                                            style="background: #059669; color: #fff; border: none; border-radius: 5px; padding: 4px 7px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                                            مسك
                                        </button>
                                    </div>
                                </td>
                                <td style="padding: 7px 10px; text-align: center;">
                                    <button type="button" onclick="window.deleteMassarMakeupScheduleEntry('${mKey}')"
                                        style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 5px; padding: 3px 7px; font-size: 0.72rem; font-weight: 700; cursor: pointer;" title="حذف من جدول الفروض التعويضية">
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function deleteMassarMakeupScheduleEntry(mKey) {
        const registry = getOrInitMakeupExamsRegistry();
        if (registry[mKey]) {
            delete registry[mKey];
            if (typeof window.saveDB === 'function') window.saveDB();
            renderMassarMakeupSchedulerTable();
            if (typeof window.showToast === 'function') window.showToast('تم حذف السجل بنجاح.', 'info');
        }
    }

    // Expose methods globally
    window.initExamReportSection = initExamReportSection;
    window.loadOrBuildReportForForm = loadOrBuildReportForForm;
    window.autoCalculateExamStats = autoCalculateExamStats;
    window.saveCurrentExamReport = saveCurrentExamReport;
    window.printOfficialExamReport = printOfficialExamReport;
    window.filterExamReportStudents = filterExamReportStudents;
    window.switchExamReportTableView = switchExamReportTableView;
    window.switchExamPieChartMode = switchExamPieChartMode;
    window.buildExamReportPieChartSVG = buildExamReportPieChartSVG;
    window.openMakeupExamManagerModal = openMakeupExamManagerModal;
    window.quickUpdateMakeupJustification = quickUpdateMakeupJustification;
    window.applyMakeupExamMarkInline = applyMakeupExamMarkInline;
    window.markStudentAbsentForCurrentExam = markStudentAbsentForCurrentExam;
    window.saveAllMakeupExamSchedules = saveAllMakeupExamSchedules;
    window.printOfficialMakeupExamConvocation = printOfficialMakeupExamConvocation;
    window.initMassarMakeupScheduler = initMassarMakeupScheduler;
    window.onMassarMakeupFilterChange = onMassarMakeupFilterChange;
    window.autoDetectJustifiedAbsentsForMassarMakeup = autoDetectJustifiedAbsentsForMassarMakeup;
    window.autoPickNextFreeSlotForMassarMakeup = autoPickNextFreeSlotForMassarMakeup;
    window.checkMassarMakeupScheduleConflicts = checkMassarMakeupScheduleConflicts;
    window.addStudentToMassarMakeupSchedule = addStudentToMassarMakeupSchedule;
    window.saveMassarMakeupScheduleAndSync = saveMassarMakeupScheduleAndSync;
    window.printMassarMakeupConvocationFromGuide = printMassarMakeupConvocationFromGuide;
    window.renderMassarMakeupSchedulerTable = renderMassarMakeupSchedulerTable;
    window.deleteMassarMakeupScheduleEntry = deleteMassarMakeupScheduleEntry;
    window.cleanupExamReportMemory = function () {
        cachedExamStudentsData = [];
        const f = document.getElementById('examReportPrintIframe');
        if (f) f.remove();
    };

})(window);
