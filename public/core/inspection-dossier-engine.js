/**
 * ============================================================================
 * محرك توليد ملف التفتيش التربوي ومجالس الأقسام الموحد (Inspection & Council Readiness Dossier)
 * المسار: /public/core/inspection-dossier-engine.js
 * ============================================================================
 * يوفر:
 * - تجميع شامل لمعطيات الأستاذ، الغلاف الزمني، نسب إنجاز المقرر، إحصائيات الأقسام، ولائحة الدعم
 * - توليد وثيقة رسمية بصيغة A4 جاهزة للطباعة أو التصدير بصيغة PDF عبر نافذة المعاينة الرسمية
 * ============================================================================
 */
(function (window) {
    'use strict';

    function escapeText(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * بناء نموذج البيانات الشامل لملف التفتيش التربوي ومجالس الأقسام
     */
    function buildOfficialInspectionDossierModel(customDb) {
        const db = customDb || (window.db && typeof window.db === 'object' ? window.db : { classes: {} });
        const profile = db.teacherProfile || {};
        const classesObj = db.classes && typeof db.classes === 'object' ? db.classes : {};
        const classNames = Object.keys(classesObj);
        const semester = db.currentSemester === 's2' ? 's2' : 's1';

        const ttSummary = (window.TimetableEngine && typeof window.TimetableEngine.calculateWeeklyTeachingHours === 'function')
            ? window.TimetableEngine.calculateWeeklyTeachingHours(db.timetable)
            : { totalWeeklyHours: 0, byClass: {} };

        const classSummaries = [];
        const remediationTargets = [];
        let totalStudentsAll = 0;

        classNames.forEach(clsName => {
            const clsData = classesObj[clsName] || {};
            const students = Array.isArray(clsData) ? clsData : (Array.isArray(clsData.students) ? clsData.students : []);
            totalStudentsAll += students.length;

            const streamCfg = (window.GradesCalculator && typeof window.GradesCalculator.getStreamOfficialConfig === 'function')
                ? window.GradesCalculator.getStreamOfficialConfig(clsName)
                : { label: 'التعليم الثانوي', coefficient: 4, examsPerSemester: 3 };

            const averages = [];
            students.forEach(st => {
                if (!st) return;
                const g = (st.grades && st.grades[semester]) ? st.grades[semester] : (st.grades || {});
                let avg = null;
                if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                    avg = window.GradesCalculator.calculateStudentSemesterAverage(g);
                }
                if (avg !== null) {
                    averages.push(avg);
                    if (avg < 10) {
                        remediationTargets.push({
                            className: clsName,
                            name: st.name || 'تلميذ(ة)',
                            massarCode: st.massarCode || st.cne || '-',
                            average: avg,
                            gapToPass: Number((10 - avg).toFixed(2))
                        });
                    }
                }
            });

            const stats = (window.GradesCalculator && typeof window.GradesCalculator.calculateClassStatisticalMetrics === 'function')
                ? window.GradesCalculator.calculateClassStatisticalMetrics(averages, 10)
                : { count: averages.length, mean: 0, median: 0, stdDev: 0, passRate: 0, strugglingCount: 0, excellentCount: 0 };

            const logs = Array.isArray(clsData.lessonLog)
                ? clsData.lessonLog
                : (db.lessonLogs && Array.isArray(db.lessonLogs[clsName]) ? db.lessonLogs[clsName] : []);

            const loggedHours = logs.reduce((acc, l) => acc + (Number(l && (l.duration || l.hours || 1)) || 1), 0);
            const officialWeekly = Number(streamCfg.weeklyHours) || 5;
            const plannedAnnualHours = officialWeekly * 34;
            const curriculumCompletionPct = Math.min(100, Number(((loggedHours / Math.max(1, plannedAnnualHours)) * 100).toFixed(1)));

            classSummaries.push({
                className: clsName,
                streamLabel: streamCfg.label,
                coefficient: streamCfg.coefficient,
                examsPerSemester: streamCfg.examsPerSemester || 3,
                examDurationHours: streamCfg.examDurationHours || 2,
                homeworkPerSemester: streamCfg.homeworkPerSemester || streamCfg.examsPerSemester || 3,
                officialWeeklyHours: officialWeekly,
                plannedAnnualHours,
                loggedHours,
                curriculumCompletionPct,
                studentCount: students.length,
                evaluatedCount: stats.count,
                mean: stats.mean,
                median: stats.median,
                stdDev: stats.stdDev,
                passRate: stats.passRate,
                strugglingCount: stats.strugglingCount,
                excellentCount: stats.excellentCount,
                loggedSessionsCount: logs.length,
                weeklyHours: ttSummary.byClass[clsName] || officialWeekly
            });
        });

        remediationTargets.sort((a, b) => a.average - b.average);

        return {
            generatedDate: new Date().toISOString().slice(0, 10),
            semesterLabel: semester === 's2' ? 'الأسدس الثاني' : 'الأسدس الأول',
            teacher: {
                name: profile.name || 'أستاذ(ة) المادة',
                academy: profile.academy || 'الأكاديمية الجهوية للتربية والتكوين',
                directorate: profile.directorate || 'المديرية الإقليمية',
                school: profile.school || 'المؤسسة التعليمية',
                academicYear: profile.academicYear || (() => {
                    if (typeof window.getCurrentAcademicYear === 'function') return window.getCurrentAcademicYear();
                    const now = new Date();
                    const y = now.getFullYear();
                    return (now.getMonth() + 1) >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
                })()
            },
            totalClasses: classNames.length,
            totalStudents: totalStudentsAll,
            totalWeeklyHours: ttSummary.totalWeeklyHours,
            classSummaries,
            remediationTargets: remediationTargets.slice(0, 25)
        };
    }

    /**
     * توليد قالب HTML الرسمي لملف التفتيش التربوي ومجالس الأقسام
     */
    function renderOfficialInspectionDossierHtml(customDb) {
        const model = buildOfficialInspectionDossierModel(customDb);
        const rowsHtml = model.classSummaries.length > 0
            ? model.classSummaries.map((c, i) => `
                <tr>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:800;">${i + 1}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;font-weight:800;color:#1e3a8a;">${escapeText(c.className)}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;">${escapeText(c.streamLabel)}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:800;">${c.coefficient}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:700;color:#6d28d9;">${c.examsPerSemester || 3} (${c.examDurationHours || 2}س)</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;">${c.studentCount}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:800;color:#0f172a;">${c.mean.toFixed(2)}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:800;color:${c.passRate >= 50 ? '#166534' : '#991b1b'};">${c.passRate}%</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;">${c.stdDev.toFixed(2)}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;color:#065f46;font-weight:800;">${c.excellentCount}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;color:#991b1b;font-weight:800;">${c.strugglingCount}</td>
                    <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${c.loggedSessionsCount} حصة (${c.loggedHours || 0}س / ${c.plannedAnnualHours || 170}س)</td>
                </tr>
            `).join('')
            : `<tr><td colspan="12" style="padding:14px;text-align:center;border:1px solid #cbd5e1;color:#64748b;">لا توجد أقسام مسجلة حالياً</td></tr>`;

        const remRowsHtml = model.remediationTargets.length > 0
            ? model.remediationTargets.slice(0, 12).map((r, idx) => `
                <tr>
                    <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
                    <td style="padding:6px;border:1px solid #cbd5e1;font-weight:800;">${escapeText(r.name)}</td>
                    <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;">${escapeText(r.massarCode)}</td>
                    <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${escapeText(r.className)}</td>
                    <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;color:#991b1b;font-weight:900;">${r.average.toFixed(2)} / 20</td>
                    <td style="padding:6px;border:1px solid #cbd5e1;text-align:center;color:#9a3412;font-weight:700;">-${r.gapToPass.toFixed(2)} ن</td>
                </tr>
            `).join('')
            : `<tr><td colspan="6" style="padding:12px;text-align:center;border:1px solid #cbd5e1;color:#166534;">لا توجد حالات تعثر مسجلة دون العتبة حالياً</td></tr>`;

        return `
            <div class="report-page" style="font-family:'Cairo',sans-serif;direction:rtl;color:#0f172a;padding:10px;font-variant-numeric:tabular-nums;">
                <div style="border:2px solid #1e3a8a;border-radius:12px;padding:14px 18px;margin-bottom:16px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-size:0.82rem;font-weight:800;line-height:1.6;color:#1e293b;">
                        <div>المملكة المغربية</div>
                        <div>وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل</div>
                        <div>${escapeText(model.teacher.academy)}</div>
                        <div>${escapeText(model.teacher.directorate)} — ${escapeText(model.teacher.school)}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:1.15rem;font-weight:900;color:#1e3a8a;">ملف التفتيش التربوي وحصيلة مجالس الأقسام</div>
                        <div style="font-size:0.84rem;font-weight:800;color:#475569;margin-top:4px;">مادة الرياضيات | ${escapeText(model.semesterLabel)} — الموسم الدراسي ${escapeText(model.teacher.academicYear)}</div>
                        <div style="font-size:0.73rem;font-weight:700;color:#1d4ed8;margin-top:2px;">مؤطر وفق التوجيهات التربوية (نونبر 2007) والمذكرة الوزارية رقم 142-08 (16 نونبر 2007)</div>
                    </div>
                    <div style="font-size:0.82rem;font-weight:800;line-height:1.6;text-align:left;color:#1e293b;">
                        <div>الأستاذ(ة): ${escapeText(model.teacher.name)}</div>
                        <div>تاريخ الإعداد: ${escapeText(model.generatedDate)}</div>
                        <div>عدد الأقسام المسندة: ${model.totalClasses}</div>
                        <div>مجموع التلاميذ: ${model.totalStudents}</div>
                    </div>
                </div>

                <h4 style="margin:12px 0 8px 0;font-size:0.95rem;font-weight:900;color:#1e3a8a;border-right:4px solid #2563eb;padding-right:8px;">
                    1. الحصيلة الإحصائية والبيداغوجية للأقسام المسندة (وفق المذكرة 142-08)
                </h4>
                <table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:16px;">
                    <thead>
                        <tr style="background:#eff6ff;color:#1e3a8a;">
                            <th style="padding:7px;border:1px solid #93c5fd;">#</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">القسم</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">المسلك / السلك</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">المعامل</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">فروض الدورة</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">التلاميذ</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">المعدل العام</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">الاستيفاء (≥10)</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">الانحراف</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">المتفوقون (≥14)</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">المتعثرون (&lt;8)</th>
                            <th style="padding:7px;border:1px solid #93c5fd;">حصص دفتر النصوص والغلاف</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>

                <h4 style="margin:12px 0 8px 0;font-size:0.95rem;font-weight:900;color:#991b1b;border-right:4px solid #dc2626;padding-right:8px;">
                    2. لائحة التلاميذ ذوي الأولوية في الدعم الاستدراكي والمعالجة البيداغوجية
                </h4>
                <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:16px;">
                    <thead>
                        <tr style="background:#fef2f2;color:#991b1b;">
                            <th style="padding:6px;border:1px solid #fca5a5;">رتبة الأولوية</th>
                            <th style="padding:6px;border:1px solid #fca5a5;">الاسم الكامل للتلميذ(ة)</th>
                            <th style="padding:6px;border:1px solid #fca5a5;">رقم مسار</th>
                            <th style="padding:6px;border:1px solid #fca5a5;">القسم</th>
                            <th style="padding:6px;border:1px solid #fca5a5;">المعدل الدوري</th>
                            <th style="padding:6px;border:1px solid #fca5a5;">الفارق عن عتبة الاستيفاء</th>
                        </tr>
                    </thead>
                    <tbody>${remRowsHtml}</tbody>
                </table>

                <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:0.76rem;line-height:1.55;color:#334155;">
                    <div style="font-weight:900;color:#1e3a8a;margin-bottom:3px;">3. ضوابط التقويم التربوي المعتمدة وفق المذكرة الوزارية رقم 142-08 (الصفحة 9) والتوجيهات التربوية (2007):</div>
                    <div>• <strong>بنية الفروض المحروسة:</strong> تغطية ≥ 75% من فقرات البرنامج المقررة في الفترة البينية، مع توزيع الأسئلة وفق المستويات المهارية المعتمدة: 60% م1 و40% م2 للتعليم الأصيل والآداب والفنون التطبيقية، و10% إلى 20% م3 مع التوازن بين م1 وم2 لباقي الجذوع والشعب العلمية والتقنية والاقتصادية.</div>
                    <div>• <strong>استثمار الفروض المنزلية وحصص التصحيح:</strong> تغطية المستويين المهاريين الثاني والثالث بنسبة 30% إلى 60% في الفروض المنزلية، مع تخصيص حصة رسمية لتصحيح كل فرض محروس ودعم التعثرات المرصودة وتوثيقها في دفتر النصوص.</div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px;text-align:center;font-size:0.82rem;font-weight:800;">
                    <div style="border:1.5px dashed #94a3b8;border-radius:10px;padding:12px 10px 38px 10px;">توقيع الأستاذ(ة)</div>
                    <div style="border:1.5px dashed #94a3b8;border-radius:10px;padding:12px 10px 38px 10px;">تأشيرة السيد(ة) المدير(ة)</div>
                    <div style="border:1.5px dashed #94a3b8;border-radius:10px;padding:12px 10px 38px 10px;">تأشيرة السيد(ة) المفتش(ة) التربوي(ة)</div>
                </div>
            </div>
        `;
    }

    /**
     * فتح ملف التفتيش التربوي ومجالس الأقسام مباشرة في نافذة المعاينة والطباعة
     */
    function generateOfficialInspectionDossierPrint(customDb) {
        const html = renderOfficialInspectionDossierHtml(customDb);
        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(html, {
                title: 'ملف_التفتيش_التربوي_ومجالس_الأقسام_A4',
                subtitle: 'وثيقة رسمية موحدة تتضمن الحصيلة الإحصائية للأقسام ولائحة الدعم التربوي وتأشيرات الإدارة والتفتيش',
                orientation: 'portrait'
            });
        }
        return html;
    }

    const InspectionDossierEngine = {
        buildOfficialInspectionDossierModel,
        renderOfficialInspectionDossierHtml,
        generateOfficialInspectionDossierPrint
    };

    window.InspectionDossierEngine = InspectionDossierEngine;
    window.generateOfficialInspectionDossierPrint = generateOfficialInspectionDossierPrint;
})(typeof window !== 'undefined' ? window : globalThis);
