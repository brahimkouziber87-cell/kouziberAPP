/**
 * ============================================================================
 * محرك تتبع السلوك والانضباط والواجبات المنزلية (Behavior & Homework Engine)
 * المسار: /public/core/behavior-homework-engine.js
 * ============================================================================
 * يوفر:
 * - حساب مؤشر الانضباط والمواظبة الفردي للتلميذ (/20) بناءً على السلوك والغياب والواجبات
 * - تجميع حصيلة السلوك والواجبات المنزلية للقسم وتحديد التلاميذ ذوي الأولوية التربوية
 * ============================================================================
 */
(function (window) {
    'use strict';

    const BEHAVIOR_STATUS_WEIGHTS = {
        'متميز': { bonus: 2, label: 'متميز ومشارك', color: '#7c3aed' },
        'منضبط': { bonus: 0, label: 'منضبط', color: '#16a34a' },
        'تنبيه': { bonus: -2, label: 'تنبيه سلوكي', color: '#d97706' },
        'مشوش': { bonus: -4, label: 'تشويش متكرر', color: '#dc2626' }
    };

    /**
     * حساب نقطة المواظبة والانضباط التقديرية للتلميذ (/20)
     */
    function evaluateStudentDisciplineScore(student, homeworkMissesCount, unjustifiedAbsenceHours) {
        const st = student || {};
        const statusKey = String(st.behaviorStatus || st.behavior || 'منضبط').trim();
        const statusCfg = BEHAVIOR_STATUS_WEIGHTS[statusKey] || BEHAVIOR_STATUS_WEIGHTS['منضبط'];

        const hwMisses = Math.max(0, Number(homeworkMissesCount) || Number(st.homeworkMisses) || 0);
        const unjHours = Math.max(0, Number(unjustifiedAbsenceHours) || Number(st.unjustifiedHours) || 0);

        let score = 20 + statusCfg.bonus - (hwMisses * 1.0) - (unjHours * 0.5);
        score = Math.max(0, Math.min(20, Number(score.toFixed(2))));

        let appreciate = 'انضباط ممتاز';
        if (score < 10) appreciate = 'يحتاج تقويماً سلوكياً ومواكبة أسرية';
        else if (score < 14) appreciate = 'انضباط متوسط يحتاج تتبعاً';
        else if (score < 17) appreciate = 'انضباط حسن';

        return {
            score,
            status: statusKey,
            statusLabel: statusCfg.label,
            color: statusCfg.color,
            homeworkMisses: hwMisses,
            unjustifiedAbsenceHours: unjHours,
            appreciation: appreciate
        };
    }

    /**
     * تجميع إحصائيات السلوك والواجبات لقسم دراسي كامل
     */
    function summarizeClassBehaviorAndHomework(students) {
        const list = Array.isArray(students) ? students : [];
        const counts = {
            total: list.length,
            exemplary: 0,
            disciplined: 0,
            warned: 0,
            disruptive: 0,
            homeworkNeglectCount: 0
        };

        const priorityStudents = [];

        list.forEach(st => {
            if (!st) return;
            const status = String(st.behaviorStatus || st.behavior || 'منضبط').trim();
            const hwMiss = Number(st.homeworkMisses || 0) || 0;
            const unjAbs = Number(st.unjustifiedHours || 0) || 0;

            if (status === 'متميز') counts.exemplary++;
            else if (status === 'تنبيه') counts.warned++;
            else if (status === 'مشوش') counts.disruptive++;
            else counts.disciplined++;

            if (hwMiss >= 2) counts.homeworkNeglectCount++;

            const evalResult = evaluateStudentDisciplineScore(st, hwMiss, unjAbs);
            if (status === 'مشوش' || status === 'تنبيه' || hwMiss >= 3 || evalResult.score < 12) {
                priorityStudents.push({
                    id: st.id || st.massarCode || '',
                    name: st.name || '',
                    status,
                    homeworkMisses: hwMiss,
                    disciplineScore: evalResult.score,
                    appreciation: evalResult.appreciation
                });
            }
        });

        return {
            counts,
            priorityStudents
        };
    }

    let _lastAiGeneratedNoteResult = null;
    let _lastAiSummaryReportResult = null;

    function escapeText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getActiveNotesClassName() {
        const sel = typeof document !== 'undefined' ? document.getElementById('notesClassSelect') : null;
        if (sel && sel.value) return sel.value;
        const db = window.db || {};
        if (db.currentClass) return db.currentClass;
        const keys = Object.keys(db.classes || {});
        return keys[0] || '';
    }

    function computeClassNotesAndGradesContext(className, studentIdFilter) {
        const db = window.db || {};
        const clsRaw = (db.classes && db.classes[className]) || [];
        const students = Array.isArray(clsRaw) ? clsRaw : (Array.isArray(clsRaw.students) ? clsRaw.students : []);
        const sem = (window.activeSemester || db.currentSemester) === 's2' ? 's2' : 's1';

        const streamCfg = (window.GradesCalculator && typeof window.GradesCalculator.getStreamOfficialConfig === 'function')
            ? window.GradesCalculator.getStreamOfficialConfig(className)
            : { label: 'سلك التعليم الثانوي التأهيلي - مادة الرياضيات', coefficient: 4 };

        const averages = [];
        students.forEach(st => {
            if (!st) return;
            const g = (st.grades && st.grades[sem]) ? st.grades[sem] : (st.grades || {});
            if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                const a = window.GradesCalculator.calculateStudentSemesterAverage(g);
                if (a !== null) averages.push(a);
            }
        });

        const stats = (window.GradesCalculator && typeof window.GradesCalculator.calculateClassStatisticalMetrics === 'function')
            ? window.GradesCalculator.calculateClassStatisticalMetrics(averages, 10)
            : { mean: 0, passRate: 0, strugglingCount: 0 };

        const rawNotes = (db.notes && Array.isArray(db.notes[className])) ? db.notes[className] : [];
        const filteredNotes = studentIdFilter
            ? rawNotes.filter(n => n && String(n.studentId || '') === String(studentIdFilter))
            : rawNotes;

        let pedagogicalCount = 0;
        let behavioralCount = 0;
        let administrativeCount = 0;
        let positiveCount = 0;
        let alertsCount = 0;

        filteredNotes.forEach(n => {
            if (!n) return;
            const cat = n.category || 'pedagogical';
            const sent = n.sentiment || 'guidance';
            if (cat === 'behavioral') behavioralCount++;
            else if (cat === 'administrative') administrativeCount++;
            else pedagogicalCount++;

            if (sent === 'positive') positiveCount++;
            else if (sent === 'alert') alertsCount++;
        });

        const selectedStudent = studentIdFilter
            ? students.find(s => s && String(s.id || s.massarCode || '') === String(studentIdFilter))
            : null;

        let studentAvg = null;
        let studentAbsentHours = 0;
        let studentBehavior = 'منضبط';
        if (selectedStudent) {
            const g = (selectedStudent.grades && selectedStudent.grades[sem]) ? selectedStudent.grades[sem] : (selectedStudent.grades || {});
            if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                studentAvg = window.GradesCalculator.calculateStudentSemesterAverage(g);
            }
            studentAbsentHours = Number(selectedStudent.absentHours || selectedStudent.unjustifiedHours || 0) || 0;
            studentBehavior = String(selectedStudent.behaviorStatus || selectedStudent.behavior || 'منضبط');
        }

        return {
            className,
            streamLabel: streamCfg.label,
            semester: sem,
            classMean: stats.mean,
            passRate: stats.passRate,
            strugglingCount: stats.strugglingCount,
            totalNotes: filteredNotes.length,
            pedagogicalCount,
            behavioralCount,
            administrativeCount,
            positiveCount,
            alertsCount,
            sampleNotes: filteredNotes.slice(0, 18).map(n => ({
                text: String(n.text || '').slice(0, 220),
                category: n.category || 'pedagogical',
                sentiment: n.sentiment || 'guidance',
                date: n.date || ''
            })),
            selectedStudent,
            studentName: selectedStudent ? selectedStudent.name : '',
            studentAvg,
            studentAbsentHours,
            studentBehavior
        };
    }

    async function callPedagogicalNotesAiEndpoint(payload) {
        const headers = { 'Content-Type': 'application/json' };
        if (window.PedagogicalStore && typeof window.PedagogicalStore.getClientAuthHeaders === 'function') {
            Object.assign(headers, window.PedagogicalStore.getClientAuthHeaders());
        }
        const res = await fetch('/api/ai/pedagogical-notes-assistant', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    function toggleAiPedagogicalNotesPanel(forceOpen) {
        if (typeof document === 'undefined') return;
        const card = document.getElementById('aiPedagogicalNotesSummaryCard');
        if (!card) return;
        const isCurrentlyHidden = card.style.display === 'none' || !card.style.display;
        const shouldShow = typeof forceOpen === 'boolean' ? forceOpen : isCurrentlyHidden;
        card.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow && typeof card.scrollIntoView === 'function') {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    async function generateOrRefineNoteWithAI() {
        if (typeof document === 'undefined') return null;
        const className = getActiveNotesClassName();
        if (!className) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ يرجى اختيار القسم أولاً لتوليد الملاحظة التربوية بالذكاء الاصطناعي.');
            }
            return null;
        }

        const studentId = document.getElementById('notesStudentSelect')?.value || '';
        const category = document.getElementById('newNoteCategorySelect')?.value || 'auto';
        const sentiment = document.getElementById('newNoteSentimentSelect')?.value || 'auto';
        const draftText = (document.getElementById('newNoteText')?.value || '').trim();

        const ctx = computeClassNotesAndGradesContext(className, studentId);
        const btn = document.getElementById('btnGenerateSingleNoteWithAi');
        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ جاري صياغة الملاحظة بالذكاء الاصطناعي...</span>';
        }

        try {
            const result = await callPedagogicalNotesAiEndpoint({
                mode: 'generate_note',
                className: ctx.className,
                streamLabel: ctx.streamLabel,
                semester: ctx.semester,
                studentName: ctx.studentName || 'عموم تلاميذ القسم',
                average: ctx.studentAvg,
                absentHours: ctx.studentAbsentHours,
                behaviorStatus: ctx.studentBehavior,
                category,
                sentiment,
                draftText
            });

            _lastAiGeneratedNoteResult = result;
            const previewBox = document.getElementById('aiGeneratedSingleNotePreviewBox');
            if (previewBox) {
                previewBox.style.display = 'block';
                const targetDisplay = escapeText(ctx.studentName || className);
                const formalHtml = escapeText(result.formalNote);
                const massarHtml = escapeText(result.conciseMassarNote);
                const recHtml = escapeText(result.actionableRecommendation);
                previewBox.innerHTML = `
                    <div style="background:linear-gradient(135deg,#f5f3ff 0%,#eef2ff 100%);border:1.5px solid #c4b5fd;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
                            <span style="font-size:0.82rem;font-weight:900;color:#4c1d95;">🤖 الصياغات التربوية المقترحة بالذكاء الاصطناعي (${targetDisplay}):</span>
                            <span style="font-size:0.7rem;background:#ddd6fe;color:#5b21b6;padding:2px 8px;border-radius:999px;font-weight:800;">${result.source === 'gemini_ai' ? 'Gemini AI ✨' : 'المحرك البيداغوجي الذكي ⚡'}</span>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;font-size:0.84rem;">
                            <div style="background:#ffffff;border:1px solid #ddd6fe;border-right:4px solid #6d28d9;border-radius:8px;padding:8px 10px;">
                                <div style="font-size:0.73rem;font-weight:800;color:#6d28d9;margin-bottom:3px;">1️⃣ الصياغة التربوية المفصلة (للسجل ومجلس القسم):</div>
                                <div id="aiSingleNoteFormalText" style="color:#1e293b;font-weight:700;line-height:1.55;">${formalHtml}</div>
                                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                                    <button type="button" onclick="window.applyAiGeneratedNoteVariant('formal')" style="background:#6d28d9;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:0.74rem;font-weight:800;cursor:pointer;">✍️ اعتماد في حقل الملاحظة</button>
                                    <button type="button" onclick="window.applyAiGeneratedNoteVariant('combined')" style="background:#4f46e5;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:0.74rem;font-weight:800;cursor:pointer;">➕ اعتماد مع التوصية البيداغوجية</button>
                                </div>
                            </div>
                            <div style="background:#ffffff;border:1px solid #bae6fd;border-right:4px solid #0284c7;border-radius:8px;padding:8px 10px;">
                                <div style="font-size:0.73rem;font-weight:800;color:#0369a1;margin-bottom:3px;">2️⃣ الصياغة الموجزة لمنظومة مسار وبيان النتائج:</div>
                                <div id="aiSingleNoteMassarText" style="color:#0f172a;font-weight:700;">${massarHtml}</div>
                                <div style="margin-top:6px;">
                                    <button type="button" onclick="window.applyAiGeneratedNoteVariant('massar')" style="background:#0284c7;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:0.74rem;font-weight:800;cursor:pointer;">⚡ اعتماد صياغة مسار الموجزة</button>
                                </div>
                            </div>
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-right:4px solid #16a34a;border-radius:8px;padding:7px 10px;font-size:0.79rem;color:#14532d;font-weight:700;">
                                💡 <b>التوجيه والتوصية العملية:</b> ${recHtml}
                            </div>
                        </div>
                    </div>
                `;
            }

            // Automatically populate #newNoteText if it was empty
            const noteInput = document.getElementById('newNoteText');
            if (noteInput && !noteInput.value.trim()) {
                noteInput.value = result.formalNote;
                if (typeof window.onNewNoteCategoryOrTextChange === 'function') {
                    try { window.onNewNoteCategoryOrTextChange(); } catch (e) {}
                }
            }

            return result;
        } catch (err) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ تعذر الاتصال بالخادم لتوليد الملاحظة.');
            }
            return null;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }
    }

    function applyAiGeneratedNoteVariant(variant) {
        if (!_lastAiGeneratedNoteResult || typeof document === 'undefined') return;
        const noteInput = document.getElementById('newNoteText');
        if (!noteInput) return;

        if (variant === 'massar') {
            noteInput.value = _lastAiGeneratedNoteResult.conciseMassarNote || _lastAiGeneratedNoteResult.formalNote;
        } else if (variant === 'combined') {
            noteInput.value = `${_lastAiGeneratedNoteResult.formalNote}\n• التوصية التربوية: ${_lastAiGeneratedNoteResult.actionableRecommendation}`;
        } else {
            noteInput.value = _lastAiGeneratedNoteResult.formalNote;
        }

        const catSel = document.getElementById('newNoteCategorySelect');
        if (catSel && _lastAiGeneratedNoteResult.category) {
            catSel.value = _lastAiGeneratedNoteResult.category;
        }
        const sentSel = document.getElementById('newNoteSentimentSelect');
        if (sentSel && _lastAiGeneratedNoteResult.sentiment) {
            sentSel.value = _lastAiGeneratedNoteResult.sentiment;
        }
        if (typeof window.onNewNoteCategoryOrTextChange === 'function') {
            try { window.onNewNoteCategoryOrTextChange(); } catch (e) {}
        }
        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast('✅ تم إدراج الملاحظة المصاغة بالذكاء الاصطناعي في حقل التدوين.');
        }
    }

    async function summarizeNotesWithAI() {
        if (typeof document === 'undefined') return null;
        const className = getActiveNotesClassName();
        if (!className) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ يرجى اختيار القسم أولاً لتلخيص الملاحظات وصياغة التقرير النوعي.');
            }
            return null;
        }

        toggleAiPedagogicalNotesPanel(true);

        const scopeMode = document.getElementById('aiSummaryScopeSelect')?.value || 'class';
        const focusType = document.getElementById('aiSummaryFocusSelect')?.value || 'comprehensive';
        const selectedStudentId = scopeMode === 'student'
            ? (document.getElementById('notesStudentSelect')?.value || '')
            : '';

        const ctx = computeClassNotesAndGradesContext(className, selectedStudentId);
        const btn = document.getElementById('btnRunAiNotesSummary');
        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ جاري تحليل وتلخيص الملاحظات بالذكاء الاصطناعي...</span>';
        }

        try {
            const result = await callPedagogicalNotesAiEndpoint({
                mode: 'summarize_report',
                focusType,
                className: ctx.className,
                streamLabel: ctx.streamLabel,
                semester: ctx.semester,
                targetStudentName: selectedStudentId ? (ctx.studentName || 'تلميذ محدد') : 'كافة تلاميذ القسم',
                classMean: ctx.classMean,
                passRate: ctx.passRate,
                strugglingCount: ctx.strugglingCount,
                totalNotes: ctx.totalNotes,
                pedagogicalCount: ctx.pedagogicalCount,
                behavioralCount: ctx.behavioralCount,
                administrativeCount: ctx.administrativeCount,
                positiveCount: ctx.positiveCount,
                alertsCount: ctx.alertsCount,
                sampleNotes: ctx.sampleNotes
            });

            _lastAiSummaryReportResult = {
                ...result,
                className: ctx.className,
                streamLabel: ctx.streamLabel,
                semester: ctx.semester
            };

            const container = document.getElementById('aiNotesSummaryResultContainer');
            if (container) {
                const recsHtml = (Array.isArray(result.strategicRecommendations) ? result.strategicRecommendations : [])
                    .map(r => `<li style="margin-bottom:4px;">${escapeText(r)}</li>`)
                    .join('');

                container.style.display = 'block';
                container.innerHTML = `
                    <div style="background:#ffffff;border:1.5px solid #cbd5e1;border-radius:12px;padding:14px 16px;margin-top:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                            <div style="font-size:0.92rem;font-weight:900;color:#0f172a;">📋 التقرير التركيبي النوعي للملاحظات التربوية — القسم: ${escapeText(ctx.className)}</div>
                            <span style="font-size:0.72rem;background:#e0e7ff;color:#4338ca;padding:2px 9px;border-radius:999px;font-weight:800;">إجمالي الملاحظات المحللة: ${Number(ctx.totalNotes) || 0}</span>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-bottom:10px;">
                            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-right:4px solid #4f46e5;border-radius:8px;padding:10px;">
                                <div style="font-size:0.76rem;font-weight:900;color:#4338ca;margin-bottom:4px;">📌 1. الخلاصة التركيبية العامة:</div>
                                <div style="font-size:0.82rem;color:#1e293b;line-height:1.55;font-weight:600;">${escapeText(result.executiveSummary)}</div>
                            </div>
                            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-right:4px solid #16a34a;border-radius:8px;padding:10px;">
                                <div style="font-size:0.76rem;font-weight:900;color:#15803d;margin-bottom:4px;">🎓 2. تشخيص التحصيل والكفايات الرياضية:</div>
                                <div style="font-size:0.82rem;color:#14532d;line-height:1.55;font-weight:600;">${escapeText(result.pedagogicalAxisSynthesis)}</div>
                            </div>
                            <div style="background:#fffbeb;border:1px solid #fde68a;border-right:4px solid #d97706;border-radius:8px;padding:10px;">
                                <div style="font-size:0.76rem;font-weight:900;color:#b45309;margin-bottom:4px;">⚖️ 3. تشخيص المواظبة والانضباط الصفي:</div>
                                <div style="font-size:0.82rem;color:#78350f;line-height:1.55;font-weight:600;">${escapeText(result.behavioralAndAttendanceSynthesis)}</div>
                            </div>
                            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-right:4px solid #0284c7;border-radius:8px;padding:10px;">
                                <div style="font-size:0.76rem;font-weight:900;color:#0369a1;margin-bottom:4px;">🎯 4. التوصيات وخطة التدخل البيداغوجي:</div>
                                <ul style="margin:0;padding-right:18px;font-size:0.81rem;color:#0c4a6e;line-height:1.5;font-weight:700;">${recsHtml}</ul>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding-top:8px;border-top:1px dashed #cbd5e1;">
                            <button type="button" onclick="window.copyAiNotesSummaryReport()" style="background:#0284c7;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;">📋 نسخ التقرير النوعي</button>
                            <button type="button" onclick="window.saveAiSummaryAsPinnedClassNote()" style="background:#059669;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;">📌 حفظ كتقرير عام مثبت في السجل</button>
                            <button type="button" onclick="window.printAiNotesQualitativeSummaryReport()" style="background:#1e293b;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;">🖨️ طباعة التقرير النوعي (A4)</button>
                        </div>
                    </div>
                `;
            }

            return result;
        } catch (err) {
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast('⚠️ تعذر تلخيص الملاحظات حالياً.');
            }
            return null;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        }
    }

    function copyAiNotesSummaryReport() {
        if (!_lastAiSummaryReportResult) return;
        const text = _lastAiSummaryReportResult.readyToPrintReportText || _lastAiSummaryReportResult.executiveSummary || '';
        if (typeof window.safeCopyTextToClipboard === 'function') {
            window.safeCopyTextToClipboard(text, '✅ تم نسخ التقرير التربوي النوعي للحافظة بنجاح.');
        }
    }

    function saveAiSummaryAsPinnedClassNote() {
        if (!_lastAiSummaryReportResult) return;
        const db = window.db;
        const className = _lastAiSummaryReportResult.className || getActiveNotesClassName();
        if (!db || !className) return;

        if (!db.notes) db.notes = {};
        if (!Array.isArray(db.notes[className])) db.notes[className] = [];

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        db.notes[className].unshift({
            id: 'ai_rep_' + Date.now(),
            date: dateStr,
            text: _lastAiSummaryReportResult.readyToPrintReportText || _lastAiSummaryReportResult.executiveSummary,
            studentId: '',
            category: 'pedagogical',
            sentiment: 'guidance',
            pinned: true,
            isAiSummaryReport: true
        });

        const persistFn = typeof window.saveDB === 'function'
            ? window.saveDB
            : (typeof window.saveData === 'function' ? window.saveData : null);
        if (persistFn) {
            try { persistFn(); } catch (e) {}
        }
        if (typeof window.renderNotes === 'function') {
            try { window.renderNotes(); } catch (e) {}
        }
        if (typeof window.notifySafeToast === 'function') {
            window.notifySafeToast(`📌 تم حفظ التقرير التركيبي النوعي كملاحظة عامة مثبتة للقسم ${className}.`);
        }
    }

    function printAiNotesQualitativeSummaryReport() {
        if (!_lastAiSummaryReportResult) return;
        const r = _lastAiSummaryReportResult;
        const recsHtml = (Array.isArray(r.strategicRecommendations) ? r.strategicRecommendations : [])
            .map(item => `<li style="margin-bottom:6px;">${escapeText(item)}</li>`)
            .join('');

        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>التقرير التركيبي النوعي للملاحظات التربوية - ${escapeText(r.className || '')}</title>
<style>
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 24px; direction: rtl; color: #0f172a; line-height: 1.65; }
  .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
  .section { border: 1px solid #cbd5e1; border-right: 4px solid #1e3a8a; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; background: #f8fafc; }
  .section h4 { margin: 0 0 6px 0; color: #1e3a8a; font-size: 15px; }
  @media print { body { padding: 0; } @page { size: A4 portrait; margin: 14mm; } }
</style>
</head>
<body>
  <div class="header">
    <h2 style="margin:0;">المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل</h2>
    <h3 style="margin:6px 0;">التقرير التركيبي النوعي للملاحظات والتوجيهات التربوية (مادة الرياضيات — الثانوي التأهيلي)</h3>
    <div>القسم: <b>${escapeText(r.className || '')}</b> | المسلك: <b>${escapeText(r.streamLabel || '')}</b> | تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-MA')}</div>
  </div>
  <div class="section">
    <h4>1. الخلاصة التركيبية العامة</h4>
    <div>${escapeText(r.executiveSummary || '')}</div>
  </div>
  <div class="section">
    <h4>2. تشخيص محور التحصيل الدراسي والكفايات الرياضية</h4>
    <div>${escapeText(r.pedagogicalAxisSynthesis || '')}</div>
  </div>
  <div class="section">
    <h4>3. تشخيص محور المواظبة والانضباط الصفي</h4>
    <div>${escapeText(r.behavioralAndAttendanceSynthesis || '')}</div>
  </div>
  <div class="section">
    <h4>4. التوصيات الاستراتيجية وخطة التدخل البيداغوجي</h4>
    <ul>${recsHtml}</ul>
  </div>
  <div style="margin-top:32px;display:flex;justify-content:space-between;font-weight:bold;">
    <span>توقيع أستاذ(ة) المادة:</span>
    <span>تأشيرة السيد(ة) مدير(ة) المؤسسة / المفتش(ة) التربوي(ة):</span>
  </div>
</body>
</html>`;

        if (typeof window.printHtmlViaHiddenIframe === 'function') {
            window.printHtmlViaHiddenIframe(html);
        }
    }

    const BehaviorHomeworkEngine = {
        BEHAVIOR_STATUS_WEIGHTS,
        evaluateStudentDisciplineScore,
        summarizeClassBehaviorAndHomework,
        computeClassNotesAndGradesContext,
        toggleAiPedagogicalNotesPanel,
        generateOrRefineNoteWithAI,
        applyAiGeneratedNoteVariant,
        summarizeNotesWithAI,
        copyAiNotesSummaryReport,
        saveAiSummaryAsPinnedClassNote,
        printAiNotesQualitativeSummaryReport
    };

    window.BehaviorHomeworkEngine = BehaviorHomeworkEngine;
    window.toggleAiPedagogicalNotesPanel = toggleAiPedagogicalNotesPanel;
    window.generateOrRefineNoteWithAI = generateOrRefineNoteWithAI;
    window.applyAiGeneratedNoteVariant = applyAiGeneratedNoteVariant;
    window.summarizeNotesWithAI = summarizeNotesWithAI;
    window.copyAiNotesSummaryReport = copyAiNotesSummaryReport;
    window.saveAiSummaryAsPinnedClassNote = saveAiSummaryAsPinnedClassNote;
    window.printAiNotesQualitativeSummaryReport = printAiNotesQualitativeSummaryReport;
})(typeof window !== 'undefined' ? window : globalThis);
