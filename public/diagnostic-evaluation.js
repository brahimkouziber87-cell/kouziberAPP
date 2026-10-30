/**
 * diagnostic-evaluation.js
 * وحدة التقويم التشخيصي لمادة الرياضيات وشبكة تفريغ الروائز في تبويب التقارير
 * رصد المكتسبات القبلية، تفييئ المتعلمين (Profilage des élèves)، والمجالات الرياضية الأربعة
 */
(function (window) {
    'use strict';

    // المجالات الرياضية الأربعة المعتمدة رسمياً في الرياضيات بالسلك الثانوي التأهيلي
    const MATH_DIAGNOSTIC_DOMAINS = [
        {
            key: 'd1',
            name: 'الحسابيات والأنشطة العددية',
            frenchName: 'Arithmétique & Calcul',
            maxScore: 5,
            icon: '🔢',
            color: '#15803d',
            bgColor: '#f0fdf4',
            borderColor: '#bbf7d0',
            topics: 'العمليات على الأعداد، القوى، الجذور المربعة، الحسابيات في Z، المجموعات والمجالات',
            obstacle: 'خلط في قواعد العمليات وإشارات الجمع والضرب وصعوبة الانتقال للتجريد الرياضي'
        },
        {
            key: 'd2',
            name: 'الهندسة والحساب المثلثي',
            frenchName: 'Géométrie & Trigonométrie',
            maxScore: 5,
            icon: '📐',
            color: '#0284c7',
            bgColor: '#f0f9ff',
            borderColor: '#bae6fd',
            topics: 'المتجهات والإزاحة، الجداء السلمي، التحويلات الاعتيادية، النسب والدوال المثلثية',
            obstacle: 'صعوبة الانتقال من الملاحظة الحسية إلى الاستدلال البرهاني واستعمال المتجهات'
        },
        {
            key: 'd3',
            name: 'الجبر والتحليل',
            frenchName: 'Algèbre & Analyse',
            maxScore: 5,
            icon: '✏️',
            color: '#d97706',
            bgColor: '#fffbeb',
            borderColor: '#fde68a',
            topics: 'المعادلات والمتراجحات والنظمات، الدوال العددية (مجموعة التعريف، التغيرات والتمثيل)',
            obstacle: 'عائق الربط بين التعبير الجبري والتمثيل المبياني، وأخطاء التعامل مع إشارات المتراجحات'
        },
        {
            key: 'd4',
            name: 'تنظيم المعطيات وحل المسائل',
            frenchName: 'Statistiques & Problèmes',
            maxScore: 5,
            icon: '📊',
            color: '#7c3aed',
            bgColor: '#faf5ff',
            borderColor: '#e9d5ff',
            topics: 'قراءة المبيانات والجداول، التناسبية، النسبة المئوية، ترييض وضعيات واقعية',
            obstacle: 'عائق فهم المقروء وصعوبة ترجمة النص اللغوي إلى معادلة رياضية'
        }
    ];

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * ضمان تهيئة بنية بيانات التقويم التشخيصي
     */
    function ensureDiagnosticDb(className) {
        if (!window.db) window.db = {};
        if (!window.db.diagnostic) window.db.diagnostic = {};
        if (!className) return {};
        if (!window.db.diagnostic[className]) {
            window.db.diagnostic[className] = {};
        }
        return window.db.diagnostic[className];
    }

    /**
     * حساب فئة التفييئ والإجراء التربوي الموصى به
     */
    function computeProfileAndRemediation(total, d1, d2, d3, d4) {
        let profile = 'C';
        let profileLabel = 'الفئة (ج): متعثر';
        let profileColor = '#dc2626';
        let profileBg = '#fef2f2';
        let profileBorder = '#fecaca';
        let recommendation = '';

        if (total >= 12) {
            profile = 'A';
            profileLabel = 'الفئة (أ): متمكن';
            profileColor = '#15803d';
            profileBg = '#f0fdf4';
            profileBorder = '#bbf7d0';
            recommendation = 'أنشطة إغناء وتحديات رياضية متقدمة لتعزيز التفكير التركيبي والاستدلال المجرد ومساعدة الأقران.';
        } else if (total >= 8) {
            profile = 'B';
            profileLabel = 'الفئة (ب): في طور التمكن';
            profileColor = '#0284c7';
            profileBg = '#f0f9ff';
            profileBorder = '#bae6fd';
            recommendation = 'تمارين تثبيت وأنشطة تدريبية مستهدفة لتوطيد المفاهيم وتفادي الهشاشة الرياضية التراكمية.';
        } else {
            profile = 'C';
            profileLabel = 'الفئة (ج): غير متمكن / متعثر';
            profileColor = '#dc2626';
            profileBg = '#fef2f2';
            profileBorder = '#fecaca';

            // تحديد أضعف مجال لتركيز الدعم
            const scores = [
                { name: 'الحسابيات والأنشطة العددية', score: d1 },
                { name: 'الهندسة والحساب المثلثي', score: d2 },
                { name: 'الجبر والتحليل', score: d3 },
                { name: 'تنظيم المعطيات وحل المسائل', score: d4 }
            ];
            scores.sort((a, b) => a.score - b.score);
            recommendation = `دعم استدراكي علاجي فوري وبطاقات معالجة متدرجة تركز خاصة على تعثرات مجال: ${scores[0].name}.`;
        }

        return {
            profile,
            profileLabel,
            profileColor,
            profileBg,
            profileBorder,
            recommendation
        };
    }

    /**
     * الحصول على بيانات التلميذ أو توليد قيم ابتدائية ذكية
     */
    function getStudentDiagnosticEntry(className, std, index, totalStudents) {
        const classDiag = ensureDiagnosticDb(className);
        if (classDiag[std.id]) {
            return classDiag[std.id];
        }

        // توليد تقدير أولي متناسق مستند إلى معدل التلميذ إذا وجد، أو توزيع طبيعي مدروس
        let estimatedTotal = 11.5;
        if (window.db && window.db.grades && window.db.grades[className] && window.db.grades[className][std.id]) {
            const gradesObj = window.db.grades[className][std.id];
            const rawCandidates = [];
            const collectFromObj = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                ['f1', 'f2', 'f3', 'f4', 'activities'].forEach(k => {
                    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
                        const n = parseFloat(obj[k]);
                        if (!isNaN(n) && n >= 0 && n <= 20) rawCandidates.push(n);
                    }
                });
            };
            collectFromObj(gradesObj);
            collectFromObj(gradesObj.s1);
            collectFromObj(gradesObj.s2);
            if (rawCandidates.length > 0) {
                estimatedTotal = rawCandidates.reduce((a, b) => a + b, 0) / rawCandidates.length;
            }
        } else {
            // توزيع بيداغوجي واقعي للقسم
            const ratio = (totalStudents > 1) ? (index / (totalStudents - 1)) : 0.5;
            estimatedTotal = 17 - (ratio * 12.5); // من 17 إلى 4.5
            // إضافة تنوع طفيف
            const hash = (std.name.length * 7 + index * 13) % 5;
            estimatedTotal += (hash - 2) * 0.5;
        }

        estimatedTotal = Math.max(3, Math.min(19, parseFloat(estimatedTotal.toFixed(2))));
        const factor = estimatedTotal / 20;

        const d1 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.2)).toFixed(2));
        const d2 = parseFloat(Math.min(5, Math.max(0.5, factor * 4.8)).toFixed(2));
        const d3 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.0)).toFixed(2));
        const d4 = parseFloat(Math.min(5, Math.max(0.5, estimatedTotal - d1 - d2 - d3)).toFixed(2));
        const actualTotal = parseFloat((d1 + d2 + d3 + d4).toFixed(2));

        const computed = computeProfileAndRemediation(actualTotal, d1, d2, d3, d4);

        const entry = {
            d1,
            d2,
            d3,
            d4,
            total: actualTotal,
            profile: computed.profile,
            recommendation: computed.recommendation
        };

        classDiag[std.id] = entry;
        return entry;
    }

    /**
     * رسم وعرض قسم التقويم التشخيصي في تبويب التقارير
     */
    function renderDiagnosticSection(className) {
        const card = document.getElementById('diagnosticReportCard');
        if (!card) return;

        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            const countBadge = document.getElementById('diagnosticStudentsCountBadge');
            if (countBadge) countBadge.textContent = '0 تلميذ';
            const tbody = document.getElementById('diagnosticTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 24px; color: #64748b; font-weight: 700; text-align: center;">يرجى اختيار القسم لعرض شبكة التقويم التشخيصي</td></tr>';
            const kpiRow = document.getElementById('diagnosticKpisRow');
            if (kpiRow) kpiRow.innerHTML = '';
            const domGrid = document.getElementById('diagnosticDomainsGrid');
            if (domGrid) domGrid.innerHTML = '';
            return;
        }

        card.style.display = 'block';

        const students = window.db.classes[className] || [];
        const countBadge = document.getElementById('diagnosticStudentsCountBadge');
        if (countBadge) countBadge.textContent = `${students.length} تلميذ`;

        if (students.length === 0) {
            const tbody = document.getElementById('diagnosticTableBody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="padding: 24px; color: #64748b; font-weight: 700; text-align: center;">لا يوجد تلاميذ مسجلين في هذا القسم بعد</td></tr>';
            return;
        }

        ensureDiagnosticDb(className);

        // إحصائيات التفييئ
        let countA = 0;
        let countB = 0;
        let countC = 0;
        let sumTotal = 0;
        let sumD1 = 0, sumD2 = 0, sumD3 = 0, sumD4 = 0;

        const evaluatedList = students.map((std, idx) => {
            const entry = getStudentDiagnosticEntry(className, std, idx, students.length);
            const total = parseFloat(entry.total) || 0;
            sumTotal += total;
            sumD1 += (parseFloat(entry.d1) || 0);
            sumD2 += (parseFloat(entry.d2) || 0);
            sumD3 += (parseFloat(entry.d3) || 0);
            sumD4 += (parseFloat(entry.d4) || 0);

            if (total >= 12) countA++;
            else if (total >= 8) countB++;
            else countC++;

            return { std, entry };
        });

        const totalStudents = students.length;
        const pctA = Math.round((countA / totalStudents) * 100);
        const pctB = Math.round((countB / totalStudents) * 100);
        const pctC = Math.max(0, 100 - pctA - pctB);
        const classAvg = parseFloat((sumTotal / totalStudents).toFixed(2));
        const masteryRate = Math.round((classAvg / 20) * 100);

        // 1. رسم بطاقات مؤشرات التفييئ (KPIs)
        const kpiRow = document.getElementById('diagnosticKpisRow');
        if (kpiRow) {
            kpiRow.innerHTML = `
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-weight: 800; color: #15803d; font-size: 0.82rem; margin-bottom: 2px;">
                        🟢 الفئة (أ): متمكنة (Maîtrise)
                    </div>
                    <div style="font-size: 0.72rem; color: #166534; margin-bottom: 6px;">معدل الرائز: [12 - 20] / 20</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #15803d;">
                        ${countA} <span style="font-size: 0.78rem;">تلميذ (${pctA}%)</span>
                    </div>
                    <div style="margin-top: 6px; height: 5px; background: #dcfce7; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pctA}%; height: 100%; background: #22c55e;"></div>
                    </div>
                </div>

                <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 10px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-weight: 800; color: #1d4ed8; font-size: 0.82rem; margin-bottom: 2px;">
                        🔵 الفئة (ب): في طور التمكن (En cours)
                    </div>
                    <div style="font-size: 0.72rem; color: #1e40af; margin-bottom: 6px;">معدل الرائز: [8 - 12[ / 20</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #1d4ed8;">
                        ${countB} <span style="font-size: 0.78rem;">تلميذ (${pctB}%)</span>
                    </div>
                    <div style="margin-top: 6px; height: 5px; background: #dbeafe; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pctB}%; height: 100%; background: #3b82f6;"></div>
                    </div>
                </div>

                <div style="background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 10px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-weight: 800; color: #dc2626; font-size: 0.82rem; margin-bottom: 2px;">
                        🔴 الفئة (ج): غير متمكنة / متعثرة
                    </div>
                    <div style="font-size: 0.72rem; color: #991b1b; margin-bottom: 6px;">معدل الرائز: دون 8 / 20</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626;">
                        ${countC} <span style="font-size: 0.78rem;">تلميذ (${pctC}%)</span>
                    </div>
                    <div style="margin-top: 6px; height: 5px; background: #fee2e2; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pctC}%; height: 100%; background: #ef4444;"></div>
                    </div>
                </div>

                <div style="background: #faf5ff; border: 1.5px solid #d8b4fe; border-radius: 10px; padding: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                    <div style="font-weight: 800; color: #7c3aed; font-size: 0.82rem; margin-bottom: 2px;">
                        📊 معدل الرائز العام للقسم
                    </div>
                    <div style="font-size: 0.72rem; color: #6b21a8; margin-bottom: 6px;">نسبة التحكم الإجمالية: ${masteryRate}%</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed;">
                        ${classAvg} <span style="font-size: 0.8rem;">/ 20</span>
                    </div>
                    <div style="margin-top: 6px; height: 5px; background: #f3e8ff; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${masteryRate}%; height: 100%; background: #a855f7;"></div>
                    </div>
                </div>
            `;
        }

        // 2. رسم بطاقات المجالات الرياضية الأربعة
        const domGrid = document.getElementById('diagnosticDomainsGrid');
        if (domGrid) {
            const domainSums = [sumD1, sumD2, sumD3, sumD4];
            domGrid.innerHTML = MATH_DIAGNOSTIC_DOMAINS.map((dom, dIdx) => {
                const domAvg = parseFloat((domainSums[dIdx] / totalStudents).toFixed(2));
                const domPct = Math.round((domAvg / dom.maxScore) * 100);
                const statusBadge = domPct >= 65 ? 'مستوى متمكن' : domPct >= 50 ? 'في طور التمكن' : 'تعثر ملحوظ يستوجب دعماً';
                const statusColor = domPct >= 65 ? '#15803d' : domPct >= 50 ? '#0284c7' : '#dc2626';

                return `
                    <div style="background: ${dom.bgColor}; border: 1px solid ${dom.borderColor}; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                <div style="font-weight: 800; color: ${dom.color}; font-size: 0.82rem; display: flex; align-items: center; gap: 4px;">
                                    <span>${dom.icon}</span>
                                    <span>${dom.name}</span>
                                </div>
                                <span style="font-size: 0.7rem; font-weight: 800; color: ${statusColor}; background: #fff; padding: 1px 6px; border-radius: 4px; border: 1px solid ${dom.borderColor};">
                                    ${domPct}%
                                </span>
                            </div>
                            <div style="font-size: 0.72rem; color: #64748b; line-height: 1.4; margin-bottom: 6px;">
                                ${dom.topics}
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 700; color: #475569; margin-bottom: 2px;">
                                <span>معدل القسم: ${domAvg} / ${dom.maxScore}</span>
                                <span style="color: ${statusColor};">${statusBadge}</span>
                            </div>
                            <div style="height: 5px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${domPct}%; height: 100%; background: ${dom.color};"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. رسم صفوف جدول تفريغ نتائج التلاميذ
        const tbody = document.getElementById('diagnosticTableBody');
        if (tbody) {
            tbody.innerHTML = evaluatedList.map(({ std, entry }, idx) => {
                const total = parseFloat(entry.total) || 0;
                const d1 = parseFloat(entry.d1) || 0;
                const d2 = parseFloat(entry.d2) || 0;
                const d3 = parseFloat(entry.d3) || 0;
                const d4 = parseFloat(entry.d4) || 0;

                const prof = computeProfileAndRemediation(total, d1, d2, d3, d4);

                return `
                    <tr style="transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                        <td style="font-weight: 700; color: #475569;">${std.orderNum || (idx + 1)}</td>
                        <td style="text-align: right; padding-right: 10px; font-weight: 800; color: #0f172a;">
                            ${escapeHtml(std.name)}
                            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: normal;">${escapeHtml(std.massar || '')}</div>
                        </td>
                        <td style="padding: 4px;">
                            <input type="number" min="0" max="5" step="0.25" value="${d1}" 
                                onchange="window.updateStudentDiagnosticMark('${escapeHtml(className)}', '${escapeHtml(std.id)}', 'd1', this.value)"
                                style="width: 60px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 5px; text-align: center; font-weight: 700; font-size: 0.8rem; background: #fff;"
                                title="الحسابيات والأنشطة العددية (من 5)">
                        </td>
                        <td style="padding: 4px;">
                            <input type="number" min="0" max="5" step="0.25" value="${d2}" 
                                onchange="window.updateStudentDiagnosticMark('${escapeHtml(className)}', '${escapeHtml(std.id)}', 'd2', this.value)"
                                style="width: 60px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 5px; text-align: center; font-weight: 700; font-size: 0.8rem; background: #fff;"
                                title="الهندسة والحساب المثلثي (من 5)">
                        </td>
                        <td style="padding: 4px;">
                            <input type="number" min="0" max="5" step="0.25" value="${d3}" 
                                onchange="window.updateStudentDiagnosticMark('${escapeHtml(className)}', '${escapeHtml(std.id)}', 'd3', this.value)"
                                style="width: 60px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 5px; text-align: center; font-weight: 700; font-size: 0.8rem; background: #fff;"
                                title="الجبر والتحليل (من 5)">
                        </td>
                        <td style="padding: 4px;">
                            <input type="number" min="0" max="5" step="0.25" value="${d4}" 
                                onchange="window.updateStudentDiagnosticMark('${escapeHtml(className)}', '${escapeHtml(std.id)}', 'd4', this.value)"
                                style="width: 60px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 5px; text-align: center; font-weight: 700; font-size: 0.8rem; background: #fff;"
                                title="تنظيم المعطيات وحل المسائل (من 5)">
                        </td>
                        <td style="font-weight: 900; font-size: 0.95rem; color: ${prof.profileColor}; background: ${prof.profileBg}; border-radius: 4px;">
                            ${total.toFixed(2)}
                        </td>
                        <td style="padding: 4px;">
                            <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 800; font-size: 0.72rem; color: ${prof.profileColor}; background: ${prof.profileBg}; border: 1px solid ${prof.profileBorder};">
                                ${prof.profileLabel}
                            </span>
                        </td>
                        <td style="text-align: right; padding-right: 8px; font-size: 0.73rem; color: #475569; line-height: 1.4;">
                            ${escapeHtml(prof.recommendation)}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تحديث نقطة تلميذ في مجال معين وحفظها
     */
    function updateStudentDiagnosticMark(className, studentId, domainKey, rawVal) {
        let val = parseFloat(rawVal);
        if (isNaN(val)) val = 0;
        val = Math.max(0, Math.min(5, parseFloat(val.toFixed(2))));

        const classDiag = ensureDiagnosticDb(className);
        if (!classDiag[studentId]) {
            classDiag[studentId] = { d1: 2.5, d2: 2.5, d3: 2.5, d4: 2.5, total: 10 };
        }

        classDiag[studentId][domainKey] = val;

        const d1 = parseFloat(classDiag[studentId].d1) || 0;
        const d2 = parseFloat(classDiag[studentId].d2) || 0;
        const d3 = parseFloat(classDiag[studentId].d3) || 0;
        const d4 = parseFloat(classDiag[studentId].d4) || 0;

        const total = parseFloat((d1 + d2 + d3 + d4).toFixed(2));
        classDiag[studentId].total = total;

        const computed = computeProfileAndRemediation(total, d1, d2, d3, d4);
        classDiag[studentId].profile = computed.profile;
        classDiag[studentId].recommendation = computed.recommendation;

        if (typeof window.saveDB === 'function') {
            window.saveDB();
        }

        // إعادة حساب المؤشرات والجدول
        renderDiagnosticSection(className);
    }

    /**
     * تعبئة تقديرية سريعة لروائز تلاميذ القسم
     */
    function autoGenerateDiagnosticMarks() {
        const className = document.getElementById('reportClassSelect')?.value;
        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى اختيار القسم أولاً لتعبئة نتائج التقويم التشخيصي.', 'warning');
            } else {
                alert('يرجى اختيار القسم أولاً.');
            }
            return;
        }

        const students = window.db.classes[className];
        if (students.length === 0) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('لا يوجد تلاميذ في هذا القسم لتعبئة روائزهم.', 'warning');
            }
            return;
        }

        const classDiag = ensureDiagnosticDb(className);

        students.forEach((std, idx) => {
            // توليد قيم جديدة متنوعة
            const ratio = (students.length > 1) ? (idx / (students.length - 1)) : 0.5;
            let total = 17.5 - (ratio * 13);
            const noise = ((idx * 17 + std.name.length * 3) % 7) - 3;
            total = Math.max(3.5, Math.min(19.25, parseFloat((total + noise * 0.4).toFixed(2))));

            const factor = total / 20;
            const d1 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.2)).toFixed(2));
            const d2 = parseFloat(Math.min(5, Math.max(0.5, factor * 4.8)).toFixed(2));
            const d3 = parseFloat(Math.min(5, Math.max(0.5, factor * 5.0)).toFixed(2));
            const d4 = parseFloat(Math.min(5, Math.max(0.5, total - d1 - d2 - d3)).toFixed(2));
            const actualTotal = parseFloat((d1 + d2 + d3 + d4).toFixed(2));

            const computed = computeProfileAndRemediation(actualTotal, d1, d2, d3, d4);

            classDiag[std.id] = {
                d1,
                d2,
                d3,
                d4,
                total: actualTotal,
                profile: computed.profile,
                recommendation: computed.recommendation
            };
        });

        if (typeof window.saveDB === 'function') {
            window.saveDB();
        }

        renderDiagnosticSection(className);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم توليد وتحديث شبكة تفريغ التقويم التشخيصي لقسم ${className} بنجاح! 🎯`, 'success');
        }
    }

    /**
     * إظهار/إخفاء صندوق خطة الدعم والمعالجة الديدكتيكية
     */
    function toggleDiagnosticRemediationBox() {
        const box = document.getElementById('diagnosticRemediationContainer');
        if (!box) return;
        const isHidden = (box.style.display === 'none' || !box.style.display);
        box.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
            box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * تصدير شبكة تفريغ التقويم التشخيصي إلى Excel بصيغة رسمية متناسقة
     */
    function exportDiagnosticExcelGrid() {
        const className = document.getElementById('reportClassSelect')?.value;
        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('يرجى اختيار القسم لتصدير شبكة التقويم التشخيصي.', 'warning');
            } else {
                alert('يرجى اختيار القسم أولاً.');
            }
            return;
        }

        if (typeof XLSX === 'undefined') {
            alert('مكتبة تصدير Excel غير محملة.');
            return;
        }

        const students = window.db.classes[className];
        const teacherProfile = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const teacherName = teacherProfile.name || 'أستاذ مادة الرياضيات';
        const schoolName = teacherProfile.school || 'المؤسسة التعليمية';
        const classDiag = ensureDiagnosticDb(className);

        const rows = [
            ['المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة'],
            ['تقرير وشبكة تفريغ نتائج التقويم التشخيصي في مادة الرياضيات'],
            [`المؤسسة: ${schoolName}`, '', `الأستاذ(ة): ${teacherName}`, '', `القسم: ${className}`, '', `تاريخ الإنجاز: ${new Date().toLocaleDateString('ar-MA')}`],
            [],
            [
                'ر.ت',
                'رقم مسار',
                'الاسم الكامل',
                'الحسابيات والأنشطة العددية (5)',
                'الهندسة والحساب المثلثي (5)',
                'الجبر والتحليل (5)',
                'تنظيم المعطيات وحل المسائل (5)',
                'مجموع الرائز (20)',
                'فئة التفييئ (Profil)',
                'الإجراء البيداغوجي الموصى به'
            ]
        ];

        let countA = 0, countB = 0, countC = 0, sumTotal = 0;

        students.forEach((std, idx) => {
            const entry = getStudentDiagnosticEntry(className, std, idx, students.length);
            const total = parseFloat(entry.total) || 0;
            const d1 = parseFloat(entry.d1) || 0;
            const d2 = parseFloat(entry.d2) || 0;
            const d3 = parseFloat(entry.d3) || 0;
            const d4 = parseFloat(entry.d4) || 0;

            sumTotal += total;
            if (total >= 12) countA++;
            else if (total >= 8) countB++;
            else countC++;

            const prof = computeProfileAndRemediation(total, d1, d2, d3, d4);

            rows.push([
                std.orderNum || (idx + 1),
                std.massar || '',
                std.name || '',
                d1,
                d2,
                d3,
                d4,
                total,
                prof.profileLabel,
                prof.recommendation
            ]);
        });

        const totalStudents = students.length;
        const avgScore = totalStudents > 0 ? parseFloat((sumTotal / totalStudents).toFixed(2)) : 0;
        const pctA = totalStudents > 0 ? ((countA / totalStudents) * 100).toFixed(1) + '%' : '0%';
        const pctB = totalStudents > 0 ? ((countB / totalStudents) * 100).toFixed(1) + '%' : '0%';
        const pctC = totalStudents > 0 ? ((countC / totalStudents) * 100).toFixed(1) + '%' : '0%';

        rows.push([]);
        rows.push(['حصيلة التفييئ الإحصائي:', '', `عدد التلاميذ: ${totalStudents}`, `معدل الرائز: ${avgScore}/20`]);
        rows.push(['الفئة (أ) متمكنة (12-20):', countA, pctA, 'الفئة (ب) في طور التمكن (8-12):', countB, pctB, 'الفئة (ج) متعثرة (دون 8):', countC, pctC]);
        rows.push([]);
        rows.push(['توقيع وخاتم أستاذ مادة الرياضيات', '', '', 'تأشيرة السيد المفتش التربوي', '', '', 'تأشيرة وخاتم السيد مدير المؤسسة']);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },  // ر.ت
            { wch: 14 }, // مسار
            { wch: 28 }, // الاسم
            { wch: 22 }, // الحساب
            { wch: 24 }, // الهندسة
            { wch: 22 }, // الجبر
            { wch: 24 }, // تنظيم المعطيات
            { wch: 16 }, // المجموع
            { wch: 20 }, // التفييئ
            { wch: 45 }  // الإجراء الموصى به
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'التقويم_التشخيصي');

        const fileName = `شبكة_تفريغ_التقويم_التشخيصي_${className.replace(/\s+/g, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم تصدير شبكة تفريغ التقويم التشخيصي لقسم ${className} إلى Excel بنجاح! 📊`, 'success');
        }
    }

    // إتاحة الدوال على window
    window.renderDiagnosticSection = renderDiagnosticSection;
    window.updateStudentDiagnosticMark = updateStudentDiagnosticMark;
    window.autoGenerateDiagnosticMarks = autoGenerateDiagnosticMarks;
    window.toggleDiagnosticRemediationBox = toggleDiagnosticRemediationBox;
    window.exportDiagnosticExcelGrid = exportDiagnosticExcelGrid;

})(window);
