/**
 * ====================================================================
 * منظومة الربط والتزامن التلقائي المباشر مع تقويم جوجل (Google Calendar)
 * Real-Time Bi-Directional Google Calendar Auto-Synchronization Engine
 * ====================================================================
 * تتيح الربط المباشر لتقويم المنظومة المدرسي (المحطات البيداغوجية، الفروض
 * المحروسة، الامتحانات الإشهادية، المواعيد والأحداث) مع Google Calendar
 * بتزامن لحظي تلقائي مباشر وتوفير مزامنة فورية شاملة واستيراد الأحداث.
 */

(function (window) {
    'use strict';

    const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const SYNC_TAG_PREFIX = '[منظومة الأستاذ]';

    // حالة محرك المزامنة
    const _syncState = {
        inProgress: false,
        lastError: null,
        lastSyncTimestamp: null,
        syncedCount: 0
    };

    /**
     * الهروب الآمن للنصوص
     */
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
     * الحصول على توكن الوصول المخزن لـ Google Calendar
     */
    async function getAccessToken(interactive = false) {
        if (typeof window.getGoogleCalendarAccessToken === 'function') {
            try {
                const token = await window.getGoogleCalendarAccessToken(interactive);
                if (token) return token;
            } catch (e) {
                console.warn('Error fetching token via getGoogleCalendarAccessToken:', e);
            }
        }
        
        // محاولة استرجاع التوكن من sessionStorage
        try {
            const stored = sessionStorage.getItem('gdrive_access_token');
            const storedTime = parseInt(sessionStorage.getItem('gdrive_token_time') || '0', 10);
            if (stored && (Date.now() - storedTime < 55 * 60 * 1000)) {
                return stored;
            }
        } catch (e) {}

        if (interactive && typeof window.handleDriveLogin === 'function') {
            return await window.handleDriveLogin();
        }

        return null;
    }

    /**
     * التحقق هل ميزة التزامن التلقائي مفعلة
     */
    function isAutoSyncEnabled() {
        if (typeof window.db !== 'undefined' && window.db && window.db.settings) {
            return window.db.settings.googleCalendarAutoSync === true;
        }
        try {
            return localStorage.getItem('school_gcal_auto_sync') === 'true';
        } catch (e) {
            return false;
        }
    }

    /**
     * تفعيل أو تعطيل التزامن التلقائي
     */
    function setAutoSyncEnabled(enabled) {
        if (typeof window.db !== 'undefined' && window.db) {
            if (!window.db.settings) window.db.settings = {};
            window.db.settings.googleCalendarAutoSync = !!enabled;
            if (typeof window.saveDB === 'function') window.saveDB();
        }
        try {
            localStorage.setItem('school_gcal_auto_sync', enabled ? 'true' : 'false');
        } catch (e) {}

        renderGoogleCalendarSyncBanner();
        if (typeof window.showAppToast === 'function') {
            window.showAppToast(
                enabled 
                    ? '⚡ تم تفعيل التزامن التلقائي المباشر مع Google Calendar بنجاح' 
                    : '⏸️ تم إيقاف التزامن التلقائي مع Google Calendar',
                enabled ? 'success' : 'info'
            );
        }
    }

    /**
     * تحويل تاريخ محلي إلى صيغة Google Calendar
     */
    function formatGCalDate(dateStr) {
        if (!dateStr) return null;
        // إذا كان يحتوي على وقت
        if (dateStr.includes('T')) {
            return { dateTime: new Date(dateStr).toISOString() };
        }
        // حدث طيلة اليوم
        return { date: dateStr };
    }

    /**
     * حساب تاريخ النهاية للأحداث طيلة اليوم (+1 day)
     */
    function getGCalEndDate(startDateStr, endDateStr) {
        const start = startDateStr || new Date().toISOString().slice(0, 10);
        const end = endDateStr || start;
        
        try {
            const [y, m, d] = end.split('-').map(Number);
            const nextDay = new Date(y, m - 1, d + 1);
            const ny = nextDay.getFullYear();
            const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
            const nd = String(nextDay.getDate()).padStart(2, '0');
            return `${ny}-${nm}-${nd}`;
        } catch (e) {
            return end;
        }
    }

    /**
     * تحويل كائن الموعد أو المحطة إلى كائن Google Calendar Event
     */
    function buildGoogleEventPayload(item) {
        const title = (item.title || item.name || 'موعد مدرسي').trim();
        const categoryLabel = item.categoryLabel || item.type || (item.isUnifiedExam ? 'امتحان موحد' : 'محطة بيداغوجية');
        const startDate = item.startDate || item.date || new Date().toISOString().slice(0, 10);
        const endDate = getGCalEndDate(startDate, item.endDate || item.date);

        let description = `${SYNC_TAG_PREFIX} ${categoryLabel}\n`;
        if (item.description || item.notes) {
            description += `${item.description || item.notes}\n`;
        }
        if (item.targetClasses || item.className) {
            description += `الأقسام المعنية: ${item.targetClasses || item.className}\n`;
        }
        if (item.coef) {
            description += `المعامل: ${item.coef} | المدة: ${item.duration || 'ساعتان'}\n`;
        }
        description += `مصدر الحدث: منظومة تتبع الغياب والأداء المدرسي (AI Studio).`;

        // ألوان Google Calendar بحسب نوع الحدث
        // 11: Red (امتحان), 9: Blue (محطة), 5: Yellow (مسار), 10: Green (عطلة), 3: Purple (مجلس)
        let colorId = '9';
        if (item.isUnifiedExam || item.category === 'exam' || item.category === 'certification') {
            colorId = '11'; // أحمر فاقع للفروض والامتحانات
        } else if (item.category === 'massar') {
            colorId = '5'; // أصفر/برتقالي لمسار
        } else if (item.category === 'holiday') {
            colorId = '10'; // أخضر للعطل
        } else if (item.category === 'council') {
            colorId = '3'; // بنفسجي للمجالس
        }

        return {
            summary: `${SYNC_TAG_PREFIX} ${title}`,
            description: description,
            start: {
                date: startDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Casablanca'
            },
            end: {
                date: endDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Casablanca'
            },
            colorId: colorId,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 24 * 60 }, // تذكير قبل 24 ساعة
                    { method: 'popup', minutes: 2 * 60 }   // تذكير قبل ساعتين
                ]
            }
        };
    }

    /**
     * إرسال طلب إنشاء حدث في Google Calendar
     */
    async function apiCreateEvent(token, payload) {
        const res = await fetch(GOOGLE_CALENDAR_API_BASE, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error?.message || `HTTP ${res.status}`);
        }
        return await res.json();
    }

    /**
     * تحديث حدث موجود في Google Calendar
     */
    async function apiUpdateEvent(token, googleEventId, payload) {
        const url = `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`;
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error?.message || `HTTP ${res.status}`);
        }
        return await res.json();
    }

    /**
     * حذف حدث من Google Calendar (مع التحقق الإلزامي للمستخدم)
     */
    async function apiDeleteEvent(token, googleEventId) {
        const url = `${GOOGLE_CALENDAR_API_BASE}/${encodeURIComponent(googleEventId)}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok && res.status !== 404) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error?.message || `HTTP ${res.status}`);
        }
        return true;
    }

    /**
     * جلب قائمة الأحداث من تقويم جوجل
     */
    async function apiListEvents(token, timeMinIso = null) {
        const timeMin = timeMinIso || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const url = `${GOOGLE_CALENDAR_API_BASE}?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime&maxResults=250`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.items || [];
    }

    /**
     * ====================================================================
     * التزامن التلقائي المباشر لحدث مفرد (عند الإضافة أو التعديل أو الحذف)
     * ====================================================================
     */
    async function autoSyncSingleItem(item, action = 'save') {
        if (!isAutoSyncEnabled()) return;
        const token = await getAccessToken(false);
        if (!token) return;

        try {
            if (action === 'delete') {
                if (item.googleEventId) {
                    // تأكيد الحذف الإلزامي للعمليات الحساسة
                    const title = item.title || item.name || 'الموعد المختار';
                    const confirmMsg = `هل تريد بالتأكيد حذف "${title}" من تقويم Google Calendar أيضاً لضمان التزامن؟`;
                    if (window.confirm(confirmMsg)) {
                        await apiDeleteEvent(token, item.googleEventId);
                        item.googleEventId = null;
                        if (typeof window.showAppToast === 'function') {
                            window.showAppToast(`تم حذف الموعد من تقويم Google بنجاح 🗑️`, 'info');
                        }
                    }
                }
                return;
            }

            // إضافة أو تعديل
            const payload = buildGoogleEventPayload(item);
            if (item.googleEventId) {
                try {
                    await apiUpdateEvent(token, item.googleEventId, payload);
                    item.googleLastSynced = new Date().toISOString();
                    if (typeof window.showAppToast === 'function') {
                        window.showAppToast(`⚡ تم تحديث "${item.title || 'الموعد'}" مباشرة في Google Calendar`, 'success');
                    }
                } catch (updateErr) {
                    // إذا كان غير موجود تم حذفه في Google ننشئه من جديد
                    const created = await apiCreateEvent(token, payload);
                    item.googleEventId = created.id;
                    item.googleLastSynced = new Date().toISOString();
                }
            } else {
                const created = await apiCreateEvent(token, payload);
                item.googleEventId = created.id;
                item.googleLastSynced = new Date().toISOString();
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast(`⚡ تم تسجيل "${item.title || 'الموعد'}" مباشرة في Google Calendar`, 'success');
                }
            }

            if (typeof window.saveDB === 'function') window.saveDB();
            renderGoogleCalendarSyncBanner();
        } catch (err) {
            console.error('Google Calendar autoSyncSingleItem error:', err);
        }
    }

    /**
     * ====================================================================
     * المزامنة الشاملة الفورية لكافة مواعيد ومحطات المنظومة
     * ====================================================================
     */
    async function syncAllToGoogleCalendar(interactive = true) {
        if (_syncState.inProgress) return;
        
        let token = await getAccessToken(interactive);
        if (!token) {
            if (interactive) {
                const proceed = window.confirm('يجب تسجيل الدخول بحساب Google أولاً لمزامنة التقويم. هل تود تسجيل الدخول الآن؟');
                if (proceed && typeof window.handleDriveLogin === 'function') {
                    token = await window.handleDriveLogin();
                }
            }
            if (!token) {
                renderGoogleCalendarSyncBanner();
                return;
            }
        }

        _syncState.inProgress = true;
        _syncState.lastError = null;
        updateSyncUIStatus('syncing');

        if (typeof window.showLoading === 'function') {
            window.showLoading('جاري مزامنة المواعيد والمحطات التربوية مع Google Calendar...');
        }

        try {
            const db = window.db || {};
            let createdCount = 0;
            let updatedCount = 0;

            // 1. تجميع كل العناصر المرشحة للمزامنة
            const itemsToSync = [];

            // أ. المحطات التربوية والامتحانات الموحدة
            if (typeof window.getAcademicMilestones === 'function') {
                const milestones = window.getAcademicMilestones();
                milestones.forEach(ms => itemsToSync.push({ ...ms, _sourceType: 'milestone' }));
            }

            // ب. أحداث التقويم الشهري المسجلة في db.events
            if (Array.isArray(db.events)) {
                db.events.forEach(evt => itemsToSync.push({ ...evt, _sourceType: 'event' }));
            }

            // ج. فروض المراقبة المستمرة المسجلة في db.exams
            if (Array.isArray(db.exams)) {
                db.exams.forEach(ex => {
                    itemsToSync.push({
                        id: ex.id || `exam_${ex.date}_${ex.class}`,
                        title: `فرض ${ex.type || 'محروس'} - ${ex.class || ''}`,
                        date: ex.date,
                        startDate: ex.date,
                        category: 'exam',
                        categoryLabel: 'فرض مراقبة مستمرة',
                        className: ex.class,
                        description: `فترة إنجاز الفرض المحروس لمادة الرياضيات للقسم: ${ex.class || ''}`,
                        googleEventId: ex.googleEventId,
                        _sourceType: 'exam'
                    });
                });
            }

            // د. رخص الأستاذ القانونية (db.teacherLeaves)
            if (Array.isArray(db.teacherLeaves)) {
                db.teacherLeaves.forEach(lv => {
                    if (!lv.startDate) return;
                    itemsToSync.push({
                        id: lv.id || `leave_${lv.startDate}`,
                        title: `🛡️ [رخصة أستاذ] ${lv.title || lv.typeLabel || 'رخصة قانونية'}`,
                        startDate: lv.startDate,
                        endDate: lv.endDate || lv.startDate,
                        category: 'admin',
                        categoryLabel: lv.typeLabel || 'رخصة أستاذ',
                        description: `رخصة قانونية مسجلة في دفتر الأستاذ (${lv.daysCount || 1} يوم)${lv.notes ? ' - ' + lv.notes : ''}`,
                        googleEventId: lv.googleEventId,
                        _sourceType: 'leave'
                    });
                });
            }

            // هـ. الواجبات المنزلية المبرمجة للأقسام (db.homeworkAgenda)
            if (db.homeworkAgenda && typeof db.homeworkAgenda === 'object') {
                Object.keys(db.homeworkAgenda).forEach(cls => {
                    const list = db.homeworkAgenda[cls];
                    if (Array.isArray(list)) {
                        list.forEach(hw => {
                            if (!hw.date || !hw.title) return;
                            itemsToSync.push({
                                id: hw.id || `hw_${cls}_${hw.date}`,
                                title: `📚 واجب (${cls}): ${hw.title}`,
                                startDate: hw.date,
                                endDate: hw.date,
                                category: 'schoolwork',
                                categoryLabel: `واجب منزلي - ${cls}`,
                                description: hw.details || `مراقبة الواجب المنزلي للقسم ${cls}`,
                                googleEventId: hw.googleEventId,
                                _sourceType: 'homework',
                                _classKey: cls
                            });
                        });
                    }
                });
            }

            if (itemsToSync.length === 0) {
                if (typeof window.hideLoading === 'function') window.hideLoading();
                _syncState.inProgress = false;
                updateSyncUIStatus('ready');
                if (interactive && typeof window.showAppToast === 'function') {
                    window.showAppToast('لا توجد مواعيد أو محطات مسجلة في التقويم للمزامنة حالياً.', 'info');
                }
                return;
            }

            // 2. مزامنة العناصر واحداً تلو الآخر
            for (let i = 0; i < itemsToSync.length; i++) {
                const item = itemsToSync[i];
                const payload = buildGoogleEventPayload(item);

                try {
                    if (item.googleEventId) {
                        try {
                            await apiUpdateEvent(token, item.googleEventId, payload);
                            updatedCount++;
                        } catch (e) {
                            const created = await apiCreateEvent(token, payload);
                            item.googleEventId = created.id;
                            createdCount++;
                        }
                    } else {
                        const created = await apiCreateEvent(token, payload);
                        item.googleEventId = created.id;
                        createdCount++;
                    }

                    // تحديث الكائن الأصلي في db
                    if (item._sourceType === 'event' && Array.isArray(db.events)) {
                        const target = db.events.find(e => e.id === item.id || (e.title === item.title && e.date === item.date));
                        if (target) target.googleEventId = item.googleEventId;
                    } else if (item._sourceType === 'milestone') {
                        if (Array.isArray(db.academicMilestones)) {
                            const targetMs = db.academicMilestones.find(m => m.id === item.id);
                            if (targetMs) targetMs.googleEventId = item.googleEventId;
                        }
                        if (Array.isArray(db.customMilestones)) {
                            const target = db.customMilestones.find(m => m.id === item.id);
                            if (target) target.googleEventId = item.googleEventId;
                        }
                    } else if (item._sourceType === 'leave' && Array.isArray(db.teacherLeaves)) {
                        const targetLv = db.teacherLeaves.find(l => l.id === item.id);
                        if (targetLv) targetLv.googleEventId = item.googleEventId;
                    } else if (item._sourceType === 'homework' && item._classKey && Array.isArray(db.homeworkAgenda?.[item._classKey])) {
                        const targetHw = db.homeworkAgenda[item._classKey].find(h => h.id === item.id || (h.date === item.startDate && `📚 واجب (${item._classKey}): ${h.title}` === item.title));
                        if (targetHw) targetHw.googleEventId = item.googleEventId;
                    }
                } catch (itemErr) {
                    console.warn(`Error syncing item ${item.title}:`, itemErr);
                }
            }

            _syncState.syncedCount = createdCount + updatedCount;
            _syncState.lastSyncTimestamp = new Date();
            if (!db.settings) db.settings = {};
            db.settings.googleCalendarLastSyncTime = _syncState.lastSyncTimestamp.toISOString();
            if (typeof window.saveDB === 'function') window.saveDB();

            if (typeof window.hideLoading === 'function') window.hideLoading();
            _syncState.inProgress = false;
            updateSyncUIStatus('synced');

            const msg = `🎉 تمت المزامنة مع Google Calendar بنجاح! (تم إنشاء ${createdCount} جديد، وتحديث ${updatedCount} موعد)`;
            if (typeof window.showAppToast === 'function') {
                window.showAppToast(msg, 'success');
            } else {
                alert(msg);
            }
            renderGoogleCalendarSyncBanner();
        } catch (err) {
            console.error('syncAllToGoogleCalendar error:', err);
            if (typeof window.hideLoading === 'function') window.hideLoading();
            _syncState.inProgress = false;
            _syncState.lastError = err.message;
            updateSyncUIStatus('error');
            alert(`حدث خطأ أثناء المزامنة مع تقويم جوجل: ${err.message}`);
        }
    }

    /**
     * ====================================================================
     * استيراد الأحداث من Google Calendar إلى منظومة التقويم المدرسي
     * ====================================================================
     */
    async function importFromGoogleCalendar(interactive = true) {
        let token = await getAccessToken(interactive);
        if (!token) {
            if (interactive) {
                const proceed = window.confirm('يتطلب استيراد الأحداث تسجيل الدخول بحساب Google. هل تود المتابعة؟');
                if (proceed && typeof window.handleDriveLogin === 'function') {
                    token = await window.handleDriveLogin();
                }
            }
            if (!token) return;
        }

        if (typeof window.showLoading === 'function') {
            window.showLoading('جاري استيراد الأحداث من Google Calendar...');
        }

        try {
            const gEvents = await apiListEvents(token);
            if (typeof window.hideLoading === 'function') window.hideLoading();

            if (gEvents.length === 0) {
                if (typeof window.showAppToast === 'function') {
                    window.showAppToast('لم يتم العثور على أحداث قادمة في تقويم جوجل.', 'info');
                } else {
                    alert('لم يتم العثور على أحداث قادمة في تقويم Google.');
                }
                return;
            }

            const db = window.db || {};
            if (!Array.isArray(db.events)) db.events = [];
            if (!Array.isArray(db.academicMilestones)) db.academicMilestones = [];

            let importedCount = 0;
            gEvents.forEach(gev => {
                const title = (gev.summary || '').trim();
                if (!title) return;

                const startStr = (gev.start?.date) || (gev.start?.dateTime ? gev.start.dateTime.slice(0, 10) : null);
                if (!startStr) return;

                const cleanTitle = title.replace(SYNC_TAG_PREFIX, '').replace(/^[🎯📝👥🛡️📚]\s*(\[[^\]]+\]\s*)?/, '').trim();
                if (!cleanTitle) return;

                // تجنب استيراد الأحداث المصدرة من المنظومة مسبقاً إذا كانت موجودة في db.academicMilestones أو db.events
                const existingInMs = db.academicMilestones.find(m => m.googleEventId === gev.id || (m.startDate === startStr && m.title === cleanTitle));
                const existingInEv = db.events.find(e => e.googleEventId === gev.id || (e.date === startStr && e.title === cleanTitle));
                if (existingInMs && existingInEv) return;

                const isExam = cleanTitle.includes('فرض') || cleanTitle.includes('امتحان') || cleanTitle.toLowerCase().includes('exam');
                const isCouncil = cleanTitle.includes('مجلس') || cleanTitle.includes('اجتماع') || cleanTitle.includes('لقاء');

                if (!existingInEv) {
                    db.events.push({
                        id: 'gcal_' + (gev.id || Date.now()),
                        title: cleanTitle,
                        date: startStr,
                        type: isExam ? 'exam' : (isCouncil ? 'meeting' : 'task'),
                        color: isExam ? '#dc2626' : (isCouncil ? '#7c3aed' : '#2563eb'),
                        description: gev.description || 'تم استيراده من Google Calendar',
                        googleEventId: gev.id,
                        importedFromGoogle: true
                    });
                }

                if (!existingInMs) {
                    const dObj = new Date(startStr);
                    const mNum = !isNaN(dObj.getTime()) ? dObj.getMonth() + 1 : 9;
                    const autoSem = (mNum >= 9 || mNum === 1) ? 's1' : 's2';
                    const mappedCat = isExam ? 'exam' : (isCouncil ? 'council' : 'schoolwork');
                    db.academicMilestones.push({
                        id: 'ms_gcal_' + (gev.id || Date.now()),
                        title: cleanTitle,
                        startDate: startStr,
                        endDate: startStr,
                        category: mappedCat,
                        categoryLabel: isExam ? 'فرض / امتحان' : (isCouncil ? 'مجلس / اجتماع' : 'موعد مستورد من Google'),
                        semester: autoSem,
                        semesterLabel: autoSem === 's2' ? 'الأسدوس الثاني' : 'الأسدوس الأول',
                        targetLevels: 'جميع المستويات',
                        description: gev.description || 'تم استيراده من Google Calendar',
                        color: isExam ? '#dc2626' : (isCouncil ? '#7c3aed' : '#2563eb'),
                        isCustom: true,
                        googleEventId: gev.id,
                        importedFromGoogle: true
                    });
                }
                importedCount++;
            });

            if (typeof window.syncAllCalendarUnits === 'function') {
                window.syncAllCalendarUnits(false);
            } else {
                if (typeof window.saveDB === 'function') window.saveDB();
                if (typeof window.renderCalendar === 'function') window.renderCalendar();
            }

            const resMsg = importedCount > 0 
                ? `✅ تم بنجاح استيراد ${importedCount} حدث من Google Calendar إلى التقويم المدرسي!` 
                : 'جميع أحداث تقويم جوجل موجودة مسبقاً في المنظومة دون تكرار.';
            
            if (typeof window.showAppToast === 'function') {
                window.showAppToast(resMsg, 'success');
            } else {
                alert(resMsg);
            }
        } catch (err) {
            if (typeof window.hideLoading === 'function') window.hideLoading();
            console.error('importFromGoogleCalendar error:', err);
            alert(`فشل استيراد الأحداث من تقويم جوجل: ${err.message}`);
        }
    }

    /**
     * تحديث شارة الحالة في شريط التقويم
     */
    function updateSyncUIStatus(status) {
        const badge = document.getElementById('calGoogleSyncStatusText');
        const dot = document.getElementById('calGoogleSyncDot');
        if (!badge) return;

        if (status === 'syncing') {
            badge.textContent = 'جاري التزامن...';
            if (dot) dot.style.background = '#f59e0b';
        } else if (status === 'synced') {
            badge.textContent = 'متزامن لحظياً ✓';
            if (dot) dot.style.background = '#10b981';
        } else if (status === 'error') {
            badge.textContent = 'تنبيه تزامن';
            if (dot) dot.style.background = '#ef4444';
        } else {
            badge.textContent = isAutoSyncEnabled() ? 'تزامن تلقائي نشط' : 'تزامن يدوي';
            if (dot) dot.style.background = isAutoSyncEnabled() ? '#10b981' : '#64748b';
        }
    }

    /**
     * ====================================================================
     * رسم شريط الربط والتزامن التلقائي المباشر داخل تبويب التقويم
     * ====================================================================
     */
    function renderGoogleCalendarSyncBanner(customMountId) {
        const mount = document.getElementById(customMountId || 'googleCalendarSyncBannerMount') || document.getElementById('calendarGoogleSyncBannerMount');
        if (!mount) return;

        const isAuto = isAutoSyncEnabled();
        const user = (typeof window.getGoogleCurrentUser === 'function') ? window.getGoogleCurrentUser() : null;
        const isConnected = !!user;
        const userEmail = user?.email || '';

        const db = window.db || {};
        const lastSyncTimeStr = db.settings?.googleCalendarLastSyncTime || _syncState.lastSyncTimestamp;
        let formattedLastSync = 'لم تتم المزامنة بعد';
        if (lastSyncTimeStr) {
            try {
                const d = new Date(lastSyncTimeStr);
                formattedLastSync = d.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        }

        mount.innerHTML = `
            <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1.5px solid ${isConnected ? '#bfdbfe' : '#e2e8f0'}; border-right: 5px solid ${isConnected ? '#2563eb' : '#94a3b8'}; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <!-- Left Details & Identity -->
                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: ${isConnected ? '#eff6ff' : '#f1f5f9'}; border: 1.5px solid ${isConnected ? '#93c5fd' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4"/>
                            <path d="M16 2v4M8 2v4M3 10h18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
                            <text x="12" y="17" fill="#ffffff" font-size="7" font-weight="bold" text-anchor="middle" font-family="sans-serif">31</text>
                        </svg>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight: 800; font-size: 0.94rem; color: #0f172a;">
                                الربط والتزامن المباشر مع تقويم جوجل (Google Calendar)
                            </span>
                            <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 9999px; background: ${isConnected ? '#dcfce7' : '#f1f5f9'}; color: ${isConnected ? '#15803d' : '#64748b'}; font-weight: 800; border: 1px solid ${isConnected ? '#86efac' : '#cbd5e1'}; display: inline-flex; align-items: center; gap: 5px;">
                                <span id="calGoogleSyncDot" style="width: 7px; height: 7px; border-radius: 50%; background: ${isConnected ? (isAuto ? '#10b981' : '#2563eb') : '#94a3b8'};"></span>
                                <span id="calGoogleSyncStatusText">${isConnected ? (userEmail ? `متصل: ${userEmail}` : 'متصل ومصرح') : 'غير متصل'}</span>
                            </span>
                        </div>
                        <div style="font-size: 0.76rem; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <span>تزامن المحطات، فروض المراقبة والامتحانات مع هاتفك وحاسوبك فورياً</span>
                            <span style="color: #94a3b8;">•</span>
                            <span>آخر تزامن: <strong>${formattedLastSync}</strong></span>
                        </div>
                    </div>
                </div>

                <!-- Right Controls & Actions -->
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <!-- Auto-Sync Toggle Switch -->
                    <label style="display: inline-flex; align-items: center; gap: 7px; background: #ffffff; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 800; color: #1e293b; user-select: none;" title="عند تفعيل هذا الخيار، يتم إرسال وتحديث وتزامن أي موعد أو محطة أو فرض فورياً في Google Calendar">
                        <input type="checkbox" id="calToggleAutoSync" ${isAuto ? 'checked' : ''} onchange="window.toggleGoogleCalendarAutoSync(this.checked)" style="width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;">
                        <span>⚡ تزامن تلقائي مباشر</span>
                    </label>

                    <!-- Manual Sync Now Button -->
                    <button type="button" class="btn-primary" onclick="window.syncAllToGoogleCalendar(true)" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); cursor: pointer;" title="مزامنة فورية شاملة لكافة المحطات والفروض والمواعيد المسجلة">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="refresh-cw" data-size="14"></span></span>
                        <span>مزامنة فورية الآن</span>
                    </button>

                    <!-- Import from Google Button -->
                    <button type="button" class="btn-secondary" onclick="window.importFromGoogleCalendar(true)" style="background: #ffffff; border: 1px solid #cbd5e1; color: #334155; padding: 7px 12px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" title="جلب الأحداث والاجتماعات من حساب تقويم جوجل إلى المنظومة">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="download" data-size="14"></span></span>
                        <span>استيراد من Google</span>
                    </button>

                    <!-- Direct Smartphone ICS Calendar Export Button -->
                    <button type="button" class="btn-secondary" onclick="if(window.downloadMinisterialCalendarICS) window.downloadMinisterialCalendarICS();" style="background: #f0fdf4; border: 1px solid #86efac; color: #166534; padding: 7px 12px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" title="تنزيل ملف التقويم الموحد (.ics) لإضافته مباشرة إلى تقويم الهاتف الذكي (iPhone / Android / Outlook) مع التنبيهات">
                        <span class="ui-icon" style="margin:0;"><span data-lucide="calendar-check" data-size="14"></span></span>
                        <span>📲 تقويم الهاتف (.ICS)</span>
                    </button>

                    ${!isConnected ? `
                        <button type="button" class="btn-primary" onclick="if(window.handleDriveLogin) window.handleDriveLogin();" style="background: #ffffff; border: 1.5px solid #4285F4; color: #1a73e8; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                            <span>تسجيل الدخول بـ Google</span>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        if (window.renderLucide) window.renderLucide();
    }

    // تصدير الواجهات والدوال إلى النطاق العالمي (window)
    window.isGoogleCalendarAutoSyncEnabled = isAutoSyncEnabled;
    window.toggleGoogleCalendarAutoSync = setAutoSyncEnabled;
    window.autoSyncSingleItemToGoogleCalendar = autoSyncSingleItem;
    window.syncAllToGoogleCalendar = syncAllToGoogleCalendar;
    window.importFromGoogleCalendar = importFromGoogleCalendar;
    window.renderGoogleCalendarSyncBanner = renderGoogleCalendarSyncBanner;

    // استماع لتغيرات توكن Google لتحديث الشريط تلقائياً
    window.addEventListener('gdrive-token-changed', () => {
        renderGoogleCalendarSyncBanner();
    });

    // استدعاء أولي عند اكتمال تحميل DOM
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(renderGoogleCalendarSyncBanner, 300);
    });

})(window);
