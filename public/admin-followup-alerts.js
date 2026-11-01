/**
 * ====================================================================
 * نظام إشعارات تتبع كشوفات المتابعة الإدارية وتنبيهات تأخر الرد (48 ساعة)
 * Admin Follow-up Slips & 48-Hour Delay Notification System
 * ====================================================================
 * يتيح للأستاذ توثيق كشوفات المتابعة والإنذار المبكر المرسلة إلى الإدارة
 * التربوية (الحراسة العامة / إدارة المؤسسة)، ورصد مدة المعالجة تلقائياً،
 * مع إطلاق تنبيه فوري وبارز داخل لوحة القيادة في حال انقضاء أكثر من 48 ساعة
 * دون التوصل برد أو استدعاء للتلاميذ، مع إمكانية توجيه تذكير مباشر وتوثيق ردود الإدارة.
 */

(function (window) {
    'use strict';

    const DELAY_THRESHOLD_HOURS = 48; // عتبة تأخر الرد (48 ساعة)
    let currentFollowUpFilter = 'all'; // 'all' | 'delayed' | 'pending' | 'responded'

    /**
     * التهيئة الأولية لسجل كشوفات المتابعة الإدارية
     */
    function initAdminFollowUpData() {
        if (!window.db) return;
        if (!window.db.adminFollowUpSlips || !Array.isArray(window.db.adminFollowUpSlips)) {
            window.db.adminFollowUpSlips = [];
        }

        // في حال كان السجل فارغاً عند أول تشغيل، نقوم بتجهيز نموذج تجريبي واقعي
        // أحدهما أُرسل منذ أكثر من 48 ساعة (52 ساعة) لتمكين الأستاذ من معاينة نظام التنبيه واختباره فوراً
        if (window.db.adminFollowUpSlips.length === 0) {
            const now = Date.now();
            const classesList = window.db.classes ? Object.keys(window.db.classes) : [];
            const primaryClass = classesList[0] || '2 باك علوم رياضية (أ)';
            const secondaryClass = classesList[1] || '1 باك علوم تجريبية (1)';
            const tpSeed = (window.db && (window.db.teacherProfile || window.db.profile)) || {};
            const teacherName = tpSeed.name || 'أستاذ المادة';

            window.db.adminFollowUpSlips = [
                {
                    id: 'slip_seed_delayed_1',
                    slipNumber: 'KM-2609-01',
                    title: 'كشف المتابعة الإداري وحالات الإنذار المبكر',
                    className: primaryClass,
                    sentAt: new Date(now - 53 * 3600 * 1000).toISOString(), // 53 ساعة مضت (> 48 ساعة)
                    sentBy: teacherName,
                    targetOffice: 'الحراسة العامة للخارجية',
                    channel: 'تسليم ورقي مع تأشيرة الاستلام',
                    studentsCount: 4,
                    criticalCount: 2,
                    urgency: 'high',
                    status: 'pending',
                    reminderCount: 0,
                    remindedAt: null,
                    notes: 'إحالة عاجلة: تلاميذ متجاوزون لعتبة الغياب غير المبرر (أكثر من 8 ساعات) وسلوك مشوش يستدعي توجيه استدعاء رسمي لأولياء الأمور.',
                    createdAt: new Date(now - 53 * 3600 * 1000).toISOString()
                },
                {
                    id: 'slip_seed_pending_2',
                    slipNumber: 'KM-2609-02',
                    title: 'كشف تتبع إهمال الواجبات والتأخرات المتكررة',
                    className: secondaryClass,
                    sentAt: new Date(now - 18 * 3600 * 1000).toISOString(), // 18 ساعة مضت (< 48 ساعة)
                    sentBy: teacherName,
                    targetOffice: 'إدارة المؤسسة',
                    channel: 'واتساب الإدارة التربوية',
                    studentsCount: 3,
                    criticalCount: 0,
                    urgency: 'medium',
                    status: 'pending',
                    reminderCount: 0,
                    remindedAt: null,
                    notes: 'تقرير دوري لرصد حالات إهمال إنجاز الواجبات والتأخر الصباحي قصد التنسيق والتنبيه.',
                    createdAt: new Date(now - 18 * 3600 * 1000).toISOString()
                },
                {
                    id: 'slip_seed_responded_3',
                    slipNumber: 'KM-2609-03',
                    title: 'كشف حالات الغياب غير المبرر - الأسبوع المنصرم',
                    className: primaryClass,
                    sentAt: new Date(now - 120 * 3600 * 1000).toISOString(), // 5 أيام مضت
                    sentBy: teacherName,
                    targetOffice: 'الحراسة العامة للخارجية',
                    channel: 'تسليم ورقي مع تأشيرة الاستلام',
                    studentsCount: 2,
                    criticalCount: 1,
                    urgency: 'high',
                    status: 'responded',
                    reminderCount: 1,
                    remindedAt: new Date(now - 70 * 3600 * 1000).toISOString(),
                    notes: 'كشف متابعة أسبوعي للتلاميذ المتغيبين بدون إذن.',
                    createdAt: new Date(now - 120 * 3600 * 1000).toISOString(),
                    response: {
                        respondedAt: new Date(now - 48 * 3600 * 1000).toISOString(),
                        decision: 'استدعاء ولي الأمر وتوقيع التزام بالانضباط',
                        referenceNumber: 'إداري/2026/104',
                        notes: 'حضر ولي الأمر إلى مكتب الحراسة العامة وتم توقيع التزام خطي بالمواظبة وتعويض الساعات الضائعة.'
                    }
                }
            ];

            if (typeof window.saveDB === 'function') window.saveDB();
        }
    }

    /**
     * استخراج بيانات كشوفات المتابعة وحساب فترات التأخر عن الأجل (48 ساعة)
     */
    function getAdminFollowUpMetrics() {
        initAdminFollowUpData();
        const slips = (window.db && window.db.adminFollowUpSlips) ? window.db.adminFollowUpSlips : [];
        const now = Date.now();

        const processed = slips.map(slip => {
            const sentTime = new Date(slip.sentAt).getTime();
            const elapsedMs = Math.max(0, now - sentTime);
            const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
            const elapsedDays = Math.floor(elapsedHours / 24);
            const remainingHoursInDay = elapsedHours % 24;

            // هل تأخرت الإدارة عن الرد؟ (الكشف معلق ومضت أكثر من 48 ساعة)
            const isPending = (slip.status === 'pending' || slip.status === 'reminded');
            const isDelayed = isPending && (elapsedHours >= DELAY_THRESHOLD_HOURS);
            const delayOverdueHours = isDelayed ? (elapsedHours - DELAY_THRESHOLD_HOURS) : 0;

            // صياغة النص الزمني بالعربية
            let timeElapsedText = '';
            if (elapsedDays > 0) {
                timeElapsedText = `منذ ${elapsedDays} ${elapsedDays === 1 ? 'يوم' : (elapsedDays === 2 ? 'يومين' : 'أيام')}${remainingHoursInDay > 0 ? ` و${remainingHoursInDay} س` : ''} (${elapsedHours} ساعة)`;
            } else {
                timeElapsedText = `منذ ${elapsedHours} ساعة`;
            }

            return {
                ...slip,
                elapsedHours,
                elapsedDays,
                isPending,
                isDelayed,
                delayOverdueHours,
                timeElapsedText
            };
        });

        // ترتيب الكشوفات: المتأخرة أولاً، ثم المعلقة، ثم الأحدث
        processed.sort((a, b) => {
            if (a.isDelayed !== b.isDelayed) return a.isDelayed ? -1 : 1;
            if (a.isPending !== b.isPending) return a.isPending ? -1 : 1;
            return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
        });

        const delayedSlips = processed.filter(s => s.isDelayed);
        const pendingSlips = processed.filter(s => s.isPending && !s.isDelayed);
        const respondedSlips = processed.filter(s => s.status === 'responded');

        return {
            allSlips: processed,
            delayedSlips,
            pendingSlips,
            respondedSlips,
            totalCount: processed.length,
            delayedCount: delayedSlips.length,
            pendingCount: pendingSlips.length,
            respondedCount: respondedSlips.length
        };
    }

    /**
     * رندرة وتحديث نظام الإشعارات بالكامل داخل لوحة القيادة
     */
    function renderAdminFollowUpNotifications() {
        const metrics = getAdminFollowUpMetrics();

        // 1. بانر التنبيه الإداري العاجل (في أعلى لوحة القيادة)
        renderAdminFollowUpDelayAlertBanner(metrics);

        // 2. المركز والجدول الشامل لتتبع الكشوفات والردود
        renderAdminFollowUpHub(metrics);

        // 3. تحديث شارات العداد
        updateFollowUpBadges(metrics);

        if (window.renderLucide) {
            window.renderLucide();
        }
    }

    /**
     * رندرة بانر التنبيه العاجل (يظهر فقط إذا كان هناك كشف متأخر > 48 ساعة)
     */
    function renderAdminFollowUpDelayAlertBanner(metrics) {
        let banner = document.getElementById('dashAdminFollowUpDelayAlert');
        if (banner) {
            banner.style.display = 'none';
            banner.innerHTML = '';
        }
    }

    /**
     * رندرة مركز وسجل كشوفات المتابعة الشامل داخل لوحة القيادة
     */
    function renderAdminFollowUpHub(metrics) {
        let hub = document.getElementById('dashAdminFollowUpHub');
        if (!hub) {
            const parent = document.getElementById('dashboardView');
            if (!parent) return;

            hub = document.createElement('div');
            hub.id = 'dashAdminFollowUpHub';

            // وضعه قبل الخط الزمني (Chronological Timeline)
            const timelineCard = document.querySelector('#dashboardView .card:has(#dashChronologicalTimelineContainer)');
            if (timelineCard) {
                parent.insertBefore(hub, timelineCard);
            } else {
                parent.appendChild(hub);
            }
        }

        hub.className = 'card hide-in-presentation';
        hub.style.padding = '18px 20px';
        hub.style.marginBottom = '16px';
        hub.style.border = '1px solid #e2e8f0';
        hub.style.background = '#ffffff';
        hub.style.borderRadius = '12px';

        // تطبيق الفلتر المحدد
        let filteredSlips = metrics.allSlips;
        if (currentFollowUpFilter === 'delayed') {
            filteredSlips = metrics.delayedSlips;
        } else if (currentFollowUpFilter === 'pending') {
            filteredSlips = metrics.allSlips.filter(s => s.isPending && !s.isDelayed);
        } else if (currentFollowUpFilter === 'responded') {
            filteredSlips = metrics.respondedSlips;
        }

        let tableRowsHtml = '';
        if (filteredSlips.length === 0) {
            tableRowsHtml = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 24px; color: #64748b; font-size: 0.84rem; background: #f8fafc;">
                        لا توجد كشوفات متابعة مطابقة لهذا التصنيف حالياً.
                    </td>
                </tr>
            `;
        } else {
            filteredSlips.forEach((slip, idx) => {
                let statusBadge = '';
                if (slip.status === 'responded') {
                    statusBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">
                            <span data-lucide="check-circle" data-size="12"></span>
                            <span>تم الرد والمعالجة</span>
                        </span>
                    `;
                } else if (slip.isDelayed) {
                    statusBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 4px; background: #fee2e2; color: #b91c1c; border: 1.5px solid #f87171; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 900; box-shadow: 0 1px 3px rgba(220,38,38,0.2);">
                            <span class="pulsing-red-dot"></span>
                            <span>تأخر في الرد (> 48 ساعة)</span>
                        </span>
                    `;
                } else if (slip.status === 'reminded') {
                    statusBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 4px; background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">
                            <span data-lucide="bell" data-size="12"></span>
                            <span>تم التذكير (في الانتظار)</span>
                        </span>
                    `;
                } else {
                    const remainingHours = Math.max(0, DELAY_THRESHOLD_HOURS - slip.elapsedHours);
                    statusBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 3px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">
                            <span data-lucide="clock" data-size="12"></span>
                            <span>في الأجل (باقٍ ${remainingHours} س)</span>
                        </span>
                    `;
                }

                tableRowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9; background: ${slip.isDelayed ? '#fffdfd' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')};">
                        <td style="padding: 10px 12px; font-family: monospace; font-size: 0.75rem; font-weight: 800; color: #475569; text-align: center;">
                            ${escapeHtml(slip.slipNumber)}
                        </td>
                        <td style="padding: 10px 12px;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">${escapeHtml(slip.title)}</div>
                            <div style="font-size: 0.73rem; color: #64748b; margin-top: 2px;">
                                المستلم: <strong>${escapeHtml(slip.targetOffice)}</strong> (${escapeHtml(slip.channel || 'ورقي')})
                            </div>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            <span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 0.78rem; padding: 2px 8px; border-radius: 6px; border: 1px solid #bfdbfe;">
                                ${escapeHtml(slip.className)}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: center; font-size: 0.8rem; font-weight: 700; color: #334155;">
                            ${slip.studentsCount} حالات
                            ${slip.criticalCount > 0 ? `<div style="font-size: 0.68rem; color: #dc2626; font-weight: 800;">(${slip.criticalCount} حرجة)</div>` : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: center; font-size: 0.75rem;">
                            <div style="font-weight: 700; color: #0f172a;">${formatIsoToUserDate(slip.sentAt)}</div>
                            <div style="font-size: 0.7rem; color: ${slip.isDelayed ? '#dc2626' : '#64748b'}; font-weight: ${slip.isDelayed ? '800' : 'normal'};">
                                ${slip.timeElapsedText}
                            </div>
                        </td>
                        <td style="padding: 10px 12px; text-align: center;">
                            ${statusBadge}
                            ${slip.response ? `
                                <div style="font-size: 0.68rem; color: #166534; font-weight: 700; margin-top: 3px;" title="${escapeHtml(slip.response.notes || '')}">
                                    القرار: ${escapeHtml(slip.response.decision)}
                                </div>
                            ` : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                            <div style="display: inline-flex; align-items: center; gap: 5px;">
                                ${slip.status !== 'responded' ? `
                                    <button type="button" onclick="openAdminFollowUpReminderModal('${slip.id}')" style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 5px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;" title="توجيه تذكير للإدارة">
                                        <span data-lucide="bell" data-size="12"></span> تذكير
                                    </button>
                                    <button type="button" onclick="openAdminFollowUpResponseModal('${slip.id}')" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 5px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;" title="تسجيل رد الإدارة">
                                        <span data-lucide="check" data-size="12"></span> رد
                                    </button>
                                ` : `
                                    <button type="button" onclick="openAdminFollowUpResponseModal('${slip.id}')" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 5px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer;" title="عرض وتعديل قرار الإدارة">
                                        تفاصيل الرد
                                    </button>
                                `}
                                <button type="button" onclick="previewFollowUpSlipReport('${slip.className}')" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 5px 8px; border-radius: 6px; font-size: 0.74rem; cursor: pointer;" title="معاينة وطباعة الكشف">
                                    <span data-lucide="printer" data-size="12"></span>
                                </button>
                                <button type="button" onclick="deleteAdminFollowUpSlip('${slip.id}')" style="background: #fff; color: #94a3b8; border: 1px solid #e2e8f0; padding: 5px 7px; border-radius: 6px; font-size: 0.74rem; cursor: pointer;" title="حذف السجل" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
                                    ✕
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        hub.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: #eff6ff; color: #2563eb; width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #bfdbfe;">
                        <span data-lucide="shield-alert" data-size="20"></span>
                    </span>
                    <div>
                        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span>سجل كشوفات المتابعة وتتبع ردود الإدارة التربوية</span>
                            <span style="font-size: 0.75rem; background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 999px; font-weight: 800; border: 1px solid #fecaca;">
                                نظام مراقبة أجل الـ 48 ساعة
                            </span>
                        </h3>
                        <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #64748b;">
                            توثيق رسمي للكشوفات الموجهة للحراسة العامة، وحساب آلي للمدة المنقضية لإخطار الأستاذ بأي تأخير في تفعيل الإجراءات التأديبية والتربوية.
                        </p>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="openAdminFollowUpCreateModal()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 5px rgba(37,99,235,0.25);">
                        <span data-lucide="plus" data-size="15"></span>
                        <span>+ توثيق إرسال كشف متابعة</span>
                    </button>
                    <button type="button" onclick="renderAdminFollowUpNotifications()" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer;" title="تحديث السجل وحساب الآجال">
                        <span data-lucide="refresh-cw" data-size="14"></span>
                    </button>
                </div>
            </div>

            <!-- Metrics Mini-Bar -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px;">
                <div onclick="setAdminFollowUpFilter('delayed')" style="background: ${currentFollowUpFilter === 'delayed' ? '#fef2f2' : '#ffffff'}; border: 1.5px solid ${metrics.delayedCount > 0 ? '#fca5a5' : '#e2e8f0'}; border-radius: 8px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;">
                    <div style="font-size: 0.7rem; font-weight: 800; color: #b91c1c;">تأخر في الرد (> 48 ساعة)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #dc2626; margin-top: 2px;">${metrics.delayedCount}</div>
                    <div style="font-size: 0.67rem; color: #ef4444;">تستلزم تذكيراً عاجلاً</div>
                </div>

                <div onclick="setAdminFollowUpFilter('pending')" style="background: ${currentFollowUpFilter === 'pending' ? '#fffbeb' : '#ffffff'}; border: 1.5px solid ${currentFollowUpFilter === 'pending' ? '#fde68a' : '#e2e8f0'}; border-radius: 8px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;">
                    <div style="font-size: 0.7rem; font-weight: 800; color: #b45309;">في انتظار الرد (< 48 ساعة)</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #d97706; margin-top: 2px;">${metrics.pendingCount}</div>
                    <div style="font-size: 0.67rem; color: #d97706;">ضمن الأجل القانوني</div>
                </div>

                <div onclick="setAdminFollowUpFilter('responded')" style="background: ${currentFollowUpFilter === 'responded' ? '#f0fdf4' : '#ffffff'}; border: 1.5px solid ${currentFollowUpFilter === 'responded' ? '#86efac' : '#e2e8f0'}; border-radius: 8px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;">
                    <div style="font-size: 0.7rem; font-weight: 800; color: #15803d;">تم الرد والمعالجة</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #16a34a; margin-top: 2px;">${metrics.respondedCount}</div>
                    <div style="font-size: 0.67rem; color: #16a34a;">استدعاء أو التزام منجز</div>
                </div>

                <div onclick="setAdminFollowUpFilter('all')" style="background: ${currentFollowUpFilter === 'all' ? '#eff6ff' : '#ffffff'}; border: 1.5px solid ${currentFollowUpFilter === 'all' ? '#bfdbfe' : '#e2e8f0'}; border-radius: 8px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;">
                    <div style="font-size: 0.7rem; font-weight: 800; color: #1e40af;">إجمالي الكشوفات المسجلة</div>
                    <div style="font-size: 1.35rem; font-weight: 900; color: #1e3a8a; margin-top: 2px;">${metrics.totalCount}</div>
                    <div style="font-size: 0.67rem; color: #3b82f6;">سجل الموسم الدراسي</div>
                </div>
            </div>

            <!-- Filter Tabs -->
            <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
                <button type="button" onclick="setAdminFollowUpFilter('all')" class="dash-pill-btn ${currentFollowUpFilter === 'all' ? 'active' : ''}" style="padding: 4px 12px; font-size: 0.78rem;">
                    جميع الكشوفات (${metrics.totalCount})
                </button>
                <button type="button" onclick="setAdminFollowUpFilter('delayed')" class="dash-pill-btn ${currentFollowUpFilter === 'delayed' ? 'active' : ''}" style="padding: 4px 12px; font-size: 0.78rem; color: ${metrics.delayedCount > 0 ? '#dc2626' : 'inherit'};">
                    ⚠️ متأخرة الرد (${metrics.delayedCount})
                </button>
                <button type="button" onclick="setAdminFollowUpFilter('pending')" class="dash-pill-btn ${currentFollowUpFilter === 'pending' ? 'active' : ''}" style="padding: 4px 12px; font-size: 0.78rem;">
                    ⏳ قيد الانتظار (${metrics.pendingCount})
                </button>
                <button type="button" onclick="setAdminFollowUpFilter('responded')" class="dash-pill-btn ${currentFollowUpFilter === 'responded' ? 'active' : ''}" style="padding: 4px 12px; font-size: 0.78rem;">
                    ✓ تمت معالجتها (${metrics.respondedCount})
                </button>
            </div>

            <!-- Slips Table -->
            <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px;">
                <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; font-weight: 800; color: #475569; font-size: 0.75rem;">
                            <th style="padding: 9px 12px; text-align: center; width: 85px;">رقم الكشف</th>
                            <th style="padding: 9px 12px;">موضوع الكشف والجهة</th>
                            <th style="padding: 9px 12px; text-align: center; width: 110px;">القسم</th>
                            <th style="padding: 9px 12px; text-align: center; width: 80px;">الحالات</th>
                            <th style="padding: 9px 12px; text-align: center; width: 150px;">تاريخ الإرسال والمدة</th>
                            <th style="padding: 9px 12px; text-align: center; width: 160px;">وضعية الرد والأجل</th>
                            <th style="padding: 9px 12px; text-align: center; width: 160px;">إجراءات المتابعة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * تحديث شارات العداد للتنبيهات الإدارية
     */
    function updateFollowUpBadges(metrics) {
        // تحديث شارة العداد في زر لوحة القيادة بالهيدر إن وُجد
        const headerBadge = document.getElementById('headerDashboardAlertBadge');
        if (headerBadge && metrics.delayedCount > 0) {
            headerBadge.title = `تنبيه: يوجد ${metrics.delayedCount} كشف متابعة متأخر الرد من الإدارة لأكثر من 48 ساعة`;
            headerBadge.style.animation = 'pulseAttention 2s infinite';
        }

        // إشعار شارات لوحة القيادة العامة للمزامنة اللحظية
        if (typeof window.updateDashboardAlertBadges === 'function') {
            try {
                window.updateDashboardAlertBadges();
            } catch (err) {}
        }
    }

    /**
     * تصفية الكشوفات المعروضة في المركز
     */
    function setAdminFollowUpFilter(filter) {
        currentFollowUpFilter = filter;
        const metrics = getAdminFollowUpMetrics();
        renderAdminFollowUpHub(metrics);
        if (window.renderLucide) window.renderLucide();
    }

    // =========================================================================
    // نافذة إرسال تذكير إداري رسمي للإدارة التربوية (Reminder Modal)
    // =========================================================================

    function openAdminFollowUpReminderModal(slipId) {
        initAdminFollowUpData();
        const slip = (window.db.adminFollowUpSlips || []).find(s => s.id === slipId);
        if (!slip) return;

        let modal = document.getElementById('modalAdminFollowUpReminder');
        if (!modal) {
            createAdminFollowUpReminderModalDOM();
            modal = document.getElementById('modalAdminFollowUpReminder');
        }

        const metrics = getAdminFollowUpMetrics();
        const processedSlip = metrics.allSlips.find(s => s.id === slipId) || slip;
        const tp = (window.db && (window.db.teacherProfile || window.db.profile)) || {};
        const teacherName = tp.name || 'أستاذ المادة';
        const subject = tp.subject || 'الرياضيات';
        const school = tp.school || 'المؤسسة التعليمية';

        const defaultReminderText = 
`سلام تام بوجود مولانا الإمام المؤيد بالله،

الموضوع: تذكير إداري مستعجل بخصوص كشف المتابعة والإنذار المبكر رقم (${processedSlip.slipNumber})
المرجع: كشف المتابعة المسلم لإدارة المؤسسة / الحراسة العامة بتاريخ ${formatIsoToUserDate(processedSlip.sentAt)}
القسم المستهدف: ${processedSlip.className}
عدد التلاميذ المعنيين: ${processedSlip.studentsCount} حالات تعثر وغياب متكرر

تحية طيبة وتقدير،
يؤسفني تذكيركم المحترم بأنه قد مضت ${processedSlip.timeElapsedText} (أكثر من 48 ساعة) على توجيه كشف تتبع حالات الغياب المتكرر والسلوك غير المنضبط للقسم أعلاه، ولم نتوصل بعد بتأشيرة الإدارة أو مآل استدعاء أولياء الأمور المعنيين.

وحيث إن التأخر في المعالجة يترتب عنه تراكم ساعات الغياب وضياع التعلمات، نرجو التفضل بالتسريع في استدعاء أولياء الأمور وتوقيع الالتزامات اللازمة لضمان الانضباط والسير العادي للدروس.

وتفضلوا بقبول أسمى عبارات التقدير والاحترام.

- الأستاذ(ة): ${teacherName} (${subject})
- المؤسسة: ${school}`;

        document.getElementById('remindSlipNumberDisplay').textContent = processedSlip.slipNumber;
        document.getElementById('remindSlipTitleDisplay').textContent = `${processedSlip.title} - ${processedSlip.className}`;
        document.getElementById('remindSlipElapsedDisplay').textContent = `المدة المنقضية: ${processedSlip.timeElapsedText} (تجاوز الأجل بـ ${processedSlip.delayOverdueHours} ساعة)`;
        document.getElementById('remindMessageTextarea').value = defaultReminderText;
        document.getElementById('remindTargetSlipId').value = slipId;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    function closeAdminFollowUpReminderModal() {
        const modal = document.getElementById('modalAdminFollowUpReminder');
        if (modal) modal.style.display = 'none';
    }

    function sendAdminFollowUpWhatsApp() {
        const text = document.getElementById('remindMessageTextarea')?.value || '';
        const slipId = document.getElementById('remindTargetSlipId')?.value;
        if (!text) return;

        // تسجيل إرسال التذكير في السجل
        markSlipAsReminded(slipId);

        const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
        window.open(url, '_blank');
        closeAdminFollowUpReminderModal();
        showFollowUpToast('تم فتح واتساب وتوثيق إرسال التذكير بنجاح ✓');
    }

    function copyAdminFollowUpReminderText() {
        const textarea = document.getElementById('remindMessageTextarea');
        const slipId = document.getElementById('remindTargetSlipId')?.value;
        if (!textarea) return;

        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            markSlipAsReminded(slipId);
            showFollowUpToast('تم نسخ نص التذكير الإداري إلى الحافظة بنجاح ✓');
            closeAdminFollowUpReminderModal();
        }).catch(() => {
            alert('تم تحديد النص، يمكنك نسخه يدوياً.');
        });
    }

    function markSlipAsReminded(slipId) {
        if (!slipId || !window.db || !window.db.adminFollowUpSlips) return;
        const slip = window.db.adminFollowUpSlips.find(s => s.id === slipId);
        if (slip) {
            slip.reminderCount = (slip.reminderCount || 0) + 1;
            slip.remindedAt = new Date().toISOString();
            slip.status = 'reminded';

            if (typeof window.recordAdminAction === 'function') {
                window.recordAdminAction({
                    actionType: 'admin_reminder',
                    title: `توجيه تذكير لإدارة المؤسسة بشأن كشف المتابعة (${slip.slipNumber})`,
                    className: slip.className,
                    details: `تذكير رقم ${slip.reminderCount} لتأخر الرد لأكثر من 48 ساعة على الكشف الموجه للحراسة العامة.`
                });
            }

            if (typeof window.saveDB === 'function') window.saveDB();
            renderAdminFollowUpNotifications();
        }
    }

    function createAdminFollowUpReminderModalDOM() {
        const modal = document.createElement('div');
        modal.id = 'modalAdminFollowUpReminder';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.72); z-index: 10025; align-items: center; justify-content: center; flex-direction: column; padding: 14px; backdrop-filter: blur(5px);';

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 660px; padding: 22px 24px; max-height: 94vh; overflow-y: auto; background: #ffffff; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #fee2e2; color: #dc2626; width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #fca5a5;">
                            <span data-lucide="bell-ring" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                توجيه تذكير رسمي للإدارة التربوية (تأخر الرد عن 48 ساعة)
                            </h3>
                            <div id="remindSlipTitleDisplay" style="font-size: 0.78rem; color: #64748b; margin-top: 2px;"></div>
                        </div>
                    </div>
                    <button type="button" onclick="closeAdminFollowUpReminderModal()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #64748b; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <input type="hidden" id="remindTargetSlipId" value="">

                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.8rem; color: #991b1b; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <div>رقم الكشف: <strong id="remindSlipNumberDisplay" style="font-family: monospace;"></strong></div>
                    <div id="remindSlipElapsedDisplay" style="font-weight: 800;"></div>
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 0.82rem; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
                        نص التذكير الإداري المنسق (يمكنك التعديل عليه قبل الإرسال):
                    </label>
                    <textarea id="remindMessageTextarea" rows="9" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 0.82rem; font-family: 'Cairo', sans-serif; line-height: 1.6; color: #0f172a; outline: none; resize: vertical;"></textarea>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                    <div style="font-size: 0.74rem; color: #64748b;">
                        💡 سيتم توثيق إرسال التذكير في السجل الكرونولوجي تلقائياً
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="sendAdminFollowUpWhatsApp()" style="background: #25d366; color: #ffffff; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,211,102,0.3);">
                            <span data-lucide="message-circle" data-size="16"></span>
                            <span>إرسال عبر واتساب الإدارة</span>
                        </button>
                        <button type="button" onclick="copyAdminFollowUpReminderText()" style="background: #1e293b; color: #ffffff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <span data-lucide="copy" data-size="15"></span>
                            <span>نسخ النص</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // =========================================================================
    // نافذة تسجيل وتوثيق رد الإدارة (Response Modal)
    // =========================================================================

    function openAdminFollowUpResponseModal(slipId) {
        initAdminFollowUpData();
        const slip = (window.db.adminFollowUpSlips || []).find(s => s.id === slipId);
        if (!slip) return;

        let modal = document.getElementById('modalAdminFollowUpResponse');
        if (!modal) {
            createAdminFollowUpResponseModalDOM();
            modal = document.getElementById('modalAdminFollowUpResponse');
        }

        document.getElementById('respTargetSlipId').value = slipId;
        document.getElementById('respSlipNumberDisplay').textContent = slip.slipNumber;
        document.getElementById('respSlipTitleDisplay').textContent = `${slip.title} - ${slip.className}`;

        const todayStr = new Date().toISOString().slice(0, 10);
        document.getElementById('respDateInput').value = slip.response?.respondedAt?.slice(0, 10) || todayStr;
        document.getElementById('respDecisionSelect').value = slip.response?.decision || 'استدعاء ولي الأمر وتوقيع التزام بالانضباط';
        document.getElementById('respReferenceInput').value = slip.response?.referenceNumber || '';
        document.getElementById('respNotesTextarea').value = slip.response?.notes || '';

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    function closeAdminFollowUpResponseModal() {
        const modal = document.getElementById('modalAdminFollowUpResponse');
        if (modal) modal.style.display = 'none';
    }

    function saveAdminFollowUpResponse() {
        const slipId = document.getElementById('respTargetSlipId')?.value;
        if (!slipId || !window.db || !window.db.adminFollowUpSlips) return;

        const slip = window.db.adminFollowUpSlips.find(s => s.id === slipId);
        if (!slip) return;

        const dateVal = document.getElementById('respDateInput')?.value || new Date().toISOString().slice(0, 10);
        const decisionVal = document.getElementById('respDecisionSelect')?.value || 'استدعاء ولي الأمر وتوقيع التزام';
        const referenceVal = document.getElementById('respReferenceInput')?.value || '';
        const notesVal = document.getElementById('respNotesTextarea')?.value || '';

        slip.status = 'responded';
        slip.response = {
            respondedAt: new Date(dateVal + 'T12:00:00').toISOString(),
            decision: decisionVal,
            referenceNumber: referenceVal,
            notes: notesVal
        };

        if (typeof window.recordAdminAction === 'function') {
            window.recordAdminAction({
                actionType: 'admin_response',
                title: `تسجيل رد وتأشيرة الإدارة على كشف المتابعة (${slip.slipNumber})`,
                className: slip.className,
                details: `قرار الإدارة: ${decisionVal}. ${referenceVal ? `(مرجع: ${referenceVal})` : ''}`
            });
        }

        if (typeof window.saveDB === 'function') window.saveDB();
        closeAdminFollowUpResponseModal();
        renderAdminFollowUpNotifications();
        showFollowUpToast('تم بنجاح تسجيل رد الإدارة وتحديث وضعية الكشف ✓');
    }

    function createAdminFollowUpResponseModalDOM() {
        const modal = document.createElement('div');
        modal.id = 'modalAdminFollowUpResponse';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.72); z-index: 10025; align-items: center; justify-content: center; flex-direction: column; padding: 14px; backdrop-filter: blur(5px);';

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 600px; padding: 22px 24px; max-height: 94vh; overflow-y: auto; background: #ffffff; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #dcfce7; color: #15803d; width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #86efac;">
                            <span data-lucide="check-circle" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                تسجيل رد وتأشيرة الإدارة التربوية على كشف المتابعة
                            </h3>
                            <div id="respSlipTitleDisplay" style="font-size: 0.78rem; color: #64748b; margin-top: 2px;"></div>
                        </div>
                    </div>
                    <button type="button" onclick="closeAdminFollowUpResponseModal()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #64748b; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <input type="hidden" id="respTargetSlipId" value="">

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 0.8rem; color: #334155;">
                    رقم الكشف المسجل: <strong id="respSlipNumberDisplay" style="font-family: monospace; color: #0f172a;"></strong>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">تاريخ استلام الرد أو التأشيرة:</label>
                        <input type="date" id="respDateInput" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none;">
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">القرار / الإجراء المتخذ من الإدارة:</label>
                        <select id="respDecisionSelect" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none; background: #fff;">
                            <option value="استدعاء ولي الأمر وتوقيع التزام بالانضباط">استدعاء ولي الأمر وتوقيع التزام خطي بالانضباط</option>
                            <option value="جلسة إنصات وتوجيه تربوي بالحراسة العامة">عقد جلسة إنصات وتوجيه تربوي بمكتب الحراسة العامة</option>
                            <option value="إحالة على مجلس الانضباط التأديبي">إحالة التلميذ(ة) على مجلس الانضباط التأديبي بالمؤسسة</option>
                            <option value="تسوية وتبرير الغياب رسمياً بشهادة مقبولة">تسوية وتبرير الغياب رسمياً بشهادة مقبولة</option>
                            <option value="توجيه إنذار وتوبيخ كتابي للتلميذ">توجيه إنذار كتابي رسمي يسلم لولي الأمر</option>
                            <option value="إشعار المديرية الإقليمية / تدبير استثنائي">إشعار المديرية الإقليمية / تدبير بيداغوجي استثنائي</option>
                            <option value="أخرى (توضيح في الملاحظات)">أخرى (مبينة في الملاحظات أدناه)</option>
                        </select>
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">رقم الإرسالية / رقم السجل الإداري (اختياري):</label>
                        <input type="text" id="respReferenceInput" placeholder="مثال: إداري/2026/105 أو ص.و 45" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; outline: none;">
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">ملاحظات الحراسة العامة ومخرجات المعالجة:</label>
                        <textarea id="respNotesTextarea" rows="3" placeholder="تفاصيل ما أسفر عنه لقاء ولي الأمر، مبررات الغياب المقبولة، أو تعهدات التلميذ..." style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 0.82rem; font-family: inherit; outline: none;"></textarea>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                    <button type="button" onclick="closeAdminFollowUpResponseModal()" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-weight: 700; cursor: pointer;">إلغاء</button>
                    <button type="button" onclick="saveAdminFollowUpResponse()" style="padding: 8px 20px; border-radius: 8px; border: none; background: #16a34a; color: #ffffff; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <span data-lucide="check" data-size="15"></span>
                        <span>حفظ واعتماد رد الإدارة ✓</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // =========================================================================
    // نافذة توثيق وإرسال كشف متابعة جديد للإدارة (Create Modal)
    // =========================================================================

    function openAdminFollowUpCreateModal(preselectedClass) {
        initAdminFollowUpData();
        let modal = document.getElementById('modalAdminFollowUpCreate');
        if (!modal) {
            createAdminFollowUpCreateModalDOM();
            modal = document.getElementById('modalAdminFollowUpCreate');
        }

        // تعبئة قائمة الأقسام
        const classSelect = document.getElementById('createFollowUpClassSelect');
        if (classSelect) {
            const classes = Object.keys(window.db.classes || {});
            let opts = `<option value="all">كافة الأقسام المسندة معاً</option>`;
            classes.forEach(c => {
                const count = (window.db.classes[c] || []).length;
                opts += `<option value="${escapeHtml(c)}">${escapeHtml(c)} (${count} تلميذ)</option>`;
            });
            classSelect.innerHTML = opts;
            if (preselectedClass) classSelect.value = preselectedClass;
        }

        // توليد رقم الكشف التلقائي
        const count = (window.db.adminFollowUpSlips || []).length + 1;
        const now = new Date();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const numStr = String(count).padStart(2, '0');
        document.getElementById('createFollowUpNumberInput').value = `KM-26${monthStr}-${numStr}`;

        // ضبط التوقيت الافتراضي (الآن)
        document.getElementById('createFollowUpDateInput').value = now.toISOString().slice(0, 10);
        document.getElementById('createFollowUpTimeInput').value = now.toTimeString().slice(0, 5);

        // عدد الحالات التقديري
        let defaultCasesCount = 3;
        if (typeof window.getDashboardAtRiskStudents === 'function') {
            const riskData = window.getDashboardAtRiskStudents({ class: preselectedClass || 'all' });
            if (riskData && riskData.students) {
                defaultCasesCount = riskData.students.length || 1;
            }
        }
        document.getElementById('createFollowUpStudentsCountInput').value = defaultCasesCount;

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide();
    }

    function closeAdminFollowUpCreateModal() {
        const modal = document.getElementById('modalAdminFollowUpCreate');
        if (modal) modal.style.display = 'none';
    }

    let _isSavingAdminFollowUpSlip = false;
    function saveAdminFollowUpSlip() {
        if (_isSavingAdminFollowUpSlip) return;
        _isSavingAdminFollowUpSlip = true;
        const unlock = () => { setTimeout(() => { _isSavingAdminFollowUpSlip = false; }, 600); };

        initAdminFollowUpData();

        const slipNumber = document.getElementById('createFollowUpNumberInput')?.value.trim() || 'KM-' + Date.now();
        const title = document.getElementById('createFollowUpTitleInput')?.value.trim() || 'كشف المتابعة الإداري وحالات الإنذار';
        const className = document.getElementById('createFollowUpClassSelect')?.value || 'كافة الأقسام';
        const dateStr = document.getElementById('createFollowUpDateInput')?.value || new Date().toISOString().slice(0, 10);
        const timeStr = document.getElementById('createFollowUpTimeInput')?.value || '09:00';
        const targetOffice = document.getElementById('createFollowUpOfficeSelect')?.value || 'الحراسة العامة للخارجية';
        const channel = document.getElementById('createFollowUpChannelSelect')?.value || 'تسليم ورقي مع تأشيرة الاستلام';
        const countVal = parseInt(document.getElementById('createFollowUpStudentsCountInput')?.value, 10) || 1;
        const notes = document.getElementById('createFollowUpNotesTextarea')?.value.trim() || '';

        const sentAt = new Date(`${dateStr}T${timeStr}:00`).toISOString();
        const teacherName = (window.db.profile && window.db.profile.name) ? window.db.profile.name : 'أستاذ المادة';

        const newSlip = {
            id: 'slip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            slipNumber,
            title,
            className,
            sentAt,
            sentBy: teacherName,
            targetOffice,
            channel,
            studentsCount: countVal,
            criticalCount: Math.ceil(countVal / 2),
            urgency: 'high',
            status: 'pending',
            reminderCount: 0,
            remindedAt: null,
            notes,
            createdAt: new Date().toISOString()
        };

        window.db.adminFollowUpSlips.unshift(newSlip);

        if (typeof window.recordAdminAction === 'function') {
            window.recordAdminAction({
                actionType: 'followup_sent',
                title: `إرسال وتوثيق كشف المتابعة الإداري (${slipNumber})`,
                className: className,
                details: `تم توجيه الكشف إلى ${targetOffice} ويتضمن ${countVal} حالات. تم تفعيل مراقبة أجل الـ 48 ساعة.`
            });
        }

        if (typeof window.saveDB === 'function') window.saveDB();

        closeAdminFollowUpCreateModal();
        renderAdminFollowUpNotifications();
        showFollowUpToast('تم توثيق إرسال كشف المتابعة بنجاح، وسينبهك النظام تلقائياً بعد 48 ساعة في حال تأخر الرد ✓');
        unlock();
    }

    function createAdminFollowUpCreateModalDOM() {
        const modal = document.createElement('div');
        modal.id = 'modalAdminFollowUpCreate';
        modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.72); z-index: 10025; align-items: center; justify-content: center; flex-direction: column; padding: 14px; backdrop-filter: blur(5px);';

        modal.innerHTML = `
            <div class="card" style="width: 100%; max-width: 620px; padding: 22px 24px; max-height: 94vh; overflow-y: auto; background: #ffffff; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: #eff6ff; color: #2563eb; width: 38px; height: 38px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #bfdbfe;">
                            <span data-lucide="send" data-size="20"></span>
                        </span>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
                                توثيق إرسال كشف متابعة جديد للإدارة التربوية
                            </h3>
                            <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">
                                تفعيل نظام المراقبة الآلية لأجل الـ 48 ساعة لتلقي تنبيهات الاستجابة
                            </div>
                        </div>
                    </div>
                    <button type="button" onclick="closeAdminFollowUpCreateModal()" style="background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; color: #64748b; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">رقم الكشف المرجعي:</label>
                            <input type="text" id="createFollowUpNumberInput" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 800; font-family: monospace; color: #0f172a; outline: none;">
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">القسم المستهدف:</label>
                            <select id="createFollowUpClassSelect" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none; background: #fff;"></select>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">موضوع وعنوان الكشف:</label>
                        <input type="text" id="createFollowUpTitleInput" value="كشف المتابعة والإنذار المبكر الموجه للإدارة التربوية" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none;">
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">تاريخ الإرسال الفعلي:</label>
                            <input type="date" id="createFollowUpDateInput" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; outline: none;">
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">وقت التسليم:</label>
                            <input type="time" id="createFollowUpTimeInput" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; outline: none;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">الجهة المستلمة:</label>
                            <select id="createFollowUpOfficeSelect" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none; background: #fff;">
                                <option value="الحراسة العامة للخارجية">الحراسة العامة للخارجية</option>
                                <option value="إدارة المؤسسة (المدير)">إدارة المؤسسة (السيد المدير)</option>
                                <option value="مكتب الناظر">مكتب السيد الناظر</option>
                                <option value="مكتب الغياب وتتبع المواظبة">مكتب الغياب وتتبع المواظبة</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">قناة التسليم:</label>
                            <select id="createFollowUpChannelSelect" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; color: #0f172a; outline: none; background: #fff;">
                                <option value="تسليم ورقي مع تأشيرة الاستلام">تسليم ورقي مع تأشيرة الاستلام</option>
                                <option value="واتساب الإدارة التربوية">مراسلة عبر واتساب الإدارة</option>
                                <option value="بريد إلكتروني رسمي">إرسال عبر البريد الإلكتروني</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">عدد حالات التلاميذ المتضمنة:</label>
                        <input type="number" id="createFollowUpStudentsCountInput" min="1" max="100" value="3" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; outline: none;">
                    </div>

                    <div>
                        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">ملاحظات خاصة بالإرسالية:</label>
                        <textarea id="createFollowUpNotesTextarea" rows="2" placeholder="ملاحظات أو توضيحات إضافية حول الحالات المستعجلة..." style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 8px; font-size: 0.82rem; font-family: inherit; outline: none;"></textarea>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                    <div style="font-size: 0.74rem; color: #0284c7; font-weight: 700;">
                        ⏱️ سيبدأ احتساب عداد الـ 48 ساعة فور الحفظ
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="closeAdminFollowUpCreateModal()" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; font-weight: 700; cursor: pointer;">إلغاء</button>
                        <button type="button" onclick="saveAdminFollowUpSlip()" style="padding: 8px 20px; border-radius: 8px; border: none; background: #2563eb; color: #ffffff; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                            <span data-lucide="send" data-size="15"></span>
                            <span>توثيق الإرسالية وتفعيل المراقبة ✓</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * حذف كشف متابعة
     */
    function deleteAdminFollowUpSlip(slipId) {
        if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الكشف من سجل المتابعة؟')) return;
        if (!window.db || !window.db.adminFollowUpSlips) return;

        window.db.adminFollowUpSlips = window.db.adminFollowUpSlips.filter(s => s.id !== slipId);
        if (typeof window.saveDB === 'function') window.saveDB();
        renderAdminFollowUpNotifications();
        showFollowUpToast('تم حذف السجل بنجاح.');
    }

    /**
     * توثيق مباشر لكشف المتابعة المفتوح حالياً في نافذة الطباعة
     */
    function quickRegisterCurrentReportAsSent() {
        const selectedClass = document.getElementById('dashReportClassFilter')?.value || 'all';
        openAdminFollowUpCreateModal(selectedClass);
    }

    /**
     * فتح معاينة الكشف مباشرة
     */
    function previewFollowUpSlipReport(className) {
        if (typeof window.openDashboardAdminReportModal === 'function') {
            window.openDashboardAdminReportModal();
            setTimeout(() => {
                const classSelect = document.getElementById('dashReportClassFilter');
                if (classSelect && className) {
                    classSelect.value = className;
                    if (typeof window.updateDashboardAdminReportPreview === 'function') {
                        window.updateDashboardAdminReportPreview();
                    }
                }
            }, 50);
        }
    }

    // =========================================================================
    // دوال مساعدة للتنسيق والإشعار
    // =========================================================================

    function formatIsoToUserDate(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${y}/${m}/${day} (${h}:${min})`;
        } catch (e) {
            return isoStr;
        }
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

    function showFollowUpToast(msg) {
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

    // تصدير الدوال للـ Window
    window.renderAdminFollowUpNotifications = renderAdminFollowUpNotifications;
    window.getAdminFollowUpMetrics = getAdminFollowUpMetrics;
    window.setAdminFollowUpFilter = setAdminFollowUpFilter;
    window.openAdminFollowUpReminderModal = openAdminFollowUpReminderModal;
    window.closeAdminFollowUpReminderModal = closeAdminFollowUpReminderModal;
    window.sendAdminFollowUpWhatsApp = sendAdminFollowUpWhatsApp;
    window.copyAdminFollowUpReminderText = copyAdminFollowUpReminderText;
    window.openAdminFollowUpResponseModal = openAdminFollowUpResponseModal;
    window.closeAdminFollowUpResponseModal = closeAdminFollowUpResponseModal;
    window.saveAdminFollowUpResponse = saveAdminFollowUpResponse;
    window.openAdminFollowUpCreateModal = openAdminFollowUpCreateModal;
    window.closeAdminFollowUpCreateModal = closeAdminFollowUpCreateModal;
    window.saveAdminFollowUpSlip = saveAdminFollowUpSlip;
    window.deleteAdminFollowUpSlip = deleteAdminFollowUpSlip;
    window.quickRegisterCurrentReportAsSent = quickRegisterCurrentReportAsSent;
    window.previewFollowUpSlipReport = previewFollowUpSlipReport;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAdminFollowUpData();
            const dashView = document.getElementById('dashboardView');
            if (dashView && dashView.style.display !== 'none') {
                renderAdminFollowUpNotifications();
            }
        });
    } else {
        initAdminFollowUpData();
        const dashView = document.getElementById('dashboardView');
        if (dashView && dashView.style.display !== 'none') {
            renderAdminFollowUpNotifications();
        }
    }

})(window);
