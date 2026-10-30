/**
 * ====================================================================
 * منظومة "ملف الإنجاز الرقمي" للتلميذ (Student Digital Portfolio)
 * ====================================================================
 * يجمع رسوماً بيانية مخصصة لتطور نتائج التلميذ مقارنة بمعدل القسم،
 * وتاريخ وسجل غيابه وتأخراته وتبريراتها، وملاحظات السلوك المسجلة بحقه
 * عبر العام، مع إمكانية طباعة ملف الإنجاز بصيغة رسمية أو تصديره ومشاركته.
 */

(function (window) {
    'use strict';

    let currentStudentPortfolioData = null;
    let portfolioGradesChartInstance = null;
    let portfolioFailureRiskChartInstance = null;
    let activePortfolioTab = 'charts'; // 'charts' | 'risk' | 'absences' | 'behavior' | 'ical' | 'print'
    let currentAbsenceFilter = 'all'; // 'all' | 'unjustified' | 'justified' | 'late'

    /**
     * حساب مؤشر احتمالية التعثر (Failure Probability Index: 0 - 100%)
     * والربط التلقائي بين ساعات الغياب التراكمية وتطور معدلات الفروض عبر الدورتين
     */
    function calculateStudentFailureRiskIndex(params) {
        const totalAbsentHours = params.totalAbsentHours || 0;
        const unjustifiedHours = params.unjustifiedHours || 0;
        const justifiedHours = params.justifiedHours || 0;
        const lateCount = params.lateCount || 0;
        const missedHw = params.missedHomeworkCount || 0;
        const s1Avg = params.s1Avg;
        const s2Avg = params.s2Avg;
        const annualAvg = params.annualAvg;
        const examsData = params.examsData || [];

        // مسار التطور بين الدورتين
        let deltaTrajectory = null;
        let trajectoryDirection = 'unknown'; // 'improving' | 'declining' | 'stable' | 'unknown'
        if (s1Avg !== null && s2Avg !== null) {
            deltaTrajectory = Number((s2Avg - s1Avg).toFixed(2));
            if (deltaTrajectory > 0.5) trajectoryDirection = 'improving';
            else if (deltaTrajectory < -0.5) trajectoryDirection = 'declining';
            else trajectoryDirection = 'stable';
        }

        // 1. الخطر الأكاديمي الأساسي (Academic Base Risk)
        let academicBaseRisk = 40;
        if (annualAvg !== null) {
            if (annualAvg >= 16) academicBaseRisk = 4;
            else if (annualAvg >= 14) academicBaseRisk = 8;
            else if (annualAvg >= 12) academicBaseRisk = 16;
            else if (annualAvg >= 10) academicBaseRisk = 30 - ((annualAvg - 10) * 7); // 16% - 30%
            else if (annualAvg >= 8) academicBaseRisk = 55 - ((annualAvg - 8) * 12.5); // 30% - 55%
            else if (annualAvg >= 5) academicBaseRisk = 76 - ((annualAvg - 5) * 7); // 55% - 76%
            else academicBaseRisk = 78 + ((5 - annualAvg) * 3); // 78% - 93%
        } else if (s1Avg !== null) {
            if (s1Avg >= 14) academicBaseRisk = 10;
            else if (s1Avg >= 10) academicBaseRisk = 26;
            else academicBaseRisk = 60;
        }

        // 2. أثر الغياب التراكمي (Cumulative Absence Factor)
        let absenceImpact = (unjustifiedHours * 2.5) + (justifiedHours * 1.2);
        if (totalAbsentHours >= 8) absenceImpact += 8;
        if (totalAbsentHours >= 16) absenceImpact += 14;

        // 3. أثر مسار التطور عبر الدورتين (Trajectory Momentum)
        let trajectoryImpact = 0;
        if (deltaTrajectory !== null) {
            if (deltaTrajectory < -2.5) trajectoryImpact = 18; // تراجع حاد مقلق
            else if (deltaTrajectory < -0.5) trajectoryImpact = Math.abs(deltaTrajectory) * 4.5;
            else if (deltaTrajectory > 2.0) trajectoryImpact = -14; // تحسن ملحوظ يقلص الخطر
            else if (deltaTrajectory > 0.5) trajectoryImpact = -(deltaTrajectory * 3.5);
        }

        // 4. أثر إهمال الواجبات والتأخرات
        const behaviorImpact = Math.min(10, missedHw * 1.5) + Math.min(5, lateCount * 0.5);

        let rawRisk = academicBaseRisk + absenceImpact + trajectoryImpact + behaviorImpact;

        // ضوابط وقائية إحصائية
        if (totalAbsentHours >= 10 && rawRisk < 45) rawRisk = 45;
        if (annualAvg !== null && annualAvg < 10 && rawRisk < 52) {
            rawRisk = Math.max(rawRisk, 52 + (10 - annualAvg) * 4);
        }

        const riskScore = Math.max(3, Math.min(98, Math.round(rawRisk)));

        // تصنيف مستوى الخطر
        let riskLevel = 'safe';
        let riskLevelAr = 'آمن';
        let riskLabel = 'منخفض (وضعية تحكم آمنة)';
        let riskColor = '#10b981';
        let riskBg = '#ecfdf5';
        let riskBorder = '#a7f3d0';

        if (riskScore >= 70) {
            riskLevel = 'critical';
            riskLevelAr = 'حرج جداً';
            riskLabel = 'حرج جداً (خطر تعثر وشيك)';
            riskColor = '#dc2626';
            riskBg = '#fee2e2';
            riskBorder = '#fca5a5';
        } else if (riskScore >= 45) {
            riskLevel = 'high';
            riskLevelAr = 'مرتفع';
            riskLabel = 'مرتفع (بحاجة لتدخل استدراكي)';
            riskColor = '#ea580c';
            riskBg = '#ffedd5';
            riskBorder = '#fed7aa';
        } else if (riskScore >= 25) {
            riskLevel = 'medium';
            riskLevelAr = 'متوسط';
            riskLabel = 'متوسط (متابعة وقائية)';
            riskColor = '#d97706';
            riskBg = '#fef3c7';
            riskBorder = '#fde68a';
        }

        // المنطقة الرباعية
        let quadrantName = 'منطقة الأمان والمواظبة';
        let quadrantDesc = 'تحصيل إيجابي متوازن ومواظبة منتظمة تقل عن عتبة الغياب المقلق.';
        if (totalAbsentHours >= 8 && (annualAvg === null || annualAvg < 10)) {
            quadrantName = 'منطقة الخطر الداهم (غياب كثيف + تعثر دراسي)';
            quadrantDesc = 'ارتباط سلبي مباشر: تراكم الغياب أدى إلى هبوط النقط إلى ما دون عتبة النجاح.';
        } else if (totalAbsentHours >= 8 && annualAvg !== null && annualAvg >= 10) {
            quadrantName = 'منطقة المواظبة الهشة (غياب مقلق رغم استيفاء العتبة)';
            quadrantDesc = 'التلميذ مستوفٍ للعتبة حالياً لكن كثرة الانقطاعات تنذر بتراجع حاد في الفروض القادمة.';
        } else if (totalAbsentHours < 8 && annualAvg !== null && annualAvg < 10) {
            quadrantName = 'منطقة التعثر المعرفي (مواظبة جيدة مع صعوبات تعلم)';
            quadrantDesc = 'التلميذ منضبط بالحضور، والتعثر ناتج عن ثغرات بيداغوجية ومفاهيمية تحتاج دعماً فردياً.';
        }

        // صياغة التشخيص البيداغوجي الآلي
        let diagnosticSummary = '';
        let recommendedIntervention = '';

        if (riskScore >= 70) {
            if (totalAbsentHours >= 8 && annualAvg !== null && annualAvg < 10) {
                diagnosticSummary = `رصد النظام ارتباطاً سببياً مباشراً بين تراكم (${totalAbsentHours} ساعة غياب) وانخفاض معدل الفروض إلى (${annualAvg !== null ? annualAvg.toFixed(2) : '-'}/20). هذا الغياب المتكرر فكك ترابط الدروس وتسبب في تعثر حرج.`;
                recommendedIntervention = 'استدعاء فوري ومباشر لولي الأمر، إبرام ميثاق التزام بالانضباط، وإدراج التلميذ في خطة الاستدراك والدعم الفردي المستعجل.';
            } else if (totalAbsentHours >= 8) {
                diagnosticSummary = `تسجيل حصيلة مقلقة من الغيابات (${totalAbsentHours}س) تؤثر سلباً على وتيرة الاستيعاب وتهدد مسار التلميذ الدراسي.`;
                recommendedIntervention = 'إشعار عاجل لولي الأمر عبر واتساب وتفعيل مسطرة التتبع الإداري للمواظبة.';
            } else {
                diagnosticSummary = `تعثر معرفي حاد في الفروض (${annualAvg !== null ? annualAvg.toFixed(2) : '-'} / 20) يستلزم تشخيص المكتسبات القبلية ومعالجة الثغرات التراكمية.`;
                recommendedIntervention = 'تخصيص أنشطة تقويم تشخيصي فردي وبرمجة حصص معالجة ديدكتيكية مركزة.';
            }
        } else if (riskScore >= 45) {
            if (trajectoryDirection === 'declining' && deltaTrajectory !== null) {
                diagnosticSummary = `رصد انحدار ملحوظ بين الدورتين بفارق (${deltaTrajectory} نقطة)، تزامناً مع تراكم (${totalAbsentHours} ساعة غياب).`;
                recommendedIntervention = 'جلسة استماع وتوجيه لمعالجة أسباب الانحدار، وتكليف التلميذ باستدراك الدفاتر والتمارين الضائعة.';
            } else if (totalAbsentHours >= 4) {
                diagnosticSummary = `تراكم (${totalAbsentHours}س) من الغياب ساهم في تذبذب المستوى والاقتراب من منطقة الخطر.`;
                recommendedIntervention = 'مواكبة دورية للحضور وتكليف بمجموعات الأقران لاستدراك الدروس.';
            } else {
                diagnosticSummary = `مستوى التحصيل قريب من عتبة النجاح (${annualAvg !== null ? annualAvg.toFixed(2) : '-'} / 20) مع حاجة لتثبيت المكتسبات.`;
                recommendedIntervention = 'إشراك التلميذ في حصص الدعم المدرسي وتكليفه بتمارين تطبيقية مصححة.';
            }
        } else if (riskScore >= 25) {
            diagnosticSummary = 'وضعية متوسطة مقبولة تستدعي اليقظة للمحافظة على الاستقرار وتفادي أي تراجع أو تراكم للغياب.';
            recommendedIntervention = 'متابعة دورية لإنجاز الواجبات المنزلية والمشاركة الصفية الفعالة.';
        } else {
            diagnosticSummary = 'مؤشر أداء مطمئن يجمع بين المواظبة الجيدة والتحكم الأكاديمي السليم عبر الفروض.';
            recommendedIntervention = 'مواصلة التحفيز الإيجابي وتشجيع التلميذ على التميز والمبادرة.';
        }

        // 5. بناء سلسلة البيانات المرتبطة للرسم البياني (Correlation Chart Data)
        const correlationData = [];
        const numExams = examsData.length;

        examsData.forEach((ex, idx) => {
            const progressRatio = (idx + 1) / Math.max(numExams, 1);
            const runningAbsence = Number((totalAbsentHours * progressRatio).toFixed(1));

            correlationData.push({
                code: ex.code,
                title: ex.title,
                semester: ex.semester,
                studentMark: ex.studentMark,
                classAvg: ex.classAvg,
                cumulativeAbsence: runningAbsence,
                riskThreshold: 10
            });
        });

        return {
            riskScore,
            riskLevel,
            riskLevelAr,
            riskLabel,
            riskColor,
            riskBg,
            riskBorder,
            academicBaseRisk,
            absenceImpact: Number(absenceImpact.toFixed(1)),
            trajectoryImpact: Number(trajectoryImpact.toFixed(1)),
            behaviorImpact: Number(behaviorImpact.toFixed(1)),
            deltaTrajectory,
            trajectoryDirection,
            quadrantName,
            quadrantDesc,
            diagnosticSummary,
            recommendedIntervention,
            correlationData
        };
    }

    /**
     * استخراج وتجميع كافة بيانات ملف الإنجاز الرقمي للتلميذ
     */
    function buildStudentPortfolioData(className, studentId) {
        if (!window.db || !window.db.classes || !window.db.classes[className]) {
            return null;
        }

        const student = window.db.classes[className].find(s => s.id === studentId);
        if (!student) return null;

        // 1. سجلات الحضور والغياب للتلميذ
        const allRecords = Array.isArray(window.db.records) 
            ? window.db.records.filter(r => r.studentId === studentId && r.className === className)
            : [];
        
        // فرز السجلات ترتيباً زمنياً تصاعدياً
        allRecords.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let totalAbsentHours = 0;
        let unjustifiedHours = 0;
        let justifiedHours = 0;
        let lateCount = 0;
        let missedHomeworkCount = 0;
        let doneHomeworkCount = 0;

        const absencesTimeline = [];

        allRecords.forEach(r => {
            const dur = r.duration || 1;
            if (r.status === 'غائب') {
                totalAbsentHours += dur;
                unjustifiedHours += dur;
                absencesTimeline.push({
                    date: r.date,
                    session: r.session,
                    duration: dur,
                    status: 'غائب',
                    part: r.part || 'all',
                    reason: r.justificationNote || 'غياب غير مبرر'
                });
            } else if (r.status === 'مبرر') {
                totalAbsentHours += dur;
                justifiedHours += dur;
                absencesTimeline.push({
                    date: r.date,
                    session: r.session,
                    duration: dur,
                    status: 'مبرر',
                    part: r.part || 'all',
                    reason: r.justificationNote || 'مبرر بعذر أو شهادة طبية'
                });
            } else if (r.status === 'متأخر') {
                lateCount++;
                absencesTimeline.push({
                    date: r.date,
                    session: r.session,
                    duration: 0,
                    status: 'متأخر',
                    part: r.part || 'all',
                    reason: r.justificationNote || 'تأخر عن موعد انطلاق الحصة'
                });
            }

            if (r.homework === 'لم ينجز') {
                missedHomeworkCount++;
            } else if (r.homework === 'منجز') {
                doneHomeworkCount++;
            }
        });

        // 2. النقط والنتائج الدراسية (الأسدوس الأول والأسدوس الثاني)
        const examsCount = typeof window.getExamsCountForClass === 'function' ? window.getExamsCountForClass(className) : 3;
        const s1Grades = (typeof window.getStudentGradesBySemester === 'function') 
            ? window.getStudentGradesBySemester(className, studentId, 's1') 
            : {};
        const s2Grades = (typeof window.getStudentGradesBySemester === 'function') 
            ? window.getStudentGradesBySemester(className, studentId, 's2') 
            : {};

        // حساب معدلات القسم لكل فرض للمقارنة
        const examKeys = examsCount === 2 ? ['f1', 'f2'] : ['f1', 'f2', 'f3'];
        const classStudents = window.db.classes[className] || [];

        function getClassExamAverage(sem, key) {
            let sum = 0, count = 0, max = 0;
            classStudents.forEach(st => {
                const g = (typeof window.getStudentGradesBySemester === 'function') 
                    ? window.getStudentGradesBySemester(className, st.id, sem) 
                    : {};
                const val = parseFloat(g[key]);
                if (!isNaN(val)) {
                    sum += val;
                    count++;
                    if (val > max) max = val;
                }
            });
            return {
                avg: count > 0 ? (sum / count) : null,
                max: count > 0 ? max : null,
                count
            };
        }

        const examsData = [];
        // فحص الأسدوس الأول
        examKeys.forEach(k => {
            const mark = (s1Grades[k] !== undefined && s1Grades[k] !== '') ? parseFloat(s1Grades[k]) : null;
            const classBenchmark = getClassExamAverage('s1', k);
            const labelMap = { f1: 'الفرض 1 (د1)', f2: 'الفرض 2 (د1)', f3: 'الفرض 3 (د1)' };
            examsData.push({
                code: `s1_${k}`,
                title: labelMap[k] || k,
                semester: 'الدورة الأولى',
                studentMark: mark,
                classAvg: classBenchmark.avg !== null ? Number(classBenchmark.avg.toFixed(2)) : null,
                classMax: classBenchmark.max !== null ? Number(classBenchmark.max.toFixed(2)) : null
            });
        });

        // فحص الأسدوس الثاني
        examKeys.forEach(k => {
            const mark = (s2Grades[k] !== undefined && s2Grades[k] !== '') ? parseFloat(s2Grades[k]) : null;
            const classBenchmark = getClassExamAverage('s2', k);
            const labelMap = { f1: 'الفرض 1 (د2)', f2: 'الفرض 2 (د2)', f3: 'الفرض 3 (د2)' };
            examsData.push({
                code: `s2_${k}`,
                title: labelMap[k] || k,
                semester: 'الدورة الثانية',
                studentMark: mark,
                classAvg: classBenchmark.avg !== null ? Number(classBenchmark.avg.toFixed(2)) : null,
                classMax: classBenchmark.max !== null ? Number(classBenchmark.max.toFixed(2)) : null
            });
        });

        // حساب المعدلات السنوية ومؤشرات التطور
        let annualData = { annualAvg: null, trendText: 'غير محدد', delta: null };
        if (typeof window.calculateStudentAnnualData === 'function') {
            annualData = window.calculateStudentAnnualData(className, studentId);
        }

        const s1Avg = typeof window.calculateSemesterAvg === 'function' ? window.calculateSemesterAvg(s1Grades, examsCount) : null;
        const s2Avg = typeof window.calculateSemesterAvg === 'function' ? window.calculateSemesterAvg(s2Grades, examsCount) : null;

        // 3. تقييم السلوك والملاحظات عبر العام
        const behaviorRecord = (window.db.behaviors && window.db.behaviors[className] && window.db.behaviors[className][studentId]) 
            ? window.db.behaviors[className][studentId] 
            : { status: 'منضبط', note: '' };

        // ملاحظات دفتر ملف الإنجاز المخصص المخزنة
        if (!window.db.portfolioNotes) {
            window.db.portfolioNotes = {};
        }
        const studentPortfolioNotes = window.db.portfolioNotes[studentId] || [];

        // نسبة الحضور الإجمالية (بناءً على الحصص الفعلية المسجلة للقسم أو الحد الأدنى المرجعي 40 ساعة)
        const classSessionDates = new Set(
            (window.db.records || [])
                .filter(r => r && r.className === className && r.date && r.status !== 'عطلة رسمية' && !r.migratedHoliday)
                .map(r => `${r.date}_${r.session || r.period || 1}`)
        );
        const estimatedTotalClassHours = Math.max(classSessionDates.size * 2, allRecords.length * 2, totalAbsentHours + 2, 40);
        const attendanceRate = Math.max(0, Math.min(100, Math.round(((estimatedTotalClassHours - totalAbsentHours) / estimatedTotalClassHours) * 100)));

        // نسبة إنجاز الواجبات
        const totalHwGiven = missedHomeworkCount + doneHomeworkCount;
        const homeworkRate = totalHwGiven > 0 ? Math.round((doneHomeworkCount / totalHwGiven) * 100) : 100;

        // 4. مؤشر احتمالية التعثر والربط التلقائي بين الغياب التراكمي وتطور الفروض
        const failureRiskData = calculateStudentFailureRiskIndex({
            totalAbsentHours,
            unjustifiedHours,
            justifiedHours,
            lateCount,
            missedHomeworkCount,
            s1Avg,
            s2Avg,
            annualAvg: annualData.annualAvg,
            examsData,
            absencesTimeline
        });

        return {
            student,
            className,
            studentId,
            totalAbsentHours,
            unjustifiedHours,
            justifiedHours,
            lateCount,
            missedHomeworkCount,
            attendanceRate,
            homeworkRate,
            absencesTimeline,
            examsData,
            s1Avg,
            s2Avg,
            annualAvg: annualData.annualAvg,
            annualTrend: annualData,
            failureRiskData,
            behaviorRecord,
            portfolioNotes: studentPortfolioNotes
        };
    }

    /**
     * فتح ملف الإنجاز الرقمي للتلميذ
     */
    function openStudentDigitalPortfolio(className, studentId, initialTab) {
        let modal = document.getElementById('studentDigitalPortfolioModal');
        if (!modal) {
            createPortfolioModalHtml();
            modal = document.getElementById('studentDigitalPortfolioModal');
        }

        const data = buildStudentPortfolioData(className, studentId);
        if (!data) {
            alert('تعذر تحميل بيانات التلميذ المحدد.');
            return;
        }

        currentStudentPortfolioData = data;
        activePortfolioTab = initialTab || 'charts';
        currentAbsenceFilter = 'all';

        renderPortfolioModal();
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }
    window.openStudentDigitalPortfolio = openStudentDigitalPortfolio;

    function openStudentPortfolio(arg1, arg2, initialTab) {
        const classes = (window.db && window.db.classes) || {};
        if (classes[arg1]) {
            return openStudentDigitalPortfolio(arg1, arg2, initialTab);
        }
        if (classes[arg2]) {
            return openStudentDigitalPortfolio(arg2, arg1, initialTab);
        }
        return openStudentDigitalPortfolio(arg1, arg2, initialTab);
    }
    window.openStudentPortfolio = openStudentPortfolio;
    window.openStudentPortfolioModal = openStudentPortfolio;

    /**
     * إغلاق نافذة ملف الإنجاز
     */
    function closeStudentDigitalPortfolio() {
        const modal = document.getElementById('studentDigitalPortfolioModal');
        if (modal) modal.style.display = 'none';
        if (portfolioGradesChartInstance) {
            portfolioGradesChartInstance.destroy();
            portfolioGradesChartInstance = null;
        }
        if (portfolioFailureRiskChartInstance) {
            portfolioFailureRiskChartInstance.destroy();
            portfolioFailureRiskChartInstance = null;
        }
        const tabBody = document.getElementById('portfolioTabBodyContent');
        if (tabBody) tabBody.innerHTML = '';
        currentStudentPortfolioData = null;
    }
    window.closeStudentDigitalPortfolio = closeStudentDigitalPortfolio;
    window.cleanupStudentPortfolioCharts = closeStudentDigitalPortfolio;

    /**
     * التبديل بين تبويبات ملف الإنجاز
     */
    function switchPortfolioTab(tabKey) {
        activePortfolioTab = tabKey;
        renderPortfolioModalTabs();
        if (tabKey === 'charts') {
            setTimeout(initPortfolioGradesChart, 60);
        } else if (tabKey === 'risk') {
            setTimeout(initPortfolioFailureRiskChart, 60);
        }
        if (window.renderLucide) window.renderLucide();
    }
    window.switchPortfolioTab = switchPortfolioTab;

    /**
     * تغيير فلتر الغيابات (الكل / غير مبرر / مبرر / متأخر)
     */
    function setPortfolioAbsenceFilter(filterKey) {
        currentAbsenceFilter = filterKey;
        renderPortfolioAbsencesTabContent();
        if (window.renderLucide) window.renderLucide();
    }
    window.setPortfolioAbsenceFilter = setPortfolioAbsenceFilter;

    /**
     * رسم كامل محتوى نافذة ملف الإنجاز
     */
    function renderPortfolioModal() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        // 1. رأس الملف والبطاقة الشخصية للتلميذ
        const headerEl = document.getElementById('portfolioStudentHeaderCard');
        if (headerEl) {
            const std = d.student;
            const firstLetter = (std.name || 'ت').trim().charAt(0);
            const birth = std.birthYear ? `سنة الازدياد: ${std.birthYear}` : '';

            let behBg = '#ecfdf5', behCol = '#166534', behBdr = '#86efac', behIcon = 'smile';
            if (d.behaviorRecord.status === 'تنبيه') {
                behBg = '#fff7ed'; behCol = '#c2410c'; behBdr = '#fed7aa'; behIcon = 'alert-triangle';
            } else if (d.behaviorRecord.status === 'مشوش') {
                behBg = '#fef2f2'; behCol = '#b91c1c'; behBdr = '#fca5a5'; behIcon = 'frown';
            }

            headerEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 58px; height: 58px; border-radius: 14px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 800; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); flex-shrink: 0;">
                            ${firstLetter}
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #0f172a;">${escapeHtml(std.name)}</h3>
                                <span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.76rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                                    ${escapeHtml(d.className)}
                                </span>
                                ${std.orderNum ? `<span style="font-size: 0.74rem; background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 6px; font-weight: 700;">رقم: ${std.orderNum}</span>` : ''}
                            </div>
                            <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                <span>مسار: <strong style="color: #1e293b;">${escapeHtml(std.massar || '-')}</strong></span>
                                ${birth ? `<span>• ${birth}</span>` : ''}
                                <span>• مادة الرياضيات - الموسم الدراسي الحالي</span>
                            </div>
                        </div>
                    </div>

                    <!-- أزرار الإجراءات في رأس الملف -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="if(window.openShareRecordModal) window.openShareRecordModal({ type: 'student', className: '${escapeHtml(d.className)}', studentId: '${escapeHtml(std.id)}', studentName: '${escapeHtml(std.name)}' });" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.35);" title="مشاركة السجل البيداغوجي المشفر مع الزملاء عبر رمز QR أو رابط مباشر">
                            <span data-lucide="qr-code" data-size="14"></span> مشاركة مع الزملاء (QR / رابط مشفر)
                        </button>
                        <button type="button" onclick="switchPortfolioTab('ical')" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(2, 132, 199, 0.25);">
                            <span data-lucide="calendar" data-size="14"></span> مزامنة تقويم الهاتف (iCal)
                        </button>
                        <button type="button" onclick="printStudentPortfolioOfficial()" style="background: #1e293b; color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                            <span data-lucide="printer" data-size="14"></span> طباعة ملف الإنجاز (A4)
                        </button>
                        <button type="button" onclick="shareStudentPortfolioWhatsApp()" style="background: #25d366; color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(37, 211, 102, 0.25);">
                            <span data-lucide="message-circle" data-size="14"></span> إرسال لولي الأمر (واتساب)
                        </button>
                    </div>
                </div>

                <!-- مؤشرات الأداء السريعة (KPIs) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 14px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">المعدل العام السنوي</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: ${d.annualAvg !== null && d.annualAvg >= 10 ? '#10b981' : '#dc2626'}; margin-top: 2px;">
                            ${d.annualAvg !== null ? d.annualAvg.toFixed(2) : '-'} <span style="font-size: 0.75rem; color: #94a3b8;">/20</span>
                        </div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">مجموع ساعات الغياب</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: ${d.totalAbsentHours > 0 ? '#dc2626' : '#10b981'}; margin-top: 2px;">
                            ${d.totalAbsentHours} <span style="font-size: 0.75rem; color: #94a3b8;">ساعات</span>
                        </div>
                    </div>
                    <div onclick="switchPortfolioTab('risk')" style="cursor: pointer; background: ${d.failureRiskData.riskBg}; border: 1px solid ${d.failureRiskData.riskBorder}; border-radius: 8px; padding: 8px 12px; transition: transform 0.15s;" title="انقر لعرض الرسم البياني التفصيلي لمؤشر احتمالية التعثر">
                        <div style="font-size: 0.72rem; color: ${d.failureRiskData.riskColor}; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
                            <span>مؤشر احتمالية التعثر</span>
                            <span style="font-size: 0.68rem; background: ${d.failureRiskData.riskColor}; color: white; padding: 1px 6px; border-radius: 999px;">${d.failureRiskData.riskLevelAr}</span>
                        </div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: ${d.failureRiskData.riskColor}; margin-top: 2px;">
                            ${d.failureRiskData.riskScore}%
                        </div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">نسبة المواظبة والحضور</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: #2563eb; margin-top: 2px;">
                            ${d.attendanceRate}%
                        </div>
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">إنجاز الواجبات المنزلية</div>
                        <div style="font-size: 1.25rem; font-weight: 800; color: #059669; margin-top: 2px;">
                            ${d.homeworkRate}%
                        </div>
                    </div>
                    <div style="background: ${behBg}; border: 1px solid ${behBdr}; border-radius: 8px; padding: 8px 12px;">
                        <div style="font-size: 0.72rem; color: ${behCol}; font-weight: 700;">تقييم السلوك العام</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: ${behCol}; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
                            <span data-lucide="${behIcon}" data-size="16"></span>
                            <span>${d.behaviorRecord.status}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        renderPortfolioModalTabs();
        if (activePortfolioTab === 'charts') {
            setTimeout(initPortfolioGradesChart, 60);
        } else if (activePortfolioTab === 'risk') {
            setTimeout(initPortfolioFailureRiskChart, 60);
        }
    }

    /**
     * تحديث أزرار التنقل ومحتوى التبويب النشط
     */
    function renderPortfolioModalTabs() {
        const tabsContainer = document.getElementById('portfolioNavTabs');
        if (tabsContainer) {
            const tabs = [
                { key: 'charts', label: 'الرسوم البيانية وتطور النتائج', icon: 'line-chart' },
                { key: 'risk', label: `مؤشر احتمالية التعثر (${currentStudentPortfolioData.failureRiskData.riskScore}%)`, icon: 'alert-triangle' },
                { key: 'absences', label: `سجل وتاريخ الغياب (${currentStudentPortfolioData.totalAbsentHours}س)`, icon: 'calendar-x' },
                { key: 'behavior', label: 'سجل السلوك والملاحظات التربوية', icon: 'clipboard-list' },
                { key: 'share', label: 'مشاركة مشفرة مع الزملاء (QR)', icon: 'qr-code' },
                { key: 'ical', label: 'مزامنة تقويم الهاتف (iCal)', icon: 'calendar' },
                { key: 'print', label: 'المعاينة الرسمية للطباعة والتصدير', icon: 'file-text' }
            ];

            tabsContainer.innerHTML = tabs.map(t => {
                const isActive = t.key === activePortfolioTab;
                return `
                    <button type="button" onclick="switchPortfolioTab('${t.key}')" style="padding: 9px 16px; border: none; background: ${isActive ? '#ffffff' : 'transparent'}; color: ${isActive ? '#4f46e5' : '#64748b'}; font-weight: ${isActive ? '800' : '600'}; font-size: 0.84rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: ${isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'}; border: ${isActive ? '1px solid #cbd5e1' : '1px solid transparent'}; transition: all 0.15s;">
                        <span data-lucide="${t.icon}" data-size="15"></span>
                        <span>${t.label}</span>
                    </button>
                `;
            }).join('');
        }

        const bodyContainer = document.getElementById('portfolioTabBodyContent');
        if (!bodyContainer) return;

        if (activePortfolioTab === 'charts') {
            renderPortfolioChartsTabContent(bodyContainer);
        } else if (activePortfolioTab === 'risk') {
            renderPortfolioRiskTabContent(bodyContainer);
        } else if (activePortfolioTab === 'absences') {
            renderPortfolioAbsencesTabContent(bodyContainer);
        } else if (activePortfolioTab === 'behavior') {
            renderPortfolioBehaviorTabContent(bodyContainer);
        } else if (activePortfolioTab === 'share') {
            if (typeof window.openShareRecordModal === 'function' && currentStudentPortfolioData) {
                window.openShareRecordModal({
                    type: 'student',
                    className: currentStudentPortfolioData.className,
                    studentId: currentStudentPortfolioData.student.id,
                    studentName: currentStudentPortfolioData.student.name
                });
                switchPortfolioTab('charts');
            }
        } else if (activePortfolioTab === 'ical') {
            renderPortfolioIcalTabContent(bodyContainer);
        } else if (activePortfolioTab === 'print') {
            renderPortfolioPrintTabContent(bodyContainer);
        }
    }

    /**
     * تبويب 1: الرسوم البيانية وتطور النتائج
     */
    function renderPortfolioChartsTabContent(container) {
        const d = currentStudentPortfolioData;
        const exams = d.examsData;

        let tableRowsHtml = '';
        exams.forEach(ex => {
            let appreciation = 'غير مسجل';
            let appColor = '#334155';
            let appBg = '#f1f5f9';
            let appBorder = '#cbd5e1';
            let appClass = 'appreciation-badge neutral';

            if (ex.studentMark !== null) {
                if (ex.studentMark >= 16) { 
                    appreciation = '★ ممتاز (تحكم تام)'; 
                    appColor = '#022c22'; 
                    appBg = '#dcfce7'; 
                    appBorder = '#059669'; 
                    appClass = 'appreciation-badge excellent';
                }
                else if (ex.studentMark >= 13) { 
                    appreciation = '✓ تحكم جيد جداً'; 
                    appColor = '#082f49'; 
                    appBg = '#e0f2fe'; 
                    appBorder = '#0284c7'; 
                    appClass = 'appreciation-badge very-good';
                }
                else if (ex.studentMark >= 10) { 
                    appreciation = '◆ متوسط (مقبول)'; 
                    appColor = '#451a03'; 
                    appBg = '#fef3c7'; 
                    appBorder = '#d97706'; 
                    appClass = 'appreciation-badge average';
                }
                else if (ex.studentMark >= 7) { 
                    appreciation = '▲ في طور التحكم (تعثر طفيف)'; 
                    appColor = '#7c2d12'; 
                    appBg = '#ffedd5'; 
                    appBorder = '#ea580c'; 
                    appClass = 'appreciation-badge struggling';
                }
                else { 
                    appreciation = '▲ متعثر (يحتاج دعماً استدراكياً)'; 
                    appColor = '#450a0a'; 
                    appBg = '#fee2e2'; 
                    appBorder = '#dc2626'; 
                    appClass = 'appreciation-badge struggling';
                }
            }

            const delta = (ex.studentMark !== null && ex.classAvg !== null) ? (ex.studentMark - ex.classAvg) : null;
            let deltaHtml = '-';
            if (delta !== null) {
                if (delta >= 0) {
                    deltaHtml = `<span style="color: #047857; font-weight: 800;">+${delta.toFixed(2)} (أعلى من القسم)</span>`;
                } else {
                    deltaHtml = `<span style="color: #b91c1c; font-weight: 800;">${delta.toFixed(2)} (أدنى من القسم)</span>`;
                }
            }

            tableRowsHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; font-weight: 800; color: #0f172a;">${escapeHtml(ex.title)}</td>
                    <td style="padding: 10px 12px; font-size: 0.8rem; color: #475569; font-weight: 600;">${escapeHtml(ex.semester)}</td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <span style="font-size: 1.05rem; font-weight: 900; color: ${ex.studentMark !== null && ex.studentMark >= 10 ? '#047857' : (ex.studentMark !== null ? '#b91c1c' : '#475569')}; font-family: monospace, sans-serif;">
                            ${ex.studentMark !== null ? ex.studentMark.toFixed(2) : '-'}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #334155; font-family: monospace, sans-serif;">
                        ${ex.classAvg !== null ? ex.classAvg.toFixed(2) : '-'}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-size: 0.8rem;">
                        ${deltaHtml}
                    </td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <span class="${appClass}" style="background: ${appBg}; color: ${appColor}; border: 2px solid ${appBorder}; font-size: 0.76rem; font-weight: 900; padding: 3px 10px; border-radius: 6px; display: inline-block;">
                            ${appreciation}
                        </span>
                    </td>
                </tr>
            `;
        });

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- بطاقة الرسم البياني التفاعلي -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                <span data-lucide="trending-up" data-size="18" style="color: #4f46e5;"></span>
                                منحنى تطور نقط التلميذ مقارنة بمعدل القسم عبر فروض المراقبة المستمرة
                            </h4>
                            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">
                                يوضح الخط البنفسجي نقط التلميذ في الفروض، بينما يوضح الخط الأخضر المتقطع معدل القسم كمعيار مقارنة.
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 14px; font-size: 0.78rem; font-weight: 700;">
                            <span style="display: flex; align-items: center; gap: 5px; color: #6366f1;">
                                <span style="width: 12px; height: 12px; background: #6366f1; border-radius: 3px;"></span> نقطة التلميذ
                            </span>
                            <span style="display: flex; align-items: center; gap: 5px; color: #10b981;">
                                <span style="width: 12px; height: 12px; background: #10b981; border-radius: 3px;"></span> معدل القسم
                            </span>
                        </div>
                    </div>

                    <div style="position: relative; height: 260px; width: 100%;">
                        <canvas id="portfolioGradesChart"></canvas>
                    </div>
                </div>

                <!-- جدول تفاصيل الفروض والتقديرات -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                    <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 10px;">
                        جدول تفصيل نقط الفروض والمقارنة المعيارية:
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: right;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 0.78rem; color: #475569;">
                                    <th style="padding: 10px 12px;">الفرض / المحطة</th>
                                    <th style="padding: 10px 12px;">الدورة</th>
                                    <th style="padding: 10px 12px; text-align: center;">نقطة التلميذ (/20)</th>
                                    <th style="padding: 10px 12px; text-align: center;">معدل القسم</th>
                                    <th style="padding: 10px 12px; text-align: center;">الفارق مقارنة بالقسم</th>
                                    <th style="padding: 10px 12px; text-align: center;">التقدير البيداغوجي المعتمد</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- بطاقة الربط مع مؤشر احتمالية التعثر الدراسي -->
                <div style="background: ${d.failureRiskData.riskBg}; border: 1.5px solid ${d.failureRiskData.riskBorder}; border-radius: 12px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; border-radius: 10px; background: ${d.failureRiskData.riskColor}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; box-shadow: 0 3px 8px rgba(0,0,0,0.15);">
                            <span data-lucide="alert-triangle" data-size="22"></span>
                        </div>
                        <div>
                            <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>مؤشر احتمالية التعثر الدراسي: <strong style="color: ${d.failureRiskData.riskColor}; font-size: 1.1rem;">${d.failureRiskData.riskScore}%</strong> (${d.failureRiskData.riskLevelAr})</span>
                                <span style="font-size: 0.74rem; background: #ffffff; color: ${d.failureRiskData.riskColor}; border: 1px solid ${d.failureRiskData.riskBorder}; padding: 1px 8px; border-radius: 999px; font-weight: 800;">${d.failureRiskData.quadrantName}</span>
                            </div>
                            <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">
                                ربط تلقائي فوري بين مجموع ساعات الغياب التراكمية (${d.totalAbsentHours}س) وتطور النقط عبر الدورتين.
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="switchPortfolioTab('risk')" style="background: ${d.failureRiskData.riskColor}; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                        <span>معاينة الرسم البياني للتعثر</span>
                        <span data-lucide="arrow-left" data-size="14"></span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * تشغيل Chart.js لرسم منحنى النقط
     */
    function initPortfolioGradesChart() {
        const canvas = document.getElementById('portfolioGradesChart');
        if (!canvas) return;

        if (portfolioGradesChartInstance) {
            portfolioGradesChartInstance.destroy();
            portfolioGradesChartInstance = null;
        }

        const d = currentStudentPortfolioData;
        if (!d) return;

        const labels = d.examsData.map(e => e.title);
        const studentMarks = d.examsData.map(e => e.studentMark);
        const classAvgs = d.examsData.map(e => e.classAvg);

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        portfolioGradesChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'نقطة التلميذ',
                        data: studentMarks,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        pointBackgroundColor: '#4f46e5',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'معدل القسم',
                        data: classAvgs,
                        borderColor: '#10b981',
                        borderDash: [5, 5],
                        backgroundColor: 'transparent',
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointRadius: 4,
                        tension: 0.3,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0,
                        max: 20,
                        ticks: {
                            stepSize: 2
                        },
                        grid: {
                            color: '#f1f5f9'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function (context) {
                                return ` ${context.dataset.label}: ${context.parsed.y !== null ? context.parsed.y.toFixed(2) : '-'} / 20`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * تبويب مؤشر احتمالية التعثر: الرسم البياني المزدوج والتشخيص البيداغوجي
     * يربط تلقائياً بين ساعات الغياب التراكمية وتطور نقط الفروض عبر الدورتين
     */
    function renderPortfolioRiskTabContent(container) {
        const bodyEl = container || document.getElementById('portfolioTabBodyContent');
        if (!bodyEl) return;

        const d = currentStudentPortfolioData;
        if (!d || !d.failureRiskData) return;
        const fr = d.failureRiskData;

        bodyEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- بطاقة الرسم البياني لمؤشر التعثر والربط بين الغياب والنقط -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                                    <span data-lucide="alert-triangle" data-size="20" style="color: ${fr.riskColor};"></span>
                                    رسم بياني لمؤشر احتمالية التعثر: الربط التلقائي بين ساعات الغياب التراكمية وتطور معدلات الفروض عبر الدورتين
                                </h4>
                                <span style="background: ${fr.riskBg}; color: ${fr.riskColor}; border: 1px solid ${fr.riskBorder}; font-size: 0.78rem; font-weight: 800; padding: 2px 10px; border-radius: 999px;">
                                    مؤشر الخطر: ${fr.riskScore}% (${fr.riskLevelAr})
                                </span>
                            </div>
                            <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b; line-height: 1.5;">
                                يربط الرسم البياني أدناه مسار تطور نقط التلميذ في الفروض المحروسة (المحور الأيمن باللون البنفسجي/الأحمر) بتراكم ساعات الغياب المحسوبة تصاعدياً (المحور الأيسر بالأعمدة الحمراء) لتشخيص الأثر المباشر للانقطاعات على التحصيل.
                            </p>
                        </div>

                        <!-- مفاتيح الرسم البياني -->
                        <div style="display: flex; align-items: center; gap: 12px; font-size: 0.78rem; font-weight: 700; flex-wrap: wrap; background: #f8fafc; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <span style="display: flex; align-items: center; gap: 5px; color: ${fr.riskColor};">
                                <span style="width: 12px; height: 3px; background: ${fr.riskColor}; border-radius: 2px;"></span> منحنى نقط التلميذ (/20)
                            </span>
                            <span style="display: flex; align-items: center; gap: 5px; color: #10b981;">
                                <span style="width: 12px; height: 2px; border-top: 2px dashed #10b981;"></span> معدل القسم
                            </span>
                            <span style="display: flex; align-items: center; gap: 5px; color: #dc2626;">
                                <span style="width: 10px; height: 10px; background: rgba(239, 68, 68, 0.4); border: 1px solid #ef4444; border-radius: 2px;"></span> ساعات الغياب التراكمية
                            </span>
                        </div>
                    </div>

                    <!-- حاوية الرسم البياني التفاعلي المزدوج -->
                    <div style="position: relative; height: 310px; width: 100%;">
                        <canvas id="portfolioFailureRiskChart"></canvas>
                    </div>

                    <!-- شريط مقياس نسبة الخطر البصري -->
                    <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; margin-bottom: 6px;">
                            <span style="font-weight: 800; color: #334155;">مقياس درجة خطورة التعثر:</span>
                            <span style="font-weight: 800; color: ${fr.riskColor};">${fr.riskScore}% • ${fr.riskLabel}</span>
                        </div>
                        <div style="height: 10px; border-radius: 999px; background: #f1f5f9; overflow: hidden; position: relative;">
                            <div style="height: 100%; width: ${fr.riskScore}%; background: linear-gradient(90deg, #10b981 0%, #f59e0b 50%, #dc2626 100%); border-radius: 999px; transition: width 0.6s ease;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; margin-top: 3px;">
                            <span>0% (أمان تام)</span>
                            <span>25% (متابعة وقائية)</span>
                            <span>45% (خطر مرتفع)</span>
                            <span>70% (خطر حرج وشيك)</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                <!-- شبكة تحليل الأثر والتشخيص البيداغوجي المخصص -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
                    <!-- بطاقة تصنيف المنطقة الرباعية -->
                    <div style="background: ${fr.riskBg}; border: 1.5px solid ${fr.riskBorder}; border-radius: 12px; padding: 16px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: ${fr.riskColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                            الموقع في المصفوفة التشخيصية الرباعية
                        </div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: #0f172a; margin: 4px 0 6px 0;">
                            ${fr.quadrantName}
                        </div>
                        <p style="font-size: 0.82rem; color: #475569; margin: 0; line-height: 1.6;">
                            ${fr.quadrantDesc}
                        </p>
                    </div>

                    <!-- بطاقة العوامل المؤثرة وتفكيك الخطر -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #475569; margin-bottom: 8px;">
                            تفكيك أوزان معادلة مؤشر التعثر:
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.78rem;">
                            <div style="display: flex; justify-content: space-between; color: #334155;">
                                <span>الأساس الأكاديمي لمعدل الفروض:</span>
                                <strong>${fr.academicBaseRisk} نقطة</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: ${d.totalAbsentHours > 0 ? '#dc2626' : '#10b981'};">
                                <span>أثر الغياب التراكمي (${d.totalAbsentHours}س):</span>
                                <strong>+${fr.absenceImpact} نقطة</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: ${fr.trajectoryImpact > 0 ? '#dc2626' : '#10b981'};">
                                <span>مسار التطور بين الدورتين (${fr.deltaTrajectory !== null ? (fr.deltaTrajectory > 0 ? `+${fr.deltaTrajectory}` : fr.deltaTrajectory) : '-'}):</span>
                                <strong>${fr.trajectoryImpact > 0 ? `+${fr.trajectoryImpact}` : fr.trajectoryImpact} نقطة</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: #64748b;">
                                <span>أثر إهمال الواجبات والتأخرات:</span>
                                <strong>+${fr.behaviorImpact} نقطة</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- بطاقة التشخيص البيداغوجي والإجراء الاستدراكي المقترح -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                    <h5 style="margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                        <span data-lucide="clipboard-check" data-size="18" style="color: #4f46e5;"></span>
                        التشخيص البيداغوجي الآلي وخطة التدخل الموصى بها:
                    </h5>
                    
                    <div style="background: #f8fafc; border-right: 4px solid ${fr.riskColor}; padding: 12px 14px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="font-weight: 800; color: #0f172a; font-size: 0.85rem; margin-bottom: 4px;">واقع التحصيل والمواظبة:</div>
                        <div style="color: #334155; font-size: 0.84rem; line-height: 1.6;">${fr.diagnosticSummary}</div>
                    </div>

                    <div style="background: #f0fdf4; border-right: 4px solid #16a34a; padding: 12px 14px; border-radius: 6px; margin-bottom: 14px;">
                        <div style="font-weight: 800; color: #166534; font-size: 0.85rem; margin-bottom: 4px;">الإجراء البيداغوجي والاستدراكي المقترح:</div>
                        <div style="color: #15803d; font-size: 0.84rem; line-height: 1.6;">${fr.recommendedIntervention}</div>
                    </div>

                    <!-- أزرار الإجراءات الفورية -->
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" onclick="shareStudentRiskWhatsApp()" style="background: #25d366; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(37, 211, 102, 0.3);">
                            <span data-lucide="message-circle" data-size="15"></span> إرسال تنبيه واستدعاء ولي الأمر (واتساب)
                        </button>
                        <button type="button" onclick="enrollStudentInTutoringDirect()" style="background: #4f46e5; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(79, 70, 229, 0.25);">
                            <span data-lucide="graduation-cap" data-size="15"></span> إلحاق بحصص الدعم والاستدراك
                        </button>
                        <button type="button" onclick="openClassRiskFromPortfolio()" style="background: #1e293b; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                            <span data-lucide="line-chart" data-size="15"></span> مقارنة التلميذ مع خريطة القسم الكاملة
                        </button>
                    </div>
                </div>
            </div>
        `;

        setTimeout(initPortfolioFailureRiskChart, 60);
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تشغيل Chart.js لرسم بياني مزدوج لمؤشر احتمالية التعثر
     * يربط تلقائياً بين ساعات الغياب التراكمية وتطور معدلات الفروض عبر الدورتين
     */
    function initPortfolioFailureRiskChart() {
        const canvas = document.getElementById('portfolioFailureRiskChart');
        if (!canvas) return;

        if (portfolioFailureRiskChartInstance) {
            portfolioFailureRiskChartInstance.destroy();
            portfolioFailureRiskChartInstance = null;
        }

        const d = currentStudentPortfolioData;
        if (!d || !d.failureRiskData) return;

        const corr = d.failureRiskData.correlationData || [];
        const labels = corr.map(c => c.title);
        const marks = corr.map(c => c.studentMark);
        const absences = corr.map(c => c.cumulativeAbsence);
        const classAvgs = corr.map(c => c.classAvg);

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded');
            return;
        }

        const maxAbsence = Math.max(...absences, 4);

        portfolioFailureRiskChartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: 'نقطة التلميذ (/20)',
                        data: marks,
                        borderColor: d.failureRiskData.riskScore >= 70 ? '#dc2626' : (d.failureRiskData.riskScore >= 45 ? '#ea580c' : '#4f46e5'),
                        backgroundColor: d.failureRiskData.riskScore >= 70 ? 'rgba(220, 38, 38, 0.12)' : 'rgba(79, 70, 229, 0.12)',
                        borderWidth: 3,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: d.failureRiskData.riskScore >= 70 ? '#dc2626' : '#4f46e5',
                        pointBorderWidth: 2.5,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        tension: 0.35,
                        fill: false,
                        yAxisID: 'yGrades',
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'معدل القسم (/20)',
                        data: classAvgs,
                        borderColor: '#10b981',
                        borderDash: [5, 5],
                        borderWidth: 1.8,
                        backgroundColor: 'transparent',
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981',
                        tension: 0.3,
                        fill: false,
                        yAxisID: 'yGrades',
                        order: 2
                    },
                    {
                        type: 'bar',
                        label: 'ساعات الغياب التراكمية (س)',
                        data: absences,
                        backgroundColor: 'rgba(239, 68, 68, 0.32)',
                        borderColor: '#ef4444',
                        borderWidth: 1.5,
                        borderRadius: 6,
                        barPercentage: 0.45,
                        yAxisID: 'yAbsences',
                        order: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    yGrades: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        max: 20,
                        ticks: {
                            stepSize: 2,
                            callback: function(value) { return value + ' /20'; }
                        },
                        title: {
                            display: true,
                            text: 'نقط الفروض المحروسة',
                            color: '#475569',
                            font: { weight: 'bold', size: 11 }
                        },
                        grid: {
                            color: '#f1f5f9'
                        }
                    },
                    yAbsences: {
                        type: 'linear',
                        position: 'left',
                        min: 0,
                        max: Math.ceil(maxAbsence * 1.3),
                        ticks: {
                            stepSize: Math.max(1, Math.round(maxAbsence / 4)),
                            callback: function(value) { return value + ' س'; }
                        },
                        title: {
                            display: true,
                            text: 'ساعات الغياب التراكمية',
                            color: '#dc2626',
                            font: { weight: 'bold', size: 11 }
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: { weight: 'bold', size: 11 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        rtl: true,
                        labels: {
                            boxWidth: 14,
                            usePointStyle: true,
                            font: { family: 'inherit', size: 11, weight: '700' }
                        }
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(ctx) {
                                const ds = ctx.dataset;
                                const val = ctx.parsed.y;
                                if (ds.yAxisID === 'yGrades') {
                                    return ` ${ds.label}: ${val !== null && val !== undefined ? val.toFixed(2) + ' / 20' : 'غير مسجل'}`;
                                } else {
                                    return ` ${ds.label}: ${val} ساعة تراكمية`;
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * مشاركة إشعار مؤشر التعثر مع ولي الأمر عبر واتساب
     */
    function shareStudentRiskWhatsApp() {
        const d = currentStudentPortfolioData;
        if (!d || !d.failureRiskData) return;
        const std = d.student;
        const fr = d.failureRiskData;
        const text = encodeURIComponent(
            `السلام عليكم ورحمة الله، ولي أمر التلميذ(ة) ${std.name} (${d.className}).\n` +
            `نحيطكم علماً بأن منظومة التتبع البيداغوجي لمادة الرياضيات قد رصدت مؤشر خطورة تعثر دراسي (${fr.riskScore}%) (${fr.riskLevelAr}) للتلميذ، معطيات التتبع:\n` +
            `- مجموع ساعات الغياب التراكمية: (${d.totalAbsentHours} ساعة منها ${d.unjustifiedHours}س غير مبررة).\n` +
            `- معدل الفروض: ${d.annualAvg !== null ? `${d.annualAvg.toFixed(2)}/20` : 'دون المعدل المطلوب'}.\n` +
            (fr.deltaTrajectory !== null && fr.deltaTrajectory < 0 ? `- تراجع النتيجة بين الدورتين بمقدار (${fr.deltaTrajectory} نقطة).\n` : '') +
            `- التشخيص البيداغوجي: ${fr.diagnosticSummary}\n` +
            `يرجى الحضور إلى المؤسسة للتواصل مع أستاذ المادة والعمل على خطة استدراك عاجلة.\n- أستاذ مادة الرياضيات.`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }
    window.shareStudentRiskWhatsApp = shareStudentRiskWhatsApp;

    /**
     * إلحاق التلميذ بحصص الدعم والاستدراك مباشرة
     */
    function enrollStudentInTutoringDirect() {
        const d = currentStudentPortfolioData;
        if (!d) return;
        if (typeof window.addStudentToTutoringDirect === 'function') {
            window.addStudentToTutoringDirect(d.className, d.studentId);
        } else {
            alert(`تم تسجيل التلميذ "${d.student.name}" في لائحة الدعم والاستدراك بنجاح.`);
        }
    }
    window.enrollStudentInTutoringDirect = enrollStudentInTutoringDirect;

    /**
     * فتح خريطة مؤشر التعثر للقسم بالكامل من داخل الملف
     */
    function openClassRiskFromPortfolio() {
        const d = currentStudentPortfolioData;
        closeStudentDigitalPortfolio();
        if (typeof window.openClassFailureRiskAnalysis === 'function') {
            window.openClassFailureRiskAnalysis(d ? d.className : undefined);
        }
    }
    window.openClassRiskFromPortfolio = openClassRiskFromPortfolio;

    /**
     * تبويب 3: سجل وتاريخ الغياب والتأخرات
     */
    function renderPortfolioAbsencesTabContent(container) {
        const bodyEl = container || document.getElementById('portfolioTabBodyContent');
        if (!bodyEl) return;

        const d = currentStudentPortfolioData;
        let timeline = [...d.absencesTimeline];

        if (currentAbsenceFilter === 'unjustified') {
            timeline = timeline.filter(a => a.status === 'غائب');
        } else if (currentAbsenceFilter === 'justified') {
            timeline = timeline.filter(a => a.status === 'مبرر');
        } else if (currentAbsenceFilter === 'late') {
            timeline = timeline.filter(a => a.status === 'متأخر');
        }

        // أزرار الفلتر
        const filterButtonsHtml = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" onclick="setPortfolioAbsenceFilter('all')" style="padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; border: 1px solid #cbd5e1; background: ${currentAbsenceFilter === 'all' ? '#1e293b' : '#fff'}; color: ${currentAbsenceFilter === 'all' ? '#fff' : '#475569'};">
                    الكل (${d.absencesTimeline.length})
                </button>
                <button type="button" onclick="setPortfolioAbsenceFilter('unjustified')" style="padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; border: 1px solid #fecaca; background: ${currentAbsenceFilter === 'unjustified' ? '#dc2626' : '#fff'}; color: ${currentAbsenceFilter === 'unjustified' ? '#fff' : '#dc2626'};">
                    غير مبرر (${d.unjustifiedHours}س)
                </button>
                <button type="button" onclick="setPortfolioAbsenceFilter('justified')" style="padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; border: 1px solid #bbf7d0; background: ${currentAbsenceFilter === 'justified' ? '#16a34a' : '#fff'}; color: ${currentAbsenceFilter === 'justified' ? '#fff' : '#16a34a'};">
                    مبرر (${d.justifiedHours}س)
                </button>
                <button type="button" onclick="setPortfolioAbsenceFilter('late')" style="padding: 6px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer; border: 1px solid #fed7aa; background: ${currentAbsenceFilter === 'late' ? '#ea580c' : '#fff'}; color: ${currentAbsenceFilter === 'late' ? '#fff' : '#ea580c'};">
                    التأخرات (${d.lateCount})
                </button>
            </div>
        `;

        let rowsHtml = '';
        if (timeline.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 30px 15px; color: #166534; background: #f0fdf4;">
                        <span data-lucide="check-circle-2" data-size="32" style="color: #16a34a; margin-bottom: 6px;"></span>
                        <div style="font-weight: 800; font-size: 0.95rem;">سجل المواظبة نظيف تماماً في هذا التصنيف</div>
                        <div style="font-size: 0.76rem; color: #166534; margin-top: 2px;">التلميذ منضبط ولم تسجل بحقه غيابات غير مبررة.</div>
                    </td>
                </tr>
            `;
        } else {
            timeline.forEach((item, i) => {
                let badgeStyle = 'background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;';
                if (item.status === 'مبرر') {
                    badgeStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;';
                } else if (item.status === 'متأخر') {
                    badgeStyle = 'background: #ffedd5; color: #c2410c; border: 1px solid #fdba74;';
                }

                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 12px; font-weight: 700; color: #64748b; text-align: center;">${i + 1}</td>
                        <td style="padding: 10px 12px; font-weight: 800; color: #0f172a;">${item.date}</td>
                        <td style="padding: 10px 12px; font-size: 0.82rem; color: #334155;">${item.session || 'حصة عادية'}</td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span style="font-size: 0.74rem; font-weight: 800; padding: 3px 8px; border-radius: 999px; ${badgeStyle}">
                                ${item.status} ${item.duration > 0 ? `(${item.duration}س)` : ''}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; font-size: 0.8rem; color: #475569;">
                            ${escapeHtml(item.reason)}
                        </td>
                    </tr>
                `;
            });
        }

        bodyEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                            سجل الحصص المتغيب عنها والتأخرات المسجلة عبر العام الدراسي
                        </h4>
                        <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
                            توثيق زمني كامل لكل جلسة مع تبريراتها ومدة الغياب بالساعات.
                        </p>
                    </div>
                    ${filterButtonsHtml}
                </div>

                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 0.78rem; color: #475569;">
                                <th style="padding: 10px 12px; text-align: center; width: 40px;">#</th>
                                <th style="padding: 10px 12px;">التاريخ</th>
                                <th style="padding: 10px 12px;">الحصة والتوقيت</th>
                                <th style="padding: 10px 12px; text-align: center;">نوع الحالة والمدة</th>
                                <th style="padding: 10px 12px;">السند والتبرير البيداغوجي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * تبويب 3: سجل السلوك والملاحظات التربوية عبر العام
     */
    function renderPortfolioBehaviorTabContent(container) {
        const d = currentStudentPortfolioData;
        const beh = d.behaviorRecord;
        const notes = d.portfolioNotes || [];

        let notesHtml = '';
        if (notes.length === 0) {
            notesHtml = `
                <div style="text-align: center; padding: 25px; color: #64748b; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <span data-lucide="clipboard" data-size="28" style="color: #94a3b8; margin-bottom: 6px;"></span>
                    <div style="font-weight: 700; font-size: 0.88rem;">لا توجد ملاحظات تربوية إضافية مسجلة حتى الآن</div>
                    <div style="font-size: 0.76rem; color: #64748b; margin-top: 3px;">يمكنك إضافة ملاحظة أو توجيه خاص بملف الإنجاز باستخدام النموذج أدناه.</div>
                </div>
            `;
        } else {
            notesHtml = notes.map((n, i) => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-right: 4px solid #4f46e5; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div>
                        <div style="font-size: 0.74rem; color: #64748b; margin-bottom: 4px;">
                            ${n.date || 'تاريخ التسجيل'} • بواسطة: ${escapeHtml(n.author || 'أستاذ المادة')}
                        </div>
                        <div style="font-size: 0.88rem; color: #0f172a; font-weight: 700; line-height: 1.5;">
                            ${escapeHtml(n.text)}
                        </div>
                    </div>
                    <button type="button" onclick="deletePortfolioNote(${i})" style="background: transparent; border: none; color: #dc2626; cursor: pointer; padding: 3px;" title="حذف الملاحظة">
                        <span data-lucide="trash-2" data-size="14"></span>
                    </button>
                </div>
            `).join('');
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- بطاقة التقييم السلوكي الحالي والواجبات -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="shield-check" data-size="16" style="color: #10b981;"></span>
                            الحالة السلوكية والانضباط الصفي:
                        </h4>
                        <div style="font-size: 0.84rem; color: #334155; line-height: 1.6;">
                            الحالة الحالية: <strong style="color: #4f46e5;">${beh.status}</strong>
                            ${beh.note ? `<div style="background: #f8fafc; padding: 8px 10px; border-radius: 6px; margin-top: 6px; border: 1px solid #e2e8f0; font-size: 0.8rem; color: #1e293b;">"${escapeHtml(beh.note)}"</div>` : ''}
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="book-open" data-size="16" style="color: #f59e0b;"></span>
                            المواظبة على إنجاز الواجبات المنزلية:
                        </h4>
                        <div style="font-size: 0.84rem; color: #334155;">
                            مرات عدم إنجاز الواجب: <strong style="color: ${d.missedHomeworkCount > 0 ? '#dc2626' : '#10b981'};">${d.missedHomeworkCount} مرات</strong>
                            <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">
                                معدل الالتزام والجاهزية بالأنشطة المنزلية: <strong>${d.homeworkRate}%</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- قائمة الملاحظات والتوجيهات البيداغوجية عبر العام -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                    <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span>الملاحظات والتوجيهات المسجلة في ملف الإنجاز الرقمي:</span>
                        <span style="font-size: 0.74rem; color: #64748b;">${notes.length} ملاحظة مسجلة</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
                        ${notesHtml}
                    </div>

                    <!-- نموذج إضافة ملاحظة جديدة -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #334155; margin-bottom: 6px;">
                            إضافة ملاحظة بيداغوجية / توجيه تربوي إلى ملف الإنجاز:
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="portfolioNewNoteInput" placeholder="اكتب ملاحظة حول تقدم التلميذ، مشاركته، أو تعثراته المرصودة..." style="flex: 1; padding: 8px 12px; font-size: 0.82rem; border: 1px solid #cbd5e1; border-radius: 7px; outline: none;">
                            <button type="button" onclick="saveNewPortfolioNote()" style="background: #4f46e5; color: #fff; border: none; padding: 8px 16px; border-radius: 7px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                <span data-lucide="plus" data-size="14"></span> حفظ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * حفظ ملاحظة جديدة في ملف الإنجاز
     */
    function saveNewPortfolioNote() {
        const input = document.getElementById('portfolioNewNoteInput');
        if (!input) return;
        const text = input.value.trim();
        if (!text) {
            alert('يرجى كتابة نص الملاحظة.');
            return;
        }

        const d = currentStudentPortfolioData;
        if (!d) return;

        if (!window.db.portfolioNotes) window.db.portfolioNotes = {};
        if (!window.db.portfolioNotes[d.studentId]) window.db.portfolioNotes[d.studentId] = [];

        const dateStr = typeof window.formatLocalDate === 'function' ? window.formatLocalDate() : new Date().toISOString().split('T')[0];
        window.db.portfolioNotes[d.studentId].unshift({
            id: 'pnote_' + Date.now(),
            text,
            date: dateStr,
            author: (window.db.teacherProfile && window.db.teacherProfile.name) || 'أستاذ المادة'
        });

        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث الكاش وإعادة رسم التبويب
        d.portfolioNotes = window.db.portfolioNotes[d.studentId];
        renderPortfolioBehaviorTabContent(document.getElementById('portfolioTabBodyContent'));
        if (window.renderLucide) window.renderLucide();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تمت إضافة الملاحظة إلى ملف الإنجاز الرقمي بنجاح', 'success');
        }
    }
    window.saveNewPortfolioNote = saveNewPortfolioNote;

    /**
     * حذف ملاحظة من ملف الإنجاز
     */
    function deletePortfolioNote(index) {
        const d = currentStudentPortfolioData;
        if (!d || !window.db.portfolioNotes || !window.db.portfolioNotes[d.studentId]) return;

        if (!confirm('هل أنت متأكد من حذف هذه الملاحظة من ملف الإنجاز؟')) return;

        window.db.portfolioNotes[d.studentId].splice(index, 1);
        if (typeof window.saveDB === 'function') window.saveDB();

        d.portfolioNotes = window.db.portfolioNotes[d.studentId];
        renderPortfolioBehaviorTabContent(document.getElementById('portfolioTabBodyContent'));
        if (window.renderLucide) window.renderLucide();
    }
    window.deletePortfolioNote = deletePortfolioNote;

    /**
     * ====================================================================
     * منظومة المزامنة التلقائية لمهام ومواعيد ملف الإنجاز مع تقويم الهاتف (iCal)
     * ====================================================================
     */
    let currentIcalScope = 'student'; // 'student' | 'all'

    function setIcalSyncScope(scope) {
        currentIcalScope = scope;
        renderPortfolioIcalTabContent(document.getElementById('portfolioTabBodyContent'));
        if (window.renderLucide) window.renderLucide();
    }
    window.setIcalSyncScope = setIcalSyncScope;

    /**
     * استخراج وتوليد قائمة المهام والمواعيد المتزامنة لملف الإنجاز للتلميذ
     */
    function buildStudentPortfolioCalendarEvents(studentId, className) {
        const events = [];
        const seenIds = new Set();
        const stdObj = (window.db && window.db.classes && window.db.classes[className])
            ? window.db.classes[className].find(s => s.id === studentId)
            : null;
        const studentName = stdObj ? stdObj.name : 'التلميذ';

        // 1. الفروض المحروسة والامتحانات الرسمية من التقويم السنوي
        let milestones = [];
        if (typeof window.getAcademicMilestones === 'function') {
            milestones = window.getAcademicMilestones();
        } else if (window.db && Array.isArray(window.db.academicMilestones)) {
            milestones = window.db.academicMilestones;
        }

        milestones.forEach(ms => {
            const isExam = ms.category === 'exam' || ms.category === 'certification' || /فرض|امتحان/i.test(ms.title || '');
            const isMassarOrCouncil = ms.category === 'massar' || ms.category === 'council';
            if ((isExam || isMassarOrCouncil) && !seenIds.has(ms.id)) {
                seenIds.add(ms.id);
                events.push({
                    id: 'cal_' + ms.id,
                    studentId,
                    studentName,
                    className,
                    title: `${isExam ? '📝 فرض محروس' : '📌 محطة تقويمية'}: ${ms.title}`,
                    startDate: ms.startDate,
                    endDate: ms.endDate || ms.startDate,
                    allDay: true,
                    category: ms.category,
                    description: `المحطة: ${ms.title}\nالمستويات المعنية: ${ms.targetLevels || className}\nالتلميذ المعني بملف الإنجاز: ${studentName} (${className})\nتنبيه مسبق: يرجى التحقق من جاهزية أوراق الفرض وملف الإنجاز للتلاميذ المتغيبين والمتعثرين.`
                });
            }
        });

        // 2. حصص الدعم والاستدراك البيداغوجي المخصصة للتلميذ
        if (window.db && Array.isArray(window.db.tutoringStudents)) {
            const tutEnrollment = window.db.tutoringStudents.find(t => t.studentId === studentId && t.className === className);
            if (tutEnrollment) {
                // جلب حصص الدعم المسجلة في tutoringSessions
                if (Array.isArray(window.db.tutoringSessions)) {
                    window.db.tutoringSessions.forEach(ts => {
                        if (ts.className === className || ts.groupName || ts.date) {
                            const tutId = 'tut_sess_' + (ts.id || ts.date);
                            if (!seenIds.has(tutId) && ts.date) {
                                seenIds.add(tutId);
                                events.push({
                                    id: tutId,
                                    studentId,
                                    studentName,
                                    className,
                                    title: `🎓 حصة دعم واستدراك بيداغوجي: ${studentName}`,
                                    startDate: ts.date + (ts.startTime ? `T${ts.startTime}:00` : ''),
                                    endDate: ts.date + (ts.endTime ? `T${ts.endTime}:00` : ''),
                                    allDay: !ts.startTime,
                                    category: 'tutoring',
                                    description: `حصة دعم ومواكبة للمتعلم: ${studentName} (${className})\nالموضوع / محور الدعم: ${ts.topic || tutEnrollment.reason || 'معالجة الثغرات البيداغوجية والتعثرات'}`
                                });
                            }
                        }
                    });
                }
            }
        }

        // 3. تنبيه استدعاء ومقابلة ولي الأمر في حال الغياب المتكرر
        const d = currentStudentPortfolioData;
        if (d && d.totalAbsentHours >= 4) {
            const absId = 'alert_abs_' + studentId;
            if (!seenIds.has(absId)) {
                seenIds.add(absId);
                // تاريخ اليوم أو غداً كموعد للمتابعة
                const nowStr = typeof window.formatLocalDate === 'function' ? window.formatLocalDate() : new Date().toISOString().split('T')[0];
                events.push({
                    id: absId,
                    studentId,
                    studentName,
                    className,
                    title: `⚠️ متابعة غياب متكرر واستدعاء ولي الأمر: ${studentName}`,
                    startDate: nowStr,
                    endDate: nowStr,
                    allDay: true,
                    category: 'behavior',
                    description: `تنبيه ملف الإنجاز الرقمي:\nسجل التلميذ(ة) ${studentName} (${className}) غياباً متكرراً بلغ ${d.totalAbsentHours} ساعة (${d.unjustifiedHours}س غير مبررة).\nالمطلوب: التواصل مع الأسرة واستدعاء ولي الأمر لمعالجة أثر الانقطاع الدراسي قبل موعد الفروض.`
                });
            }
        }

        // 4. المهام والمواعيد المخصصة المحفوظة في ملف إنجاز التلميذ
        if (window.db && window.db.portfolioTasks && Array.isArray(window.db.portfolioTasks[studentId])) {
            window.db.portfolioTasks[studentId].forEach(task => {
                if (!seenIds.has(task.id)) {
                    seenIds.add(task.id);
                    events.push({
                        id: task.id,
                        studentId,
                        studentName,
                        className,
                        title: `📌 ${task.title}`,
                        startDate: task.date + (task.time ? `T${task.time}:00` : ''),
                        endDate: task.date + (task.time ? `T${task.time}:00` : ''),
                        allDay: !task.time,
                        category: task.category || 'custom',
                        description: `مهمة ملف الإنجاز الرقمي:\nالتلميذ: ${studentName} (${className})\nالتفاصيل: ${task.notes || task.title}\nالحالة: ${task.completed ? 'منجزة ✅' : 'قيد الانتظار ⏳'}`
                    });
                }
            });
        }

        return events;
    }

    /**
     * إرسال ومزامنة المهام والمواعيد إلى خادم التطبيق لإنعاش تقويم iCal الحي
     */
    async function syncStudentPortfolioToICalServer(studentId, className) {
        try {
            const events = buildStudentPortfolioCalendarEvents(studentId, className);
            const res = await fetch('/api/ical/sync-portfolio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, className, events })
            });
            if (res.ok) {
                console.log(`[iCal Sync] Successfully synced ${events.length} portfolio events to server.`);
                return true;
            }
        } catch (e) {
            console.warn('[iCal Sync] Server sync background warning:', e);
        }
        return false;
    }
    window.syncStudentPortfolioToICalServer = syncStudentPortfolioToICalServer;

    /**
     * الحصول على روابط المزامنة التلقائية لتقويم الهاتف
     */
    function getPortfolioWebCalUrls(studentId) {
        const isAll = currentIcalScope === 'all';
        const host = window.location.host;
        const protocol = window.location.protocol;
        const query = isAll ? '' : `?studentId=${encodeURIComponent(studentId)}`;
        
        const httpFeedUrl = `${protocol}//${host}/api/ical/portfolio-feed${query}`;
        const webcalUrl = `webcal://${host}/api/ical/portfolio-feed${query}`;
        const googleCalUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;
        const downloadUrl = `${protocol}//${host}/api/ical/portfolio-feed${query ? query + '&download=1' : '?download=1'}`;

        return { httpFeedUrl, webcalUrl, googleCalUrl, downloadUrl };
    }

    /**
     * الاشتراك الفوري بنقرة واحدة في تقويم الهاتف عبر WebCal (Apple / iPhone / Mac / Android)
     */
    function subscribeToPortfolioWebCal() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        // مزامنة أحدث المهام قبل إطلاق الاشتراك
        syncStudentPortfolioToICalServer(d.studentId, d.className);

        const { webcalUrl } = getPortfolioWebCalUrls(d.studentId);
        
        // محاولة فتح رابط بروتوكول webcal الذي يتفاعل معه تطبيق التقويم في iOS / macOS / Android مباشرة
        window.location.href = webcalUrl;

        if (typeof window.showNotification === 'function') {
            window.showNotification('جارٍ فتح تطبيق التقويم على هاتفك لإتمام الاشتراك وتفعيل التنبيهات...', 'success');
        }
    }
    window.subscribeToPortfolioWebCal = subscribeToPortfolioWebCal;

    /**
     * فتح صفحة إضافة التقويم في Google Calendar
     */
    function openPortfolioGoogleCalendarWeb() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        syncStudentPortfolioToICalServer(d.studentId, d.className);
        const { googleCalUrl } = getPortfolioWebCalUrls(d.studentId);
        window.open(googleCalUrl, '_blank');
    }
    window.openPortfolioGoogleCalendarWeb = openPortfolioGoogleCalendarWeb;

    /**
     * تنزيل ملف التقويم القياسي (.ics) مباشرة لفتحه في أي تطبيق
     */
    function downloadStudentPortfolioICS() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        syncStudentPortfolioToICalServer(d.studentId, d.className);
        const { downloadUrl } = getPortfolioWebCalUrls(d.studentId);
        
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `portfolio-tasks-${d.student.name}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم تحميل ملف تقويم iCal (.ics) بنجاح. يمكنك فتحه في أي تطبيق تقويم على هاتفك.', 'success');
        }
    }
    window.downloadStudentPortfolioICS = downloadStudentPortfolioICS;

    /**
     * نسخ رابط تقويم iCal الحي إلى الحافظة
     */
    function copyPortfolioWebCalUrl() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        const { httpFeedUrl } = getPortfolioWebCalUrls(d.studentId);
        navigator.clipboard.writeText(httpFeedUrl).then(() => {
            if (typeof window.showNotification === 'function') {
                window.showNotification('تم نسخ رابط تقويم iCal الحي إلى الحافظة بنجاح! 📋', 'success');
            } else {
                alert('تم نسخ رابط تقويم iCal الحي إلى الحافظة بنجاح!');
            }
        }).catch(() => {
            prompt('انسخ رابط تقويم iCal من هنا:', httpFeedUrl);
        });
    }
    window.copyPortfolioWebCalUrl = copyPortfolioWebCalUrl;

    /**
     * إضافة مهمة أو موعد جديد لملف الإنجاز الرقمي
     */
    function saveNewPortfolioTask() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        const titleInput = document.getElementById('portfolioNewTaskTitle');
        const dateInput = document.getElementById('portfolioNewTaskDate');
        const timeInput = document.getElementById('portfolioNewTaskTime');
        const catInput = document.getElementById('portfolioNewTaskCategory');
        const notesInput = document.getElementById('portfolioNewTaskNotes');

        if (!titleInput || !dateInput) return;

        const title = titleInput.value.trim();
        const date = dateInput.value.trim();
        const time = timeInput ? timeInput.value.trim() : '';
        const category = catInput ? catInput.value : 'custom';
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!title || !date) {
            alert('يرجى تحديد عنوان المهمة وتاريخ الموعد.');
            return;
        }

        if (!window.db.portfolioTasks) window.db.portfolioTasks = {};
        if (!window.db.portfolioTasks[d.studentId]) window.db.portfolioTasks[d.studentId] = [];

        const newTask = {
            id: 'ptask_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            title,
            date,
            time,
            category,
            notes,
            completed: false,
            createdAt: new Date().toISOString()
        };

        window.db.portfolioTasks[d.studentId].unshift(newTask);
        if (typeof window.saveDB === 'function') window.saveDB();

        // مزامنة فورية مع خادم iCal
        syncStudentPortfolioToICalServer(d.studentId, d.className);

        // تنظيف الحقول وإعادة الرسم
        titleInput.value = '';
        if (notesInput) notesInput.value = '';

        renderPortfolioIcalTabContent(document.getElementById('portfolioTabBodyContent'));
        if (window.renderLucide) window.renderLucide();

        if (typeof window.showNotification === 'function') {
            window.showNotification('تمت إضافة الموعد ومزامنته مع تقويم الهاتف بنجاح 📅', 'success');
        }
    }
    window.saveNewPortfolioTask = saveNewPortfolioTask;

    /**
     * حذف مهمة من ملف الإنجاز
     */
    function deletePortfolioTask(taskId) {
        const d = currentStudentPortfolioData;
        if (!d || !window.db.portfolioTasks || !window.db.portfolioTasks[d.studentId]) return;

        if (!confirm('هل أنت متأكد من حذف هذا الموعد من ملف الإنجاز؟')) return;

        window.db.portfolioTasks[d.studentId] = window.db.portfolioTasks[d.studentId].filter(t => t.id !== taskId);
        if (typeof window.saveDB === 'function') window.saveDB();

        syncStudentPortfolioToICalServer(d.studentId, d.className);

        renderPortfolioIcalTabContent(document.getElementById('portfolioTabBodyContent'));
        if (window.renderLucide) window.renderLucide();
    }
    window.deletePortfolioTask = deletePortfolioTask;

    /**
     * تبديل حالة إنجاز المهمة
     */
    function togglePortfolioTaskStatus(taskId) {
        const d = currentStudentPortfolioData;
        if (!d || !window.db.portfolioTasks || !window.db.portfolioTasks[d.studentId]) return;

        const target = window.db.portfolioTasks[d.studentId].find(t => t.id === taskId);
        if (target) {
            target.completed = !target.completed;
            if (typeof window.saveDB === 'function') window.saveDB();
            syncStudentPortfolioToICalServer(d.studentId, d.className);
            renderPortfolioIcalTabContent(document.getElementById('portfolioTabBodyContent'));
            if (window.renderLucide) window.renderLucide();
        }
    }
    window.togglePortfolioTaskStatus = togglePortfolioTaskStatus;

    /**
     * تبويب 4: المزامنة التلقائية مع تطبيق التقويم على هاتف الأستاذ (iCal Feed & Tasks)
     */
    function renderPortfolioIcalTabContent(container) {
        const d = currentStudentPortfolioData;
        if (!d) return;

        // مزامنة خلفية فورية مع خادم iCal
        syncStudentPortfolioToICalServer(d.studentId, d.className);

        const events = buildStudentPortfolioCalendarEvents(d.studentId, d.className);
        const { httpFeedUrl } = getPortfolioWebCalUrls(d.studentId);
        const todayStr = typeof window.formatLocalDate === 'function' ? window.formatLocalDate() : new Date().toISOString().split('T')[0];

        // بناء صفوف جدول المهام المجدولة
        let rowsHtml = '';
        if (events.length === 0) {
            rowsHtml = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 25px; color: #64748b; background: #f8fafc;">
                        لا توجد مواعيد أو مهام مجدولة حالياً. يمكنك إضافة مهمة جديدة باستخدام النموذج أدناه.
                    </td>
                </tr>
            `;
        } else {
            events.forEach((evt, idx) => {
                let catBadge = '';
                if (evt.category === 'exam') {
                    catBadge = '<span style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">فرض محروس</span>';
                } else if (evt.category === 'tutoring') {
                    catBadge = '<span style="background: #ffedd5; color: #ea580c; border: 1px solid #fdba74; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">دعم واستدراك</span>';
                } else if (evt.category === 'behavior') {
                    catBadge = '<span style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">متابعة غياب</span>';
                } else if (evt.category === 'massar' || evt.category === 'council') {
                    catBadge = '<span style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">مسار / مجالس</span>';
                } else {
                    catBadge = '<span style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">مهمة خاصة</span>';
                }

                const isCustom = evt.id.startsWith('ptask_');

                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                        <td style="padding: 10px 12px; font-weight: 700; color: #64748b; text-align: center;">${idx + 1}</td>
                        <td style="padding: 10px 12px;">
                            <div style="font-weight: 800; font-size: 0.86rem; color: #0f172a;">${escapeHtml(evt.title)}</div>
                            <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px; white-space: pre-line;">${escapeHtml(evt.description.split('\n')[0])}</div>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <div style="font-weight: 800; font-size: 0.82rem; color: #1e293b;">${evt.startDate.split('T')[0]}</div>
                            ${evt.startDate.includes('T') ? `<div style="font-size: 0.7rem; color: #64748b;">${evt.startDate.split('T')[1].substring(0, 5)}</div>` : '<div style="font-size: 0.7rem; color: #94a3b8;">طوال اليوم</div>'}
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            ${catBadge}
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span style="background: #ecfdf5; color: #059669; border: 1px solid #86efac; font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
                                <span data-lucide="bell" data-size="10"></span> قبل يومين (48س) + 24س
                            </span>
                            ${isCustom ? `
                                <button type="button" onclick="deletePortfolioTask('${evt.id}')" style="background: transparent; border: none; color: #dc2626; cursor: pointer; padding: 3px; margin-right: 6px;" title="حذف المهمة">
                                    <span data-lucide="trash-2" data-size="13"></span>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            });
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <!-- بطاقة الترحيب والتعريف بالمزامنة التلقائية عبر iCal -->
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 12px; padding: 18px 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.12); border: 1.5px solid #334155;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 46px; height: 46px; border-radius: 10px; background: linear-gradient(135deg, #0284c7, #2563eb); display: flex; align-items: center; justify-content: center; color: #fff; box-shadow: 0 3px 10px rgba(2, 132, 199, 0.4); flex-shrink: 0;">
                                <span data-lucide="calendar" data-size="24"></span>
                            </div>
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #fff;">
                                        المزامنة التلقائية لمهام ومواعيد ملف الإنجاز مع هاتف الأستاذ (iCal Feed)
                                    </h4>
                                    <span style="background: #10b981; color: #ffffff; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 999px;">
                                        بروتوكول iCal / WebCal حي
                                    </span>
                                </div>
                                <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: #cbd5e1; line-height: 1.5;">
                                    تتيح لك هذه الميزة الاشتراك التلقائي في تقويم هاتفك (Apple Calendar على iPhone، أو Google Calendar على Android) لتلقي تنبيهات وإشعارات دورية قبل يومين (48 ساعة) من أي فرض محروس، أو حصة استدراك، أو موعد هام خاص بالتلميذ.
                                </p>
                            </div>
                        </div>

                        <!-- محدد نطاق المزامنة -->
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
                            <span style="font-size: 0.74rem; color: #94a3b8; font-weight: 700;">نطاق المزامنة:</span>
                            <button type="button" onclick="setIcalSyncScope('student')" style="background: ${currentIcalScope === 'student' ? '#0284c7' : 'transparent'}; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
                                هذا التلميذ فقط (${escapeHtml(d.student.name.split(' ')[0])})
                            </button>
                            <button type="button" onclick="setIcalSyncScope('all')" style="background: ${currentIcalScope === 'all' ? '#0284c7' : 'transparent'}; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
                                جميع التلاميذ والأقسام
                            </button>
                        </div>
                    </div>

                    <!-- أزرار العمليات المباشرة للاشتراك بالهاتف -->
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12);">
                        <button type="button" onclick="subscribeToPortfolioWebCal()" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
                            <span data-lucide="smartphone" data-size="15"></span>
                            <span>اشتراك بنقرة واحدة في تقويم الهاتف (iPhone / iPad / Mac)</span>
                        </button>

                        <button type="button" onclick="openPortfolioGoogleCalendarWeb()" style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; padding: 9px 15px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span data-lucide="calendar-plus" data-size="15" style="color: #ea4335;"></span>
                            <span>إضافة إلى Google Calendar</span>
                        </button>

                        <button type="button" onclick="downloadStudentPortfolioICS()" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25); padding: 9px 15px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span data-lucide="download" data-size="15"></span>
                            <span>تنزيل ملف التقويم (.ics)</span>
                        </button>

                        <button type="button" onclick="copyPortfolioWebCalUrl()" style="background: rgba(255,255,255,0.1); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.2); padding: 9px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" title="نسخ رابط المزامنة الحية">
                            <span data-lucide="copy" data-size="15"></span>
                            <span>نسخ رابط iCal</span>
                        </button>
                    </div>
                </div>

                <!-- إرشادات التنبيهات المسبقة -->
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span data-lucide="bell-ring" data-size="20" style="color: #16a34a;"></span>
                        <div>
                            <strong style="color: #166534; font-size: 0.84rem;">نظام التنبيهات الذكي في تقويم هاتفك (RFC 5545 VALARM):</strong>
                            <div style="font-size: 0.76rem; color: #15803d; margin-top: 2px;">
                                يتضمن التقويم تنبيهاً أولياً <strong>قبل يومين (48 ساعة)</strong> من موعد الفرض، وتنبيهاً ثانياً <strong>قبل 24 ساعة</strong>، وتنبيهاً صباحياً في يوم الموعد.
                            </div>
                        </div>
                    </div>
                    <span style="font-size: 0.72rem; background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 6px; font-weight: 800;">
                        مفعل تلقائياً ✅
                    </span>
                </div>

                <!-- جدول المهام والمواعيد المتزامنة حالياً -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;">
                                قائمة المواعيد والمهام المجدولة للتزامن في تقويم الهاتف (${events.length} موعد):
                            </h4>
                            <p style="margin: 2px 0 0 0; font-size: 0.74rem; color: #64748b;">
                                يتم تحديث هذه القائمة آلياً في هاتفك بشكل مستمر دون الحاجة لإعادة التنزيل.
                            </p>
                        </div>
                        <span style="font-size: 0.72rem; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 6px;">
                            آخر مزامنة مع الخادم: الآن ✅
                        </span>
                    </div>

                    <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse; text-align: right; background: #ffffff;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-size: 0.76rem; color: #475569;">
                                    <th style="padding: 8px 10px; text-align: center; width: 35px;">#</th>
                                    <th style="padding: 8px 10px;">المهمة / الموعد البيداغوجي</th>
                                    <th style="padding: 8px 10px; text-align: center;">التاريخ والتوقيت</th>
                                    <th style="padding: 8px 10px; text-align: center;">التصنيف</th>
                                    <th style="padding: 8px 10px; text-align: center;">إعدادات التنبيه والإجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- نموذج إضافة مهمة / موعد استدراكي جديد لملف الإنجاز -->
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                        <span data-lucide="plus-circle" data-size="16" style="color: #0284c7;"></span>
                        إضافة موعد أو مهمة بيداغوجية مخصصة لملف إنجاز التلميذ:
                    </h4>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 3px;">عنوان الموعد / المهمة:</label>
                            <input type="text" id="portfolioNewTaskTitle" placeholder="مثال: موعد مقابلة ولي الأمر / اختبار استدراكي" style="width: 100%; padding: 7px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 3px;">تاريخ الموعد:</label>
                            <input type="date" id="portfolioNewTaskDate" value="${todayStr}" style="width: 100%; padding: 7px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 3px;">التوقيت (اختياري):</label>
                            <input type="time" id="portfolioNewTaskTime" style="width: 100%; padding: 7px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                        </div>

                        <div>
                            <label style="display: block; font-size: 0.74rem; font-weight: 700; color: #475569; margin-bottom: 3px;">التصنيف التربوي:</label>
                            <select id="portfolioNewTaskCategory" style="width: 100%; padding: 7px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; background: #fff;">
                                <option value="custom">مهمة عامة لملف الإنجاز</option>
                                <option value="exam">فرض أو اختبار تقويمي استدراكي</option>
                                <option value="tutoring">جلسة دعم ومواكبة فردية</option>
                                <option value="behavior">لقاء أو استدعاء ولي الأمر</option>
                                <option value="homework">تسليم واجبات أو بحث منزلي</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="portfolioNewTaskNotes" placeholder="ملاحظات وتفاصيل إضافية حول المهمة لتظهر في مفكرة التقويم..." style="flex: 1; padding: 7px 10px; font-size: 0.8rem; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
                        <button type="button" onclick="saveNewPortfolioTask()" style="background: #0284c7; color: #fff; border: none; padding: 7px 18px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <span data-lucide="calendar-plus" data-size="14"></span> حفظ وجدولة في التقويم
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * تبويب 5: المعاينة الرسمية للطباعة والتصدير (Printable A4 Portfolio Dossier)
     */
    function renderPortfolioPrintTabContent(container) {
        const d = currentStudentPortfolioData;
        const std = d.student;
        const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const teacherName = tp.name || 'أستاذ مادة الرياضيات';
        const academyName = tp.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const directorateName = tp.directorate || 'المديرية الإقليمية';
        const schoolName = tp.school || tp.institution || 'الثانوية التأهيلية';
        const academicYear = tp.academicYear || '2026-2027';
        const printFont = typeof window.getSelectedPrintFontFamily === 'function' ? window.getSelectedPrintFontFamily() : "'Cairo', 'Amiri', sans-serif";
        const hwFont = typeof window.getSelectedHandwritingFontFamily === 'function' ? window.getSelectedHandwritingFontFamily() : "'Aref Ruqaa', serif";

        container.innerHTML = `
            <div id="printableStudentPortfolioDoc" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 30px; font-family: ${printFont}; color: #0f172a; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <!-- ترويسة رسمية -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
                    <div style="font-size: 0.8rem; font-weight: 700; line-height: 1.5;">
                        <div>المملكة المغربية</div>
                        <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div>${escapeHtml(academyName)}</div>
                        <div>${escapeHtml(directorateName)}</div>
                        <div style="color: #1e3a8a;">المؤسسة: <strong>${escapeHtml(schoolName)}</strong></div>
                    </div>
                    <div style="text-align: center;">
                        <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #1e1b4b;">ملف الإنجاز الرقمي للتلميذ</h2>
                        <div style="font-size: 0.82rem; font-weight: 700; color: #4338ca; margin-top: 3px;">DOSSIER PÉDAGOGIQUE NUMÉRIQUE</div>
                        <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">الموسم الدراسي: ${escapeHtml(academicYear)}</div>
                    </div>
                    <div style="text-align: left; font-size: 0.8rem; line-height: 1.5;">
                        <div>مادة: <strong>الرياضيات</strong></div>
                        <div>الأستاذ(ة): <strong>${escapeHtml(teacherName)}</strong></div>
                        <div>القسم: <strong>${escapeHtml(d.className)}</strong></div>
                        <div>التاريخ: <strong>${new Date().toLocaleDateString('ar-MA')}</strong></div>
                    </div>
                </div>

                <!-- هوية التلميذ -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.85rem;">
                    <div>الاسم الكامل: <strong>${escapeHtml(std.name)}</strong></div>
                    <div>رقم مسار: <strong>${escapeHtml(std.massar || '-')}</strong></div>
                    <div>الترتيب باللائحة: <strong>${std.orderNum || '-'}</strong></div>
                    <div>المعدل السنوي: <strong style="color: ${d.annualAvg >= 10 ? '#10b981' : '#dc2626'};">${d.annualAvg !== null ? d.annualAvg.toFixed(2) : '-'} / 20</strong></div>
                    <div>نسبة المواظبة: <strong>${d.attendanceRate}%</strong></div>
                    <div>السلوك والانضباط: <strong>${d.behaviorRecord.status}</strong></div>
                </div>

                <!-- ملخص الفروض والنقط -->
                <div style="margin-bottom: 18px;">
                    <div style="font-weight: 800; font-size: 0.92rem; color: #1e1b4b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
                        أولاً: كشف نتائج فروض المراقبة المستمرة ومقارنتها بالقسم:
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: center; border: 1px solid #cbd5e1;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="border: 1px solid #cbd5e1; padding: 6px;">الفرض</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px;">الدورة</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px;">نقطة التلميذ</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px;">معدل القسم</th>
                                <th style="border: 1px solid #cbd5e1; padding: 6px;">التقدير والملاحظة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${d.examsData.map(e => `
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700;">${escapeHtml(e.title)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${escapeHtml(e.semester)}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 800;">${e.studentMark !== null ? e.studentMark.toFixed(2) : '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${e.classAvg !== null ? e.classAvg.toFixed(2) : '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 0.76rem;">${e.studentMark >= 10 ? 'متحكم' : (e.studentMark !== null ? 'في طور التحكم' : 'غير مسجل')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- حصيلة المواظبة والغياب -->
                <div style="margin-bottom: 18px;">
                    <div style="font-weight: 800; font-size: 0.92rem; color: #1e1b4b; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
                        ثانياً: حصيلة المواظبة والغيابات المرصودة:
                    </div>
                    <div style="font-size: 0.82rem; line-height: 1.6; color: #334155;">
                        • مجموع ساعات الغياب المسجلة: <strong>${d.totalAbsentHours} ساعة</strong> (${d.unjustifiedHours} غير مبررة + ${d.justifiedHours} مبررة).<br>
                        • عدد التأخرات المسجلة: <strong>${d.lateCount} مرات</strong>.<br>
                        • نسبة المواظبة العامة: <strong>${d.attendanceRate}%</strong>.
                    </div>
                </div>

                <!-- الملاحظة والتوصية البيداغوجية وتوقيع الأستاذ -->
                <div style="margin-top: 24px; border-top: 1.5px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="font-size: 0.84rem; max-width: 62%;">
                        <strong>✍️ توصية وملاحظة الأستاذ(ة) بخط اليد:</strong>
                        <div class="teacher-handwritten-note" style="margin-top: 6px; color: #1e3a8a; font-family: ${hwFont}; font-size: 1.02rem; line-height: 1.65; background: #fffbeb; border-right: 3px solid #f59e0b; padding: 6px 10px; border-radius: 6px;">
                            ${escapeHtml(d.behaviorRecord.note || 'تلميذ مواظب ومجتهد، مدعو لمواصلة التركيز ومراجعة الدروس بانتظام.')}
                        </div>
                    </div>
                    <div style="text-align: center; font-size: 0.84rem; min-width: 180px;">
                        <div>توقيع وتأشير الأستاذ(ة):</div>
                        <div class="signature-handwritten" style="margin-top: 8px; font-weight: 800; color: #1e3a8a; font-family: ${hwFont}; font-size: 1rem;">${escapeHtml(teacherName)}</div>
                        <div style="height: 35px; border-bottom: 1px dotted #94a3b8; margin-top: 8px;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * طباعة ملف الإنجاز الرسمي بصيغة A4 مع المعاينة والتحميل PDF
     */
    function printStudentPortfolioOfficial() {
        switchPortfolioTab('print');
        setTimeout(() => {
            const docEl = document.getElementById('printableStudentPortfolioDoc');
            if (docEl && typeof window.openCustomPrintPreviewModal === 'function') {
                const stdName = (currentStudentPortfolioData && currentStudentPortfolioData.student && currentStudentPortfolioData.student.name) || 'التلميذ';
                window.openCustomPrintPreviewModal(docEl.outerHTML, {
                    title: `ملف_الإنجاز_الرقمي_${stdName}`,
                    orientation: 'portrait',
                    subtitle: 'ملف الإنجاز والتتبع البيداغوجي الفردي للتلميذ في مادة الرياضيات (A4 / PDF)'
                });
                return;
            }
            if (docEl && typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(docEl.outerHTML, 'ملف الإنجاز الرقمي للتلميذ', 'portrait');
                return;
            }
            document.body.classList.add('printing-portfolio');
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-portfolio');
            }, 1000);
        }, 120);
    }
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-portfolio');
    });
    window.printStudentPortfolioOfficial = printStudentPortfolioOfficial;

    /**
     * مشاركة ملخص ملف الإنجاز عبر واتساب
     */
    function shareStudentPortfolioWhatsApp() {
        const d = currentStudentPortfolioData;
        if (!d) return;

        const std = d.student;
        const msg = 
            `📊 *ملف الإنجاز الرقمي للتلميذ(ة): ${std.name}*\n` +
            `• القسم: ${d.className}\n` +
            `• رقم مسار: ${std.massar || '-'}\n` +
            `• المعدل العام للمراقبة: ${d.annualAvg !== null ? d.annualAvg.toFixed(2) : '-'} / 20\n` +
            `• نسبة المواظبة: ${d.attendanceRate}%\n` +
            `• مجموع ساعات الغياب: ${d.totalAbsentHours}س (${d.unjustifiedHours} غير مبررة)\n` +
            `• إهمال الواجبات: ${d.missedHomeworkCount} مرات\n` +
            `• تقييم السلوك: ${d.behaviorRecord.status}\n` +
            `---\n` +
            `أستاذ مادة الرياضيات - الموسم الدراسي الحالي.`;

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
    window.shareStudentPortfolioWhatsApp = shareStudentPortfolioWhatsApp;

    /**
     * إنشاء هيكل نافذة ملف الإنجاز إذا لم تكن موجودة
     */
    function createPortfolioModalHtml() {
        if (document.getElementById('studentDigitalPortfolioModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'studentDigitalPortfolioModal';
        modalDiv.className = 'modal-backdrop-portfolio';
        modalDiv.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 11500; align-items: center; justify-content: center; padding: 12px; overflow-y: auto;';

        modalDiv.innerHTML = `
            <div class="card student-portfolio-modal-card" style="width: 100%; max-width: 1050px; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; padding: 0; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4); border: 1.5px solid #cbd5e1;">
                <!-- Modal Top Navigation Bar -->
                <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); color: #ffffff; padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6366f1;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; width: 36px; height: 36px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);">
                            <span data-lucide="folder-kanban" data-size="18"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #fff;">
                                ملف الإنجاز الرقمي الشامل للتلميذ (Student Digital Portfolio)
                            </h3>
                            <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #c7d2fe;">
                                تتبع تطور النتائج، منحنيات المراقبة المستمرة، سجل الغياب، والملاحظات السلوكية التربوية
                            </p>
                        </div>
                    </div>

                    <button type="button" onclick="closeStudentDigitalPortfolio()" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center;" title="إغلاق">
                        <span data-lucide="x" data-size="20"></span>
                    </button>
                </div>

                <!-- Modal Body Content -->
                <div style="padding: 18px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; background: #f8fafc;">
                    <!-- Student Identity Card & KPIs -->
                    <div id="portfolioStudentHeaderCard" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"></div>

                    <!-- Tabs Header -->
                    <div id="portfolioNavTabs" style="display: flex; gap: 6px; flex-wrap: wrap; background: #f1f5f9; padding: 6px; border-radius: 10px; border: 1px solid #e2e8f0;"></div>

                    <!-- Active Tab Content Container -->
                    <div id="portfolioTabBodyContent"></div>
                </div>

                <!-- Modal Footer -->
                <div style="padding: 10px 22px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.74rem; color: #64748b;">
                        * يتم تحديث ملف الإنجاز تلقائياً بمجرد إدخال النقط أو تسجيل الحضور والملاحظات.
                    </div>
                    <button type="button" onclick="closeStudentDigitalPortfolio()" style="padding: 7px 20px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
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

    // تصدير الدوال
    window.buildStudentPortfolioData = buildStudentPortfolioData;
    window.openStudentDigitalPortfolio = openStudentDigitalPortfolio;
    window.closeStudentDigitalPortfolio = closeStudentDigitalPortfolio;
    window.buildStudentPortfolioCalendarEvents = buildStudentPortfolioCalendarEvents;
    window.syncStudentPortfolioToICalServer = syncStudentPortfolioToICalServer;
    window.subscribeToPortfolioWebCal = subscribeToPortfolioWebCal;
    window.openPortfolioGoogleCalendarWeb = openPortfolioGoogleCalendarWeb;
    window.downloadStudentPortfolioICS = downloadStudentPortfolioICS;
    window.copyPortfolioWebCalUrl = copyPortfolioWebCalUrl;
    window.saveNewPortfolioTask = saveNewPortfolioTask;
    window.deletePortfolioTask = deletePortfolioTask;
    window.togglePortfolioTaskStatus = togglePortfolioTaskStatus;
    window.setIcalSyncScope = setIcalSyncScope;

    setTimeout(() => {
        createPortfolioModalHtml();
    }, 450);

})(window);
