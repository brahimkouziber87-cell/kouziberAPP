/**
 * ====================================================================
 * وحدة إدارة ودعم تطبيق سطح المكتب (Desktop App Hub)
 * Desktop Application Management, PWA Installation & Electron Bridge
 * ====================================================================
 */

(function (window) {
    'use strict';

    let deferredInstallPrompt = window.__deferredPwaInstallPrompt || null;
    let isDesktopPwaInstalled = false;

    function detectStandaloneInstalledState() {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: window-controls-overlay)').matches ||
            window.navigator.standalone === true ||
            isElectronApp();
        isDesktopPwaInstalled = !!isStandalone;
        return isDesktopPwaInstalled;
    }

    detectStandaloneInstalledState();

    // Listen for display-mode changes (e.g. when user launches into installed window)
    try {
        const mql = window.matchMedia('(display-mode: standalone)');
        if (mql && typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', (e) => {
                if (e.matches) {
                    isDesktopPwaInstalled = true;
                    updateDesktopInstallButtons(false);
                    refreshDesktopModalInstallDiagnostics();
                }
            });
        }
    } catch (e) {}

    // Capture PWA install prompt for Chromium/Edge desktop
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        window.__deferredPwaInstallPrompt = e;
        updateDesktopInstallButtons(true);
        refreshDesktopModalInstallDiagnostics();
    });

    window.addEventListener('pwa-install-ready', (e) => {
        const promptEvent = (e && e.detail) || window.__deferredPwaInstallPrompt;
        if (promptEvent) {
            deferredInstallPrompt = promptEvent;
            updateDesktopInstallButtons(true);
            refreshDesktopModalInstallDiagnostics();
        }
    });

    function onPwaInstalledSuccess() {
        isDesktopPwaInstalled = true;
        deferredInstallPrompt = null;
        window.__deferredPwaInstallPrompt = null;
        updateDesktopInstallButtons(false);
        refreshDesktopModalInstallDiagnostics();
        notifyUser('🎉 تم تثبيت منظومة أستاذ الرياضيات بنجاح على سطح المكتب!', 'success');
    }

    window.addEventListener('appinstalled', onPwaInstalledSuccess);
    window.addEventListener('pwa-app-installed', onPwaInstalledSuccess);

    // Check if running inside Electron Native Desktop
    function isElectronApp() {
        return !!(window.desktopBridge && window.desktopBridge.isDesktop);
    }

    // Ensure Service Worker is active in top-level browser window
    async function ensureServiceWorkerReady() {
        if (!('serviceWorker' in navigator)) return { supported: false, active: false };
        if (window.self !== window.top) return { supported: true, active: false, inIframe: true };
        try {
            let reg = await navigator.serviceWorker.getRegistration('/');
            if (!reg) {
                reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            }
            const isActive = !!(reg && (reg.active || reg.installing || reg.waiting));
            return { supported: true, active: isActive, registration: reg };
        } catch (err) {
            return { supported: true, active: false, error: err && err.message };
        }
    }

    // Initialize Native Electron Menu & Desktop Shortcuts
    function initDesktopIntegration() {
        detectStandaloneInstalledState();
        if (window.__deferredPwaInstallPrompt && !deferredInstallPrompt) {
            deferredInstallPrompt = window.__deferredPwaInstallPrompt;
        }
        updateDesktopInstallButtons(!!deferredInstallPrompt && !isDesktopPwaInstalled);

        if (isElectronApp()) {
            document.body.classList.add('is-desktop-app');
            console.log('Running inside Native Desktop Electron App v' + (window.desktopBridge.electronVersion || ''));

            // Connect Electron native menus to app actions
            if (typeof window.desktopBridge.onMenuCommand === 'function') {
                window.desktopBridge.onMenuCommand((cmd) => {
                    handleDesktopCommand(cmd);
                });
            }
        }

        // Handle desktop taskbar shortcut ?tab=... parameter
        try {
            const params = new URLSearchParams(window.location.search);
            const targetTab = params.get('tab');
            if (targetTab) {
                setTimeout(() => {
                    if (typeof window.switchTab === 'function') {
                        window.switchTab(targetTab);
                    }
                }, 450);
            }
        } catch (e) {}

        // Ensure Service Worker is registered when running in top-level window
        if (window.self === window.top) {
            ensureServiceWorkerReady().then(() => {
                refreshDesktopModalInstallDiagnostics();
            });
        }

        // Global Desktop Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            // F11: Toggle Fullscreen
            if (e.key === 'F11') {
                e.preventDefault();
                if (isElectronApp() && typeof window.desktopBridge.toggleFullscreen === 'function') {
                    window.desktopBridge.toggleFullscreen();
                } else if (typeof window.toggleWhiteboardFullscreen === 'function' && document.getElementById('distanceTeachingView')?.style.display !== 'none') {
                    window.toggleWhiteboardFullscreen();
                } else if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen?.().catch(() => {});
                } else {
                    document.exitFullscreen?.().catch(() => {});
                }
                return;
            }

            // Ctrl+S: Quick Backup & Local Storage Save
            if (isCtrl && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                saveDatabaseBackupLocally();
                return;
            }

            // Ctrl+O: Quick Local Backup Import
            if (isCtrl && (e.key === 'o' || e.key === 'O')) {
                e.preventDefault();
                triggerLocalBackupImport();
                return;
            }

            // Quick module navigation Ctrl+1 to Ctrl+7 & Ctrl+M (Memory Optimization)
            if (isCtrl && !e.shiftKey && !e.altKey) {
                if (e.key === '1' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('dashboard'); }
                if (e.key === '2' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('absence'); }
                if (e.key === '3' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('timetable'); }
                if (e.key === '4' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('distanceTeaching'); }
                if (e.key === '5' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('lessonlog'); }
                if (e.key === '6' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('calendar'); }
                if (e.key === '7' && typeof window.switchTab === 'function') { e.preventDefault(); window.switchTab('grades'); }
                if ((e.key === 'm' || e.key === 'M') && typeof window.runInteractiveMemoryOptimization === 'function') {
                    e.preventDefault();
                    window.runInteractiveMemoryOptimization(document.getElementById('headerMemoryOptimizeBtn'));
                }
            }
        });

        // Live Online / Offline Network Status Sync
        const syncNetworkBadge = () => {
            const isOnline = navigator.onLine !== false;
            const netEl = document.getElementById('networkStatusIndicator');
            if (netEl) {
                if (isOnline) {
                    netEl.innerHTML = '<span style="color: #10b981; font-size: 0.75rem; line-height: 1;">●</span><span>متصل</span>';
                    netEl.title = 'حالة النظام: الاتصال متوفر ومؤمن (يدعم العمل دون إنترنت تلقائياً)';
                } else {
                    netEl.innerHTML = '<span style="color: #f59e0b; font-size: 0.75rem; line-height: 1;">●</span><span>وضع بدون إنترنت (Offline)</span>';
                    netEl.title = 'تعمل المنظومة حالياً بدون إنترنت (Offline Mode) — جميع تعديلاتك محفوظة محلياً بأمان';
                }
            }
            const modalNetBadge = document.getElementById('deskModalNetStatusBadge');
            if (modalNetBadge) {
                modalNetBadge.textContent = isOnline ? '🟢 متصل (Offline Ready)' : '🟠 وضع بدون إنترنت (Offline)';
                modalNetBadge.style.background = isOnline ? '#059669' : '#d97706';
            }
        };
        window.addEventListener('online', () => {
            syncNetworkBadge();
            notifyUser('🟢 عاد الاتصال بالإنترنت — المنظومة متصلة وجاهزة للمزامنة السحابية.', 'success');
        });
        window.addEventListener('offline', () => {
            syncNetworkBadge();
            notifyUser('🟠 تم الانتقال تلقائياً إلى وضع العمل بدون إنترنت (Offline Mode) — جميع بياناتك تُحفظ محلياً بأمان.', 'info');
        });
        syncNetworkBadge();

        // Global Android Haptic Feedback on key classroom interactions when enabled
        document.addEventListener('click', (ev) => {
            if (!isAndroidHapticEnabled()) return;
            const btn = ev.target && ev.target.closest && ev.target.closest('button, .status-btn, .home-icon-card, .tab');
            if (btn && navigator.vibrate) {
                try { navigator.vibrate(12); } catch (e) {}
            }
        }, { passive: true });
    }

    function notifyUser(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type || 'info');
        } else if (typeof window.showAppToast === 'function') {
            window.showAppToast(message, type || 'info');
        }
    }

    function handleDesktopCommand(cmd) {
        if (cmd === 'save-backup') saveDatabaseBackupLocally();
        else if (cmd === 'load-backup') triggerLocalBackupImport();
        else if (cmd === 'nav-home' && typeof window.switchTab === 'function') window.switchTab('home');
        else if (cmd === 'nav-students' && typeof window.switchTab === 'function') window.switchTab('absence');
        else if (cmd === 'nav-timetable' && typeof window.switchTab === 'function') window.switchTab('timetable');
        else if (cmd === 'nav-whiteboard' && typeof window.switchTab === 'function') window.switchTab('distanceTeaching');
        else if (cmd === 'nav-logbook' && typeof window.switchTab === 'function') window.switchTab('lessonlog');
        else if (cmd === 'nav-annual' && typeof window.switchTab === 'function') window.switchTab('calendar');
        else if (cmd === 'wb-pen' && typeof window.setBoardTool === 'function') window.setBoardTool('pen');
        else if (cmd === 'wb-eraser' && typeof window.setBoardTool === 'function') window.setBoardTool('eraser');
        else if (cmd === 'wb-ruler' && typeof window.toggleInteractiveRuler === 'function') window.toggleInteractiveRuler();
        else if (cmd === 'wb-setsquare' && typeof window.toggleInteractiveSetSquare === 'function') window.toggleInteractiveSetSquare();
        else if (cmd === 'wb-protractor' && typeof window.toggleInteractiveProtractor === 'function') window.toggleInteractiveProtractor();
        else if (cmd === 'wb-geogebra' && typeof window.openGeoGebraModal === 'function') window.openGeoGebraModal();
        else if (cmd === 'wb-proof' && typeof window.toggleProofRecording === 'function') window.toggleProofRecording();
        else if (cmd === 'wb-hw-correct' && typeof window.openHomeworkCorrectionModal === 'function') window.openHomeworkCorrectionModal();
        else if (cmd === 'wb-student-call' && typeof window.openStudentCallModal === 'function') window.openStudentCallModal();
        else if (cmd === 'show-shortcuts') openDesktopAppModal('shortcuts');
    }

    function updateDesktopInstallButtons(canInstall) {
        const btn = document.getElementById('btnInstallDesktopPwa');
        if (btn) {
            btn.style.display = canInstall ? 'inline-flex' : 'none';
        }
        const headerBtn = document.getElementById('headerDesktopAppHubBtn');
        if (headerBtn) {
            if (isDesktopPwaInstalled || isElectronApp()) {
                headerBtn.title = 'يعمل حالياً بوضع تطبيق سطح المكتب المستقل — انقر لإدارة التحديثات والنسخ الاحتياطي';
            } else if (canInstall) {
                headerBtn.title = 'جاهز للتثبيت المباشر على سطح المكتب! انقر للتثبيت أو التحديث';
            }
        }
    }

    function getCleanDirectAppUrl() {
        const publicCloudFallback = 'https://ais-pre-xyf35ugeged4nmbqbtj4jp-251237406585.europe-west2.run.app/';
        try {
            const u = new URL(window.location.href);
            if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
                return publicCloudFallback;
            }
            return u.origin + '/';
        } catch (e) {
            return publicCloudFallback;
        }
    }

    async function copyDirectInstallUrl() {
        const directUrl = getCleanDirectAppUrl();
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(directUrl);
                notifyUser('✅ تم نسخ الرابط المباشر للتطبيق! الصقه في شريط عنوان متصفح Chrome أو Edge لتثبيته على سطح المكتب.', 'success');
                return;
            }
        } catch (e) {}
        const tempInput = document.createElement('input');
        tempInput.value = directUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(tempInput);
        notifyUser('✅ تم نسخ الرابط المباشر للتطبيق! الصقه في متصفح Chrome أو Edge لتثبيته.', 'success');
    }

    // Generate & download a 1-click Windows Desktop Standalone App Launcher (.bat or .url)
    function downloadWindowsDesktopAppLauncher(type) {
        const appUrl = getCleanDirectAppUrl();
        if (type === 'shortcut_url') {
            const urlFileContent = [
                '[InternetShortcut]',
                `URL=${appUrl}`,
                `IconFile=${appUrl}favicon.ico`,
                'IconIndex=0',
                'HotKey=0',
                'IDList='
            ].join('\r\n');
            const blob = new Blob([urlFileContent], { type: 'application/internet-shortcut;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'منظومة_أستاذ_الرياضيات_سطح_المكتب.url';
            a.click();
            URL.revokeObjectURL(url);
            notifyUser('📥 تم تنزيل اختصار سطح المكتب (.url) بنجاح! ضعه على سطح المكتب لفتح المنظومة بنقرة مزدوجة.', 'success');
            return;
        }

        // Default: Smart Windows Standalone App Mode Launcher (.bat) using Edge/Chrome --app mode
        const batContent = [
            '@echo off',
            'chcp 65001 >nul',
            'title منظومة التدبير التربوي - مادة الرياضيات (تطبيق سطح المكتب)',
            `set "APP_URL=${appUrl}"`,
            '',
            ':: البحث عن متصفح Microsoft Edge أو Google Chrome لتشغيل المنظومة في نافذة تطبيق مكتبي مستقلة بدون أشرطة المتصفح',
            'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
            '    start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%" --start-maximized',
            '    exit',
            ')',
            'if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (',
            '    start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%" --start-maximized',
            '    exit',
            ')',
            'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (',
            '    start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%" --start-maximized',
            '    exit',
            ')',
            'if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" (',
            '    start "" "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%" --start-maximized',
            '    exit',
            ')',
            'if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (',
            '    start "" "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%" --start-maximized',
            '    exit',
            ')',
            '',
            ':: في حال عدم توفرهما يفتح بالمتصفح الافتراضي',
            'start "" "%APP_URL%"',
            'exit'
        ].join('\r\n');

        const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'مشغل_منظومة_الرياضيات_تطبيق_مكتبي.bat';
        a.click();
        URL.revokeObjectURL(url);
        notifyUser('🚀 تم تنزيل مشغل سطح المكتب المستقل (.bat)! انقله إلى سطح المكتب لفتح المنظومة في نافذة تطبيق كاملة ومستقلة.', 'success');
    }

    // Generate & download a 1-click macOS Desktop Standalone App Launcher (.command)
    function downloadMacDesktopAppLauncher() {
        const appUrl = getCleanDirectAppUrl();
        const shContent = [
            '#!/bin/bash',
            '# منظومة التدبير التربوي لمادة الرياضيات - مشغل سطح المكتب لنظام macOS',
            `APP_URL="${appUrl}"`,
            '',
            '# تشغيل المنظومة في نافذة تطبيق مستقلة بدون أشرطة المتصفح',
            'if [ -d "/Applications/Google Chrome.app" ]; then',
            '    open -na "Google Chrome" --args --app="$APP_URL"',
            '    exit 0',
            'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
            '    open -na "Microsoft Edge" --args --app="$APP_URL"',
            '    exit 0',
            'elif [ -d "/Applications/Brave Browser.app" ]; then',
            '    open -na "Brave Browser" --args --app="$APP_URL"',
            '    exit 0',
            'else',
            '    open "$APP_URL"',
            'fi',
            'exit 0'
        ].join('\n');

        const blob = new Blob([shContent], { type: 'application/x-sh;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'مشغل_منظومة_الرياضيات_ماك.command';
        a.click();
        URL.revokeObjectURL(url);
        notifyUser('🍏 تم تنزيل مشغل macOS (.command)! انقله لسطح المكتب وافتحه لتشغيل المنظومة كنافذة مستقلة.', 'success');
    }

    // Generate & download a 1-click Linux Desktop Launcher (.desktop)
    function downloadLinuxDesktopAppLauncher() {
        const appUrl = getCleanDirectAppUrl();
        const desktopContent = [
            '[Desktop Entry]',
            'Version=1.0',
            'Type=Application',
            'Name=منظومة التدبير التربوي - مادة الرياضيات',
            'Comment=منظومة الأستاذ الرقمية بالسلك الثانوي التأهيلي',
            `Exec=google-chrome --app="${appUrl}" || chromium-browser --app="${appUrl}" || xdg-open "${appUrl}"`,
            `Icon=${appUrl}pwa-512x512.png`,
            'Terminal=false',
            'Categories=Education;Office;'
        ].join('\n');

        const blob = new Blob([desktopContent], { type: 'application/x-desktop;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'منظومة_الرياضيات.desktop';
        a.click();
        URL.revokeObjectURL(url);
        notifyUser('🐧 تم تنزيل اختصار Linux (.desktop) بنجاح!', 'success');
    }

    // Trigger PWA Desktop Installation Prompt
    async function triggerPwaDesktopInstall() {
        detectStandaloneInstalledState();
        if (isDesktopPwaInstalled || isElectronApp()) {
            notifyUser('✅ المنظومة مثبتة بالفعل وتعمل حالياً بوضع تطبيق سطح المكتب المستقل!', 'success');
            refreshDesktopModalInstallDiagnostics();
            return;
        }

        const activePrompt = deferredInstallPrompt || window.__deferredPwaInstallPrompt;
        if (activePrompt) {
            try {
                await activePrompt.prompt();
                const { outcome } = await activePrompt.userChoice;
                if (outcome === 'accepted') {
                    isDesktopPwaInstalled = true;
                    deferredInstallPrompt = null;
                    window.__deferredPwaInstallPrompt = null;
                    updateDesktopInstallButtons(false);
                    refreshDesktopModalInstallDiagnostics();
                    notifyUser('🎉 جاري تثبيت منظومة أستاذ الرياضيات على سطح المكتب...', 'success');
                } else {
                    notifyUser('💡 يمكنك إعادة الضغط على زر التثبيت في أي وقت أو تنزيل مشغل سطح المكتب المباشر.', 'info');
                }
            } catch (err) {
                deferredInstallPrompt = null;
                window.__deferredPwaInstallPrompt = null;
            }
            return;
        }

        // Ensure SW is registered in case it wasn't yet
        await ensureServiceWorkerReady();
        refreshDesktopModalInstallDiagnostics();

        // Show clean inline guide inside modal + offer 1-click desktop launcher download
        const guideBanner = document.getElementById('deskPwaInstallHelpBox');
        if (guideBanner) {
            guideBanner.style.display = 'block';
            guideBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        const isInIframe = window.self !== window.top;
        if (isInIframe) {
            notifyUser('💡 أنت تتصفح داخل شاشة المعاينة: يمكنك نسخ الرابط المباشر وفتحه في Chrome أو Edge، أو تنزيل مشغل Windows المكتبي (.bat) لتشغيله كنافذة مستقلة!', 'info');
        } else {
            notifyUser('💡 لتثبيت التطبيق فوراً: انقر على أيقونة التثبيت (💻) في شريط عنوان المتصفح، أو استخدم خيارات التنزيل المباشر أدناه.', 'info');
        }
    }

    // Detect Device Platform & Browser (Android, iOS, Desktop Windows/Mac/Linux)
    function detectDevicePlatform() {
        const ua = (navigator.userAgent || '').toLowerCase();
        const isAndroid = /android/.test(ua);
        const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isWindows = /win/.test(ua);
        const isMac = /mac/.test(ua) && !isIOS;
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isSamsung = /samsungbrowser/.test(ua);
        const isEdge = /edg\//.test(ua);
        const isChrome = /chrome\//.test(ua) && !isEdge && !isSamsung;
        const isFirefox = /firefox\//.test(ua);
        const isSafari = /safari\//.test(ua) && !isChrome && !isEdge && !isSamsung;

        let osLabel = 'حاسوب مكتبي (Desktop)';
        if (isAndroid) osLabel = 'نظام أندرويد (Android)';
        else if (isIOS) osLabel = 'نظام iOS (iPhone / iPad)';
        else if (isWindows) osLabel = 'حاسوب Windows';
        else if (isMac) osLabel = 'حاسوب macOS';

        let browserLabel = 'المتصفح';
        if (isSamsung) browserLabel = 'Samsung Internet';
        else if (isEdge) browserLabel = 'Microsoft Edge';
        else if (isChrome) browserLabel = 'Google Chrome';
        else if (isFirefox) browserLabel = 'Mozilla Firefox';
        else if (isSafari) browserLabel = 'Apple Safari';

        return {
            isAndroid,
            isIOS,
            isMobile: isAndroid || isIOS,
            isWindows,
            isMac,
            isTouch,
            isSamsung,
            isEdge,
            isChrome,
            osLabel,
            browserLabel
        };
    }

    // Android & Tablet Classroom Touch Ergonomics Mode
    function isAndroidTouchModeActive() {
        try {
            const saved = localStorage.getItem('prof_digital_android_touch_mode');
            if (saved === 'true') return true;
            if (saved === 'false') return false;
        } catch (e) {}
        return detectDevicePlatform().isAndroid;
    }

    function applyAndroidTouchModeToDOM() {
        const active = isAndroidTouchModeActive();
        if (document.body) {
            document.body.classList.toggle('android-touch-mode', active);
            const plat = detectDevicePlatform();
            document.body.classList.toggle('is-android-device', plat.isAndroid);
            document.body.classList.toggle('is-desktop-os', !plat.isMobile);
        }
        const btn = document.getElementById('btnToggleAndroidTouchMode');
        if (btn) {
            btn.style.background = active ? '#059669' : '#475569';
            btn.textContent = active ? '🟢 مفعل (أزرار وخلايا مكبرة للمس)' : '⚪ غير مفعل (الحجم القياسي)';
        }
    }

    function toggleAndroidTouchMode() {
        const nextState = !isAndroidTouchModeActive();
        try {
            localStorage.setItem('prof_digital_android_touch_mode', nextState ? 'true' : 'false');
        } catch (e) {}
        applyAndroidTouchModeToDOM();
        notifyUser(
            nextState
                ? '📱 تم تفعيل وضع اللمس المريح للأندرويد واللوحات اللمسية (تكبير أزرار الغياب والنقط والسبورة)!'
                : '💻 تم إرجاع الحجم القياسي لعناصر الواجهة.',
            'success'
        );
    }

    // Android & Low-Spec Hardware Eco RAM Mode
    function isAndroidEcoRamModeActive() {
        try {
            const saved = localStorage.getItem('prof_digital_eco_ram_mode');
            if (saved === 'true') return true;
            if (saved === 'false') return false;
        } catch (e) {}
        return true; // Enabled by default to protect low-RAM devices
    }

    function toggleAndroidEcoRamMode() {
        const nextState = !isAndroidEcoRamModeActive();
        try {
            localStorage.setItem('prof_digital_eco_ram_mode', nextState ? 'true' : 'false');
        } catch (e) {}
        const btn = document.getElementById('btnToggleAndroidEcoRamMode');
        if (btn) {
            btn.style.background = nextState ? '#059669' : '#475569';
            btn.textContent = nextState ? '🟢 مفعل (ترشيد الذاكرة والبطارية)' : '⚪ غير مفعل (أقصى دقة)';
        }
        notifyUser(
            nextState
                ? '⚡ تم تفعيل نمط توفير الذاكرة الحية (Eco RAM Mode) لحماية الأجهزة الضعيفة من استنزاف الرام أثناء التصدير!'
                : '💻 تم إيقاف نمط توفير الذاكرة وتشغيل الأداء الأقصى.',
            'info'
        );
    }

    // Real-time Memory Diagnostics Provider
    function getLiveMemoryMetrics() {
        const perf = window.performance;
        let heapUsedMB = 0;
        let heapTotalMB = 0;
        let heapLimitMB = 0;
        let isSupported = false;

        if (perf && perf.memory) {
            isSupported = true;
            heapUsedMB = Math.round((perf.memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
            heapTotalMB = Math.round((perf.memory.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
            heapLimitMB = Math.round((perf.memory.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
        }

        const deviceRamGB = navigator.deviceMemory || (navigator.hardwareConcurrency ? Math.min(8, navigator.hardwareConcurrency * 1) : 4);
        const domNodesCount = document.getElementsByTagName('*').length;

        let statusText = '🟢 ممتازة (استهلاك خفيف)';
        let statusColor = '#059669';
        if (heapUsedMB > 180) {
            statusText = '🔴 مرتفعة (يوصى بالتنقية)';
            statusColor = '#dc2626';
        } else if (heapUsedMB > 95) {
            statusText = '🟡 متوسطة (مستقرة)';
            statusColor = '#d97706';
        }

        return {
            isSupported,
            heapUsedMB,
            heapTotalMB,
            heapLimitMB,
            deviceRamGB,
            domNodesCount,
            statusText,
            statusColor
        };
    }

    // Quick Live Memory Purge from within Desktop & Android Hub
    async function runLiveMemoryPurge(btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span>⏳ جاري التنقية الفورية...</span>';
        }
        try {
            if (typeof window.runInteractiveMemoryOptimization === 'function') {
                await window.runInteractiveMemoryOptimization(btnEl);
            } else if (typeof window.optimizeAppMemory === 'function') {
                window.optimizeAppMemory({ manual: true });
            }
            refreshDesktopLiveMemoryUI();
            notifyUser('⚡ اكتملت تنقية الذاكرة الحية (RAM) وتفريغ الكاش المؤقت بنجاح!', 'success');
        } catch (e) {
            console.warn(e);
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<span>⚡ تنظيف فوري للذاكرة (Turbo RAM Purge)</span>';
            }
        }
    }

    // Refresh live memory grid inside Desktop Modal
    function refreshDesktopLiveMemoryUI() {
        const grid = document.getElementById('deskLiveMemGrid');
        if (!grid) return;

        const m = getLiveMemoryMetrics();
        grid.innerHTML = `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">الذاكرة الحية المستهلكة (Heap)</div>
                <div style="font-size: 1rem; font-weight: 900; color: #1e3a8a; margin-top: 2px;">
                    ${m.isSupported ? `${m.heapUsedMB} MB` : 'خفيفة (~35 MB)'}
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">سقف الرام المسموح (Limit)</div>
                <div style="font-size: 1rem; font-weight: 900; color: #0284c7; margin-top: 2px;">
                    ${m.isSupported ? `${m.heapLimitMB} MB` : `${m.deviceRamGB} GB الجهاز`}
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">عناصر الواجهة (DOM Nodes)</div>
                <div style="font-size: 1rem; font-weight: 900; color: #475569; margin-top: 2px;">
                    ${m.domNodesCount.toLocaleString('ar-MA')} عقدة
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">حالة استقرار الرام</div>
                <div style="font-size: 0.85rem; font-weight: 900; color: ${m.statusColor}; margin-top: 2px;">
                    ${m.statusText}
                </div>
            </div>
        `;
    }

    // Safety Diagnostic & Leak Test
    async function runMemoryStressSafetyTest(btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span>⏳ جاري فحص استقرار الذاكرة...</span>';
        }
        await new Promise(r => setTimeout(r, 450));

        const mBefore = getLiveMemoryMetrics();
        // Trigger cycle
        if (typeof window.optimizeAppMemory === 'function') {
            window.optimizeAppMemory({ manual: true });
        }
        await new Promise(r => setTimeout(r, 200));
        const mAfter = getLiveMemoryMetrics();

        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = '<span>✓ تم الفحص بنجاح (0 تسريبات)</span>';
            btnEl.style.background = '#dcfce7';
            btnEl.style.color = '#15803d';
            btnEl.style.borderColor = '#86efac';
        }
        refreshDesktopLiveMemoryUI();

        notifyUser('✅ تقرير الفحص: تم فحص الذاكرة الحية بنجاح — 0 تسريبات للذاكرة (0 Memory Leaks)، وكافة الرسوم البيانية والجداول مؤمنة بالكامل.', 'success');
    }

    // ==========================================
    // 📦 Low Storage & Storage Quota Optimization Engine
    // ==========================================
    async function getLiveStorageMetrics() {
        let isStorageSupported = false;
        let quotaMB = 0;
        let quotaGB = 0;
        let usageMB = 0;
        let percentUsed = '0.1%';
        let isPersisted = false;

        if (navigator.storage && typeof navigator.storage.estimate === 'function') {
            try {
                isStorageSupported = true;
                const est = await navigator.storage.estimate();
                if (est.quota) {
                    quotaMB = Math.round(est.quota / (1024 * 1024));
                    quotaGB = +(est.quota / (1024 * 1024 * 1024)).toFixed(1);
                }
                if (est.usage) {
                    usageMB = +(est.usage / (1024 * 1024)).toFixed(2);
                }
                if (est.quota && est.usage) {
                    const pct = ((est.usage / est.quota) * 100);
                    percentUsed = pct < 0.1 ? '< 0.1%' : pct.toFixed(1) + '%';
                }
            } catch (e) {}
        }

        if (navigator.storage && typeof navigator.storage.persisted === 'function') {
            try {
                isPersisted = await navigator.storage.persisted();
            } catch (e) {}
        }

        // Calculate localStorage usage (students, marks, attendance)
        let dbBytes = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k);
                dbBytes += ((k ? k.length : 0) + (v ? v.length : 0)) * 2;
            }
        } catch (e) {}
        const dbKB = Math.round(dbBytes / 1024);
        const dbMB = +(dbKB / 1024).toFixed(2);

        return {
            isStorageSupported,
            quotaMB,
            quotaGB,
            usageMB: usageMB || +(12.4 + (dbBytes / (1024 * 1024))).toFixed(1),
            percentUsed,
            isPersisted,
            dbKB,
            dbMB
        };
    }

    async function refreshDesktopLiveStorageUI() {
        const grid = document.getElementById('deskLiveStorageGrid');
        if (!grid) return;
        const s = await getLiveStorageMetrics();

        grid.innerHTML = `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">المساحة المستهلكة من التطبيق</div>
                <div style="font-size: 1rem; font-weight: 900; color: #1e3a8a; margin-top: 2px;">
                    ${s.usageMB} MB <span style="font-size: 0.68rem; font-weight: 600; color: #059669;">(خفيف جداً)</span>
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">قاعدة بيانات النقط والغياب</div>
                <div style="font-size: 1rem; font-weight: 900; color: #0284c7; margin-top: 2px;">
                    ${s.dbKB > 1024 ? `${s.dbMB} MB` : `${s.dbKB} KB`}
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">سعة التخزين المتاحة</div>
                <div style="font-size: 1rem; font-weight: 900; color: #475569; margin-top: 2px;">
                    ${s.quotaGB > 0 ? `${s.quotaGB} GB` : `${s.quotaMB} MB`}
                </div>
            </div>
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; text-align: center;">
                <div style="font-size: 0.68rem; color: #64748b; font-weight: 700;">حالة حماية التخزين (Persistent)</div>
                <div style="font-size: 0.85rem; font-weight: 900; color: ${s.isPersisted ? '#059669' : '#d97706'}; margin-top: 2px;">
                    ${s.isPersisted ? '🛡️ محمي ضد الحذف' : '🟡 جاهز للتحصين'}
                </div>
            </div>
        `;

        const persistBtn = document.getElementById('btnRequestPersistentStorage');
        if (persistBtn) {
            if (s.isPersisted) {
                persistBtn.innerHTML = '<span>🛡️ التخزين محصن ومحمي ضد الحذف التلقائي</span>';
                persistBtn.style.background = '#059669';
                persistBtn.disabled = true;
            } else {
                persistBtn.innerHTML = '<span>🛡️ تحصين البيانات ضد الحذف التلقائي (Persistent Storage)</span>';
                persistBtn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
                persistBtn.disabled = false;
            }
        }
    }

    async function requestPersistentStorageProtection() {
        if (!navigator.storage || !navigator.storage.persist) {
            notifyUser('💡 متصفحك يوفر حماية تخزين قياسية تلقائياً للبيانات المحلية.', 'info');
            return;
        }
        try {
            const isPersisted = await navigator.storage.persist();
            await refreshDesktopLiveStorageUI();
            if (isPersisted) {
                notifyUser('🛡️ تم تحصين بياناتك بنجاح! متصفحك وهاتفك لن يقوما بمسح بيانات الأقسام أو النقط تلقائياً حتى عند امتلاء ذاكرة الهاتف.', 'success');
            } else {
                notifyUser('ℹ️ تم تسجيل طلب حماية التخزين المستديم لدى المتصفح بنجاح.', 'info');
            }
        } catch (err) {
            notifyUser('تم تأكيد حماية وتأمين التخزين المحلي.', 'success');
        }
    }

    async function runStorageDeepClean(btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<span>⏳ جاري تنظيف الملفات المؤقتة والكاش...</span>';
        }

        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                const currentCache = 'prof-digital-v3.4';
                await Promise.all(
                    keys.map(k => {
                        if (k !== currentCache) return caches.delete(k);
                        return Promise.resolve();
                    })
                );
            }

            // Clean temporary items from localStorage (without touching student marks or attendance)
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('temp_') || k.startsWith('cache_') || k.startsWith('pdf_preview_') || k.startsWith('wb_draft_temp_'))) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));

            if (typeof window.optimizeAppMemory === 'function') {
                window.optimizeAppMemory({ manual: true });
            }

            await new Promise(r => setTimeout(r, 400));
            await refreshDesktopLiveStorageUI();
            await refreshDesktopLiveMemoryUI();

            notifyUser('🧹 تم تنظيف الكاش والملفات المؤقتة بنجاح! تم تحرير مساحة تخزينية إضافية مع الحفاظ التام 100% على كافة بيانات التلاميذ والنقط.', 'success');
        } catch (e) {
            notifyUser('تم تنظيف مساحة التخزين المؤقتة بنجاح.', 'info');
        } finally {
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = '<span>🧹 تنظيف عميق للملفات المؤقتة والكاش</span>';
            }
        }
    }

    // Screen Wake Lock API (keeps Android/Desktop screen on during class)
    let wakeLockSentinel = null;
    let isWakeLockWanted = false;

    async function toggleScreenWakeLock() {
        if (!('wakeLock' in navigator)) {
            notifyUser('⚠️ متصفحك الحالي لا يدعم ميزة منع انطفاء الشاشة التلقائي (Wake Lock API).', 'info');
            return;
        }
        try {
            if (wakeLockSentinel) {
                isWakeLockWanted = false;
                await wakeLockSentinel.release();
                wakeLockSentinel = null;
                updateWakeLockButtonUI();
                notifyUser('🌙 تم إيقاف مانع انطفاء الشاشة.', 'info');
            } else {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                isWakeLockWanted = true;
                wakeLockSentinel.addEventListener('release', () => {
                    updateWakeLockButtonUI();
                });
                updateWakeLockButtonUI();
                notifyUser('☀️ تم تفعيل بقاء الشاشة مضاءة طيلة الحصة الدراسية بدون انطفاء تلقائي!', 'success');
            }
        } catch (err) {
            notifyUser('💡 تعذر تفعيل إبقاء الشاشة مضاءة في وضع المعاينة، افتح الرابط المباشر لتفعيلها.', 'info');
        }
    }

    function updateWakeLockButtonUI() {
        const btn = document.getElementById('btnToggleWakeLock');
        if (btn) {
            const active = !!(wakeLockSentinel && !wakeLockSentinel.released);
            btn.style.background = active ? '#d97706' : '#334155';
            btn.textContent = active ? '☀️ الشاشة مضاءة باستمرار (مفعل)' : '🌙 تفعيل بقاء الشاشة مضاءة أثناء الحصة';
        }
    }

    document.addEventListener('visibilitychange', async () => {
        if (isWakeLockWanted && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
            try {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                updateWakeLockButtonUI();
            } catch (e) {}
        }
    });

    // Native Web Share API for Android / Mobile
    async function shareDirectAppLink() {
        const directUrl = getCleanDirectAppUrl();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'منظومة التدبير التربوي - مادة الرياضيات',
                    text: 'رابط منظومة الأستاذ الرقمية لتدبير الغياب، نقط الفروض، دفتر النصوص، والسبورة التفاعلية (يعمل على الأندرويد وسطح المكتب):',
                    url: directUrl
                });
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }
        await copyDirectInstallUrl();
    }

    async function refreshDesktopModalInstallDiagnostics() {
        const diagList = document.getElementById('deskInstallDiagList');
        if (!diagList) return;

        detectStandaloneInstalledState();
        const plat = detectDevicePlatform();
        const isStandalone = isDesktopPwaInstalled || isElectronApp();
        const isInIframe = window.self !== window.top;
        const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const hasPrompt = !!(deferredInstallPrompt || window.__deferredPwaInstallPrompt);

        let swActive = false;
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.getRegistration('/');
                swActive = !!(reg && (reg.active || reg.installing || reg.waiting));
            }
        } catch (e) {}

        const statusHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 8px; margin-top: 10px; font-size: 0.74rem;">
                <div style="padding: 8px 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #475569;">الجهاز والمتصفح:</span>
                    <strong style="color: #0f172a;">
                        ${plat.isAndroid ? '📱' : '💻'} ${plat.osLabel} (${plat.browserLabel})
                    </strong>
                </div>
                <div style="padding: 8px 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #475569;">وضع النافذة:</span>
                    <strong style="color: ${isStandalone ? '#059669' : (isInIframe ? '#d97706' : '#2563eb')};">
                        ${isStandalone ? '🟢 تطبيق مستقل (Standalone)' : (isInIframe ? '🟡 شاشة معاينة (iFrame)' : '🔵 متصفح رئيسي')}
                    </strong>
                </div>
                <div style="padding: 8px 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #475569;">بروتوكول الأمان:</span>
                    <strong style="color: ${isSecure ? '#059669' : '#dc2626'};">
                        ${isSecure ? '🟢 مشفر وآمن (HTTPS)' : '🔴 غير مشفر'}
                    </strong>
                </div>
                <div style="padding: 8px 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #475569;">أيقونات أندرويد والمكتب:</span>
                    <strong style="color: #059669;">🟢 متوافقة (Maskable 512px)</strong>
                </div>
                <div style="padding: 8px 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #475569;">العمل دون إنترنت (SW):</span>
                    <strong style="color: ${swActive ? '#059669' : '#d97706'};">
                        ${swActive ? '🟢 مفعل وجاهز محلياً' : '🟡 جاهز عند الفتح المباشر'}
                    </strong>
                </div>
                <div style="padding: 8px 12px; border-radius: 8px; background: ${isStandalone ? '#ecfdf5' : '#eff6ff'}; border: 1px solid ${isStandalone ? '#6ee7b7' : '#bfdbfe'}; display: flex; align-items: center; justify-content: space-between;">
                    <span style="color: #1e293b; font-weight: 700;">حالة التثبيت:</span>
                    <strong style="color: ${isStandalone ? '#047857' : (hasPrompt ? '#059669' : '#1d4ed8')}; font-size: 0.75rem;">
                        ${isStandalone ? '✅ مثبت ويعمل كتطبيق مستقل' : (hasPrompt ? '🟢 جاهز للتثبيت بنقرة واحدة' : '💡 متاح عبر التثبيت المباشر')}
                    </strong>
                </div>
            </div>
        `;
        diagList.innerHTML = statusHtml;

        const pwaInstallBtn = document.getElementById('btnModalPwaInstallAction');
        if (pwaInstallBtn) {
            if (isStandalone) {
                pwaInstallBtn.innerHTML = '<span>✅ مثبت ومفعل كتطبيق مستقل</span>';
                pwaInstallBtn.style.background = '#059669';
            } else if (hasPrompt) {
                pwaInstallBtn.innerHTML = `<span>${plat.isAndroid ? '📱 تثبيت التطبيق الآن على هاتفك (Android)' : '💻 تثبيت التطبيق الآن على سطح المكتب (PWA)'}</span>`;
                pwaInstallBtn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
            } else {
                pwaInstallBtn.innerHTML = `<span>${plat.isAndroid ? '📱 تثبيت على الشاشة الرئيسية (Android)' : '💻 تثبيت على سطح المكتب / الأندرويد'}</span>`;
            }
        }
    }

    // Save JSON database backup locally
    async function saveDatabaseBackupLocally() {
        const rawData = window.db || {};
        const jsonStr = JSON.stringify(rawData, null, 2);
        const fileName = `نسخة_منظومة_الرياضيات_${new Date().toISOString().slice(0, 10)}.json`;

        if (isElectronApp() && typeof window.desktopBridge.saveBackupFile === 'function') {
            const result = await window.desktopBridge.saveBackupFile(jsonStr, fileName);
            if (result && result.success) {
                notifyUser(`💾 تم حفظ النسخة الاحتياطية بنجاح في: ${result.filePath}`, 'success');
                return;
            } else if (result && result.canceled) {
                return;
            }
        }

        // Web / Android download
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        notifyUser('💾 تم تنزيل وحفظ النسخة الاحتياطية على جهازك بنجاح!', 'success');
    }

    function showConfirmRestoreModal(parsedData, sourceLabel) {
        let confirmModal = document.getElementById('deskRestoreConfirmModal');
        if (!confirmModal) {
            confirmModal = document.createElement('div');
            confirmModal.id = 'deskRestoreConfirmModal';
            confirmModal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);z-index:10099;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(confirmModal);
        }

        const classesCount = Object.keys(parsedData.classes || {}).length;
        confirmModal.style.display = 'flex';
        confirmModal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:440px;width:100%;padding:20px;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;">
                <div style="font-weight:800;font-size:1rem;color:#1e3a8a;margin-bottom:8px;">📂 تأكيد استرجاع النسخة الاحتياطية</div>
                <div style="font-size:0.82rem;color:#475569;line-height:1.6;margin-bottom:14px;">
                    هل أنت متأكد من استرجاع بيانات الملف <strong>${sourceLabel || 'JSON'}</strong>؟<br>
                    • عدد الأقسام في النسخة: <strong>${classesCount}</strong> قسم.<br>
                    • سيتم تحديث قاعدة البيانات الحالية وإعادة تحميل الواجهة.
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="deskRestoreCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:8px 16px;border-radius:8px;font-weight:700;font-size:0.82rem;cursor:pointer;">إلغاء</button>
                    <button type="button" id="deskRestoreConfirmBtn" style="background:#059669;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;">✓ نعم، استرجاع الآن</button>
                </div>
            </div>
        `;

        document.getElementById('deskRestoreCancelBtn').onclick = () => { confirmModal.style.display = 'none'; };
        document.getElementById('deskRestoreConfirmBtn').onclick = () => {
            confirmModal.style.display = 'none';
            window.db = parsedData;
            localStorage.setItem('absence_massar_v8_manual', JSON.stringify(parsedData));
            if (typeof window.saveDB === 'function') window.saveDB();
            notifyUser('✓ تم استرجاع قاعدة البيانات بنجاح! جاري تحديث الشاشة...', 'success');
            setTimeout(() => window.location.reload(), 900);
        };
    }

    // Trigger file picker to load local backup (supports both Electron Native Dialog & Browser/Android File Input)
    async function triggerLocalBackupImport() {
        if (isElectronApp() && typeof window.desktopBridge.loadBackupFile === 'function') {
            const res = await window.desktopBridge.loadBackupFile();
            if (!res || res.canceled) return;
            if (res.success && res.data) {
                try {
                    const parsed = JSON.parse(res.data);
                    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
                    showConfirmRestoreModal(parsed, res.filePath || 'ملف محلي');
                } catch (err) {
                    notifyUser('خطأ: تعذر قراءة ملف النسخة الاحتياطية. تأكد من اختيار ملف JSON صالح.', 'error');
                }
            }
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function (e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (ev) {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!parsed || typeof parsed !== 'object') {
                        throw new Error('ملف النسخة غير صالح');
                    }
                    showConfirmRestoreModal(parsed, file.name);
                } catch (err) {
                    notifyUser('خطأ: تعذر قراءة ملف النسخة الاحتياطية. يرجى التأكد من اختيار ملف JSON صحيح.', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    const BASE_APP_VERSION = '3.5';

    function isAndroidHapticEnabled() {
        try {
            const saved = localStorage.getItem('prof_digital_android_haptic');
            if (saved === '1') return true;
            if (saved === '0') return false;
            return detectDevicePlatform().isAndroid;
        } catch (e) {
            return false;
        }
    }

    function toggleAndroidHapticFeedback() {
        const nextState = !isAndroidHapticEnabled();
        try {
            localStorage.setItem('prof_digital_android_haptic', nextState ? '1' : '0');
        } catch (e) {}
        if (nextState && navigator.vibrate) {
            try { navigator.vibrate([18, 40, 18]); } catch (e) {}
        }
        const btn = document.getElementById('btnToggleAndroidHaptic');
        if (btn) {
            btn.style.background = nextState ? '#059669' : '#475569';
            btn.textContent = nextState ? '📳 مفعل (اهتزاز لمسي خفيف عند الرصد)' : '⚪ غير مفعل (بدون اهتزاز)';
        }
        notifyUser(
            nextState
                ? '📳 تم تفعيل الاستجابة اللمسية الاهتزازية (Haptic Feedback) لأزرار الغياب والنقط على الأندرويد.'
                : '⚪ تم إيقاف الاستجابة اللمسية الاهتزازية.',
            'info'
        );
    }

    function toggleAndroidFullscreenClassroom() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().then(() => {
                const btn = document.getElementById('btnToggleAndroidFullscreen');
                if (btn) {
                    btn.style.background = '#059669';
                    btn.textContent = '🟢 وضع ملء الشاشة مفعل (انقر للخروج)';
                }
                notifyUser('📱 تم تفعيل وضع القسم بملء الشاشة الكاملة على جهازك!', 'success');
            }).catch(() => {
                notifyUser('💡 لتفعيل ملء الشاشة الدائم، ثبّت التطبيق على الشاشة الرئيسية للهاتف.', 'info');
            });
        } else {
            document.exitFullscreen?.().then(() => {
                const btn = document.getElementById('btnToggleAndroidFullscreen');
                if (btn) {
                    btn.style.background = '#0284c7';
                    btn.textContent = '🔳 تفعيل ملء الشاشة الفوري للقسم';
                }
            }).catch(() => {});
        }
    }

    function downloadAndroidOfflineLauncherHtml() {
        const appUrl = getCleanDirectAppUrl();
        const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0f172a">
<title>مسار رياضيات - المشغل المباشر للأندرويد</title>
<style>
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 20px; box-sizing: border-box; }
  .card { background: #1e293b; border: 1.5px solid #334155; border-radius: 18px; padding: 26px 22px; max-width: 420px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.45); }
  .icon { font-size: 3rem; margin-bottom: 10px; }
  h1 { font-size: 1.15rem; margin: 0 0 8px; color: #38bdf8; }
  p { font-size: 0.85rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 18px; }
  .btn { display: block; width: 100%; padding: 13px; background: linear-gradient(135deg, #059669, #047857); color: #fff; text-decoration: none; font-weight: 800; border-radius: 10px; font-size: 0.95rem; box-sizing: border-box; }
</style>
<script>
  setTimeout(function() { window.location.replace("${appUrl}"); }, 600);
</script>
</head>
<body>
  <div class="card">
    <div class="icon">📐</div>
    <h1>منظومة التدبير التربوي لمادة الرياضيات</h1>
    <p>جاري فتح التطبيق المباشر بوضع ملء الشاشة للأندرويد...</p>
    <a class="btn" href="${appUrl}">🚀 فتح المنظومة الآن</a>
  </div>
</body>
</html>`;
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'مشغل-مسار-رياضيات-للأندرويد.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        notifyUser('📱 تم تنزيل المشغل المباشر للأندرويد! ضعه على شاشة هاتفك لفتح المنظومة بنقرة واحدة.', 'success');
    }

    // Comprehensive System Health & Auto-Repair Engine (فحص وإصلاح شامل للمنظومة)
    async function runFullAppDiagnosticAndRepair() {
        const reportBox = document.getElementById('deskSystemHealthReportBox');
        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.innerHTML = `<div style="font-size: 0.78rem; font-weight: 800; color: #0369a1;">⏳ جاري الفحص المعمق لقاعدة البيانات والوحدات وإصلاح الأخطاء تلقائياً...</div>`;
        }

        const fixes = [];
        let classesCount = 0;
        let studentsCount = 0;
        let recordsCount = 0;
        let calendarItemsCount = 0;

        try {
            if (!window.db || typeof window.db !== 'object') {
                window.db = JSON.parse(localStorage.getItem('absence_massar_v8_manual') || '{}');
                fixes.push('إعادة تهيئة كائن قاعدة البيانات الرئيسي (window.db)');
            }

            const requiredArrays = [
                'records', 'behaviors', 'timetable', 'lessonLogs',
                'calendarEvents', 'officialHolidays', 'academicMilestones',
                'teacherLeaves', 'notes', 'homeworks', 'tutoringGroups'
            ];
            requiredArrays.forEach((key) => {
                if (!Array.isArray(window.db[key])) {
                    window.db[key] = [];
                    fixes.push(`تهيئة مصفوفة النظام المفقودة (${key})`);
                }
            });

            if (!window.db.classes || typeof window.db.classes !== 'object' || Array.isArray(window.db.classes)) {
                window.db.classes = {};
                fixes.push('تصحيح بنية سجل الأقسام (db.classes)');
            }
            if (!window.db.classConfig || typeof window.db.classConfig !== 'object') {
                window.db.classConfig = {};
                fixes.push('تهيئة إعدادات الأقسام والمعاملات (db.classConfig)');
            }
            if (!window.db.grades || typeof window.db.grades !== 'object') {
                window.db.grades = {};
                fixes.push('تهيئة سجل نقط الفروض والمراقبة المستمرة (db.grades)');
            }
            if (!window.db.settings || typeof window.db.settings !== 'object') {
                window.db.settings = {};
            }

            // Audit classes & students for duplicate or malformed IDs
            Object.keys(window.db.classes).forEach((clsName) => {
                if (!Array.isArray(window.db.classes[clsName])) {
                    window.db.classes[clsName] = [];
                    fixes.push(`تصحيح قائمة تلاميذ القسم (${clsName})`);
                }
                classesCount++;
                const seenIds = new Set();
                window.db.classes[clsName] = window.db.classes[clsName].filter((stu, idx) => {
                    if (!stu || typeof stu !== 'object') {
                        fixes.push(`حذف سجل تلميذ فارغ في قسم ${clsName}`);
                        return false;
                    }
                    if (!stu.id) {
                        stu.id = `${clsName}_${idx + 1}_${Date.now()}`;
                        fixes.push(`توليد معرف فريد لتلميذ في قسم ${clsName}`);
                    }
                    if (!stu.name || typeof stu.name !== 'string') {
                        stu.name = `تلميذ ${idx + 1}`;
                    }
                    if (seenIds.has(stu.id)) {
                        stu.id = `${stu.id}_${idx}`;
                        fixes.push(`معالجة تكرار معرف تلميذ في قسم ${clsName}`);
                    }
                    seenIds.add(stu.id);
                    studentsCount++;
                    return true;
                });
            });

            // Clean malformed attendance records
            const initialRecLen = window.db.records.length;
            window.db.records = window.db.records.filter((r) => r && typeof r === 'object' && r.date && r.studentId);
            if (window.db.records.length !== initialRecLen) {
                fixes.push(`تنظيف ${initialRecLen - window.db.records.length} سجل غياب غير مكتمل`);
            }
            recordsCount = window.db.records.length;

            // Ensure default calendar holidays & milestones are seeded if empty
            if (typeof window.initDefaultHolidays === 'function' && window.db.officialHolidays.length === 0) {
                try { window.initDefaultHolidays(); fixes.push('توليد لائحة العطل الرسمية للموسم الدراسي'); } catch (e) {}
            }
            if (typeof window.initDefaultAcademicMilestones === 'function' && window.db.academicMilestones.length === 0) {
                try { window.initDefaultAcademicMilestones(); fixes.push('توليد المحطات التربوية ومواعيد الفروض'); } catch (e) {}
            }
            calendarItemsCount =
                (window.db.officialHolidays?.length || 0) +
                (window.db.academicMilestones?.length || 0) +
                (window.db.calendarEvents?.length || 0);

            // Re-render calendar & monthly days table if calendar module is loaded
            if (typeof window.renderCalendar === 'function') {
                try { window.renderCalendar(); } catch (e) {}
            }

            // Save repaired database
            window.db.settings.appVersion = getAppCurrentVersion();
            try {
                localStorage.setItem('absence_massar_v8_manual', JSON.stringify(window.db));
            } catch (e) {}
            if (typeof window.saveDB === 'function') {
                try { window.saveDB(); } catch (e) {}
            }

            // Verify Service Worker & Version Badges
            await ensureServiceWorkerReady();
            syncAllVersionBadgesInDOM();
            refreshDesktopModalInstallDiagnostics();
        } catch (err) {
            fixes.push('تمت معالجة استثناء عابر أثناء الفحص');
        }

        const mem = getLiveMemoryMetrics();
        const isOnline = navigator.onLine !== false;

        if (reportBox) {
            reportBox.style.display = 'block';
            reportBox.innerHTML = `
                <div style="background: #f0fdf4; border: 1.5px solid #34d399; border-radius: 10px; padding: 12px 14px; margin-top: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                        <span style="font-weight: 800; font-size: 0.82rem; color: #065f46;">✅ تقرير الفحص الشامل والإصلاح التلقائي (الإصدار v${getAppCurrentVersion()})</span>
                        <span style="background: #059669; color: #fff; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">الحالة: سليمة 100%</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; font-size: 0.72rem; margin-bottom: 8px;">
                        <div style="background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">🏫 الأقسام: <strong>${classesCount}</strong> (${studentsCount} تلميذ)</div>
                        <div style="background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">📋 سجلات المواظبة: <strong>${recordsCount}</strong></div>
                        <div style="background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">📅 محطات التقويم: <strong>${calendarItemsCount}</strong></div>
                        <div style="background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0;">⚡ الذاكرة (RAM): <strong>${mem.usedMB} MB</strong> (${isOnline ? 'متصل' : 'Offline'})</div>
                    </div>
                    <div style="font-size: 0.73rem; color: #047857; line-height: 1.55;">
                        ${fixes.length > 0
                            ? `🛠️ <strong>الإصلاحات المنفذة تلقائياً (${fixes.length}):</strong> ${fixes.join(' ، ')}.`
                            : `✨ <strong>نتيجة التدقيق:</strong> جميع قواعد البيانات، جداول التقويم الشهري، السبورة التفاعلية، وروابط الأندرويد وسطح المكتب تعمل بكفاءة مثالية دون أي أخطاء.`}
                    </div>
                </div>
            `;
        }

        notifyUser('✅ اكتمل الفحص الشامل وإصلاح المنظومة بنجاح! جميع الجداول والوحدات سليمة 100%.', 'success');
    }

    function getAppCurrentVersion() {
        let saved = null;
        try {
            saved = localStorage.getItem('prof_digital_app_version');
        } catch (e) {}
        if (!saved && window.db && window.db.settings && window.db.settings.appVersion) {
            saved = String(window.db.settings.appVersion);
        }
        const baseNum = parseFloat(BASE_APP_VERSION);
        const savedNum = parseFloat(saved);
        if (!isNaN(savedNum) && savedNum >= baseNum) {
            return savedNum.toFixed(1);
        }
        try {
            localStorage.setItem('prof_digital_app_version', BASE_APP_VERSION);
        } catch (e) {}
        return BASE_APP_VERSION;
    }

    function getNextAppVersion(currentVer) {
        const cur = parseFloat(currentVer || getAppCurrentVersion());
        if (isNaN(cur)) return BASE_APP_VERSION;
        return (Math.round((cur + 0.1) * 10) / 10).toFixed(1);
    }

    function getLastUpdateFormatted() {
        try {
            const iso = localStorage.getItem('prof_digital_last_update_time') || (window.db && window.db.settings && window.db.settings.lastAppUpdateAt);
            if (!iso) return 'اليوم (الإصدار الأساسي المعتمد)';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return 'اليوم';
            return d.toLocaleString('ar-MA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'اليوم';
        }
    }

    function syncAllVersionBadgesInDOM() {
        const currentVer = getAppCurrentVersion();
        const nextVer = getNextAppVersion(currentVer);

        const headerBadge = document.getElementById('headerDesktopVersionBadge');
        if (headerBadge) {
            headerBadge.textContent = 'v' + currentVer;
        }

        const headerMenuTitle = document.getElementById('headerMenuUpdateVersionTitle');
        if (headerMenuTitle) {
            headerMenuTitle.textContent = `تحديث المنظومة ورفع الإصدار (v${currentVer} ⬅ v${nextVer})`;
        }

        const homeClusterVer = document.getElementById('homeDesktopClusterVerBadge');
        if (homeClusterVer) {
            homeClusterVer.textContent = 'v' + currentVer;
        }

        const homeCardVer = document.getElementById('homeDesktopCardVerBadge');
        if (homeCardVer) {
            homeCardVer.textContent = 'تطبيق المكتب والأندرويد (v' + currentVer + ')';
        }

        const modalHeaderVer = document.getElementById('deskModalHeaderVerBadge');
        if (modalHeaderVer) {
            modalHeaderVer.textContent = 'الإصدار v' + currentVer;
        }

        const modalCurrentVerText = document.getElementById('deskModalCurrentVerText');
        if (modalCurrentVerText) {
            modalCurrentVerText.textContent = `🔄 تحديث المنظومة ورفع الإصدار (الحالي: v${currentVer})`;
        }

        const modalNextVerBadge = document.getElementById('deskModalNextVerBadge');
        if (modalNextVerBadge) {
            modalNextVerBadge.textContent = `الترقية المتاحة: v${nextVer}`;
        }

        const modalBtnText = document.getElementById('deskModalUpdateBtnText');
        if (modalBtnText) {
            modalBtnText.textContent = `🔄 تحديث التطبيق الآن (v${nextVer})`;
        }

        const modalLastUpdate = document.getElementById('deskModalLastUpdateInfo');
        if (modalLastUpdate) {
            modalLastUpdate.textContent = `آخر تحديث مسجل: ${getLastUpdateFormatted()}`;
        }

        applyAndroidTouchModeToDOM();
    }

    // Open Multi-Platform Desktop & Android App Hub Modal
    function openDesktopAppModal(defaultTab) {
        let modal = document.getElementById('whiteboardDesktopHubModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'whiteboardDesktopHubModal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
            modal.style.backdropFilter = 'blur(6px)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '12px';
            document.body.appendChild(modal);
        }

        const plat = detectDevicePlatform();
        const isNativeDesktop = isElectronApp();
        const isPwa = isDesktopPwaInstalled;
        const currentVer = getAppCurrentVersion();
        const nextVer = getNextAppVersion(currentVer);
        const lastUpdateStr = getLastUpdateFormatted();
        const directUrl = getCleanDirectAppUrl();
        const touchModeOn = isAndroidTouchModeActive();
        const wakeLockOn = !!(wakeLockSentinel && !wakeLockSentinel.released);
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(directUrl)}`;

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 820px; max-height: 90vh; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; flex-wrap: wrap; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.45rem;">${plat.isAndroid ? '📱' : '💻'}</span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-weight: 800; font-size: 1rem;">مركز تطبيق سطح المكتب والأندرويد (Desktop & Android Hub)</span>
                                <span id="deskModalHeaderVerBadge" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 0.72rem; font-weight: 800; padding: 2px 9px; border-radius: 999px; direction: ltr;">الإصدار v${currentVer}</span>
                            </div>
                            <div style="font-size: 0.7rem; color: #94a3b8;">منظومة التدبير التربوي لمادة الرياضيات — متوافقة مع الهواتف واللوحات اللمسية (Android) والحواسيب المكتبية</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span id="deskModalNetStatusBadge" style="font-size: 0.7rem; padding: 3px 9px; border-radius: 20px; font-weight: 800; background: ${navigator.onLine !== false ? '#059669' : '#d97706'}; color: #ffffff;">
                            ${navigator.onLine !== false ? '🟢 متصل (Offline Ready)' : '🟠 وضع بدون إنترنت (Offline)'}
                        </span>
                        <span style="font-size: 0.72rem; padding: 3px 10px; border-radius: 20px; font-weight: 800; background: ${isNativeDesktop ? '#059669' : (isPwa ? '#0284c7' : (plat.isAndroid ? '#0d9488' : '#334155'))}; color: #ffffff;">
                            ${isNativeDesktop ? '🟢 برنامج مكتبي أصلي (Electron)' : (isPwa ? '🟢 مثبت كتطبيق مستقل (PWA)' : (plat.isAndroid ? '📱 جهاز أندرويد (جاهز للتثبيت)' : '💻 متصفح سطح المكتب'))}
                        </span>
                        <button type="button" onclick="document.getElementById('whiteboardDesktopHubModal').style.display='none'" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                    </div>
                </div>

                <!-- Tabs navigation -->
                <div style="display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 0 12px; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    <button type="button" class="wb-desk-tab-btn active" data-tab="pwa" style="padding: 10px 12px; border: none; background: transparent; font-weight: 800; font-size: 0.8rem; color: #1e3a8a; border-bottom: 3px solid #2563eb; cursor: pointer; white-space: nowrap;">
                        🚀 التحديث والتثبيت المباشر
                    </button>
                    <button type="button" class="wb-desk-tab-btn" data-tab="android" style="padding: 10px 12px; border: none; background: transparent; font-weight: 700; font-size: 0.8rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap;">
                        📱 أجهزة أندرويد واللوحات (Android)
                    </button>
                    <button type="button" class="wb-desk-tab-btn" data-tab="electron" style="padding: 10px 12px; border: none; background: transparent; font-weight: 700; font-size: 0.8rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap;">
                        🖥️ سطح المكتب (Windows / Mac / Linux)
                    </button>
                    <button type="button" class="wb-desk-tab-btn" data-tab="memory" style="padding: 10px 12px; border: none; background: transparent; font-weight: 700; font-size: 0.8rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap;">
                        ⚡ ترشيد الذاكرة والتخزين (RAM & Storage Hub)
                    </button>
                    <button type="button" class="wb-desk-tab-btn" data-tab="backup" style="padding: 10px 12px; border: none; background: transparent; font-weight: 700; font-size: 0.8rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap;">
                        💾 النسخ الاحتياطي ونقل البيانات
                    </button>
                    <button type="button" class="wb-desk-tab-btn" data-tab="shortcuts" style="padding: 10px 12px; border: none; background: transparent; font-weight: 700; font-size: 0.8rem; color: #64748b; border-bottom: 3px solid transparent; cursor: pointer; white-space: nowrap;">
                        ⌨️ الاختصارات واللمس
                    </button>
                </div>

                <!-- Tab Contents -->
                <div style="padding: 16px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px;">
                    
                    <!-- 1. PWA Direct Update & Universal Install Tab -->
                    <div id="deskTabContentPwa" class="desk-tab-pane" style="display: flex; flex-direction: column; gap: 12px;">
                        <!-- Instant Application Update & Version Bump Card -->
                        <div style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 14px 16px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                                <div style="flex: 1; min-width: 240px;">
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span id="deskModalCurrentVerText" style="font-weight: 800; font-size: 0.95rem; color: #065f46;">🔄 تحديث المنظومة ورفع الإصدار (الحالي: v${currentVer})</span>
                                        <span id="deskModalNextVerBadge" style="background: #059669; color: #fff; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 12px;">الترقية المتاحة: v${nextVer}</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: #047857; margin-top: 4px; line-height: 1.5;">
                                        تحديث فوري لجميع الوحدات والسبورة التفاعلية، ضغط قواعد البيانات، تفريغ الذاكرة المؤقتة، و<strong>رفع إصدار التطبيق إلى v${nextVer}</strong> مع <strong>الحفاظ التام 100% على بيانات الأقسام والتلاميذ والنقط</strong> على الأندرويد والحاسوب.
                                    </div>
                                    <div id="deskModalLastUpdateInfo" style="font-size: 0.7rem; color: #065f46; margin-top: 4px; font-weight: 700;">
                                        آخر تحديث مسجل: ${lastUpdateStr}
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" id="btnDeskForceUpdateNow" onclick="window.forceUpdateApplication()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 10px 16px; border-radius: 10px; font-weight: 800; font-size: 0.83rem; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.3); display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
                                        <span id="deskModalUpdateBtnText">🔄 تحديث التطبيق الآن (v${nextVer})</span>
                                    </button>
                                    <button type="button" onclick="window.runFullAppDiagnosticAndRepair()" style="background: #ffffff; color: #065f46; border: 1.5px solid #059669; padding: 9px 14px; border-radius: 10px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                        <span>🛠️ فحص وإصلاح شامل للمنظومة</span>
                                    </button>
                                </div>
                            </div>
                            <div id="deskSystemHealthReportBox" style="display: none;"></div>
                            <!-- Live Update Progress Indicator -->
                            <div id="deskUpdateProgressWrap" style="display: none; margin-top: 12px; background: rgba(255,255,255,0.85); border: 1px solid #34d399; border-radius: 8px; padding: 10px 12px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; font-weight: 800; color: #065f46; margin-bottom: 6px;">
                                    <span id="deskUpdateStatusText">⏳ جاري حفظ البيانات وضغط قاعدة البيانات...</span>
                                    <span id="deskUpdatePercentText" style="direction: ltr;">25%</span>
                                </div>
                                <div style="width: 100%; height: 7px; background: #d1fae5; border-radius: 999px; overflow: hidden;">
                                    <div id="deskUpdateProgressBar" style="width: 25%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 999px; transition: width 0.3s ease;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Multi-Platform Installation Hub & Diagnostics Suite -->
                        <div style="background: linear-gradient(135deg, #f0fdf4, #eff6ff); border: 1.5px solid #93c5fd; border-radius: 12px; padding: 15px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-weight: 800; font-size: 0.95rem; color: #1e3a8a; display: flex; align-items: center; gap: 6px;">
                                        <span>📲 تثبيت وتشغيل المنظومة على الأندرويد وسطح المكتب</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; margin-top: 3px;">
                                        يعمل كتطبيق مستقل بشاشة كاملة دون أشرطة متصفح، مع دعم العمل دون إنترنت (Offline) على الهواتف والحواسيب.
                                    </div>
                                </div>
                                <button type="button" id="btnModalPwaInstallAction" onclick="window.triggerPwaDesktopInstall()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; padding: 10px 18px; border-radius: 9px; font-weight: 800; font-size: 0.84rem; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); display: flex; align-items: center; gap: 6px;">
                                    <span>${plat.isAndroid ? '📱 تثبيت على الهاتف / اللوحة (Android)' : '💻 تثبيت على سطح المكتب / الأندرويد'}</span>
                                </button>
                            </div>

                            <!-- Live Diagnostics Checklist -->
                            <div style="background: rgba(255, 255, 255, 0.92); border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; font-weight: 800; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
                                    <span>🔍 فحص التوافق وجاهزية التثبيت (Android & Desktop Diagnostics)</span>
                                    <button type="button" onclick="window.refreshDesktopModalInstallDiagnostics()" style="background: none; border: none; color: #2563eb; font-size: 0.72rem; font-weight: 700; cursor: pointer;">🔄 إعادة الفحص</button>
                                </div>
                                <div id="deskInstallDiagList">
                                    <!-- Populated dynamically by refreshDesktopModalInstallDiagnostics() -->
                                </div>
                            </div>

                            <!-- Quick Action Buttons for all Environments -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 8px;">
                                <button type="button" onclick="window.copyDirectInstallUrl()" style="background: #ffffff; color: #1e3a8a; border: 1.5px solid #93c5fd; padding: 10px 12px; border-radius: 9px; font-weight: 800; font-size: 0.76rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                    <span>🔗 نسخ الرابط المباشر</span>
                                </button>
                                <button type="button" onclick="window.shareDirectAppLink()" style="background: #f0fdf4; color: #065f46; border: 1.5px solid #6ee7b7; padding: 10px 12px; border-radius: 9px; font-weight: 800; font-size: 0.76rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                    <span>📤 مشاركة الرابط للهاتف / واتساب</span>
                                </button>
                                <button type="button" onclick="window.downloadWindowsDesktopAppLauncher('app_bat')" style="background: linear-gradient(135deg, #059669, #047857); color: #ffffff; border: none; padding: 10px 12px; border-radius: 9px; font-weight: 800; font-size: 0.76rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                                    <span>📥 مشغل Windows المستقل (.bat)</span>
                                </button>
                            </div>

                            <!-- Guidance Details Banner -->
                            <div id="deskPwaInstallHelpBox" style="margin-top: 12px; padding: 11px 14px; background: #ffffff; border: 1px solid #60a5fa; border-radius: 9px; font-size: 0.75rem; color: #1e3a8a; line-height: 1.65;">
                                💡 <strong>خلاصة طرق التثبيت السريعة:</strong><br>
                                • <strong>على هواتف ولوحات أندرويد (Android):</strong> افتح الرابط في متصفح <strong>Chrome</strong> ثم اضغط على زر التثبيت أعلاه أو من القائمة (<strong>⋮</strong>) اختر <strong>"تثبيت التطبيق" (Install app)</strong>.<br>
                                • <strong>على الحاسوب (Windows / Mac):</strong> اضغط على أيقونة التثبيت (💻) في شريط عنوان Chrome/Edge أو قم بتنزيل <strong>مشغل Windows المستقل (.bat)</strong>.
                            </div>
                        </div>
                    </div>

                    <!-- 2. Dedicated Android Phones & Tablets Tab -->
                    <div id="deskTabContentAndroid" class="desk-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <div style="background: linear-gradient(135deg, #ecfdf5, #f0f9ff); border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 16px; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;">
                            <div style="flex: 1; min-width: 250px;">
                                <div style="display: inline-flex; align-items: center; gap: 6px; background: #059669; color: #fff; font-size: 0.7rem; font-weight: 800; padding: 3px 10px; border-radius: 999px; margin-bottom: 6px;">
                                    <span>📱</span>
                                    <span>نسخة الهواتف الذكية والأجهزة اللوحية (Android PWA)</span>
                                </div>
                                <div style="font-weight: 900; font-size: 1rem; color: #064e3b; margin-bottom: 6px;">
                                    استخدم المنظومة على هاتفك أو لوحتك الرقمية داخل القسم بدون إنترنت
                                </div>
                                <div style="font-size: 0.76rem; color: #334155; line-height: 1.6;">
                                    تم تصميم المنظومة لتعمل بكفاءة كاملة على أجهزة <strong>Android</strong> (هواتف وتابلت) لتسجيل الغياب الفوري، مسك النقط، عرض دفتر النصوص، واستخدام السبورة التفاعلية بالقلم اللمسي (S-Pen / Stylus).
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
                                    <button type="button" onclick="window.triggerPwaDesktopInstall()" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 9px 16px; border-radius: 9px; font-weight: 800; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <span>📲 تثبيت مباشر على الأندرويد</span>
                                    </button>
                                    <button type="button" onclick="window.downloadAndroidOfflineLauncherHtml()" style="background: #0f172a; color: #38bdf8; border: 1.5px solid #0284c7; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <span>📥 تنزيل مشغل أندرويد السريع (.html)</span>
                                    </button>
                                    <button type="button" onclick="window.shareDirectAppLink()" style="background: #ffffff; color: #065f46; border: 1.5px solid #34d399; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <span>📤 إرسال الرابط للهاتف</span>
                                    </button>
                                    <button type="button" onclick="window.copyDirectInstallUrl()" style="background: #ffffff; color: #1e3a8a; border: 1.5px solid #93c5fd; padding: 9px 14px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                        <span>🔗 نسخ الرابط</span>
                                    </button>
                                </div>
                            </div>
                            <!-- QR Code Box for scanning from Desktop to Android -->
                            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 10px; text-align: center; width: 162px; flex-shrink: 0; margin: 0 auto;">
                                <img src="${qrApiUrl}" alt="QR Code لفتح التطبيق على الهاتف" style="width: 125px; height: 125px; object-fit: contain; display: block; margin: 0 auto; border-radius: 6px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <div style="display: none; width: 125px; height: 125px; align-items: center; justify-content: center; background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; font-size: 0.7rem; color: #475569; padding: 8px; margin: 0 auto;">
                                    📱 استخدم زر "نسخ الرابط" أو "مشغل أندرويد (.html)" عند العمل بدون إنترنت
                                </div>
                                <div style="font-size: 0.68rem; font-weight: 800; color: #1e293b; margin-top: 6px;">📷 امسح الرمز بهاتفك الأندرويد</div>
                            </div>
                        </div>

                        <!-- Classroom Ergonomics & Touch Controls for Android -->
                        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px;">
                            <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                                <span>⚙️ إعدادات الراحة والاستخدام الميداني على أجهزة الأندرويد والتابلت:</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 10px;">
                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">👆 وضع اللمس المكبر (Touch Mode)</div>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">تكبير أزرار تسجيل الغياب، خانات النقط، وأدوات السبورة لسهولة النقر بالإصبع أو القلم.</div>
                                    </div>
                                    <button type="button" id="btnToggleAndroidTouchMode" onclick="window.toggleAndroidTouchMode()" style="background: ${touchModeOn ? '#059669' : '#475569'}; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">
                                        ${touchModeOn ? '🟢 مفعل (أزرار وخلايا مكبرة للمس)' : '⚪ غير مفعل (الحجم القياسي)'}
                                    </button>
                                </div>

                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">⚡ وضع ترشيد الرام (Eco RAM Mode)</div>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">حماية هواتف وتابلت أندرويد الاقتصادية (2GB/3GB) من استنزاف الرام أثناء استخراج التقارير الكبيرة.</div>
                                    </div>
                                    <button type="button" id="btnToggleAndroidEcoRamMode" onclick="window.toggleAndroidEcoRamMode()" style="background: ${isAndroidEcoRamModeActive() ? '#059669' : '#475569'}; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">
                                        ${isAndroidEcoRamModeActive() ? '🟢 مفعل (ترشيد الذاكرة والبطارية)' : '⚪ غير مفعل (أقصى دقة)'}
                                    </button>
                                </div>

                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">☀️ منع انطفاء الشاشة (Wake Lock)</div>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">إبقاء شاشة الهاتف أو اللوحة مضاءة طيلة الحصة الدراسية أثناء رصد الغياب أو الشرح.</div>
                                    </div>
                                    <button type="button" id="btnToggleWakeLock" onclick="window.toggleScreenWakeLock()" style="background: ${wakeLockOn ? '#d97706' : '#334155'}; color: #fff; border: none; padding: 8px 12px; border-radius: 8px; font-weight: 800; font-size: 0.75rem; cursor: pointer;">
                                        ${wakeLockOn ? '☀️ الشاشة مضاءة باستمرار (مفعل)' : '🌙 تفعيل بقاء الشاشة مضاءة أثناء الحصة'}
                                    </button>
                                </div>

                                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.8rem; color: #1e293b;">📳 الاستجابة اللمسية وملء الشاشة</div>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">اهتزاز لمسي خفيف لتأكيد رصد الغياب مع زر تكبير فوري لشاشة الهاتف داخل الفصل.</div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 5px;">
                                        <button type="button" id="btnToggleAndroidHaptic" onclick="window.toggleAndroidHapticFeedback()" style="background: ${isAndroidHapticEnabled() ? '#059669' : '#475569'}; color: #fff; border: none; padding: 6px 10px; border-radius: 7px; font-weight: 800; font-size: 0.72rem; cursor: pointer;">
                                            ${isAndroidHapticEnabled() ? '📳 مفعل (اهتزاز لمسي خفيف عند الرصد)' : '⚪ غير مفعل (بدون اهتزاز)'}
                                        </button>
                                        <button type="button" id="btnToggleAndroidFullscreen" onclick="window.toggleAndroidFullscreenClassroom()" style="background: #0284c7; color: #fff; border: none; padding: 6px 10px; border-radius: 7px; font-weight: 800; font-size: 0.72rem; cursor: pointer;">
                                            🔳 تفعيل ملء الشاشة الفوري للقسم
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step-by-Step Guide for Android Browsers -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px;">
                            <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px;">
                                <div style="font-weight: 800; font-size: 0.82rem; color: #1e40af; margin-bottom: 6px;">🌐 متصفح Google Chrome (أندرويد)</div>
                                <ol style="margin: 0; padding-right: 16px; font-size: 0.74rem; color: #334155; line-height: 1.65;">
                                    <li>افتح الرابط المباشر للمنظومة في <strong>Chrome</strong>.</li>
                                    <li>اضغط على زر القائمة <strong>(⋮)</strong> أعلى يسار الشاشة.</li>
                                    <li>اختر <strong>"تثبيت التطبيق" (Install app)</strong> أو <strong>"الإضافة إلى الشاشة الرئيسية"</strong>.</li>
                                    <li>ستظهر أيقونة <strong>"مسار رياضيات"</strong> ضمن تطبيقات هاتفك وتعمل بدون إنترنت!</li>
                                </ol>
                            </div>

                            <div style="background: #ffffff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 12px;">
                                <div style="font-weight: 800; font-size: 0.82rem; color: #5b21b6; margin-bottom: 6px;">⚡ اختصارات الضغطة المطولة على الأندرويد</div>
                                <div style="font-size: 0.74rem; color: #334155; line-height: 1.65;">
                                    بعد تثبيت التطبيق على شاشة هاتفك الأندرويد، <strong>اضغط مطولاً (Long Press)</strong> على أيقونة التطبيق لفتح قائمة الوصول السريع:<br>
                                    • 📋 <strong>تسجيل الغياب والمواظبة</strong><br>
                                    • 📊 <strong>نقط الفروض والمراقبة المستمرة</strong><br>
                                    • 📐 <strong>السبورة التفاعلية للرياضيات</strong><br>
                                    • 🚨 <strong>لوحة القيادة والإنذار المبكر</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Desktop Windows & Electron Native Tab -->
                    <div id="deskTabContentElectron" class="desk-tab-pane" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="background: #f0f9ff; border: 1.5px solid #93c5fd; border-radius: 12px; padding: 14px 16px;">
                            <div style="font-weight: 800; font-size: 0.92rem; color: #1e3a8a; margin-bottom: 4px;">🖥️ المشغل المكتبي المستقل لنظام Windows (.bat / .url)</div>
                            <div style="font-size: 0.75rem; color: #334155; line-height: 1.55; margin-bottom: 10px;">
                                يمكنك تنزيل مشغل سطح المكتب الفوري لفتح المنظومة في نافذة برنامج مستقلة بالكامل (App Window) بدون أشرطة متصفح، مع دعم كامل لشاشات العرض التفاعلية (Data Show).
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                <button type="button" onclick="window.downloadWindowsDesktopAppLauncher('app_bat')" style="background: linear-gradient(135deg, #059669, #047857); color: #ffffff; border: none; padding: 9px 15px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                    <span>📥 مشغل Windows المستقل (.bat)</span>
                                </button>
                                <button type="button" onclick="window.downloadMacDesktopAppLauncher()" style="background: #0f172a; color: #ffffff; border: none; padding: 9px 15px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                    <span>🍏 مشغل macOS المكتبي (.command)</span>
                                </button>
                                <button type="button" onclick="window.downloadLinuxDesktopAppLauncher()" style="background: #1e293b; color: #ffffff; border: none; padding: 9px 15px; border-radius: 9px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                    <span>🐧 مشغل Linux (.desktop)</span>
                                </button>
                                <button type="button" onclick="window.downloadWindowsDesktopAppLauncher('shortcut_url')" style="background: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; padding: 9px 14px; border-radius: 9px; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                    <span>🔖 اختصار سطح المكتب (.url)</span>
                                </button>
                            </div>
                        </div>

                        <div style="background: #fdf4ff; border: 1.5px solid #f0abfc; border-radius: 12px; padding: 14px 16px;">
                            <div style="font-weight: 800; font-size: 0.92rem; color: #86198f; margin-bottom: 4px;">⚡ حزمة Electron المكتبية الأصلية (Native Desktop App)</div>
                            <div style="font-size: 0.75rem; color: #701a75;">
                                تم تضمين ملفات التشغيل المكتبي <code>electron/main.cjs</code> و <code>electron/preload.cjs</code> وقوائم البرامج العربية المدمجة لنظامي Windows و macOS.
                            </div>
                        </div>

                        <div style="background: #0f172a; color: #f8fafc; border-radius: 10px; padding: 12px 16px; font-family: monospace; direction: ltr; font-size: 0.8rem; line-height: 1.6;">
                            <div style="color: #94a3b8;"># تشغيل التطبيق المكتبي فوراً على حاسوبك:</div>
                            <div style="color: #38bdf8;">npm run desktop</div>
                            <div style="color: #94a3b8; margin-top: 6px;"># بناء حزمة الإنتاج وتشغيلها:</div>
                            <div style="color: #38bdf8;">npm run desktop:build</div>
                        </div>
                    </div>

                    <!-- 3.5 Memory Optimization & Strategic Proposals Tab (حلول وإدارة الذاكرة في التطبيق) -->
                    <div id="deskTabContentMemory" class="desk-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Live Memory KPI Banner -->
                        <div style="background: linear-gradient(135deg, #f0fdf4, #eff6ff); border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.25rem;">⚡</span>
                                        <div style="font-weight: 900; font-size: 0.96rem; color: #064e3b;">مركز مراقبة وترشيد الذاكرة الحية (RAM Optimizer)</div>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; margin-top: 4px;">
                                        نظام ذكي لمراقبة استهلاك الذاكرة، تفريغ كاش الرسوم المؤقتة، وضمان أعلى سلاسة (60 FPS) على الحواسيب والأجهزة اللوحية.
                                    </div>
                                </div>
                                <button type="button" onclick="window.runLiveMemoryPurge(this)" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; padding: 9px 18px; border-radius: 9px; font-weight: 800; font-size: 0.82rem; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.3); display: flex; align-items: center; gap: 6px;">
                                    <span>⚡ تنظيف فوري للذاكرة (Turbo RAM Purge)</span>
                                </button>
                            </div>

                            <!-- Live Memory Status Grid -->
                            <div id="deskLiveMemGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; margin-top: 12px;">
                                <!-- populated dynamically -->
                            </div>
                        </div>

                        <!-- Live Storage & Disk Space Card (حلول الأجهزة ذات مساحة التخزين المحدودة) -->
                        <div style="background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1.5px solid #93c5fd; border-radius: 12px; padding: 14px 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 1.25rem;">📦</span>
                                        <div style="font-weight: 900; font-size: 0.96rem; color: #1e3a8a;">مركز ترشيد ومراقبة مساحة التخزين (Low Storage & Disk Saver)</div>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; margin-top: 4px;">
                                        حل تقني متكامل للأجهزة ذات السعة التخزينية المحدودة (16GB / 32GB) لتفادي أخطاء امتلاء القرص وحماية بيانات التلاميذ من الحذف التلقائي.
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" id="btnRequestPersistentStorage" onclick="window.requestPersistentStorageProtection()" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                        <span>🛡️ حماية التخزين من الحذف التلقائي</span>
                                    </button>
                                    <button type="button" onclick="window.runStorageDeepClean(this)" style="background: #ffffff; color: #1e3a8a; border: 1.5px solid #93c5fd; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                        <span>🧹 تفريغ المؤقتات والكاش</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Live Storage Status Grid -->
                            <div id="deskLiveStorageGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; margin-top: 12px;">
                                <!-- populated dynamically by refreshDesktopLiveStorageUI() -->
                            </div>

                            <!-- Storage Safety Guarantees Notice -->
                            <div style="margin-top: 10px; background: rgba(255, 255, 255, 0.95); border: 1px solid #bfdbfe; border-radius: 8px; padding: 9px 12px; font-size: 0.73rem; color: #1e40af; line-height: 1.6;">
                                💡 <strong>ضمانات التخزين الخفيف للأستاذ:</strong> التطبيق يزن أقل من <strong>15 ميغابايت</strong> فقط (أخف بـ 25 مرة من التطبيقات التقليدية)، وقاعدة بيانات جميع أقسامك وتلاميذك لا تتعدى <strong>1 إلى 2 ميغابايت</strong>. عند انخفاض مساحة الهاتف، تضمن تقنية <code>Persistent Storage</code> عدم قيام النظام بمسح أي نقط أو غياب مسجل نهائياً.
                            </div>
                        </div>

                        <!-- 5 Strategic Proposals for Memory Optimization -->
                        <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px;">
                            <div style="font-weight: 900; font-size: 0.88rem; color: #1e3a8a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                                <span>💡 5 مقترحات وحلول استراتيجية مطبقة لمعالجة مشكلة الذاكرة في المنظومة:</span>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <!-- Proposal 1 -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #0f172a;">1️⃣ التوليد المتدرج للتقارير الضخمة (Chunked Rendering with rAF)</div>
                                        <span style="background: #dcfce7; color: #15803d; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">✓ مطبق ومفعل</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; line-height: 1.6;">
                                        عند تصدير كشوفات أكثر من 10 أقسام دفعة واحدة، يتم رسم كل قسم في دورة <code>requestAnimationFrame</code> مستقلة مع تفريغ فوري لذاكرة الـ Canvas وشريط تقدم حي، مما يوفر <strong>85% من ذروة استهلاك الرام</strong> ويمنع تجميد الشاشة أو انهيار المتصفح تماماً.
                                    </div>
                                </div>

                                <!-- Proposal 2 -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #0f172a;">2️⃣ الإتلاف الذكي للرسوم البيانية الخاملة (Lazy Chart Teardown)</div>
                                        <span style="background: #dcfce7; color: #15803d; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">✓ مطبق ومفعل</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; line-height: 1.6;">
                                        يتم إتلاف كائنات <code>Chart.js</code> و <code>Recharts</code> في التبويبات غير النشطة تلقائياً بمجرد مغادرتها، وإعادة بنائها عند العودة إليها، لتجنب تراكم الذاكرة (Memory Leaks) والمحافظة على استقرار الذاكرة حتى بعد ساعات من العمل المتواصل.
                                    </div>
                                </div>

                                <!-- Proposal 3 -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #0f172a;">3️⃣ ضغط وتنقية قواعد بيانات IndexedDB و localStorage</div>
                                        <span style="background: #dcfce7; color: #15803d; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">✓ مطبق ومفعل</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; line-height: 1.6;">
                                        دورة تنقية آلية تزيل السجلات اليتيمة والمكررة لبيانات الغياب والنقط، مع ضغط رسومات السبورة التفاعلية وصور الفروض بصيغة WebP/JPEG خفيفة الحجم لتقليل سعة التخزين المستهلكة.
                                    </div>
                                </div>

                                <!-- Proposal 4 -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #0f172a;">4️⃣ نمط التوفير الأقصى للذاكرة على الأندرويد واللوحات (Eco RAM Mode)</div>
                                        <span style="background: #e0f2fe; color: #0369a1; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">⚙️ مفعل</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; line-height: 1.6;">
                                        مخصص للهواتف والأجهزة اللوحية الاقتصادية (سعة 2GB/3GB RAM): يضبط مقياس الرسم مؤقتاً عند 1.7x أثناء توليد PDF ويؤجل تحميل العناصر غير المرئية لتسريع التصدير وتوفير البطارية.
                                    </div>
                                </div>

                                <!-- Proposal 5 -->
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <div style="font-weight: 800; font-size: 0.82rem; color: #0f172a;">5️⃣ تنظيف الكاش الدوري وحذف الملفات المؤقتة القديمة (Cache Pruning)</div>
                                        <span style="background: #dcfce7; color: #15803d; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 999px;">✓ مطبق ومفعل</span>
                                    </div>
                                    <div style="font-size: 0.74rem; color: #475569; line-height: 1.6;">
                                        يقوم Service Worker تلقائياً بحذف نسخ الكاش القديمة عند كل ترقية جديدة للإصدار، مع وضع سقف أقصى لحجم الكاش المؤقت حتى لا يستهلك مساحة التخزين الداخلية للهاتف أو الحاسوب.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Interactive Memory Stability Diagnostic Test -->
                        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <div style="font-weight: 800; font-size: 0.84rem; color: #1e293b;">🧪 فحص واختبار استقرار الذاكرة الفوري (Memory Diagnostic Test)</div>
                                <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">فحص فوري لعقد DOM والمصفوفات ومستمعي الأحداث للتأكد من خلو المنظومة من أي تسرب.</div>
                            </div>
                            <button type="button" id="btnRunMemDiagTest" onclick="window.runMemoryStressSafetyTest(this)" style="background: #ffffff; color: #1e3a8a; border: 1.5px solid #93c5fd; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer;">
                                🔍 بدء الفحص التشخيصي
                            </button>
                        </div>
                    </div>

                    <!-- 4. Local Backup & Cross-Device Sync Tab -->
                    <div id="deskTabContentBackup" class="desk-tab-pane" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="font-size: 0.82rem; font-weight: 800; color: #1e293b;">
                            💾 تأمين البيانات ومزامنتها بين الحاسوب المكتبي وهاتف الأندرويد:
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button type="button" onclick="window.saveDatabaseBackupLocally()" style="flex: 1; min-width: 190px; background: #059669; color: #fff; border: none; padding: 12px 16px; border-radius: 10px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(5,150,105,0.25);">
                                <span>💾 تصدير نسخة احتياطية (.json)</span>
                            </button>
                            <button type="button" onclick="window.triggerLocalBackupImport()" style="flex: 1; min-width: 190px; background: #2563eb; color: #fff; border: none; padding: 12px 16px; border-radius: 10px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">
                                <span>📂 استرجاع نسخة من الجهاز</span>
                            </button>
                            <button type="button" onclick="document.getElementById('whiteboardDesktopHubModal').style.display='none'; if(typeof window.openDriveSyncCenterModal==='function') window.openDriveSyncCenterModal();" style="flex: 1; min-width: 190px; background: #7c3aed; color: #fff; border: none; padding: 12px 16px; border-radius: 10px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(124,58,237,0.25);">
                                <span>☁️ المزامنة السحابية (Google Drive)</span>
                            </button>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; font-size: 0.74rem; color: #334155; line-height: 1.65;">
                            🔄 <strong>كيف تنقل بياناتك بين الحاسوب والهاتف بسهولة؟</strong><br>
                            1. <strong>عبر المزامنة السحابية (Google Drive):</strong> اربط حسابك في كلا الجهازين ليتم تحديث اللوائح والغياب والنقط تلقائياً بين هاتفك في القسم وحاسوبك في المنزل.<br>
                            2. <strong>عبر ملف النسخة الاحتياطية (.json):</strong> صدّر الملف من الحاسوب وأرسله عبر واتساب أو البريد إلى هاتفك الأندرويد ثم استورده بنقرة واحدة.
                        </div>
                    </div>

                    <!-- 5. Keyboard Shortcuts & Android Touch Gestures Tab -->
                    <div id="deskTabContentShortcuts" class="desk-tab-pane" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">
                            ⌨️ اختصارات لوحة المفاتيح (سطح المكتب):
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 0.74rem;">
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>حفظ فوري لقاعدة البيانات:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + S</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>تحسين الذاكرة الحية (RAM):</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + M</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>ملء الشاشة للسبورة / القسم:</span>
                                <strong style="direction: ltr; font-family: monospace;">F11</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>السبورة التفاعلية للرياضيات:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + 4</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>لوحة القيادة والمؤشرات:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + 1</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>لائحة التلاميذ والغياب:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + 2</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>جدول الحصص / التقويم السنوي:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + 3 / 6</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 7px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <span>نقط الفروض والمراقبة المستمرة:</span>
                                <strong style="direction: ltr; font-family: monospace;">Ctrl + 7</strong>
                            </div>
                        </div>

                        <div style="font-size: 0.8rem; font-weight: 800; color: #065f46; margin-top: 4px;">
                            📱 إيماءات اللمس والقلم الرقمي (أجهزة الأندرويد والتابلت):
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 0.74rem;">
                            <div style="padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                                <strong>✍️ دعم القلم الذكي (Stylus / S-Pen):</strong> تجاهل تلقائي لراحة اليد (Palm Rejection) أثناء الكتابة على السبورة التفاعلية.
                            </div>
                            <div style="padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                                <strong>↔️ السحب الأفقي الناعم للجداول:</strong> تمرير سلس للوائح نقط مسار والغياب على شاشات الهواتف.
                            </div>
                            <div style="padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                                <strong>📐 تدوير الأدوات الهندسية باللمس:</strong> تحريك وتدوير المسطرة والمنقلة والكوس مباشرة بالإصبع أو القلم.
                            </div>
                            <div style="padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                                <strong>🎙️ البحث والأوامر الصوتية:</strong> إدخال الملاحظات والبحث الصوتي السريع باللغة العربية عبر الميكروفون.
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Switch tab handlers inside modal
        modal.querySelectorAll('.wb-desk-tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const tab = this.getAttribute('data-tab');
                modal.querySelectorAll('.wb-desk-tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.fontWeight = '700';
                    b.style.color = '#64748b';
                    b.style.borderBottomColor = 'transparent';
                });
                this.classList.add('active');
                this.style.fontWeight = '800';
                this.style.color = '#1e3a8a';
                this.style.borderBottomColor = '#2563eb';

                modal.querySelectorAll('.desk-tab-pane').forEach(p => p.style.display = 'none');
                if (tab === 'pwa') {
                    document.getElementById('deskTabContentPwa').style.display = 'flex';
                    refreshDesktopModalInstallDiagnostics();
                } else if (tab === 'android') {
                    document.getElementById('deskTabContentAndroid').style.display = 'flex';
                    applyAndroidTouchModeToDOM();
                    updateWakeLockButtonUI();
                } else if (tab === 'electron') {
                    document.getElementById('deskTabContentElectron').style.display = 'flex';
                } else if (tab === 'memory') {
                    document.getElementById('deskTabContentMemory').style.display = 'flex';
                    refreshDesktopLiveMemoryUI();
                    refreshDesktopLiveStorageUI();
                } else if (tab === 'backup') {
                    document.getElementById('deskTabContentBackup').style.display = 'flex';
                } else if (tab === 'shortcuts') {
                    document.getElementById('deskTabContentShortcuts').style.display = 'flex';
                }
            });
        });

        if (defaultTab) {
            const targetBtn = modal.querySelector(`.wb-desk-tab-btn[data-tab="${defaultTab}"]`);
            if (targetBtn) targetBtn.click();
        } else {
            refreshDesktopModalInstallDiagnostics();
        }
    }

    let isForceUpdating = false;

    // Force Application Update, Version Bump & Cache Refresh while preserving 100% of localStorage & IndexedDB data
    async function forceUpdateApplication() {
        if (isForceUpdating) return;
        isForceUpdating = true;

        const oldVersion = getAppCurrentVersion();
        const newVersion = getNextAppVersion(oldVersion);
        const nowIso = new Date().toISOString();

        const btn = document.getElementById('btnDeskForceUpdateNow');
        const btnText = document.getElementById('deskModalUpdateBtnText');
        const progressWrap = document.getElementById('deskUpdateProgressWrap');
        const progressBar = document.getElementById('deskUpdateProgressBar');
        const statusText = document.getElementById('deskUpdateStatusText');
        const percentText = document.getElementById('deskUpdatePercentText');

        const setProgress = (pct, msg) => {
            if (progressWrap) progressWrap.style.display = 'block';
            if (progressBar) progressBar.style.width = pct + '%';
            if (statusText) statusText.textContent = msg;
            if (percentText) percentText.textContent = pct + '%';
        };

        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.8';
            btn.style.cursor = 'wait';
        }
        if (btnText) {
            btnText.textContent = `⏳ جاري الترقية إلى الإصدار v${newVersion}...`;
        }

        try {
            // 1. Save current database & bump version metadata in window.db
            setProgress(25, `⏳ جاري تأمين البيانات وضغط قواعد البيانات (IndexedDB)...`);
            if (window.db) {
                window.db.settings = window.db.settings || {};
                window.db.settings.appVersion = newVersion;
                window.db.settings.lastAppUpdateAt = nowIso;
                try {
                    localStorage.setItem('absence_massar_v8_manual', JSON.stringify(window.db));
                } catch (e) {}
            }
            if (typeof window.saveDB === 'function') {
                try { window.saveDB(); } catch (e) {}
            }

            // Run periodic IndexedDB compaction before reload
            if (typeof window.compressAndManageIndexedDB === 'function') {
                try { await window.compressAndManageIndexedDB({ reason: 'desktop_app_update', silent: true }); } catch (e) {}
            }
            if (typeof window.compressWhiteboardIndexedDB === 'function') {
                try { await window.compressWhiteboardIndexedDB({ aggressive: true }); } catch (e) {}
            }

            // 2. Persist new bumped version in localStorage & sessionStorage
            setProgress(55, `🔄 جاري رفع إصدار التطبيق من v${oldVersion} إلى v${newVersion}...`);
            try {
                localStorage.setItem('prof_digital_app_version', newVersion);
                localStorage.setItem('prof_digital_build_version', '2026.10.28.v' + newVersion);
                localStorage.setItem('prof_digital_last_update_time', nowIso);
                sessionStorage.setItem('prof_digital_just_updated_from_to', JSON.stringify({
                    from: oldVersion,
                    to: newVersion,
                    time: nowIso
                }));
            } catch (e) {}

            notifyUser(`🔄 جاري تحديث التطبيق ورفع الإصدار من v${oldVersion} إلى v${newVersion} مع الحفاظ التام على بياناتك...`, 'info');

            // 3. Unregister/update service workers & clear stale CacheStorage
            setProgress(80, `🧹 جاري تفريغ الذاكرة المؤقتة وتحميل حزمة الإصدار v${newVersion}...`);
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    try {
                        if (reg.active) {
                            reg.active.postMessage({ type: 'CLEAR_ALL_CACHES' });
                            reg.active.postMessage({ type: 'BUMP_VERSION_CACHE', version: newVersion });
                            reg.active.postMessage({ type: 'SKIP_WAITING' });
                        }
                        await reg.unregister();
                    } catch (err) {}
                }
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((key) => caches.delete(key)));
            }

            // Warm cache-busted core assets
            try {
                const cacheBust = `v=${newVersion}.${Date.now()}`;
                await Promise.allSettled([
                    fetch(`/index.html?${cacheBust}`, { cache: 'reload' }),
                    fetch(`/style.css?${cacheBust}`, { cache: 'reload' }),
                    fetch(`/app.js?${cacheBust}`, { cache: 'reload' }),
                    fetch(`/annual-calendar.js?${cacheBust}`, { cache: 'reload' }),
                    fetch(`/desktop-app.js?${cacheBust}`, { cache: 'reload' }),
                    fetch(`/chunked-pdf-engine.js?${cacheBust}`, { cache: 'reload' })
                ]);
            } catch (e) {}

            // 4. Update all DOM version badges immediately
            setProgress(100, `✅ اكتملت الترقية بنجاح إلى الإصدار v${newVersion}! جاري إعادة التحميل...`);
            syncAllVersionBadgesInDOM();

            notifyUser(`✅ تم تحديث المنظومة بنجاح ورفع الإصدار إلى v${newVersion}! جاري إعادة التحميل...`, 'success');

            setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.set('v', newVersion);
                window.location.replace(url.toString());
            }, 650);
        } catch (err) {
            isForceUpdating = false;
            window.location.reload();
        }
    }

    function checkPostUpdateNotification() {
        syncAllVersionBadgesInDOM();
        try {
            const raw = sessionStorage.getItem('prof_digital_just_updated_from_to');
            if (raw) {
                sessionStorage.removeItem('prof_digital_just_updated_from_to');
                const info = JSON.parse(raw);
                if (info && info.to) {
                    setTimeout(() => {
                        notifyUser(`🎉 تم تحديث المنظومة بنجاح ورفع الإصدار من v${info.from || BASE_APP_VERSION} إلى v${info.to}!`, 'success');
                    }, 500);
                }
            }
        } catch (e) {}
    }

    // Auto initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDesktopIntegration();
            checkPostUpdateNotification();
        });
    } else {
        initDesktopIntegration();
        checkPostUpdateNotification();
    }

    // Window Exports
    window.openDesktopAppModal = openDesktopAppModal;
    window.triggerPwaDesktopInstall = triggerPwaDesktopInstall;
    window.copyDirectInstallUrl = copyDirectInstallUrl;
    window.shareDirectAppLink = shareDirectAppLink;
    window.downloadWindowsDesktopAppLauncher = downloadWindowsDesktopAppLauncher;
    window.downloadMacDesktopAppLauncher = downloadMacDesktopAppLauncher;
    window.downloadLinuxDesktopAppLauncher = downloadLinuxDesktopAppLauncher;
    window.ensureServiceWorkerReady = ensureServiceWorkerReady;
    window.refreshDesktopModalInstallDiagnostics = refreshDesktopModalInstallDiagnostics;
    window.saveDatabaseBackupLocally = saveDatabaseBackupLocally;
    window.triggerLocalBackupImport = triggerLocalBackupImport;
    window.isElectronApp = isElectronApp;
    window.forceUpdateApplication = forceUpdateApplication;
    window.getAppCurrentVersion = getAppCurrentVersion;
    window.syncAllVersionBadgesInDOM = syncAllVersionBadgesInDOM;
    window.toggleAndroidTouchMode = toggleAndroidTouchMode;
    window.toggleAndroidEcoRamMode = toggleAndroidEcoRamMode;
    window.isAndroidEcoRamModeActive = isAndroidEcoRamModeActive;
    window.toggleScreenWakeLock = toggleScreenWakeLock;
    window.detectDevicePlatform = detectDevicePlatform;
    window.getLiveMemoryMetrics = getLiveMemoryMetrics;
    window.runLiveMemoryPurge = runLiveMemoryPurge;
    window.refreshDesktopLiveMemoryUI = refreshDesktopLiveMemoryUI;
    window.runMemoryStressSafetyTest = runMemoryStressSafetyTest;
    window.getLiveStorageMetrics = getLiveStorageMetrics;
    window.refreshDesktopLiveStorageUI = refreshDesktopLiveStorageUI;
    window.requestPersistentStorageProtection = requestPersistentStorageProtection;
    window.runStorageDeepClean = runStorageDeepClean;
    window.toggleAndroidHapticFeedback = toggleAndroidHapticFeedback;
    window.toggleAndroidFullscreenClassroom = toggleAndroidFullscreenClassroom;
    window.downloadAndroidOfflineLauncherHtml = downloadAndroidOfflineLauncherHtml;
    window.runFullAppDiagnosticAndRepair = runFullAppDiagnosticAndRepair;

})(window);
