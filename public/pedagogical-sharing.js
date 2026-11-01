/**
 * ====================================================================
 * منظومة مشاركة السجلات البيداغوجية والتقارير عبر رمز QR ورابط مباشر مشفر
 * Pedagogical Sharing Engine with QR Code & Encrypted Direct Links
 * ====================================================================
 * مادة الرياضيات - المملكة المغربية
 */

(function (window) {
    'use strict';

    let currentShareConfig = null;
    let currentShareResult = null;
    let isGeneratingShare = false;

    /**
     * فتح نافذة إعداد ومشاركة السجل البيداغوجي أو التقرير
     * @param {Object} options { type: 'student'|'report', className, studentId, studentName, semester, reportTitle, reportData }
     */
    function openShareRecordModal(options) {
        currentShareConfig = options || {};
        ensureShareModalExists();

        const modal = document.getElementById('pedagogicalShareModal');
        if (!modal) return;

        // Reset state
        currentShareResult = null;
        isGeneratingShare = false;

        const targetTitleEl = document.getElementById('shareModalTargetTitle');
        const targetDescEl = document.getElementById('shareModalTargetDesc');
        const pinInput = document.getElementById('shareModalPinInput');
        const qrContainer = document.getElementById('shareModalQrResultContainer');
        const formContainer = document.getElementById('shareModalConfigContainer');
        const genBtn = document.getElementById('shareModalGenerateBtn');

        if (pinInput) pinInput.value = '';
        if (qrContainer) qrContainer.style.display = 'none';
        if (formContainer) formContainer.style.display = 'block';
        if (genBtn) {
            genBtn.disabled = false;
            genBtn.style.opacity = '1';
            genBtn.innerHTML = '<span class="ui-icon"><span data-lucide="qr-code" data-size="16"></span></span> <span>توليد رمز QR والرابط المشفر</span>';
        }

        const type = options.type || 'student';
        if (type === 'student') {
            const stdName = options.studentName || 'التلميذ';
            const cls = options.className || 'القسم';
            if (targetTitleEl) targetTitleEl.textContent = `مشاركة السجل البيداغوجي: ${stdName}`;
            if (targetDescEl) targetDescEl.textContent = `القسم: ${cls} • مادة الرياضيات • إعداد ملف الإنجاز المشفر للمشاركة مع الزملاء`;
        } else {
            const repTitle = options.reportTitle || `تقرير القسم (${options.className || ''})`;
            if (targetTitleEl) targetTitleEl.textContent = `مشاركة التقرير البيداغوجي: ${repTitle}`;
            if (targetDescEl) targetDescEl.textContent = `المحضر والتقرير التحليلي الموحد • مادة الرياضيات`;
        }

        modal.style.display = 'flex';
        if (window.renderLucide) window.renderLucide(modal);

        // Auto trigger generation for convenience
        setTimeout(() => {
            generateEncryptedShare();
        }, 120);
    }

    /**
     * إغلاق نافذة المشاركة
     */
    function closeShareRecordModal() {
        const modal = document.getElementById('pedagogicalShareModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * جمع البيانات وتوليد الرابط المشفر ورمز QR عبر الخادم
     */
    async function generateEncryptedShare() {
        if (isGeneratingShare) return;
        if (!currentShareConfig) return;

        isGeneratingShare = true;
        const genBtn = document.getElementById('shareModalGenerateBtn');
        const qrContainer = document.getElementById('shareModalQrResultContainer');
        const loadingSpinner = document.getElementById('shareModalLoadingSpinner');

        if (genBtn) {
            genBtn.disabled = true;
            genBtn.style.opacity = '0.7';
            genBtn.innerHTML = '<span class="ui-icon animate-spin">⏳</span> <span>جاري تشفير البيانات وتوليد رمز QR...</span>';
        }
        if (loadingSpinner) loadingSpinner.style.display = 'flex';

        try {
            const db = window.db || {};
            const teacherProfile = db.teacherProfile || db.profile || {};
            const teacherName = teacherProfile.name || 'أستاذ مادة الرياضيات';
            const schoolName = teacherProfile.school || 'المؤسسة التعليمية';

            const pinInput = document.getElementById('shareModalPinInput');
            const pin = pinInput ? pinInput.value.trim() : '';

            const expirySelect = document.getElementById('shareModalExpirySelect');
            const expiryDays = expirySelect ? parseInt(expirySelect.value, 10) : 30;

            const optGrades = document.getElementById('shareOptGrades') ? document.getElementById('shareOptGrades').checked : true;
            const optAbsences = document.getElementById('shareOptAbsences') ? document.getElementById('shareOptAbsences').checked : true;
            const optBehavior = document.getElementById('shareOptBehavior') ? document.getElementById('shareOptBehavior').checked : true;
            const optRemediation = document.getElementById('shareOptRemediation') ? document.getElementById('shareOptRemediation').checked : true;

            let sharePayload = null;
            let shareTitle = '';
            let shareSubtitle = '';

            if (currentShareConfig.type === 'student') {
                const className = currentShareConfig.className;
                const studentId = currentShareConfig.studentId;

                let portfolioData = null;
                if (typeof window.buildStudentPortfolioData === 'function') {
                    portfolioData = window.buildStudentPortfolioData(className, studentId);
                }

                // If portfolio data builder is available, use it; otherwise build structured student object from db
                if (!portfolioData) {
                    const studentObj = (db.classes && db.classes[className]) ? db.classes[className].find(s => s.id === studentId) : null;
                    const gradesObj = (db.grades && db.grades[className] && db.grades[className][studentId]) ? db.grades[className][studentId] : {};
                    const absenceRecords = (db.records && Array.isArray(db.records))
                        ? db.records.filter(r => r.className === className && r.studentId === studentId)
                        : [];

                    portfolioData = {
                        student: studentObj || { id: studentId, name: currentShareConfig.studentName || 'تلميذ' },
                        className,
                        grades: gradesObj,
                        absences: absenceRecords,
                        behaviors: (db.behaviors && db.behaviors[className] && db.behaviors[className][studentId]) ? db.behaviors[className][studentId] : {}
                    };
                }

                const stdName = (portfolioData.student && portfolioData.student.name) || currentShareConfig.studentName || 'التلميذ';
                shareTitle = `سجل التلميذ(ة): ${stdName}`;
                shareSubtitle = `القسم: ${className} • الموسم الدراسي: ${db.academicYear || '2026/2027'}`;

                // Filter data according to teacher options
                sharePayload = {
                    student: {
                        id: portfolioData.student.id,
                        name: portfolioData.student.name,
                        massar: portfolioData.student.massar || portfolioData.student.id,
                        gender: portfolioData.student.gender || 'M',
                        className
                    },
                    schoolYear: db.academicYear || '2026/2027',
                    scope: {
                        grades: optGrades,
                        absences: optAbsences,
                        behavior: optBehavior,
                        remediation: optRemediation
                    },
                    // Grades & Continuous Assessment
                    grades: optGrades ? (portfolioData.gradesData || portfolioData.grades || {}) : null,
                    academicMetrics: optGrades ? {
                        s1Avg: portfolioData.s1Avg,
                        s2Avg: portfolioData.s2Avg,
                        annualAvg: portfolioData.annualAvg,
                        rankInClass: portfolioData.rankInClass,
                        classSize: portfolioData.classSize,
                        trajectoryDirection: portfolioData.trajectoryDirection,
                        deltaTrajectory: portfolioData.deltaTrajectory
                    } : null,
                    // Failure Risk Index
                    riskIndex: (optGrades && portfolioData.failureRisk) ? {
                        riskScore: portfolioData.failureRisk.riskScore,
                        riskLabel: portfolioData.failureRisk.riskLabel,
                        riskColor: portfolioData.failureRisk.riskColor,
                        diagnosticSummary: portfolioData.failureRisk.diagnosticSummary
                    } : null,
                    // Attendance Records
                    absences: optAbsences ? {
                        totalHours: portfolioData.totalAbsentHours || 0,
                        unjustifiedHours: portfolioData.unjustifiedHours || 0,
                        justifiedHours: portfolioData.justifiedHours || 0,
                        lateCount: portfolioData.lateCount || 0,
                        records: (portfolioData.absencesList || []).slice(0, 30)
                    } : null,
                    // Behavior & Homework Notes
                    behavior: optBehavior ? {
                        missedHomework: portfolioData.missedHomeworkCount || 0,
                        notesList: (portfolioData.behaviorNotesList || []).slice(0, 20)
                    } : null,
                    // Targeted Remediation Notes
                    remediation: optRemediation ? {
                        notes: portfolioData.remediationNotes || 'متابعة بيداغوجية مستمرة وتعزيز التحكم في البرهان الرياضي وحل المسائل.',
                        actionItems: portfolioData.suggestedActions || ['التركيز على التمارين التطبيقية المتدرجة', 'المواظبة على إنجاز الواجبات المنزلية']
                    } : null
                };

            } else {
                // Class Unified Report Share
                const className = currentShareConfig.className || 'القسم';
                const semester = currentShareConfig.semester || 's1';
                shareTitle = `التقرير والتحليل البيداغوجي الموحد (${className})`;
                shareSubtitle = `الدورة ${semester === 's2' ? 'الثانية' : 'الأولى'} • مادة الرياضيات`;

                sharePayload = {
                    className,
                    semester,
                    schoolYear: db.academicYear || '2026/2027',
                    reportData: currentShareConfig.reportData || {
                        generatedAt: new Date().toISOString(),
                        summary: `تقرير الأداء والمواظبة لقسم ${className}`
                    }
                };
            }

            // Call Backend Sharing API
            const response = await fetch('/api/share/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: currentShareConfig.type || 'student',
                    title: shareTitle,
                    subtitle: shareSubtitle,
                    data: sharePayload,
                    pin: pin,
                    expiryDays: expiryDays,
                    teacherName: teacherName,
                    schoolName: schoolName
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'تعذر توليد رابط المشاركة المشفر');
            }

            const result = await response.json();
            currentShareResult = result;

            renderShareResult(result, pin);

        } catch (error) {
            console.error("Share generation error:", error);
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تعذر توليد رابط المشاركة: ' + error.message, 'error');
            } else {
                alert('تعذر توليد رابط المشاركة: ' + error.message);
            }
        } finally {
            isGeneratingShare = false;
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (genBtn) {
                genBtn.disabled = false;
                genBtn.style.opacity = '1';
                genBtn.innerHTML = '<span class="ui-icon"><span data-lucide="refresh-cw" data-size="16"></span></span> <span>إعادة توليد الرابط والرمز</span>';
                if (window.renderLucide) window.renderLucide(genBtn);
            }
        }
    }

    /**
     * عرض نتيجة التشفير ورمز QR والرابط المباشر
     */
    function renderShareResult(result, pin) {
        const qrContainer = document.getElementById('shareModalQrResultContainer');
        const qrImg = document.getElementById('shareResultQrImage');
        const urlInput = document.getElementById('shareResultUrlInput');
        const pinBadge = document.getElementById('shareResultPinBadge');
        const expiryBadge = document.getElementById('shareResultExpiryBadge');

        if (!qrContainer) return;

        if (qrImg && result.qrCodeDataUrl) {
            qrImg.src = result.qrCodeDataUrl;
        }
        if (urlInput && result.shareUrl) {
            urlInput.value = result.shareUrl;
        }

        if (pinBadge) {
            if (result.hasPin && pin) {
                pinBadge.style.display = 'inline-flex';
                pinBadge.innerHTML = `🔒 محمي بالقن السري: <b style="letter-spacing: 2px; margin-right: 4px;">${escapeHtml(pin)}</b>`;
            } else {
                pinBadge.style.display = 'none';
            }
        }

        if (expiryBadge && result.expiresAt) {
            const expDate = new Date(result.expiresAt).toLocaleDateString('ar-MA');
            expiryBadge.textContent = `📅 صالح حتى: ${expDate}`;
        }

        qrContainer.style.display = 'block';
        if (window.renderLucide) window.renderLucide(qrContainer);
    }

    /**
     * نسخ الرابط المشفر إلى الحافظة
     */
    window.copySharedDirectLink = function () {
        const urlInput = document.getElementById('shareResultUrlInput');
        if (!urlInput || !urlInput.value) return;

        navigator.clipboard.writeText(urlInput.value).then(() => {
            const copyBtn = document.getElementById('shareModalCopyBtn');
            if (copyBtn) {
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span>✅ تم النسخ بنجاح!</span>';
                copyBtn.style.background = '#10b981';
                copyBtn.style.color = '#fff';
                setTimeout(() => {
                    copyBtn.innerHTML = originalHtml;
                    copyBtn.style.background = '';
                    copyBtn.style.color = '';
                    if (window.renderLucide) window.renderLucide(copyBtn);
                }, 2000);
            }

            if (typeof window.showAppToast === 'function') {
                window.showAppToast('✅ تم نسخ الرابط المشفر بنجاح إلى الحافظة.', 'success');
            }
        }).catch(err => {
            urlInput.select();
            document.execCommand('copy');
            if (typeof window.showAppToast === 'function') {
                window.showAppToast('تم نسخ الرابط.', 'success');
            }
        });
    };

    /**
     * تنزيل رمز QR كصورة PNG عالية الدقة
     */
    window.downloadSharedQrPng = function () {
        if (!currentShareResult || !currentShareResult.qrCodeDataUrl) return;

        const a = document.createElement('a');
        a.href = currentShareResult.qrCodeDataUrl;
        const targetName = (currentShareConfig && currentShareConfig.studentName) ? currentShareConfig.studentName.replace(/\s+/g, '_') : 'record';
        a.download = `QR_Code_${targetName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (typeof window.showAppToast === 'function') {
            window.showAppToast('تم بدء تنزيل رمز QR كصورة عالية الدقة.', 'info');
        }
    };

    /**
     * المشاركة المباشرة عبر WhatsApp مع رسالة مهنية مؤطرة
     */
    window.shareViaWhatsApp = function () {
        if (!currentShareResult || !currentShareResult.shareUrl) return;

        const pinInput = document.getElementById('shareModalPinInput');
        const pin = pinInput ? pinInput.value.trim() : '';

        const type = (currentShareConfig && currentShareConfig.type) || 'student';
        let msg = '';

        if (type === 'student') {
            const stdName = (currentShareConfig && currentShareConfig.studentName) || 'التلميذ(ة)';
            const cls = (currentShareConfig && currentShareConfig.className) || '';
            msg = `السلام عليكم ورحمة الله وبركاته،\nأخي الأستاذ / أختي الأستاذة،\nأشاركك السجل البيداغوجي المشفر للتلميذ(ة) *${stdName}* (${cls}) لمادة الرياضيات عبر الرابط الآمن التالي:\n${currentShareResult.shareUrl}`;
            if (pin) {
                msg += `\n🔑 القن السري لفتح السجل: *${pin}*`;
            }
            msg += `\n\n— منظومة التدبير التربوي لمادة الرياضيات`;
        } else {
            const title = (currentShareConfig && currentShareConfig.reportTitle) || 'التقرير البيداغوجي';
            msg = `السلام عليكم ورحمة الله وبركاته،\nأشارككم *${title}* لمادة الرياضيات عبر الرابط المشفر المباشر:\n${currentShareResult.shareUrl}`;
            if (pin) {
                msg += `\n🔑 القن السري لفتح التقرير: *${pin}*`;
            }
            msg += `\n\n— منظومة التدبير التربوي`;
        }

        const encodedMsg = encodeURIComponent(msg);
        window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
    };

    /**
     * معاينة حية كما يراها الزميل الأستاذ
     */
    window.previewSharedAsColleague = function () {
        if (!currentShareResult || !currentShareResult.shareUrl) return;
        window.open(currentShareResult.shareUrl, '_blank');
    };

    /**
     * إنشاء وحقن نافذة المشاركة التفاعلية في الصفحة
     */
    function ensureShareModalExists() {
        if (document.getElementById('pedagogicalShareModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'pedagogicalShareModal';
        modalDiv.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(5px); z-index: 13000; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box;';

        modalDiv.innerHTML = `
            <div class="card" style="width: 100%; max-width: 660px; max-height: 94vh; overflow-y: auto; background: #ffffff; border-radius: 16px; border: 1.5px solid #cbd5e1; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); padding: 0; display: flex; flex-direction: column;">
                
                <!-- Modal Header -->
                <div style="padding: 16px 20px; border-bottom: 1.5px solid #e2e8f0; background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; border-top-left-radius: 14px; border-top-right-radius: 14px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 10px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1.5px solid rgba(96, 165, 250, 0.4);">
                            <span data-lucide="qr-code" data-size="22"></span>
                        </span>
                        <div>
                            <h3 id="shareModalTargetTitle" style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #f8fafc;">مشاركة السجل البيداغوجي</h3>
                            <p id="shareModalTargetDesc" style="margin: 2px 0 0 0; font-size: 0.76rem; color: #94a3b8;">توليد رمز QR ورابط مباشر مشفر للمشاركة مع الزملاء</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeShareRecordModal()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.1rem;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">✕</button>
                </div>

                <!-- Modal Body -->
                <div style="padding: 20px; flex: 1;">
                    
                    <!-- 1. Options & Controls Container -->
                    <div id="shareModalConfigContainer" style="margin-bottom: 16px;">
                        
                        <!-- Scope Checkboxes -->
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                            <label style="font-weight: 800; color: #1e293b; font-size: 0.86rem; display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                                <span class="ui-icon" style="color: #2563eb; margin: 0;"><span data-lucide="sliders" data-size="16"></span></span>
                                <span>البيانات المراد تضمينها في السجل المشترك:</span>
                            </label>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: #334155; cursor: pointer;">
                                    <input type="checkbox" id="shareOptGrades" checked style="width: 17px; height: 17px; accent-color: #2563eb;">
                                    <span>نقط الفروض والمعدلات ومسار التطور</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: #334155; cursor: pointer;">
                                    <input type="checkbox" id="shareOptAbsences" checked style="width: 17px; height: 17px; accent-color: #2563eb;">
                                    <span>سجل وتواريخ الغياب والتأخرات</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: #334155; cursor: pointer;">
                                    <input type="checkbox" id="shareOptBehavior" checked style="width: 17px; height: 17px; accent-color: #2563eb;">
                                    <span>ملاحظات السلوك وتتبع الواجبات</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: #334155; cursor: pointer;">
                                    <input type="checkbox" id="shareOptRemediation" checked style="width: 17px; height: 17px; accent-color: #2563eb;">
                                    <span>مؤشر التعثر وتوصيات المعالجة</span>
                                </label>
                            </div>
                        </div>

                        <!-- Security & Expiry Controls -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                            <div>
                                <label style="font-weight: 800; font-size: 0.82rem; color: #1e293b; display: block; margin-bottom: 4px;">
                                    🔒 حماية بقن سري (اختياري للخصوصية):
                                </label>
                                <input type="text" id="shareModalPinInput" placeholder="مثال: 1234 أو كود خاص" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-family: monospace; outline: none;" maxlength="10">
                                <span style="font-size: 0.7rem; color: #64748b; margin-top: 2px; display: block;">اتركه فارغاً للمشاركة المباشرة دون قن</span>
                            </div>
                            <div>
                                <label style="font-weight: 800; font-size: 0.82rem; color: #1e293b; display: block; margin-bottom: 4px;">
                                    ⏳ مدة صلاحية الرابط:
                                </label>
                                <select id="shareModalExpirySelect" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-weight: 700; color: #334155; background: #fff; cursor: pointer;">
                                    <option value="7">أسبوع واحد (7 أيام)</option>
                                    <option value="30" selected>شهر كامل (30 يوماً)</option>
                                    <option value="90">فصل دراسي (90 يوماً)</option>
                                    <option value="365">موسم دراسي كامل (سنة)</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" id="shareModalGenerateBtn" onclick="generateEncryptedShare()" class="btn-primary" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; padding: 10px 22px; border-radius: 9px; font-weight: 800; font-size: 0.86rem; color: #fff; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); cursor: pointer;">
                                <span class="ui-icon" style="margin: 0;"><span data-lucide="qr-code" data-size="16"></span></span>
                                <span>توليد رمز QR والرابط المشفر</span>
                            </button>
                        </div>
                    </div>

                    <!-- Loading Spinner -->
                    <div id="shareModalLoadingSpinner" style="display: none; align-items: center; justify-content: center; padding: 24px; flex-direction: column; gap: 10px;">
                        <span style="font-size: 1.8rem;" class="animate-spin">⏳</span>
                        <span style="font-size: 0.85rem; font-weight: 700; color: #2563eb;">جاري تشفير وتأمين البيانات وتوليد رمز الاستجابة السريعة QR...</span>
                    </div>

                    <!-- 2. Result QR & Link Card (Hidden initially, shown after generation) -->
                    <div id="shareModalQrResultContainer" style="display: none; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 2px solid #cbd5e1; border-radius: 14px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.05);">
                        
                        <div style="display: flex; flex-direction: column; md:flex-row; gap: 18px; align-items: center; justify-content: center;">
                            
                            <!-- QR Code Display Box -->
                            <div style="background: #ffffff; padding: 12px; border-radius: 12px; border: 1.5px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <img id="shareResultQrImage" src="" alt="رمز QR للمعاينة والمشاركة" style="width: 170px; height: 170px; display: block; border-radius: 6px;">
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: 700; margin-top: 6px; text-align: center;">
                                    امسح بكاميرا الهاتف للمعاينة المباشرة 📱
                                </span>
                            </div>

                            <!-- Link Actions & Badges -->
                            <div style="flex: 1; width: 100%; display: flex; flex-direction: column; gap: 10px;">
                                
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                    <span style="font-size: 0.74rem; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 9px; border-radius: 6px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                                        <span>🔒 تشفير 256-bit آمن</span>
                                    </span>
                                    <span id="shareResultPinBadge" style="display: none; font-size: 0.74rem; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 3px 9px; border-radius: 6px; font-weight: 800;">
                                    </span>
                                    <span id="shareResultExpiryBadge" style="font-size: 0.72rem; color: #64748b; font-weight: 700;">
                                    </span>
                                </div>

                                <!-- Share URL Input with Copy Button -->
                                <div>
                                    <label style="font-weight: 800; font-size: 0.8rem; color: #1e293b; display: block; margin-bottom: 4px;">
                                        الرابط المباشر المشفر:
                                    </label>
                                    <div style="display: flex; gap: 6px;">
                                        <input type="text" id="shareResultUrlInput" readonly style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #fff; font-size: 0.8rem; font-family: monospace; color: #0f172a; direction: ltr; text-align: left;" onclick="this.select();">
                                        <button type="button" id="shareModalCopyBtn" onclick="copySharedDirectLink()" style="background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap;">
                                            <span class="ui-icon" style="margin: 0;"><span data-lucide="copy" data-size="14"></span></span>
                                            <span>نسخ الرابط</span>
                                        </button>
                                    </div>
                                </div>

                                <!-- Quick Distribution Actions -->
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                                    <button type="button" onclick="shareViaWhatsApp()" style="background: #25D366; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                                        <span>💬 مشاركة عبر WhatsApp</span>
                                    </button>
                                    <button type="button" onclick="downloadSharedQrPng()" style="background: #ffffff; color: #334155; border: 1.5px solid #cbd5e1; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                                        <span class="ui-icon" style="margin: 0;"><span data-lucide="download" data-size="14"></span></span>
                                        <span>تنزيل رمز QR (صورة)</span>
                                    </button>
                                    <button type="button" onclick="previewSharedAsColleague()" style="background: #f1f5f9; color: #1e40af; border: 1.5px solid #bfdbfe; padding: 8px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                                        <span class="ui-icon" style="margin: 0;"><span data-lucide="external-link" data-size="14"></span></span>
                                        <span>معاينة حية كما يراها الزميل</span>
                                    </button>
                                </div>

                            </div>
                        </div>

                    </div>

                </div>

                <!-- Modal Footer -->
                <div style="padding: 12px 20px; border-top: 1px solid #e2e8f0; background: #ffffff; border-bottom-left-radius: 14px; border-bottom-right-radius: 14px; display: flex; justify-content: flex-end;">
                    <button type="button" onclick="closeShareRecordModal()" style="padding: 8px 20px; border: 1px solid #cbd5e1; background: #f8fafc; color: #475569; border-radius: 8px; font-weight: 700; font-size: 0.84rem; cursor: pointer;">
                        إغلاق
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    /**
     * ====================================================================
     * SHARED RECORD VIEWER ENGINE (معاينة السجل البيداغوجي المشفر للزميل)
     * ====================================================================
     */
    async function checkUrlForSharedRecord() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');

        if (!shareId) return;

        // Open viewer modal directly
        openSharedViewerModal(shareId);
    }

    /**
     * فتح عارض السجل البيداغوجي المشترك
     */
    async function openSharedViewerModal(shareId) {
        ensureSharedViewerModalExists();
        const viewerModal = document.getElementById('sharedRecordViewerModal');
        if (!viewerModal) return;

        viewerModal.style.display = 'flex';
        showViewerLoading(true);

        try {
            await fetchAndRenderSharedRecord(shareId);
        } catch (err) {
            showViewerError(err.message || 'حدث خطأ أثناء تحميل السجل المشترك.');
        }
    }

    async function fetchAndRenderSharedRecord(shareId, pin) {
        const headers = { 'Content-Type': 'application/json' };
        if (pin) headers['x-share-pin'] = pin;

        const res = await fetch(`/api/share/${encodeURIComponent(shareId)}`, { headers });
        const data = await res.json();

        if (res.status === 404 || res.status === 410) {
            showViewerError(data.error || 'هذا الرابط غير موجود أو انتهت صلاحيته.');
            return;
        }

        if (data.requiresPin) {
            showViewerPinPrompt(shareId, data.title, data.error);
            return;
        }

        if (!data.success) {
            showViewerError(data.error || 'تعذر عرض السجل.');
            return;
        }

        renderDecryptedRecordContent(data);
    }

    /**
     * عرض مطالبة إدخال القن السري في واجهة المعاينة
     */
    function showViewerPinPrompt(shareId, title, errorMsg) {
        const container = document.getElementById('sharedViewerContent');
        if (!container) return;

        container.innerHTML = `
            <div style="max-width: 440px; margin: 40px auto; background: #fff; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                    <span data-lucide="lock" data-size="28"></span>
                </div>
                <h3 style="margin: 0 0 6px 0; color: #0f172a; font-size: 1.15rem; font-weight: 800;">السجل البيداغوجي محمي بقن سري</h3>
                <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.82rem;">${escapeHtml(title || 'السجل محمي لحفظ سرية معطيات التلميذ')}</p>
                
                ${errorMsg ? `<div style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; margin-bottom: 14px;">${escapeHtml(errorMsg)}</div>` : ''}

                <form onsubmit="event.preventDefault(); submitViewerPin('${escapeHtml(shareId)}');">
                    <input type="password" id="viewerPinInputField" placeholder="أدخل القن السري هنا" autofocus style="width: 100%; padding: 12px; border-radius: 8px; border: 2px solid #cbd5e1; font-size: 1.1rem; text-align: center; letter-spacing: 4px; font-weight: 800; margin-bottom: 14px; outline: none; box-sizing: border-box;">
                    <button type="submit" class="btn-primary" style="width: 100%; padding: 12px; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 800; font-size: 0.95rem; border: none; cursor: pointer;">
                        فتح ومعاينة السجل 🔓
                    </button>
                </form>
            </div>
        `;
        if (window.renderLucide) window.renderLucide(container);
    }

    window.submitViewerPin = function (shareId) {
        const input = document.getElementById('viewerPinInputField');
        if (!input || !input.value.trim()) return;
        fetchAndRenderSharedRecord(shareId, input.value.trim());
    };

    /**
     * بناء وتنسيق البطاقة البيداغوجية المتكاملة للتلميذ أو التقرير
     */
    function renderDecryptedRecordContent(payload) {
        const container = document.getElementById('sharedViewerContent');
        if (!container) return;

        const isStudent = payload.type === 'student';
        const d = payload.data || {};
        const teacherName = payload.teacherName || 'أستاذ مادة الرياضيات';
        const schoolName = payload.schoolName || 'المؤسسة التعليمية';

        if (isStudent) {
            const std = d.student || {};
            const metrics = d.academicMetrics || {};
            const absences = d.absences || {};
            const risk = d.riskIndex || {};
            const grades = d.grades || {};
            const behavior = d.behavior || {};
            const remediation = d.remediation || {};

            let gradesHtml = '';
            if (d.scope && d.scope.grades) {
                // Table of exams
                gradesHtml = `
                    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="font-weight: 800; color: #1e3a8a; font-size: 0.95rem; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="award" data-size="18" style="color: #2563eb;"></span>
                            <span>نتائج فروض المراقبة المستمرة ومعدل المادة:</span>
                        </div>

                        <!-- KPI summary badges -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 14px;">
                            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
                                <div style="font-size: 0.72rem; color: #1e40af; font-weight: 700;">معدل الأسدوس 1</div>
                                <div style="font-size: 1.3rem; font-weight: 900; color: #1e3a8a;">${metrics.s1Avg !== null && metrics.s1Avg !== undefined ? Number(metrics.s1Avg).toFixed(2) : '--'} / 20</div>
                            </div>
                            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
                                <div style="font-size: 0.72rem; color: #15803d; font-weight: 700;">معدل الأسدوس 2</div>
                                <div style="font-size: 1.3rem; font-weight: 900; color: #166534;">${metrics.s2Avg !== null && metrics.s2Avg !== undefined ? Number(metrics.s2Avg).toFixed(2) : '--'} / 20</div>
                            </div>
                            <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px; text-align: center;">
                                <div style="font-size: 0.72rem; color: #7e22ce; font-weight: 700;">المعدل السنوي التراكمي</div>
                                <div style="font-size: 1.3rem; font-weight: 900; color: #6b21a8;">${metrics.annualAvg !== null && metrics.annualAvg !== undefined ? Number(metrics.annualAvg).toFixed(2) : '--'} / 20</div>
                            </div>
                            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px; text-align: center;">
                                <div style="font-size: 0.72rem; color: #b45309; font-weight: 700;">الرتبة في القسم</div>
                                <div style="font-size: 1.3rem; font-weight: 900; color: #92400e;">${metrics.rankInClass ? `${metrics.rankInClass} من ${metrics.classSize || '--'}` : '--'}</div>
                            </div>
                        </div>

                        ${risk.riskScore ? `
                            <div style="background: ${risk.riskColor === '#dc2626' ? '#fee2e2' : '#ecfdf5'}; border: 1.5px solid ${risk.riskColor}; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="font-size: 1.1rem;">📊</span>
                                    <div>
                                        <div style="font-weight: 800; font-size: 0.86rem; color: ${risk.riskColor};">مؤشر احتمالية التعثر: ${risk.riskScore}% (${escapeHtml(risk.riskLabel || '')})</div>
                                        <div style="font-size: 0.74rem; color: #334155;">${escapeHtml(risk.diagnosticSummary || 'متابعة دورية منتظمة')}</div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            let absencesHtml = '';
            if (d.scope && d.scope.absences && absences) {
                absencesHtml = `
                    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="font-weight: 800; color: #1e3a8a; font-size: 0.95rem; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="clock" data-size="18" style="color: #0284c7;"></span>
                            <span>سجل الغياب والتأخرات والمواظبة:</span>
                        </div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
                            <span style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">إجمالي ساعات الغياب: <b style="color: #0f172a;">${absences.totalHours || 0} س</b></span>
                            <span style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">غياب غير مبرر: <b>${absences.unjustifiedHours || 0} س</b></span>
                            <span style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">غياب مبرر: <b>${absences.justifiedHours || 0} س</b></span>
                            <span style="background: #fff7ed; border: 1px solid #fed7aa; color: #c2410c; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 0.82rem;">التأخرات: <b>${absences.lateCount || 0} مرة</b></span>
                        </div>
                    </div>
                `;
            }

            let remediationHtml = '';
            if (d.scope && d.scope.remediation && remediation) {
                remediationHtml = `
                    <div style="background: #fdf4ff; border: 1.5px solid #f0abfc; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="font-weight: 800; color: #86198f; font-size: 0.95rem; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <span data-lucide="sparkles" data-size="18" style="color: #a21caf;"></span>
                            <span>التوصيات البيداغوجية وخطة المعالجة المقترحة للزميل:</span>
                        </div>
                        <p style="margin: 0 0 10px 0; font-size: 0.84rem; color: #701a75; line-height: 1.6;">${escapeHtml(remediation.notes || '')}</p>
                        ${Array.isArray(remediation.actionItems) ? `
                            <ul style="margin: 0; padding-right: 20px; font-size: 0.82rem; color: #581c87;">
                                ${remediation.actionItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="print-sheet-share" style="max-width: 820px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1.5px solid #cbd5e1; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
                    
                    <!-- Official Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="font-weight: 900; color: #1e3a8a; font-size: 1.1rem;">المملكة المغربية</div>
                            <div style="font-weight: 700; color: #334155; font-size: 0.84rem;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                            <div style="font-weight: 600; color: #64748b; font-size: 0.78rem;">${escapeHtml(schoolName)}</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="display: inline-block; background: #1e3a8a; color: #fff; padding: 4px 14px; border-radius: 20px; font-weight: 800; font-size: 0.88rem; margin-bottom: 4px;">
                                بطاقة ملف الإنجاز والتتبع البيداغوجي 🔒
                            </div>
                            <div style="font-size: 0.76rem; color: #475569; font-weight: 700;">مادة الرياضيات • وثيقة مشتركة بين الأساتذة</div>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 0.78rem; color: #64748b;">الموسم الدراسي: <b>${escapeHtml(d.schoolYear || '2026/2027')}</b></div>
                            <div style="font-size: 0.78rem; color: #64748b;">الأستاذ(ة): <b>${escapeHtml(teacherName)}</b></div>
                        </div>
                    </div>

                    <!-- Student Identification Bar -->
                    <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <div style="font-size: 0.74rem; color: #1d4ed8; font-weight: 700;">الاسم الكامل للتلميذ(ة):</div>
                            <div style="font-size: 1.25rem; font-weight: 900; color: #1e3a8a;">${escapeHtml(std.name || 'التلميذ')}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.74rem; color: #1d4ed8; font-weight: 700;">رقم مسار:</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #0f172a; font-family: monospace;">${escapeHtml(std.massar || std.id || '--')}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.74rem; color: #1d4ed8; font-weight: 700;">القسم المسند:</div>
                            <div style="font-size: 1rem; font-weight: 800; color: #0f172a;">${escapeHtml(std.className || '--')}</div>
                        </div>
                    </div>

                    ${gradesHtml}
                    ${absencesHtml}
                    ${remediationHtml}

                    <!-- Official Footer & Signatures -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1.5px solid #e2e8f0; padding-top: 14px; margin-top: 20px; font-size: 0.78rem; color: #64748b; flex-wrap: wrap; gap: 10px;">
                        <div>حرر بتاريخ: <b>${new Date().toLocaleDateString('ar-MA')}</b></div>
                        <div style="text-align: center; border: 1px dashed #cbd5e1; padding: 6px 16px; border-radius: 6px;">
                            <span>تأشيرة أستاذ مادة الرياضيات: <b>${escapeHtml(teacherName)}</b></span>
                        </div>
                        <div>وثيقة رسمية مشفرة ومصادق عليها إلكترونياً ✔️</div>
                    </div>

                </div>
            `;

        } else {
            // Report Display
            container.innerHTML = `
                <div style="max-width: 820px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1.5px solid #cbd5e1; padding: 24px;">
                    <h2 style="color: #1e3a8a; margin-top: 0;">${escapeHtml(payload.title || 'التقرير البيداغوجي المشترك')}</h2>
                    <p style="color: #64748b;">${escapeHtml(payload.subtitle || '')}</p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0;">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
                    </div>
                </div>
            `;
        }

        if (window.renderLucide) window.renderLucide(container);
    }

    function showViewerLoading(show) {
        const container = document.getElementById('sharedViewerContent');
        if (!container) return;
        if (show) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 2.2rem; margin-bottom: 12px;" class="animate-spin">⏳</div>
                    <div style="font-weight: 800; color: #1e3a8a; font-size: 1.05rem;">جاري تحميل وفك تشفير السجل البيداغوجي...</div>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">التحقق من التوقيع الرقمي وصلاحية الرابط</div>
                </div>
            `;
        }
    }

    function showViewerError(msg) {
        const container = document.getElementById('sharedViewerContent');
        if (!container) return;
        container.innerHTML = `
            <div style="max-width: 480px; margin: 60px auto; background: #fff; border: 2px solid #fecaca; border-radius: 16px; padding: 28px; text-align: center; box-shadow: 0 10px 25px -5px rgba(239,68,68,0.1);">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                    <span data-lucide="alert-triangle" data-size="28"></span>
                </div>
                <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 1.2rem; font-weight: 800;">تعذر فتح السجل المشترك</h3>
                <p style="margin: 0 0 20px 0; color: #475569; font-size: 0.86rem; line-height: 1.5;">${escapeHtml(msg)}</p>
                <button type="button" onclick="closeSharedViewerModal()" class="btn-primary" style="padding: 10px 24px; border-radius: 8px; background: #475569; color: #fff; font-weight: 700; border: none; cursor: pointer;">
                    إغلاق العارض
                </button>
            </div>
        `;
        if (window.renderLucide) window.renderLucide(container);
    }

    function ensureSharedViewerModalExists() {
        if (document.getElementById('sharedRecordViewerModal')) return;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'sharedRecordViewerModal';
        modalDiv.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; z-index: 15000; flex-direction: column; overflow-y: auto;';

        modalDiv.innerHTML = `
            <!-- Viewer Top Navbar -->
            <div style="position: sticky; top: 0; z-index: 100; background: #0f172a; color: #ffffff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.15);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">
                        <span data-lucide="shield-check" data-size="20"></span>
                    </span>
                    <div>
                        <div style="font-weight: 800; font-size: 0.95rem;">عارض السجلات والتقارير المشفرة المشتركة</div>
                        <div style="font-size: 0.72rem; color: #94a3b8;">منظومة التدبير التربوي لمادة الرياضيات • وضع القراءة والمشاركة الرسمية</div>
                    </div>
                </div>

                <div style="display: flex; gap: 8px; align-items: center;">
                    <button type="button" onclick="window.printSharedViewerRecord()" style="background: #2563eb; color: #fff; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <span data-lucide="printer" data-size="14"></span>
                        <span>طباعة السجل (A4)</span>
                    </button>
                    <button type="button" onclick="closeSharedViewerModal()" style="background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer;">
                        إغلاق
                    </button>
                </div>
            </div>

            <!-- Viewer Body Container -->
            <div id="sharedViewerContent" style="padding: 24px 16px; flex: 1;">
            </div>
        `;

        document.body.appendChild(modalDiv);
    }

    window.printSharedViewerRecord = function () {
        const content = document.getElementById('sharedViewerContent');
        if (!content) return;
        if (typeof window.openCustomPrintPreviewModal === 'function') {
            window.openCustomPrintPreviewModal(content.innerHTML, {
                title: 'سجل_البيانات_المشترك_A4',
                orientation: 'portrait',
                subtitle: 'نسخة رسمية من السجل التربوي المشترك (A4 / PDF)'
            });
        } else if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(content.innerHTML, 'سجل البيانات المشترك', 'portrait');
        }
    };

    window.closeSharedViewerModal = function () {
        const modal = document.getElementById('sharedRecordViewerModal');
        if (modal) modal.style.display = 'none';

        // Clean up URL parameter cleanly without reloading
        const url = new URL(window.location);
        url.searchParams.delete('share');
        window.history.replaceState({}, '', url.pathname + url.search);
    };

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Export to global window
    window.openShareRecordModal = openShareRecordModal;
    window.closeShareRecordModal = closeShareRecordModal;
    window.generateEncryptedShare = generateEncryptedShare;
    window.checkUrlForSharedRecord = checkUrlForSharedRecord;

    // Check on startup
    document.addEventListener('DOMContentLoaded', () => {
        checkUrlForSharedRecord();
    });

})(window);
