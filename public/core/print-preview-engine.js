/**
 * ============================================================================
 * محرك المعاينة الطباعية الموحدة ونوافذ التأكيد غير الحاجبة (Print Preview & Confirm Dialog Engine)
 * المسار: /public/core/print-preview-engine.js
 * ============================================================================
 * يوفر:
 * - نافذة التأكيد التفاعلية الموحدة غير الحاجبة (window.showConfirmDialog) بديلاً آمناً عن window.confirm
 *   مع دعم كامل للوصولية (role="dialog", aria-modal="true", Escape/Enter) وإرجاع Promise<boolean>
 * - محول اعتراض نوافذ الطباعة الفارغة (installDirectPrintPopupInterceptor) لمنع حظر النوافذ في بيئة iFrame
 * ============================================================================
 */
(function (window, document) {
    'use strict';

    /**
     * نافذة تأكيد تفاعلية غير حاجبة (Non-Blocking In-App Confirmation Dialog)
     * تدعم أسلوب الاستدعاء عبر Callbacks (onConfirm, onCancel) وأسلوب async/await عبر Promise<boolean>
     *
     * @param {string} message نص رسالة التأكيد
     * @param {Function} [onConfirm] دالة تُنفذ عند التأكيد
     * @param {Function} [onCancel] دالة تُنفذ عند الإلغاء
     * @param {Object} [options] خيارات التخصيص (title, confirmText, cancelText, danger, icon)
     * @returns {Promise<boolean>}
     */
    function showConfirmDialog(message, onConfirm, onCancel, options) {
        const opts = (onConfirm && typeof onConfirm === 'object' && !Array.isArray(onConfirm))
            ? onConfirm
            : (options || {});
        const confirmCb = typeof onConfirm === 'function' ? onConfirm : (typeof opts.onConfirm === 'function' ? opts.onConfirm : null);
        const cancelCb = typeof onCancel === 'function' ? onCancel : (typeof opts.onCancel === 'function' ? opts.onCancel : null);

        const title = opts.title || 'تأكيد العملية';
        const confirmText = opts.confirmText || 'تأكيد المتابعة';
        const cancelText = opts.cancelText || 'إلغاء';
        const isDanger = opts.danger !== undefined ? Boolean(opts.danger) : /حذف|مسح|تصفير|إلغاء|إزالة/.test(String(message || ''));
        const icon = opts.icon || (isDanger ? '⚠️' : '🛡️');

        return new Promise((resolve) => {
            if (!document || !document.body) {
                if (confirmCb) confirmCb();
                resolve(true);
                return;
            }

            const existing = document.getElementById('appUnifiedConfirmDialogBackdrop');
            if (existing) existing.remove();

            const backdrop = document.createElement('div');
            backdrop.id = 'appUnifiedConfirmDialogBackdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');
            backdrop.setAttribute('aria-labelledby', 'appUnifiedConfirmDialogTitle');
            backdrop.setAttribute('aria-describedby', 'appUnifiedConfirmDialogMessage');
            backdrop.style.cssText = [
                'position:fixed',
                'inset:0',
                'background:rgba(15,23,42,0.72)',
                'backdrop-filter:blur(4px)',
                'z-index:1000000',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'padding:16px',
                'direction:rtl',
                'font-family:"Cairo",sans-serif'
            ].join(';');

            const card = document.createElement('div');
            card.style.cssText = [
                'width:100%',
                'max-width:460px',
                'background:#ffffff',
                'border-radius:16px',
                `border:1.5px solid ${isDanger ? '#fca5a5' : '#cbd5e1'}`,
                `border-top:5px solid ${isDanger ? '#dc2626' : '#2563eb'}`,
                'box-shadow:0 25px 50px -12px rgba(15,23,42,0.4)',
                'overflow:hidden'
            ].join(';');

            const header = document.createElement('div');
            header.style.cssText = 'padding:16px 20px 10px 20px; display:flex; align-items:center; gap:10px;';

            const iconBox = document.createElement('div');
            iconBox.style.cssText = `width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; background:${isDanger ? '#fef2f2' : '#eff6ff'}; border:1px solid ${isDanger ? '#fecaca' : '#bfdbfe'}; flex-shrink:0;`;
            iconBox.textContent = icon;

            const titleEl = document.createElement('h3');
            titleEl.id = 'appUnifiedConfirmDialogTitle';
            titleEl.style.cssText = 'margin:0; font-size:1.05rem; font-weight:900; color:#0f172a;';
            titleEl.textContent = title;

            header.appendChild(iconBox);
            header.appendChild(titleEl);

            const body = document.createElement('div');
            body.id = 'appUnifiedConfirmDialogMessage';
            body.style.cssText = 'padding:6px 20px 18px 20px; font-size:0.9rem; font-weight:600; color:#334155; line-height:1.65; white-space:pre-line;';
            body.textContent = String(message || '');

            const footer = document.createElement('div');
            footer.style.cssText = 'padding:12px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; align-items:center; gap:10px;';

            const btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.id = 'btnUnifiedConfirmCancel';
            btnCancel.style.cssText = 'background:#ffffff; color:#475569; border:1.5px solid #cbd5e1; padding:8px 16px; border-radius:9px; font-size:0.85rem; font-weight:800; cursor:pointer; font-family:"Cairo",sans-serif;';
            btnCancel.textContent = cancelText;

            const btnConfirm = document.createElement('button');
            btnConfirm.type = 'button';
            btnConfirm.id = 'btnUnifiedConfirmAccept';
            btnConfirm.style.cssText = `background:${isDanger ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)'}; color:#ffffff; border:none; padding:8px 18px; border-radius:9px; font-size:0.85rem; font-weight:800; cursor:pointer; font-family:"Cairo",sans-serif; box-shadow:0 4px 12px ${isDanger ? 'rgba(220,38,38,0.3)' : 'rgba(37,99,235,0.3)'};`;
            btnConfirm.textContent = confirmText;

            footer.appendChild(btnCancel);
            footer.appendChild(btnConfirm);

            card.appendChild(header);
            card.appendChild(body);
            card.appendChild(footer);
            backdrop.appendChild(card);

            let settled = false;
            const finalize = (accepted) => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                try {
                    if (accepted && confirmCb) confirmCb();
                    if (!accepted && cancelCb) cancelCb();
                } catch (err) {
                    console.error('Confirm dialog callback error:', err);
                }
                resolve(accepted);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    finalize(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    finalize(true);
                }
            };

            btnCancel.onclick = () => finalize(false);
            btnConfirm.onclick = () => finalize(true);
            backdrop.onclick = (e) => {
                if (e.target === backdrop) finalize(false);
            };

            document.addEventListener('keydown', onKeyDown);
            document.body.appendChild(backdrop);
            setTimeout(() => {
                try { btnConfirm.focus(); } catch (e) {}
            }, 20);
        });
    }

    /**
     * نافذة إدخال نصية تفاعلية غير حاجبة (Non-Blocking In-App Input Dialog)
     * بديل آمن عن window.prompt يدعم Callbacks و Promise<string | null>
     *
     * @param {string} message نص الرسالة التوضيحية
     * @param {string} [defaultValue] القيمة الافتراضية للحقل
     * @param {Function} [onSubmit] دالة تُنفذ عند الإدخال والتأكيد
     * @param {Object} [options] خيارات إضافية (title, placeholder, confirmText, cancelText)
     * @returns {Promise<string|null>}
     */
    function showInputDialog(message, defaultValue, onSubmit, options) {
        const defVal = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';
        const opts = (onSubmit && typeof onSubmit === 'object' && !Array.isArray(onSubmit))
            ? onSubmit
            : (options || {});
        const submitCb = typeof onSubmit === 'function' ? onSubmit : (typeof opts.onSubmit === 'function' ? opts.onSubmit : null);
        const title = opts.title || 'إدخال معطيات';
        const placeholder = opts.placeholder || 'اكتب هنا...';
        const confirmText = opts.confirmText || 'حفظ وتأكيد';
        const cancelText = opts.cancelText || 'إلغاء';

        return new Promise((resolve) => {
            if (!document || !document.body) {
                if (submitCb) submitCb(defVal);
                resolve(defVal);
                return;
            }

            const existing = document.getElementById('appUnifiedInputDialogBackdrop');
            if (existing) existing.remove();

            const backdrop = document.createElement('div');
            backdrop.id = 'appUnifiedInputDialogBackdrop';
            backdrop.setAttribute('role', 'dialog');
            backdrop.setAttribute('aria-modal', 'true');
            backdrop.style.cssText = [
                'position:fixed',
                'inset:0',
                'background:rgba(15,23,42,0.72)',
                'backdrop-filter:blur(4px)',
                'z-index:1000001',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'padding:16px',
                'direction:rtl',
                'font-family:"Cairo",sans-serif'
            ].join(';');

            const card = document.createElement('div');
            card.style.cssText = [
                'width:100%',
                'max-width:480px',
                'background:#ffffff',
                'border-radius:16px',
                'border:1.5px solid #cbd5e1',
                'border-top:5px solid #2563eb',
                'box-shadow:0 25px 50px -12px rgba(15,23,42,0.4)',
                'overflow:hidden'
            ].join(';');

            const header = document.createElement('div');
            header.style.cssText = 'padding:16px 20px 8px 20px; display:flex; align-items:center; gap:10px;';
            header.innerHTML = `<div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;background:#eff6ff;border:1px solid #bfdbfe;">✏️</div>`;
            const titleEl = document.createElement('h3');
            titleEl.style.cssText = 'margin:0; font-size:1.02rem; font-weight:900; color:#0f172a;';
            titleEl.textContent = title;
            header.appendChild(titleEl);

            const body = document.createElement('div');
            body.style.cssText = 'padding:6px 20px 16px 20px;';

            const msgEl = document.createElement('div');
            msgEl.style.cssText = 'font-size:0.86rem; font-weight:700; color:#334155; line-height:1.6; white-space:pre-line; margin-bottom:10px;';
            msgEl.textContent = String(message || '');

            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.id = 'appUnifiedInputDialogField';
            inputEl.value = defVal;
            inputEl.placeholder = placeholder;
            inputEl.style.cssText = 'width:100%; padding:10px 12px; border:1.5px solid #94a3b8; border-radius:10px; font-size:0.9rem; font-weight:700; color:#0f172a; font-family:"Cairo",sans-serif; box-sizing:border-box; outline:none;';

            body.appendChild(msgEl);
            body.appendChild(inputEl);

            const footer = document.createElement('div');
            footer.style.cssText = 'padding:12px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; align-items:center; gap:10px;';

            const btnCancel = document.createElement('button');
            btnCancel.type = 'button';
            btnCancel.id = 'btnUnifiedInputCancel';
            btnCancel.style.cssText = 'background:#ffffff; color:#475569; border:1.5px solid #cbd5e1; padding:8px 16px; border-radius:9px; font-size:0.84rem; font-weight:800; cursor:pointer; font-family:"Cairo",sans-serif;';
            btnCancel.textContent = cancelText;

            const btnSubmit = document.createElement('button');
            btnSubmit.type = 'button';
            btnSubmit.id = 'btnUnifiedInputAccept';
            btnSubmit.style.cssText = 'background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#ffffff; border:none; padding:8px 18px; border-radius:9px; font-size:0.84rem; font-weight:800; cursor:pointer; font-family:"Cairo",sans-serif; box-shadow:0 4px 12px rgba(37,99,235,0.3);';
            btnSubmit.textContent = confirmText;

            footer.appendChild(btnCancel);
            footer.appendChild(btnSubmit);

            card.appendChild(header);
            card.appendChild(body);
            card.appendChild(footer);
            backdrop.appendChild(card);

            let settled = false;
            const finalize = (val) => {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                try {
                    if (val !== null && submitCb) submitCb(val);
                } catch (err) {
                    console.error('Input dialog callback error:', err);
                }
                resolve(val);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    finalize(null);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    finalize(inputEl.value);
                }
            };

            btnCancel.onclick = () => finalize(null);
            btnSubmit.onclick = () => finalize(inputEl.value);
            backdrop.onclick = (e) => {
                if (e.target === backdrop) finalize(null);
            };

            document.addEventListener('keydown', onKeyDown);
            document.body.appendChild(backdrop);
            setTimeout(() => {
                try {
                    inputEl.focus();
                    inputEl.select();
                } catch (e) {}
            }, 20);
        });
    }

    /**
     * اعتراض نوافذ الطباعة الفارغة وتحويلها تلقائياً إلى معاينة الطباعة المدمجة داخل التطبيق
     */
    function installDirectPrintPopupInterceptor() {
        if (!window || window.__directPrintInterceptorInstalled) return;
        window.__directPrintInterceptorInstalled = true;

        const _origWindowOpen = window.open;
        const customOpen = function (url) {
            if (!url || url === '' || url === 'about:blank') {
                let _buffer = '';
                let _printed = false;
                const triggerDirectPrint = () => {
                    if (_printed || !_buffer.trim()) return;
                    _printed = true;
                    const isLandscape = /size:\s*A4\s+landscape/i.test(_buffer);
                    const titleMatch = _buffer.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const docTitle = titleMatch ? titleMatch[1].trim() : 'وثيقة_رسمية_للطباعة';
                    if (typeof window.openCustomPrintPreviewModal === 'function') {
                        window.openCustomPrintPreviewModal(_buffer, {
                            title: docTitle,
                            orientation: isLandscape ? 'landscape' : 'portrait'
                        });
                    }
                };
                return {
                    closed: false,
                    document: {
                        title: '',
                        open: function () { _buffer = ''; return this; },
                        write: function (str) {
                            _buffer += String(str || '');
                            setTimeout(triggerDirectPrint, 80);
                        },
                        writeln: function (str) {
                            _buffer += String(str || '') + '\n';
                            setTimeout(triggerDirectPrint, 80);
                        },
                        close: function () {
                            setTimeout(triggerDirectPrint, 30);
                        }
                    },
                    focus: function () {},
                    print: function () {
                        triggerDirectPrint();
                    },
                    close: function () {
                        this.closed = true;
                    }
                };
            }
            return typeof window.openSafeExternalUrl === 'function'
                ? window.openSafeExternalUrl(url)
                : (_origWindowOpen ? _origWindowOpen.apply(window, arguments) : null);
        };
        try {
            const desc = Object.getOwnPropertyDescriptor(window, 'open');
            if (!desc || desc.writable || desc.configurable) {
                Object.defineProperty(window, 'open', { value: customOpen, configurable: true, writable: true });
            }
        } catch (e) {}
    }

    installDirectPrintPopupInterceptor();

    const PrintPreviewEngine = {
        showConfirmDialog,
        showInputDialog,
        installDirectPrintPopupInterceptor
    };

    window.PrintPreviewEngine = PrintPreviewEngine;
    window.showConfirmDialog = showConfirmDialog;
    window.showInputDialog = showInputDialog;
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
