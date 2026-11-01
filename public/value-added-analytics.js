/**
 * ====================================================================
 * وحدة مؤشر القيمة المضافة وتحليل التجانس الصفي (المحور الرابع الإحصائي)
 * Value-Added Pedagogical Analytics & Classroom Homogeneity Engine
 * ====================================================================
 * يقارن التحصيل بين روائز التقويم التشخيصي وفروض المراقبة المستمرة،
 * ويحسب مؤشر القيمة المضافة التربوية (IVAP)، والانحراف المعياري،
 * ومعامل الاختلاف (CV) لتحديد التباين الصفي ودعم قرارات مجالس الأقسام.
 */

(function (window) {
    'use strict';

    const _vaState = {
        selectedClass: '',
        semester: 's1'
    };

    /**
     * استخراج نقطة التقويم التشخيصي للتلميذ إن وجدت (على 20)
     */
    function getStudentDiagnosticScore(className, studentId) {
        const db = window.db || {};
        // 1. التحقق من قاعدة بيانات التقويم التشخيصي المعتمدة (db.diagnostic)
        if (db.diagnostic && db.diagnostic[className] && db.diagnostic[className][studentId] !== undefined) {
            const dEntry = db.diagnostic[className][studentId];
            if (typeof dEntry === 'number' && !isNaN(dEntry)) return dEntry;
            if (dEntry && typeof dEntry === 'object') {
                if (dEntry.total !== undefined && !isNaN(parseFloat(dEntry.total))) return parseFloat(dEntry.total);
                if (dEntry.totalScore !== undefined && !isNaN(parseFloat(dEntry.totalScore))) return parseFloat(dEntry.totalScore);
                if (dEntry.score !== undefined && !isNaN(parseFloat(dEntry.score))) return parseFloat(dEntry.score);
                const sumD = ['d1', 'd2', 'd3', 'd4'].reduce((acc, k) => acc + (parseFloat(dEntry[k]) || 0), 0);
                if (sumD > 0) return parseFloat(sumD.toFixed(2));
            }
        }
        // 2. التحقق من البنية البديلة (db.diagnosticEvaluation)
        if (db.diagnosticEvaluation && db.diagnosticEvaluation[className] && db.diagnosticEvaluation[className][studentId] !== undefined) {
            const diag = db.diagnosticEvaluation[className][studentId];
            if (typeof diag === 'number' && !isNaN(diag)) return diag;
            if (diag && typeof diag === 'object') {
                if (diag.total !== undefined && !isNaN(parseFloat(diag.total))) return parseFloat(diag.total);
                if (diag.totalScore !== undefined && !isNaN(parseFloat(diag.totalScore))) return parseFloat(diag.totalScore);
                if (diag.score !== undefined && !isNaN(parseFloat(diag.score))) return parseFloat(diag.score);
            }
        }
        // 3. التحقق من سجل التلميذ المباشر
        const students = (db.classes && db.classes[className]) || [];
        const std = students.find(s => s.id === studentId);
        if (std && (std.diagnosticScore !== undefined || std.diagScore !== undefined)) {
            const val = parseFloat(std.diagnosticScore ?? std.diagScore);
            if (!isNaN(val)) return val;
        }
        return null;
    }

    /**
     * حساب القيمة المضافة والتجانس الصفي لقسم معين
     */
    function computeClassValueAddedStats(className, semester) {
        const db = window.db || {};
        const students = (db.classes && db.classes[className]) ? db.classes[className] : [];
        const sem = semester || window.activeSemester || 's1';
        const examCount = (typeof window.getExamsCountForClass === 'function') ? window.getExamsCountForClass(className) : 3;

        let sumCC = 0;
        let countCC = 0;
        let sumDiag = 0;
        let countDiag = 0;
        const validScoresCC = [];

        const studentRows = [];

        students.forEach((std, idx) => {
            const grades = (typeof window.getStudentGradesBySemester === 'function')
                ? window.getStudentGradesBySemester(className, std.id, sem)
                : ((db.grades && db.grades[className] && db.grades[className][std.id]) || {});

            const avgCC = (typeof window.calculateStudentAvg === 'function')
                ? window.calculateStudentAvg(grades, className, sem)
                : (typeof window.calculateSemesterAvg === 'function' ? window.calculateSemesterAvg(grades, examCount, sem) : null);

            const scoreDiag = getStudentDiagnosticScore(className, std.id);

            let delta = null;
            let status = 'بدون تشخيص';
            let statusColor = '#64748b';
            let statusCategory = 'none';

            if (avgCC !== null && !isNaN(avgCC)) {
                sumCC += avgCC;
                countCC++;
                validScoresCC.push(avgCC);

                if (scoreDiag !== null && !isNaN(scoreDiag)) {
                    sumDiag += scoreDiag;
                    countDiag++;
                    delta = parseFloat((avgCC - scoreDiag).toFixed(2));

                    if (delta >= 2.5) {
                        status = '🚀 تطور استثنائي بارز';
                        statusColor = '#15803d';
                        statusCategory = 'exceptional';
                    } else if (delta >= 1.0) {
                        status = '📈 تقدم إيجابي ملحوظ';
                        statusColor = '#0284c7';
                        statusCategory = 'progression';
                    } else if (delta >= -1.0) {
                        status = '⚖️ استقرار في الأداء';
                        statusColor = '#475569';
                        statusCategory = 'stable';
                    } else if (delta >= -2.5) {
                        status = '⚠️ تراجع طفيف يستوجب المتابعة';
                        statusColor = '#d97706';
                        statusCategory = 'mild_regression';
                    } else {
                        status = '🚨 تراجع مقلق يستدعي التدخل';
                        statusColor = '#dc2626';
                        statusCategory = 'severe_regression';
                    }
                }
            }

            studentRows.push({
                id: std.id,
                orderNum: std.orderNum || (idx + 1),
                name: std.name || `تلميذ #${idx + 1}`,
                massar: std.massar || std.code || '—',
                avgCC: avgCC !== null ? parseFloat(avgCC.toFixed(2)) : null,
                scoreDiag: scoreDiag !== null ? parseFloat(scoreDiag.toFixed(2)) : null,
                delta,
                status,
                statusColor,
                statusCategory
            });
        });

        // 1. حساب المتوسطات
        const meanCC = countCC > 0 ? parseFloat((sumCC / countCC).toFixed(2)) : 0;
        const meanDiag = countDiag > 0 ? parseFloat((sumDiag / countDiag).toFixed(2)) : 0;
        const globalValueAdded = countDiag > 0 ? parseFloat((meanCC - meanDiag).toFixed(2)) : null;

        // 2. حساب الانحراف المعياري ومعامل التباين (Dispersion & Homogeneity)
        let variance = 0;
        let stdDev = 0;
        let cv = 0;
        let homogeneityLabel = 'غير متوفر';
        let homogeneityBadgeBg = '#f1f5f9';
        let homogeneityColor = '#475569';
        let didacticAdvice = '';

        if (validScoresCC.length >= 2) {
            const sumSquares = validScoresCC.reduce((acc, val) => acc + Math.pow(val - meanCC, 2), 0);
            variance = sumSquares / validScoresCC.length;
            stdDev = parseFloat(Math.sqrt(variance).toFixed(2));
            cv = meanCC > 0 ? parseFloat(((stdDev / meanCC) * 100).toFixed(1)) : 0;

            if (cv <= 18) {
                homogeneityLabel = 'قسم متجانس جداً (Forte Homogénéité)';
                homogeneityBadgeBg = '#ecfdf5';
                homogeneityColor = '#065f46';
                didacticAdvice = 'المستوى العام للتلاميذ متقارب للغاية؛ يُنصح برفع نسق التعلمات وإدراج وضعيات مشكلة مركبة ومسائل استمثال وتطبيقات أولمبية.';
            } else if (cv <= 30) {
                homogeneityLabel = 'تباين صفي معتدل وطبيعي (Dispersion Modérée)';
                homogeneityBadgeBg = '#eff6ff';
                homogeneityColor = '#1e40af';
                didacticAdvice = 'التوزيع طبيعي لنتائج الفصل؛ يُفضل الحفاظ على وتيرة العمل المتوازنة مع إسناد مهام إضافية للتلاميذ السريعين.';
            } else {
                homogeneityLabel = 'تباين وتشتت صفي حاد (Forte Hétérogénéité)';
                homogeneityBadgeBg = '#fef2f2';
                homogeneityColor = '#991b1b';
                didacticAdvice = 'يوجد تباعد كبير في كفايات المتعلمين الصفيّة؛ توصي التوجيهات التربوية الرسمية بإعمال البيداغوجيا الفارقية والعمل في مجموعات غير متجانسة لتبادل الأقران مع إفراد المتعثرين بدعم خاص.';
            }
        }

        // ترتيب التلاميذ حسب الفارق التراكمي (أكبر تقدم أولاً)
        studentRows.sort((a, b) => {
            if (a.delta === null && b.delta === null) return 0;
            if (a.delta === null) return 1;
            if (b.delta === null) return -1;
            return b.delta - a.delta;
        });

        return {
            className,
            semester: sem,
            studentsCount: students.length,
            testedCount: countCC,
            diagCount: countDiag,
            meanCC,
            meanDiag,
            globalValueAdded,
            stdDev,
            cv,
            homogeneityLabel,
            homogeneityBadgeBg,
            homogeneityColor,
            didacticAdvice,
            students: studentRows
        };
    }

    /**
     * بناء كود HTML لواجهة تقرير القيمة المضافة والتجانس
     */
    function buildValueAddedReportHTML(className, semester) {
        const stats = computeClassValueAddedStats(className, semester);
        const semLabel = stats.semester === 's2' ? 'الدورة الثانية' : 'الدورة الأولى';

        const vaBadge = stats.globalValueAdded !== null ? (
            stats.globalValueAdded >= 0 
                ? `<span style="color:#86efac; font-weight:900;">+${stats.globalValueAdded} نقطة (قيمة مضافة إيجابية)</span>` 
                : `<span style="color:#fca5a5; font-weight:900;">${stats.globalValueAdded} نقطة (تراجع بيداغوجي)</span>`
        ) : '<span style="color:#e2e8f0;">غير محدد (يتطلب رائز تشخيصي)</span>';

        const rowsHtml = stats.students.map((std, i) => {
            const deltaBadge = std.delta !== null ? (
                std.delta > 0 
                    ? `<span style="color:#15803d; font-weight:800; background:#f0fdf4; padding:2px 8px; border-radius:6px;">+${std.delta}</span>` 
                    : (std.delta < 0 
                        ? `<span style="color:#dc2626; font-weight:800; background:#fef2f2; padding:2px 8px; border-radius:6px;">${std.delta}</span>` 
                        : `<span style="color:#475569; font-weight:800; background:#f8fafc; padding:2px 8px; border-radius:6px;">0.00</span>`)
            ) : '<span style="color:#94a3b8; font-size:0.75rem;">—</span>';

            return `
            <tr style="border-bottom: 1px solid #cbd5e1; background: ${i % 2 === 0 ? '#fff' : '#f8fafc'};">
                <td style="padding: 7px 5px; text-align: center; font-weight: 800; border: 1px solid #cbd5e1; color: #1e3a8a;">#${std.orderNum}</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 700; border: 1px solid #cbd5e1; color: #0f172a;">${std.name}</td>
                <td style="padding: 7px 6px; text-align: center; font-weight: 700; border: 1px solid #cbd5e1; color: #475569;">
                    ${std.scoreDiag !== null ? `${std.scoreDiag} <span style="font-size:0.7rem;">/20</span>` : '<span style="color:#94a3b8; font-size:0.72rem;">غير مرصود</span>'}
                </td>
                <td style="padding: 7px 6px; text-align: center; font-weight: 900; border: 1px solid #cbd5e1; color: #0284c7;">
                    ${std.avgCC !== null ? `${std.avgCC} <span style="font-size:0.7rem;">/20</span>` : '<span style="color:#94a3b8;">غائب</span>'}
                </td>
                <td style="padding: 7px 6px; text-align: center; border: 1px solid #cbd5e1;">${deltaBadge}</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 700; font-size: 0.76rem; border: 1px solid #cbd5e1; color: ${std.statusColor};">
                    ${std.status}
                </td>
            </tr>
            `;
        }).join('');

        return `
        <div style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; color: #0f172a; padding: 12px; background: #fff;">
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #1e3a8a, #0369a1); color: #fff; padding: 16px 20px; border-radius: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 8px;">
                        <span>📈 مؤشر القيمة المضافة التربوية ومصفوفة التجانس الصفي</span>
                    </h3>
                    <div style="font-size: 0.8rem; opacity: 0.9; margin-top: 4px;">
                        تحليل الفارق بين نقط التقويم التشخيصي ونقط المراقبة المستمرة • القسم: <strong>${className}</strong> (${semLabel})
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25); text-align: center;">
                    <div style="font-size: 0.72rem; opacity: 0.85;">القيمة المضافة الإجمالية للقسم</div>
                    <div style="font-size: 1.05rem; font-weight: 900; margin-top: 2px;">${vaBadge}</div>
                </div>
            </div>

            <!-- Mathematical Dispersion & Homogeneity Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: #64748b;">معدل المراقبة المستمرة (x̄)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #1e3a8a; margin: 4px 0;">${stats.meanCC} <span style="font-size:0.75rem;">/20</span></div>
                    <div style="font-size: 0.72rem; color: #475569;">معدل التشخيصي: <strong>${stats.meanDiag} /20</strong> (${stats.diagCount} مرصود)</div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: #64748b;">الانحراف المعياري (Écart-type σ)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed; margin: 4px 0;">${stats.stdDev} <span style="font-size:0.75rem;">نقطة</span></div>
                    <div style="font-size: 0.72rem; color: #475569;">مقياس تشتت نتائج التلاميذ حول المعدل</div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: #64748b;">معامل التغير والاختلاف (CV %)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: ${stats.cv > 30 ? '#dc2626' : '#059669'}; margin: 4px 0;">${stats.cv}%</div>
                    <div style="font-size: 0.72rem; color: #475569;">${stats.cv > 30 ? 'تشتت مرتفع يستوجب تفريد التعلم' : 'تشتت معتدل ومقبول'}</div>
                </div>

                <div style="background: ${stats.homogeneityBadgeBg}; border: 1.5px solid ${stats.homogeneityColor}; border-radius: 10px; padding: 12px;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: ${stats.homogeneityColor};">درجة التجانس الصفي</div>
                    <div style="font-size: 0.95rem; font-weight: 900; color: ${stats.homogeneityColor}; margin: 4px 0;">${stats.homogeneityLabel}</div>
                    <div style="font-size: 0.72rem; color: #334155; line-height: 1.4;">${stats.didacticAdvice}</div>
                </div>
            </div>

            <!-- Table of Students Value-Added -->
            <div style="margin-bottom: 14px; overflow-x: auto; border: 1.5px solid #cbd5e1; border-radius: 10px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: center;">
                    <thead>
                        <tr style="background: #1e3a8a; color: #ffffff; font-weight: 800;">
                            <th style="padding: 8px 4px; border: 1px solid #1e3a8a; width: 45px;">الرقم</th>
                            <th style="padding: 8px 10px; border: 1px solid #1e3a8a; text-align: right;">الاسم الكامل للتلميذ</th>
                            <th style="padding: 8px 6px; border: 1px solid #1e3a8a; width: 110px;">التقويم التشخيصي</th>
                            <th style="padding: 8px 6px; border: 1px solid #1e3a8a; width: 110px;">معدل المراقبة المستمرة</th>
                            <th style="padding: 8px 6px; border: 1px solid #1e3a8a; width: 100px;">الفارق (Δ)</th>
                            <th style="padding: 8px 10px; border: 1px solid #1e3a8a; text-align: right;">تصنيف مؤشر التطور البيداغوجي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Official Footer Signature -->
            <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 0.76rem; font-weight: 800; color: #1e3a8a;">
                منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر
            </div>
        </div>
        `;
    }

    /**
     * طباعة تقرير القيمة المضافة والتجانس الصفي A4
     */
    function printValueAddedReport() {
        const cls = _vaState.selectedClass;
        if (!cls) return;
        const html = buildValueAddedReportHTML(cls, _vaState.semester);

        let iframe = document.getElementById('vaReportPrintIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'vaReportPrintIframe';
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
            document.body.appendChild(iframe);
        }
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير القيمة المضافة والتجانس الصفي - ${cls}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>${html}</body>
            </html>
        `);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 250);
    }

    /**
     * فتح نافذة مؤشر القيمة المضافة والتجانس الصفي (توجيه مباشر للمركز المدمج لمجلس القسم والقيمة المضافة)
     */
    function openValueAddedAnalyticsModal(className = null, semester = null) {
        if (typeof window.openPedagogicalCouncilPvModal === 'function') {
            window.openPedagogicalCouncilPvModal(className, semester, 'va');
            return;
        }
        let modal = document.getElementById('valueAddedAnalyticsModal');
        if (!modal) {
            modal = createValueAddedModalElement();
            document.body.appendChild(modal);
        }

        const classSelect = document.getElementById('classSelect');
        const activeCls = className || (classSelect ? classSelect.value : '') || Object.keys(window.db?.classes || {})[0] || '';
        const activeSem = window.activeSemester || 's1';
        _vaState.selectedClass = activeCls;
        _vaState.semester = activeSem;

        const clsDropdown = document.getElementById('vaModalClassSelect');
        if (clsDropdown) {
            const classes = Object.keys(window.db?.classes || {});
            clsDropdown.innerHTML = classes.map(c => `<option value="${c}" ${c === activeCls ? 'selected' : ''}>${c}</option>`).join('');
        }
        const semDropdown = document.getElementById('vaModalSemesterSelect');
        if (semDropdown) {
            semDropdown.value = activeSem;
        }

        renderValueAddedModalContent();
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    function closeValueAddedAnalyticsModal() {
        const modal = document.getElementById('valueAddedAnalyticsModal');
        if (modal) modal.style.display = 'none';
    }

    function renderValueAddedModalContent() {
        const container = document.getElementById('vaModalContentContainer');
        if (!container) return;
        const cls = _vaState.selectedClass;
        if (!cls) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">يرجى اختيار القسم لعرض مؤشرات القيمة المضافة.</div>';
            return;
        }
        container.innerHTML = buildValueAddedReportHTML(cls, _vaState.semester);
    }

    function createValueAddedModalElement() {
        const m = document.createElement('div');
        m.id = 'valueAddedAnalyticsModal';
        m.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 10075; align-items: center; justify-content: center; padding: 14px;';
        m.onclick = (e) => { if (e.target === m) closeValueAddedAnalyticsModal(); };

        m.innerHTML = `
        <div class="card" style="width: 100%; max-width: 1050px; max-height: 92vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
            <div style="padding: 14px 20px; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff;">
                        <span data-lucide="trending-up" data-size="20"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">مؤشر القيمة المضافة والتجانس الصفي (Educational Analytics)</h3>
                        <div style="font-size: 0.76rem; color: #64748b; font-weight: 600;">تحليل دقيق للانحراف المعياري، تباين النتائج، وتطور التحصيل بين التشخيص والمراقبة المستمرة</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <select id="vaModalClassSelect" onchange="window.onVaClassChanged(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff;"></select>
                    <select id="vaModalSemesterSelect" onchange="window.onVaSemesterChanged(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff;">
                        <option value="s1">الدورة الأولى (الأسدوس 1)</option>
                        <option value="s2">الدورة الثانية (الأسدوس 2)</option>
                    </select>
                    <button type="button" onclick="window.printValueAddedReport()" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                        <span data-lucide="printer" data-size="16"></span>
                        <span>طباعة A4</span>
                    </button>
                    <button type="button" onclick="window.closeValueAddedAnalyticsModal()" style="background: #f1f5f9; border: none; color: #64748b; width: 32px; height: 32px; border-radius: 8px; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
            </div>
            <div id="vaModalContentContainer" style="flex: 1; overflow-y: auto; padding: 18px; background: #f8fafc;"></div>
        </div>
        `;
        return m;
    }

    window.onVaClassChanged = function (cls) {
        _vaState.selectedClass = cls;
        renderValueAddedModalContent();
    };

    window.onVaSemesterChanged = function (sem) {
        _vaState.semester = sem;
        renderValueAddedModalContent();
    };

    window.openValueAddedAnalyticsModal = openValueAddedAnalyticsModal;
    window.closeValueAddedAnalyticsModal = closeValueAddedAnalyticsModal;
    window.printValueAddedReport = printValueAddedReport;
    window.computeClassValueAddedStats = computeClassValueAddedStats;
    window.buildValueAddedReportHTML = buildValueAddedReportHTML;

})(window);
