/**
 * ============================================================================
 * محرك دفتر النصوص وتتبع وتيرة إنجاز المقرر الوزاري (Lesson Log & Curriculum Engine)
 * المسار: /public/core/lesson-log-engine.js
 * ============================================================================
 * يوفر:
 * - حساب مؤشرات التقدم في المقرر الدراسي ومقارنتها بالوتيرة الزمنية الرسمية (computeCurriculumPacingMetrics)
 * - توليد المرجع القانوني والتربوي للحصة في دفتر النصوص (formatLessonLegalReference)
 * - مطابقة الدروس المنجزة في دفتر النصوص مع مفردات التوزيع السنوي الرسمي
 * ============================================================================
 */
(function (window) {
    'use strict';

    function escapeText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * حساب مؤشرات تقدم إنجاز المقرر الدراسي مقارنة بالأسابيع الدراسية الفعلية
     */
    function computeCurriculumPacingMetrics(params) {
        const p = params || {};
        const completedHours = Math.max(0, Number(p.completedHours) || 0);
        const plannedAnnualHours = Math.max(1, Number(p.plannedAnnualHours) || 100);
        const elapsedWeeks = Math.max(0, Number(p.elapsedWeeks) || 0);
        const totalTeachingWeeks = Math.max(1, Number(p.totalTeachingWeeks) || 32);

        const actualCompletionPct = Math.min(100, Number(((completedHours / plannedAnnualHours) * 100).toFixed(1)));
        const expectedCompletionPct = Math.min(100, Number(((elapsedWeeks / totalTeachingWeeks) * 100).toFixed(1)));
        const deltaPct = Number((actualCompletionPct - expectedCompletionPct).toFixed(1));

        let status = 'on_track';
        let label = 'وتيرة عادية ومنتظمة';
        let color = '#065f46';

        if (deltaPct < -12) {
            status = 'delayed';
            label = 'تأخر في إنجاز المقرر (يستوجب تكييفاً أو حصص استدراك)';
            color = '#991b1b';
        } else if (deltaPct < -5) {
            status = 'slightly_behind';
            label = 'تأخر طفيف عن التوزيع السنوي';
            color = '#9a3412';
        } else if (deltaPct > 8) {
            status = 'ahead';
            label = 'تقدم إيجابي على التوزيع السنوي';
            color = '#1e40af';
        }

        return {
            completedHours,
            plannedAnnualHours,
            actualCompletionPct,
            expectedCompletionPct,
            deltaPct,
            status,
            label,
            color
        };
    }

    /**
     * صياغة الترويسة المرجعية الرسمية لحصة في دفتر النصوص الرقمي وفق التوجيهات التربوية
     */
    function formatLessonLegalReference(entry) {
        const e = entry || {};
        const sessionType = String(e.sessionType || e.type || 'درس').trim();
        const axisName = String(e.axis || e.unit || 'المجزوءة المقررة').trim();
        const lessonTitle = String(e.title || e.lesson || e.content || 'حصة بيداغوجية').trim();
        const duration = Number(e.duration || e.hours || 1) || 1;
        const semester = e.semester === 's2' || e.semester === 2 ? 'الأسدس الثاني' : 'الأسدس الأول';

        return `${semester} | ${axisName} — ${lessonTitle} (${sessionType} - ${duration} س)`;
    }

    /**
     * مطابقة قائمة دروس المقرر الرسمي مع الحصص المسجلة في دفتر النصوص لقسم معين
     */
    function matchCurriculumLessonsWithLogs(curriculumLessons, classLogs) {
        const lessons = Array.isArray(curriculumLessons) ? curriculumLessons : [];
        const logs = Array.isArray(classLogs) ? classLogs : [];

        return lessons.map((item, index) => {
            const title = typeof item === 'string' ? item : String(item.title || item.name || '');
            const plannedHours = (typeof item === 'object' && item && Number(item.hours)) ? Number(item.hours) : 4;
            const cleanTitle = title.trim();

            const matchingLogs = logs.filter(log => {
                if (!log) return false;
                const logLesson = String(log.lesson || log.title || log.topic || '').trim();
                const logContent = String(log.content || '').trim();
                return (cleanTitle && (logLesson.includes(cleanTitle) || cleanTitle.includes(logLesson) || logContent.includes(cleanTitle)));
            });

            const loggedHours = matchingLogs.reduce((acc, l) => acc + (Number(l.duration || l.hours || 1) || 1), 0);
            const state = loggedHours >= plannedHours ? 'completed' : (loggedHours > 0 ? 'in_progress' : 'pending');

            return {
                order: index + 1,
                title: cleanTitle,
                plannedHours,
                loggedHours,
                sessionsCount: matchingLogs.length,
                state
            };
        });
    }

    /**
     * جسر التكامل مع تطبيق إنتاج الوثائق التربوية (الفروض، السلاسل، الدروس) الخاص بالأستاذ:
     * يصدر بطاقة تشخيصية مهيكلة للقسم (المسلك بالتأهيلي، الدروس المنجزة، نسبة الاستيفاء، ومواطن التعثر)
     * لتوجيه إنتاج الفروض المحروسة أو سلاسل الدعم في التطبيق الموازي.
     */
    function buildCompanionAppPedagogicalBrief(params) {
        const p = params || {};
        const className = String(p.className || '').trim();
        const streamCfg = (window.GradesCalculator && typeof window.GradesCalculator.getStreamOfficialConfig === 'function')
            ? window.GradesCalculator.getStreamOfficialConfig(className)
            : { code: 'TCS', label: 'التعليم الثانوي التأهيلي', coefficient: 4, examsPerSemester: 3 };

        return {
            protocol: 'PEDAGOGICAL_COMPANION_BRIDGE_V1',
            schemaVersion: '1.0',
            cycle: 'QUALIFYING_SECONDARY_MOROCCO',
            cycleLabel: 'سلك التعليم الثانوي التأهيلي',
            subject: 'الرياضيات',
            className,
            streamCode: streamCfg.code,
            streamLabel: streamCfg.label,
            coefficient: streamCfg.coefficient,
            semester: p.semester === 's2' ? 'الأسدس الثاني' : 'الأسدس الأول',
            completedLessons: Array.isArray(p.completedLessons) ? p.completedLessons : [],
            currentAxis: String(p.currentAxis || ''),
            classMean: Number(p.classMean || 0),
            passRate: Number(p.passRate || 0),
            strugglingCount: Number(p.strugglingCount || 0),
            recommendedDocumentType: Number(p.strugglingCount || 0) >= 5 ? 'سلسلة دعم ومعالجة مركزة' : 'فرض محروس / سلسلة تمارين توليفية',
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * استيراد وتطبيع بطاقة وثيقة تربوية (فرض / سلسلة تمارين / درس) منتجة في التطبيق الموازي
     * لربطها مباشرة بدفتر النصوص أو المكتبة الرقمية أو سجل الفروض
     */
    function normalizeImportedCompanionDocument(rawDoc) {
        const d = (rawDoc && typeof rawDoc === 'object') ? rawDoc : {};
        const rawType = String(d.type || d.docType || 'series').toLowerCase();
        let normalizedType = 'سلسلة تمارين';
        if (/exam|devoir|فرض/.test(rawType)) normalizedType = 'فرض محروس';
        else if (/lesson|cours|درس/.test(rawType)) normalizedType = 'درس بيداغوجي';
        else if (/remed|support|دعم/.test(rawType)) normalizedType = 'سلسلة دعم واستدراك';

        return {
            id: String(d.id || `doc_${Date.now()}`),
            title: String(d.title || d.name || normalizedType).trim(),
            docType: normalizedType,
            cycle: 'سلك التعليم الثانوي التأهيلي',
            levelOrStream: String(d.level || d.stream || 'الثانوي التأهيلي').trim(),
            axis: String(d.axis || d.unit || d.topic || '').trim(),
            semester: d.semester === 's2' || d.semester === 2 ? 's2' : 's1',
            durationHours: Number(d.durationHours || d.duration || (normalizedType === 'فرض محروس' ? 2 : 1)) || 1,
            fileUrl: String(d.fileUrl || d.pdfUrl || d.url || '').trim(),
            importedAt: new Date().toISOString()
        };
    }

    /**
     * استيراد وثيقة منتجة وحفظها فعلياً في دفتر النصوص والخزانة الرقمية للقسم المستهدف
     */
    function importCompanionDocumentIntoClass(rawInput, targetClassName) {
        let parsedObj = {};
        if (typeof rawInput === 'string') {
            const trimmed = rawInput.trim();
            if (trimmed.startsWith('{')) {
                try {
                    parsedObj = JSON.parse(trimmed);
                } catch (e) {
                    parsedObj = { title: trimmed };
                }
            } else {
                parsedObj = { title: trimmed };
            }
        } else if (rawInput && typeof rawInput === 'object') {
            parsedObj = rawInput;
        }

        const docRecord = normalizeImportedCompanionDocument(parsedObj);
        const db = (window.db && typeof window.db === 'object') ? window.db : null;
        const targetClass = targetClassName || (db && db.currentClass) || docRecord.levelOrStream || '2BAC-PC-1';

        if (db) {
            if (!db.lessonLogs || typeof db.lessonLogs !== 'object') db.lessonLogs = {};
            if (!Array.isArray(db.lessonLogs[targetClass])) db.lessonLogs[targetClass] = [];

            const todayIso = new Date().toISOString().slice(0, 10);
            const logEntry = {
                id: docRecord.id,
                date: todayIso,
                className: targetClass,
                type: docRecord.docType,
                lesson: docRecord.title,
                title: docRecord.title,
                axis: docRecord.axis || docRecord.docType,
                duration: docRecord.durationHours,
                semester: docRecord.semester,
                fileUrl: docRecord.fileUrl,
                source: 'PEDAGOGICAL_COMPANION_BRIDGE_V1',
                legalReference: formatLessonLegalReference({
                    date: todayIso,
                    sessionType: docRecord.docType,
                    unitTitle: docRecord.axis || 'الرياضيات - الثانوي التأهيلي',
                    lessonTitle: docRecord.title,
                    durationHours: docRecord.durationHours
                })
            };
            db.lessonLogs[targetClass].unshift(logEntry);

            if (db.classes && db.classes[targetClass] && !Array.isArray(db.classes[targetClass])) {
                if (!Array.isArray(db.classes[targetClass].lessonLog)) {
                    db.classes[targetClass].lessonLog = [];
                }
                db.classes[targetClass].lessonLog.unshift(logEntry);
            }

            if (!Array.isArray(db.customResources)) db.customResources = [];
            db.customResources.unshift({
                id: docRecord.id,
                title: docRecord.title,
                category: docRecord.docType,
                level: targetClass,
                axis: docRecord.axis,
                url: docRecord.fileUrl,
                dateAdded: todayIso,
                source: 'تطبيق إنتاج الوثائق التربوية'
            });

            const persistFn = typeof window.saveDB === 'function'
                ? window.saveDB
                : (typeof window.saveData === 'function' ? window.saveData : null);
            if (persistFn) {
                try { persistFn(); } catch (e) {}
            }
            if (typeof window.renderLessonLogs === 'function') {
                try { window.renderLessonLogs(); } catch (e) {}
            }
            if (window.PedagogicalStore && typeof window.PedagogicalStore.notifyPedagogicalStoreUpdated === 'function') {
                try { window.PedagogicalStore.notifyPedagogicalStoreUpdated('companion-doc-import'); } catch (e) {}
            }
        }

        return docRecord;
    }

    /**
     * نافذة جسر التكامل البيداغوجي مع تطبيق إنتاج الوثائق التربوية (الفروض، السلاسل، الدروس)
     * تتيح للأستاذ تصدير البطاقة التشخيصية للقسم (JSON / نص توجيهي) أو استيراد وثيقة منتجة مباشرة لدفتر النصوص والخزانة الرقمية
     */
    function openCompanionDocumentBridgeModal(selectedClassName) {
        if (typeof document === 'undefined' || !document.body) return null;
        const db = (window.db && typeof window.db === 'object') ? window.db : { classes: {} };
        const classNames = Object.keys(db.classes || {});
        const targetClass = selectedClassName || db.currentClass || classNames[0] || '2BAC-PC-1';

        const clsObj = (db.classes && db.classes[targetClass]) || {};
        const students = Array.isArray(clsObj) ? clsObj : (Array.isArray(clsObj.students) ? clsObj.students : []);
        const sem = db.currentSemester === 's2' ? 's2' : 's1';
        const averages = [];
        students.forEach(st => {
            if (!st) return;
            const g = (st.grades && st.grades[sem]) ? st.grades[sem] : (st.grades || {});
            if (window.GradesCalculator && typeof window.GradesCalculator.calculateStudentSemesterAverage === 'function') {
                const a = window.GradesCalculator.calculateStudentSemesterAverage(g, { includeActivity: true });
                if (a !== null) averages.push(a);
            }
        });
        const stats = (window.GradesCalculator && typeof window.GradesCalculator.calculateClassStatisticalMetrics === 'function')
            ? window.GradesCalculator.calculateClassStatisticalMetrics(averages, 10)
            : { mean: 0, passRate: 0, strugglingCount: 0 };

        const logs = Array.isArray(clsObj.lessonLog)
            ? clsObj.lessonLog
            : (db.lessonLogs && Array.isArray(db.lessonLogs[targetClass]) ? db.lessonLogs[targetClass] : []);
        const completedTitles = logs.map(l => String(l.lesson || l.title || l.topic || '').trim()).filter(Boolean).slice(-8);

        const brief = buildCompanionAppPedagogicalBrief({
            className: targetClass,
            semester: sem,
            completedLessons: completedTitles,
            currentAxis: completedTitles[completedTitles.length - 1] || '',
            classMean: stats.mean,
            passRate: stats.passRate,
            strugglingCount: stats.strugglingCount
        });

        const existing = document.getElementById('companionDocBridgeModalBackdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.id = 'companionDocBridgeModalBackdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(4px);z-index:1000002;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:"Cairo",sans-serif;';

        const briefJson = JSON.stringify(brief, null, 2);
        const classOptionsHtml = (classNames.length > 0 ? classNames : [targetClass])
            .map(c => `<option value="${escapeText(c)}" ${c === targetClass ? 'selected' : ''}>${escapeText(c)}</option>`)
            .join('');

        backdrop.innerHTML = `
            <div style="width:100%;max-width:680px;background:#ffffff;border-radius:16px;border:1.5px solid #cbd5e1;border-top:5px solid #0284c7;box-shadow:0 25px 50px -12px rgba(15,23,42,0.45);overflow:hidden;">
                <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:1.02rem;font-weight:900;color:#0f172a;">🔗 جسر التكامل مع تطبيق إنتاج الوثائق التربوية (الثانوي التأهيلي)</h3>
                        <div style="font-size:0.76rem;font-weight:700;color:#475569;margin-top:2px;">تصدير تشخيص القسم لتطبيق إنتاج الفروض والسلاسل والدروس واستيراد الوثائق المنتجة لدفتر النصوص</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <select id="companionBridgeClassSelect" aria-label="اختر القسم" style="padding:5px 10px;border-radius:8px;border:1.5px solid #cbd5e1;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:800;color:#0f172a;background:#fff;">
                            ${classOptionsHtml}
                        </select>
                        <button type="button" id="btnCloseCompanionBridgeModal" style="background:#e2e8f0;color:#334155;border:none;width:32px;height:32px;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>
                    </div>
                </div>
                <div style="padding:16px 20px;max-height:78vh;overflow-y:auto;">
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.81rem;font-weight:700;color:#0c4a6e;">
                        <div>📌 المسلك الرسمي: <b>${escapeText(brief.streamLabel)}</b> | المعامل: <b>${Number(brief.coefficient) || 0}</b> | الأسدوس: <b>${sem === 's2' ? 'الثاني' : 'الأول'}</b></div>
                        <div style="margin-top:4px;">📊 المعدل الحالي: <b>${brief.classMean.toFixed(2)}/20</b> | نسبة الاستيفاء: <b>${brief.passRate}%</b> | المتعثرون (<10): <b>${brief.strugglingCount}</b></div>
                        <div style="margin-top:4px;">🎯 الوثيقة الموصى بإنتاجها الآن: <b style="color:#0369a1;">${escapeText(brief.recommendedDocumentType)}</b></div>
                    </div>

                    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #cbd5e1;">
                        <label style="display:block;font-size:0.8rem;font-weight:900;color:#1e293b;margin-bottom:6px;">1. تصدير بطاقة التوصيف البيداغوجي للقسم نحو تطبيق إنتاج الوثائق (JSON):</label>
                        <textarea id="companionBridgeExportTextarea" readonly style="width:100%;height:110px;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;font-family:monospace;font-size:0.76rem;direction:ltr;text-align:left;background:#f8fafc;color:#0f172a;box-sizing:border-box;">${escapeText(briefJson)}</textarea>
                        <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:8px;">
                            <button type="button" id="btnDownloadCompanionBriefJson" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:7px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">💾 تنزيل ملف (.json)</button>
                            <button type="button" id="btnCopyCompanionBriefJson" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📋 نسخ بطاقة القسم (JSON)</button>
                        </div>
                    </div>

                    <div>
                        <label style="display:block;font-size:0.8rem;font-weight:900;color:#1e293b;margin-bottom:8px;">2. استيراد وثيقة منتجة (فرض / سلسلة / درس) إلى دفتر النصوص والخزانة الرقمية:</label>
                        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                            <input type="text" id="companionImportTitleInput" placeholder="عنوان الوثيقة أو ألصق JSON هنا..." style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;" />
                            <select id="companionImportTypeSelect" style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;">
                                <option value="series">سلسلة تمارين</option>
                                <option value="exam">فرض محروس</option>
                                <option value="lesson">درس بيداغوجي</option>
                                <option value="remediation">سلسلة دعم واستدراك</option>
                            </select>
                            <input type="text" id="companionImportAxisInput" value="${escapeText(brief.currentAxis || '')}" placeholder="المحور / المجزوءة" style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;" />
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                            <span id="companionImportStatusMsg" style="font-size:0.76rem;font-weight:800;color:#059669;"></span>
                            <button type="button" id="btnImportCompanionDocToLog" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:0.8rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📥 إدراج الوثيقة في دفتر النصوص والخزانة</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        const closeBtn = document.getElementById('btnCloseCompanionBridgeModal');
        if (closeBtn) closeBtn.onclick = () => backdrop.remove();
        backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };

        const classSelect = document.getElementById('companionBridgeClassSelect');
        if (classSelect) {
            classSelect.onchange = () => {
                openCompanionDocumentBridgeModal(classSelect.value);
            };
        }

        const copyBtn = document.getElementById('btnCopyCompanionBriefJson');
        if (copyBtn) {
            copyBtn.onclick = () => {
                if (typeof window.safeCopyTextToClipboard === 'function') {
                    window.safeCopyTextToClipboard(briefJson, '✅ تم نسخ البطاقة التشخيصية للقسم بنجاح لاستخدامها في تطبيق إنتاج الفروض والسلاسل');
                }
            };
        }

        const downloadBtn = document.getElementById('btnDownloadCompanionBriefJson');
        if (downloadBtn) {
            downloadBtn.onclick = () => {
                try {
                    const blob = new Blob([briefJson], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pedagogical-brief-${targetClass}-${sem}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {}
            };
        }

        const importBtn = document.getElementById('btnImportCompanionDocToLog');
        if (importBtn) {
            importBtn.onclick = () => {
                const rawTitleOrJson = (document.getElementById('companionImportTitleInput')?.value || '').trim();
                const docTypeVal = document.getElementById('companionImportTypeSelect')?.value || 'series';
                const axisVal = (document.getElementById('companionImportAxisInput')?.value || '').trim();
                if (!rawTitleOrJson) {
                    const statusEl = document.getElementById('companionImportStatusMsg');
                    if (statusEl) {
                        statusEl.style.color = '#dc2626';
                        statusEl.textContent = '⚠️ يرجى إدخال عنوان الوثيقة أو لصق كود JSON الخاص بها.';
                    }
                    return;
                }
                let payload = rawTitleOrJson;
                if (!rawTitleOrJson.startsWith('{')) {
                    payload = {
                        title: rawTitleOrJson,
                        type: docTypeVal,
                        level: targetClass,
                        axis: axisVal,
                        semester: sem
                    };
                }
                const imported = importCompanionDocumentIntoClass(payload, targetClass);
                const statusEl = document.getElementById('companionImportStatusMsg');
                if (statusEl) {
                    statusEl.style.color = '#059669';
                    statusEl.textContent = `✅ تم إدراج «${imported.title}» (${imported.docType}) في دفتر النصوص والخزانة الرقمية للقسم ${targetClass}.`;
                }
                if (typeof window.notifySafeToast === 'function') {
                    window.notifySafeToast(`✅ تم استيراد «${imported.title}» وإدراجه في دفتر النصوص للقسم ${targetClass}`, 'success');
                }
            };
        }

        return brief;
    }

    const LessonLogEngine = {
        computeCurriculumPacingMetrics,
        formatLessonLegalReference,
        matchCurriculumLessonsWithLogs,
        buildCompanionAppPedagogicalBrief,
        normalizeImportedCompanionDocument,
        importCompanionDocumentIntoClass,
        openCompanionDocumentBridgeModal
    };

    window.LessonLogEngine = LessonLogEngine;
    window.openCompanionDocumentBridgeModal = openCompanionDocumentBridgeModal;
})(typeof window !== 'undefined' ? window : globalThis);
