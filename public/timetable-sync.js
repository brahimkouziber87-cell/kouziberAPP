/**
 * ====================================================================
 * منظومة الربط التلقائي بين جدول الحصص والتقويم السنوي والتذكيرات الذكية
 * Automated Timetable - Annual Calendar Sync & Smart Advance Homework Alerts
 * ====================================================================
 */

(function (window) {
    'use strict';

    // State variables
    let radarInterval = null;
    let activeRadarSession = null;
    let snoozedUntil = 0;
    let dismissedSessionKey = null;
    let lastNotifiedSessionKey = null;

    /**
     * إعدادات الربط التلقائي الافتراضية
     */
    function getTimetableSyncConfig() {
        if (!window.db) return getDefaultConfig();
        if (!window.db.timetableCalendarSyncConfig) {
            window.db.timetableCalendarSyncConfig = getDefaultConfig();
        }
        return Object.assign(getDefaultConfig(), window.db.timetableCalendarSyncConfig);
    }

    function getDefaultConfig() {
        return {
            enabled: true,                  // الربط مفعل
            showInCalendar: true,           // إظهار الحصص في التقويم السنوي
            advanceMinutes: 15,             // التنبيه قبل 15 دقيقة
            showRadarBanner: true,          // إظهار شريط الرادار بالصفحة الرئيسية
            linkHomework: true,             // ربط تنبيهات الواجبات المنزلية المقررة
            skipHolidays: true,             // استثناء العطل الرسمية
            enableAudioBeep: true,          // نغمة صوتية هادئة عند التنبيه
            enableBrowserNotify: true,      // إشعار سطح المكتب / الهاتف
            batchRange: '4weeks'            // المدى الافتراضي للتثبيت
        };
    }

    /**
     * حفظ الإعدادات من النافذة المنبثقة
     */
    function saveTimetableCalendarSyncSettings() {
        if (!window.db) return;
        const cfg = getTimetableSyncConfig();

        const masterToggle = document.getElementById('ttSyncMasterEnabled');
        if (masterToggle) cfg.enabled = masterToggle.checked;

        const advSelect = document.getElementById('ttSyncAdvanceMinutesSelect');
        if (advSelect) cfg.advanceMinutes = parseInt(advSelect.value, 10) || 15;

        const showRadarChk = document.getElementById('ttSyncShowRadarBanner');
        if (showRadarChk) cfg.showRadarBanner = showRadarChk.checked;

        const linkHwChk = document.getElementById('ttSyncLinkHomework');
        if (linkHwChk) cfg.linkHomework = linkHwChk.checked;

        const calGridChk = document.getElementById('ttSyncShowInCalendarGrid');
        if (calGridChk) cfg.showInCalendar = calGridChk.checked;

        const skipHolChk = document.getElementById('ttSyncSkipHolidays');
        if (skipHolChk) cfg.skipHolidays = skipHolChk.checked;

        const beepChk = document.getElementById('ttSyncEnableAudioBeep');
        if (beepChk) cfg.enableAudioBeep = beepChk.checked;

        const browserNotifyChk = document.getElementById('ttSyncEnableBrowserNotify');
        if (browserNotifyChk) cfg.enableBrowserNotify = browserNotifyChk.checked;

        window.db.timetableCalendarSyncConfig = cfg;
        if (typeof window.saveDB === 'function') window.saveDB();

        // Update badge in Calendar header
        updateSyncStatusBadges();

        // Request browser permission if enabled
        if (cfg.enableBrowserNotify && "Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        // Re-render Calendar and re-check radar
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        checkUpcomingSessionRadar();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم حفظ إعدادات ربط جدول الحصص والتذكيرات بنجاح 📅⚡', 'success');
        } else if (typeof window.showNotification === 'function') {
            window.showNotification('تم حفظ إعدادات ربط جدول الحصص والتذكيرات بنجاح', 'success');
        }

        closeTimetableCalendarSyncModal();
    }

    function toggleTtSyncMaster(checked) {
        const cfg = getTimetableSyncConfig();
        cfg.enabled = checked;
        window.db.timetableCalendarSyncConfig = cfg;
        if (typeof window.saveDB === 'function') window.saveDB();
        updateSyncStatusBadges();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        checkUpcomingSessionRadar();
    }

    function updateSyncStatusBadges() {
        const cfg = getTimetableSyncConfig();
        const badge = document.getElementById('calendarTimetableSyncStatusBadge');
        if (badge) {
            badge.textContent = cfg.enabled ? 'مفعل' : 'معطل';
            badge.style.background = cfg.enabled ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.3)';
        }
    }

    /**
     * تشغيل نغمة تنبيه صوتية باستخدام Web Audio API دون أي ملفات خارجية
     */
    function playChimeSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const now = ctx.currentTime;
            // Tone 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(784, now); // G5
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.18, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Tone 2 (harmony)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1046.5, now + 0.12); // C6
            gain2.gain.setValueAtTime(0, now + 0.12);
            gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.55);
        } catch (e) {
            console.log('Audio chime played in background or blocked');
        }
    }

    /**
     * استخراج حصص يوم محدد مع الواجبات المرتبطة والعطل
     */
    function getTimetableSessionsForDate(dateInput) {
        let dateObj;
        let dateStr;

        if (typeof dateInput === 'string') {
            dateStr = dateInput;
            const parts = dateInput.split('-');
            dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else if (dateInput instanceof Date) {
            dateObj = dateInput;
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        } else {
            dateObj = new Date();
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getDate()).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }

        const WORK_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const dayName = WORK_DAYS[dateObj.getDay()];

        // التحقق من العطل
        let isHoliday = false;
        let holidayName = '';
        if (window.db && Array.isArray(window.db.calendarEvents)) {
            const hol = window.db.calendarEvents.find(ev => ev.date === dateStr && (ev.type === 'holiday' || ev.isOfficial));
            if (hol) {
                isHoliday = true;
                holidayName = hol.title || 'عطلة رسمية';
            }
        }

        const sessions = [];
        if (!window.db || !window.db.timetable || !window.db.timetable[dayName]) {
            return { dateStr, dayName, isHoliday, holidayName, sessions };
        }

        const data = window.db.timetable[dayName];
        const slotKeys = [
            { key: 'm1', defaultStart: '08:00', defaultHrs: 2, label: 'الحصة الأولى صباحاً' },
            { key: 'm2', defaultStart: '10:00', defaultHrs: 2, label: 'الحصة الثانية صباحاً' },
            { key: 'm3', defaultStart: '12:00', defaultHrs: 1, label: 'الحصة الثالثة صباحاً' },
            { key: 'e1', defaultStart: '13:00', defaultHrs: 2, label: 'الحصة الأولى مساءً' },
            { key: 'e2', defaultStart: '15:00', defaultHrs: 2, label: 'الحصة الثانية مساءً' },
            { key: 'e3', defaultStart: '17:00', defaultHrs: 1, label: 'الحصة الثالثة مساءً' }
        ];

        slotKeys.forEach(slotDef => {
            const k = slotDef.key;
            let className = '';
            let startTime = '';
            let hours = slotDef.defaultHrs;
            let note = '';
            let room = '';

            if (k === 'm1') {
                className = data.m1_class || data.morningClass1 || data.morningClass || '';
                startTime = data.m1_time || data.morningTime1 || slotDef.defaultStart;
                hours = parseFloat(data.m1_hrs || data.morningHours1 || data.morningHours || slotDef.defaultHrs);
                note = data.m1_note || '';
                room = data.m1_room || '';
            } else if (k === 'm2') {
                className = data.m2_class || data.morningClass2 || '';
                startTime = data.m2_time || data.morningTime2 || slotDef.defaultStart;
                hours = parseFloat(data.m2_hrs || data.morningHours2 || slotDef.defaultHrs);
                note = data.m2_note || '';
                room = data.m2_room || '';
            } else if (k === 'm3') {
                className = data.m3_class || '';
                startTime = data.m3_time || slotDef.defaultStart;
                hours = parseFloat(data.m3_hrs || slotDef.defaultHrs);
                note = data.m3_note || '';
                room = data.m3_room || '';
            } else if (k === 'e1') {
                className = data.e1_class || data.eveningClass1 || data.eveningClass || '';
                startTime = data.e1_time || data.eveningTime1 || slotDef.defaultStart;
                hours = parseFloat(data.e1_hrs || data.eveningHours1 || data.eveningHours || slotDef.defaultHrs);
                note = data.e1_note || '';
                room = data.e1_room || '';
            } else if (k === 'e2') {
                className = data.e2_class || data.eveningClass2 || '';
                startTime = data.e2_time || data.eveningTime2 || slotDef.defaultStart;
                hours = parseFloat(data.e2_hrs || data.eveningHours2 || slotDef.defaultHrs);
                note = data.e2_note || '';
                room = data.e2_room || '';
            } else if (k === 'e3') {
                className = data.e3_class || '';
                startTime = data.e3_time || slotDef.defaultStart;
                hours = parseFloat(data.e3_hrs || slotDef.defaultHrs);
                note = data.e3_note || '';
                room = data.e3_room || '';
            }

            if (className && className.trim() !== '') {
                className = className.trim();
                startTime = startTime || slotDef.defaultStart;
                const endTime = computeEndTime(startTime, hours);

                // استخراج الواجبات المنزلية المرتبطة بهذا القسم في هذا التاريخ
                const homeworkItems = getHomeworkForClassAndDate(className, dateStr);

                sessions.push({
                    slotKey: k,
                    label: slotDef.label,
                    className,
                    startTime,
                    endTime,
                    hours,
                    note,
                    room: room || extractRoomFromNote(note),
                    dateStr,
                    dayName,
                    hasHomework: homeworkItems.length > 0,
                    homeworkItems
                });
            }
        });

        // ترتيب الحصص زمنياً
        sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

        return { dateStr, dayName, isHoliday, holidayName, sessions };
    }

    function extractRoomFromNote(note) {
        if (!note) return '';
        const match = note.match(/(قاعة|حجرة|ق\.|salle|room)\s*[:\s]?\s*([0-9A-Za-z\u0600-\u06FF]+)/i);
        return match ? match[2] : '';
    }

    function computeEndTime(startTime, hours) {
        try {
            const [hStr, mStr] = (startTime || '08:00').split(':');
            let h = parseInt(hStr, 10);
            let m = parseInt(mStr || '0', 10);
            const addMinutes = Math.round(hours * 60);
            const totalM = h * 60 + m + addMinutes;
            const finalH = Math.floor(totalM / 60) % 24;
            const finalM = totalM % 60;
            return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
        } catch (e) {
            return startTime;
        }
    }

    /**
     * استخراج الواجبات المقررة لقسم محدد في تاريخ محدد
     */
    function getHomeworkForClassAndDate(className, dateStr) {
        const items = [];
        if (!window.db) return items;

        // 1. من أجندة الواجبات db.homeworkAgenda
        if (window.db.homeworkAgenda && window.db.homeworkAgenda[className]) {
            const list = window.db.homeworkAgenda[className];
            list.forEach(item => {
                if (item.date === dateStr) {
                    items.push({
                        id: item.id || Date.now().toString(),
                        source: 'agenda',
                        title: item.title || 'واجب منزلي',
                        className,
                        date: dateStr
                    });
                }
            });
        }

        // 2. من دفتر النصوص db.lessonLogs
        if (window.db.lessonLogs && window.db.lessonLogs[className]) {
            const logs = window.db.lessonLogs[className];
            logs.forEach(log => {
                if (log.homeworkDueDate === dateStr && log.homework) {
                    items.push({
                        id: 'log_' + log.id,
                        source: 'lessonLog',
                        title: log.homework,
                        lessonTitle: log.title || '',
                        className,
                        date: dateStr
                    });
                }
            });
        }

        return items;
    }

    /**
     * فحص الحصة القادمة وإظهار رادار التذكير المسبق وتنبيهات الواجبات
     */
    function checkUpcomingSessionRadar() {
        const cfg = getTimetableSyncConfig();
        const banner = document.getElementById('upcomingSessionRadarBanner');
        if (!banner) return;

        // حصر التنبيهات المنبثقة ورادار الحصة حصرياً في تبويب التقويم وفق طلب الأستاذ
        if (typeof window.activeTab !== 'undefined' && window.activeTab !== 'calendar') {
            banner.style.display = 'none';
            return;
        }

        if (!cfg.enabled || !cfg.showRadarBanner) {
            banner.style.display = 'none';
            return;
        }

        // إذا كان التنبيه مؤجلاً (Snooze)
        if (Date.now() < snoozedUntil) {
            banner.style.display = 'none';
            return;
        }

        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        const todayInfo = getTimetableSessionsForDate(todayStr);

        // تخطي العطل إذا كان الخيار مفعلاً
        if (cfg.skipHolidays && todayInfo.isHoliday) {
            banner.style.display = 'none';
            return;
        }

        const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();
        const advanceMins = cfg.advanceMinutes || 15;

        let matchedSession = null;
        let sessionStatus = 'upcoming'; // 'upcoming' | 'ongoing'
        let timeRemainingLabel = '';

        for (const sess of todayInfo.sessions) {
            const [sh, sm] = sess.startTime.split(':').map(Number);
            const [eh, em] = sess.endTime.split(':').map(Number);
            const startM = sh * 60 + sm;
            const endM = eh * 60 + em;

            const diffToStart = startM - currentMinutesOfDay;

            // 1. الحصة قادمة ضمن نافذة التذكير المسبق
            if (diffToStart >= 0 && diffToStart <= advanceMins) {
                matchedSession = sess;
                sessionStatus = 'upcoming';
                if (diffToStart === 0) {
                    timeRemainingLabel = 'تبدأ الآن حالاً!';
                } else if (diffToStart === 1) {
                    timeRemainingLabel = 'تبدأ بعد دقيقة واحدة';
                } else {
                    timeRemainingLabel = `تبدأ بعد ${diffToStart} دقيقة (${sess.startTime})`;
                }
                break;
            }

            // 2. الحصة جارية حالياً (في أول 30 دقيقة منها)
            if (currentMinutesOfDay >= startM && currentMinutesOfDay < endM && (currentMinutesOfDay - startM) <= 35) {
                matchedSession = sess;
                sessionStatus = 'ongoing';
                const minsLeft = endM - currentMinutesOfDay;
                timeRemainingLabel = `جارية حالياً (متبقي ${minsLeft} د)`;
                break;
            }
        }

        if (!matchedSession) {
            banner.style.display = 'none';
            activeRadarSession = null;
            return;
        }

        const sessionKey = `${todayStr}_${matchedSession.slotKey}_${matchedSession.className}_${sessionStatus}`;

        // إذا تم إغلاقه يدوياً من طرف الأستاذ في هذه الجلسة
        if (dismissedSessionKey === sessionKey) {
            banner.style.display = 'none';
            return;
        }

        activeRadarSession = matchedSession;

        // تحديث عناصر الشعار في واجهة المستخدم
        const statusBadge = document.getElementById('sessionRadarStatusBadge');
        const timeUntil = document.getElementById('sessionRadarTimeUntil');
        const titleEl = document.getElementById('sessionRadarTitle');
        const roomBadge = document.getElementById('sessionRadarRoomBadge');
        const hwBox = document.getElementById('sessionRadarHomeworkBox');
        const hwTitle = document.getElementById('sessionRadarHomeworkTitle');
        const btnAttendanceLabel = document.getElementById('sessionRadarBtnAttendanceLabel');
        const iconBox = document.getElementById('sessionRadarIconBox');

        if (statusBadge) {
            if (sessionStatus === 'ongoing') {
                statusBadge.textContent = 'الحصة جارية الآن';
                statusBadge.style.background = '#16a34a';
            } else {
                statusBadge.textContent = `تذكير مسبق (${advanceMins}د)`;
                statusBadge.style.background = '#0284c7';
            }
        }

        if (iconBox) {
            iconBox.style.background = (sessionStatus === 'ongoing') ? '#16a34a' : (matchedSession.hasHomework ? '#7c3aed' : '#0284c7');
        }

        if (timeUntil) timeUntil.textContent = timeRemainingLabel;
        if (titleEl) {
            titleEl.textContent = `حصة مادة الرياضيات: قسم ${matchedSession.className} (${matchedSession.startTime} - ${matchedSession.endTime})`;
        }

        if (roomBadge) {
            if (matchedSession.room) {
                roomBadge.style.display = 'inline-block';
                roomBadge.textContent = `القاعة: ${matchedSession.room}`;
            } else {
                roomBadge.style.display = 'none';
            }
        }

        // عرض تنبيه الواجب المنزلي إن وجد
        if (cfg.linkHomework && matchedSession.hasHomework && hwBox && hwTitle) {
            hwBox.style.display = 'block';
            const hwNames = matchedSession.homeworkItems.map(h => h.title).join(' | ');
            hwTitle.textContent = hwNames;
            if (btnAttendanceLabel) btnAttendanceLabel.textContent = 'تسجيل الحضور ومراقبة الواجب';
        } else if (hwBox) {
            hwBox.style.display = 'none';
            if (btnAttendanceLabel) btnAttendanceLabel.textContent = 'تسجيل حضور القسم';
        }

        banner.style.display = 'block';

        // إطلاق النغمة الصوتية والإشعار الخارجي عند أول ظهور
        if (lastNotifiedSessionKey !== sessionKey) {
            lastNotifiedSessionKey = sessionKey;

            if (cfg.enableAudioBeep) {
                playChimeSound();
            }

            if (cfg.enableBrowserNotify && "Notification" in window && Notification.permission === "granted") {
                let notifBody = `حصة قسم ${matchedSession.className} ${timeRemainingLabel}`;
                if (matchedSession.hasHomework) {
                    notifBody += `\n📚 تنبيه واجب منزلي: ${matchedSession.homeworkItems[0].title}`;
                }
                try {
                    new Notification("تذكير مسبق بالحصة - منظومة الرياضيات", {
                        body: notifBody,
                        icon: '/pwa-192x192.png',
                        badge: '/pwa-192x192.png'
                    });
                } catch (e) {
                    // ignore notification exceptions
                }
            }
        }
    }

    /**
     * الانتقال من شريط الرادار إلى تسجيل الحضور للقسم المعني
     */
    function goToSessionAttendanceFromRadar() {
        if (!activeRadarSession) return;
        const cls = activeRadarSession.className;
        if (typeof window.switchTab === 'function') window.switchTab('absence');
        if (typeof window.changeClass === 'function') window.changeClass(cls);

        // إذا كان هناك واجب، التنبيه بتسجيله
        if (activeRadarSession.hasHomework && typeof window.showAppToast === 'function') {
            window.showAppToast(`قسم ${cls}: يرجى مراقبة إنجاز الواجب المنزلي اليوم 📚`, 'info');
        }
    }

    /**
     * الانتقال من شريط الرادار إلى دفتر النصوص
     */
    function goToSessionLessonLogFromRadar() {
        if (!activeRadarSession) return;
        const cls = activeRadarSession.className;
        if (typeof window.switchTab === 'function') window.switchTab('lessonlog');
        const sel = document.getElementById('lessonLogClassSelect');
        if (sel) {
            sel.value = cls;
            if (typeof window.renderLessonLogs === 'function') {
                window.renderLessonLogs();
            } else if (typeof window.onLessonLogClassChanged === 'function') {
                window.onLessonLogClassChanged();
            }
        }
    }

    /**
     * تأجيل التنبيه لدقائق (Snooze)
     */
    function snoozeUpcomingSessionRadar(minutes) {
        snoozedUntil = Date.now() + (minutes * 60 * 1000);
        const banner = document.getElementById('upcomingSessionRadarBanner');
        if (banner) banner.style.display = 'none';

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم تأجيل التنبيه لمدة ${minutes} دقائق ⏱️`, 'info');
        }
    }

    /**
     * إغلاق التنبيه الحالي
     */
    function dismissUpcomingSessionRadar() {
        if (activeRadarSession) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            dismissedSessionKey = `${y}-${m}-${d}_${activeRadarSession.slotKey}_${activeRadarSession.className}_ongoing`;
        }
        const banner = document.getElementById('upcomingSessionRadarBanner');
        if (banner) banner.style.display = 'none';
    }

    /**
     * تجربة إطلاق التذكير التجريبي الفوري (Demo/Test run)
     */
    function triggerTestUpcomingSessionRadar() {
        playChimeSound();
        const banner = document.getElementById('upcomingSessionRadarBanner');
        if (!banner) return;

        // اختيار أول قسم متاح أو اسم افتراضي
        let firstClass = '1APIC-1';
        if (window.db && window.db.classes) {
            const keys = Object.keys(window.db.classes);
            if (keys.length > 0) firstClass = keys[0];
        }

        activeRadarSession = {
            slotKey: 'test',
            className: firstClass,
            startTime: '10:00',
            endTime: '12:00',
            hours: 2,
            room: '12',
            hasHomework: true,
            homeworkItems: [{ title: 'تمارين 12 و 14 ص 45 - الأعداد الجذرية' }]
        };

        const statusBadge = document.getElementById('sessionRadarStatusBadge');
        const timeUntil = document.getElementById('sessionRadarTimeUntil');
        const titleEl = document.getElementById('sessionRadarTitle');
        const roomBadge = document.getElementById('sessionRadarRoomBadge');
        const hwBox = document.getElementById('sessionRadarHomeworkBox');
        const hwTitle = document.getElementById('sessionRadarHomeworkTitle');

        if (statusBadge) {
            statusBadge.textContent = 'تذكير تجريبي مسبق (15د)';
            statusBadge.style.background = '#7c3aed';
        }
        if (timeUntil) timeUntil.textContent = 'تبدأ بعد 15 دقيقة (10:00)';
        if (titleEl) titleEl.textContent = `حصة تجريبية: قسم ${firstClass} (10:00 - 12:00)`;
        if (roomBadge) {
            roomBadge.style.display = 'inline-block';
            roomBadge.textContent = 'القاعة: 12';
        }
        if (hwBox && hwTitle) {
            hwBox.style.display = 'block';
            hwTitle.textContent = 'تمارين 12 و 14 ص 45 - الأعداد الجذرية';
        }

        banner.style.display = 'block';
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم إطلاق تنبيه الرادار التجريبي مع النغمة الصوتية بنجاح 🔔✨', 'success');
        }
        closeTimetableCalendarSyncModal();
    }

    /**
     * النوافذ المنبثقة والتبويبات
     */
    function openTimetableCalendarSyncModal() {
        const modal = document.getElementById('timetableCalendarSyncModal');
        if (!modal) return;

        const cfg = getTimetableSyncConfig();

        const masterToggle = document.getElementById('ttSyncMasterEnabled');
        if (masterToggle) masterToggle.checked = cfg.enabled;

        const advSelect = document.getElementById('ttSyncAdvanceMinutesSelect');
        if (advSelect) advSelect.value = String(cfg.advanceMinutes || 15);

        const showRadarChk = document.getElementById('ttSyncShowRadarBanner');
        if (showRadarChk) showRadarChk.checked = cfg.showRadarBanner !== false;

        const linkHwChk = document.getElementById('ttSyncLinkHomework');
        if (linkHwChk) linkHwChk.checked = cfg.linkHomework !== false;

        const calGridChk = document.getElementById('ttSyncShowInCalendarGrid');
        if (calGridChk) calGridChk.checked = cfg.showInCalendar !== false;

        const skipHolChk = document.getElementById('ttSyncSkipHolidays');
        if (skipHolChk) skipHolChk.checked = cfg.skipHolidays !== false;

        const beepChk = document.getElementById('ttSyncEnableAudioBeep');
        if (beepChk) beepChk.checked = cfg.enableAudioBeep !== false;

        const browserNotifyChk = document.getElementById('ttSyncEnableBrowserNotify');
        if (browserNotifyChk) browserNotifyChk.checked = cfg.enableBrowserNotify !== false;

        switchTtSyncModalTab('settings');
        modal.classList.add('active');
        if (window.renderLucide) window.renderLucide();
    }

    function closeTimetableCalendarSyncModal() {
        const modal = document.getElementById('timetableCalendarSyncModal');
        if (modal) modal.classList.remove('active');
    }

    function switchTtSyncModalTab(tabKey) {
        const tabs = ['settings', 'batch', 'preview'];
        tabs.forEach(t => {
            const btn = document.getElementById(`ttSyncTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
            const content = document.getElementById(`ttSyncTabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
            if (btn) btn.classList.toggle('active', t === tabKey);
            if (content) content.style.display = (t === tabKey) ? 'flex' : 'none';
        });

        if (tabKey === 'preview') {
            renderTtSyncLivePreview();
        }
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * رسم المعاينة الحية للحصص في التبويب الثالث
     */
    function renderTtSyncLivePreview() {
        const container = document.getElementById('ttSyncLiveSessionsPreviewContainer');
        if (!container) return;

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayInfo = getTimetableSessionsForDate(now);
        const tomorrowInfo = getTimetableSessionsForDate(tomorrow);

        let html = '';

        // قسم اليوم
        html += `
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
                <div style="font-weight: 800; color: #0284c7; font-size: 0.9rem; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>📅 حصص اليوم (${todayInfo.dayName} ${todayInfo.dateStr}):</span>
                    <span style="font-size: 0.75rem; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-weight: 700;">${todayInfo.sessions.length} حصص</span>
                </div>
        `;

        if (todayInfo.sessions.length === 0) {
            html += `<div style="font-size: 0.8rem; color: #94a3b8; padding: 8px 0;">لا توجد حصص مبرمجة لليوم في جدول الحصص الأسبوعي.</div>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 8px;">`;
            todayInfo.sessions.forEach(s => {
                html += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-right: 4px solid ${s.hasHomework ? '#7c3aed' : '#0284c7'}; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                                <span>${s.startTime} - ${s.endTime}</span> | <span style="color: #0284c7;">قسم: ${s.className}</span>
                                ${s.room ? `<span style="font-size: 0.74rem; background: #e2e8f0; color: #334155; padding: 1px 6px; border-radius: 4px; margin-right: 4px;">القاعة: ${s.room}</span>` : ''}
                            </div>
                            ${s.hasHomework ? `
                                <div style="font-size: 0.78rem; color: #6b21a8; font-weight: 700; margin-top: 3px;">
                                    📚 واجب مرتبط: ${s.homeworkItems.map(h => h.title).join(' | ')}
                                </div>
                            ` : `<div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">لا يوجد واجب منزلي مرتبط مسجل.</div>`}
                        </div>
                        <button type="button" class="btn-action" onclick="openQuickAddSessionHomeworkModal('${s.className}', '${todayInfo.dateStr}')" style="font-size: 0.75rem; padding: 5px 10px; border-radius: 6px; background: #faf5ff; border: 1px solid #d8b4fe; color: #6b21a8; font-weight: 700; cursor: pointer;">
                            + ربط واجب
                        </button>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;

        // قسم الغد
        html += `
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
                <div style="font-weight: 800; color: #475569; font-size: 0.9rem; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>🗓️ حصص الغد (${tomorrowInfo.dayName} ${tomorrowInfo.dateStr}):</span>
                    <span style="font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 6px; font-weight: 700;">${tomorrowInfo.sessions.length} حصص</span>
                </div>
        `;

        if (tomorrowInfo.sessions.length === 0) {
            html += `<div style="font-size: 0.8rem; color: #94a3b8; padding: 8px 0;">لا توجد حصص مبرمجة للغد في جدول الحصص.</div>`;
        } else {
            html += `<div style="display: flex; flex-direction: column; gap: 8px;">`;
            tomorrowInfo.sessions.forEach(s => {
                html += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-right: 4px solid ${s.hasHomework ? '#7c3aed' : '#64748b'}; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                                <span>${s.startTime} - ${s.endTime}</span> | <span>قسم: ${s.className}</span>
                            </div>
                            ${s.hasHomework ? `
                                <div style="font-size: 0.78rem; color: #6b21a8; font-weight: 700; margin-top: 3px;">
                                    📚 واجب مرتبط: ${s.homeworkItems.map(h => h.title).join(' | ')}
                                </div>
                            ` : `<div style="font-size: 0.74rem; color: #94a3b8; margin-top: 2px;">لا يوجد واجب منزلي مرتبط مسجل.</div>`}
                        </div>
                        <button type="button" class="btn-action" onclick="openQuickAddSessionHomeworkModal('${s.className}', '${tomorrowInfo.dateStr}')" style="font-size: 0.75rem; padding: 5px 10px; border-radius: 6px; background: #faf5ff; border: 1px solid #d8b4fe; color: #6b21a8; font-weight: 700; cursor: pointer;">
                            + ربط واجب
                        </button>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;

        container.innerHTML = html;
        if (window.renderLucide) window.renderLucide();
    }

    /**
     * تثبيت الحصص الأسبوعية في جدول أحداث التقويم (Batch Sync)
     */
    function executeBatchTimetableSync() {
        if (!window.db) return;
        const rangeSelect = document.getElementById('ttSyncBatchRangeSelect');
        const range = rangeSelect ? rangeSelect.value : '4weeks';

        if (!window.db.calendarEvents) window.db.calendarEvents = [];

        const now = new Date();
        let startDate = new Date(now);
        let endDate = new Date(now);

        if (range === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (range === '4weeks') {
            startDate = new Date(now);
            endDate = new Date(now);
            endDate.setDate(endDate.getDate() + 28);
        } else if (range === 'semester1') {
            startDate = new Date(now.getFullYear(), 8, 1); // 1 Sep
            endDate = new Date(now.getFullYear() + (now.getMonth() < 6 ? 0 : 1), 0, 31); // 31 Jan
        } else if (range === 'semester2') {
            startDate = new Date(now.getFullYear(), 1, 1); // 1 Feb
            endDate = new Date(now.getFullYear(), 5, 30); // 30 June
        } else if (range === 'year') {
            startDate = new Date(now.getFullYear(), 8, 1); // 1 Sep
            endDate = new Date(now.getFullYear() + 1, 5, 30); // 30 June next year
        }

        // إزالة الحصص المزامنة السابقة في هذا المدى لتفادي التكرار
        window.db.calendarEvents = window.db.calendarEvents.filter(ev => {
            if (!ev.linkedTimetable) return true;
            const evDate = new Date(ev.date);
            return evDate < startDate || evDate > endDate;
        });

        let addedCount = 0;
        const cur = new Date(startDate);
        while (cur <= endDate) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const d = String(cur.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            const info = getTimetableSessionsForDate(dateStr);
            const cfg = getTimetableSyncConfig();

            // استثناء العطل إذا كان الخيار مفعلاً
            if (!cfg.skipHolidays || !info.isHoliday) {
                info.sessions.forEach(sess => {
                    let title = `حصة: ${sess.className} (${sess.startTime}-${sess.endTime})`;
                    if (sess.room) title += ` - القاعة: ${sess.room}`;
                    if (sess.hasHomework) {
                        title += ` [📚 واجب: ${sess.homeworkItems[0].title}]`;
                    }

                    window.db.calendarEvents.push({
                        id: 'tt_' + dateStr + '_' + sess.slotKey + '_' + sess.className,
                        date: dateStr,
                        title,
                        type: sess.hasHomework ? 'homework' : 'task',
                        time: sess.startTime,
                        className: sess.className,
                        slotKey: sess.slotKey,
                        linkedTimetable: true,
                        isOfficial: false
                    });
                    addedCount++;
                });
            }

            cur.setDate(cur.getDate() + 1);
        }

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم تثبيت ومزامنة ${addedCount} حصة بنجاح في التقويم السنوي 📅🎉`, 'success');
        } else if (typeof window.showNotification === 'function') {
            window.showNotification(`تم تثبيت ومزامنة ${addedCount} حصة بنجاح في التقويم السنوي`, 'success');
        }
    }

    /**
     * حذف جميع الحصص المزامنة السابقة من التقويم
     */
    function clearBatchTimetableSyncEvents() {
        if (!window.db || !Array.isArray(window.db.calendarEvents)) return;
        const initialLen = window.db.calendarEvents.length;
        window.db.calendarEvents = window.db.calendarEvents.filter(ev => !ev.linkedTimetable);
        const removed = initialLen - window.db.calendarEvents.length;

        if (typeof window.saveDB === 'function') window.saveDB();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم حذف ${removed} حصة مزامنة من التقويم بنجاح 🗑️`, 'info');
        }
    }

    /**
     * تصدير جدول الحصص مع التنبيهات المسبقة (15 دقيقة) إلى ملف iCal (.ics)
     */
    function exportTimetableWithAlertsIcs() {
        if (!window.db || !window.db.timetable) {
            alert('لا توجد بيانات مسجلة في جدول الحصص لتصديرها.');
            return;
        }

        const WORK_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const dayToIcalByDay = {
            "الإثنين": "MO",
            "الثلاثاء": "TU",
            "الأربعاء": "WE",
            "الخميس": "TH",
            "الجمعة": "FR",
            "السبت": "SA",
            "الأحد": "SU"
        };

        let icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//DigitalTeacher//TimetableCalendarSync//AR',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:جدول حصص الرياضيات والتذكيرات الذكية'
        ];

        const now = new Date();
        const baseYear = now.getFullYear();

        // إنشاء تاريخ البداية
        const pad = (n) => String(n).padStart(2, '0');

        WORK_DAYS.forEach((dayName, dayIndex) => {
            const data = window.db.timetable[dayName];
            if (!data) return;

            const icalDay = dayToIcalByDay[dayName];
            if (!icalDay) return;

            const info = getTimetableSessionsForDate(now); // to get slot info
            // Find reference date for this day of week
            const refDate = new Date(baseYear, 8, 1); // 1 Sep
            while (refDate.getDay() !== dayIndex) {
                refDate.setDate(refDate.getDate() + 1);
            }
            const datePrefix = `${refDate.getFullYear()}${pad(refDate.getMonth() + 1)}${pad(refDate.getDate())}`;

            ['m1', 'm2', 'm3', 'e1', 'e2', 'e3'].forEach(k => {
                let className = '';
                let startTime = '08:00';
                let hrs = 2;
                let room = '';
                let note = '';

                if (k === 'm1') {
                    className = data.m1_class || data.morningClass1 || data.morningClass;
                    startTime = data.m1_time || '08:00';
                    hrs = data.m1_hrs || 2;
                    note = data.m1_note || '';
                } else if (k === 'm2') {
                    className = data.m2_class || data.morningClass2;
                    startTime = data.m2_time || '10:00';
                    hrs = data.m2_hrs || 2;
                    note = data.m2_note || '';
                } else if (k === 'm3') {
                    className = data.m3_class;
                    startTime = data.m3_time || '12:00';
                    hrs = data.m3_hrs || 1;
                    note = data.m3_note || '';
                } else if (k === 'e1') {
                    className = data.e1_class || data.eveningClass1 || data.eveningClass;
                    startTime = data.e1_time || '13:00';
                    hrs = data.e1_hrs || 2;
                    note = data.e1_note || '';
                } else if (k === 'e2') {
                    className = data.e2_class || data.eveningClass2;
                    startTime = data.e2_time || '15:00';
                    hrs = data.e2_hrs || 2;
                    note = data.e2_note || '';
                } else if (k === 'e3') {
                    className = data.e3_class;
                    startTime = data.e3_time || '17:00';
                    hrs = data.e3_hrs || 1;
                    note = data.e3_note || '';
                }

                if (className && className.trim() !== '') {
                    const [sh, sm] = startTime.split(':');
                    const endTime = computeEndTime(startTime, hrs);
                    const [eh, em] = endTime.split(':');

                    const dtStart = `${datePrefix}T${pad(sh)}${pad(sm)}00`;
                    const dtEnd = `${datePrefix}T${pad(eh)}${pad(em)}00`;

                    icsContent.push(
                        'BEGIN:VEVENT',
                        `UID:session_${k}_${dayName}_${Date.now()}@teacherapp.local`,
                        `DTSTAMP:${datePrefix}T000000Z`,
                        `DTSTART:${dtStart}`,
                        `DTEND:${dtEnd}`,
                        `RRULE:FREQ=WEEKLY;BYDAY=${icalDay};UNTIL=${baseYear + 1}0630T235959Z`,
                        `SUMMARY:حصة رياضيات - قسم ${className}`,
                        `DESCRIPTION:حصة مبرمجة في جدول الحصص الأسبوعي لمادة الرياضيات. ${note ? 'ملاحظات: ' + note : ''}`,
                        room ? `LOCATION:القاعة ${room}` : '',
                        'BEGIN:VALARM',
                        'TRIGGER:-PT15M',
                        'ACTION:DISPLAY',
                        `DESCRIPTION:تذكير باقتراب موعد حصة الرياضيات لقسم ${className} (بعد 15 دقيقة) وتفقد الواجبات المنزلية`,
                        'END:VALARM',
                        'END:VEVENT'
                    );
                }
            });
        });

        icsContent.push('END:VCALENDAR');
        const blob = new Blob([icsContent.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `جدول_الحصص_مع_التنبيهات_المسبقة_${baseYear}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم تصدير ملف التقويم التفاعلي (.ics) بنجاح 📥📅', 'success');
        }
    }

    /**
     * نافذة الإضافة السريعة لواجب منزلي مرتبط بحصة محددة
     */
    function openQuickAddSessionHomeworkModal(className, dateStr) {
        const modal = document.getElementById('quickAddSessionHomeworkModal');
        const classInput = document.getElementById('quickHwClassInput');
        const dateInput = document.getElementById('quickHwDateInput');
        const titleInput = document.getElementById('quickHwTitleInput');
        const noteInput = document.getElementById('quickHwNoteInput');

        if (!modal) return;

        if (classInput) classInput.value = className || '';
        if (dateInput) {
            if (dateStr) {
                dateInput.value = dateStr;
            } else {
                const now = new Date();
                dateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }
        }
        if (titleInput) titleInput.value = '';
        if (noteInput) noteInput.value = '';

        modal.classList.add('active');
        if (titleInput) titleInput.focus();
        if (window.renderLucide) window.renderLucide();
    }

    function closeQuickAddSessionHomeworkModal() {
        const modal = document.getElementById('quickAddSessionHomeworkModal');
        if (modal) modal.classList.remove('active');
    }

    function submitQuickSessionHomework() {
        const classInput = document.getElementById('quickHwClassInput');
        const dateInput = document.getElementById('quickHwDateInput');
        const titleInput = document.getElementById('quickHwTitleInput');
        const noteInput = document.getElementById('quickHwNoteInput');

        const className = classInput ? classInput.value.trim() : '';
        const date = dateInput ? dateInput.value : '';
        const title = titleInput ? titleInput.value.trim() : '';
        const note = noteInput ? noteInput.value.trim() : '';

        if (!className || !date || !title) {
            alert('يرجى تحديد القسم، التاريخ، ووصف الواجب المنزلي.');
            return;
        }

        if (!window.db) window.db = {};
        if (!window.db.homeworkAgenda) window.db.homeworkAgenda = {};
        if (!window.db.homeworkAgenda[className]) window.db.homeworkAgenda[className] = [];

        window.db.homeworkAgenda[className].push({
            id: Date.now().toString(),
            title: title + (note ? ` (${note})` : ''),
            date
        });

        if (typeof window.saveDB === 'function') window.saveDB();

        // تحديث واجهات الأجندة والتقويم والرادار
        if (typeof window.renderHomeworkAgenda === 'function') window.renderHomeworkAgenda();
        if (typeof window.checkHomeworkAlerts === 'function') window.checkHomeworkAlerts();
        if (typeof window.renderCalendar === 'function') window.renderCalendar();
        checkUpcomingSessionRadar();

        closeQuickAddSessionHomeworkModal();

        if (typeof window.showAppToast === 'function') {
            window.showAppToast(`تم ربط الواجب بالقسم ${className} ليوم ${date} بنجاح 📚✨`, 'success');
        }
    }

    /**
     * مساعدات سريعة لتسجيل الحضور وتفقد الواجبات
     */
    function openFastAttendanceForClass(className, dateStr) {
        if (typeof window.switchTab === 'function') window.switchTab('absence');
        if (typeof window.changeClass === 'function') window.changeClass(className);
        if (typeof window.closeDayDetailsModal === 'function') window.closeDayDetailsModal();
    }

    function focusHomeworkTrackingForClass(className) {
        if (typeof window.switchTab === 'function') window.switchTab('tutoring');
        if (typeof window.changeClass === 'function') window.changeClass(className);
        if (typeof window.closeDayDetailsModal === 'function') window.closeDayDetailsModal();

        setTimeout(() => {
            const hwCol = document.querySelector('[data-type="homework"]') || document.getElementById('tutoringHwHeader');
            if (hwCol) {
                hwCol.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }

    // تهيئة المؤقت الدوري
    function init() {
        checkUpcomingSessionRadar();
        if (radarInterval) clearInterval(radarInterval);
        radarInterval = setInterval(checkUpcomingSessionRadar, 30000); // Check every 30 seconds
    }

    // تصدير الدوال عالمياً
    window.getTimetableSyncConfig = getTimetableSyncConfig;
    window.saveTimetableCalendarSyncSettings = saveTimetableCalendarSyncSettings;
    window.toggleTtSyncMaster = toggleTtSyncMaster;
    window.getTimetableSessionsForDate = getTimetableSessionsForDate;
    window.checkUpcomingSessionRadar = checkUpcomingSessionRadar;
    window.goToSessionAttendanceFromRadar = goToSessionAttendanceFromRadar;
    window.goToSessionLessonLogFromRadar = goToSessionLessonLogFromRadar;
    window.snoozeUpcomingSessionRadar = snoozeUpcomingSessionRadar;
    window.dismissUpcomingSessionRadar = dismissUpcomingSessionRadar;
    window.triggerTestUpcomingSessionRadar = triggerTestUpcomingSessionRadar;
    window.openTimetableCalendarSyncModal = openTimetableCalendarSyncModal;
    window.closeTimetableCalendarSyncModal = closeTimetableCalendarSyncModal;
    window.switchTtSyncModalTab = switchTtSyncModalTab;
    window.renderTtSyncLivePreview = renderTtSyncLivePreview;
    window.executeBatchTimetableSync = executeBatchTimetableSync;
    window.clearBatchTimetableSyncEvents = clearBatchTimetableSyncEvents;
    window.exportTimetableWithAlertsIcs = exportTimetableWithAlertsIcs;
    window.openQuickAddSessionHomeworkModal = openQuickAddSessionHomeworkModal;
    window.closeQuickAddSessionHomeworkModal = closeQuickAddSessionHomeworkModal;
    window.submitQuickSessionHomework = submitQuickSessionHomework;
    window.openFastAttendanceForClass = openFastAttendanceForClass;
    window.focusHomeworkTrackingForClass = focusHomeworkTrackingForClass;
    window.playChimeSound = playChimeSound;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);
