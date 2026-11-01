/**
 * ====================================================================
 * وحدة محضر اجتماع مجلس القسم الرسمي والتحقق من منظومة مسار
 * Moroccan Secondary Math - Official Pedagogical Council PV & Massar Hub
 * ====================================================================
 * يتيح للأستاذ توليد محضر رسمي متكامل لمجلس القسم (الدورة 1 / الدورة 2)
 * مطابق للمواصفات الإدارية والتربوية لوزارة التربية الوطنية المغربية،
 * مع التحقق الذكي من أرقام مسار واستخراج بطاقات التنقيط الرسمية.
 */

(function (window) {
    'use strict';

    // الحالة العامة للوحدة
    const _councilState = {
        selectedClass: '',
        semester: 's1',
        includeAbsence: true,
        includeOrientation: true,
        includeSupportPlan: true,
        minPassMark: 10
    };

    /**
     * التحقق من سلامة وصيغة رقم مسار للتلميذ (Code Massar Validation)
     * الصيغة الرسمية: حرف لاتيني متبوع بـ 9 أرقام (مثال: G134058912 أو D145023981)
     */
    function isValidMassarCode(code) {
        if (!code || typeof code !== 'string') return false;
        const clean = code.trim().toUpperCase();
        return /^[A-Z][0-9]{8,9}$/.test(clean);
    }

    /**
     * فحص وتدقيق أرقام مسار لجميع تلاميذ قسم معين
     */
    function auditClassMassarCodes(className) {
        const db = window.db || {};
        const students = (db.classes && db.classes[className]) ? db.classes[className] : [];
        const result = {
            total: students.length,
            valid: 0,
            missing: [],
            invalidFormat: []
        };

        students.forEach((std, idx) => {
            const rawCode = (std.massar || std.code || std.cne || '').trim();
            const orderNum = std.orderNum || (idx + 1);
            const name = std.name || `تلميذ #${orderNum}`;

            if (!rawCode) {
                result.missing.push({ id: std.id, orderNum, name, code: '' });
            } else if (!isValidMassarCode(rawCode)) {
                result.invalidFormat.push({ id: std.id, orderNum, name, code: rawCode });
            } else {
                result.valid++;
            }
        });

        return result;
    }

    /**
     * جمع وحساب الإحصائيات الشاملة للقسم لمجلس القسم
     */
    function getCouncilClassStatistics(className, semester) {
        const db = window.db || {};
        const students = (db.classes && db.classes[className]) ? db.classes[className] : [];
        const sem = semester || window.activeSemester || 's1';
        const examCount = (typeof window.getExamsCountForClass === 'function') ? window.getExamsCountForClass(className) : 3;
        const coef = (typeof window.getSubjectCoefForClass === 'function') ? window.getSubjectCoefForClass(className) : 7;
        const recCurric = (typeof window.recognizeMathCurriculumForClass === 'function') ? window.recognizeMathCurriculumForClass(className) : {};

        let sumMarks = 0;
        let testedCount = 0;
        let passCount = 0;
        let highCount = 0;   // >= 14 (جيد فما فوق)
        let middleCount = 0; // 10 - 13.99
        let alertCount = 0;  // 8 - 9.99 (في طور التحكم)
        let criticalCount = 0; // < 8 (تعثر حاد)
        let maxMark = -1;
        let minMark = 999;

        const evaluatedStudents = [];

        students.forEach((std, idx) => {
            const grades = (typeof window.getStudentGradesBySemester === 'function')
                ? window.getStudentGradesBySemester(className, std.id, sem)
                : ((db.grades && db.grades[className] && db.grades[className][std.id]) || {});

            const avg = (typeof window.calculateStudentAvg === 'function')
                ? window.calculateStudentAvg(grades, className, sem)
                : (typeof window.calculateSemesterAvg === 'function' ? window.calculateSemesterAvg(grades, examCount, sem) : null);

            // إحصائيات الغياب للدورة
            const absRecords = (db.records || []).filter(r => {
                if (r.className !== className || r.studentId !== std.id) return false;
                if (r.status !== 'غائب' && r.status !== 'مبرر') return false;
                return true;
            });
            const totalAbsHours = absRecords.reduce((acc, r) => acc + (parseFloat(r.hours) || (r.timeSlot ? 2 : 1)), 0);
            const unjustifiedAbsHours = absRecords.filter(r => r.status === 'غائب').reduce((acc, r) => acc + (parseFloat(r.hours) || 2), 0);

            let appreciation = 'غير مجتاز';
            let category = 'untested';

            if (avg !== null && !isNaN(avg)) {
                testedCount++;
                sumMarks += avg;
                if (avg > maxMark) maxMark = avg;
                if (avg < minMark) minMark = avg;

                if (avg >= 16) { appreciation = 'ممتاز (Très Bien)'; category = 'excellent'; highCount++; }
                else if (avg >= 14) { appreciation = 'جيد جداً (Bien)'; category = 'good'; highCount++; }
                else if (avg >= 12) { appreciation = 'حسن (Assez Bien)'; category = 'fair'; middleCount++; }
                else if (avg >= 10) { appreciation = 'مستحسن (Passable)'; category = 'passable'; middleCount++; }
                else if (avg >= 8) { appreciation = 'في طور التحكم (Moyen)'; category = 'alert'; alertCount++; }
                else { appreciation = 'تعثر حاد يستوجب الدعم (Insuffisant)'; category = 'critical'; criticalCount++; }

                if (avg >= 10) passCount++;
            }

            // اقتراح التوجيه الأكاديمي
            let orientationAdvice = 'متابعة عادية';
            if (recCurric.branchCode === 'TCS' || recCurric.branchCode === 'TCT') {
                if (avg !== null && avg >= 13.5 && unjustifiedAbsHours <= 4) {
                    orientationAdvice = 'مؤهل بامتياز لشعبة العلوم الرياضية (1BAC SM)';
                } else if (avg !== null && avg >= 10) {
                    orientationAdvice = 'مؤهل لشعبة العلوم التجريبية (1BAC SE) أو التكنولوجيات';
                } else if (avg !== null && avg >= 8) {
                    orientationAdvice = 'توجيه نحو العلوم الاقتصادية أو مسالك مهنية / تعزيز الدعم';
                } else if (avg !== null) {
                    orientationAdvice = 'إعادة التوجيه نحو الآداب أو مسالك تقنية ومهنية';
                }
            } else if (recCurric.branchCode === '1BAC_SM') {
                if (avg !== null && avg >= 11) {
                    orientationAdvice = 'المواصلة الإيجابية بالثانية باك علوم رياضية (2BAC SM)';
                } else if (avg !== null && avg >= 8) {
                    orientationAdvice = 'إمكانية الاستمرار مع دعم مكثف، أو التحويل لـ 2BAC PC';
                } else if (avg !== null) {
                    orientationAdvice = 'يُنصح بإعادة التوجيه للثانية باك علوم فيزيائية (2BAC PC)';
                }
            } else if (recCurric.branchCode === '1BAC_SE') {
                if (avg !== null && avg >= 10) {
                    orientationAdvice = 'أداء مناسب لمسلكي العلوم الفيزيائية (PC) أو علوم الحياة والأرض (SVT)';
                } else if (avg !== null) {
                    orientationAdvice = 'استدراك مكثف في الرياضيات أو التوجيه لـ 2BAC SVT';
                }
            }

            evaluatedStudents.push({
                id: std.id,
                orderNum: std.orderNum || (idx + 1),
                massar: (std.massar || std.code || '').trim(),
                name: std.name || `تلميذ #${idx + 1}`,
                avg: avg !== null ? parseFloat(avg.toFixed(2)) : null,
                totalAbsHours,
                unjustifiedAbsHours,
                appreciation,
                category,
                orientationAdvice
            });
        });

        // ترتيب التلاميذ تنازلياً حسب المعدل
        evaluatedStudents.sort((a, b) => {
            if (a.avg === null && b.avg === null) return 0;
            if (a.avg === null) return 1;
            if (b.avg === null) return -1;
            return b.avg - a.avg;
        });

        const overallAvg = testedCount > 0 ? parseFloat((sumMarks / testedCount).toFixed(2)) : 0;
        const passRate = testedCount > 0 ? parseFloat(((passCount / testedCount) * 100).toFixed(1)) : 0;

        return {
            totalRegistered: students.length,
            testedCount,
            absentCount: students.length - testedCount,
            passCount,
            passRate,
            overallAvg,
            maxMark: maxMark !== -1 ? parseFloat(maxMark.toFixed(2)) : 0,
            minMark: minMark !== 999 ? parseFloat(minMark.toFixed(2)) : 0,
            highCount,
            middleCount,
            alertCount,
            criticalCount,
            coef,
            examCount,
            recCurric,
            students: evaluatedStudents
        };
    }

    /**
     * بناء كود HTML الكامل لمحضر اجتماع مجلس القسم الرسمي
     */
    function buildPedagogicalCouncilPvHTML(className, semester, options = {}) {
        const db = window.db || {};
        const pAcademy = (db.teacherProfile && db.teacherProfile.academy) || 'الأكاديمية الجهوية للتربية والتكوين';
        const pDirectorate = (db.teacherProfile && db.teacherProfile.directorate) || 'المديرية الإقليمية';
        const pSchool = (db.teacherProfile && db.teacherProfile.school) || 'الثانوية التأهيلية';
        const pTeacher = (db.teacherProfile && db.teacherProfile.name) || 'أستاذ(ة) مادة الرياضيات';
        const pYear = (db.teacherProfile && db.teacherProfile.academicYear) || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        const sem = semester || window.activeSemester || 's1';
        const semLabel = sem === 's2' ? 'نهاية الدورة الثانية (نهاية السنة الدراسية)' : 'نهاية الدورة الأولى (الأسدوس الأول)';

        const stats = getCouncilClassStatistics(className, sem);
        const massarAudit = auditClassMassarCodes(className);

        const rowsHtml = stats.students.map((std, i) => {
            const rank = std.avg !== null ? (i + 1) : '-';
            const avgBadgeColor = std.avg === null ? '#94a3b8' : (std.avg >= 12 ? '#15803d' : (std.avg >= 10 ? '#0284c7' : (std.avg >= 8 ? '#d97706' : '#dc2626')));
            const avgBgColor = std.avg === null ? '#f8fafc' : (std.avg >= 10 ? '#f0fdf4' : (std.avg >= 8 ? '#fffbeb' : '#fef2f2'));

            return `
            <tr style="border-bottom: 1px solid #cbd5e1; page-break-inside: avoid; background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="padding: 6px 4px; text-align: center; font-weight: 800; border: 1px solid #cbd5e1; color: #1e3a8a;">${rank}</td>
                <td style="padding: 6px 4px; text-align: center; font-family: monospace; font-size: 0.78rem; font-weight: 700; border: 1px solid #cbd5e1;">${std.massar || '—'}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 700; border: 1px solid #cbd5e1; color: #0f172a;">${std.name}</td>
                <td style="padding: 6px 4px; text-align: center; font-weight: 900; font-size: 0.88rem; border: 1px solid #cbd5e1; background: ${avgBgColor}; color: ${avgBadgeColor};">
                    ${std.avg !== null ? std.avg.toFixed(2) : '<span style="color:#94a3b8; font-size:0.75rem;">غائب</span>'}
                </td>
                <td style="padding: 6px 6px; text-align: center; font-size: 0.76rem; font-weight: 700; border: 1px solid #cbd5e1; color: #334155;">${std.appreciation}</td>
                <td style="padding: 6px 4px; text-align: center; font-size: 0.78rem; border: 1px solid #cbd5e1; font-weight: 700; color: ${std.unjustifiedAbsHours > 4 ? '#be123c' : '#475569'};">
                    ${std.totalAbsHours > 0 ? `${std.totalAbsHours} س <span style="font-size:0.7rem; color:#dc2626;">(${std.unjustifiedAbsHours}غ.م)</span>` : '0'}
                </td>
                <td style="padding: 6px 8px; text-align: right; font-size: 0.75rem; font-weight: 600; border: 1px solid #cbd5e1; color: #1e293b;">
                    ${std.orientationAdvice}
                </td>
            </tr>
            `;
        }).join('');

        return `
        <div class="official-pv-container" style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; color: #0f172a; padding: 15px; background: #ffffff;">
            <!-- Official Moroccan Ministerial Header -->
            <div style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="text-align: right; font-size: 0.8rem; line-height: 1.5; font-weight: 700; color: #1e3a8a;">
                    <div>المملكة المغربية</div>
                    <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                    <div>${pAcademy}</div>
                    <div>${pDirectorate}</div>
                    <div style="color: #0f172a; font-weight: 800;">${pSchool}</div>
                </div>
                <div style="text-align: center;">
                    <div style="display: inline-block; padding: 6px 16px; border: 2px solid #1e3a8a; border-radius: 10px; background: #f0f7ff;">
                        <h2 style="margin: 0; font-size: 1.15rem; font-weight: 900; color: #1e3a8a;">محضر اجتماع مجلس القسم الرسمي</h2>
                        <div style="font-size: 0.82rem; font-weight: 800; color: #0284c7; margin-top: 2px;">تقرير نتائج مادة الرياضيات • ${semLabel}</div>
                    </div>
                    <div style="font-size: 0.76rem; color: #64748b; font-weight: 700; margin-top: 4px;">الموسم الدراسي: ${pYear}</div>
                </div>
                <div style="text-align: left; font-size: 0.8rem; line-height: 1.5; font-weight: 700; color: #334155;">
                    <div><strong>القسم:</strong> <span style="color: #1e3a8a; font-size: 0.95rem; font-weight: 900;">${className}</span></div>
                    <div><strong>المسلك:</strong> ${(stats.recCurric && stats.recCurric.branchLabel) || 'التعليم الثانوي التأهيلي'}</div>
                    <div><strong>معامل المادة:</strong> <span style="color: #be123c; font-weight: 900;">${stats.coef}</span> (مسار)</div>
                    <div><strong>الأستاذ(ة):</strong> ${pTeacher}</div>
                </div>
            </div>

            <!-- Key Statistical Indicators Matrix (KPIs) -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 14px;">
                <div style="font-size: 0.85rem; font-weight: 900; color: #1e3a8a; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <span>📊 المؤشرات الإحصائية العامة للتحصيل الصفي:</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; text-align: center;">
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">عدد المسجلين</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #0f172a;">${stats.totalRegistered}</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">الممتحنون فعلياً</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #0284c7;">${stats.testedCount}</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">معدل القسم</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: ${stats.overallAvg >= 10 ? '#15803d' : '#dc2626'};">${stats.overallAvg} <span style="font-size:0.7rem;">/20</span></div>
                    </div>
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">نسبة النجاح (≥10)</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: ${stats.passRate >= 60 ? '#15803d' : '#dc2626'};">${stats.passRate}%</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">أعلى نقطة / أدنى نقطة</div>
                        <div style="font-size: 0.95rem; font-weight: 900; color: #475569; margin-top: 3px;">${stats.maxMark} / ${stats.minMark}</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 700;">تعثر حاد (&lt;8)</div>
                        <div style="font-size: 1.15rem; font-weight: 900; color: #be123c;">${stats.criticalCount} <span style="font-size:0.7rem;">تلاميذ</span></div>
                    </div>
                </div>
            </div>

            <!-- Table of Students & Orientation Advice -->
            <div style="margin-bottom: 14px; overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: center;">
                    <thead>
                        <tr style="background: #1e3a8a; color: #ffffff; font-weight: 800;">
                            <th style="padding: 8px 4px; border: 1px solid #1e3a8a; width: 40px;">الرتبة</th>
                            <th style="padding: 8px 4px; border: 1px solid #1e3a8a; width: 95px;">رقم مسار</th>
                            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right;">الاسم والنسب الكامل</th>
                            <th style="padding: 8px 4px; border: 1px solid #1e3a8a; width: 85px;">المعدل (/20)</th>
                            <th style="padding: 8px 6px; border: 1px solid #1e3a8a; width: 140px;">التقدير التربوي</th>
                            <th style="padding: 8px 4px; border: 1px solid #1e3a8a; width: 75px;">الغياب (س)</th>
                            <th style="padding: 8px 8px; border: 1px solid #1e3a8a; text-align: right;">ملاحظات وقرار التوجيه المقترح</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Recommendations & Council Resolutions -->
            <div style="background: #fdf4ff; border: 1.5px solid #f0abfc; border-radius: 8px; padding: 10px 14px; margin-bottom: 15px; font-size: 0.8rem; line-height: 1.6;">
                <div style="font-weight: 800; color: #86198f; margin-bottom: 4px;">📌 خلاصات وتوصيات أستاذ المادة المرفوعة لمجلس القسم:</div>
                <ul style="margin: 0; padding-right: 20px; color: #4a044e;">
                    <li><strong>الدعم البيداغوجي:</strong> برمجة حصص معالجة مركزة لفائدة المتعثرين (${stats.criticalCount} تلاميذ دون عتبة 8) في المفاهيم الأساسية والأدوات الجبرية والتحليلية.</li>
                    <li><strong>المواظبة والانضباط:</strong> تنبيه أولياء أمور التلاميذ المسجلين لغيابات غير مبررة تفوق 4 ساعات تفادياً لتأثيرها المباشر على التحصيل.</li>
                    <li><strong>التوجيه والمواكبة:</strong> تشجيع المتعلمين ذوي المعدلات المتميزة (≥13.5) للالتحاق بشعب العلوم الرياضية والمسالك العلمية الدقيقة.</li>
                </ul>
            </div>

            <!-- Official Signatures Box (3 Official Visas) -->
            <div style="margin-top: 20px; padding-top: 10px; border-top: 1.5px dashed #94a3b8; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; page-break-inside: avoid;">
                <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 85px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">توقيع أستاذ(ة) المادة</div>
                        <div style="font-size: 0.72rem; color: #1e3a8a; font-weight: 700; margin-top: 2px;">${pTeacher}</div>
                    </div>
                    <div style="font-size: 0.68rem; color: #94a3b8;">التاريخ والإمضاء: ......................</div>
                </div>
                <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 85px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">تأشيرة ممثل الإدارة التربوية</div>
                        <div style="font-size: 0.7rem; color: #64748b;">(الحراسة العامة / الناظر)</div>
                    </div>
                    <div style="font-size: 0.68rem; color: #94a3b8;">الملاحظات: ......................</div>
                </div>
                <div style="border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; background: #fafafa; min-height: 85px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">تأشيرة وخاتم رئيس المؤسسة</div>
                        <div style="font-size: 0.7rem; color: #64748b;">(مدير الثانوية التأهيلية)</div>
                    </div>
                    <div style="font-size: 0.68rem; color: #94a3b8;">خاتم المؤسسة: ......................</div>
                </div>
            </div>
        </div>
        `;
    }

    /**
     * فتح نافذة محضر مجلس القسم التفاعلية
     */
    function openPedagogicalCouncilPvModal(className = null, semester = null) {
        let modal = document.getElementById('pedagogicalCouncilPvModal');
        if (!modal) {
            modal = createCouncilPvModalElement();
            document.body.appendChild(modal);
        }

        const classSelect = document.getElementById('classSelect');
        const activeCls = className || (classSelect ? classSelect.value : '') || Object.keys(window.db?.classes || {})[0] || '';
        const activeSem = semester || window.activeSemester || 's1';

        _councilState.selectedClass = activeCls;
        _councilState.semester = activeSem;

        // Populate dropdowns in modal
        const clsDropdown = document.getElementById('councilPvClassSelect');
        if (clsDropdown) {
            const classes = Object.keys(window.db?.classes || {});
            clsDropdown.innerHTML = classes.map(c => `<option value="${c}" ${c === activeCls ? 'selected' : ''}>${c}</option>`).join('');
        }
        const semDropdown = document.getElementById('councilPvSemesterSelect');
        if (semDropdown) {
            semDropdown.value = activeSem;
        }

        renderCouncilPvPreview();
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);
    }

    function closePedagogicalCouncilPvModal() {
        const modal = document.getElementById('pedagogicalCouncilPvModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * تحديث معاينة المحضر داخل النافذة
     */
    function renderCouncilPvPreview() {
        const previewBox = document.getElementById('councilPvPreviewContainer');
        if (!previewBox) return;

        const cls = _councilState.selectedClass;
        const sem = _councilState.semester;

        if (!cls) {
            previewBox.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">يرجى اختيار القسم لعرض محضر مجلس القسم.</div>';
            return;
        }

        previewBox.innerHTML = buildPedagogicalCouncilPvHTML(cls, sem);
    }

    /**
     * طباعة المحضر A4
     */
    function printPedagogicalCouncilPv() {
        const cls = _councilState.selectedClass;
        const sem = _councilState.semester;
        if (!cls) return;

        const html = buildPedagogicalCouncilPvHTML(cls, sem);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>محضر مجلس القسم - ${cls} - مادة الرياضيات</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 0; background: #fff; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = function() { window.print(); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    /**
     * تصدير ورقة التنقيط الرسمية لمسار بصيغة Excel
     */
    function exportCouncilMassarFicheExcel() {
        const cls = _councilState.selectedClass;
        const sem = _councilState.semester;
        if (!cls || !window.XLSX) {
            alert('لا توجد بيانات متاحة أو مكتبة Excel غير محملة');
            return;
        }

        const stats = getCouncilClassStatistics(cls, sem);
        const data = [
            ['المملكة المغربية', 'وزارة التربية الوطنية والتعليم الأولي والرياضة', 'منظومة مسار للتدبير المدرسي'],
            ['ورقة تنقيط مادة الرياضيات لمجلس القسم الرسمي', `القسم: ${cls}`, `الدورة: ${sem === 's2' ? 'الثانية' : 'الأولى'}`],
            [''],
            ['الرتبة', 'رقم مسار', 'النسب والاسم الكامل', 'معدل الرياضيات', 'التقدير التربوي الوزاري', 'مجموع ساعات الغياب', 'الغياب غير المبرر', 'مقترح التوجيه']
        ];

        stats.students.forEach((s, i) => {
            data.push([
                s.avg !== null ? (i + 1) : '',
                s.massar,
                s.name,
                s.avg !== null ? s.avg : '',
                s.appreciation,
                s.totalAbsHours,
                s.unjustifiedAbsHours,
                s.orientationAdvice
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `مجلس_${cls.slice(0, 10)}`);
        XLSX.writeFile(wb, `محضر_مجلس_القسم_${cls}_${sem}.xlsx`);
    }

    /**
     * بناء عنصر النافذة المنبثقة
     */
    function createCouncilPvModalElement() {
        const m = document.createElement('div');
        m.id = 'pedagogicalCouncilPvModal';
        m.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(5px); z-index: 10070; align-items: center; justify-content: center; padding: 14px;';
        m.onclick = (e) => { if (e.target === m) closePedagogicalCouncilPvModal(); };

        m.innerHTML = `
        <div class="card" style="width: 100%; max-width: 1080px; max-height: 94vh; display: flex; flex-direction: column; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);">
            <!-- Header -->
            <div style="padding: 14px 20px; border-bottom: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 9px; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff;">
                        <span data-lucide="file-check" data-size="20"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: #0f172a;">محضر اجتماع مجلس القسم الرسمي (Procès-Verbal Officiel)</h3>
                        <div style="font-size: 0.76rem; color: #64748b; font-weight: 600;">التقرير الإداري والتربوي لنتائج مادة الرياضيات وتوصيات التوجيه لمجالس الأقسام</div>
                    </div>
                </div>
                <!-- Controls -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <select id="councilPvClassSelect" onchange="window.onCouncilPvClassChanged(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff;"></select>
                    <select id="councilPvSemesterSelect" onchange="window.onCouncilPvSemesterChanged(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff;">
                        <option value="s1">الدورة الأولى (الأسدوس 1)</option>
                        <option value="s2">الدورة الثانية (الأسدوس 2)</option>
                    </select>
                    <button type="button" onclick="window.printPedagogicalCouncilPv()" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
                        <span data-lucide="printer" data-size="16"></span>
                        <span>طباعة A4 رسمية</span>
                    </button>
                    <button type="button" onclick="window.exportCouncilMassarFicheExcel()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(5,150,105,0.25);">
                        <span data-lucide="file-spreadsheet" data-size="16"></span>
                        <span>تصدير لمسار Excel</span>
                    </button>
                    <button type="button" onclick="window.closePedagogicalCouncilPvModal()" style="background: #f1f5f9; border: none; color: #64748b; width: 32px; height: 32px; border-radius: 8px; font-size: 1.2rem; cursor: pointer;">✕</button>
                </div>
            </div>

            <!-- Preview Body -->
            <div id="councilPvPreviewContainer" style="flex: 1; overflow-y: auto; padding: 20px; background: #f1f5f9;"></div>
        </div>
        `;
        return m;
    }

    // Handlers
    window.onCouncilPvClassChanged = function (cls) {
        _councilState.selectedClass = cls;
        renderCouncilPvPreview();
    };

    window.onCouncilPvSemesterChanged = function (sem) {
        _councilState.semester = sem;
        renderCouncilPvPreview();
    };

    // Global exports
    window.openPedagogicalCouncilPvModal = openPedagogicalCouncilPvModal;
    window.closePedagogicalCouncilPvModal = closePedagogicalCouncilPvModal;
    window.printPedagogicalCouncilPv = printPedagogicalCouncilPv;
    window.exportCouncilMassarFicheExcel = exportCouncilMassarFicheExcel;
    window.buildPedagogicalCouncilPvHTML = buildPedagogicalCouncilPvHTML;
    window.auditClassMassarCodes = auditClassMassarCodes;
    window.getCouncilClassStatistics = getCouncilClassStatistics;

})(window);
