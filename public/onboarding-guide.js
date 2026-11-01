/**
 * onboarding-guide.js
 * نافذة الدليل المبسط للمنظومة عند أول استخدام
 * First-use Onboarding Guide Modal & Tutorial
 */

(function () {
    'use strict';

    let _currentGuideTab = 1;
    const TOTAL_GUIDE_TABS = 4;
    const STORAGE_KEY = 'hide_onboarding_guide_v1';

    /**
     * فحص هل يجب إظهار دليل الاستخدام عند بدء التشغيل
     */
    function checkAndOpenOnboardingGuide() {
        try {
            const hasSeenLocal = localStorage.getItem(STORAGE_KEY) === 'true';
            const hasSeenDb = (window.db && window.db.settings && window.db.settings.hideOnboardingGuide === true);

            if (!hasSeenLocal && !hasSeenDb) {
                // الانتظار قليلاً حتى يكتمل تحميل الصفحة والواجهة
                setTimeout(() => {
                    openOnboardingGuideModal(false);
                }, 600);
            }
        } catch (e) {
            console.warn('checkAndOpenOnboardingGuide error:', e);
        }
    }

    /**
     * فتح نافذة دليل الاستخدام
     * @param {boolean} isManualOpen هل تم الفتح يدوياً من زر المساعدة
     */
    function openOnboardingGuideModal(isManualOpen = false) {
        const modal = document.getElementById('onboardingGuideModal');
        if (!modal) return;

        // تهيئة التبويب الأول
        switchOnboardingGuideTab(1);

        // ضبط حالة خيار "عدم الإظهار مجدداً"
        const chk = document.getElementById('chkDoNotShowOnboardingAgain');
        if (chk) {
            const isHidden = (localStorage.getItem(STORAGE_KEY) === 'true') ||
                (window.db && window.db.settings && window.db.settings.hideOnboardingGuide === true);
            chk.checked = isHidden;
        }

        modal.style.display = 'flex';

        if (window.renderLucide) window.renderLucide();
        else if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    /**
     * إغلاق نافذة الدليل وحفظ التفضيل
     */
    function closeOnboardingGuideModal() {
        const modal = document.getElementById('onboardingGuideModal');
        if (modal) modal.style.display = 'none';

        const chk = document.getElementById('chkDoNotShowOnboardingAgain');
        if (chk) {
            if (chk.checked) {
                try {
                    localStorage.setItem(STORAGE_KEY, 'true');
                    if (window.db) {
                        if (!window.db.settings) window.db.settings = {};
                        window.db.settings.hideOnboardingGuide = true;
                        if (typeof saveDB === 'function') saveDB();
                    }
                } catch (e) {
                    console.warn('Failed to save onboarding preference', e);
                }
            } else {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                    if (window.db && window.db.settings) {
                        window.db.settings.hideOnboardingGuide = false;
                        if (typeof saveDB === 'function') saveDB();
                    }
                } catch (e) {}
            }
        }
    }

    /**
     * الانتقال بين تبويبات الدليل
     * @param {number} tabNum رقم التبويب (1 إلى 4)
     */
    function switchOnboardingGuideTab(tabNum) {
        _currentGuideTab = Math.max(1, Math.min(TOTAL_GUIDE_TABS, tabNum));

        // تحديث أزرار التبويبات
        for (let i = 1; i <= TOTAL_GUIDE_TABS; i++) {
            const btn = document.getElementById(`onboardingTabBtn${i}`);
            const content = document.getElementById(`onboardingGuideContent${i}`);

            if (btn) {
                if (i === _currentGuideTab) {
                    btn.style.background = '#eff6ff';
                    btn.style.color = '#1d4ed8';
                    btn.style.borderColor = '#2563eb';
                    btn.style.fontWeight = '800';
                } else {
                    btn.style.background = '#f8fafc';
                    btn.style.color = '#475569';
                    btn.style.borderColor = 'transparent';
                    btn.style.fontWeight = '700';
                }
            }

            if (content) {
                content.style.display = (i === _currentGuideTab) ? 'block' : 'none';
            }
        }

        // تحديث أزرار التنقل (السابق / التالي)
        const btnPrev = document.getElementById('btnOnboardingPrev');
        const btnNext = document.getElementById('btnOnboardingNext');

        if (btnPrev) {
            btnPrev.style.display = (_currentGuideTab > 1) ? 'inline-flex' : 'none';
        }

        if (btnNext) {
            if (_currentGuideTab === TOTAL_GUIDE_TABS) {
                btnNext.innerHTML = `<span>فهمت، ابدأ استخدام المنظومة الآن</span> <span data-lucide="check" data-size="16"></span>`;
                btnNext.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
            } else {
                btnNext.innerHTML = `<span>الخطوة التالية</span> <span data-lucide="arrow-left" data-size="16"></span>`;
                btnNext.style.background = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
            }
        }

        if (window.renderLucide) window.renderLucide();
        else if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    }

    function nextOnboardingGuideTab() {
        if (_currentGuideTab >= TOTAL_GUIDE_TABS) {
            // الانتهاء والإغلاق
            const chk = document.getElementById('chkDoNotShowOnboardingAgain');
            if (chk) chk.checked = true; // تعيين عدم الإظهار تلقائياً عند إتمام الدليل
            closeOnboardingGuideModal();
            if (typeof showNotification === 'function') {
                showNotification('نتمنى لك تجربة ممتعة وموفقة في التدبير التربوي!', 'success');
            }
        } else {
            switchOnboardingGuideTab(_currentGuideTab + 1);
        }
    }

    function prevOnboardingGuideTab() {
        if (_currentGuideTab > 1) {
            switchOnboardingGuideTab(_currentGuideTab - 1);
        }
    }

    /**
     * الانتقال الفوري للوظيفة المشروحة من داخل الدليل
     * @param {string} target 'absence' | 'grades' | 'backup' | 'dashboard'
     */
    function navigateToFromGuide(target) {
        closeOnboardingGuideModal();

        setTimeout(() => {
            if (target === 'absence') {
                if (typeof switchTab === 'function') switchTab('absence');
            } else if (target === 'grades') {
                if (typeof switchTab === 'function') switchTab('grades');
            } else if (target === 'backup') {
                if (typeof openTeacherSettings === 'function') {
                    openTeacherSettings('settingsBackup');
                } else if (typeof openDataManagementModal === 'function') {
                    openDataManagementModal();
                }
            } else if (target === 'dashboard') {
                if (typeof switchTab === 'function') switchTab('dashboard');
            }
        }, 150);
    }

    // تصدير الدوال للنطاق العام
    window.checkAndOpenOnboardingGuide = checkAndOpenOnboardingGuide;
    window.openOnboardingGuideModal = openOnboardingGuideModal;
    window.closeOnboardingGuideModal = closeOnboardingGuideModal;
    window.switchOnboardingGuideTab = switchOnboardingGuideTab;
    window.nextOnboardingGuideTab = nextOnboardingGuideTab;
    window.prevOnboardingGuideTab = prevOnboardingGuideTab;
    window.navigateToFromGuide = navigateToFromGuide;

    // استدعاء الفحص التلقائي عند اكتمال تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(checkAndOpenOnboardingGuide, 800);
        });
    } else {
        setTimeout(checkAndOpenOnboardingGuide, 800);
    }

})();
