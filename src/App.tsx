import { useEffect, useState } from 'react';
import { Download, Smartphone, Share2, X } from 'lucide-react';

function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).__deferredPwaInstallPrompt || null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (window.navigator as any).standalone === true ||
      Boolean((window as any).desktopBridge && (window as any).desktopBridge.isDesktop);
    setIsInstalled(isStandalone);

    // Pick up prompt if captured early in <head>
    if ((window as any).__deferredPwaInstallPrompt) {
      setDeferredPrompt((window as any).__deferredPwaInstallPrompt);
    }

    // Detect iOS & Android devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePwaReady = (e: Event) => {
      const promptEvent = (e as CustomEvent)?.detail || (window as any).__deferredPwaInstallPrompt;
      if (promptEvent) setDeferredPrompt(promptEvent);
    };

    const handleAppInstalled = () => {
      (window as any).__deferredPwaInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-install-ready', handlePwaReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-app-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-ready', handlePwaReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-app-installed', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const activePrompt = deferredPrompt || (window as any).__deferredPwaInstallPrompt;
    if (!activePrompt) {
      if (typeof (window as any).openDesktopAppModal === 'function') {
        (window as any).openDesktopAppModal(isAndroid ? 'android' : 'pwa');
      }
      return false;
    }
    await activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).__deferredPwaInstallPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}

export default function App() {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if ((isInstalled || dismissed) && isOnline) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-3">
      {!isOnline && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xl border border-amber-400/50">
          <span>🟠 وضع العمل بدون إنترنت (Offline) — جميع تعديلاتك محفوظة محلياً</span>
        </div>
      )}

      {!isInstalled && !dismissed && isInstallable && (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-blue-600 pl-3 pr-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xl border border-blue-400/40">
          <button
            onClick={install}
            className="flex items-center gap-2 hover:opacity-95 transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isAndroid ? 'تثبيت تطبيق الأندرويد (v3.5)' : 'تثبيت التطبيق على الجهاز (v3.5)'}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="إخفاء"
            className="mr-1 p-1 rounded-full hover:bg-blue-700/80 text-blue-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!isInstallable && isAndroid && (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-emerald-700 pl-3 pr-5 py-2.5 text-xs font-bold text-white shadow-xl border border-emerald-400/40">
          <button
            onClick={() => {
              if (typeof (window as any).openDesktopAppModal === 'function') {
                (window as any).openDesktopAppModal('android');
              }
            }}
            className="flex items-center gap-2 hover:opacity-95 transition active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>تثبيت نسخة الأندرويد ووضع اللمس</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            title="إخفاء"
            className="mr-1 p-1 rounded-full hover:bg-emerald-800 text-emerald-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isIOS && (
        <>
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white border border-gray-300 pl-3 pr-5 py-2.5 text-xs sm:text-sm font-bold text-blue-600 shadow-lg">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-2 hover:opacity-90 transition active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>تثبيت على iPhone / iPad</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              title="إخفاء"
              className="mr-1 p-1 rounded-full hover:bg-gray-100 text-gray-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {showIOSGuide && (
            <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" dir="rtl">
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl text-center">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">تثبيت على iPhone / iPad</h3>
                  <button onClick={() => setShowIOSGuide(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <img src="/logo.png" alt="شعار التطبيق" className="w-16 h-16 rounded-full border-2 border-amber-400 mx-auto my-3 shadow-md object-cover" />
                <p className="text-sm text-gray-700 leading-relaxed mb-4 text-right">
                  1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط Safari أسفل الشاشة.<br />
                  <br />
                  2. مرر للأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                </p>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full rounded-lg bg-gray-100 py-3 text-sm font-bold text-gray-800 hover:bg-gray-200"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
