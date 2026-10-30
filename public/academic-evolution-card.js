/**
 * ====================================================================
 * بطاقة إحصائية: مؤشر تطور الأداء الدراسي وأبطال التقدم في النقط
 * Academic Performance Evolution Index & Top Improvers Hub
 * ====================================================================
 * تقوم بتحليل ورصد التغير في نقط الفروض المحروسة بين محطات الدورة
 * الواحدة (الفرض 1 ⬅️ الفرض 2 ⬅️ الفرض 3)، وتحديد مؤشر التقدم العام،
 * وإبراز التلاميذ أصحاب أكبر قفزة نوعية في النقط مع شهادات تقديرية.
 */

(function (window) {
    'use strict';

    // حالة بطاقة تطور الأداء
    const _evoState = {
        semester: 's1', // 's1' | 's2'
        classFilter: 'all', // 'all' | specific className
        examMode: 'f1_to_f2', // 'f1_to_f2' | 'f2_to_f3' | 'f_all'
        activeTab: 'top_improvers', // 'top_improvers' | 'full_roster' | 'support_needed'
        searchQuery: ''
    };

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
     * استخراج قائمة الأقسام المتاحة للمدرس
     */
    function getAvailableClasses() {
        if (window.db && window.db.classes) {
            return Object.keys(window.db.classes);
        }
        return [];
    }
    if (!window.getAvailableClasses) {
        window.getAvailableClasses = getAvailableClasses;
    }

    /**
     * استخراج بيانات النقط المتاحة لتلميذ بحسب الدورة ونوع المقارنة
     */
    function getStudentExamMarks(className, studentId, semester, examMode) {
        let grades = {};
        if (typeof window.getStudentGradesBySemester === 'function') {
            grades = window.getStudentGradesBySemester(className, studentId, semester) || {};
        } else if (window.db && window.db.grades && window.db.grades[className] && window.db.grades[className][studentId]) {
            const rec = window.db.grades[className][studentId];
            if (semester === 's2') {
                grades = rec.s2 || {};
            } else {
                grades = rec.s1 || { f1: rec.f1, f2: rec.f2, f3: rec.f3 };
            }
        }

        const parseMark = (v) => {
            if (v === undefined || v === null || v === '' || isNaN(v)) return null;
            const n = parseFloat(v);
            return (n >= 0 && n <= 20) ? n : null;
        };

        const f1 = parseMark(grades.f1);
        const f2 = parseMark(grades.f2);
        const f3 = parseMark(grades.f3);

        let m1 = null;
        let m2 = null;
        let label1 = 'الفرض 1';
        let label2 = 'الفرض 2';

        if (examMode === 'f2_to_f3') {
            m1 = f2;
            m2 = f3;
            label1 = 'الفرض 2';
            label2 = 'الفرض 3';
        } else if (examMode === 'f_all') {
            // مقارنة أول فرض تم تسجيله بآخر فرض مسجل
            const valid = [];
            if (f1 !== null) valid.push({ val: f1, label: 'الفرض 1' });
            if (f2 !== null) valid.push({ val: f2, label: 'الفرض 2' });
            if (f3 !== null) valid.push({ val: f3, label: 'الفرض 3' });

            if (valid.length >= 2) {
                m1 = valid[0].val;
                m2 = valid[valid.length - 1].val;
                label1 = valid[0].label;
                label2 = valid[valid.length - 1].label;
            }
        } else {
            // f1_to_f2 (الافتراضي)
            m1 = f1;
            m2 = f2;
            label1 = 'الفرض 1';
            label2 = 'الفرض 2';
        }

        return {
            hasBoth: (m1 !== null && m2 !== null),
            m1,
            m2,
            f1,
            f2,
            f3,
            label1,
            label2
        };
    }

    /**
     * استخراج كافة بيانات تطور الأداء لجميع التلاميذ والأقسام
     */
    function calculateAcademicEvolution() {
        const classes = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];
        const targetClasses = (_evoState.classFilter === 'all')
            ? classes
            : classes.filter(c => c === _evoState.classFilter);

        const evaluatedStudents = [];
        let totalStudentsCount = 0;

        targetClasses.forEach(className => {
            const studentList = window.db.classes[className] || [];
            totalStudentsCount += studentList.length;

            studentList.forEach(std => {
                const marksInfo = getStudentExamMarks(className, std.id, _evoState.semester, _evoState.examMode);
                if (marksInfo.hasBoth) {
                    const delta = Number((marksInfo.m2 - marksInfo.m1).toFixed(2));
                    let pct = 0;
                    if (marksInfo.m1 > 0) {
                        pct = Number((((marksInfo.m2 - marksInfo.m1) / marksInfo.m1) * 100).toFixed(1));
                    } else if (marksInfo.m2 > 0) {
                        pct = 100;
                    }

                    // تصنيف التطور
                    let category = 'stable';
                    let categoryLabel = 'استقرار نسبي';
                    let badgeColor = '#64748b';
                    let badgeBg = '#f1f5f9';

                    if (delta >= 3.0) {
                        category = 'exceptional';
                        categoryLabel = '🚀 قفزة استثنائية';
                        badgeColor = '#047857';
                        badgeBg = '#ecfdf5';
                    } else if (delta >= 1.0) {
                        category = 'notable';
                        categoryLabel = '📈 تحسن ملحوظ';
                        badgeColor = '#0284c7';
                        badgeBg = '#e0f2fe';
                    } else if (delta > 0) {
                        category = 'slight';
                        categoryLabel = '↗️ تقدم طفيف';
                        badgeColor = '#0d9488';
                        badgeBg = '#ccfbf1';
                    } else if (delta <= -1.0) {
                        category = 'critical_regression';
                        categoryLabel = '⚠️ تراجع حاد';
                        badgeColor = '#b91c1c';
                        badgeBg = '#fef2f2';
                    } else if (delta < 0) {
                        category = 'slight_regression';
                        categoryLabel = '↘️ تراجع طفيف';
                        badgeColor = '#ea580c';
                        badgeBg = '#fff7ed';
                    }

                    evaluatedStudents.push({
                        id: std.id,
                        name: std.name,
                        massarId: std.massar || std.massarId || '',
                        className,
                        m1: marksInfo.m1,
                        m2: marksInfo.m2,
                        label1: marksInfo.label1,
                        label2: marksInfo.label2,
                        delta,
                        pct,
                        category,
                        categoryLabel,
                        badgeColor,
                        badgeBg,
                        passedM1: marksInfo.m1 >= 10,
                        passedM2: marksInfo.m2 >= 10
                    });
                }
            });
        });

        const totalEvaluated = evaluatedStudents.length;

        // فرز التلاميذ
        const topImprovers = evaluatedStudents
            .filter(s => s.delta > 0)
            .sort((a, b) => b.delta - a.delta);

        const regressedStudents = evaluatedStudents
            .filter(s => s.delta < 0)
            .sort((a, b) => a.delta - b.delta);

        const stableStudents = evaluatedStudents.filter(s => s.delta === 0);

        // حساب المؤشرات المجمعة
        let sumDelta = 0;
        let sumM1 = 0;
        let sumM2 = 0;
        let passCountM1 = 0;
        let passCountM2 = 0;

        evaluatedStudents.forEach(s => {
            sumDelta += s.delta;
            sumM1 += s.m1;
            sumM2 += s.m2;
            if (s.passedM1) passCountM1++;
            if (s.passedM2) passCountM2++;
        });

        const avgDelta = totalEvaluated > 0 ? Number((sumDelta / totalEvaluated).toFixed(2)) : 0;
        const avgM1 = totalEvaluated > 0 ? Number((sumM1 / totalEvaluated).toFixed(2)) : 0;
        const avgM2 = totalEvaluated > 0 ? Number((sumM2 / totalEvaluated).toFixed(2)) : 0;
        const improversRate = totalEvaluated > 0 ? Number(((topImprovers.length / totalEvaluated) * 100).toFixed(1)) : 0;
        const regressedRate = totalEvaluated > 0 ? Number(((regressedStudents.length / totalEvaluated) * 100).toFixed(1)) : 0;
        const passRateM1 = totalEvaluated > 0 ? Number(((passCountM1 / totalEvaluated) * 100).toFixed(1)) : 0;
        const passRateM2 = totalEvaluated > 0 ? Number(((passCountM2 / totalEvaluated) * 100).toFixed(1)) : 0;
        const passRateDiff = Number((passRateM2 - passRateM1).toFixed(1));

        return {
            totalStudentsCount,
            totalEvaluated,
            evaluatedStudents,
            topImprovers,
            regressedStudents,
            stableStudents,
            avgDelta,
            avgM1,
            avgM2,
            improversCount: topImprovers.length,
            improversRate,
            regressedCount: regressedStudents.length,
            regressedRate,
            stableCount: stableStudents.length,
            passRateM1,
            passRateM2,
            passRateDiff,
            maxImprover: topImprovers.length > 0 ? topImprovers[0] : null
        };
    }

    /**
     * تحديث بطاقة KPI المصغرة في شبكة لوحة القيادة العلوية
     */
    function updateDashboardKpiMiniCard(data) {
        const kpiCard = document.getElementById('dashKpiAcademicEvolutionCard');
        if (!kpiCard) return;

        const countEl = document.getElementById('dashKpiEvolutionAvgDelta');
        const badgeEl = document.getElementById('dashKpiEvolutionBadge');
        const textEl = document.getElementById('dashKpiEvolutionText');
        const subEl = document.getElementById('dashKpiEvolutionSub');

        if (countEl) {
            const prefix = data.avgDelta > 0 ? '+' : '';
            countEl.textContent = `${prefix}${data.avgDelta}`;
            countEl.style.color = data.avgDelta >= 0 ? '#047857' : '#b91c1c';
        }

        if (textEl) {
            if (data.totalEvaluated === 0) {
                textEl.textContent = 'بانتظار رصد الفروض';
            } else {
                textEl.textContent = `${data.improversRate}% في مسار تصاعدي`;
            }
        }

        if (subEl) {
            if (data.maxImprover) {
                subEl.textContent = `أكبر تقدم: ${data.maxImprover.name} (+${data.maxImprover.delta} ن)`;
            } else {
                subEl.textContent = `مقارنة نتائج الدورة ${_evoState.semester === 's2' ? '2' : '1'}`;
            }
        }

        if (badgeEl) {
            if (data.avgDelta > 0) {
                badgeEl.style.background = '#ecfdf5';
                badgeEl.style.color = '#047857';
                badgeEl.style.borderColor = '#a7f3d0';
            } else if (data.avgDelta < 0) {
                badgeEl.style.background = '#fef2f2';
                badgeEl.style.color = '#b91c1c';
                badgeEl.style.borderColor = '#fecaca';
            }
        }
    }

    /**
     * تعبئة بيانات نموذجية تجريبية للنقط لتسهيل المعاينة
     */
    function seedDemoAcademicEvolutionGrades() {
        if (!window.db) return;
        if (!confirm('هل تريد ملء نقط نموذجية واقعية للفرضين 1 و 2 للأقسام لمعاينة مؤشر تطور الأداء ولوحة الشرف؟')) {
            return;
        }

        if (!window.db.classes || Object.keys(window.db.classes).length === 0) {
            // إنشاء قسمين تجريبيين بالسلك الثانوي التأهيلي لمادة الرياضيات إذا لم تكن هناك أقسام
            window.db.classes = {
                '2 باك علوم رياضية (2BAC-SM)': [
                    { id: '1', name: 'أحمد العلمي الفاسي', massarId: 'G130012345' },
                    { id: '2', name: 'مريم التازي العمراني', massarId: 'G130012346' },
                    { id: '3', name: 'ياسين بنجلون الإدريسي', massarId: 'G130012347' },
                    { id: '4', name: 'فاطمة الزهراء الصقلي', massarId: 'G130012348' },
                    { id: '5', name: 'حمزة الوردي المنصوري', massarId: 'G130012349' },
                    { id: '6', name: 'زينب برادة الفيلالي', massarId: 'G130012350' },
                    { id: '7', name: 'عمر الخمليشي الحسني', massarId: 'G130012351' },
                    { id: '8', name: 'سارة أيت علي أوبلا', massarId: 'G130012352' },
                    { id: '9', name: 'مهدي القباج المرابط', massarId: 'G130012353' },
                    { id: '10', name: 'هبة بوشعيب الشرايبي', massarId: 'G130012354' }
                ],
                '1 باك علوم تجريبية (1BAC-SE)': [
                    { id: '11', name: 'أيوب السبتي التلمساني', massarId: 'G130022341' },
                    { id: '12', name: 'ابتسام الناصري الإبراهيمي', massarId: 'G130022342' },
                    { id: '13', name: 'رضا بنسودة العلوي', massarId: 'G130022343' },
                    { id: '14', name: 'سلمى الشرقاوي اليعقوبي', massarId: 'G130022344' },
                    { id: '15', name: 'أنس المحمدي القادري', massarId: 'G130022345' }
                ]
            };
        }

        if (!window.db.grades) window.db.grades = {};

        const sampleProfiles = [
            { f1: 8.5, f2: 15.0, f3: 16.5 },  // تقدم هائل +6.5
            { f1: 9.0, f2: 14.5, f3: 15.0 },  // تقدم هائل +5.5
            { f1: 11.0, f2: 15.5, f3: 17.0 }, // تقدم ملحوظ +4.5
            { f1: 10.5, f2: 14.0, f3: 15.5 }, // تقدم ملحوظ +3.5
            { f1: 7.5, f2: 10.5, f3: 12.0 },  // تقدم +3.0 (تجاوز العتبة)
            { f1: 13.0, f2: 15.0, f3: 16.0 }, // تقدم +2.0
            { f1: 12.5, f2: 13.5, f3: 14.0 }, // تحسن +1.0
            { f1: 14.0, f2: 14.0, f3: 14.5 }, // استقرار
            { f1: 11.5, f2: 10.5, f3: 11.0 }, // تراجع طفيف -1.0
            { f1: 13.0, f2: 10.0, f3: 9.5 }   // تراجع حاد -3.0
        ];

        Object.keys(window.db.classes).forEach(cls => {
            if (!window.db.grades[cls]) window.db.grades[cls] = {};
            const students = window.db.classes[cls];
            students.forEach((s, idx) => {
                const profile = sampleProfiles[idx % sampleProfiles.length];
                window.db.grades[cls][s.id] = {
                    s1: { f1: profile.f1, f2: profile.f2, f3: profile.f3 },
                    s2: { f1: profile.f1 + 0.5, f2: profile.f2 + 0.5, f3: profile.f3 }
                };
            });
        });

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.showNotification === 'function') {
            window.showNotification('تمت تعبئة نقط نموذجية تجريبية بنجاح! تفحص لوحة الشرف 🏆', 'success');
        }
        renderAcademicEvolutionDashboard();
    }

    /**
     * طباعة شهادة تقديرية وتنويه بالتقدم الدراسي للتلميذ
     */
    function printStudentImprovementCertificate(studentData) {
        if (!studentData) return;

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'أستاذ مادة الرياضيات';
        const institutionName = (window.db && window.db.teacherProfile && (window.db.teacherProfile.school || window.db.teacherProfile.institution)) || (window.db && window.db.schoolName) || 'الثانوية التأهيلية';
        const hwFont = typeof window.getSelectedHandwritingFontFamily === 'function' ? window.getSelectedHandwritingFontFamily() : "'Aref Ruqaa', serif";

        const certHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>شهادة تنويه بالتقدم الدراسي - ${escapeHtml(studentData.name)}</title>
                <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Reem+Kufi:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        font-family: 'Amiri', 'Cairo', serif;
                        margin: 0;
                        padding: 20px;
                        background: #ffffff;
                        color: #0f172a;
                        direction: rtl;
                    }
                    .cert-border {
                        border: 6px double #047857;
                        border-radius: 16px;
                        padding: 30px 40px;
                        position: relative;
                        background: radial-gradient(circle at center, #ffffff 60%, #f0fdf4 100%);
                        box-shadow: inset 0 0 40px rgba(5, 150, 105, 0.08);
                        min-height: 520px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                    }
                    .cert-header {
                        text-align: center;
                        border-bottom: 2px solid #a7f3d0;
                        padding-bottom: 14px;
                    }
                    .cert-kingdom {
                        font-size: 14px;
                        font-weight: 800;
                        color: #1e3a8a;
                        margin: 0 0 4px 0;
                    }
                    .cert-ministry {
                        font-size: 12px;
                        color: #475569;
                        margin: 0;
                    }
                    .cert-main-title {
                        font-size: 28px;
                        font-weight: 900;
                        color: #065f46;
                        margin: 16px 0 8px 0;
                        letter-spacing: 1px;
                        text-shadow: 1px 1px 2px rgba(4, 120, 87, 0.15);
                    }
                    .cert-subtitle {
                        font-size: 15px;
                        color: #047857;
                        font-weight: 700;
                        margin: 0 0 16px 0;
                    }
                    .cert-body {
                        text-align: center;
                        margin: 18px 0;
                        line-height: 1.8;
                    }
                    .cert-lead {
                        font-size: 16px;
                        color: #334155;
                    }
                    .student-name {
                        font-size: 26px;
                        font-weight: 900;
                        color: #1e3a8a;
                        display: inline-block;
                        padding: 2px 20px;
                        border-bottom: 3px solid #059669;
                        margin: 8px 0;
                    }
                    .cert-desc {
                        font-size: 15px;
                        color: #1e293b;
                        max-width: 780px;
                        margin: 10px auto;
                    }
                    .metric-highlight {
                        display: inline-flex;
                        align-items: center;
                        gap: 12px;
                        background: #ecfdf5;
                        border: 2px solid #a7f3d0;
                        border-radius: 12px;
                        padding: 10px 24px;
                        margin: 14px auto;
                    }
                    .metric-pill {
                        font-size: 16px;
                        font-weight: 800;
                        color: #047857;
                    }
                    .cert-footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-top: 24px;
                        padding-top: 14px;
                        border-top: 1px dashed #cbd5e1;
                        font-size: 13px;
                        color: #475569;
                    }
                    .sig-box {
                        text-align: center;
                        min-width: 180px;
                    }
                    .sig-line {
                        margin-top: 35px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .watermark-seal {
                        position: absolute;
                        bottom: 40px;
                        left: 45%;
                        opacity: 0.12;
                        font-size: 120px;
                        pointer-events: none;
                    }
                    @media print {
                        body { padding: 0; background: #fff; }
                        .cert-border { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="cert-border">
                    <div class="watermark-seal">🏆</div>
                    <div class="cert-header">
                        <div class="cert-kingdom">المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div class="cert-ministry">${escapeHtml(institutionName)} | مادة الرياضيات بالسلك الثانوي التأهيلي</div>
                        <div class="cert-main-title">🎖️ شهادة تنويه وتشجيع بالتقدم الدراسي 🎖️</div>
                        <div class="cert-subtitle">تقدير الجهد والمثابرة في تطوير التحصيل الدراسي لمادة الرياضيات</div>
                    </div>

                    <div class="cert-body">
                        <div class="cert-lead">يشهد أستاذ مادة الرياضيات بأن التلميذ(ة) النجيب(ة):</div>
                        <div class="student-name">${escapeHtml(studentData.name)}</div>
                        <div style="font-size: 14px; color: #64748b; font-weight: 700;">القسم: <strong>${escapeHtml(studentData.className)}</strong> | الرقم الترتيبي: <strong>${escapeHtml(studentData.id)}</strong></div>

                        <div class="cert-desc">
                            قد حقق(ت) <strong>تقدماً نوعياً متميزاً ومثابرة ملحوظة</strong> في نقط الفروض المحروسة خلال الدورة، حيث ارتفعت نتيجته(ا) من <strong>${studentData.m1} / 20</strong> (${escapeHtml(studentData.label1)}) إلى <strong>${studentData.m2} / 20</strong> (${escapeHtml(studentData.label2)}).
                        </div>

                        <div class="metric-highlight">
                            <span class="metric-pill">🚀 مقدار القفزة النوعية: <strong>+${studentData.delta} نقطة</strong></span>
                            <span style="color: #94a3b8;">|</span>
                            <span class="metric-pill">📈 نسبة التحسن: <strong>+${studentData.pct}%</strong></span>
                            <span style="color: #94a3b8;">|</span>
                            <span class="metric-pill">⭐ وسام التميز والمثابرة</span>
                        </div>

                        <div class="teacher-handwritten-note" style="font-family: ${hwFont}; font-size: 16px; color: #1e3a8a;">
                            "إن الإصرار على التطور هو البداية الحقيقية لكل نجاح باهر.. مزيداً من التألق والتفوق!"
                        </div>
                    </div>

                    <div class="cert-footer">
                        <div class="sig-box">
                            <div>تحريراً في: <strong>${new Date().toLocaleDateString('ar-MA')}</strong></div>
                            <div class="sig-line">تأشير الإدارة التربوية</div>
                        </div>
                        <div class="sig-box">
                            <div>إعداد وتنويه:</div>
                            <div class="sig-line signature-handwritten" style="font-family: ${hwFont}; font-size: 17px; color: #1e3a8a;">${escapeHtml(teacherName)}</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(certHtml, 'شهادة تنويه بالتقدم الدراسي - ' + studentData.name, 'landscape');
        }
    }

    /**
     * إرسال رسالة تشجيعية عبر واتساب لولي أمر التلميذ
     */
    function sendWhatsAppImprovementMessage(studentData) {
        if (!studentData) return;

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'أستاذ مادة الرياضيات';
        const msg = `السلام عليكم ورحمة الله وبركاته،
تحية تربوية طيبة،

يسرني بصفتي أستاذ مادة الرياضيات أن أشارككم خبراً مفرحاً يخص التلميذ(ة): *${studentData.name}* (${studentData.className}).
لقد حقق التلميذ تقدماً دراسياً رائعاً ومثابرة ملحوظة بين فروض المراقبة المستمرة؛ حيث ارتفعت نقطته من *${studentData.m1}/20* في ${studentData.label1} إلى *${studentData.m2}/20* في ${studentData.label2}، محققاً قفزة إيجابية فارقها *(+${studentData.delta} نقطة)* 🚀.

نشيد بجهده المتواصل وندعوكم لتشجيعه وتحفيزه لمواصلة هذا المسار التصاعدي المتميز في الاستحقاقات القادمة.

مع أطيب التحيات والتقدير،
${teacherName}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).then(() => {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('تم نسخ نص رسالة التهنئة التشجيعية بنجاح 📋', 'success');
                } else {
                    alert('تم نسخ رسالة التهنئة لواتساب ولي الأمر بنجاح!');
                }
            }).catch(() => {
                prompt('انسخ نص التهنئة التالي لإرساله لولي الأمر:', msg);
            });
        } else {
            prompt('انسخ نص التهنئة التالي لإرساله لولي الأمر:', msg);
        }
    }

    /**
     * طباعة التقرير الإحصائي الشامل للتقدم الدراسي لجميع الأقسام
     */
    function printAcademicEvolutionReport() {
        const data = calculateAcademicEvolution();
        if (data.totalEvaluated === 0) {
            alert('لا توجد معطيات نقط كافية للطباعة حالياً');
            return;
        }

        const teacherName = (window.db && window.db.teacherProfile && window.db.teacherProfile.name) || 'الأستاذ';
        const institutionName = (window.db && window.db.teacherProfile && (window.db.teacherProfile.school || window.db.teacherProfile.institution)) || (window.db && window.db.schoolName) || 'المؤسسة التعليمية';

        const rowsHtml = data.evaluatedStudents
            .sort((a, b) => b.delta - a.delta)
            .map((s, idx) => `
                <tr style="border-bottom: 1px solid #cbd5e1; ${idx % 2 === 0 ? 'background: #ffffff;' : 'background: #f8fafc;'}">
                    <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 6px 8px; font-weight: 800; color: #0f172a;">${escapeHtml(s.name)}</td>
                    <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: #0284c7;">${escapeHtml(s.className)}</td>
                    <td style="padding: 6px 8px; text-align: center; font-weight: 700;">${s.m1} / 20</td>
                    <td style="padding: 6px 8px; text-align: center; font-weight: 800; color: #1e3a8a;">${s.m2} / 20</td>
                    <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: ${s.delta > 0 ? '#047857' : s.delta < 0 ? '#b91c1c' : '#64748b'};">
                        ${s.delta > 0 ? '+' : ''}${s.delta}
                    </td>
                    <td style="padding: 6px 8px; text-align: center; font-weight: 700;">${s.delta > 0 ? '+' : ''}${s.pct}%</td>
                    <td style="padding: 6px 8px; text-align: center;">
                        <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 800; background: ${s.badgeBg}; color: ${s.badgeColor};">
                            ${s.categoryLabel}
                        </span>
                    </td>
                </tr>
            `).join('');

        const docHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>كشف مؤشر تطور الأداء الدراسي وأبطال التقدم</title>
                <style>
                    body {
                        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
                        padding: 20px;
                        color: #0f172a;
                        direction: rtl;
                    }
                    .header-box {
                        text-align: center;
                        border-bottom: 2px solid #047857;
                        padding-bottom: 10px;
                        margin-bottom: 16px;
                    }
                    .kpi-row {
                        display: flex;
                        justify-content: space-around;
                        background: #ecfdf5;
                        border: 1px solid #a7f3d0;
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 16px;
                        text-align: center;
                    }
                    .kpi-item h4 { margin: 0; font-size: 12px; color: #047857; }
                    .kpi-item p { margin: 4px 0 0 0; font-size: 16px; font-weight: 900; color: #065f46; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th { background: #047857; color: #ffffff; padding: 8px; border: 1px solid #047857; }
                    td { border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <h2 style="margin: 0; color: #065f46;">المملكة المغربية - كشف مؤشر تطور الأداء الدراسي</h2>
                    <h3 style="margin: 4px 0; color: #1e3a8a;">${escapeHtml(institutionName)} - مادة الرياضيات</h3>
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                        الدورة: <strong>${_evoState.semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى'}</strong> | 
                        الأقسام: <strong>${_evoState.classFilter === 'all' ? 'جميع الأقسام' : _evoState.classFilter}</strong> | 
                        الأستاذ: <strong>${escapeHtml(teacherName)}</strong>
                    </p>
                </div>

                <div class="kpi-row">
                    <div class="kpi-item">
                        <h4>إجمالي المفحوصين</h4>
                        <p>${data.totalEvaluated} تلميذ</p>
                    </div>
                    <div class="kpi-item">
                        <h4>متوسط فارق التقدم العام</h4>
                        <p>${data.avgDelta > 0 ? '+' : ''}${data.avgDelta} ن</p>
                    </div>
                    <div class="kpi-item">
                        <h4>نسبة التلاميذ المتقدمين</h4>
                        <p>${data.improversRate}% (${data.improversCount})</p>
                    </div>
                    <div class="kpi-item">
                        <h4>تغير نسبة النجاح</h4>
                        <p>${data.passRateDiff > 0 ? '+' : ''}${data.passRateDiff}%</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>اسم التلميذ</th>
                            <th>القسم</th>
                            <th>نقطة الفرض 1</th>
                            <th>نقطة الفرض 2</th>
                            <th>فارق النقط</th>
                            <th>نسبة التطور</th>
                            <th>التصنيف البيداغوجي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(docHtml, 'كشف مؤشر تطور الأداء الدراسي', 'portrait');
        }
    }

    /**
     * تحديث خيارات الأقسام في القائمة المنسدلة
     */
    function updateClassDropdown() {
        const select = document.getElementById('dashEvolutionClassFilter');
        if (!select) return;

        const currentVal = select.value;
        const classes = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];

        select.innerHTML = '<option value="all">جميع الأقسام معاً</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        });

        if (currentVal && (currentVal === 'all' || classes.includes(currentVal))) {
            select.value = currentVal;
        } else {
            select.value = _evoState.classFilter;
        }
    }

    /**
     * رسم وعرض بطاقة تطور الأداء الدراسي في لوحة القيادة
     */
    function renderAcademicEvolutionDashboard() {
        const container = document.getElementById('dashAcademicEvolutionCard');
        if (!container) return;

        updateClassDropdown();

        const data = calculateAcademicEvolution();
        updateDashboardKpiMiniCard(data);

        // إذا لم تكن هناك أي معطيات نقط مفحوصة (صفر تلاميذ مفحوصين)
        if (data.totalEvaluated === 0) {
            container.innerHTML = `
                <div style="padding: 20px 22px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25); font-size: 1.25rem;">
                                📈
                            </span>
                            <div>
                                <h3 style="color: #065f46; font-size: 1.08rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
                                    <span>مؤشر تطور الأداء الدراسي وأبطال التقدم بين الفروض</span>
                                    <span style="font-size: 0.72rem; background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 999px; font-weight: 800; border: 1px solid #a7f3d0;">تتبع المردودية</span>
                                </h3>
                                <p style="color: #64748b; font-size: 0.78rem; margin: 2px 0 0 0;">
                                    رصد الفارق في نقط الفروض المحروسة للدورة الواحدة وإبراز التلاميذ أصحاب أعلى قفزة نوعية
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style="text-align: center; padding: 36px 20px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
                        <div style="font-size: 2.4rem; margin-bottom: 8px;">🎯</div>
                        <h4 style="color: #1e3a8a; font-size: 1rem; font-weight: 800; margin: 0 0 6px 0;">بانتظار رصد نقط فرضين على الأقل لتفعيل المؤشر</h4>
                        <p style="color: #64748b; font-size: 0.82rem; max-width: 520px; margin: 0 auto 16px auto; line-height: 1.6;">
                            يتطلب مؤشر تطور الأداء توفر نقط الفرضين (1 و 2) للدورة الواحدة لاحتساب فارق التقدم وإبراز لوحة الشرف للأبطال المتقدمين.
                        </p>
                        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                            <button type="button" onclick="window.seedDemoAcademicEvolutionGrades()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);">
                                <span>✨</span>
                                <span>تعبئة نقط نموذجية للتجربة والمعاينة</span>
                            </button>
                            <button type="button" onclick="switchTab('reports')" style="background: #ffffff; color: #1e3a8a; border: 1.5px solid #cbd5e1; padding: 8px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer;">
                                <span>📝 الانتقال لرصد النقط في كشف التقارير</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // بناء محتوى البطاقة الإحصائية الكاملة
        let html = `
            <div style="padding: 18px 20px;">
                <!-- Header with Title and Control Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #fff; width: 42px; height: 42px; border-radius: 11px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(5, 150, 105, 0.25); font-size: 1.3rem;">
                            🚀
                        </span>
                        <div>
                            <h3 style="color: #065f46; font-size: 1.1rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span>مؤشر تطور الأداء الدراسي وأبطال التقدم بين الفروض</span>
                                <span style="font-size: 0.72rem; background: #ecfdf5; color: #047857; padding: 2px 9px; border-radius: 999px; font-weight: 800; border: 1px solid #a7f3d0;">
                                    ${data.improversRate}% في مسار تصاعدي
                                </span>
                            </h3>
                            <p style="color: #64748b; font-size: 0.79rem; margin: 2px 0 0 0;">
                                قياس الفارق في النقط بين استحقاقات الدورة المدرسية وتشجيع التلاميذ المحققين لأكبر وثبة تحصيلية
                            </p>
                        </div>
                    </div>

                    <!-- أزرار التصفية والتحكم -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <!-- اختيار الدورة -->
                        <div style="display: flex; gap: 2px; background: #f8fafc; padding: 2px; border: 1px solid #cbd5e1; border-radius: 7px;">
                            <button type="button" onclick="window.setEvolutionFilter('semester', 's1')" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 800; border-radius: 5px; border: none; cursor: pointer; ${_evoState.semester === 's1' ? 'background: #047857; color: #fff;' : 'background: transparent; color: #475569;'}">الدورة 1</button>
                            <button type="button" onclick="window.setEvolutionFilter('semester', 's2')" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 800; border-radius: 5px; border: none; cursor: pointer; ${_evoState.semester === 's2' ? 'background: #047857; color: #fff;' : 'background: transparent; color: #475569;'}">الدورة 2</button>
                        </div>

                        <!-- اختيار القسم -->
                        <select id="dashEvolutionClassFilter" onchange="window.setEvolutionFilter('classFilter', this.value)" style="font-size: 0.78rem; padding: 5px 10px; border-radius: 7px; border: 1.5px solid #cbd5e1; background: #ffffff; font-weight: 700; color: #334155; cursor: pointer;">
                            <option value="all">جميع الأقسام معاً</option>
                        </select>

                        <!-- نوع المقارنة -->
                        <select onchange="window.setEvolutionFilter('examMode', this.value)" style="font-size: 0.78rem; padding: 5px 10px; border-radius: 7px; border: 1.5px solid #cbd5e1; background: #ffffff; font-weight: 700; color: #334155; cursor: pointer;">
                            <option value="f1_to_f2" ${_evoState.examMode === 'f1_to_f2' ? 'selected' : ''}>الفرض 1 ⬅️ الفرض 2</option>
                            <option value="f2_to_f3" ${_evoState.examMode === 'f2_to_f3' ? 'selected' : ''}>الفرض 2 ⬅️ الفرض 3</option>
                            <option value="f_all" ${_evoState.examMode === 'f_all' ? 'selected' : ''}>أول فرض ⬅️ آخر فرض</option>
                        </select>

                        <button type="button" onclick="window.printAcademicEvolutionReport()" style="background: #ffffff; color: #0f172a; border: 1.5px solid #cbd5e1; padding: 5px 12px; border-radius: 7px; font-size: 0.76rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>🖨️</span>
                            <span>طباعة الكشف</span>
                        </button>
                        <button type="button" onclick="window.seedDemoAcademicEvolutionGrades()" style="background: #f0fdf4; color: #047857; border: 1px solid #a7f3d0; padding: 5px 9px; border-radius: 7px; font-size: 0.74rem; font-weight: 700; cursor: pointer;" title="تحديث أو إعادة تعبئة بيانات تجريبية">
                            <span>✨ تجديد النماذج</span>
                        </button>
                    </div>
                </div>

                <!-- KPI Metric Strip (شريط المؤشرات الإحصائية الرئيسية) -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px;">
                    <!-- 1. متوسط الفارق العام بالنقط -->
                    <div style="background: ${data.avgDelta >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1.5px solid ${data.avgDelta >= 0 ? '#86efac' : '#fecaca'}; border-radius: 11px; padding: 12px 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 0.74rem; font-weight: 800; color: ${data.avgDelta >= 0 ? '#15803d' : '#b91c1c'};">📈 مؤشر التطور الصافي</span>
                            <span style="font-size: 0.7rem; background: #ffffff; padding: 1px 6px; border-radius: 4px; font-weight: 700; color: #64748b;">${data.totalEvaluated} تلميذ</span>
                        </div>
                        <div style="font-size: 1.7rem; font-weight: 900; color: ${data.avgDelta >= 0 ? '#14532d' : '#991b1b'}; margin: 4px 0 2px 0;">
                            ${data.avgDelta > 0 ? '+' : ''}${data.avgDelta} <span style="font-size: 0.85rem; font-weight: 700;">نقطة</span>
                        </div>
                        <div style="font-size: 0.72rem; color: ${data.avgDelta >= 0 ? '#166534' : '#991b1b'}; font-weight: 700;">
                            معدل الفرض 1: ${data.avgM1} ⬅️ الفرض 2: ${data.avgM2}
                        </div>
                    </div>

                    <!-- 2. نسبة التلاميذ في مسار تصاعدي -->
                    <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 11px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 800; color: #047857;">🚀 نسبة المتعلمين المتقدمين</div>
                        <div style="font-size: 1.7rem; font-weight: 900; color: #065f46; margin: 4px 0 2px 0;">
                            ${data.improversRate}%
                        </div>
                        <div style="font-size: 0.72rem; color: #047857; font-weight: 700;">
                            ${data.improversCount} تلميذ حققوا زيادة إيجابية
                        </div>
                    </div>

                    <!-- 3. تطور نسبة النجاح -->
                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 11px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 800; color: #1e40af;">🎯 نسبة المعدل (≥10/20)</div>
                        <div style="font-size: 1.7rem; font-weight: 900; color: #1e3a8a; margin: 4px 0 2px 0;">
                            ${data.passRateM2}%
                        </div>
                        <div style="font-size: 0.72rem; color: #1d4ed8; font-weight: 700;">
                            الفارق: <strong>${data.passRateDiff > 0 ? '+' : ''}${data.passRateDiff}%</strong> (كانت ${data.passRateM1}%)
                        </div>
                    </div>

                    <!-- 4. أعلى قفزة نوعية في النقط -->
                    <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 11px; padding: 12px 14px;">
                        <div style="font-size: 0.74rem; font-weight: 800; color: #7e22ce;">🏆 الرقم القياسي للقفزة النوعية</div>
                        <div style="font-size: 1.7rem; font-weight: 900; color: #6b21a8; margin: 4px 0 2px 0;">
                            ${data.maxImprover ? `+${data.maxImprover.delta} ن` : '--'}
                        </div>
                        <div style="font-size: 0.72rem; color: #7e22ce; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${data.maxImprover ? `${data.maxImprover.name} (${data.maxImprover.className})` : 'لا توجد بيانات'}
                        </div>
                    </div>
                </div>

                <!-- شريط التبديل بين محاور العرض (Tabs) -->
                <div style="display: flex; gap: 8px; margin-bottom: 14px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="window.setEvolutionTab('top_improvers')" style="padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; border: none; ${_evoState.activeTab === 'top_improvers' ? 'background: linear-gradient(135deg, #059669, #047857); color: #fff; box-shadow: 0 2px 5px rgba(5,150,105,0.25);' : 'background: #f1f5f9; color: #475569;'}">
                        <span>🏆</span>
                        <span>أبطال التقدم الدراسي (${data.improversCount})</span>
                    </button>
                    <button type="button" onclick="window.setEvolutionTab('full_roster')" style="padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; border: none; ${_evoState.activeTab === 'full_roster' ? 'background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; box-shadow: 0 2px 5px rgba(37,99,235,0.25);' : 'background: #f1f5f9; color: #475569;'}">
                        <span>📋</span>
                        <span>الكشف الإحصائي الشامل لجميع المتعلمين (${data.totalEvaluated})</span>
                    </button>
                    <button type="button" onclick="window.setEvolutionTab('support_needed')" style="padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; border: none; ${_evoState.activeTab === 'support_needed' ? 'background: linear-gradient(135deg, #dc2626, #b91c1c); color: #fff; box-shadow: 0 2px 5px rgba(220,38,38,0.25);' : 'background: #f1f5f9; color: #475569;'}">
                        <span>⚠️</span>
                        <span>المستهدفون بالدعم الاستدراكي (${data.regressedCount})</span>
                    </button>
                </div>
        `;

        // 1. محتوى تبويب أبطال التقدم (Top Improvers)
        if (_evoState.activeTab === 'top_improvers') {
            if (data.topImprovers.length === 0) {
                html += `
                    <div style="text-align: center; padding: 28px; background: #fafafa; border-radius: 10px; color: #64748b; font-size: 0.85rem;">
                        لم يتم تسجيل أي فارق تقدم إيجابي بين الفرضين المحددين حتى الآن.
                    </div>
                `;
            } else {
                // منصة التتويج للمراكز الثلاثة الأولى
                const podium = data.topImprovers.slice(0, 3);
                const restImprovers = data.topImprovers.slice(3);

                html += `
                    <!-- منصة التتويج البيداغوجي (Top 3 Podium) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin: 0 0 18px 0; align-items: stretch;">
                `;

                podium.forEach((st, pIdx) => {
                    const medals = ['🥇 المركز الأول', '🥈 المركز الثاني', '🥉 المركز الثالث'];
                    const cardColors = [
                        { border: '#fbbf24', bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', badge: '#b45309', ring: '#f59e0b' },
                        { border: '#cbd5e1', bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', badge: '#475569', ring: '#94a3b8' },
                        { border: '#fdba74', bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', badge: '#c2410c', ring: '#fb923c' }
                    ];
                    const clr = cardColors[pIdx] || cardColors[0];

                    html += `
                        <div class="dash-evolution-podium-card" style="background: ${clr.bg}; border: 1.5px solid ${clr.border}; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04); position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-size: 0.76rem; font-weight: 800; color: ${clr.badge}; background: #ffffff; padding: 2px 8px; border-radius: 999px; border: 1px solid ${clr.border};">
                                        ${medals[pIdx]}
                                    </span>
                                    <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">${escapeHtml(st.className)}</span>
                                </div>
                                <div style="font-size: 1.02rem; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
                                    ${escapeHtml(st.name)}
                                </div>
                                
                                <!-- مسار القفزة في النقط -->
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 9px; padding: 8px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">${st.label1}</div>
                                        <div style="font-size: 0.95rem; font-weight: 800; color: #334155;">${st.m1} <span style="font-size: 0.65rem;">/20</span></div>
                                    </div>
                                    <div style="font-size: 1.1rem; color: #059669; font-weight: 900;">➔</div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">${st.label2}</div>
                                        <div style="font-size: 1.05rem; font-weight: 900; color: #047857;">${st.m2} <span style="font-size: 0.65rem;">/20</span></div>
                                    </div>
                                    <div style="text-align: center; border-right: 1px dashed #cbd5e1; padding-right: 8px;">
                                        <div style="font-size: 0.68rem; color: #047857; font-weight: 700;">الفارق الصافي</div>
                                        <div style="font-size: 1.1rem; font-weight: 900; color: #047857;">+${st.delta}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- أزرار الإجراءات الفورية -->
                            <div style="display: flex; gap: 6px; align-items: center; border-top: 1px dashed ${clr.border}; padding-top: 8px;">
                                <button type="button" onclick='window.printStudentImprovementCertificate(${JSON.stringify(st).replace(/'/g, "&apos;")})' style="flex: 1; background: #ffffff; color: #047857; border: 1.5px solid #a7f3d0; padding: 5px 8px; border-radius: 6px; font-size: 0.73rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" title="طباعة شهادة تنويه بالتقدم الدراسي">
                                    <span>🏆</span>
                                    <span>شهادة تنويه</span>
                                </button>
                                <button type="button" onclick='window.sendWhatsAppImprovementMessage(${JSON.stringify(st).replace(/'/g, "&apos;")})' style="flex: 1; background: #ecfdf5; color: #065f46; border: 1.5px solid #86efac; padding: 5px 8px; border-radius: 6px; font-size: 0.73rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" title="إرسال رسالة تشجيع لولي الأمر عبر واتساب">
                                    <span>💬</span>
                                    <span>تهنئة الولي</span>
                                </button>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;

                // باقي المتعلمين المتقدمين (جدول أو شبكة مصغرة)
                if (restImprovers.length > 0) {
                    html += `
                        <div style="font-size: 0.85rem; font-weight: 800; color: #065f46; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <span>⭐ قائمة الشرف لباقي التلاميذ المتقدمين:</span>
                            <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">(${restImprovers.length} تلميذ إضافي)</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px; max-height: 320px; overflow-y: auto; padding-left: 4px;">
                    `;

                    restImprovers.forEach((st, idx) => {
                        html += `
                            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="width: 24px; height: 24px; border-radius: 50%; background: #f0fdf4; color: #16a34a; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; justify-content: center;">
                                        ${idx + 4}
                                    </span>
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a;">${escapeHtml(st.name)}</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(st.className)} | من ${st.m1} إلى ${st.m2}</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 900;">
                                        +${st.delta} ن
                                    </span>
                                    <button type="button" onclick='window.printStudentImprovementCertificate(${JSON.stringify(st).replace(/'/g, "&apos;")})' style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 6px; border-radius: 5px; font-size: 0.7rem; cursor: pointer;" title="طباعة شهادة التنويه">🏆</button>
                                    <button type="button" onclick='window.sendWhatsAppImprovementMessage(${JSON.stringify(st).replace(/'/g, "&apos;")})' style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 6px; border-radius: 5px; font-size: 0.7rem; cursor: pointer;" title="تهنئة الولي">💬</button>
                                </div>
                            </div>
                        `;
                    });

                    html += `</div>`;
                }
            }
        }

        // 2. محتوى تبويب الكشف الشامل لجميع التلاميذ
        else if (_evoState.activeTab === 'full_roster') {
            html += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                    <div style="max-height: 380px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: center; white-space: nowrap;">
                            <thead style="background: #f8fafc; color: #475569; position: sticky; top: 0; z-index: 2; border-bottom: 2px solid #e2e8f0;">
                                <tr>
                                    <th style="padding: 8px 6px; width: 40px;">#</th>
                                    <th style="padding: 8px 10px; text-align: right;">اسم التلميذ</th>
                                    <th style="padding: 8px 6px;">القسم</th>
                                    <th style="padding: 8px 6px;">الفرض 1</th>
                                    <th style="padding: 8px 6px;">الفرض 2</th>
                                    <th style="padding: 8px 8px;">الفارق الصافي</th>
                                    <th style="padding: 8px 6px;">التطور %</th>
                                    <th style="padding: 8px 6px;">التصنيف</th>
                                    <th style="padding: 8px 6px;">شهادة / مراسلة</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            const sortedRoster = data.evaluatedStudents.slice().sort((a, b) => b.delta - a.delta);

            sortedRoster.forEach((s, idx) => {
                const deltaColor = s.delta > 0 ? '#047857' : (s.delta < 0 ? '#b91c1c' : '#64748b');
                const deltaSign = s.delta > 0 ? '+' : '';

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 0 ? 'background: #ffffff;' : 'background: #fafafa;'}">
                        <td style="padding: 7px 6px; color: #64748b; font-weight: 700;">${idx + 1}</td>
                        <td style="padding: 7px 10px; text-align: right; font-weight: 800; color: #0f172a;">${escapeHtml(s.name)}</td>
                        <td style="padding: 7px 6px; color: #0284c7; font-weight: 700;">${escapeHtml(s.className)}</td>
                        <td style="padding: 7px 6px; font-weight: 700; color: ${s.m1 >= 10 ? '#15803d' : '#b91c1c'};">${s.m1}</td>
                        <td style="padding: 7px 6px; font-weight: 800; color: ${s.m2 >= 10 ? '#15803d' : '#b91c1c'};">${s.m2}</td>
                        <td style="padding: 7px 8px; font-weight: 900; color: ${deltaColor};">
                            ${deltaSign}${s.delta}
                        </td>
                        <td style="padding: 7px 6px; font-weight: 700; color: ${deltaColor};">
                            ${deltaSign}${s.pct}%
                        </td>
                        <td style="padding: 7px 6px;">
                            <span style="background: ${s.badgeBg}; color: ${s.badgeColor}; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                                ${s.categoryLabel}
                            </span>
                        </td>
                        <td style="padding: 7px 6px;">
                            <div style="display: flex; gap: 4px; justify-content: center;">
                                ${s.delta > 0 ? `
                                    <button type="button" onclick='window.printStudentImprovementCertificate(${JSON.stringify(s).replace(/'/g, "&apos;")})' style="background: #f0fdf4; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="طباعة شهادة التنويه">🏆</button>
                                    <button type="button" onclick='window.sendWhatsAppImprovementMessage(${JSON.stringify(s).replace(/'/g, "&apos;")})' style="background: #f0fdf4; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="تهنئة الولي">💬</button>
                                ` : '-'}
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // 3. محتوى تبويب المستهدفين بالدعم الاستدراكي (المتراجعون)
        else if (_evoState.activeTab === 'support_needed') {
            if (data.regressedStudents.length === 0) {
                html += `
                    <div style="text-align: center; padding: 28px; background: #f0fdf4; border: 1.5px dashed #86efac; border-radius: 12px; color: #15803d;">
                        <div style="font-size: 2rem; margin-bottom: 6px;">🎉</div>
                        <h4 style="margin: 0 0 4px 0; font-weight: 800;">ممتاز! لا توجد حالات تراجع مسجلة بين الفرضين</h4>
                        <p style="margin: 0; font-size: 0.8rem; color: #166534;">جميع المتعلمين حافظوا على مستواهم أو حققوا تقدماً إيجابياً.</p>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: #fff5f5; border: 1.5px solid #fecaca; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.2rem;">⚠️</span>
                            <div>
                                <div style="font-weight: 800; font-size: 0.86rem; color: #991b1b;">
                                    رصد ${data.regressedStudents.length} تلميذ تراجعت نقطهم بين الفرضين
                                </div>
                                <div style="font-size: 0.74rem; color: #b91c1c;">
                                    يستحسن برمجة حصة دعم بيداغوجي استدراكي ومعالجة التعثرات قبل الفرض القادم.
                                </div>
                            </div>
                        </div>
                        <button type="button" onclick="if(typeof openAutoRemediationWithTimetableSync === 'function') openAutoRemediationWithTimetableSync(); else switchTab('tutoring');" style="background: linear-gradient(135deg, #b91c1c, #991b1b); color: #fff; border: none; padding: 6px 12px; border-radius: 7px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>🎯</span>
                            <span>جدولة دعم استدراكي للمتراجعين</span>
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; max-height: 320px; overflow-y: auto;">
                `;

                data.regressedStudents.forEach((st, idx) => {
                    html += `
                        <div style="background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            <div>
                                <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a;">${escapeHtml(st.name)}</div>
                                <div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(st.className)} | تراجع من ${st.m1} إلى ${st.m2}</div>
                            </div>
                            <div style="text-align: left;">
                                <span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 900;">
                                    ${st.delta} ن
                                </span>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
            }
        }

        html += `</div>`;
        container.innerHTML = html;

        // تحديث بطاقة نادي أولمبياد الرياضيات والتميز بالتوازي
        renderMathOlympiadClubCard();
    }

    /**
     * تغيير معايير التصفية
     */
    function setEvolutionFilter(key, val) {
        if (_evoState[key] !== undefined) {
            _evoState[key] = val;
            renderAcademicEvolutionDashboard();
        }
    }

    /**
     * تغيير تبويب العرض
     */
    function setEvolutionTab(tab) {
        _evoState.activeTab = tab;
        renderAcademicEvolutionDashboard();
    }

    /**
     * =========================================================================
     * النقطة 4: بطاقة ونادي أولمبياد الرياضيات والتميز (Club Olympiades de Mathématiques)
     * =========================================================================
     */
    const _olympiadState = {
        semester: 's1',
        threshold: 17,
        criterion: 'best', // 'best' | 'avg' | 'f1' | 'f2' | 'f3'
        classFilter: 'all'
    };

    const OLYMPIAD_SPECIALTIES = {
        all_round: { label: '🌟 تميز شامل (أولمبياد عامة)', color: '#b45309', bg: '#fef3c7' },
        geometry: { label: '📐 الهندسة المستوية والفضائية', color: '#1d4ed8', bg: '#dbeafe' },
        algebra: { label: '🔢 الجبر والحسابيات ونظرية الأعداد', color: '#047857', bg: '#d1fae5' },
        analysis: { label: '📈 التحليل والدوال والمتتاليات', color: '#6d28d9', bg: '#ede9fe' },
        combinatorics: { label: '🧩 التركيب والمنطق والاستدلال', color: '#be123c', bg: '#ffe4e6' }
    };

    function getOrInitOlympiadClubRegistry() {
        if (!window.db) return {};
        if (!window.db.mathOlympiadClub || typeof window.db.mathOlympiadClub !== 'object') {
            window.db.mathOlympiadClub = {
                members: {},
                workshop: {
                    date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                    time: '15:00 - 17:00',
                    room: 'قاعة الأنشطة / نادي الرياضيات',
                    topic: 'تقنيات البرهان الرياضي، المتفاوتات الكلاسيكية، والهندسة الأولمبية'
                }
            };
        }
        if (!window.db.mathOlympiadClub.members) window.db.mathOlympiadClub.members = {};
        if (!window.db.mathOlympiadClub.workshop) {
            window.db.mathOlympiadClub.workshop = {
                date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                time: '15:00 - 17:00',
                room: 'قاعة الأنشطة / نادي الرياضيات',
                topic: 'تقنيات البرهان الرياضي، المتفاوتات الكلاسيكية، والهندسة الأولمبية'
            };
        }
        return window.db.mathOlympiadClub;
    }

    function extractMathOlympiadCandidates() {
        const classesList = getAvailableClasses();
        const targetClasses = _olympiadState.classFilter === 'all'
            ? classesList
            : classesList.filter(c => c === _olympiadState.classFilter);

        const sem = _olympiadState.semester || 's1';
        const threshold = parseFloat(_olympiadState.threshold) || 17;
        const criterion = _olympiadState.criterion || 'best';
        const clubRegistry = getOrInitOlympiadClubRegistry();

        const candidates = [];
        let totalEvaluatedStudents = 0;
        const representedClassesSet = new Set();

        targetClasses.forEach(className => {
            const rawClass = window.db.classes[className];
            const students = Array.isArray(rawClass) ? rawClass : (rawClass && rawClass.students ? rawClass.students : []);
            const classGrades = (window.db.grades && window.db.grades[className]) ? window.db.grades[className] : {};

            students.forEach((std, idx) => {
                const stdRecord = classGrades[std.id];
                const f1 = getStudentExamMarks(stdRecord, sem, 'f1');
                const f2 = getStudentExamMarks(stdRecord, sem, 'f2');
                const f3 = getStudentExamMarks(stdRecord, sem, 'f3');
                const f4 = getStudentExamMarks(stdRecord, sem, 'f4');

                const validMarks = [f1, f2, f3, f4].filter(v => v !== null && !isNaN(v));
                if (validMarks.length === 0) return;

                totalEvaluatedStudents++;
                const bestMark = Math.max(...validMarks);
                const avgMark = parseFloat((validMarks.reduce((a, b) => a + b, 0) / validMarks.length).toFixed(2));

                let scoreToCompare = null;
                if (criterion === 'best') scoreToCompare = bestMark;
                else if (criterion === 'avg') scoreToCompare = avgMark;
                else if (criterion === 'f1') scoreToCompare = f1;
                else if (criterion === 'f2') scoreToCompare = f2;
                else if (criterion === 'f3') scoreToCompare = f3;

                if (scoreToCompare !== null && scoreToCompare >= threshold) {
                    const memberKey = `${className}__${std.id}`;
                    const savedMember = clubRegistry.members[memberKey] || {};
                    const specialtyKey = savedMember.specialty || (bestMark >= 18.5 ? 'all_round' : (idx % 2 === 0 ? 'geometry' : 'algebra'));

                    representedClassesSet.add(className);
                    candidates.push({
                        id: std.id,
                        order: idx + 1,
                        name: std.name || `تلميذ(ة) ${idx + 1}`,
                        massar: std.massar || '---',
                        className,
                        f1,
                        f2,
                        f3,
                        f4,
                        bestMark: parseFloat(bestMark.toFixed(2)),
                        avgMark,
                        qualifyingScore: parseFloat(scoreToCompare.toFixed(2)),
                        specialty: specialtyKey,
                        memberKey
                    });
                }
            });
        });

        candidates.sort((a, b) => {
            if (b.qualifyingScore !== a.qualifyingScore) return b.qualifyingScore - a.qualifyingScore;
            return b.avgMark - a.avgMark;
        });

        return {
            candidates,
            totalEvaluatedStudents,
            representedClassesCount: representedClassesSet.size,
            maxScore: candidates.length > 0 ? candidates[0].qualifyingScore : null,
            clubAvg: candidates.length > 0
                ? (candidates.reduce((acc, c) => acc + c.qualifyingScore, 0) / candidates.length).toFixed(2)
                : '--'
        };
    }

    function setOlympiadFilter(key, val) {
        if (key === 'threshold') {
            _olympiadState.threshold = parseFloat(val) || 17;
        } else if (_olympiadState[key] !== undefined) {
            _olympiadState[key] = val;
        }
        renderMathOlympiadClubCard();
    }

    function updateOlympiadMemberSpecialty(memberKey, specialtyCode) {
        const clubRegistry = getOrInitOlympiadClubRegistry();
        if (!clubRegistry.members[memberKey]) {
            clubRegistry.members[memberKey] = {};
        }
        clubRegistry.members[memberKey].specialty = specialtyCode;
        clubRegistry.members[memberKey].updatedAt = new Date().toISOString();
        if (typeof window.saveData === 'function') window.saveData();
        renderMathOlympiadClubCard();
        if (typeof window.showToast === 'function') {
            window.showToast('تم تحديث تخصص التلميذ(ة) في نادي أولمبياد الرياضيات', 'success');
        }
    }

    function scheduleMathOlympiadWorkshop() {
        const dateEl = document.getElementById('olympiadWorkshopDateInput');
        const timeEl = document.getElementById('olympiadWorkshopTimeInput');
        const roomEl = document.getElementById('olympiadWorkshopRoomInput');
        const topicEl = document.getElementById('olympiadWorkshopTopicInput');

        const clubRegistry = getOrInitOlympiadClubRegistry();
        const wDate = (dateEl && dateEl.value) ? dateEl.value : clubRegistry.workshop.date;
        const wTime = (timeEl && timeEl.value) ? timeEl.value : clubRegistry.workshop.time;
        const wRoom = (roomEl && roomEl.value) ? roomEl.value : clubRegistry.workshop.room;
        const wTopic = (topicEl && topicEl.value) ? topicEl.value : clubRegistry.workshop.topic;

        clubRegistry.workshop = { date: wDate, time: wTime, room: wRoom, topic: wTopic };

        const data = extractMathOlympiadCandidates();

        if (window.db) {
            if (!Array.isArray(window.db.agenda)) window.db.agenda = [];
            const eventId = `olympiad_workshop_${wDate}`;
            const eventObj = {
                id: eventId,
                title: `🏆 ورشة تأطير نادي أولمبياد الرياضيات والتميز (${data.candidates.length} تلميذ متميز)`,
                date: wDate,
                time: wTime,
                type: 'olympiad_club',
                category: 'نادي أولمبياد الرياضيات',
                room: wRoom,
                notes: `تأطير التلاميذ المتفوقين (≥ ${_olympiadState.threshold}/20) في جميع الأقسام. المحور: ${wTopic}`
            };
            const idx = window.db.agenda.findIndex(e => e && e.id === eventId);
            if (idx >= 0) window.db.agenda[idx] = eventObj;
            else window.db.agenda.push(eventObj);

            if (Array.isArray(window.db.events)) {
                const evIdx = window.db.events.findIndex(e => e && e.id === eventId);
                if (evIdx >= 0) window.db.events[evIdx] = eventObj;
                else window.db.events.push(eventObj);
            }
        }

        if (typeof window.saveData === 'function') window.saveData();
        renderMathOlympiadClubCard();

        if (typeof window.showToast === 'function') {
            window.showToast(`🏆 تم جدولة حصة تأطير نادي أولمبياد الرياضيات ليوم ${wDate} ومزامنتها مع التقويم التربوي`, 'success');
        }
    }

    function renderMathOlympiadClubCard() {
        const container = document.getElementById('dashMathOlympiadCard');
        if (!container) return;

        const classesList = getAvailableClasses();
        const data = extractMathOlympiadCandidates();
        const clubRegistry = getOrInitOlympiadClubRegistry();
        const workshop = clubRegistry.workshop;

        const criterionLabels = {
            best: 'أعلى نقطة محققة في الفروض',
            avg: 'معدل الفروض المحروسة للدورة',
            f1: 'نقطة الفرض المحروس 1',
            f2: 'نقطة الفرض المحروس 2',
            f3: 'نقطة الفرض المحروس 3'
        };

        let html = `
            <!-- ترويسة بطاقة نادي أولمبياد الرياضيات والتميز -->
            <div style="background: linear-gradient(135deg, #78350f 0%, #b45309 48%, #1e3a8a 100%); color: #ffffff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="width: 40px; height: 40px; border-radius: 10px; background: rgba(254,243,199,0.22); border: 1.5px solid #fcd34d; display: inline-flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 3px 10px rgba(0,0,0,0.18);">
                        🏆
                    </span>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 1.02rem; font-weight: 900; color: #ffffff;">
                                بطاقة ونادي أولمبياد الرياضيات والتميز (Club Olympiades de Mathématiques)
                            </h3>
                            <span style="background: #fef3c7; color: #92400e; font-size: 0.70rem; font-weight: 900; padding: 2px 9px; border-radius: 999px; border: 1px solid #fde68a;">
                                انتقاء آلي عابر للأقسام (≥ ${_olympiadState.threshold}/20)
                            </span>
                        </div>
                        <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #fde68a;">
                            فرز آلي للنخبة المتميزة في الرياضيات عبر جميع الأقسام المسندة، تصنيف التخصصات الأولمبية، وإصدار اللائحة الرسمية للإدارة والمديرية
                        </p>
                    </div>
                </div>

                <!-- شريط الفلاتر والأزرار -->
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <select onchange="window.setOlympiadFilter('classFilter', this.value)" style="background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(253,230,138,0.45); border-radius: 7px; padding: 5px 8px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                        <option value="all" ${_olympiadState.classFilter === 'all' ? 'selected' : ''} style="color:#0f172a;">جميع الأقسام (${classesList.length})</option>
                        ${classesList.map(c => `<option value="${escapeHtml(c)}" ${_olympiadState.classFilter === c ? 'selected' : ''} style="color:#0f172a;">القسم: ${escapeHtml(c)}</option>`).join('')}
                    </select>

                    <select onchange="window.setOlympiadFilter('semester', this.value)" style="background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(253,230,138,0.45); border-radius: 7px; padding: 5px 8px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                        <option value="s1" ${_olympiadState.semester === 's1' ? 'selected' : ''} style="color:#0f172a;">الدورة الأولى (S1)</option>
                        <option value="s2" ${_olympiadState.semester === 's2' ? 'selected' : ''} style="color:#0f172a;">الدورة الثانية (S2)</option>
                    </select>

                    <select onchange="window.setOlympiadFilter('criterion', this.value)" style="background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(253,230,138,0.45); border-radius: 7px; padding: 5px 8px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                        <option value="best" ${_olympiadState.criterion === 'best' ? 'selected' : ''} style="color:#0f172a;">المعيار: أعلى نقطة فرض</option>
                        <option value="avg" ${_olympiadState.criterion === 'avg' ? 'selected' : ''} style="color:#0f172a;">المعيار: معدل الفروض</option>
                        <option value="f1" ${_olympiadState.criterion === 'f1' ? 'selected' : ''} style="color:#0f172a;">المعيار: الفرض 1</option>
                        <option value="f2" ${_olympiadState.criterion === 'f2' ? 'selected' : ''} style="color:#0f172a;">المعيار: الفرض 2</option>
                        <option value="f3" ${_olympiadState.criterion === 'f3' ? 'selected' : ''} style="color:#0f172a;">المعيار: الفرض 3</option>
                    </select>

                    <select onchange="window.setOlympiadFilter('threshold', this.value)" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 7px; padding: 5px 8px; font-size: 0.75rem; font-weight: 900; cursor: pointer;">
                        <option value="16" ${_olympiadState.threshold === 16 ? 'selected' : ''}>عتبة الانتقاء: ≥ 16 / 20</option>
                        <option value="16.5" ${_olympiadState.threshold === 16.5 ? 'selected' : ''}>عتبة الانتقاء: ≥ 16.5 / 20</option>
                        <option value="17" ${_olympiadState.threshold === 17 ? 'selected' : ''}>عتبة الانتقاء: ≥ 17 / 20</option>
                        <option value="18" ${_olympiadState.threshold === 18 ? 'selected' : ''}>عتبة الانتقاء: ≥ 18 / 20</option>
                    </select>

                    <button type="button" onclick="window.printMathOlympiadOfficialRoster()" style="background: #ffffff; color: #92400e; border: none; border-radius: 7px; padding: 5px 12px; font-size: 0.75rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.18);">
                        <span>🖨️</span>
                        <span>طباعة لائحة المرشحين للأولمبياد (A4)</span>
                    </button>
                </div>
            </div>

            <div style="padding: 14px 18px;">
                <!-- شريط المؤشرات القياسية لنادي الأولمبياد -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 10px; margin-bottom: 14px;">
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #92400e; font-weight: 800;">🏅 أبطال النادي المؤهلون (≥ ${_olympiadState.threshold}/20)</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #b45309; margin-top: 2px;">
                            ${data.candidates.length} <span style="font-size: 0.76rem; font-weight: 700;">تلميذ(ة) متميز(ة)</span>
                        </div>
                        <div style="font-size: 0.69rem; color: #78350f;">من أصل ${data.totalEvaluatedStudents} تلميذ مقيّم</div>
                    </div>

                    <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #166534; font-weight: 800;">🌟 أعلى نقطة مسجلة بالنادي</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #15803d; margin-top: 2px;">
                            ${data.maxScore !== null ? data.maxScore.toFixed(2) : '--'} <span style="font-size: 0.78rem;">/ 20</span>
                        </div>
                        <div style="font-size: 0.69rem; color: #15803d;">معدل النخبة المنتقاة: ${data.clubAvg} / 20</div>
                    </div>

                    <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #1e40af; font-weight: 800;">🏫 التمثيلية حسب الأقسام</div>
                        <div style="font-size: 1.35rem; font-weight: 900; color: #1d4ed8; margin-top: 2px;">
                            ${data.representedClassesCount} <span style="font-size: 0.76rem; font-weight: 700;">أقسام ممثلة</span>
                        </div>
                        <div style="font-size: 0.69rem; color: #1e3a8a;">${escapeHtml(criterionLabels[_olympiadState.criterion] || '')}</div>
                    </div>

                    <div style="background: #f5f3ff; border: 1.5px solid #ddd6fe; border-radius: 10px; padding: 10px 12px;">
                        <div style="font-size: 0.72rem; color: #5b21b6; font-weight: 800;">📅 الورشة الأولمبية القادمة</div>
                        <div style="font-size: 0.96rem; font-weight: 900; color: #6d28d9; margin-top: 4px;">
                            ${escapeHtml(workshop.date)} (${escapeHtml(workshop.time)})
                        </div>
                        <div style="font-size: 0.69rem; color: #4c1d95;">${escapeHtml(workshop.room)}</div>
                    </div>
                </div>

                <!-- شريط برمجة ورشة تدريب أولمبياد الرياضيات ومزامنتها مع التقويم -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1;">
                        <span style="font-size: 0.76rem; font-weight: 900; color: #1e3a8a; white-space: nowrap;">🎯 برمجة حصة تأطير الأولمبياد:</span>
                        <input type="date" id="olympiadWorkshopDateInput" value="${escapeHtml(workshop.date)}" style="padding: 4px 7px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem; font-weight: 800;">
                        <input type="text" id="olympiadWorkshopTimeInput" value="${escapeHtml(workshop.time)}" placeholder="التوقيت" style="width: 110px; padding: 4px 7px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                        <input type="text" id="olympiadWorkshopRoomInput" value="${escapeHtml(workshop.room)}" placeholder="القاعة" style="width: 140px; padding: 4px 7px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                        <input type="text" id="olympiadWorkshopTopicInput" value="${escapeHtml(workshop.topic)}" placeholder="محور الورشة الأولمبية" style="flex: 1; min-width: 180px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.75rem;">
                    </div>
                    <button type="button" onclick="window.scheduleMathOlympiadWorkshop()" style="background: linear-gradient(135deg, #b45309, #92400e); color: #ffffff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
                        <span>🗓️</span>
                        <span>حفظ ومزامنة الورشة مع التقويم</span>
                    </button>
                </div>
        `;

        if (data.candidates.length === 0) {
            html += `
                <div style="background: #fffbeb; border: 1.5px dashed #fcd34d; border-radius: 10px; padding: 18px; text-align: center;">
                    <div style="font-weight: 900; color: #92400e; font-size: 0.9rem; margin-bottom: 4px;">
                        لا يوجد حالياً تلاميذ مسجلة لهم نقط تفوق أو تساوي ${_olympiadState.threshold}/20 وفق المعيار المحدد.
                    </div>
                    <div style="font-size: 0.76rem; color: #78350f; margin-bottom: 10px;">
                        يمكنك تخفيض عتبة الانتقاء إلى 16/20 أو توليد بيانات نقط تجريبية لمعاينة نادي أولمبياد الرياضيات والتميز:
                    </div>
                    <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" onclick="window.setOlympiadFilter('threshold', 16)" style="background: #ffffff; color: #92400e; border: 1px solid #f59e0b; padding: 6px 14px; border-radius: 7px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                            🔎 عرض التلاميذ الحاصلين على ≥ 16 / 20
                        </button>
                        <button type="button" onclick="window.seedDemoAcademicEvolutionGrades()" style="background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; border: none; padding: 6px 14px; border-radius: 7px; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
                            ✨ توليد نقط تجريبية للأقسام ومعاينة النادي
                        </button>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; max-height: 360px; overflow-y: auto; padding: 2px;">
                    ${data.candidates.map((cand, i) => {
                        const rankBadge = i === 0 ? '🥇 1' : (i === 1 ? '🥈 2' : (i === 2 ? '🥉 3' : `#${i + 1}`));
                        const specObj = OLYMPIAD_SPECIALTIES[cand.specialty] || OLYMPIAD_SPECIALTIES.all_round;
                        return `
                        <div style="background: linear-gradient(135deg, #ffffff 0%, #fffbeb 100%); border: 1.5px solid #fde68a; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; box-shadow: 0 2px 6px rgba(180,83,9,0.06);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-weight: 900; font-size: 0.78rem; padding: 3px 8px; border-radius: 7px;">
                                        ${rankBadge}
                                    </span>
                                    <div>
                                        <div style="font-weight: 900; font-size: 0.86rem; color: #0f172a;">${escapeHtml(cand.name)}</div>
                                        <div style="font-size: 0.71rem; color: #475569;">
                                            القسم: <strong style="color: #1e3a8a;">${escapeHtml(cand.className)}</strong> | مسار: <strong>${escapeHtml(cand.massar)}</strong>
                                        </div>
                                    </div>
                                </div>
                                <div style="text-align: left;">
                                    <span style="background: #15803d; color: #ffffff; font-weight: 900; font-size: 0.82rem; padding: 3px 9px; border-radius: 7px; display: inline-block;">
                                        ${cand.qualifyingScore.toFixed(2)} / 20
                                    </span>
                                    <div style="font-size: 0.67rem; color: #64748b; margin-top: 2px;">
                                        معدل الفروض: ${cand.avgMark.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 6px; font-size: 0.71rem; color: #334155; background: #ffffff; border: 1px solid #f1f5f9; border-radius: 6px; padding: 4px 8px; justify-content: space-around;">
                                <span>الفرض 1: <strong>${cand.f1 !== null ? cand.f1 : '--'}</strong></span>
                                <span>الفرض 2: <strong>${cand.f2 !== null ? cand.f2 : '--'}</strong></span>
                                <span>الفرض 3: <strong>${cand.f3 !== null ? cand.f3 : '--'}</strong></span>
                                <span style="color: #15803d;">أعلى نقطة: <strong>${cand.bestMark}</strong></span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; border-top: 1px dashed #fde68a; padding-top: 6px;">
                                <select onchange="window.updateOlympiadMemberSpecialty('${escapeHtml(cand.memberKey)}', this.value)" style="flex: 1; padding: 4px 6px; font-size: 0.72rem; font-weight: 800; border: 1px solid #fcd34d; border-radius: 6px; background: ${specObj.bg}; color: ${specObj.color}; cursor: pointer;">
                                    ${Object.entries(OLYMPIAD_SPECIALTIES).map(([k, v]) => `
                                        <option value="${k}" ${cand.specialty === k ? 'selected' : ''} style="background:#fff; color:#0f172a;">${v.label}</option>
                                    `).join('')}
                                </select>
                                <button type="button" onclick="window.printStudentOlympiadCertificate('${escapeHtml(cand.className)}', '${escapeHtml(String(cand.id))}')" style="background: #1e3a8a; color: #ffffff; border: none; border-radius: 6px; padding: 4px 9px; font-size: 0.71rem; font-weight: 800; cursor: pointer; white-space: nowrap;" title="طباعة شهادة التميز والترشيح لأولمبياد الرياضيات">
                                    🏅 شهادة الأولمبياد
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    /**
     * طباعة اللائحة الرسمية للتلاميذ المقترحين لنادي أولمبياد الرياضيات والتميز (A4 للإدارة والمديرية)
     */
    function printMathOlympiadOfficialRoster() {
        const data = extractMathOlympiadCandidates();
        const clubRegistry = getOrInitOlympiadClubRegistry();
        const workshop = clubRegistry.workshop;

        const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const school = tp.school || tp.institution || 'الثانوية التأهيلية';
        const academy = tp.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const direction = tp.direction || tp.province || 'المديرية الإقليمية';
        const teacher = tp.name || 'أستاذ(ة) مادة الرياضيات';
        const year = tp.schoolYear || tp.year || '2024 / 2025';
        const semLabel = _olympiadState.semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى';

        const fontFamily = typeof window.getSelectedPrintFontFamily === 'function'
            ? window.getSelectedPrintFontFamily()
            : "'Cairo', 'Amiri', sans-serif";
        const hwFontFamily = typeof window.getSelectedHandwritingFontFamily === 'function'
            ? window.getSelectedHandwritingFontFamily()
            : "'Aref Ruqaa', 'Marhey', serif";

        const rowsHtml = data.candidates.length > 0
            ? data.candidates.map((c, idx) => {
                const specObj = OLYMPIAD_SPECIALTIES[c.specialty] || OLYMPIAD_SPECIALTIES.all_round;
                return `
                    <tr>
                        <td style="text-align:center; font-weight:900;">${idx + 1}</td>
                        <td style="text-align:right; padding-right:8px; font-weight:800;">${escapeHtml(c.name)}</td>
                        <td style="text-align:center;">${escapeHtml(c.massar)}</td>
                        <td style="text-align:center; font-weight:800; color:#1e3a8a;">${escapeHtml(c.className)}</td>
                        <td style="text-align:center;">${c.f1 !== null ? c.f1.toFixed(2) : '--'}</td>
                        <td style="text-align:center;">${c.f2 !== null ? c.f2.toFixed(2) : '--'}</td>
                        <td style="text-align:center; font-weight:900; color:#15803d; background:#f0fdf4;">${c.bestMark.toFixed(2)} / 20</td>
                        <td style="text-align:center; font-weight:800;">${c.avgMark.toFixed(2)} / 20</td>
                        <td style="text-align:right; padding-right:6px; font-size:8pt;">${escapeHtml(specObj.label)}</td>
                        <td style="text-align:center; font-weight:800; color:#b45309;">مؤهل(ة) للأولمبياد</td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="10" style="text-align:center; padding:14px;">لا توجد بيانات مرشحين حالياً</td></tr>`;

        const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>لائحة التلاميذ المقترحين لنادي أولمبياد الرياضيات والتميز - ${escapeHtml(school)}</title>
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
        .page-wrap {
            width: 210mm; height: 297mm;
            padding: 8mm 10mm;
            display: flex; flex-direction: column; justify-content: space-between;
        }
        .hw-note {
            font-family: ${hwFontFamily} !important;
            color: #1e3a8a;
            font-size: 9.5pt;
        }
        table.olymp-table {
            width: 100%; border-collapse: collapse; font-size: 8.2pt; margin-top: 6px;
        }
        table.olymp-table th, table.olymp-table td {
            border: 1px solid #64748b; padding: 4.5px 5px;
        }
        table.olymp-table th {
            background: #1e3a8a; color: #ffffff; font-weight: 800; text-align: center;
        }
    </style>
</head>
<body>
    <div class="page-wrap">
        <div>
            <div style="height: 4px; background: linear-gradient(90deg, #b45309 0%, #eab308 50%, #1e3a8a 100%); border-radius: 2px; margin-bottom: 6px;"></div>
            <div style="border: 1.8px solid #b45309; border-radius: 8px; padding: 8px 12px; background: #fffbeb;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fde68a; padding-bottom: 5px; margin-bottom: 6px; font-size: 8.5pt;">
                    <div style="line-height: 1.4;">
                        <strong>المملكة المغربية</strong><br>
                        <span style="color: #1e3a8a; font-weight: 800;">وزارة التربية الوطنية والتعليم الأولي والرياضة</span><br>
                        <span>${escapeHtml(academy)} — ${escapeHtml(direction)}</span><br>
                        <strong>المؤسسة: ${escapeHtml(school)}</strong>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 13pt; font-weight: 900; color: #92400e;">🏆 اللائحة الرسمية للتلاميذ المرشحين لنادي أولمبياد الرياضيات والتميز</div>
                        <div style="font-size: 8.5pt; font-weight: 800; color: #1e3a8a; margin-top: 2px;">انتقاء النخبة المتفوقة في مادة الرياضيات (عتبة التميز: ≥ ${_olympiadState.threshold} / 20)</div>
                        <div style="font-size: 8pt; color: #475569; margin-top: 2px;">الموسم الدراسي: ${escapeHtml(year)} | ${semLabel}</div>
                    </div>
                    <div style="text-align: left; line-height: 1.4;">
                        <strong>المادة:</strong> الرياضيات<br>
                        <strong>الأقسام الممثلة:</strong> ${data.representedClassesCount} أقسام<br>
                        <strong>الأستاذ(ة) المؤطر(ة):</strong> ${escapeHtml(teacher)}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #ffffff; border: 1px solid #fde68a; border-radius: 6px; padding: 5px 10px; font-size: 8.2pt;">
                    <div><strong style="color:#92400e;">عدد المرشحين:</strong> <strong>${data.candidates.length} تلميذ(ة)</strong></div>
                    <div><strong style="color:#15803d;">أعلى نقطة مسجلة:</strong> <strong>${data.maxScore !== null ? data.maxScore.toFixed(2) : '--'} / 20</strong></div>
                    <div><strong style="color:#1e3a8a;">معدل النخبة:</strong> <strong>${data.clubAvg} / 20</strong></div>
                    <div><strong style="color:#6d28d9;">تاريخ ورشة التأطير:</strong> <strong>${escapeHtml(workshop.date)}</strong></div>
                </div>
            </div>

            <div style="margin-top: 8px;">
                <table class="olymp-table">
                    <thead>
                        <tr>
                            <th style="width: 34px;">الرتبة</th>
                            <th>الاسم الكامل للتلميذ(ة)</th>
                            <th style="width: 85px;">رمز مسار</th>
                            <th style="width: 72px;">القسم</th>
                            <th style="width: 52px;">الفرض 1</th>
                            <th style="width: 52px;">الفرض 2</th>
                            <th style="width: 68px;">أعلى نقطة</th>
                            <th style="width: 68px;">المعدل</th>
                            <th style="width: 150px;">مجال التميز الأولمبي</th>
                            <th style="width: 85px;">قرار الترشيح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 8px; border: 1.2px solid #cbd5e1; border-radius: 6px; padding: 7px 10px; background: #f8fafc; font-size: 8.4pt;">
                <strong style="color: #1e3a8a;">📌 برنامج التأطير البيداغوجي لنادي أولمبياد الرياضيات بالمؤسسة:</strong>
                <div class="hw-note" style="margin-top: 3px; line-height: 1.55;">
                    بناءً على النتائج المتميزة المحصل عليها في فروض المراقبة المستمرة لمادة الرياضيات، يقترح أستاذ المادة تسجيل التلاميذ الواردة أسماؤهم أعلاه ضمن "نادي أولمبياد الرياضيات والتميز" للمؤسسة، وبرمجة حصة تأطير خاصة يوم ${escapeHtml(workshop.date)} (${escapeHtml(workshop.time)}) بـ ${escapeHtml(workshop.room)} حول محور: "${escapeHtml(workshop.topic)}" استعداداً للمباريات الإقليمية والجهوية لأولمبياد الرياضيات.
                </div>
            </div>
        </div>

        <div>
            <div style="display: flex; justify-content: space-between; border-top: 1.5px dashed #94a3b8; padding-top: 6px; margin-top: 6px; font-size: 8.5pt;">
                <div style="width: 32%; text-align: center;">
                    <strong>توقيع الأستاذ(ة) منسق(ة) النادي:</strong><br>
                    <span class="hw-note">${escapeHtml(teacher)}</span>
                </div>
                <div style="width: 32%; text-align: center;">
                    <strong>تأشيرة السيد الناظر / الحارس العام:</strong><br>
                    <span style="color:#94a3b8;">....................................</span>
                </div>
                <div style="width: 32%; text-align: center;">
                    <strong>خاتم ومصادقة السيد مدير المؤسسة:</strong><br>
                    <span style="color:#94a3b8;">....................................</span>
                </div>
            </div>
            <div style="border-top: 1px solid #cbd5e1; padding-top: 3px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 7.2pt; color: #64748b;">
                <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · نادي أولمبياد الرياضيات والتميز (${escapeHtml(school)})</span>
                <span>وثيقة رسمية للإدارة التربوية والمديرية الإقليمية — A4</span>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: `لائحة_مرشحي_أولمبياد_الرياضيات_${school}`,
                orientation: 'portrait',
                subtitle: `اللائحة الرسمية للتلاميذ المقترحين لنادي أولمبياد الرياضيات والتميز (${data.candidates.length} تلميذ متميز)`
            });
        }
    }

    function printStudentOlympiadCertificate(className, studentId) {
        const data = extractMathOlympiadCandidates();
        const cand = data.candidates.find(c => c.className === className && String(c.id) === String(studentId)) || data.candidates[0];
        if (!cand) return;

        const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const school = tp.school || tp.institution || 'الثانوية التأهيلية';
        const academy = tp.academy || 'الأكاديمية الجهوية للتربية والتكوين';
        const direction = tp.direction || tp.province || 'المديرية الإقليمية';
        const teacher = tp.name || 'أستاذ(ة) مادة الرياضيات';
        const year = tp.schoolYear || tp.year || '2024 / 2025';
        const specObj = OLYMPIAD_SPECIALTIES[cand.specialty] || OLYMPIAD_SPECIALTIES.all_round;

        const fontFamily = typeof window.getSelectedPrintFontFamily === 'function'
            ? window.getSelectedPrintFontFamily()
            : "'Cairo', 'Amiri', sans-serif";
        const hwFontFamily = typeof window.getSelectedHandwritingFontFamily === 'function'
            ? window.getSelectedHandwritingFontFamily()
            : "'Aref Ruqaa', 'Marhey', serif";

        const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>شهادة التميز والعضوية في نادي أولمبياد الرياضيات - ${escapeHtml(cand.name)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800;900&family=Reem+Kufi:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 0 !important; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body {
            margin: 0 !important; padding: 0 !important;
            width: 297mm; height: 210mm;
            font-family: ${fontFamily};
            background: #ffffff; direction: rtl;
        }
        .cert-page {
            width: 297mm; height: 210mm; padding: 12mm;
            display: flex; align-items: center; justify-content: center;
        }
        .cert-frame {
            width: 100%; height: 100%;
            border: 4px double #b45309;
            border-radius: 16px;
            padding: 12mm 16mm;
            background: radial-gradient(circle at center, #ffffff 0%, #fffbeb 100%);
            display: flex; flex-direction: column; justify-content: space-between;
            text-align: center;
        }
        .hw-sig {
            font-family: ${hwFontFamily} !important;
            color: #1e3a8a;
            font-size: 13pt;
        }
    </style>
</head>
<body>
    <div class="cert-page">
        <div class="cert-frame">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #fde68a; padding-bottom:8px; font-size:9.5pt;">
                <div style="text-align:right;">
                    <strong>المملكة المغربية</strong><br>
                    وزارة التربية الوطنية والتعليم الأولي والرياضة<br>
                    ${escapeHtml(academy)} — ${escapeHtml(direction)}
                </div>
                <div style="font-size:24pt;">🏆</div>
                <div style="text-align:left;">
                    <strong>المؤسسة: ${escapeHtml(school)}</strong><br>
                    نادي أولمبياد الرياضيات والتميز<br>
                    الموسم الدراسي: ${escapeHtml(year)}
                </div>
            </div>

            <div>
                <div style="font-size:22pt; font-weight:900; color:#92400e; margin-bottom:6px;">
                    شهادة التميز والترشيح لأولمبياد الرياضيات
                </div>
                <div style="font-size:11pt; color:#1e3a8a; font-weight:800; margin-bottom:14px;">
                    Club Olympiades de Mathématiques &amp; d'Excellence
                </div>
                <div style="font-size:12pt; color:#334155; line-height:1.8;">
                    يشهد أستاذ مادة الرياضيات وإدارة مؤسسة <strong>${escapeHtml(school)}</strong> بأن التلميذ(ة) النجيب(ة):
                </div>
                <div style="font-size:20pt; font-weight:900; color:#1e3a8a; margin:8px 0; background:#fef3c7; display:inline-block; padding:4px 28px; border-radius:999px; border:1.5px solid #f59e0b;">
                    ${escapeHtml(cand.name)} (${escapeHtml(cand.className)})
                </div>
                <div style="font-size:11.5pt; color:#1e293b; line-height:1.8; max-width:85%; margin:8px auto;">
                    قد أبان(ت) عن تفوق علمي متميز واستدلال رياضي رفيع بحصوله(ها) على نقطة <strong style="color:#15803d;">${cand.bestMark.toFixed(2)} / 20</strong> (معدل الفروض: <strong>${cand.avgMark.toFixed(2)} / 20</strong>)، وبذلك يُمنح(تُمنح) العضوية الشرفية الكاملة في <strong>نادي أولمبياد الرياضيات والتميز</strong> في مجال: <strong style="color:#92400e;">${escapeHtml(specObj.label)}</strong>.
                </div>
            </div>

            <div style="display:flex; justify-content:space-around; align-items:center; border-top:1.5px dashed #fcd34d; padding-top:10px; font-size:10.5pt;">
                <div>
                    <strong>توقيع أستاذ(ة) مادة الرياضيات:</strong><br>
                    <span class="hw-sig">${escapeHtml(teacher)}</span>
                </div>
                <div>
                    <strong>خاتم وتوقيع السيد مدير المؤسسة:</strong><br>
                    <span style="color:#94a3b8;">........................................</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: `شهادة_أولمبياد_الرياضيات_${cand.name}`,
                orientation: 'landscape',
                subtitle: `شهادة التميز والعضوية في نادي أولمبياد الرياضيات — ${cand.name} (${cand.className})`
            });
        }
    }

    /**
     * تهيئة المكون
     */
    function initAcademicEvolutionDashboard() {
        const dashView = document.getElementById('dashboardView');
        if (dashView && dashView.style.display !== 'none') {
            renderAcademicEvolutionDashboard();
            renderMathOlympiadClubCard();
        }
    }

    // تصدير الدوال على الكائن العام
    window.renderAcademicEvolutionDashboard = renderAcademicEvolutionDashboard;
    window.calculateAcademicEvolution = calculateAcademicEvolution;
    window.setEvolutionFilter = setEvolutionFilter;
    window.setEvolutionTab = setEvolutionTab;
    window.seedDemoAcademicEvolutionGrades = seedDemoAcademicEvolutionGrades;
    window.printStudentImprovementCertificate = printStudentImprovementCertificate;
    window.sendWhatsAppImprovementMessage = sendWhatsAppImprovementMessage;
    window.printAcademicEvolutionReport = printAcademicEvolutionReport;
    window.initAcademicEvolutionDashboard = initAcademicEvolutionDashboard;
    window.renderMathOlympiadClubCard = renderMathOlympiadClubCard;
    window.setOlympiadFilter = setOlympiadFilter;
    window.updateOlympiadMemberSpecialty = updateOlympiadMemberSpecialty;
    window.scheduleMathOlympiadWorkshop = scheduleMathOlympiadWorkshop;
    window.printMathOlympiadOfficialRoster = printMathOlympiadOfficialRoster;
    window.printStudentOlympiadCertificate = printStudentOlympiadCertificate;

    // تهيئة عند اكتمال الـ DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAcademicEvolutionDashboard);
    } else {
        initAcademicEvolutionDashboard();
    }

})(window);
