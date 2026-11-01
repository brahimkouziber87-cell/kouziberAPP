/**
 * Moroccan Educational Attendance & Absence Slip Module
 * وحدة ورقة غياب الحصة الرسمية (الحراسة العامة) وتتبع الغياب المباشر
 * مصممة خصيصاً للمنظومة التربوية المغربية (مؤسسات التعليم العمومي والخصوصي وحصص الدعم)
 */

(function () {
    'use strict';

    // أسماء الشهور والشهور الميلادية بالعربية
    const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
    const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    function getFormattedArabicDate(dateStr) {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const monthIdx = parseInt(parts[1], 10) - 1;
                const dayNum = parseInt(parts[2], 10);
                const d = new Date(year, monthIdx, dayNum);
                const dayName = ARABIC_DAYS[d.getDay()] || '';
                const monthName = ARABIC_MONTHS[monthIdx] || '';
                return `${dayName} ${dayNum} ${monthName} ${year}`;
            }
        } catch (e) {
            console.error('Error formatting date', e);
        }
        return dateStr;
    }

    /**
     * تجميع بيانات الغياب للحصة المحددة حالياً
     */
    function getSessionAbsenceData() {
        const classSelect = document.getElementById('classSelect');
        const datePicker = document.getElementById('datePicker');
        const sessionSelect = document.getElementById('sessionSelect');

        if (!classSelect || !datePicker || !sessionSelect) return null;

        const className = classSelect.value;
        const date = datePicker.value;
        const session = sessionSelect.value;
        const duration = (typeof currentDuration !== 'undefined') ? currentDuration : 2;

        if (!className || !window.db || !window.db.classes || !window.db.classes[className]) {
            return null;
        }

        const students = window.db.classes[className];
        const teacherProfile = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const teacherName = teacherProfile.name ? teacherProfile.name : 'أستاذ المادة';
        const institutionName = teacherProfile.school || teacherProfile.institution || (window.db && (window.db.schoolName || window.db.institution)) || 'الثانوية التأهيلية';

        const absentList = [];
        const lateList = [];
        const noHwList = [];
        const presentList = [];

        students.forEach(std => {
            let rec = null;
            if (typeof window.getRecord === 'function') {
                rec = window.getRecord(std.id, date, session);
            } else if (window.db.records) {
                rec = window.db.records.find(r => r.studentId === std.id && r.date === date && r.session === session);
            }

            const status = rec ? rec.status : 'حاضر';
            const part = rec ? (rec.part || 'all') : 'all';
            const hw = rec ? rec.homework : 'منجز';
            const recDuration = rec ? (rec.duration || duration) : duration;

            if (status === 'غائب') {
                let durationText = `${recDuration} ساعة`;
                if (part === 'h1') durationText = 'ساعة أولى (س1)';
                else if (part === 'h2') durationText = 'ساعة ثانية (س2)';
                else if (recDuration === 2) durationText = 'ساعتان (2س)';

                absentList.push({
                    orderNum: std.orderNum,
                    id: std.id,
                    name: std.name,
                    massar: std.massar || '-',
                    duration: recDuration,
                    durationText: durationText,
                    statusText: 'غائب',
                    isJustified: false
                });
            } else if (status === 'مبرر') {
                let durationText = `${recDuration} ساعة`;
                if (part === 'h1') durationText = 'ساعة أولى (س1)';
                else if (part === 'h2') durationText = 'ساعة ثانية (س2)';

                absentList.push({
                    orderNum: std.orderNum,
                    id: std.id,
                    name: std.name,
                    massar: std.massar || '-',
                    duration: recDuration,
                    durationText: durationText,
                    statusText: 'غياب مبرر',
                    isJustified: true
                });
            } else if (status === 'متأخر') {
                lateList.push({
                    orderNum: std.orderNum,
                    id: std.id,
                    name: std.name,
                    massar: std.massar || '-'
                });
                presentList.push(std);
            } else {
                presentList.push(std);
            }

            if (hw === 'لم ينجز') {
                noHwList.push({
                    orderNum: std.orderNum,
                    id: std.id,
                    name: std.name,
                    massar: std.massar || '-'
                });
            }
        });

        const totalStudents = students.length;
        const absentCount = absentList.length;
        const lateCount = lateList.length;
        const presentCount = totalStudents - absentCount;
        const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '100';

        return {
            className,
            date,
            dateFormatted: getFormattedArabicDate(date),
            session,
            duration,
            teacherName,
            institutionName,
            totalStudents,
            presentCount,
            absentCount,
            lateCount,
            attendanceRate,
            absentList,
            lateList,
            noHwList
        };
    }

    /**
     * فتح نافذة ورقة غياب الحصة الرسمية
     */
    window.openSessionAbsenceSlipModal = function () {
        const data = getSessionAbsenceData();
        if (!data) {
            alert('يرجى اختيار القسم وتحديد التاريخ والحصة أولاً لعرض ورقة الغياب.');
            return;
        }

        let modal = document.getElementById('sessionAbsenceSlipModal');
        if (!modal) {
            createSessionAbsenceSlipModalDOM();
            modal = document.getElementById('sessionAbsenceSlipModal');
        }

        renderSessionAbsenceSlipContent(data);
        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    };

    /**
     * إغلاق نافذة ورقة الغياب
     */
    window.closeSessionAbsenceSlipModal = function () {
        const modal = document.getElementById('sessionAbsenceSlipModal');
        if (modal) modal.style.display = 'none';
    };

    /**
     * إنشاء عنصر DOM للنافذة المنبثقة
     */
    function createSessionAbsenceSlipModalDOM() {
        const modal = document.createElement('div');
        modal.id = 'sessionAbsenceSlipModal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); z-index: 10003; align-items: center; justify-content: center; flex-direction: column; padding: 15px; overflow-y: auto;';

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 680px; padding: 22px; max-height: 92vh; overflow-y: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center;">
                            <span data-lucide="clipboard-list" data-size="20"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; color: #0f172a; font-family: 'Cairo', sans-serif; font-weight: 800;">
                                ورقة غياب الحصة الرسمية (الحراسة العامة)
                            </h3>
                            <div style="font-size: 0.78rem; color: #64748b;">قسيمة إخبار الإدارة والحراسة العامة بغياب وتأخر التلاميذ</div>
                        </div>
                    </div>
                    <button type="button" onclick="closeSessionAbsenceSlipModal()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; color: #64748b; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <!-- حاوية المحتوى الديناميكي -->
                <div id="sessionAbsenceSlipContent"></div>

                <!-- أزرار الإجراءات السريعة -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <button type="button" onclick="printSessionAbsenceSlip()" class="btn-primary" style="flex: 1.2; min-width: 160px; background: #0284c7; color: #ffffff; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
                        <span data-lucide="printer" data-size="16"></span>
                        طباعة ورقة الغياب
                    </button>
                    <button type="button" onclick="registerCurrentSessionSlipToAdminFollowUp()" class="btn-primary" style="flex: 1.3; min-width: 180px; background: linear-gradient(135deg, #4f46e5, #4338ca); color: #ffffff; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;" title="توثيق تسليم الورقة للإدارة وتفعيل نظام مراقبة أجل الـ 48 ساعة">
                        <span data-lucide="shield-alert" data-size="16"></span>
                        توثيق للإدارة (مراقبة 48س)
                    </button>
                    <button type="button" onclick="copySessionAbsenceReportToWhatsApp()" class="btn-success" style="flex: 1.2; min-width: 160px; background: #10b981; color: #ffffff; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
                        <span data-lucide="copy" data-size="16"></span>
                        نسخ تقرير الحراسة
                    </button>
                    <button type="button" onclick="shareSessionAbsenceViaWhatsApp()" style="background: #25d366; color: #ffffff; border: none; padding: 10px 14px; border-radius: 8px; font-weight: 800; font-size: 0.86rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" title="إرسال مباشر عبر واتساب">
                        <span data-lucide="message-circle" data-size="16"></span>
                        واتساب
                    </button>
                    <button type="button" onclick="closeSessionAbsenceSlipModal()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer;">
                        إغلاق
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * رندرة محتوى ورقة الغياب
     */
    function renderSessionAbsenceSlipContent(data) {
        const container = document.getElementById('sessionAbsenceSlipContent');
        if (!container) return;

        let absentRowsHtml = '';
        if (data.absentList.length > 0) {
            data.absentList.forEach((st, idx) => {
                const tagColor = st.isJustified ? '#ca8a04' : '#dc2626';
                const tagBg = st.isJustified ? '#fefce8' : '#fef2f2';
                const tagBorder = st.isJustified ? '#fef08a' : '#fecaca';

                absentRowsHtml += `
                    <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                        <td style="padding: 8px 10px; text-align: center; font-weight: 800; color: #475569; font-size: 0.85rem;">${st.orderNum}</td>
                        <td style="padding: 8px 10px; font-weight: 800; color: #1e293b; font-size: 0.9rem;">${st.name}</td>
                        <td style="padding: 8px 10px; text-align: center; color: #64748b; font-size: 0.8rem; font-family: monospace;">${st.massar}</td>
                        <td style="padding: 8px 10px; text-align: center;">
                            <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; background: ${tagBg}; color: ${tagColor}; border: 1px solid ${tagBorder};">
                                ${st.durationText}
                            </span>
                        </td>
                        <td style="padding: 8px 10px; text-align: center; font-size: 0.8rem; color: #64748b;">
                            ${st.isJustified ? 'تبرير مسلم' : 'غير مبرر'}
                        </td>
                    </tr>
                `;
            });
        }

        let lateRowsHtml = '';
        if (data.lateList.length > 0) {
            data.lateList.forEach(st => {
                lateRowsHtml += `
                    <span style="display: inline-flex; align-items: center; gap: 4px; background: #fff7ed; color: #c2410c; border: 1px solid #fed7aa; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">
                        <span>(${st.orderNum})</span> ${st.name}
                    </span>
                `;
            });
        }

        let noHwHtml = '';
        if (data.noHwList.length > 0) {
            data.noHwList.forEach(st => {
                noHwHtml += `
                    <span style="display: inline-flex; align-items: center; gap: 4px; background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">
                        <span>(${st.orderNum})</span> ${st.name}
                    </span>
                `;
            });
        }

        const html = `
            <div id="printableSlipArea" style="background: #ffffff; padding: 15px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'Cairo', sans-serif;">
                <!-- الترويسة المغربية الرسمية -->
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px;">
                    ${typeof window.getDualLogosHTML === 'function' ? `<div style="margin-bottom: 6px;">${window.getDualLogosHTML('print')}</div>` : ''}
                    <div style="font-size: 0.75rem; color: #475569; font-weight: 700;">المملكة المغربية</div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 1px;">الأكاديمية الجهوية للتربية والتكوين • المديرية الإقليمية</div>
                    <div style="display: inline-block; margin-top: 6px; background: #0f172a; color: #ffffff; padding: 4px 16px; border-radius: 4px; font-size: 0.95rem; font-weight: 800; letter-spacing: 0.5px;">
                        ورقة غياب الحصة الرسمية (الحراسة العامة)
                    </div>
                </div>

                <!-- شبكة بيانات الحصة -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 14px; font-size: 0.83rem;">
                    <div><strong style="color: #475569;">المؤسسة:</strong> <span style="font-weight: 800; color: #0f172a;">${data.institutionName}</span></div>
                    <div><strong style="color: #475569;">القسم:</strong> <span style="font-weight: 800; color: #0284c7;">${data.className}</span></div>
                    <div><strong style="color: #475569;">المادة:</strong> <span style="font-weight: 800; color: #0f172a;">الرياضيات</span></div>
                    <div><strong style="color: #475569;">الأستاذ:</strong> <span style="font-weight: 800; color: #0f172a;">${data.teacherName}</span></div>
                    <div><strong style="color: #475569;">التاريخ:</strong> <span style="font-weight: 800; color: #0f172a;">${data.dateFormatted}</span></div>
                    <div><strong style="color: #475569;">الحصة:</strong> <span style="font-weight: 800; color: #0f172a;">${data.session} (${data.duration}س)</span></div>
                </div>

                <!-- شريط المؤشرات الرقمية -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; text-align: center;">
                    <div style="background: #f1f5f9; padding: 6px 4px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <div style="font-size: 0.7rem; color: #64748b; font-weight: 700;">مجموع التلاميذ</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #1e293b;">${data.totalStudents}</div>
                    </div>
                    <div style="background: #ecfdf5; padding: 6px 4px; border-radius: 6px; border: 1px solid #a7f3d0;">
                        <div style="font-size: 0.7rem; color: #059669; font-weight: 700;">الحاضرون</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #059669;">${data.presentCount} (${data.attendanceRate}%)</div>
                    </div>
                    <div style="background: ${data.absentCount > 0 ? '#fef2f2' : '#f8fafc'}; padding: 6px 4px; border-radius: 6px; border: 1px solid ${data.absentCount > 0 ? '#fecaca' : '#e2e8f0'};">
                        <div style="font-size: 0.7rem; color: ${data.absentCount > 0 ? '#dc2626' : '#64748b'}; font-weight: 700;">الغائبون</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: ${data.absentCount > 0 ? '#dc2626' : '#1e293b'};">${data.absentCount}</div>
                    </div>
                    <div style="background: ${data.lateCount > 0 ? '#fff7ed' : '#f8fafc'}; padding: 6px 4px; border-radius: 6px; border: 1px solid ${data.lateCount > 0 ? '#fed7aa' : '#e2e8f0'};">
                        <div style="font-size: 0.7rem; color: ${data.lateCount > 0 ? '#c2410c' : '#64748b'}; font-weight: 700;">المتأخرون</div>
                        <div style="font-size: 1.05rem; font-weight: 800; color: ${data.lateCount > 0 ? '#c2410c' : '#1e293b'};">${data.lateCount}</div>
                    </div>
                </div>

                <!-- جدول الغائبين -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 0.85rem; font-weight: 800; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                        <span>❌ لائحة التلاميذ الغائبين في هذه الحصة:</span>
                        <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">(يُسلم فوراً للحراسة العامة)</span>
                    </div>

                    ${data.absentList.length === 0 ? `
                        <div style="background: #f0fdf4; border: 1px solid #86efac; color: #15803d; padding: 12px; border-radius: 6px; text-align: center; font-weight: 800; font-size: 0.88rem;">
                            ✓ حضور تام بنسبة 100% — لا يوجد أي تلميذ غائب في هذه الحصة!
                        </div>
                    ` : `
                        <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
                            <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.82rem;">
                                <thead>
                                    <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
                                        <th style="padding: 6px 10px; width: 40px; text-align: center;">ر.ت</th>
                                        <th style="padding: 6px 10px;">الاسم الكامل للتلميذ(ة)</th>
                                        <th style="padding: 6px 10px; text-align: center; width: 110px;">رقم مسار</th>
                                        <th style="padding: 6px 10px; text-align: center; width: 120px;">المدة المسجلة</th>
                                        <th style="padding: 6px 10px; text-align: center; width: 90px;">الملاحظة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${absentRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>

                <!-- قسم المتأخرين إن وجدوا -->
                ${data.lateList.length > 0 ? `
                    <div style="margin-bottom: 12px; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 10px; border-radius: 6px;">
                        <strong style="color: #92400e; font-size: 0.8rem; display: block; margin-bottom: 4px;">⏳ التلاميذ المتأخرون عن الحصة (${data.lateList.length}):</strong>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${lateRowsHtml}
                        </div>
                    </div>
                ` : ''}

                <!-- قسم عدم إنجاز الواجب إن وجدوا -->
                ${data.noHwList.length > 0 ? `
                    <div style="margin-bottom: 12px; background: #fef2f2; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 6px;">
                        <strong style="color: #991b1b; font-size: 0.8rem; display: block; margin-bottom: 4px;">⚠️ تلاميذ لم ينجزوا الواجب المنزلي (${data.noHwList.length}):</strong>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${noHwHtml}
                        </div>
                    </div>
                ` : ''}

                <!-- خانة التوقيعات الرسمية -->
                <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 0.82rem;">
                    <div style="text-align: center; width: 45%;">
                        <div style="color: #475569; font-weight: bold; margin-bottom: 30px;">توقيع أستاذ المادة:</div>
                        <div style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.72rem; padding-top: 3px;">ذ. ${data.teacherName}</div>
                    </div>
                    <div style="text-align: center; width: 45%;">
                        <div style="color: #475569; font-weight: bold; margin-bottom: 30px;">تأشيرة الحراسة العامة / الإدارة:</div>
                        <div style="border-top: 1px solid #94a3b8; width: 80%; margin: 0 auto; color: #64748b; font-size: 0.72rem; padding-top: 3px;">حرر بتاريخ: ${data.date}</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * طباعة ورقة الغياب بتنسيق رسمي مخصص للطابعة
     */
    window.printSessionAbsenceSlip = function () {
        const area = document.getElementById('printableSlipArea');
        if (!area) return;

        const activePrintFont = typeof window.getSelectedPrintFontFamily === 'function' ? window.getSelectedPrintFontFamily() : "'Cairo', 'Amiri', system-ui, sans-serif";
        const slipHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>ورقة غياب الحصة - الحراسة العامة</title>
                <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: ${activePrintFont};
                        direction: rtl;
                        margin: 15px;
                        color: #0f172a;
                        background: #fff;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #334155;
                        padding: 6px 8px;
                    }
                    @media print {
                        body { margin: 10mm; }
                        @page { size: A5 landscape; margin: 8mm; }
                    }
                </style>
            </head>
            <body>
                ${area.innerHTML}
            </body>
            </html>
        `;
        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(slipHtml, 'ورقة غياب الحصة - الحراسة العامة');
        } else if (typeof window.printHtmlViaIframe === 'function') {
            window.printHtmlViaIframe(slipHtml);
        }
    };

    /**
     * نسخ تقرير الحصة للحراسة العامة بصيغة منسقة للواتساب
     */
    window.copySessionAbsenceReportToWhatsApp = function () {
        const data = getSessionAbsenceData();
        if (!data) return;

        let absentText = '';
        if (data.absentList.length === 0) {
            absentText = '✔ *الحضور تام (0 غياب)* — نسبة الحضور: 100%\n';
        } else {
            data.absentList.forEach((st, i) => {
                absentText += `${i + 1}. *${st.name}* (رقم: ${st.orderNum} | مسار: ${st.massar}) ⬅ *${st.durationText}* (${st.statusText})\n`;
            });
        }

        let lateText = '';
        if (data.lateList.length > 0) {
            lateText = '\n⏳ *المتأخرون (' + data.lateList.length + '):*\n';
            data.lateList.forEach((st, i) => {
                lateText += `${i + 1}. ${st.name} (رقم ${st.orderNum})\n`;
            });
        }

        let noHwText = '';
        if (data.noHwList.length > 0) {
            noHwText = '\n⚠️ *عدم إنجاز الواجب المنزلي (' + data.noHwList.length + '):*\n';
            data.noHwList.forEach((st, i) => {
                noHwText += `${i + 1}. ${st.name} (رقم ${st.orderNum})\n`;
            });
        }

        const report = `📋 *ورقة غياب الحصة — ${data.institutionName}*
----------------------------------------
• *القسم:* ${data.className}
• *المادة:* الرياضيات | *الأستاذ:* ذ. ${data.teacherName}
• *التاريخ:* ${data.dateFormatted}
• *الحصة:* ${data.session} (${data.duration}س)
----------------------------------------
📊 *إحصائيات الحضور:*
• المسجلون: ${data.totalStudents} | الحاضرون: ${data.presentCount} (${data.attendanceRate}%)
• الغائبون: ${data.absentCount} | المتأخرون: ${data.lateCount}

❌ *لائحة الغائبين:*
${absentText}${lateText}${noHwText}----------------------------------------
_تقرير تلقائي من تطبيق الأستاذ للغياب والتنقيط_`;

        navigator.clipboard.writeText(report).then(() => {
            showToastMessage('تم نسخ تقرير الحراسة العامة إلى الحافظة بنجاح ✓ يمكنك لصقه في واتساب فوراً');
        }).catch(() => {
            alert('تعذر النسخ التلقائي، يمكنك نسخ النص يدوياً.');
        });
    };

    /**
     * مشاركة التقرير مباشرة عبر تطبيق واتساب
     */
    window.shareSessionAbsenceViaWhatsApp = function () {
        const data = getSessionAbsenceData();
        if (!data) return;

        let absentText = '';
        if (data.absentList.length === 0) {
            absentText = '✔ *الحضور تام (0 غياب)*\n';
        } else {
            data.absentList.forEach((st, i) => {
                absentText += `${i + 1}. *${st.name}* (رقم: ${st.orderNum}) ⬅ *${st.durationText}*\n`;
            });
        }

        const text = encodeURIComponent(`📋 *إشعار غياب الحصة — ${data.className}*
• المؤسسة: ${data.institutionName}
• التاريخ: ${data.dateFormatted}
• الحصة: ${data.session}
• الأستاذ: ذ. ${data.teacherName}

📊 الحاضرون: ${data.presentCount} / ${data.totalStudents} (${data.attendanceRate}%)
❌ الغائبون (${data.absentCount}):
${absentText}`);

        window.open('https://api.whatsapp.com/send?text=' + text, '_blank');
    };

    // تنظيف تلقائي للقسم التجريبي إن وُجد سابقاً
    function cleanupSampleClassIfPresent() {
        try {
            const sampleClassName = '2 باك علوم رياضية (أ) - نموذج تجريبي';
            if (window.db && window.db.classes && window.db.classes[sampleClassName]) {
                delete window.db.classes[sampleClassName];
                if (window.db.classConfig) delete window.db.classConfig[sampleClassName];
                if (window.db.records) {
                    window.db.records = window.db.records.filter(r => r.className !== sampleClassName);
                }
                if (typeof window.saveDB === 'function') window.saveDB();
                if (typeof window.refreshClassDropdown === 'function') window.refreshClassDropdown();
            }
        } catch (e) {
            console.error('Cleanup sample class error:', e);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanupSampleClassIfPresent);
    } else {
        setTimeout(cleanupSampleClassIfPresent, 100);
    }

    /**
     * نافذة ملخص غياب حصة الدعم وإشعار الأولياء عبر واتساب
     * تفتح تلقائياً عند حفظ حصة دعم تحتوي على غياب
     */
    window.openTutoringAbsenceSummaryModal = function (sessionInfo, absentees, allStudents) {
        let modal = document.getElementById('tutoringAbsenceSummaryModal');
        if (!modal) {
            createTutoringAbsenceSummaryModalDOM();
            modal = document.getElementById('tutoringAbsenceSummaryModal');
        }

        const contentContainer = document.getElementById('tutoringAbsenceSummaryContent');
        if (!contentContainer) return;

        const dateFormatted = getFormattedArabicDate(sessionInfo.date);
        let listHtml = '';

        absentees.forEach(std => {
            const phone = std.phone ? std.phone.trim() : '';
            const hasPhone = phone.length >= 8;
            const statusBadge = std.attendanceStatus === 'absent' 
                ? '<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: bold;">غائب(ة)</span>'
                : '<span style="background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: bold;">متأخر(ة)</span>';

            const waMsg = encodeURIComponent(`السلام عليكم ورحمة الله ولي أمر التلميذ(ة) ${std.name}،

نحيطكم علماً بأن التلميذ(ة) قد تغيب(ت) عن حصة الدعم الخصوصي المقررة اليوم ${dateFormatted} على الساعة ${sessionInfo.time || '18:00'} (مجموعة: ${sessionInfo.group}).
${sessionInfo.topic ? `• موضوع الحصة المنجز: ${sessionInfo.topic}\n` : ''}${sessionInfo.homework ? `• الواجبات المطلوبة للحصة المقبلة: ${sessionInfo.homework}\n` : ''}
نرجو حث التلميذ(ة) على الحرص على الانضباط والمواظبة على الحصص لضمان الاستفادة والتحصيل الجيد.
شكراً جزيلاً لتعاونكم وحسن تواصلكم.`);

            const waLink = hasPhone 
                ? `https://api.whatsapp.com/send?phone=${cleanPhoneNumber(phone)}&text=${waMsg}`
                : `https://api.whatsapp.com/send?text=${waMsg}`;

            listHtml += `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                            ${std.name}
                            ${statusBadge}
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 3px;">
                            الهاتف: <strong style="color: ${hasPhone ? '#0f172a' : '#ef4444'};">${hasPhone ? phone : 'غير مسجل ⚠️'}</strong>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="background: #25d366; color: #ffffff; text-decoration: none; padding: 6px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                            <span>إشعار ولي الأمر بالغياب 📲</span>
                        </a>
                        ${!hasPhone ? `
                            <button type="button" onclick="window.promptSetStudentPhone('${std.id}')" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                + رقم
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        contentContainer.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 0.85rem;">
                <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <div><strong style="color: #475569;">المجموعة:</strong> <span style="font-weight: 800; color: #0284c7;">${sessionInfo.group}</span></div>
                    <div><strong style="color: #475569;">التاريخ والتوقيت:</strong> <span style="font-weight: 800; color: #0f172a;">${dateFormatted} (${sessionInfo.time || '18:00'})</span></div>
                    <div><strong style="color: #475569;">المدة:</strong> <span style="font-weight: 800; color: #0f172a;">${sessionInfo.hours} ساعات</span></div>
                </div>
                ${sessionInfo.topic ? `<div style="margin-top: 6px; color: #334155;"><strong>موضوع الدرس:</strong> ${sessionInfo.topic}</div>` : ''}
                ${sessionInfo.homework ? `<div style="margin-top: 4px; color: #b45309;"><strong>الواجب المنزلي:</strong> ${sessionInfo.homework}</div>` : ''}
            </div>

            <div style="margin-bottom: 10px;">
                <div style="font-size: 0.88rem; font-weight: 800; color: #991b1b; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>⚠️ تم رصد (${absentees.length}) تلاميذ غائبين/متأخرين في هذه الحصة:</span>
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: normal;">إرسال رسالة واتساب شخصية فورية لكل ولي أمر</span>
                </div>
                ${listHtml}
            </div>
        `;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    };

    /**
     * إغلاق نافذة ملخص غياب حصة الدعم
     */
    window.closeTutoringAbsenceSummaryModal = function () {
        const modal = document.getElementById('tutoringAbsenceSummaryModal');
        if (modal) modal.style.display = 'none';
    };

    /**
     * إنشاء DOM لنافذة ملخص غياب الدعم
     */
    function createTutoringAbsenceSummaryModalDOM() {
        const modal = document.createElement('div');
        modal.id = 'tutoringAbsenceSummaryModal';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); z-index: 10003; align-items: center; justify-content: center; flex-direction: column; padding: 15px; overflow-y: auto;';

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 600px; padding: 22px; max-height: 90vh; overflow-y: auto; background: #ffffff; border-radius: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 8px; background: #10b981; color: white; display: flex; align-items: center; justify-content: center;">
                            <span data-lucide="check-circle" data-size="20"></span>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; color: #0f172a; font-family: 'Cairo', sans-serif; font-weight: 800;">
                                تم تسجيل الحصة بنجاح! ملخص الغياب والتواصل
                            </h3>
                            <div style="font-size: 0.78rem; color: #64748b;">إشعار فوري لأولياء أمور التلاميذ الغائبين عبر واتساب</div>
                        </div>
                    </div>
                    <button type="button" onclick="closeTutoringAbsenceSummaryModal()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; color: #64748b; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div id="tutoringAbsenceSummaryContent"></div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                    <button type="button" class="btn-primary" onclick="closeTutoringAbsenceSummaryModal()" style="padding: 9px 24px; border-radius: 8px; font-weight: bold; background: #0f172a; color: #ffffff; border: none; cursor: pointer;">
                        إتمام وإغلاق ✓
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * مساعدة لإضافة رقم هاتف تلميذ سريعاً
     */
    window.promptSetStudentPhone = function (studentId) {
        if (!window.db || !window.db.tutoring || !window.db.tutoring.students) return;
        const std = window.db.tutoring.students.find(s => s.id === studentId);
        if (!std) return;

        const newPhone = prompt(`أدخل رقم هاتف ولي أمر التلميذ(ة) "${std.name}":`, std.phone || '');
        if (newPhone !== null) {
            std.phone = newPhone.trim();
            if (typeof window.saveDB === 'function') window.saveDB();
            if (typeof window.renderTutoringStudents === 'function') window.renderTutoringStudents();
            showToastMessage('تم حفظ رقم الهاتف بنجاح.');
        }
    };

    /**
     * تنظيف رقم الهاتف وإضافة مفتاح المغرب 212
     */
    function cleanPhoneNumber(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '212' + cleaned.substring(1);
        } else if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }

    /**
     * إظهار Toast خفيف ومريح
     */
    function showToastMessage(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 30px; z-index: 999999; font-family: "Cairo", sans-serif; font-weight: bold; font-size: 0.88rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; display: flex; align-items: center; gap: 8px;';
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.4s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3200);
    }

    /**
     * ربط ورقة غياب الحصة بنظام تتبع كشوفات المتابعة وتنبيهات الـ 48 ساعة للإدارة
     */
    window.registerCurrentSessionSlipToAdminFollowUp = function () {
        const data = getSessionAbsenceData();
        if (typeof window.openAdminFollowUpCreateModal === 'function') {
            if (typeof window.closeSessionAbsenceSlipModal === 'function') {
                window.closeSessionAbsenceSlipModal();
            }
            window.openAdminFollowUpCreateModal(data ? data.className : '');
            setTimeout(() => {
                if (data) {
                    const titleInput = document.getElementById('createFollowUpTitleInput');
                    if (titleInput) {
                        titleInput.value = `ورقة غياب الحصة الرسمية (${data.session}) - ${data.className}`;
                    }
                    const countInput = document.getElementById('createFollowUpStudentsCountInput');
                    if (countInput) {
                        countInput.value = data.absentCount || 1;
                    }
                    const notesInput = document.getElementById('createFollowUpNotesTextarea');
                    if (notesInput) {
                        notesInput.value = `إحالة ورقة غياب الحصة للحراسة العامة: ${data.absentCount} غائبين، ${data.lateCount} متأخرين في حصة ${data.session} (${data.dateFormatted}).`;
                    }
                }
            }, 60);
        } else {
            showToastMessage('نظام تتبع كشوفات المتابعة غير متاح حالياً');
        }
    };

})();
