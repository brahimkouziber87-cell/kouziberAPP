/**
 * tutoring-advanced.js
 * Advanced Private Tutoring Management Engine
 * - Sub-tab Navigation (Students, Weekly Schedule, Groups Hub, Analytics)
 * - Batch Student Management (Bulk Paid, Bulk Move, Bulk WhatsApp, Bulk Receipts)
 * - Multi-Student Performance Report Export (Combined PDF for Group, 1 per page or 2-in-1 cut-slip)
 * - Weekly Schedule Slots & Visual Timetable
 * - Group Management Hub & Analytics KPIs
 * - Comprehensive Student Profile / Dossier Modal
 */

(function () {
    'use strict';

    // Access app db safely across execution contexts
    function getDb() {
        return window.db || (typeof db !== 'undefined' ? db : { tutoring: { students: [], groups: [], scheduleSlots: [] } });
    }
    const db = new Proxy({}, {
        get(target, prop) {
            const actualDb = getDb();
            return actualDb ? actualDb[prop] : undefined;
        },
        set(target, prop, value) {
            const actualDb = getDb();
            if (actualDb) {
                actualDb[prop] = value;
                return true;
            }
            return false;
        }
    });

    // Global Selection Store for Batch Operations
    window.selectedTutoringStudentIds = new Set();
    window.currentBatchReportLayout = 'one_per_page';

    window.getSelectedTutoringStudentIds = function () {
        return Array.from(window.selectedTutoringStudentIds || []);
    };

    // =========================================================================
    // 1. SUB-TAB NAVIGATION
    // =========================================================================
    window.showTutoringSubTab = function (tabName) {
        const tabs = ['students', 'schedule', 'groups', 'attendance', 'analytics'];
        const panes = {
            students: document.getElementById('tutPaneStudents') || document.getElementById('tutoringStudentsPane'),
            schedule: document.getElementById('tutPaneSchedule') || document.getElementById('tutoringWeeklySchedulePane'),
            groups: document.getElementById('tutPaneGroups') || document.getElementById('tutoringGroupsPane'),
            attendance: document.getElementById('tutoringAttendancePane'),
            analytics: document.getElementById('tutPaneAnalytics') || document.getElementById('tutoringAnalyticsPane')
        };
        const buttons = {
            students: document.getElementById('tutBtnStudents') || document.getElementById('subTabTutoringStudents'),
            schedule: document.getElementById('tutBtnSchedule') || document.getElementById('subTabTutoringSchedule'),
            groups: document.getElementById('tutBtnGroups') || document.getElementById('subTabTutoringGroups'),
            attendance: document.getElementById('subTabTutoringAttendance'),
            analytics: document.getElementById('tutBtnAnalytics') || document.getElementById('subTabTutoringAnalytics')
        };

        tabs.forEach(t => {
            if (panes[t]) {
                panes[t].style.display = (t === tabName) ? 'block' : 'none';
            }
            if (buttons[t]) {
                if (t === tabName) {
                    buttons[t].classList.add('active');
                    buttons[t].style.color = 'var(--primary, #0284c7)';
                    buttons[t].style.borderBottom = '3px solid var(--primary, #0284c7)';
                    buttons[t].style.fontWeight = '800';
                } else {
                    buttons[t].classList.remove('active');
                    buttons[t].style.color = '#64748b';
                    buttons[t].style.borderBottom = '3px solid transparent';
                    buttons[t].style.fontWeight = '700';
                }
            }
        });

        // Trigger renderers
        if (tabName === 'students') {
            if (typeof window.renderTutoringStudents === 'function') {
                window.renderTutoringStudents();
            }
        } else if (tabName === 'schedule') {
            window.renderTutoringWeeklySchedule();
        } else if (tabName === 'groups') {
            window.renderTutoringGroupsHub();
        } else if (tabName === 'attendance') {
            if (typeof window.renderTutoringAttendanceLedger === 'function') {
                window.renderTutoringAttendanceLedger();
            }
        } else if (tabName === 'analytics') {
            window.renderTutoringAnalytics();
        }

        setTimeout(() => {
            if (window.renderLucide) window.renderLucide();
        }, 30);
    };

    // =========================================================================
    // 2. BATCH SELECTION & ACTIONS
    // =========================================================================
    window.toggleTutoringMasterSelect = function (masterCheckbox) {
        const isChecked = masterCheckbox ? masterCheckbox.checked : false;
        const rowCheckboxes = document.querySelectorAll('.tutoring-row-checkbox');
        
        rowCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            const stdId = cb.value;
            if (isChecked) {
                window.selectedTutoringStudentIds.add(stdId);
            } else {
                window.selectedTutoringStudentIds.delete(stdId);
            }
        });

        window.updateTutoringBatchBar();
    };

    window.onTutoringStudentCheckboxChange = function (id, checked) {
        if (checked) {
            window.selectedTutoringStudentIds.add(id);
        } else {
            window.selectedTutoringStudentIds.delete(id);
        }

        const masterCheckbox = document.getElementById('tutoringMasterSelectCb') || document.getElementById('tutoringMasterCheckbox');
        const rowCheckboxes = document.querySelectorAll('.tutoring-row-checkbox');
        if (masterCheckbox && rowCheckboxes.length > 0) {
            masterCheckbox.checked = (window.selectedTutoringStudentIds.size === rowCheckboxes.length);
        }

        window.updateTutoringBatchBar();
    };

    window.updateTutoringBatchBar = function () {
        const bar = document.getElementById('tutoringBatchActionBar');
        const countSpan = document.getElementById('tutoringSelectedCount') || document.getElementById('tutoringBatchSelectedCount');
        const count = window.selectedTutoringStudentIds.size;

        if (countSpan) {
            countSpan.textContent = count;
        }

        if (bar) {
            if (count > 0) {
                bar.style.display = 'flex';
            } else {
                bar.style.display = 'none';
            }
        }
    };

    window.clearTutoringBatchSelection = function () {
        window.selectedTutoringStudentIds.clear();
        const masterCheckbox = document.getElementById('tutoringMasterSelectCb') || document.getElementById('tutoringMasterCheckbox');
        if (masterCheckbox) masterCheckbox.checked = false;
        
        document.querySelectorAll('.tutoring-row-checkbox').forEach(cb => {
            cb.checked = false;
        });

        window.updateTutoringBatchBar();
    };

    // Batch Action: Mark All Selected as Paid for Active Month
    window.batchMarkTutoringPaid = function () {
        const count = window.selectedTutoringStudentIds.size;
        if (count === 0) return;

        const monthInput = document.getElementById('tutoringMonth');
        const month = monthInput ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));

        if (!confirm(`هل أنت متأكد من رغبتك في تسجيل الأداء الكامل لشهر (${month}) لجميع التلاميذ المحددين (${count} تلميذ) دفعة واحدة؟`)) {
            return;
        }

        const todayStr = window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA');
        let updatedCount = 0;

        (db.tutoring.students || []).forEach(std => {
            if (window.selectedTutoringStudentIds.has(std.id)) {
                const payInfo = window.getTutoringPaymentInfo(std, month);
                if (payInfo.remaining > 0) {
                    const instItem = {
                        id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                        date: todayStr,
                        month: month,
                        amount: payInfo.remaining,
                        method: 'نقداً (كاش)',
                        note: 'أداء جماعي دفعة واحدة',
                        recordedAt: new Date().toISOString()
                    };
                    if (!std.paymentHistory) std.paymentHistory = [];
                    std.paymentHistory.push(instItem);

                    if (!std.payments || Array.isArray(std.payments)) std.payments = {};
                    const prevHist = (std.payments[month] && Array.isArray(std.payments[month].history))
                        ? [...std.payments[month].history]
                        : (Array.isArray(payInfo.history) ? [...payInfo.history] : []);
                    prevHist.push(instItem);
                    std.payments[month] = {
                        amount: payInfo.totalDue,
                        status: 'paid',
                        history: prevHist,
                        note: 'أداء جماعي دفعة واحدة'
                    };

                    if (Array.isArray(std.paidMonths)) {
                        if (!std.paidMonths.includes(month)) std.paidMonths.push(month);
                    } else {
                        if (!std.paidMonths) std.paidMonths = {};
                        std.paidMonths[month] = true;
                    }
                    updatedCount++;
                }
            }
        });

        if (typeof saveDB === 'function') saveDB();
        
        if (typeof showToast === 'function') {
            showToast(`تم تسجيل الأداء بنجاح لـ ${updatedCount} تلميذ لشهر ${month}`, 'success');
        }

        window.clearTutoringBatchSelection();
        if (typeof window.renderTutoringStudents === 'function') {
            window.renderTutoringStudents();
        }
    };

    // Batch Action: Move Selected to Group
    window.batchMoveTutoringGroup = function () {
        const count = window.selectedTutoringStudentIds.size;
        if (count === 0) return;

        // Populate datalist or select with known groups
        const datalist = document.getElementById('tutoringGroupDatalist');
        if (datalist) {
            const groups = new Set((db.tutoring.students || []).map(s => s.group).filter(Boolean));
            datalist.innerHTML = Array.from(groups).map(g => `<option value="${g}">`).join('');
        }

        const modal = document.getElementById('tutoringBatchGroupModal');
        if (modal) {
            modal.style.display = 'flex';
            const input = document.getElementById('batchMoveTargetGroup');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    };

    window.closeTutoringBatchGroupModal = function () {
        const modal = document.getElementById('tutoringBatchGroupModal');
        if (modal) modal.style.display = 'none';
    };

    window.submitTutoringBatchMoveGroup = function () {
        const input = document.getElementById('batchMoveTargetGroup');
        const newGroup = input ? input.value.trim() : '';
        if (!newGroup) {
            alert('يرجى تحديد أو كتابة اسم المجموعة المستهدفة.');
            return;
        }

        const count = window.selectedTutoringStudentIds.size;
        let movedCount = 0;

        (db.tutoring.students || []).forEach(std => {
            if (window.selectedTutoringStudentIds.has(std.id)) {
                std.group = newGroup;
                movedCount++;
            }
        });

        // Ensure group is saved in db.tutoring.groups if not existing
        if (!db.tutoring.groups) db.tutoring.groups = [];
        if (!db.tutoring.groups.some(g => g.name === newGroup)) {
            db.tutoring.groups.push({
                id: 'grp_' + Date.now(),
                name: newGroup,
                level: '',
                defaultFee: 100,
                notes: 'أُنشئت تلقائياً عبر النقل الجماعي'
            });
        }

        if (typeof saveDB === 'function') saveDB();

        window.closeTutoringBatchGroupModal();
        window.clearTutoringBatchSelection();

        if (typeof showToast === 'function') {
            showToast(`تم نقل ${movedCount} تلميذ بنجاح إلى مجموعة: ${newGroup}`, 'success');
        }

        if (typeof window.renderTutoringStudents === 'function') {
            window.renderTutoringStudents();
        }
    };

    // Batch Action: Export Receipts for Selected
    window.batchExportReceiptsTutoring = function () {
        const count = window.selectedTutoringStudentIds.size;
        if (count === 0) return;

        const monthInput = document.getElementById('tutoringMonth');
        const month = monthInput ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));

        const studentsToPrint = (db.tutoring.students || []).filter(s => window.selectedTutoringStudentIds.has(s.id));
        if (studentsToPrint.length === 0) return;

        let combinedHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>وصل أداء مجمع - ${month}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; background: #fff; margin: 0; padding: 15px; color: #0f172a; }
                    .receipt-card { border: 2px solid #0f172a; border-radius: 10px; padding: 18px 22px; margin-bottom: 25px; page-break-inside: avoid; }
                    .receipt-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; }
                    .receipt-title { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0; }
                    .receipt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem; margin-bottom: 14px; }
                    .stamp-box { border: 1.5px dashed #16a34a; background: #f0fdf4; color: #16a34a; font-weight: 800; text-align: center; padding: 8px; border-radius: 8px; font-size: 1rem; }
                    .footer-note { font-size: 0.75rem; color: #64748b; text-align: center; margin-top: 10px; }
                    @media print {
                        body { padding: 0; }
                        .receipt-card { margin-bottom: 20px; page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
        `;

        const tp = (db && db.teacherProfile) ? db.teacherProfile : {};
        const teacherName = tp.name || 'الأستاذ(ة) المشرف(ة)';

        studentsToPrint.forEach((std, idx) => {
            const sessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(month) && s.attendance !== 'absent');
            const totalHours = sessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
            const rate = parseFloat(std.fee) || 0;
            const totalDue = typeof window.computeTutoringStudentMonthDue === 'function'
                ? window.computeTutoringStudentMonthDue(std, month)
                : (totalHours * rate);
            const discount = parseFloat(std.discount) || 0;
            const billingTypeLabel = std.billingType === 'monthly_fixed'
                ? 'باقة شهرية قارة'
                : (std.billingType === 'session_pack' ? 'باقة حصص' : `${rate} درهم/ساعة`);
            const pInfo = window.getTutoringPaymentInfo(std, month, totalDue);
            const receiptNo = `${month.replace('-', '')}-${String(idx + 1).padStart(3, '0')}`;

            combinedHtml += `
                <div class="receipt-card">
                    <div class="receipt-header">
                        <div>
                            <div style="font-size: 0.8rem; color: #64748b; font-weight:700;">المملكة المغربية • منظومة الأستاذ للدعم التربوي والتقوية</div>
                            <h2 class="receipt-title">وصل استخلاص واجبات الدعم المدرسي رقم #${receiptNo}</h2>
                        </div>
                        <div style="text-align: left; font-size: 0.82rem; color: #475569;">
                            <div><b>الشهر المرجعي:</b> ${month}</div>
                            <div><b>تاريخ التحرير:</b> ${new Date().toLocaleDateString('ar-MA')}</div>
                        </div>
                    </div>
                    <div class="receipt-grid">
                        <div><b>اسم التلميذ(ة):</b> ${std.name}</div>
                        <div><b>المجموعة / المستوى:</b> ${std.group || 'دعم فردي'} ${std.level ? `(${std.level})` : ''}</div>
                        <div><b>الحصص المنجزة:</b> ${sessions.length} حصص (${totalHours} س)</div>
                        <div><b>نظام الفوترة:</b> ${billingTypeLabel}${discount > 0 ? ` (تخفيض: ${discount} د.م)` : ''}</div>
                        <div><b>المبلغ الصافي المستحق:</b> ${totalDue} درهم</div>
                        <div><b>المبلغ المؤدى:</b> <span style="color:#16a34a; font-weight:800;">${pInfo.paidAmount} درهم</span></div>
                    </div>
                    <div class="stamp-box" style="${pInfo.status === 'paid' ? '' : 'border-color:#d97706; background:#fffbeb; color:#b45309;'}">
                        ${pInfo.status === 'paid' ? '✓ تم الأداء بالكامل والذمة المالية بريئة' : (pInfo.status === 'partial' ? `أداء جزئي — المتبقي في الذمة: ${pInfo.remaining} درهم` : `واجب قيد الاستخلاص: ${pInfo.remaining} درهم`)}
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 0.84rem; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-weight:700;">
                        <div>إمضاء الأستاذ(ة) (${teacherName}): ..........................</div>
                        <div>توقيع واطلاع ولي الأمر: ..........................</div>
                    </div>
                    <div class="footer-note">وثيقة رسمية تثبت حضور حصص الدعم التربوي وتسوية وضعيتها المالية عن شهر ${month}.</div>
                </div>
            `;
        });

        combinedHtml += `
            </body>
            </html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(combinedHtml, {
                title: `توصيل_أداء_مجمع_${month}`,
                orientation: 'portrait',
                subtitle: `وصولات استخلاص واجبات الدعم الخصوصي (${studentsToPrint.length} تلميذ) — شهر ${month}`
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(combinedHtml, `توصيل_أداء_مجمع_${month}`, 'portrait');
        }
    };

    // Batch Action: WhatsApp reminders
    window.batchSendWhatsAppTutoring = function () {
        if (typeof window.openTutoringWhatsAppBulkModal === 'function') {
            window.openTutoringWhatsAppBulkModal();
        } else {
            alert('يرجى فتح قائمة تذكيرات الواتساب.');
        }
    };

    // Batch Action: Delete Selected Students
    window.batchDeleteTutoringStudents = function () {
        const count = window.selectedTutoringStudentIds.size;
        if (count === 0) return;

        if (!confirm(`هل أنت متأكد من حذف ${count} تلميذ محدد نهائياً مع كافة حصصهم وسجلاتهم؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }

        db.tutoring.students = (db.tutoring.students || []).filter(s => !window.selectedTutoringStudentIds.has(s.id));
        if (typeof saveDB === 'function') saveDB();

        window.clearTutoringBatchSelection();
        if (typeof showToast === 'function') {
            showToast(`تم حذف ${count} تلميذ بنجاح.`, 'info');
        }

        if (typeof window.renderTutoringStudents === 'function') {
            window.renderTutoringStudents();
        }
    };

    // =========================================================================
    // 3. MULTI-STUDENT PERFORMANCE REPORT EXPORT (REQUEST #1)
    // =========================================================================
    window.setBatchReportLayout = function (layout) {
        window.currentBatchReportLayout = layout;
        const optOne = document.getElementById('batchLayoutOptOne');
        const optTwo = document.getElementById('batchLayoutOptTwo');

        if (optOne && optTwo) {
            if (layout === 'one_per_page') {
                optOne.classList.add('active');
                optTwo.classList.remove('active');
            } else {
                optTwo.classList.add('active');
                optOne.classList.remove('active');
            }
        }
        window.updateBatchReportPreviewSummary();
    };

    window.changeBatchReportMonth = function (delta) {
        const input = document.getElementById('batchReportMonthSelect');
        if (!input || !input.value) return;

        const parts = input.value.split('-');
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) + delta;

        if (month > 12) { month = 1; year++; }
        if (month < 1) { month = 12; year--; }

        input.value = `${year}-${String(month).padStart(2, '0')}`;
        window.updateBatchReportPreviewSummary();
    };

    window.openTutoringGroupBatchPerformanceReportModal = function (defaultGroup) {
        const modal = document.getElementById('tutoringGroupBatchReportModal');
        if (!modal) return;

        const groupSelect = document.getElementById('batchReportGroupSelect');
        const monthSelect = document.getElementById('batchReportMonthSelect');
        const globalMonth = document.getElementById('tutoringMonth');

        // Populate groups dropdown
        const groups = new Set((db.tutoring.students || []).map(s => s.group).filter(Boolean));
        if (db.tutoring.groups) {
            db.tutoring.groups.forEach(g => { if (g.name) groups.add(g.name); });
        }

        if (groupSelect) {
            let optionsHtml = '';
            Array.from(groups).sort().forEach(grp => {
                optionsHtml += `<option value="${grp}">${grp}</option>`;
            });
            if (!optionsHtml) {
                optionsHtml = '<option value="">لا توجد مجموعات معرفة بعد</option>';
            }
            groupSelect.innerHTML = optionsHtml;

            if (defaultGroup && groups.has(defaultGroup)) {
                groupSelect.value = defaultGroup;
            } else {
                const currentFilter = document.getElementById('tutoringGroupFilter');
                if (currentFilter && currentFilter.value !== 'all' && groups.has(currentFilter.value)) {
                    groupSelect.value = currentFilter.value;
                }
            }
        }

        if (monthSelect) {
            monthSelect.value = (globalMonth && globalMonth.value) ? globalMonth.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));
        }

        window.setBatchReportLayout(window.currentBatchReportLayout || 'one_per_page');
        window.updateBatchReportPreviewSummary();

        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringGroupBatchPerformanceReportModal = function () {
        const modal = document.getElementById('tutoringGroupBatchReportModal');
        if (modal) modal.style.display = 'none';
    };

    window.updateBatchReportPreviewSummary = function () {
        const groupSelect = document.getElementById('batchReportGroupSelect');
        const monthSelect = document.getElementById('batchReportMonthSelect');
        const summaryCard = document.getElementById('batchReportSummaryCard');
        if (!summaryCard) return;

        const targetGroup = groupSelect ? groupSelect.value : '';
        const targetMonth = monthSelect ? monthSelect.value : '';

        const students = (db.tutoring.students || []).filter(s => s.group === targetGroup);
        const studentCount = students.length;

        let totalSessionsCount = 0;
        let totalHoursAll = 0;
        let totalFeesAll = 0;

        students.forEach(std => {
            const sessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(targetMonth));
            totalSessionsCount += sessions.length;
            const validSessions = sessions.filter(s => s.attendance !== 'absent');
            const stdHours = validSessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
            totalHoursAll += stdHours;
            const pInfo = window.getTutoringPaymentInfo(std, targetMonth);
            totalFeesAll += pInfo.totalDue;
        });

        const isTwoPerPage = (window.currentBatchReportLayout === 'two_per_page');
        const estimatedPages = isTwoPerPage ? Math.ceil(studentCount / 2) : studentCount;

        summaryCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 38px; height: 38px; border-radius: 8px; background: #10b981; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem;">
                        ${studentCount}
                    </div>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #065f46;">
                            مجموعة: ${targetGroup || 'لم تحدد'} (${studentCount} تلميذ)
                        </div>
                        <div style="font-size: 0.78rem; color: #047857;">
                            شهر: ${targetMonth} • إجمالي الساعات: ${totalHoursAll} س • مجموع المستحقات: ${totalFeesAll} د.م
                        </div>
                    </div>
                </div>
                <div style="text-align: left; background: #fff; padding: 6px 12px; border-radius: 8px; border: 1px solid #a7f3d0;">
                    <div style="font-size: 0.72rem; color: #64748b;">تقدير صفحات الطباعة (A4):</div>
                    <div style="font-size: 1rem; font-weight: 900; color: #0f172a;">
                        ${estimatedPages} ${estimatedPages === 1 ? 'صفحة' : 'صفحات'} (${isTwoPerPage ? 'كشفان / صفحة' : 'كشف كامل / صفحة'})
                    </div>
                </div>
            </div>
        `;
    };

    // Helper: Build the complete printable HTML Document for the Batch Report
    window.generateBatchPerformanceReportHtml = function (targetGroup, targetMonth, layout, options) {
        const students = (db.tutoring.students || []).filter(s => s.group === targetGroup);
        if (students.length === 0) {
            return `<html><body style="font-family:sans-serif; text-align:center; padding:50px;">لا يوجد أي تلميذ مسجل في هذه المجموعة.</body></html>`;
        }

        const isTwoPerPage = (layout === 'two_per_page');
        const includeSessions = options.sessionsTable !== false;
        const includeStats = options.attendanceStats !== false;
        const includeFinance = options.finance !== false;
        const includeNotesAndSign = options.notesAndSign !== false;
        const customNote = options.customNote || '';

        let html = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>كشف أداء شهري مجمع - مجموعة ${targetGroup} - ${targetMonth}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Cairo', 'Tajawal', sans-serif;
                        background: #f8fafc;
                        color: #0f172a;
                        margin: 0;
                        padding: 0;
                        direction: rtl;
                    }
                    .report-wrapper {
                        max-width: 820px;
                        margin: 0 auto;
                        padding: 10px;
                    }
                    .student-slip {
                        background: #ffffff;
                        border: 1.5px solid #cbd5e1;
                        border-radius: 8px;
                        padding: ${isTwoPerPage ? '16px 20px' : '26px 30px'};
                        margin-bottom: 20px;
                        position: relative;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .slip-cut-divider {
                        border-top: 2px dashed #94a3b8;
                        margin: 25px 0;
                        position: relative;
                        text-align: center;
                    }
                    .slip-cut-badge {
                        position: absolute;
                        top: -12px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: #f1f5f9;
                        border: 1px solid #cbd5e1;
                        padding: 2px 14px;
                        border-radius: 20px;
                        font-size: 0.72rem;
                        font-weight: 800;
                        color: #475569;
                    }
                    .slip-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 10px;
                        margin-bottom: 12px;
                    }
                    .ministry-title {
                        font-size: 0.75rem;
                        font-weight: bold;
                        color: #475569;
                        line-height: 1.4;
                    }
                    .report-main-title {
                        font-size: ${isTwoPerPage ? '1.15rem' : '1.35rem'};
                        font-weight: 900;
                        color: #0f172a;
                        margin: 4px 0 0 0;
                    }
                    .meta-badge {
                        background: #f1f5f9;
                        border: 1px solid #cbd5e1;
                        padding: 3px 8px;
                        border-radius: 6px;
                        font-size: 0.75rem;
                        font-weight: 700;
                        color: #334155;
                    }
                    .student-info-strip {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 8px 14px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 10px;
                        margin-bottom: 12px;
                    }
                    .student-name-big {
                        font-size: ${isTwoPerPage ? '1.1rem' : '1.25rem'};
                        font-weight: 900;
                        color: #1e293b;
                    }
                    .kpi-row {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 8px;
                        margin-bottom: 12px;
                        text-align: center;
                    }
                    .kpi-cell {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 6px 4px;
                    }
                    .kpi-label {
                        font-size: 0.7rem;
                        color: #64748b;
                        font-weight: 700;
                    }
                    .kpi-val {
                        font-size: ${isTwoPerPage ? '0.95rem' : '1.1rem'};
                        font-weight: 900;
                        color: #0f172a;
                        margin-top: 2px;
                    }
                    table.sessions-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: ${isTwoPerPage ? '0.74rem' : '0.82rem'};
                        margin-bottom: 12px;
                    }
                    table.sessions-table th {
                        background: #f1f5f9;
                        color: #334155;
                        padding: 6px 8px;
                        border: 1px solid #cbd5e1;
                        font-weight: 800;
                        text-align: center;
                    }
                    table.sessions-table td {
                        padding: 5px 8px;
                        border: 1px solid #e2e8f0;
                        text-align: center;
                    }
                    .stamp-paid {
                        display: inline-block;
                        border: 1.5px solid #16a34a;
                        color: #16a34a;
                        background: #f0fdf4;
                        padding: 4px 12px;
                        border-radius: 6px;
                        font-weight: 900;
                        font-size: 0.8rem;
                    }
                    .stamp-unpaid {
                        display: inline-block;
                        border: 1.5px solid #dc2626;
                        color: #dc2626;
                        background: #fef2f2;
                        padding: 4px 12px;
                        border-radius: 6px;
                        font-weight: 900;
                        font-size: 0.8rem;
                    }
                    .pedagogical-notes-box {
                        border: 1px dashed #cbd5e1;
                        background: #fff;
                        border-radius: 6px;
                        padding: 8px 12px;
                        font-size: 0.78rem;
                        color: #334155;
                        margin-bottom: 12px;
                    }
                    .signature-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-top: 10px;
                        padding-top: 8px;
                        border-top: 1px solid #e2e8f0;
                        font-size: 0.78rem;
                        font-weight: 700;
                        color: #475569;
                    }
                    @media print {
                        body { background: #fff; }
                        .report-wrapper { max-width: 100%; padding: 0; margin: 0; }
                        .page-break-force { page-break-after: always; break-after: page; }
                        .no-print { display: none !important; }
                        .student-slip { border: 1px solid #94a3b8; box-shadow: none; margin-bottom: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="report-wrapper">
        `;

        students.forEach((std, index) => {
            const allSessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(targetMonth));
            const attendedSessions = allSessions.filter(s => s.attendance === 'present' || s.attendance === 'late');
            const absentSessions = allSessions.filter(s => s.attendance === 'absent');
            const excusedSessions = allSessions.filter(s => s.attendance === 'excused');
            
            const totalHours = attendedSessions.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
            const rate = parseFloat(std.fee) || 0;
            const totalDue = typeof window.computeTutoringStudentMonthDue === 'function'
                ? window.computeTutoringStudentMonthDue(std, targetMonth)
                : (totalHours * rate);
            const pInfo = window.getTutoringPaymentInfo(std, targetMonth, totalDue);

            const attendancePercent = allSessions.length > 0 
                ? Math.round((attendedSessions.length / allSessions.length) * 100) 
                : 100;

            const hasRoi = (std.gradeBefore !== undefined && std.gradeBefore !== '' && std.gradeAfter !== undefined && std.gradeAfter !== '');
            const roiDiff = hasRoi ? ((parseFloat(std.gradeAfter) || 0) - (parseFloat(std.gradeBefore) || 0)).toFixed(2) : null;

            const isPageBreakNeeded = isTwoPerPage 
                ? ((index % 2 === 1) && (index < students.length - 1)) 
                : (index < students.length - 1);

            html += `
                <div class="student-slip">
                    <div class="slip-header">
                        <div>
                            <div class="ministry-title">المملكة المغربية • قطاع التربية الوطنية والتكوين • الدعم والتقوية الخصوصية</div>
                            <h1 class="report-main-title">كشف الأداء والمواظبة الشهري والتتبع البيداغوجي</h1>
                        </div>
                        <div style="text-align: left;">
                            <div class="meta-badge">شهر: <b>${targetMonth}</b></div>
                            <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">مجموعة: <b>${targetGroup}</b></div>
                        </div>
                    </div>

                    <div class="student-info-strip">
                        <div>
                            <span style="font-size: 0.75rem; color: #64748b;">اسم التلميذ(ة):</span>
                            <span class="student-name-big">${std.name}</span>
                        </div>
                        <div style="display: flex; gap: 10px; font-size: 0.78rem; align-items:center; flex-wrap:wrap;">
                            <span>المستوى: <b>${std.level || 'ثانوي تأهيلي / إعدادي'}</b></span>
                            ${hasRoi ? `<span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:6px; font-weight:800;">الأثر البيداغوجي: ${std.gradeBefore} ⬅ ${std.gradeAfter} (${roiDiff >= 0 ? '+' + roiDiff : roiDiff})</span>` : ''}
                            ${std.nextExamDate ? `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-weight:800;">الفرض القادم: ${std.nextExamDate}</span>` : ''}
                            ${std.phone ? `<span dir="ltr">هاتف: <b>${std.phone}</b></span>` : ''}
                        </div>
                    </div>

                    ${includeStats ? `
                        <div class="kpi-row">
                            <div class="kpi-cell">
                                <div class="kpi-label">الحصص المنجزة</div>
                                <div class="kpi-val" style="color: #2563eb;">${attendedSessions.length} حصص</div>
                            </div>
                            <div class="kpi-cell">
                                <div class="kpi-label">مجموع الساعات</div>
                                <div class="kpi-val" style="color: #059669;">${totalHours} س</div>
                            </div>
                            <div class="kpi-cell">
                                <div class="kpi-label">نسبة المواظبة</div>
                                <div class="kpi-val" style="color: ${attendancePercent >= 80 ? '#16a34a' : '#dc2626'};">${attendancePercent}%</div>
                            </div>
                            <div class="kpi-cell">
                                <div class="kpi-label">الغياب / المبرر</div>
                                <div class="kpi-val" style="color: ${absentSessions.length > 0 ? '#dc2626' : '#64748b'};">${absentSessions.length} غياب (${excusedSessions.length} مبرر)</div>
                            </div>
                        </div>
                    ` : ''}

                    ${includeSessions ? `
                        <table class="sessions-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>التاريخ</th>
                                    <th>التوقيت / المدة</th>
                                    <th>موضوع الحصة والدرس</th>
                                    <th>الحضور</th>
                                    <th>الواجب المنزلي</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allSessions.length > 0 ? allSessions.map((s, idx) => `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td style="font-weight:bold;">${s.date}</td>
                                        <td>${s.hours || 2} س (${s.time || 'مسائي'})</td>
                                        <td style="text-align:right; font-weight:600;">${s.topic || s.title || 'مراجعة وتمارين تطبيقية'}</td>
                                        <td>
                                            ${s.attendance === 'present' ? '<span style="color:#16a34a; font-weight:800;">حاضر</span>' :
                                              s.attendance === 'absent' ? '<span style="color:#dc2626; font-weight:800;">غائب</span>' :
                                              s.attendance === 'late' ? '<span style="color:#d97706; font-weight:800;">متأخر</span>' :
                                              '<span style="color:#2563eb; font-weight:800;">مبرر</span>'}
                                        </td>
                                        <td>${s.homework || 'أُنجز بعناية'}</td>
                                    </tr>
                                `).join('') : `
                                    <tr><td colspan="6" style="padding:10px; color:#64748b;">لا توجد حصص مسجلة خلال هذا الشهر.</td></tr>
                                `}
                            </tbody>
                        </table>
                    ` : ''}

                    ${includeFinance ? `
                        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.8rem;">
                            <div>
                                واجب الساعة: <b>${rate} درهم</b> • المبلغ الإجمالي المستحق: <b>${totalDue} درهم</b>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>المؤدى: <b style="color:#16a34a;">${pInfo.paidAmount} درهم</b></span>
                                ${pInfo.remaining > 0 ? `<span style="color:#dc2626; font-weight:800;">(متبقي: ${pInfo.remaining} د.م)</span>` : ''}
                                ${pInfo.status === 'paid' ? '<span class="stamp-paid">✓ مؤدى بالكامل</span>' : '<span class="stamp-unpaid">قيد الاستخلاص</span>'}
                            </div>
                        </div>
                    ` : ''}

                    ${includeNotesAndSign ? `
                        <div class="pedagogical-notes-box">
                            <b>ملاحظات الأستاذ وتوجيهات التقويم والدعم:</b>
                            <div style="margin-top: 4px;">
                                ${customNote || std.pedagogicalNote || 'مواظبة جيدة، استيعاب سليم للمفاهيم الأساسية، يُرجى مواصلة التركيز وحل المسائل التوليفية في المنزل.'}
                            </div>
                        </div>

                        <div class="signature-row">
                            <div>توقيع وختم الأستاذ المشرف: .............................</div>
                            <div>توقيع واطلاع ولي أمر التلميذ: .............................</div>
                        </div>
                    ` : ''}
                </div>
            `;

            // If 2 per page and it's the first slip on the sheet, add scissor cut guide
            if (isTwoPerPage && (index % 2 === 0) && (index < students.length - 1)) {
                html += `
                    <div class="slip-cut-divider">
                        <span class="slip-cut-badge">✂ خط القص للفصل بين كشفي التلميذين لتسهيل التوزيع دفعة واحدة</span>
                    </div>
                `;
            }

            if (isPageBreakNeeded) {
                html += `<div class="page-break-force"></div>`;
            }
        });

        html += `
                </div>
                <script>
                    // Auto render icons or print if triggered
                <\/script>
            </body>
            </html>
        `;

        return html;
    };

    window.printBatchPerformanceReportDirect = function () {
        const groupSelect = document.getElementById('batchReportGroupSelect');
        const monthSelect = document.getElementById('batchReportMonthSelect');
        const groupName = groupSelect ? groupSelect.value : '';
        const month = monthSelect ? monthSelect.value : '';

        const options = {
            sessionsTable: document.getElementById('batchOptSessionsTable') ? document.getElementById('batchOptSessionsTable').checked : true,
            attendanceStats: document.getElementById('batchOptAttendanceStats') ? document.getElementById('batchOptAttendanceStats').checked : true,
            finance: document.getElementById('batchOptFinance') ? document.getElementById('batchOptFinance').checked : true,
            notesAndSign: document.getElementById('batchOptNotesAndSign') ? document.getElementById('batchOptNotesAndSign').checked : true,
            customNote: document.getElementById('batchReportCustomNote') ? document.getElementById('batchReportCustomNote').value : ''
        };

        const htmlContent = window.generateBatchPerformanceReportHtml(groupName, month, window.currentBatchReportLayout, options);

        let iframe = document.getElementById('tutoringPrintIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'tutoringPrintIframe';
            iframe.style.position = 'fixed';
            iframe.style.top = '-10000px';
            iframe.style.left = '-10000px';
            iframe.style.width = '1px';
            iframe.style.height = '1px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 450);
    };

    window.exportBatchPerformancePdf = function () {
        const groupSelect = document.getElementById('batchReportGroupSelect');
        const monthSelect = document.getElementById('batchReportMonthSelect');
        const groupName = groupSelect ? groupSelect.value : 'المجموعة';
        const month = monthSelect ? monthSelect.value : '';

        const options = {
            sessionsTable: document.getElementById('batchOptSessionsTable') ? document.getElementById('batchOptSessionsTable').checked : true,
            attendanceStats: document.getElementById('batchOptAttendanceStats') ? document.getElementById('batchOptAttendanceStats').checked : true,
            finance: document.getElementById('batchOptFinance') ? document.getElementById('batchOptFinance').checked : true,
            notesAndSign: document.getElementById('batchOptNotesAndSign') ? document.getElementById('batchOptNotesAndSign').checked : true,
            customNote: document.getElementById('batchReportCustomNote') ? document.getElementById('batchReportCustomNote').value : ''
        };

        const htmlContent = window.generateBatchPerformanceReportHtml(groupName, month, window.currentBatchReportLayout, options);

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(htmlContent, {
                title: `كشف_أداء_شهري_مجمع_${groupName.replace(/\s+/g, '_')}_${month}`,
                orientation: 'portrait',
                subtitle: `بطاقات التتبع البيداغوجي والمواظبة الشهرية — المجموعة: ${groupName} | الشهر: ${month}`
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(htmlContent, `كشف_أداء_شهري_مجمع_${groupName}_${month}`, 'portrait');
        }
    };

    window.previewBatchPerformancePdfInApp = function () {
        const groupSelect = document.getElementById('batchReportGroupSelect');
        const monthSelect = document.getElementById('batchReportMonthSelect');
        const groupName = groupSelect ? groupSelect.value : '';
        const month = monthSelect ? monthSelect.value : '';

        const options = {
            sessionsTable: document.getElementById('batchOptSessionsTable') ? document.getElementById('batchOptSessionsTable').checked : true,
            attendanceStats: document.getElementById('batchOptAttendanceStats') ? document.getElementById('batchOptAttendanceStats').checked : true,
            finance: document.getElementById('batchOptFinance') ? document.getElementById('batchOptFinance').checked : true,
            notesAndSign: document.getElementById('batchOptNotesAndSign') ? document.getElementById('batchOptNotesAndSign').checked : true,
            customNote: document.getElementById('batchReportCustomNote') ? document.getElementById('batchReportCustomNote').value : ''
        };

        const htmlContent = window.generateBatchPerformanceReportHtml(groupName, month, window.currentBatchReportLayout, options);

        // Open in a stylish preview modal overlay
        let previewOverlay = document.getElementById('tutoringBatchReportPreviewOverlay');
        if (!previewOverlay) {
            previewOverlay = document.createElement('div');
            previewOverlay.id = 'tutoringBatchReportPreviewOverlay';
            previewOverlay.style.position = 'fixed';
            previewOverlay.style.top = '0';
            previewOverlay.style.left = '0';
            previewOverlay.style.width = '100%';
            previewOverlay.style.height = '100%';
            previewOverlay.style.background = 'rgba(15, 23, 42, 0.85)';
            previewOverlay.style.zIndex = '10008';
            previewOverlay.style.display = 'flex';
            previewOverlay.style.flexDirection = 'column';
            document.body.appendChild(previewOverlay);
        }

        previewOverlay.innerHTML = `
            <div style="background: #1e293b; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: 800; font-size: 1.1rem;">معاينة كشف الأداء المجمع: مجموعة ${groupName} (${month})</span>
                    <span style="font-size: 0.8rem; background: #3b82f6; padding: 2px 8px; border-radius: 4px;">جاهز للتصدير كـ PDF</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" onclick="window.printBatchPerformanceReportDirect()" style="background: #10b981; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        طباعة فورية
                    </button>
                    <button type="button" onclick="document.getElementById('tutoringBatchReportPreviewOverlay').style.display='none'" style="background: rgba(255,255,255,0.15); color: #fff; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; font-size: 1.2rem;">
                        ✕
                    </button>
                </div>
            </div>
            <div style="flex: 1; padding: 15px; overflow-y: auto; display: flex; justify-content: center; background: #475569;">
                <iframe id="previewReportIframe" style="width: 100%; max-width: 860px; height: 100%; border: none; background: #fff; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);"></iframe>
            </div>
        `;

        previewOverlay.style.display = 'flex';
        const frame = document.getElementById('previewReportIframe');
        if (frame) {
            const fDoc = frame.contentWindow.document;
            fDoc.open();
            fDoc.write(htmlContent);
            fDoc.close();
        }
    };

    // =========================================================================
    // 4. ADVANCED WEEKLY SCHEDULE & TIMETABLE HUB (SUB-TAB 2)
    // =========================================================================
    window.currentTutoringScheduleView = 'matrix'; // 'matrix' | 'cards' | 'today'

    window.setTutoringScheduleView = function (viewType) {
        window.currentTutoringScheduleView = viewType;
        const btnMatrix = document.getElementById('btnSchedViewMatrix');
        const btnCards = document.getElementById('btnSchedViewCards');
        const btnToday = document.getElementById('btnSchedViewToday');

        if (btnMatrix) btnMatrix.classList.toggle('active', viewType === 'matrix');
        if (btnCards) btnCards.classList.toggle('active', viewType === 'cards');
        if (btnToday) btnToday.classList.toggle('active', viewType === 'today');

        window.renderTutoringWeeklySchedule();
    };

    window.timeToMinutes = function (timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const parts = timeStr.split(':');
        return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    };

    window.calculateDurationText = function (startTime, endTime) {
        const startMin = window.timeToMinutes(startTime);
        const endMin = window.timeToMinutes(endTime);
        const diffMin = endMin > startMin ? (endMin - startMin) : 0;
        if (diffMin <= 0) return 'غير محدد';
        const hours = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        if (hours > 0 && mins > 0) return `${hours} ساعة و ${mins} د`;
        if (hours === 1) return 'ساعة واحدة (1 س)';
        if (hours === 2) return 'ساعتان (2 س)';
        if (hours > 2) return `${hours} ساعات`;
        return `${mins} دقيقة`;
    };

    window.getSlotColorConfig = function (colorName) {
        const configs = {
            indigo: {
                bg: '#f5f3ff',
                border: '#6366f1',
                text: '#3730a3',
                pillBg: '#e0e7ff',
                pillText: '#4338ca'
            },
            blue: {
                bg: '#eff6ff',
                border: '#2563eb',
                text: '#1e40af',
                pillBg: '#dbeafe',
                pillText: '#1d4ed8'
            },
            emerald: {
                bg: '#ecfdf5',
                border: '#059669',
                text: '#065f46',
                pillBg: '#d1fae5',
                pillText: '#047857'
            },
            amber: {
                bg: '#fffbeb',
                border: '#d97706',
                text: '#92400e',
                pillBg: '#fef3c7',
                pillText: '#b45309'
            },
            purple: {
                bg: '#faf5ff',
                border: '#9333ea',
                text: '#6b21a8',
                pillBg: '#f3e8ff',
                pillText: '#7e22ce'
            },
            rose: {
                bg: '#fff1f2',
                border: '#e11d48',
                text: '#9f1239',
                pillBg: '#ffe4e6',
                pillText: '#be123c'
            }
        };
        return configs[colorName] || configs.indigo;
    };

    window.calculateDurationHours = function (startTime, endTime) {
        const startMin = window.timeToMinutes(startTime);
        const endMin = window.timeToMinutes(endTime);
        const diffMin = endMin > startMin ? (endMin - startMin) : 0;
        if (diffMin <= 0) return 2;
        return parseFloat((diffMin / 60).toFixed(1));
    };

    window.getSlotDisplayName = function (slot) {
        if (!slot) return '';
        if (slot.slotType === 'individual' || slot.studentId) {
            return '👤 دعم فردي: ' + (slot.studentName || slot.group || 'تلميذ فردي');
        }
        return '👥 ' + (slot.group || 'مجموعة دعم');
    };

    let _lastWaScheduleSendTime = 0;
    window.sendWhatsAppScheduleToStudent = function (phone, name, dayName, startTime, endTime, topic) {
        const now = Date.now();
        if (now - _lastWaScheduleSendTime < 800) return;
        _lastWaScheduleSendTime = now;

        if (!phone) {
            alert('لم يتم تسجيل رقم هاتف لهذا التلميذ.');
            return;
        }
        let cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '212' + cleanPhone.substring(1);
        const targetDay = dayName ? `يوم ${dayName}` : 'الموعد المحدد';
        const msg = `السلام عليكم ورحمة الله،\nتحية طيبة، نذكر التلميذ(ة) *${name || ''}* بموعد حصة الدعم الخصوصي الفردية المقررة ${targetDay} من الساعة *${startTime}* إلى *${endTime}*.\n🎯 المحور والهدف: ${topic || 'معالجة تربوية ومواكبة فردية'}.\nيرجى الحضور في الموعد المحدد. بالتوفيق! ✨`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    window.detectTutoringScheduleConflicts = function (slots) {
        const conflicts = [];
        if (!slots || slots.length === 0) return conflicts;

        const dayNames = {
            1: 'الإثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
            4: 'الخميس', 5: 'الجمعة', 6: 'السبت', 0: 'الأحد'
        };

        const slotsByDay = {};
        slots.forEach(s => {
            const dayKey = String(s.day);
            if (!slotsByDay[dayKey]) slotsByDay[dayKey] = [];
            slotsByDay[dayKey].push(s);
        });

        Object.keys(slotsByDay).forEach(dayKey => {
            const daySlots = slotsByDay[dayKey];
            for (let i = 0; i < daySlots.length; i++) {
                for (let j = i + 1; j < daySlots.length; j++) {
                    const s1 = daySlots[i];
                    const s2 = daySlots[j];
                    const start1 = window.timeToMinutes(s1.startTime);
                    const end1 = window.timeToMinutes(s1.endTime);
                    const start2 = window.timeToMinutes(s2.startTime);
                    const end2 = window.timeToMinutes(s2.endTime);

                    if (Math.max(start1, start2) < Math.min(end1, end2)) {
                        conflicts.push({
                            day: dayKey,
                            dayName: dayNames[dayKey] || dayKey,
                            slot1: s1,
                            slot2: s2
                        });
                    }
                }
            }
        });
        return conflicts;
    };

    window.openAddTutoringScheduleSlotModal = function (day) {
        window.openTutoringScheduleSlotModal(null, day);
    };

    window.renderTutoringWeeklySchedule = function () {
        const container = document.getElementById('tutoringWeeklyScheduleGrid');
        if (!container) return;

        if (!db.tutoring.scheduleSlots) db.tutoring.scheduleSlots = [];

        const allSlots = db.tutoring.scheduleSlots;

        // 0. Update top stats badges (Weekly Summary)
        const statsContainer = document.getElementById('tutoringScheduleStatsBadges');
        if (statsContainer) {
            const totalSlots = allSlots.length;
            const groupSlots = allSlots.filter(s => s.slotType !== 'individual' && !s.studentId).length;
            const indivSlots = allSlots.filter(s => s.slotType === 'individual' || s.studentId).length;
            let totalWeeklyHours = 0;
            allSlots.forEach(s => {
                const startM = window.timeToMinutes(s.startTime);
                const endM = window.timeToMinutes(s.endTime);
                if (endM > startM) totalWeeklyHours += (endM - startM) / 60;
            });

            statsContainer.innerHTML = `
                <span style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.76rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="ui-icon" style="margin: 0;"><span data-lucide="layers" data-size="12"></span></span>
                    ${totalSlots} مواعيد أسبوعية
                </span>
                <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 0.76rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="ui-icon" style="margin: 0;"><span data-lucide="users" data-size="12"></span></span>
                    ${groupSlots} حصص جماعية
                </span>
                <span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; font-size: 0.76rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="ui-icon" style="margin: 0;"><span data-lucide="user-check" data-size="12"></span></span>
                    ${indivSlots} حصص دعم فردي 👤
                </span>
                <span style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; font-size: 0.76rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">
                    <span class="ui-icon" style="margin: 0;"><span data-lucide="clock" data-size="12"></span></span>
                    ${totalWeeklyHours.toFixed(1)} س / أسبوع
                </span>
            `;
        }

        // 1. Populate groups and individual students filter dropdown
        const filterSelect = document.getElementById('tutoringScheduleGroupFilter');
        if (filterSelect) {
            const currentVal = filterSelect.value || 'all';
            const groupSet = new Set();
            const indivSet = new Map(); // studentId -> studentName

            allSlots.forEach(s => {
                if (s.slotType === 'individual' || s.studentId) {
                    indivSet.set(s.studentId || s.group, s.studentName || s.group);
                } else if (s.group) {
                    groupSet.add(s.group);
                }
            });
            (db.tutoring.groups || []).forEach(g => { if (g.name) groupSet.add(g.name); });

            let optsHtml = '<option value="all">كل المجموعات والتلاميذ (' + allSlots.length + ' حصة)</option>';
            
            if (groupSet.size > 0) {
                optsHtml += '<optgroup label="👥 مجموعات الدعم">';
                Array.from(groupSet).sort().forEach(gName => {
                    const count = allSlots.filter(s => s.slotType !== 'individual' && !s.studentId && s.group === gName).length;
                    optsHtml += `<option value="grp:${gName}" ${currentVal === ('grp:' + gName) || currentVal === gName ? 'selected' : ''}>${gName} (${count} حصص)</option>`;
                });
                optsHtml += '</optgroup>';
            }

            if (indivSet.size > 0) {
                optsHtml += '<optgroup label="👤 تلاميذ الدعم الفردي">';
                Array.from(indivSet.entries()).forEach(([sId, sName]) => {
                    const count = allSlots.filter(s => (s.slotType === 'individual' || s.studentId) && (s.studentId === sId || s.studentName === sName || s.group === sName)).length;
                    optsHtml += `<option value="ind:${sId}" ${currentVal === ('ind:' + sId) ? 'selected' : ''}>👤 ${sName} (${count} حصص)</option>`;
                });
                optsHtml += '</optgroup>';
            }

            filterSelect.innerHTML = optsHtml;
        }

        const selectedGroupFilter = filterSelect ? filterSelect.value : 'all';
        const typeFilterSelect = document.getElementById('tutoringScheduleTypeFilter');
        const selectedTypeFilter = typeFilterSelect ? typeFilterSelect.value : 'all';

        // 2. Active slots (filtered by session type and selected group/student)
        let visibleSlots = allSlots;

        // Filter by type
        if (selectedTypeFilter === 'group') {
            visibleSlots = visibleSlots.filter(s => s.slotType !== 'individual' && !s.studentId);
        } else if (selectedTypeFilter === 'individual') {
            visibleSlots = visibleSlots.filter(s => s.slotType === 'individual' || s.studentId);
        }

        // Filter by group or student
        if (selectedGroupFilter !== 'all') {
            if (selectedGroupFilter.startsWith('grp:')) {
                const targetGroup = selectedGroupFilter.substring(4);
                visibleSlots = visibleSlots.filter(s => s.slotType !== 'individual' && !s.studentId && s.group === targetGroup);
            } else if (selectedGroupFilter.startsWith('ind:')) {
                const targetStudentId = selectedGroupFilter.substring(4);
                visibleSlots = visibleSlots.filter(s => (s.slotType === 'individual' || s.studentId) && (s.studentId === targetStudentId || s.group.includes(targetStudentId)));
            } else {
                visibleSlots = visibleSlots.filter(s => s.group === selectedGroupFilter || s.studentName === selectedGroupFilter || s.studentId === selectedGroupFilter);
            }
        }

        // 3. Detect Conflicts
        const conflicts = window.detectTutoringScheduleConflicts(allSlots);
        const conflictSlotIds = new Set();
        conflicts.forEach(c => {
            conflictSlotIds.add(c.slot1.id);
            conflictSlotIds.add(c.slot2.id);
        });

        // 4. Render Conflict Alert Banner
        const conflictBanner = document.getElementById('tutoringConflictAlertBanner');
        if (conflictBanner) {
            if (conflicts.length > 0) {
                let confListHtml = conflicts.map(c => {
                    const name1 = window.getSlotDisplayName(c.slot1);
                    const name2 = window.getSlotDisplayName(c.slot2);
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.82rem; margin-top: 4px;">
                            <span>📅 <b>يوم ${c.dayName}:</b> تداخل بين <b>${name1}</b> (${c.slot1.startTime}-${c.slot1.endTime}) و <b>${name2}</b> (${c.slot2.startTime}-${c.slot2.endTime})</span>
                            <button type="button" onclick="openTutoringScheduleSlotModal('${c.slot2.id}')" style="background: #ffffff; border: 1px solid #f87171; color: #b91c1c; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                تعديل التوقيت
                            </button>
                        </div>
                    `;
                }).join('');

                conflictBanner.innerHTML = `
                    <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-right: 5px solid #ef4444; border-radius: 10px; padding: 12px 16px; color: #991b1b;">
                        <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 0.92rem;">
                            <span class="ui-icon" style="color: #dc2626; margin: 0;"><span data-lucide="alert-triangle" data-size="18"></span></span>
                            <span>تم رصد تعارض زمني في جدول الحصص الأسبوعي (${conflicts.length} تداخل):</span>
                        </div>
                        <div style="margin-top: 6px; padding-right: 26px;">
                            ${confListHtml}
                        </div>
                    </div>
                `;
            } else {
                conflictBanner.innerHTML = '';
            }
        }

        // 5. Render Today's Live Alert Banner
        const todayBanner = document.getElementById('tutoringTodayAlertBanner');
        if (todayBanner) {
            const todayIdx = new Date().getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
            const dayNames = {
                1: 'الإثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
                4: 'الخميس', 5: 'الجمعة', 6: 'السبت', 0: 'الأحد'
            };
            const todaySlots = allSlots.filter(s => parseInt(s.day, 10) === todayIdx);
            todaySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            const todayDateStr = new Intl.DateTimeFormat('ar-MA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(new Date());

            if (todaySlots.length > 0) {
                let slotsBadges = todaySlots.map(s => {
                    const isIndiv = s.slotType === 'individual' || s.studentId;
                    const durationHours = window.calculateDurationHours(s.startTime, s.endTime);

                    if (isIndiv) {
                        const studentName = s.studentName || s.group;
                        return `
                            <div style="background: rgba(254, 243, 199, 0.2); border: 1.5px solid #fde68a; border-radius: 8px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem;">
                                <span style="background: #f59e0b; color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 900;">👤 فردي</span>
                                <span style="font-weight: 800; color: #fef08a;">${studentName}</span>
                                <span dir="ltr" style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.78rem;">${s.startTime} - ${s.endTime}</span>
                                ${s.pedagogicalFocus ? `<span style="font-size: 0.74rem; color: #fef3c7;">🎯 ${s.pedagogicalFocus}</span>` : ''}
                                <button type="button" onclick="if(typeof openTutoringSessionModal==='function') openTutoringSessionModal('${s.studentId}', { date: (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')), time: '${s.startTime}', hours: ${durationHours}, topic: '${(s.pedagogicalFocus || s.notes || 'حصة دعم خصوصي فردية').replace(/'/g, "\\'")}' });" style="background: #10b981; color: #ffffff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="تسجيل حضور وإنجاز هذه الحصة الفردية الآن">
                                    ✍️ تسجيل الحصة
                                </button>
                                ${s.studentPhone ? `
                                    <button type="button" onclick="sendWhatsAppScheduleToStudent('${s.studentPhone}', '${studentName}', 'اليوم', '${s.startTime}', '${s.endTime}', '${(s.pedagogicalFocus || s.notes || '').replace(/'/g, "\\'")}')" style="background: #25D366; color: #ffffff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;" title="تأكيد الموعد عبر واتساب">
                                        💬 واتساب
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }

                    const stds = (db.tutoring.students || []).filter(st => st.group === s.group);
                    return `
                        <div style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.82rem;">
                            <span style="font-weight: 800; color: #fbbf24;">${s.group}</span>
                            <span dir="ltr" style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.78rem;">${s.startTime} - ${s.endTime}</span>
                            <span>👥 ${stds.length} تلاميذ</span>
                            <button type="button" onclick="if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${s.group}', {durationHours: ${durationHours}, notes: '${s.notes || ''}', time: '${s.startTime}'});" style="background: #10b981; color: #ffffff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="تسجيل حضور وإنجاز هذه الحصة الآن">
                                ✍️ تسجيل الحصة
                            </button>
                        </div>
                    `;
                }).join('');

                todayBanner.innerHTML = `
                    <div class="tutoring-today-banner">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; font-weight: 900; font-size: 1rem; color: #f8fafc;">
                                <span class="ui-icon" style="color: #38bdf8; margin: 0;"><span data-lucide="calendar-check" data-size="20"></span></span>
                                <span>حصص اليوم (${todayDateStr}) - مبرمج ${todaySlots.length} حصة:</span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                                ${slotsBadges}
                            </div>
                        </div>
                        <div class="tutoring-today-banner-actions" style="display: flex; gap: 8px; align-items: center;">
                            <button type="button" onclick="setTutoringScheduleView('today')" style="background: #3b82f6; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer;">
                                عرض شاشة اليوم المباشرة 🎯
                            </button>
                        </div>
                    </div>
                `;
            } else {
                todayBanner.innerHTML = `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; color: #64748b;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem;">
                            <span class="ui-icon" style="color: #10b981; margin: 0;"><span data-lucide="coffee" data-size="18"></span></span>
                            <span><b>${todayDateStr}:</b> اليوم استراحة، لا توجد حصص دعم مبرمجة في هذا اليوم.</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" onclick="openTutoringScheduleSlotModal(null, ${todayIdx}, 'individual')" style="background: #fffbeb; border: 1px solid #fde68a; color: #b45309; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                ➕ حصة دعم فردية لليوم ⭐
                            </button>
                            <button type="button" onclick="openAddTutoringScheduleSlotModal(${todayIdx})" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                ➕ حصة جماعية لليوم
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        // 6. Handle Empty State if no slots at all
        if (allSlots.length === 0) {
            container.innerHTML = `
                <div style="background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 45px 20px; text-align: center; max-width: 680px; margin: 20px auto;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; background: #e0e7ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                        <span class="ui-icon" style="margin: 0;"><span data-lucide="calendar-plus" data-size="30"></span></span>
                    </div>
                    <h3 style="margin: 0 0 8px 0; font-family: 'Cairo', sans-serif; font-size: 1.25rem; font-weight: 800; color: #1e293b;">
                        استعمال الزمن فارغ حالياً
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #64748b; font-size: 0.88rem; line-height: 1.6;">
                        قم ببرمجة مواعيد حصص الدعم الأسبوعية لتنظيم أوقات المجموعات، كشف تعارض القاعات، وتسهيل تسجيل حضور الحصص اليومية بنقرة واحدة.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                        <button type="button" class="btn-primary" onclick="seedTutoringSampleSchedule()" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <span class="ui-icon" style="margin: 0;"><span data-lucide="sparkles" data-size="16"></span></span>
                            <span>توليد جدول أسبوعي نموذجي تلقائياً</span>
                        </button>
                        <button type="button" class="btn-secondary" onclick="openTutoringScheduleSlotModal()" style="background: #f8fafc; border: 1.5px solid #cbd5e1; color: #334155; padding: 10px 18px; border-radius: 8px; font-weight: 800; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <span class="ui-icon" style="margin: 0;"><span data-lucide="plus-circle" data-size="16"></span></span>
                            <span>إضافة موعد يدوياً</span>
                        </button>
                    </div>
                </div>
            `;
            setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
            return;
        }

        // 7. Render Chosen View
        const days = [
            { id: 1, name: 'الإثنين', fr: 'Lundi' },
            { id: 2, name: 'الثلاثاء', fr: 'Mardi' },
            { id: 3, name: 'الأربعاء', fr: 'Mercredi' },
            { id: 4, name: 'الخميس', fr: 'Jeudi' },
            { id: 5, name: 'الجمعة', fr: 'Vendredi' },
            { id: 6, name: 'السبت', fr: 'Samedi' },
            { id: 0, name: 'الأحد', fr: 'Dimanche' }
        ];

        const todayIdx = new Date().getDay();

        if (window.currentTutoringScheduleView === 'matrix') {
            window.renderScheduleMatrixView(container, days, visibleSlots, conflictSlotIds, todayIdx);
        } else if (window.currentTutoringScheduleView === 'today') {
            window.renderScheduleTodayView(container, visibleSlots, conflictSlotIds, todayIdx);
        } else {
            // 'cards' view
            window.renderScheduleCardsView(container, days, visibleSlots, conflictSlotIds, todayIdx);
        }

        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 40);
    };

    // View Mode 1: Comprehensive Timetable Matrix Table
    window.renderScheduleMatrixView = function (container, days, slots, conflictSlotIds, todayIdx) {
        let theadCols = days.map(d => {
            const isToday = d.id === todayIdx;
            return `
                <th class="${isToday ? 'day-is-today' : ''}">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>${d.name}</span>
                        ${isToday ? '<span style="background: #2563eb; color: #fff; font-size: 0.68rem; padding: 1px 6px; border-radius: 10px; font-weight: 800;">اليوم</span>' : ''}
                    </div>
                    <div style="font-size: 0.72rem; font-weight: normal; color: ${isToday ? '#1e40af' : '#94a3b8'}; margin-top: 2px;">
                        ${d.fr}
                    </div>
                </th>
            `;
        }).join('');

        let tbodyCells = days.map(d => {
            const isToday = d.id === todayIdx;
            const daySlots = slots.filter(s => parseInt(s.day, 10) === d.id);
            daySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            let slotsHtml = '';
            if (daySlots.length === 0) {
                slotsHtml = `
                    <div style="min-height: 85px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.76rem; gap: 4px;">
                        <span>لا توجد حصص</span>
                        <div style="display: flex; gap: 4px; margin-top: 2px;">
                            <button type="button" onclick="openTutoringScheduleSlotModal(null, ${d.id}, 'individual')" style="background: #fffbeb; border: 1px dashed #fde68a; color: #b45309; padding: 2px 6px; border-radius: 5px; font-size: 0.7rem; font-weight: 700; cursor: pointer;" title="برمجة حصة دعم فردية لهذا اليوم">
                                👤 فردي
                            </button>
                            <button type="button" onclick="openAddTutoringScheduleSlotModal(${d.id})" style="background: none; border: 1px dashed #cbd5e1; color: #64748b; padding: 2px 6px; border-radius: 5px; font-size: 0.7rem; cursor: pointer;" title="إضافة حصة جماعية">
                                👥 جماعي
                            </button>
                        </div>
                    </div>
                `;
            } else {
                slotsHtml = daySlots.map(slot => {
                    const isIndiv = slot.slotType === 'individual' || slot.studentId;
                    const color = window.getSlotColorConfig(slot.color || (isIndiv ? 'amber' : 'indigo'));
                    const hasConflict = conflictSlotIds.has(slot.id);
                    const stds = (db.tutoring.students || []).filter(s => s.group === slot.group);
                    const durationText = window.calculateDurationText(slot.startTime, slot.endTime);
                    const durationHours = window.calculateDurationHours(slot.startTime, slot.endTime);

                    if (isIndiv) {
                        const studentName = slot.studentName || slot.group;
                        return `
                            <div class="tutoring-slot-card is-individual ${hasConflict ? 'has-conflict' : ''}" style="background: ${color.bg}; border-color: ${hasConflict ? '#ef4444' : color.border}; border-right-color: #d97706 !important;">
                                ${hasConflict ? '<div style="color: #dc2626; font-size: 0.72rem; font-weight: 800; margin-bottom: 2px;">⚠️ تعارض توقيت!</div>' : ''}
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 3px;">
                                    <div style="font-weight: 900; font-size: 0.88rem; color: #0f172a; line-height: 1.3; display: flex; align-items: center; gap: 4px;">
                                        <span style="color: #b45309;">👤</span>
                                        <span>${studentName}</span>
                                    </div>
                                    <span style="font-family: monospace; font-size: 0.7rem; font-weight: 800; background: ${color.pillBg}; color: ${color.pillText}; padding: 2px 6px; border-radius: 4px; white-space: nowrap;" dir="ltr">
                                        ${slot.startTime} - ${slot.endTime}
                                    </span>
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span class="tutoring-slot-badge-individual">⭐ دعم خصوصي فردي</span>
                                    ${slot.individualFee ? `<span style="font-size: 0.72rem; font-weight: 900; color: #047857; background: #ecfdf5; padding: 1px 6px; border-radius: 4px;">${slot.individualFee} د.م</span>` : ''}
                                </div>

                                ${slot.pedagogicalFocus ? `<div style="font-size: 0.73rem; color: #92400e; font-weight: 700; margin-bottom: 4px; background: rgba(254, 243, 199, 0.7); padding: 3px 6px; border-radius: 4px; border: 1px dashed #fde68a;">🎯 ${slot.pedagogicalFocus}</div>` : ''}

                                ${slot.level ? `<div style="font-size: 0.72rem; color: #475569; margin-bottom: 3px; font-weight: 600;">🎓 ${slot.level}</div>` : ''}

                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.73rem; color: #64748b; margin-top: 3px;">
                                    <span>${slot.room ? `📍 ${slot.room}` : 'المقر'}</span>
                                    <span>⏱️ ${durationText}</span>
                                </div>

                                ${slot.deliveryMode && slot.deliveryMode.includes('عن بعد') ? `<div style="font-size: 0.7rem; color: #2563eb; margin-top: 2px;">🌐 عن بعد (Online)</div>` : ''}

                                ${slot.notes ? `<div style="font-size: 0.7rem; color: #475569; margin-top: 3px; font-style: italic; background: rgba(255,255,255,0.7); padding: 2px 6px; border-radius: 4px;">📝 ${slot.notes}</div>` : ''}

                                <div class="tutoring-slot-actions" style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 7px; padding-top: 5px; border-top: 1px dashed rgba(217,119,6,0.25);">
                                    <button type="button" onclick="if(typeof openTutoringSessionModal==='function') openTutoringSessionModal('${slot.studentId}', { date: (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')), time: '${slot.startTime}', hours: ${durationHours}, topic: '${(slot.pedagogicalFocus || slot.notes || 'حصة دعم فردية').replace(/'/g, "\\'")}' });" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 3px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="تسجيل حضور وإنجاز الحصة الفردية الآن">
                                        ✍️ حصة
                                    </button>
                                    ${slot.studentPhone ? `
                                        <button type="button" onclick="sendWhatsAppScheduleToStudent('${slot.studentPhone}', '${studentName}', '${d.name}', '${slot.startTime}', '${slot.endTime}', '${(slot.pedagogicalFocus || slot.notes || '').replace(/'/g, "\\'")}')" style="background: #25D366; color: #fff; border: none; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="تأكيد الموعد عبر واتساب">
                                            💬
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="openTutoringScheduleSlotModal('${slot.id}')" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="تعديل الموعد">
                                        ✏️
                                    </button>
                                    <button type="button" onclick="deleteTutoringScheduleSlot('${slot.id}')" style="background: #fee2e2; color: #b91c1c; border: none; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="حذف الموعد">
                                        ✕
                                    </button>
                                </div>
                            </div>
                        `;
                    }

                    return `
                        <div class="tutoring-slot-card ${hasConflict ? 'has-conflict' : ''}" style="background: ${color.bg}; border-color: ${hasConflict ? '#ef4444' : color.border}; border-right-width: 4px;">
                            ${hasConflict ? '<div style="color: #dc2626; font-size: 0.72rem; font-weight: 800; margin-bottom: 2px;">⚠️ تعارض توقيت!</div>' : ''}
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 4px;">
                                <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; line-height: 1.3;">
                                    ${slot.group}
                                </div>
                                <span style="font-family: monospace; font-size: 0.72rem; font-weight: 800; background: ${color.pillBg}; color: ${color.pillText}; padding: 2px 6px; border-radius: 4px; white-space: nowrap;" dir="ltr">
                                    ${slot.startTime} - ${slot.endTime}
                                </span>
                            </div>

                            ${slot.level ? `<div style="font-size: 0.73rem; color: #475569; margin-bottom: 3px; font-weight: 600;">🎓 ${slot.level}</div>` : ''}

                            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.74rem; color: #64748b; margin-top: 4px;">
                                <span>${slot.room ? `📍 ${slot.room}` : 'المقر الرئيسي'}</span>
                                <button type="button" onclick="openTutoringScheduleStudentsModal('${slot.group}', '${slot.startTime}', '${slot.endTime}')" style="background: none; border: none; padding: 0; color: #059669; font-weight: 800; font-size: 0.74rem; cursor: pointer; text-decoration: underline;" title="عرض قائمة تلاميذ هذه المجموعة">
                                    👥 ${stds.length} تلاميذ
                                </button>
                            </div>

                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;">
                                ⏱️ ${durationText}
                            </div>

                            ${slot.notes ? `<div style="font-size: 0.72rem; color: #475569; margin-top: 4px; font-style: italic; background: rgba(255,255,255,0.7); padding: 3px 6px; border-radius: 4px;">${slot.notes}</div>` : ''}

                            <div class="tutoring-slot-actions" style="display: flex; gap: 4px; justify-content: flex-end; margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(0,0,0,0.1);">
                                <button type="button" onclick="if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${slot.group}', {durationHours: ${durationHours}, notes: '${slot.notes || ''}', time: '${slot.startTime}'});" style="background: #10b981; color: #fff; border: none; padding: 3px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="تسجيل حضور وإنجاز الحصة">
                                    ✍️ حصة
                                </button>
                                <button type="button" onclick="openTutoringScheduleSlotModal('${slot.id}')" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="تعديل الموعد">
                                    ✏️
                                </button>
                                <button type="button" onclick="deleteTutoringScheduleSlot('${slot.id}')" style="background: #fee2e2; color: #b91c1c; border: none; padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;" title="حذف الموعد">
                                    ✕
                                </button>
                            </div>
                        </div>
                    `;
                }).join('') + `
                    <div style="display: flex; gap: 4px; margin-top: 6px;">
                        <button type="button" onclick="openTutoringScheduleSlotModal(null, ${d.id}, 'individual')" style="flex: 1; background: #fffbeb; border: 1px dashed #fde68a; color: #b45309; padding: 4px 6px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer;" title="إضافة حصة دعم فردية لهذا اليوم">
                            👤 فردي ⭐
                        </button>
                        <button type="button" onclick="openAddTutoringScheduleSlotModal(${d.id})" style="flex: 1; background: #f8fafc; border: 1px dashed #cbd5e1; color: #64748b; padding: 4px 6px; border-radius: 6px; font-size: 0.7rem; cursor: pointer;" title="إضافة موعد جماعي">
                            👥 جماعي
                        </button>
                    </div>
                `;
            }

            return `
                <td class="${isToday ? 'day-cell-today' : ''}">
                    ${slotsHtml}
                </td>
            `;
        }).join('');

        container.innerHTML = `
            <div class="tutoring-matrix-wrapper">
                <table class="tutoring-matrix-table">
                    <thead>
                        <tr>${theadCols}</tr>
                    </thead>
                    <tbody>
                        <tr>${tbodyCells}</tr>
                    </tbody>
                </table>
            </div>
        `;
    };

    // View Mode 2: Responsive Day Columns / Cards View
    window.renderScheduleCardsView = function (container, days, slots, conflictSlotIds, todayIdx) {
        let html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
        `;

        days.forEach(d => {
            const isToday = d.id === todayIdx;
            const daySlots = slots.filter(s => parseInt(s.day, 10) === d.id);
            daySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            html += `
                <div class="tutoring-day-column ${isToday ? 'is-today' : ''}">
                    <div class="tutoring-day-column-header">
                        <div>
                            <span style="font-weight: 900; font-size: 1rem; color: #0f172a;">${d.name}</span>
                            <span style="font-size: 0.75rem; color: #64748b; margin-right: 4px;">(${d.fr})</span>
                            ${isToday ? '<span style="background: #2563eb; color: #fff; font-size: 0.68rem; padding: 2px 8px; border-radius: 12px; font-weight: 800; margin-right: 6px;">اليوم 📍</span>' : ''}
                        </div>
                        <span style="background: ${isToday ? '#dbeafe' : '#f1f5f9'}; color: ${isToday ? '#1d4ed8' : '#475569'}; font-size: 0.76rem; font-weight: 800; padding: 2px 8px; border-radius: 12px;">
                            ${daySlots.length} حصص
                        </span>
                    </div>
                    <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; gap: 8px;">
            `;

            if (daySlots.length === 0) {
                html += `
                    <div style="text-align: center; padding: 30px 10px; color: #94a3b8; font-size: 0.82rem;">
                        لا توجد حصص مبرمجة في هذا اليوم
                        <div style="margin-top: 10px; display: flex; justify-content: center; gap: 6px;">
                            <button type="button" onclick="openTutoringScheduleSlotModal(null, ${d.id}, 'individual')" style="background: #fffbeb; border: 1px dashed #fde68a; color: #b45309; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                👤 دعم فردي ⭐
                            </button>
                            <button type="button" onclick="openAddTutoringScheduleSlotModal(${d.id})" style="background: #f8fafc; border: 1px dashed #cbd5e1; color: #475569; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                👥 حصة جماعية
                            </button>
                        </div>
                    </div>
                `;
            } else {
                daySlots.forEach(slot => {
                    const isIndiv = slot.slotType === 'individual' || slot.studentId;
                    const color = window.getSlotColorConfig(slot.color || (isIndiv ? 'amber' : 'indigo'));
                    const hasConflict = conflictSlotIds.has(slot.id);
                    const stds = (db.tutoring.students || []).filter(s => s.group === slot.group);
                    const durationText = window.calculateDurationText(slot.startTime, slot.endTime);
                    const durationHours = window.calculateDurationHours(slot.startTime, slot.endTime);

                    if (isIndiv) {
                        const studentName = slot.studentName || slot.group;
                        html += `
                            <div class="tutoring-slot-card is-individual ${hasConflict ? 'has-conflict' : ''}" style="background: ${color.bg}; border-color: ${hasConflict ? '#ef4444' : color.border}; border-right-color: #d97706 !important;">
                                ${hasConflict ? '<div style="color: #dc2626; font-size: 0.75rem; font-weight: 800; margin-bottom: 4px;">⚠️ تعارض توقيت مع حصة أخرى في نفس اليوم!</div>' : ''}
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                    <div>
                                        <div style="font-weight: 900; font-size: 0.95rem; color: #0f172a; display: flex; align-items: center; gap: 5px;">
                                            <span style="color: #b45309;">👤</span>
                                            <span>${studentName}</span>
                                        </div>
                                        <span class="tutoring-slot-badge-individual" style="margin-top: 3px;">⭐ دعم خصوصي فردي</span>
                                    </div>
                                    <div style="text-align: left;">
                                        <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; color: ${color.pillText}; background: ${color.pillBg}; padding: 3px 8px; border-radius: 4px;" dir="ltr">
                                            ${slot.startTime} - ${slot.endTime}
                                        </span>
                                        ${slot.individualFee ? `<div style="font-size: 0.75rem; font-weight: 900; color: #047857; margin-top: 3px;">💰 ${slot.individualFee} د.م</div>` : ''}
                                    </div>
                                </div>

                                ${slot.pedagogicalFocus ? `<div style="font-size: 0.76rem; color: #92400e; font-weight: 700; margin: 6px 0; background: rgba(254, 243, 199, 0.85); padding: 4px 8px; border-radius: 6px; border: 1px dashed #fde68a;">🎯 الهدف: ${slot.pedagogicalFocus}</div>` : ''}

                                ${slot.level ? `<div style="font-size: 0.75rem; color: #475569; font-weight: 600;">🎓 المستوى: ${slot.level}</div>` : ''}

                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #64748b; margin-top: 6px;">
                                    <span>📍 ${slot.room || 'المقر المعتاد'} ${slot.deliveryMode ? '(' + slot.deliveryMode + ')' : ''}</span>
                                    <span>⏱️ ${durationText}</span>
                                </div>

                                ${slot.notes ? `<div style="font-size: 0.75rem; color: #334155; margin-top: 6px; background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 6px; font-style: italic;">📝 ${slot.notes}</div>` : ''}

                                <div class="tutoring-slot-actions" style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(217,119,6,0.25);">
                                    <button type="button" onclick="if(typeof openTutoringSessionModal==='function') openTutoringSessionModal('${slot.studentId}', { date: (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')), time: '${slot.startTime}', hours: ${durationHours}, topic: '${(slot.pedagogicalFocus || slot.notes || 'حصة دعم فردية').replace(/'/g, "\\'")}' });" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        ✍️ سجل الحصة الفردية
                                    </button>
                                    ${slot.studentPhone ? `
                                        <button type="button" onclick="sendWhatsAppScheduleToStudent('${slot.studentPhone}', '${studentName}', '${d.name}', '${slot.startTime}', '${slot.endTime}', '${(slot.pedagogicalFocus || slot.notes || '').replace(/'/g, "\\'")}')" style="background: #25D366; color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;" title="تأكيد الموعد عبر واتساب">
                                            💬 واتساب
                                        </button>
                                    ` : ''}
                                    <button type="button" onclick="openTutoringScheduleSlotModal('${slot.id}')" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" title="تعديل الموعد">
                                        تعديل
                                    </button>
                                    <button type="button" onclick="deleteTutoringScheduleSlot('${slot.id}')" style="background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" title="حذف الموعد">
                                        ✕
                                    </button>
                                </div>
                            </div>
                        `;
                    } else {
                        html += `
                            <div class="tutoring-slot-card ${hasConflict ? 'has-conflict' : ''}" style="background: ${color.bg}; border-color: ${hasConflict ? '#ef4444' : color.border}; border-right-width: 4px;">
                                ${hasConflict ? '<div style="color: #dc2626; font-size: 0.75rem; font-weight: 800; margin-bottom: 4px;">⚠️ تعارض توقيت مع حصة أخرى في نفس اليوم!</div>' : ''}
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a;">${slot.group}</div>
                                        ${slot.level ? `<div style="font-size: 0.75rem; color: #475569; font-weight: 600;">🎓 ${slot.level}</div>` : ''}
                                    </div>
                                    <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; color: ${color.pillText}; background: ${color.pillBg}; padding: 3px 8px; border-radius: 4px;" dir="ltr">
                                        ${slot.startTime} - ${slot.endTime}
                                    </span>
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #64748b; margin-top: 6px;">
                                    <span>${slot.room ? `📍 ${slot.room}` : 'المقر المعتاد'}</span>
                                    <button type="button" onclick="openTutoringScheduleStudentsModal('${slot.group}', '${slot.startTime}', '${slot.endTime}')" style="background: none; border: none; color: #059669; font-weight: 800; font-size: 0.78rem; cursor: pointer; text-decoration: underline;">
                                        👥 ${stds.length} تلاميذ
                                    </button>
                                </div>

                                <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
                                    ⏱️ المدة: ${durationText}
                                </div>

                                ${slot.notes ? `<div style="font-size: 0.75rem; color: #334155; margin-top: 6px; background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 6px; font-style: italic;">📝 ${slot.notes}</div>` : ''}

                                <div class="tutoring-slot-actions" style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(0,0,0,0.1);">
                                    <button type="button" onclick="if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${slot.group}', {durationHours: ${durationHours}, notes: '${slot.notes || ''}', time: '${slot.startTime}'});" style="background: #10b981; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        ✍️ سجل حصة
                                    </button>
                                    <button type="button" onclick="openTutoringScheduleSlotModal('${slot.id}')" style="background: #ffffff; color: #475569; border: 1px solid #cbd5e1; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" title="تعديل الموعد">
                                        تعديل
                                    </button>
                                    <button type="button" onclick="deleteTutoringScheduleSlot('${slot.id}')" style="background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;" title="حذف الموعد">
                                        ✕
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                });

                html += `
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                        <button type="button" onclick="openTutoringScheduleSlotModal(null, ${d.id}, 'individual')" style="flex: 1; background: #fffbeb; border: 1px dashed #fde68a; color: #b45309; padding: 6px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                            ➕ دعم فردي ⭐
                        </button>
                        <button type="button" onclick="openAddTutoringScheduleSlotModal(${d.id})" style="flex: 1; background: #ffffff; border: 1px dashed #cbd5e1; color: #64748b; padding: 6px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                            ➕ موعد جماعي
                        </button>
                    </div>
                `;
            }

            html += `
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
    };

    // View Mode 3: Today's Focused Session Deck
    window.renderScheduleTodayView = function (container, slots, conflictSlotIds, todayIdx) {
        const todaySlots = slots.filter(s => parseInt(s.day, 10) === todayIdx);
        todaySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        const todayNameStr = new Intl.DateTimeFormat('ar-MA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(now);

        let cardsHtml = '';
        if (todaySlots.length === 0) {
            cardsHtml = `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 40px 20px; text-align: center; color: #64748b;">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">☕</div>
                    <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 1.1rem; font-weight: 800;">لا توجد حصص دعم مبرمجة لليوم (${todayNameStr})</h4>
                    <p style="margin: 0 0 16px 0; font-size: 0.85rem;">يمكنك إضافة حصة استثنائية أو تصفح باقي أيام الأسبوع من خلال التبديل إلى "شبكة التوقيت".</p>
                    <div style="display: flex; justify-content: center; gap: 8px;">
                        <button type="button" onclick="openTutoringScheduleSlotModal(null, ${todayIdx}, 'individual')" class="btn-primary" style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 0.85rem;">
                            ➕ إضافة حصة دعم فردية ⭐
                        </button>
                        <button type="button" onclick="openAddTutoringScheduleSlotModal(${todayIdx})" class="btn-secondary" style="padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 0.85rem;">
                            ➕ إضافة حصة جماعية لليوم
                        </button>
                    </div>
                </div>
            `;
        } else {
            cardsHtml = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
            ` + todaySlots.map(slot => {
                const isIndiv = slot.slotType === 'individual' || slot.studentId;
                const startMins = window.timeToMinutes(slot.startTime);
                const endMins = window.timeToMinutes(slot.endTime);
                const color = window.getSlotColorConfig(slot.color || (isIndiv ? 'amber' : 'indigo'));
                const stds = (db.tutoring.students || []).filter(s => s.group === slot.group);
                const durationHours = window.calculateDurationHours(slot.startTime, slot.endTime);

                let statusBadge = '';
                if (currentMins >= startMins && currentMins <= endMins) {
                    statusBadge = '<span style="background: #ef4444; color: #fff; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; animation: pulse 2s infinite;">🔴 جارية الآن</span>';
                } else if (currentMins < startMins) {
                    const diff = startMins - currentMins;
                    const diffH = Math.floor(diff / 60);
                    const diffM = diff % 60;
                    const diffText = diffH > 0 ? `${diffH} س و ${diffM} د` : `${diffM} دقيقة`;
                    statusBadge = `<span style="background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">⏳ تبدأ بعد ${diffText}</span>`;
                } else {
                    statusBadge = '<span style="background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">انتهت الحصة</span>';
                }

                if (isIndiv) {
                    const studentName = slot.studentName || slot.group;
                    return `
                        <div style="background: #fff; border: 1.5px solid #fde68a; border-top: 5px solid #d97706; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(217, 119, 6, 0.08); display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    ${statusBadge}
                                    <span dir="ltr" style="font-family: monospace; font-size: 0.85rem; font-weight: 900; background: ${color.pillBg}; color: ${color.pillText}; padding: 3px 10px; border-radius: 6px;">
                                        ${slot.startTime} - ${slot.endTime}
                                    </span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                    <h4 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                                        <span style="color: #d97706;">👤</span>
                                        <span>${studentName}</span>
                                    </h4>
                                    <span class="tutoring-slot-badge-individual">⭐ دعم خصوصي فردي</span>
                                </div>
                                ${slot.level ? `<div style="font-size: 0.82rem; color: #475569; font-weight: 700; margin-bottom: 8px;">🎓 المستوى: ${slot.level}</div>` : ''}
                                
                                <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 0.82rem; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                                    ${slot.pedagogicalFocus ? `<div style="color: #92400e; font-weight: 800;">🎯 <b>الهدف:</b> ${slot.pedagogicalFocus}</div>` : ''}
                                    <div>📍 <b>المقر / المكان:</b> ${slot.room || 'المقر الرئيسي'} ${slot.deliveryMode ? '(' + slot.deliveryMode + ')' : ''}</div>
                                    <div>⏱️ <b>المدة:</b> ${window.calculateDurationText(slot.startTime, slot.endTime)}</div>
                                    ${slot.individualFee ? `<div>💰 <b>التسعيرة الفردية:</b> <span style="color: #047857; font-weight: 800;">${slot.individualFee} درهم</span></div>` : ''}
                                    ${slot.notes ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #fde68a; font-style: italic;">📝 <b>ملاحظات:</b> ${slot.notes}</div>` : ''}
                                </div>
                            </div>

                            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                                <button type="button" class="btn-primary" onclick="if(typeof openTutoringSessionModal==='function') openTutoringSessionModal('${slot.studentId}', { date: (window.formatLocalDate ? window.formatLocalDate() : new Date().toLocaleDateString('en-CA')), time: '${slot.startTime}', hours: ${durationHours}, topic: '${(slot.pedagogicalFocus || slot.notes || 'حصة دعم فردية').replace(/'/g, "\\'")}' });" style="flex: 1; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                                    <span class="ui-icon" style="margin: 0;"><span data-lucide="check-square" data-size="16"></span></span>
                                    <span>تسجيل الحصة الفردية الآن</span>
                                </button>
                                ${slot.studentPhone ? `
                                    <button type="button" onclick="sendWhatsAppScheduleToStudent('${slot.studentPhone}', '${studentName}', 'اليوم', '${slot.startTime}', '${slot.endTime}', '${(slot.pedagogicalFocus || slot.notes || '').replace(/'/g, "\\'")}')" style="background: #25D366; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                                        <span>💬 واتساب</span>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }

                return `
                    <div style="background: #fff; border: 1.5px solid #e2e8f0; border-top: 5px solid ${color.border}; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                ${statusBadge}
                                <span dir="ltr" style="font-family: monospace; font-size: 0.85rem; font-weight: 900; background: ${color.pillBg}; color: ${color.pillText}; padding: 3px 10px; border-radius: 6px;">
                                    ${slot.startTime} - ${slot.endTime}
                                </span>
                            </div>
                            <h4 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 900; color: #0f172a;">${slot.group}</h4>
                            ${slot.level ? `<div style="font-size: 0.82rem; color: #475569; font-weight: 700; margin-bottom: 8px;">🎓 المستوى: ${slot.level}</div>` : ''}
                            
                            <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 0.82rem; color: #334155; display: flex; flex-direction: column; gap: 4px;">
                                <div>📍 <b>القاعة / المكان:</b> ${slot.room || 'المقر الرئيسي المعتاد'}</div>
                                <div>⏱️ <b>المدة:</b> ${window.calculateDurationText(slot.startTime, slot.endTime)}</div>
                                <div>👥 <b>التلاميذ المسجلون:</b> ${stds.length} تلاميذ بالمجموعة</div>
                                ${slot.notes ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; font-style: italic;">📝 <b>ملاحظات:</b> ${slot.notes}</div>` : ''}
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                            <button type="button" class="btn-primary" onclick="if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${slot.group}', {durationHours: ${durationHours}, notes: '${slot.notes || ''}', time: '${slot.startTime}'});" style="flex: 1; background: #10b981; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                                <span class="ui-icon" style="margin: 0;"><span data-lucide="check-square" data-size="16"></span></span>
                                <span>تسجيل الحصة والغياب الآن</span>
                            </button>
                            <button type="button" onclick="openTutoringScheduleStudentsModal('${slot.group}', '${slot.startTime}', '${slot.endTime}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 0.82rem; cursor: pointer;">
                                👥 التلاميذ (${stds.length})
                            </button>
                        </div>
                    </div>
                `;
            }).join('') + `</div>`;
        }

        container.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px;">
                    <div>
                        <h4 style="margin: 0; color: #1e40af; font-size: 1.05rem; font-weight: 800;">🎯 جدول حصص اليوم: ${todayNameStr}</h4>
                        <p style="margin: 2px 0 0 0; color: #3b82f6; font-size: 0.8rem;">متابعة فورية للحصص الجارية والقادمة مع إمكانية تسجيل الحضور بضغطة واحدة</p>
                    </div>
                    <button type="button" onclick="setTutoringScheduleView('matrix')" style="background: #ffffff; border: 1px solid #93c5fd; color: #1d4ed8; padding: 6px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: bold; cursor: pointer;">
                        الرجوع للجدول الأسبوعي الكامل
                    </button>
                </div>
                ${cardsHtml}
            </div>
        `;
    };

    // Seed Sample Moroccan Tutoring Schedule with Groups & Individual Private Sessions
    window.seedTutoringSampleSchedule = function () {
        if (!confirm('هل تريد استيراد نموذج جدول أسبوعي متكامل لحصص الدعم والتقوية (يشمل حصص المجموعات وحصص الدعم الخصوصي الفردي)؟')) return;

        if (!db.tutoring.scheduleSlots) db.tutoring.scheduleSlots = [];
        if (!db.tutoring.students) db.tutoring.students = [];

        // Ensure sample individual students exist in tutoring roster
        const sampleStudents = [
            {
                id: 'std_indiv_sample_1',
                name: 'ياسين الإدريسي',
                phone: '0661234567',
                group: 'دعم خصوصي فردي',
                hourlyRate: 150,
                payments: [],
                sessions: []
            },
            {
                id: 'std_indiv_sample_2',
                name: 'سلمى بنجلون',
                phone: '0662345678',
                group: 'دعم خصوصي فردي',
                hourlyRate: 160,
                payments: [],
                sessions: []
            }
        ];
        sampleStudents.forEach(st => {
            if (!db.tutoring.students.some(s => s.id === st.id)) {
                db.tutoring.students.push(st);
            }
        });

        const sampleSlots = [
            {
                id: 'slot_seed_1',
                slotType: 'group',
                day: '6', // السبت
                group: 'ثانية باك علوم رياضية (SM)',
                level: '2BAC-SM',
                startTime: '16:00',
                endTime: '18:00',
                room: 'قاعة 1',
                color: 'indigo',
                recurrence: 'weekly',
                notes: 'مسائل الأولمبياد والتحليل الرياضي'
            },
            {
                id: 'slot_seed_2',
                slotType: 'group',
                day: '6', // السبت
                group: 'ثانية باك علوم تجريبية (PC)',
                level: '2BAC-PC',
                startTime: '18:00',
                endTime: '20:00',
                room: 'قاعة 1',
                color: 'blue',
                recurrence: 'weekly',
                notes: 'تمارين الدوال اللوغاريتمية والأسية'
            },
            {
                id: 'slot_seed_3',
                slotType: 'group',
                day: '0', // الأحد
                group: 'أولى باك علوم رياضية',
                level: '1BAC-SM',
                startTime: '10:00',
                endTime: '12:00',
                room: 'قاعة 2',
                color: 'emerald',
                recurrence: 'weekly',
                notes: 'مبادئ في المنطق والحسابيات'
            },
            {
                id: 'slot_seed_indiv_1',
                slotType: 'individual',
                studentId: 'std_indiv_sample_1',
                studentName: 'ياسين الإدريسي',
                studentPhone: '0661234567',
                pedagogicalFocus: 'معالجة تعثرات الحساب التكاملي والمتتاليات',
                individualFee: 150,
                deliveryMode: 'حضوري (بالقاعة / المركز)',
                group: 'دعم فردي: ياسين الإدريسي',
                level: '2BAC-SM',
                day: '2', // الثلاثاء
                recurrence: 'weekly',
                startTime: '17:00',
                endTime: '18:30',
                room: 'قاعة الدعم الفردي',
                color: 'amber',
                notes: 'إعداد مكثف للامتحان الوطني مع التركيز على المنهجية'
            },
            {
                id: 'slot_seed_4',
                slotType: 'group',
                day: '0', // الأحد
                group: 'جذع مشترك علمي (خيار فرنسية)',
                level: 'TC-SC',
                startTime: '15:00',
                endTime: '17:00',
                room: 'قاعة 1',
                color: 'amber',
                recurrence: 'weekly',
                notes: 'الحساب المتجهي ومجموعات الأعداد والحدوديات'
            },
            {
                id: 'slot_seed_indiv_2',
                slotType: 'individual',
                studentId: 'std_indiv_sample_2',
                studentName: 'سلمى بنجلون',
                studentPhone: '0662345678',
                pedagogicalFocus: 'مراجعة مكثفة في الأعداد العقدية والاحتمالات',
                individualFee: 160,
                deliveryMode: 'عن بعد (Google Meet / Zoom)',
                group: 'دعم فردي: سلمى بنجلون',
                level: '2BAC-PC',
                day: '4', // الخميس
                recurrence: 'weekly',
                startTime: '18:00',
                endTime: '19:30',
                room: 'عن بعد (Google Meet)',
                color: 'purple',
                notes: 'حصة تقوية وتثبيت المفاهيم وتدارك التأخر'
            },
            {
                id: 'slot_seed_5',
                slotType: 'group',
                day: '3', // الأربعاء
                group: 'جذع مشترك علمي',
                level: 'TC-SC',
                startTime: '16:00',
                endTime: '18:00',
                room: 'قاعة 2',
                color: 'purple',
                recurrence: 'weekly',
                notes: 'مجموعات الأعداد والترتيب في R'
            }
        ];

        db.tutoring.scheduleSlots = sampleSlots;

        // Also ensure these groups are tracked
        if (!db.tutoring.groups) db.tutoring.groups = [];
        sampleSlots.forEach(slot => {
            if (slot.slotType !== 'individual' && !db.tutoring.groups.some(g => g.name === slot.group)) {
                db.tutoring.groups.push({
                    id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                    name: slot.group,
                    level: slot.level,
                    defaultFee: 120,
                    notes: slot.notes
                });
            }
        });

        if (typeof saveDB === 'function') saveDB();
        window.renderTutoringWeeklySchedule();

        if (typeof showToast === 'function') {
            showToast('تم استيراد نموذج الجدول الأسبوعي المتكامل (جماعي وفردي) بنجاح!', 'success');
        }
    };

    // Modal Helpers for Individual vs Group Slots
    window.setScheduleSlotType = function (type) {
        const typeInput = document.getElementById('scheduleSlotType');
        if (typeInput) typeInput.value = type;

        const btnGroup = document.getElementById('scheduleSlotTypeBtnGroup');
        const btnIndiv = document.getElementById('scheduleSlotTypeBtnIndividual');
        if (btnGroup) btnGroup.classList.toggle('active', type === 'group');
        if (btnIndiv) btnIndiv.classList.toggle('active', type === 'individual');

        const grpSec = document.getElementById('scheduleSlotGroupSection');
        const indSec = document.getElementById('scheduleSlotIndividualSection');
        if (grpSec) grpSec.style.display = (type === 'group') ? 'block' : 'none';
        if (indSec) indSec.style.display = (type === 'individual') ? 'block' : 'none';

        // Select amber/orange theme by default for individual support if user has default indigo
        if (type === 'individual') {
            const amberRadio = document.querySelector('input[name="slotColor"][value="amber"]');
            const indigoRadio = document.querySelector('input[name="slotColor"][value="indigo"]');
            if (amberRadio && indigoRadio && indigoRadio.checked) {
                amberRadio.checked = true;
            }
        }
        window.updateScheduleSlotDurationPreview();
    };

    window.setSlotPedagogicalPreset = function (text) {
        const input = document.getElementById('scheduleSlotPedagogicalFocus');
        if (input) {
            input.value = text;
            input.focus();
        }
    };

    window.onScheduleSlotStudentChange = function () {
        const select = document.getElementById('scheduleSlotStudentSelect');
        if (!select) return;
        const stdId = select.value;
        const nameInput = document.getElementById('scheduleSlotStudentName');
        const phoneInput = document.getElementById('scheduleSlotStudentPhone');
        const levelSelect = document.getElementById('scheduleSlotLevel');
        const feeInput = document.getElementById('scheduleSlotIndividualFee');
        const badge = document.getElementById('scheduleSlotStudentInfoBadge');
        const directBox = document.getElementById('scheduleSlotNewStudentDirectBox');
        const directName = document.getElementById('scheduleSlotDirectStudentName');
        const directPhone = document.getElementById('scheduleSlotDirectStudentPhone');

        if (stdId === '__NEW_INDEPENDENT__') {
            if (directBox) directBox.style.display = 'block';
            if (badge) badge.innerHTML = '<span style="background: #fef3c7; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px; color: #b45309;">✍️ إدخال يدوي مباشر لتلميذ دعم فردي مستقل</span>';
            if (nameInput && directName) nameInput.value = directName.value.trim();
            if (phoneInput && directPhone) phoneInput.value = directPhone.value.trim();
            if (feeInput && (!feeInput.value || feeInput.value === '0')) feeInput.value = '150';
            if (directName) setTimeout(() => directName.focus(), 50);
            return;
        }

        if (directBox) directBox.style.display = 'none';

        if (!stdId) {
            if (nameInput) nameInput.value = '';
            if (phoneInput) phoneInput.value = '';
            if (badge) badge.innerHTML = '';
            return;
        }

        const allTutoringStudents = db.tutoring.students || [];
        const std = allTutoringStudents.find(s => s.id === stdId);

        if (std) {
            if (nameInput) nameInput.value = std.name || '';
            if (phoneInput) phoneInput.value = std.phone || '';

            // Auto-select level if available
            if (levelSelect && std.group) {
                for (let opt of levelSelect.options) {
                    if (opt.value && (std.group.includes(opt.value) || (std.level && std.level.includes(opt.value)))) {
                        levelSelect.value = opt.value;
                        break;
                    }
                }
            }

            // Auto fee
            if (feeInput && (!feeInput.value || feeInput.value === '0' || feeInput.value === '')) {
                feeInput.value = std.hourlyRate || std.fee || 150;
            }

            if (badge) {
                badge.innerHTML = `
                    <span style="background: #fef3c7; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px;">🎓 ${std.group || 'دعم فردي'}</span>
                    <span style="background: #fef3c7; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 6px;">📞 ${std.phone || 'لا يوجد هاتف مسجل'}</span>
                    <span style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 2px 8px; border-radius: 6px;">💵 سعر الساعة: ${std.hourlyRate || std.fee || 150} د.م</span>
                `;
            }
        }
    };

    // Modal: Open Slot Editor / Creator (Group & Individual)
    window.openTutoringScheduleSlotModal = function (slotId, defaultDay, defaultType, defaultStudentId) {
        const modal = document.getElementById('tutoringScheduleSlotModal');
        if (!modal) return;

        const idInput = document.getElementById('scheduleSlotId');
        const typeInput = document.getElementById('scheduleSlotType');
        const daySelect = document.getElementById('scheduleSlotDay');
        const recSelect = document.getElementById('scheduleSlotRecurrence');
        const groupInput = document.getElementById('scheduleSlotGroup');
        const levelSelect = document.getElementById('scheduleSlotLevel');
        const startInput = document.getElementById('scheduleSlotStartTime');
        const endInput = document.getElementById('scheduleSlotEndTime');
        const roomInput = document.getElementById('scheduleSlotRoom');
        const notesInput = document.getElementById('scheduleSlotNotes');
        const titleEl = document.getElementById('scheduleSlotModalTitle');
        const studentSelect = document.getElementById('scheduleSlotStudentSelect');
        const studentNameInput = document.getElementById('scheduleSlotStudentName');
        const studentPhoneInput = document.getElementById('scheduleSlotStudentPhone');
        const focusInput = document.getElementById('scheduleSlotPedagogicalFocus');
        const feeInput = document.getElementById('scheduleSlotIndividualFee');
        const deliverySelect = document.getElementById('scheduleSlotDeliveryMode');

        if (!db.tutoring.scheduleSlots) db.tutoring.scheduleSlots = [];

        // 1. Populate student dropdown (Independent Tutoring Students Only + Direct entry option)
        if (studentSelect) {
            let opts = '<option value="">-- اختر التلميذ(ة) للدعم الخصوصي الفردي --</option>';
            opts += '<option value="__NEW_INDEPENDENT__">✍️ تلميذ فردي جديد (إدخال مباشر ومستقل)...</option>';

            const tutStudents = (db.tutoring.students || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
            if (tutStudents.length > 0) {
                opts += '<optgroup label="تلاميذ الدعم والدروس الخصوصية المسجلون">';
                tutStudents.forEach(s => {
                    const grp = s.group ? ` [${s.group}]` : '';
                    opts += `<option value="${s.id}">${s.name}${grp}</option>`;
                });
                opts += '</optgroup>';
            }

            studentSelect.innerHTML = opts;
        }

        if (slotId) {
            const slot = db.tutoring.scheduleSlots.find(s => s.id === slotId);
            if (slot) {
                const isIndiv = slot.slotType === 'individual' || Boolean(slot.studentId);
                window.setScheduleSlotType(isIndiv ? 'individual' : 'group');

                if (idInput) idInput.value = slot.id;
                if (daySelect) daySelect.value = String(slot.day);
                if (recSelect) recSelect.value = slot.recurrence || 'weekly';
                if (groupInput) groupInput.value = slot.group || '';
                if (levelSelect) levelSelect.value = slot.level || '';
                if (startInput) startInput.value = slot.startTime || '16:00';
                if (endInput) endInput.value = slot.endTime || '18:00';
                if (roomInput) roomInput.value = slot.room || '';
                if (notesInput) notesInput.value = slot.notes || '';

                if (isIndiv) {
                    if (studentSelect) studentSelect.value = slot.studentId || '';
                    if (studentNameInput) studentNameInput.value = slot.studentName || '';
                    if (studentPhoneInput) studentPhoneInput.value = slot.studentPhone || '';
                    if (focusInput) focusInput.value = slot.pedagogicalFocus || '';
                    if (feeInput) feeInput.value = slot.individualFee || '';
                    if (deliverySelect) deliverySelect.value = slot.deliveryMode || 'حضوري (بالقاعة / المركز)';
                    window.onScheduleSlotStudentChange();
                    if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #f59e0b;"><span data-lucide="edit-3" data-size="20"></span></span> تعديل موعد حصة الدعم الفردية 👤`;
                } else {
                    if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #6366f1;"><span data-lucide="edit-3" data-size="20"></span></span> تعديل موعد الحصة الأسبوعي لمجموعة الدعم`;
                }

                const colorRadios = document.querySelectorAll('input[name="slotColor"]');
                colorRadios.forEach(r => {
                    r.checked = (r.value === (slot.color || (isIndiv ? 'amber' : 'indigo')));
                });
            }
        } else {
            const isIndiv = defaultType === 'individual' || Boolean(defaultStudentId);
            window.setScheduleSlotType(isIndiv ? 'individual' : 'group');

            if (idInput) idInput.value = '';
            if (daySelect) daySelect.value = (defaultDay !== undefined && defaultDay !== null) ? String(defaultDay) : '1';
            if (recSelect) recSelect.value = 'weekly';
            if (groupInput) groupInput.value = '';
            if (levelSelect) levelSelect.value = '';
            if (startInput) startInput.value = isIndiv ? '17:00' : '16:00';
            if (endInput) endInput.value = isIndiv ? '18:30' : '18:00';
            if (roomInput) roomInput.value = isIndiv ? 'قاعة الدعم الفردي' : 'قاعة 1';
            if (notesInput) notesInput.value = '';
            if (focusInput) focusInput.value = '';
            if (feeInput) feeInput.value = isIndiv ? '150' : '';
            if (deliverySelect) deliverySelect.value = 'حضوري (بالقاعة / المركز)';

            if (isIndiv) {
                if (defaultStudentId && studentSelect) {
                    studentSelect.value = defaultStudentId;
                    window.onScheduleSlotStudentChange();
                } else {
                    if (studentSelect) studentSelect.value = '';
                    if (studentNameInput) studentNameInput.value = '';
                    if (studentPhoneInput) studentPhoneInput.value = '';
                    const badge = document.getElementById('scheduleSlotStudentInfoBadge');
                    if (badge) badge.innerHTML = '';
                }
                const amberRadio = document.querySelector('input[name="slotColor"][value="amber"]');
                if (amberRadio) amberRadio.checked = true;
                if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #f59e0b;"><span data-lucide="user-plus" data-size="20"></span></span> برمجة حصة دعم خصوصي فردية (1-à-1) ⭐`;
            } else {
                const defaultRadio = document.querySelector('input[name="slotColor"][value="indigo"]');
                if (defaultRadio) defaultRadio.checked = true;
                if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #6366f1;"><span data-lucide="calendar-plus" data-size="20"></span></span> إضافة موعد أسبوعي لمجموعة دعم`;
            }
        }

        window.updateScheduleSlotDurationPreview();
        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringScheduleSlotModal = function () {
        const modal = document.getElementById('tutoringScheduleSlotModal');
        if (modal) modal.style.display = 'none';
    };

    window.updateScheduleSlotDurationPreview = function () {
        const startInput = document.getElementById('scheduleSlotStartTime');
        const endInput = document.getElementById('scheduleSlotEndTime');
        const daySelect = document.getElementById('scheduleSlotDay');
        const idInput = document.getElementById('scheduleSlotId');
        const durationTextEl = document.getElementById('scheduleSlotDurationText');
        const warningEl = document.getElementById('scheduleSlotConflictWarning');

        if (!startInput || !endInput) return;
        const text = window.calculateDurationText(startInput.value, endInput.value);
        if (durationTextEl) durationTextEl.innerText = text;

        // Check for conflict on that day
        if (warningEl && daySelect) {
            const startM = window.timeToMinutes(startInput.value);
            const endM = window.timeToMinutes(endInput.value);
            const currentId = idInput ? idInput.value : '';
            const dayVal = daySelect.value;

            const existingSlots = (db.tutoring.scheduleSlots || []).filter(s => String(s.day) === dayVal && s.id !== currentId);
            const hasConflict = existingSlots.some(s => {
                const s1 = window.timeToMinutes(s.startTime);
                const e1 = window.timeToMinutes(s.endTime);
                return Math.max(startM, s1) < Math.min(endM, e1);
            });

            warningEl.style.display = hasConflict ? 'inline-block' : 'none';
        }
    };

    let _isSavingTutoringScheduleSlot = false;
    window.saveTutoringScheduleSlot = function () {
        if (_isSavingTutoringScheduleSlot) return;
        _isSavingTutoringScheduleSlot = true;
        const unlock = () => { setTimeout(() => { _isSavingTutoringScheduleSlot = false; }, 450); };

        const idInput = document.getElementById('scheduleSlotId');
        const typeInput = document.getElementById('scheduleSlotType');
        const slotType = typeInput ? typeInput.value : 'group';
        const daySelect = document.getElementById('scheduleSlotDay');
        const recSelect = document.getElementById('scheduleSlotRecurrence');
        const groupInput = document.getElementById('scheduleSlotGroup');
        const levelSelect = document.getElementById('scheduleSlotLevel');
        const startInput = document.getElementById('scheduleSlotStartTime');
        const endInput = document.getElementById('scheduleSlotEndTime');
        const roomInput = document.getElementById('scheduleSlotRoom');
        const notesInput = document.getElementById('scheduleSlotNotes');
        const studentSelect = document.getElementById('scheduleSlotStudentSelect');
        const studentNameInput = document.getElementById('scheduleSlotStudentName');
        const studentPhoneInput = document.getElementById('scheduleSlotStudentPhone');
        const focusInput = document.getElementById('scheduleSlotPedagogicalFocus');
        const feeInput = document.getElementById('scheduleSlotIndividualFee');
        const deliverySelect = document.getElementById('scheduleSlotDeliveryMode');

        let group = '';
        let studentId = '';
        let studentName = '';
        let studentPhone = '';
        let pedagogicalFocus = '';
        let individualFee = 0;
        let deliveryMode = '';

        if (slotType === 'individual') {
            studentId = studentSelect ? studentSelect.value : '';
            const directName = document.getElementById('scheduleSlotDirectStudentName');
            const directPhone = document.getElementById('scheduleSlotDirectStudentPhone');

            if (studentId === '__NEW_INDEPENDENT__' || !studentId) {
                studentName = (directName && directName.value.trim()) || (studentNameInput && studentNameInput.value.trim()) || '';
                studentPhone = (directPhone && directPhone.value.trim()) || (studentPhoneInput && studentPhoneInput.value.trim()) || '';
                if (!studentName) {
                    alert('يرجى كتابة اسم التلميذ(ة) المستهدف بالدعم الخصوصي الفردي.');
                    unlock();
                    return;
                }
                studentId = 'tstd_' + Date.now();
            } else {
                studentName = studentNameInput ? studentNameInput.value.trim() : '';
                if (!studentName) {
                    const opt = studentSelect.options[studentSelect.selectedIndex];
                    studentName = opt ? opt.text.split('[')[0].trim() : 'تلميذ فردي';
                }
                studentPhone = studentPhoneInput ? studentPhoneInput.value.trim() : '';
            }

            pedagogicalFocus = focusInput ? focusInput.value.trim() : '';
            individualFee = feeInput ? (parseFloat(feeInput.value) || 0) : 0;
            deliveryMode = deliverySelect ? deliverySelect.value : 'حضوري (بالقاعة / المركز)';
            group = 'دعم فردي: ' + studentName;

            // Ensure student is registered in db.tutoring.students so they are trackable in billing & roster
            if (!db.tutoring.students) db.tutoring.students = [];
            let tutStd = db.tutoring.students.find(s => s.id === studentId || (s.name && s.name.trim().toLowerCase() === studentName.toLowerCase()));
            if (!tutStd) {
                tutStd = {
                    id: studentId,
                    name: studentName,
                    phone: studentPhone,
                    group: 'دعم خصوصي فردي',
                    hourlyRate: individualFee || 150,
                    payments: [],
                    sessions: []
                };
                db.tutoring.students.push(tutStd);
            } else {
                studentId = tutStd.id;
                if (individualFee > 0 && !tutStd.hourlyRate) tutStd.hourlyRate = individualFee;
                if (studentPhone && !tutStd.phone) tutStd.phone = studentPhone;
            }
        } else {
            group = groupInput ? groupInput.value.trim() : '';
            if (!group) {
                alert('يرجى كتابة أو اختيار مجموعة الدعم.');
                unlock();
                return;
            }
        }

        const selectedColorRadio = document.querySelector('input[name="slotColor"]:checked');
        const color = selectedColorRadio ? selectedColorRadio.value : (slotType === 'individual' ? 'amber' : 'indigo');

        if (!db.tutoring.scheduleSlots) db.tutoring.scheduleSlots = [];

        const slotData = {
            id: idInput && idInput.value ? idInput.value : ('slot_' + Date.now()),
            slotType: slotType,
            studentId: studentId,
            studentName: studentName,
            studentPhone: studentPhone,
            pedagogicalFocus: pedagogicalFocus,
            individualFee: individualFee,
            deliveryMode: deliveryMode,
            day: daySelect ? daySelect.value : '1',
            recurrence: recSelect ? recSelect.value : 'weekly',
            group: group,
            level: levelSelect ? levelSelect.value : '',
            startTime: startInput ? startInput.value : '16:00',
            endTime: endInput ? endInput.value : '18:00',
            room: roomInput ? roomInput.value.trim() : (slotType === 'individual' ? 'قاعة الدعم الفردي' : 'قاعة 1'),
            color: color,
            notes: notesInput ? notesInput.value.trim() : ''
        };

        const existingIdx = db.tutoring.scheduleSlots.findIndex(s => s.id === slotData.id);
        if (existingIdx >= 0) {
            db.tutoring.scheduleSlots[existingIdx] = slotData;
        } else {
            db.tutoring.scheduleSlots.push(slotData);
        }

        // Auto-register group if group slot
        if (slotType !== 'individual') {
            if (!db.tutoring.groups) db.tutoring.groups = [];
            if (!db.tutoring.groups.some(g => g.name === group)) {
                db.tutoring.groups.push({
                    id: 'grp_' + Date.now(),
                    name: group,
                    level: slotData.level,
                    defaultFee: 100,
                    notes: slotData.notes
                });
            }
        }

        if (typeof saveDB === 'function') saveDB();
        window.closeTutoringScheduleSlotModal();
        window.renderTutoringWeeklySchedule();

        if (typeof showToast === 'function') {
            showToast(slotType === 'individual' ? 'تمت برمجة حصة الدعم الفردية في الجدول الأسبوعي بنجاح!' : 'تم حفظ موعد الحصة الأسبوعي بنجاح!', 'success');
        }
        unlock();
    };

    window.deleteTutoringScheduleSlot = function (slotId) {
        if (!confirm('هل أنت متأكد من حذف هذا الموعد من الجدول الأسبوعي؟')) return;
        db.tutoring.scheduleSlots = (db.tutoring.scheduleSlots || []).filter(s => s.id !== slotId);
        if (typeof saveDB === 'function') saveDB();
        window.renderTutoringWeeklySchedule();
        if (typeof showToast === 'function') {
            showToast('تم حذف الموعد من الجدول الأسبوعي', 'info');
        }
    };

    // Modal: Enrolled Students Roster
    window.openTutoringScheduleStudentsModal = function (groupName, startTime, endTime) {
        const modal = document.getElementById('tutoringScheduleStudentsModal');
        if (!modal) return;

        const titleEl = document.getElementById('schedStudentsModalTitle');
        const subtitleEl = document.getElementById('schedStudentsModalSubtitle');
        const listContainer = document.getElementById('schedStudentsListContainer');
        const actionsContainer = document.getElementById('schedStudentsModalActions');

        const students = (db.tutoring.students || []).filter(s => s.group === groupName);

        if (titleEl) titleEl.innerText = `تلاميذ المجموعة: ${groupName}`;
        if (subtitleEl) subtitleEl.innerText = `التوقيت المبرمج: ${startTime || ''} إلى ${endTime || ''} • إجمالي المسجلين: ${students.length} تلميذ`;

        if (listContainer) {
            if (students.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 25px; color: #94a3b8; font-size: 0.85rem;">
                        لا يوجد تلاميذ مسجلون في هذه المجموعة حالياً.
                        <div style="margin-top: 10px;">
                            <button type="button" onclick="window.closeTutoringScheduleStudentsModal(); window.showTutoringSubTab('students');" class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem; font-weight: bold; border-radius: 6px;">
                                إضافة تلاميذ للمجموعة
                            </button>
                        </div>
                    </div>
                `;
            } else {
                listContainer.innerHTML = students.map((std, idx) => {
                    const avatarLetter = (std.name || 'ت').trim().charAt(0);
                    const phone = std.parentPhone || std.phone || '';
                    const cleanPhone = phone.replace(/[^0-9]/g, '');
                    let waTargetPhone = cleanPhone;
                    if (typeof cleanWhatsAppNumber === 'function') {
                        waTargetPhone = cleanWhatsAppNumber(phone);
                    } else if (waTargetPhone.startsWith('00')) {
                        waTargetPhone = waTargetPhone.substring(2);
                    } else if (waTargetPhone.startsWith('0')) {
                        waTargetPhone = '212' + waTargetPhone.substring(1);
                    } else if (!waTargetPhone.startsWith('212') && waTargetPhone.length === 9) {
                        waTargetPhone = '212' + waTargetPhone;
                    }

                    // Calculate current month status
                    const currentMonth = window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7));
                    const isPaid = (std.paidMonths && std.paidMonths.includes(currentMonth));
                    const fee = std.fee || 100;
                    const paidAmount = std.paidAmount || (isPaid ? fee : 0);
                    const remaining = Math.max(0, fee - paidAmount);

                    let payBadge = '';
                    if (isPaid || remaining === 0) {
                        payBadge = '<span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 800;">خالص الشهر الحالي</span>';
                    } else if (paidAmount > 0) {
                        payBadge = `<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 800;">متبقي: ${remaining} درهم</span>`;
                    } else {
                        payBadge = `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 800;">غير مؤدى (${fee} درهم)</span>`;
                    }

                    return `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem;">
                                    ${avatarLetter}
                                </div>
                                <div>
                                    <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">${idx + 1}. ${std.name}</div>
                                    <div style="font-size: 0.75rem; color: #64748b;">${std.level || 'بدون مستوى'} ${phone ? `• 📞 ${phone}` : ''}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${payBadge}
                                ${cleanPhone ? `
                                    <a href="https://wa.me/${waTargetPhone}?text=${encodeURIComponent(`السلام عليكم، تذكير بموعد حصة الدعم لمجموعة ${groupName}.`)}" target="_blank" rel="noopener noreferrer" style="background: #25d366; color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: bold; text-decoration: none;" title="مراسلة واتساب">
                                        واتساب
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (actionsContainer) {
            actionsContainer.innerHTML = `
                <button type="button" class="btn-primary" onclick="window.closeTutoringScheduleStudentsModal(); if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${groupName}');" style="background: #10b981; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                    <span class="ui-icon" style="margin: 0;"><span data-lucide="check-square" data-size="16"></span></span>
                    <span>تسجيل حضور حصة لهذه المجموعة</span>
                </button>
            `;
        }

        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringScheduleStudentsModal = function () {
        const modal = document.getElementById('tutoringScheduleStudentsModal');
        if (modal) modal.style.display = 'none';
    };

    // Timetable Printable Document Builder (A4 Official Format)
    window.buildWeeklySchedulePrintHtml = function () {
        const days = [
            { id: 1, name: 'الإثنين', fr: 'Lundi' },
            { id: 2, name: 'الثلاثاء', fr: 'Mardi' },
            { id: 3, name: 'الأربعاء', fr: 'Mercredi' },
            { id: 4, name: 'الخميس', fr: 'Jeudi' },
            { id: 5, name: 'الجمعة', fr: 'Vendredi' },
            { id: 6, name: 'السبت', fr: 'Samedi' },
            { id: 0, name: 'الأحد', fr: 'Dimanche' }
        ];

        const slots = db.tutoring.scheduleSlots || [];

        let tableRows = days.map(d => {
            const daySlots = slots.filter(s => parseInt(s.day, 10) === d.id);
            daySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

            let sessionsCell = '';
            if (daySlots.length === 0) {
                sessionsCell = '<span style="color: #94a3b8; font-style: italic;">استراحة / لا توجد حصص</span>';
            } else {
                sessionsCell = daySlots.map(s => {
                    const isIndiv = s.slotType === 'individual' || Boolean(s.studentId);
                    if (isIndiv) {
                        return `
                            <div style="display: inline-block; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 6px 10px; margin: 3px; font-size: 0.85rem; text-align: right; min-width: 230px; box-shadow: 0 1px 2px rgba(245, 158, 11, 0.08);">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                                    <span style="font-weight: 900; color: #b45309;">👤 ${s.studentName || s.group}</span>
                                    <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 10px; font-size: 0.68rem; font-weight: 800; padding: 1px 6px;">دعم فردي ⭐</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: #78350f; margin-top: 3px;">
                                    <span dir="ltr" style="font-family: monospace; font-weight: bold;">⏰ ${s.startTime} - ${s.endTime}</span>
                                    <span>${s.deliveryMode || s.room || 'حضوري'}</span>
                                    ${s.individualFee ? `<span>💵 ${s.individualFee} د.م</span>` : ''}
                                </div>
                                ${s.pedagogicalFocus ? `<div style="font-size: 0.72rem; color: #92400e; margin-top: 2px;">🎯 ${s.pedagogicalFocus}</div>` : ''}
                                ${s.notes ? `<div style="font-size: 0.70rem; color: #94a3b8; margin-top: 1px;">📝 ${s.notes}</div>` : ''}
                            </div>
                        `;
                    }

                    const stds = (db.tutoring.students || []).filter(st => st.group === s.group);
                    return `
                        <div style="display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; margin: 3px; font-size: 0.85rem; text-align: right; min-width: 220px;">
                            <div style="font-weight: 800; color: #0f172a;">👥 ${s.group}</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #475569; margin-top: 2px;">
                                <span dir="ltr" style="font-family: monospace; font-weight: bold;">⏰ ${s.startTime} - ${s.endTime}</span>
                                <span>${s.room || 'المقر'}</span>
                                <span>(${stds.length} تلاميذ)</span>
                            </div>
                            ${s.notes ? `<div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">📝 ${s.notes}</div>` : ''}
                        </div>
                    `;
                }).join('');
            }

            return `
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 10px; font-weight: 800; background: #f8fafc; width: 140px; text-align: center;">
                        <div style="font-size: 1rem; color: #0f172a;">${d.name}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${d.fr}</div>
                    </td>
                    <td style="border: 1px solid #94a3b8; padding: 8px; vertical-align: middle;">
                        ${sessionsCell}
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div style="font-family: 'Cairo', 'Amiri', Tahoma, sans-serif; direction: rtl; color: #0f172a;">
                <!-- Official Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
                    <div style="text-align: right; font-size: 0.82rem; line-height: 1.4;">
                        <div style="font-weight: 800;">المملكة المغربية</div>
                        <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                        <div>برنامج الدعم التربوي والتقوية الخصوصية</div>
                    </div>
                    <div style="text-align: center;">
                        <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #1e293b; text-decoration: underline;">
                            استعمال الزمن وجدول الحصص الأسبوعي
                        </h2>
                        <div style="font-size: 0.85rem; color: #475569; margin-top: 4px;">
                            الموسم الدراسي: 2026 / 2027 • مادة الرياضيات
                        </div>
                    </div>
                    <div style="text-align: left; font-size: 0.82rem; line-height: 1.4;" dir="ltr">
                        <div><b>Total Sessions:</b> ${slots.length}</div>
                        <div><b>Date:</b> ${new Date().toLocaleDateString('fr-FR')}</div>
                    </div>
                </div>

                <!-- Timetable Grid -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background: #1e293b; color: #ffffff;">
                            <th style="border: 1px solid #1e293b; padding: 8px; font-size: 0.9rem;">يوم الأسبوع</th>
                            <th style="border: 1px solid #1e293b; padding: 8px; font-size: 0.9rem;">المجموعات المبرمجة وتوقيت الحصص والقاعات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <!-- Footer and Signature -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding-top: 15px; border-top: 1px dashed #94a3b8;">
                    <div style="font-size: 0.78rem; color: #64748b;">
                        * يرجى من جميع التلاميذ احترام مواعيد الحضور المحددة وتجنب التأخر لضمان السير البيداغوجي الأمثل للحصص.
                    </div>
                    <div style="text-align: center; min-width: 180px;">
                        <div style="font-weight: 800; font-size: 0.88rem; margin-bottom: 45px;">توقيع وختم الأستاذ:</div>
                        <div style="border-bottom: 1px solid #cbd5e1; width: 150px; margin: 0 auto;"></div>
                    </div>
                </div>
            </div>
        `;
    };

    window.openTutoringSchedulePrintModal = function () {
        const modal = document.getElementById('tutoringSchedulePrintModal');
        const container = document.getElementById('tutoringPrintScheduleContainer');
        if (!modal || !container) return;

        container.innerHTML = window.buildWeeklySchedulePrintHtml();
        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringSchedulePrintModal = function () {
        const modal = document.getElementById('tutoringSchedulePrintModal');
        if (modal) modal.style.display = 'none';
    };

    window.printWeeklyScheduleNow = function () {
        const content = window.buildWeeklySchedulePrintHtml();
        const fullHtml = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>استعمال_الزمن_الأسبوعي_الرسمي_للدعم</title>
                <style>
                    body { font-family: 'Cairo', Tahoma, sans-serif; margin: 0; color: #000; direction: rtl; }
                </style>
            </head>
            <body>
                ${content}
            </body>
            </html>
        `;
        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(fullHtml, {
                title: 'استعمال_الزمن_الأسبوعي_لحصص_الدعم',
                orientation: 'landscape',
                subtitle: 'جدول الحصص الأسبوعي الرسمي لمجموعات الدعم التربوي والتقوية (A4 Landscape)'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(fullHtml, 'استعمال_الزمن_الأسبوعي_لحصص_الدعم', 'landscape');
        }
    };

    // WhatsApp Broadcast Formatter
    window.copyTutoringWeeklyScheduleWhatsApp = function () {
        const days = [
            { id: 1, name: 'الإثنين' },
            { id: 2, name: 'الثلاثاء' },
            { id: 3, name: 'الأربعاء' },
            { id: 4, name: 'الخميس' },
            { id: 5, name: 'الجمعة' },
            { id: 6, name: 'السبت' },
            { id: 0, name: 'الأحد' }
        ];

        const slots = db.tutoring.scheduleSlots || [];
        if (slots.length === 0) {
            alert('لا توجد حصص مبرمجة في الجدول لنسخها.');
            return;
        }

        let message = `📅 *استعمال الزمن الأسبوعي لحصص الدعم والتقوية* 📚\n\n`;

        days.forEach(d => {
            const daySlots = slots.filter(s => parseInt(s.day, 10) === d.id);
            if (daySlots.length > 0) {
                daySlots.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
                message += `🔹 *يوم ${d.name}:*\n`;
                daySlots.forEach(s => {
                    const isIndiv = s.slotType === 'individual' || Boolean(s.studentId);
                    if (isIndiv) {
                        message += `  ▫️ 👤 *دعم فردي: ${s.studentName || s.group}* ⭐ | من ${s.startTime} إلى ${s.endTime}${s.deliveryMode ? ` (${s.deliveryMode})` : (s.room ? ` (${s.room})` : '')}\n`;
                        if (s.pedagogicalFocus) message += `     🎯 _الهدف البيداغوجي: ${s.pedagogicalFocus}_\n`;
                    } else {
                        message += `  ▫️ 👥 *${s.group}* | من ${s.startTime} إلى ${s.endTime}${s.room ? ` (${s.room})` : ''}\n`;
                    }
                    if (s.notes) message += `     _ملاحظة: ${s.notes}_\n`;
                });
                message += `\n`;
            }
        });

        message += `📍 *ملاحظة هامة:* يرجى الحضور قبل الموعد بـ 5 دقائق. بالتوفيق للجميع! ✨`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(message).then(() => {
                if (typeof showToast === 'function') {
                    showToast('تم نسخ جدول الحصص الأسبوعي بنجاح بصيغة واتساب!', 'success');
                } else {
                    alert('تم نسخ جدول الحصص بنجاح! يمكنك لصقه الآن في مجموعات واتساب.');
                }
            }).catch(() => {
                prompt('انسخ نص الجدول لمشاركته في واتساب:', message);
            });
        } else {
            prompt('انسخ نص الجدول لمشاركته في واتساب:', message);
        }
    };

    // =========================================================================
    // 5. GROUPS HUB & MANAGEMENT (SUB-TAB 3)
    // =========================================================================
    window.renderTutoringGroupsHub = function () {
        const container = document.getElementById('tutoringGroupsContainer') || document.getElementById('tutoringGroupsGrid');
        if (!container) return;

        if (!db.tutoring.groups) db.tutoring.groups = [];

        // Discover all groups from both db.tutoring.groups and student tags
        const groupMap = new Map();

        // 1. Defined groups
        db.tutoring.groups.forEach(g => {
            if (g.name) {
                groupMap.set(g.name, {
                    id: g.id || 'grp_' + g.name,
                    name: g.name,
                    level: g.level || '',
                    defaultFee: g.defaultFee || 100,
                    notes: g.notes || ''
                });
            }
        });

        // 2. Discover from students
        (db.tutoring.students || []).forEach(s => {
            if (s.group && !groupMap.has(s.group)) {
                groupMap.set(s.group, {
                    id: 'grp_discovered_' + s.group,
                    name: s.group,
                    level: s.level || '',
                    defaultFee: s.fee || 100,
                    notes: 'مجموعة مستكشفة من سجل التلاميذ'
                });
            }
        });

        const monthInput = document.getElementById('tutoringMonth');
        const month = monthInput ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));

        const groupsList = Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

        if (groupsList.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; color: #64748b;">
                    <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 8px;">لا توجد أي مجموعة دعم منشأة بعد</div>
                    <p style="font-size: 0.85rem; margin-bottom: 16px;">قم بإضافة مجموعة دعم جديدة لتنظيم حصص التلاميذ ومتابعة الأداء واستخراج الكشوفات المجمعة.</p>
                    <button type="button" class="btn-primary" onclick="openTutoringGroupManageModal()" style="display: inline-flex; align-items: center; gap: 6px;">
                        إضافة أول مجموعة دعم
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        groupsList.forEach(grp => {
            const stds = (db.tutoring.students || []).filter(s => s.group === grp.name);
            let totalMonthHours = 0;
            let totalMonthDue = 0;
            let totalMonthPaid = 0;
            let totalSessionsCount = 0;
            let attendedCount = 0;

            stds.forEach(s => {
                const sessions = (s.sessions || []).filter(ss => ss.date && ss.date.startsWith(month));
                totalSessionsCount += sessions.length;
                let sHours = 0;
                sessions.forEach(ss => {
                    if (ss.attendance !== 'absent') {
                        const h = parseFloat(ss.hours) || 0;
                        sHours += h;
                        totalMonthHours += h;
                        attendedCount++;
                    }
                });
                const rate = parseFloat(s.fee) || grp.defaultFee || 0;
                const fallbackDue = sHours * rate;
                const pay = window.getTutoringPaymentInfo(s, month, fallbackDue);
                totalMonthDue += pay.totalDue;
                totalMonthPaid += pay.paidAmount;
            });

            const collectionPercent = totalMonthDue > 0 ? Math.round((totalMonthPaid / totalMonthDue) * 100) : 100;
            const attendanceRate = totalSessionsCount > 0 ? Math.round((attendedCount / totalSessionsCount) * 100) : 100;

            html += `
                <div style="background: #fff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 44px; height: 44px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 900;">
                                    ${grp.name.charAt(0)}
                                </div>
                                <div>
                                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">${grp.name}</h4>
                                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                                        ${grp.level || 'مجموعة مستقلة'} • واجب الساعة: <b>${grp.defaultFee} د.م</b>${grp.room ? ` • 📍 ${grp.room}` : ''}
                                    </div>
                                </div>
                            </div>
                            <button type="button" onclick="openTutoringGroupManageModal('${grp.name}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;" title="إدارة المجموعة">
                                ⚙️
                            </button>
                        </div>

                        <!-- Stats Row -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; text-align: center;">
                            <div style="background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <div style="font-size: 0.7rem; color: #64748b;">التلاميذ</div>
                                <div style="font-size: 1.1rem; font-weight: 900; color: #2563eb;">${stds.length}</div>
                            </div>
                            <div style="background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <div style="font-size: 0.7rem; color: #64748b;">ساعات ${month}</div>
                                <div style="font-size: 1.1rem; font-weight: 900; color: #059669;">${totalMonthHours} س</div>
                            </div>
                            <div style="background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <div style="font-size: 0.7rem; color: #64748b;">نسبة الاستخلاص</div>
                                <div style="font-size: 1.1rem; font-weight: 900; color: ${collectionPercent >= 80 ? '#16a34a' : '#d97706'};">${collectionPercent}%</div>
                            </div>
                        </div>

                        <!-- Progress Bar -->
                        <div style="margin-bottom: 14px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 4px; color: #475569;">
                                <span>المؤدى: <b>${totalMonthPaid} د.م</b></span>
                                <span>المستحق: <b>${totalMonthDue} د.م</b></span>
                            </div>
                            <div style="background: #e2e8f0; border-radius: 999px; height: 6px; overflow: hidden;">
                                <div style="width: ${collectionPercent}%; height: 100%; background: ${collectionPercent === 100 ? '#10b981' : '#3b82f6'};"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px dashed #e2e8f0;">
                        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 6px;">
                            <button type="button" onclick="openTutoringGroupBatchPerformanceReportModal('${grp.name.replace(/'/g, "\\'")}')" style="background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; border: none; padding: 8px 10px; border-radius: 8px; font-weight: bold; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" title="تصدير كشف أداء شهري مجمع لجميع تلاميذ هذه المجموعة في ملف PDF واحد">
                                📄 كشف الأداء (PDF)
                            </button>
                            <button type="button" onclick="openGroupSeriesTrackerModal('${grp.name.replace(/'/g, "\\'")}')" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 8px 10px; border-radius: 8px; font-weight: bold; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;" title="تتبع السلاسل والتمارين والفروض التجريبية المنجزة مع هذه المجموعة">
                                📚 السلاسل (${((db.tutoring.groupSeries && db.tutoring.groupSeries[grp.name]) || []).length})
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            <button type="button" onclick="if(typeof openTutoringGroupSessionModal==='function') openTutoringGroupSessionModal('${grp.name.replace(/'/g, "\\'")}');" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 7px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                ⚡ تسجيل حصة
                            </button>
                            <button type="button" onclick="window.filterStudentsByGroup('${grp.name.replace(/'/g, "\\'")}')" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 7px; border-radius: 6px; font-size: 0.78rem; font-weight: bold; cursor: pointer;">
                                👥 عرض التلاميذ
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.filterStudentsByGroup = function (groupName) {
        window.showTutoringSubTab('students');
        const filterSelect = document.getElementById('tutoringGroupFilter');
        if (filterSelect) {
            filterSelect.value = groupName;
            if (typeof window.renderTutoringStudents === 'function') {
                window.renderTutoringStudents();
            }
        }
    };

    window.openTutoringGroupManageModal = function (groupName) {
        const modal = document.getElementById('tutoringGroupManageModal');
        if (!modal) return;

        const origNameInput = document.getElementById('groupManageOriginalName');
        const nameInput = document.getElementById('groupManageName');
        const levelSelect = document.getElementById('groupManageLevel');
        const feeInput = document.getElementById('groupManageDefaultFee');
        const roomInput = document.getElementById('groupManageRoom');
        const notesInput = document.getElementById('groupManageNotes');
        const rosterInput = document.getElementById('groupManageRosterText');
        const titleEl = document.getElementById('groupManageModalTitle');

        if (!db.tutoring.groups) db.tutoring.groups = [];

        if (groupName) {
            const grp = db.tutoring.groups.find(g => g.name === groupName) || { name: groupName, level: '', defaultFee: 100, notes: '', room: '' };
            if (origNameInput) origNameInput.value = grp.name;
            if (nameInput) nameInput.value = grp.name;
            if (levelSelect) levelSelect.value = grp.level || '';
            if (feeInput) feeInput.value = grp.defaultFee || 100;
            if (roomInput) roomInput.value = grp.room || '';
            if (notesInput) notesInput.value = grp.notes || '';
            if (rosterInput) rosterInput.value = '';
            if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #0284c7;"><span data-lucide="edit-3" data-size="20"></span></span> تعديل مجموعة دعم مستقلة: ${grp.name}`;
        } else {
            if (origNameInput) origNameInput.value = '';
            if (nameInput) nameInput.value = '';
            if (levelSelect) levelSelect.value = '';
            if (feeInput) feeInput.value = 100;
            if (roomInput) roomInput.value = '';
            if (notesInput) notesInput.value = '';
            if (rosterInput) rosterInput.value = '';
            if (titleEl) titleEl.innerHTML = `<span class="ui-icon" style="color: #0284c7;"><span data-lucide="school" data-size="20"></span></span> إنشاء مجموعة دعم جديدة (مستقلة)`;
        }

        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringGroupManageModal = function () {
        const modal = document.getElementById('tutoringGroupManageModal');
        if (modal) modal.style.display = 'none';
    };

    let _isSavingTutoringGroup = false;
    window.saveTutoringGroupManage = function () {
        if (_isSavingTutoringGroup) return;
        _isSavingTutoringGroup = true;
        const unlock = () => { setTimeout(() => { _isSavingTutoringGroup = false; }, 450); };

        const origNameInput = document.getElementById('groupManageOriginalName');
        const nameInput = document.getElementById('groupManageName');
        const levelSelect = document.getElementById('groupManageLevel');
        const feeInput = document.getElementById('groupManageDefaultFee');
        const roomInput = document.getElementById('groupManageRoom');
        const notesInput = document.getElementById('groupManageNotes');
        const rosterInput = document.getElementById('groupManageRosterText');

        const newName = nameInput ? nameInput.value.trim() : '';
        const origName = origNameInput ? origNameInput.value.trim() : '';
        if (!newName) {
            alert('يرجى كتابة اسم المجموعة.');
            unlock();
            return;
        }

        if (!db.tutoring.groups) db.tutoring.groups = [];

        const groupData = {
            id: 'grp_' + Date.now(),
            name: newName,
            level: levelSelect ? levelSelect.value : '',
            defaultFee: feeInput ? parseFloat(feeInput.value) || 100 : 100,
            room: roomInput ? roomInput.value.trim() : '',
            notes: notesInput ? notesInput.value.trim() : ''
        };

        if (origName) {
            // Update existing
            const idx = db.tutoring.groups.findIndex(g => g.name === origName);
            if (idx >= 0) {
                db.tutoring.groups[idx] = Object.assign(db.tutoring.groups[idx], groupData);
            } else {
                db.tutoring.groups.push(groupData);
            }

            // Rename in students if changed
            if (origName !== newName) {
                (db.tutoring.students || []).forEach(std => {
                    if (std.group === origName) {
                        std.group = newName;
                    }
                });
                // Rename in slots
                (db.tutoring.scheduleSlots || []).forEach(slot => {
                    if (slot.group === origName) {
                        slot.group = newName;
                    }
                });
            }
        } else {
            db.tutoring.groups.push(groupData);
        }

        // Process fast independent roster import if text provided
        const rosterText = rosterInput ? rosterInput.value.trim() : '';
        let addedStudentsCount = 0;
        if (rosterText) {
            if (!db.tutoring.students) db.tutoring.students = [];
            const lines = rosterText.split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                let sName = '';
                let sPhone = '';
                if (trimmed.includes(',')) {
                    const parts = trimmed.split(',');
                    sName = parts[0].trim();
                    sPhone = parts.slice(1).join(',').trim();
                } else if (trimmed.includes(' - ')) {
                    const parts = trimmed.split(' - ');
                    sName = parts[0].trim();
                    sPhone = parts[1].trim();
                } else if (trimmed.includes(';')) {
                    const parts = trimmed.split(';');
                    sName = parts[0].trim();
                    sPhone = parts[1].trim();
                } else {
                    sName = trimmed;
                }

                if (sName) {
                    // Check if already in tutoring
                    let existing = db.tutoring.students.find(s => (s.name || '').trim().toLowerCase() === sName.toLowerCase());
                    if (existing) {
                        existing.group = newName;
                        if (sPhone && !existing.phone) existing.phone = sPhone;
                        if (!existing.fee) existing.fee = groupData.defaultFee;
                    } else {
                        db.tutoring.students.push({
                            id: 'tstd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                            name: sName,
                            phone: sPhone,
                            group: newName,
                            level: groupData.level,
                            fee: groupData.defaultFee,
                            sessions: [],
                            payments: {}
                        });
                        addedStudentsCount++;
                    }
                }
            });
        }

        if (typeof saveDB === 'function') saveDB();
        window.closeTutoringGroupManageModal();
        window.renderTutoringGroupsHub();
        if (typeof renderTutoringStudents === 'function') renderTutoringStudents();

        if (typeof showToast === 'function') {
            const msg = addedStudentsCount > 0 
                ? `تم حفظ المجموعة بنجاح وإضافة ${addedStudentsCount} تلميذ إليها!` 
                : 'تم حفظ بيانات المجموعة المستقلة بنجاح!';
            showToast(msg, 'success');
        }
        unlock();
    };

    // =========================================================================
    // 6. ANALYTICS & KPIS HUB (SUB-TAB 4)
    // =========================================================================
    window.renderTutoringAnalytics = function () {
        const container = document.getElementById('tutPaneAnalytics') || document.getElementById('tutoringAnalyticsContent') || document.getElementById('tutoringAnalyticsPane');
        if (!container) return;

        const monthInput = document.getElementById('tutoringMonth');
        const month = monthInput ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));

        const students = db.tutoring.students || [];
        let grandRevenue = 0;
        let grandCollected = 0;
        let grandRemaining = 0;
        let totalSessionsCount = 0;
        let totalAttendedCount = 0;
        let totalAbsentCount = 0;
        let totalMonthHoursAll = 0;

        const unpaidStudentsList = [];

        students.forEach(s => {
            const sessions = (s.sessions || []).filter(ss => ss.date && ss.date.startsWith(month));
            let sHours = 0;
            sessions.forEach(ss => {
                totalSessionsCount++;
                if (ss.attendance === 'absent') {
                    totalAbsentCount++;
                } else {
                    totalAttendedCount++;
                    sHours += (parseFloat(ss.hours) || 0);
                }
            });
            totalMonthHoursAll += sHours;

            const pay = window.getTutoringPaymentInfo(s, month);
            const due = pay.totalDue;
            grandRevenue += due;
            grandCollected += pay.paidAmount;
            grandRemaining += pay.remaining;

            if (pay.remaining > 0) {
                unpaidStudentsList.push({ student: s, pay: pay, hours: sHours });
            }
        });

        // Compute All-Time Revenue Stats
        let allTimeCollected = 0;
        let allTimeDue = 0;
        const allMonthsMap = {};

        students.forEach(s => {
            const sessionsByMonth = {};
            (s.sessions || []).forEach(ss => {
                if (ss.date && ss.date.length >= 7) {
                    const mKey = ss.date.slice(0, 7);
                    if (!sessionsByMonth[mKey]) sessionsByMonth[mKey] = 0;
                    if (ss.attendance !== 'absent') {
                        sessionsByMonth[mKey] += (parseFloat(ss.hours) || 0);
                    }
                }
            });

            const studentMonths = window.getStudentActiveMonthsSet
                ? window.getStudentActiveMonthsSet(s, month)
                : new Set([
                    ...Object.keys(sessionsByMonth),
                    ...Object.keys((s.payments && !Array.isArray(s.payments)) ? s.payments : {}),
                    ...Object.keys(s.paymentRecords || {}),
                    ...(Array.isArray(s.paidMonths) ? s.paidMonths : Object.keys(s.paidMonths || {}).filter(k => s.paidMonths[k]))
                ]);

            studentMonths.forEach(mKey => {
                const hours = sessionsByMonth[mKey] || 0;
                const pay = window.getTutoringPaymentInfo(s, mKey);
                const due = pay.totalDue;
                
                allTimeDue += due;
                allTimeCollected += pay.paidAmount;

                if (!allMonthsMap[mKey]) {
                    allMonthsMap[mKey] = { due: 0, collected: 0, remaining: 0, hours: 0, studentsCount: 0 };
                }
                allMonthsMap[mKey].due += due;
                allMonthsMap[mKey].collected += pay.paidAmount;
                allMonthsMap[mKey].remaining += pay.remaining;
                allMonthsMap[mKey].hours += hours;
                if (hours > 0 || due > 0 || pay.paidAmount > 0) {
                    allMonthsMap[mKey].studentsCount++;
                }
            });
        });

        grandRevenue = Math.round(grandRevenue * 100) / 100;
        grandCollected = Math.round(grandCollected * 100) / 100;
        grandRemaining = Math.round(grandRemaining * 100) / 100;
        allTimeDue = Math.round(allTimeDue * 100) / 100;
        allTimeCollected = Math.round(allTimeCollected * 100) / 100;

        const allExpGlobal = (db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses : [];
        const allTimeExpensesTotal = Math.round(allExpGlobal.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
        const allTimeNetProfit = Math.round((allTimeCollected - allTimeExpensesTotal) * 100) / 100;

        const allTimeRemaining = Math.max(0, Math.round((allTimeDue - allTimeCollected) * 100) / 100);
        const allTimeCollectionRate = allTimeDue > 0 ? Math.round((allTimeCollected / allTimeDue) * 100) : 100;
        const collectionRate = grandRevenue > 0 ? Math.round((grandCollected / grandRevenue) * 100) : 100;
        const attendanceRate = totalSessionsCount > 0 ? Math.round((totalAttendedCount / totalSessionsCount) * 100) : 100;

        // Sorted months desc
        const sortedMonths = Object.keys(allMonthsMap).sort().reverse();

        // Sort unpaid students by remaining desc
        unpaidStudentsList.sort((a, b) => b.pay.remaining - a.pay.remaining);

        container.innerHTML = `
            <!-- Lifetime Overall Revenue Banner -->
            <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); border-radius: 14px; padding: 22px; color: #fff; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.35); position: relative; overflow: hidden;">
                <div style="position: absolute; left: -20px; bottom: -20px; opacity: 0.1; font-size: 10rem; pointer-events: none; font-weight: 900; line-height: 1;">💰</div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; position: relative; z-index: 1;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255,255,255,0.3); padding: 3px 10px; border-radius: 20px; font-size: 0.76rem; font-weight: bold;">
                                ✦ السجل المالي التراكمي الشامل
                            </span>
                            <span style="font-size: 0.8rem; color: #d1fae5;">كافة مواسم وأشهر الدعم</span>
                        </div>
                        <h2 style="margin: 0; font-size: 1.55rem; font-weight: 900; letter-spacing: -0.5px;">
                            المجموع الكلي لمداخيل الدعم الخصوصي والربح الصافي
                        </h2>
                    </div>
                    <button type="button" onclick="openTutoringAllTimeRevenueModal()" style="background: #ffffff; color: #064e3b; border: none; font-weight: 800; font-size: 0.86rem; padding: 9px 18px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                        <span>فتح السجل المالي المفصل</span>
                        <span data-lucide="arrow-left" data-size="16"></span>
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-top: 18px; position: relative; z-index: 1;">
                    <div style="background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 0.76rem; color: #d1fae5; font-weight: bold;">المجموع الكلي المستخلص</div>
                        <div style="font-size: 1.55rem; font-weight: 900; margin-top: 2px;">${allTimeCollected} <span style="font-size: 0.85rem; font-weight: bold; color: #a7f3d0;">درهم</span></div>
                        <div style="font-size: 0.72rem; color: #d1fae5; margin-top: 3px;">نسبة التحصيل الإجمالية: ${allTimeCollectionRate}%</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(8px); border: 1.5px solid rgba(167, 243, 208, 0.55); border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 0.76rem; color: #ecfdf5; font-weight: 800;">💎 الربح الصافي التراكمي</div>
                        <div style="font-size: 1.55rem; font-weight: 900; margin-top: 2px; color: ${allTimeNetProfit >= 0 ? '#ffffff' : '#fecaca'};">${allTimeNetProfit} <span style="font-size: 0.85rem; font-weight: bold; color: #a7f3d0;">درهم</span></div>
                        <div style="font-size: 0.72rem; color: #d1fae5; margin-top: 3px;">بعد خصم المصاريف (${allTimeExpensesTotal} د.م)</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 0.76rem; color: #d1fae5; font-weight: bold;">إجمالي المستحقات التاريخية</div>
                        <div style="font-size: 1.55rem; font-weight: 900; margin-top: 2px;">${allTimeDue} <span style="font-size: 0.85rem; font-weight: bold; color: #a7f3d0;">درهم</span></div>
                        <div style="font-size: 0.72rem; color: #d1fae5; margin-top: 3px;">مجموع كل الساعات والباقات</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 0.76rem; color: #fed7aa; font-weight: bold;">المتبقي التاريخي غير المستخلص</div>
                        <div style="font-size: 1.55rem; font-weight: 900; margin-top: 2px; color: ${allTimeRemaining > 0 ? '#fecaca' : '#fff'};">${allTimeRemaining} <span style="font-size: 0.85rem; font-weight: bold; color: #fed7aa;">درهم</span></div>
                        <div style="font-size: 0.72rem; color: #fed7aa; margin-top: 3px;">${allTimeRemaining === 0 ? '✓ كل الحسابات مسواة' : 'بذمة متأخرين'}</div>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 12px 16px;">
                        <div style="font-size: 0.76rem; color: #d1fae5; font-weight: bold;">الأشهر النشطة في النظام</div>
                        <div style="font-size: 1.55rem; font-weight: 900; margin-top: 2px;">${sortedMonths.length} <span style="font-size: 0.85rem; font-weight: bold; color: #a7f3d0;">شهر</span></div>
                        <div style="font-size: 0.72rem; color: #d1fae5; margin-top: 3px;">${sortedMonths.length > 0 ? `من ${sortedMonths[sortedMonths.length - 1]} إلى ${sortedMonths[0]}` : 'لا توجد سجلات'}</div>
                    </div>
                </div>
            </div>

            <!-- Current Month Focus KPIs -->
            <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 8px;">
                    <span data-lucide="calendar" data-size="18" style="color: #2563eb;"></span>
                    <span>مؤشرات وإحصائيات شهر (${month})</span>
                </h3>
                <span style="font-size: 0.8rem; color: #64748b; font-weight: bold;">تتغير ديناميكياً مع اختيار الشهر</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 18px;">
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">إجمالي المداخيل المستحقة</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #0f172a;">${grandRevenue} <span style="font-size: 0.9rem; font-weight: bold; color: #64748b;">د.م</span></div>
                    <div style="font-size: 0.75rem; color: #16a34a; margin-top: 4px;">شهر ${month} (${totalMonthHoursAll} س)</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">المبالغ المحصلة والمستخلصة</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #16a34a;">${grandCollected} <span style="font-size: 0.9rem; font-weight: bold; color: #64748b;">د.م</span></div>
                    <div style="font-size: 0.75rem; color: #16a34a; margin-top: 4px;">نسبة التحصيل: ${collectionRate}%</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">المبالغ المتبقية غير المستخلصة</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #dc2626;">${grandRemaining} <span style="font-size: 0.9rem; font-weight: bold; color: #64748b;">د.م</span></div>
                    <div style="font-size: 0.75rem; color: #dc2626; margin-top: 4px;">${unpaidStudentsList.length} تلميذ بذمتهم مستحقات</div>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
                    <div style="font-size: 0.8rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">المواظبة العامة والانضباط</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: #2563eb;">${attendanceRate}%</div>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">${totalAttendedCount} حضور / ${totalAbsentCount} غياب</div>
                </div>
            </div>

            <!-- Axis 4: Net Profit, Expenses & Hourly Yield Card -->
            ${(() => {
                const allExp = (db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses : [];
                const monthExpList = allExp.filter(e => e.month === month);
                const monthExpensesTotal = Math.round(monthExpList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
                const netProfitMonth = Math.round((grandCollected - monthExpensesTotal) * 100) / 100;
                const expectedNetProfitMonth = Math.round((grandRevenue - monthExpensesTotal) * 100) / 100;
                const avgHourlyYield = totalMonthHoursAll > 0 ? Math.round((netProfitMonth / totalMonthHoursAll) * 10) / 10 : 0;
                return `
                <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%); border: 1.5px solid #99f6e4; border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                        <div style="background: #0f766e; color: #fff; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: bold;">💎</div>
                        <div>
                            <div style="font-size: 0.8rem; color: #0f766e; font-weight: 800;">المحاسبة الصافية لشهر (${month}) بعد خصم مصاريف الدعم (المعادلة: الربح الصافي = المحصل - المصاريف)</div>
                            <div style="display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; margin-top: 4px;">
                                <div><span style="font-size: 0.78rem; color: #475569;">الربح الصافي المحصل فعلياً:</span> <strong style="font-size: 1.25rem; color: ${netProfitMonth >= 0 ? '#047857' : '#dc2626'}; font-weight: 900;">${netProfitMonth} د.م</strong></div>
                                <div><span style="font-size: 0.78rem; color: #475569;">الربح الصافي المتوقع بعد التحصيل:</span> <strong style="font-size: 1.05rem; color: #0f766e; font-weight: 800;">${expectedNetProfitMonth} د.م</strong></div>
                                <div><span style="font-size: 0.78rem; color: #475569;">مصاريف الشهر (${monthExpList.length}):</span> <strong style="font-size: 1rem; color: #b45309;">${monthExpensesTotal} د.م</strong></div>
                                <div><span style="font-size: 0.78rem; color: #475569;">صافي مردودية الساعة:</span> <strong style="font-size: 1rem; color: #1d4ed8;">${avgHourlyYield} د.م / س</strong></div>
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="openTutoringExpensesModal('${month}')" style="background: #0f766e; color: #fff; border: none; padding: 9px 16px; border-radius: 10px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(15,118,110,0.25);">
                        💸 إدارة مصاريف الدعم (${monthExpList.length})
                    </button>
                </div>
                `;
            })()}

            <!-- Interactive Financial & Collection Analytics Section -->
            <div style="background: #fff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.05); margin-bottom: 22px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: #ecfdf5; color: #059669;">
                                <span data-lucide="trending-up" data-size="18"></span>
                            </span>
                            <span>التطور التراكمي للمداخيل ونسب تحصيل المستحقات على مدار السنة الدراسية</span>
                        </h3>
                        <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: #64748b;">
                            رسوم بيانية تفاعلية متقدمة لرصد التدفق المالي التراكمي ونسب الاستخلاص الشهرية والسنوية
                        </p>
                    </div>

                    <!-- Interactive Mode Switcher & Export Tools -->
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <button type="button" id="btnTutAnalyticsCumul" class="tutoring-chart-mode-btn active" onclick="switchTutoringAnalyticsView('cumulative')" title="عرض المنحنى التراكمي">
                            <span data-lucide="line-chart" data-size="14"></span>
                            <span>التطور التراكمي</span>
                        </button>
                        <button type="button" id="btnTutAnalyticsRate" class="tutoring-chart-mode-btn" onclick="switchTutoringAnalyticsView('rate')" title="عرض نسب التحصيل الشهرية والسنوية">
                            <span data-lucide="percent" data-size="14"></span>
                            <span>نسب التحصيل (%)</span>
                        </button>
                        <button type="button" id="btnTutAnalyticsMonthly" class="tutoring-chart-mode-btn" onclick="switchTutoringAnalyticsView('monthly')" title="عرض مقارنة المداخيل الشهرية">
                            <span data-lucide="bar-chart-2" data-size="14"></span>
                            <span>المقارنة الشهرية</span>
                        </button>
                        <button type="button" id="btnTutAnalyticsAll" class="tutoring-chart-mode-btn" onclick="switchTutoringAnalyticsView('all')" title="عرض كافة المخططات">
                            <span data-lucide="layout-grid" data-size="14"></span>
                            <span>الكل</span>
                        </button>
                        <button type="button" class="btn-secondary" onclick="downloadActiveTutoringChart()" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px; border-radius: 8px;" title="تصدير المخطط البياني النشط كصورة">
                            <span data-lucide="download" data-size="14"></span>
                            <span>تصدير (PNG)</span>
                        </button>
                    </div>
                </div>

                <!-- 1. Cumulative Revenue Progression Chart Card -->
                <div id="tutoringCumulativeSection" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">منحنى التطور التراكمي للمداخيل والمستحقات (د.م)</span>
                            <span style="font-size: 0.74rem; background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; font-weight: 700;">التراكم السنوي</span>
                        </div>
                        <div id="tutoringCumulativeStatsBadge" style="display: flex; align-items: center; gap: 10px; font-size: 0.78rem; font-weight: bold;">
                            <span style="color: #059669; background: #ecfdf5; padding: 3px 10px; border-radius: 6px; border: 1px solid #a7f3d0;">
                                المستخلص التراكمي: ${allTimeCollected} د.م
                            </span>
                            <span style="color: #2563eb; background: #eff6ff; padding: 3px 10px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                المستحق التراكمي: ${allTimeDue} د.م
                            </span>
                            <span style="color: ${allTimeRemaining > 0 ? '#dc2626' : '#16a34a'}; background: ${allTimeRemaining > 0 ? '#fff1f2' : '#f0fdf4'}; padding: 3px 10px; border-radius: 6px; border: 1px solid ${allTimeRemaining > 0 ? '#fecdd3' : '#bbf7d0'};">
                                المتبقي غير المحصل: ${allTimeRemaining} د.م
                            </span>
                        </div>
                    </div>
                    <div style="position: relative; height: 280px; width: 100%;">
                        <canvas id="tutoringCumulativeRevenueChart"></canvas>
                    </div>
                </div>

                <!-- 2. Collection Rate Trend Across The Academic Year Chart Card -->
                <div id="tutoringRateSection" style="margin-bottom: 20px; display: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">نسب تحصيل المستحقات على مدار السنة الدراسية (%)</span>
                            <span style="font-size: 0.74rem; background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 999px; font-weight: 700;">المؤشر المستهدف: 80%</span>
                        </div>
                        <div id="tutoringRateStatsBadge" style="display: flex; align-items: center; gap: 10px; font-size: 0.78rem; font-weight: bold;">
                            <span style="color: #6d28d9; background: #f5f3ff; padding: 3px 10px; border-radius: 6px; border: 1px solid #ddd6fe;">
                                النسبة العامة التراكمية: ${allTimeCollectionRate}%
                            </span>
                        </div>
                    </div>
                    <div style="position: relative; height: 260px; width: 100%;">
                        <canvas id="tutoringCollectionRateTrendChart"></canvas>
                    </div>
                </div>

                <!-- 3. Monthly Breakdown & Groups Distribution Grid -->
                <div id="tutoringMonthlySection" style="display: none; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
                    <!-- Monthly Bar Chart -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; font-size: 0.92rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                                <span style="color: #059669;">📊</span> المقارنة الشهرية للمداخيل (د.م)
                            </h4>
                            <span style="font-size: 0.72rem; color: #64748b;">حسب الأشهر</span>
                        </div>
                        <div style="position: relative; height: 230px; width: 100%;">
                            <canvas id="tutoringRevenueMonthlyChart"></canvas>
                        </div>
                    </div>

                    <!-- Groups Distribution Chart -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; font-size: 0.92rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                                <span style="color: #6366f1;">🎯</span> توزيع الساعات والتلاميذ حسب المجموعات
                            </h4>
                            <span style="font-size: 0.72rem; color: #64748b;">شهر ${month}</span>
                        </div>
                        <div style="position: relative; height: 230px; width: 100%;">
                            <canvas id="tutoringGroupDistChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Monthly Financial Breakdown History Table -->
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04); margin-bottom: 22px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #059669;">📊</span> جدول تطور المداخيل حسب الأشهر
                        </h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">مقارنة الأداء المالي، حجم الساعات، ونسبة الاستخلاص شهراً بشهر</p>
                    </div>
                </div>

                ${sortedMonths.length === 0 ? `
                    <div style="text-align: center; padding: 30px; color: #64748b;">
                        لا توجد سجلات حصص أو دفعات مسجلة حتى الآن.
                    </div>
                ` : `
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right;">
                                    <th style="padding: 10px;">الشهر</th>
                                    <th style="padding: 10px;">التلاميذ النشطون</th>
                                    <th style="padding: 10px;">إجمالي الساعات</th>
                                    <th style="padding: 10px;">المستحقات الكلية</th>
                                    <th style="padding: 10px;">المبالغ المستخلصة</th>
                                    <th style="padding: 10px;">المتبقي غير المحصل</th>
                                    <th style="padding: 10px;">نسبة التحصيل</th>
                                    <th style="padding: 10px; text-align: center;">إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedMonths.map(mKey => {
                                    const mData = allMonthsMap[mKey];
                                    const mRate = mData.due > 0 ? Math.round((mData.collected / mData.due) * 100) : 100;
                                    const isCurrentViewed = mKey === month;
                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9; ${isCurrentViewed ? 'background: #eff6ff; font-weight: bold;' : ''}">
                                            <td style="padding: 10px; font-weight: 800; color: #0f172a;">
                                                ${mKey} ${isCurrentViewed ? '<span style="background: #2563eb; color: #fff; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">المعروض حالياً</span>' : ''}
                                            </td>
                                            <td style="padding: 10px; color: #475569;">${mData.studentsCount} تلميذ</td>
                                            <td style="padding: 10px; color: #1e293b;">${mData.hours} س</td>
                                            <td style="padding: 10px; font-weight: 800; color: #0f172a;">${mData.due} د.م</td>
                                            <td style="padding: 10px; font-weight: 800; color: #16a34a;">${mData.collected} د.م</td>
                                            <td style="padding: 10px; font-weight: 800; color: ${mData.remaining > 0 ? '#dc2626' : '#16a34a'};">${mData.remaining} د.م</td>
                                            <td style="padding: 10px;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <span style="font-weight: bold; color: ${mRate >= 80 ? '#16a34a' : (mRate >= 50 ? '#d97706' : '#dc2626')};">${mRate}%</span>
                                                    <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; min-width: 50px;">
                                                        <div style="width: ${mRate}%; height: 100%; background: ${mRate >= 80 ? '#16a34a' : (mRate >= 50 ? '#f59e0b' : '#dc2626')};"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style="padding: 10px; text-align: center;">
                                                <button type="button" onclick="selectTutoringMonth('${mKey}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer; color: #334155;">
                                                    عرض الشهر ◀
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Urgent Follow Up Section -->
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="color: #dc2626;">⚠️</span> قائمة المتابعة المستعجلة للمستحقات والواجبات (شهر ${month})
                        </h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #64748b;">تلاميذ بحاجة إلى تسوية وضعية الأداء أو إرسال تذكيرات عبر واتساب</p>
                    </div>
                    <button type="button" onclick="if(typeof openTutoringWhatsAppBulkModal==='function') openTutoringWhatsAppBulkModal();" class="btn-primary" style="background: #25D366; font-size: 0.82rem; padding: 7px 14px; display: inline-flex; align-items: center; gap: 6px;">
                        إرسال تذكير للجميع عبر واتساب
                    </button>
                </div>

                ${unpaidStudentsList.length === 0 ? `
                    <div style="text-align: center; padding: 30px; color: #16a34a; font-weight: bold;">
                        ✓ ممتاز! تم استخلاص جميع مستحقات شهر ${month} بالكامل ولا يوجد أي تأخير.
                    </div>
                ` : `
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right;">
                                    <th style="padding: 10px;">التلميذ</th>
                                    <th style="padding: 10px;">المجموعة</th>
                                    <th style="padding: 10px;">ساعات الشهر</th>
                                    <th style="padding: 10px;">المبلغ المستحق</th>
                                    <th style="padding: 10px;">المبلغ المؤدى</th>
                                    <th style="padding: 10px;">المبلغ المتبقي</th>
                                    <th style="padding: 10px; text-align: center;">إجراءات سريعة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unpaidStudentsList.map(item => {
                                    const statusCfg = (typeof window.getTutoringStatusVisualConfig === 'function')
                                        ? window.getTutoringStatusVisualConfig(item.pay.status, item.pay)
                                        : null;
                                    return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 10px; font-weight: bold; color: #1e293b;">
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <a href="javascript:void(0)" onclick="openTutoringStudentProfileModal('${item.student.id}')" style="color: #2563eb; text-decoration: none;">
                                                    ${item.student.name}
                                                </a>
                                                ${statusCfg ? `
                                                    <span class="tutoring-status-tag ${statusCfg.key}" style="display:inline-flex; align-items:center; gap:3px; padding:1px 7px; border-radius:12px; font-size:0.68rem; font-weight:800; background:${statusCfg.bgColor}; color:${statusCfg.color}; border:1px solid ${statusCfg.borderColor};">
                                                        <span class="ui-icon" style="margin:0; color:${statusCfg.accentColor};"><span data-lucide="${statusCfg.icon}" data-size="11"></span></span>
                                                        <span>${statusCfg.label}</span>
                                                    </span>
                                                ` : ''}
                                            </div>
                                        </td>
                                        <td style="padding: 10px; color: #64748b;">${item.student.group || '-'}</td>
                                        <td style="padding: 10px; font-weight: bold;">${item.hours} س</td>
                                        <td style="padding: 10px; font-weight: 800;">${item.pay.totalDue} د.م</td>
                                        <td style="padding: 10px; color: #16a34a; font-weight: bold;">${item.pay.paidAmount} د.م</td>
                                        <td style="padding: 10px; color: #dc2626; font-weight: 900;">${item.pay.remaining} د.م</td>
                                        <td style="padding: 10px; text-align: center;">
                                            <div style="display: flex; gap: 6px; justify-content: center;">
                                                <button type="button" onclick="openTutoringPaymentModal('${item.student.id}', '${month}')" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                                    تسجيل دفعة
                                                </button>
                                                <button type="button" onclick="openTutoringWhatsAppModal('${item.student.id}', 'unpaid')" style="background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                                    واتساب
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
        `;
        setTimeout(() => { 
            if (window.renderLucide) window.renderLucide(); 
            if (typeof initTutoringAnalyticsCharts === 'function') {
                initTutoringAnalyticsCharts(sortedMonths, allMonthsMap, month);
            }
        }, 50);
    };

    window.selectTutoringMonth = function (mKey) {
        const monthInput = document.getElementById('tutoringMonth');
        if (monthInput) {
            monthInput.value = mKey;
            if (typeof window.renderTutoringStudents === 'function') window.renderTutoringStudents();
            if (typeof window.renderTutoringAnalytics === 'function') window.renderTutoringAnalytics();
            if (typeof window.showTutoringSubTab === 'function') window.showTutoringSubTab('students');
        }
    };

    // =========================================================================
    // 7. COMPREHENSIVE STUDENT PROFILE / DOSSIER MODAL
    // =========================================================================
    window.openTutoringStudentProfileModal = function (studentId) {
        window.currentViewingStudentId = studentId;
        const modal = document.getElementById('tutoringStudentProfileModal');
        if (!modal) return;

        const std = (db.tutoring.students || []).find(s => s.id === studentId);
        if (!std) return;

        const monthInput = document.getElementById('tutoringMonth');
        const activeMonth = monthInput ? monthInput.value : (window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7)));

        // Header info
        const avatar = document.getElementById('profileStudentAvatar');
        const nameEl = document.getElementById('profileStudentName');
        const groupBadge = document.getElementById('profileStudentGroupBadge');
        const levelBadge = document.getElementById('profileStudentLevelBadge');
        const phoneText = document.getElementById('profileStudentPhoneText');
        const waBtn = document.getElementById('profileBtnWhatsApp');

        if (avatar) avatar.textContent = (std.name || 'ت').charAt(0);
        if (nameEl) nameEl.textContent = std.name;
        if (groupBadge) groupBadge.textContent = std.group ? `مجموعة: ${std.group}` : 'فردي';
        if (levelBadge) levelBadge.textContent = std.level || 'المستوى العام';
        if (phoneText) phoneText.innerHTML = std.phone ? `📞 ${std.phone}` : 'بدون هاتف';

        if (waBtn) {
            waBtn.onclick = () => {
                if (typeof openTutoringWhatsAppModal === 'function') {
                    openTutoringWhatsAppModal(std.id);
                }
            };
        }

        // Compute Lifetime figures across all payment schemas
        const allSessions = std.sessions || [];
        const allPayments = [];
        const activeStdMonths = window.getStudentActiveMonthsSet ? window.getStudentActiveMonthsSet(std, activeMonth) : new Set([activeMonth]);
        let totalLifetimePaid = 0;

        activeStdMonths.forEach(mKey => {
            const pInfo = window.getTutoringPaymentInfo(std, mKey);
            totalLifetimePaid += pInfo.paidAmount;
            if (Array.isArray(pInfo.history) && pInfo.history.length > 0) {
                pInfo.history.forEach(inst => {
                    allPayments.push({
                        id: inst.id,
                        amount: inst.amount,
                        date: inst.date || mKey,
                        month: inst.month || mKey,
                        note: inst.note || inst.method || 'دفعة مسجلة'
                    });
                });
            } else if (pInfo.paidAmount > 0) {
                allPayments.push({
                    id: 'pay_' + mKey,
                    amount: pInfo.paidAmount,
                    date: mKey,
                    month: mKey,
                    note: pInfo.note || 'تم الأداء'
                });
            }
        });
        totalLifetimePaid = Math.round(totalLifetimePaid * 100) / 100;
        const totalLifetimeHours = allSessions.filter(s => s.attendance !== 'absent').reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);

        const currentMonthPay = window.getTutoringPaymentInfo(std, activeMonth);
        const statusCfg = (typeof window.getTutoringStatusVisualConfig === 'function')
            ? window.getTutoringStatusVisualConfig(currentMonthPay.status, currentMonthPay)
            : null;

        const statusBadge = document.getElementById('profileStudentPaymentStatusBadge');
        if (statusBadge) {
            if (statusCfg) {
                statusBadge.style.display = 'inline-flex';
                statusBadge.style.background = statusCfg.bgColor;
                statusBadge.style.color = statusCfg.color;
                statusBadge.style.border = `1px solid ${statusCfg.borderColor}`;
                statusBadge.innerHTML = `
                    <span class="ui-icon" style="margin:0; color:${statusCfg.accentColor};"><span data-lucide="${statusCfg.icon}" data-size="13"></span></span>
                    <span>شهر ${activeMonth}: <strong>${statusCfg.longLabel}</strong></span>
                `;
            } else {
                statusBadge.style.display = 'none';
            }
        }

        // Body Content
        const bodyEl = document.getElementById('profileModalBody');
        if (bodyEl) {
            bodyEl.innerHTML = `
                <!-- Lifetime KPIs -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 10px; margin-bottom: 14px;">
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: bold;">ساعات الدعم التراكمية</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #2563eb; margin-top: 2px;">${totalLifetimeHours} س</div>
                    </div>
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: bold;">نظام الفوترة المعتمد</div>
                        <div style="font-size: 1.05rem; font-weight: 900; color: #0f172a; margin-top: 4px;">${std.billingMode === 'monthly_fixed' ? `شهري ثابت (${std.monthlyFixedFee || std.fee || 300} د.م)` : (std.billingMode === 'session_pack' ? `باقة ${std.packSessions || 4} حصص (${std.packPrice || 400} د.م)` : `${std.fee || 100} د.م / ساعة`)}</div>
                        ${parseFloat(std.discountPercent) > 0 ? `<div style="font-size:0.7rem; color:#d97706; font-weight:bold;">شامل لتخفيض -${std.discountPercent}%</div>` : ''}
                    </div>
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center;">
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: bold;">إجمالي المؤدى تراكمياً</div>
                        <div style="font-size: 1.3rem; font-weight: 900; color: #16a34a; margin-top: 2px;">${totalLifetimePaid} د.م</div>
                    </div>
                    <div style="background: ${statusCfg ? statusCfg.bgColor : '#fff'}; border: 1.5px solid ${statusCfg ? statusCfg.borderColor : '#e2e8f0'}; border-radius: 10px; padding: 14px; text-align: center;">
                        <div style="font-size: 0.72rem; color: ${statusCfg ? statusCfg.color : '#64748b'}; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 4px;">
                            ${statusCfg ? `<span class="ui-icon" style="margin: 0; color: ${statusCfg.accentColor};"><span data-lucide="${statusCfg.icon}" data-size="13"></span></span>` : ''}
                            <span>وضعية شهر ${activeMonth}</span>
                        </div>
                        <div style="font-size: 1.05rem; font-weight: 900; color: ${statusCfg ? statusCfg.color : (currentMonthPay.status === 'paid' ? '#16a34a' : '#dc2626')}; margin-top: 4px;">
                            ${currentMonthPay.status === 'paid' ? 'مؤدى بالكامل' : (currentMonthPay.status === 'partial' ? `أداء جزئي (متبقي ${currentMonthPay.remaining} د.م)` : `غير مؤدى (مستحق ${currentMonthPay.remaining} د.م)`)}
                        </div>
                    </div>
                </div>

                <!-- Pedagogical ROI & School Exam Readiness Card -->
                ${(() => {
                    const gb = parseFloat(std.gradeBefore);
                    const ga = parseFloat(std.gradeAfter);
                    const hasGrades = !isNaN(gb) || !isNaN(ga);
                    const delta = (!isNaN(gb) && !isNaN(ga)) ? +(ga - gb).toFixed(2) : null;
                    const monthAttendedCount = allSessions.filter(s => s.date && s.date.startsWith(activeMonth) && s.attendance !== 'absent').length;
                    const packSize = parseInt(std.packSessions, 10) || 4;
                    const packRem = std.billingMode === 'session_pack' ? Math.max(0, packSize - monthAttendedCount) : null;
                    return `
                    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.74rem; color: #166534; font-weight: 800;">📈 الأثر البيداغوجي وتطور النقطة</div>
                                <div style="font-size: 0.88rem; font-weight: 900; color: #0f172a; margin-top: 2px;">
                                    ${hasGrades ? `قبل الدعم: <b>${!isNaN(gb) ? gb + '/20' : '-'}</b> ← بعد الدعم: <b style="color:#15803d;">${!isNaN(ga) ? ga + '/20' : '-'}</b> ${delta !== null ? `<span style="background:${delta >= 0 ? '#dcfce7' : '#fee2e2'}; color:${delta >= 0 ? '#166534' : '#991b1b'}; padding:2px 8px; border-radius:99px; font-size:0.75rem; margin-right:6px;">${delta >= 0 ? '+' : ''}${delta} نقطة</span>` : ''}` : '<span style="color:#64748b; font-weight:600; font-size:0.8rem;">لم يتم إدخال نقطتي قبل/بعد الدعم بعد (من زر تعديل البيانات)</span>'}
                                </div>
                            </div>
                            ${std.nextExamDate ? `
                            <div style="border-right: 2px solid #cbd5e1; padding-right: 14px;">
                                <div style="font-size: 0.74rem; color: #b45309; font-weight: 800;">🎯 الفرض المحروس القادم بمؤسسته</div>
                                <div style="font-size: 0.84rem; font-weight: 800; color: #78350f; margin-top: 2px;">📅 ${std.nextExamDate} ${std.nextExamTopic ? `• (${std.nextExamTopic})` : ''}</div>
                            </div>` : ''}
                            ${packRem !== null ? `
                            <div style="border-right: 2px solid #cbd5e1; padding-right: 14px;">
                                <div style="font-size: 0.74rem; color: #1d4ed8; font-weight: 800;">📦 رصيد باقة الحصص (${activeMonth})</div>
                                <div style="font-size: 0.84rem; font-weight: 900; color: ${packRem === 0 ? '#dc2626' : '#1e40af'}; margin-top: 2px;">أنجز ${monthAttendedCount} من ${packSize} حصص (المتبقي: ${packRem})</div>
                            </div>` : ''}
                        </div>
                    </div>`;
                })()}

                <!-- Tabs/Section: Sessions vs Payments -->
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px;">
                    <!-- Sessions list -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">سجل الحصص المنفذة (${allSessions.length})</h4>
                            <button type="button" onclick="openTutoringSessionModal('${std.id}')" style="background: #fef08a; color: #854d0e; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                + حصة جديدة
                            </button>
                        </div>
                        <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                            ${allSessions.length === 0 ? `
                                <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.8rem;">لا توجد حصص مسجلة بعد.</div>
                            ` : allSessions.slice().reverse().map(sess => `
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: bold; color: #0f172a;">${sess.date} • ${sess.topic || sess.title || 'مراجعة'}</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">${sess.hours || 2} ساعات • ${sess.attendance === 'absent' ? 'غائب' : 'حاضر'}</div>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-weight: 800; color: ${sess.attendance === 'absent' ? '#dc2626' : '#16a34a'};">
                                            ${sess.attendance === 'absent' ? 'غائب' : 'حاضر'}
                                        </span>
                                        <button type="button" onclick="openTutoringSessionModal('${std.id}', {id:'${sess.id}', date:'${sess.date}', time:'${sess.time || '18:00'}', hours:${sess.hours || 2}, topic:'${(sess.topic || sess.title || '').replace(/'/g, "\\'")}'})" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; border-radius: 4px; padding: 2px 6px; font-size: 0.72rem; font-weight: bold; cursor: pointer;" title="تعديل الحصة">تعديل</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Payments list -->
                    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #1e293b;">دفعات واستخلاصات (${allPayments.length})</h4>
                            <button type="button" onclick="openTutoringPaymentModal('${std.id}', '${activeMonth}')" style="background: #dcfce7; color: #15803d; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                                + تسجيل دفعة
                            </button>
                        </div>
                        <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
                            ${allPayments.length === 0 ? `
                                <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.8rem;">لا توجد أي دفعة مسجلة بعد.</div>
                            ` : allPayments.slice().reverse().map(pay => `
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: bold; color: #16a34a;">${pay.amount} درهم</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">${pay.date} • شهر: ${pay.month || '-'}</div>
                                    </div>
                                    <div style="font-size: 0.72rem; color: #475569;">${pay.note || 'أداء مباشر'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Footer Actions
        const footerActions = document.getElementById('profileFooterActions');
        if (footerActions) {
            footerActions.innerHTML = `
                <button type="button" onclick="printStudentTutoringQrCard('${std.id}')" class="btn-action" style="background: #fdf4ff; color: #86198f; border: 1px solid #f5d0fe; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;" title="طباعة بطاقة انخراط ذكية للتلميذ مزودة برمز QR">
                    🪪 بطاقة الانخراط (QR)
                </button>
                <button type="button" onclick="sendParentMonthlyReportWhatsApp('${std.id}', '${activeMonth}')" class="btn-action" style="background: #dcfce7; color: #166534; border: 1px solid #86efac; padding: 6px 12px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;" title="إرسال بطاقة التقرير الشهري الشامل (المواظبة + تطور النقطة + الوضعية المالية) لولي الأمر عبر واتساب">
                    📲 تقرير ولي الأمر (واتساب)
                </button>
                <button type="button" onclick="openTutoringStatementModal('${std.id}', '${activeMonth}')" class="btn-action" style="background: #eff6ff; color: #1d4ed8; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
                    كشف حساب شهري PDF
                </button>
                <button type="button" onclick="printTutoringReceipt('${std.id}', '${activeMonth}')" class="btn-action" style="background: #ecfdf5; color: #059669; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
                    طباعة وصل الأداء
                </button>
                <button type="button" onclick="closeTutoringStudentProfileModal(); editTutoringStudent('${std.id}');" class="btn-action" style="background: #f1f5f9; color: #334155; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.8rem;">
                    تعديل البيانات
                </button>
            `;
        }

        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringStudentProfileModal = function () {
        const modal = document.getElementById('tutoringStudentProfileModal');
        if (modal) modal.style.display = 'none';
    };

    // =========================================================================
    // 8. ALL-TIME REVENUE & COMPREHENSIVE FINANCIAL HISTORY MODAL
    // =========================================================================
    window.openTutoringAllTimeRevenueModal = function () {
        const modal = document.getElementById('tutoringAllTimeRevenueModal');
        if (!modal) return;
        window.populateTutoringAllTimeRevenueModal();
        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeTutoringAllTimeRevenueModal = function () {
        const modal = document.getElementById('tutoringAllTimeRevenueModal');
        if (modal) modal.style.display = 'none';
    };

    window.populateTutoringAllTimeRevenueModal = function () {
        const content = document.getElementById('tutoringAllTimeRevenueModalContent');
        if (!content) return;

        const students = db.tutoring.students || [];
        let grandAllTimeCollected = 0;
        let grandAllTimeDue = 0;
        let grandAllTimeHours = 0;
        let totalSessionsCount = 0;
        let totalInstallmentsCount = 0;

        const monthsSummary = {};
        const groupsSummary = {};
        const studentsSummary = [];

        students.forEach(s => {
            const sGroup = s.group || 'غير محدد';
            if (!groupsSummary[sGroup]) {
                groupsSummary[sGroup] = { studentsCount: 0, hours: 0, due: 0, collected: 0, remaining: 0 };
            }
            groupsSummary[sGroup].studentsCount++;

            const rate = parseFloat(s.fee) || 0;
            const sessionsByMonth = {};
            let studentTotalHours = 0;

            (s.sessions || []).forEach(ss => {
                totalSessionsCount++;
                if (ss.date && ss.date.length >= 7) {
                    const mKey = ss.date.slice(0, 7);
                    if (!sessionsByMonth[mKey]) sessionsByMonth[mKey] = 0;
                    if (ss.attendance !== 'absent') {
                        const h = parseFloat(ss.hours) || 0;
                        sessionsByMonth[mKey] += h;
                        studentTotalHours += h;
                        grandAllTimeHours += h;
                    }
                }
            });

            // Gather all relevant months for this student
            const relevantMonths = window.getStudentActiveMonthsSet
                ? window.getStudentActiveMonthsSet(s)
                : new Set([
                    ...Object.keys(sessionsByMonth),
                    ...Object.keys((s.payments && !Array.isArray(s.payments)) ? s.payments : {}),
                    ...Object.keys(s.paymentRecords || {}),
                    ...(Array.isArray(s.paidMonths) ? s.paidMonths : Object.keys(s.paidMonths || {}).filter(k => s.paidMonths[k]))
                ]);

            let studentTotalDue = 0;
            let studentTotalPaid = 0;

            relevantMonths.forEach(mKey => {
                const hours = sessionsByMonth[mKey] || 0;
                const pay = window.getTutoringPaymentInfo(s, mKey);
                const due = pay.totalDue;

                studentTotalDue += due;
                studentTotalPaid += pay.paidAmount;
                grandAllTimeDue += due;
                grandAllTimeCollected += pay.paidAmount;

                if (pay.installments && pay.installments.length > 0) {
                    totalInstallmentsCount += pay.installments.length;
                } else if (pay.paidAmount > 0) {
                    totalInstallmentsCount++;
                }

                // Month stats
                if (!monthsSummary[mKey]) {
                    monthsSummary[mKey] = { due: 0, collected: 0, remaining: 0, hours: 0, activeStudents: 0 };
                }
                monthsSummary[mKey].due += due;
                monthsSummary[mKey].collected += pay.paidAmount;
                monthsSummary[mKey].remaining += pay.remaining;
                monthsSummary[mKey].hours += hours;
                if (hours > 0 || due > 0 || pay.paidAmount > 0) {
                    monthsSummary[mKey].activeStudents++;
                }

                // Group stats
                groupsSummary[sGroup].hours += hours;
                groupsSummary[sGroup].due += due;
                groupsSummary[sGroup].collected += pay.paidAmount;
                groupsSummary[sGroup].remaining += pay.remaining;
            });

            const sRemaining = Math.max(0, Math.round((studentTotalDue - studentTotalPaid) * 100) / 100);
            studentsSummary.push({
                student: s,
                totalHours: studentTotalHours,
                totalDue: Math.round(studentTotalDue * 100) / 100,
                totalPaid: Math.round(studentTotalPaid * 100) / 100,
                remaining: sRemaining,
                rate: rate
            });
        });

        grandAllTimeDue = Math.round(grandAllTimeDue * 100) / 100;
        grandAllTimeCollected = Math.round(grandAllTimeCollected * 100) / 100;
        const grandAllTimeRemaining = Math.max(0, Math.round((grandAllTimeDue - grandAllTimeCollected) * 100) / 100);
        const allExpensesList = (db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses : [];
        const grandAllTimeExpenses = Math.round(allExpensesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
        const grandAllTimeNetProfit = Math.round((grandAllTimeCollected - grandAllTimeExpenses) * 100) / 100;
        const overallCollectionRate = grandAllTimeDue > 0 ? Math.round((grandAllTimeCollected / grandAllTimeDue) * 100) : 100;
        const sortedMonths = Object.keys(monthsSummary).sort().reverse();

        // Sort students: those with remaining balances first, then by total paid
        studentsSummary.sort((a, b) => (b.remaining - a.remaining) || (b.totalPaid - a.totalPaid));

        content.innerHTML = `
            <!-- Top KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 12px; margin-bottom: 20px;">
                <div style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px rgba(5, 150, 105, 0.2);">
                    <div style="font-size: 0.78rem; color: #a7f3d0; font-weight: bold;">المجموع الكلي للمداخيل المحصلة</div>
                    <div style="font-size: 1.65rem; font-weight: 900; margin-top: 4px;">${grandAllTimeCollected} <span style="font-size: 0.9rem; font-weight: bold;">د.م</span></div>
                    <div style="font-size: 0.72rem; color: #d1fae5; margin-top: 4px;">نسبة التحصيل: ${overallCollectionRate}%</div>
                </div>

                <div style="background: #f0fdfa; border: 1.5px solid #5eead4; border-radius: 12px; padding: 16px;">
                    <div style="font-size: 0.78rem; color: #0f766e; font-weight: 800;">💎 الربح الصافي التراكمي</div>
                    <div style="font-size: 1.65rem; font-weight: 900; color: ${grandAllTimeNetProfit >= 0 ? '#047857' : '#dc2626'}; margin-top: 4px;">${grandAllTimeNetProfit} <span style="font-size: 0.9rem; font-weight: bold;">د.م</span></div>
                    <div style="font-size: 0.72rem; color: #0f766e; margin-top: 4px;">المصاريف التراكمية: ${grandAllTimeExpenses} د.م</div>
                </div>

                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px;">
                    <div style="font-size: 0.78rem; color: #475569; font-weight: bold;">إجمالي المستحقات التاريخية</div>
                    <div style="font-size: 1.65rem; font-weight: 900; color: #0f172a; margin-top: 4px;">${grandAllTimeDue} <span style="font-size: 0.9rem; font-weight: bold; color: #64748b;">د.م</span></div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">كافة الحصص منذ البداية</div>
                </div>

                <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 16px;">
                    <div style="font-size: 0.78rem; color: #991b1b; font-weight: bold;">المبالغ المتبقية غير المستخلصة</div>
                    <div style="font-size: 1.65rem; font-weight: 900; color: #b91c1c; margin-top: 4px;">${grandAllTimeRemaining} <span style="font-size: 0.9rem; font-weight: bold;">د.م</span></div>
                    <div style="font-size: 0.72rem; color: #dc2626; margin-top: 4px;">${studentsSummary.filter(s => s.remaining > 0).length} تلاميذ بذمتهم مبالغ</div>
                </div>

                <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 16px;">
                    <div style="font-size: 0.78rem; color: #1e40af; font-weight: bold;">إجمالي ساعات العمل المنجزة</div>
                    <div style="font-size: 1.65rem; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${grandAllTimeHours} <span style="font-size: 0.9rem; font-weight: bold;">ساعة</span></div>
                    <div style="font-size: 0.72rem; color: #2563eb; margin-top: 4px;">${totalSessionsCount} حصة مسجلة</div>
                </div>
            </div>

            <!-- Progress Bar of Cumulative Collection -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 22px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.84rem; font-weight: 800; color: #334155; margin-bottom: 6px;">
                    <span>معدل استخلاص المداخيل الإجمالية التراكمية:</span>
                    <span style="color: #059669; font-size: 0.95rem;">${overallCollectionRate}% (${grandAllTimeCollected} د.م محصلة من أصل ${grandAllTimeDue} د.م)</span>
                </div>
                <div style="background: #e2e8f0; border-radius: 6px; height: 10px; overflow: hidden;">
                    <div style="width: ${overallCollectionRate}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.4s ease;"></div>
                </div>
            </div>

            <!-- Section 1: Monthly Breakdown -->
            <div style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                        <span data-lucide="calendar-range" data-size="18" style="color: #2563eb;"></span>
                        <span>توزيع المداخيل حسب الأشهر (${sortedMonths.length} شهر)</span>
                    </h4>
                    <span style="font-size: 0.78rem; color: #64748b;">تحديث فوري وتلقائي</span>
                </div>
                <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right;">
                                <th style="padding: 10px;">الشهر</th>
                                <th style="padding: 10px;">التلاميذ النشطون</th>
                                <th style="padding: 10px;">الساعات المنجزة</th>
                                <th style="padding: 10px;">المستحقات</th>
                                <th style="padding: 10px;">المداخيل المحصلة</th>
                                <th style="padding: 10px;">المتبقي غير المستخلص</th>
                                <th style="padding: 10px;">نسبة التحصيل</th>
                                <th style="padding: 10px; text-align: center;">إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedMonths.length === 0 ? `
                                <tr><td colspan="8" style="text-align: center; padding: 25px; color: #94a3b8;">لا توجد أي بيانات مدخلة حتى الآن</td></tr>
                            ` : sortedMonths.map(mKey => {
                                const m = monthsSummary[mKey];
                                const rate = m.due > 0 ? Math.round((m.collected / m.due) * 100) : 100;
                                return `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 10px; font-weight: 800; color: #0f172a;">${mKey}</td>
                                        <td style="padding: 10px; color: #475569;">${m.activeStudents} تلميذ</td>
                                        <td style="padding: 10px; font-weight: bold; color: #1e293b;">${m.hours} س</td>
                                        <td style="padding: 10px; font-weight: 800; color: #0f172a;">${m.due} د.م</td>
                                        <td style="padding: 10px; font-weight: 800; color: #16a34a;">${m.collected} د.م</td>
                                        <td style="padding: 10px; font-weight: 800; color: ${m.remaining > 0 ? '#dc2626' : '#16a34a'};">${m.remaining} د.م</td>
                                        <td style="padding: 10px;">
                                            <span style="font-weight: 800; color: ${rate >= 80 ? '#16a34a' : (rate >= 50 ? '#d97706' : '#dc2626')};">${rate}%</span>
                                        </td>
                                        <td style="padding: 10px; text-align: center;">
                                            <button type="button" onclick="closeTutoringAllTimeRevenueModal(); selectTutoringMonth('${mKey}');" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 0.74rem; font-weight: bold; cursor: pointer;">
                                                عرض تفاصيل الشهر
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Section 2: Group Revenue Breakdown -->
            <div style="margin-bottom: 24px;">
                <div style="margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                        <span data-lucide="school" data-size="18" style="color: #8b5cf6;"></span>
                        <span>توزيع المداخيل حسب المجموعات الدراسية</span>
                    </h4>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
                    ${Object.keys(groupsSummary).map(grp => {
                        const g = groupsSummary[grp];
                        const gRate = g.due > 0 ? Math.round((g.collected / g.due) * 100) : 100;
                        return `
                            <div style="background: #fff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                                    <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem;">${grp}</div>
                                    <span style="font-size: 0.72rem; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${g.studentsCount} تلميذ</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                                    <span style="color: #64748b;">المداخيل المستخلصة:</span>
                                    <span style="font-weight: 800; color: #16a34a;">${g.collected} د.م</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                                    <span style="color: #64748b;">المستحقات الكلية:</span>
                                    <span style="font-weight: 800; color: #0f172a;">${g.due} د.م</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 8px;">
                                    <span style="color: #64748b;">المتبقي غير المؤدى:</span>
                                    <span style="font-weight: 800; color: ${g.remaining > 0 ? '#dc2626' : '#16a34a'};">${g.remaining} د.م</span>
                                </div>
                                <div style="font-size: 0.74rem; color: #64748b; margin-top: 4px;">
                                    الساعات المنجزة: <strong>${g.hours} س</strong> • التحصيل: <strong>${gRate}%</strong>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Section 3: Cumulative Per-Student Financial Records -->
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                        <span data-lucide="users" data-size="18" style="color: #059669;"></span>
                        <span>كشف الحساب التراكمي الشامل لكل تلميذ (${studentsSummary.length} تلميذ)</span>
                    </h4>
                    <span style="font-size: 0.78rem; color: #64748b;">مرتبة حسب المتأخرات ثم المبالغ المستخلصة</span>
                </div>
                <div style="max-height: 320px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.83rem;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #475569; text-align: right; position: sticky; top: 0; z-index: 2;">
                                <th style="padding: 10px; background: #f8fafc;">التلميذ</th>
                                <th style="padding: 10px; background: #f8fafc;">المجموعة</th>
                                <th style="padding: 10px; background: #f8fafc;">سعر الساعة</th>
                                <th style="padding: 10px; background: #f8fafc;">مجموع الساعات</th>
                                <th style="padding: 10px; background: #f8fafc;">إجمالي المستحق</th>
                                <th style="padding: 10px; background: #f8fafc;">المجموع المؤدى</th>
                                <th style="padding: 10px; background: #f8fafc;">المتبقي بذمته</th>
                                <th style="padding: 10px; background: #f8fafc; text-align: center;">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studentsSummary.map(item => `
                                <tr style="border-bottom: 1px solid #f1f5f9; ${item.remaining > 0 ? 'background: #fffbeb;' : ''}">
                                    <td style="padding: 10px; font-weight: bold; color: #0f172a;">
                                        <a href="javascript:void(0)" onclick="closeTutoringAllTimeRevenueModal(); openTutoringStudentProfileModal('${item.student.id}')" style="color: #2563eb; text-decoration: none;">
                                            ${item.student.name}
                                        </a>
                                    </td>
                                    <td style="padding: 10px; color: #64748b;">${item.student.group || '-'}</td>
                                    <td style="padding: 10px; color: #475569;">${item.rate} د.م/س</td>
                                    <td style="padding: 10px; font-weight: bold;">${item.totalHours} س</td>
                                    <td style="padding: 10px; font-weight: 800; color: #0f172a;">${item.totalDue} د.م</td>
                                    <td style="padding: 10px; font-weight: 800; color: #16a34a;">${item.totalPaid} د.م</td>
                                    <td style="padding: 10px; font-weight: 900; color: ${item.remaining > 0 ? '#dc2626' : '#16a34a'};">
                                        ${item.remaining > 0 ? `${item.remaining} د.م ⚠️` : '0 د.م ✓'}
                                    </td>
                                    <td style="padding: 10px; text-align: center;">
                                        <button type="button" onclick="closeTutoringAllTimeRevenueModal(); openTutoringStudentProfileModal('${item.student.id}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; font-size: 0.74rem; font-weight: bold; cursor: pointer; color: #334155;">
                                            الملف الشخصي
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.printTutoringAllTimeRevenueReport = function () {
        const modal = document.getElementById('tutoringAllTimeRevenueModal');
        if (!modal) return;
        const content = document.getElementById('tutoringAllTimeRevenueModalContent');
        if (!content) return;

        // استنساخ المحتوى وتنظيفه من الأزرار التفاعلية وأعمدة الإجراءات
        const clone = content.cloneNode(true);
        clone.querySelectorAll('button, .btn, [onclick]').forEach(el => {
            if (el.tagName === 'BUTTON') el.remove();
        });
        clone.querySelectorAll('table').forEach(tbl => {
            tbl.querySelectorAll('tr').forEach(tr => {
                const cells = tr.querySelectorAll('th, td');
                if (cells.length >= 7) {
                    const lastCell = cells[cells.length - 1];
                    if (lastCell && (lastCell.textContent.includes('إجراء') || lastCell.textContent.includes('تفاصيل') || lastCell.textContent.includes('الملف') || lastCell.innerHTML.trim() === '')) {
                        lastCell.remove();
                    }
                }
            });
        });

        // حساب المصاريف وصافي الربح التراكمي لإغناء التقرير المالي
        const expenses = (db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses : [];
        const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const tp = (db && db.teacherProfile) ? db.teacherProfile : {};
        const teacherName = tp.name || 'الأستاذ(ة) المشرف(ة)';

        const printHTML = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>التقرير_المالي_التراكمي_الشامل_للدعم</title>
                <style>
                    body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; direction: rtl; color: #0f172a; margin: 0; }
                    h2, h3, h4 { margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.82rem; }
                    th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: right; }
                    th { background: #f1f5f9; font-weight: 800; }
                </style>
            </head>
            <body>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2.5px solid #059669; padding-bottom: 12px; margin-bottom: 16px;">
                    <div>
                        <div style="font-size:0.78rem; color:#64748b; font-weight:700;">المملكة المغربية • منظومة الأستاذ لإدارة الدعم التربوي والخصوصي</div>
                        <h2 style="color: #059669; margin: 4px 0;">التقرير المالي التراكمي الشامل للمداخيل والمستحقات وصافي الربح</h2>
                    </div>
                    <div style="text-align:left; font-size:0.8rem; color:#334155; font-weight:700;">
                        <div>إشراف: ${teacherName}</div>
                        <div>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-MA')}</div>
                    </div>
                </div>
                ${totalExpenses > 0 ? `
                    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; font-weight:800;">
                        <span style="color:#991b1b;">إجمالي المصاريف والنفقات المسجلة (${expenses.length} عملية):</span>
                        <span style="color:#dc2626; font-size:1rem;">-${totalExpenses.toLocaleString('ar-MA')} درهم</span>
                    </div>
                ` : ''}
                ${clone.innerHTML}
                <div style="margin-top:24px; display:flex; justify-content:space-between; font-size:0.85rem; font-weight:700; color:#334155; border-top:1px dashed #cbd5e1; padding-top:12px;">
                    <div>توقيع وخاتم الأستاذ(ة) المشرف(ة): .................................</div>
                    <div>مصادقة الإدارة / المحاسبة: .................................</div>
                </div>
            </body>
            </html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(printHTML, {
                title: 'التقرير_المالي_التراكمي_الشامل_للدعم',
                orientation: 'portrait',
                subtitle: 'الحصيلة المالية التراكمية للمداخيل المحصلة والديون المتبقية والمصاريف'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printHTML, 'التقرير_المالي_التراكمي_الشامل_للدعم', 'portrait');
        }
    };

    // =========================================================================
    // 10. CHART.JS ANALYTICS INITIALIZER & INTERACTIVE CONTROLS
    // =========================================================================
    function getArabicMonthLabel(mKey) {
        if (!mKey || typeof mKey !== 'string') return mKey || '';
        const parts = mKey.split('-');
        if (parts.length < 2) return mKey;
        const year = parts[0];
        const m = parts[1];
        const monthNames = {
            '01': 'يناير',
            '02': 'فبراير',
            '03': 'مارس',
            '04': 'أبريل',
            '05': 'ماي',
            '06': 'يونيو',
            '07': 'يوليوز',
            '08': 'غشت',
            '09': 'شتنبر',
            '10': 'أكتوبر',
            '11': 'نونبر',
            '12': 'دجنبر'
        };
        return (monthNames[m] || m) + ' ' + year;
    }

    window.switchTutoringAnalyticsView = function(mode) {
        window._currentTutoringAnalyticsMode = mode;
        const btnCumul = document.getElementById('btnTutAnalyticsCumul');
        const btnRate = document.getElementById('btnTutAnalyticsRate');
        const btnMonthly = document.getElementById('btnTutAnalyticsMonthly');
        const btnAll = document.getElementById('btnTutAnalyticsAll');
        const secCumul = document.getElementById('tutoringCumulativeSection');
        const secRate = document.getElementById('tutoringRateSection');
        const secMonthly = document.getElementById('tutoringMonthlySection');

        if (btnCumul) btnCumul.classList.toggle('active', mode === 'cumulative');
        if (btnRate) btnRate.classList.toggle('active', mode === 'rate');
        if (btnMonthly) btnMonthly.classList.toggle('active', mode === 'monthly');
        if (btnAll) btnAll.classList.toggle('active', mode === 'all');

        if (secCumul) secCumul.style.display = (mode === 'cumulative' || mode === 'all') ? 'block' : 'none';
        if (secRate) secRate.style.display = (mode === 'rate' || mode === 'all') ? 'block' : 'none';
        if (secMonthly) secMonthly.style.display = (mode === 'monthly' || mode === 'all') ? 'grid' : 'none';

        if (window.renderLucide) window.renderLucide();
    };

    window.downloadActiveTutoringChart = function() {
        const mode = window._currentTutoringAnalyticsMode || 'cumulative';
        let canvasId = 'tutoringCumulativeRevenueChart';
        if (mode === 'rate') canvasId = 'tutoringCollectionRateTrendChart';
        else if (mode === 'monthly') canvasId = 'tutoringRevenueMonthlyChart';

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            if (typeof showAppToast === 'function') showAppToast('تعذر العثور على المخطط المطلوب لتصديره.', 'warning');
            return;
        }
        try {
            const a = document.createElement('a');
            a.download = `tutoring-${mode}-analytics-${Date.now()}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
            if (typeof showAppToast === 'function') {
                showAppToast('تم تصدير المخطط البياني التفاعلي كصورة عالية الدقة بنجاح 📊', 'success');
            }
        } catch (e) {
            console.error('downloadActiveTutoringChart error:', e);
        }
    };

    function initTutoringAnalyticsCharts(sortedMonths, allMonthsMap, activeMonth) {
        if (typeof Chart === 'undefined') return;

        // Prepare chronological school year months sequence
        const standardSchoolMonths = [
            '2026-09', '2026-10', '2026-11', '2026-12',
            '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06'
        ];
        let monthsAsc = Object.keys(allMonthsMap || {}).sort();
        if (monthsAsc.length < 3) {
            const set = new Set([...standardSchoolMonths, ...monthsAsc]);
            monthsAsc = [...set].sort();
        }

        // Calculate running cumulative totals
        let runningDue = 0;
        let runningCollected = 0;
        const cumulDue = [];
        const cumulCollected = [];
        const cumulRemaining = [];
        const monthlyRates = [];
        const cumulRates = [];

        monthsAsc.forEach(m => {
            const mData = (allMonthsMap && allMonthsMap[m]) ? allMonthsMap[m] : { due: 0, collected: 0, remaining: 0 };
            runningDue += (mData.due || 0);
            runningCollected += (mData.collected || 0);
            cumulDue.push(runningDue);
            cumulCollected.push(runningCollected);
            cumulRemaining.push(Math.max(0, runningDue - runningCollected));

            const mRate = (mData.due > 0) ? Math.min(100, Math.round(((mData.collected || 0) / mData.due) * 100)) : 100;
            monthlyRates.push(mRate);

            const cRate = (runningDue > 0) ? Math.min(100, Math.round((runningCollected / runningDue) * 100)) : 100;
            cumulRates.push(cRate);
        });

        const arabicLabels = monthsAsc.map(m => getArabicMonthLabel(m));

        // -------------------------------------------------------------
        // 1. CUMULATIVE REVENUE PROGRESSION CHART (التطور التراكمي للمداخيل)
        // -------------------------------------------------------------
        const cumulCanvas = document.getElementById('tutoringCumulativeRevenueChart');
        if (cumulCanvas) {
            if (window._tutoringCumulativeRevenueChart && typeof window._tutoringCumulativeRevenueChart.destroy === 'function') {
                window._tutoringCumulativeRevenueChart.destroy();
            }

            const ctxCumul = cumulCanvas.getContext('2d');
            const gradCollected = ctxCumul.createLinearGradient(0, 0, 0, 260);
            gradCollected.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
            gradCollected.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

            const gradDue = ctxCumul.createLinearGradient(0, 0, 0, 260);
            gradDue.addColorStop(0, 'rgba(37, 99, 235, 0.30)');
            gradDue.addColorStop(1, 'rgba(37, 99, 235, 0.02)');

            window._tutoringCumulativeRevenueChart = new Chart(ctxCumul, {
                type: 'line',
                data: {
                    labels: arabicLabels,
                    datasets: [
                        {
                            label: 'المداخيل المستخلصة التراكمية (د.م)',
                            data: cumulCollected,
                            borderColor: '#059669',
                            backgroundColor: gradCollected,
                            fill: true,
                            tension: 0.35,
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 8,
                            pointBackgroundColor: '#059669',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'المستحقات الكلية التراكمية (د.م)',
                            data: cumulDue,
                            borderColor: '#2563eb',
                            backgroundColor: gradDue,
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2.2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#2563eb',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'المتبقي غير المحصل التراكمي (د.م)',
                            data: cumulRemaining,
                            borderColor: '#dc2626',
                            backgroundColor: 'transparent',
                            borderDash: [6, 4],
                            tension: 0.35,
                            borderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#dc2626',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1.5
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
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Cairo', weight: 'bold', size: 12 },
                                usePointStyle: true,
                                padding: 14
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Cairo', weight: 'bold', size: 13 },
                            bodyFont: { family: 'Cairo', size: 12 },
                            padding: 12,
                            boxPadding: 6,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + (context.parsed.y || 0).toLocaleString('ar-MA') + ' د.م';
                                },
                                afterBody: function(items) {
                                    const idx = items[0] ? items[0].dataIndex : -1;
                                    if (idx >= 0) {
                                        return [`نسبة التحصيل التراكمية الإجمالية: ${cumulRates[idx]}%`];
                                    }
                                    return [];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                font: { family: 'Cairo', size: 11 },
                                callback: function(val) { return val + ' د.م'; }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Cairo', size: 11, weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // -------------------------------------------------------------
        // 2. COLLECTION RATE TREND CHART (نسب تحصيل المستحقات على مدار السنة)
        // -------------------------------------------------------------
        const rateCanvas = document.getElementById('tutoringCollectionRateTrendChart');
        if (rateCanvas) {
            if (window._tutoringCollectionRateTrendChart && typeof window._tutoringCollectionRateTrendChart.destroy === 'function') {
                window._tutoringCollectionRateTrendChart.destroy();
            }

            const ctxRate = rateCanvas.getContext('2d');
            const gradRate = ctxRate.createLinearGradient(0, 0, 0, 240);
            gradRate.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
            gradRate.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

            window._tutoringCollectionRateTrendChart = new Chart(ctxRate, {
                type: 'line',
                data: {
                    labels: arabicLabels,
                    datasets: [
                        {
                            label: 'نسبة التحصيل الشهرية (%)',
                            data: monthlyRates,
                            borderColor: '#10b981',
                            backgroundColor: 'transparent',
                            tension: 0.3,
                            borderWidth: 2.8,
                            pointRadius: 6,
                            pointHoverRadius: 9,
                            pointBackgroundColor: monthlyRates.map(r => r >= 80 ? '#10b981' : (r >= 50 ? '#f59e0b' : '#ef4444')),
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'نسبة التحصيل التراكمية السنوية (%)',
                            data: cumulRates,
                            borderColor: '#8b5cf6',
                            backgroundColor: gradRate,
                            fill: true,
                            tension: 0.3,
                            borderWidth: 2.2,
                            pointRadius: 4,
                            pointHoverRadius: 7,
                            pointBackgroundColor: '#8b5cf6',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 1.5
                        },
                        {
                            label: 'الحد المرجعي الممتاز (80%)',
                            data: monthsAsc.map(() => 80),
                            borderColor: 'rgba(5, 150, 105, 0.65)',
                            borderDash: [6, 4],
                            borderWidth: 1.5,
                            pointRadius: 0,
                            fill: false
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
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Cairo', weight: 'bold', size: 12 },
                                usePointStyle: true,
                                padding: 14
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Cairo', weight: 'bold', size: 13 },
                            bodyFont: { family: 'Cairo', size: 12 },
                            padding: 12,
                            boxPadding: 6,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y + '%';
                                },
                                afterBody: function(items) {
                                    const idx = items[0] ? items[0].dataIndex : -1;
                                    if (idx >= 0) {
                                        const m = monthsAsc[idx];
                                        const md = (allMonthsMap && allMonthsMap[m]) ? allMonthsMap[m] : { due: 0, collected: 0, remaining: 0 };
                                        return [
                                            `المستحقات الشهرية: ${(md.due || 0)} د.م`,
                                            `المبالغ المستخلصة: ${(md.collected || 0)} د.م`,
                                            `المتبقي غير المحصل: ${(md.remaining || 0)} د.م`
                                        ];
                                    }
                                    return [];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            grid: { color: '#f1f5f9' },
                            ticks: {
                                font: { family: 'Cairo', size: 11 },
                                callback: function(val) { return val + '%'; }
                            }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { family: 'Cairo', size: 11, weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // -------------------------------------------------------------
        // 3. MONTHLY DISCRETE BAR CHART (المقارنة الشهرية)
        // -------------------------------------------------------------
        const revCanvas = document.getElementById('tutoringRevenueMonthlyChart');
        if (revCanvas) {
            if (window._tutoringRevenueChart && typeof window._tutoringRevenueChart.destroy === 'function') {
                window._tutoringRevenueChart.destroy();
            }

            const chartMonths = (sortedMonths && sortedMonths.length > 0) 
                ? [...sortedMonths].slice(-7).reverse() 
                : [activeMonth || (window.formatLocalMonth ? window.formatLocalMonth() : '2026-09')];

            const dueData = chartMonths.map(m => (allMonthsMap[m] ? allMonthsMap[m].due : 0));
            const collectedData = chartMonths.map(m => (allMonthsMap[m] ? allMonthsMap[m].collected : 0));
            const barArabicLabels = chartMonths.map(m => getArabicMonthLabel(m));

            const ctx = revCanvas.getContext('2d');
            window._tutoringRevenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: barArabicLabels,
                    datasets: [
                        {
                            label: 'المستحقات الكلية (د.م)',
                            data: dueData,
                            backgroundColor: 'rgba(59, 130, 246, 0.70)',
                            borderColor: '#2563eb',
                            borderWidth: 1.5,
                            borderRadius: 6
                        },
                        {
                            label: 'المداخيل المستخلصة (د.م)',
                            data: collectedData,
                            backgroundColor: 'rgba(16, 185, 129, 0.85)',
                            borderColor: '#059669',
                            borderWidth: 1.5,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Cairo', weight: 'bold', size: 12 }
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Cairo', weight: 'bold' },
                            bodyFont: { family: 'Cairo' },
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y + ' د.م';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: { family: 'Cairo', size: 11 },
                                callback: function(val) { return val + ' د.م'; }
                            }
                        },
                        x: {
                            ticks: { font: { family: 'Cairo', size: 11, weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // -------------------------------------------------------------
        // 4. GROUPS DISTRIBUTION CHART (توزيع المجموعات)
        // -------------------------------------------------------------
        const groupCanvas = document.getElementById('tutoringGroupDistChart');
        if (groupCanvas) {
            if (window._tutoringGroupDistChart && typeof window._tutoringGroupDistChart.destroy === 'function') {
                window._tutoringGroupDistChart.destroy();
            }

            const students = (db && db.tutoring && db.tutoring.students) ? db.tutoring.students : [];
            const groupMap = {};
            students.forEach(s => {
                const g = s.group || 'بدون مجموعة';
                if (!groupMap[g]) groupMap[g] = { students: 0, hours: 0 };
                groupMap[g].students++;
                (s.sessions || []).forEach(ss => {
                    if (ss.date && ss.date.startsWith(activeMonth) && ss.attendance !== 'absent') {
                        groupMap[g].hours += (parseFloat(ss.hours) || 0);
                    }
                });
            });

            const gLabels = Object.keys(groupMap);
            const gStudents = gLabels.map(g => groupMap[g].students);
            const gHours = gLabels.map(g => groupMap[g].hours);

            const ctx2 = groupCanvas.getContext('2d');
            window._tutoringGroupDistChart = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: gLabels.length > 0 ? gLabels : ['عام'],
                    datasets: [
                        {
                            label: 'عدد التلاميذ',
                            data: gStudents.length > 0 ? gStudents : [0],
                            backgroundColor: 'rgba(99, 102, 241, 0.7)',
                            borderColor: '#6366f1',
                            borderWidth: 1.5,
                            borderRadius: 6
                        },
                        {
                            label: 'ساعات الدعم المنجزة (س)',
                            data: gHours.length > 0 ? gHours : [0],
                            backgroundColor: 'rgba(245, 158, 11, 0.8)',
                            borderColor: '#d97706',
                            borderWidth: 1.5,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                font: { family: 'Cairo', weight: 'bold', size: 12 }
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: { family: 'Cairo', weight: 'bold' },
                            bodyFont: { family: 'Cairo' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { font: { family: 'Cairo', size: 11 } }
                        },
                        x: {
                            ticks: { font: { family: 'Cairo', size: 11, weight: 'bold' } }
                        }
                    }
                }
            });
        }
    }
    window.initTutoringAnalyticsCharts = initTutoringAnalyticsCharts;

    // =========================================================================
    // 11. TUTORING ATTENDANCE & PEDAGOGICAL TRACKING LEDGER
    // =========================================================================
    window.renderTutoringAttendanceLedger = function () {
        const monthInput = document.getElementById('tutoringAttMonthFilter');
        const groupFilter = document.getElementById('tutoringAttGroupFilter');
        const statusFilter = document.getElementById('tutoringAttStatusFilter');
        const searchInput = document.getElementById('tutoringAttSearchInput');
        const kpisContainer = document.getElementById('tutoringAttendanceKpis');
        const ledgerContainer = document.getElementById('tutoringAttendanceLedgerContainer');

        if (!kpisContainer || !ledgerContainer) return;

        // Default month
        if (monthInput && !monthInput.value) {
            monthInput.value = window.formatLocalMonth ? window.formatLocalMonth() : (window.formatLocalDate ? window.formatLocalDate().slice(0, 7) : new Date().toLocaleDateString('en-CA').slice(0, 7));
        }
        const activeMonth = monthInput ? monthInput.value : '';

        // Populate groups dropdown if needed
        const students = db.tutoring.students || [];
        const uniqueGroups = Array.from(new Set(students.map(s => s.group).filter(Boolean))).sort();
        if (groupFilter) {
            const currentSelected = groupFilter.value;
            let options = '<option value="all">كل المجموعات</option>';
            uniqueGroups.forEach(g => {
                options += `<option value="${escapeTutoringHtml(g)}"${currentSelected === g ? ' selected' : ''}>${escapeTutoringHtml(g)}</option>`;
            });
            groupFilter.innerHTML = options;
        }

        const selectedGroup = groupFilter ? groupFilter.value : 'all';
        const selectedStatus = statusFilter ? statusFilter.value : 'all';
        const searchQuery = (searchInput ? searchInput.value : '').trim().toLowerCase();

        // Flatten all sessions with student info
        const allEntries = [];
        let totalMonthSessions = 0;
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalExcused = 0;
        let totalLate = 0;
        let totalHomeworkCount = 0;
        let goodOrExcellentCount = 0;

        students.forEach(std => {
            if (selectedGroup !== 'all' && std.group !== selectedGroup) return;

            (std.sessions || []).forEach(sess => {
                if (!sess.date || !sess.date.startsWith(activeMonth)) return;

                totalMonthSessions++;
                const att = sess.attendance || 'present';
                if (att === 'present') totalPresent++;
                else if (att === 'absent') totalAbsent++;
                else if (att === 'excused') totalExcused++;
                else if (att === 'late') totalLate++;

                if (sess.homework && sess.homework.trim().length > 0) totalHomeworkCount++;
                if (sess.evaluation === 'excellent' || sess.evaluation === 'very_good') goodOrExcellentCount++;

                // Apply status filter
                if (selectedStatus === 'absent_only' && att !== 'absent') return;
                if (selectedStatus === 'present_only' && att !== 'present') return;
                if (selectedStatus === 'excused_only' && att !== 'excused') return;
                if (selectedStatus === 'late_only' && att !== 'late') return;

                // Apply search filter
                if (searchQuery) {
                    const matchName = (std.name || '').toLowerCase().includes(searchQuery);
                    const matchTopic = (sess.topic || '').toLowerCase().includes(searchQuery);
                    const matchGroup = (std.group || '').toLowerCase().includes(searchQuery);
                    const matchHw = (sess.homework || '').toLowerCase().includes(searchQuery);
                    if (!matchName && !matchTopic && !matchGroup && !matchHw) return;
                }

                allEntries.push({
                    student: std,
                    session: sess
                });
            });
        });

        // Sort entries by date descending, then time
        allEntries.sort((a, b) => {
            const dateCmp = b.session.date.localeCompare(a.session.date);
            if (dateCmp !== 0) return dateCmp;
            return (b.session.time || '').localeCompare(a.session.time || '');
        });

        const effectiveAttended = totalPresent + totalLate;
        const attRate = totalMonthSessions > 0 ? Math.round((effectiveAttended / totalMonthSessions) * 100) : 100;
        const hwRate = totalMonthSessions > 0 ? Math.round((totalHomeworkCount / totalMonthSessions) * 100) : 0;

        // Render KPI Cards
        kpisContainer.innerHTML = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: bold;">نسبة المواظبة العامة</span>
                    <span style="color: #2563eb;"><span data-lucide="award" data-size="16"></span></span>
                </div>
                <div style="font-size: 1.6rem; font-weight: 900; color: ${attRate >= 85 ? '#059669' : (attRate >= 70 ? '#d97706' : '#dc2626')};">${attRate}%</div>
                <div style="font-size: 0.74rem; color: #64748b; margin-top: 3px;">من أصل ${totalMonthSessions} تسجيل حصة</div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: bold;">حضور فعلي (حاضر + تأخر)</span>
                    <span style="color: #059669;"><span data-lucide="user-check" data-size="16"></span></span>
                </div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #059669;">${effectiveAttended}</div>
                <div style="font-size: 0.74rem; color: #64748b; margin-top: 3px;">${totalPresent} حاضر • ${totalLate} مع تأخر</div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: bold;">الغيابات المرصودة</span>
                    <span style="color: #dc2626;"><span data-lucide="user-x" data-size="16"></span></span>
                </div>
                <div style="font-size: 1.6rem; font-weight: 900; color: ${totalAbsent > 0 ? '#dc2626' : '#16a34a'};">${totalAbsent}</div>
                <div style="font-size: 0.74rem; color: #64748b; margin-top: 3px;">${totalExcused} غياب بعذر مبرر</div>
            </div>

            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.78rem; color: #64748b; font-weight: bold;">التتبع البيداغوجي والواجبات</span>
                    <span style="color: #8b5cf6;"><span data-lucide="book-check" data-size="16"></span></span>
                </div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #7c3aed;">${totalHomeworkCount} <span style="font-size: 0.85rem; font-weight: bold; color: #64748b;">واجب (${hwRate}%)</span></div>
                <div style="font-size: 0.74rem; color: #64748b; margin-top: 3px;">${goodOrExcellentCount} تقييم استيعاب ممتاز/جيد جداً</div>
            </div>
        `;

        // Render Main Ledger Table
        if (allEntries.length === 0) {
            ledgerContainer.innerHTML = `
                <div style="background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 40px 20px; text-align: center; color: #64748b;">
                    <span class="ui-icon" style="color: #94a3b8; margin-bottom: 8px;"><span data-lucide="inbox" data-size="36"></span></span>
                    <h4 style="margin: 0 0 6px 0; color: #334155; font-size: 1rem; font-weight: bold;">لا توجد حصص تطابق معايير التصفية المحددة لشهر ${activeMonth}</h4>
                    <p style="margin: 0; font-size: 0.82rem;">يمكنك تسجيل حصة جديدة أو تعديل خيارات التصفية بالأعلى (المجموعة، حالة الحضور، أو الشهر).</p>
                </div>
            `;
            setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
            return;
        }

        let tableHtml = `
            <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                <div style="padding: 12px 18px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <span style="font-weight: 800; font-size: 0.88rem; color: #1e293b;">
                        عرض سجل الحصص والمواظبة (${allEntries.length} تسجيل):
                    </span>
                    <span style="font-size: 0.78rem; color: #64748b;">
                        شهر التتبع: <b>${activeMonth}</b> • المجموعة: <b>${selectedGroup === 'all' ? 'جميع المجموعات' : selectedGroup}</b>
                    </span>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem; text-align: right;">
                        <thead>
                            <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #cbd5e1; font-weight: 800;">
                                <th style="padding: 10px 14px;">التلميذ والمجموعة</th>
                                <th style="padding: 10px 14px;">التاريخ والتوقيت</th>
                                <th style="padding: 10px 14px;">حالة الحضور</th>
                                <th style="padding: 10px 14px;">موضوع الحصة والأنشطة</th>
                                <th style="padding: 10px 14px;">التقييم البيداغوجي</th>
                                <th style="padding: 10px 14px;">الواجب والتكليف</th>
                                <th style="padding: 10px 14px; text-align: center;">إجراءات وتواصل</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        allEntries.forEach(({ student, session }) => {
            const att = session.attendance || 'present';
            let attBadge = '';
            if (att === 'absent') {
                attBadge = '<span style="background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 4px;">❌ غائب (0 س)</span>';
            } else if (att === 'excused') {
                attBadge = '<span style="background: #fef3c7; color: #b45309; font-weight: 800; padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 4px;">⚠️ غياب مبرر</span>';
            } else if (att === 'late') {
                attBadge = `<span style="background: #fff7ed; color: #c2410c; font-weight: 800; padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #fed7aa; display: inline-flex; align-items: center; gap: 4px;">⏱️ متأخر (${session.hours} س)</span>`;
            } else {
                attBadge = `<span style="background: #ecfdf5; color: #059669; font-weight: 800; padding: 3px 9px; border-radius: 6px; font-size: 0.75rem; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 4px;">✓ حاضر (${session.hours} س)</span>`;
            }

            let evalBadge = '-';
            if (session.evaluation === 'excellent') {
                evalBadge = '<span style="background: #ecfdf5; color: #059669; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px solid #a7f3d0; font-size: 0.74rem;">⭐⭐⭐ استيعاب ممتاز</span>';
            } else if (session.evaluation === 'very_good') {
                evalBadge = '<span style="background: #eff6ff; color: #2563eb; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px solid #bfdbfe; font-size: 0.74rem;">⭐⭐ جيد جداً</span>';
            } else if (session.evaluation === 'good') {
                evalBadge = '<span style="background: #f8fafc; color: #475569; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.74rem;">⭐ حسن</span>';
            } else if (session.evaluation === 'needs_support') {
                evalBadge = '<span style="background: #fef2f2; color: #dc2626; font-weight: bold; padding: 2px 7px; border-radius: 4px; border: 1px solid #fca5a5; font-size: 0.74rem;">⚠️ بحاجة لدعم</span>';
            }

            tableHtml += `
                <tr style="border-bottom: 1px solid #f1f5f9; ${att === 'absent' ? 'background: #fffdfd;' : ''}">
                    <td style="padding: 10px 14px;">
                        <div style="font-weight: 800; color: #0f172a;">
                            <a href="javascript:void(0)" onclick="openTutoringStudentProfileModal('${student.id}')" style="color: #0284c7; text-decoration: none;">
                                ${escapeTutoringHtml(student.name)}
                            </a>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">
                            ${student.group ? `مجموعة: <b style="color:#334155;">${escapeTutoringHtml(student.group)}</b>` : 'فردي'}
                            ${student.level ? ` • ${escapeTutoringHtml(student.level)}` : ''}
                        </div>
                    </td>
                    <td style="padding: 10px 14px; white-space: nowrap;">
                        <div style="font-weight: bold; color: #1e293b;">${session.date}</div>
                        <div style="font-size: 0.75rem; color: #64748b;" dir="ltr">${session.time || '18:00'}</div>
                    </td>
                    <td style="padding: 10px 14px;">
                        ${attBadge}
                    </td>
                    <td style="padding: 10px 14px; max-width: 220px;">
                        ${session.topic ? `
                            <div style="font-weight: 600; color: #0369a1; font-size: 0.8rem;">
                                ${escapeTutoringHtml(session.topic)}
                            </div>
                        ` : '<span style="color: #94a3b8; font-size: 0.76rem;">حصة عامة</span>'}
                        ${session.evaluationNotes ? `
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px; font-style: italic;">
                                💬 ${escapeTutoringHtml(session.evaluationNotes)}
                            </div>
                        ` : ''}
                    </td>
                    <td style="padding: 10px 14px;">
                        ${evalBadge}
                    </td>
                    <td style="padding: 10px 14px; max-width: 180px;">
                        ${session.homework ? `
                            <div style="background: #fefce8; border: 1px solid #fef08a; padding: 2px 7px; border-radius: 4px; font-size: 0.75rem; color: #854d0e; font-weight: 600;">
                                📝 ${escapeTutoringHtml(session.homework)}
                            </div>
                        ` : '<span style="color: #94a3b8; font-size: 0.75rem;">-</span>'}
                    </td>
                    <td style="padding: 10px 14px; text-align: center; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 5px;">
                            <button type="button" onclick="shareTutoringSessionWhatsApp('${student.id}', '${session.id}')" style="background: #25D366; color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.73rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 3px;" title="إرسال تقرير الحصة لولي الأمر عبر واتساب">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="message-circle" data-size="12"></span></span>
                                <span>واتساب</span>
                            </button>
                            <button type="button" onclick="editTutoringSingleSession('${student.id}', '${session.id}')" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 0.73rem; font-weight: bold;" title="تعديل الحصة">
                                تعديل
                            </button>
                            <button type="button" onclick="deleteTutoringSession('${student.id}', '${session.id}')" style="background: #fee2e2; border: 1px solid #fecaca; color: #ef4444; cursor: pointer; padding: 4px 7px; border-radius: 6px;" title="حذف الحصة">
                                <span class="ui-icon" style="margin:0;"><span data-lucide="trash-2" data-size="13"></span></span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        ledgerContainer.innerHTML = tableHtml;
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    // =========================================================================
    // 12. PRINT TUTORING ATTENDANCE LEDGER
    // =========================================================================
    window.printTutoringAttendanceLedger = function () {
        const monthInput = document.getElementById('tutoringAttMonthFilter');
        const groupFilter = document.getElementById('tutoringAttGroupFilter');

        const activeMonth = monthInput ? monthInput.value : '';
        const selectedGroup = groupFilter ? groupFilter.value : 'all';
        const groupLabel = selectedGroup === 'all' ? 'كافة المجموعات' : selectedGroup;

        const ledgerContainer = document.getElementById('tutoringAttendanceLedgerContainer');
        const kpisContainer = document.getElementById('tutoringAttendanceKpis');

        // استنساخ الجدول وحذف عمود "إجراءات سريعة" والأزرار التفاعلية
        let cleanTableHtml = '<p>لا توجد بيانات مسجلة</p>';
        if (ledgerContainer) {
            const clone = ledgerContainer.cloneNode(true);
            clone.querySelectorAll('button').forEach(b => b.remove());
            clone.querySelectorAll('tr').forEach(tr => {
                const cells = tr.querySelectorAll('th, td');
                if (cells.length >= 9) {
                    cells[cells.length - 1].remove();
                }
            });
            cleanTableHtml = clone.innerHTML;
        }

        const tp = (db && db.teacherProfile) ? db.teacherProfile : {};
        const teacherName = tp.name || 'الأستاذ(ة) المشرف(ة)';

        const printHTML = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>سجل_مواظبة_وحصص_الدعم_${activeMonth}</title>
                <style>
                    body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; direction: rtl; color: #0f172a; margin: 0; }
                    h2, h3, h4 { margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.8rem; }
                    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
                    th { background: #1e1b4b !important; color: #ffffff !important; font-weight: 800; }
                    .header-box { display:flex; justify-content:space-between; align-items:center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px; }
                    .signature-box { margin-top: 26px; display: flex; justify-content: space-between; padding: 0 20px; font-size: 0.85rem; font-weight: 700; page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <div>
                        <div style="font-size:0.78rem; color:#64748b; font-weight:700;">المملكة المغربية • منظومة الأستاذ لإدارة الدعم الخصوصي</div>
                        <h2 style="color: #312e81; margin: 3px 0;">سجل المواظبة والغياب والتتبع البيداغوجي لحصص الدعم</h2>
                    </div>
                    <div style="text-align:left; font-size:0.8rem; color:#334155; font-weight:700;">
                        <div>الشهر: <b>${activeMonth || 'الكل'}</b> | المجموعة: <b>${groupLabel}</b></div>
                        <div>إشراف: ${teacherName} | التاريخ: ${new Date().toLocaleDateString('ar-MA')}</div>
                    </div>
                </div>

                ${kpisContainer ? `<div style="margin-bottom:12px;">${kpisContainer.innerHTML}</div>` : ''}

                ${cleanTableHtml}

                <div class="signature-box">
                    <div style="text-align: center;">
                        <p style="margin: 0;">ملاحظات وتوجيهات الأستاذ(ة):</p>
                        <div style="margin-top: 28px; color: #64748b;">................................................</div>
                    </div>
                    <div style="text-align: center;">
                        <p style="margin: 0;">توقيع وخاتم الأستاذ(ة) المشرف(ة):</p>
                        <div style="margin-top: 28px; color: #64748b;">................................................</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(printHTML, {
                title: `سجل_مواظبة_وحصص_الدعم_${activeMonth || 'الشامل'}`,
                orientation: 'landscape',
                subtitle: `دفتر الحضور والغياب والمواكبة البيداغوجية — المجموعة: ${groupLabel}`
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(printHTML, `سجل_مواظبة_وحصص_الدعم_${activeMonth}`, 'landscape');
        }
    };

    // =========================================================================
    // 13. NOTIFY ABSENT TUTORING STUDENTS VIA WHATSAPP
    // =========================================================================
    window.notifyAllAbsentTutoringWhatsApp = function () {
        const monthInput = document.getElementById('tutoringAttMonthFilter');
        const groupFilter = document.getElementById('tutoringAttGroupFilter');
        const activeMonth = monthInput ? monthInput.value : '';
        const selectedGroup = groupFilter ? groupFilter.value : 'all';

        const students = db.tutoring.students || [];
        const absentRecords = [];

        students.forEach(std => {
            if (selectedGroup !== 'all' && std.group !== selectedGroup) return;
            (std.sessions || []).forEach(sess => {
                if (sess.date && sess.date.startsWith(activeMonth) && (sess.attendance === 'absent' || sess.attendance === 'excused')) {
                    absentRecords.push({ student: std, session: sess });
                }
            });
        });

        if (absentRecords.length === 0) {
            alert(`✓ رائع! لا يوجد أي غياب مسجل للتلاميذ في شهر ${activeMonth} للمجموعة المحددة.`);
            return;
        }

        // Show prompt or open first / copy list
        const absentSummary = absentRecords.map((r, i) => `${i + 1}. ${r.student.name} (${r.session.date} - ${r.student.phone || 'بدون هاتف'})`).join('\n');
        
        const confirmSend = confirm(`تم رصد ${absentRecords.length} حالة غياب في شهر ${activeMonth}:\n\n${absentSummary}\n\nهل ترغب في فتح واتساب لإرسال إشعار غياب لولي أمر أول تلميذ في القائمة (${absentRecords[0].student.name})؟`);
        
        if (confirmSend) {
            window.shareTutoringSessionWhatsApp(absentRecords[0].student.id, absentRecords[0].session.id);
        }
    };

    // =========================================================================
    // 14. BATCH IMPORT TUTORING STUDENTS FROM REGULAR CLASSES
    // =========================================================================
    window.openBatchImportTutoringFromClassModal = function () {
        const modal = document.getElementById('tutoringBatchImportClassModal');
        const classSelect = document.getElementById('batchImportSourceClassSelect');
        const targetGroupInput = document.getElementById('batchImportTargetGroupName');
        const defaultFeeInput = document.getElementById('batchImportDefaultFee');
        const container = document.getElementById('batchImportStudentsContainer');
        const countBadge = document.getElementById('batchImportCountBadge');

        if (!modal) return;

        // Populate class options from db.classes
        if (classSelect) {
            let options = '<option value="">-- اختر القسم الرسمي --</option>';
            const classKeys = Object.keys(db.classes || {}).sort();
            classKeys.forEach(cls => {
                const count = (db.classes[cls] && Array.isArray(db.classes[cls])) ? db.classes[cls].length : 0;
                options += `<option value="${escapeTutoringHtml(cls)}">${escapeTutoringHtml(cls)} (${count} تلميذ)</option>`;
            });
            classSelect.innerHTML = options;
        }

        if (targetGroupInput) targetGroupInput.value = '';
        if (defaultFeeInput) defaultFeeInput.value = '80';
        if (countBadge) countBadge.textContent = 'تم تحديد: 0 تلميذ';
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 0.85rem; padding: 30px;">يرجى اختيار القسم لعرض قائمة التلاميذ المتاحين للاستيراد</div>';
        }

        modal.style.display = 'flex';
        setTimeout(() => { if (window.renderLucide) window.renderLucide(); }, 30);
    };

    window.closeBatchImportTutoringFromClassModal = function () {
        const modal = document.getElementById('tutoringBatchImportClassModal');
        if (modal) modal.style.display = 'none';
    };

    window.onBatchImportClassSelectChange = function () {
        const classSelect = document.getElementById('batchImportSourceClassSelect');
        const targetGroupInput = document.getElementById('batchImportTargetGroupName');
        const container = document.getElementById('batchImportStudentsContainer');
        const countBadge = document.getElementById('batchImportCountBadge');

        if (!classSelect || !container) return;

        const cls = classSelect.value;
        if (!cls || !db.classes[cls]) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 0.85rem; padding: 30px;">يرجى اختيار القسم لعرض قائمة التلاميذ المتاحين للاستيراد</div>';
            if (countBadge) countBadge.textContent = 'تم تحديد: 0 تلميذ';
            return;
        }

        // Auto-set suggested group name
        if (targetGroupInput && !targetGroupInput.value.trim()) {
            targetGroupInput.value = `مجموعة ${cls}`;
        }

        const studentsInClass = db.classes[cls] || [];
        const existingTutoringNames = new Set((db.tutoring.students || []).map(s => (s.name || '').trim().toLowerCase()));

        if (studentsInClass.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #64748b; font-size: 0.85rem; padding: 30px;">لا يوجد تلاميذ مسجلون في هذا القسم حتى الآن.</div>';
            if (countBadge) countBadge.textContent = 'تم تحديد: 0 تلميذ';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 6px;">';
        studentsInClass.forEach((st, idx) => {
            const stName = st.name || `تلميذ ${idx + 1}`;
            const isAlreadyAdded = existingTutoringNames.has(stName.trim().toLowerCase());
            const phone = st.phone || st.parentPhone || '';

            html += `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: ${isAlreadyAdded ? '#f8fafc' : '#ffffff'}; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: background 0.15s ease;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" class="batch-import-checkbox" data-index="${idx}" data-name="${escapeTutoringHtml(stName)}" data-phone="${escapeTutoringHtml(phone)}" onchange="updateBatchImportCount()" style="width: 17px; height: 17px; accent-color: #0284c7; cursor: pointer;" ${!isAlreadyAdded ? 'checked' : ''}>
                        <div>
                            <span style="font-weight: 700; color: #0f172a; font-size: 0.85rem;">${escapeTutoringHtml(stName)}</span>
                            ${st.studentCode ? `<span style="font-size: 0.72rem; color: #64748b; margin-right: 6px;">(${st.studentCode})</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${phone ? `<span style="font-size: 0.75rem; color: #059669; font-weight: bold;" dir="ltr">📞 ${phone}</span>` : '<span style="font-size: 0.72rem; color: #94a3b8;">بدون هاتف</span>'}
                        ${isAlreadyAdded ? '<span style="font-size: 0.7rem; background: #e0f2fe; color: #0369a1; padding: 1px 6px; border-radius: 4px; font-weight: bold;">مسجل سابقاً</span>' : ''}
                    </div>
                </label>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
        updateBatchImportCount();
    };

    window.toggleBatchImportSelectAll = function (selectAll) {
        const checkboxes = document.querySelectorAll('.batch-import-checkbox');
        checkboxes.forEach(cb => { cb.checked = selectAll; });
        updateBatchImportCount();
    };

    window.updateBatchImportCount = function () {
        const checkboxes = document.querySelectorAll('.batch-import-checkbox:checked');
        const countBadge = document.getElementById('batchImportCountBadge');
        if (countBadge) {
            countBadge.textContent = `تم تحديد: ${checkboxes.length} تلميذ`;
        }
    };

    window.submitBatchImportTutoringFromClass = function () {
        const classSelect = document.getElementById('batchImportSourceClassSelect');
        const targetGroupInput = document.getElementById('batchImportTargetGroupName');
        const defaultFeeInput = document.getElementById('batchImportDefaultFee');
        const checkedBoxes = document.querySelectorAll('.batch-import-checkbox:checked');

        const cls = classSelect ? classSelect.value : '';
        const groupName = targetGroupInput ? targetGroupInput.value.trim() : '';
        const defaultFee = defaultFeeInput ? parseFloat(defaultFeeInput.value) : 80;

        if (!cls) {
            alert('يرجى اختيار القسم الرسمي أولاً.');
            return;
        }
        if (checkedBoxes.length === 0) {
            alert('يرجى تحديد تلميذ واحد على الأقل للاستيراد.');
            return;
        }

        // Infer Moroccan level from class name
        let inferredLevel = '2BAC-PC';
        const upperCls = cls.toUpperCase();
        if (upperCls.includes('2BAC') || upperCls.includes('2 BAC')) {
            if (upperCls.includes('SM') || upperCls.includes('MATH')) inferredLevel = '2BAC-SM';
            else if (upperCls.includes('SVT')) inferredLevel = '2BAC-SVT';
            else if (upperCls.includes('ECO')) inferredLevel = '2BAC-ECO';
            else if (upperCls.includes('STE') || upperCls.includes('STM')) inferredLevel = '2BAC-STE';
            else inferredLevel = '2BAC-PC';
        } else if (upperCls.includes('1BAC') || upperCls.includes('1 BAC')) {
            if (upperCls.includes('SM')) inferredLevel = '1BAC-SM';
            else if (upperCls.includes('ECO')) inferredLevel = '1BAC-ECO';
            else inferredLevel = '1BAC-EX';
        } else if (upperCls.includes('TCL') || upperCls.includes('آداب')) {
            inferredLevel = 'TC-LSH';
        } else if (upperCls.includes('TC') || upperCls.includes('TCS') || upperCls.includes('TCT')) {
            inferredLevel = 'TC-SC';
        }

        if (!db.tutoring) db.tutoring = { students: [] };
        if (!db.tutoring.students) db.tutoring.students = [];

        let addedCount = 0;
        let updatedCount = 0;

        checkedBoxes.forEach(cb => {
            const stName = cb.getAttribute('data-name');
            const stPhone = cb.getAttribute('data-phone') || '';

            const existingStudent = db.tutoring.students.find(s => s.name && s.name.trim().toLowerCase() === stName.trim().toLowerCase());
            if (existingStudent) {
                if (groupName && !existingStudent.group) existingStudent.group = groupName;
                if (!existingStudent.phone && stPhone) existingStudent.phone = stPhone;
                if (!existingStudent.level) existingStudent.level = inferredLevel;
                updatedCount++;
            } else {
                db.tutoring.students.push({
                    id: 'tut_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    name: stName,
                    phone: stPhone,
                    group: groupName || `مجموعة ${cls}`,
                    level: inferredLevel,
                    fee: isNaN(defaultFee) ? 80 : defaultFee,
                    notes: `مستورد من قسم ${cls}`,
                    sessions: [],
                    payments: {}
                });
                addedCount++;
            }
        });

        saveDB();

        // Refresh UI
        if (typeof window.renderTutoringStudents === 'function') {
            window.renderTutoringStudents();
        }
        if (typeof window.renderTutoringAttendanceLedger === 'function') {
            window.renderTutoringAttendanceLedger();
        }
        if (typeof window.renderTutoringGroupsHub === 'function') {
            window.renderTutoringGroupsHub();
        }

        closeBatchImportTutoringFromClassModal();

        // Success Alert Toast
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:#0284c7;color:white;padding:12px 24px;border-radius:25px;z-index:99999;font-family:"Cairo",sans-serif;font-weight:bold;box-shadow:0 4px 14px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;';
        toast.innerHTML = `✓ تم استيراد ${addedCount} تلميذ جديد وتحديث ${updatedCount} تلميذ إلى مجموعة الدعم بنجاح!`;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3500);
    };

    // =========================================================================
    // 15. 5-AXIS EXPERT TUTORING UPGRADE ENGINE (Billing, ROI, Live Launcher, Expenses, QR & Parent Report)
    // =========================================================================

    function showTutoringExpertToast(msg, bg = '#059669') {
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:${bg};color:white;padding:12px 22px;border-radius:999px;z-index:100050;font-family:"Cairo",sans-serif;font-weight:800;font-size:0.88rem;box-shadow:0 8px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px;`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 3600);
    }

    // --- Axis 1: Toggle Billing Mode Input Fields in Student Modal ---
    window.toggleTutoringBillingModeFields = function (mode) {
        const hourlyBox = document.getElementById('tutoringBillingHourlyBox');
        const monthlyBox = document.getElementById('tutoringBillingMonthlyBox');
        const packBox = document.getElementById('tutoringBillingPackBox');
        if (hourlyBox) hourlyBox.style.display = (!mode || mode === 'hourly') ? 'block' : 'none';
        if (monthlyBox) monthlyBox.style.display = (mode === 'monthly_fixed') ? 'block' : 'none';
        if (packBox) packBox.style.display = (mode === 'session_pack') ? 'grid' : 'none';
    };

    // --- Hook Student Modal Open / Edit / Save & Payment Calculation ---
    function installTutoringExpertHooks() {
        if (window.__tutoringExpertHooksInstalled) return;
        window.__tutoringExpertHooksInstalled = true;

        // 1. Hook openAddTutoringStudentModal to reset new fields
        const origOpenAdd = window.openAddTutoringStudentModal;
        if (typeof origOpenAdd === 'function') {
            window.openAddTutoringStudentModal = function () {
                origOpenAdd.apply(this, arguments);
                const bm = document.getElementById('tutoringBillingMode');
                if (bm) bm.value = 'hourly';
                window.toggleTutoringBillingModeFields('hourly');
                ['tutoringMonthlyFixedFee', 'tutoringPackPrice', 'tutoringGradeBefore', 'tutoringGradeAfter', 'tutoringNextExamDate', 'tutoringNextExamTopic'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                const packSess = document.getElementById('tutoringPackSessions');
                if (packSess) packSess.value = '4';
                const disc = document.getElementById('tutoringDiscountPercent');
                if (disc) disc.value = '0';
            };
        }

        // 2. Hook editTutoringStudent to populate new fields
        const origEditStudent = window.editTutoringStudent;
        if (typeof origEditStudent === 'function') {
            window.editTutoringStudent = function (id) {
                origEditStudent.apply(this, arguments);
                const std = (db.tutoring && db.tutoring.students || []).find(s => s.id === id);
                if (!std) return;
                const mode = std.billingMode || 'hourly';
                const bm = document.getElementById('tutoringBillingMode');
                if (bm) bm.value = mode;
                window.toggleTutoringBillingModeFields(mode);

                const setVal = (elId, val) => {
                    const el = document.getElementById(elId);
                    if (el) el.value = (val !== undefined && val !== null) ? val : '';
                };
                setVal('tutoringMonthlyFixedFee', std.monthlyFixedFee || '');
                setVal('tutoringPackSessions', std.packSessions || 4);
                setVal('tutoringPackPrice', std.packPrice || '');
                setVal('tutoringDiscountPercent', std.discountPercent || 0);
                setVal('tutoringGradeBefore', std.gradeBefore !== undefined ? std.gradeBefore : '');
                setVal('tutoringGradeAfter', std.gradeAfter !== undefined ? std.gradeAfter : '');
                setVal('tutoringNextExamDate', std.nextExamDate || '');
                setVal('tutoringNextExamTopic', std.nextExamTopic || '');
            };
        }

        // 3. Hook saveTutoringStudent to persist flexible billing & pedagogical ROI fields
        const origSaveStudent = window.saveTutoringStudent;
        if (typeof origSaveStudent === 'function') {
            window.saveTutoringStudent = function () {
                const editId = (document.getElementById('tutoringStudentId') || {}).value;
                const nameVal = ((document.getElementById('tutoringName') || {}).value || '').trim();
                const billingMode = ((document.getElementById('tutoringBillingMode') || {}).value) || 'hourly';
                const monthlyFixedFee = parseFloat((document.getElementById('tutoringMonthlyFixedFee') || {}).value) || 0;
                const packSessions = parseInt((document.getElementById('tutoringPackSessions') || {}).value, 10) || 4;
                const packPrice = parseFloat((document.getElementById('tutoringPackPrice') || {}).value) || 0;
                const discountPercent = Math.min(100, Math.max(0, parseFloat((document.getElementById('tutoringDiscountPercent') || {}).value) || 0));
                const gradeBeforeRaw = (document.getElementById('tutoringGradeBefore') || {}).value;
                const gradeAfterRaw = (document.getElementById('tutoringGradeAfter') || {}).value;
                const nextExamDate = ((document.getElementById('tutoringNextExamDate') || {}).value || '').trim();
                const nextExamTopic = ((document.getElementById('tutoringNextExamTopic') || {}).value || '').trim();

                // Ensure #tutoringFee has a sensible fallback if monthly_fixed or session_pack is chosen
                const feeInput = document.getElementById('tutoringFee');
                if (feeInput && (!feeInput.value || parseFloat(feeInput.value) <= 0)) {
                    if (billingMode === 'monthly_fixed' && monthlyFixedFee > 0) {
                        feeInput.value = Math.round(monthlyFixedFee / 8) || 100;
                    } else if (billingMode === 'session_pack' && packPrice > 0) {
                        feeInput.value = Math.round(packPrice / (packSessions * 2)) || 100;
                    }
                }

                origSaveStudent.apply(this, arguments);

                if (db.tutoring && Array.isArray(db.tutoring.students)) {
                    let target = null;
                    if (editId) {
                        target = db.tutoring.students.find(s => s.id === editId);
                    } else if (nameVal) {
                        const matches = db.tutoring.students.filter(s => (s.name || '').trim() === nameVal);
                        target = matches[matches.length - 1];
                    }
                    if (target) {
                        target.billingMode = billingMode;
                        target.monthlyFixedFee = monthlyFixedFee;
                        target.packSessions = packSessions;
                        target.packPrice = packPrice;
                        target.discountPercent = discountPercent;
                        target.gradeBefore = (gradeBeforeRaw !== '' && gradeBeforeRaw !== undefined) ? parseFloat(gradeBeforeRaw) : '';
                        target.gradeAfter = (gradeAfterRaw !== '' && gradeAfterRaw !== undefined) ? parseFloat(gradeAfterRaw) : '';
                        target.nextExamDate = nextExamDate;
                        target.nextExamTopic = nextExamTopic;
                        saveDB();
                        if (typeof window.renderTutoringStudents === 'function') window.renderTutoringStudents();
                    }
                }
            };
        }

        // 4. Ensure getTutoringPaymentInfo includes paid/effectiveDue aliases and supports all billing modes
        const origGetPaymentInfo = window.getTutoringPaymentInfo;
        if (typeof origGetPaymentInfo === 'function') {
            window.getTutoringPaymentInfo = function (student, month, calculatedDue) {
                const info = origGetPaymentInfo.call(this, student, month, calculatedDue);
                if (info && typeof info === 'object') {
                    if (info.paid === undefined) info.paid = info.paidAmount || 0;
                    if (info.effectiveDue === undefined) info.effectiveDue = info.totalDue || 0;
                    if (!Array.isArray(info.installments)) info.installments = Array.isArray(info.history) ? info.history : [];
                }
                return info;
            };
        }

        // 5. Hook renderTutoringStudents to render the Smart Pedagogical & Billing Insights Strip + Student Row Badges
        const origRenderStudents = window.renderTutoringStudents;
        if (typeof origRenderStudents === 'function') {
            window.renderTutoringStudents = function () {
                origRenderStudents.apply(this, arguments);
                try {
                    renderTutoringSmartInsightsStrip();
                    decorateTutoringStudentRowsAndCards();
                } catch (err) {
                    console.warn('Tutoring smart insights render warning:', err);
                }
            };
        }
    }

    function getStudentPedagogicalBadgesHTML(std, month) {
        if (!std) return '';
        const badges = [];
        const mode = std.billingMode || 'hourly';
        const discount = parseFloat(std.discountPercent) || 0;
        const sessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(month) && s.attendance !== 'absent');

        if (mode === 'monthly_fixed') {
            badges.push(`<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:1px 7px;border-radius:99px;font-size:0.68rem;font-weight:800;">📅 شهري: ${std.monthlyFixedFee || std.fee || 0} د.م</span>`);
        } else if (mode === 'session_pack') {
            const packSize = parseInt(std.packSessions, 10) || 4;
            const rem = Math.max(0, packSize - sessions.length);
            const low = rem <= 1;
            badges.push(`<span style="background:${low ? '#fef2f2' : '#f0f9ff'};color:${low ? '#dc2626' : '#0369a1'};border:1px solid ${low ? '#fecaca' : '#bae6fd'};padding:1px 7px;border-radius:99px;font-size:0.68rem;font-weight:800;">📦 باقة: باقي ${rem}/${packSize} ح</span>`);
        }

        if (discount > 0) {
            badges.push(`<span style="background:#fffbeb;color:#b45309;border:1px solid #fde68a;padding:1px 6px;border-radius:99px;font-size:0.66rem;font-weight:800;">🏷️ إخوة/تخفيض -${discount}%</span>`);
        }

        const gb = parseFloat(std.gradeBefore);
        const ga = parseFloat(std.gradeAfter);
        if (!isNaN(gb) && !isNaN(ga)) {
            const delta = +(ga - gb).toFixed(2);
            const pos = delta >= 0;
            badges.push(`<span style="background:${pos ? '#dcfce7' : '#fee2e2'};color:${pos ? '#15803d' : '#b91c1c'};border:1px solid ${pos ? '#86efac' : '#fca5a5'};padding:1px 7px;border-radius:99px;font-size:0.68rem;font-weight:900;" title="النقطة قبل الدعم: ${gb}/20 | بعد الدعم: ${ga}/20">📈 ${pos ? '+' : ''}${delta} ن (${ga}/20)</span>`);
        }

        if (std.nextExamDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const exDate = new Date(std.nextExamDate + 'T00:00:00');
            const diffDays = Math.round((exDate - today) / 86400000);
            if (diffDays >= 0 && diffDays <= 10) {
                badges.push(`<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;padding:1px 7px;border-radius:99px;font-size:0.68rem;font-weight:800;" title="${std.nextExamTopic || 'فرض محروس قادم بمؤسسته'}">🎯 فرض بعد ${diffDays === 0 ? 'اليوم!' : diffDays + ' ي'}</span>`);
            }
        }

        return badges.length > 0 ? `<div class="tut-expert-badges" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${badges.join('')}</div>` : '';
    }

    function decorateTutoringStudentRowsAndCards() {
        const monthEl = document.getElementById('tutoringMonth');
        const month = (monthEl && monthEl.value) ? monthEl.value : new Date().toISOString().slice(0, 7);
        const students = (db.tutoring && Array.isArray(db.tutoring.students)) ? db.tutoring.students : [];
        if (!students.length) return;

        // Decorate table rows
        const tbody = document.getElementById('tutoringTableBody');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(tr => {
                if (tr.querySelector('.tut-expert-badges')) return;
                const profileLink = tr.querySelector('[onclick*="openTutoringStudentProfileModal"]');
                if (!profileLink) return;
                const m = (profileLink.getAttribute('onclick') || '').match(/openTutoringStudentProfileModal\(['"]([^'"]+)['"]\)/);
                if (!m) return;
                const std = students.find(s => s.id === m[1]);
                if (!std) return;
                const badgeHtml = getStudentPedagogicalBadgesHTML(std, month);
                if (badgeHtml) {
                    const firstTd = tr.querySelector('td');
                    if (firstTd) firstTd.insertAdjacentHTML('beforeend', badgeHtml);
                }
            });
        }
    }

    function renderTutoringSmartInsightsStrip() {
        const strip = document.getElementById('tutoringSmartInsightsStrip');
        if (!strip) return;
        const monthEl = document.getElementById('tutoringMonth');
        const month = (monthEl && monthEl.value) ? monthEl.value : new Date().toISOString().slice(0, 7);
        const students = (db.tutoring && Array.isArray(db.tutoring.students)) ? db.tutoring.students : [];

        // 1. Pedagogical ROI average
        let roiCount = 0;
        let roiSum = 0;
        let improvedCount = 0;
        // 2. Upcoming School Exams within 7 days
        const upcomingExams = [];
        // 3. Low/Depleted Session Packs
        const lowPacks = [];
        // 4. Net Profit after expenses
        let monthCollected = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        students.forEach(std => {
            const gb = parseFloat(std.gradeBefore);
            const ga = parseFloat(std.gradeAfter);
            if (!isNaN(gb) && !isNaN(ga)) {
                const d = ga - gb;
                roiSum += d;
                roiCount++;
                if (d > 0) improvedCount++;
            }

            if (std.nextExamDate) {
                const exDate = new Date(std.nextExamDate + 'T00:00:00');
                const diffDays = Math.round((exDate - today) / 86400000);
                if (diffDays >= 0 && diffDays <= 7) {
                    upcomingExams.push({ name: std.name, days: diffDays, topic: std.nextExamTopic || '' });
                }
            }

            const pInfo = window.getTutoringPaymentInfo ? window.getTutoringPaymentInfo(std, month) : { paidAmount: 0, paid: 0, totalDue: 0 };
            monthCollected += (parseFloat(pInfo.paidAmount ?? pInfo.paid) || 0);

            if (std.billingMode === 'session_pack') {
                const packSize = parseInt(std.packSessions, 10) || 4;
                const attended = ((std.sessions || []).filter(s => s.date && s.date.startsWith(month) && s.attendance !== 'absent')).length;
                const rem = Math.max(0, packSize - (attended % packSize || (attended > 0 ? packSize : 0)));
                if (rem <= 1) {
                    lowPacks.push({ name: std.name, rem, packSize });
                }
            }
        });

        const avgDelta = roiCount > 0 ? +(roiSum / roiCount).toFixed(2) : null;
        const expenses = (db.tutoring && Array.isArray(db.tutoring.expenses)) ? db.tutoring.expenses.filter(e => e.month === month) : [];
        const totalExp = Math.round(expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
        monthCollected = Math.round(monthCollected * 100) / 100;
        const netProfit = Math.round((monthCollected - totalExp) * 100) / 100;

        strip.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div>
                    <div style="font-size: 0.73rem; color: #166534; font-weight: 800;">📈 الأثر البيداغوجي للدعم (ROI)</div>
                    <div style="font-size: 0.92rem; font-weight: 900; color: #14532d; margin-top: 2px;">
                        ${avgDelta !== null ? `متوسط التحسن: ${avgDelta >= 0 ? '+' : ''}${avgDelta} نقطة (${improvedCount}/${roiCount} تلميذ)` : 'أدخل نقط قبل/بعد الدعم لقياس الأثر'}
                    </div>
                </div>
                <span style="font-size: 1.3rem;">🏆</span>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div>
                    <div style="font-size: 0.73rem; color: #b45309; font-weight: 800;">🎯 فروض محروسة قادمة للتلاميذ (7 أيام)</div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #78350f; margin-top: 2px;">
                        ${upcomingExams.length > 0 ? `${upcomingExams.length} تلاميذ: ${upcomingExams.slice(0, 2).map(e => `${e.name} (${e.days === 0 ? 'اليوم' : e.days + 'ي'})`).join('، ')}` : 'لا توجد فروض معلنة خلال هذا الأسبوع'}
                    </div>
                </div>
                <span style="font-size: 1.3rem;">📝</span>
            </div>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div>
                    <div style="font-size: 0.73rem; color: #0369a1; font-weight: 800;">📦 تتبع باقات الحصص (Pack Balance)</div>
                    <div style="font-size: 0.85rem; font-weight: 800; color: #0c4a6e; margin-top: 2px;">
                        ${lowPacks.length > 0 ? `⚠️ ${lowPacks.length} تلاميذ شارفت باقتهم على الانتهاء` : 'جميع باقات التلاميذ برصيد كافٍ'}
                    </div>
                </div>
                <span style="font-size: 1.3rem;">📦</span>
            </div>

            <div onclick="openTutoringExpensesModal('${month}')" style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer;" title="انقر لإدارة مصاريف الدعم وحساب الربح الصافي">
                <div>
                    <div style="font-size: 0.73rem; color: #0f766e; font-weight: 800;">💎 الربح الصافي لشهر ${month} (المحصل - المصاريف)</div>
                    <div style="font-size: 0.95rem; font-weight: 900; color: ${netProfit >= 0 ? '#047857' : '#dc2626'}; margin-top: 2px;">
                        ${netProfit} د.م <span style="font-size: 0.72rem; color: #64748b; font-weight: bold;">(محصل: ${monthCollected} | مصاريف: ${totalExp} د.م)</span>
                    </div>
                </div>
                <span style="font-size: 1.3rem;">💸</span>
            </div>
        `;
    }

    // --- Axis 3: 1-Click Live Group Session Launcher & WhatsApp Summary ---
    window.launchTodayQuickTutoringSession = function () {
        if (!db.tutoring) db.tutoring = { students: [], groups: [], scheduleSlots: [], schedule: [] };
        const todayDay = new Date().getDay();
        const modernSlots = (Array.isArray(db.tutoring.scheduleSlots) ? db.tutoring.scheduleSlots : []).filter(sl => parseInt(sl.day, 10) === todayDay);
        const legacySlots = (Array.isArray(db.tutoring.schedule) ? db.tutoring.schedule : []).filter(sl => parseInt(sl.dayIndex, 10) === [6, 0, 1, 2, 3, 4, 5][todayDay]);

        if (modernSlots.length > 0) {
            const slot = modernSlots[0];
            const groupName = slot.slotType === 'individual' ? (slot.studentName || slot.group) : (slot.group || '');
            const durationHours = window.calculateDurationHours ? window.calculateDurationHours(slot.startTime, slot.endTime) : 2;
            if (typeof window.openTutoringGroupSessionModal === 'function') {
                window.openTutoringGroupSessionModal(groupName);
                const hEl = document.getElementById('groupSessionHours');
                if (hEl) hEl.value = durationHours || '2';
                const tEl = document.getElementById('groupSessionTopic');
                if (tEl && (slot.pedagogicalFocus || slot.notes) && !tEl.value) {
                    tEl.value = slot.pedagogicalFocus || slot.notes || '';
                }
                showTutoringExpertToast(`⚡ تم تحميل حصة اليوم تلقائياً: ${groupName} (${slot.startTime} - ${slot.endTime})`, '#7c3aed');
                return;
            }
        } else if (legacySlots.length > 0) {
            const slot = legacySlots[0];
            if (typeof window.openTutoringGroupSessionModal === 'function') {
                window.openTutoringGroupSessionModal(slot.groupName || '');
                const hEl = document.getElementById('groupSessionHours');
                if (hEl && slot.duration) hEl.value = slot.duration;
                const tEl = document.getElementById('groupSessionTopic');
                if (tEl && slot.subject && !tEl.value) tEl.value = slot.subject;
                showTutoringExpertToast(`⚡ تم تحميل حصة اليوم تلقائياً: ${slot.groupName || 'مجموعة اليوم'}`, '#7c3aed');
                return;
            }
        }
        if (typeof window.openTutoringGroupSessionModal === 'function') {
            window.openTutoringGroupSessionModal();
        }
    };

    window.saveAndShareTutoringGroupSessionWhatsApp = function () {
        const grpSelect = document.getElementById('groupSessionSelect');
        const dateEl = document.getElementById('groupSessionDate');
        const hoursEl = document.getElementById('groupSessionHours');
        const topicEl = document.getElementById('groupSessionTopic');
        const hwEl = document.getElementById('groupSessionHomework');

        const grpName = grpSelect ? grpSelect.value : '';
        const dateVal = dateEl ? dateEl.value : new Date().toISOString().slice(0, 10);
        const hoursVal = hoursEl ? hoursEl.value : '2';
        const topicVal = (topicEl && topicEl.value.trim()) ? topicEl.value.trim() : 'حصة دعم وتقوية وتطبيقات منهجية';
        const hwVal = (hwEl && hwEl.value.trim()) ? hwEl.value.trim() : 'مراجعة فقرات الحصة وإنجاز التمارين التطبيقية المحددة';

        if (!grpName) {
            showTutoringExpertToast('⚠️ يرجى اختيار المجموعة أولاً قبل الحفظ والمشاركة', '#dc2626');
            return;
        }

        // Count present/absent before saving
        const cbs = document.querySelectorAll('.group-session-student-cb');
        let presentCount = 0;
        let absentCount = 0;
        cbs.forEach(cb => { if (cb.checked) presentCount++; else absentCount++; });

        if (typeof window.saveTutoringGroupSession === 'function') {
            window.saveTutoringGroupSession();
        }

        const teacherName = (db.settings && db.settings.teacherName) ? db.settings.teacherName : 'الأستاذ(ة)';
        const summaryText =
`📚 *ملخص حصة الدعم والواجب المنزلي*
━━━━━━━━━━━━━━━━━━
👥 *المجموعة:* ${grpName}
📅 *التاريخ:* ${dateVal} (المدة: ${hoursVal} س)
📖 *محور الحصة المنجز:* ${topicVal}
✍️ *الواجب المطلوب للحصة القادمة:* ${hwVal}
✅ *المواظبة:* حضور ${presentCount} تلميذ(ة)${absentCount > 0 ? ` | غياب ${absentCount}` : ''}
━━━━━━━━━━━━━━━━━━
مع تحيات ${teacherName} 🌟`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(summaryText).catch(() => {});
        }
        const waUrl = `https://wa.me/?text=${encodeURIComponent(summaryText)}`;
        window.open(waUrl, '_blank');
        showTutoringExpertToast('📲 تم حفظ الحصة ونسخ الملخص وفتح واتساب للمشاركة!');
    };

    // --- Axis 4: Tutoring Expenses & Net Profit Modal ---
    window.openTutoringExpensesModal = function (defaultMonth) {
        const monthEl = document.getElementById('tutoringMonth');
        const activeMonth = defaultMonth || (monthEl && monthEl.value) || new Date().toISOString().slice(0, 7);
        if (!db.tutoring) db.tutoring = { students: [], expenses: [] };
        if (!Array.isArray(db.tutoring.expenses)) db.tutoring.expenses = [];

        let modal = document.getElementById('tutoringExpensesLedgerModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'tutoringExpensesLedgerModal';
            modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.72);z-index:10025;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px);';
            document.body.appendChild(modal);
        }

        const renderModalContent = (selectedMonth) => {
            const allExp = db.tutoring.expenses || [];
            const monthExp = allExp.filter(e => e.month === selectedMonth);
            const totalMonthExp = Math.round(monthExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;
            const totalAllExp = Math.round(allExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0) * 100) / 100;

            let monthCollected = 0;
            let monthGrossDue = 0;
            (db.tutoring.students || []).forEach(st => {
                const p = window.getTutoringPaymentInfo ? window.getTutoringPaymentInfo(st, selectedMonth) : { paidAmount: 0, paid: 0, totalDue: 0 };
                monthCollected += (parseFloat(p.paidAmount ?? p.paid) || 0);
                monthGrossDue += (parseFloat(p.totalDue ?? p.effectiveDue) || 0);
            });
            monthCollected = Math.round(monthCollected * 100) / 100;
            monthGrossDue = Math.round(monthGrossDue * 100) / 100;
            const netProfit = Math.round((monthCollected - totalMonthExp) * 100) / 100;
            const expectedNetProfit = Math.round((monthGrossDue - totalMonthExp) * 100) / 100;

            modal.innerHTML = `
                <div class="card" style="width:100%;max-width:720px;max-height:92vh;overflow-y:auto;border-radius:16px;background:#fff;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0;font-size:1.15rem;font-weight:900;color:#0f766e;display:flex;align-items:center;gap:8px;">
                                <span>💸 سجل مصاريف الدعم والمحاسبة الصافية</span>
                            </h3>
                            <p style="margin:3px 0 0 0;font-size:0.78rem;color:#64748b;">الربح الصافي الفعلي = المداخيل المحصلة (${monthCollected} د.م) − المصاريف (${totalMonthExp} د.م)</p>
                        </div>
                        <button type="button" onclick="document.getElementById('tutoringExpensesLedgerModal').style.display='none'" style="background:#f1f5f9;border:none;width:34px;height:34px;border-radius:50%;font-weight:bold;cursor:pointer;">✕</button>
                    </div>

                    <!-- KPI Row -->
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;text-align:center;">
                        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px;">
                            <div style="font-size:0.72rem;color:#166534;font-weight:bold;">المداخيل المحصلة (${selectedMonth})</div>
                            <div style="font-size:1.2rem;font-weight:900;color:#15803d;">${monthCollected} د.م</div>
                            <div style="font-size:0.68rem;color:#16a34a;">من أصل ${monthGrossDue} د.م مستحق</div>
                        </div>
                        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px;">
                            <div style="font-size:0.72rem;color:#b45309;font-weight:bold;">مصاريف الشهر (${selectedMonth})</div>
                            <div style="font-size:1.2rem;font-weight:900;color:#d97706;">${totalMonthExp} د.م</div>
                            <div style="font-size:0.68rem;color:#b45309;">${monthExp.length} عملية مسجلة</div>
                        </div>
                        <div style="background:#f0fdfa;border:1.5px solid #5eead4;border-radius:10px;padding:10px;">
                            <div style="font-size:0.72rem;color:#0f766e;font-weight:800;">💎 الربح الصافي الفعلي</div>
                            <div style="font-size:1.2rem;font-weight:900;color:${netProfit >= 0 ? '#047857' : '#dc2626'};">${netProfit} د.م</div>
                            <div style="font-size:0.68rem;color:#0f766e;">بعد خصم المصاريف من المحصل</div>
                        </div>
                        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;">
                            <div style="font-size:0.72rem;color:#1e40af;font-weight:bold;">الربح الصافي المتوقع (100%)</div>
                            <div style="font-size:1.2rem;font-weight:900;color:${expectedNetProfit >= 0 ? '#1d4ed8' : '#dc2626'};">${expectedNetProfit} د.م</div>
                            <div style="font-size:0.68rem;color:#2563eb;">عند تحصيل كافة المستحقات</div>
                        </div>
                    </div>

                    <!-- Add Expense Form -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:16px;">
                        <div style="font-weight:800;font-size:0.84rem;color:#1e293b;margin-bottom:10px;">➕ إضافة مصروف جديد:</div>
                        <div style="display:grid;grid-template-columns:1.1fr 1.2fr 0.9fr 0.9fr auto;gap:8px;align-items:end;">
                            <div>
                                <label style="font-size:0.72rem;margin-bottom:2px;">التصنيف:</label>
                                <select id="tutExpCategory" style="margin:0;padding:7px;font-size:0.8rem;">
                                    <option value="نسخ وطبع السلاسل">🖨️ نسخ وطبع السلاسل</option>
                                    <option value="أقلام ووسائل تعليمية">🖊️ أقلام ووسائل تعليمية</option>
                                    <option value="واجب قاعة / مركز">🏫 واجب قاعة / مركز</option>
                                    <option value="تنقل ومحروقات">🚗 تنقل ومحروقات</option>
                                    <option value="مصاريف أخرى">📦 مصاريف أخرى</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.72rem;margin-bottom:2px;">بيان المصروف:</label>
                                <input type="text" id="tutExpTitle" placeholder="مثال: طبع 40 نسخة سلسلة الدوال..." style="margin:0;padding:7px;font-size:0.8rem;">
                            </div>
                            <div>
                                <label style="font-size:0.72rem;margin-bottom:2px;">المبلغ (د.م):</label>
                                <input type="number" id="tutExpAmount" placeholder="50" min="1" step="5" style="margin:0;padding:7px;font-size:0.8rem;">
                            </div>
                            <div>
                                <label style="font-size:0.72rem;margin-bottom:2px;">الشهر:</label>
                                <input type="month" id="tutExpMonth" value="${selectedMonth}" onchange="window.__rerenderTutoringExpModal(this.value)" style="margin:0;padding:6px;font-size:0.8rem;">
                            </div>
                            <button type="button" onclick="window.addTutoringExpenseItem()" style="background:#0f766e;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;height:36px;">+ تسجيل</button>
                        </div>
                    </div>

                    <!-- Expenses List -->
                    <div style="max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:10px;">
                        ${monthExp.length === 0 ? `
                            <div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85rem;">لا توجد مصاريف مسجلة لشهر ${selectedMonth}.</div>
                        ` : `
                            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
                                <thead>
                                    <tr style="background:#f1f5f9;color:#334155;text-align:right;">
                                        <th style="padding:8px 10px;">التصنيف</th>
                                        <th style="padding:8px 10px;">البيان</th>
                                        <th style="padding:8px 10px;">التاريخ</th>
                                        <th style="padding:8px 10px;">المبلغ</th>
                                        <th style="padding:8px 10px;text-align:center;">حذف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthExp.slice().reverse().map(e => `
                                        <tr style="border-top:1px solid #f1f5f9;">
                                            <td style="padding:8px 10px;font-weight:bold;color:#0f766e;">${e.category || '-'}</td>
                                            <td style="padding:8px 10px;color:#1e293b;">${e.title || '-'}</td>
                                            <td style="padding:8px 10px;color:#64748b;font-size:0.75rem;">${e.date || e.month}</td>
                                            <td style="padding:8px 10px;font-weight:900;color:#b45309;">${e.amount} د.م</td>
                                            <td style="padding:8px 10px;text-align:center;">
                                                <button type="button" onclick="window.deleteTutoringExpenseItem('${e.id}', '${selectedMonth}')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:2px 8px;font-size:0.72rem;cursor:pointer;">حذف</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `}
                    </div>
                    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:#64748b;">
                        <span>إجمالي المصاريف التراكمية لكل الأشهر: <b>${totalAllExp} د.م</b></span>
                        <button type="button" onclick="document.getElementById('tutoringExpensesLedgerModal').style.display='none'" style="background:#e2e8f0;color:#334155;border:none;padding:7px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">إغلاق</button>
                    </div>
                </div>
            `;
        };

        window.__rerenderTutoringExpModal = renderModalContent;
        renderModalContent(activeMonth);
        modal.style.display = 'flex';
    };

    window.addTutoringExpenseItem = function () {
        const cat = (document.getElementById('tutExpCategory') || {}).value || 'نسخ وطبع السلاسل';
        const title = ((document.getElementById('tutExpTitle') || {}).value || '').trim() || cat;
        const amount = parseFloat((document.getElementById('tutExpAmount') || {}).value);
        const month = ((document.getElementById('tutExpMonth') || {}).value) || new Date().toISOString().slice(0, 7);

        if (isNaN(amount) || amount <= 0) {
            showTutoringExpertToast('⚠️ يرجى إدخال مبلغ مصروف صحيح', '#dc2626');
            return;
        }
        if (!db.tutoring) db.tutoring = { students: [], expenses: [] };
        if (!Array.isArray(db.tutoring.expenses)) db.tutoring.expenses = [];
        db.tutoring.expenses.push({
            id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            category: cat,
            title: title,
            amount: amount,
            month: month,
            date: new Date().toISOString().slice(0, 10)
        });
        saveDB();
        if (typeof window.__rerenderTutoringExpModal === 'function') window.__rerenderTutoringExpModal(month);
        if (typeof window.renderTutoringStudents === 'function') window.renderTutoringStudents();
        if (typeof window.renderTutoringAnalytics === 'function') window.renderTutoringAnalytics();
        showTutoringExpertToast('✓ تم تسجيل المصروف وتحديث الربح الصافي بنجاح');
    };

    window.deleteTutoringExpenseItem = function (expId, month) {
        if (!db.tutoring || !Array.isArray(db.tutoring.expenses)) return;
        db.tutoring.expenses = db.tutoring.expenses.filter(e => e.id !== expId);
        saveDB();
        if (typeof window.__rerenderTutoringExpModal === 'function') window.__rerenderTutoringExpModal(month);
        if (typeof window.renderTutoringStudents === 'function') window.renderTutoringStudents();
        if (typeof window.renderTutoringAnalytics === 'function') window.renderTutoringAnalytics();
    };

    // --- Axis 2B: Group Series & Worksheets Tracker Modal ---
    window.openGroupSeriesTrackerModal = function (groupName) {
        if (!groupName) return;
        if (!db.tutoring) db.tutoring = { students: [] };
        if (!db.tutoring.groupSeries) db.tutoring.groupSeries = {};
        if (!Array.isArray(db.tutoring.groupSeries[groupName])) db.tutoring.groupSeries[groupName] = [];

        let modal = document.getElementById('tutoringGroupSeriesModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'tutoringGroupSeriesModal';
            modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.72);z-index:10026;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px);';
            document.body.appendChild(modal);
        }

        const renderSeries = () => {
            const list = db.tutoring.groupSeries[groupName] || [];
            modal.innerHTML = `
                <div class="card" style="width:100%;max-width:650px;max-height:92vh;overflow-y:auto;border-radius:16px;background:#fff;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);">
                    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0;font-size:1.12rem;font-weight:900;color:#0369a1;">📚 سجل السلاسل والتمارين والفروض التجريبية — ${groupName}</h3>
                            <p style="margin:3px 0 0 0;font-size:0.78rem;color:#64748b;">تتبع السلاسل الموزعة على المجموعة وحالة تصحيحها لضمان عدم تكرار أو نسيان أي تمرين</p>
                        </div>
                        <button type="button" onclick="document.getElementById('tutoringGroupSeriesModal').style.display='none'" style="background:#f1f5f9;border:none;width:34px;height:34px;border-radius:50%;font-weight:bold;cursor:pointer;">✕</button>
                    </div>

                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:16px;display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;align-items:end;">
                        <div>
                            <label style="font-size:0.74rem;margin-bottom:2px;">عنوان السلسلة أو الفرض التجريبي:</label>
                            <input type="text" id="grpSeriesTitle" placeholder="مثال: سلسلة رقم 3 - الاتصال والاشتقاق" style="margin:0;padding:7px;font-size:0.82rem;">
                        </div>
                        <div>
                            <label style="font-size:0.74rem;margin-bottom:2px;">عدد التمارين / الحالة:</label>
                            <input type="text" id="grpSeriesMeta" placeholder="مثال: 6 تمارين (تم تصحيح 4)" style="margin:0;padding:7px;font-size:0.82rem;">
                        </div>
                        <div>
                            <label style="font-size:0.74rem;margin-bottom:2px;">الحالة:</label>
                            <select id="grpSeriesStatus" style="margin:0;padding:7px;font-size:0.82rem;">
                                <option value="in_progress">⏳ قيد الإنجاز والتصحيح</option>
                                <option value="completed">✅ مكتملة ومصححة بالكامل</option>
                            </select>
                        </div>
                        <button type="button" onclick="window.addGroupSeriesItem('${groupName.replace(/'/g, "\\'")}')" style="background:#0284c7;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;height:36px;">+ إضافة</button>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
                        ${list.length === 0 ? `<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85rem;">لم يتم تسجيل أي سلسلة لهذه المجموعة بعد.</div>` : list.slice().reverse().map(item => `
                            <div style="background:${item.status === 'completed' ? '#f0fdf4' : '#fff'};border:1px solid ${item.status === 'completed' ? '#bbf7d0' : '#e2e8f0'};border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;">
                                <div>
                                    <div style="font-weight:800;font-size:0.88rem;color:#0f172a;">${item.title}</div>
                                    <div style="font-size:0.75rem;color:#64748b;margin-top:2px;">📅 ${item.date || '-'} • ${item.meta || 'سلسلة دعم'}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <button type="button" onclick="window.toggleGroupSeriesStatus('${groupName.replace(/'/g, "\\'")}', '${item.id}')" style="background:${item.status === 'completed' ? '#dcfce7' : '#fef3c7'};color:${item.status === 'completed' ? '#166534' : '#92400e'};border:none;padding:4px 10px;border-radius:99px;font-size:0.74rem;font-weight:800;cursor:pointer;">
                                        ${item.status === 'completed' ? '✅ مكتملة' : '⏳ قيد التصحيح'}
                                    </button>
                                    <button type="button" onclick="window.deleteGroupSeriesItem('${groupName.replace(/'/g, "\\'")}', '${item.id}')" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;padding:4px 8px;font-size:0.72rem;cursor:pointer;">حذف</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };
        window.__rerenderGroupSeriesModal = renderSeries;
        renderSeries();
        modal.style.display = 'flex';
    };

    window.addGroupSeriesItem = function (groupName) {
        const title = ((document.getElementById('grpSeriesTitle') || {}).value || '').trim();
        const meta = ((document.getElementById('grpSeriesMeta') || {}).value || '').trim();
        const status = ((document.getElementById('grpSeriesStatus') || {}).value) || 'in_progress';
        if (!title) {
            showTutoringExpertToast('⚠️ يرجى إدخال عنوان السلسلة أو الفرض التجريبي', '#dc2626');
            return;
        }
        if (!db.tutoring.groupSeries) db.tutoring.groupSeries = {};
        if (!Array.isArray(db.tutoring.groupSeries[groupName])) db.tutoring.groupSeries[groupName] = [];
        db.tutoring.groupSeries[groupName].push({
            id: 'ser_' + Date.now(),
            title,
            meta,
            status,
            date: new Date().toISOString().slice(0, 10)
        });
        saveDB();
        if (typeof window.__rerenderGroupSeriesModal === 'function') window.__rerenderGroupSeriesModal();
        if (typeof window.renderTutoringGroupsHub === 'function') window.renderTutoringGroupsHub();
        showTutoringExpertToast('📚 تمت إضافة السلسلة إلى سجل المجموعة');
    };

    window.toggleGroupSeriesStatus = function (groupName, itemId) {
        const list = (db.tutoring && db.tutoring.groupSeries && db.tutoring.groupSeries[groupName]) || [];
        const item = list.find(x => x.id === itemId);
        if (item) {
            item.status = item.status === 'completed' ? 'in_progress' : 'completed';
            saveDB();
            if (typeof window.__rerenderGroupSeriesModal === 'function') window.__rerenderGroupSeriesModal();
        }
    };

    window.deleteGroupSeriesItem = function (groupName, itemId) {
        if (!db.tutoring || !db.tutoring.groupSeries || !db.tutoring.groupSeries[groupName]) return;
        db.tutoring.groupSeries[groupName] = db.tutoring.groupSeries[groupName].filter(x => x.id !== itemId);
        saveDB();
        if (typeof window.__rerenderGroupSeriesModal === 'function') window.__rerenderGroupSeriesModal();
        if (typeof window.renderTutoringGroupsHub === 'function') window.renderTutoringGroupsHub();
    };

    // --- Axis 5A: Smart Student Membership Card (QR) ---
    window.printStudentTutoringQrCard = function (studentId) {
        const std = (db.tutoring && db.tutoring.students || []).find(s => s.id === studentId);
        if (!std) return;
        const teacherName = (db.settings && db.settings.teacherName) ? db.settings.teacherName : 'الأستاذ(ة)';
        const subjectName = (db.settings && db.settings.subject) ? db.settings.subject : 'الرياضيات والعلوم';
        const qrPayload = encodeURIComponent(`TUTORING-ID:${std.id}|NAME:${std.name}|GROUP:${std.group || 'فردي'}|LEVEL:${std.level || '-'}`);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${qrPayload}`;

        let modal = document.getElementById('tutoringQrCardModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'tutoringQrCardModal';
            modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:10030;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
            document.body.appendChild(modal);
        }

        const billingLabel = std.billingMode === 'monthly_fixed'
            ? `شهري ثابت (${std.monthlyFixedFee || std.fee || 300} د.م)`
            : (std.billingMode === 'session_pack' ? `باقة ${std.packSessions || 4} حصص` : `بالساعة (${std.fee || 100} د.م/س)`);

        modal.innerHTML = `
            <div class="card" style="width:100%;max-width:460px;background:#fff;border-radius:18px;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);">
                <div id="printableTutoringQrCardArea" style="border:2px solid #1e3a8a;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);font-family:'Cairo',sans-serif;">
                    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:0.72rem;color:#bfdbfe;font-weight:bold;">بطاقة الانخراط والمواظبة في حصص الدعم</div>
                            <div style="font-size:1.05rem;font-weight:900;">فضاء التميز للدعم التربوي</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.18);padding:4px 10px;border-radius:8px;font-size:0.75rem;font-weight:bold;">${subjectName}</div>
                    </div>
                    <div style="padding:18px;display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:center;">
                        <div style="font-size:0.84rem;color:#1e293b;display:flex;flex-direction:column;gap:6px;">
                            <div><span style="color:#64748b;font-size:0.74rem;">الاسم الكامل:</span><div style="font-weight:900;font-size:1rem;color:#0f172a;">${std.name}</div></div>
                            <div><span style="color:#64748b;font-size:0.74rem;">المجموعة / المستوى:</span><div style="font-weight:800;color:#1d4ed8;">${std.group || 'دعم فردي'} • ${std.level || 'عام'}</div></div>
                            <div><span style="color:#64748b;font-size:0.74rem;">نظام الانخراط:</span><div style="font-weight:800;color:#047857;">${billingLabel}</div></div>
                            <div><span style="color:#64748b;font-size:0.74rem;">إشراف:</span><div style="font-weight:700;">${teacherName}</div></div>
                        </div>
                        <div style="text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;">
                            <img src="${qrUrl}" alt="QR" style="width:115px;height:115px;display:block;margin:0 auto;" />
                            <div style="font-size:0.65rem;color:#64748b;margin-top:4px;font-family:monospace;">#${std.id.slice(-6).toUpperCase()}</div>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="button" onclick="const area=document.getElementById('printableTutoringQrCardArea'); if(area && window.openCustomPrintPreviewModal){ window.openCustomPrintPreviewModal('<div style=&quot;max-width:440px;margin:20px auto;&quot;>'+area.outerHTML+'</div>', {title:'بطاقة_الانخراط_QR', orientation:'portrait', subtitle:'بطاقة الانخراط والمواظبة الذكية لتلميذ الدعم التربوي'}); } else if(area && window.printDocumentDirectly){ window.printDocumentDirectly(area.outerHTML, 'بطاقة_الانخراط_QR', 'portrait'); }" style="flex:1;background:#1d4ed8;color:#fff;border:none;padding:10px;border-radius:10px;font-weight:800;cursor:pointer;">🖨️ معاينة وطباعة البطاقة (A4 / PDF)</button>
                    <button type="button" onclick="document.getElementById('tutoringQrCardModal').style.display='none'" style="padding:10px 18px;background:#e2e8f0;color:#334155;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">إغلاق</button>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    };

    // --- Axis 5B: Parent Monthly Report Card via WhatsApp ---
    window.sendParentMonthlyReportWhatsApp = function (studentId, activeMonth) {
        const std = (db.tutoring && db.tutoring.students || []).find(s => s.id === studentId);
        if (!std) return;
        const month = activeMonth || ((document.getElementById('tutoringMonth') || {}).value) || new Date().toISOString().slice(0, 7);
        const sessions = (std.sessions || []).filter(s => s.date && s.date.startsWith(month));
        const attended = sessions.filter(s => s.attendance !== 'absent');
        const absent = sessions.filter(s => s.attendance === 'absent');
        const totalHours = attended.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
        const payInfo = window.getTutoringPaymentInfo ? window.getTutoringPaymentInfo(std, month) : { totalDue: 0, effectiveDue: 0, paidAmount: 0, paid: 0, remaining: 0 };
        const effDue = payInfo.totalDue ?? payInfo.effectiveDue ?? 0;
        const effPaid = payInfo.paidAmount ?? payInfo.paid ?? 0;

        const gb = parseFloat(std.gradeBefore);
        const ga = parseFloat(std.gradeAfter);
        const progressLine = (!isNaN(gb) && !isNaN(ga))
            ? `\n📈 *تطور النقطة:* من ${gb}/20 قبل الدعم إلى *${ga}/20* (${ga - gb >= 0 ? '+' : ''}${(ga - gb).toFixed(2)} نقطة)`
            : '';
        const examLine = std.nextExamDate
            ? `\n🎯 *الفرض القادم بمؤسسته:* يوم ${std.nextExamDate}${std.nextExamTopic ? ` (${std.nextExamTopic})` : ''}`
            : '';

        const msg =
`📊 *التقرير الشهري للمواظبة والتتبع التربوي (${month})*
━━━━━━━━━━━━━━━━━━
👤 *التلميذ(ة):* ${std.name}
🏫 *المجموعة:* ${std.group || 'حصص فردية'} (${std.level || 'عام'})
⏱️ *الحصص المنجزة:* ${attended.length} حصص (${totalHours} ساعة)${absent.length > 0 ? ` | الغياب: ${absent.length}` : ' | مواظبة ممتازة 100%'}${progressLine}${examLine}
💳 *الوضعية المالية للشهر:* المستحق ${effDue} د.م | المؤدى ${effPaid} د.م | المتبقي ${payInfo.remaining || 0} د.م
${std.notes ? `📝 *ملاحظة تربوية:* ${std.notes}\n` : ''}━━━━━━━━━━━━━━━━━━
شكراً لتعاونكم وحرصكم على تتبع مسار ابنكم/ابنتكم 🌟`;

        let cleanPhone = (std.phone || '').replace(/\s+/g, '').replace(/[^0-9+]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '212' + cleanPhone.slice(1);
        const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    // Initialize hooks when DOM is ready and after short delay
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(installTutoringExpertHooks, 150));
    } else {
        setTimeout(installTutoringExpertHooks, 150);
    }

})();


