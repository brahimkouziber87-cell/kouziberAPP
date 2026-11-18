/**
 * ============================================================================
 * محرك التقرير الإداري الشامل (المواظبة والغياب + النقط والمراقبة المستمرة) - PDF
 * Comprehensive School Administration PDF Report (All Students Attendance & Grading)
 * ============================================================================
 */
(function (window, document) {
    'use strict';

    function escapeHtml(val) {
        return String(val == null ? '' : val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hasValidMark(v) {
        return v !== undefined && v !== null && v !== '' && !isNaN(parseFloat(v));
    }

    function fmtMark(v) {
        if (v === null || v === undefined || v === '' || isNaN(parseFloat(v))) return '--';
        return Number(parseFloat(v)).toFixed(2);
    }

    function computeSemesterGradesObj(db, className, studentId, sem, examCount) {
        let raw = {};
        if (typeof window.getStudentGradesBySemester === 'function') {
            raw = window.getStudentGradesBySemester(className, studentId, sem) || {};
        } else {
            const rec = (db.grades && db.grades[className] && db.grades[className][studentId]) || {};
            if (sem === 's2') {
                const s2Direct = (db.gradesS2 && db.gradesS2[className] && db.gradesS2[className][studentId]) || {};
                raw = rec.s2 || s2Direct || {};
            } else {
                const s1Direct = (db.gradesS1 && db.gradesS1[className] && db.gradesS1[className][studentId]) || {};
                raw = rec.s1 || (hasValidMark(s1Direct.f1) || hasValidMark(s1Direct.f2) ? s1Direct : rec) || {};
            }
        }

        const keys = examCount === 4 ? ['f1', 'f2', 'f3', 'f4'] : (examCount === 2 ? ['f1', 'f2'] : ['f1', 'f2', 'f3']);
        let sum = 0;
        let count = 0;
        keys.forEach((k) => {
            if (hasValidMark(raw[k])) {
                sum += parseFloat(raw[k]);
                count++;
            }
        });

        return {
            f1: hasValidMark(raw.f1) ? parseFloat(raw.f1) : null,
            f2: hasValidMark(raw.f2) ? parseFloat(raw.f2) : null,
            f3: hasValidMark(raw.f3) ? parseFloat(raw.f3) : null,
            f4: hasValidMark(raw.f4) ? parseFloat(raw.f4) : null,
            avg: count > 0 ? Number((sum / count).toFixed(2)) : null
        };
    }

    function buildAdminReportDataset(options = {}) {
        const db = window.db || {};
        const scopeSemester = options.semester || 'annual'; // 'annual' | 's1' | 's2'
        const targetClass = options.classFilter || '__ALL__';
        const absenceThreshold = Number(db.absenceThreshold || 10);

        const allSortedClasses = (typeof window.getSortedClasses === 'function')
            ? window.getSortedClasses(false)
            : Object.keys(db.classes || {});

        const classesList = (targetClass && targetClass !== '__ALL__' && allSortedClasses.includes(targetClass))
            ? [targetClass]
            : allSortedClasses;

        const recordsByStudentClass = new Map();
        const rawRecords = Array.isArray(db.records) ? db.records : [];
        for (let i = 0; i < rawRecords.length; i++) {
            const r = rawRecords[i];
            if (!r) continue;
            if (typeof window.isRecordProtectedHolidayOrLeave === 'function' && window.isRecordProtectedHolidayOrLeave(r)) {
                continue;
            }
            const key = `${r.studentId || ''}__${r.className || ''}`;
            if (!recordsByStudentClass.has(key)) recordsByStudentClass.set(key, []);
            recordsByStudentClass.get(key).push(r);
        }

        const classSummaries = [];
        const allAlertStudents = [];

        let globalStudents = 0;
        let globalAbsentHours = 0;
        let globalUnjustifiedHours = 0;
        let globalJustifiedHours = 0;
        let globalLateCount = 0;
        let globalMissedHomework = 0;
        let globalAssessedCount = 0;
        let globalPassCount = 0;
        let globalAvgSum = 0;
        let globalAbsenceAlertCount = 0;
        let globalAcademicAlertCount = 0;

        classesList.forEach((clsName) => {
            const students = Array.isArray(db.classes && db.classes[clsName]) ? db.classes[clsName] : [];
            const examCount = (typeof window.getExamsCountForClass === 'function') ? window.getExamsCountForClass(clsName) : 3;
            const cfg = (db.classConfig && db.classConfig[clsName]) || {};
            const levelLabel = cfg.level || cfg.levelName || (typeof window.detectLevelFromClassName === 'function' ? window.detectLevelFromClassName(clsName) : '') || 'ثانوي تأهيلي';

            let clsAbsentHours = 0;
            let clsUnjustifiedHours = 0;
            let clsJustifiedHours = 0;
            let clsLateCount = 0;
            let clsMissedHw = 0;

            let clsS1Sum = 0, clsS1Count = 0;
            let clsS2Sum = 0, clsS2Count = 0;
            let clsSelectedSum = 0, clsSelectedCount = 0, clsPassCount = 0;
            let clsMaxAvg = null, clsMinAvg = null;
            let clsAlertCount = 0;

            const studentRows = students.map((std, idx) => {
                const stdRecords = recordsByStudentClass.get(`${std.id}__${clsName}`) || [];
                let absentHours = 0;
                let unjustifiedHours = 0;
                let justifiedHours = 0;
                let lateCount = 0;
                let missedHw = 0;

                stdRecords.forEach((r) => {
                    const dur = (typeof window.getRecordAbsenceDuration === 'function')
                        ? window.getRecordAbsenceDuration(r, 1)
                        : ((r.part === 'h1' || r.part === 'h2') ? 1 : (parseFloat(r.duration || r.hours) || 1));
                    if (r.status === 'غائب') {
                        absentHours += dur;
                        unjustifiedHours += dur;
                    } else if (r.status === 'مبرر') {
                        absentHours += dur;
                        justifiedHours += dur;
                    }
                    if (r.status === 'متأخر' || r.late === true || r.isLate === true) {
                        lateCount += 1;
                    }
                    if (r.homework === 'لم ينجز') {
                        missedHw += 1;
                    }
                });

                const s1 = computeSemesterGradesObj(db, clsName, std.id, 's1', examCount);
                const s2 = computeSemesterGradesObj(db, clsName, std.id, 's2', examCount);

                let annualAvg = null;
                if (s1.avg !== null && s2.avg !== null) {
                    annualAvg = Number(((s1.avg + s2.avg) / 2).toFixed(2));
                } else if (s1.avg !== null) {
                    annualAvg = s1.avg;
                } else if (s2.avg !== null) {
                    annualAvg = s2.avg;
                }

                const primaryAvg = scopeSemester === 's1'
                    ? s1.avg
                    : (scopeSemester === 's2' ? s2.avg : annualAvg);

                clsAbsentHours += absentHours;
                clsUnjustifiedHours += unjustifiedHours;
                clsJustifiedHours += justifiedHours;
                clsLateCount += lateCount;
                clsMissedHw += missedHw;

                if (s1.avg !== null) { clsS1Sum += s1.avg; clsS1Count++; }
                if (s2.avg !== null) { clsS2Sum += s2.avg; clsS2Count++; }
                if (primaryAvg !== null) {
                    clsSelectedSum += primaryAvg;
                    clsSelectedCount++;
                    if (primaryAvg >= 10) clsPassCount++;
                    if (clsMaxAvg === null || primaryAvg > clsMaxAvg) clsMaxAvg = primaryAvg;
                    if (clsMinAvg === null || primaryAvg < clsMinAvg) clsMinAvg = primaryAvg;
                }

                const isHighAbsence = absentHours >= absenceThreshold || unjustifiedHours >= Math.max(4, Math.floor(absenceThreshold * 0.6));
                const isAtRiskAcademic = primaryAvg !== null && primaryAvg < 10;

                if (isHighAbsence) globalAbsenceAlertCount++;
                if (isAtRiskAcademic) globalAcademicAlertCount++;

                let statusLabel = 'في طور التقييم';
                let statusColor = '#475569';
                let statusBg = '#f1f5f9';

                if (isHighAbsence && isAtRiskAcademic) {
                    statusLabel = 'تنبيه إداري مزدوج';
                    statusColor = '#991b1b';
                    statusBg = '#fee2e2';
                } else if (isHighAbsence) {
                    statusLabel = 'تجاوز عتبة الغياب';
                    statusColor = '#b45309';
                    statusBg = '#fef3c7';
                } else if (isAtRiskAcademic) {
                    statusLabel = 'يحتاج دعماً (<10)';
                    statusColor = '#be123c';
                    statusBg = '#ffe4e6';
                } else if (primaryAvg !== null && primaryAvg >= 16) {
                    statusLabel = 'امتياز وتفوق';
                    statusColor = '#166534';
                    statusBg = '#dcfce7';
                } else if (primaryAvg !== null && primaryAvg >= 14) {
                    statusLabel = 'حسن جداً';
                    statusColor = '#15803d';
                    statusBg = '#ecfdf5';
                } else if (primaryAvg !== null && primaryAvg >= 10) {
                    statusLabel = 'مستوفٍ';
                    statusColor = '#0369a1';
                    statusBg = '#e0f2fe';
                }

                if (isHighAbsence || isAtRiskAcademic) {
                    clsAlertCount++;
                    allAlertStudents.push({
                        className: clsName,
                        name: std.name || 'تلميذ(ة)',
                        massar: std.massar || std.code || '--',
                        absentHours,
                        unjustifiedHours,
                        justifiedHours,
                        lateCount,
                        primaryAvg,
                        isHighAbsence,
                        isAtRiskAcademic,
                        statusLabel
                    });
                }

                return {
                    num: std.orderNum || (idx + 1),
                    id: std.id,
                    massar: std.massar || std.code || '--',
                    name: std.name || 'بدون اسم',
                    absentHours,
                    unjustifiedHours,
                    justifiedHours,
                    lateCount,
                    missedHw,
                    s1,
                    s2,
                    annualAvg,
                    primaryAvg,
                    isHighAbsence,
                    isAtRiskAcademic,
                    statusLabel,
                    statusColor,
                    statusBg
                };
            });

            globalStudents += students.length;
            globalAbsentHours += clsAbsentHours;
            globalUnjustifiedHours += clsUnjustifiedHours;
            globalJustifiedHours += clsJustifiedHours;
            globalLateCount += clsLateCount;
            globalMissedHomework += clsMissedHw;
            globalAssessedCount += clsSelectedCount;
            globalPassCount += clsPassCount;
            globalAvgSum += clsSelectedSum;

            classSummaries.push({
                className: clsName,
                levelLabel,
                examCount,
                studentsCount: students.length,
                absentHours: clsAbsentHours,
                unjustifiedHours: clsUnjustifiedHours,
                justifiedHours: clsJustifiedHours,
                avgAbsentPerStudent: students.length > 0 ? Number((clsAbsentHours / students.length).toFixed(1)) : 0,
                lateCount: clsLateCount,
                missedHw: clsMissedHw,
                s1Avg: clsS1Count > 0 ? Number((clsS1Sum / clsS1Count).toFixed(2)) : null,
                s2Avg: clsS2Count > 0 ? Number((clsS2Sum / clsS2Count).toFixed(2)) : null,
                overallAvg: clsSelectedCount > 0 ? Number((clsSelectedSum / clsSelectedCount).toFixed(2)) : null,
                passRate: clsSelectedCount > 0 ? Math.round((clsPassCount / clsSelectedCount) * 100) : null,
                passCount: clsPassCount,
                assessedCount: clsSelectedCount,
                maxAvg: clsMaxAvg,
                minAvg: clsMinAvg,
                alertCount: clsAlertCount,
                students: studentRows
            });
        });

        // ترتيب قائمة التنبيهات الإدارية حسب خطورة الغياب والتعثر
        allAlertStudents.sort((a, b) => {
            const scoreA = (a.isHighAbsence ? 100 : 0) + (a.isAtRiskAcademic ? 50 : 0) + a.unjustifiedHours;
            const scoreB = (b.isHighAbsence ? 100 : 0) + (b.isAtRiskAcademic ? 50 : 0) + b.unjustifiedHours;
            return scoreB - scoreA;
        });

        const tp = db.teacherProfile || db.profile || {};
        const settings = db.settings || {};

        return {
            meta: {
                academy: tp.academy || settings.academy || 'الأكاديمية الجهوية للتربية والتكوين',
                directorate: tp.directorate || settings.directorate || 'المديرية الإقليمية',
                school: tp.school || settings.schoolName || 'الثانوية التأهيلية',
                teacherName: tp.name || settings.teacherName || 'الأستاذ إبراهيم قزيبر',
                academicYear: db.academicYear || tp.academicYear || settings.schoolYear || '2026 / 2027',
                subject: 'الرياضيات - السلك الثانوي التأهيلي',
                dateStr: new Date().toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' }),
                timeStr: new Date().toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' }),
                absenceThreshold,
                scopeSemester,
                scopeLabel: scopeSemester === 's1' ? 'الدورة الأولى (S1)' : (scopeSemester === 's2' ? 'الدورة الثانية (S2)' : 'الحصيلة السنوية الموحدة (S1 + S2)')
            },
            totals: {
                classesCount: classSummaries.length,
                studentsCount: globalStudents,
                absentHours: globalAbsentHours,
                unjustifiedHours: globalUnjustifiedHours,
                justifiedHours: globalJustifiedHours,
                lateCount: globalLateCount,
                missedHomework: globalMissedHomework,
                assessedCount: globalAssessedCount,
                passCount: globalPassCount,
                passRate: globalAssessedCount > 0 ? Math.round((globalPassCount / globalAssessedCount) * 100) : null,
                globalAvg: globalAssessedCount > 0 ? Number((globalAvgSum / globalAssessedCount).toFixed(2)) : null,
                absenceAlertCount: globalAbsenceAlertCount,
                academicAlertCount: globalAcademicAlertCount,
                totalAlerts: allAlertStudents.length
            },
            classSummaries,
            alertStudents: allAlertStudents
        };
    }

    function buildAdminComprehensiveHtml(dataset, options = {}) {
        const includeRosters = options.includeRosters !== false;
        const includeAlertsList = options.includeAlertsList !== false;
        const m = dataset.meta;
        const t = dataset.totals;

        const classSummaryRowsHtml = dataset.classSummaries.map((c, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; white-space: nowrap;">${idx + 1}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; color: #1e3a8a; text-align: right; white-space: nowrap;">${escapeHtml(c.className)}</td>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9.5px; color: #475569; text-align: right;">${escapeHtml(c.levelLabel)}</td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; white-space: nowrap;">${c.studentsCount}</td>
                <td style="padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; white-space: nowrap; color: ${c.unjustifiedHours > 0 ? '#b91c1c' : '#334155'};">${c.absentHours} س <span style="font-size: 8.5px; color: #64748b;">(${c.unjustifiedHours} غ.م / ${c.justifiedHours} م)</span></td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; white-space: nowrap;">${c.lateCount}</td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 800; white-space: nowrap;">${fmtMark(c.s1Avg)}</td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 800; white-space: nowrap;">${fmtMark(c.s2Avg)}</td>
                <td style="padding: 6px 6px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 900; color: #0f172a; background: #eff6ff; white-space: nowrap;">${fmtMark(c.overallAvg)}</td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 900; white-space: nowrap; color: ${c.passRate !== null && c.passRate >= 50 ? '#15803d' : '#b91c1c'};">${c.passRate !== null ? c.passRate + '%' : '--'}</td>
                <td style="padding: 6px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; white-space: nowrap; color: ${c.alertCount > 0 ? '#b91c1c' : '#15803d'};">${c.alertCount}</td>
            </tr>
        `).join('');

        let alertSectionHtml = '';
        if (includeAlertsList && dataset.alertStudents.length > 0) {
            const topAlerts = dataset.alertStudents.slice(0, 45);
            const alertRows = topAlerts.map((a, idx) => `
                <tr style="background: ${idx % 2 === 0 ? '#fff' : '#fff7ed'}; page-break-inside: avoid;">
                    <td style="padding: 5px 5px; border: 1px solid #fed7aa; text-align: center; font-weight: 800; white-space: nowrap;">${idx + 1}</td>
                    <td style="padding: 5px 7px; border: 1px solid #fed7aa; font-weight: 800; color: #1e3a8a; text-align: right; white-space: nowrap;">${escapeHtml(a.className)}</td>
                    <td style="padding: 5px 6px; border: 1px solid #fed7aa; font-family: monospace; font-size: 9px; text-align: center; white-space: nowrap;">${escapeHtml(a.massar)}</td>
                    <td style="padding: 5px 8px; border: 1px solid #fed7aa; font-weight: 800; text-align: right;">${escapeHtml(a.name)}</td>
                    <td style="padding: 5px 6px; border: 1px solid #fed7aa; text-align: center; font-weight: 900; white-space: nowrap; color: ${a.isHighAbsence ? '#b91c1c' : '#334155'};">${a.absentHours} س (${a.unjustifiedHours} غ.م)</td>
                    <td style="padding: 5px 5px; border: 1px solid #fed7aa; text-align: center; font-weight: 700; white-space: nowrap;">${a.lateCount}</td>
                    <td style="padding: 5px 6px; border: 1px solid #fed7aa; text-align: center; font-family: monospace; font-weight: 900; white-space: nowrap; color: ${a.isAtRiskAcademic ? '#b91c1c' : '#15803d'};">${fmtMark(a.primaryAvg)}</td>
                    <td style="padding: 5px 7px; border: 1px solid #fed7aa; text-align: center; font-weight: 800; color: #9a3412; white-space: nowrap;">${escapeHtml(a.statusLabel)}</td>
                </tr>
            `).join('');

            alertSectionHtml = `
                <div style="margin-top: 14px; border: 1.5px solid #fdba74; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
                    <div style="background: #fff7ed; padding: 7px 12px; border-bottom: 1.5px solid #fdba74; display: flex; justify-content: space-between; align-items: center;">
                        <strong style="font-size: 11px; color: #9a3412;">⚠️ لائحة الرصد والتنبيه الإداري المبكر (تجاوز عتبة الغياب ${m.absenceThreshold} س أو التعثر الدراسي &lt; 10/20)</strong>
                        <span style="font-size: 9.5px; font-weight: 800; color: #c2410c;">الإجمالي المرصود: ${dataset.alertStudents.length} تلميذ(ة)</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.8px; table-layout: auto;">
                        <thead>
                            <tr style="background: #ffedd5; color: #7c2d12;">
                                <th style="padding: 5px 4px; border: 1px solid #fed7aa; width: 28px; white-space: nowrap;">#</th>
                                <th style="padding: 5px 7px; border: 1px solid #fed7aa; text-align: right; width: 85px; white-space: nowrap;">القسم</th>
                                <th style="padding: 5px 6px; border: 1px solid #fed7aa; width: 82px; white-space: nowrap;">رقم مسار</th>
                                <th style="padding: 5px 8px; border: 1px solid #fed7aa; text-align: right; min-width: 165px;">الاسم الكامل</th>
                                <th style="padding: 5px 6px; border: 1px solid #fed7aa; width: 95px; white-space: nowrap;">الغياب (س)</th>
                                <th style="padding: 5px 5px; border: 1px solid #fed7aa; width: 54px; white-space: nowrap;">التأخرات</th>
                                <th style="padding: 5px 6px; border: 1px solid #fed7aa; width: 68px; white-space: nowrap;">المعدل (/20)</th>
                                <th style="padding: 5px 7px; border: 1px solid #fed7aa; width: 145px; white-space: nowrap;">التصنيف الإداري</th>
                            </tr>
                        </thead>
                        <tbody>${alertRows}</tbody>
                    </table>
                </div>
            `;
        }

        let rostersHtml = '';
        if (includeRosters) {
            rostersHtml = dataset.classSummaries.map((c) => {
                const showS1Cols = m.scopeSemester === 'annual' || m.scopeSemester === 's1';
                const showS2Cols = m.scopeSemester === 'annual' || m.scopeSemester === 's2';
                const semExamCols = (c.examCount || 3) + 1;
                const totalRosterCols = 3 + (showS1Cols ? semExamCols : 0) + (showS2Cols ? semExamCols : 0) + 5;

                const rows = c.students.map((st, sIdx) => `
                    <tr style="background: ${sIdx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
                        <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; white-space: nowrap;">${st.num}</td>
                        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 9px; text-align: center; white-space: nowrap;">${escapeHtml(st.massar)}</td>
                        <td style="padding: 4px 7px; border: 1px solid #cbd5e1; font-weight: 800; color: #0f172a; text-align: right;">${escapeHtml(st.name)}</td>
                        ${showS1Cols ? `
                            <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s1.f1)}</td>
                            <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s1.f2)}</td>
                            ${c.examCount >= 3 ? `<td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s1.f3)}</td>` : ''}
                            ${c.examCount === 4 ? `<td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s1.f4)}</td>` : ''}
                            <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 900; background: #eff6ff; color: #1e3a8a; white-space: nowrap;">${fmtMark(st.s1.avg)}</td>
                        ` : ''}
                        ${showS2Cols ? `
                            <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s2.f1)}</td>
                            <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s2.f2)}</td>
                            ${c.examCount >= 3 ? `<td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s2.f3)}</td>` : ''}
                            ${c.examCount === 4 ? `<td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; white-space: nowrap;">${fmtMark(st.s2.f4)}</td>` : ''}
                            <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 900; background: #f0fdf4; color: #166534; white-space: nowrap;">${fmtMark(st.s2.avg)}</td>
                        ` : ''}
                        <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: 900; background: #faf5ff; white-space: nowrap; color: ${st.primaryAvg !== null && st.primaryAvg < 10 ? '#b91c1c' : '#581c87'};">${fmtMark(st.primaryAvg)}</td>
                        <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; white-space: nowrap; color: ${st.isHighAbsence ? '#b91c1c' : '#0f172a'};">${st.absentHours} س</td>
                        <td style="padding: 4px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; color: #475569; white-space: nowrap;">${st.unjustifiedHours} / ${st.justifiedHours}</td>
                        <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; white-space: nowrap;">${st.lateCount}</td>
                        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px; font-weight: 800; background: ${st.statusBg}; color: ${st.statusColor}; white-space: nowrap;">${escapeHtml(st.statusLabel)}</td>
                    </tr>
                `).join('');

                return `
                    <div class="admin-class-roster-section" style="page-break-before: always; margin-top: 18px;">
                        <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                            <div>
                                <div style="font-size: 13px; font-weight: 900; color: #1e3a8a;">📋 الكشف الإداري المفصل للمواظبة والنقط — القسم: ${escapeHtml(c.className)}</div>
                                <div style="font-size: 9.5px; color: #475569; font-weight: 700;">${escapeHtml(c.levelLabel)} · عدد التلاميذ: ${c.studentsCount} · ${escapeHtml(m.scopeLabel)}</div>
                            </div>
                            <div style="display: flex; gap: 8px; font-size: 9.5px; font-weight: 800;">
                                <span style="background: #eff6ff; color: #1e40af; padding: 3px 8px; border-radius: 5px; border: 1px solid #bfdbfe;">المعدل العام: ${fmtMark(c.overallAvg)}/20</span>
                                <span style="background: #f0fdf4; color: #15803d; padding: 3px 8px; border-radius: 5px; border: 1px solid #bbf7d0;">نسبة الاستيفاء: ${c.passRate !== null ? c.passRate + '%' : '--'}</span>
                                <span style="background: #fff1f2; color: #be123c; padding: 3px 8px; border-radius: 5px; border: 1px solid #fecdd3;">مجموع الغياب: ${c.absentHours} س (${c.unjustifiedHours} غ.م)</span>
                            </div>
                        </div>

                        <table style="width: 100%; border-collapse: collapse; font-size: 9.4px; table-layout: auto;">
                            <thead>
                                <tr style="background: #1e293b; color: #ffffff;">
                                    <th style="padding: 5px 3px; border: 1px solid #334155; width: 26px; white-space: nowrap;">#</th>
                                    <th style="padding: 5px 4px; border: 1px solid #334155; width: 76px; white-space: nowrap;">مسار</th>
                                    <th style="padding: 5px 7px; border: 1px solid #334155; text-align: right; min-width: 150px;">الاسم الكامل للتلميذ(ة)</th>
                                    ${showS1Cols ? `
                                        <th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د1 ف1</th>
                                        <th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د1 ف2</th>
                                        ${c.examCount >= 3 ? '<th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د1 ف3</th>' : ''}
                                        ${c.examCount === 4 ? '<th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د1 ف4</th>' : ''}
                                        <th style="padding: 5px 4px; border: 1px solid #334155; background: #1e3a8a; width: 46px; white-space: nowrap;">معدل د1</th>
                                    ` : ''}
                                    ${showS2Cols ? `
                                        <th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د2 ف1</th>
                                        <th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د2 ف2</th>
                                        ${c.examCount >= 3 ? '<th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د2 ف3</th>' : ''}
                                        ${c.examCount === 4 ? '<th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">د2 ف4</th>' : ''}
                                        <th style="padding: 5px 4px; border: 1px solid #334155; background: #14532d; width: 46px; white-space: nowrap;">معدل د2</th>
                                    ` : ''}
                                    <th style="padding: 5px 4px; border: 1px solid #334155; background: #4c1d95; width: 52px; white-space: nowrap;">المعدل المعتمد</th>
                                    <th style="padding: 5px 4px; border: 1px solid #334155; width: 42px; white-space: nowrap;">الغياب</th>
                                    <th style="padding: 5px 4px; border: 1px solid #334155; width: 56px; white-space: nowrap;">غ.م / مبرر</th>
                                    <th style="padding: 5px 3px; border: 1px solid #334155; width: 34px; white-space: nowrap;">تأخر</th>
                                    <th style="padding: 5px 6px; border: 1px solid #334155; width: 105px; white-space: nowrap;">الملاحظة الإدارية</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || `<tr><td colspan="${totalRosterCols}" style="padding: 10px; text-align: center; border: 1px solid #cbd5e1;">لا يوجد تلاميذ مسجلون في هذا القسم</td></tr>`}
                            </tbody>
                        </table>

                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; font-size: 9.5px; font-weight: 800; text-align: center; page-break-inside: avoid;">
                            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 7px; min-height: 46px;">توقيع أستاذ المادة:<br><span style="color: #1e3a8a;">${escapeHtml(m.teacherName)}</span></div>
                            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 7px; min-height: 46px;">ملاحظات وتأشيرة الحراسة العامة:</div>
                            <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 7px; min-height: 46px;">تأشيرة السيدة المديرة / السيد المدير:<br><span style="color: #64748b; font-size: 8.5px;">(خاتم المؤسسة)</span></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        return `
            <div style="font-family: 'Cairo', system-ui, sans-serif; direction: rtl; color: #0f172a; line-height: 1.45;">
                <!-- Official Administrative Header -->
                <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px;">
                    <div style="height: 3.5px; background: linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%); border-radius: 2px; margin-bottom: 8px;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <div style="font-size: 10px; font-weight: 800; line-height: 1.5; color: #334155;">
                            <div style="font-size: 11.5px; font-weight: 900; color: #0f172a;">المملكة المغربية</div>
                            <div style="color: #1e3a8a;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                            <div>${escapeHtml(m.academy)}</div>
                            <div>${escapeHtml(m.directorate)} · المؤسسة: <strong>${escapeHtml(m.school)}</strong></div>
                        </div>
                        <div style="text-align: center; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 7px 14px;">
                            <div style="font-size: 13px; font-weight: 900; color: #1e3a8a;">التقرير الإداري الشامل للمواظبة والنقط</div>
                            <div style="font-size: 9.5px; font-weight: 700; color: #475569;">ملخص موجه لإدارة المؤسسة والحراسة العامة — ${escapeHtml(m.subject)}</div>
                            <div style="margin-top: 3px; display: inline-block; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 800;">${escapeHtml(m.scopeLabel)}</div>
                        </div>
                        <div style="font-size: 10px; font-weight: 800; line-height: 1.5; text-align: left; color: #334155;">
                            <div>الأستاذ(ة): <strong style="color: #0f172a;">${escapeHtml(m.teacherName)}</strong></div>
                            <div>الموسم الدراسي: <strong style="color: #1e3a8a;">${escapeHtml(m.academicYear)}</strong></div>
                            <div>تاريخ التحرير: ${escapeHtml(m.dateStr)} (${escapeHtml(m.timeStr)})</div>
                            <div>عتبة تنبيه الغياب: <strong>${m.absenceThreshold} ساعات</strong></div>
                        </div>
                    </div>
                </div>

                <!-- School-Wide Executive KPI Strip -->
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px;">
                    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #0369a1; font-weight: 800;">الأقسام والتلاميذ</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #0c4a6e;">${t.classesCount} / ${t.studentsCount}</div>
                    </div>
                    <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #be123c; font-weight: 800;">إجمالي ساعات الغياب</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #9f1239;">${t.absentHours} س</div>
                    </div>
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #c2410c; font-weight: 800;">غير مبرر / مبرر</div>
                        <div style="font-size: 12px; font-weight: 900; color: #9a3412;">${t.unjustifiedHours} س / ${t.justifiedHours} س</div>
                    </div>
                    <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #6d28d9; font-weight: 800;">المعدل العام المجمع</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #4c1d95;">${fmtMark(t.globalAvg)} / 20</div>
                    </div>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #15803d; font-weight: 800;">نسبة الاستيفاء (≥10)</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #14532d;">${t.passRate !== null ? t.passRate + '%' : '--'}</div>
                    </div>
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; padding: 7px 8px; text-align: center;">
                        <div style="font-size: 9px; color: #b91c1c; font-weight: 800;">حالات التنبيه الإداري</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #991b1b;">${t.totalAlerts} حالة</div>
                    </div>
                </div>

                <!-- Per-Class Executive Summary Matrix -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 900; color: #1e3a8a; margin-bottom: 6px;">
                        📊 أولاً: الخلاصة التركيبية الإجمالية حسب الأقسام المسندة (المواظبة والنتائج الدراسية):
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px; table-layout: auto;">
                        <thead>
                            <tr style="background: #0f172a; color: #ffffff;">
                                <th style="padding: 6px 4px; border: 1px solid #334155; width: 28px; white-space: nowrap;">#</th>
                                <th style="padding: 6px 8px; border: 1px solid #334155; text-align: right; width: 105px; white-space: nowrap;">القسم</th>
                                <th style="padding: 6px 8px; border: 1px solid #334155; text-align: right; min-width: 140px;">المستوى</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 52px; white-space: nowrap;">التلاميذ</th>
                                <th style="padding: 6px 6px; border: 1px solid #334155; width: 115px; white-space: nowrap;">ساعات الغياب</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 52px; white-space: nowrap;">التأخرات</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 58px; white-space: nowrap;">معدل د1</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 58px; white-space: nowrap;">معدل د2</th>
                                <th style="padding: 6px 6px; border: 1px solid #334155; background: #1e3a8a; width: 66px; white-space: nowrap;">المعدل العام</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 56px; white-space: nowrap;">النجاح</th>
                                <th style="padding: 6px 5px; border: 1px solid #334155; width: 54px; white-space: nowrap;">تنبيهات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classSummaryRowsHtml || '<tr><td colspan="11" style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">لا توجد أقسام مسجلة حالياً</td></tr>'}
                        </tbody>
                    </table>
                </div>

                ${alertSectionHtml}

                <!-- Official Cover Signatures -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; font-size: 9.8px; font-weight: 800; text-align: center; page-break-inside: avoid;">
                    <div style="border: 1px dashed #94a3b8; border-radius: 7px; padding: 8px; min-height: 54px;">توقيع أستاذ المادة:<br><span style="color: #1e3a8a;">${escapeHtml(m.teacherName)}</span></div>
                    <div style="border: 1px dashed #94a3b8; border-radius: 7px; padding: 8px; min-height: 54px;">تأشيرة الحراسة العامة:<br><span style="color: #64748b; font-size: 8.5px;">(متابعة المواظبة والانضباط)</span></div>
                    <div style="border: 1px dashed #94a3b8; border-radius: 7px; padding: 8px; min-height: 54px;">تأشيرة الإدارة التربوية:<br><span style="color: #64748b; font-size: 8.5px;">(خاتم وتوقيع السيد(ة) المدير(ة))</span></div>
                </div>

                ${rostersHtml}
            </div>
        `;
    }

    async function exportHtmlDirectlyToPdf(htmlContent, fileName, orientation = 'landscape') {
        if (typeof window.html2pdf !== 'function' && typeof window.ensureHtml2PdfLoaded === 'function') {
            await window.ensureHtml2PdfLoaded();
        }
        if (typeof window.html2pdf !== 'function') {
            if (typeof window.openCustomPrintPreviewModal === 'function') {
                window.openCustomPrintPreviewModal(htmlContent, {
                    title: fileName.replace(/\.pdf$/i, ''),
                    orientation,
                    subtitle: 'التقرير الإداري الشامل للمواظبة والنقط (A4)'
                });
            }
            return Promise.resolve(false);
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `position:fixed; left:-99999px; top:0; width:${orientation === 'landscape' ? '297mm' : '210mm'}; background:#ffffff; color:#0f172a; padding:6mm 8mm; box-sizing:border-box; direction:rtl; z-index:-9999;`;
        tempContainer.innerHTML = htmlContent;
        document.body.appendChild(tempContainer);

        const opt = {
            margin: [6, 6, 6, 6],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        return window.html2pdf().set(opt).from(tempContainer).save().then(() => {
            tempContainer.remove();
            return true;
        }).catch((err) => {
            tempContainer.remove();
            throw err;
        });
    }

    function renderAdminPdfModalBody() {
        const bodyEl = document.getElementById('adminComprehensivePdfBody');
        if (!bodyEl) return;

        const semEl = document.getElementById('adminPdfScopeSemester');
        const clsEl = document.getElementById('adminPdfScopeClass');
        const rostersEl = document.getElementById('adminPdfIncludeRosters');
        const alertsEl = document.getElementById('adminPdfIncludeAlerts');
        const orientEl = document.getElementById('adminPdfOrientation');

        const semester = semEl ? semEl.value : 'annual';
        const classFilter = clsEl ? clsEl.value : '__ALL__';

        const dataset = buildAdminReportDataset({ semester, classFilter });
        const t = dataset.totals;

        const statsContainer = document.getElementById('adminPdfLiveStatsGrid');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:0.72rem; color:#0369a1; font-weight:700;">الأقسام / التلاميذ</div>
                    <div style="font-size:1.15rem; font-weight:900; color:#0c4a6e;">${t.classesCount} / ${t.studentsCount}</div>
                </div>
                <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:0.72rem; color:#be123c; font-weight:700;">إجمالي الغياب</div>
                    <div style="font-size:1.15rem; font-weight:900; color:#9f1239;">${t.absentHours} ساعة</div>
                </div>
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:0.72rem; color:#15803d; font-weight:700;">نسبة الاستيفاء</div>
                    <div style="font-size:1.15rem; font-weight:900; color:#14532d;">${t.passRate !== null ? t.passRate + '%' : '--'}</div>
                </div>
                <div style="background:#faf5ff; border:1px solid #e9d5ff; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:0.72rem; color:#6d28d9; font-weight:700;">المعدل العام</div>
                    <div style="font-size:1.15rem; font-weight:900; color:#581c87;">${fmtMark(t.globalAvg)} / 20</div>
                </div>
                <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:10px; text-align:center;">
                    <div style="font-size:0.72rem; color:#c2410c; font-weight:700;">حالات التنبيه</div>
                    <div style="font-size:1.15rem; font-weight:900; color:#9a3412;">${t.totalAlerts} تلميذ</div>
                </div>
            `;
        }

        const tablePreview = document.getElementById('adminPdfClassSummaryPreview');
        if (tablePreview) {
            if (dataset.classSummaries.length === 0) {
                tablePreview.innerHTML = `<div style="padding:18px; text-align:center; color:#64748b; font-size:0.84rem;">لا توجد أقسام مسجلة حالياً في قاعدة البيانات.</div>`;
            } else {
                tablePreview.innerHTML = `
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem; table-layout:auto;">
                        <thead>
                            <tr style="background:#f1f5f9; color:#1e293b;">
                                <th style="padding:7px 8px; border-bottom:1px solid #cbd5e1; text-align:right; min-width:110px;">القسم</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">التلاميذ</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">الغياب (س)</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">التأخرات</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">المعدل (/20)</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">النجاح</th>
                                <th style="padding:7px 6px; border-bottom:1px solid #cbd5e1; white-space:nowrap;">التنبيهات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dataset.classSummaries.map((c) => `
                                <tr>
                                    <td style="padding:6px 8px; border-bottom:1px solid #e2e8f0; font-weight:800; color:#1e3a8a; text-align:right; white-space:nowrap;">${escapeHtml(c.className)}</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; white-space:nowrap;">${c.studentsCount}</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; color:#b91c1c; font-weight:700; white-space:nowrap;">${c.absentHours} (${c.unjustifiedHours} غ.م)</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; white-space:nowrap;">${c.lateCount}</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; font-family:monospace; font-weight:800; white-space:nowrap;">${fmtMark(c.overallAvg)}</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; font-weight:800; color:#15803d; white-space:nowrap;">${c.passRate !== null ? c.passRate + '%' : '--'}</td>
                                    <td style="padding:6px 6px; border-bottom:1px solid #e2e8f0; text-align:center; font-weight:800; white-space:nowrap; color:${c.alertCount > 0 ? '#b91c1c' : '#64748b'};">${c.alertCount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }

        // Preserve option compatibility
        if (rostersEl && alertsEl && orientEl) {
            // values read dynamically on export
        }
    }

    function openAdminComprehensivePdfModal() {
        let modal = document.getElementById('adminComprehensivePdfModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'adminComprehensivePdfModal';
            modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,0.78); backdrop-filter:blur(5px); z-index:13500; align-items:center; justify-content:center; padding:14px; direction:rtl; font-family:"Cairo",sans-serif; box-sizing:border-box;';
            document.body.appendChild(modal);
        }

        const classesList = (typeof window.getSortedClasses === 'function')
            ? window.getSortedClasses(false)
            : Object.keys((window.db && window.db.classes) || {});

        const classOptionsHtml = [
            `<option value="__ALL__">📚 جميع الأقسام المسندة (${classesList.length} أقسام)</option>`,
            ...classesList.map((c) => `<option value="${escapeHtml(c)}">القسم: ${escapeHtml(c)}</option>`)
        ].join('');

        modal.innerHTML = `
            <div class="card" style="width:100%; max-width:780px; max-height:92vh; overflow-y:auto; background:#ffffff; border-radius:16px; border:1.5px solid #cbd5e1; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); padding:0; display:flex; flex-direction:column;">
                <!-- Header -->
                <div style="padding:15px 20px; background:linear-gradient(135deg,#0f172a,#1e3a8a); color:#ffffff; border-top-left-radius:14px; border-top-right-radius:14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="width:40px; height:40px; border-radius:10px; background:rgba(16,185,129,0.22); border:1.5px solid rgba(52,211,153,0.5); color:#6ee7b7; display:inline-flex; align-items:center; justify-content:center;">
                            <span data-lucide="file-spreadsheet" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin:0; font-size:1.06rem; font-weight:900; color:#f8fafc;">التقرير الإداري الشامل للمواظبة والنقط (PDF)</h3>
                            <p style="margin:2px 0 0 0; font-size:0.75rem; color:#cbd5e1;">ملخص موحد وشامل لجميع التلاميذ (الغياب، التأخرات، نقط الفروض والمعدلات) مصمم لإدارة المؤسسة</p>
                        </div>
                    </div>
                    <button type="button" onclick="window.closeAdminComprehensivePdfModal()" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#e2e8f0; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:1.1rem; font-weight:bold;">✕</button>
                </div>

                <!-- Body -->
                <div id="adminComprehensivePdfBody" style="padding:18px 20px; flex:1;">
                    <!-- Live KPI Strip -->
                    <div id="adminPdfLiveStatsGrid" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(125px,1fr)); gap:8px; margin-bottom:16px;"></div>

                    <!-- Filters & Configuration -->
                    <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:12px 14px; margin-bottom:14px;">
                        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px; margin-bottom:10px;">
                            <div>
                                <label for="adminPdfScopeSemester" style="display:block; font-size:0.76rem; font-weight:800; color:#334155; margin-bottom:4px;">الدورة الدراسية / النطاق:</label>
                                <select id="adminPdfScopeSemester" onchange="window.refreshAdminComprehensivePdfStats()" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:0.82rem; font-weight:700; background:#ffffff; color:#0f172a;">
                                    <option value="annual" selected>📊 الحصيلة السنوية الشاملة (الدورة 1 + 2)</option>
                                    <option value="s1">📘 الدورة الأولى فقط (S1)</option>
                                    <option value="s2">📗 الدورة الثانية فقط (S2)</option>
                                </select>
                            </div>
                            <div>
                                <label for="adminPdfScopeClass" style="display:block; font-size:0.76rem; font-weight:800; color:#334155; margin-bottom:4px;">نطاق الأقسام:</label>
                                <select id="adminPdfScopeClass" onchange="window.refreshAdminComprehensivePdfStats()" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:0.82rem; font-weight:700; background:#ffffff; color:#0f172a;">
                                    ${classOptionsHtml}
                                </select>
                            </div>
                            <div>
                                <label for="adminPdfOrientation" style="display:block; font-size:0.76rem; font-weight:800; color:#334155; margin-bottom:4px;">توجيه صفحة A4:</label>
                                <select id="adminPdfOrientation" style="width:100%; padding:8px 10px; border-radius:8px; border:1.5px solid #cbd5e1; font-size:0.82rem; font-weight:700; background:#ffffff; color:#0f172a;">
                                    <option value="landscape" selected>📐 أفقي (Landscape) - موصى به للجدول الكامل</option>
                                    <option value="portrait">📄 عمودي (Portrait)</option>
                                </select>
                            </div>
                        </div>

                        <div style="display:flex; gap:16px; flex-wrap:wrap; padding-top:6px; border-top:1px dashed #cbd5e1;">
                            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700; color:#1e293b; cursor:pointer;">
                                <input type="checkbox" id="adminPdfIncludeAlerts" checked style="width:16px; height:16px; accent-color:#059669;">
                                <span>تضمين لائحة التنبيه الإداري المبكر (تجاوز الغياب أو التعثر)</span>
                            </label>
                            <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700; color:#1e293b; cursor:pointer;">
                                <input type="checkbox" id="adminPdfIncludeRosters" checked style="width:16px; height:16px; accent-color:#059669;">
                                <span>تضمين الكشوفات الفردية الكاملة لجميع التلاميذ (المواظبة + الفروض)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Quick Class Summary Table Preview -->
                    <div style="border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:14px;">
                        <div style="background:#f8fafc; padding:8px 12px; border-bottom:1px solid #e2e8f0; font-size:0.8rem; font-weight:800; color:#1e3a8a;">
                            معاينة الخلاصة التركيبية حسب الأقسام قبل التصدير:
                        </div>
                        <div id="adminPdfClassSummaryPreview" style="max-height:210px; overflow-y:auto;"></div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap; flex:1;">
                            <button type="button" id="btnDownloadAdminComprehensivePdf" onclick="window.downloadAdminComprehensivePdfDirectly()" style="flex:1; min-width:210px; background:linear-gradient(135deg,#059669,#047857); color:#ffffff; border:none; padding:11px 16px; border-radius:10px; font-weight:900; font-size:0.88rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(5,150,105,0.28);">
                                <span data-lucide="download" data-size="16"></span>
                                <span>توليد وتحميل ملف PDF للإدارة مباشرة</span>
                            </button>
                            <button type="button" onclick="window.previewAdminComprehensivePdfReport()" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8); color:#ffffff; border:none; padding:11px 16px; border-radius:10px; font-weight:800; font-size:0.86rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:7px;">
                                <span data-lucide="printer" data-size="16"></span>
                                <span>معاينة وطباعة رسمية (A4)</span>
                            </button>
                        </div>
                        <button type="button" onclick="window.closeAdminComprehensivePdfModal()" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:10px 16px; border-radius:10px; font-weight:700; font-size:0.84rem; cursor:pointer;">
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        renderAdminPdfModalBody();
        if (window.renderLucide) window.renderLucide(modal);
        if (window.lucide) window.lucide.createIcons();
    }

    function getModalExportOptions() {
        const semester = document.getElementById('adminPdfScopeSemester')?.value || 'annual';
        const classFilter = document.getElementById('adminPdfScopeClass')?.value || '__ALL__';
        const includeRosters = document.getElementById('adminPdfIncludeRosters')?.checked !== false;
        const includeAlertsList = document.getElementById('adminPdfIncludeAlerts')?.checked !== false;
        const orientation = document.getElementById('adminPdfOrientation')?.value || 'landscape';
        return { semester, classFilter, includeRosters, includeAlertsList, orientation };
    }

    async function downloadAdminComprehensivePdfDirectly() {
        const opts = getModalExportOptions();
        const dataset = buildAdminReportDataset(opts);
        if (dataset.totals.classesCount === 0) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('⚠️ لا توجد أقسام نشطة لتوليد التقرير الإداري.', 'warning');
            }
            return;
        }

        const btn = document.getElementById('btnDownloadAdminComprehensivePdf');
        const origHtml = btn ? btn.innerHTML : '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ جاري إعداد وتصدير ملف PDF الإداري الشامل...</span>';
        }

        try {
            const html = buildAdminComprehensiveHtml(dataset, opts);
            const today = new Date().toISOString().slice(0, 10);
            const clsSlug = opts.classFilter === '__ALL__' ? 'جميع_الأقسام' : opts.classFilter.replace(/\s+/g, '_');
            const fileName = `التقرير_الإداري_الشامل_المواظبة_والنقط_${clsSlug}_${today}.pdf`;

            await exportHtmlDirectlyToPdf(html, fileName, opts.orientation);

            if (typeof window.showAppToast === 'function') {
                window.showAppToast('✅ تم توليد وتحميل التقرير الإداري الشامل (PDF) بنجاح.', 'success');
            }
        } catch (err) {
            console.error('Admin comprehensive PDF export error:', err);
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('⚠️ تعذر توليد ملف PDF مباشرة؛ جاري فتح نافذة المعاينة والطباعة البديلة.', 'warning');
            }
            previewAdminComprehensivePdfReport();
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = origHtml;
                if (window.renderLucide) window.renderLucide(btn);
            }
        }
    }

    function previewAdminComprehensivePdfReport() {
        const opts = getModalExportOptions();
        const dataset = buildAdminReportDataset(opts);
        if (dataset.totals.classesCount === 0) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('⚠️ لا توجد أقسام نشطة لمعاينة التقرير الإداري.', 'warning');
            }
            return;
        }
        const html = buildAdminComprehensiveHtml(dataset, opts);
        closeAdminComprehensivePdfModal();

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(html, {
                title: 'التقرير_الإداري_الشامل_للمواظبة_والنقط',
                orientation: opts.orientation,
                subtitle: `ملخص إداري موحد لجميع التلاميذ (${dataset.totals.studentsCount} تلميذ · ${dataset.totals.classesCount} أقسام)`
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(html, 'التقرير الإداري الشامل للمواظبة والنقط', opts.orientation);
        }
    }

    function closeAdminComprehensivePdfModal() {
        const modal = document.getElementById('adminComprehensivePdfModal');
        if (modal) modal.style.display = 'none';
    }

    window.buildAdminComprehensiveDataset = buildAdminReportDataset;
    window.openAdminComprehensivePdfModal = openAdminComprehensivePdfModal;
    window.closeAdminComprehensivePdfModal = closeAdminComprehensivePdfModal;
    window.refreshAdminComprehensivePdfStats = renderAdminPdfModalBody;
    window.downloadAdminComprehensivePdfDirectly = downloadAdminComprehensivePdfDirectly;
    window.previewAdminComprehensivePdfReport = previewAdminComprehensivePdfReport;
})(window, document);
