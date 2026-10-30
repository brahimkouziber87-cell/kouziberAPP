/**
 * ====================================================================
 * وحدة الذكاء الاصطناعي لتحليل نتائج الفروض واقتراح خطة الدعم البيداغوجي المخصص
 * AI Math Exam Results Analysis & Customized Remediation Plan Engine
 * تركيز معمق على تشخيص المفاهيم والمواضيع الرياضية وصعوبات التعلم
 * ====================================================================
 */

(function (window) {
    'use strict';

    // قائمة المواضيع والمفاهيم الرياضية للمقررات المغربية حسب المستوى والأسدوس
    const MOROCCAN_MATH_CURRICULUM = {
        'tcs': {
            levelName: 'الجذع المشترك العلمي والتكنولوجي',
            s1: [
                'المجموعات والحسابيات في N والأعداد الأولية والزوجية',
                'الحساب العددي في R والمتطابقات الهامة والقوى والجذور',
                'الترتيب في R والمجالات والقيمة المطلقة والتأطير',
                'المستقيم في المستوى والشرط التحليلي للتوازي',
                'الحدوديات والتعميل بالقسمة الإقليدية وجذر حدودية',
                'المعادلات والمتراجحات والنظمات من الدرجة الأولى والثانية',
                'الحساب المثلثي (الدائرة المثلثية وقواعد التحويل)',
                'الإحصاء والميزات الكمية'
            ],
            s2: [
                'عموميات حول الدوال العددية (مجموعة التعريف، الزوجية، الرتابة)',
                'الحساب المتجهي في المستوى والاستقامة',
                'الإسقاط ومبرهنة طاليس المتجهية',
                'التحويلات الاعتيادية (الإزاحة والتحاكي والتماثل)',
                'الجداء السلمي وتطبيقاته في حساب المسافات والزوايا',
                'الهندسة الفضائية وتقاطع وتوازي المستقيمات والمستويات'
            ]
        },
        'tcl': {
            levelName: 'الجذع المشترك للآداب والعلوم الإنسانية',
            s1: [
                'الحساب العددي والعمليات في IR والنسب المئوية',
                'الترتيب في IR والمجالات والقيمة المطلقة والتأطير',
                'المعادلات والمتراجحات من الدرجة الأولى بمجهول واحد والنظمات',
                'الإحصاء وتنظيم المعطيات والمخططات البيانية'
            ],
            s2: [
                'عموميات حول الدوال العددية والدوال التآلفية',
                'دراسة دوال عددية بسيطة وقراءة التمثيلات المبيانية',
                'التعداد ومبادئ الاحتمالات في الحياة اليومية'
            ]
        },
        '1bac_sm': {
            levelName: 'الأولى باكالوريا علوم رياضية (SM)',
            s1: [
                'مبادئ في المنطق الرياضي وأنماط الاستدلال بالترجع والخلف',
                'المجموعات والتطبيقات والتقابل والتطبيق العكسي',
                'عموميات حول الدوال ومقارنتها ومركب دالتين',
                'المرجح في المستوى وتطبيقاته الهندسية والفيزيائية',
                'الجداء السلمي وتطبيقاته التحليلية ومعادلة الدائرة',
                'الحساب المثلثي وصيغ التحويل والمعادلات المثلثية المتقدمة'
            ],
            s2: [
                'الدوران في المستوى وحفاظ المسافات والزوايا',
                'المتتاليات العددية المتقدمة ومفهوم النهاية والتقارب',
                'نهايات الدوال ومبرهنات الحصر والترتيب',
                'الاشتقاق وتطبيقاته ومطاريف ورتابة دالة',
                'دراسة الدوال وتمثيلها المبياني والفروع اللانهائية',
                'الهندسة التحليلية في الفضاء والتمثيل البارامتري لمستقيم',
                'الحسابيات في Z والتعداد'
            ]
        },
        '1bac_exp': {
            levelName: 'الأولى باكالوريا علوم تجريبية وتكنولوجية',
            s1: [
                'مبادئ في المنطق الرياضي (الاستدلال بالخلف، التكافؤ، الترجع)',
                'عموميات حول الدوال العددية ومقارنتها ومركب دالتين',
                'المرجح في المستوى وتطبيقاته الإنشائية والحسابية',
                'الجداء السلمي وتطبيقاته التحليلية ومعادلة الدائرة',
                'الحساب المثلثي وصيغ التحويل وحل المعادلات المثلثية'
            ],
            s2: [
                'المتتاليات العددية (الحسابية والهندسية والرتابة والتقارب)',
                'نهايات الدوال العددية وحساب النهايات والأشكال غير المحددة',
                'الاشتقاق ودراسة الدوال وتطبيقات المشتقة والمماسات',
                'التمثيل المبياني للدوال وفروعها اللانهائية',
                'الهندسة التحليلية في الفضاء (الجداء السلمي ومعادلة المستوى)'
            ]
        },
        '2bac_sm': {
            levelName: 'الثانية باكالوريا علوم رياضية (SM-A / SM-B)',
            s1: [
                'النهايات والاتصال على مجال ومبرهنة القيم الوسيطية والدالة العكسية',
                'الاشتقاق ومبرهنة رول ومبرهنة التزايدات المنتهية TAF ودراسة الدوال',
                'المتتاليات العددية المتقدمة والمتتاليات المتجاورة وتقارب المتتاليات',
                'الدوال اللوغاريتمية (اللوغاريتم النبيري والأساس a)',
                'الدوال الأسية ودوال القوى وترييض المسائل',
                'الأعداد العقدية (البنية الجبرية والمثلثية وصيغتا أولير ودي موافر)'
            ],
            s2: [
                'الأعداد العقدية (التطبيقات الهندسية، التحويلات النقطية والتشابه)',
                'البنيات الجبرية: القوانين التركيبية والزمر والحلقات والأجسام',
                'الحسابيات في Z: مبرهنة بوزو، مبرهنة غوص، والتوافقات النمطية',
                'الحساب التكاملي والمكاملة بالأجزاء وتغيير المتغير والمعادلات التفاضلية',
                'حساب الاحتمالات وفضاء الاحتمالات والمتغيرات العشوائية وقانون بواسون'
            ]
        },
        '2bac_exp': {
            levelName: 'الثانية باكالوريا علوم تجريبية (PC / SVT)',
            s1: [
                'الاتصال والاشتقاق ومبرهنة القيم الوسيطية',
                'الدوال اللوغاريتمية (Ln) ونهاياتها ومشتقاتها وتمثيلها المبياني',
                'المتتاليات العددية وتقارب المتتاليات المرتبطة بدوال',
                'الدوال الأسية (Exp) وخصائصها وحل المعادلات والمتراجحات',
                'الأعداد العقدية (الجبرية والمثلثية والإخطاط والهندسة)'
            ],
            s2: [
                'الحساب التكاملي والدوال الأصلية وحساب المساحات والحجوم',
                'المعادلات التفاضلية من الرتبة الأولى والثانية',
                'الهندسة الفضائية والجداء السلمي والمتجهي وتطبيقات الفلكة',
                'الحساب الاحتمالي والمتغيرات العشوائية وقانون برنولي ذي الحدين'
            ]
        },
        '2bac_eco': {
            levelName: 'الثانية باكالوريا علوم اقتصادية وتدبير',
            s1: [
                'النهايات والاتصال ومبرهنة القيم الوسيطية',
                'الاشتقاق وتطبيقاته الاقتصادية (الدالة الهامشية والمرونة والربح الأقصى)',
                'المتتاليات العددية والرياضيات المالية والفوائد المركبة',
                'الدوال اللوغاريتمية (Ln) ودراسة الدوال'
            ],
            s2: [
                'الدوال الأسية (Exp) ونماذج النمو الاقتصادي',
                'الحساب التكاملي والدوال الأصلية وفائض المستهلك والمنتج',
                'التعداد وحساب الاحتمالات واتخاذ القرار',
                'الإحصاء بمتغيرين ومستقيم الانحدار الخطي'
            ]
        }
    };

    // الصعوبات الرياضية والأخطاء الديداكتيكية الشائعة المصنفة
    const COMMON_MATH_DIFFICULTIES = [
        { id: 'diff_limits_indet', label: 'صعوبة رفع الأشكال غير المحددة في النهايات وتطبيق المرافق والتعميل والتقنيات المقاربة' },
        { id: 'diff_continuity_tvi', label: 'الخلط في شروط مبرهنة القيم الوسيطية ورتابة الدالة والاتصال لإثبات وجود ووحدانية الحلول' },
        { id: 'diff_derivatives_chain', label: 'أخطاء في مشتقة مركب دالتين f(u) ومشتقة دالة المقلوب والجذر واللوغاريتم والأسية' },
        { id: 'diff_complex_geo', label: 'صعوبة التأويل الهندسي لمعيار وعمدة عدد عقدي والتحويلات النقطية (الدوران والتحاكي والإزاحة)' },
        { id: 'diff_recurrence_proof', label: 'ارتباك في صياغة الاستدلال بالترجع ومرحلة التحقق والافتراض وبرهان خاصية الرتبة n+1' },
        { id: 'diff_integration_parts', label: "أخطاء في اختيار الدوال u و v prime عند تطبيق المكاملة بالأجزاء وحساب المساحات والتكاملات" },
        { id: 'diff_prob_conditional', label: 'الخلط بين الاحتمال الشرطي P_B(A) وتقاطع الأحداث P(A∩B) وصيغة الاحتمالات الكلية' },
        { id: 'diff_space_vectors', label: 'صعوبة الانتقال من الهندسة المستوية إلى الفضاء وتحديد معادلات المستوى والتقاطعات' },
        { id: 'diff_arithmetic_congruence', label: 'صعوبة توظيف الحسابيات النمطية في Z ومبرهنة بوزو ومبرهنة غوص لحل المعادلات' }
    ];

    let _currentClassRemediationData = null;
    let _lastGeneratedPlanHtml = '';

    /**
     * استخراج المستوى المناسب من اسم القسم
     */
    function detectLevelKeyFromClassName(className) {
        if (!className) return 'tcs';
        const c = className.toLowerCase();
        if (c.includes('2bac') || c.includes('ثانية باك') || c.includes('2ème')) {
            if (c.includes('sm') || c.includes('رياضية') || c.includes('math')) return '2bac_sm';
            if (c.includes('eco') || c.includes('اقتصاد') || c.includes('tgc')) return '2bac_eco';
            return '2bac_exp';
        }
        if (c.includes('1bac') || c.includes('أولى باك') || c.includes('1ère')) {
            if (c.includes('sm') || c.includes('رياضية') || c.includes('math')) return '1bac_sm';
            return '1bac_exp';
        }
        if (c.includes('tcl') || c.includes('آداب') || c.includes('إنسانية') || c.includes('أدبي')) return 'tcl';
        if (c.includes('tc') || c.includes('tcs') || c.includes('tct') || c.includes('جذع') || c.includes('علمي') || c.includes('tronc')) return 'tcs';
        return 'tcs'; // الافتراضي هو الجذع المشترك العلمي
    }

    /**
     * حساب إحصائيات نقط الفروض للقسم وتحديد المتعثرين
     */
    function computeClassExamStats(className, semester) {
        const db = window.db;
        if (!db || !db.classes || !db.classes[className]) {
            return null;
        }

        const students = db.classes[className] || [];
        const examCount = (typeof window.getExamsCountForClass === 'function') 
            ? window.getExamsCountForClass(className) 
            : 3;

        let totalPoints = 0;
        let evaluatedCount = 0;
        let passCount = 0;
        let failCount = 0;
        let minGrade = 20;
        let maxGrade = 0;

        let exam1Sum = 0, exam1Count = 0;
        let exam2Sum = 0, exam2Count = 0;
        let exam3Sum = 0, exam3Count = 0;
        let exam4Sum = 0, exam4Count = 0;

        const evaluatedStudents = [];

        students.forEach(std => {
            const grades = (typeof window.getStudentGradesBySemester === 'function')
                ? window.getStudentGradesBySemester(className, std.id, semester)
                : {};

            const f1 = (grades.f1 !== undefined && grades.f1 !== '' && !isNaN(grades.f1)) ? parseFloat(grades.f1) : null;
            const f2 = (grades.f2 !== undefined && grades.f2 !== '' && !isNaN(grades.f2)) ? parseFloat(grades.f2) : null;
            const f3 = (grades.f3 !== undefined && grades.f3 !== '' && !isNaN(grades.f3)) ? parseFloat(grades.f3) : null;
            const f4 = (grades.f4 !== undefined && grades.f4 !== '' && !isNaN(grades.f4)) ? parseFloat(grades.f4) : null;

            if (f1 !== null) { exam1Sum += f1; exam1Count++; }
            if (f2 !== null) { exam2Sum += f2; exam2Count++; }
            if (f3 !== null && examCount >= 3) { exam3Sum += f3; exam3Count++; }
            if (f4 !== null && examCount === 4) { exam4Sum += f4; exam4Count++; }

            const avg = (typeof window.calculateSemesterAvg === 'function')
                ? window.calculateSemesterAvg(grades, examCount)
                : null;

            // حساب غياب التلميذ
            let absenceHours = 0;
            if (typeof window.getTotalAbsentHours === 'function') {
                absenceHours = window.getTotalAbsentHours(std.id, className);
            } else if (Array.isArray(db.records)) {
                db.records.forEach(r => {
                    if (r && r.className === className && r.studentId === std.id && (r.status === 'absent' || r.status === 'غائب' || r.status === 'مبرر')) {
                        absenceHours += (parseFloat(r.duration) || 1);
                    }
                });
            } else if (db.records && db.records[className] && db.records[className][std.id]) {
                const recs = db.records[className][std.id];
                Object.keys(recs).forEach(date => {
                    const r = recs[date];
                    if (r && (r.status === 'absent' || r.status === 'غائب' || r.status === 'مبرر')) {
                        absenceHours += (parseFloat(r.duration) || 1);
                    }
                });
            }

            if (avg !== null) {
                evaluatedCount++;
                totalPoints += avg;
                if (avg >= 10) passCount++;
                else failCount++;

                if (avg < minGrade) minGrade = avg;
                if (avg > maxGrade) maxGrade = avg;

                evaluatedStudents.push({
                    id: std.id,
                    name: std.name,
                    f1: f1 !== null ? f1.toFixed(2) : '-',
                    f2: f2 !== null ? f2.toFixed(2) : '-',
                    f3: f3 !== null ? f3.toFixed(2) : '-',
                    f4: f4 !== null ? f4.toFixed(2) : '-',
                    average: avg.toFixed(2),
                    absenceHours,
                    isStruggling: avg < 10,
                    isTop: avg >= 14
                });
            } else {
                evaluatedStudents.push({
                    id: std.id,
                    name: std.name,
                    f1: f1 !== null ? f1.toFixed(2) : '-',
                    f2: f2 !== null ? f2.toFixed(2) : '-',
                    f3: f3 !== null ? f3.toFixed(2) : '-',
                    f4: f4 !== null ? f4.toFixed(2) : '-',
                    average: '-',
                    absenceHours,
                    isStruggling: false,
                    isTop: false
                });
            }
        });

        const classAverage = evaluatedCount > 0 ? (totalPoints / evaluatedCount).toFixed(2) : '0.00';
        const successRate = evaluatedCount > 0 ? ((passCount / evaluatedCount) * 100).toFixed(1) + '%' : '0%';
        const failureRate = evaluatedCount > 0 ? ((failCount / evaluatedCount) * 100).toFixed(1) + '%' : '0%';

        const strugglingStudents = evaluatedStudents
            .filter(s => s.isStruggling)
            .sort((a, b) => parseFloat(a.average) - parseFloat(b.average));

        const topStudents = evaluatedStudents
            .filter(s => s.isTop)
            .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

        return {
            className,
            semester,
            totalStudents: students.length,
            evaluatedCount,
            classAverage: parseFloat(classAverage),
            successRate,
            failureRate,
            highestGrade: maxGrade > 0 ? maxGrade.toFixed(2) : '-',
            lowestGrade: evaluatedCount > 0 ? minGrade.toFixed(2) : '-',
            exam1Avg: exam1Count > 0 ? (exam1Sum / exam1Count).toFixed(2) : '-',
            exam2Avg: exam2Count > 0 ? (exam2Sum / exam2Count).toFixed(2) : '-',
            exam3Avg: exam3Count > 0 ? (exam3Sum / exam3Count).toFixed(2) : '-',
            exam4Avg: exam4Count > 0 ? (exam4Sum / exam4Count).toFixed(2) : '-',
            strugglingStudents,
            topStudents,
            allStudents: evaluatedStudents
        };
    }

    /**
     * فتح نافذة تحليل نتائج الفروض واقتراح خطة الدعم البيداغوجي المخصص
     */
    function openMathRemediationModal(targetClassName) {
        const modal = document.getElementById('mathRemediationAiModal');
        if (!modal) return;

        const lessonLogClassSelect = document.getElementById('lessonLogClassSelect');
        const classSelect = document.getElementById('classSelect');
        const className = targetClassName || (lessonLogClassSelect && lessonLogClassSelect.value) || (classSelect ? classSelect.value : Object.keys(window.db?.classes || {})[0]);
        const sem = window.activeSemester || 's1';

        if (!className || !window.db.classes || !window.db.classes[className]) {
            alert('يرجى تحديد قسم دراسي أولاً لتحليل نتائج فروضه.');
            return;
        }

        const stats = computeClassExamStats(className, sem);
        if (!stats) {
            alert('تعذر استخراج بيانات القسم المحدد.');
            return;
        }

        _currentClassRemediationData = stats;

        // تحديث عناصر الترويسة في النافذة
        const titleBadge = document.getElementById('mathRemediationClassBadge');
        if (titleBadge) {
            titleBadge.textContent = `${className} • ${sem === 's2' ? 'الدورة الثانية' : 'الدورة الأولى'}`;
        }

        const levelKey = detectLevelKeyFromClassName(className);
        const currInfo = MOROCCAN_MATH_CURRICULUM[levelKey] || MOROCCAN_MATH_CURRICULUM['tcs'];

        // تعبئة بطاقة مؤشرات الأداء السريعة
        const kpiAvg = document.getElementById('mathRemediationKpiAvg');
        if (kpiAvg) {
            kpiAvg.textContent = `${stats.classAverage} / 20`;
            kpiAvg.style.color = stats.classAverage >= 10 ? '#166534' : '#dc2626';
        }
        const kpiSuccess = document.getElementById('mathRemediationKpiSuccess');
        if (kpiSuccess) kpiSuccess.textContent = stats.successRate;
        const kpiStruggling = document.getElementById('mathRemediationKpiStruggling');
        if (kpiStruggling) kpiStruggling.textContent = `${stats.strugglingStudents.length} تلميذ (${stats.failureRate})`;
        const kpiTotal = document.getElementById('mathRemediationKpiTotal');
        if (kpiTotal) kpiTotal.textContent = `${stats.evaluatedCount} من ${stats.totalStudents} تلميذ`;

        // تعبئة مواضيع المقرر للأسدوس لاختيارها
        const topicsListEl = document.getElementById('mathRemediationTopicsList');
        if (topicsListEl) {
            const availableTopics = currInfo[sem] || currInfo['s1'];
            topicsListEl.innerHTML = availableTopics.map((t, idx) => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: #1e293b; background: #ffffff; padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer;">
                    <input type="checkbox" name="mathRemediationTopicChk" value="${escapeQuotes(t)}" checked style="accent-color: #2563eb; width: 16px; height: 16px;">
                    <span>${t}</span>
                </label>
            `).join('');
        }

        // تعبئة الصعوبات والأخطاء الشائعة
        const diffListEl = document.getElementById('mathRemediationDiffList');
        if (diffListEl) {
            diffListEl.innerHTML = COMMON_MATH_DIFFICULTIES.map((d, idx) => `
                <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.8rem; color: #475569; background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer;">
                    <input type="checkbox" name="mathRemediationDiffChk" value="${escapeQuotes(d.label)}" ${idx < 3 ? 'checked' : ''} style="accent-color: #dc2626; width: 15px; height: 15px; margin-top: 2px;">
                    <span>${d.label}</span>
                </label>
            `).join('');
        }

        // إعادة ضبط حاوية التقرير
        const reportContainer = document.getElementById('mathRemediationAiReportContainer');
        if (reportContainer) {
            reportContainer.innerHTML = `
                <div style="text-align: center; padding: 30px 10px; color: #64748b;">
                    <div style="font-size: 2.2rem; margin-bottom: 10px;">✨🤖</div>
                    <div style="font-weight: 800; font-size: 1rem; color: #1e293b; margin-bottom: 6px;">جاهز لتحليل نتائج فروض القسم بالذكاء الاصطناعي</div>
                    <div style="font-size: 0.84rem; max-width: 500px; margin: 0 auto 16px auto; line-height: 1.6;">
                        انقر على الزر أدناه لتشغيل محرك التحليل الديداكتيكي وتوليد خطة دعم بيداغوجي واستدراك مخصصة للقسم مع التركيز على المفاهيم الرياضية المتعثرة وتفييء المتعلمين.
                    </div>
                    <button type="button" class="btn-primary" onclick="window.runMathRemediationGeneration()" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; border: none; padding: 10px 24px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); cursor: pointer;">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="sparkles" data-size="18"></span></span>
                        <span>توليد خطة الدعم البيداغوجي المخصصة الآن</span>
                    </button>
                </div>
            `;
        }

        document.getElementById('mathRemediationActionsBar').style.display = 'none';

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إغلاق نافذة خطة الدعم
     */
    function closeMathRemediationModal() {
        const modal = document.getElementById('mathRemediationAiModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * تنفيذ توليد خطة الدعم عبر استدعاء API أو المحرك البيداغوجي
     */
    async function runMathRemediationGeneration() {
        if (!_currentClassRemediationData) return;

        const reportContainer = document.getElementById('mathRemediationAiReportContainer');
        const actionsBar = document.getElementById('mathRemediationActionsBar');

        if (reportContainer) {
            reportContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 10px;">
                    <div class="spinner" style="width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top: 4px solid #7c3aed; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px auto;"></div>
                    <div style="font-weight: 900; font-size: 1.1rem; color: #5b21b6; margin-bottom: 6px;">جاري تحليل نتائج الفروض بالذكاء الاصطناعي...</div>
                    <div style="font-size: 0.85rem; color: #64748b; line-height: 1.6;">
                        يتم تشخيص مؤشرات القسم، تفكيك صعوبات المفاهيم الرياضية، تفييء التلاميذ المتعثرين، واقتراح خطة معالجة ديداكتيكية متدرجة
                    </div>
                </div>
            `;
        }

        // جمع المواضيع المختارة
        const selectedTopics = [];
        document.querySelectorAll('input[name="mathRemediationTopicChk"]:checked').forEach(chk => {
            selectedTopics.push(chk.value);
        });

        // جمع الصعوبات المختارة
        const selectedDiffs = [];
        document.querySelectorAll('input[name="mathRemediationDiffChk"]:checked').forEach(chk => {
            selectedDiffs.push(chk.value);
        });

        const customDiffInput = document.getElementById('mathRemediationCustomDiffInput');
        if (customDiffInput && customDiffInput.value.trim()) {
            selectedDiffs.push(customDiffInput.value.trim());
        }

        const levelKey = detectLevelKeyFromClassName(_currentClassRemediationData.className);
        const levelName = (MOROCCAN_MATH_CURRICULUM[levelKey] && MOROCCAN_MATH_CURRICULUM[levelKey].levelName) || 'الجذع المشترك العلمي';

        const payload = {
            className: _currentClassRemediationData.className,
            level: levelName,
            subject: 'الرياضيات',
            examLabel: `فروض المراقبة المستمرة (${_currentClassRemediationData.semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول'})`,
            stats: {
                totalStudents: _currentClassRemediationData.totalStudents,
                evaluatedCount: _currentClassRemediationData.evaluatedCount,
                classAverage: _currentClassRemediationData.classAverage,
                successRate: _currentClassRemediationData.successRate,
                failureRate: _currentClassRemediationData.failureRate,
                highestGrade: _currentClassRemediationData.highestGrade,
                lowestGrade: _currentClassRemediationData.lowestGrade,
                exam1Avg: _currentClassRemediationData.exam1Avg,
                exam2Avg: _currentClassRemediationData.exam2Avg,
                exam3Avg: _currentClassRemediationData.exam3Avg,
                exam4Avg: _currentClassRemediationData.exam4Avg
            },
            strugglingStudents: _currentClassRemediationData.strugglingStudents.map(s => ({
                id: s.id,
                name: s.name,
                grade: s.average,
                f1: s.f1,
                f2: s.f2,
                f3: s.f3,
                f4: s.f4,
                absenceHours: s.absenceHours
            })),
            topStudents: _currentClassRemediationData.topStudents.map(s => ({
                id: s.id,
                name: s.name,
                grade: s.average
            })),
            mathTopics: selectedTopics.length > 0 ? selectedTopics : ['الاتصال والنهايات ودراسة الدوال العددية', 'المتتاليات العددية والبرهان بالترجع', 'الحساب المتجهي والجداء السلمي في المستوى والفضاء'],
            specificDifficulties: selectedDiffs.join(' • ')
        };

        try {
            const res = await fetch('/api/ai/analyze-exam-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error('فشل في الاتصال بمحرك الذكاء الاصطناعي');
            }

            const data = await res.json();
            const resultHtml = data.result || '';

            _lastGeneratedPlanHtml = resultHtml;
            window._lastGeneratedMathRemediationHtml = resultHtml;
            window.currentMathRemediationClass = _currentClassRemediationData.className;
            window.currentMathRemediationTopics = payload.mathTopics;
            window.currentMathRemediationStrugglingCount = payload.strugglingStudents.length;

            if (reportContainer) {
                reportContainer.innerHTML = `
                    <div class="math-remediation-report-wrapper" style="background: #ffffff; border-radius: 12px; padding: 4px;">
                        ${resultHtml}
                    </div>
                `;
            }

            if (actionsBar) {
                actionsBar.style.display = 'flex';
            }

            // تفعيل وتعبئة لوحة الجدولة الذكية في التقويم تلقائياً
            initRemediationSchedulePanel(payload.mathTopics);

            // حفظ الخطة في الذاكرة المحلية لقاعدة البيانات
            saveGeneratedPlanToDB(_currentClassRemediationData.className, _currentClassRemediationData.semester, payload, resultHtml);

            if (window.renderLucide) window.renderLucide();
        } catch (e) {
            console.error('Error generating AI math remediation:', e);
            if (reportContainer) {
                reportContainer.innerHTML = `
                    <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 18px; color: #991b1b; text-align: center;">
                        <div style="font-size: 1.8rem; margin-bottom: 6px;">⚠️</div>
                        <div style="font-weight: 800; font-size: 1rem; margin-bottom: 6px;">حدث خطأ أثناء الاتصال بمحرك الذكاء الاصطناعي</div>
                        <div style="font-size: 0.82rem; margin-bottom: 14px;">${e.message || 'يرجى التأكد من اتصال الإنترنت وإعادة المحاولة.'}</div>
                        <button type="button" class="btn-primary" onclick="window.runMathRemediationGeneration()" style="background: #dc2626; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
                            إعادة المحاولة 🔄
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * حفظ خطة الدعم في سجل قاعدة البيانات
     */
    function saveGeneratedPlanToDB(className, semester, payload, html) {
        if (!window.db) return;
        if (!window.db.mathRemediationPlans) {
            window.db.mathRemediationPlans = {};
        }

        const key = `${className}_${semester}`;
        window.db.mathRemediationPlans[key] = {
            id: 'plan_' + Date.now(),
            className,
            semester,
            createdAt: new Date().toISOString(),
            dateStr: new Date().toLocaleDateString('ar-MA'),
            stats: payload.stats,
            topics: payload.mathTopics,
            strugglingCount: payload.strugglingStudents.length,
            htmlContent: html
        };

        if (typeof window.saveDB === 'function') window.saveDB();
    }

    /**
     * طباعة التقرير البيداغوجي بصيغة رسمية A4
     */
    function printMathRemediationReport() {
        if (!_lastGeneratedPlanHtml) {
            alert('لا توجد خطة دعم مولدة حالياً للطباعة.');
            return;
        }

        const className = (_currentClassRemediationData && _currentClassRemediationData.className) || 'القسم';
        const sem = (_currentClassRemediationData && _currentClassRemediationData.semester === 's2') ? 'الأسدوس الثاني' : 'الأسدوس الأول';
        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || (window.db && window.db.profile && window.db.profile.name) || 'أستاذ مادة الرياضيات';
        const schoolName = (window.db && window.db.teacherProfile && window.db.teacherProfile.school) || (window.db && window.db.profile && window.db.profile.school) || 'المؤسسة التعليمية';

        const printHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>خطة الدعم البيداغوجي والاستدراك الرياضي - ${className}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page {
            size: A4 portrait;
            margin: 12mm 10mm;
        }
        body {
            font-family: 'Cairo', system-ui, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 0;
            margin: 0;
            line-height: 1.6;
            font-size: 10.5pt;
        }
        .official-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 14px;
        }
        .header-title {
            text-align: center;
            flex: 1;
        }
        .header-title h1 {
            margin: 0;
            font-size: 13.5pt;
            font-weight: 900;
            color: #1e3a8a;
        }
        .header-title h2 {
            margin: 4px 0 0 0;
            font-size: 10pt;
            font-weight: 700;
            color: #475569;
        }
        .report-body {
            width: 100%;
        }
        .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 28px;
            page-break-inside: avoid;
        }
        .signature-box {
            width: 45%;
            text-align: center;
            border-top: 1px dashed #94a3b8;
            padding-top: 8px;
            font-weight: 700;
            font-size: 10pt;
        }
        @media print {
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="official-header">
        <div style="font-size: 9pt; font-weight: 700; line-height: 1.4;">
            المملكة المغربية<br>
            وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
            الأكاديمية الجهوية للتربية والتكوين<br>
            المؤسسة: ${schoolName}
        </div>
        <div class="header-title">
            <h1>خطة الدعم البيداغوجي ومعالجة التعثرات في مادة الرياضيات</h1>
            <h2>تشخيص نتائج الفروض وتفييء المتعلمين (المذكرة 142-08) • ${className} • ${sem}</h2>
        </div>
        <div style="font-size: 9pt; font-weight: 700; text-align: left; line-height: 1.4;">
            الموسم الدراسي: 2026-2027<br>
            الأستاذ: ${teacherName}<br>
            المادة: الرياضيات<br>
            التاريخ: ${new Date().toLocaleDateString('ar-MA')}
        </div>
    </div>

    <div class="report-body">
        ${_lastGeneratedPlanHtml}
    </div>

    <div class="signature-section">
        <div class="signature-box">
            توقيع الأستاذ المؤطر:<br>
            <strong>${teacherName}</strong>
        </div>
        <div class="signature-box">
            تأشيرة السيد المفتش التربوي / الإدارة التربوية:<br>
            <strong>المعاينة والمصادقة</strong>
        </div>
    </div>
</body>
</html>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printHtml, `خطة الدعم البيداغوجي - ${className}`, 'portrait');
            return;
        }
        window.print();
    }

    /**
     * نسخ محتوى الخطة البيداغوجية
     */
    function copyMathRemediationText() {
        if (!_lastGeneratedPlanHtml) {
            alert('لا توجد خطة دعم مولدة حالياً للنسخ.');
            return;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = _lastGeneratedPlanHtml;
        const text = tempDiv.innerText || tempDiv.textContent;

        navigator.clipboard.writeText(text).then(() => {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ محتوى خطة الدعم البيداغوجي بنجاح 📋', 'success');
            } else {
                alert('تم نسخ محتوى خطة الدعم بنجاح إلى الحافظة.');
            }
        }).catch(() => {
            alert('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.');
        });
    }

    /**
     * تهيئة وتجهيز لوحة جدولة حصص الدعم في التقويم ودفتر النصوص
     */
    function initRemediationSchedulePanel(topics = []) {
        const panel = document.getElementById('mathRemediationSchedulePanel');
        if (!panel) return;

        const className = (_currentClassRemediationData && _currentClassRemediationData.className) || 'القسم';
        const badge = document.getElementById('remediationScheduleClassBadge');
        if (badge) {
            const strugglingCount = _currentClassRemediationData ? _currentClassRemediationData.strugglingStudents.length : 0;
            badge.textContent = `${className} • ${strugglingCount} متعلم مستهدف`;
        }

        // حساب مواعيد ذكية مقترحة قريبة (الأربعاء بعد الزوال والسبت صباحاً أو 3 أيام و 7 أيام)
        const d1 = new Date();
        d1.setDate(d1.getDate() + 3);
        const d1Str = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}`;

        const d2 = new Date();
        d2.setDate(d2.getDate() + 7);
        const d2Str = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`;

        const date1Input = document.getElementById('remediationSchedDate1');
        if (date1Input && !date1Input.value) date1Input.value = d1Str;

        const date2Input = document.getElementById('remediationSchedDate2');
        if (date2Input && !date2Input.value) date2Input.value = d2Str;

        const t1 = topics[0] || 'معالجة صعوبات الحساب الجبري ومبرهنة طاليس';
        const t2 = topics[1] || topics[0] || 'أنشطة توليفية وبيداغوجيا الأقران في الهندسة';

        const topic1Input = document.getElementById('remediationSchedTopic1');
        if (topic1Input && !topic1Input.value) topic1Input.value = `معالجة تعثرات: ${t1}`;

        const topic2Input = document.getElementById('remediationSchedTopic2');
        if (topic2Input && !topic2Input.value) topic2Input.value = `دعم تشاركي وتثبيت: ${t2}`;

        // إظهار اللوحة بانسيابية
        panel.style.display = 'block';
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * إظهار وتركيز لوحة الجدولة الذكية في التقويم
     */
    function scheduleRemediationSessionsInCalendar() {
        const panel = document.getElementById('mathRemediationSchedulePanel');
        if (!panel) return;

        initRemediationSchedulePanel(window.currentMathRemediationTopics || []);
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        panel.style.outline = '3px solid #10b981';
        setTimeout(() => { panel.style.outline = 'none'; }, 1500);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم فتح لوحة ضبط وتأكيد مواعيد حصص الدعم لجدولتها 📅', 'info');
        }
    }

    /**
     * تأكيد واعتماد جدولة حصص الدعم في التقويم ودفتر النصوص مع منع التكرار (Deduplication Guard)
     */
    let _isSchedulingRemediation = false;
    function confirmRemediationSessionsSchedule() {
        if (_isSchedulingRemediation) return;

        const className = (_currentClassRemediationData && _currentClassRemediationData.className) || 'القسم';
        const date1 = document.getElementById('remediationSchedDate1')?.value;
        const slot1 = document.getElementById('remediationSchedSlot1')?.value || '16:00 - 18:00';
        const topic1 = document.getElementById('remediationSchedTopic1')?.value?.trim() || 'حصة دعم ومعالجة تعثرات الرياضيات';

        const date2 = document.getElementById('remediationSchedDate2')?.value;
        const slot2 = document.getElementById('remediationSchedSlot2')?.value || '16:00 - 18:00';
        const topic2 = document.getElementById('remediationSchedTopic2')?.value?.trim() || 'حصة دعم وبيداغوجيا الأقران';

        const addToCalendar = document.getElementById('remediationSchedAddToCalendar')?.checked !== false;
        const addToLessonLog = document.getElementById('remediationSchedAddToLessonLog')?.checked !== false;

        if (!date1 && !date2) {
            alert('يرجى تحديد تاريخ حصة واحدة على الأقل لجدولتها.');
            return;
        }

        const btn = document.getElementById('btnConfirmRemediationSchedule');
        _isSchedulingRemediation = true;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>جاري التحقق والجدولة... ⏳</span>';
        }

        if (!window.db) window.db = {};
        if (!Array.isArray(window.db.calendarEvents)) window.db.calendarEvents = [];
        if (!window.db.lessonLogs) window.db.lessonLogs = {};
        if (!window.db.lessonLogs[className]) window.db.lessonLogs[className] = [];

        const strugglingNames = (_currentClassRemediationData?.strugglingStudents || []).map(s => s.name).join('، ') || 'المتعلمون المتعثرون';

        const sessionsToProcess = [];
        if (date1) {
            sessionsToProcess.push({
                num: 1,
                date: date1,
                slot: slot1,
                topic: topic1,
                desc: `حصة دعم ومعالجة تعثرات بيداغوجية لقسم (${className}) - المستهدفون: ${strugglingNames.substring(0, 80)}`
            });
        }
        if (date2) {
            sessionsToProcess.push({
                num: 2,
                date: date2,
                slot: slot2,
                topic: topic2,
                desc: `حصة دعم تشاركي وبيداغوجيا الأقران لقسم (${className}) في موضوع: ${topic2}`
            });
        }

        let addedCalendarCount = 0;
        let addedLessonLogCount = 0;
        let skippedCount = 0;

        sessionsToProcess.forEach(s => {
            // 1. فحص وتجنب تكرار العمليات في التقويم (Prevent Calendar Duplicates)
            if (addToCalendar) {
                const isCalDuplicate = window.db.calendarEvents.some(ev => 
                    ev && ev.date === s.date && (
                        (ev.title && ev.title.includes(className) && ev.title.includes('دعم')) ||
                        (ev.details && ev.details.includes(s.topic))
                    )
                );

                if (!isCalDuplicate) {
                    window.db.calendarEvents.push({
                        id: `ev_remed_${Date.now()}_${s.num}_${Math.random().toString(36).substring(2, 6)}`,
                        date: s.date,
                        time: s.slot.split('-')[0]?.trim() || '16:00',
                        title: `🎯 حصة دعم: ${s.topic} (${className})`,
                        type: 'task',
                        className: className,
                        details: s.desc,
                        createdAt: new Date().toISOString()
                    });
                    addedCalendarCount++;
                } else {
                    skippedCount++;
                }
            }

            // 2. فحص وتجنب تكرار العمليات في دفتر النصوص (Prevent Lesson Log Duplicates)
            if (addToLessonLog) {
                const logs = window.db.lessonLogs[className];
                const isLogDuplicate = logs.some(l => 
                    l && l.date === s.date && (
                        (l.timeSlot && l.timeSlot.replace(/\s+/g, '') === s.slot.replace(/\s+/g, '')) ||
                        (l.number && l.number.includes(s.topic)) ||
                        (l.summary && l.summary.includes(s.topic))
                    )
                );

                if (!isLogDuplicate) {
                    const nextSessionNum = logs.length + 1;
                    logs.push({
                        id: `log_remed_${Date.now()}_${s.num}_${Math.random().toString(36).substring(2, 6)}`,
                        sessionNum: String(nextSessionNum),
                        date: s.date,
                        timeSlot: s.slot,
                        duration: '2',
                        sessionType: 'soutien',
                        isExtraSession: true,
                        isRemedial: true,
                        outOfSchedule: true,
                        remedialReason: s.topic,
                        remedialBeneficiaries: strugglingNames.substring(0, 100),
                        number: `حصة دعم واستدراك: ${s.topic}`,
                        title: `المعالجة البيداغوجية وتفييء المتعلمين`,
                        axes: [
                            {
                                title: `تشخيص وتفكيك تعثرات: ${s.topic}`,
                                paragraphs: [
                                    { title: 'أنشطة تذكير ومعالجة ديداكتيكية', content: `معالجة الأخطاء الشائعة المرصودة في الفروض لتمكين المتعلمين من اكتساب الكفايات الأساسية.`, type: 'remediation' },
                                    { title: 'ورشة عمل وتطبيقات موجهة', content: `حل تمارين متدرجة الصعوبة بإشراف الأستاذ ومرافقة الأقران.`, type: 'application' }
                                ]
                            }
                        ],
                        summary: `حصة دعم بيداغوجي مبرمجة بناءً على تشخيص نتائج الفروض لمعالجة التعثرات في: ${s.topic}.`,
                        homework: 'أنشطة تقويم تكويني منزلي للتثبيت',
                        notes: 'تمت الجدولة والتوثيق آلياً عبر محرك خطة الدعم البيداغوجي الذكي',
                        updatedAt: new Date().toISOString()
                    });
                    addedLessonLogCount++;
                } else {
                    skippedCount++;
                }
            }
        });

        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث الواجهات الحية
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        if (typeof window.renderLessonLogs === 'function') window.renderLessonLogs();
        if (typeof window.updateLessonLogStats === 'function') window.updateLessonLogStats(className);

        setTimeout(() => {
            _isSchedulingRemediation = false;
            if (btn) {
                btn.disabled = false;
                btn.style.background = 'linear-gradient(135deg, #15803d, #166534)';
                btn.innerHTML = '<span data-lucide="check-circle" data-size="15"></span><span>تمت الجدولة والتوثيق بنجاح! ✅</span>';
                if (window.renderLucide) window.renderLucide();
            }

            let msg = `🎉 تم بنجاح اعتماد خطة الدعم لقسم (${className}):\n`;
            if (addedCalendarCount > 0) msg += `• تمت إضافة (${addedCalendarCount}) حصة في أجندة التقويم 📅\n`;
            if (addedLessonLogCount > 0) msg += `• تم توثيق (${addedLessonLogCount}) حصة دعم في دفتر النصوص 📖\n`;
            if (skippedCount > 0) msg += `• تم تفادي تكرار (${skippedCount}) عملية كانت مسجلة مسبقاً ✨`;

            if (typeof window.showAppToast === 'function') {
                window.showAppToast(msg, 'success');
            } else {
                alert(msg);
            }
        }, 350);
    }

    /**
     * بناء مستند PDF رسمي لخطة الدعم البيداغوجي (A4)
     * متاح للمعاينة والطباعة والنسخ في المعاينة الشاملة
     */
    function buildRemediationPdfHTML(className, options = {}) {
        const db = window.db || {};
        const safeClass = className || (typeof getSortedClasses === 'function' ? getSortedClasses()[0] : Object.keys(db.classes || {})[0]) || 'القسم';
        const semester = window.activeSemester || 's1';
        const semLabel = semester === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول';

        const header = (typeof window.buildOfficialMoroccanHeader === 'function')
            ? window.buildOfficialMoroccanHeader('خطة الدعم البيداغوجي ومعالجة التعثرات في مادة الرياضيات', safeClass, null, options)
            : `<div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 14px;">
                <h2 style="margin: 0; color: #1e3a8a;">خطة الدعم البيداغوجي ومعالجة التعثرات - ${safeClass}</h2>
                <div style="font-size: 0.85rem; color: #64748b;">${semLabel} • السنة الدراسية 2026-2027</div>
               </div>`;

        // إذا كانت هناك خطة سابقة مولدة بالذكاء الاصطناعي لنفس القسم
        const key = `${safeClass}_${semester}`;
        const savedPlan = (db.mathRemediationPlans && db.mathRemediationPlans[key]) ? db.mathRemediationPlans[key] : null;

        if (savedPlan && savedPlan.htmlContent) {
            return header + `
                <div class="remediation-saved-report" style="font-family: 'Cairo', system-ui, sans-serif; line-height: 1.6;">
                    ${savedPlan.htmlContent}
                </div>
            ` + (typeof window.buildOfficialVisasSection === 'function' ? window.buildOfficialVisasSection(options) : '');
        }

        if (_lastGeneratedPlanHtml && _currentClassRemediationData && _currentClassRemediationData.className === safeClass) {
            return header + `
                <div class="remediation-active-report" style="font-family: 'Cairo', system-ui, sans-serif; line-height: 1.6;">
                    ${_lastGeneratedPlanHtml}
                </div>
            ` + (typeof window.buildOfficialVisasSection === 'function' ? window.buildOfficialVisasSection(options) : '');
        }

        // في حال عدم توليد الخطة بالذكاء بعد، يتم توليد تقرير تركيبي بيداغوجي فوري عالي المعايير
        const stats = computeClassExamStats(safeClass, semester) || {
            classAverage: 11.2,
            successRate: '68%',
            failureRate: '32%',
            totalStudents: 34,
            evaluatedCount: 34,
            strugglingStudents: [],
            topStudents: []
        };

        const strugglingList = (stats.strugglingStudents && stats.strugglingStudents.length > 0)
            ? stats.strugglingStudents
            : [
                { name: 'تلميذ متعثر 1', average: '7.50', absenceHours: 2 },
                { name: 'تلميذ متعثر 2', average: '8.25', absenceHours: 4 },
                { name: 'تلميذ متعثر 3', average: '9.00', absenceHours: 0 }
            ];

        const topList = (stats.topStudents && stats.topStudents.length > 0)
            ? stats.topStudents
            : [
                { name: 'تلميذ متفوق (ميسر أقران 1)', average: '17.50' },
                { name: 'تلميذ متفوق (ميسر أقران 2)', average: '16.75' }
            ];

        const kpisHtml = (options.optStats !== false) ? `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; text-align: center; font-family: 'Cairo', system-ui, sans-serif;">
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">المعدل العام للقسم</div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">${stats.classAverage} / 20</div>
                </div>
                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #15803d; font-weight: 700;">نسبة التحكم والنجاح</div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #166534;">${stats.successRate}</div>
                </div>
                <div style="background: #fef2f2; border: 1.5px solid #fecaca; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #991b1b; font-weight: 700;">فئة الدعم ذات الأولوية</div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #dc2626;">${strugglingList.length} متعلم</div>
                </div>
                <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #1e40af; font-weight: 700;">التلاميذ الخاضعون للتقييم</div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #1d4ed8;">${stats.evaluatedCount} / ${stats.totalStudents}</div>
                </div>
            </div>
        ` : '';

        const strugglingRows = strugglingList.map((s, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 0.82rem; background: ${idx % 2 === 0 ? '#fff' : '#fef2f2'};">
                <td style="padding: 6px; text-align: center; font-weight: 800; color: #dc2626;">${idx + 1}</td>
                <td style="padding: 6px 10px; font-weight: 800; color: #0f172a;">${s.name}</td>
                <td style="padding: 6px; text-align: center; font-weight: 900; color: #dc2626; background: #fee2e2;">${s.average} / 20</td>
                <td style="padding: 6px; text-align: center; color: #64748b;">${s.absenceHours || 0} س</td>
                <td style="padding: 6px 10px; color: #475569;">صعوبة في الحساب الجبري وترييض المسائل والبرهان الهندسي</td>
                <td style="padding: 6px 10px; font-weight: 700; color: #166534;">ورشة دعم فارقي + بيداغوجيا الأقران</td>
            </tr>
        `).join('');

        return header + kpisHtml + `
            <div style="margin-bottom: 16px; font-family: 'Cairo', system-ui, sans-serif;">
                <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; margin-bottom: 6px;">
                    🎯 1. لائحة المتعلمين المستهدفين بالدعم الاستدراكي ذي الأولوية:
                </div>
                <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; margin-bottom: 14px;">
                    <thead>
                        <tr style="background: #f1f5f9; color: #334155; font-size: 0.8rem; border-bottom: 1.5px solid #cbd5e1;">
                            <th style="padding: 6px; width: 40px; text-align: center;">الرقم</th>
                            <th style="padding: 6px 10px; text-align: right;">الاسم الكامل للمتعلم(ة)</th>
                            <th style="padding: 6px; width: 90px; text-align: center;">المعدل المرصود</th>
                            <th style="padding: 6px; width: 75px; text-align: center;">الغياب</th>
                            <th style="padding: 6px 10px; text-align: right;">طبيعة التعثر الديداكتيكي المرصود</th>
                            <th style="padding: 6px 10px; text-align: right;">الصيغة العلاجية المعتمدة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${strugglingRows}
                    </tbody>
                </table>

                <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; margin-bottom: 6px;">
                    🗓️ 2. مخطط تنزيل حصص الدعم البيداغوجي المبرمجة في التقويم ودفتر النصوص:
                </div>
                <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; margin-bottom: 14px; font-size: 0.82rem;">
                    <thead>
                        <tr style="background: #1e3a8a; color: #ffffff;">
                            <th style="padding: 7px; width: 75px; text-align: center;">المحطة</th>
                            <th style="padding: 7px 10px; text-align: right;">الموضوع والمفاهيم المستهدفة</th>
                            <th style="padding: 7px 10px; width: 140px; text-align: center;">الصيغة البيداغوجية</th>
                            <th style="padding: 7px 10px; width: 150px; text-align: center;">الوسائل والمعينات</th>
                            <th style="padding: 7px 10px; width: 130px; text-align: center;">مؤشر تحقق الأثر</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid #cbd5e1;">
                            <td style="padding: 8px; text-align: center; font-weight: 800; color: #1e3a8a; background: #eff6ff;">حصة 1</td>
                            <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">معالجة الأخطاء الشائعة في الإشارات وتوحيد المقامات وتبسيط الجذور</td>
                            <td style="padding: 8px 10px; text-align: center;">ورشة فارقية موجهة بالسبورة والألواح</td>
                            <td style="padding: 8px 10px; text-align: center;">بطاقات علاجية متدرجة (Fiches Remédiation)</td>
                            <td style="padding: 8px 10px; text-align: center; color: #166534; font-weight: 700;">تحكم بنسبة 80% في الحساب</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
                            <td style="padding: 8px; text-align: center; font-weight: 800; color: #0284c7; background: #e0f2fe;">حصة 2</td>
                            <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">بيداغوجيا الأقران وحل وضعيات هندسية (مبرهنة طاليس وفيتاغورس)</td>
                            <td style="padding: 8px 10px; text-align: center;">عمل تشاركي في مجموعات غير متجانسة</td>
                            <td style="padding: 8px 10px; text-align: center;">مسائل توليفية تطبيقية وجداول توجيه</td>
                            <td style="padding: 8px 10px; text-align: center; color: #166534; font-weight: 700;">صياغة البرهان الرياضي الصحيح</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        ` + (typeof window.buildOfficialVisasSection === 'function' ? window.buildOfficialVisasSection(options) : '');
    }

    function escapeQuotes(str) {
        if (!str) return '';
        return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }


    // =========================================================================
    // نظام اقتراح أنشطة الدعم التربوي التلقائي والربط بجدول الحصص المبرمج
    // (Automated Pedagogical Support Recommendation & Programmed Timetable Sync)
    // =========================================================================
    
    let _activeAutoRemediationClass = null;
    let _activeAutoRemediationSemester = 's1';
    let _selectedRemediationActivityIdx = 0;

    function openAutoRemediationWithTimetableSync(targetClass = null, targetStudentId = null) {
        let classes = Object.keys(window.db?.classes || {});
        if (classes.length === 0) {
            alert('يرجى إضافة قسم واحد على الأقل أولاً لتشغيل نظام اقتراح أنشطة الدعم.');
            return;
        }

        let cls = targetClass;
        if (!cls || !classes.includes(cls)) {
            cls = window.currentClass || classes[0];
        }
        _activeAutoRemediationClass = cls;

        let modal = document.getElementById('autoRemediationTimetableModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'autoRemediationTimetableModal';
            modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.78); z-index: 10070; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 14px;';
            modal.innerHTML = `
                <div class="tt-sync-modal-card" style="max-width: 920px; width: 100%; max-height: 94vh; background: #ffffff; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45); border: 2px solid #cbd5e1;">
                    <!-- Modal Header -->
                    <div style="padding: 16px 22px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%); color: #ffffff; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; justify-content: center; color: #a5b4fc;">
                                <span data-lucide="sparkles" data-size="22"></span>
                            </span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                                    <span>نظام اقتراح أنشطة الدعم التربوي والربط بجدول الحصص</span>
                                    <span style="font-size: 0.72rem; background: #10b981; color: #ffffff; padding: 2px 8px; border-radius: 999px; font-weight: 800;">تلقائي ذكي 🎯</span>
                                </h3>
                                <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #c7d2fe;">
                                    تحليل نتائج المراقبة المستمرة للتلاميذ المتعثرين وتوليد أنشطة علاجية فارقية مع ربطها المباشر بجدول الحصص المبرمج
                                </p>
                            </div>
                        </div>
                        <button type="button" onclick="window.closeAutoRemediationWithTimetableSync()" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 34px; height: 34px; border-radius: 8px; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
                    </div>

                    <!-- Modal Body (Dynamic) -->
                    <div id="autoRemediationTimetableBody" style="padding: 18px 22px; overflow-y: auto; flex: 1; background: #f8fafc;">
                        <!-- يتم التوليد ديناميكياً -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        renderAutoRemediationContent(targetStudentId);
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }
    window.openAutoRemediationWithTimetableSync = openAutoRemediationWithTimetableSync;

    function closeAutoRemediationWithTimetableSync() {
        const modal = document.getElementById('autoRemediationTimetableModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeAutoRemediationWithTimetableSync = closeAutoRemediationWithTimetableSync;

    function renderAutoRemediationContent(highlightStudentId = null) {
        const body = document.getElementById('autoRemediationTimetableBody');
        if (!body) return;

        const cls = _activeAutoRemediationClass;
        const classes = Object.keys(window.db?.classes || {});
        const stats = computeClassExamStats(cls, _activeAutoRemediationSemester);

        const struggling = stats.strugglingStudents || [];
        const topStudents = stats.topStudents || [];
        const levelKey = detectLevelKeyFromClassName(cls);

        // مقترحات أنشطة الدعم البيداغوجي التلقائية المخصصة لمادة الرياضيات
        const suggestedActivities = [
            {
                id: 'act_remediation_diff',
                badge: 'ورشة علاجية فارقية',
                badgeColor: '#dc2626',
                badgeBg: '#fee2e2',
                icon: 'target',
                title: 'تفكيك العوائق الحسابية والجبرية وضبط قواعد الإشارات والتعميل',
                approach: 'بيداغوجيا فارقية ومجموعات عمل متجانسة وفق نوع التعثر المرصود',
                duration: 'ساعتان (حصة كاملة)',
                objective: 'تمكين المتعلمين المتعثرين من تملك تقنيات الحساب الجبري الدقيق وتفادي الأخطاء المتكررة في الإشارات وتبسيط الجذور وحل المعادلات.',
                targetedGroup: 'المتعثرون دون عتبة 8.00 / 20 (' + Math.max(1, Math.min(struggling.length, Math.ceil(struggling.length * 0.6))) + ' تلميذ)',
                materials: 'بطاقات علاجية متدرجة (Fiches Remédiation Auto-correctives)، سبورة تفاعلية، وألواح فردية للتحقق الفوري.',
                successMetric: 'تحقيق نسبة تحكم تفوق 75% في تمرين توليفي تطبيقي مباشر بنهاية الحصة.'
            },
            {
                id: 'act_peer_tutoring',
                badge: 'بيداغوجيا الأقران التشاركية',
                badgeColor: '#2563eb',
                badgeBg: '#dbeafe',
                icon: 'users',
                title: 'مرافقة تشاركية في الهندسة والبرهان الرياضي وحساب المثلثات',
                approach: 'ثنائيات بيداغوجية موجهة (تلميذ متفوق يرافق تلميذاً في طور التمكن)',
                duration: 'ساعة واحدة',
                objective: 'تطوير مهارة صياغة البرهان الرياضي الاستنتاجي السليم وتطبيق مبرهنة طاليس وحساب المتجهات من خلال التعلم بالأقران.',
                targetedGroup: 'المتعثرون ذوو النقط بين 8.00 و 9.75 بمرافقة المتفوقين (' + topStudents.length + ' متفوق مؤطر)',
                materials: 'وضعيات هندسية مدمجة، شبكة قيادة وملاحظة ثنائية، ومسطرة البرهان الرياضي خطوة بخطوة.',
                successMetric: 'قدرة المتعلم على صياغة برهان هندسي منظم من 3 خطوات منطقية دون مساعدة خارجية.'
            },
            {
                id: 'act_problem_modeling',
                badge: 'مختبر ترييض المسائل والنمذجة',
                badgeColor: '#059669',
                badgeBg: '#d1fae5',
                icon: 'compass',
                title: 'مختبر ترييض وضعيات واقعية وبناء الاستدلال والنمذجة الرياضية',
                approach: 'ورشة حل المسائل المفتوحة والتفكير الاستدلالي الجماعي',
                duration: 'ساعتان',
                objective: 'التدريب المنهجي على مراحل الترييض الأربع: قراءة وفهم السند ⬅️ اختيار المجهول ⬅️ صياغة المعادلة أو المتراجحة ⬅️ الحل والتأويل المنطقي.',
                targetedGroup: 'كافة المتعلمين المحتاجين لتثبيت مهارة الترييض وحل المسائل في القسم',
                materials: 'وضعيات-مسائل مستوحاة من البيئة اليومية، بطاقات دعم ديداكتيكية، ومعجم مصطلحات ترييضية.',
                successMetric: 'تمكن المتعلم من ترجمة نص مسألة واقعية إلى معادلة رياضية صحيحة بنجاح مستقل.'
            }
        ];

        // استخراج حصص جدول الحصص الأسبوعي للأستاذ
        const timetableSlots = [];
        const WORK_DAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        if (window.db && window.db.timetable) {
            WORK_DAYS.forEach(day => {
                const row = window.db.timetable[day];
                if (row && typeof row === 'object') {
                    // فحص الحصص الصباحية والمسائية
                    const slotsMap = [
                        { key: 'm1', time: row.m1_time || row.morningTime1 || '08:00', hrs: row.m1_hrs || 2, cls: row.m1_class || row.morningClass1 || '', room: row.m1_room || '' },
                        { key: 'm2', time: row.m2_time || row.morningTime2 || '10:00', hrs: row.m2_hrs || 2, cls: row.m2_class || row.morningClass2 || '', room: row.m2_room || '' },
                        { key: 'e1', time: row.e1_time || row.eveningTime1 || '13:00', hrs: row.e1_hrs || 2, cls: row.e1_class || row.eveningClass1 || '', room: row.e1_room || '' },
                        { key: 'e2', time: row.e2_time || row.eveningTime2 || '15:00', hrs: row.e2_hrs || 2, cls: row.e2_class || row.eveningClass2 || '', room: row.e2_room || '' }
                    ];

                    slotsMap.forEach(s => {
                        const isThisClass = (s.cls === cls);
                        const isEmpty = (!s.cls || s.cls.trim() === '');
                        if (isThisClass || isEmpty) {
                            timetableSlots.push({
                                day,
                                time: s.time,
                                hrs: s.hrs,
                                slotClass: s.cls,
                                isThisClass,
                                isEmpty,
                                room: s.room || 'قاعة الرياضيات'
                            });
                        }
                    });
                }
            });
        }

        // تاريخ مقترح قادم
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 3);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        body.innerHTML = `
            <!-- Top Selector Bar -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-size: 0.82rem; font-weight: 800; color: #1e293b;">القسم المستهدف:</label>
                        <select onchange="window.setAutoRemediationClass(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #2563eb; background: #f8fafc; font-weight: 800; font-size: 0.84rem; color: #1e40af;">
                            ${classes.map(c => `<option value="${c}" ${c === cls ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label style="font-size: 0.82rem; font-weight: 800; color: #1e293b;">الفترة التقويمية:</label>
                        <select onchange="window.setAutoRemediationSemester(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #f8fafc; font-weight: 800; font-size: 0.84rem; color: #334155;">
                            <option value="s1" ${_activeAutoRemediationSemester === 's1' ? 'selected' : ''}>الأسدس الأول (S1)</option>
                            <option value="s2" ${_activeAutoRemediationSemester === 's2' ? 'selected' : ''}>الأسدس الثاني (S2)</option>
                        </select>
                    </div>
                </div>

                <!-- Stats summary badge -->
                <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 800;">
                    <span style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 6px;">
                        ⚠️ ${struggling.length} متعلم بحاجة لدعم عاجل
                    </span>
                    <span style="background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px;">
                        معدل الفروض العام: ${stats.overallAverage} / 20
                    </span>
                </div>
            </div>

            <!-- Struggling Students Strip -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 18px;">
                <div style="font-size: 0.84rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span data-lucide="user-x" data-size="16" style="color: #ef4444;"></span>
                        <span>لائحة التلاميذ المتعثرين المستهدفين بأنشطة الدعم (${struggling.length} تلميذ):</span>
                    </span>
                    <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(المعدل أقل من 10 / 20 بناءً على الفروض المحروسة)</span>
                </div>

                ${struggling.length === 0 ? `
                    <div style="text-align: center; color: #16a34a; font-weight: 800; padding: 10px; font-size: 0.85rem;">
                        🎉 ما شاء الله! كافة تلاميذ قسم ${cls} مستوفون لعتبة النجاح في هذه الفترة التقويمية.
                    </div>
                ` : `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 110px; overflow-y: auto;">
                        ${struggling.map(s => {
                            const isHl = (highlightStudentId && s.id === highlightStudentId);
                            return `
                                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 6px; background: ${isHl ? '#fef08a' : '#fef2f2'}; border: 1.5px solid ${isHl ? '#ca8a04' : '#fecaca'}; font-size: 0.76rem; font-weight: 800; color: ${isHl ? '#854d0e' : '#991b1b'};">
                                    <span>${s.name}</span>
                                    <span style="background: ${isHl ? '#facc15' : '#fee2e2'}; color: ${isHl ? '#713f12' : '#b91c1c'}; padding: 1px 5px; border-radius: 4px; font-family: monospace;">${s.average.toFixed(2)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>

            <!-- 3 Proposed Pedagogical Activities Grid -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span data-lucide="layers" data-size="18" style="color: #4f46e5;"></span>
                    <span>الأنشطة البيداغوجية المقترحة تلقائياً لمعالجة التعثرات:</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 14px;">
                    ${suggestedActivities.map((act, idx) => {
                        return `
                            <div style="background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); transition: all 0.15s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                            <span style="background: ${act.badgeBg}; color: ${act.badgeColor}; border: 1px solid ${act.badgeColor}; padding: 2px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 900;">
                                                ${act.badge}
                                            </span>
                                            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">${act.duration}</span>
                                        </div>
                                        <h4 style="margin: 0; font-size: 0.98rem; font-weight: 900; color: #0f172a; line-height: 1.4;">
                                            ${act.title}
                                        </h4>
                                    </div>

                                    <!-- Link to Timetable Button -->
                                    <button type="button" 
                                        onclick="window.toggleActivityTimetableLinking('${act.id}', ${idx})"
                                        style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 10px rgba(37,99,235,0.25);"
                                        title="ربط هذا النشاط بحصة مبرمجة في جدول الحصص الأسبوعي">
                                        <span data-lucide="calendar" data-size="15"></span>
                                        <span>ربط بجدول الحصص المبرمج 📅</span>
                                    </button>
                                </div>

                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; line-height: 1.5; color: #334155; margin-bottom: 10px;">
                                    <div>
                                        <b style="color: #0f172a;">الهدف الإجرائي:</b> ${act.objective}
                                    </div>
                                    <div>
                                        <b style="color: #0f172a;">الصيغة البيداغوجية:</b> ${act.approach}
                                    </div>
                                    <div>
                                        <b style="color: #0f172a;">الفئة المستهدفة:</b> ${act.targetedGroup}
                                    </div>
                                    <div>
                                        <b style="color: #0f172a;">المعينات الديداكتيكية:</b> ${act.materials}
                                    </div>
                                </div>

                                <!-- Collapsible Timetable Linking Drawer for this activity -->
                                <div id="timetableDrawer_${act.id}" style="display: none; margin-top: 12px; background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 14px;">
                                    <div style="font-weight: 900; font-size: 0.86rem; color: #1e40af; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                        <span data-lucide="clock" data-size="16"></span>
                                        <span>تحديد حصة من جدول الحصص الأسبوعي للأستاذ لتثبيت هذا النشاط:</span>
                                    </div>

                                    ${timetableSlots.length === 0 ? `
                                        <div style="font-size: 0.8rem; color: #475569; margin-bottom: 10px;">
                                            لم يتم العثور على حصص مخصصة لقسم ${cls} في جدول الحصص. يمكنك اختيار تاريخ ووقت استدراكي حر:
                                        </div>
                                    ` : `
                                        <div style="font-size: 0.78rem; font-weight: 700; color: #334155; margin-bottom: 6px;">
                                            اختر الحصة المناسبة من جدول الحصص الأسبوعي:
                                        </div>
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-bottom: 12px;">
                                            ${timetableSlots.map((ts, sIdx) => `
                                                <label style="display: flex; align-items: center; gap: 8px; background: #ffffff; border: 1.5px solid ${ts.isThisClass ? '#3b82f6' : '#cbd5e1'}; border-radius: 8px; padding: 8px 10px; cursor: pointer; font-size: 0.8rem;">
                                                    <input type="radio" name="ttSlotRadio_${act.id}" value="${ts.day}_${ts.time}" ${sIdx === 0 ? 'checked' : ''} onchange="window.onAutoRemediationSlotSelected('${act.id}', '${ts.day}', '${ts.time}', '${ts.room}')">
                                                    <div>
                                                        <div style="font-weight: 800; color: #0f172a;">${ts.day}: ${ts.time} (${ts.hrs} س)</div>
                                                        <div style="font-size: 0.7rem; color: #64748b;">${ts.isThisClass ? 'حصة رسمية للقسم' : 'حصة دعم / شغور'} • ${ts.room}</div>
                                                    </div>
                                                </label>
                                            `).join('')}
                                        </div>
                                    `}

                                    <!-- Date and Details Form Row -->
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 12px;">
                                        <div>
                                            <label style="display: block; font-size: 0.74rem; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">تاريخ انعقاد الحصة:</label>
                                            <input type="date" id="ttSchedDate_${act.id}" value="${nextDateStr}" style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #93c5fd; background: #fff; font-size: 0.82rem; font-weight: 700; box-sizing: border-box;">
                                        </div>
                                        <div>
                                            <label style="display: block; font-size: 0.74rem; font-weight: 800; color: #1e3a8a; margin-bottom: 4px;">القاعة المخصصة:</label>
                                            <input type="text" id="ttSchedRoom_${act.id}" value="قاعة الرياضيات (S04)" style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1.5px solid #93c5fd; background: #fff; font-size: 0.82rem; font-weight: 700; box-sizing: border-box;">
                                        </div>
                                    </div>

                                    <!-- Confirm Schedule Action -->
                                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                                        <div style="display: flex; align-items: center; gap: 12px; font-size: 0.76rem; font-weight: 700; color: #1e40af;">
                                            <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                                                <input type="checkbox" id="ttSchedAddToLessonLog_${act.id}" checked>
                                                <span>تسجيل في دفتر النصوص 📖</span>
                                            </label>
                                            <label style="display: inline-flex; align-items: center; gap: 4px; cursor: pointer;">
                                                <input type="checkbox" id="ttSchedAddToCalendar_${act.id}" checked>
                                                <span>تسجيل في التقويم 📅</span>
                                            </label>
                                        </div>

                                        <button type="button" 
                                            onclick="window.confirmRemediationTimetableLink('${act.id}', '${escapeQuotes(act.title)}', '${escapeQuotes(act.objective)}', '${cls}')"
                                            style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 900; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 8px rgba(16,185,129,0.3);">
                                            <span data-lucide="check-circle" data-size="14"></span>
                                            <span>تأكيد وتثبيت الحصة في جدول الحصص ودفتر النصوص 💾</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        if (window.renderLucide) window.renderLucide(body);
    }

    function toggleActivityTimetableLinking(actId, idx) {
        const drawer = document.getElementById('timetableDrawer_' + actId);
        if (!drawer) return;
        const isVisible = drawer.style.display !== 'none';
        drawer.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (window.renderLucide) window.renderLucide(drawer);
    }
    window.toggleActivityTimetableLinking = toggleActivityTimetableLinking;

    function onAutoRemediationSlotSelected(actId, day, time, room) {
        const roomInp = document.getElementById('ttSchedRoom_' + actId);
        if (roomInp && room) roomInp.value = room;
    }
    window.onAutoRemediationSlotSelected = onAutoRemediationSlotSelected;

    function confirmRemediationTimetableLink(actId, title, objective, className) {
        const dateInput = document.getElementById('ttSchedDate_' + actId);
        const roomInput = document.getElementById('ttSchedRoom_' + actId);
        const addToLessonLog = document.getElementById('ttSchedAddToLessonLog_' + actId)?.checked !== false;
        const addToCalendar = document.getElementById('ttSchedAddToCalendar_' + actId)?.checked !== false;

        const dateVal = dateInput ? dateInput.value : '';
        const roomVal = roomInput ? roomInput.value : 'قاعة الرياضيات';

        if (!dateVal) {
            alert('يرجى تحديد تاريخ انعقاد حصة الدعم.');
            return;
        }

        if (!window.db) window.db = {};
        if (!window.db.lessonLogs) window.db.lessonLogs = {};
        if (!window.db.lessonLogs[className]) window.db.lessonLogs[className] = [];
        if (!Array.isArray(window.db.calendarEvents)) window.db.calendarEvents = [];

        // استخراج أسماء التلاميذ المتعثرين
        const stats = computeClassExamStats(className, _activeAutoRemediationSemester);
        const strugglingNames = (stats.strugglingStudents || []).map(s => s.name).join('، ') || 'المتعلمون المتعثرون في الفروض';

        // 1. تسجيل الحصة في دفتر النصوص
        if (addToLessonLog) {
            window.db.lessonLogs[className].push({
                id: 'log_remed_' + Date.now(),
                date: dateVal,
                session: 'حصة دعم بيداغوجي مبرمجة في جدول الحصص',
                subject: title,
                objectives: objective,
                content: `حصة معالجة تعثرات بيداغوجية مبرمجة لقسم (${className}) - القاعة: ${roomVal} • المستهدفون: ${strugglingNames.substring(0, 100)}`,
                type: 'remediation',
                room: roomVal,
                targetedStudents: strugglingNames,
                status: 'مكتملة ومبرمجة',
                createdAt: new Date().toISOString()
            });
        }

        // 2. تسجيل في تقويم المواعيد الرسمية
        if (addToCalendar) {
            window.db.calendarEvents.push({
                id: 'cal_remed_' + Date.now(),
                date: dateVal,
                time: '15:00',
                title: `🎯 حصة دعم مبرمجة: ${title} (${className})`,
                type: 'task',
                className: className,
                details: `حصة دعم ومعالجة تعثرات بيداغوجية مبرمجة - الأهداف: ${objective} - القاعة: ${roomVal}`,
                createdAt: new Date().toISOString()
            });
        }

        if (typeof window.saveToLocalStorage === 'function') window.saveToLocalStorage();
        if (typeof window.saveDB === 'function') window.saveDB();

        const successMsg = `تم بنجاح ربط وتثبيت حصة الدعم "${title}" لقسم ${className} في جدول الحصص ودفتر النصوص 📅✨`;
        if (typeof window.showNotification === 'function') {
            window.showNotification(successMsg, 'success');
        } else if (typeof window.showAppToast === 'function') {
            window.showAppToast(successMsg, 'success');
        } else if (typeof window.showToast === 'function') {
            window.showToast(successMsg, 'success');
        } else {
            alert(successMsg);
        }

        // إغلاق الدرج أو النافذة
        const drawer = document.getElementById('timetableDrawer_' + actId);
        if (drawer) {
            drawer.innerHTML = `
                <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 12px; text-align: center; color: #065f46;">
                    <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 4px;">✅ تم تثبيت الحصة في جدول الحصص ودفتر النصوص بنجاح!</div>
                    <div style="font-size: 0.78rem; margin-bottom: 8px;">التاريخ: ${dateVal} • القاعة: ${roomVal}</div>
                    <button type="button" onclick="window.printOfficialRemediationReportSheet('${className}', '${dateVal}', '${escapeQuotes(title)}', '${escapeQuotes(objective)}', '${roomVal}')" style="background: #10b981; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 0.78rem; cursor: pointer;">
                        طباعة محضر حصة الدعم التربوي المبرمجة 🖨️
                    </button>
                </div>
            `;
        }
    }
    window.confirmRemediationTimetableLink = confirmRemediationTimetableLink;

    function printOfficialRemediationReportSheet(className, sessionDate, title, objective, room) {
        const teacherName = (window.db?.teacherProfile?.name) || (window.db?.profile?.name) || 'أستاذ مادة الرياضيات';
        const schoolName = (window.db?.teacherProfile?.school) || (window.db?.profile?.school) || 'الثانوية التأهيلية';

        const stats = computeClassExamStats(className, _activeAutoRemediationSemester);
        const struggling = stats.strugglingStudents || [];

        const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>محضر إنجاز حصة دعم بيداغوجي واستدراك مبرمجة - ${className}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: 'Cairo', system-ui, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0; font-size: 11pt; line-height: 1.6; direction: rtl; }
        .official-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
        .official-header .side { font-size: 9.5pt; font-weight: 700; }
        .official-header .center { text-align: center; }
        .title { font-size: 14pt; font-weight: 900; color: #1e3a8a; margin: 0 0 4px 0; }
        .meta-box { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 10pt; line-height: 1.8; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 9.5pt; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
        th { background: #f1f5f9; font-weight: 800; }
        .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 35px; page-break-inside: avoid; }
        .sign-box { border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; min-height: 85px; font-weight: 800; }
    </style>
</head>
<body>
    <div class="official-header">
        <div class="side">
            المملكة المغربية<br>
            وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
            المؤسسة: ${schoolName}
        </div>
        <div class="center">
            <h2 class="title">محضر إنجاز حصة دعم بيداغوجي واستدراك مبرمجة</h2>
            <div style="font-size: 9.5pt; font-weight: 700; color: #475569;">مادة الرياضيات • السلك الثانوي التأهيلي (المذكرة 142-08)</div>
        </div>
        <div class="side" style="text-align: left;">
            الموسم الدراسي: ${(window.db && window.db.schoolYear) || '2026 / 2027'}<br>
            الأستاذ: ${teacherName}<br>
            تاريخ الطباعة: ${new Date().toLocaleDateString('ar-MA')}
        </div>
    </div>

    <div class="meta-box">
        <div>القسم المستفيد: <b>${className}</b> • تاريخ انعقاد الحصة: <b>${sessionDate}</b> • القاعة: <b>${room}</b></div>
        <div>موضوع الحصة: <b>${title}</b></div>
        <div>الهدف البيداغوجي الإجرائي: <b>${objective}</b></div>
        <div>السند التنظيمي: مندرجة ضمن جدول الحصص المبرمج وموثقة رسمياً في دفتر النصوص.</div>
    </div>

    <h4 style="margin: 0 0 8px 0; font-size: 10.5pt; font-weight: 800; color: #1e3a8a;">
        لائحة المتعلمين المستهدفين بحصة الدعم البيداغوجي:
    </h4>
    <table>
        <thead>
            <tr>
                <th style="width: 40px;">#</th>
                <th style="text-align: right;">اسم التلميذ(ة)</th>
                <th>معدل الفروض</th>
                <th>ساعات الغياب</th>
                <th>مؤشر التحقق والأثر بعد الدعم</th>
                <th>توقيع الحضور</th>
            </tr>
        </thead>
        <tbody>
            ${struggling.map((s, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td style="text-align: right; font-weight: 700;">${s.name}</td>
                    <td style="font-weight: 800; color: #dc2626;">${s.average.toFixed(2)}</td>
                    <td>${s.absenceHours || 0} س</td>
                    <td style="color: #166534; font-weight: 700;">تحكم وتملك للمفهوم ✅</td>
                    <td style="width: 90px;"></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="sign-grid">
        <div class="sign-box">
            توقيع وختم أستاذ مادة الرياضيات:<br><br>
            ${teacherName}
        </div>
        <div class="sign-box">
            تأشيرة الحراسة العامة / إدارة المؤسسة:<br><br>
            المعاينة والمصادقة
        </div>
    </div>
</body>
</html>`;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(html, 'محضر إنجاز حصة دعم بيداغوجي - ' + className, 'portrait');
        } else if (typeof window.printHtmlViaIframe === 'function') {
            window.printHtmlViaIframe(html);
        }
    }
    window.printOfficialRemediationReportSheet = printOfficialRemediationReportSheet;

    // تصدير الدوال إلى النطاق العالمي (window)
    window.renderAutoRemediationContent = renderAutoRemediationContent;
    window.setAutoRemediationClass = function (clsVal) {
        _activeAutoRemediationClass = clsVal;
        renderAutoRemediationContent();
    };
    window.setAutoRemediationSemester = function (semVal) {
        _activeAutoRemediationSemester = semVal;
        renderAutoRemediationContent();
    };
    window.openMathRemediationModal = openMathRemediationModal;
    window.closeMathRemediationModal = closeMathRemediationModal;
    window.runMathRemediationGeneration = runMathRemediationGeneration;
    window.printMathRemediationReport = printMathRemediationReport;
    window.copyMathRemediationText = copyMathRemediationText;
    window.scheduleRemediationSessionsInCalendar = scheduleRemediationSessionsInCalendar;
    window.initRemediationSchedulePanel = initRemediationSchedulePanel;
    window.confirmRemediationSessionsSchedule = confirmRemediationSessionsSchedule;
    window.buildRemediationPdfHTML = buildRemediationPdfHTML;
    window.computeClassExamStats = computeClassExamStats;

})(window);
