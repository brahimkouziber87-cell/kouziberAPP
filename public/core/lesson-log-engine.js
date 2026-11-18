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
    function normalizeImportedCompanionDocument(rawDoc, batchIndex) {
        const d = (rawDoc && typeof rawDoc === 'object') ? rawDoc : {};
        const rawType = String(d.type || d.docType || d.category || d.kind || 'series').toLowerCase();
        let normalizedType = 'سلسلة تمارين';
        if (/exam|devoir|control|ctrl|فرض/.test(rawType)) normalizedType = 'فرض محروس';
        else if (/lesson|cours|chapitre|درس/.test(rawType)) normalizedType = 'درس بيداغوجي';
        else if (/remed|support|soutien|دعم|استدراك/.test(rawType)) normalizedType = 'سلسلة دعم واستدراك';

        const suffix = typeof batchIndex === 'number' ? `_${batchIndex}` : '';
        const rawTitle = d.title || d.name || d.documentTitle || d.label || normalizedType;
        const rawAxis = d.axis || d.unit || d.topic || d.chapter || d.module || '';
        const rawDuration = Number(d.durationHours || d.duration || d.hours || (normalizedType === 'فرض محروس' ? 2 : 1)) || 1;

        return {
            id: String(d.id || `doc_${Date.now()}${suffix}_${Math.floor(Math.random() * 1000)}`),
            title: String(rawTitle).trim(),
            docType: normalizedType,
            cycle: 'سلك التعليم الثانوي التأهيلي',
            levelOrStream: String(d.level || d.stream || d.className || d.streamCode || 'الثانوي التأهيلي').trim(),
            axis: String(rawAxis).trim(),
            semester: d.semester === 's2' || d.semester === 2 || d.semester === 'الأسدس الثاني' ? 's2' : 's1',
            durationHours: Math.max(0.5, Math.min(20, rawDuration)),
            fileUrl: String(d.fileUrl || d.pdfUrl || d.url || d.link || '').trim(),
            notes: String(d.notes || d.description || d.summary || d.objectivesText || '').trim(),
            exercisesCount: Number(d.exercisesCount || (Array.isArray(d.exercises) ? d.exercises.length : 0)) || 0,
            importedAt: new Date().toISOString()
        };
    }

    /**
     * تحليل والتحقق من محتوى ملف JSON مستورد من تطبيق إنتاج الوثائق التربوية
     * يدعم: وثيقة مفردة، مصفوفة وثائق، أو حزمة مهيكلة { documents / items / exports / data }
     */
    function parseCompanionJsonText(jsonText) {
        const raw = typeof jsonText === 'string' ? jsonText.trim() : '';
        if (!raw) {
            return { ok: false, error: '⚠️ الملف فارغ أو لا يحتوي على بيانات JSON صالحة.' };
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (err) {
            return { ok: false, error: '⚠️ صيغة ملف JSON غير صالحة؛ يرجى التأكد من سلامة الملف المصدر.' };
        }

        let candidates = [];
        let bundleClassName = '';
        let bundleSemester = '';

        if (Array.isArray(parsed)) {
            candidates = parsed;
        } else if (parsed && typeof parsed === 'object') {
            bundleClassName = String(parsed.className || parsed.targetClass || parsed.level || '').trim();
            bundleSemester = parsed.semester === 's2' || parsed.semester === 2 ? 's2' : (parsed.semester ? 's1' : '');

            if (Array.isArray(parsed.documents)) candidates = parsed.documents;
            else if (Array.isArray(parsed.items)) candidates = parsed.items;
            else if (Array.isArray(parsed.exports)) candidates = parsed.exports;
            else if (Array.isArray(parsed.files)) candidates = parsed.files;
            else if (Array.isArray(parsed.data)) candidates = parsed.data;
            else if (parsed.document && typeof parsed.document === 'object') candidates = [parsed.document];
            else if (parsed.title || parsed.name || parsed.documentTitle || parsed.docType || parsed.type) {
                candidates = [parsed];
            } else if (parsed.protocol === 'PEDAGOGICAL_COMPANION_BRIDGE_V1' && parsed.recommendedDocumentType) {
                return {
                    ok: false,
                    error: 'ℹ️ هذا الملف عبارة عن «بطاقة تشخيصية مصدرة» نحو تطبيق إنتاج الوثائق ولا يتضمن وثائق منتجة للاستيراد.'
                };
            }
        }

        const validItems = candidates.filter(item => item && typeof item === 'object' && (item.title || item.name || item.documentTitle || item.label || item.docType || item.type));
        if (validItems.length === 0) {
            return {
                ok: false,
                error: '⚠️ لم يتم العثور على أي وثيقة تربوية صالحة (عنوان أو نوع وثيقة) داخل ملف JSON.'
            };
        }

        const enrichedItems = validItems.map(item => ({
            ...item,
            level: item.level || item.stream || item.className || bundleClassName || '',
            semester: item.semester || bundleSemester || ''
        }));

        return {
            ok: true,
            documents: enrichedItems,
            bundleClassName,
            protocol: (parsed && typeof parsed === 'object' && parsed.protocol) ? String(parsed.protocol) : 'PEDAGOGICAL_COMPANION_BRIDGE_V1'
        };
    }

    /**
     * استيراد وثيقة منتجة وحفظها فعلياً في دفتر النصوص والخزانة الرقمية للقسم المستهدف
     */
    function importCompanionDocumentIntoClass(rawInput, targetClassName, options) {
        const opts = options || {};
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

        const docRecord = normalizeImportedCompanionDocument(parsedObj, opts.batchIndex);
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
                notes: docRecord.notes,
                exercisesCount: docRecord.exercisesCount,
                source: 'PEDAGOGICAL_COMPANION_BRIDGE_V1',
                legalReference: formatLessonLegalReference({
                    date: todayIso,
                    sessionType: docRecord.docType,
                    axis: docRecord.axis || 'الرياضيات - الثانوي التأهيلي',
                    title: docRecord.title,
                    duration: docRecord.durationHours,
                    semester: docRecord.semester
                })
            };

            const existingLogIdx = db.lessonLogs[targetClass].findIndex(l => l && l.id === docRecord.id);
            if (existingLogIdx >= 0) {
                db.lessonLogs[targetClass][existingLogIdx] = logEntry;
            } else {
                db.lessonLogs[targetClass].unshift(logEntry);
            }

            if (db.classes && db.classes[targetClass] && !Array.isArray(db.classes[targetClass])) {
                if (!Array.isArray(db.classes[targetClass].lessonLog)) {
                    db.classes[targetClass].lessonLog = [];
                }
                const clsLogIdx = db.classes[targetClass].lessonLog.findIndex(l => l && l.id === docRecord.id);
                if (clsLogIdx >= 0) {
                    db.classes[targetClass].lessonLog[clsLogIdx] = logEntry;
                } else {
                    db.classes[targetClass].lessonLog.unshift(logEntry);
                }
            }

            if (!Array.isArray(db.customResources)) db.customResources = [];
            const resEntry = {
                id: docRecord.id,
                title: docRecord.title,
                category: docRecord.docType,
                level: targetClass,
                axis: docRecord.axis,
                url: docRecord.fileUrl,
                notes: docRecord.notes,
                dateAdded: todayIso,
                source: 'تطبيق إنتاج الوثائق التربوية'
            };
            const existingResIdx = db.customResources.findIndex(r => r && r.id === docRecord.id);
            if (existingResIdx >= 0) {
                db.customResources[existingResIdx] = resEntry;
            } else {
                db.customResources.unshift(resEntry);
            }

            if (!opts.deferPersistence) {
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
        }

        return docRecord;
    }

    /**
     * استيراد نص ملف JSON (وثيقة مفردة أو حزمة وثائق) دفعة واحدة إلى القسم المحدد
     */
    function importCompanionJsonFileContent(jsonText, targetClassName) {
        const parsed = parseCompanionJsonText(jsonText);
        if (!parsed.ok) {
            return parsed;
        }

        const db = (window.db && typeof window.db === 'object') ? window.db : null;
        const resolvedClass = targetClassName
            || (parsed.bundleClassName && db && db.classes && db.classes[parsed.bundleClassName] ? parsed.bundleClassName : '')
            || (db && db.currentClass)
            || parsed.bundleClassName
            || '2BAC-PC-1';

        const importedDocs = parsed.documents.map((docObj, idx) =>
            importCompanionDocumentIntoClass(docObj, resolvedClass, {
                deferPersistence: true,
                batchIndex: idx
            })
        );

        if (db) {
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
                try { window.PedagogicalStore.notifyPedagogicalStoreUpdated('companion-doc-json-import'); } catch (e) {}
            }
        }

        return {
            ok: true,
            count: importedDocs.length,
            targetClass: resolvedClass,
            documents: importedDocs
        };
    }

    /**
     * قراءة ملف .json محدد أو مسحوب (File / Blob) واستيراد محتواه عبر الجسر التربوي
     */
    async function readAndImportCompanionJsonFile(file, targetClassName) {
        if (!file) {
            return { ok: false, error: '⚠️ لم يتم اختيار أي ملف JSON.' };
        }
        try {
            let text = '';
            if (typeof file.text === 'function') {
                text = await file.text();
            } else if (typeof FileReader !== 'undefined') {
                text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
                    reader.readAsText(file, 'utf-8');
                });
            }
            return importCompanionJsonFileContent(text, targetClassName);
        } catch (err) {
            return { ok: false, error: '⚠️ تعذر قراءة ملف JSON المحدد.' };
        }
    }

    /**
     * نافذة جسر التكامل البيداغوجي مع تطبيق إنتاج الوثائق التربوية (الفروض، السلاسل، الدروس)
     * تتيح للأستاذ تصدير البطاقة التشخيصية للقسم (JSON) واستيراد ملف .json أو إدخال وثيقة مباشرة لدفتر النصوص والخزانة الرقمية
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
            <div style="width:100%;max-width:720px;background:#ffffff;border-radius:16px;border:1.5px solid #cbd5e1;border-top:5px solid #0284c7;box-shadow:0 25px 50px -12px rgba(15,23,42,0.45);overflow:hidden;">
                <div style="padding:14px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                    <div>
                        <h3 style="margin:0;font-size:1.02rem;font-weight:900;color:#0f172a;">🔗 جسر التكامل مع تطبيق إنتاج الوثائق التربوية (الثانوي التأهيلي)</h3>
                        <div style="font-size:0.76rem;font-weight:700;color:#475569;margin-top:2px;">تصدير تشخيص القسم لتطبيق إنتاج الفروض والسلاسل والدروس واستيراد ملفات (.json) والوثائق المنتجة لدفتر النصوص</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <select id="companionBridgeClassSelect" aria-label="اختر القسم" style="padding:5px 10px;border-radius:8px;border:1.5px solid #cbd5e1;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:800;color:#0f172a;background:#fff;">
                            ${classOptionsHtml}
                        </select>
                        <button type="button" id="btnCloseCompanionBridgeModal" style="background:#e2e8f0;color:#334155;border:none;width:32px;height:32px;border-radius:8px;font-weight:900;cursor:pointer;">✕</button>
                    </div>
                </div>
                <div style="padding:16px 20px;max-height:80vh;overflow-y:auto;">
                    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.81rem;font-weight:700;color:#0c4a6e;">
                        <div>📌 المسلك الرسمي: <b>${escapeText(brief.streamLabel)}</b> | المعامل: <b>${Number(brief.coefficient) || 0}</b> | الأسدوس: <b>${sem === 's2' ? 'الثاني' : 'الأول'}</b></div>
                        <div style="margin-top:4px;">📊 المعدل الحالي: <b>${brief.classMean.toFixed(2)}/20</b> | نسبة الاستيفاء: <b>${brief.passRate}%</b> | المتعثرون (<10): <b>${brief.strugglingCount}</b></div>
                        <div style="margin-top:4px;">🎯 الوثيقة الموصى بإنتاجها الآن: <b style="color:#0369a1;">${escapeText(brief.recommendedDocumentType)}</b></div>
                    </div>

                    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dashed #cbd5e1;">
                        <label style="display:block;font-size:0.8rem;font-weight:900;color:#1e293b;margin-bottom:6px;">1. تصدير بطاقة التوصيف البيداغوجي للقسم نحو تطبيق إنتاج الوثائق (JSON):</label>
                        <textarea id="companionBridgeExportTextarea" readonly style="width:100%;height:105px;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;font-family:monospace;font-size:0.76rem;direction:ltr;text-align:left;background:#f8fafc;color:#0f172a;box-sizing:border-box;">${escapeText(briefJson)}</textarea>
                        <div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:8px;">
                            <button type="button" id="btnDownloadCompanionBriefJson" style="background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:7px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">💾 تنزيل ملف (.json)</button>
                            <button type="button" id="btnCopyCompanionBriefJson" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:7px 16px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📋 نسخ بطاقة القسم (JSON)</button>
                        </div>
                    </div>

                    <div>
                        <label style="display:block;font-size:0.8rem;font-weight:900;color:#1e293b;margin-bottom:8px;">2. استيراد ملف (.json) أو وثيقة منتجة (فرض / سلسلة / درس) إلى دفتر النصوص والخزانة الرقمية:</label>

                        <div id="companionImportJsonDropzone" style="border:2px dashed #38bdf8;background:#f0f9ff;border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;transition:all 0.2s;">
                            <div style="font-size:0.79rem;font-weight:800;color:#0c4a6e;">
                                <div>📂 استيراد مباشر من ملف <b>.json</b> مصدر من تطبيق إنتاج الوثائق التربوية</div>
                                <div style="font-size:0.72rem;font-weight:700;color:#0369a1;margin-top:2px;">يدعم وثيقة مفردة أو حزمة وثائق متعددة (فروض، سلاسل، دروس) — اسحب الملف هنا أو اختره من جهازك</div>
                            </div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <input type="file" id="companionImportJsonFileInput" accept=".json,application/json" style="display:none;" />
                                <button type="button" id="btnSelectCompanionJsonFile" style="background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📁 استيراد ملف .json</button>
                            </div>
                        </div>
                        <div id="companionJsonFilePreview" style="display:none;margin-bottom:10px;"></div>

                        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;">
                            <input type="text" id="companionImportTitleInput" placeholder="أو أدخل عنوان الوثيقة / الصق كود JSON هنا..." style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;" />
                            <select id="companionImportTypeSelect" style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;">
                                <option value="series">سلسلة تمارين</option>
                                <option value="exam">فرض محروس</option>
                                <option value="lesson">درس بيداغوجي</option>
                                <option value="remediation">سلسلة دعم واستدراك</option>
                            </select>
                            <input type="text" id="companionImportAxisInput" value="${escapeText(brief.currentAxis || '')}" placeholder="المحور / المجزوءة" style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:700;" />
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
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

        function renderImportOutcomeUi(outcome, sourceLabel) {
            const statusEl = document.getElementById('companionImportStatusMsg');
            const previewEl = document.getElementById('companionJsonFilePreview');
            if (!outcome || !outcome.ok) {
                const errMsg = (outcome && outcome.error) || '⚠️ تعذر استيراد ملف JSON.';
                if (statusEl) {
                    statusEl.style.color = '#dc2626';
                    statusEl.textContent = errMsg;
                }
                if (previewEl) {
                    previewEl.style.display = 'block';
                    previewEl.innerHTML = `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:8px 12px;font-size:0.78rem;font-weight:800;">${escapeText(errMsg)}</div>`;
                }
                if (typeof window.notifySafeToast === 'function') {
                    window.notifySafeToast(errMsg, 'error');
                }
                return;
            }

            const docs = outcome.documents || [];
            const firstTitle = docs[0] ? docs[0].title : '';
            const summaryText = docs.length === 1
                ? `✅ تم استيراد «${firstTitle}» (${docs[0].docType}) بنجاح في دفتر النصوص والخزانة للقسم ${outcome.targetClass}.`
                : `✅ تم استيراد ${docs.length} وثائق تربوية من ${sourceLabel || 'ملف JSON'} وإدراجها في دفتر النصوص والخزانة للقسم ${outcome.targetClass}.`;

            if (statusEl) {
                statusEl.style.color = '#059669';
                statusEl.textContent = summaryText;
            }
            if (previewEl) {
                const itemsHtml = docs.slice(0, 6).map(d =>
                    `<li style="margin-bottom:3px;"><b>${escapeText(d.title)}</b> — <span style="color:#0369a1;">${escapeText(d.docType)}</span>${d.axis ? ` (${escapeText(d.axis)})` : ''}</li>`
                ).join('');
                const moreHtml = docs.length > 6 ? `<div style="font-size:0.72rem;color:#047857;">... و ${docs.length - 6} وثائق إضافية</div>` : '';
                previewEl.style.display = 'block';
                previewEl.innerHTML = `
                    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-right:4px solid #059669;border-radius:8px;padding:9px 12px;font-size:0.77rem;color:#065f46;">
                        <div style="font-weight:900;margin-bottom:4px;">📄 الوثائق المدرجة${sourceLabel ? ` من «${escapeText(sourceLabel)}»` : ''}:</div>
                        <ul style="margin:0;padding-right:18px;font-weight:700;">${itemsHtml}</ul>
                        ${moreHtml}
                    </div>
                `;
            }
            if (typeof window.notifySafeToast === 'function') {
                window.notifySafeToast(summaryText, 'success');
            }
        }

        const fileInput = document.getElementById('companionImportJsonFileInput');
        const selectFileBtn = document.getElementById('btnSelectCompanionJsonFile');
        const dropzone = document.getElementById('companionImportJsonDropzone');

        if (selectFileBtn && fileInput) {
            selectFileBtn.onclick = () => fileInput.click();
        }
        if (fileInput) {
            fileInput.onchange = async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const activeClass = (document.getElementById('companionBridgeClassSelect')?.value) || targetClass;
                const outcome = await readAndImportCompanionJsonFile(file, activeClass);
                renderImportOutcomeUi(outcome, file.name);
                fileInput.value = '';
            };
        }
        if (dropzone) {
            dropzone.ondragover = (e) => {
                e.preventDefault();
                dropzone.style.background = '#e0f2fe';
                dropzone.style.borderColor = '#0284c7';
            };
            dropzone.ondragleave = () => {
                dropzone.style.background = '#f0f9ff';
                dropzone.style.borderColor = '#38bdf8';
            };
            dropzone.ondrop = async (e) => {
                e.preventDefault();
                dropzone.style.background = '#f0f9ff';
                dropzone.style.borderColor = '#38bdf8';
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!file) return;
                const activeClass = (document.getElementById('companionBridgeClassSelect')?.value) || targetClass;
                const outcome = await readAndImportCompanionJsonFile(file, activeClass);
                renderImportOutcomeUi(outcome, file.name);
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
                        statusEl.textContent = '⚠️ يرجى اختيار ملف .json أو إدخال عنوان الوثيقة أو لصق كود JSON.';
                    }
                    return;
                }
                const activeClass = (document.getElementById('companionBridgeClassSelect')?.value) || targetClass;
                if (rawTitleOrJson.startsWith('{') || rawTitleOrJson.startsWith('[')) {
                    const outcome = importCompanionJsonFileContent(rawTitleOrJson, activeClass);
                    renderImportOutcomeUi(outcome, 'نص JSON');
                    return;
                }
                const imported = importCompanionDocumentIntoClass({
                    title: rawTitleOrJson,
                    type: docTypeVal,
                    level: activeClass,
                    axis: axisVal,
                    semester: sem
                }, activeClass);
                renderImportOutcomeUi({ ok: true, count: 1, targetClass: activeClass, documents: [imported] }, '');
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
        parseCompanionJsonText,
        importCompanionDocumentIntoClass,
        importCompanionJsonFileContent,
        readAndImportCompanionJsonFile,
        openCompanionDocumentBridgeModal
    };

    window.LessonLogEngine = LessonLogEngine;
    window.openCompanionDocumentBridgeModal = openCompanionDocumentBridgeModal;
})(typeof window !== 'undefined' ? window : globalThis);
