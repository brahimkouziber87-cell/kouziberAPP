/**
 * voice-search.js
 * منظومة التدبير التربوي - محرك البحث الصوتي الذكي والمساعد الصوتي التفاعلي
 * يدعم التعرف الصوتي على اللغة العربية (اللهجة المغربية والفصحى) مع التوجيه الآلي للأوامر والبحث الشامل
 */

(function () {
    'use strict';

    // التحقق من دعم واجهة Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

    // حالة محرك البحث الصوتي
    const VoiceState = {
        isSupported: !!SpeechRecognition,
        isListening: false,
        recognition: null,
        currentLang: 'ar-MA', // الافتراضي: العربية (المغرب)
        activeTargetInputId: null,
        lastTranscript: '',
        audioCtx: null,
        streamAudioAnimationId: null
    };

    // نغمات صوتية تفاعلية لتأكيد بدء وانتهاء الاستماع
    function playAudioChime(type) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!VoiceState.audioCtx) {
                VoiceState.audioCtx = new AudioCtx();
            }
            const ctx = VoiceState.audioCtx;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            if (type === 'start') {
                // نغمة صاعدة لطيفة عند بدء الاستماع
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now); // A4
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'success') {
                // نغمة نجاح ثلاثية لطيفة
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.setValueAtTime(880, now + 0.1); // A5
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.start(now);
                osc.stop(now + 0.28);
            } else if (type === 'error') {
                // نغمة خطأ منخفضة هادئة
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.linearRampToValueAtTime(190, now + 0.2);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (e) {
            // تجاهل أخطاء تشغيل الصوت الصامتة
        }
    }
    window.playVoiceAudioChime = playAudioChime;

    // تنظيف وتوحيد النصوص العربية للبحث الذكي
    function normalizeArabicText(str) {
        if (!str) return '';
        return str
            .trim()
            .toLowerCase()
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/[ة]/g, 'ه')
            .replace(/[ى]/g, 'ي')
            .replace(/[ًٌٍَُِّْ]/g, '') // إزالة التشكيل
            .replace(/[^\u0600-\u06FFa-zA-Z0-9\s/_-]/g, ' ')
            .replace(/\s+/g, ' ');
    }

    // مطابقة الأوامر الصوتية والتنقل بين أقسام المنظومة
    const VOICE_COMMANDS = [
        {
            keywords: ['لوحة التحكم', 'الرئيسية', 'لوحة القيادة', 'الداشبورد', 'dashboard', 'لوحه التحكم'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('dashboard');
                return 'الانتقال إلى لوحة القيادة التفاعلية';
            }
        },
        {
            keywords: ['الغياب', 'تسجيل الغياب', 'غياب', 'لائحة الغياب', 'ورقة الغياب', 'حصر الغياب'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('absence');
                return 'الانتقال إلى تسجيل وتتبع الغياب';
            }
        },
        {
            keywords: ['النقط', 'نقط', 'المراقبة المستمرة', 'الدرجات', 'الفروض', 'الفرض'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('grades');
                return 'الانتقال إلى دفتر المراقبة المستمرة والنقط';
            }
        },
        {
            keywords: ['الاداء السنوي', 'الأداء السنوي', 'حصيلة السنة', 'مقارنة الدورتين'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('annual');
                return 'الانتقال إلى لوحة الأداء السنوي الشامل';
            }
        },
        {
            keywords: ['تحليل البيانات', 'التحليل الاحصائي', 'تحليل النقط', 'التحليل'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('analysis');
                return 'الانتقال إلى مركز التحليل الإحصائي المعمق';
            }
        },
        {
            keywords: ['دفتر النصوص', 'نصوص', 'الحصص', 'الدرس اليومي', 'تسجيل حصة', 'دفتر نصوص'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('lessonlog');
                return 'الانتقال إلى دفتر النصوص الرقمي';
            }
        },
        {
            keywords: ['جدول الحصص', 'استعمال الزمن', 'الحصص الاسبوعية', 'الجدول'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('timetable');
                return 'الانتقال إلى جدول الحصص الأسبوعي';
            }
        },
        {
            keywords: ['الدعم', 'الدعم والتقوية', 'حصص الدعم', 'المعالجة', 'الدعم التربوي'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('tutoring');
                return 'الانتقال إلى مركز الدعم والتقوية التربوية';
            }
        },
        {
            keywords: ['بنك الاسئلة', 'التمارين', 'بنك التمارين', 'الاسئلة'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('library');
                return 'الانتقال إلى المكتبة الرقمية وبنك التمارين';
            }
        },
        {
            keywords: ['التقارير', 'المبيانات', 'الاحصائيات', 'احصاء النقط', 'تطور المعدلات'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('reports');
                return 'الانتقال إلى التقارير والتحليلات البيانية';
            }
        },
        {
            keywords: ['المكتبة', 'الموارد', 'الدروس', 'الجذاذات', 'المقرر'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('library');
                return 'الانتقال إلى مكتبة الموارد والوثائق الرقمية';
            }
        },
        {
            keywords: ['قوالب الذكاء الاصطناعي', 'ذكاء اصطناعي', 'برومبت', 'prompts', 'توجيهات الذكاء'],
            action: () => {
                if (typeof openPromptTemplatesModal === 'function') openPromptTemplatesModal();
                return 'فتح مكتبة قوالب وتوجيهات الذكاء الاصطناعي';
            }
        },
        {
            keywords: ['الرموز الرياضية', 'الرموز', 'رموز الرياضيات', 'معادلات'],
            action: () => {
                if (typeof openMathSymbolsPaletteModal === 'function') openMathSymbolsPaletteModal();
                return 'فتح لوحة الرموز والصيغ الرياضية الرسمية';
            }
        },
        {
            keywords: ['معاملات مسار', 'معاملات', 'حاسبة مسار', 'معامل'],
            action: () => {
                if (typeof openMassarCoefficientsModal === 'function') openMassarCoefficientsModal();
                return 'فتح دليل وحاسبة معاملات مسار لمادة الرياضيات';
            }
        },
        {
            keywords: ['وثائق pdf', 'طباعة المستندات', 'معاينة pdf', 'الوثائق الرسمية'],
            action: () => {
                if (typeof openUniversalPdfPreviewModal === 'function') openUniversalPdfPreviewModal();
                return 'فتح مركز وثائق ومعاينة مستندات PDF الرسمية';
            }
        },
        {
            keywords: ['التدريس التفاعلي', 'مؤقت الحصة', 'وضع الحصة', 'المؤقت'],
            action: () => {
                if (typeof toggleInteractiveTeachingMode === 'function') toggleInteractiveTeachingMode();
                return 'تفعيل / تبديل وضع التدريس التفاعلي ومؤقت الحصة';
            }
        },
        {
            keywords: ['وضع العرض', 'عرض امام التلاميذ', 'داتا شو', 'شاشة العرض'],
            action: () => {
                if (typeof togglePresentationModeQuick === 'function') togglePresentationModeQuick();
                return 'تبديل وضع العرض أمام التلاميذ (Data Show)';
            }
        },
        {
            keywords: ['دليل البدء', 'دليل الاستخدام', 'المساعدة', 'شرح المنظومة'],
            action: () => {
                if (typeof openOnboardingGuideModal === 'function') openOnboardingGuideModal(true);
                return 'فتح دليل الاستخدام السريع للمنظومة';
            }
        },
        {
            keywords: ['تنبيه الفرض', 'الفروض المقتربة', 'تنبيهات الفروض'],
            action: () => {
                if (typeof openSmartExamAlertModal === 'function') openSmartExamAlertModal();
                return 'فتح نافذة التنبيه الذكي لاقتراب الفروض المحروسة';
            }
        },
        {
            keywords: ['حصة دعم', 'اضافة دعم', 'جدولة دعم', 'دعم استدراكي'],
            action: () => {
                if (typeof openMathRemediationModal === 'function') {
                    openMathRemediationModal();
                    return 'فتح خطة وجدولة حصص الدعم التربوي المندمج';
                } else if (typeof openExtraSupportSessionModal === 'function') {
                    openExtraSupportSessionModal();
                    return 'فتح جدولة حصة دعم استثنائية';
                }
                return null;
            }
        },
        {
            keywords: ['المتعثرين', 'دون 10', 'اقل من 10', 'المتعثرون', 'صعوبات التعلم'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('dashboard');
                if (typeof setDashboardFilter === 'function') setDashboardFilter('category', 'at_risk');
                return 'تصفية التلاميذ المتعثرين (معدل أقل من 10) في لوحة القيادة';
            }
        },
        {
            keywords: ['سلوك غير منضبط', 'سلوك', 'المخالفات', 'الانضباط'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('dashboard');
                if (typeof setDashboardFilter === 'function') setDashboardFilter('category', 'behavior');
                return 'تصفية التلاميذ ذوي السلوك غير المنضبط';
            }
        },
        {
            keywords: ['غياب متكرر', 'كثير الغياب', 'تجاوز عتبة الغياب'],
            action: () => {
                if (typeof switchTab === 'function') switchTab('dashboard');
                if (typeof setDashboardFilter === 'function') setDashboardFilter('category', 'absence');
                return 'تصفية التلاميذ ذوي الغياب المتكرر';
            }
        }
    ];

    // استخراج أسماء التلاميذ والأقسام للبحث الصوتي الدقيق
    function searchStudentsByVoice(query) {
        if (!query) return [];
        const normQ = normalizeArabicText(query);
        const tokens = normQ.split(' ').filter(t => t.length > 1);
        if (tokens.length === 0) return [];

        const results = [];
        const db = window.db || {};
        const classes = (db.classes && Object.keys(db.classes)) || [];

        // إذا كان معرّف وظيفة getDashboardAllStudentsList متوفراً
        let allStudents = [];
        if (typeof window.getDashboardAllStudentsList === 'function') {
            allStudents = window.getDashboardAllStudentsList();
        } else {
            // بناء لائحة شاملة من قاعدة البيانات
            classes.forEach(cls => {
                const stdList = (db.classes && db.classes[cls]) || [];
                const classGrades = (db.grades && db.grades[cls]) || {};
                const classBehaviors = (db.behaviors && db.behaviors[cls]) || {};
                const records = (db.attendance && db.attendance[cls]) || [];

                stdList.forEach(std => {
                    let totalAbsent = 0;
                    records.forEach(r => {
                        if (r.studentId === std.id && (r.status === 'غائب' || r.status === 'مبرر')) {
                            totalAbsent += (r.duration || 1);
                        }
                    });
                    const beh = classBehaviors[std.id] || { status: 'منضبط', note: '' };
                    const stdGrades = classGrades[std.id] || {};
                    const gradeAvg = typeof calculateStudentAvg === 'function' ? calculateStudentAvg(stdGrades, cls) : null;

                    allStudents.push({
                        id: std.id,
                        orderNum: std.orderNum || '',
                        name: std.name || '',
                        massar: std.massar || '',
                        className: cls,
                        totalAbsent,
                        behaviorStatus: beh.status || 'منضبط',
                        behaviorNote: beh.note || '',
                        gradeAvg
                    });
                });
            });
        }

        // مطابقة التلاميذ وحساب درجة الصلة (Score)
        allStudents.forEach(std => {
            const normName = normalizeArabicText(std.name);
            const normMassar = normalizeArabicText(std.massar);
            const normClass = normalizeArabicText(std.className);

            let score = 0;
            // مطابقة تامة
            if (normName.includes(normQ)) score += 50;
            if (normMassar.includes(normQ)) score += 60;

            // مطابقة بالكلمات
            tokens.forEach(tok => {
                if (normName.includes(tok)) score += 20;
                if (normMassar.includes(tok)) score += 25;
                if (normClass.includes(tok)) score += 10;
            });

            if (score > 0) {
                results.push({ student: std, score });
            }
        });

        // ترتيب النتائج حسب الأكثر تطابقاً
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 10).map(r => r.student);
    }

    // مطابقة الأقسام
    function searchClassesByVoice(query) {
        if (!query) return null;
        const normQ = normalizeArabicText(query);
        const db = window.db || {};
        const classes = (db.classes && Object.keys(db.classes)) || [];

        for (const cls of classes) {
            const normCls = normalizeArabicText(cls);
            if (normCls === normQ || normQ.includes(normCls) || normCls.includes(normQ)) {
                return cls;
            }
            // فحص أشكال مثل "3/1" أو "الثالثة 1"
            const numMatches = cls.match(/\d+/g);
            if (numMatches && numMatches.every(num => normQ.includes(num))) {
                return cls;
            }
        }
        return null;
    }

    // معالجة النص الصوتي الملتقط وتنفيذ الأوامر الذكية
    function processVoiceTranscript(rawTranscript, targetInputId = null) {
        const transcript = (rawTranscript || '').trim();
        if (!transcript) return;

        VoiceState.lastTranscript = transcript;

        // إذا كان الاستماع موجهاً لحقل إدخال محدد (Dictation mode)
        if (targetInputId) {
            const input = document.getElementById(targetInputId);
            if (input) {
                input.value = transcript;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                playAudioChime('success');
                showVoiceFeedbackToast(`تمت كتابة: "${transcript}"`);
                return;
            }
        }

        // إزالة الكلمات الزائدة والطلبات التمهيدية
        let cleanQuery = transcript
            .replace(/^(ابحث عن|ابحث لي عن|ابحث في|بحث عن|اريد البحث عن|وريني|اعرض لي|افتح لي|افتح|سير لـ|انتقل الى|انتقل لـ|شكون هو|من هو)/gi, '')
            .trim();

        // 1. فحص الأوامر العامة للمنظومة
        const normTranscript = normalizeArabicText(transcript);
        for (const cmd of VOICE_COMMANDS) {
            const matched = cmd.keywords.some(kw => {
                const normKw = normalizeArabicText(kw);
                return normTranscript.includes(normKw);
            });

            if (matched) {
                const desc = cmd.action();
                playAudioChime('success');
                updateVoiceModalStatus(`تم التعرف على الأمر: ${desc}`, 'success');
                showVoiceFeedbackToast(`🎙️ ${desc}`);
                renderVoiceModalResults([], `تم تنفيذ الأمر: ${desc} بنجاح ✅`);
                return;
            }
        }

        // 2. فحص الأقسام
        const matchedClass = searchClassesByVoice(cleanQuery || transcript);
        if (matchedClass) {
            playAudioChime('success');
            if (typeof switchTab === 'function') switchTab('dashboard');
            if (typeof setDashboardFilter === 'function') setDashboardFilter('class', matchedClass);
            updateVoiceModalStatus(`تم اختيار القسم: ${matchedClass}`, 'success');
            showVoiceFeedbackToast(`🎙️ تم الانتقال إلى قسم: ${matchedClass}`);
            renderVoiceModalResults([], `تم تحديد قسم ${matchedClass} في المنظومة بنجاح.`);
            return;
        }

        // 3. البحث عن التلاميذ
        const students = searchStudentsByVoice(cleanQuery || transcript);
        if (students.length > 0) {
            playAudioChime('success');
            updateVoiceModalStatus(`تم العثور على ${students.length} تلميذ مطابق لـ "${transcript}"`, 'success');
            renderVoiceModalResults(students);
            
            // تحديث البحث السريع في لوحة القيادة أيضاً
            const quickInput = document.getElementById('dashQuickStudentSearchInput');
            if (quickInput) {
                quickInput.value = cleanQuery || transcript;
                if (typeof onDashQuickStudentSearchInput === 'function') {
                    onDashQuickStudentSearchInput(quickInput.value);
                }
            }
            return;
        }

        // لم يتم العثور على نتيجة مباشرة: عرض التنبيه وإتاحة الخيارات
        playAudioChime('error');
        updateVoiceModalStatus(`لم يتم العثور على تلميذ أو أمر مطابق لـ: "${transcript}"`, 'warning');
        renderVoiceModalResults([], `جرب نطق اسم التلميذ بوضوح (مثال: "فاطمة الزهراء")، أو نطق اسم القسم، أو أوامر المنظومة مثل "دفتر النصوص" أو "المتعثرين".`);
    }

    // إشعار عائم خفيف بنتيجة الصوت
    function showVoiceFeedbackToast(msg) {
        let toast = document.getElementById('voiceFeedbackToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'voiceFeedbackToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 86px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: linear-gradient(135deg, #1e293b, #0f172a);
                color: #ffffff;
                padding: 10px 20px;
                border-radius: 9999px;
                font-size: 0.88rem;
                font-weight: 700;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(59, 130, 246, 0.4);
                z-index: 15000;
                display: flex;
                align-items: center;
                gap: 8px;
                opacity: 0;
                pointer-events: none;
                transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                direction: rtl;
                font-family: inherit;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<span style="color: #60a5fa;">🎙️</span> <span>${escapeHtmlText(msg)}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
            }
        }, 3200);
    }

    function escapeHtmlText(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // بدء محرك التعرف على الصوت
    function startListening(targetInputId = null) {
        if (!VoiceState.isSupported) {
            openVoiceSearchModal(targetInputId);
            return;
        }

        if (VoiceState.isListening) {
            stopListening();
            return;
        }

        VoiceState.activeTargetInputId = targetInputId;

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = VoiceState.currentLang || 'ar-MA';
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            recognition.onstart = function () {
                VoiceState.isListening = true;
                playAudioChime('start');
                updateMicVisuals(true);
                updateVoiceModalStatus('جار الاستماع لصوتك الآن... تحدث باللغة العربية 🎙️', 'listening');
                startPulseAnimation();
            };

            recognition.onresult = function (event) {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const currentText = finalTranscript || interimTranscript;
                updateVoiceModalTranscript(currentText, !!finalTranscript);

                if (targetInputId) {
                    const inp = document.getElementById(targetInputId);
                    if (inp && currentText) {
                        inp.value = currentText;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }

                if (finalTranscript) {
                    processVoiceTranscript(finalTranscript, targetInputId);
                }
            };

            recognition.onerror = function (event) {
                VoiceState.isListening = false;
                playAudioChime('error');
                updateMicVisuals(false);
                stopPulseAnimation();

                let errMsg = 'تعذر التقاط الصوت، يرجى المحاولة مرة أخرى.';
                if (event.error === 'not-allowed') {
                    errMsg = 'تم حظر صلاحية الميكروفون في المتصفح. يرجى تفعيل إذن الميكروفون.';
                } else if (event.error === 'no-speech') {
                    errMsg = 'لم يتم رصد صوت. اضغط على الميكروفون وتحدث بصوت مسموع.';
                } else if (event.error === 'network') {
                    errMsg = 'خطأ في الاتصال بخدمة التعرف على الصوت. تحقق من اتصالك بالإنترنت.';
                }

                updateVoiceModalStatus(errMsg, 'error');
            };

            recognition.onend = function () {
                VoiceState.isListening = false;
                updateMicVisuals(false);
                stopPulseAnimation();
            };

            VoiceState.recognition = recognition;
            recognition.start();

        } catch (err) {
            VoiceState.isListening = false;
            updateMicVisuals(false);
            updateVoiceModalStatus('حدث خطأ أثناء تشغيل الميكروفون: ' + err.message, 'error');
        }
    }

    function stopListening() {
        if (VoiceState.recognition && VoiceState.isListening) {
            try {
                VoiceState.recognition.stop();
            } catch (e) {}
        }
        VoiceState.isListening = false;
        updateMicVisuals(false);
        stopPulseAnimation();
    }

    // تحديث المظهر المرئي لأزرار الميكروفون في الصفحة
    function updateMicVisuals(isListening) {
        // الزر العائم
        const floatingBtn = document.getElementById('floatingVoiceSearchBtn');
        if (floatingBtn) {
            if (isListening) {
                floatingBtn.classList.add('voice-btn-active');
            } else {
                floatingBtn.classList.remove('voice-btn-active');
            }
        }

        // الزر في الهيدر
        const headerBtn = document.getElementById('headerVoiceSearchBtn');
        if (headerBtn) {
            const badge = document.getElementById('headerVoiceSearchBadge');
            if (badge) badge.style.display = isListening ? 'inline-block' : 'none';
        }

        // زر النافذة المنبثقة
        const modalMicBtn = document.getElementById('voiceModalMicActionBtn');
        if (modalMicBtn) {
            if (isListening) {
                modalMicBtn.classList.add('modal-mic-pulse');
                modalMicBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            } else {
                modalMicBtn.classList.remove('modal-mic-pulse');
                modalMicBtn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
            }
        }
    }

    // تأثير حركة التموج الصوتي أثناء التسجيل
    function startPulseAnimation() {
        const visualizer = document.getElementById('voiceAudioWaveVisualizer');
        if (visualizer) {
            visualizer.style.display = 'flex';
        }
    }

    function stopPulseAnimation() {
        const visualizer = document.getElementById('voiceAudioWaveVisualizer');
        if (visualizer) {
            visualizer.style.display = 'none';
        }
    }

    function updateVoiceModalStatus(text, type = 'normal') {
        const statusEl = document.getElementById('voiceModalStatusText');
        if (!statusEl) return;
        statusEl.textContent = text;
        
        statusEl.className = 'voice-status-pill';
        if (type === 'listening') {
            statusEl.style.color = '#2563eb';
            statusEl.style.background = '#eff6ff';
            statusEl.style.borderColor = '#bfdbfe';
        } else if (type === 'success') {
            statusEl.style.color = '#15803d';
            statusEl.style.background = '#f0fdf4';
            statusEl.style.borderColor = '#bbf7d0';
        } else if (type === 'warning') {
            statusEl.style.color = '#b45309';
            statusEl.style.background = '#fffbeb';
            statusEl.style.borderColor = '#fde68a';
        } else if (type === 'error') {
            statusEl.style.color = '#b91c1c';
            statusEl.style.background = '#fef2f2';
            statusEl.style.borderColor = '#fecaca';
        } else {
            statusEl.style.color = '#475569';
            statusEl.style.background = '#f8fafc';
            statusEl.style.borderColor = '#e2e8f0';
        }
    }

    function updateVoiceModalTranscript(text, isFinal) {
        const transcriptEl = document.getElementById('voiceModalTranscriptBox');
        if (!transcriptEl) return;
        if (!text) {
            transcriptEl.innerHTML = '<span style="color: #94a3b8; font-style: italic;">سأعرض ما تنطقه هنا مباشرة...</span>';
            return;
        }
        transcriptEl.innerHTML = `
            <div style="font-size: 1.15rem; font-weight: 800; color: #1e293b; line-height: 1.5;">
                "${escapeHtmlText(text)}"
            </div>
            ${isFinal ? '<span style="display: inline-block; font-size: 0.72rem; color: #16a34a; font-weight: 700; margin-top: 4px;">✓ تم التقاط الكلمات بدقة</span>' : '<span style="display: inline-block; font-size: 0.72rem; color: #2563eb; font-weight: 700; margin-top: 4px;">... جار المعالجة</span>'}
        `;
    }

    // عرض بطاقات نتائج التلاميذ المطابقة للبحث الصوتي
    function renderVoiceModalResults(students, customMessage = null) {
        const container = document.getElementById('voiceModalResultsList');
        if (!container) return;

        if (customMessage) {
            container.innerHTML = `
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; color: #475569; font-size: 0.9rem; margin-top: 10px;">
                    ${customMessage}
                </div>
            `;
            return;
        }

        if (!students || students.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = `
            <div style="margin-top: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.85rem; font-weight: 800; color: #334155;">نتائج مطابقة في الأقسام (${students.length}):</span>
                    <span style="font-size: 0.75rem; color: #64748b;">انقر على أي تلميذ للوصول المباشر</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; max-height: 320px; overflow-y: auto; padding-left: 4px;">
        `;

        students.forEach(std => {
            const avgBadge = std.gradeAvg !== null ? `
                <span style="font-weight: 800; padding: 2px 7px; border-radius: 6px; font-size: 0.78rem; background: ${std.gradeAvg >= 10 ? '#dcfce7' : '#fee2e2'}; color: ${std.gradeAvg >= 10 ? '#15803d' : '#b91c1c'}; border: 1px solid ${std.gradeAvg >= 10 ? '#86efac' : '#fca5a5'};">
                    المعدل: ${Number(std.gradeAvg).toFixed(2)}/20
                </span>
            ` : '';

            const absBadge = std.totalAbsent > 0 ? `
                <span style="font-size: 0.74rem; font-weight: 700; color: ${std.totalAbsent >= 3 ? '#b91c1c' : '#b45309'}; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">
                    غياب: ${std.totalAbsent} س
                </span>
            ` : '<span style="font-size: 0.74rem; color: #16a34a;">بدون غياب</span>';

            html += `
                <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.04); transition: transform 0.15s, border-color 0.15s;" onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='none';">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;">
                        <div>
                            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${escapeHtmlText(std.name)}</div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;">
                                <span style="font-size: 0.74rem; background: #eff6ff; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${escapeHtmlText(std.className)}</span>
                                <span style="font-size: 0.72rem; color: #64748b; font-family: monospace;">${escapeHtmlText(std.massar || 'بدون مسار')}</span>
                            </div>
                        </div>
                        <div>${avgBadge}</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                        <div>${absBadge}</div>
                        <div style="display: flex; gap: 4px;">
                            <button type="button" onclick="window.voiceOpenStudentFocus('${escapeHtmlText(std.id)}', '${escapeHtmlText(std.className)}')" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;" title="وضع التركيز الفردي">
                                🎯 وضع التركيز
                            </button>
                            <button type="button" onclick="window.voiceOpenStudentCard('${escapeHtmlText(std.id)}', '${escapeHtmlText(std.className)}')" style="background: #1e293b; color: #fff; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;" title="فتح بطاقة التلميذ">
                                📋 البطاقة
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // التنقل لتلميذ محدد من خلال البحث الصوتي
    window.voiceOpenStudentFocus = function (studentId, className) {
        closeVoiceSearchModal();
        if (typeof switchTab === 'function') switchTab('dashboard');
        if (typeof openStudentFocusMode === 'function') {
            openStudentFocusMode(studentId, className);
        } else if (typeof setDashboardFilter === 'function') {
            setDashboardFilter('class', className);
        }
    };

    window.voiceOpenStudentCard = function (studentId, className) {
        closeVoiceSearchModal();
        if (typeof openStudentPortfolioModal === 'function') {
            openStudentPortfolioModal(studentId, className);
        } else if (typeof openStudentDetailsModal === 'function') {
            openStudentDetailsModal(studentId, className);
        } else if (typeof viewStudentCard === 'function') {
            viewStudentCard(studentId, className);
        } else {
            if (typeof switchTab === 'function') switchTab('dashboard');
            if (typeof setDashboardFilter === 'function') setDashboardFilter('class', className);
        }
    };

    // فتح نافذة البحث الصوتي الشاملة
    window.openVoiceSearchModal = function (targetInputId = null) {
        const modal = document.getElementById('voiceSearchMainModal');
        if (!modal) return;

        VoiceState.activeTargetInputId = targetInputId;
        modal.style.display = 'flex';

        // تحديث رسالة الدعم الفني
        const supportWarning = document.getElementById('voiceBrowserSupportWarning');
        if (supportWarning) {
            supportWarning.style.display = VoiceState.isSupported ? 'none' : 'block';
        }

        // مسح النتائج السابقة
        updateVoiceModalTranscript('', false);
        updateVoiceModalStatus(VoiceState.isSupported ? 'جاهز للاستماع.. اضغط على الميكروفون وتحدث' : 'المتصفح لا يدعم ميزة الميكروفون، يمكنك كتابة أمرك أو الضغط على الاقتراحات أدناه', 'normal');
        renderVoiceModalResults([]);

        // إذا كان المتصفح يدعم، نبدأ الاستماع تلقائياً بعد لحظة قصيرة من الفتح لتجربة استخدام فائقة السلاسة
        if (VoiceState.isSupported) {
            setTimeout(() => {
                if (!VoiceState.isListening) {
                    startListening(targetInputId);
                }
            }, 300);
        }

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }

        // تركيز حقل البحث البديل
        const manualInput = document.getElementById('voiceManualSearchInput');
        if (manualInput) {
            manualInput.value = '';
            setTimeout(() => manualInput.focus(), 350);
        }
    };

    window.closeVoiceSearchModal = function () {
        const modal = document.getElementById('voiceSearchMainModal');
        if (modal) modal.style.display = 'none';
        stopListening();
    };

    window.toggleVoiceSearchListening = function () {
        if (VoiceState.isListening) {
            stopListening();
            updateVoiceModalStatus('تم إيقاف الاستماع. يمكنك الضغط مجدداً للتحدث.', 'normal');
        } else {
            startListening(VoiceState.activeTargetInputId);
        }
    };

    window.setVoiceLanguage = function (langCode) {
        VoiceState.currentLang = langCode;
        if (VoiceState.isListening) {
            stopListening();
            startListening(VoiceState.activeTargetInputId);
        }
        showVoiceFeedbackToast(`تم تغيير لغة الصوت إلى: ${langCode === 'ar-MA' ? 'العربية (المغرب)' : langCode === 'ar-SA' ? 'العربية (الفصحى)' : 'الفرنسية'}`);
    };

    // تجربة أمر من اقتراحات البحث بنقرة واحدة
    window.executeVoiceSuggestion = function (phrase) {
        const transcriptEl = document.getElementById('voiceModalTranscriptBox');
        if (transcriptEl) {
            updateVoiceModalTranscript(phrase, true);
        }
        processVoiceTranscript(phrase, VoiceState.activeTargetInputId);
    };

    // البحث اليدوي الفوري عند الكتابة في النافذة
    window.onVoiceManualSearchInput = function (val) {
        const query = (val || '').trim();
        if (!query) {
            renderVoiceModalResults([]);
            return;
        }
        const students = searchStudentsByVoice(query);
        if (students.length > 0) {
            renderVoiceModalResults(students);
            updateVoiceModalStatus(`مطابقة ${students.length} تلميذ لكلمة "${query}"`, 'success');
        } else {
            renderVoiceModalResults([], `لا يوجد تلميذ مطابق لـ "${query}"`);
        }
    };

    // ربط ميكروفونات الإدخال داخل حقول البحث المختلفة في المنظومة
    function attachVoiceButtonsToSearchInputs() {
        const targetSelectors = [
            '#dashSearchInput',
            '#dashQuickStudentSearchInput',
            '#studentSearchInput',
            '#libSearch',
            '#notesSearchInput',
            '#lessonLogSearchInput'
        ];

        targetSelectors.forEach(selector => {
            const input = document.querySelector(selector);
            if (!input || input.dataset.hasVoiceBtnAttached) return;

            // التحقق من الحاوية المحيطة
            const parent = input.parentElement;
            if (!parent) return;

            // إنشاء زر الميكروفون
            const micBtn = document.createElement('button');
            micBtn.type = 'button';
            micBtn.className = 'input-inline-voice-btn';
            micBtn.title = 'البحث الصوتي (تحدث باللغة العربية)';
            micBtn.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" x2="12" y1="19" y2="22"></line>
                </svg>
            `;

            micBtn.style.cssText = `
                background: #eff6ff;
                color: #2563eb;
                border: 1px solid #bfdbfe;
                border-radius: 7px;
                padding: 4px 6px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
                flex-shrink: 0;
            `;

            micBtn.addEventListener('mouseenter', () => {
                micBtn.style.background = '#2563eb';
                micBtn.style.color = '#ffffff';
                micBtn.style.transform = 'scale(1.08)';
            });

            micBtn.addEventListener('mouseleave', () => {
                micBtn.style.background = '#eff6ff';
                micBtn.style.color = '#2563eb';
                micBtn.style.transform = 'scale(1)';
            });

            micBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.openVoiceSearchModal(input.id);
            });

            // إدراج الزر بجانب حقل الإدخال
            if (parent.style.position === 'relative' || getComputedStyle(parent).position === 'relative') {
                micBtn.style.position = 'absolute';
                micBtn.style.left = '38px';
                micBtn.style.top = '50%';
                micBtn.style.transform = 'translateY(-50%)';
                parent.appendChild(micBtn);
            } else if (parent.classList.contains('search-input-wrapper')) {
                parent.appendChild(micBtn);
            } else {
                input.insertAdjacentElement('afterend', micBtn);
            }

            input.dataset.hasVoiceBtnAttached = 'true';
        });
    }

    // إضافة الزر العائم في زاوية الشاشة للوصول السريع
    function createFloatingVoiceButton() {
        if (document.getElementById('floatingVoiceSearchBtn')) return;

        const btn = document.createElement('button');
        btn.id = 'floatingVoiceSearchBtn';
        btn.type = 'button';
        btn.title = 'البحث الصوتي الذكي (Alt + V أو انقر للتحدث)';
        btn.setAttribute('aria-label', 'البحث الصوتي الذكي');
        btn.innerHTML = `
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" x2="12" y1="19" y2="22"></line>
            </svg>
            <span class="floating-voice-ripple"></span>
        `;

        btn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff;
            border: 2px solid rgba(255, 255, 255, 0.4);
            box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9995;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.1) translateY(-3px)';
            btn.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.55)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1) translateY(0)';
            btn.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.4)';
        });

        btn.addEventListener('click', () => {
            window.openVoiceSearchModal();
        });

        document.body.appendChild(btn);
    }

    // اختصار لوحة المفاتيح Alt+V أو Ctrl+Shift+V
    window.addEventListener('keydown', (e) => {
        if ((e.altKey && (e.key === 'v' || e.key === 'V' || e.key === 'ر')) ||
            (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V'))) {
            e.preventDefault();
            window.openVoiceSearchModal();
        } else if (e.key === 'Escape') {
            const modal = document.getElementById('voiceSearchMainModal');
            if (modal && modal.style.display !== 'none') {
                window.closeVoiceSearchModal();
            }
        }
    });

    // التهيئة التلقائية عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createFloatingVoiceButton();
            setTimeout(attachVoiceButtonsToSearchInputs, 800);
        });
    } else {
        createFloatingVoiceButton();
        setTimeout(attachVoiceButtonsToSearchInputs, 800);
    }

    // إعادة الفحص عند تبديل التبويبات للتأكد من إرفاق الأزرار
    window.addEventListener('tabSwitched', () => {
        setTimeout(attachVoiceButtonsToSearchInputs, 400);
    });

})();
