/**
 * ====================================================================
 * وحدة السبورة التفاعلية والتدريس عن بعد ومعاينة ملفات PDF
 * Interactive Math Whiteboard & PDF Annotation Workspace
 * ====================================================================
 * الميزات:
 * 1. نظام طبقتين مستقلتين (Dual-Layer Canvas):
 *    - طبقة الخلفية ومستندات PDF (#whiteboardBgCanvas)
 *    - طبقة الرسم والحل التفاعلي للأستاذ (#mathWhiteboardCanvas)
 *    مما يضمن عدم تأثر ملف الـ PDF أو الشبكة التربيعية عند استخدام الممحاة أو تغيير الخلفية.
 * 2. حفظ تلقائي مستمر لحالة الرسم والألوان والصفحات عند التنقل بين التبويبات وعبر LocalStorage.
 * 3. استيراد ومعاينة ملفات PDF (عبر الزر أو السحب والإفلات أو من المكتبة الرقمية) مع شريط مصغرات الصفحات،
 *    التكبير والتصغير، التدوير، التحريك، والحل المباشر فوق التمارين والفروض.
 * 4. نموذج فرض/سلسلة تمارين رياضيات متعدد الصفحات مدمج للمعاينة والاشتغال الفوري.
 * 5. أدوات هندسية ورياضية متكاملة: قلم، تمييز فسفوري، ممحاة ذكية، مؤشر ليزر، أشكال، معلم متعامد، دائرة مثلثية، ومنحنيات الدوال.
 */

(function (window) {
    'use strict';

    const STORAGE_KEY = 'math_whiteboard_persisted_state_v2';
    const IDB_NAME = 'MathInteractiveWhiteboardDB';
    const IDB_VERSION = 1;
    const IDB_STORE = 'whiteboard_state';
    let idbDatabase = null;

    // Canvas & Context References
    let canvas = null;      // Top interactive ink layer (#mathWhiteboardCanvas)
    let ctx = null;
    let bgCanvas = null;    // Bottom background & PDF layer (#whiteboardBgCanvas)
    let bgCtx = null;
    let toolsCanvas = null; // Interactive geometric tools overlay layer (#whiteboardToolsCanvas)
    let toolsCtx = null;

    let isInitialized = false;
    let lastValidWidth = 0;
    let lastValidHeight = 0;

    // Drawing State
    let isDrawing = false;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let panStartX = 0;
    let panStartY = 0;

    let currentTool = 'pen'; // 'pen', 'highlighter', 'eraser', 'laser', 'pan', 'line', 'arrow', 'triangle', 'rect', 'circle', 'text'
    let currentColor = '#1e3a8a';
    let currentSize = 3;
    let currentBg = 'grid'; // 'grid', 'dots', 'white', 'green', 'dark'

    // Interactive Geometric Tools State (Ruler, Protractor & Set Square)
    let rulerState = {
        visible: false,
        x: 420,
        y: 360,
        angle: 0,       // in radians
        length: 440,    // px (approx 22 cm at 20px/cm)
        height: 54
    };

    let protractorState = {
        visible: false,
        x: 420,
        y: 260,
        angle: 0,       // in radians
        radius: 170,
        rayAngleDeg: 60 // Dynamic angle measurement ray (0° - 180°)
    };

    let setSquareState = {
        visible: false,
        x: 360,
        y: 290,
        angle: 0,       // in radians
        size: 260       // base length in px
    };

    let compassState = {
        visible: false,
        x: 420,
        y: 300,
        angle: 0,       // in radians
        radius: 120,    // px (approx 6 cm at 20px/cm)
        arcSpanDeg: 90  // Arc span for geometric constructions
    };

    // Pedagogical Reveal Curtain State (الستار البيداغوجي التدريجي)
    let curtainState = {
        visible: false,
        y: 260,         // Top edge of curtain (hides everything from y to bottom)
        opacity: 0.94
    };

    // Live Video + Audio Lesson Recorder State (استوديو تسجيل الحصة بالفيديو والصوت)
    let videoRecorderState = {
        isRecording: false,
        mediaRecorder: null,
        recordedChunks: [],
        animFrameId: null,
        audioStream: null,
        compCanvas: null,
        compCtx: null,
        startTime: 0,
        timerInterval: null
    };

    let exerciseTimerState = {
        secondsLeft: 300,
        running: false,
        intervalId: null
    };

    let cachedProofBaseImg = null;
    let cachedProofBaseSrc = '';

    let activeGeoInteraction = null; // { tool: 'ruler'|'protractor'|'setSquare'|'compass'|'curtain', mode: 'move'|'rotate'|'resize'|'ray'|'compass_arc', startX, startY, origX, origY, origAngle, origLength, origSize, origRadius }
    let laserPointerPos = null;      // Decoupled laser pointer overlay pos: { x, y }
    let laserTrailPoints = [];       // [{ x, y, t }] for glowing fading laser trail
    let laserTrailAnimId = null;     // requestAnimationFrame handle for fading laser trail
    let spotlightState = {           // Spotlight focus aperture for remote teaching
        active: false,
        x: 420,
        y: 300,
        radius: 135
    };
    let isZenMode = false;           // Broadcast Zen Mode (hides studio bar)
    let strokePoints = [];           // Points history for smooth midpoint quadratic bezier curves
    let activeStylusId = null;       // Active pointer ID for Palm Rejection

    // 1. Proof Recorder & Step-by-Step Playback Animation Engine State
    let proofRecording = {
        isRecording: false,
        isPlaying: false,
        startTime: 0,
        strokes: [],
        baseSnapshot: null,
        timerInterval: null
    };
    let currentRecordedStroke = null;
    let proofPlaybackTimer = null;
    let proofPlaybackSpeed = 1.0;
    let proofPlaybackTime = 0;
    let proofTotalDuration = 0;

    // 2. Homework PDF/Image Student Annotation & Pedagogical Stamps State
    let homeworkCorrectionState = {
        active: false,
        currentStudent: '',
        currentClassName: '',
        currentHomeworkTitle: '',
        activeStamp: null // 'star'|'check'|'warning'|'error'|'df'|'chasles'|'score'
    };

    // 3. Virtual Blackboard Call-up / Student Collaboration Mode State
    let studentCallState = {
        active: false,
        studentName: '',
        studentRole: 'teacher', // 'teacher' or 'student'
        isLocked: false,
        studentColor: '#059669', // Emerald green
        studentSize: 3,
        roomCode: 'MATH-BAC-2026',
        participationCount: 0
    };
    let studentCursorPos = null;
    let collabClient = null;
    const remotePeers = new Map(); // senderId -> { x, y, name, role, ts }

    // Interactive Vector Selection & Tools Dock State
    let selectedVectorIndex = -1;
    let activeSelectInteraction = null; // { mode: 'move'|'nw'|'ne'|'sw'|'se', index, origObj, origBounds, startX, startY }
    let isLeftDockCollapsed = false;
    let isFreehandDrawerOpen = false;

    // Multi-page Whiteboard State (Vector Stroke Serialization + Raster fallback)
    let pageDataUrls = [''];
    let pageVectorStrokes = [[]]; // [{ id, t, c, s, ... }] (~4-8KB per page)
    let pdfPageVectorStrokes = {}; // Map: pageNum -> array of vector strokes
    let currentVectorStroke = null;
    let currentPageIndex = 0;

    // Undo / Redo Stacks (stores dataURLs + synchronized vector snapshots)
    let undoStack = [];
    let redoStack = [];
    let undoVectorSnapshots = [];
    let redoVectorSnapshots = [];
    const MAX_HISTORY = 15;

    // PDF & Worksheet Integration State
    let currentPdfDoc = null;
    let isSampleWorksheetActive = false;
    let sampleWorksheetPages = []; // Array of offscreen canvases for built-in math worksheet
    let currentPdfFileName = '';
    let currentPdfPageNum = 1;
    let pdfTotalPages = 0;
    let pdfPageDataUrls = {}; // Map: pageNum -> dataURL of teacher's annotations on that PDF page
    let pdfRenderedCanvas = null;
    let pdfRenderPos = { x: 0, y: 0, width: 0, height: 0 };
    let pdfZoom = 1.0;
    let pdfRotation = 0; // 0, 90, 180, 270
    let pdfPanOffset = { x: 0, y: 0 };
    let pdfFitMode = 'contain'; // 'contain' or 'width'
    let isPdfRendering = false;
    let isThumbnailsOpen = true;

    function getVectorEnv() {
        return {
            isPdfActive: isPdfOrWorksheetActive(),
            pdfRenderPos: pdfRenderPos,
            pdfPanOffset: pdfPanOffset,
            currentBg: currentBg
        };
    }

    function cloneVectorObj(obj) {
        try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return Object.assign({}, obj); }
    }

    function pushVectorObject(obj, skipCollabBroadcast = false) {
        if (!obj) return null;
        if (window.WbVectorEngine) {
            if (!obj.id) obj.id = window.WbVectorEngine.uid('obj');
            window.WbVectorEngine.attachNormalizedPdfFields(obj, getVectorEnv());
        } else if (!obj.id) {
            obj.id = 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        }
        const arr = getActiveVectorArray();
        arr.push(obj);
        if (!skipCollabBroadcast && collabClient && collabClient.roomCode) {
            collabClient.send('stroke:add', { object: obj });
        }
        return obj;
    }

    function drawVectorObjectOnCtx(obj) {
        if (!ctx || !obj) return;
        if (window.WbVectorEngine && typeof window.WbVectorEngine.drawVectorObject === 'function') {
            window.WbVectorEngine.drawVectorObject(ctx, obj, getVectorEnv(), () => {
                const list = getActiveVectorArray();
                replayVectorStrokesToCanvas(list);
            });
        }
    }

    function refreshFreehandDrawerIfOpen() {
        if (isFreehandDrawerOpen && window.WbBridges && typeof window.WbBridges.renderFreehandPagesDrawer === 'function') {
            window.WbBridges.renderFreehandPagesDrawer(
                { pageDataUrls, currentPageIndex },
                {
                    onJump: (idx) => jumpToFreehandPage(idx),
                    onMove: (fromIdx, toIdx) => moveFreehandPage(fromIdx, toIdx),
                    onDelete: (idx) => deleteFreehandPageAt(idx)
                }
            );
        }
    }

    /**
     * فتح وتجهيز قاعدة بيانات IndexedDB للحفظ الفوري والمستمر للرسومات
     */
    function openWhiteboardIndexedDB() {
        return new Promise((resolve) => {
            if (idbDatabase) {
                resolve(idbDatabase);
                return;
            }
            if (!window.indexedDB) {
                resolve(null);
                return;
            }
            try {
                const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
                request.onupgradeneeded = function (e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
                    }
                };
                request.onsuccess = function (e) {
                    idbDatabase = e.target.result;
                    resolve(idbDatabase);
                };
                request.onerror = function () {
                    resolve(null);
                };
            } catch (err) {
                resolve(null);
            }
        });
    }

    /**
     * حفظ البيانات في قاعدة بيانات IndexedDB بشكل غير متزامن وفوري
     */
    function savePayloadToIndexedDB(payload) {
        openWhiteboardIndexedDB().then((db) => {
            if (!db) return;
            try {
                const tx = db.transaction([IDB_STORE], 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                store.put(Object.assign({ id: 'active_whiteboard_session' }, payload));
            } catch (err) {}
        });
    }

    /**
     * استرجاع حالة السبورة والرسومات من IndexedDB عند بدء التشغيل
     */
    function loadPersistedStateFromIndexedDB() {
        openWhiteboardIndexedDB().then((db) => {
            if (!db) return;
            try {
                const tx = db.transaction([IDB_STORE], 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const req = store.get('active_whiteboard_session');
                req.onsuccess = function (e) {
                    const data = e.target.result;
                    if (!data) return;
                    if (data.currentColor) currentColor = data.currentColor;
                    if (data.currentSize) currentSize = Number(data.currentSize) || 3;
                    if (data.currentBg) currentBg = data.currentBg;
                    if (data.currentTool) currentTool = data.currentTool;
                    if (Array.isArray(data.pageDataUrls) && data.pageDataUrls.length > 0) {
                        pageDataUrls = data.pageDataUrls;
                        currentPageIndex = Math.min(data.currentPageIndex || 0, pageDataUrls.length - 1);
                    }
                    if (Array.isArray(data.pageVectorStrokes) && data.pageVectorStrokes.length > 0) {
                        pageVectorStrokes = data.pageVectorStrokes;
                        while (pageVectorStrokes.length < pageDataUrls.length) {
                            pageVectorStrokes.push([]);
                        }
                    }
                    if (data.pdfPageDataUrls && typeof data.pdfPageDataUrls === 'object') {
                        pdfPageDataUrls = Object.assign({}, pdfPageDataUrls, data.pdfPageDataUrls);
                    }
                    if (data.pdfPageVectorStrokes && typeof data.pdfPageVectorStrokes === 'object') {
                        pdfPageVectorStrokes = Object.assign({}, pdfPageVectorStrokes, data.pdfPageVectorStrokes);
                    }
                    if (data.rulerState && typeof data.rulerState === 'object') {
                        rulerState = Object.assign(rulerState, data.rulerState);
                    }
                    if (data.protractorState && typeof data.protractorState === 'object') {
                        protractorState = Object.assign(protractorState, data.protractorState);
                    }
                    if (data.setSquareState && typeof data.setSquareState === 'object') {
                        setSquareState = Object.assign(setSquareState, data.setSquareState);
                    }
                    if (data.compassState && typeof data.compassState === 'object') {
                        compassState = Object.assign(compassState, data.compassState);
                    }
                    if (data.curtainState && typeof data.curtainState === 'object') {
                        curtainState = Object.assign(curtainState, data.curtainState);
                    }

                    updateToolbarUI();
                    updatePageIndicator();
                    drawBackground();
                    renderGeometricToolsOverlay();

                    if (!isPdfOrWorksheetActive() && !isDrawing) {
                        if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0 && window.WbVectorEngine) {
                            replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
                        } else if (pageDataUrls[currentPageIndex]) {
                            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
                        }
                    }
                };
            } catch (err) {}
        });
    }

    /**
     * تهيئة السبورة التفاعلية واسترجاع الحالة المحفوظة
     */
    function initDistanceTeaching() {
        canvas = document.getElementById('mathWhiteboardCanvas');
        bgCanvas = document.getElementById('whiteboardBgCanvas');
        toolsCanvas = document.getElementById('whiteboardToolsCanvas');
        if (!canvas) return;

        ctx = canvas.getContext('2d');
        if (bgCanvas) {
            bgCtx = bgCanvas.getContext('2d');
        }
        if (toolsCanvas) {
            toolsCtx = toolsCanvas.getContext('2d');
        }

        if (!isInitialized) {
            loadPersistedStateFromStorage();
            loadPersistedStateFromIndexedDB();
            window.addEventListener('resize', debounce(() => {
                if (isContainerVisible()) {
                    resizeCanvas(true);
                }
            }, 150));
            setupFullscreenListeners();
            setupKeyboardShortcuts();
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const roomParam = urlParams.get('wbroom');
                if (roomParam) {
                    const roleParam = urlParams.get('role') === 'student' ? 'student' : 'teacher';
                    const nameParam = urlParams.get('name') || (roleParam === 'student' ? 'تلميذ عن بعد' : 'الأستاذ');
                    setTimeout(() => joinWhiteboardCollabRoom(roomParam, roleParam, nameParam), 250);
                }
            } catch (e) {}
            isInitialized = true;
        }

        if (!canvas._eventsBound) {
            bindCanvasEvents();
            setupDragAndDropPdf();
            canvas._eventsBound = true;
        }

        // Resize and restore drawing only when container is actually visible in the DOM
        if (isContainerVisible()) {
            resizeCanvas(true);
        }
        requestAnimationFrame(() => {
            if (isContainerVisible()) {
                resizeCanvas(true);
            }
        });

        updateToolbarUI();
        updatePageIndicator();
        renderGeometricToolsOverlay();
    }

    function isContainerVisible() {
        if (!canvas || !canvas.parentElement) return false;
        const view = document.getElementById('distanceTeachingView');
        if (view && view.style.display === 'none') return false;
        const rect = canvas.parentElement.getBoundingClientRect();
        return rect.width >= 50 && rect.height >= 50;
    }

    function debounce(fn, ms) {
        let timer;
        return function () {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, arguments), ms);
        };
    }

    const persistOnMoveThrottled = (function () {
        let timer = null;
        return function () {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                persistWhiteboardState();
            }, 90);
        };
    })();

    /**
     * ضغط صورة DataURL من PNG إلى WebP لتقليل استهلاك الذاكرة و IndexedDB بنسبة تصل إلى 75%
     */
    function compressDataUrlToWebp(dataUrl, quality = 0.78) {
        return new Promise((resolve) => {
            if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) {
                resolve(dataUrl || '');
                return;
            }
            const img = new Image();
            img.onload = function () {
                try {
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = img.naturalWidth || img.width || 800;
                    offCanvas.height = img.naturalHeight || img.height || 600;
                    const offCtx = offCanvas.getContext('2d');
                    offCtx.drawImage(img, 0, 0);
                    const compressed = offCanvas.toDataURL('image/webp', quality);
                    offCanvas.width = 0;
                    offCanvas.height = 0;
                    resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
                } catch (e) {
                    resolve(dataUrl);
                }
            };
            img.onerror = function () {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    /**
     * دالة ضغط وتنظيف قاعدة بيانات السبورة التفاعلية (math_whiteboard_idb) وتقليص استهلاك الذاكرة
     */
    async function compressWhiteboardIndexedDB(options = {}) {
        const stats = {
            pagesCompacted: 0,
            pdfAnnotationsCompacted: 0,
            emptyPagesPruned: 0,
            undoTrimmed: 0,
            bytesSavedEstimate: 0
        };

        try {
            // 1. تقليص مكدس التراجع والإعادة في الذاكرة الحية (RAM) عند الخمول أو الخروج
            if (redoStack.length > 0) {
                stats.undoTrimmed += redoStack.length;
                redoStack = [];
                redoVectorSnapshots = [];
            }
            const maxIdleUndo = options.aggressive ? 3 : 6;
            if (undoStack.length > maxIdleUndo) {
                const removed = undoStack.length - maxIdleUndo;
                stats.undoTrimmed += removed;
                undoStack = undoStack.slice(-maxIdleUndo);
                undoVectorSnapshots = undoVectorSnapshots.slice(-maxIdleUndo);
            }

            // 2. حذف الصفحات الفارغة الزائدة في نهاية المصفوفة
            while (pageDataUrls.length > 1 && !pageDataUrls[pageDataUrls.length - 1] && currentPageIndex < pageDataUrls.length - 1) {
                pageDataUrls.pop();
                stats.emptyPagesPruned++;
            }

            // 3. ضغط صفحات السبورة من PNG إلى WebP
            for (let i = 0; i < pageDataUrls.length; i++) {
                const raw = pageDataUrls[i];
                if (raw && raw.startsWith('data:image/png')) {
                    const beforeLen = raw.length;
                    const compressed = await compressDataUrlToWebp(raw, 0.78);
                    if (compressed.length < beforeLen) {
                        pageDataUrls[i] = compressed;
                        stats.pagesCompacted++;
                        stats.bytesSavedEstimate += (beforeLen - compressed.length);
                    }
                }
            }

            // 4. ضغط تعليقات وشروحات صفحات الـ PDF
            if (pdfPageDataUrls && typeof pdfPageDataUrls === 'object') {
                const keys = Object.keys(pdfPageDataUrls);
                for (const k of keys) {
                    const raw = pdfPageDataUrls[k];
                    if (!raw) {
                        delete pdfPageDataUrls[k];
                        continue;
                    }
                    if (raw.startsWith('data:image/png')) {
                        const beforeLen = raw.length;
                        const compressed = await compressDataUrlToWebp(raw, 0.78);
                        if (compressed.length < beforeLen) {
                            pdfPageDataUrls[k] = compressed;
                            stats.pdfAnnotationsCompacted++;
                            stats.bytesSavedEstimate += (beforeLen - compressed.length);
                        }
                    }
                }
            }

            // 5. تقليص وضغط المسارات المتجهية (Vector Stroke Quantization)
            if (Array.isArray(pageVectorStrokes)) {
                while (pageVectorStrokes.length > pageDataUrls.length) {
                    pageVectorStrokes.pop();
                }
                pageVectorStrokes = pageVectorStrokes.map(strokeList => {
                    if (!Array.isArray(strokeList)) return [];
                    return strokeList.map(st => {
                        if (!st || typeof st !== 'object') return st;
                        if (Array.isArray(st.pts)) {
                            st.pts = st.pts.map(p => [Math.round(Number(p[0]) * 10) / 10, Math.round(Number(p[1]) * 10) / 10]);
                        }
                        return st;
                    });
                });
            }

            // 6. حفظ النسخة المضغوطة في IndexedDB وتخفيف localStorage (اعتماد التمثيل المتجهي الخفيف في localStorage)
            const compactPayload = {
                currentTool: currentTool === 'laser' || currentTool === 'pan' ? 'pen' : currentTool,
                currentColor,
                currentSize,
                currentBg,
                currentPageIndex,
                pageDataUrls: pageDataUrls.slice(0, 20),
                pageVectorStrokes: pageVectorStrokes.slice(0, 20),
                pdfPageDataUrls,
                pdfPageVectorStrokes,
                rulerState,
                protractorState,
                setSquareState,
                compassState,
                curtainState,
                compressedAt: Date.now(),
                updatedAt: Date.now()
            };
            savePayloadToIndexedDB(compactPayload);

            try {
                const lsLightweight = {
                    currentTool: compactPayload.currentTool,
                    currentColor,
                    currentSize,
                    currentBg,
                    currentPageIndex,
                    pageVectorStrokes: pageVectorStrokes.slice(0, 20),
                    pageDataUrls: pageDataUrls[currentPageIndex] ? [pageDataUrls[currentPageIndex]] : [''],
                    rulerState,
                    protractorState,
                    setSquareState,
                    compassState,
                    curtainState,
                    updatedAt: compactPayload.updatedAt
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(lsLightweight));
            } catch (e) {}
        } catch (err) {}

        return stats;
    }

    /**
     * إعادة رسم المسارات والكائنات المتجهية المحفوظة عبر محرك WbVectorEngine بدقة عالية
     */
    function replayVectorStrokesToCanvas(strokesList) {
        if (!ctx || !canvas) return;
        clearInkCanvasInternal();
        if (!Array.isArray(strokesList) || strokesList.length === 0) return;

        const env = getVectorEnv();
        if (window.WbVectorEngine && typeof window.WbVectorEngine.drawVectorObject === 'function') {
            for (let i = 0; i < strokesList.length; i++) {
                const st = strokesList[i];
                if (!st) continue;
                window.WbVectorEngine.drawVectorObject(ctx, st, env, () => {
                    replayVectorStrokesToCanvas(strokesList);
                });
            }
            return;
        }

        for (let i = 0; i < strokesList.length; i++) {
            const st = strokesList[i];
            if (!st) continue;
            const tool = st.t || st.tool || 'pen';
            const color = st.c || st.color || '#1e293b';
            const size = Number(st.s || st.size) || 3;

            if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
                const pts = st.pts || st.points || [];
                if (pts.length === 0) continue;
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                if (tool === 'pen') {
                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                    ctx.lineWidth = size;
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';
                } else if (tool === 'highlighter') {
                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                    ctx.lineWidth = Math.max(12, size * 4);
                    ctx.globalAlpha = 0.28;
                    ctx.globalCompositeOperation = 'source-over';
                } else if (tool === 'eraser') {
                    ctx.lineWidth = Math.max(16, size * 5);
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.strokeStyle = 'rgba(0,0,0,1)';
                    ctx.globalAlpha = 1.0;
                }

                const p0x = Array.isArray(pts[0]) ? pts[0][0] : pts[0].x;
                const p0y = Array.isArray(pts[0]) ? pts[0][1] : pts[0].y;
                if (pts.length === 1) {
                    ctx.beginPath();
                    ctx.arc(p0x, p0y, Math.max(0.8, size / 2), 0, Math.PI * 2);
                    ctx.fill();
                } else if (pts.length === 2) {
                    const p1x = Array.isArray(pts[1]) ? pts[1][0] : pts[1].x;
                    const p1y = Array.isArray(pts[1]) ? pts[1][1] : pts[1].y;
                    ctx.beginPath();
                    ctx.moveTo(p0x, p0y);
                    ctx.lineTo(p1x, p1y);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(p0x, p0y);
                    for (let j = 1; j < pts.length - 1; j++) {
                        const px = Array.isArray(pts[j]) ? pts[j][0] : pts[j].x;
                        const py = Array.isArray(pts[j]) ? pts[j][1] : pts[j].y;
                        const nx = Array.isArray(pts[j + 1]) ? pts[j + 1][0] : pts[j + 1].x;
                        const ny = Array.isArray(pts[j + 1]) ? pts[j + 1][1] : pts[j + 1].y;
                        ctx.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);
                    }
                    const lx = Array.isArray(pts[pts.length - 1]) ? pts[pts.length - 1][0] : pts[pts.length - 1].x;
                    const ly = Array.isArray(pts[pts.length - 1]) ? pts[pts.length - 1][1] : pts[pts.length - 1].y;
                    ctx.lineTo(lx, ly);
                    ctx.stroke();
                }
                ctx.restore();
            } else if (st.x1 !== undefined && st.x2 !== undefined) {
                const prevColor = currentColor;
                const prevSize = currentSize;
                currentColor = color;
                currentSize = size;
                drawShapePreview(st.x1, st.y1, st.x2, st.y2, tool);
                currentColor = prevColor;
                currentSize = prevSize;
            }
        }
    }

    /**
     * حفظ حالة الرسم الحالية في الذاكرة وفي IndexedDB + LocalStorage عند كل حركة وبعد كل رسم
     */
    function persistWhiteboardState() {
        if (!canvas || !ctx) return;

        if (canvas.width > 0 && canvas.height > 0 && lastValidWidth > 0) {
            try {
                const dataUrl = canvas.toDataURL('image/webp', 0.85);
                if (isPdfOrWorksheetActive()) {
                    pdfPageDataUrls[currentPdfPageNum] = dataUrl;
                    updateThumbnailAnnotationBadge(currentPdfPageNum, true);
                } else {
                    pageDataUrls[currentPageIndex] = dataUrl;
                }
            } catch (e) {}
        }

        const payload = {
            currentTool: (currentTool === 'laser' || currentTool === 'pan' || currentTool === 'spotlight') ? 'pen' : currentTool,
            currentColor,
            currentSize,
            currentBg,
            currentPageIndex,
            pageDataUrls: pageDataUrls.slice(0, 20),
            pageVectorStrokes: pageVectorStrokes.slice(0, 20),
            pdfPageDataUrls,
            pdfPageVectorStrokes,
            rulerState,
            protractorState,
            setSquareState,
            compassState,
            curtainState,
            updatedAt: Date.now()
        };

        savePayloadToIndexedDB(payload);

        try {
            const lsPayload = {
                currentTool: payload.currentTool,
                currentColor,
                currentSize,
                currentBg,
                currentPageIndex,
                pageVectorStrokes: pageVectorStrokes.slice(0, 20),
                pageDataUrls: pageDataUrls[currentPageIndex] ? [pageDataUrls[currentPageIndex]] : [''],
                rulerState,
                protractorState,
                setSquareState,
                compassState,
                curtainState,
                updatedAt: payload.updatedAt
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lsPayload));
        } catch (e) {}

        flashPersistBadge();
        refreshFreehandDrawerIfOpen();
    }

    function loadPersistedStateFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.currentColor) currentColor = data.currentColor;
            if (data.currentSize) currentSize = Number(data.currentSize) || 3;
            if (data.currentBg) currentBg = data.currentBg;
            if (data.currentTool) currentTool = data.currentTool;
            if (Array.isArray(data.pageDataUrls) && data.pageDataUrls.length > 0) {
                pageDataUrls = data.pageDataUrls;
                currentPageIndex = Math.min(data.currentPageIndex || 0, pageDataUrls.length - 1);
            }
            if (Array.isArray(data.pageVectorStrokes) && data.pageVectorStrokes.length > 0) {
                pageVectorStrokes = data.pageVectorStrokes;
                while (pageDataUrls.length < pageVectorStrokes.length) {
                    pageDataUrls.push('');
                }
            }
            if (data.rulerState && typeof data.rulerState === 'object') {
                rulerState = Object.assign(rulerState, data.rulerState);
            }
            if (data.protractorState && typeof data.protractorState === 'object') {
                protractorState = Object.assign(protractorState, data.protractorState);
            }
            if (data.setSquareState && typeof data.setSquareState === 'object') {
                setSquareState = Object.assign(setSquareState, data.setSquareState);
            }
            if (data.compassState && typeof data.compassState === 'object') {
                compassState = Object.assign(compassState, data.compassState);
            }
            if (data.curtainState && typeof data.curtainState === 'object') {
                curtainState = Object.assign(curtainState, data.curtainState);
            }
        } catch (e) {}
    }

    function flashPersistBadge() {
        const badge = document.getElementById('whiteboardPersistBadge');
        if (!badge) return;
        const vecList = isPdfOrWorksheetActive()
            ? (pdfPageVectorStrokes[currentPdfPageNum] || [])
            : (pageVectorStrokes[currentPageIndex] || []);
        badge.textContent = vecList.length > 0
            ? `✓ محفوظ متجهياً (${vecList.length} مسار • Vector+IDB)`
            : '✓ محفوظ تلقائياً (Vector + IndexedDB)';
        badge.style.background = '#dcfce7';
        badge.style.color = '#15803d';
    }

    function isPdfOrWorksheetActive() {
        return !!(currentPdfDoc || isSampleWorksheetActive);
    }

    /**
     * ضبط أبعاد ومقاسات السبورة مع الحفاظ الكامل على الرسومات
     */
    function resizeCanvas(restoreAfterResize = true) {
        if (!canvas || !canvas.parentElement) return;
        if (!isContainerVisible()) return;

        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(320, Math.floor(rect.width));
        const height = Math.max(420, Math.floor(rect.height || 600));

        // If dimensions haven't changed and canvas is already initialized, just redraw background and keep ink
        if (lastValidWidth === width && lastValidHeight === height && canvas.width === Math.floor(width * dpr)) {
            if (isPdfOrWorksheetActive()) {
                renderActiveDocumentPage(currentPdfPageNum, false);
            } else {
                drawBackground();
            }
            renderGeometricToolsOverlay();
            return;
        }

        // Save current ink before changing canvas dimensions
        const activeDataUrl = isPdfOrWorksheetActive()
            ? pdfPageDataUrls[currentPdfPageNum]
            : pageDataUrls[currentPageIndex];

        lastValidWidth = width;
        lastValidHeight = height;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        if (bgCanvas && bgCtx) {
            bgCanvas.width = Math.floor(width * dpr);
            bgCanvas.height = Math.floor(height * dpr);
            bgCanvas.style.width = width + 'px';
            bgCanvas.style.height = height + 'px';
            bgCtx.setTransform(1, 0, 0, 1, 0, 0);
            bgCtx.scale(dpr, dpr);
        }

        if (toolsCanvas && toolsCtx) {
            toolsCanvas.width = Math.floor(width * dpr);
            toolsCanvas.height = Math.floor(height * dpr);
            toolsCanvas.style.width = width + 'px';
            toolsCanvas.style.height = height + 'px';
            toolsCtx.setTransform(1, 0, 0, 1, 0, 0);
            toolsCtx.scale(dpr, dpr);
        }

        if (isPdfOrWorksheetActive()) {
            renderActiveDocumentPage(currentPdfPageNum, false);
        } else {
            drawBackground();
            if (restoreAfterResize) {
                const vecList = getActiveVectorArray();
                if (Array.isArray(vecList) && vecList.length > 0 && window.WbVectorEngine) {
                    replayVectorStrokesToCanvas(vecList);
                } else if (activeDataUrl) {
                    restoreDataUrlToInkCanvas(activeDataUrl);
                }
            }
        }
        renderGeometricToolsOverlay();
    }

    function restoreDataUrlToInkCanvas(dataUrl, callback) {
        if (!ctx || !canvas) return;
        clearInkCanvasInternal();
        if (!dataUrl) {
            if (callback) callback();
            return;
        }
        const img = new Image();
        img.onload = function () {
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
            ctx.drawImage(img, 0, 0, w, h);
            ctx.restore();
            if (callback) callback();
        };
        img.src = dataUrl;
    }

    /**
     * رسم الخلفية أو صفحة الـ PDF على طبقة الخلفية المستقلة (#whiteboardBgCanvas)
     */
    function drawBackground() {
        const targetCtx = bgCtx || ctx;
        const targetCanvas = bgCanvas || canvas;
        if (!targetCtx || !targetCanvas) return;

        const w = lastValidWidth || parseFloat(targetCanvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(targetCanvas.style.height) || 600;

        targetCtx.save();
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.clearRect(0, 0, w, h);

        // إذا كان هناك ملف PDF أو ورقة تمارين معروضة حالياً
        if (isPdfOrWorksheetActive() && pdfRenderedCanvas) {
            // خلفية مكتب مريحة للعين حول ورقة الـ PDF
            targetCtx.fillStyle = '#e2e8f0';
            targetCtx.fillRect(0, 0, w, h);

            const drawX = pdfRenderPos.x + pdfPanOffset.x;
            const drawY = pdfRenderPos.y + pdfPanOffset.y;

            // ظل الورقة وإطارها الأبيض
            targetCtx.save();
            targetCtx.shadowColor = 'rgba(15, 23, 42, 0.22)';
            targetCtx.shadowBlur = 16;
            targetCtx.shadowOffsetY = 5;
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(drawX, drawY, pdfRenderPos.width, pdfRenderPos.height);
            targetCtx.restore();

            // رسم محتوى صفحة الـ PDF
            try {
                targetCtx.drawImage(pdfRenderedCanvas, drawX, drawY, pdfRenderPos.width, pdfRenderPos.height);
                targetCtx.strokeStyle = '#cbd5e1';
                targetCtx.lineWidth = 1;
                targetCtx.strokeRect(drawX, drawY, pdfRenderPos.width, pdfRenderPos.height);
            } catch (err) {}

            targetCtx.restore();
            return;
        }

        // الأنماط الاعتيادية لخلفية السبورة
        if (currentBg === 'grid') {
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, w, h);

            targetCtx.lineWidth = 0.6;
            targetCtx.strokeStyle = '#e2e8f0';
            const gridSize = 24;
            targetCtx.beginPath();
            for (let x = 0; x < w; x += gridSize) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }
            for (let y = 0; y < h; y += gridSize) {
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(w, y);
            }
            targetCtx.stroke();

            // خطوط رئيسية بارزة كل 4 مربعات
            targetCtx.lineWidth = 1.1;
            targetCtx.strokeStyle = '#cbd5e1';
            targetCtx.beginPath();
            for (let x = 0; x < w; x += gridSize * 4) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }
            for (let y = 0; y < h; y += gridSize * 4) {
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(w, y);
            }
            targetCtx.stroke();

        } else if (currentBg === 'dots') {
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, w, h);
            targetCtx.fillStyle = '#94a3b8';
            const spacing = 24;
            for (let x = spacing; x < w; x += spacing) {
                for (let y = spacing; y < h; y += spacing) {
                    targetCtx.beginPath();
                    targetCtx.arc(x, y, 1.3, 0, Math.PI * 2);
                    targetCtx.fill();
                }
            }
        } else if (currentBg === 'white') {
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, w, h);
        } else if (currentBg === 'green') {
            targetCtx.fillStyle = '#14432a';
            targetCtx.fillRect(0, 0, w, h);
            // شبكة خفيفة جداً على السبورة الخضراء
            targetCtx.lineWidth = 0.5;
            targetCtx.strokeStyle = 'rgba(255,255,255,0.08)';
            const gridSize = 28;
            targetCtx.beginPath();
            for (let x = 0; x < w; x += gridSize) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }
            for (let y = 0; y < h; y += gridSize) {
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(w, y);
            }
            targetCtx.stroke();
        } else if (currentBg === 'dark') {
            targetCtx.fillStyle = '#0f172a';
            targetCtx.fillRect(0, 0, w, h);
            targetCtx.lineWidth = 0.5;
            targetCtx.strokeStyle = 'rgba(255,255,255,0.07)';
            const gridSize = 28;
            targetCtx.beginPath();
            for (let x = 0; x < w; x += gridSize) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }
            for (let y = 0; y < h; y += gridSize) {
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(w, y);
            }
            targetCtx.stroke();

        } else if (currentBg === 'seyes') {
            // دفتر مربعات مغربي رسمي (Seyes Grands Carreaux)
            targetCtx.fillStyle = '#ffffff';
            targetCtx.fillRect(0, 0, w, h);

            const mainGrid = 32; // خطوط رئيسية (مربعات كبرى)
            const subGrid = 8;   // خطوط ثانوية خفيفة (2mm)

            // خطوط ثانوية أفقية رفيعة جداً بلون أزرق سماوي ناعم
            targetCtx.lineWidth = 0.5;
            targetCtx.strokeStyle = 'rgba(191, 219, 254, 0.55)';
            targetCtx.beginPath();
            for (let y = 0; y < h; y += subGrid) {
                if (y % mainGrid !== 0) {
                    targetCtx.moveTo(0, y);
                    targetCtx.lineTo(w, y);
                }
            }
            targetCtx.stroke();

            // خطوط رئيسية أفقية بلون أزرق بنفسجي مدرسي
            targetCtx.lineWidth = 0.9;
            targetCtx.strokeStyle = 'rgba(147, 197, 253, 0.85)';
            targetCtx.beginPath();
            for (let y = 0; y < h; y += mainGrid) {
                targetCtx.moveTo(0, y);
                targetCtx.lineTo(w, y);
            }
            targetCtx.stroke();

            // خطوط رئيسية عمودية
            targetCtx.lineWidth = 0.65;
            targetCtx.strokeStyle = 'rgba(191, 219, 254, 0.65)';
            targetCtx.beginPath();
            for (let x = 0; x < w; x += mainGrid) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }
            targetCtx.stroke();

            // خط الهامش الأحمر المغربي (Marguerite / Marge)
            const marginX = 72;
            targetCtx.lineWidth = 1.3;
            targetCtx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
            targetCtx.beginPath();
            targetCtx.moveTo(marginX, 0);
            targetCtx.lineTo(marginX, h);
            targetCtx.stroke();
        } else if (currentBg === 'isometric') {
            // شبكة الهندسة الفضائية المتقايسة (3D Isometric Grid - 30° / 60° / 90°)
            targetCtx.fillStyle = '#f8fafc';
            targetCtx.fillRect(0, 0, w, h);

            const step = 34; // المسافة العمودية بين الرؤوس المتقايسة
            const dx = step * Math.cos(Math.PI / 6); // step * √3 / 2 ≈ 29.44
            const dy = step * Math.sin(Math.PI / 6); // step / 2 = 17

            targetCtx.lineWidth = 0.75;
            targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.36)';
            targetCtx.beginPath();

            // 1. الخطوط العمودية (محور z الفضائي)
            for (let x = 0; x <= w + dx; x += dx) {
                targetCtx.moveTo(x, 0);
                targetCtx.lineTo(x, h);
            }

            // 2. الخطوط المائلة بزاوية +30° و -30°
            const tan30 = Math.tan(Math.PI / 6);
            const extraH = w * tan30;
            for (let yStart = -extraH; yStart <= h + extraH; yStart += step) {
                targetCtx.moveTo(0, yStart);
                targetCtx.lineTo(w, yStart + extraH);

                targetCtx.moveTo(0, yStart);
                targetCtx.lineTo(w, yStart - extraH);
            }
            targetCtx.stroke();

            // 3. نقاط تقاطع الشبكة الفضائية لسهولة ضبط رؤوس المجسمات
            targetCtx.fillStyle = 'rgba(37, 99, 235, 0.42)';
            let colIndex = 0;
            for (let x = 0; x <= w; x += dx) {
                const yOffset = (colIndex % 2 === 1) ? dy : 0;
                for (let y = yOffset; y <= h; y += step) {
                    targetCtx.beginPath();
                    targetCtx.arc(x, y, 1.4, 0, Math.PI * 2);
                    targetCtx.fill();
                }
                colIndex++;
            }
        }

        targetCtx.restore();
    }

    function getActiveVectorArray() {
        if (isPdfOrWorksheetActive()) {
            if (!Array.isArray(pdfPageVectorStrokes[currentPdfPageNum])) {
                pdfPageVectorStrokes[currentPdfPageNum] = [];
            }
            return pdfPageVectorStrokes[currentPdfPageNum];
        }
        while (pageVectorStrokes.length <= currentPageIndex) {
            pageVectorStrokes.push([]);
        }
        if (!Array.isArray(pageVectorStrokes[currentPageIndex])) {
            pageVectorStrokes[currentPageIndex] = [];
        }
        return pageVectorStrokes[currentPageIndex];
    }

    function setActiveVectorArray(arr) {
        const nextArr = Array.isArray(arr) ? arr.slice() : [];
        if (isPdfOrWorksheetActive()) {
            pdfPageVectorStrokes[currentPdfPageNum] = nextArr;
        } else {
            while (pageVectorStrokes.length <= currentPageIndex) {
                pageVectorStrokes.push([]);
            }
            pageVectorStrokes[currentPageIndex] = nextArr;
        }
    }

    function resetUndoHistory() {
        undoStack = [];
        redoStack = [];
        undoVectorSnapshots = [];
        redoVectorSnapshots = [];
    }

    /**
     * حفظ لقطة قبل الرسم للتراجع (Undo) مع ضغط أمثل ومزامنة المسارات المتجهية
     */
    function saveStateForUndo() {
        if (!ctx || !canvas) return;
        const vecSnap = getActiveVectorArray().slice();
        try {
            const snapshot = canvas.toDataURL('image/webp', 0.85);
            undoStack.push(snapshot);
            undoVectorSnapshots.push(vecSnap);
            if (undoStack.length > MAX_HISTORY) undoStack.shift();
            if (undoVectorSnapshots.length > MAX_HISTORY) undoVectorSnapshots.shift();
            redoStack = [];
            redoVectorSnapshots = [];
        } catch (e) {
            try {
                const snapshot = canvas.toDataURL('image/png');
                undoStack.push(snapshot);
                undoVectorSnapshots.push(vecSnap);
                if (undoStack.length > MAX_HISTORY) undoStack.shift();
                if (undoVectorSnapshots.length > MAX_HISTORY) undoVectorSnapshots.shift();
                redoStack = [];
                redoVectorSnapshots = [];
            } catch (err) {}
        }
    }

    /**
     * ربط أحداث الفأرة واللمس والتكبير بعجلة الفأرة مع دعم الأدوات الهندسية والحفظ الفوري
     */
    function bindCanvasEvents() {
        let shapeSnapshotImg = null;
        let lastCursorSentAt = 0;

        const getCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            let clientX = e.clientX;
            let clientY = e.clientY;
            if (clientX === undefined && e.touches && e.touches[0]) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else if (clientX === undefined && e.changedTouches && e.changedTouches[0]) {
                clientX = e.changedTouches[0].clientX;
                clientY = e.changedTouches[0].clientY;
            }
            const scaleX = (lastValidWidth || canvas.clientWidth || rect.width) / (rect.width || 1);
            const scaleY = (lastValidHeight || canvas.clientHeight || rect.height) / (rect.height || 1);
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY,
                pressure: (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 0.5,
                pointerType: e.pointerType || (e.touches ? 'touch' : 'mouse')
            };
        };

        const onPointerDown = (e) => {
            if (e.button && e.button !== 0) return;

            // Palm Rejection: If an active stylus/pen is writing, ignore non-pen touch inputs
            if (activeStylusId !== null && e.pointerType === 'touch') {
                return;
            }
            if (e.pointerType === 'pen') {
                activeStylusId = e.pointerId;
            }

            e.preventDefault();
            try {
                if (canvas.setPointerCapture && e.pointerId !== undefined) {
                    canvas.setPointerCapture(e.pointerId);
                }
            } catch (err) {}

            const pos = getCoords(e);

            // 1. Check if clicking on an interactive geometric tool (Ruler, Protractor, Set Square, Compass, Curtain)
            const geoHit = hitTestGeometricTools(pos.x, pos.y);
            if (geoHit) {
                if (geoHit.mode === 'close') {
                    if (geoHit.tool === 'ruler') toggleInteractiveRuler(false);
                    if (geoHit.tool === 'protractor') toggleInteractiveProtractor(false);
                    if (geoHit.tool === 'setSquare') toggleInteractiveSetSquare(false);
                    if (geoHit.tool === 'compass') toggleInteractiveCompass(false);
                    if (geoHit.tool === 'curtain') toggleBoardCurtain(false);
                    return;
                }
                if (geoHit.mode === 'stamp_angle' && geoHit.tool === 'protractor') {
                    stampProtractorAngleToInk();
                    return;
                }
                if (geoHit.mode === 'stamp_right_angle' && geoHit.tool === 'setSquare') {
                    stampSetSquareRightAngleToInk();
                    return;
                }
                if (geoHit.mode === 'stamp_compass_circle' && geoHit.tool === 'compass') {
                    stampCompassCircleToInk();
                    return;
                }
                if (geoHit.mode === 'stamp_compass_arc' && geoHit.tool === 'compass') {
                    stampCompassArcToInk();
                    return;
                }
                if (geoHit.mode === 'draw_edge' && geoHit.tool === 'ruler') {
                    drawFullRulerEdgeToInk();
                    return;
                }
                const targetState = geoHit.tool === 'ruler' ? rulerState : (geoHit.tool === 'protractor' ? protractorState : (geoHit.tool === 'compass' ? compassState : (geoHit.tool === 'curtain' ? curtainState : setSquareState)));
                activeGeoInteraction = {
                    tool: geoHit.tool,
                    mode: geoHit.mode,
                    startX: pos.x,
                    startY: pos.y,
                    origX: targetState.x || 0,
                    origY: targetState.y || 0,
                    origAngle: targetState.angle || 0,
                    origLength: targetState.length || 440,
                    origSize: targetState.size || 260,
                    origRadius: targetState.radius || 120,
                    startPointerAngle: Math.atan2(pos.y - (targetState.y || 0), pos.x - (targetState.x || 0))
                };
                canvas.style.cursor = geoHit.mode === 'rotate' ? 'grabbing' : (geoHit.tool === 'curtain' ? 'ns-resize' : 'move');
                return;
            }

            if (currentTool === 'pan') {
                isPanning = true;
                panStartX = pos.x - pdfPanOffset.x;
                panStartY = pos.y - pdfPanOffset.y;
                canvas.style.cursor = 'grabbing';
                return;
            }

            // Select / Move / Resize / Duplicate / Delete Vector Objects
            if (currentTool === 'select' && window.WbVectorEngine) {
                const arr = getActiveVectorArray();
                const env = getVectorEnv();
                if (selectedVectorIndex >= 0 && selectedVectorIndex < arr.length) {
                    const selObj = arr[selectedVectorIndex];
                    const selB = window.WbVectorEngine.getObjectBounds(selObj, env);
                    const handle = window.WbVectorEngine.hitTestSelectionHandle(pos.x, pos.y, selB);
                    if (handle === 'delete') {
                        saveStateForUndo();
                        const deleted = arr.splice(selectedVectorIndex, 1)[0];
                        selectedVectorIndex = -1;
                        replayVectorStrokesToCanvas(arr);
                        renderGeometricToolsOverlay();
                        persistWhiteboardState();
                        if (collabClient && collabClient.roomCode && deleted && deleted.id) {
                            collabClient.send('object:delete', { objectId: deleted.id });
                        }
                        return;
                    }
                    if (handle === 'duplicate') {
                        saveStateForUndo();
                        const copy = cloneVectorObj(selObj);
                        copy.id = window.WbVectorEngine.uid('obj');
                        window.WbVectorEngine.moveVectorObject(copy, 22, 22, env);
                        pushVectorObject(copy);
                        selectedVectorIndex = arr.length - 1;
                        replayVectorStrokesToCanvas(arr);
                        renderGeometricToolsOverlay();
                        persistWhiteboardState();
                        return;
                    }
                    if (handle) {
                        saveStateForUndo();
                        activeSelectInteraction = {
                            mode: handle,
                            index: selectedVectorIndex,
                            origObj: cloneVectorObj(selObj),
                            origBounds: selB,
                            startX: pos.x,
                            startY: pos.y
                        };
                        canvas.style.cursor = handle === 'move' ? 'grabbing' : 'nwse-resize';
                        return;
                    }
                }

                const hitIdx = window.WbVectorEngine.hitTestObjects(pos.x, pos.y, arr, env);
                selectedVectorIndex = hitIdx;
                if (hitIdx >= 0) {
                    saveStateForUndo();
                    const hitObj = arr[hitIdx];
                    activeSelectInteraction = {
                        mode: 'move',
                        index: hitIdx,
                        origObj: cloneVectorObj(hitObj),
                        origBounds: window.WbVectorEngine.getObjectBounds(hitObj, env),
                        startX: pos.x,
                        startY: pos.y
                    };
                    canvas.style.cursor = 'grabbing';
                } else {
                    canvas.style.cursor = 'default';
                }
                renderGeometricToolsOverlay();
                return;
            }

            // Whole-Stroke Vector Eraser
            if (currentTool === 'stroke_eraser' && window.WbVectorEngine) {
                const arr = getActiveVectorArray();
                const hitIdx = window.WbVectorEngine.hitTestObjects(pos.x, pos.y, arr, getVectorEnv());
                if (hitIdx >= 0) {
                    saveStateForUndo();
                    const deleted = arr.splice(hitIdx, 1)[0];
                    if (selectedVectorIndex === hitIdx) selectedVectorIndex = -1;
                    else if (selectedVectorIndex > hitIdx) selectedVectorIndex--;
                    replayVectorStrokesToCanvas(arr);
                    renderGeometricToolsOverlay();
                    persistWhiteboardState();
                    if (collabClient && collabClient.roomCode && deleted && deleted.id) {
                        collabClient.send('object:delete', { objectId: deleted.id });
                    }
                }
                return;
            }

            if (currentTool === 'text') {
                promptAndInsertText(pos.x, pos.y);
                return;
            }

            // Homework Evaluation Stamp Mode: click to place stamp on paper
            if (homeworkCorrectionState.active && homeworkCorrectionState.activeStamp) {
                placeHomeworkStamp(pos.x, pos.y, homeworkCorrectionState.activeStamp);
                return;
            }

            // Student Call Mode: check student pen lock
            if (studentCallState.active && studentCallState.studentRole === 'student' && studentCallState.isLocked) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('قلم التلميذ مقفل حالياً من طرف الأستاذ للتوجيه', 'info');
                }
                return;
            }

            if (currentTool === 'laser') {
                const now = performance.now();
                laserPointerPos = { x: pos.x, y: pos.y };
                laserTrailPoints.push({ x: pos.x, y: pos.y, t: now });
                if (laserTrailPoints.length > 48) laserTrailPoints.shift();
                startLaserTrailLoop();
                renderGeometricToolsOverlay();
                return;
            }

            if (currentTool === 'spotlight') {
                spotlightState.active = true;
                spotlightState.x = pos.x;
                spotlightState.y = pos.y;
                renderGeometricToolsOverlay();
                return;
            }

            // Snap point to active geometric tool if drawing near ruler or set square edge
            const snappedPos = snapPointToToolsIfClose(pos.x, pos.y);

            isDrawing = true;
            startX = snappedPos.x;
            startY = snappedPos.y;
            lastX = snappedPos.x;
            lastY = snappedPos.y;

            saveStateForUndo();

            // Always capture snapshot so Shift+Pen straight line constraint never wipes previous strokes
            const snapUrl = undoStack[undoStack.length - 1];
            if (snapUrl) {
                shapeSnapshotImg = new Image();
                shapeSnapshotImg.src = snapUrl;
            }

            if (proofRecording.isRecording) {
                currentRecordedStroke = {
                    tool: currentTool,
                    color: (studentCallState.active && studentCallState.studentRole === 'student') ? studentCallState.studentColor : currentColor,
                    size: currentSize,
                    startTime: Date.now() - proofRecording.startTime,
                    points: [{ x: snappedPos.x, y: snappedPos.y, t: Date.now() - proofRecording.startTime, pressure: pos.pressure || 0.5 }]
                };
            }

            // Initialize lightweight Vector Stroke object (~50 bytes per stroke)
            const strokeColor = (studentCallState.active && studentCallState.studentRole === 'student') ? studentCallState.studentColor : currentColor;
            const qx = Math.round(snappedPos.x * 10) / 10;
            const qy = Math.round(snappedPos.y * 10) / 10;
            const strokeId = window.WbVectorEngine ? window.WbVectorEngine.uid('st') : ('st_' + Date.now().toString(36));
            if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
                currentVectorStroke = {
                    id: strokeId,
                    t: currentTool,
                    c: strokeColor,
                    s: currentSize,
                    pts: [[qx, qy]]
                };
            } else {
                currentVectorStroke = {
                    id: strokeId,
                    t: currentTool,
                    c: strokeColor,
                    s: currentSize,
                    x1: qx,
                    y1: qy,
                    x2: qx,
                    y2: qy
                };
            }

            if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
                strokePoints = [{ x: snappedPos.x, y: snappedPos.y, pressure: pos.pressure }];
                ctx.save();
                applyDrawingStyle();

                // Draw initial contact dot
                ctx.beginPath();
                ctx.arc(snappedPos.x, snappedPos.y, Math.max(0.8, currentSize / 2), 0, Math.PI * 2);
                ctx.fill();
            }
        };

        const onPointerMove = (e) => {
            // Ignore touch if stylus is active
            if (activeStylusId !== null && e.pointerType === 'touch' && e.pointerId !== activeStylusId) {
                return;
            }

            const pos = getCoords(e);

            if (collabClient && collabClient.roomCode) {
                const nowMs = Date.now();
                if (nowMs - lastCursorSentAt > 55) {
                    lastCursorSentAt = nowMs;
                    collabClient.send('cursor:move', { x: Math.round(pos.x), y: Math.round(pos.y) });
                }
            }

            // Active Vector Select Move / Corner Resize
            if (activeSelectInteraction && window.WbVectorEngine) {
                e.preventDefault();
                const arr = getActiveVectorArray();
                const env = getVectorEnv();
                const idx = activeSelectInteraction.index;
                if (idx >= 0 && idx < arr.length) {
                    const updated = cloneVectorObj(activeSelectInteraction.origObj);
                    const dx = pos.x - activeSelectInteraction.startX;
                    const dy = pos.y - activeSelectInteraction.startY;
                    if (activeSelectInteraction.mode === 'move') {
                        window.WbVectorEngine.moveVectorObject(updated, dx, dy, env);
                    } else {
                        const ob = activeSelectInteraction.origBounds;
                        let nx = ob.x, ny = ob.y, nw = ob.w, nh = ob.h;
                        const m = activeSelectInteraction.mode;
                        if (m === 'se') {
                            nw = Math.max(24, ob.w + dx);
                            nh = Math.max(20, ob.h + dy);
                        } else if (m === 'nw') {
                            nw = Math.max(24, ob.w - dx);
                            nh = Math.max(20, ob.h - dy);
                            nx = ob.x + ob.w - nw;
                            ny = ob.y + ob.h - nh;
                        } else if (m === 'ne') {
                            nw = Math.max(24, ob.w + dx);
                            nh = Math.max(20, ob.h - dy);
                            ny = ob.y + ob.h - nh;
                        } else if (m === 'sw') {
                            nw = Math.max(24, ob.w - dx);
                            nh = Math.max(20, ob.h + dy);
                            nx = ob.x + ob.w - nw;
                        }
                        window.WbVectorEngine.scaleObjectToBounds(updated, ob, { x: nx, y: ny, w: nw, h: nh }, env);
                    }
                    arr[idx] = updated;
                    replayVectorStrokesToCanvas(arr);
                    renderGeometricToolsOverlay();
                }
                return;
            }

            // Active geometric tool transformation (moving, rotating, resizing, measuring angle, curtain)
            if (activeGeoInteraction) {
                e.preventDefault();
                if (activeGeoInteraction.tool === 'curtain') {
                    const h = lastValidHeight || (canvas && parseFloat(canvas.style.height)) || 640;
                    curtainState.y = Math.max(40, Math.min(h - 36, activeGeoInteraction.origY + (pos.y - activeGeoInteraction.startY)));
                    renderGeometricToolsOverlay();
                    return;
                }
                const target = activeGeoInteraction.tool === 'ruler' ? rulerState : (activeGeoInteraction.tool === 'protractor' ? protractorState : (activeGeoInteraction.tool === 'compass' ? compassState : setSquareState));
                if (activeGeoInteraction.mode === 'move') {
                    target.x = activeGeoInteraction.origX + (pos.x - activeGeoInteraction.startX);
                    target.y = activeGeoInteraction.origY + (pos.y - activeGeoInteraction.startY);
                } else if (activeGeoInteraction.mode === 'rotate') {
                    const currentPointerAngle = Math.atan2(pos.y - target.y, pos.x - target.x);
                    let newAngle = activeGeoInteraction.origAngle + (currentPointerAngle - activeGeoInteraction.startPointerAngle);
                    if (!e.shiftKey) {
                        const deg = ((newAngle * 180) / Math.PI) % 360;
                        const snapAngles = [-180, -150, -135, -120, -90, -60, -45, -30, 0, 30, 45, 60, 90, 120, 135, 150, 180];
                        for (let s of snapAngles) {
                            if (Math.abs(deg - s) < 1.4) {
                                newAngle = (s * Math.PI) / 180;
                                break;
                            }
                        }
                    }
                    target.angle = newAngle;
                } else if (activeGeoInteraction.mode === 'resize' && activeGeoInteraction.tool === 'ruler') {
                    const dx = pos.x - target.x;
                    const dy = pos.y - target.y;
                    const localX = dx * Math.cos(-target.angle) - dy * Math.sin(-target.angle);
                    target.length = Math.max(240, Math.min(880, Math.abs(localX) * 2));
                } else if (activeGeoInteraction.mode === 'resize' && activeGeoInteraction.tool === 'setSquare') {
                    const dx = pos.x - target.x;
                    const dy = pos.y - target.y;
                    const localDist = Math.hypot(dx, dy);
                    target.size = Math.max(180, Math.min(520, localDist));
                } else if (activeGeoInteraction.mode === 'resize' && activeGeoInteraction.tool === 'compass') {
                    const dist = Math.hypot(pos.x - target.x, pos.y - target.y);
                    target.radius = Math.max(30, Math.min(340, Math.round(dist)));
                    target.angle = Math.atan2(pos.y - target.y, pos.x - target.x);
                } else if (activeGeoInteraction.mode === 'ray' && activeGeoInteraction.tool === 'protractor') {
                    const dx = pos.x - target.x;
                    const dy = pos.y - target.y;
                    const localX = dx * Math.cos(-target.angle) - dy * Math.sin(-target.angle);
                    const localY = dx * Math.sin(-target.angle) + dy * Math.cos(-target.angle);
                    let angleRad = Math.atan2(-localY, localX);
                    if (angleRad < 0) angleRad = localX >= 0 ? 0 : Math.PI;
                    let deg = Math.round((angleRad * 180) / Math.PI);
                    deg = Math.max(0, Math.min(180, deg));
                    target.rayAngleDeg = deg;
                }
                renderGeometricToolsOverlay();
                return;
            }

            if (isPanning) {
                e.preventDefault();
                const nextX = pos.x - panStartX;
                const nextY = pos.y - panStartY;
                const dx = nextX - pdfPanOffset.x;
                const dy = nextY - pdfPanOffset.y;
                pdfPanOffset.x = nextX;
                pdfPanOffset.y = nextY;
                shiftInkCanvasAndVectorsByDelta(dx, dy);
                drawBackground();
                syncPdfVerticalSliderUI();
                return;
            }

            if (currentTool === 'laser') {
                const now = performance.now();
                laserPointerPos = { x: pos.x, y: pos.y };
                laserTrailPoints.push({ x: pos.x, y: pos.y, t: now });
                if (laserTrailPoints.length > 48) laserTrailPoints.shift();
                startLaserTrailLoop();
                renderGeometricToolsOverlay();
                return;
            }

            if (currentTool === 'spotlight') {
                spotlightState.active = true;
                spotlightState.x = pos.x;
                spotlightState.y = pos.y;
                renderGeometricToolsOverlay();
                return;
            }

            if (studentCallState.active) {
                studentCursorPos = { x: pos.x, y: pos.y };
                renderGeometricToolsOverlay();
            }

            // Hover state feedback
            if (!isDrawing) {
                const hoverHit = hitTestGeometricTools(pos.x, pos.y);
                if (hoverHit) {
                    if (hoverHit.mode === 'rotate' || hoverHit.mode === 'ray') canvas.style.cursor = 'grab';
                    else if (hoverHit.mode === 'resize') canvas.style.cursor = 'nwse-resize';
                    else if (hoverHit.mode === 'close' || hoverHit.mode === 'stamp_angle' || hoverHit.mode === 'stamp_right_angle' || hoverHit.mode === 'draw_edge') canvas.style.cursor = 'pointer';
                    else canvas.style.cursor = 'move';
                } else if (currentTool === 'select' && window.WbVectorEngine) {
                    const arr = getActiveVectorArray();
                    let cur = 'default';
                    if (selectedVectorIndex >= 0 && selectedVectorIndex < arr.length) {
                        const selB = window.WbVectorEngine.getObjectBounds(arr[selectedVectorIndex], getVectorEnv());
                        const h = window.WbVectorEngine.hitTestSelectionHandle(pos.x, pos.y, selB);
                        if (h === 'move') cur = 'move';
                        else if (h === 'delete' || h === 'duplicate') cur = 'pointer';
                        else if (h === 'nw' || h === 'se') cur = 'nwse-resize';
                        else if (h === 'ne' || h === 'sw') cur = 'nesw-resize';
                    }
                    if (cur === 'default' && window.WbVectorEngine.hitTestObjects(pos.x, pos.y, arr, getVectorEnv()) >= 0) {
                        cur = 'move';
                    }
                    canvas.style.cursor = cur;
                } else {
                    if (currentTool === 'pan') canvas.style.cursor = 'grab';
                    else if (currentTool === 'text') canvas.style.cursor = 'text';
                    else if (currentTool === 'laser' || currentTool === 'stroke_eraser') canvas.style.cursor = 'pointer';
                    else canvas.style.cursor = 'crosshair';
                }
                return;
            }

            e.preventDefault();
            const snappedPos = snapPointToToolsIfClose(pos.x, pos.y);

            if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
                // Auto straight line constraint when holding Shift key
                if (e.shiftKey) {
                    const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                    const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
                    clearInkCanvasInternal();
                    if (shapeSnapshotImg && shapeSnapshotImg.complete) {
                        ctx.drawImage(shapeSnapshotImg, 0, 0, w, h);
                    }
                    drawShapePreview(startX, startY, snappedPos.x, snappedPos.y, 'line');
                    if (currentVectorStroke) {
                        currentVectorStroke = {
                            id: currentVectorStroke.id,
                            t: 'line',
                            c: currentVectorStroke.c,
                            s: currentVectorStroke.s,
                            x1: Math.round(startX * 10) / 10,
                            y1: Math.round(startY * 10) / 10,
                            x2: Math.round(snappedPos.x * 10) / 10,
                            y2: Math.round(snappedPos.y * 10) / 10
                        };
                    }
                    return;
                }

                // Smooth handwriting with Midpoint Quadratic Bezier Curves
                strokePoints.push({ x: snappedPos.x, y: snappedPos.y, pressure: pos.pressure });
                const len = strokePoints.length;

                if (currentVectorStroke && Array.isArray(currentVectorStroke.pts)) {
                    const lastVecPt = currentVectorStroke.pts[currentVectorStroke.pts.length - 1];
                    const qx = Math.round(snappedPos.x * 10) / 10;
                    const qy = Math.round(snappedPos.y * 10) / 10;
                    if (!lastVecPt || Math.hypot(qx - lastVecPt[0], qy - lastVecPt[1]) >= 1.2) {
                        currentVectorStroke.pts.push([qx, qy]);
                    }
                }

                if (proofRecording.isRecording && currentRecordedStroke) {
                    currentRecordedStroke.points.push({
                        x: snappedPos.x,
                        y: snappedPos.y,
                        t: Date.now() - proofRecording.startTime,
                        pressure: pos.pressure || 0.5
                    });
                }

                // Stylus pressure modulation for authentic mathematical pen strokes
                if (pos.pointerType === 'pen' && pos.pressure > 0 && currentTool === 'pen') {
                    ctx.lineWidth = Math.max(1, currentSize * (0.6 + pos.pressure * 0.8));
                }

                if (len >= 3) {
                    const p0 = strokePoints[len - 3];
                    const p1 = strokePoints[len - 2];
                    const p2 = strokePoints[len - 1];

                    const mid1X = (p0.x + p1.x) / 2;
                    const mid1Y = (p0.y + p1.y) / 2;
                    const mid2X = (p1.x + p2.x) / 2;
                    const mid2Y = (p1.y + p2.y) / 2;

                    ctx.beginPath();
                    ctx.moveTo(mid1X, mid1Y);
                    ctx.quadraticCurveTo(p1.x, p1.y, mid2X, mid2Y);
                    ctx.stroke();
                } else if (len === 2) {
                    ctx.beginPath();
                    ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
                    ctx.lineTo(strokePoints[1].x, strokePoints[1].y);
                    ctx.stroke();
                }
                lastX = snappedPos.x;
                lastY = snappedPos.y;
            } else {
                if (currentVectorStroke) {
                    currentVectorStroke.x2 = Math.round(snappedPos.x * 10) / 10;
                    currentVectorStroke.y2 = Math.round(snappedPos.y * 10) / 10;
                }
                if (proofRecording.isRecording && currentRecordedStroke) {
                    const relT = Date.now() - proofRecording.startTime;
                    if (currentRecordedStroke.points.length <= 1) {
                        currentRecordedStroke.points.push({ x: snappedPos.x, y: snappedPos.y, t: relT, pressure: pos.pressure || 0.5 });
                    } else {
                        currentRecordedStroke.points[1] = { x: snappedPos.x, y: snappedPos.y, t: relT, pressure: pos.pressure || 0.5 };
                    }
                }
                const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
                clearInkCanvasInternal();
                if (shapeSnapshotImg && shapeSnapshotImg.complete) {
                    ctx.drawImage(shapeSnapshotImg, 0, 0, w, h);
                }
                drawShapePreview(startX, startY, snappedPos.x, snappedPos.y, currentTool);
            }
        };

        const onPointerUp = (e) => {
            if (e && e.pointerId && activeStylusId === e.pointerId) {
                activeStylusId = null;
            }
            if (e && e.pointerId && canvas.releasePointerCapture) {
                try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
            }
            if (activeSelectInteraction) {
                const idx = activeSelectInteraction.index;
                activeSelectInteraction = null;
                const arr = getActiveVectorArray();
                if (collabClient && collabClient.roomCode && idx >= 0 && arr[idx]) {
                    collabClient.send('object:update', { object: arr[idx] });
                }
                canvas.style.cursor = 'default';
                persistWhiteboardState();
                return;
            }
            if (activeGeoInteraction) {
                activeGeoInteraction = null;
                persistWhiteboardState();
                return;
            }
            if (isPanning) {
                isPanning = false;
                canvas.style.cursor = 'grab';
                return;
            }
            if (currentTool === 'laser') {
                laserPointerPos = null;
                startLaserTrailLoop();
                renderGeometricToolsOverlay();
                return;
            }
            if (currentTool === 'spotlight') {
                renderGeometricToolsOverlay();
                return;
            }
            if (!isDrawing) return;
            isDrawing = false;
            strokePoints = [];

            if (currentVectorStroke) {
                pushVectorObject(currentVectorStroke);
                currentVectorStroke = null;
            }

            if (proofRecording.isRecording && currentRecordedStroke) {
                currentRecordedStroke.endTime = Date.now() - proofRecording.startTime;
                proofRecording.strokes.push(currentRecordedStroke);
                currentRecordedStroke = null;
                updateProofRecordingUI();
            }

            ctx.restore();
            persistWhiteboardState();
        };

        // Pointer Events API (supports Mouse, Stylus/Pen with Pressure, and Multi-touch with Palm Rejection)
        if (window.PointerEvent) {
            canvas.addEventListener('pointerdown', onPointerDown);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        } else {
            // Fallback for older browsers
            canvas.addEventListener('mousedown', onPointerDown);
            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
            canvas.addEventListener('touchstart', onPointerDown, { passive: false });
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp, { passive: false });
        }

        // Double-click any lesson_header object on canvas to customize or update it in-place
        canvas.addEventListener('dblclick', (e) => {
            if (!window.WbVectorEngine) return;
            const arr = getActiveVectorArray();
            if (!Array.isArray(arr) || arr.length === 0) return;
            const pos = getCoords(e);
            const hitIdx = window.WbVectorEngine.hitTestObjects(pos.x, pos.y, arr, getVectorEnv());
            if (hitIdx >= 0 && arr[hitIdx] && arr[hitIdx].t === 'lesson_header') {
                e.preventDefault();
                selectedVectorIndex = hitIdx;
                openLessonHeaderModal(hitIdx);
            }
        });

        // Wheel zoom/scroll when PDF is active, spotlight radius, or rotate geometric tools when hovering over them
        canvas.addEventListener('wheel', (e) => {
            if (currentTool === 'spotlight') {
                e.preventDefault();
                spotlightState.radius = Math.max(60, Math.min(280, spotlightState.radius + (e.deltaY < 0 ? 12 : -12)));
                spotlightState.active = true;
                renderGeometricToolsOverlay();
                return;
            }

            const pos = getCoords(e);
            const hoverHit = hitTestGeometricTools(pos.x, pos.y);
            if (hoverHit && hoverHit.tool !== 'curtain') {
                e.preventDefault();
                const target = hoverHit.tool === 'ruler' ? rulerState : (hoverHit.tool === 'protractor' ? protractorState : (hoverHit.tool === 'compass' ? compassState : setSquareState));
                if (hoverHit.tool === 'compass' && e.ctrlKey) {
                    target.radius = Math.max(30, Math.min(340, (target.radius || 120) + (e.deltaY < 0 ? 6 : -6)));
                } else {
                    const stepDeg = e.shiftKey ? 5 : 1;
                    const deltaRad = ((e.deltaY < 0 ? stepDeg : -stepDeg) * Math.PI) / 180;
                    target.angle = (target.angle || 0) + deltaRad;
                }
                renderGeometricToolsOverlay();
                return;
            }

            if (!isPdfOrWorksheetActive()) return;
            e.preventDefault();
            if (e.ctrlKey) {
                zoomWhiteboardPdf(e.deltaY < 0 ? 0.15 : -0.15);
            } else {
                if (e.deltaY !== 0) {
                    scrollWhiteboardPdfVertical(e.deltaY * 0.85);
                }
                if (e.deltaX !== 0) {
                    scrollWhiteboardPdfHorizontal(-e.deltaX * 0.7);
                }
            }
        }, { passive: false });
    }

    function applyDrawingStyle() {
        if (!ctx) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let effectiveColor = currentColor;
        let effectiveSize = currentSize;
        if (studentCallState.active && studentCallState.studentRole === 'student') {
            effectiveColor = studentCallState.studentColor;
            effectiveSize = studentCallState.studentSize;
        }

        if (currentTool === 'pen') {
            ctx.strokeStyle = effectiveColor;
            ctx.lineWidth = effectiveSize;
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        } else if (currentTool === 'highlighter') {
            ctx.strokeStyle = effectiveColor;
            ctx.lineWidth = Math.max(12, effectiveSize * 4);
            ctx.globalAlpha = 0.28;
            ctx.globalCompositeOperation = 'source-over';
        } else if (currentTool === 'eraser') {
            // لأن الرسم على طبقة مستقلة (#mathWhiteboardCanvas)، الممحاة تمسح الحبر فقط دون المساس بالخلفية أو الـ PDF!
            ctx.lineWidth = Math.max(16, effectiveSize * 5);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            ctx.globalAlpha = 1.0;
        }
    }

    function drawShapePreview(x1, y1, x2, y2, tool) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (tool === 'line') {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

        } else if (tool === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            const angle = Math.atan2(dy, dx);
            const headLen = 12 + currentSize * 1.5;
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

        } else if (tool === 'rect') {
            ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(dx), Math.abs(dy));

        } else if (tool === 'circle') {
            const radius = Math.sqrt(dx * dx + dy * dy);
            ctx.beginPath();
            ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x1, y1, 3, 0, 2 * Math.PI);
            ctx.fill();

        } else if (tool === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x1, y2);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * رسم معلم متعامد ممنظم (O, i, j)
     */
    function drawCartesianAxes() {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const obj = { t: 'axes', x: 0, y: 0, w, h, step: 40, c: currentColor };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification('📐 تم إدراج معلم متعامد ممنظم مدرج مع شبكة إحداثيات (O, i, j)', 'success');
        }
    }

    /**
     * رسم الدائرة المثلثية مع الزوايا الشهيرة
     */
    function drawTrigonometricCircle() {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const side = Math.min(w, h) * 0.88;
        const obj = {
            t: 'trig_circle',
            x: Math.floor((w - side) / 2),
            y: Math.floor((h - side) / 2),
            w: side,
            h: side,
            c: currentColor
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification('⭕ تم إدراج الدائرة المثلثية مع الزوايا الشهيرة', 'success');
        }
    }

    /**
     * رسم منحنى دالة رياضية ومقارباتها ومماسها
     */
    function drawMathCurve(curveType) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const labels = {
            parabola: 'Cf : f(x) = x²',
            homographic: 'Cf : f(x) = (2x - 1)/(x - 1)',
            sqrt: 'Cf : f(x) = √x',
            inv: 'Cf : f(x) = 1/x',
            sin: 'Cf : f(x) = sin(x)',
            cos: 'Cf : f(x) = cos(x)',
            tan: 'Cf : f(x) = tan(x)',
            cube: 'Cf : f(x) = x³',
            abs: 'Cf : f(x) = |x|',
            ln: 'Cf : f(x) = ln(x)',
            exp: 'Cf : f(x) = eˣ',
            gaussian: 'Cf : f(x) = 2.5 e^(-x²)',
            tangent: '(T) : y = 2x - 1 (مماس Cf عند A(1,1))'
        };
        const obj = {
            t: 'math_curve',
            curveType,
            label: labels[curveType] || 'Cf',
            x: 0,
            y: 0,
            w,
            h,
            scale: 40,
            c: currentColor,
            s: Math.max(2.5, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`📉 تم رسم منحنى الدالة: ${labels[curveType] || curveType}`, 'success');
        }
    }

    /**
     * إدراج رمز رياضي على السبورة
     */
    function insertMathSymbol(sym) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const offsetX = Math.floor((Math.random() - 0.5) * 80);
        const offsetY = Math.floor((Math.random() - 0.5) * 50);
        const fontSize = Math.max(24, currentSize * 7);
        const obj = {
            t: 'text',
            x: Math.floor(w / 2 - 20 + offsetX),
            y: Math.floor(h / 2 - fontSize / 2 + offsetY),
            text: sym,
            fontSize,
            fontFamily: '"Cairo", serif',
            c: currentColor,
            s: currentSize
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`تم إدراج الرمز الرياضي: ${sym}`, 'info');
        }
    }

    /**
     * إدخال نص أو معادلة مخصصة على السبورة
     */
    function promptAndInsertText(x, y) {
        const container = canvas.parentElement;
        if (!container) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'اكتب الحل أو المعادلة واضغط Enter...';
        input.style.position = 'absolute';
        input.style.left = `${Math.min(x, (lastValidWidth || 600) - 250)}px`;
        input.style.top = `${Math.max(10, y - 16)}px`;
        input.style.zIndex = '100';
        input.style.background = '#ffffff';
        input.style.border = '2px solid #2563eb';
        input.style.borderRadius = '8px';
        input.style.padding = '6px 12px';
        input.style.fontSize = `${Math.max(15, currentSize * 4)}px`;
        input.style.fontFamily = "'Cairo', system-ui, sans-serif";
        input.style.fontWeight = '700';
        input.style.color = currentColor === '#ffffff' ? '#0f172a' : currentColor;
        input.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)';
        input.style.outline = 'none';
        input.style.minWidth = '240px';

        let committed = false;
        const commitText = () => {
            if (committed) return;
            committed = true;
            const val = input.value.trim();
            if (input.parentElement) input.remove();
            if (!val || !ctx) return;
            saveStateForUndo();
            const fontSize = Math.max(17, currentSize * 5);
            const obj = {
                t: 'text',
                x,
                y: Math.max(8, y - 4),
                text: val,
                fontSize,
                fontFamily: '"Cairo", sans-serif',
                c: currentColor,
                s: currentSize
            };
            pushVectorObject(obj);
            drawVectorObjectOnCtx(obj);
            persistWhiteboardState();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitText();
            } else if (e.key === 'Escape') {
                committed = true;
                input.remove();
            }
        });

        input.addEventListener('blur', commitText);
        container.appendChild(input);
        setTimeout(() => input.focus(), 30);
    }

    // ====================================================================
    // استيراد ومعاينة ملفات PDF والاشتغال عليها (PDF Preview & Annotation)
    // ====================================================================

    function triggerWhiteboardPdfImport() {
        const fileInput = document.getElementById('whiteboardPdfInput');
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    }

    function setupDragAndDropPdf() {
        const container = document.getElementById('whiteboardCanvasContainer');
        const overlay = document.getElementById('whiteboardDropOverlay');
        if (!container) return;

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (overlay) overlay.style.display = 'flex';
        });

        container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (overlay) overlay.style.display = 'none';
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            if (overlay) overlay.style.display = 'none';
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length > 0) {
                loadPdfFileObject(files[0]);
            }
        });
    }

    async function handleWhiteboardPdfFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        await loadPdfFileObject(file);
    }

    async function loadPdfFileObject(file) {
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            if (typeof window.showNotification === 'function') {
                window.showNotification('يرجى اختيار ملف بصيغة PDF صالح (فرض، سلسلة تمارين، كتاب مدرسي).', 'warning');
            }
            return;
        }

        if (!window.pdfjsLib && typeof window.ensurePdfJsLoaded === 'function') {
            await window.ensurePdfJsLoaded();
        }
        if (!window.pdfjsLib) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('مكتبة PDF.js غير متوفرة حالياً.', 'error');
            }
            return;
        }

        try {
            if (typeof window.showNotification === 'function') {
                window.showNotification('⏳ جاري فتح ومعالجة صفحات ملف PDF للمعاينة والاشتغال...', 'info');
            }

            const arrayBuffer = await file.arrayBuffer();
            await loadPdfFromArrayBuffer(arrayBuffer, file.name);
        } catch (err) {
            console.error('Error loading PDF into whiteboard:', err);
            if (typeof window.showNotification === 'function') {
                window.showNotification('تعذر فتح ملف PDF: ' + (err.message || 'خطأ غير متوقع'), 'error');
            }
        }
    }

    async function loadPdfFromArrayBuffer(arrayBuffer, fileName) {
        if (currentPdfDoc && typeof currentPdfDoc.destroy === 'function') {
            try { currentPdfDoc.destroy(); } catch (e) {}
            currentPdfDoc = null;
        }
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        currentPdfDoc = await loadingTask.promise;
        isSampleWorksheetActive = false;
        if (Array.isArray(sampleWorksheetPages)) {
            sampleWorksheetPages.forEach(c => { if (c) { c.width = 0; c.height = 0; } });
        }
        sampleWorksheetPages = [];

        currentPdfFileName = fileName || 'مستند_رياضيات.pdf';
        pdfTotalPages = currentPdfDoc.numPages;
        currentPdfPageNum = 1;
        pdfPageDataUrls = {};
        pdfPageVectorStrokes = {};
        selectedVectorIndex = -1;
        pdfZoom = 1.0;
        pdfRotation = 0;
        pdfPanOffset = { x: 0, y: 0 };

        activatePdfWorkspaceUI(currentPdfFileName, pdfTotalPages);

        clearInkCanvasInternal();
        resetUndoHistory();

        await renderActiveDocumentPage(1, false);
        await buildPdfThumbnailsSidebar();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`📄 تم فتح "${currentPdfFileName}" (${pdfTotalPages} صفحات) - يمكنك الآن الشرح والحل فوقه مباشرة!`, 'success');
        }
    }

    function activatePdfWorkspaceUI(title, totalPages) {
        const tb = document.getElementById('whiteboardPdfToolbar');
        if (tb) tb.style.display = 'flex';

        const badge = document.getElementById('whiteboardPdfActiveBadge');
        if (badge) badge.style.display = 'inline-flex';

        const nameLabel = document.getElementById('whiteboardPdfNameLabel');
        if (nameLabel) nameLabel.textContent = title;

        const pageInput = document.getElementById('whiteboardPdfPageInput');
        if (pageInput) {
            pageInput.max = String(totalPages);
            pageInput.value = '1';
        }

        const thumbsPanel = document.getElementById('whiteboardPdfThumbnailsPanel');
        if (thumbsPanel) {
            thumbsPanel.style.display = isThumbnailsOpen ? 'flex' : 'none';
        }

        const vertNav = document.getElementById('whiteboardPdfVerticalNavOverlay');
        if (vertNav) {
            vertNav.style.display = 'flex';
        }

        setTimeout(() => resizeCanvas(false), 40);
    }

    /**
     * توليد نموذج فرض محروس / سلسلة تمارين رياضيات متعددة الصفحات للاشتغال المباشر
     */
    async function loadSampleMathPdfWorksheet() {
        currentPdfDoc = null;
        isSampleWorksheetActive = true;
        currentPdfFileName = 'فرض_محروس_نموذجي_الرياضيات_ثانوي_تأهيلي.pdf';
        pdfTotalPages = 3;
        currentPdfPageNum = 1;
        pdfPageDataUrls = {};
        pdfPageVectorStrokes = {};
        selectedVectorIndex = -1;
        pdfZoom = 1.0;
        pdfRotation = 0;
        pdfPanOffset = { x: 0, y: 0 };

        sampleWorksheetPages = [
            createSampleWorksheetCanvasPage(1),
            createSampleWorksheetCanvasPage(2),
            createSampleWorksheetCanvasPage(3)
        ];

        activatePdfWorkspaceUI(currentPdfFileName, pdfTotalPages);
        clearInkCanvasInternal();
        resetUndoHistory();

        await renderActiveDocumentPage(1, false);
        await buildPdfThumbnailsSidebar();

        if (typeof window.showNotification === 'function') {
            window.showNotification('📝 تم فتح نموذج الفرض المحروس (3 صفحات) للمعاينة والحل المباشر فوق السبورة!', 'success');
        }
    }

    function createSampleWorksheetCanvasPage(pageNumber) {
        const pageW = 794; // A4 width at 96 DPI
        const pageH = 1123;
        const c = document.createElement('canvas');
        c.width = pageW * 2;
        c.height = pageH * 2;
        const g = c.getContext('2d');
        g.scale(2, 2);

        // White paper background
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, pageW, pageH);

        // Top official Moroccan border
        g.strokeStyle = '#1e3a8a';
        g.lineWidth = 2;
        g.strokeRect(28, 28, pageW - 56, pageH - 56);

        // Header Box
        g.fillStyle = '#f8fafc';
        g.fillRect(36, 36, pageW - 72, 86);
        g.strokeStyle = '#cbd5e1';
        g.lineWidth = 1;
        g.strokeRect(36, 36, pageW - 72, 86);

        g.fillStyle = '#0f172a';
        g.font = 'bold 14px "Cairo", sans-serif';
        g.textAlign = 'right';
        g.fillText('المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل', pageW - 50, 60);
        const tp = (window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile()) || {};
        const acadYear = (window.WbSecurityMath && window.WbSecurityMath.getAcademicYearLabel()) || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
        g.fillStyle = '#1e3a8a';
        g.font = 'bold 13px "Cairo", sans-serif';
        g.fillText(`${tp.specialty || 'مادة الرياضيات | السلك الثانوي التأهيلي'} | الأستاذ(ة): ${tp.name || 'الأستاذ(ة)'}`, pageW - 50, 84);
        g.fillStyle = '#475569';
        g.font = 'bold 12px "Cairo", sans-serif';
        g.fillText(`الفرض المحروس النموذجي رقم 1 - الصفحة ${pageNumber} من 3 (الموسم الدراسي ${acadYear})`, pageW - 50, 108);

        // Content by Page
        g.textAlign = 'right';
        if (pageNumber === 1) {
            drawWorksheetSection(g, pageW, 150, 'التمرين الأول (7 نقط): المتتاليات العددية والبرهان بالترجع', [
                'نعتبر المتتالية العددية (uₙ) المعرفة بما يلي: u₀ = 2 و uₙ₊₁ = (3uₙ + 4) / (uₙ + 3) لكل n من ℕ.',
                '1) احسب الحدين u₁ و u₂ ثم تحقق أن المتتالية (uₙ) ليست حسابية وليست هندسية.',
                '2) برهن بالترجع أنه لكل n من ℕ :  1 < uₙ ≤ 2.',
                '3) أدرس رتابة المتتالية (uₙ) واستنتج أنها متقاربة.',
                '4) نضع لكل n من ℕ : vₙ = (uₙ - 2) / (uₙ + 2). بين أن (vₙ) متتالية هندسية محدداً أساسها q وحدها الأول v₀.'
            ], 260);

            drawWorksheetSection(g, pageW, 560, 'التمرين الثاني (6 نقط): اتصال واشتقاق دالة عددية', [
                'لتكن f الدالة العددية المعرفة على المجال [0, +∞[ بما يلي:  f(x) = x - 2√x + 2.',
                '1) احسب نهاية الدالة f عند +∞ ثم الفروع اللانهائية للمنحنى (Cf).',
                '2) أدرس قابلية اشتقاق الدالة f على اليمين في النقطة x₀ = 0 وأعط تأويلاً هندسياً للنتيجة.',
                '3) بين أنه لكل x من ]0, +∞[ :  f\'(x) = (√x - 1) / √x  ثم ضع جدول تغيرات الدالة f.'
            ], 260);
        } else if (pageNumber === 2) {
            drawWorksheetSection(g, pageW, 150, 'التمرين الثالث (7 نقط): الدراسة التحليلية للدالة اللوغاريتمية والأسية', [
                'نعتبر الدالة العددية g المعرفة على ]0, +∞[ بما يلي:  g(x) = x² - 1 + 2 ln(x).',
                '1) احسب g(1) ثم بالاعتماد على رتابة الدالة g حدد إشارة g(x) على المجال ]0, +∞[.',
                '2) نعتبر الدالة f المعرفة على ]0, +∞[ بـ:  f(x) = x - 1 - (ln(x) / x).',
                '   أ) بين أنه لكل x من ]0, +∞[ :  f\'(x) = g(x) / x².',
                '   ب) استنتج تغيرات الدالة f ثم أنشئ المنحنى (Cf) في معلم متعامد ممنظم (O, i⃗, j⃗).'
            ], 420);
        } else {
            drawWorksheetSection(g, pageW, 150, 'التمرين الرابع (6 نقط): الهندسة الفضائية والجداء السلمي والفلكة', [
                'في الفضاء المنسوب إلى معلم متعامد ممنظم مباشر (O, i⃗, j⃗, k⃗)، نعتبر النقط A(1, 2, -1) و B(3, 0, 1)',
                'والمستوى (P) ذا المعادلة الديكارتية:  x - y + z - 2 = 0.',
                '1) حدد تمثيلاً بارامترياً للمستقيم (Δ) المار من A والعمودي على المستوى (P).',
                '2) احسب المسافة d(B, (P)) بين النقطة B والمستوى (P).',
                '3) حدد معادلة ديكارتية للفلكة (S) التي مركزها B وتقطع المستوى (P) وفق دائرة شعاعها r = 2.'
            ], 420);
        }

        return c;
    }

    function drawWorksheetSection(g, pageW, startY, title, lines, workAreaHeight) {
        // Exercise Title Bar
        g.fillStyle = '#eff6ff';
        g.fillRect(36, startY, pageW - 72, 34);
        g.strokeStyle = '#93c5fd';
        g.strokeRect(36, startY, pageW - 72, 34);

        g.fillStyle = '#1e3a8a';
        g.font = 'bold 14px "Cairo", sans-serif';
        g.fillText(title, pageW - 48, startY + 23);

        // Questions
        g.fillStyle = '#1e293b';
        g.font = 'bold 13px "Cairo", sans-serif';
        let y = startY + 60;
        lines.forEach(line => {
            g.fillText(line, pageW - 48, y);
            y += 28;
        });

        // Dotted workspace box for teacher solution
        const boxTop = y + 6;
        g.strokeStyle = '#cbd5e1';
        g.setLineDash([4, 4]);
        g.strokeRect(36, boxTop, pageW - 72, workAreaHeight);
        g.setLineDash([]);

        g.fillStyle = '#94a3b8';
        g.font = 'bold 11px "Cairo", sans-serif';
        g.fillText('✍️ مساحة مخصصة للحل والتأشير والشرح المباشر على السبورة:', pageW - 48, boxTop + 20);

        // Subtle horizontal lines inside solution workspace
        g.strokeStyle = '#f1f5f9';
        g.lineWidth = 1;
        for (let ly = boxTop + 44; ly < boxTop + workAreaHeight - 10; ly += 28) {
            g.beginPath();
            g.moveTo(48, ly);
            g.lineTo(pageW - 48, ly);
            g.stroke();
        }
    }

    /**
     * فتح ملف PDF من المكتبة الرقمية للمنظومة
     */
    function openLibraryPdfForWhiteboard() {
        if (window.WbBridges && typeof window.WbBridges.openLibraryPdfPickerModal === 'function') {
            window.WbBridges.openLibraryPdfPickerModal(
                (buf, name) => loadPdfFromArrayBuffer(buf, name),
                triggerWhiteboardPdfImport
            );
            return;
        }
        triggerWhiteboardPdfImport();
    }

    /**
     * رندر صفحة محددة من مستند الـ PDF أو ورقة التمارين النموذجية
     */
    async function renderActiveDocumentPage(pageNum, shouldSavePrevious = true) {
        if (!isPdfOrWorksheetActive() || pageNum < 1 || pageNum > pdfTotalPages || isPdfRendering) return;

        isPdfRendering = true;
        try {
            if (shouldSavePrevious && canvas && lastValidWidth > 0) {
                try {
                    pdfPageDataUrls[currentPdfPageNum] = canvas.toDataURL('image/png');
                } catch (e) {}
            }

            currentPdfPageNum = pageNum;
            selectedVectorIndex = -1;
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;

            if (isSampleWorksheetActive && sampleWorksheetPages[pageNum - 1]) {
                const srcCanvas = sampleWorksheetPages[pageNum - 1];
                const baseW = 794;
                const baseH = 1123;
                let baseScale = pdfFitMode === 'width'
                    ? (w - 32) / baseW
                    : Math.min((w - 32) / baseW, (h - 24) / baseH);
                const finalScale = Math.max(0.25, baseScale * pdfZoom);

                pdfRenderedCanvas = srcCanvas;
                pdfRenderPos = {
                    x: Math.floor((w - baseW * finalScale) / 2),
                    y: Math.max(10, Math.floor((h - baseH * finalScale) / 2)),
                    width: Math.floor(baseW * finalScale),
                    height: Math.floor(baseH * finalScale)
                };
            } else if (currentPdfDoc) {
                const page = await currentPdfDoc.getPage(pageNum);
                const unscaledViewport = page.getViewport({ scale: 1.0, rotation: pdfRotation });

                let baseScale = pdfFitMode === 'width'
                    ? (w - 32) / unscaledViewport.width
                    : Math.min((w - 32) / unscaledViewport.width, (h - 24) / unscaledViewport.height);
                const finalScale = Math.max(0.25, baseScale * pdfZoom);

                const viewport = page.getViewport({ scale: finalScale, rotation: pdfRotation });
                const dpr = window.devicePixelRatio || 1;
                const offscreen = document.createElement('canvas');
                offscreen.width = Math.floor(viewport.width * dpr);
                offscreen.height = Math.floor(viewport.height * dpr);
                const offCtx = offscreen.getContext('2d');
                offCtx.scale(dpr, dpr);

                await page.render({
                    canvasContext: offCtx,
                    viewport: viewport
                }).promise;

                if (pdfRenderedCanvas && pdfRenderedCanvas !== offscreen && (!Array.isArray(sampleWorksheetPages) || !sampleWorksheetPages.includes(pdfRenderedCanvas))) {
                    pdfRenderedCanvas.width = 0;
                    pdfRenderedCanvas.height = 0;
                }
                pdfRenderedCanvas = offscreen;
                pdfRenderPos = {
                    x: Math.floor((w - viewport.width) / 2),
                    y: Math.max(10, Math.floor((h - viewport.height) / 2)),
                    width: Math.floor(viewport.width),
                    height: Math.floor(viewport.height)
                };
            }

            drawBackground();

            // استعادة شروحات وحلول الأستاذ الخاصة بهذه الصفحة مع الإحداثيات المعيارية للـ PDF
            const pageVecs = pdfPageVectorStrokes[pageNum];
            if (Array.isArray(pageVecs) && pageVecs.length > 0) {
                replayVectorStrokesToCanvas(pageVecs);
            } else if (pdfPageDataUrls[pageNum]) {
                restoreDataUrlToInkCanvas(pdfPageDataUrls[pageNum]);
            } else {
                clearInkCanvasInternal();
            }

            updatePdfUI();
            updatePageIndicator();
            highlightActiveThumbnail(pageNum);
            renderGeometricToolsOverlay();

        } catch (err) {
            console.error('Error rendering PDF page:', err);
        } finally {
            isPdfRendering = false;
        }
    }

    /**
     * بناء شريط مصغرات صفحات الـ PDF الجانبي
     */
    async function buildPdfThumbnailsSidebar() {
        const listEl = document.getElementById('whiteboardPdfThumbnailsList');
        if (!listEl) return;
        listEl.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
        listEl.innerHTML = '';

        for (let p = 1; p <= pdfTotalPages; p++) {
            const item = document.createElement('div');
            item.className = 'pdf-thumb-card';
            item.setAttribute('data-page', String(p));
            item.style.cssText = `
                cursor: pointer; border: 2px solid ${p === currentPdfPageNum ? '#2563eb' : '#cbd5e1'};
                border-radius: 8px; padding: 5px; background: ${p === currentPdfPageNum ? '#eff6ff' : '#ffffff'};
                display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative;
                transition: all 0.15s ease;
            `;
            item.onclick = () => jumpToPdfPage(p);

            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = 120;
            thumbCanvas.height = 165;
            thumbCanvas.style.cssText = 'width: 100%; height: auto; border-radius: 4px; border: 1px solid #e2e8f0; background: #fff;';

            const label = document.createElement('div');
            label.style.cssText = 'font-size: 0.72rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 4px;';
            label.innerHTML = `<span>صفحة ${p}</span> <span id="pdfThumbBadge_${p}" style="display: none; font-size: 0.68rem;">✏️</span>`;

            item.appendChild(thumbCanvas);
            item.appendChild(label);
            listEl.appendChild(item);

            // Render thumbnail asynchronously
            renderSingleThumbnail(p, thumbCanvas);
        }
    }

    async function renderSingleThumbnail(pageNum, thumbCanvas) {
        try {
            const tCtx = thumbCanvas.getContext('2d');
            if (isSampleWorksheetActive && sampleWorksheetPages[pageNum - 1]) {
                tCtx.drawImage(sampleWorksheetPages[pageNum - 1], 0, 0, thumbCanvas.width, thumbCanvas.height);
            } else if (currentPdfDoc) {
                const page = await currentPdfDoc.getPage(pageNum);
                const vp = page.getViewport({ scale: 0.22 });
                thumbCanvas.width = vp.width;
                thumbCanvas.height = vp.height;
                await page.render({ canvasContext: tCtx, viewport: vp }).promise;
            }
        } catch (e) {}
    }

    function highlightActiveThumbnail(pageNum) {
        document.querySelectorAll('#whiteboardPdfThumbnailsList .pdf-thumb-card').forEach(card => {
            const p = Number(card.getAttribute('data-page'));
            card.style.borderColor = p === pageNum ? '#2563eb' : '#cbd5e1';
            card.style.background = p === pageNum ? '#eff6ff' : '#ffffff';
        });
    }

    function updateThumbnailAnnotationBadge(pageNum, hasDrawing) {
        const badge = document.getElementById(`pdfThumbBadge_${pageNum}`);
        if (badge) {
            badge.style.display = hasDrawing ? 'inline' : 'none';
        }
    }

    function togglePdfThumbnailsSidebar() {
        const panel = document.getElementById('whiteboardPdfThumbnailsPanel');
        if (!panel) return;
        isThumbnailsOpen = !isThumbnailsOpen;
        panel.style.display = isThumbnailsOpen ? 'flex' : 'none';
        setTimeout(() => resizeCanvas(false), 50);
    }

    function getPdfVerticalScrollBounds() {
        const h = lastValidHeight || (canvas && parseFloat(canvas.style.height)) || 640;
        const pageH = (pdfRenderPos && pdfRenderPos.height) ? pdfRenderPos.height : h;
        const overflowY = Math.max(220, pageH - h + 60);
        return {
            minOffsetY: -overflowY,
            maxOffsetY: 160,
            overflowY: overflowY
        };
    }

    function syncPdfVerticalSliderUI() {
        const vertNav = document.getElementById('whiteboardPdfVerticalNavOverlay');
        if (vertNav) {
            vertNav.style.display = isPdfOrWorksheetActive() ? 'flex' : 'none';
        }
        const slider = document.getElementById('whiteboardPdfVerticalSlider');
        if (!slider || !isPdfOrWorksheetActive()) return;

        const bounds = getPdfVerticalScrollBounds();
        // Map pdfPanOffset.y from [0 .. bounds.minOffsetY] to [0 .. 100]
        const clampedY = Math.max(bounds.minOffsetY, Math.min(0, pdfPanOffset.y));
        const pct = bounds.minOffsetY < 0 ? Math.round((clampedY / bounds.minOffsetY) * 100) : 0;
        slider.value = String(Math.max(0, Math.min(100, pct)));
    }

    /**
     * إزاحة طبقة الحبر والتأشيرات بنفس مقدار تحريك صفحة الـ PDF لضمان ثبات الحلول فوق التمارين
     */
    function shiftInkCanvasAndVectorsByDelta(dx, dy) {
        if (!ctx || !canvas || (!dx && !dy)) return;
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;

        if (isPdfOrWorksheetActive() && Array.isArray(pdfPageVectorStrokes[currentPdfPageNum]) && pdfPageVectorStrokes[currentPdfPageNum].length > 0) {
            pdfPageVectorStrokes[currentPdfPageNum].forEach(st => {
                if (!st || st.coordSpace === 'pdf_norm') return;
                if (window.WbVectorEngine && typeof window.WbVectorEngine.moveVectorObject === 'function') {
                    window.WbVectorEngine.moveVectorObject(st, dx, dy, getVectorEnv());
                }
            });
            replayVectorStrokesToCanvas(pdfPageVectorStrokes[currentPdfPageNum]);
            renderGeometricToolsOverlay();
            return;
        }

        // Fallback for legacy raster-only PDF annotations
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        clearInkCanvasInternal();
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height, dx, dy, w, h);
        ctx.restore();
    }

    function scrollWhiteboardPdfVertical(deltaY) {
        if (!isPdfOrWorksheetActive()) return;
        const bounds = getPdfVerticalScrollBounds();
        const oldY = pdfPanOffset.y;
        // Positive deltaY means moving down the page (towards bottom -> decrease pdfPanOffset.y)
        const newY = Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, oldY - Number(deltaY || 0)));
        const dy = newY - oldY;
        pdfPanOffset.y = newY;
        if (dy !== 0) shiftInkCanvasAndVectorsByDelta(0, dy);
        drawBackground();
        syncPdfVerticalSliderUI();
    }

    function scrollWhiteboardPdfHorizontal(deltaX) {
        if (!isPdfOrWorksheetActive()) return;
        const w = lastValidWidth || (canvas && parseFloat(canvas.style.width)) || 800;
        const pageW = (pdfRenderPos && pdfRenderPos.width) ? pdfRenderPos.width : w;
        const maxShiftX = Math.max(200, Math.abs(pageW - w) + 120);
        const oldX = pdfPanOffset.x;
        const newX = Math.max(-maxShiftX, Math.min(maxShiftX, oldX + Number(deltaX || 0)));
        const dx = newX - oldX;
        pdfPanOffset.x = newX;
        if (dx !== 0) shiftInkCanvasAndVectorsByDelta(dx, 0);
        drawBackground();
    }

    function setPdfVerticalScrollFromSlider(sliderVal) {
        if (!isPdfOrWorksheetActive()) return;
        const pct = Math.max(0, Math.min(100, Number(sliderVal) || 0)) / 100;
        const bounds = getPdfVerticalScrollBounds();
        const oldY = pdfPanOffset.y;
        const newY = Math.round(bounds.minOffsetY * pct);
        const dy = newY - oldY;
        pdfPanOffset.y = newY;
        if (dy !== 0) shiftInkCanvasAndVectorsByDelta(0, dy);
        drawBackground();
    }

    function updatePdfUI() {
        const ind = document.getElementById('whiteboardPdfPageIndicator');
        if (ind) ind.textContent = `من ${pdfTotalPages}`;

        const pageInput = document.getElementById('whiteboardPdfPageInput');
        if (pageInput) pageInput.value = String(currentPdfPageNum);

        const zoomBadge = document.getElementById('whiteboardPdfZoomBadge');
        if (zoomBadge) zoomBadge.textContent = `${Math.round(pdfZoom * 100)}%`;

        const fitBtn = document.getElementById('btnPdfFitMode');
        if (fitBtn) {
            fitBtn.textContent = pdfFitMode === 'width' ? '📄 احتواء الصفحة' : '↔️ ملاءمة العرض';
        }

        syncPdfVerticalSliderUI();
    }

    function prevPdfPage() {
        if (!isPdfOrWorksheetActive() || currentPdfPageNum <= 1) return;
        pdfPanOffset = { x: 0, y: 0 };
        renderActiveDocumentPage(currentPdfPageNum - 1, true);
    }

    function nextPdfPage() {
        if (!isPdfOrWorksheetActive() || currentPdfPageNum >= pdfTotalPages) return;
        pdfPanOffset = { x: 0, y: 0 };
        renderActiveDocumentPage(currentPdfPageNum + 1, true);
    }

    function jumpToPdfPage(val) {
        if (!isPdfOrWorksheetActive()) return;
        const target = Math.max(1, Math.min(pdfTotalPages, parseInt(val, 10) || 1));
        if (target !== currentPdfPageNum) {
            pdfPanOffset = { x: 0, y: 0 };
            renderActiveDocumentPage(target, true);
        }
    }

    function zoomWhiteboardPdf(delta) {
        if (!isPdfOrWorksheetActive()) return;
        pdfZoom = Math.max(0.5, Math.min(3.0, Math.round((pdfZoom + delta) * 100) / 100));
        renderActiveDocumentPage(currentPdfPageNum, true);
    }

    function rotateWhiteboardPdf(deg) {
        if (!isPdfOrWorksheetActive()) return;
        pdfRotation = (pdfRotation + (deg || 90)) % 360;
        renderActiveDocumentPage(currentPdfPageNum, true);
    }

    function resetWhiteboardPdfView() {
        if (!isPdfOrWorksheetActive()) return;
        pdfZoom = 1.0;
        pdfRotation = 0;
        pdfPanOffset = { x: 0, y: 0 };
        renderActiveDocumentPage(currentPdfPageNum, true);
    }

    function fitPdfPageWidth() {
        pdfFitMode = (pdfFitMode === 'width') ? 'contain' : 'width';
        pdfPanOffset = { x: 0, y: 0 };
        renderActiveDocumentPage(currentPdfPageNum, true);
        if (typeof window.showNotification === 'function') {
            window.showNotification(pdfFitMode === 'width' ? 'تم ضبط العرض لملاءمة عرض السبورة' : 'تم احتواء الصفحة بالكامل', 'info');
        }
    }

    function closeWhiteboardPdf() {
        if (!isPdfOrWorksheetActive()) return;

        if (currentPdfDoc && typeof currentPdfDoc.destroy === 'function') {
            try { currentPdfDoc.destroy(); } catch (e) {}
        }
        currentPdfDoc = null;
        isSampleWorksheetActive = false;
        if (Array.isArray(sampleWorksheetPages)) {
            sampleWorksheetPages.forEach(c => { if (c) { c.width = 0; c.height = 0; } });
        }
        sampleWorksheetPages = [];
        currentPdfFileName = '';
        if (pdfRenderedCanvas) {
            pdfRenderedCanvas.width = 0;
            pdfRenderedCanvas.height = 0;
        }
        pdfRenderedCanvas = null;
        pdfPageDataUrls = {};
        pdfPageVectorStrokes = {};
        selectedVectorIndex = -1;
        pdfZoom = 1.0;
        pdfPanOffset = { x: 0, y: 0 };

        const tb = document.getElementById('whiteboardPdfToolbar');
        if (tb) tb.style.display = 'none';

        const badge = document.getElementById('whiteboardPdfActiveBadge');
        if (badge) badge.style.display = 'none';

        const thumbsList = document.getElementById('whiteboardPdfThumbnailsList');
        if (thumbsList) {
            thumbsList.querySelectorAll('canvas').forEach(c => { c.width = 0; c.height = 0; });
            thumbsList.innerHTML = '';
        }
        const thumbsPanel = document.getElementById('whiteboardPdfThumbnailsPanel');
        if (thumbsPanel) thumbsPanel.style.display = 'none';

        const vertNav = document.getElementById('whiteboardPdfVerticalNavOverlay');
        if (vertNav) vertNav.style.display = 'none';

        drawBackground();
        const curVecs = pageVectorStrokes[currentPageIndex];
        if (Array.isArray(curVecs) && curVecs.length > 0) {
            replayVectorStrokesToCanvas(curVecs);
        } else {
            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex] || '');
        }
        updatePageIndicator();
        refreshFreehandDrawerIfOpen();
        renderGeometricToolsOverlay();

        setTimeout(() => resizeCanvas(true), 40);

        if (typeof window.showNotification === 'function') {
            window.showNotification('تم إغلاق ملف PDF والعودة إلى صفحات السبورة التفاعلية المحفوظة.', 'info');
        }
    }

    // ====================================================================
    // وضع ملء الشاشة (Whiteboard Fullscreen Mode)
    // ====================================================================

    function toggleWhiteboardFullscreen() {
        const pane = document.getElementById('distanceBoardPane');
        if (!pane) return;

        persistWhiteboardState();
        const isCurrentlyFull = pane.classList.contains('whiteboard-fullscreen-mode');

        if (!isCurrentlyFull) {
            pane.classList.add('whiteboard-fullscreen-mode');
            if (pane.requestFullscreen && !document.fullscreenElement) {
                pane.requestFullscreen().catch(() => {});
            }
            updateFullscreenUI(true);
            if (typeof window.showNotification === 'function') {
                window.showNotification('⛶ تم تفعيل وضع ملء الشاشة للسبورة (اضغط Esc للخروج)', 'info');
            }
        } else {
            pane.classList.remove('whiteboard-fullscreen-mode');
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            updateFullscreenUI(false);
        }

        setTimeout(() => resizeCanvas(true), 60);
        setTimeout(() => resizeCanvas(true), 220);
    }

    function updateFullscreenUI(isFull) {
        const label = document.getElementById('whiteboardFullscreenLabel');
        const icon = document.getElementById('whiteboardFullscreenIcon');
        if (label) {
            label.textContent = isFull ? '🗗' : '⛶';
        }
        if (icon) {
            icon.setAttribute('data-lucide', isFull ? 'minimize' : 'maximize');
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function setupFullscreenListeners() {
        document.addEventListener('fullscreenchange', () => {
            const pane = document.getElementById('distanceBoardPane');
            if (!pane) return;
            const isNative = !!document.fullscreenElement;
            if (!isNative && pane.classList.contains('whiteboard-fullscreen-mode')) {
                pane.classList.remove('whiteboard-fullscreen-mode');
                updateFullscreenUI(false);
                setTimeout(() => resizeCanvas(true), 100);
            }
        });
    }

    function deleteSelectedVectorObject() {
        const arr = getActiveVectorArray();
        if (selectedVectorIndex < 0 || selectedVectorIndex >= arr.length) return;
        saveStateForUndo();
        const removed = arr.splice(selectedVectorIndex, 1)[0];
        selectedVectorIndex = -1;
        replayVectorStrokesToCanvas(arr);
        renderGeometricToolsOverlay();
        persistWhiteboardState();
        if (removed && removed.id && collabClient && collabClient.roomCode) {
            collabClient.send('object:delete', { objectId: removed.id });
        }
    }

    function duplicateSelectedVectorObject() {
        const arr = getActiveVectorArray();
        if (selectedVectorIndex < 0 || selectedVectorIndex >= arr.length) return;
        const src = arr[selectedVectorIndex];
        saveStateForUndo();
        const copy = cloneVectorObj(src);
        if (window.WbVectorEngine) {
            copy.id = window.WbVectorEngine.uid('obj');
            if (typeof window.WbVectorEngine.moveVectorObject === 'function') {
                window.WbVectorEngine.moveVectorObject(copy, 26, 26, getVectorEnv());
            }
        } else {
            copy.id = 'obj_' + Date.now();
        }
        pushVectorObject(copy);
        selectedVectorIndex = arr.length - 1;
        replayVectorStrokesToCanvas(arr);
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!isContainerVisible()) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedVectorIndex >= 0) {
                e.preventDefault();
                duplicateSelectedVectorObject();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedVectorIndex >= 0) {
                e.preventDefault();
                deleteSelectedVectorObject();
            } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
                const k = e.key.toLowerCase();
                if (k === 'v') { e.preventDefault(); setTool('select'); }
                else if (k === 'p') { e.preventDefault(); setTool('pen'); }
                else if (k === 'h') { e.preventDefault(); setTool('highlighter'); }
                else if (k === 'e') { e.preventDefault(); setTool('eraser'); }
                else if (k === 'l') { e.preventDefault(); setTool('laser'); }
                else if (k === 's') { e.preventDefault(); setTool(currentTool === 'spotlight' ? 'pen' : 'spotlight'); }
                else if (k === 't') { e.preventDefault(); setTool('text'); }
            } else if (isPdfOrWorksheetActive() && (e.key === 'ArrowDown' || e.key === 'PageDown')) {
                e.preventDefault();
                scrollWhiteboardPdfVertical(e.key === 'PageDown' ? 260 : 100);
            } else if (isPdfOrWorksheetActive() && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
                e.preventDefault();
                scrollWhiteboardPdfVertical(e.key === 'PageUp' ? -260 : -100);
            } else if (e.key === 'Escape') {
                if (selectedVectorIndex >= 0) {
                    selectedVectorIndex = -1;
                    renderGeometricToolsOverlay();
                    return;
                }
                if (currentTool === 'spotlight') {
                    setTool('pen');
                    return;
                }
                const pane = document.getElementById('distanceBoardPane');
                if (pane && pane.classList.contains('whiteboard-fullscreen-mode')) {
                    pane.classList.remove('whiteboard-fullscreen-mode');
                    if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    }
                    updateFullscreenUI(false);
                    setTimeout(() => resizeCanvas(true), 100);
                }
            }
        });
    }

    // ====================================================================
    // إدارة صفحات السبورة الاعتيادية (Whiteboard Multi-Pages) & شريط الأدوات الجانبي
    // ====================================================================

    function toggleLeftToolsDock(forceState) {
        const dock = document.getElementById('whiteboardLeftToolsDock');
        const btn = document.getElementById('btnToggleLeftToolsDock');
        if (!dock) return;
        isLeftDockCollapsed = typeof forceState === 'boolean' ? !forceState : !isLeftDockCollapsed;
        dock.classList.toggle('wb-dock-collapsed', isLeftDockCollapsed);
        if (btn) {
            btn.innerHTML = isLeftDockCollapsed ? '<span>▶ إظهار الأدوات</span>' : '<span>◀ طي الأدوات</span>';
            btn.style.background = isLeftDockCollapsed ? '#eff6ff' : '#f8fafc';
            btn.style.color = isLeftDockCollapsed ? '#1d4ed8' : '#334155';
        }
        setTimeout(() => resizeCanvas(true), 50);
    }

    function toggleFreehandPagesDrawer(forceState) {
        const panel = document.getElementById('whiteboardFreehandPagesPanel');
        if (!panel) return;
        if (isPdfOrWorksheetActive() && forceState !== false) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('أنت تشتغل حالياً على مستند PDF؛ توجد مصغرات صفحات الـ PDF على اليمين.', 'info');
            }
            return;
        }
        isFreehandDrawerOpen = typeof forceState === 'boolean' ? forceState : !isFreehandDrawerOpen;
        panel.style.display = isFreehandDrawerOpen ? 'flex' : 'none';
        if (isFreehandDrawerOpen) {
            persistWhiteboardState();
            refreshFreehandDrawerIfOpen();
        }
        setTimeout(() => resizeCanvas(true), 50);
    }

    function jumpToFreehandPage(idx) {
        if (isPdfOrWorksheetActive()) return;
        const target = Math.max(0, Math.min(pageDataUrls.length - 1, Number(idx) || 0));
        if (target === currentPageIndex) return;
        persistWhiteboardState();
        currentPageIndex = target;
        selectedVectorIndex = -1;
        const vecs = pageVectorStrokes[currentPageIndex];
        if (Array.isArray(vecs) && vecs.length > 0) {
            replayVectorStrokesToCanvas(vecs);
        } else if (pageDataUrls[currentPageIndex]) {
            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
        } else {
            clearInkCanvasInternal();
        }
        resetUndoHistory();
        updatePageIndicator();
        refreshFreehandDrawerIfOpen();
        renderGeometricToolsOverlay();
    }

    function moveFreehandPage(fromIdx, toIdx) {
        if (isPdfOrWorksheetActive()) return;
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= pageDataUrls.length || toIdx >= pageDataUrls.length || fromIdx === toIdx) return;
        persistWhiteboardState();
        const [movedUrl] = pageDataUrls.splice(fromIdx, 1);
        pageDataUrls.splice(toIdx, 0, movedUrl);
        if (Array.isArray(pageVectorStrokes)) {
            const [movedVec] = pageVectorStrokes.splice(fromIdx, 1);
            pageVectorStrokes.splice(toIdx, 0, movedVec || []);
        }
        if (currentPageIndex === fromIdx) currentPageIndex = toIdx;
        else if (fromIdx < currentPageIndex && toIdx >= currentPageIndex) currentPageIndex--;
        else if (fromIdx > currentPageIndex && toIdx <= currentPageIndex) currentPageIndex++;
        updatePageIndicator();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();
    }

    function deleteFreehandPageAt(idx) {
        if (isPdfOrWorksheetActive() || pageDataUrls.length <= 1) return;
        if (idx === currentPageIndex) {
            deleteBoardPage();
            return;
        }
        persistWhiteboardState();
        pageDataUrls.splice(idx, 1);
        if (Array.isArray(pageVectorStrokes)) {
            pageVectorStrokes.splice(idx, 1);
        }
        if (idx < currentPageIndex) currentPageIndex--;
        updatePageIndicator();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();
    }

    function addPage() {
        if (!ctx || !canvas) return;

        if (isPdfOrWorksheetActive()) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('أنت تشتغل حالياً على مستند PDF؛ استخدم أزرار صفحات PDF للتنقل أو أغلق الـ PDF لإضافة صفحات حرة.', 'info');
            }
            return;
        }

        persistWhiteboardState();
        pageDataUrls.push('');
        pageVectorStrokes.push([]);
        currentPageIndex = pageDataUrls.length - 1;
        selectedVectorIndex = -1;

        clearInkCanvasInternal();
        drawBackground();
        resetUndoHistory();
        updatePageIndicator();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();
        renderGeometricToolsOverlay();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`تمت إضافة صفحة سبورة جديدة (${currentPageIndex + 1})`, 'success');
        }
    }

    function prevPage() {
        if (isPdfOrWorksheetActive()) {
            prevPdfPage();
            return;
        }
        if (currentPageIndex > 0) {
            persistWhiteboardState();
            currentPageIndex--;
            selectedVectorIndex = -1;
            if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
                replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
            } else if (pageDataUrls[currentPageIndex]) {
                restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
            } else {
                clearInkCanvasInternal();
            }
            resetUndoHistory();
            updatePageIndicator();
            refreshFreehandDrawerIfOpen();
            renderGeometricToolsOverlay();
        }
    }

    function nextPage() {
        if (isPdfOrWorksheetActive()) {
            nextPdfPage();
            return;
        }
        if (currentPageIndex < pageDataUrls.length - 1) {
            persistWhiteboardState();
            currentPageIndex++;
            selectedVectorIndex = -1;
            if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
                replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
            } else if (pageDataUrls[currentPageIndex]) {
                restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
            } else {
                clearInkCanvasInternal();
            }
            resetUndoHistory();
            updatePageIndicator();
            refreshFreehandDrawerIfOpen();
            renderGeometricToolsOverlay();
        }
    }

    function duplicateBoardPage() {
        if (!ctx || !canvas) return;
        if (isPdfOrWorksheetActive()) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('لا يمكن تكرار صفحات مستند PDF، أغلق الـ PDF لتكرار صفحات السبورة الحرة.', 'info');
            }
            return;
        }
        persistWhiteboardState();
        const currentUrl = canvas.toDataURL('image/webp', 0.85);
        const currentVectors = Array.isArray(pageVectorStrokes[currentPageIndex])
            ? JSON.parse(JSON.stringify(pageVectorStrokes[currentPageIndex]))
            : [];
        pageDataUrls.splice(currentPageIndex + 1, 0, currentUrl);
        pageVectorStrokes.splice(currentPageIndex + 1, 0, currentVectors);
        currentPageIndex++;
        selectedVectorIndex = -1;
        resetUndoHistory();
        updatePageIndicator();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();
        renderGeometricToolsOverlay();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`📋 تم استنساخ الصفحة الحالية إلى الصفحة (${currentPageIndex + 1})`, 'success');
        }
    }

    function deleteBoardPage() {
        if (!ctx || !canvas) return;
        if (isPdfOrWorksheetActive()) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('أنت تشتغل على مستند PDF؛ استخدم زر مسح الصفحة لمسح الشروحات.', 'info');
            }
            return;
        }
        if (pageDataUrls.length <= 1) {
            clearCanvas();
            return;
        }
        pageDataUrls.splice(currentPageIndex, 1);
        if (Array.isArray(pageVectorStrokes)) {
            pageVectorStrokes.splice(currentPageIndex, 1);
        }
        if (currentPageIndex >= pageDataUrls.length) {
            currentPageIndex = pageDataUrls.length - 1;
        }
        selectedVectorIndex = -1;
        if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
            replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
        } else if (pageDataUrls[currentPageIndex]) {
            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
        } else {
            clearInkCanvasInternal();
        }
        resetUndoHistory();
        updatePageIndicator();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();
        renderGeometricToolsOverlay();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🗑️ تم حذف الصفحة. أنت الآن في الصفحة ${currentPageIndex + 1} من ${pageDataUrls.length}`, 'info');
        }
    }

    function updatePageIndicator() {
        const el = document.getElementById('boardPageIndicator');
        if (el) {
            if (isPdfOrWorksheetActive()) {
                el.textContent = `PDF ${currentPdfPageNum} / ${pdfTotalPages}`;
            } else {
                el.textContent = `صفحة ${currentPageIndex + 1} من ${Math.max(1, pageDataUrls.length)}`;
            }
        }
    }

    // ====================================================================
    // التراجع والإعادة والمسح الفوري والتصدير (Undo / Redo / Clear / Export)
    // ====================================================================

    function undo() {
        if (undoStack.length === 0 || !canvas) return;
        const currentUrl = canvas.toDataURL('image/webp', 0.85);
        redoStack.push(currentUrl);
        redoVectorSnapshots.push(cloneVectorObj(getActiveVectorArray()));

        const prevVecSnap = undoVectorSnapshots.pop();
        if (Array.isArray(prevVecSnap)) {
            setActiveVectorArray(prevVecSnap);
        }
        selectedVectorIndex = -1;

        const prevUrl = undoStack.pop();
        if (Array.isArray(prevVecSnap) && prevVecSnap.length > 0) {
            replayVectorStrokesToCanvas(prevVecSnap);
            renderGeometricToolsOverlay();
            persistWhiteboardState();
            refreshFreehandDrawerIfOpen();
        } else {
            restoreDataUrlToInkCanvas(prevUrl, () => {
                renderGeometricToolsOverlay();
                persistWhiteboardState();
                refreshFreehandDrawerIfOpen();
            });
        }
        if (collabClient && collabClient.roomCode) {
            collabClient.send('page:restore', { objects: getActiveVectorArray() });
        }
    }

    function redo() {
        if (redoStack.length === 0 || !canvas) return;
        const currentUrl = canvas.toDataURL('image/webp', 0.85);
        undoStack.push(currentUrl);
        undoVectorSnapshots.push(cloneVectorObj(getActiveVectorArray()));

        const nextVecSnap = redoVectorSnapshots.pop();
        if (Array.isArray(nextVecSnap)) {
            setActiveVectorArray(nextVecSnap);
        }
        selectedVectorIndex = -1;

        const nextUrl = redoStack.pop();
        if (Array.isArray(nextVecSnap) && nextVecSnap.length > 0) {
            replayVectorStrokesToCanvas(nextVecSnap);
            renderGeometricToolsOverlay();
            persistWhiteboardState();
            refreshFreehandDrawerIfOpen();
        } else {
            restoreDataUrlToInkCanvas(nextUrl, () => {
                renderGeometricToolsOverlay();
                persistWhiteboardState();
                refreshFreehandDrawerIfOpen();
            });
        }
        if (collabClient && collabClient.roomCode) {
            collabClient.send('page:restore', { objects: getActiveVectorArray() });
        }
    }

    /**
     * مسح رسومات الصفحة الحالية فوراً بدون نوافذ منبثقة معطلة، مع إمكانية التراجع (Undo)
     */
    function clearCanvas() {
        if (!ctx || !canvas) return;
        saveStateForUndo();
        clearInkCanvasInternal();
        selectedVectorIndex = -1;

        if (isPdfOrWorksheetActive()) {
            pdfPageDataUrls[currentPdfPageNum] = '';
            pdfPageVectorStrokes[currentPdfPageNum] = [];
            updateThumbnailAnnotationBadge(currentPdfPageNum, false);
        } else {
            pageDataUrls[currentPageIndex] = '';
            pageVectorStrokes[currentPageIndex] = [];
        }

        renderGeometricToolsOverlay();
        persistWhiteboardState();
        refreshFreehandDrawerIfOpen();

        if (collabClient && collabClient.roomCode) {
            collabClient.send('page:clear', {});
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification('🗑️ تم مسح رسومات الصفحة (يمكنك النقر على "تراجع ↩️" لاستعادتها)', 'info');
        }
    }

    function clearInkCanvasInternal() {
        if (!ctx || !canvas) return;
        const w = lastValidWidth || parseFloat(canvas.style.width) || canvas.width;
        const h = lastValidHeight || parseFloat(canvas.style.height) || canvas.height;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.restore();
    }

    /**
     * دمج طبقة الخلفية/PDF مع طبقة رسومات الأستاذ في كانفاس موحد للتصدير والطباعة
     */
    function createCompositedCanvas() {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const expCtx = exportCanvas.getContext('2d');

        if (bgCanvas) {
            expCtx.drawImage(bgCanvas, 0, 0);
        } else {
            expCtx.fillStyle = '#ffffff';
            expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        }
        expCtx.drawImage(canvas, 0, 0);
        return exportCanvas;
    }

    function exportBoardImage() {
        if (!canvas) return;
        const exportCanvas = createCompositedCanvas();
        const dataUrl = exportCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        const fileName = isPdfOrWorksheetActive()
            ? `سبورة_الرياضيات_${currentPdfFileName.replace(/\.pdf$/i, '')}_صفحة_${currentPdfPageNum}.png`
            : `سبورة_الرياضيات_صفحة_${currentPageIndex + 1}_${new Date().toISOString().slice(0, 10)}.png`;
        a.download = fileName;
        a.click();

        if (typeof window.showNotification === 'function') {
            window.showNotification('💾 تم تصدير وحفظ السبورة مع الشروحات كصورة PNG عالية الدقة!', 'success');
        }
    }

    /**
     * طباعة أو تصدير الصفحة/المستند مع الشروحات والحلول والترويسة الرسمية
     */
    function printAnnotatedWhiteboardPages() {
        if (!canvas) return;
        persistWhiteboardState();

        const compositedDataUrl = createCompositedCanvas().toDataURL('image/png');
        const docTitle = isPdfOrWorksheetActive()
            ? `تصحيح وحل: ${currentPdfFileName} (الصفحة ${currentPdfPageNum})`
            : `ملخص وشروحات السبورة التفاعلية لمادة الرياضيات (الصفحة ${currentPageIndex + 1})`;

        const officialHeader = typeof window.buildOfficialMoroccanHeader === 'function'
            ? window.buildOfficialMoroccanHeader(docTitle, '', new Date().toLocaleDateString('ar-MA'))
            : `<h2 style="text-align:center;color:#1e3a8a;font-family:'Cairo',sans-serif;">${docTitle}</h2>`;

        const html = `
            <div style="font-family: 'Cairo', sans-serif; direction: rtl; padding: 10px;">
                ${officialHeader}
                <div style="text-align: center; margin-top: 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 8px; background: #ffffff;">
                    <img src="${compositedDataUrl}" style="max-width: 100%; max-height: 220mm; object-fit: contain; border-radius: 6px;" alt="السبورة التفاعلية" />
                </div>
            </div>
        `;

        if (typeof window.printDocumentDirectly === 'function') {
            window.printDocumentDirectly(html, docTitle, { orientation: 'landscape' });
        } else {
            exportBoardImage();
        }
    }

    /**
     * تصدير دفتر السبورة الكامل (جميع الصفحات الحرة أو صفحات الـ PDF المشروحة) كملف PDF شامل متعدد الصفحات
     */
    async function exportAllWhiteboardPagesToPDF() {
        if (!canvas || !ctx) return;
        persistWhiteboardState();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 960;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        if (typeof window.showNotification === 'function') {
            window.showNotification('⏳ جاري تجميع وتجهيز جميع صفحات السبورة في ملف PDF شامل عالي الدقة...', 'info');
        }

        const todayStr = new Date().toLocaleDateString('ar-MA');
        const className = window.currentClass || '2BAC';
        const teacherProfile = (window.WbSecurityMath && typeof window.WbSecurityMath.getTeacherProfile === 'function')
            ? window.WbSecurityMath.getTeacherProfile()
            : { name: 'الأستاذ(ة)' };

        // Helper to render a single freehand page (background + vectors/ink + academic header strip) to a DataURL
        const renderPageToDataUrl = (pageIdx, totalPagesCount) => new Promise((resolve) => {
            const offCanvas = document.createElement('canvas');
            const headerH = 44;
            offCanvas.width = Math.round(w * dpr);
            offCanvas.height = Math.round((h + headerH) * dpr);
            const offCtx = offCanvas.getContext('2d');
            offCtx.scale(dpr, dpr);

            // Top academic header strip
            offCtx.fillStyle = '#1e3a8a';
            offCtx.fillRect(0, 0, w, headerH);
            offCtx.fillStyle = '#ffffff';
            offCtx.font = 'bold 14px "Cairo", sans-serif';
            offCtx.textAlign = 'right';
            offCtx.textBaseline = 'middle';
            offCtx.fillText(`📐 دفتر السبورة التفاعلية — القسم: ${className} | ${teacherProfile.name || 'مادة الرياضيات'}`, w - 16, headerH / 2);
            offCtx.textAlign = 'left';
            offCtx.font = 'bold 13px "Cairo", sans-serif';
            offCtx.fillStyle = '#bae6fd';
            offCtx.fillText(`📅 ${todayStr}   |   📄 الصفحة ${pageIdx + 1} من ${totalPagesCount}`, 16, headerH / 2);

            // Translate down for board area
            offCtx.save();
            offCtx.translate(0, headerH);

            // Draw active background grid
            drawBackgroundGrid(offCtx, w, h);

            // Draw vectors if available
            const vecs = Array.isArray(pageVectorStrokes[pageIdx]) ? pageVectorStrokes[pageIdx] : [];
            const env = getVectorEnv();
            if (vecs.length > 0 && window.WbVectorEngine) {
                const inkLayer = document.createElement('canvas');
                inkLayer.width = Math.round(w * dpr);
                inkLayer.height = Math.round(h * dpr);
                const inkCtx = inkLayer.getContext('2d');
                inkCtx.scale(dpr, dpr);
                vecs.forEach(obj => {
                    window.WbVectorEngine.drawVectorObject(inkCtx, obj, env);
                });
                offCtx.drawImage(inkLayer, 0, 0, w, h);
                offCtx.restore();
                resolve(offCanvas.toDataURL('image/jpeg', 0.92));
            } else if (pageDataUrls[pageIdx]) {
                const img = new Image();
                img.onload = () => {
                    offCtx.drawImage(img, 0, 0, w, h);
                    offCtx.restore();
                    resolve(offCanvas.toDataURL('image/jpeg', 0.92));
                };
                img.onerror = () => {
                    offCtx.restore();
                    resolve(offCanvas.toDataURL('image/jpeg', 0.92));
                };
                img.src = pageDataUrls[pageIdx];
            } else {
                offCtx.restore();
                resolve(offCanvas.toDataURL('image/jpeg', 0.92));
            }
        });

        try {
            const totalFreehand = Math.max(1, pageDataUrls.length, pageVectorStrokes.length);
            const pageImages = [];

            if (isPdfOrWorksheetActive() && totalFreehand <= 1) {
                // Export current composited PDF/worksheet page
                const comp = createCompositedCanvas();
                pageImages.push(comp.toDataURL('image/jpeg', 0.92));
            } else {
                for (let i = 0; i < totalFreehand; i++) {
                    const dataUrl = await renderPageToDataUrl(i, totalFreehand);
                    pageImages.push(dataUrl);
                }
            }

            if (typeof window.loadJsPDF === 'function') {
                const jspdfLib = await window.loadJsPDF();
                const jsPDFCtor = (jspdfLib && jspdfLib.jsPDF) ? jspdaSafe(jspdfLib) : (window.jspdf && window.jspdf.jsPDF);
                if (jsPDFCtor) {
                    const pdfDoc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                    const pageW = pdfDoc.internal.pageSize.getWidth();
                    const pageH = pdfDoc.internal.pageSize.getHeight();
                    pageImages.forEach((imgData, idx) => {
                        if (idx > 0) pdfDoc.addPage('a4', 'landscape');
                        pdfDoc.addImage(imgData, 'JPEG', 6, 6, pageW - 12, pageH - 12);
                    });
                    const safeDate = new Date().toISOString().slice(0, 10);
                    pdfDoc.save(`دفتر_السبورة_الرقمية_${className}_${safeDate}.pdf`);
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(`✅ تم تصدير دفتر السبورة الشامل (${pageImages.length} صفحات) بصيغة PDF بنجاح!`, 'success');
                    }
                    return;
                }
            }

            // Fallback to multi-page print document if jsPDF is unavailable
            const pagesHtml = pageImages.map((imgUrl, idx) => `
                <div style="page-break-after: ${idx < pageImages.length - 1 ? 'always' : 'auto'}; padding: 8px; text-align: center;">
                    <img src="${imgUrl}" style="max-width: 100%; max-height: 195mm; border: 1px solid #cbd5e1; border-radius: 8px;" />
                </div>
            `).join('');
            if (typeof window.printDocumentDirectly === 'function') {
                window.printDocumentDirectly(`<div style="direction:rtl;font-family:'Cairo',sans-serif;">${pagesHtml}</div>`, `دفتر السبورة الرقمية (${pageImages.length} صفحات)`, { orientation: 'landscape' });
            }
        } catch (err) {
            console.warn('Multi-page PDF export fallback:', err);
            printAnnotatedWhiteboardPages();
        }
    }

    function jspdaSafe(lib) {
        return lib && (lib.jsPDF || lib.default || lib);
    }

    // ====================================================================
    // شريط الأدوات وتغيير الأنماط والألوان والسمك (Toolbar & Customization)
    // ====================================================================

    function setTool(tool) {
        currentTool = tool;
        if (tool !== 'select') {
            selectedVectorIndex = -1;
        }
        if (tool === 'spotlight') {
            spotlightState.active = true;
            if (canvas) {
                const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
                if (!spotlightState.x || spotlightState.x <= 0 || spotlightState.x > w) spotlightState.x = Math.floor(w / 2);
                if (!spotlightState.y || spotlightState.y <= 0 || spotlightState.y > h) spotlightState.y = Math.floor(h / 2);
            }
        } else {
            spotlightState.active = false;
        }
        if (canvas) {
            if (tool === 'pan') canvas.style.cursor = 'grab';
            else if (tool === 'select') canvas.style.cursor = 'default';
            else if (tool === 'text') canvas.style.cursor = 'text';
            else if (tool === 'laser' || tool === 'spotlight') canvas.style.cursor = 'pointer';
            else canvas.style.cursor = 'crosshair';
        }
        updateToolbarUI();
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function setColor(color) {
        currentColor = color;
        if (currentTool === 'eraser' || currentTool === 'pan' || currentTool === 'spotlight') {
            currentTool = 'pen';
            spotlightState.active = false;
            renderGeometricToolsOverlay();
        }
        const picker = document.getElementById('whiteboardCustomColorPicker');
        if (picker && color.startsWith('#') && color.length === 7) {
            picker.value = color;
        }
        updateToolbarUI();
        persistWhiteboardState();
    }

    function setSize(sz) {
        currentSize = Math.max(1, Math.min(30, parseInt(sz, 10) || 3));
        const slider = document.getElementById('whiteboardSizeSlider');
        if (slider) slider.value = String(currentSize);
        const badge = document.getElementById('whiteboardSizeBadge');
        if (badge) badge.textContent = `${currentSize}px`;
        updateToolbarUI();
        persistWhiteboardState();
    }

    function setBackground(bg) {
        currentBg = bg;
        // تبديل ذكي للون القلم عند الانتقال بين السبورة الفاتحة والسبورة الخضراء/الليلية لضمان وضوح الكتابة
        if (bg === 'green' || bg === 'dark') {
            if (currentColor === '#1e3a8a' || currentColor === '#0f172a' || currentColor === '#000000') {
                currentColor = '#ffffff';
            }
        } else {
            if (currentColor === '#ffffff') {
                currentColor = '#1e3a8a';
            }
        }
        // لأن الخلفية في طبقة منفصلة (#whiteboardBgCanvas)، تغيير الخلفية يحافظ على جميع الرسومات فوقها!
        drawBackground();
        updateToolbarUI();
        persistWhiteboardState();
    }

    // ====================================================================
    // الأدوات الهندسية التفاعلية: المسطرة والمنقلة والكوس والبركار
    // Interactive Geometric Tools (Ruler, Protractor, Set Square & Compass)
    // ====================================================================

    function toggleInteractiveRuler(forceState) {
        rulerState.visible = typeof forceState === 'boolean' ? forceState : !rulerState.visible;
        if (rulerState.visible && canvas) {
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            if (!rulerState.x || rulerState.x < 40 || rulerState.x > w - 40) rulerState.x = Math.floor(w / 2);
            if (!rulerState.y || rulerState.y < 40 || rulerState.y > h - 40) rulerState.y = Math.floor(h * 0.62);
        }
        updateToolbarUI();
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function toggleInteractiveProtractor(forceState) {
        protractorState.visible = typeof forceState === 'boolean' ? forceState : !protractorState.visible;
        if (protractorState.visible && canvas) {
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            if (!protractorState.x || protractorState.x < 40 || protractorState.x > w - 40) protractorState.x = Math.floor(w / 2);
            if (!protractorState.y || protractorState.y < 40 || protractorState.y > h - 40) protractorState.y = Math.floor(h * 0.48);
        }
        updateToolbarUI();
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function toggleInteractiveSetSquare(forceState) {
        setSquareState.visible = typeof forceState === 'boolean' ? forceState : !setSquareState.visible;
        if (setSquareState.visible && canvas) {
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            if (!setSquareState.x || setSquareState.x < 40 || setSquareState.x > w - 40) setSquareState.x = Math.floor(w * 0.38);
            if (!setSquareState.y || setSquareState.y < 40 || setSquareState.y > h - 40) setSquareState.y = Math.floor(h * 0.54);
        }
        updateToolbarUI();
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function toggleInteractiveCompass(forceState) {
        compassState.visible = typeof forceState === 'boolean' ? forceState : !compassState.visible;
        if (compassState.visible && canvas) {
            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            if (!compassState.x || compassState.x < 40 || compassState.x > w - 40) compassState.x = Math.floor(w * 0.52);
            if (!compassState.y || compassState.y < 40 || compassState.y > h - 40) compassState.y = Math.floor(h * 0.48);
        }
        updateToolbarUI();
        renderGeometricToolsOverlay();
        persistWhiteboardState();
    }

    function toLocalToolCoords(px, py, toolState) {
        const dx = px - toolState.x;
        const dy = py - toolState.y;
        const cosA = Math.cos(-toolState.angle);
        const sinA = Math.sin(-toolState.angle);
        return {
            x: dx * cosA - dy * sinA,
            y: dx * sinA + dy * cosA
        };
    }

    function toWorldToolCoords(lx, ly, toolState) {
        const cosA = Math.cos(toolState.angle);
        const sinA = Math.sin(toolState.angle);
        return {
            x: toolState.x + lx * cosA - ly * sinA,
            y: toolState.y + lx * sinA + ly * cosA
        };
    }

    /**
     * فحص النقر أو التحويم فوق المسطرة أو المنقلة أو الكوس أو البركار ومقابض التحكم
     */
    function hitTestGeometricTools(px, py) {
        // 0-A. Check Pedagogical Curtain handle if visible
        if (curtainState.visible) {
            const w = lastValidWidth || (canvas && parseFloat(canvas.style.width)) || 800;
            const cy = curtainState.y || 260;
            // Close button on curtain bar at right side (w - 32, cy + 16)
            if (Math.hypot(px - (w - 32), py - (cy + 16)) <= 16) {
                return { tool: 'curtain', mode: 'close' };
            }
            // Drag handle bar along top of curtain (cy - 12 to cy + 28)
            if (py >= cy - 12 && py <= cy + 32) {
                return { tool: 'curtain', mode: 'move' };
            }
        }

        // 0-B. Check Compass first (if visible)
        if (compassState.visible) {
            const loc = toLocalToolCoords(px, py, compassState);
            const r = compassState.radius || 120;
            // Close handle at top hinge (r/2 + 24, -105)
            if (Math.hypot(loc.x - (r / 2 + 24), loc.y - (-105)) <= 14) {
                return { tool: 'compass', mode: 'close' };
            }
            // Stamp full circle button at (r/2 - 26, -55)
            if (Math.abs(loc.x - (r / 2 - 26)) <= 26 && Math.abs(loc.y - (-55)) <= 13) {
                return { tool: 'compass', mode: 'stamp_compass_circle' };
            }
            // Stamp construction arc button at (r/2 + 28, -55)
            if (Math.abs(loc.x - (r / 2 + 28)) <= 26 && Math.abs(loc.y - (-55)) <= 13) {
                return { tool: 'compass', mode: 'stamp_compass_arc' };
            }
            // Resize / Pencil tip at (r, 0)
            if (Math.hypot(loc.x - r, loc.y) <= 18) {
                return { tool: 'compass', mode: 'resize' };
            }
            // Center needle or hinge body for moving
            if (Math.hypot(loc.x, loc.y) <= 20 || (Math.abs(loc.x - r / 2) <= 32 && loc.y >= -110 && loc.y <= -20)) {
                return { tool: 'compass', mode: 'move' };
            }
        }

        // 1. Check Set Square first (if visible)
        if (setSquareState.visible) {
            const loc = toLocalToolCoords(px, py, setSquareState);
            const size = setSquareState.size || 260;

            // Close button at (size - 18, -12)
            if (Math.hypot(loc.x - (size - 18), loc.y - (-12)) <= 14) {
                return { tool: 'setSquare', mode: 'close' };
            }
            // Rotate handle at (12, -size + 18)
            if (Math.hypot(loc.x - 12, loc.y - (-size + 18)) <= 15) {
                return { tool: 'setSquare', mode: 'rotate' };
            }
            // Resize handle near hypotenuse midpoint (size * 0.6, -size * 0.6)
            if (Math.hypot(loc.x - size * 0.6, loc.y - (-size * 0.6)) <= 15) {
                return { tool: 'setSquare', mode: 'resize' };
            }
            // Stamp right angle button
            if (loc.x >= size * 0.22 && loc.x <= size * 0.22 + 96 && loc.y >= -size * 0.25 && loc.y <= -size * 0.25 + 22) {
                return { tool: 'setSquare', mode: 'stamp_right_angle' };
            }
            // Body (inside triangle 0 <= x <= size, -size <= y <= 0, and x - y <= size)
            if (loc.x >= -6 && loc.y <= 6 && (loc.x - loc.y) <= size + 10) {
                return { tool: 'setSquare', mode: 'move' };
            }
        }

        // 2. Check Protractor (if visible)
        if (protractorState.visible) {
            const loc = toLocalToolCoords(px, py, protractorState);
            const r = protractorState.radius || 170;

            // Close button at top-left (-r + 18, -r + 18)
            if (Math.hypot(loc.x - (-r + 22), loc.y - (-r + 18)) <= 15) {
                return { tool: 'protractor', mode: 'close' };
            }
            // Rotate handle at top-right (r - 22, -r + 18)
            if (Math.hypot(loc.x - (r - 22), loc.y - (-r + 18)) <= 16) {
                return { tool: 'protractor', mode: 'rotate' };
            }
            // Stamp Angle button at bottom center (0, 22)
            if (Math.abs(loc.x) <= 58 && loc.y >= 8 && loc.y <= 32) {
                return { tool: 'protractor', mode: 'stamp_angle' };
            }
            // Dynamic Angle Ray handle
            const rayRad = ((protractorState.rayAngleDeg || 60) * Math.PI) / 180;
            const rayHx = (r - 18) * Math.cos(rayRad);
            const rayHy = -(r - 18) * Math.sin(rayRad);
            if (Math.hypot(loc.x - rayHx, loc.y - rayHy) <= 18) {
                return { tool: 'protractor', mode: 'ray' };
            }
            // Protractor body (semi-circle y <= 14 and dist <= r)
            const dist = Math.hypot(loc.x, loc.y);
            if (loc.y <= 24 && loc.y >= -r - 8 && dist <= r + 6) {
                if (dist >= r - 20 && loc.y < -10) {
                    return { tool: 'protractor', mode: 'rotate' };
                }
                return { tool: 'protractor', mode: 'move' };
            }
        }

        // 3. Check Ruler (if visible)
        if (rulerState.visible) {
            const loc = toLocalToolCoords(px, py, rulerState);
            const halfL = (rulerState.length || 440) / 2;
            const halfH = (rulerState.height || 54) / 2;

            // Close handle at left side (-halfL + 18, 8)
            if (Math.hypot(loc.x - (-halfL + 20), loc.y - 8) <= 13) {
                return { tool: 'ruler', mode: 'close' };
            }
            // Rotate handle at right side (halfL - 22, 8)
            if (Math.hypot(loc.x - (halfL - 22), loc.y - 8) <= 14) {
                return { tool: 'ruler', mode: 'rotate' };
            }
            // Resize handle at far right edge (halfL, 0)
            if (Math.abs(loc.x - halfL) <= 12 && Math.abs(loc.y) <= halfH) {
                return { tool: 'ruler', mode: 'resize' };
            }
            // Draw straight line button in center (85, 8)
            if (Math.abs(loc.x - 85) <= 44 && Math.abs(loc.y - 8) <= 12) {
                return { tool: 'ruler', mode: 'draw_edge' };
            }
            // Ruler body (leave top 6px edge free for pen snapping)
            if (Math.abs(loc.x) <= halfL && loc.y >= -halfH + 5 && loc.y <= halfH) {
                return { tool: 'ruler', mode: 'move' };
            }
        }

        return null;
    }

    /**
     * مغنطة القلم على الحافة العليا للمسطرة التفاعلية لرسم القطع والمستقيمات بدقة هندسية
     */
    function snapPointToRulerEdgeIfClose(px, py) {
        if (!rulerState.visible) return { x: px, y: py };
        if (currentTool !== 'pen' && currentTool !== 'highlighter' && currentTool !== 'line' && currentTool !== 'arrow') {
            return { x: px, y: py };
        }
        const loc = toLocalToolCoords(px, py, rulerState);
        const halfL = (rulerState.length || 440) / 2;
        const halfH = (rulerState.height || 54) / 2;

        // Top edge of ruler is at loc.y = -halfH
        if (Math.abs(loc.x) <= halfL + 10 && Math.abs(loc.y - (-halfH)) <= 16) {
            return toWorldToolCoords(loc.x, -halfH - 1, rulerState);
        }
        // Bottom edge of ruler is at loc.y = +halfH
        if (Math.abs(loc.x) <= halfL + 10 && Math.abs(loc.y - halfH) <= 14) {
            return toWorldToolCoords(loc.x, halfH + 1, rulerState);
        }
        return { x: px, y: py };
    }

    /**
     * مغنطة القلم على ضلعي الزاوية القائمة للكوس الهندسي (Équerre)
     */
    function snapPointToSetSquareEdgeIfClose(px, py) {
        if (!setSquareState.visible) return { x: px, y: py };
        if (currentTool !== 'pen' && currentTool !== 'highlighter' && currentTool !== 'line' && currentTool !== 'arrow') {
            return { x: px, y: py };
        }
        const loc = toLocalToolCoords(px, py, setSquareState);
        const size = setSquareState.size || 260;

        // Snap to horizontal leg (loc.y = 0, 0 <= loc.x <= size)
        if (loc.x >= -8 && loc.x <= size + 10 && Math.abs(loc.y) <= 15) {
            return toWorldToolCoords(loc.x, -1, setSquareState);
        }
        // Snap to vertical leg (loc.x = 0, -size <= loc.y <= 0)
        if (loc.y >= -size - 10 && loc.y <= 8 && Math.abs(loc.x) <= 15) {
            return toWorldToolCoords(1, loc.y, setSquareState);
        }
        return { x: px, y: py };
    }

    /**
     * دمج مغنطة القلم على الأدوات النشطة
     */
    function snapPointToToolsIfClose(px, py) {
        if (rulerState.visible) {
            const rSnap = snapPointToRulerEdgeIfClose(px, py);
            if (rSnap.x !== px || rSnap.y !== py) return rSnap;
        }
        if (setSquareState.visible) {
            const sqSnap = snapPointToSetSquareEdgeIfClose(px, py);
            if (sqSnap.x !== px || sqSnap.y !== py) return sqSnap;
        }
        return { x: px, y: py };
    }

    /**
     * تسطير مستقيم كامل على طول حافة المسطرة بنقرة زر واحدة
     */
    function drawFullRulerEdgeToInk() {
        if (!ctx || !rulerState.visible) return;
        saveStateForUndo();
        const halfL = (rulerState.length || 440) / 2 - 12;
        const halfH = (rulerState.height || 54) / 2;
        const p1 = toWorldToolCoords(-halfL, -halfH - 1, rulerState);
        const p2 = toWorldToolCoords(halfL, -halfH - 1, rulerState);

        const obj = {
            t: 'line',
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            c: currentColor,
            s: Math.max(2, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
    }

    /**
     * رسم وتثبيت زاوية قائمة (90°) متعامدة على طبقة الحبر بواسطة الكوس
     */
    function stampSetSquareRightAngleToInk() {
        if (!ctx || !setSquareState.visible) return;
        saveStateForUndo();
        const len = (setSquareState.size || 260) * 0.7;
        const origin = toWorldToolCoords(0, 0, setSquareState);
        const hEnd = toWorldToolCoords(len, 0, setSquareState);
        const vEnd = toWorldToolCoords(0, -len, setSquareState);

        const sqSize = 22;
        const sq1 = toWorldToolCoords(sqSize, 0, setSquareState);
        const sqCorner = toWorldToolCoords(sqSize, -sqSize, setSquareState);
        const sq2 = toWorldToolCoords(0, -sqSize, setSquareState);
        const dot = toWorldToolCoords(sqSize / 2, -sqSize / 2, setSquareState);

        const xs = [origin.x, hEnd.x, vEnd.x];
        const ys = [origin.y, hEnd.y, vEnd.y];
        const minX = Math.min(...xs) - 6;
        const minY = Math.min(...ys) - 6;
        const boxW = Math.max(24, Math.max(...xs) + 6 - minX);
        const boxH = Math.max(24, Math.max(...ys) + 6 - minY);

        const obj = {
            t: 'right_angle',
            x: minX,
            y: minY,
            w: boxW,
            h: boxH,
            baseW: boxW,
            baseH: boxH,
            origin: [origin.x, origin.y],
            hEnd: [hEnd.x, hEnd.y],
            vEnd: [vEnd.x, vEnd.y],
            sq1: [sq1.x, sq1.y],
            sqCorner: [sqCorner.x, sqCorner.y],
            sq2: [sq2.x, sq2.y],
            dot: [dot.x, dot.y],
            c: currentColor,
            s: Math.max(2, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification('📐 تم رسم وتثبيت زاوية قائمة (90°) متعامدة', 'success');
        }
    }

    /**
     * رسم وتثبيت الزاوية المحددة على المنقلة مباشرة فوق طبقة الحبر (#mathWhiteboardCanvas)
     */
    function stampProtractorAngleToInk() {
        if (!ctx || !protractorState.visible) return;
        saveStateForUndo();
        const r = (protractorState.radius || 170) * 0.78;
        const deg = protractorState.rayAngleDeg || 60;
        const rayRad = (deg * Math.PI) / 180;

        const origin = toWorldToolCoords(0, 0, protractorState);
        const baseEnd = toWorldToolCoords(r, 0, protractorState);
        const rayEnd = toWorldToolCoords(r * Math.cos(rayRad), -r * Math.sin(rayRad), protractorState);
        const midRad = rayRad / 2;
        const labelPos = toWorldToolCoords(52 * Math.cos(midRad), -52 * Math.sin(midRad), protractorState);

        const xs = [origin.x, baseEnd.x, rayEnd.x, labelPos.x];
        const ys = [origin.y, baseEnd.y, rayEnd.y, labelPos.y];
        const minX = Math.min(...xs) - 16;
        const minY = Math.min(...ys) - 16;
        const boxW = Math.max(40, Math.max(...xs) + 16 - minX);
        const boxH = Math.max(40, Math.max(...ys) + 16 - minY);

        const obj = {
            t: 'angle_arc',
            x: minX,
            y: minY,
            w: boxW,
            h: boxH,
            baseW: boxW,
            baseH: boxH,
            origin: [origin.x, origin.y],
            baseEnd: [baseEnd.x, baseEnd.y],
            rayEnd: [rayEnd.x, rayEnd.y],
            labelPos: [labelPos.x, labelPos.y],
            startWorldAngle: protractorState.angle - rayRad,
            endWorldAngle: protractorState.angle,
            deg,
            c: currentColor,
            s: Math.max(2, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
    }

    /**
     * رسم وتثبيت دائرة البركار مع مركزها وشعاعها على طبقة الحبر (#mathWhiteboardCanvas)
     */
    function stampCompassCircleToInk() {
        if (!ctx || !compassState.visible) return;
        saveStateForUndo();
        const r = compassState.radius || 120;
        const cx = compassState.x;
        const cy = compassState.y;
        const rCm = Math.round((r / 20) * 10) / 10;

        const obj = {
            t: 'compass_circle',
            x: cx - r,
            y: cy - r,
            w: r * 2,
            h: r * 2,
            angle: compassState.angle || 0,
            c: currentColor,
            s: Math.max(2, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🧭 تم رسم دائرة بالبركار (الشعاع R = ${rCm} cm)`, 'success');
        }
    }

    /**
     * رسم قوس إنشاء هندسي بالبركار (زاوية 70 درجة حول اتجاه إبرة القلم) للإنشاءات الهندسية والواسطات
     */
    function stampCompassArcToInk() {
        if (!ctx || !compassState.visible) return;
        saveStateForUndo();
        const r = compassState.radius || 120;
        const cx = compassState.x;
        const cy = compassState.y;

        const obj = {
            t: 'compass_arc',
            x: cx - r,
            y: cy - r,
            w: r * 2,
            h: r * 2,
            angle: compassState.angle || 0,
            c: currentColor,
            s: Math.max(2, currentSize)
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('🧭 تم رسم قوس الإنشاء الهندسي بالبركار بنجاح', 'success');
        }
    }

    /**
     * رسم الستار البيداغوجي للإخفاء التدريجي على طبقة الأدوات (#whiteboardToolsCanvas)
     */
    function drawPedagogicalCurtain(tCtx, w, h) {
        const cy = Math.max(40, Math.min(h - 36, curtainState.y || 260));
        tCtx.save();

        // Curtain body covering from cy to bottom h
        const grad = tCtx.createLinearGradient(0, cy, 0, h);
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
        grad.addColorStop(1, 'rgba(30, 58, 138, 0.97)');
        tCtx.fillStyle = grad;
        tCtx.fillRect(0, cy, w, h - cy);

        // Top golden/blue handle bar
        tCtx.fillStyle = '#0284c7';
        tCtx.fillRect(0, cy, w, 6);

        // Center grab pill
        const pillW = 240;
        const pillH = 26;
        const pillX = (w - pillW) / 2;
        const pillY = cy + 6;
        tCtx.fillStyle = '#0f172a';
        tCtx.strokeStyle = '#38bdf8';
        tCtx.lineWidth = 1.5;
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(pillX, pillY, pillW, pillH, 12);
        } else {
            tCtx.rect(pillX, pillY, pillW, pillH);
        }
        tCtx.fill();
        tCtx.stroke();

        tCtx.fillStyle = '#e0f2fe';
        tCtx.font = 'bold 11px "Cairo", sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('🎭 اسحب الستار للأسفل لكشف مراحل الحل تدريجياً ↕', w / 2, pillY + pillH / 2);

        // Close button at right
        tCtx.fillStyle = '#ef4444';
        tCtx.beginPath();
        tCtx.arc(w - 32, cy + 18, 11, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 12px sans-serif';
        tCtx.fillText('×', w - 32, cy + 18);

        tCtx.restore();
    }

    function startLaserTrailLoop() {
        if (laserTrailAnimId) return;
        const step = () => {
            const now = performance.now();
            laserTrailPoints = laserTrailPoints.filter(p => (now - p.t) < 1100);
            renderGeometricToolsOverlay();
            if (laserTrailPoints.length > 0 || (currentTool === 'laser' && laserPointerPos)) {
                laserTrailAnimId = requestAnimationFrame(step);
            } else {
                laserTrailAnimId = null;
            }
        };
        laserTrailAnimId = requestAnimationFrame(step);
    }

    function drawSpotlightFocusOverlay(tCtx, w, h, x, y, radius) {
        tCtx.save();
        // Dim everything outside the glowing focus aperture
        tCtx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        tCtx.beginPath();
        tCtx.rect(0, 0, w, h);
        tCtx.arc(x, y, radius, 0, Math.PI * 2, true);
        tCtx.fill('evenodd');

        // Soft glowing amber ring around the illuminated zone
        tCtx.strokeStyle = 'rgba(250, 204, 21, 0.92)';
        tCtx.lineWidth = 3;
        tCtx.shadowColor = 'rgba(250, 204, 21, 0.85)';
        tCtx.shadowBlur = 16;
        tCtx.beginPath();
        tCtx.arc(x, y, radius, 0, Math.PI * 2);
        tCtx.stroke();

        // Compact instruction pill below the spotlight aperture
        tCtx.shadowBlur = 0;
        tCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        const labelText = `🔦 بقعة التركيز (عجلة الفأرة لتغيير القطر • Esc للخروج)`;
        tCtx.font = 'bold 11px "Cairo", sans-serif';
        const tw = tCtx.measureText(labelText).width + 20;
        const lx = Math.max(10, Math.min(w - tw - 10, x - tw / 2));
        const ly = Math.min(h - 32, y + radius + 12);
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(lx, ly, tw, 24, 10);
        } else {
            tCtx.rect(lx, ly, tw, 24);
        }
        tCtx.fill();
        tCtx.strokeStyle = '#facc15';
        tCtx.lineWidth = 1;
        tCtx.stroke();

        tCtx.fillStyle = '#fef08a';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(labelText, lx + tw / 2, ly + 12);
        tCtx.restore();
    }

    /**
     * رسم المسطرة والمنقلة والكوس والبركار والستار وبقعة التركيز ومؤشر الليزر على طبقة الأدوات (#whiteboardToolsCanvas)
     */
    function renderGeometricToolsOverlay() {
        if (!toolsCanvas) {
            toolsCanvas = document.getElementById('whiteboardToolsCanvas');
            if (toolsCanvas) toolsCtx = toolsCanvas.getContext('2d');
        }
        if (!toolsCanvas || !toolsCtx) return;

        const w = lastValidWidth || parseFloat(toolsCanvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(toolsCanvas.style.height) || 600;

        toolsCtx.save();
        toolsCtx.clearRect(0, 0, w, h);

        if (currentTool === 'spotlight' && spotlightState.active) {
            drawSpotlightFocusOverlay(toolsCtx, w, h, spotlightState.x, spotlightState.y, spotlightState.radius);
        }
        if (curtainState.visible) {
            drawPedagogicalCurtain(toolsCtx, w, h);
        }
        if (rulerState.visible) {
            drawInteractiveRuler(toolsCtx);
        }
        if (protractorState.visible) {
            drawInteractiveProtractor(toolsCtx);
        }
        if (setSquareState.visible) {
            drawInteractiveSetSquare(toolsCtx);
        }
        if (compassState.visible) {
            drawInteractiveCompass(toolsCtx);
        }
        if (laserTrailPoints.length > 0 || laserPointerPos) {
            drawLaserPointer(toolsCtx, laserPointerPos ? laserPointerPos.x : null, laserPointerPos ? laserPointerPos.y : null);
        }
        if (selectedVectorIndex >= 0 && window.WbVectorEngine) {
            const activeArr = getActiveVectorArray();
            const selObj = activeArr[selectedVectorIndex];
            if (selObj) {
                const selBounds = window.WbVectorEngine.getObjectBounds(selObj, getVectorEnv());
                if (selBounds) {
                    window.WbVectorEngine.drawSelectionOverlay(toolsCtx, selBounds);
                }
            }
        }
        const nowPeerTs = Date.now();
        let hasActiveRemotePeer = false;
        remotePeers.forEach((peer, peerId) => {
            if (peer && (nowPeerTs - (peer.ts || 0) < 15000)) {
                hasActiveRemotePeer = true;
                drawStudentCursorBadge(toolsCtx, peer.x, peer.y, peer.name, peer.role);
            } else {
                remotePeers.delete(peerId);
            }
        });
        if (!hasActiveRemotePeer && studentCallState.active && studentCursorPos) {
            drawStudentCursorBadge(toolsCtx, studentCursorPos.x, studentCursorPos.y, studentCallState.studentName, studentCallState.studentRole);
        }

        toolsCtx.restore();
    }

    function drawInteractiveCompass(tCtx) {
        const r = compassState.radius || 120;
        const rCm = Math.round((r / 20) * 10) / 10;

        tCtx.save();
        tCtx.translate(compassState.x, compassState.y);
        tCtx.rotate(compassState.angle || 0);

        // Preview dashed circle around needle center (0,0)
        tCtx.save();
        tCtx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
        tCtx.lineWidth = 1.4;
        tCtx.setLineDash([6, 4]);
        tCtx.beginPath();
        tCtx.arc(0, 0, r, 0, Math.PI * 2);
        tCtx.stroke();
        tCtx.restore();

        // Highlighted construction arc preview (-35° to +35°)
        tCtx.save();
        tCtx.strokeStyle = '#ea580c';
        tCtx.lineWidth = 2.6;
        tCtx.beginPath();
        tCtx.arc(0, 0, r, -(35 * Math.PI) / 180, (35 * Math.PI) / 180);
        tCtx.stroke();
        tCtx.restore();

        // Compass legs from hinge (r/2, -95) to needle (0,0) and pencil tip (r,0)
        const hingeX = r / 2;
        const hingeY = -95;

        tCtx.save();
        tCtx.shadowColor = 'rgba(15, 23, 42, 0.25)';
        tCtx.shadowBlur = 8;
        tCtx.lineCap = 'round';
        tCtx.lineJoin = 'round';

        // Left leg (needle leg)
        tCtx.strokeStyle = '#475569';
        tCtx.lineWidth = 6;
        tCtx.beginPath();
        tCtx.moveTo(hingeX, hingeY);
        tCtx.lineTo(0, 0);
        tCtx.stroke();

        // Right leg (pencil leg)
        tCtx.strokeStyle = '#d97706';
        tCtx.lineWidth = 6;
        tCtx.beginPath();
        tCtx.moveTo(hingeX, hingeY);
        tCtx.lineTo(r, 0);
        tCtx.stroke();

        // Top hinge cap
        tCtx.fillStyle = '#1e293b';
        tCtx.beginPath();
        tCtx.arc(hingeX, hingeY, 10, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.restore();

        // Needle center point at (0,0)
        tCtx.fillStyle = '#dc2626';
        tCtx.beginPath();
        tCtx.arc(0, 0, 5, 0, Math.PI * 2);
        tCtx.fill();

        // Resize / Pencil tip handle at (r, 0)
        tCtx.fillStyle = '#0284c7';
        tCtx.beginPath();
        tCtx.arc(r, 0, 10, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 10px sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('↔', r, 0);

        // Two action buttons: 1) Full Circle (⭕ دائرة)  2) Construction Arc (✏️ قوس)
        tCtx.fillStyle = '#d97706';
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(hingeX - 52, -67, 50, 22, 6);
        } else {
            tCtx.rect(hingeX - 52, -67, 50, 22);
        }
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 8.5px "Cairo", sans-serif';
        tCtx.fillText(`⭕ ${rCm}cm`, hingeX - 27, -56);

        tCtx.fillStyle = '#059669';
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(hingeX + 2, -67, 50, 22, 6);
        } else {
            tCtx.rect(hingeX + 2, -67, 50, 22);
        }
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.fillText('✏️ قوس', hingeX + 27, -56);

        // Close button at (hingeX + 24, -105)
        tCtx.fillStyle = '#ef4444';
        tCtx.beginPath();
        tCtx.arc(hingeX + 24, -105, 10, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 11px sans-serif';
        tCtx.fillText('×', hingeX + 24, -105);

        tCtx.restore();
    }

    function drawStudentCursorBadge(tCtx, x, y, name, role) {
        tCtx.save();
        const isStudent = role === 'student';
        const clr = isStudent ? '#059669' : '#2563eb';
        const label = isStudent ? `✏️ ${name || 'التلميذ(ة)'}` : `🎓 الأستاذ`;

        tCtx.fillStyle = clr;
        tCtx.beginPath();
        tCtx.arc(x, y, 4, 0, Math.PI * 2);
        tCtx.fill();

        tCtx.font = 'bold 11px "Cairo", sans-serif';
        const textWidth = tCtx.measureText(label).width;
        const pillW = textWidth + 14;
        const pillH = 20;
        const pillX = x + 10;
        const pillY = y - 24;

        tCtx.fillStyle = clr;
        tCtx.shadowColor = 'rgba(0,0,0,0.3)';
        tCtx.shadowBlur = 6;
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(pillX, pillY, pillW, pillH, 8);
        } else {
            tCtx.rect(pillX, pillY, pillW, pillH);
        }
        tCtx.fill();

        tCtx.shadowBlur = 0;
        tCtx.fillStyle = '#ffffff';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(label, pillX + pillW / 2, pillY + pillH / 2);
        tCtx.restore();
    }

    function drawLaserPointer(tCtx, x, y) {
        tCtx.save();
        const now = performance.now();
        // Draw glowing fading laser trail
        if (laserTrailPoints.length >= 2) {
            tCtx.lineCap = 'round';
            tCtx.lineJoin = 'round';
            tCtx.shadowColor = '#ef4444';
            tCtx.shadowBlur = 14;
            for (let i = 1; i < laserTrailPoints.length; i++) {
                const p0 = laserTrailPoints[i - 1];
                const p1 = laserTrailPoints[i];
                const age = now - p1.t;
                if (age >= 1100) continue;
                const life = Math.max(0, 1 - age / 1100);
                tCtx.strokeStyle = `rgba(239, 68, 68, ${(life * 0.9).toFixed(3)})`;
                tCtx.lineWidth = Math.max(1.8, 7 * life);
                tCtx.beginPath();
                tCtx.moveTo(p0.x, p0.y);
                tCtx.lineTo(p1.x, p1.y);
                tCtx.stroke();

                tCtx.strokeStyle = `rgba(255, 255, 255, ${(life * 0.75).toFixed(3)})`;
                tCtx.lineWidth = Math.max(0.8, 2.5 * life);
                tCtx.beginPath();
                tCtx.moveTo(p0.x, p0.y);
                tCtx.lineTo(p1.x, p1.y);
                tCtx.stroke();
            }
        }

        if (x !== null && y !== null) {
            tCtx.shadowColor = '#ef4444';
            tCtx.shadowBlur = 18;

            const grad = tCtx.createRadialGradient(x, y, 2, x, y, 14);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, '#f87171');
            grad.addColorStop(0.7, '#ef4444');
            grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

            tCtx.fillStyle = grad;
            tCtx.beginPath();
            tCtx.arc(x, y, 14, 0, Math.PI * 2);
            tCtx.fill();

            tCtx.fillStyle = '#ffffff';
            tCtx.beginPath();
            tCtx.arc(x, y, 3, 0, Math.PI * 2);
            tCtx.fill();
        }
        tCtx.restore();
    }

    function drawInteractiveSetSquare(tCtx) {
        const size = setSquareState.size || 260;
        const degAngle = Math.round(((setSquareState.angle * 180) / Math.PI) * 10) / 10;

        tCtx.save();
        tCtx.translate(setSquareState.x, setSquareState.y);
        tCtx.rotate(setSquareState.angle);

        // Shadow & translucent emerald/teal drafting body
        tCtx.save();
        tCtx.shadowColor = 'rgba(15, 23, 42, 0.24)';
        tCtx.shadowBlur = 14;
        tCtx.shadowOffsetY = 4;

        tCtx.beginPath();
        tCtx.moveTo(0, 0);
        tCtx.lineTo(size, 0);
        tCtx.lineTo(0, -size);
        tCtx.closePath();

        const grad = tCtx.createLinearGradient(0, 0, size, -size);
        grad.addColorStop(0, 'rgba(209, 250, 229, 0.90)');
        grad.addColorStop(1, 'rgba(167, 243, 208, 0.84)');
        tCtx.fillStyle = grad;
        tCtx.strokeStyle = '#059669';
        tCtx.lineWidth = 2;
        tCtx.fill();
        tCtx.stroke();
        tCtx.restore();

        // Triangular cutout in center (drafting square window)
        const cutStart = size * 0.22;
        const cutEnd = size * 0.72;
        tCtx.save();
        tCtx.beginPath();
        tCtx.moveTo(cutStart, -cutStart * 0.5);
        tCtx.lineTo(cutEnd, -cutStart * 0.5);
        tCtx.lineTo(cutStart, -cutEnd);
        tCtx.closePath();
        tCtx.fillStyle = 'rgba(255, 255, 255, 0.68)';
        tCtx.strokeStyle = 'rgba(5, 150, 105, 0.45)';
        tCtx.lineWidth = 1.3;
        tCtx.fill();
        tCtx.stroke();
        tCtx.restore();

        // 90° Right Angle Marker in the corner (0, 0)
        tCtx.strokeStyle = '#047857';
        tCtx.lineWidth = 1.6;
        tCtx.beginPath();
        tCtx.moveTo(22, 0);
        tCtx.lineTo(22, -22);
        tCtx.lineTo(0, -22);
        tCtx.stroke();
        tCtx.fillStyle = '#047857';
        tCtx.beginPath();
        tCtx.arc(11, -11, 2.5, 0, Math.PI * 2);
        tCtx.fill();

        // Millimeter ticks along horizontal leg (0 to size)
        tCtx.fillStyle = '#064e3b';
        tCtx.strokeStyle = '#064e3b';
        tCtx.font = 'bold 9px "Cairo", sans-serif';
        tCtx.textAlign = 'center';

        const totalMm = Math.floor((size - 14) / 2);
        for (let mm = 0; mm <= totalMm; mm++) {
            const x = 14 + mm * 2;
            let tickH = 4;
            if (mm % 10 === 0) {
                tickH = 11;
                tCtx.lineWidth = 1.3;
                tCtx.fillText(String(mm / 10), x, -tickH - 2);
            } else if (mm % 5 === 0) {
                tickH = 7;
                tCtx.lineWidth = 0.9;
            } else {
                tCtx.lineWidth = 0.5;
            }
            tCtx.beginPath();
            tCtx.moveTo(x, 0);
            tCtx.lineTo(x, -tickH);
            tCtx.stroke();
        }

        // Millimeter ticks along vertical leg (0 to -size)
        tCtx.textAlign = 'left';
        tCtx.textBaseline = 'middle';
        for (let mm = 0; mm <= totalMm; mm++) {
            const y = -(14 + mm * 2);
            let tickW = 4;
            if (mm % 10 === 0) {
                tickW = 11;
                tCtx.lineWidth = 1.3;
                tCtx.fillText(String(mm / 10), tickW + 2, y);
            } else if (mm % 5 === 0) {
                tickW = 7;
                tCtx.lineWidth = 0.9;
            } else {
                tCtx.lineWidth = 0.5;
            }
            tCtx.beginPath();
            tCtx.moveTo(0, y);
            tCtx.lineTo(tickW, y);
            tCtx.stroke();
        }

        // Info Badge (Angle & 90°)
        tCtx.fillStyle = 'rgba(6, 78, 59, 0.85)';
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(size * 0.28, -size * 0.42, 90, 20, 8) : tCtx.rect(size * 0.28, -size * 0.42, 90, 20);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 9.5px "Cairo", sans-serif';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(`📐 90° | ${degAngle}°`, size * 0.28 + 45, -size * 0.42 + 10);

        // Quick Button: "رسم تعامد" (Stamp Right Angle)
        tCtx.fillStyle = '#059669';
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(size * 0.25, -size * 0.24, 96, 20, 8) : tCtx.rect(size * 0.25, -size * 0.24, 96, 20);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 9px "Cairo", sans-serif';
        tCtx.fillText('✏️ رسم زاوية قائمة', size * 0.25 + 48, -size * 0.24 + 10);

        // Close handle at hypotenuse outer corner (size - 18, -12)
        tCtx.fillStyle = '#ef4444';
        tCtx.beginPath();
        tCtx.arc(size - 18, -12, 10, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 11px sans-serif';
        tCtx.fillText('×', size - 18, -12);

        // Rotate handle at top corner (12, -size + 18)
        tCtx.fillStyle = '#0284c7';
        tCtx.beginPath();
        tCtx.arc(12, -size + 18, 11, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 12px sans-serif';
        tCtx.fillText('↻', 12, -size + 18);

        tCtx.restore();
    }

    function drawInteractiveRuler(tCtx) {
        const halfL = (rulerState.length || 440) / 2;
        const halfH = (rulerState.height || 54) / 2;
        const degAngle = Math.round(((rulerState.angle * 180) / Math.PI) * 10) / 10;

        tCtx.save();
        tCtx.translate(rulerState.x, rulerState.y);
        tCtx.rotate(rulerState.angle);

        // Drop shadow & translucent body
        tCtx.save();
        tCtx.shadowColor = 'rgba(15, 23, 42, 0.25)';
        tCtx.shadowBlur = 12;
        tCtx.shadowOffsetY = 4;
        const grad = tCtx.createLinearGradient(0, -halfH, 0, halfH);
        grad.addColorStop(0, 'rgba(224, 242, 254, 0.88)');
        grad.addColorStop(1, 'rgba(186, 230, 253, 0.82)');
        tCtx.fillStyle = grad;
        tCtx.strokeStyle = '#0284c7';
        tCtx.lineWidth = 2;
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(-halfL, -halfH, halfL * 2, halfH * 2, 6) : tCtx.rect(-halfL, -halfH, halfL * 2, halfH * 2);
        tCtx.fill();
        tCtx.stroke();
        tCtx.restore();

        // Highlight active drawing top edge
        tCtx.strokeStyle = '#0369a1';
        tCtx.lineWidth = 2.5;
        tCtx.beginPath();
        tCtx.moveTo(-halfL, -halfH);
        tCtx.lineTo(halfL, -halfH);
        tCtx.stroke();

        // Centimeter & millimeter graduations (20px = 1cm, 2px = 1mm)
        const pxPerCm = 20;
        const startX = -halfL + 16;
        const endX = halfL - 16;
        const totalMm = Math.floor((endX - startX) / 2);

        tCtx.fillStyle = '#0f172a';
        tCtx.strokeStyle = '#0f172a';
        tCtx.font = 'bold 10px "Cairo", sans-serif';
        tCtx.textAlign = 'center';

        for (let mm = 0; mm <= totalMm; mm++) {
            const x = startX + mm * 2;
            let tickH = 5;
            if (mm % 10 === 0) {
                tickH = 14;
                tCtx.lineWidth = 1.4;
                const cmVal = mm / 10;
                tCtx.fillText(String(cmVal), x, -halfH + 23);
            } else if (mm % 5 === 0) {
                tickH = 9;
                tCtx.lineWidth = 1.1;
            } else {
                tCtx.lineWidth = 0.7;
            }
            tCtx.beginPath();
            tCtx.moveTo(x, -halfH);
            tCtx.lineTo(x, -halfH + tickH);
            tCtx.stroke();
        }

        // Info badge (Angle & Length)
        tCtx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(-55, -2, 110, 20, 10) : tCtx.rect(-55, -2, 110, 20);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 10.5px "Cairo", sans-serif';
        tCtx.fillText(`📏 ${Math.round(totalMm / 10)} cm | ${degAngle}°`, 0, 11);

        // Quick "سطّر مستقيم" button on ruler
        tCtx.fillStyle = '#0284c7';
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(44, -2, 82, 20, 8) : tCtx.rect(44, -2, 82, 20);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 9.5px "Cairo", sans-serif';
        tCtx.fillText('✏️ تسطير الحافة', 85, 11);

        // Close button (-halfL + 20, 8)
        tCtx.fillStyle = '#ef4444';
        tCtx.beginPath();
        tCtx.arc(-halfL + 20, 8, 10, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 11px sans-serif';
        tCtx.fillText('×', -halfL + 20, 12);

        // Rotate handle (halfL - 22, 8)
        tCtx.fillStyle = '#2563eb';
        tCtx.beginPath();
        tCtx.arc(halfL - 22, 8, 11, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 12px sans-serif';
        tCtx.fillText('↻', halfL - 22, 12);

        tCtx.restore();
    }

    function drawInteractiveProtractor(tCtx) {
        const r = protractorState.radius || 170;
        const degAngle = Math.round(((protractorState.angle * 180) / Math.PI) * 10) / 10;
        const rayDeg = protractorState.rayAngleDeg !== undefined ? protractorState.rayAngleDeg : 60;
        const rayRad = (rayDeg * Math.PI) / 180;

        tCtx.save();
        tCtx.translate(protractorState.x, protractorState.y);
        tCtx.rotate(protractorState.angle);

        // Semi-circle translucent body
        tCtx.save();
        tCtx.shadowColor = 'rgba(15, 23, 42, 0.25)';
        tCtx.shadowBlur = 14;
        tCtx.shadowOffsetY = 4;
        const grad = tCtx.createRadialGradient(0, 0, 20, 0, 0, r);
        grad.addColorStop(0, 'rgba(243, 232, 255, 0.72)');
        grad.addColorStop(1, 'rgba(221, 214, 254, 0.88)');
        tCtx.fillStyle = grad;
        tCtx.strokeStyle = '#6d28d9';
        tCtx.lineWidth = 2;

        tCtx.beginPath();
        tCtx.arc(0, 0, r, Math.PI, 0, false);
        tCtx.lineTo(r, 20);
        tCtx.lineTo(-r, 20);
        tCtx.closePath();
        tCtx.fill();
        tCtx.stroke();
        tCtx.restore();

        // Inner cutout arc
        tCtx.strokeStyle = 'rgba(109, 40, 217, 0.4)';
        tCtx.lineWidth = 1.2;
        tCtx.beginPath();
        tCtx.arc(0, 0, r * 0.42, Math.PI, 0, false);
        tCtx.closePath();
        tCtx.stroke();

        // Baseline (0° - 180°) & origin crosshair
        tCtx.strokeStyle = '#4c1d95';
        tCtx.lineWidth = 1.6;
        tCtx.beginPath();
        tCtx.moveTo(-r + 6, 0);
        tCtx.lineTo(r - 6, 0);
        tCtx.moveTo(0, -r + 6);
        tCtx.lineTo(0, 10);
        tCtx.stroke();

        // Origin target point
        tCtx.fillStyle = '#dc2626';
        tCtx.beginPath();
        tCtx.arc(0, 0, 4.5, 0, Math.PI * 2);
        tCtx.fill();

        // Degree ticks (0° to 180°)
        tCtx.fillStyle = '#1e1b4b';
        tCtx.strokeStyle = '#1e1b4b';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';

        for (let d = 0; d <= 180; d++) {
            const rad = (d * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            let tickLen = 5;
            if (d % 10 === 0) {
                tickLen = 13;
                tCtx.lineWidth = 1.3;
            } else if (d % 5 === 0) {
                tickLen = 8;
                tCtx.lineWidth = 0.9;
            } else {
                tCtx.lineWidth = 0.5;
            }

            const x1 = r * cos;
            const y1 = -r * sin;
            const x2 = (r - tickLen) * cos;
            const y2 = -(r - tickLen) * sin;

            tCtx.beginPath();
            tCtx.moveTo(x1, y1);
            tCtx.lineTo(x2, y2);
            tCtx.stroke();

            if (d % 10 === 0) {
                // Outer scale (0 to 180 right-to-left)
                tCtx.font = 'bold 9.5px "Cairo", sans-serif';
                tCtx.fillStyle = '#1e1b4b';
                const tx = (r - 22) * cos;
                const ty = -(r - 22) * sin;
                tCtx.fillText(String(d), tx, ty);

                // Inner scale (180 to 0)
                if (d > 0 && d < 180) {
                    tCtx.font = 'bold 8px "Cairo", sans-serif';
                    tCtx.fillStyle = '#6d28d9';
                    const itx = (r - 35) * cos;
                    const ity = -(r - 35) * sin;
                    tCtx.fillText(String(180 - d), itx, ity);
                }
            }
        }

        // Dynamic Interactive Angle Measurement Ray
        const rayX = (r - 18) * Math.cos(rayRad);
        const rayY = -(r - 18) * Math.sin(rayRad);

        // Shaded sector for measured angle
        tCtx.fillStyle = 'rgba(220, 38, 38, 0.14)';
        tCtx.beginPath();
        tCtx.moveTo(0, 0);
        tCtx.arc(0, 0, 48, 0, -rayRad, true);
        tCtx.closePath();
        tCtx.fill();

        // Ray line
        tCtx.strokeStyle = '#dc2626';
        tCtx.lineWidth = 2.2;
        tCtx.setLineDash([4, 3]);
        tCtx.beginPath();
        tCtx.moveTo(0, 0);
        tCtx.lineTo(rayX, rayY);
        tCtx.stroke();
        tCtx.setLineDash([]);

        // Draggable handle on ray
        tCtx.fillStyle = '#dc2626';
        tCtx.beginPath();
        tCtx.arc(rayX, rayY, 9, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.strokeStyle = '#ffffff';
        tCtx.lineWidth = 2;
        tCtx.stroke();

        // Live Angle Readout & Stamp Button
        tCtx.fillStyle = '#6d28d9';
        tCtx.beginPath();
        tCtx.roundRect ? tCtx.roundRect(-56, 8, 112, 20, 8) : tCtx.rect(-56, 8, 112, 20);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 10px "Cairo", sans-serif';
        tCtx.fillText(`📐 رسم زاوية ${rayDeg}° (${ degAngle }°)`, 0, 18);

        // Close button (-r + 22, -r + 18)
        tCtx.fillStyle = '#ef4444';
        tCtx.beginPath();
        tCtx.arc(-r + 22, -r + 18, 11, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 12px sans-serif';
        tCtx.fillText('×', -r + 22, -r + 18);

        // Rotate handle (r - 22, -r + 18)
        tCtx.fillStyle = '#6d28d9';
        tCtx.beginPath();
        tCtx.arc(r - 22, -r + 18, 12, 0, Math.PI * 2);
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 13px sans-serif';
        tCtx.fillText('↻', r - 22, -r + 18);

        tCtx.restore();
    }

    function openMathFormulaModal() {
        let modal = document.getElementById('whiteboardMathFormulaModal');
        if (modal) {
            modal.style.display = 'flex';
            const input = document.getElementById('wbFormulaLatexInput');
            if (input && input._renderPreview) input._renderPreview();
            return;
        }

        modal = document.createElement('div');
        modal.id = 'whiteboardMathFormulaModal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.backgroundColor = 'rgba(15, 23, 42, 0.65)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '14px';

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 660px; box-shadow: 0 20px 45px rgba(0,0,0,0.22); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.2rem;">∛</span>
                        <span style="font-weight: 800; font-size: 0.96rem;">إدراج صيغ ومعادلات رياضية عالية الجودة (LaTeX / KaTeX)</span>
                    </div>
                    <button type="button" onclick="document.getElementById('whiteboardMathFormulaModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; max-height: 80vh; overflow-y: auto;">
                    <div>
                        <div style="font-size: 0.78rem; font-weight: 800; color: #475569; margin-bottom: 6px;">
                            📚 بنك صيغ ومبرهنات المقرر الدراسي (الثانوي التأهيلي):
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;" id="wbFormulaPresetsContainer">
                            <button type="button" class="wb-f-pill" data-tex="\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">النهايات المثلثية</button>
                            <button type="button" class="wb-f-pill" data-tex="\\lim_{x \\to +\\infty} \\frac{\\ln(x)}{x} = 0" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">التزايد المقارن</button>
                            <button type="button" class="wb-f-pill" data-tex="\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">مشتقة خارج دالتين</button>
                            <button type="button" class="wb-f-pill" data-tex="(T) : y = f'(x_0)(x - x_0) + f(x_0)" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">معادلة المماس</button>
                            <button type="button" class="wb-f-pill" data-tex="\\int_a^b f(t)\\,dt = [F(t)]_a^b = F(b) - F(a)" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">حساب التكامل</button>
                            <button type="button" class="wb-f-pill" data-tex="u_n = u_0 \\cdot q^n \\quad \\left(S_n = u_0 \\frac{1 - q^n}{1 - q}\\right)" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">المتتالية الهندسية</button>
                            <button type="button" class="wb-f-pill" data-tex="\\vec{u} \\cdot \\vec{v} = \\|\\vec{u}\\| \\times \\|\\vec{v}\\| \\times \\cos(\\theta)" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">الجداء السلمي</button>
                            <button type="button" class="wb-f-pill" data-tex="d(A, (P)) = \\frac{|ax_A + by_A + cz_A + d|}{\\sqrt{a^2 + b^2 + c^2}}" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">مسافة نقطة عن مستوى</button>
                            <button type="button" class="wb-f-pill" data-tex="z = r(\\cos\\theta + i\\sin\\theta) = r e^{i\\theta}" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">الشكل المثلثي والأسي</button>
                            <button type="button" class="wb-f-pill" data-tex="\\Delta = b^2 - 4ac \\implies x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">مميز المعادلة 2nde</button>
                            <button type="button" class="wb-f-pill" data-tex="P(A \\cup B) = P(A) + P(B) - P(A \\cap B)" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">اتحاد حدثين</button>
                            <button type="button" class="wb-f-pill" data-tex="C_n^k = \\frac{n!}{k!(n-k)!}" style="background:#f5f3ff; border:1px solid #ddd6fe; color:#6d28d9; padding:4px 9px; border-radius:6px; font-size:0.75rem; font-weight:700; cursor:pointer;">التأليفات التوافقية</button>
                        </div>
                    </div>

                    <div>
                        <label for="wbFormulaLatexInput" style="display: block; font-size: 0.78rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">
                            ✏️ كود الصيغة (LaTeX / الرياضي):
                        </label>
                        <textarea id="wbFormulaLatexInput" rows="2" style="width: 100%; direction: ltr; font-family: monospace; font-size: 0.88rem; padding: 8px 10px; border: 1.5px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none; resize: vertical;">f'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}</textarea>
                    </div>

                    <div>
                        <div style="font-size: 0.78rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">
                            👁️ معاينة بصرية حية للمعادلة:
                        </div>
                        <div id="wbFormulaPreviewBox" style="min-height: 70px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 12px; font-size: 1.25rem; overflow-x: auto;"></div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #f1f5f9; padding: 8px 12px; border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">حجم الخط:</span>
                            <select id="wbFormulaFontSize" style="padding: 3px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.78rem;">
                                <option value="20">صغير (20px)</option>
                                <option value="26" selected>متوسط (26px)</option>
                                <option value="34">كبير (34px)</option>
                                <option value="44">عريض جداً (44px)</option>
                            </select>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: #475569;">لون الصيغة:</span>
                            <input type="color" id="wbFormulaColor" value="${currentColor === '#ffffff' ? '#1e3a8a' : currentColor}" style="width: 28px; height: 28px; border: none; cursor: pointer; border-radius: 4px;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #fafafa;">
                    <button type="button" onclick="document.getElementById('whiteboardMathFormulaModal').style.display='none'" class="btn-secondary" style="padding: 7px 16px; font-size: 0.82rem; font-weight: 700;">إلغاء</button>
                    <button type="button" id="btnInsertFormulaToBoard" class="btn-primary" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 7px 20px; font-size: 0.84rem; font-weight: 800; border-radius: 8px;">➕ إدراج على السبورة</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const input = document.getElementById('wbFormulaLatexInput');
        const previewBox = document.getElementById('wbFormulaPreviewBox');
        const colorInput = document.getElementById('wbFormulaColor');
        const sizeSelect = document.getElementById('wbFormulaFontSize');
        const insertBtn = document.getElementById('btnInsertFormulaToBoard');

        function renderFormulaPreview() {
            const tex = input.value.trim();
            const color = colorInput.value;
            previewBox.style.color = color;
            if (!tex) {
                previewBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.82rem;">اكتب صيغة رياضية في الحقل أعلاه للمعاينة...</span>';
                return;
            }
            if (window.katex && typeof window.katex.renderToString === 'function') {
                try {
                    previewBox.innerHTML = window.katex.renderToString(tex, { displayMode: true, throwOnError: false });
                    return;
                } catch (e) {}
            }
            previewBox.textContent = tex;
        }

        input._renderPreview = renderFormulaPreview;
        input.addEventListener('input', renderFormulaPreview);
        colorInput.addEventListener('input', renderFormulaPreview);

        modal.querySelectorAll('.wb-f-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const tex = btn.getAttribute('data-tex');
                if (tex) {
                    input.value = tex;
                    renderFormulaPreview();
                }
            });
        });

        insertBtn.addEventListener('click', () => {
            const tex = input.value.trim();
            if (!tex) return;
            const color = colorInput.value;
            const size = parseInt(sizeSelect.value, 10) || 26;
            stampKaTeXFormulaToCanvas(tex, color, size);
            modal.style.display = 'none';
        });

        renderFormulaPreview();
    }

    function stampKaTeXFormulaToCanvas(latex, color, fontSize, targetX, targetY) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const posX = targetX !== undefined ? targetX : w / 2;
        const posY = targetY !== undefined ? targetY : h / 2;
        const clr = color || currentColor;
        const fSize = fontSize || 26;

        if (window.katex && typeof window.katex.renderToString === 'function') {
            try {
                const mathHtml = window.katex.renderToString(latex, { displayMode: true, throwOnError: false });
                const svgW = 720;
                const svgH = 150;
                const svgString = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
                        <foreignObject width="100%" height="100%">
                            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fSize}px; color:${clr}; display:flex; align-items:center; justify-content:center; height:100%; font-family:'KaTeX_Main', serif;">
                                ${mathHtml}
                            </div>
                        </foreignObject>
                    </svg>
                `;
                const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
                const obj = {
                    t: 'latex_img',
                    x: posX - 180,
                    y: posY - 40,
                    w: 360,
                    h: 80,
                    src: svgDataUrl,
                    latex,
                    c: clr
                };
                pushVectorObject(obj);
                drawVectorObjectOnCtx(obj);
                persistWhiteboardState();

                if (typeof window.showNotification === 'function') {
                    window.showNotification('∛ تم إدراج الصيغة الرياضية بنجاح على السبورة!', 'success');
                }
                return;
            } catch (err) {}
        }

        const obj = {
            t: 'text',
            x: posX - 60,
            y: posY - Math.round(fSize / 2),
            text: latex,
            fontSize: fSize,
            fontFamily: '"Cairo", serif',
            c: clr,
            s: currentSize
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification('∛ تم إدراج الصيغة الرياضية على السبورة', 'success');
        }
    }

    /* ====================================================================
     * 1. حاسبة ورسم جيوجبرا التفاعلية (GeoGebra Interactive Integration)
     * ==================================================================== */
    function openGeoGebraModal() {
        let modal = document.getElementById('whiteboardGeoGebraModal');
        if (modal) {
            modal.style.display = 'flex';
            return;
        }

        modal = document.createElement('div');
        modal.id = 'whiteboardGeoGebraModal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
        modal.style.backdropFilter = 'blur(6px)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '14px';

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 980px; height: 86vh; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">🌐</span>
                        <span style="font-weight: 800; font-size: 0.98rem;">حاسبة ورسم جيوجبرا التفاعلية (GeoGebra Graphing Calculator)</span>
                        <span style="background: rgba(255,255,255,0.22); font-size: 0.68rem; padding: 2px 8px; border-radius: 5px; font-weight: 800;">السلك الثانوي التأهيلي</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" id="btnWbGeoGebraStamp" style="background: #059669; border: none; color: #fff; padding: 5px 12px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(5,150,105,0.3);">
                            <span>📸 إدراج المعلم والمنحنى في السبورة</span>
                        </button>
                        <button type="button" onclick="document.getElementById('whiteboardGeoGebraModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; overflow-x: auto; flex-wrap: nowrap;">
                    <span style="font-size: 0.72rem; font-weight: 800; color: #475569; white-space: nowrap;">📊 نماذج مقررة سريعة:</span>
                    <button type="button" class="wb-ggb-preset-btn" data-type="homographic" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;">متخاطة ومقاربات f(x)=(2x-1)/(x-1)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="ln" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;">دالة اللوغاريتم ln(x)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="exp" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;">الدالة الأسية exp(x)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="tangent" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;">مماس المنحنى ومعادلته</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="circle" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap;">الدائرة المثلثية مع الزوايا</button>
                </div>

                <div style="flex: 1; position: relative; background: #ffffff;">
                    <iframe id="wbGeoGebraIframe" src="https://www.geogebra.org/calculator?embed" style="width: 100%; height: 100%; border: none; display: block;" allow="fullscreen"></iframe>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.wb-ggb-preset-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const type = this.getAttribute('data-type');
                stampGeoGebraPlot(type);
                modal.style.display = 'none';
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`تم إدراج نموذج ${this.textContent} مباشرة في السبورة!`, 'success');
                }
            });
        });

        const stampBtn = document.getElementById('btnWbGeoGebraStamp');
        if (stampBtn) {
            stampBtn.addEventListener('click', function () {
                drawCartesianAxes();
                drawMathCurve('homographic');
                modal.style.display = 'none';
                if (typeof window.showNotification === 'function') {
                    window.showNotification('📸 تم نسخ المعلم والمنحنى بنجاح إلى السبورة التفاعلية!', 'success');
                }
            });
        }
    }

    function stampGeoGebraPlot(type) {
        drawCartesianAxes();
        if (type === 'homographic') {
            drawMathCurve('homographic');
        } else if (type === 'ln') {
            drawMathCurve('ln');
        } else if (type === 'exp') {
            drawMathCurve('exp');
        } else if (type === 'tangent') {
            drawMathCurve('tangent');
        } else if (type === 'circle') {
            drawTrigonometricCircle();
        }
        persistWhiteboardState();
    }

    /* ====================================================================
     * 2. تسجيل وإعادة تشغيل البراهين خطوة بخطوة (Proof Recorder & Player)
     * ==================================================================== */
    function toggleProofRecording() {
        if (proofRecording.isRecording) {
            stopProofRecording();
        } else {
            startProofRecording();
        }
    }

    function startProofRecording() {
        saveStateForUndo();
        proofRecording.isRecording = true;
        proofRecording.isPlaying = false;
        proofRecording.startTime = Date.now();
        proofRecording.strokes = [];
        proofRecording.baseSnapshot = undoStack[undoStack.length - 1] || (canvas ? canvas.toDataURL() : '');

        const dot = document.getElementById('proofRecordDot');
        if (dot) {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
        }
        const lbl = document.getElementById('btnProofRecordLabel');
        if (lbl) lbl.textContent = '⏹️ إيقاف (00:00)';

        if (proofRecording.timerInterval) clearInterval(proofRecording.timerInterval);
        proofRecording.timerInterval = setInterval(() => {
            if (!proofRecording.isRecording) return;
            const elapsed = Math.floor((Date.now() - proofRecording.startTime) / 1000);
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            const l = document.getElementById('btnProofRecordLabel');
            if (l) l.textContent = `⏹️ إيقاف (${m}:${s})`;
        }, 1000);

        if (typeof window.showNotification === 'function') {
            window.showNotification('⏺️ تم بدء تسجيل البرهان الرياضي! اكتب واشرح على السبورة بحرية.', 'info');
        }
    }

    function stopProofRecording() {
        proofRecording.isRecording = false;
        if (proofRecording.timerInterval) {
            clearInterval(proofRecording.timerInterval);
            proofRecording.timerInterval = null;
        }

        const dot = document.getElementById('proofRecordDot');
        if (dot) {
            dot.style.background = '#6d28d9';
            dot.style.boxShadow = 'none';
        }
        const lbl = document.getElementById('btnProofRecordLabel');
        if (lbl) lbl.textContent = '⏺️ تسجيل برهان';

        if (proofRecording.strokes.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('لم يتم تسجيل أي كتابة أو برهان.', 'warning');
            }
            return;
        }

        const lastStroke = proofRecording.strokes[proofRecording.strokes.length - 1];
        proofTotalDuration = lastStroke.endTime || (Date.now() - proofRecording.startTime);

        const dock = document.getElementById('wbProofPlaybackDock');
        if (dock) dock.style.display = 'flex';
        updateProofPlaybackUI(0);

        if (typeof window.showNotification === 'function') {
            window.showNotification(`✓ تم تسجيل البرهان بنجاح (${proofRecording.strokes.length} خطوة)! يمكنك تشغيله الآن.`, 'success');
        }
    }

    function updateProofRecordingUI() {
        const elapsed = Math.floor((Date.now() - proofRecording.startTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        const l = document.getElementById('btnProofRecordLabel');
        if (l) l.textContent = `⏹️ إيقاف (${m}:${s})`;
    }

    function updateProofPlaybackUI(curMs) {
        const curSec = Math.floor(curMs / 1000);
        const totSec = Math.floor(proofTotalDuration / 1000);
        const curStr = `${String(Math.floor(curSec / 60)).padStart(2, '0')}:${String(curSec % 60).padStart(2, '0')}`;
        const totStr = `${String(Math.floor(totSec / 60)).padStart(2, '0')}:${String(totSec % 60).padStart(2, '0')}`;

        const timerLbl = document.getElementById('wbProofTimerLabel');
        if (timerLbl) timerLbl.textContent = `${curStr} / ${totStr}`;

        const slider = document.getElementById('wbProofProgressSlider');
        if (slider && proofTotalDuration > 0) {
            slider.value = String(Math.min(100, (curMs / proofTotalDuration) * 100));
        }
    }

    function playRecordedProof() {
        if (proofRecording.isRecording) return;
        if (!proofRecording.strokes || proofRecording.strokes.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('لا يوجد برهان مسجل حالياً. اضغط على ⏺️ تسجيل برهان أو اختر نموذجاً من بنك البراهين.', 'warning');
            }
            return;
        }

        if (proofRecording.isPlaying) {
            pauseRecordedProof();
            return;
        }

        proofRecording.isPlaying = true;
        const playBtn = document.getElementById('btnPlayProofAnim');
        if (playBtn) playBtn.textContent = '⏸';

        const dock = document.getElementById('wbProofPlaybackDock');
        if (dock) dock.style.display = 'flex';

        let playbackStart = performance.now() - (proofPlaybackTime / proofPlaybackSpeed);

        function playbackStep(now) {
            if (!proofRecording.isPlaying) return;

            const elapsedReal = now - playbackStart;
            proofPlaybackTime = elapsedReal * proofPlaybackSpeed;

            if (proofPlaybackTime >= proofTotalDuration) {
                renderProofUpToTime(proofTotalDuration);
                updateProofPlaybackUI(proofTotalDuration);
                proofRecording.isPlaying = false;
                if (playBtn) playBtn.textContent = '▶';
                persistWhiteboardState();
                return;
            }

            renderProofUpToTime(proofPlaybackTime);
            updateProofPlaybackUI(proofPlaybackTime);
            requestAnimationFrame(playbackStep);
        }

        requestAnimationFrame(playbackStep);
    }

    function pauseRecordedProof() {
        proofRecording.isPlaying = false;
        const playBtn = document.getElementById('btnPlayProofAnim');
        if (playBtn) playBtn.textContent = '▶';
    }

    function resetProofPlayback() {
        proofRecording.isPlaying = false;
        proofPlaybackTime = 0;
        const playBtn = document.getElementById('btnPlayProofAnim');
        if (playBtn) playBtn.textContent = '▶';
        renderProofUpToTime(0);
        updateProofPlaybackUI(0);
    }

    function seekProofPlayback(percent) {
        const pct = Math.max(0, Math.min(100, Number(percent)));
        proofPlaybackTime = (pct / 100) * proofTotalDuration;
        renderProofUpToTime(proofPlaybackTime);
        updateProofPlaybackUI(proofPlaybackTime);
    }

    function setProofSpeed(spd) {
        proofPlaybackSpeed = Number(spd) || 1.0;
        document.querySelectorAll('.wb-proof-spd-btn').forEach(btn => {
            const s = Number(btn.getAttribute('data-spd'));
            const active = s === proofPlaybackSpeed;
            btn.classList.toggle('active', active);
            btn.style.background = active ? '#a855f7' : 'rgba(255,255,255,0.1)';
            btn.style.borderColor = active ? '#c084fc' : '#475569';
        });
    }

    function closeProofPlaybackDock() {
        pauseRecordedProof();
        const dock = document.getElementById('wbProofPlaybackDock');
        if (dock) dock.style.display = 'none';
    }

    function renderProofUpToTime(targetTime) {
        if (!ctx || !canvas) return;
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;

        clearInkCanvasInternal();

        if (proofRecording.baseSnapshot) {
            if (cachedProofBaseSrc !== proofRecording.baseSnapshot || !cachedProofBaseImg) {
                cachedProofBaseSrc = proofRecording.baseSnapshot;
                cachedProofBaseImg = new Image();
                cachedProofBaseImg.src = proofRecording.baseSnapshot;
            }
            if (cachedProofBaseImg && cachedProofBaseImg.complete) {
                ctx.drawImage(cachedProofBaseImg, 0, 0, w, h);
            }
        }

        for (const stroke of proofRecording.strokes) {
            if (stroke.startTime > targetTime) break;

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.strokeStyle = stroke.color;
            ctx.fillStyle = stroke.color;
            ctx.lineWidth = stroke.size;
            if (stroke.tool === 'highlighter') ctx.globalAlpha = 0.28;

            const visiblePoints = stroke.points.filter(pt => pt.t <= targetTime);
            const isShapeTool = (stroke.tool === 'line' || stroke.tool === 'arrow' || stroke.tool === 'rect' || stroke.tool === 'circle' || stroke.tool === 'triangle');
            if (isShapeTool && visiblePoints.length >= 2 && window.WbVectorEngine && typeof window.WbVectorEngine.drawShape === 'function') {
                const first = visiblePoints[0];
                const last = visiblePoints[visiblePoints.length - 1];
                const dur = Math.max(1, (stroke.endTime || last.t || 1) - (stroke.startTime || first.t || 0));
                const prog = Math.max(0, Math.min(1, (targetTime - (stroke.startTime || 0)) / dur));
                const curX = first.x + (last.x - first.x) * prog;
                const curY = first.y + (last.y - first.y) * prog;
                ctx.restore();
                window.WbVectorEngine.drawShape(ctx, first.x, first.y, curX, curY, stroke.tool, stroke.color, stroke.size);
                continue;
            }
            if (visiblePoints.length === 1) {
                ctx.beginPath();
                ctx.arc(visiblePoints[0].x, visiblePoints[0].y, Math.max(0.8, stroke.size / 2), 0, Math.PI * 2);
                ctx.fill();
            } else if (visiblePoints.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
                for (let i = 1; i < visiblePoints.length; i++) {
                    const p1 = visiblePoints[i - 1];
                    const p2 = visiblePoints[i];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
                }
                const last = visiblePoints[visiblePoints.length - 1];
                ctx.lineTo(last.x, last.y);
                ctx.stroke();

                // Draw arrowhead when stroke is an arrow vector (e.g., Chasles relation)
                if (stroke.tool === 'arrow') {
                    const first = visiblePoints[0];
                    const angle = Math.atan2(last.y - first.y, last.x - first.x);
                    const headLen = Math.max(12, stroke.size * 3.5);
                    ctx.beginPath();
                    ctx.moveTo(last.x, last.y);
                    ctx.lineTo(last.x - headLen * Math.cos(angle - Math.PI / 6), last.y - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.lineTo(last.x - headLen * Math.cos(angle + Math.PI / 6), last.y - headLen * Math.sin(angle + Math.PI / 6));
                    ctx.closePath();
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    function saveProofToBankModal() {
        if (!proofRecording.strokes || proofRecording.strokes.length === 0) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('سجل برهاناً أولاً لحفظه في البنك!', 'warning');
            }
            return;
        }

        let modal = document.getElementById('wbSaveProofTitleModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbSaveProofTitleModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(4px);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:440px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1.5px solid #cbd5e1;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-weight:800;font-size:0.95rem;color:#1e3a8a;">💾 حفظ البرهان الرياضي في بنك البراهين</div>
                    <button type="button" id="wbSaveProofCancelX" style="background:none;border:none;font-size:1rem;color:#64748b;cursor:pointer;">✕</button>
                </div>
                <label style="display:block;font-size:0.78rem;font-weight:700;color:#475569;margin-bottom:6px;">عنوان البرهان أو المبرهنة:</label>
                <input type="text" id="wbSaveProofTitleInput" value="مبرهنة القيم الوسيطية - مثال تطبيقي" style="width:100%;padding:9px 12px;border:1.5px solid #93c5fd;border-radius:8px;font-family:inherit;font-size:0.85rem;font-weight:700;color:#0f172a;margin-bottom:14px;box-sizing:border-box;outline:none;">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="wbSaveProofCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                    <button type="button" id="wbSaveProofConfirmBtn" style="background:#059669;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.8rem;cursor:pointer;">حفظ في البنك</button>
                </div>
            </div>
        `;

        const inputEl = document.getElementById('wbSaveProofTitleInput');
        const close = () => { modal.style.display = 'none'; };
        const confirmSave = () => {
            const title = (inputEl && inputEl.value.trim()) || '';
            if (!title) return;
            close();
            try {
                const savedBank = JSON.parse(localStorage.getItem('math_recorded_proofs_bank') || '[]');
                savedBank.push({
                    id: 'proof_' + Date.now(),
                    title: title,
                    date: new Date().toLocaleDateString('ar-MA'),
                    strokes: proofRecording.strokes,
                    duration: proofTotalDuration,
                    baseSnapshot: proofRecording.baseSnapshot
                });
                localStorage.setItem('math_recorded_proofs_bank', JSON.stringify(savedBank));
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`💾 تم حفظ البرهان "${title}" في بنك البراهين بنجاح!`, 'success');
                }
            } catch (e) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('تعذر حفظ البرهان في الذاكرة المحلية.', 'error');
                }
            }
        };

        document.getElementById('wbSaveProofCancelX').onclick = close;
        document.getElementById('wbSaveProofCancelBtn').onclick = close;
        document.getElementById('wbSaveProofConfirmBtn').onclick = confirmSave;
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmSave(); }
                else if (e.key === 'Escape') close();
            };
        }
    }

    function deleteSavedProofItem(idx) {
        try {
            const savedBank = JSON.parse(localStorage.getItem('math_recorded_proofs_bank') || '[]');
            if (idx >= 0 && idx < savedBank.length) {
                savedBank.splice(idx, 1);
                localStorage.setItem('math_recorded_proofs_bank', JSON.stringify(savedBank));
                openProofBankModal();
                if (typeof window.showNotification === 'function') {
                    window.showNotification('🗑️ تم حذف البرهان المسجل من البنك.', 'info');
                }
            }
        } catch (e) {}
    }

    function openProofBankModal() {
        let savedBank = [];
        try {
            savedBank = JSON.parse(localStorage.getItem('math_recorded_proofs_bank') || '[]');
        } catch (e) {
            savedBank = [];
        }

        let modal = document.getElementById('whiteboardProofBankModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'whiteboardProofBankModal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
            modal.style.backdropFilter = 'blur(5px)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '14px';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 640px; max-height: 85vh; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">📚</span>
                        <span style="font-weight: 800; font-size: 0.98rem;">بنك البراهين الرياضية التفاعلية المسجلة (Step-by-Step Proofs)</span>
                    </div>
                    <button type="button" onclick="document.getElementById('whiteboardProofBankModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
                    <div style="font-size: 0.78rem; font-weight: 800; color: #475569;">
                        🎯 نماذج براهين مقررة جاهزة للتشغيل الفوري:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #f5f3ff; border: 1.5px solid #ddd6fe; border-radius: 8px; padding: 10px 14px;">
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: #6d28d9;">1. مبرهنة القيم الوسيطية (T.V.I) والحلول الفريدة</div>
                                <div style="font-size: 0.68rem; color: #64748b;">اتصال الدالة على [a, b] + الرتابة قطعا + استنتاج وجود حل وحيد المعادلة f(x)=0</div>
                            </div>
                            <button type="button" onclick="window.loadBuiltinProof('tvi')" style="background: #7c3aed; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">▶️ تشغيل العرض</button>
                        </div>

                        <div style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 8px; padding: 10px 14px;">
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: #1d4ed8;">2. علاقة شال والمتجهات في المستوى والفضاء</div>
                                <div style="font-size: 0.68rem; color: #64748b;">برهان هندسي حركي: AB + BC = AC مع التمثيل المتجهي والتحقق الحسابي</div>
                            </div>
                            <button type="button" onclick="window.loadBuiltinProof('chasles')" style="background: #2563eb; color: #fff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">▶️ تشغيل العرض</button>
                        </div>
                    </div>

                    ${savedBank.length > 0 ? `
                        <div style="font-size: 0.78rem; font-weight: 800; color: #475569; margin-top: 8px;">
                            💾 البراهين التي قمت بتسجيلها وحفظها:
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${savedBank.map((item, idx) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px;">
                                    <div>
                                        <div style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">${escWb(item.title)}</div>
                                        <div style="font-size: 0.66rem; color: #64748b;">تاريخ التسجيل: ${escWb(item.date)} | المدة: ${Math.round((item.duration || 0) / 1000)} ثانية</div>
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <button type="button" onclick="window.loadSavedProofItem(${idx})" style="background: #059669; color: #fff; border: none; padding: 4px 10px; border-radius: 5px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">▶️ استرجاع وتشغيل</button>
                                        <button type="button" onclick="window.deleteSavedProofItem(${idx})" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 8px; border-radius: 5px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">🗑️</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function loadBuiltinProof(type) {
        const modal = document.getElementById('whiteboardProofBankModal');
        if (modal) modal.style.display = 'none';

        clearCanvas();
        drawBackground();

        const w = lastValidWidth || 800;
        const h = lastValidHeight || 600;
        const cx = w / 2;
        const cy = h / 2;

        let demoStrokes = [];

        if (type === 'tvi') {
            demoStrokes = [
                { tool: 'pen', color: '#1e3a8a', size: 3, startTime: 0, endTime: 1200, points: [{x: cx - 220, y: cy + 100, t: 0}, {x: cx + 220, y: cy + 100, t: 1200}] },
                { tool: 'pen', color: '#1e3a8a', size: 3, startTime: 1300, endTime: 2400, points: [{x: cx - 180, y: cy + 180, t: 1300}, {x: cx - 180, y: cy - 140, t: 2400}] },
                { tool: 'pen', color: '#059669', size: 4, startTime: 2600, endTime: 4800, points: [{x: cx - 140, y: cy + 70, t: 2600}, {x: cx - 60, y: cy + 20, t: 3200}, {x: cx + 10, y: cy - 40, t: 4000}, {x: cx + 120, y: cy - 110, t: 4800}] },
                { tool: 'pen', color: '#dc2626', size: 3, startTime: 5000, endTime: 5800, points: [{x: cx - 25, y: cy + 90, t: 5000}, {x: cx - 25, y: cy + 110, t: 5800}] }
            ];
            proofTotalDuration = 6000;
        } else {
            demoStrokes = [
                { tool: 'arrow', color: '#2563eb', size: 4, startTime: 0, endTime: 1500, points: [{x: cx - 160, y: cy + 80, t: 0}, {x: cx, y: cy - 80, t: 1500}] },
                { tool: 'arrow', color: '#16a34a', size: 4, startTime: 1700, endTime: 3200, points: [{x: cx, y: cy - 80, t: 1700}, {x: cx + 180, y: cy + 80, t: 3200}] },
                { tool: 'arrow', color: '#dc2626', size: 4, startTime: 3400, endTime: 5200, points: [{x: cx - 160, y: cy + 80, t: 3400}, {x: cx + 180, y: cy + 80, t: 5200}] }
            ];
            proofTotalDuration = 5500;
        }

        proofRecording.strokes = demoStrokes;
        proofRecording.baseSnapshot = '';
        proofPlaybackTime = 0;

        playRecordedProof();

        if (typeof window.showNotification === 'function') {
            window.showNotification('▶️ بدأ العرض الحركي للبرهان خطوة بخطوة!', 'success');
        }
    }

    function loadSavedProofItem(idx) {
        try {
            const savedBank = JSON.parse(localStorage.getItem('math_recorded_proofs_bank') || '[]');
            const item = savedBank[idx];
            if (!item) return;

            const modal = document.getElementById('whiteboardProofBankModal');
            if (modal) modal.style.display = 'none';

            proofRecording.strokes = item.strokes;
            proofRecording.baseSnapshot = item.baseSnapshot || '';
            proofTotalDuration = item.duration || 5000;
            proofPlaybackTime = 0;

            playRecordedProof();

            if (typeof window.showNotification === 'function') {
                window.showNotification(`▶️ تم تحميل وتشغيل برهان: "${item.title}"!`, 'success');
            }
        } catch (e) {}
    }

    /* ====================================================================
     * 3. تصحيح الفروض المنزلية وتطبيقات الدعم عن بعد (Homework Correction)
     * ==================================================================== */
    function openHomeworkCorrectionModal() {
        let modal = document.getElementById('whiteboardHwCorrectionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'whiteboardHwCorrectionModal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
            modal.style.backdropFilter = 'blur(5px)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '14px';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';

        let studentOptions = [
            'فاطمة الزهراء العلمي (2BAC-SM)',
            'أمين الإدريسي (1BAC-SE)',
            'مريم الناصري (2BAC-PC)',
            'طه بنجلون (1BAC-SM)',
            'أيوب الشرايبي (2BAC-SV)',
            'سلمى التازي (1BAC-SE)'
        ];

        try {
            if (window.db && window.db.classes) {
                const found = [];
                for (const cKey in window.db.classes) {
                    const c = window.db.classes[cKey];
                    const arr = Array.isArray(c) ? c : (c && Array.isArray(c.students) ? c.students : []);
                    arr.forEach(s => {
                        if (s && s.name) found.push(`${s.name} (${cKey})`);
                    });
                }
                if (found.length > 0) studentOptions = found;
            }
        } catch (e) {}

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 580px; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #059669, #047857); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">📝</span>
                        <span style="font-weight: 800; font-size: 0.98rem;">فضاء تصحيح الفروض المنزلية وتطبيقات الدعم عن بعد</span>
                    </div>
                    <button type="button" onclick="document.getElementById('whiteboardHwCorrectionModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">👤 اختر التلميذ(ة) صاحب النسخة:</label>
                        <select id="wbHwSelectStudent" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.8rem; background: #fff; color: #1e293b;">
                            ${studentOptions.map(opt => `<option value="${escWb(opt)}">${escWb(opt)}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.78rem; font-weight: 800; color: #1e293b; margin-bottom: 4px;">📑 عنوان الفرض المنزلي:</label>
                        <input type="text" id="wbHwTitleInput" value="الفرض المنزلي رقم 1: النهايات والاتصال وحساب المشتقات" style="width: 100%; padding: 7px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.8rem; box-sizing: border-box;">
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        <button type="button" id="btnLoadStudentSampleCopy" style="background: linear-gradient(135deg, #059669, #047857); color: #fff; border: none; border-radius: 8px; padding: 10px 14px; font-size: 0.84rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <span>✍️ فتح ورقة إجابة التلميذ النموذجية للبدء في التصحيح</span>
                        </button>

                        <div style="text-align: center; font-size: 0.72rem; color: #64748b; font-weight: bold;">— أو —</div>

                        <label style="background: #f0fdf4; border: 1.5px dashed #22c55e; border-radius: 8px; padding: 10px 14px; text-align: center; cursor: pointer; display: block;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #15803d;">📂 استيراد صورة أو PDF لورقة التلميذ من الحاسوب</span>
                            <input type="file" id="wbHwUploadFile" accept="image/*,application/pdf" style="display: none;" onchange="window.handleStudentHomeworkUpload(event)">
                        </label>
                    </div>
                </div>
            </div>
        `;

        const btnSample = document.getElementById('btnLoadStudentSampleCopy');
        if (btnSample) {
            btnSample.addEventListener('click', function () {
                const sName = document.getElementById('wbHwSelectStudent').value;
                const hTitle = document.getElementById('wbHwTitleInput').value;
                modal.style.display = 'none';
                loadSampleStudentHomework(sName, hTitle);
            });
        }
    }

    function loadSampleStudentHomework(studentName, hwTitle) {
        homeworkCorrectionState.active = true;
        homeworkCorrectionState.currentStudent = studentName || 'فاطمة الزهراء العلمي';
        homeworkCorrectionState.currentHomeworkTitle = hwTitle || 'الفرض المنزلي رقم 1';
        homeworkCorrectionState.activeStamp = null;

        setTool('pen');
        setColor('#dc2626');
        setSize(3);

        const badge = document.getElementById('wbHwStudentBadge');
        if (badge) badge.textContent = `تصحيح: ${homeworkCorrectionState.currentStudent}`;

        const pal = document.getElementById('wbHomeworkStampPalette');
        if (pal) pal.style.display = 'flex';

        if (!bgCanvas) bgCanvas = document.getElementById('whiteboardBgCanvas');
        if (bgCanvas) bgCtx = bgCanvas.getContext('2d');
        if (!bgCtx) return;

        const w = lastValidWidth || 800;
        const h = lastValidHeight || 600;

        bgCtx.save();
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, w, h);

        bgCtx.lineWidth = 0.5;
        bgCtx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
        for (let y = 30; y < h; y += 28) {
            bgCtx.beginPath();
            bgCtx.moveTo(0, y);
            bgCtx.lineTo(w, y);
            bgCtx.stroke();
        }

        bgCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        bgCtx.lineWidth = 1.5;
        bgCtx.beginPath();
        bgCtx.moveTo(w - 75, 0);
        bgCtx.lineTo(w - 75, h);
        bgCtx.stroke();

        bgCtx.fillStyle = '#0f172a';
        bgCtx.font = 'bold 15px "Amiri", "Cairo", serif';
        bgCtx.textAlign = 'right';
        bgCtx.fillText(`المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي`, w - 90, 35);
        bgCtx.font = 'bold 13px "Cairo", sans-serif';
        bgCtx.fillStyle = '#1e3a8a';
        bgCtx.fillText(`ورقة إجابة التلميذ(ة): ${homeworkCorrectionState.currentStudent}`, w - 90, 60);
        bgCtx.fillStyle = '#475569';
        bgCtx.fillText(`الموضوع: ${homeworkCorrectionState.currentHomeworkTitle}`, w - 90, 85);

        bgCtx.font = 'bold 14px "Cairo", serif';
        bgCtx.fillStyle = '#1e293b';

        bgCtx.fillText(`التمرين الأول: لتكن الدالة f المعرفة بـ f(x) = (x² - 1) / (x + 2)`, w - 90, 130);
        bgCtx.fillStyle = '#1e3a8a';
        bgCtx.fillText(`1) نحدد مجموعة التعريف: Df = { x ∈ ℝ / x + 2 ≠ 0 } = ℝ \\ {-2}`, w - 110, 165);

        bgCtx.fillText(`2) حساب النهاية: lim (x→+∞) f(x) = lim (x→+∞) x²/x = +∞`, w - 110, 205);
        bgCtx.fillText(`   lim (x→-2⁺) f(x) : لدينا بسط يؤول إلى 3 ومقام يؤول إلى 0⁺ إذن النتيجة +∞`, w - 110, 235);

        bgCtx.fillText(`3) حساب المشتقة: f'(x) = [2x(x+2) - (x²-1)(1)] / (x+2)²`, w - 110, 280);
        bgCtx.fillText(`   = (2x² + 4x - x² + 1) / (x+2)² = (x² + 4x + 1) / (x+2)²`, w - 110, 310);

        bgCtx.fillText(`4) إشارة f'(x) هي إشارة x² + 4x + 1 لأن (x+2)² > 0 على Df`, w - 110, 355);
        bgCtx.fillText(`   Δ = 16 - 4 = 12 > 0  ⇒  x₁ = -2 - √3  و  x₂ = -2 + √3`, w - 110, 385);

        bgCtx.restore();

        clearInkCanvasInternal();
        persistWhiteboardState();

        if (typeof window.showNotification === 'function') {
            window.showNotification('📝 تم فتح ورقة التلميذ! استخدم القلم الأحمر وأختام التقييم للتصحيح.', 'success');
        }
    }

    function handleStudentHomeworkUpload(event) {
        const file = event && event.target && event.target.files && event.target.files[0];
        if (!file) return;

        const modal = document.getElementById('whiteboardHwCorrectionModal');
        if (modal) modal.style.display = 'none';

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            handleWhiteboardPdfFile(event);
            homeworkCorrectionState.active = true;
            homeworkCorrectionState.currentStudent = file.name.replace('.pdf', '');
            const badge = document.getElementById('wbHwStudentBadge');
            if (badge) badge.textContent = `تصحيح: ${homeworkCorrectionState.currentStudent}`;
            const pal = document.getElementById('wbHomeworkStampPalette');
            if (pal) pal.style.display = 'flex';
            setColor('#dc2626');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                if (!bgCanvas) bgCanvas = document.getElementById('whiteboardBgCanvas');
                if (bgCanvas) bgCtx = bgCanvas.getContext('2d');
                if (!bgCtx) return;

                const w = lastValidWidth || 800;
                const h = lastValidHeight || 600;

                bgCtx.save();
                bgCtx.fillStyle = '#ffffff';
                bgCtx.fillRect(0, 0, w, h);
                bgCtx.drawImage(img, 0, 0, w, h);
                bgCtx.restore();

                homeworkCorrectionState.active = true;
                homeworkCorrectionState.currentStudent = file.name;
                const badge = document.getElementById('wbHwStudentBadge');
                if (badge) badge.textContent = `تصحيح: ${homeworkCorrectionState.currentStudent}`;
                const pal = document.getElementById('wbHomeworkStampPalette');
                if (pal) pal.style.display = 'flex';

                setColor('#dc2626');
                clearInkCanvasInternal();
                persistWhiteboardState();

                if (typeof window.showNotification === 'function') {
                    window.showNotification('📄 تم تحميل ورقة التلميذ بنجاح! جاهزة للتصحيح بالقلم والأختام.', 'success');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function toggleHomeworkStampPalette() {
        const pal = document.getElementById('wbHomeworkStampPalette');
        if (!pal) return;
        const isShown = pal.style.display === 'flex';
        pal.style.display = isShown ? 'none' : 'flex';
    }

    function selectHomeworkStamp(type) {
        homeworkCorrectionState.activeStamp = type;
        document.querySelectorAll('.wb-hw-stamp-btn').forEach(btn => {
            const s = btn.getAttribute('data-stamp');
            const active = s === type;
            btn.classList.toggle('active', active);
            btn.style.outline = active ? '2.5px solid #059669' : 'none';
        });
        if (canvas) canvas.style.cursor = 'cell';
        if (typeof window.showNotification === 'function') {
            window.showNotification('انقر الآن على الموضع المطلوب في الورقة لوضع الختم.', 'info');
        }
    }

    function placeHomeworkStamp(x, y, stampType) {
        if (!ctx) return;
        saveStateForUndo();

        let icon = '⭐';
        let label = 'ممتاز واصل!';
        let bgClr = '#fefce8';
        let borderClr = '#facc15';
        let textClr = '#854d0e';

        if (stampType === 'check') {
            icon = '✔️';
            label = 'برهان سليم ومبرر';
            bgClr = '#ecfdf5';
            borderClr = '#34d399';
            textClr = '#065f46';
        } else if (stampType === 'warning') {
            icon = '⚠️';
            label = 'راجع التعليل والمنهجية';
            bgClr = '#fffbeb';
            borderClr = '#fbbf24';
            textClr = '#92400e';
        } else if (stampType === 'error') {
            icon = '❌';
            label = 'خطأ في الحساب العددي';
            bgClr = '#fef2f2';
            borderClr = '#f87171';
            textClr = '#991b1b';
        } else if (stampType === 'df') {
            icon = '💡';
            label = 'حدد Df أولاً';
            bgClr = '#eff6ff';
            borderClr = '#60a5fa';
            textClr = '#1e40af';
        } else if (stampType === 'chasles') {
            icon = '📐';
            label = 'علاقة شال محققة';
            bgClr = '#faf5ff';
            borderClr = '#c084fc';
            textClr = '#6b21a8';
        }

        ctx.save();
        ctx.font = 'bold 12px "Cairo", sans-serif';
        const textWidth = ctx.measureText(`${icon} ${label}`).width;
        ctx.restore();
        const boxW = textWidth + 16;
        const boxH = 26;

        const obj = {
            t: 'stamp',
            x: x - boxW / 2,
            y: y - boxH / 2,
            w: boxW,
            h: boxH,
            icon,
            label,
            bg: bgClr,
            border: borderClr,
            textColor: textClr
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();

        homeworkCorrectionState.activeStamp = null;
        document.querySelectorAll('.wb-hw-stamp-btn').forEach(btn => btn.style.outline = 'none');
        if (canvas) canvas.style.cursor = 'crosshair';
    }

    function stampScoreBadgeModal() {
        let modal = document.getElementById('wbScoreBadgeInputModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbScoreBadgeInputModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(4px);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const quickScores = ['+0.5', '+1', '+1.5', '+2', '+3', '16/20', '18/20', '20/20'];
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1.5px solid #cbd5e1;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-weight:800;font-size:0.95rem;color:#dc2626;">🔢 إدراج علامة السؤال أو النقطة</div>
                    <button type="button" id="wbScoreCancelX" style="background:none;border:none;font-size:1rem;color:#64748b;cursor:pointer;">✕</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">
                    ${quickScores.map(s => `<button type="button" class="wb-quick-score-pill" data-val="${s}" style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:6px;padding:4px 9px;font-size:0.76rem;font-weight:800;cursor:pointer;direction:ltr;">${s}</button>`).join('')}
                </div>
                <input type="text" id="wbScoreBadgeValueInput" value="+2" placeholder="مثال: +1.5 أو 18/20" style="width:100%;padding:9px 12px;border:1.5px solid #fca5a5;border-radius:8px;font-family:inherit;font-size:0.9rem;font-weight:800;color:#dc2626;margin-bottom:14px;box-sizing:border-box;text-align:center;direction:ltr;outline:none;">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="wbScoreCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                    <button type="button" id="wbScoreConfirmBtn" style="background:#dc2626;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.8rem;cursor:pointer;">وضع العلامة</button>
                </div>
            </div>
        `;

        const inputEl = document.getElementById('wbScoreBadgeValueInput');
        const close = () => { modal.style.display = 'none'; };
        const applyScore = (scoreVal) => {
            const score = (scoreVal || (inputEl && inputEl.value) || '').trim();
            if (!score) return;
            close();

            const w = lastValidWidth || 800;
            saveStateForUndo();

            const obj = {
                t: 'score_badge',
                x: w - 62,
                y: 108,
                w: 44,
                h: 44,
                score,
                c: '#dc2626'
            };
            pushVectorObject(obj);
            drawVectorObjectOnCtx(obj);
            persistWhiteboardState();

            if (typeof window.showNotification === 'function') {
                window.showNotification(`🔢 تم وضع علامة السؤال (${score}) في هامش التصحيح!`, 'success');
            }
        };

        modal.querySelectorAll('.wb-quick-score-pill').forEach(btn => {
            btn.onclick = () => applyScore(btn.getAttribute('data-val'));
        });
        document.getElementById('wbScoreCancelX').onclick = close;
        document.getElementById('wbScoreCancelBtn').onclick = close;
        document.getElementById('wbScoreConfirmBtn').onclick = () => applyScore();
        if (inputEl) {
            inputEl.focus();
            inputEl.select();
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); applyScore(); }
                else if (e.key === 'Escape') close();
            };
        }
    }

    function exportCorrectedHomeworkCopy() {
        if (!canvas) return;
        const offscreen = createCompositedCanvas();
        const dataUrl = offscreen.toDataURL('image/png');
        const link = document.createElement('a');
        const sName = (homeworkCorrectionState.currentStudent || 'تلميذ').replace(/[\s()]/g, '_');
        link.download = `تصحيح_فرض_${sName}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();

        if (typeof window.showNotification === 'function') {
            window.showNotification('💾 تم تصدير ورقة التلميذ المصححة بجودة عالية (High-DPI) بنجاح!', 'success');
        }
    }

    function closeHomeworkCorrectionMode() {
        homeworkCorrectionState.active = false;
        homeworkCorrectionState.activeStamp = null;
        const pal = document.getElementById('wbHomeworkStampPalette');
        if (pal) pal.style.display = 'none';
        if (typeof window.showNotification === 'function') {
            window.showNotification('تم إنهاء وضع تصحيح الفروض.', 'info');
        }
    }

    /* ====================================================================
     * 4. السبورة التشاركية ودعوة تلميذ للصعود للسبورة (Student Collaboration)
     * ==================================================================== */
    function escWb(s) {
        return window.WbSecurityMath ? window.WbSecurityMath.escapeHtml(s) : String(s || '');
    }

    function updateCollabRoomBadgeUI(statusInfo) {
        const badge = document.getElementById('wbCollabRoomBadge');
        const room = (collabClient && collabClient.roomCode) || studentCallState.roomCode || 'MATH-BAC-2026';
        const peers = (collabClient && collabClient.peerCount) || 1;
        const connected = statusInfo ? !!statusInfo.connected : (collabClient ? !!collabClient.isConnected : false);
        if (badge) {
            const dot = connected ? '🟢' : '🟡';
            badge.textContent = `${dot} غرفة: ${room} | متصل: ${peers}`;
        }
        const btn = document.getElementById('btnToggleStudentLock');
        const status = document.getElementById('wbStudentPenStatus');
        if (btn) {
            btn.textContent = studentCallState.isLocked ? '🔓 فتح القلم' : '🔒 قفل القلم';
            btn.style.background = studentCallState.isLocked ? '#dc2626' : '#334155';
        }
        if (status) {
            status.textContent = studentCallState.isLocked ? 'حالة القلم: مقفل للشرح 🔴' : 'حالة القلم: متاح للكتابة 🟢';
        }
    }

    function getOrCreateCollabClient() {
        if (collabClient) return collabClient;
        if (!window.WbCollabSync || typeof window.WbCollabSync.WhiteboardCollabClient !== 'function') {
            return null;
        }
        collabClient = new window.WbCollabSync.WhiteboardCollabClient({
            onStatus: (info) => {
                updateCollabRoomBadgeUI(info);
            },
            onEvent: (msg) => {
                if (!msg || !msg.type) return;
                if (msg.type === 'room:presence') {
                    updateCollabRoomBadgeUI();
                    return;
                }
                if (msg.type === 'room:sync') {
                    studentCallState.isLocked = !!msg.locked;
                    const syncObjects = Array.isArray(msg.objects)
                        ? msg.objects
                        : (msg.snapshot && Array.isArray(msg.snapshot.objects) ? msg.snapshot.objects : null);
                    if (syncObjects && syncObjects.length > 0 && (studentCallState.studentRole === 'student' || getActiveVectorArray().length === 0)) {
                        setActiveVectorArray(syncObjects.map(cloneVectorObj));
                        selectedVectorIndex = -1;
                        replayVectorStrokesToCanvas(getActiveVectorArray());
                        refreshFreehandDrawerIfOpen();
                        persistWhiteboardState();
                    }
                    renderGeometricToolsOverlay();
                    updateCollabRoomBadgeUI();
                    return;
                }
                if (msg.type === 'room:lock') {
                    studentCallState.isLocked = !!msg.locked;
                    updateCollabRoomBadgeUI();
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(studentCallState.isLocked ? '🔒 تم قفل القلم مؤقتاً للشرح.' : '🔓 تم فتح القلم للكتابة مجدداً.', 'info');
                    }
                    return;
                }
                if (msg.type === 'lock:rejected') {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('🔒 القلم مقفل حالياً من طرف الأستاذ للشرح.', 'warning');
                    }
                    return;
                }
                if (msg.type === 'cursor:move') {
                    if (msg.senderId) {
                        remotePeers.set(String(msg.senderId), {
                            x: Number(msg.x) || 0,
                            y: Number(msg.y) || 0,
                            name: String(msg.senderName || 'مشارك'),
                            role: msg.senderRole === 'teacher' ? 'teacher' : 'student',
                            ts: Date.now()
                        });
                        renderGeometricToolsOverlay();
                    }
                    return;
                }
                if (msg.type === 'stroke:add' && msg.object) {
                    const arr = getActiveVectorArray();
                    if (!msg.object.id || !arr.some(o => o && o.id === msg.object.id)) {
                        const cloned = cloneVectorObj(msg.object);
                        arr.push(cloned);
                        drawVectorObjectOnCtx(cloned);
                        refreshFreehandDrawerIfOpen();
                        persistWhiteboardState();
                    }
                    return;
                }
                if (msg.type === 'object:update' && msg.object && msg.object.id) {
                    const arr = getActiveVectorArray();
                    const idx = arr.findIndex(o => o && o.id === msg.object.id);
                    const cloned = cloneVectorObj(msg.object);
                    if (idx >= 0) arr[idx] = cloned;
                    else arr.push(cloned);
                    replayVectorStrokesToCanvas(arr);
                    renderGeometricToolsOverlay();
                    refreshFreehandDrawerIfOpen();
                    persistWhiteboardState();
                    return;
                }
                if (msg.type === 'object:delete' && msg.objectId) {
                    const filtered = getActiveVectorArray().filter(o => !o || o.id !== msg.objectId);
                    setActiveVectorArray(filtered);
                    selectedVectorIndex = -1;
                    replayVectorStrokesToCanvas(filtered);
                    renderGeometricToolsOverlay();
                    refreshFreehandDrawerIfOpen();
                    persistWhiteboardState();
                    return;
                }
                if (msg.type === 'page:clear') {
                    if (ctx && canvas) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    setActiveVectorArray([]);
                    selectedVectorIndex = -1;
                    renderGeometricToolsOverlay();
                    refreshFreehandDrawerIfOpen();
                    persistWhiteboardState();
                    return;
                }
                if (msg.type === 'page:restore' && Array.isArray(msg.objects)) {
                    const restored = msg.objects.map(cloneVectorObj);
                    setActiveVectorArray(restored);
                    selectedVectorIndex = -1;
                    replayVectorStrokesToCanvas(restored);
                    renderGeometricToolsOverlay();
                    refreshFreehandDrawerIfOpen();
                    persistWhiteboardState();
                    return;
                }
                if (msg.type === 'guidance:send' && msg.text) {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(`💬 توجيه الأستاذ: "${msg.text}"`, 'info');
                    }
                }
            }
        });
        return collabClient;
    }

    function joinWhiteboardCollabRoom(roomCode, role, displayName) {
        const cleanRoom = (window.WbSecurityMath && window.WbSecurityMath.sanitizeRoomCode(roomCode))
            || String(roomCode || studentCallState.roomCode || 'MATH-BAC-2026').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
            || 'MATH-BAC-2026';
        const effectiveRole = role === 'student' ? 'student' : 'teacher';
        const tp = (window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile()) || {};
        const effectiveName = displayName || (effectiveRole === 'teacher' ? (tp.name || 'الأستاذ') : (studentCallState.studentName || 'تلميذ عن بعد'));

        studentCallState.roomCode = cleanRoom;
        studentCallState.active = true;
        studentCallState.studentRole = effectiveRole;
        if (effectiveRole === 'student') {
            studentCallState.studentName = effectiveName;
        } else if (!studentCallState.studentName) {
            studentCallState.studentName = 'تلميذ مشارك';
        }

        const banner = document.getElementById('wbStudentCallBanner');
        if (banner) banner.style.display = 'flex';
        const nameLbl = document.getElementById('wbActiveStudentName');
        if (nameLbl) {
            nameLbl.textContent = effectiveRole === 'student'
                ? `التلميذ(ة): ${studentCallState.studentName}`
                : `غرفة تشاركية: ${studentCallState.studentName || cleanRoom}`;
        }

        setCollabRole(effectiveRole);

        const client = getOrCreateCollabClient();
        if (client) {
            client.connect(cleanRoom, effectiveRole, effectiveName, () => ({
                objects: getActiveVectorArray(),
                locked: !!studentCallState.isLocked
            }));
        }
        updateCollabRoomBadgeUI();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`🌐 تم الاتصال بغرفة السبورة التفاعلية (${cleanRoom}) بصفة ${effectiveRole === 'student' ? 'تلميذ(ة)' : 'أستاذ'}.`, 'success');
        }
    }

    function copyWhiteboardCollabLink() {
        const room = (collabClient && collabClient.roomCode) || studentCallState.roomCode || 'MATH-BAC-2026';
        if (!collabClient || !collabClient.roomCode) {
            joinWhiteboardCollabRoom(room, 'teacher');
        }
        const base = window.location.origin + window.location.pathname;
        const inviteUrl = `${base}?wbroom=${encodeURIComponent(room)}&role=student&name=${encodeURIComponent(studentCallState.studentName || 'تلميذ')}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(inviteUrl).catch(() => {});
        } else {
            try {
                const ta = document.createElement('textarea');
                ta.value = inviteUrl;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            } catch (e) {}
        }
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🔗 تم نسخ رابط غرفة التعاون (${room}) لدعوة التلاميذ عن بعد!`, 'success');
        }
    }

    function openSaveBoardToLibraryModal() {
        if (!window.WbBridges || typeof window.WbBridges.openSaveBoardToLibraryModal !== 'function') return;
        window.WbBridges.openSaveBoardToLibraryModal(() => {
            if (!canvas) return null;
            persistWhiteboardState();
            const comp = createCompositedCanvas();
            const today = (typeof window.formatLocalDate === 'function') ? window.formatLocalDate() : new Date().toISOString().slice(0, 10);
            const defaultTitle = isPdfOrWorksheetActive()
                ? `تصحيح_${(currentPdfFileName || 'سلسلة_تمارين').replace(/\.pdf$/i, '')}_ص${currentPdfPageNum}`
                : `ملخص_السبورة_ص${currentPageIndex + 1}_${today}`;
            return {
                previewUrl: comp.toDataURL('image/png'),
                defaultTitle,
                topic: window.currentLessonTopic || '',
                toBlob: () => new Promise((resolve) => comp.toBlob(resolve, 'image/png'))
            };
        });
    }

    function openAttachBoardToTutoringModal() {
        if (!window.WbBridges || typeof window.WbBridges.openAttachBoardToTutoringModal !== 'function') return;
        window.WbBridges.openAttachBoardToTutoringModal(() => {
            if (!canvas) return null;
            persistWhiteboardState();
            const comp = createCompositedCanvas();
            const shareDataUrl = comp.toDataURL('image/webp', 0.86);
            const defaultTitle = isPdfOrWorksheetActive()
                ? `تصحيح ${currentPdfFileName || 'فرض'} - ص ${currentPdfPageNum}`
                : `شرح السبورة التفاعلية - ص ${currentPageIndex + 1}`;
            return {
                previewUrl: shareDataUrl,
                defaultTitle,
                shareDataUrl
            };
        });
    }

    function openStudentCallModal() {
        let modal = document.getElementById('whiteboardStudentCallModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'whiteboardStudentCallModal';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.backgroundColor = 'rgba(15, 23, 42, 0.72)';
            modal.style.backdropFilter = 'blur(5px)';
            modal.style.zIndex = '9999';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.padding = '14px';
            document.body.appendChild(modal);
        }

        let studentList = [
            'أمين الإدريسي',
            'فاطمة الزهراء العلمي',
            'طه بنجلون',
            'مريم الناصري',
            'أيوب الشرايبي',
            'سلمى التازي',
            'يوسف المرابط'
        ];

        try {
            if (window.db && window.db.classes) {
                const found = [];
                const activeClassKey = window.currentClass || (document.getElementById('classSelect') && document.getElementById('classSelect').value) || '';
                const classKeys = (activeClassKey && window.db.classes[activeClassKey]) ? [activeClassKey, ...Object.keys(window.db.classes).filter(k => k !== activeClassKey)] : Object.keys(window.db.classes);
                const todayStr = (typeof window.formatLocalDate === 'function')
                    ? window.formatLocalDate()
                    : new Date().toISOString().slice(0, 10);
                for (const cKey of classKeys) {
                    const c = window.db.classes[cKey];
                    const arr = Array.isArray(c) ? c : (c && Array.isArray(c.students) ? c.students : []);
                    const absMap = (window.db.absences && window.db.absences[cKey]) ? window.db.absences[cKey] : {};
                    const clsRecs = (typeof window.getClassRecordsFast === 'function')
                        ? window.getClassRecordsFast(cKey)
                        : (Array.isArray(window.db.records) ? window.db.records.filter(r => r && r.className === cKey) : []);
                    const absentTodaySet = new Set();
                    for (let i = 0; i < clsRecs.length; i++) {
                        const r = clsRecs[i];
                        if (r && r.date === todayStr && (r.status === 'غائب' || r.status === 'مبرر')) {
                            absentTodaySet.add(String(r.studentId));
                        }
                    }
                    arr.forEach(s => {
                        if (s && s.name) {
                            const isAbsAux = absMap[s.id] && absMap[s.id].status && absMap[s.id].status !== 'present' && absMap[s.id].status !== 'حاضر';
                            const isAbsToday = absentTodaySet.has(String(s.id));
                            if (!isAbsAux && !isAbsToday) {
                                found.push(`${s.name} (${cKey})`);
                            }
                        }
                    });
                }
                if (found.length > 0) studentList = found;
            }
        } catch (e) {}

        const defaultRoom = studentCallState.roomCode || 'MATH-BAC-2026';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 540px; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">👥</span>
                        <span style="font-weight: 800; font-size: 0.98rem;">دعوة تلميذ(ة) للصعود إلى السبورة التفاعلية (حل تشاركي)</span>
                    </div>
                    <button type="button" id="wbCallCloseTopBtn" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <label style="font-size: 0.78rem; font-weight: 800; color: #1e293b;">🧑‍🎓 اختر التلميذ(ة) المراد صعوده(ا) للسبورة:</label>
                            <button type="button" id="btnRandomPickStudentWb" style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; border-radius: 6px; padding: 3px 9px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">🎲 قرعة عشوائية</button>
                        </div>
                        <select id="wbCallStudentSelect" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff; color: #1e293b;">
                            ${studentList.map(s => `<option value="${escWb(s)}">${escWb(s)}</option>`).join('')}
                        </select>
                    </div>

                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 0.76rem; font-weight: 800; color: #1e40af;">🌐 رمز غرفة التعاون اللحظي عبر الإنترنت (WebSocket):</label>
                        <div style="display: flex; gap: 6px;">
                            <input type="text" id="wbCallRoomCodeInput" value="${escWb(defaultRoom)}" dir="ltr" style="flex: 1; padding: 6px 10px; border-radius: 7px; border: 1.5px solid #93c5fd; font-weight: 800; font-size: 0.8rem; color: #0f172a; background: #fff;">
                            <button type="button" id="btnCopyRoomInviteModal" style="background: #0284c7; color: #fff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 0.74rem; font-weight: 800; cursor: pointer;">🔗 نسخ رابط الدعوة</button>
                        </div>
                    </div>

                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 14px; font-size: 0.74rem; color: #9a3412;">
                        💡 <strong>الميزة الديداكتيكية (تقويم تكويني خالص):</strong> يتيح هذا الوضع للتلميذ الكتابة على السبورة بقلم مميز (أخضر زمردي) مع إمكانية تحكم الأستاذ الكاملة: قفل القلم للشرح، إرسال توجيهات رياضية فورية، وتقديم تشجيع تربوي وتكويني دون احتساب أي نقط مشاركة (اعتماداً على المذكرة الوزارية الخاصة بمادة الرياضيات التي ترتكز حصرياً على الفروض المحروسة).
                    </div>

                    <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        <button type="button" id="wbCallCancelBtn" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer;">إلغاء</button>
                        <button type="button" id="btnStartStudentCallNow" style="background: linear-gradient(135deg, #ea580c, #c2410c); border: none; color: #fff; padding: 6px 18px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">🚀 بدء صعود التلميذ(ة) الآن</button>
                    </div>
                </div>
            </div>
        `;

        const closeCallModal = () => { modal.style.display = 'none'; };
        const closeTop = document.getElementById('wbCallCloseTopBtn');
        const closeBtm = document.getElementById('wbCallCancelBtn');
        if (closeTop) closeTop.onclick = closeCallModal;
        if (closeBtm) closeBtm.onclick = closeCallModal;

        const rndBtn = document.getElementById('btnRandomPickStudentWb');
        if (rndBtn) {
            rndBtn.addEventListener('click', function () {
                const sel = document.getElementById('wbCallStudentSelect');
                if (sel && sel.options.length > 0) {
                    const rIdx = Math.floor(Math.random() * sel.options.length);
                    sel.selectedIndex = rIdx;
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(`🎲 القرعة اختارت التلميذ(ة): ${sel.value}`, 'info');
                    }
                }
            });
        }

        const copyInviteBtn = document.getElementById('btnCopyRoomInviteModal');
        if (copyInviteBtn) {
            copyInviteBtn.addEventListener('click', function () {
                const roomInp = document.getElementById('wbCallRoomCodeInput');
                const sel = document.getElementById('wbCallStudentSelect');
                if (sel && sel.value) studentCallState.studentName = sel.value;
                if (roomInp && roomInp.value.trim()) {
                    studentCallState.roomCode = (window.WbSecurityMath && window.WbSecurityMath.sanitizeRoomCode(roomInp.value)) || roomInp.value.trim();
                }
                copyWhiteboardCollabLink();
            });
        }

        const startBtn = document.getElementById('btnStartStudentCallNow');
        if (startBtn) {
            startBtn.addEventListener('click', function () {
                const sName = document.getElementById('wbCallStudentSelect').value;
                const roomInp = document.getElementById('wbCallRoomCodeInput');
                const rCode = (roomInp && roomInp.value.trim()) || studentCallState.roomCode || 'MATH-BAC-2026';
                closeCallModal();
                startStudentCallSession(sName, rCode);
            });
        }
    }

    function startStudentCallSession(studentName, roomCode) {
        studentCallState.active = true;
        studentCallState.studentName = studentName || 'تلميذ(ة) مشارك(ة)';
        studentCallState.isLocked = false;
        if (roomCode) {
            studentCallState.roomCode = (window.WbSecurityMath && window.WbSecurityMath.sanitizeRoomCode(roomCode)) || String(roomCode);
        }

        const banner = document.getElementById('wbStudentCallBanner');
        if (banner) banner.style.display = 'flex';

        const nameLbl = document.getElementById('wbActiveStudentName');
        if (nameLbl) nameLbl.textContent = `التلميذ(ة): ${studentCallState.studentName}`;

        const tp = (window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile()) || {};
        const client = getOrCreateCollabClient();
        if (client) {
            client.connect(studentCallState.roomCode, 'teacher', tp.name || 'الأستاذ', () => ({
                objects: getActiveVectorArray(),
                locked: !!studentCallState.isLocked
            }));
        }

        setCollabRole('student');
        updateCollabRoomBadgeUI();

        if (typeof window.showNotification === 'function') {
            window.showNotification(`🧑‍🎓 صعد(ت) التلميذ(ة) ${studentCallState.studentName} إلى السبورة! الغرفة (${studentCallState.roomCode}) نشطة الآن.`, 'success');
        }
    }

    function setCollabRole(role) {
        studentCallState.studentRole = role;
        const btnTeach = document.getElementById('btnRoleTeacher');
        const btnStud = document.getElementById('btnRoleStudent');
        if (btnTeach) {
            btnTeach.style.background = role === 'teacher' ? '#2563eb' : 'transparent';
            btnTeach.style.color = role === 'teacher' ? '#fff' : '#cbd5e1';
        }
        if (btnStud) {
            btnStud.style.background = role === 'student' ? '#059669' : 'transparent';
            btnStud.style.color = role === 'student' ? '#fff' : '#cbd5e1';
        }
        if (role === 'student') {
            setColor(studentCallState.studentColor);
        } else {
            setColor('#1e3a8a');
        }
    }

    function toggleStudentPenLock() {
        studentCallState.isLocked = !studentCallState.isLocked;
        updateCollabRoomBadgeUI();
        if (collabClient && collabClient.roomCode) {
            collabClient.send('room:lock', { locked: studentCallState.isLocked });
        }
        if (typeof window.showNotification === 'function') {
            window.showNotification(studentCallState.isLocked ? 'تم قفل قلم التلميذ مؤقتاً لتوضيح الأستاذ.' : 'تم فتح قلم التلميذ للكتابة مجدداً.', 'info');
        }
    }

    function sendInstantMathGuidance() {
        const prompts = [
            'أحسنت! أكمل تعميل البسط والمقام.',
            'انتبه للإشارة السالبة عند نشر الأقواس.',
            'استعمل الضرب في المرافق لحساب النهاية.',
            'تذكر أن المشتقة تنعدم في مطراف الدالة.',
            'تحقق من إشارة المميز Δ قبل الاستنتاج.',
            'برهان ممتاز وواضح! واصل.'
        ];

        let modal = document.getElementById('wbMathGuidanceModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbMathGuidanceModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(4px);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1.5px solid #cbd5e1;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-weight:800;font-size:0.95rem;color:#6d28d9;">💬 إرسال توجيه رياضي فوري للتلميذ(ة)</div>
                    <button type="button" id="wbGuidanceCancelX" style="background:none;border:none;font-size:1rem;color:#64748b;cursor:pointer;">✕</button>
                </div>
                <div style="font-size:0.75rem;color:#64748b;margin-bottom:8px;">انقر على توجيه جاهز أو اكتب توجيهاً مخصصاً:</div>
                <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
                    ${prompts.map(p => `<button type="button" class="wb-guidance-preset-btn" data-msg="${escWb(p)}" style="text-align:right;background:#faf5ff;border:1px solid #d8b4fe;color:#5b21b6;border-radius:8px;padding:6px 10px;font-size:0.78rem;font-weight:700;cursor:pointer;">💡 ${escWb(p)}</button>`).join('')}
                </div>
                <input type="text" id="wbGuidanceCustomInput" value="${escWb(prompts[0])}" style="width:100%;padding:8px 12px;border:1.5px solid #c084fc;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;color:#0f172a;margin-bottom:12px;box-sizing:border-box;outline:none;">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="wbGuidanceCancelBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                    <button type="button" id="wbGuidanceSendBtn" style="background:#7c3aed;color:#fff;border:none;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.8rem;cursor:pointer;">إرسال التوجيه</button>
                </div>
            </div>
        `;

        const inputEl = document.getElementById('wbGuidanceCustomInput');
        const close = () => { modal.style.display = 'none'; };
        const sendGuidance = (msg) => {
            const chosen = (msg || (inputEl && inputEl.value) || '').trim();
            if (!chosen) return;
            close();
            if (collabClient && collabClient.roomCode) {
                collabClient.send('guidance:send', { text: chosen });
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification(`💬 توجيه الأستاذ إلى ${studentCallState.studentName || 'التلميذ(ة)'}: "${chosen}"`, 'info');
            }
        };

        modal.querySelectorAll('.wb-guidance-preset-btn').forEach(btn => {
            btn.onclick = () => sendGuidance(btn.getAttribute('data-msg'));
        });
        document.getElementById('wbGuidanceCancelX').onclick = close;
        document.getElementById('wbGuidanceCancelBtn').onclick = close;
        document.getElementById('wbGuidanceSendBtn').onclick = () => sendGuidance();
        if (inputEl) {
            inputEl.focus();
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); sendGuidance(); }
                else if (e.key === 'Escape') close();
            };
        }
    }

    function awardStudentParticipationPoint() {
        const rawLabel = studentCallState.studentName || 'التلميذ(ة)';
        const praises = [
            '👏 أحسنت! خطوات برهنة رياضية سليمة ومنظمة على السبورة.',
            '🌟 ممتاز! تحكم جيد في القواعد الرياضية وسلاسة في التحرير.',
            '💡 مبادرة طيبة! محاولة موفقة تعكس استيعاباً جيداً للفقرة.',
            '🎯 عمل متميز على السبورة التفاعلية! واصل بنفس التركيز.'
        ];
        const msg = praises[studentCallState.participationCount % praises.length];
        studentCallState.participationCount++;

        const vp = document.getElementById('whiteboardViewport');
        if (vp) {
            const oldToast = document.getElementById('wbFormativePraiseBanner');
            if (oldToast) oldToast.remove();
            const badge = document.createElement('div');
            badge.id = 'wbFormativePraiseBanner';
            badge.style.cssText = 'position:absolute;top:52px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#065f46,#059669);color:#fff;padding:8px 18px;border-radius:999px;font-weight:800;font-size:0.82rem;box-shadow:0 10px 25px rgba(5,150,105,0.35);border:1.5px solid #6ee7b7;z-index:85;display:flex;align-items:center;gap:8px;direction:rtl;pointer-events:none;';
            badge.innerHTML = `<span>${escWb(msg)}</span> <span style="background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:999px;font-size:0.7rem;">تقويم تكويني — ${escWb(rawLabel)}</span>`;
            vp.appendChild(badge);
            setTimeout(() => {
                if (badge && badge.parentNode) badge.remove();
            }, 4000);
        }

        if (typeof window.showNotification === 'function') {
            window.showNotification(`👏 تشجيع بيداغوجي وتكويني للتلميذ(ة): ${rawLabel} (دون احتساب نقط مشاركة — التقويم في الرياضيات يعتمد حصرياً على الفروض المحروسة).`, 'success');
        }
    }

    function endStudentCallSession() {
        const sName = studentCallState.studentName;
        studentCallState.active = false;
        studentCallState.studentName = '';
        studentCallState.studentRole = 'teacher';
        studentCallState.isLocked = false;
        studentCursorPos = null;
        remotePeers.clear();

        if (collabClient) {
            try { collabClient.disconnect(); } catch (e) {}
        }

        const banner = document.getElementById('wbStudentCallBanner');
        if (banner) banner.style.display = 'none';

        updateCollabRoomBadgeUI({ connected: false });
        renderGeometricToolsOverlay();
        setCollabRole('teacher');

        if (typeof window.showNotification === 'function') {
            window.showNotification(`🏁 تم إنهاء مشاركة التلميذ(ة) ${sName} على السبورة.`, 'info');
        }
    }

    function updateToolbarUI() {
        document.querySelectorAll('.board-tool-btn').forEach(btn => {
            const t = btn.getAttribute('data-tool');
            if (t === 'ruler') {
                btn.classList.toggle('active', !!rulerState.visible);
                btn.style.background = rulerState.visible ? '#0284c7' : '#f0f9ff';
                btn.style.color = rulerState.visible ? '#ffffff' : '#0369a1';
                return;
            }
            if (t === 'protractor') {
                btn.classList.toggle('active', !!protractorState.visible);
                btn.style.background = protractorState.visible ? '#7c3aed' : '#faf5ff';
                btn.style.color = protractorState.visible ? '#ffffff' : '#6d28d9';
                return;
            }
            if (t === 'setSquare') {
                btn.classList.toggle('active', !!setSquareState.visible);
                btn.style.background = setSquareState.visible ? '#059669' : '#ecfdf5';
                btn.style.color = setSquareState.visible ? '#ffffff' : '#047857';
                return;
            }
            if (t === 'compass') {
                btn.classList.toggle('active', !!compassState.visible);
                btn.style.background = compassState.visible ? '#d97706' : '#fffbeb';
                btn.style.color = compassState.visible ? '#ffffff' : '#b45309';
                return;
            }
            const isActive = t === currentTool;
            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? '#eff6ff' : '#ffffff';
            btn.style.borderColor = isActive ? '#2563eb' : '#cbd5e1';
            btn.style.color = isActive ? '#1d4ed8' : '#1e293b';
        });

        document.querySelectorAll('.board-color-btn').forEach(btn => {
            const c = btn.getAttribute('data-color');
            const isActive = c && c.toLowerCase() === currentColor.toLowerCase();
            btn.classList.toggle('active', isActive);
            btn.style.transform = isActive ? 'scale(1.2)' : 'scale(1)';
            btn.style.boxShadow = isActive ? '0 0 0 2.5px #2563eb' : '0 0 0 1px #cbd5e1';
        });

        document.querySelectorAll('.board-size-btn').forEach(btn => {
            const s = Number(btn.getAttribute('data-size'));
            const isActive = s === currentSize;
            btn.style.background = isActive ? '#2563eb' : '';
            btn.style.color = isActive ? '#ffffff' : '';
        });

        document.querySelectorAll('.board-bg-btn').forEach(btn => {
            const b = btn.getAttribute('data-bg');
            const isActive = b === currentBg;
            btn.classList.toggle('active', isActive);
            btn.style.background = isActive ? '#eff6ff' : '#ffffff';
            btn.style.borderColor = isActive ? '#2563eb' : '#cbd5e1';
        });

        const spotlightTopBtn = document.getElementById('btnToggleSpotlightTop');
        if (spotlightTopBtn) {
            const isSpot = currentTool === 'spotlight';
            spotlightTopBtn.style.background = isSpot ? '#d97706' : '#fffbeb';
            spotlightTopBtn.style.color = isSpot ? '#ffffff' : '#92400e';
            spotlightTopBtn.style.borderColor = isSpot ? '#b45309' : '#fcd34d';
        }

        const slider = document.getElementById('whiteboardSizeSlider');
        if (slider) slider.value = String(currentSize);
        const badge = document.getElementById('whiteboardSizeBadge');
        if (badge) badge.textContent = `${currentSize}px`;
    }

    /* ====================================================================
     * 5. مولد جداول الإشارة والتغيرات التفاعلي (Variation & Sign Table Generator)
     * ==================================================================== */
    const VARIATION_PRESETS = {
        trinomial: {
            fnName: 'f(x) = x² - 4x + 3',
            xVals: '-∞, 1, 2, 3, +∞',
            signs: '+, 0, -, 0, +',
            arrows: '↘, ↗',
            yVals: '+∞, -1, +∞'
        },
        homographic: {
            fnName: 'f(x) = (2x - 1) / (x - 1)',
            xVals: '-∞, 1, +∞',
            signs: '-, ||, -',
            arrows: '↘, ||, ↘',
            yVals: '2, -∞ || +∞, 2'
        },
        cubic: {
            fnName: 'f(x) = x³ - 3x',
            xVals: '-∞, -1, 1, +∞',
            signs: '+, 0, -, 0, +',
            arrows: '↗, ↘, ↗',
            yVals: '-∞, 2, -2, +∞'
        },
        ln: {
            fnName: 'f(x) = x - ln(x)',
            xVals: '0, ||, 1, +∞',
            signs: '||, -, 0, +',
            arrows: '||, ↘, ↗',
            yVals: '+∞, 1, +∞'
        },
        exp: {
            fnName: 'f(x) = (x - 1)e^x',
            xVals: '-∞, 0, +∞',
            signs: '-, 0, +',
            arrows: '↘, ↗',
            yVals: '0, -1, +∞'
        }
    };

    function openVariationTableModal() {
        let modal = document.getElementById('wbVariationTableModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbVariationTableModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const p = VARIATION_PRESETS.cubic;
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:600px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">📊 مولد جدول الإشارة وجدول تغيرات الدالة f(x)</div>
                    <button type="button" id="wbVarCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                        <span style="font-size:0.75rem;font-weight:800;color:#475569;">⚡ نماذج جاهزة:</span>
                        <button type="button" class="wb-var-preset" data-key="cubic" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">دالة حدودية درجة 3</button>
                        <button type="button" class="wb-var-preset" data-key="trinomial" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">ثلاثية حدود درجة 2</button>
                        <button type="button" class="wb-var-preset" data-key="homographic" style="background:#fef3c7;border:1px solid #fcd34d;color:#b45309;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">دالة متخاطة (قيمة ممنوعة ||)</button>
                        <button type="button" class="wb-var-preset" data-key="ln" style="background:#f3e8ff;border:1px solid #d8b4fe;color:#6d28d9;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">دالة لوغاريتمية ln(x)</button>
                        <button type="button" class="wb-var-preset" data-key="exp" style="background:#dcfce7;border:1px solid #86efac;color:#15803d;border-radius:6px;padding:3px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;">دالة أسية e^x</button>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">عنوان أو تعبير الدالة:</label>
                        <input type="text" id="wbVarFnName" value="${p.fnName}" dir="ltr" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.82rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">قيم x ومجموعة التعريف (مفصولة بفاصلة ,):</label>
                        <input type="text" id="wbVarXVals" value="${p.xVals}" dir="ltr" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.82rem;box-sizing:border-box;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">إشارة المشتقة f'(x) (+ , - , 0 , ||):</label>
                            <input type="text" id="wbVarSigns" value="${p.signs}" dir="ltr" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.82rem;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">أسهم رتابة f(x) (↗ أو ↘ أو ||):</label>
                            <input type="text" id="wbVarArrows" value="${p.arrows}" dir="ltr" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.82rem;box-sizing:border-box;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">النهايات والمطاريف بالترتيب (مفصولة بفاصلة ,):</label>
                        <input type="text" id="wbVarYVals" value="${p.yVals}" dir="ltr" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.82rem;box-sizing:border-box;">
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
                        <button type="button" id="wbVarCancelBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbVarStampBtn" style="background:linear-gradient(135deg,#0284c7,#0369a1);border:none;color:#fff;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;">📌 إدراج جدول التغيرات على السبورة</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbVarCloseX').onclick = close;
        document.getElementById('wbVarCancelBtn').onclick = close;

        modal.querySelectorAll('.wb-var-preset').forEach(btn => {
            btn.onclick = () => {
                const k = btn.getAttribute('data-key');
                const pr = VARIATION_PRESETS[k];
                if (!pr) return;
                document.getElementById('wbVarFnName').value = pr.fnName;
                document.getElementById('wbVarXVals').value = pr.xVals;
                document.getElementById('wbVarSigns').value = pr.signs;
                document.getElementById('wbVarArrows').value = pr.arrows;
                document.getElementById('wbVarYVals').value = pr.yVals;
            };
        });

        document.getElementById('wbVarStampBtn').onclick = () => {
            const cfg = {
                fnName: document.getElementById('wbVarFnName').value.trim(),
                xVals: document.getElementById('wbVarXVals').value.split(',').map(s => s.trim()).filter(Boolean),
                signs: document.getElementById('wbVarSigns').value.split(',').map(s => s.trim()).filter(Boolean),
                arrows: document.getElementById('wbVarArrows').value.split(',').map(s => s.trim()).filter(Boolean),
                yVals: document.getElementById('wbVarYVals').value.split(',').map(s => s.trim()).filter(Boolean)
            };
            close();
            stampVariationTableToCanvas(cfg);
        };
    }

    function stampVariationTableToCanvas(cfg) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const tableW = Math.min(620, w - 60);
        const tableH = 195;
        const x0 = Math.floor((w - tableW) / 2);
        const y0 = Math.floor((h - tableH) / 2);

        const obj = {
            t: 'variation_table',
            x: x0,
            y: y0,
            w: tableW,
            h: tableH,
            blank: false,
            fnName: cfg.fnName || 'f',
            xList: cfg.xVals && cfg.xVals.length > 0 ? cfg.xVals : ['-∞', '+∞'],
            sigList: cfg.signs || [],
            arrList: cfg.arrows || [],
            yList: cfg.yVals || []
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📊 تم إدراج جدول الإشارة والتغيرات على السبورة بنجاح!', 'success');
        }
    }

    /* ====================================================================
     * 6. راسم الدوال المخصصة مع المماس وحساب التكامل (Custom Function Plotter)
     * ==================================================================== */
    function evalMathExprSafe(exprStr, xVal) {
        if (window.WbSecurityMath && typeof window.WbSecurityMath.evaluateMathWithX === 'function') {
            return window.WbSecurityMath.evaluateMathWithX(exprStr, xVal, false);
        }
        return NaN;
    }

    function openCustomFunctionPlotterModal() {
        let modal = document.getElementById('wbCustomPlotterModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbCustomPlotterModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10050;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:560px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#059669,#047857);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">📈 راسم منحنى دالة مخصصة C_f مع المماس (T) والتكامل</div>
                    <button type="button" id="wbPlotCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                        <span style="font-size:0.74rem;font-weight:800;color:#475569;">أمثلة سريعة:</span>
                        <button type="button" class="wb-fn-ex" data-fn="x^3 - 3*x" style="background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">x^3 - 3*x</button>
                        <button type="button" class="wb-fn-ex" data-fn="x - 1 + exp(-x)" style="background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">x - 1 + exp(-x)</button>
                        <button type="button" class="wb-fn-ex" data-fn="ln(x)/x" style="background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">ln(x)/x</button>
                        <button type="button" class="wb-fn-ex" data-fn="(2*x - 1)/(x - 1)" style="background:#ecfdf5;border:1px solid #6ee7b7;color:#047857;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">(2*x-1)/(x-1)</button>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">تعبير الدالة f(x) (يدعم: x^2, ln(x), exp(x), sqrt(x), sin(x), cos(x)):</label>
                        <input type="text" id="wbPlotFnInput" value="0.25*x^3 - 0.75*x" dir="ltr" style="width:100%;padding:8px 12px;border:1.5px solid #10b981;border-radius:8px;font-weight:800;font-size:0.88rem;box-sizing:border-box;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;">
                            <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;font-weight:800;color:#1e3a8a;cursor:pointer;">
                                <input type="checkbox" id="wbPlotDrawTangent" checked> رسم المماس (T) في النقطة x₀:
                            </label>
                            <input type="number" id="wbPlotTangentX0" value="1.5" step="0.5" dir="ltr" style="width:100%;margin-top:5px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;">
                        </div>
                        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;">
                            <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;font-weight:800;color:#7c3aed;cursor:pointer;">
                                <input type="checkbox" id="wbPlotDrawIntegral" checked> تظليل حيز التكامل ∫ من a إلى b:
                            </label>
                            <div style="display:flex;gap:6px;margin-top:5px;" dir="ltr">
                                <input type="number" id="wbPlotIntA" value="0" step="0.5" placeholder="a" style="width:50%;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;">
                                <input type="number" id="wbPlotIntB" value="2" step="0.5" placeholder="b" style="width:50%;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-weight:700;">
                            </div>
                        </div>
                    </div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.76rem;font-weight:700;color:#475569;cursor:pointer;">
                        <input type="checkbox" id="wbPlotIncludeAxes" checked> رسم المعلم المتعامد الممنظم (O, i⃗, j⃗) تلقائياً مع المنحنى
                    </label>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
                        <button type="button" id="wbPlotCancelBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbPlotConfirmBtn" style="background:linear-gradient(135deg,#059669,#047857);border:none;color:#fff;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;">📈 رسم المنحنى على السبورة</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbPlotCloseX').onclick = close;
        document.getElementById('wbPlotCancelBtn').onclick = close;
        modal.querySelectorAll('.wb-fn-ex').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('wbPlotFnInput').value = btn.getAttribute('data-fn');
            };
        });

        document.getElementById('wbPlotConfirmBtn').onclick = () => {
            const expr = document.getElementById('wbPlotFnInput').value.trim();
            const withAxes = document.getElementById('wbPlotIncludeAxes').checked;
            const withTangent = document.getElementById('wbPlotDrawTangent').checked;
            const x0 = parseFloat(document.getElementById('wbPlotTangentX0').value) || 0;
            const withIntegral = document.getElementById('wbPlotDrawIntegral').checked;
            const intA = parseFloat(document.getElementById('wbPlotIntA').value) || 0;
            const intB = parseFloat(document.getElementById('wbPlotIntB').value) || 2;
            close();

            if (withAxes) {
                drawCartesianAxes();
            } else {
                saveStateForUndo();
            }

            const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
            const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
            const obj = {
                t: 'math_curve',
                x: 0,
                y: 0,
                w,
                h,
                scale: 40,
                expr,
                label: `(Cf): f(x) = ${expr}`,
                withTangent,
                x0,
                withIntegral,
                intA,
                intB,
                c: currentColor,
                s: Math.max(2.6, currentSize)
            };
            pushVectorObject(obj);
            drawVectorObjectOnCtx(obj);
            persistWhiteboardState();
            if (typeof window.showNotification === 'function') {
                window.showNotification(`📈 تم رسم منحنى الدالة f(x) = ${expr} بنجاح!`, 'success');
            }
        };
    }

    /* ====================================================================
     * 7. قوالب الهندسة الفضائية وشجرة الاحتمالات (3D Space & Probability Templates)
     * ==================================================================== */
    function drawSpaceOrProbTemplate(templateType) {
        if (!ctx || !canvas || !templateType) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;

        if (templateType === 'blank_variation_table') {
            const tblW = Math.min(w - 80, 620);
            const tblH = 230;
            const obj = {
                t: 'variation_table',
                x: Math.floor((w - tblW) / 2),
                y: Math.floor((h - tblH) / 2),
                w: tblW,
                h: tblH,
                blank: true
            };
            pushVectorObject(obj);
            drawVectorObjectOnCtx(obj);
        } else {
            const boxW = Math.min(w - 80, 440);
            const boxH = Math.min(h - 60, 340);
            const obj = {
                t: 'space_prob',
                templateType,
                x: Math.floor((w - boxW) / 2),
                y: Math.floor((h - boxH) / 2),
                w: boxW,
                h: boxH,
                c: currentColor
            };
            pushVectorObject(obj);
            drawVectorObjectOnCtx(obj);
        }

        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('🧪 تم إدراج قالب مختبر الرياضيات التفاعلي على السبورة بنجاح!', 'success');
        }
    }

    function drawBlankVariationTableOnBoard() {
        drawSpaceOrProbTemplate('blank_variation_table');
    }

    /**
     * استوديو الهندسة الفضائية التفاعلي (3D Solids & Space Geometry Studio Modal)
     */
    function open3DSolidsStudioModal() {
        let modal = document.getElementById('wb3DSolidsStudioModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wb3DSolidsStudioModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const solidsCatalog = [
            { id: 'space_axes_3d', icon: '📐', name: 'معلم فضائي (O, i⃗, j⃗, k⃗)', desc: 'معلم متعامد ممنظم في الفضاء مع تمثيل النقطة M(x,y,z) ومسقطها العمودي H(x,y,0)' },
            { id: 'cube3d', icon: '🧊', name: 'مكعب ABCDEFGH', desc: 'مكعب فضائي بأحرف مخفية متقطعة والقطر الفضائي [AG]' },
            { id: 'parallelepiped3d', icon: '📦', name: 'متوازي المستطيلات', desc: 'متوازي المستطيلات القائم ABCDEFGH لدراسة الجداء السلمي والمسافات' },
            { id: 'tetrahedron', icon: '🔺', name: 'رباعي الأوجه ABCD', desc: 'رباعي أوجه فضائي مع الحرف الخلفي المتقطع [BC]' },
            { id: 'pyramid3d', icon: '⛰️', name: 'هرم رباعي القاعدة SABCD', desc: 'هرم منتظم قاعدته ABCD وارتفاعه العمودي [SH]' },
            { id: 'sphere_plane', icon: '🌐', name: 'فلكة (S) ومستوى (P)', desc: 'تقاطع فلكة مركزها Ω وشعاعها R مع مستوى وفق دائرة (C) مركزها H' },
            { id: 'cylinder3d', icon: '🛢️', name: 'أسطوانة قائمة', desc: 'أسطوانة دورانية قائمة محورها (OO\') وشعاع قاعدتها R' },
            { id: 'cone3d', icon: '🍦', name: 'مخروط دوراني قائم', desc: 'مخروط دوراني رأسه S ومركز قاعدته O وشعاعه R' }
        ];

        modal.innerHTML = `
            <div style="background:#ffffff;border-radius:16px;max-width:660px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:2px solid #0284c7;overflow:hidden;">
                <div style="background:linear-gradient(135deg,#0f172a,#0369a1);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:1.4rem;">🧊</span>
                        <div>
                            <div style="font-size:0.98rem;font-weight:900;">استوديو الهندسة الفضائية التفاعلي (3D Space Studio)</div>
                            <div style="font-size:0.72rem;color:#bae6fd;">توليد المجسمات الفضائية والمعلم (O,i⃗,j⃗,k⃗) مع الأحرف المخفية المتقطعة تلقائياً</div>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('wb3DSolidsStudioModal').style.display='none'" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-weight:bold;">✕</button>
                </div>

                <div style="padding:16px;display:flex;flex-direction:column;gap:12px;max-height:78vh;overflow-y:auto;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px;" id="wb3DSolidCardsGrid">
                        ${solidsCatalog.map((s, idx) => `
                            <div class="wb-3d-solid-card" data-solid="${s.id}" style="border:2px solid ${idx === 0 ? '#0284c7' : '#e2e8f0'};background:${idx === 0 ? '#f0f9ff' : '#f8fafc'};border-radius:10px;padding:9px;cursor:pointer;transition:all 0.15s ease;">
                                <div style="font-size:1.35rem;margin-bottom:3px;">${s.icon}</div>
                                <div style="font-size:0.76rem;font-weight:900;color:#0f172a;">${s.name}</div>
                                <div style="font-size:0.64rem;color:#475569;line-height:1.4;margin-top:2px;">${s.desc}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;">
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:800;color:#1e293b;cursor:pointer;">
                            <input type="checkbox" id="wb3DShowHidden" checked style="accent-color:#0284c7;width:16px;height:16px;">
                            <span>إظهار الأحرف المخفية بخط متقطع (---)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:800;color:#1e293b;cursor:pointer;">
                            <input type="checkbox" id="wb3DShowLabels" checked style="accent-color:#0284c7;width:16px;height:16px;">
                            <span>تسمية الرؤوس والنقط (A, B, C, Ω...)</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:800;color:#1e293b;cursor:pointer;">
                            <input type="checkbox" id="wb3DShowAltitude" checked style="accent-color:#0284c7;width:16px;height:16px;">
                            <span>إظهار الارتفاع / المسقط / القطر الفضائي</span>
                        </label>
                        <label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:800;color:#0369a1;cursor:pointer;">
                            <input type="checkbox" id="wb3DSwitchIsoGrid" style="accent-color:#0284c7;width:16px;height:16px;">
                            <span>تفعيل خلفية الشبكة المتقايسة 3D تلقائياً</span>
                        </label>
                    </div>

                    <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #e2e8f0;padding-top:10px;">
                        <button type="button" onclick="document.getElementById('wb3DSolidsStudioModal').style.display='none'" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:7px 16px;font-family:'Cairo',sans-serif;font-size:0.78rem;font-weight:800;cursor:pointer;">إلغاء</button>
                        <button type="button" id="btnConfirmStamp3DSolid" style="background:linear-gradient(135deg,#0284c7,#1d4ed8);color:#fff;border:none;border-radius:8px;padding:7px 20px;font-family:'Cairo',sans-serif;font-size:0.8rem;font-weight:900;cursor:pointer;box-shadow:0 4px 12px rgba(2,132,199,0.25);">🧊 إدراج المجسم على السبورة</button>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        let selectedSolid = 'space_axes_3d';
        const cards = modal.querySelectorAll('.wb-3d-solid-card');
        cards.forEach(card => {
            card.onclick = () => {
                selectedSolid = card.getAttribute('data-solid') || 'cube3d';
                cards.forEach(c => {
                    const active = c.getAttribute('data-solid') === selectedSolid;
                    c.style.borderColor = active ? '#0284c7' : '#e2e8f0';
                    c.style.background = active ? '#f0f9ff' : '#f8fafc';
                });
            };
        });

        document.getElementById('btnConfirmStamp3DSolid').onclick = () => {
            const showHiddenEdges = !!document.getElementById('wb3DShowHidden')?.checked;
            const showLabels = !!document.getElementById('wb3DShowLabels')?.checked;
            const showAltitude = !!document.getElementById('wb3DShowAltitude')?.checked;
            const switchIso = !!document.getElementById('wb3DSwitchIsoGrid')?.checked;

            if (switchIso) {
                setBackground('isometric');
            }

            if (ctx && canvas) {
                saveStateForUndo();
                const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
                const boxW = Math.min(w - 80, 440);
                const boxH = Math.min(h - 60, 350);
                const obj = {
                    t: 'space_prob',
                    templateType: selectedSolid,
                    showHiddenEdges,
                    showLabels,
                    showAltitude,
                    x: Math.floor((w - boxW) / 2),
                    y: Math.floor((h - boxH) / 2),
                    w: boxW,
                    h: boxH,
                    c: currentColor
                };
                pushVectorObject(obj);
                drawVectorObjectOnCtx(obj);
                persistWhiteboardState();
            }

            modal.style.display = 'none';
            if (typeof window.showNotification === 'function') {
                window.showNotification('🧊 تم إدراج المجسم الفضائي التفاعلي على السبورة (يمكنك تحريكه وتكبيره بأداة التحديد 🖱️)', 'success');
            }
        };
    }

    /* ====================================================================
     * 8. التكامل مع القسم ودفتر النصوص ومؤقت التمارين (Classroom Integration)
     * ==================================================================== */
    const WB_LESSON_HEADER_PREFS_KEY = 'wb_lesson_header_prefs_v1';

    const WB_SESSION_TYPE_META = {
        cours: { label: 'درس وبناء المفاهيم', defaultTheme: 'academic' },
        exercices: { label: 'تمارين تطبيقية', defaultTheme: 'workshop' },
        problemes: { label: 'مسائل وتوليف', defaultTheme: 'workshop' },
        soutien: { label: 'دعم واستدراك', defaultTheme: 'workshop' },
        homework: { label: 'تصحيح واجب منزلي', defaultTheme: 'workshop' },
        controle: { label: 'فرض محروس', defaultTheme: 'workshop' },
        correction: { label: 'تصحيح الفرض المحروس', defaultTheme: 'workshop' }
    };

    function escapeWbAttrHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function loadLessonHeaderPrefs() {
        try {
            const raw = localStorage.getItem(WB_LESSON_HEADER_PREFS_KEY);
            return raw ? (JSON.parse(raw) || {}) : {};
        } catch (e) {
            return {};
        }
    }

    function saveLessonHeaderPrefs(prefs) {
        try {
            const current = loadLessonHeaderPrefs();
            localStorage.setItem(WB_LESSON_HEADER_PREFS_KEY, JSON.stringify(Object.assign({}, current, prefs)));
        } catch (e) {}
    }

    function resolveActiveWhiteboardLessonContext(preferredClassName) {
        const prefs = loadLessonHeaderPrefs();
        const todayStr = new Date().toLocaleDateString('ar-MA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let className = (preferredClassName && String(preferredClassName).trim()) || '';
        const classOptions = [];

        try {
            const dbClasses = (window.db && window.db.classes) ? Object.keys(window.db.classes) : [];
            dbClasses.forEach((c) => {
                if (c && !classOptions.includes(c)) classOptions.push(c);
            });
            const lessonLogViewEl = document.getElementById('lessonLogView');
            const isLessonLogActive = !!(lessonLogViewEl && lessonLogViewEl.style.display !== 'none');
            const llSel = document.getElementById('lessonLogClassSelect');
            const mainSel = document.getElementById('classSelect');
            if (!className && isLessonLogActive && llSel && llSel.value) className = llSel.value;
            if (!className && mainSel && mainSel.value) className = mainSel.value;
            if (!className && window.currentClass) className = window.currentClass;
            if (!className && llSel && llSel.value) className = llSel.value;
            if (!className && classOptions.length > 0) className = classOptions[0];
            if (!className) className = '2BAC-PC-1';
            if (className && !classOptions.includes(className)) classOptions.unshift(className);
        } catch (e) {
            if (!className) className = '2BAC-PC-1';
        }

        const tp = (window.db && window.db.teacherProfile) ? window.db.teacherProfile : {};
        const teacherName = (tp.name || '').trim();
        const schoolName = (tp.school || '').trim();

        let levelLabel = '';
        let curriculumLessons = [];
        try {
            if (typeof window.getSecondaryMathLessonsForClass === 'function') {
                const info = window.getSecondaryMathLessonsForClass(className);
                if (info) {
                    levelLabel = info.levelName || info.levelId || '';
                    curriculumLessons = Array.isArray(info.allLessons) ? info.allLessons : [];
                }
            } else if (typeof window.getCurriculumLevelForClass === 'function') {
                levelLabel = window.getCurriculumLevelForClass(className) || '';
            }
        } catch (e) {}

        let lessonTitle = '';
        let axisTitle = '';
        let objective = '';
        let sessionNum = '';
        let sessionType = 'cours';

        try {
            // 1. Live Lesson Log form inputs if active and populated for current/matching class
            const formClsEl = document.getElementById('lessonLogClassSelect');
            const isSameFormClass = !formClsEl || !formClsEl.value || formClsEl.value === className;
            if (isSameFormClass) {
                const numInput = document.getElementById('lessonLogNumber');
                const titleInput = document.getElementById('lessonLogTitle');
                const sessNumInput = document.getElementById('lessonLogSessionNum');
                const sessTypeInput = document.getElementById('lessonLogSessionType');
                const candFormTitle = ((numInput && numInput.value) || (titleInput && titleInput.value) || '').trim();
                if (candFormTitle) lessonTitle = candFormTitle;
                if (sessNumInput && sessNumInput.value) sessionNum = String(sessNumInput.value).trim();
                if (sessTypeInput && sessTypeInput.value && WB_SESSION_TYPE_META[sessTypeInput.value]) {
                    sessionType = sessTypeInput.value;
                }
            }

            // 2. Latest canonical entry from db.lessonLogs[className]
            const logs = (window.db && window.db.lessonLogs && Array.isArray(window.db.lessonLogs[className]))
                ? window.db.lessonLogs[className]
                : [];
            if (logs.length > 0) {
                const latest = logs[logs.length - 1] || {};
                if (!lessonTitle) {
                    lessonTitle = String(latest.number || latest.title || latest.topic || latest.unit || '').trim();
                }
                if (Array.isArray(latest.axes) && latest.axes.length > 0) {
                    const lastAxis = latest.axes[latest.axes.length - 1];
                    axisTitle = typeof lastAxis === 'string'
                        ? lastAxis.trim()
                        : String((lastAxis && (lastAxis.title || lastAxis.name)) || '').trim();
                } else if (latest.axisTitle) {
                    axisTitle = String(latest.axisTitle).trim();
                }
                if (!sessionNum && latest.sessionNum) sessionNum = String(latest.sessionNum).trim();
                if (latest.sessionType && WB_SESSION_TYPE_META[latest.sessionType]) {
                    sessionType = latest.sessionType;
                }
                if (latest.objective) objective = String(latest.objective).trim();
            }

            // 3. Official curriculum fallback if teacher hasn't logged any lesson yet for this class
            if (!lessonTitle && curriculumLessons.length > 0) {
                lessonTitle = curriculumLessons[0].title || '';
                if (!axisTitle && Array.isArray(curriculumLessons[0].axes) && curriculumLessons[0].axes.length > 0) {
                    const a0 = curriculumLessons[0].axes[0];
                    axisTitle = typeof a0 === 'string' ? a0 : (a0 && a0.title) || '';
                }
            }
        } catch (e) {}

        if (!lessonTitle) lessonTitle = 'الاتصال والاشتقاق ودراسة الدوال العددية';

        const sessionMeta = WB_SESSION_TYPE_META[sessionType] || WB_SESSION_TYPE_META.cours;
        const styleTheme = (prefs.styleTheme && ['academic', 'chalkboard', 'compact', 'workshop'].includes(prefs.styleTheme))
            ? prefs.styleTheme
            : 'academic';

        return {
            todayStr,
            className,
            classOptions,
            levelLabel,
            lessonTitle,
            axisTitle,
            objective,
            sessionNum,
            sessionType,
            sessionTypeLabel: sessionMeta.label,
            teacherName,
            schoolName,
            styleTheme,
            showInstitutionalMeta: prefs.showInstitutionalMeta !== false,
            curriculumLessons
        };
    }

    function insertCurrentLessonHeaderOnBoard(customConfig) {
        if (!ctx || !canvas) return;
        const cfg = (customConfig && typeof customConfig === 'object') ? customConfig : {};
        const resolved = resolveActiveWhiteboardLessonContext(cfg.className);
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;

        const styleTheme = cfg.styleTheme || resolved.styleTheme || 'academic';
        const isCompact = styleTheme === 'compact';
        const sessionType = cfg.sessionType || resolved.sessionType || 'cours';
        const sessionMeta = WB_SESSION_TYPE_META[sessionType] || WB_SESSION_TYPE_META.cours;

        const headerData = {
            t: 'lesson_header',
            x: typeof cfg.x === 'number' ? cfg.x : 24,
            y: typeof cfg.y === 'number' ? cfg.y : 12,
            w: typeof cfg.w === 'number' ? cfg.w : Math.max(320, w - 48),
            h: typeof cfg.h === 'number' ? cfg.h : (isCompact ? 50 : 88),
            todayStr: (cfg.todayStr !== undefined ? cfg.todayStr : resolved.todayStr).trim(),
            className: (cfg.className !== undefined ? cfg.className : resolved.className).trim(),
            levelLabel: (cfg.levelLabel !== undefined ? cfg.levelLabel : resolved.levelLabel).trim(),
            lessonTitle: (cfg.lessonTitle !== undefined ? cfg.lessonTitle : resolved.lessonTitle).trim() || 'درس الرياضيات',
            axisTitle: (cfg.axisTitle !== undefined ? cfg.axisTitle : resolved.axisTitle).trim(),
            objective: (cfg.objective !== undefined ? cfg.objective : resolved.objective).trim(),
            sessionNum: (cfg.sessionNum !== undefined ? String(cfg.sessionNum) : resolved.sessionNum).trim(),
            sessionType,
            sessionTypeLabel: (cfg.sessionTypeLabel !== undefined ? cfg.sessionTypeLabel : sessionMeta.label).trim(),
            teacherName: (cfg.teacherName !== undefined ? cfg.teacherName : resolved.teacherName).trim(),
            schoolName: (cfg.schoolName !== undefined ? cfg.schoolName : resolved.schoolName).trim(),
            styleTheme,
            showInstitutionalMeta: typeof cfg.showInstitutionalMeta === 'boolean' ? cfg.showInstitutionalMeta : resolved.showInstitutionalMeta
        };

        saveStateForUndo();

        const arr = getActiveVectorArray();
        const replaceIndex = typeof cfg.replaceIndex === 'number' ? cfg.replaceIndex : -1;

        if (replaceIndex >= 0 && arr[replaceIndex] && arr[replaceIndex].t === 'lesson_header') {
            const prev = arr[replaceIndex];
            const updatedObj = Object.assign({}, prev, headerData, {
                x: prev.x,
                y: prev.y,
                w: prev.w,
                h: isCompact ? Math.min(prev.h || 50, 56) : Math.max(prev.h || 88, 84)
            });
            if (window.WbVectorEngine) {
                window.WbVectorEngine.attachNormalizedPdfFields(updatedObj, getVectorEnv());
            }
            arr[replaceIndex] = updatedObj;
            selectedVectorIndex = replaceIndex;
            replayVectorStrokesToCanvas(arr);
            renderGeometricToolsOverlay();
            if (collabClient && collabClient.roomCode && updatedObj.id) {
                collabClient.send('stroke:update', { object: updatedObj });
            }
        } else {
            if (cfg.replaceExisting && Array.isArray(arr)) {
                for (let i = arr.length - 1; i >= 0; i--) {
                    if (arr[i] && arr[i].t === 'lesson_header') {
                        arr.splice(i, 1);
                    }
                }
                selectedVectorIndex = -1;
            }
            pushVectorObject(headerData);
            if (cfg.replaceExisting) {
                replayVectorStrokesToCanvas(arr);
            } else {
                drawVectorObjectOnCtx(headerData);
            }
            renderGeometricToolsOverlay();
        }

        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            const actionLabel = replaceIndex >= 0 ? 'تحديث' : 'إدراج';
            window.showNotification(`📌 تم ${actionLabel} ترويسة الحصة (${headerData.className} — ${headerData.lessonTitle}) بنجاح!`, 'success');
        }
    }

    function openLessonHeaderModal(editVectorIndex = -1) {
        const arr = getActiveVectorArray();
        const isEditingExisting = (typeof editVectorIndex === 'number' && editVectorIndex >= 0 && arr[editVectorIndex] && arr[editVectorIndex].t === 'lesson_header');
        const existingObj = isEditingExisting ? arr[editVectorIndex] : null;
        const existingTopIdx = !isEditingExisting && Array.isArray(arr)
            ? arr.findIndex(item => item && item.t === 'lesson_header')
            : -1;

        const baseCtx = resolveActiveWhiteboardLessonContext(existingObj ? existingObj.className : '');
        const state = {
            className: existingObj ? (existingObj.className || baseCtx.className) : baseCtx.className,
            levelLabel: existingObj ? (existingObj.levelLabel || baseCtx.levelLabel) : baseCtx.levelLabel,
            lessonTitle: existingObj ? (existingObj.lessonTitle || baseCtx.lessonTitle) : baseCtx.lessonTitle,
            axisTitle: existingObj ? (existingObj.axisTitle || '') : baseCtx.axisTitle,
            objective: existingObj ? (existingObj.objective || '') : baseCtx.objective,
            sessionNum: existingObj ? (existingObj.sessionNum || '') : baseCtx.sessionNum,
            sessionType: existingObj ? (existingObj.sessionType || 'cours') : baseCtx.sessionType,
            todayStr: existingObj ? (existingObj.todayStr || baseCtx.todayStr) : baseCtx.todayStr,
            teacherName: existingObj ? (existingObj.teacherName !== undefined ? existingObj.teacherName : baseCtx.teacherName) : baseCtx.teacherName,
            schoolName: existingObj ? (existingObj.schoolName !== undefined ? existingObj.schoolName : baseCtx.schoolName) : baseCtx.schoolName,
            styleTheme: existingObj ? (existingObj.styleTheme || baseCtx.styleTheme) : baseCtx.styleTheme,
            showInstitutionalMeta: existingObj ? (existingObj.showInstitutionalMeta !== false) : baseCtx.showInstitutionalMeta
        };

        let modal = document.getElementById('wbLessonHeaderModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbLessonHeaderModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.74);backdrop-filter:blur(5px);z-index:10058;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;overflow-y:auto;';
            document.body.appendChild(modal);
        }

        const themeCards = [
            { id: 'academic', label: 'أكاديمي رسمي', sub: 'إطار مهيكل بسطرين' },
            { id: 'chalkboard', label: 'سبورة مغربية', sub: 'خلفية خضراء وخط طبشوري' },
            { id: 'workshop', label: 'ورشة وتطبيقات', sub: 'ملائم للتمارين والدعم' },
            { id: 'compact', label: 'مختصر أنيق', sub: 'يوفر مساحة للكتابة' }
        ];

        const sessionTypeOptions = Object.keys(WB_SESSION_TYPE_META).map((key) => ({
            id: key,
            label: WB_SESSION_TYPE_META[key].label
        }));

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#ffffff;border-radius:14px;max-width:740px;width:100%;box-shadow:0 24px 60px rgba(15,23,42,0.38);border:1px solid #cbd5e1;overflow:hidden;margin:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:13px 18px;background:#0f172a;color:#f8fafc;border-bottom:1px solid #1e293b;">
                    <div>
                        <div style="font-weight:800;font-size:0.98rem;">📌 استوديو ترويسة الدرس على السبورة التفاعلية</div>
                        <div style="font-size:0.74rem;color:#94a3b8;font-weight:600;margin-top:2px;">مزامنة تلقائية مع دفتر النصوص والمقرر الرسمي للرياضيات · انقر مرتين على الترويسة في السبورة لتعديلها لاحقاً</div>
                    </div>
                    <button type="button" id="wbLessonHeaderCloseX" aria-label="إغلاق" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);color:#f8fafc;width:32px;height:32px;border-radius:8px;cursor:pointer;font-weight:800;font-size:0.9rem;">✕</button>
                </div>

                <div style="padding:14px 18px;display:flex;flex-direction:column;gap:12px;max-height:84vh;overflow-y:auto;">
                    <!-- Live Canvas Preview -->
                    <div id="wbHeaderPreviewBackdrop" style="border:1px solid #cbd5e1;border-radius:10px;padding:10px;background:#f8fafc;display:flex;flex-direction:column;gap:6px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.74rem;font-weight:700;color:#475569;">
                            <span>معاينة حية على خلفية السبورة الحالية</span>
                            <span id="wbHeaderPreviewDims" style="font-variant-numeric:tabular-nums;color:#64748b;"></span>
                        </div>
                        <canvas id="wbLessonHeaderPreviewCanvas" style="width:100%;height:auto;display:block;border-radius:8px;"></canvas>
                    </div>

                    <!-- Style Theme Selector -->
                    <div>
                        <div style="font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:5px;">نمط الترويسة البيداغوجية:</div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:6px;">
                            ${themeCards.map((tc) => `
                                <button type="button" class="wb-hdr-theme-btn" data-theme="${tc.id}" style="padding:7px 10px;border-radius:8px;border:1.5px solid #cbd5e1;background:#f8fafc;color:#0f172a;cursor:pointer;text-align:right;transition:all 0.15s ease;">
                                    <div style="font-weight:800;font-size:0.78rem;">${tc.label}</div>
                                    <div style="font-weight:600;font-size:0.69rem;color:#64748b;margin-top:1px;">${tc.sub}</div>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Class + Session Row -->
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
                        <div>
                            <label for="wbHdrClassInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">القسم:</label>
                            <select id="wbHdrClassInput" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;background:#ffffff;color:#0f172a;box-sizing:border-box;">
                                ${baseCtx.classOptions.map((c) => `<option value="${escapeWbAttrHtml(c)}" ${c === state.className ? 'selected' : ''}>${escapeWbAttrHtml(c)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="wbHdrSessionTypeInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">طبيعة الحصة:</label>
                            <select id="wbHdrSessionTypeInput" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;background:#ffffff;color:#0f172a;box-sizing:border-box;">
                                ${sessionTypeOptions.map((st) => `<option value="${st.id}" ${st.id === state.sessionType ? 'selected' : ''}>${escapeWbAttrHtml(st.label)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="wbHdrSessionNumInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">رقم الحصة:</label>
                            <input type="text" id="wbHdrSessionNumInput" value="${escapeWbAttrHtml(state.sessionNum)}" placeholder="مثال: 3" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;font-variant-numeric:tabular-nums;box-sizing:border-box;">
                        </div>
                        <div>
                            <label for="wbHdrDateInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">التاريخ:</label>
                            <input type="text" id="wbHdrDateInput" value="${escapeWbAttrHtml(state.todayStr)}" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.78rem;box-sizing:border-box;">
                        </div>
                    </div>

                    <!-- Lesson Picker (Lesson Log + Curriculum) & Editable Title -->
                    <div style="display:grid;grid-template-columns:1fr;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                            <div>
                                <label for="wbHdrCurriculumPicker" style="display:block;font-size:0.75rem;font-weight:800;color:#1e3a8a;margin-bottom:3px;">استيراد سريع من دفتر النصوص أو المقرر الوزاري:</label>
                                <select id="wbHdrCurriculumPicker" style="width:100%;padding:7px 9px;border:1.5px solid #93c5fd;border-radius:8px;font-weight:700;font-size:0.79rem;background:#ffffff;color:#0f172a;box-sizing:border-box;"></select>
                            </div>
                            <div>
                                <label for="wbHdrAxisPicker" style="display:block;font-size:0.75rem;font-weight:800;color:#047857;margin-bottom:3px;">اختيار محور / فقرة الدرس:</label>
                                <select id="wbHdrAxisPicker" style="width:100%;padding:7px 9px;border:1.5px solid #86efac;border-radius:8px;font-weight:700;font-size:0.79rem;background:#ffffff;color:#0f172a;box-sizing:border-box;"></select>
                            </div>
                        </div>

                        <div>
                            <label for="wbHdrLessonInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">عنوان الدرس الرئيسي:</label>
                            <input type="text" id="wbHdrLessonInput" value="${escapeWbAttrHtml(state.lessonTitle)}" placeholder="عنوان الدرس..." style="width:100%;padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:800;font-size:0.84rem;box-sizing:border-box;background:#ffffff;">
                        </div>

                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
                            <div>
                                <label for="wbHdrAxisInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">المحور أو الفقرة الحالية (اختياري):</label>
                                <input type="text" id="wbHdrAxisInput" value="${escapeWbAttrHtml(state.axisTitle)}" placeholder="مثال: مبرهنة القيم الوسيطية وتطبيقاتها" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;box-sizing:border-box;background:#ffffff;">
                            </div>
                            <div>
                                <label for="wbHdrObjectiveInput" style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">الهدف الديداكتيكي / الكفاية (اختياري):</label>
                                <input type="text" id="wbHdrObjectiveInput" value="${escapeWbAttrHtml(state.objective)}" placeholder="مثال: توظيف جدول التغيرات لحصر حلول معادلة" style="width:100%;padding:7px 9px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;box-sizing:border-box;background:#ffffff;">
                            </div>
                        </div>
                    </div>

                    <!-- Institutional Meta Toggle -->
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:6px 4px;">
                        <label style="display:inline-flex;align-items:center;gap:7px;font-size:0.78rem;font-weight:700;color:#334155;cursor:pointer;">
                            <input type="checkbox" id="wbHdrShowInstToggle" ${state.showInstitutionalMeta ? 'checked' : ''} style="width:16px;height:16px;accent-color:#1e3a8a;">
                            <span>إظهار اسم المؤسسة والأستاذ (${escapeWbAttrHtml([state.schoolName, state.teacherName ? 'ذ. ' + state.teacherName : ''].filter(Boolean).join(' · ') || 'حسب الملف الشخصي')})</span>
                        </label>
                        ${!isEditingExisting && existingTopIdx >= 0 ? `
                            <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.77rem;font-weight:700;color:#0369a1;cursor:pointer;">
                                <input type="checkbox" id="wbHdrReplaceExistingToggle" checked style="width:16px;height:16px;accent-color:#0284c7;">
                                <span>استبدال الترويسة الموجودة حالياً في هذه الصفحة</span>
                            </label>
                        ` : ''}
                    </div>

                    <!-- Actions -->
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-top:6px;border-top:1px solid #e2e8f0;">
                        <button type="button" id="wbHdrSavePresetBtn" style="background:#f8fafc;border:1px solid #cbd5e1;color:#334155;padding:7px 12px;border-radius:8px;font-weight:700;font-size:0.77rem;cursor:pointer;">💾 حفظ الإعدادات الافتراضية</button>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <button type="button" id="wbHdrCancelBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                            <button type="button" id="wbHdrApplyBtn" style="background:#1e3a8a;border:none;color:#ffffff;padding:8px 18px;border-radius:8px;font-weight:800;font-size:0.83rem;cursor:pointer;">
                                ${isEditingExisting ? '✅ تحديث الترويسة المحددة' : '📌 إدراج الترويسة أعلى السبورة'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const previewCanvas = document.getElementById('wbLessonHeaderPreviewCanvas');
        const previewBackdrop = document.getElementById('wbHeaderPreviewBackdrop');
        const previewDims = document.getElementById('wbHeaderPreviewDims');
        const clsEl = document.getElementById('wbHdrClassInput');
        const sessTypeEl = document.getElementById('wbHdrSessionTypeInput');
        const sessNumEl = document.getElementById('wbHdrSessionNumInput');
        const dateEl = document.getElementById('wbHdrDateInput');
        const curPicker = document.getElementById('wbHdrCurriculumPicker');
        const axisPicker = document.getElementById('wbHdrAxisPicker');
        const lessonEl = document.getElementById('wbHdrLessonInput');
        const axisEl = document.getElementById('wbHdrAxisInput');
        const objEl = document.getElementById('wbHdrObjectiveInput');
        const instEl = document.getElementById('wbHdrShowInstToggle');

        let currentPreviewLessons = [];

        const populateCurriculumPickers = (clsName) => {
            const clsCtx = resolveActiveWhiteboardLessonContext(clsName);
            state.levelLabel = clsCtx.levelLabel;
            currentPreviewLessons = [];
            const opts = ['<option value="">— اختر درساً أو اكتب يدوياً أدناه —</option>'];

            const logs = (window.db && window.db.lessonLogs && Array.isArray(window.db.lessonLogs[clsName]))
                ? window.db.lessonLogs[clsName]
                : [];
            if (logs.length > 0) {
                const seenLogTitles = new Set();
                const logOpts = [];
                for (let i = logs.length - 1; i >= 0; i--) {
                    const lg = logs[i];
                    const t = String((lg && (lg.number || lg.title || lg.topic || lg.unit)) || '').trim();
                    if (!t || seenLogTitles.has(t)) continue;
                    seenLogTitles.add(t);
                    const axesList = Array.isArray(lg.axes)
                        ? lg.axes.map(ax => typeof ax === 'string' ? ax : (ax && (ax.title || ax.name)) || '').filter(Boolean)
                        : [];
                    const idx = currentPreviewLessons.length;
                    currentPreviewLessons.push({ title: t, axes: axesList, competency: lg.objective || '' });
                    logOpts.push(`<option value="${idx}">دفتر النصوص: ${escapeWbAttrHtml(t)}</option>`);
                }
                if (logOpts.length > 0) {
                    opts.push(`<optgroup label="دروس مسجلة في دفتر النصوص">${logOpts.join('')}</optgroup>`);
                }
            }

            if (clsCtx.curriculumLessons.length > 0) {
                const currOpts = clsCtx.curriculumLessons.map((ls) => {
                    const idx = currentPreviewLessons.length;
                    const axesList = Array.isArray(ls.axes)
                        ? ls.axes.map(ax => typeof ax === 'string' ? ax : (ax && (ax.title || ax.desc)) || '').filter(Boolean)
                        : [];
                    currentPreviewLessons.push({ title: ls.title, axes: axesList, competency: ls.competency || '' });
                    return `<option value="${idx}">${escapeWbAttrHtml(ls.order ? ls.order + '. ' + ls.title : ls.title)}</option>`;
                });
                opts.push(`<optgroup label="المنهاج الرسمي (${escapeWbAttrHtml(clsCtx.levelLabel)})">${currOpts.join('')}</optgroup>`);
            }

            curPicker.innerHTML = opts.join('');
            const matchIdx = currentPreviewLessons.findIndex(item => item.title === lessonEl.value.trim());
            if (matchIdx >= 0) {
                curPicker.value = String(matchIdx);
                populateAxesPicker(currentPreviewLessons[matchIdx]);
            } else {
                populateAxesPicker(null);
            }
        };

        const populateAxesPicker = (lessonEntry) => {
            const axes = (lessonEntry && Array.isArray(lessonEntry.axes)) ? lessonEntry.axes : [];
            if (axes.length === 0) {
                axisPicker.innerHTML = '<option value="">— أدخل المحور يدوياً أو اختر درساً —</option>';
                return;
            }
            axisPicker.innerHTML = [
                '<option value="">— اختر محوراً من الدرس —</option>',
                ...axes.map((ax, i) => `<option value="${escapeWbAttrHtml(ax)}">${i + 1}. ${escapeWbAttrHtml(ax)}</option>`)
            ].join('');
            const curAx = axisEl.value.trim();
            if (curAx && axes.includes(curAx)) {
                axisPicker.value = curAx;
            }
        };

        const syncThemeButtonsUI = () => {
            modal.querySelectorAll('.wb-hdr-theme-btn').forEach((btn) => {
                const active = btn.getAttribute('data-theme') === state.styleTheme;
                btn.style.borderColor = active ? '#1e3a8a' : '#cbd5e1';
                btn.style.background = active ? '#eff6ff' : '#f8fafc';
                btn.style.boxShadow = active ? '0 0 0 2px rgba(30,58,138,0.16)' : 'none';
            });
        };

        const buildHeaderObjectFromInputs = () => {
            const theme = state.styleTheme;
            const sessKey = sessTypeEl.value || 'cours';
            const sessMeta = WB_SESSION_TYPE_META[sessKey] || WB_SESSION_TYPE_META.cours;
            return {
                t: 'lesson_header',
                x: 12,
                y: 12,
                w: 676,
                h: theme === 'compact' ? 50 : 88,
                todayStr: dateEl.value.trim(),
                className: clsEl.value.trim(),
                levelLabel: state.levelLabel,
                lessonTitle: lessonEl.value.trim() || 'درس الرياضيات',
                axisTitle: axisEl.value.trim(),
                objective: objEl.value.trim(),
                sessionNum: sessNumEl.value.trim(),
                sessionType: sessKey,
                sessionTypeLabel: sessMeta.label,
                teacherName: state.teacherName,
                schoolName: state.schoolName,
                styleTheme: theme,
                showInstitutionalMeta: !!instEl.checked
            };
        };

        const renderPreview = () => {
            if (!previewCanvas) return;
            const hdrObj = buildHeaderObjectFromInputs();
            const cw = 700;
            const ch = hdrObj.h + 24;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            previewCanvas.width = cw * dpr;
            previewCanvas.height = ch * dpr;
            const pCtx = previewCanvas.getContext('2d');
            pCtx.save();
            pCtx.scale(dpr, dpr);

            const isDarkBoard = (currentBg === 'green' || currentBg === 'dark');
            previewBackdrop.style.background = isDarkBoard ? '#0f172a' : '#f8fafc';
            previewBackdrop.style.borderColor = isDarkBoard ? '#334155' : '#cbd5e1';
            if (previewDims) {
                const boardW = lastValidWidth || parseFloat(canvas && canvas.style.width) || 800;
                previewDims.textContent = `${Math.max(320, Math.round(boardW - 48))} × ${hdrObj.h} px`;
            }

            if (currentBg === 'green') {
                pCtx.fillStyle = '#064e3b';
            } else if (currentBg === 'dark') {
                pCtx.fillStyle = '#0f172a';
            } else {
                pCtx.fillStyle = '#ffffff';
            }
            pCtx.fillRect(0, 0, cw, ch);

            if (window.WbVectorEngine && typeof window.WbVectorEngine.drawVectorObject === 'function') {
                window.WbVectorEngine.drawVectorObject(pCtx, hdrObj, { currentBg, isPdfActive: false });
            }
            pCtx.restore();
        };

        populateCurriculumPickers(state.className);
        syncThemeButtonsUI();
        renderPreview();

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbLessonHeaderCloseX').onclick = close;
        document.getElementById('wbHdrCancelBtn').onclick = close;

        modal.querySelectorAll('.wb-hdr-theme-btn').forEach((btn) => {
            btn.onclick = () => {
                state.styleTheme = btn.getAttribute('data-theme') || 'academic';
                syncThemeButtonsUI();
                renderPreview();
            };
        });

        clsEl.onchange = () => {
            state.className = clsEl.value;
            populateCurriculumPickers(state.className);
            renderPreview();
        };

        curPicker.onchange = () => {
            const idx = parseInt(curPicker.value, 10);
            if (!isNaN(idx) && currentPreviewLessons[idx]) {
                const chosen = currentPreviewLessons[idx];
                lessonEl.value = chosen.title || '';
                populateAxesPicker(chosen);
                if (chosen.axes && chosen.axes.length > 0) {
                    axisEl.value = chosen.axes[0];
                    axisPicker.value = chosen.axes[0];
                } else {
                    axisEl.value = '';
                }
                if (!objEl.value.trim() && chosen.competency) {
                    objEl.value = chosen.competency;
                }
                renderPreview();
            }
        };

        axisPicker.onchange = () => {
            if (axisPicker.value) {
                axisEl.value = axisPicker.value;
                renderPreview();
            }
        };

        [sessTypeEl, sessNumEl, dateEl, lessonEl, axisEl, objEl, instEl].forEach((el) => {
            if (!el) return;
            el.addEventListener('input', renderPreview);
            el.addEventListener('change', renderPreview);
        });

        document.getElementById('wbHdrSavePresetBtn').onclick = () => {
            saveLessonHeaderPrefs({
                styleTheme: state.styleTheme,
                showInstitutionalMeta: !!instEl.checked
            });
            if (typeof window.showNotification === 'function') {
                window.showNotification('💾 تم حفظ نمط الترويسة كإعداد افتراضي لحصصك القادمة.', 'success');
            }
        };

        const submitHeader = () => {
            const payload = buildHeaderObjectFromInputs();
            saveLessonHeaderPrefs({
                styleTheme: payload.styleTheme,
                showInstitutionalMeta: payload.showInstitutionalMeta
            });
            const replaceToggle = document.getElementById('wbHdrReplaceExistingToggle');
            const replaceExisting = !!(replaceToggle && replaceToggle.checked);
            close();
            insertCurrentLessonHeaderOnBoard({
                className: payload.className,
                levelLabel: payload.levelLabel,
                lessonTitle: payload.lessonTitle,
                axisTitle: payload.axisTitle,
                objective: payload.objective,
                sessionNum: payload.sessionNum,
                sessionType: payload.sessionType,
                sessionTypeLabel: payload.sessionTypeLabel,
                todayStr: payload.todayStr,
                teacherName: payload.teacherName,
                schoolName: payload.schoolName,
                styleTheme: payload.styleTheme,
                showInstitutionalMeta: payload.showInstitutionalMeta,
                replaceIndex: isEditingExisting ? editVectorIndex : -1,
                replaceExisting
            });
        };

        document.getElementById('wbHdrApplyBtn').onclick = submitHeader;
        [lessonEl, axisEl, objEl, sessNumEl, dateEl].forEach((el) => {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitHeader();
                }
            });
        });
    }

    function updateBoardExerciseTimerUI() {
        const disp = document.getElementById('wbExerciseTimerDisplay') || document.getElementById('wbTimerDisplay');
        if (disp) {
            const m = String(Math.floor(exerciseTimerState.secondsLeft / 60)).padStart(2, '0');
            const s = String(exerciseTimerState.secondsLeft % 60).padStart(2, '0');
            disp.textContent = `${m}:${s}`;
            disp.style.color = exerciseTimerState.secondsLeft <= 30 ? '#f87171' : '#fef08a';
        }
        const btn = document.getElementById('btnWbTimerStartPause');
        if (btn) {
            btn.textContent = exerciseTimerState.running ? '⏸' : '▶';
            btn.style.background = exerciseTimerState.running ? '#d97706' : '#eab308';
            btn.style.color = exerciseTimerState.running ? '#ffffff' : '#0f172a';
        }
    }

    function toggleBoardExerciseTimer(forceState) {
        const overlay = document.getElementById('wbExerciseTimerOverlay');
        if (!overlay) return;
        const isVisible = overlay.style.display === 'flex';
        const nextState = (typeof forceState === 'boolean') ? forceState : !isVisible;
        overlay.style.display = nextState ? 'flex' : 'none';
        if (nextState) {
            updateBoardExerciseTimerUI();
        } else if (exerciseTimerState.running) {
            exerciseTimerState.running = false;
            if (exerciseTimerState.intervalId) {
                clearInterval(exerciseTimerState.intervalId);
                exerciseTimerState.intervalId = null;
            }
        }
    }

    function setBoardExerciseTimerMinutes(mins) {
        if (exerciseTimerState.intervalId) {
            clearInterval(exerciseTimerState.intervalId);
            exerciseTimerState.intervalId = null;
        }
        exerciseTimerState.running = false;
        exerciseTimerState.secondsLeft = Math.max(60, (parseInt(mins, 10) || 5) * 60);
        updateBoardExerciseTimerUI();
    }

    function startPauseBoardExerciseTimer() {
        if (exerciseTimerState.running) {
            exerciseTimerState.running = false;
            if (exerciseTimerState.intervalId) {
                clearInterval(exerciseTimerState.intervalId);
                exerciseTimerState.intervalId = null;
            }
            updateBoardExerciseTimerUI();
            return;
        }

        if (exerciseTimerState.secondsLeft <= 0) {
            exerciseTimerState.secondsLeft = 300;
        }
        exerciseTimerState.running = true;
        updateBoardExerciseTimerUI();

        exerciseTimerState.intervalId = setInterval(() => {
            if (!exerciseTimerState.running) return;
            exerciseTimerState.secondsLeft--;
            if (exerciseTimerState.secondsLeft <= 0) {
                exerciseTimerState.secondsLeft = 0;
                exerciseTimerState.running = false;
                clearInterval(exerciseTimerState.intervalId);
                exerciseTimerState.intervalId = null;
                updateBoardExerciseTimerUI();
                if (typeof window.playTeachingSessionChime === 'function') {
                    try { window.playTeachingSessionChime('subtimer_end'); } catch (e) {}
                }
                if (typeof window.showNotification === 'function') {
                    window.showNotification('⏱️ انتهى الوقت المخصص لإنجاز التمرين التطبيقي! لنمر إلى التصحيح الجماعي على السبورة.', 'warning');
                }
                return;
            }
            updateBoardExerciseTimerUI();
        }, 1000);
    }

    function saveBoardToLessonLog() {
        try {
            const pageCount = isPdfOrWorksheetActive() ? pdfTotalPages : pageDataUrls.length;
            const docLabel = isPdfOrWorksheetActive() ? `مع تصحيح مستند (${currentPdfFileName || 'سلسلة تمارين'})` : `(${pageCount} صفحات سبورة تفاعلية)`;
            const summaryNote = `إنجاز الحصة وشرح الفقرات والتمارين التطبيقية على السبورة الرقمية التفاعلية ${docLabel}.`;

            let targetClass = window.currentClass || '';
            const clsSel = document.getElementById('lessonLogClassSelect') || document.getElementById('classSelect');
            if (!targetClass && clsSel && clsSel.value) targetClass = clsSel.value;
            if (!targetClass && window.db && window.db.classes) {
                targetClass = Object.keys(window.db.classes)[0] || '';
            }

            if (typeof window.addQuickSession === 'function' && targetClass) {
                window.addQuickSession(targetClass, {
                    type: 'درس وتطبيقات (سبورة رقمية)',
                    summary: summaryNote,
                    homework: 'مراجعة التمارين المصححة على السبورة الرقمية وإنجاز التمرين التطبيقي الموالي.'
                });
                return;
            }

            if (window.db && targetClass) {
                window.db.lessonLogs = window.db.lessonLogs || {};
                if (!Array.isArray(window.db.lessonLogs[targetClass])) {
                    window.db.lessonLogs[targetClass] = [];
                }
                const now = new Date();
                const h = String(now.getHours()).padStart(2, '0');
                const nextH = String((now.getHours() + 1) % 24).padStart(2, '0');
                window.db.lessonLogs[targetClass].push({
                    id: 'log_wb_' + Date.now(),
                    date: now.toISOString().slice(0, 10),
                    time: `من ${h}:00 إلى ${nextH}:00`,
                    type: 'درس نظري وتطبيقات',
                    unit: 'السبورة التفاعلية',
                    topic: isPdfOrWorksheetActive() ? `تصحيح: ${currentPdfFileName || 'سلسلة تمارين'}` : 'حصة تفاعلية على السبورة الرقمية',
                    summary: summaryNote,
                    homework: 'مراجعة الحلول المنجزة على السبورة الرقمية',
                    signature: `${(window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile().name) || 'الأستاذ(ة)'} (توثيق رقمي من السبورة)`,
                    completionRate: 100
                });
                if (typeof window.saveDB === 'function') window.saveDB();
                if (typeof window.renderLessonLogs === 'function') window.renderLessonLogs();
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification(`📓 تم توثيق ملخص السبورة التفاعلية في دفتر نصوص القسم (${targetClass || 'الحالي'}) بنجاح!`, 'success');
            }
        } catch (e) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('📓 تم حفظ ملخص السبورة في دفتر النصوص.', 'info');
            }
        }
    }

    /* ====================================================================
     * 9. الميزات التربوية المتقدمة للتدريس عن بعد والرياضيات (Upgrades)
     * ==================================================================== */

    /**
     * أ. ستار الإخفاء التدريجي (Pedagogical Reveal Curtain)
     */
    function toggleBoardCurtain(forceState) {
        const next = (typeof forceState === 'boolean') ? forceState : !curtainState.visible;
        curtainState.visible = next;
        if (next) {
            const h = lastValidHeight || (canvas && parseFloat(canvas.style.height)) || 640;
            if (!curtainState.y || curtainState.y < 50 || curtainState.y > h - 40) {
                curtainState.y = Math.floor(h * 0.38);
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification('🎭 تم تفعيل ستار الإخفاء التدريجي — اسحب الشريط الأزرق للأسفل لكشف مراحل الحل خطوة بخطوة.', 'info');
            }
        }
        const btn = document.getElementById('btnToggleBoardCurtain');
        if (btn) {
            btn.style.background = next ? '#0284c7' : '#f0f9ff';
            btn.style.color = next ? '#ffffff' : '#0369a1';
        }
        renderGeometricToolsOverlay();
    }

    /**
     * ب. استوديو تسجيل الحصة بالفيديو والصوت (Live Video + Audio Lesson Recorder .webm)
     */
    async function toggleBoardVideoRecorder() {
        if (videoRecorderState.isRecording) {
            stopBoardVideoRecorder();
            return;
        }
        await startBoardVideoRecorder();
    }

    async function startBoardVideoRecorder() {
        if (!canvas) return;
        try {
            const compCanvas = document.createElement('canvas');
            compCanvas.width = canvas.width || 1280;
            compCanvas.height = canvas.height || 720;
            const compCtx = compCanvas.getContext('2d');
            videoRecorderState.compCanvas = compCanvas;
            videoRecorderState.compCtx = compCtx;
            videoRecorderState.recordedChunks = [];

            const renderCompositeFrame = () => {
                if (!videoRecorderState.isRecording) return;
                if (compCanvas.width !== canvas.width || compCanvas.height !== canvas.height) {
                    compCanvas.width = canvas.width;
                    compCanvas.height = canvas.height;
                }
                compCtx.clearRect(0, 0, compCanvas.width, compCanvas.height);
                if (bgCanvas) {
                    compCtx.drawImage(bgCanvas, 0, 0);
                } else {
                    compCtx.fillStyle = '#ffffff';
                    compCtx.fillRect(0, 0, compCanvas.width, compCanvas.height);
                }
                compCtx.drawImage(canvas, 0, 0);
                if (toolsCanvas) {
                    compCtx.drawImage(toolsCanvas, 0, 0);
                }
                videoRecorderState.animFrameId = requestAnimationFrame(renderCompositeFrame);
            };

            videoRecorderState.isRecording = true;
            renderCompositeFrame();

            const canvasStream = compCanvas.captureStream ? compCanvas.captureStream(30) : null;
            if (!canvasStream) {
                videoRecorderState.isRecording = false;
                if (typeof window.showNotification === 'function') {
                    window.showNotification('المتصفح الحالي لا يدعم تسجيل الفيديو المباشر من الكانفاس.', 'warning');
                }
                return;
            }

            // Try to attach teacher microphone audio if available (gracefully fallback to silent video if denied)
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    videoRecorderState.audioStream = audioStream;
                    audioStream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
                }
            } catch (micErr) {
                // Continue recording board video without microphone if user declines or no mic exists
            }

            let mimeType = 'video/webm;codecs=vp9,opus';
            if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
            }

            const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
            videoRecorderState.mediaRecorder = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    videoRecorderState.recordedChunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(videoRecorderState.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const dateTag = new Date().toISOString().slice(0, 10);
                a.href = url;
                a.download = `تسجيل_حصة_الرياضيات_السبورة_${dateTag}.webm`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                if (typeof window.showNotification === 'function') {
                    window.showNotification('🎬 تم حفظ وتحميل فيديو الحصة المشروحة (.webm) بنجاح! يمكنك مشاركته مع التلاميذ.', 'success');
                }
            };

            recorder.start(1000);
            videoRecorderState.startTime = Date.now();
            updateVideoRecorderButtonUI();

            videoRecorderState.timerInterval = setInterval(() => {
                updateVideoRecorderButtonUI();
            }, 1000);

            if (typeof window.showNotification === 'function') {
                const hasMic = !!(videoRecorderState.audioStream && videoRecorderState.audioStream.getAudioTracks().length);
                window.showNotification(hasMic ? '🎥 بدأ تسجيل فيديو الحصة مع الصوت (الميكروفون نشط)...' : '🎥 بدأ تسجيل فيديو السبورة التفاعلية (انقر مرة أخرى للإيقاف والحفظ).', 'success');
            }
        } catch (err) {
            videoRecorderState.isRecording = false;
            updateVideoRecorderButtonUI();
            if (typeof window.showNotification === 'function') {
                window.showNotification('تعذر بدء تسجيل الفيديو: ' + (err.message || ''), 'error');
            }
        }
    }

    function stopBoardVideoRecorder() {
        videoRecorderState.isRecording = false;
        if (videoRecorderState.animFrameId) {
            cancelAnimationFrame(videoRecorderState.animFrameId);
            videoRecorderState.animFrameId = null;
        }
        if (videoRecorderState.timerInterval) {
            clearInterval(videoRecorderState.timerInterval);
            videoRecorderState.timerInterval = null;
        }
        if (videoRecorderState.audioStream) {
            try {
                videoRecorderState.audioStream.getTracks().forEach(t => t.stop());
            } catch (e) {}
            videoRecorderState.audioStream = null;
        }
        if (videoRecorderState.mediaRecorder && videoRecorderState.mediaRecorder.state !== 'inactive') {
            try {
                videoRecorderState.mediaRecorder.stop();
            } catch (e) {}
        }
        updateVideoRecorderButtonUI();
    }

    function updateVideoRecorderButtonUI() {
        const btn = document.getElementById('btnToggleBoardVideoRec');
        const lbl = document.getElementById('btnBoardVideoRecLabel');
        const dot = document.getElementById('boardVideoRecDot');
        if (!btn || !lbl) return;

        if (videoRecorderState.isRecording) {
            const elapsed = Math.max(0, Math.floor((Date.now() - videoRecorderState.startTime) / 1000));
            const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            btn.style.background = '#dc2626';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#b91c1c';
            lbl.textContent = `⏹ إيقاف (${m}:${s})`;
            if (dot) dot.style.background = '#fef08a';
        } else {
            btn.style.background = '#fef2f2';
            btn.style.color = '#b91c1c';
            btn.style.borderColor = '#fca5a5';
            lbl.textContent = '🎥 تسجيل فيديو';
            if (dot) dot.style.background = '#dc2626';
        }
    }

    /**
     * ج. البث والمشاركة الفورية للسبورة عبر رمز QR ورابط مباشر للتلاميذ (`openBoardLiveShareModal`)
     */
    async function openBoardLiveShareModal() {
        if (!canvas) return;
        persistWhiteboardState();

        const comp = createCompositedCanvas();
        const imgDataUrl = comp.toDataURL('image/webp', 0.86);

        let modal = document.getElementById('wbLiveShareQrModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbLiveShareQrModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10060;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const clsName = window.currentClass || 'عام';
        const pageTitle = isPdfOrWorksheetActive()
            ? `تصحيح ${currentPdfFileName || 'سلسلة تمارين'} - صفحة ${currentPdfPageNum}`
            : `ملخص السبورة التفاعلية - صفحة ${currentPageIndex + 1}`;
        const tp = (window.WbSecurityMath && window.WbSecurityMath.getTeacherProfile()) || {};

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#ffffff;border-radius:16px;max-width:520px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#3730a3,#4f46e5);color:#fff;">
                    <div style="font-weight:800;font-size:0.96rem;">📡 مشاركة السبورة والحلول مع التلاميذ عبر QR</div>
                    <button type="button" id="wbShareCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;">
                    <div style="font-size:0.8rem;font-weight:800;color:#1e293b;">${escWb(pageTitle)} (${escWb(clsName)})</div>
                    <img src="${imgDataUrl}" alt="معاينة السبورة" style="max-height:150px;width:auto;border-radius:8px;border:1.5px solid #cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                    <div id="wbShareQrBox" style="min-height:165px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#f8fafc;border:1.5px dashed #94a3b8;border-radius:12px;padding:12px;width:100%;box-sizing:border-box;">
                        <span style="font-size:0.78rem;color:#475569;font-weight:700;">⏳ جاري توليد رابط المشاركة ورمز الاستجابة السريعة QR...</span>
                    </div>
                    <div style="display:flex;gap:8px;width:100%;">
                        <input type="text" id="wbShareDirectUrlInput" readonly value="" placeholder="رابط السبورة المباشر للتلاميذ..." dir="ltr" style="flex:1;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:0.76rem;font-weight:700;color:#1e293b;background:#f8fafc;">
                        <button type="button" id="wbShareCopyLinkBtn" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:0.76rem;font-weight:800;cursor:pointer;">📋 نسخ الرابط</button>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:8px;width:100%;border-top:1px solid #e2e8f0;padding-top:10px;">
                        <button type="button" id="wbShareExportPngBtn" style="flex:1;background:#059669;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:0.78rem;font-weight:800;cursor:pointer;">💾 تحميل الصورة PNG</button>
                        <button type="button" id="wbShareCloseBtn" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:8px;padding:8px 16px;font-size:0.78rem;font-weight:800;cursor:pointer;">إغلاق</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbShareCloseX').onclick = close;
        document.getElementById('wbShareCloseBtn').onclick = close;
        const expPngBtn = document.getElementById('wbShareExportPngBtn');
        if (expPngBtn) expPngBtn.onclick = () => exportBoardImage();

        let shareUrl = '';
        let qrDataUrl = '';
        let shareErrorMsg = '';
        try {
            const resp = await fetch('/api/share/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'whiteboard',
                    title: `${pageTitle} (${clsName})`,
                    subtitle: `ملخص وتصحيح على السبورة التفاعلية لمادة الرياضيات`,
                    data: {
                        kind: 'whiteboard_snapshot',
                        imageDataUrl: imgDataUrl,
                        pageTitle,
                        className: clsName,
                        createdAt: new Date().toISOString()
                    },
                    expiryDays: 30,
                    teacherName: tp.name || '',
                    schoolName: tp.school || ''
                })
            });
            const data = await resp.json().catch(() => null);
            if (resp.ok && data && data.success) {
                shareUrl = data.shareUrl || (data.shareId ? `${window.location.origin}/?share=${data.shareId}` : '');
                qrDataUrl = data.qrCodeDataUrl || '';
            } else {
                shareErrorMsg = (data && data.error) || 'تعذر الاتصال بخادم المشاركة الآمن.';
            }
        } catch (err) {
            shareErrorMsg = err && err.message ? err.message : 'تعذر الاتصال بالخادم.';
        }

        const urlInput = document.getElementById('wbShareDirectUrlInput');
        if (urlInput) urlInput.value = shareUrl || window.location.origin;

        const qrBox = document.getElementById('wbShareQrBox');
        if (qrBox) {
            if (qrDataUrl) {
                qrBox.innerHTML = `
                    <img src="${escWb(qrDataUrl)}" alt="QR Code" style="width:155px;height:155px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;padding:4px;">
                    <div style="font-size:0.72rem;font-weight:800;color:#3730a3;">📱 يمسح التلاميذ هذا الرمز بهواتفهم لفتح السبورة وحفظ الحلول فوراً</div>
                `;
            } else {
                qrBox.innerHTML = `
                    <div style="font-size:0.8rem;font-weight:800;color:#b45309;">⚠️ ${escWb(shareErrorMsg || 'لم يتم توليد رمز QR')}</div>
                    <div style="font-size:0.72rem;color:#64748b;">يمكنك تحميل صورة السبورة PNG ومشاركتها مباشرة مع التلاميذ.</div>
                `;
            }
        }

        const copyBtn = document.getElementById('wbShareCopyLinkBtn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const targetUrl = shareUrl || (urlInput && urlInput.value) || window.location.origin;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(targetUrl).catch(() => {});
                } else if (urlInput) {
                    urlInput.select();
                    document.execCommand('copy');
                }
                if (typeof window.showNotification === 'function') {
                    window.showNotification('🔗 تم نسخ رابط السبورة المباشر لمشاركته مع التلاميذ!', 'success');
                }
            };
        }
    }

    /**
     * د. رسم المستوى العقدي (O, u⃗, v⃗) مع التمثيل المبياني للعدد العقدي z ومرافقه z̄ والمعيار والعمدة
     */
    function drawComplexPlane() {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const boxW = Math.min(w - 60, 620);
        const boxH = Math.min(h - 40, 440);
        const obj = {
            t: 'complex_plane',
            x: Math.floor((w - boxW) / 2),
            y: Math.floor((h - boxH) / 2),
            w: boxW,
            h: boxH,
            c: currentColor
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('🔢 تم رسم المستوى العقدي (O, u⃗, v⃗) مع التمثيل المبياني لـ z و z̄ والمعيار والعمدة!', 'success');
        }
    }

    /**
     * هـ. التمثيل المبياني للمتتالية الترجعية u_{n+1} = f(u_n) (Cobweb / Staircase Construction)
     */
    function openRecursiveSequenceModal() {
        let modal = document.getElementById('wbRecursiveSeqModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbRecursiveSeqModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10055;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#0369a1,#0284c7);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">🌀 التمثيل المبياني للمتتالية الترجعية uₙ₊₁ = f(uₙ)</div>
                    <button type="button" id="wbSeqCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                        <span style="font-size:0.74rem;font-weight:800;color:#475569;">أمثلة المقرر (2 باك):</span>
                        <button type="button" class="wb-seq-ex" data-fn="sqrt(2*x + 3)" data-u0="0.5" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">√(2x+3) , u₀=0.5</button>
                        <button type="button" class="wb-seq-ex" data-fn="0.5*x + 2" data-u0="0.5" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">0.5x + 2 , u₀=0.5</button>
                        <button type="button" class="wb-seq-ex" data-fn="4/(x + 1)" data-u0="0.5" style="background:#e0f2fe;border:1px solid #7dd3fc;color:#0369a1;border-radius:5px;padding:2px 8px;font-size:0.72rem;font-weight:800;cursor:pointer;" dir="ltr">4/(x+1) , u₀=0.5</button>
                    </div>
                    <div>
                        <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">تعبير الدالة المرفقة f(x):</label>
                        <input type="text" id="wbSeqFnInput" value="sqrt(2*x + 3)" dir="ltr" style="width:100%;padding:8px 12px;border:1.5px solid #0284c7;border-radius:8px;font-weight:800;font-size:0.86rem;box-sizing:border-box;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">الحد الأول u₀:</label>
                            <input type="number" id="wbSeqU0Input" value="0.5" step="0.5" dir="ltr" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-weight:800;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block;font-size:0.76rem;font-weight:800;color:#1e293b;margin-bottom:4px;">عدد الحدود الممثلة (n):</label>
                            <input type="number" id="wbSeqTermsInput" value="4" min="2" max="7" dir="ltr" style="width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-weight:800;box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
                        <button type="button" id="wbSeqCancelBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbSeqDrawBtn" style="background:linear-gradient(135deg,#0369a1,#0284c7);border:none;color:#fff;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;">🌀 إنشاء التمثيل المبياني على السبورة</button>
                    </div>
                </div>
            </div>
        `;

        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbSeqCloseX').onclick = close;
        document.getElementById('wbSeqCancelBtn').onclick = close;
        modal.querySelectorAll('.wb-seq-ex').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('wbSeqFnInput').value = btn.getAttribute('data-fn');
                document.getElementById('wbSeqU0Input').value = btn.getAttribute('data-u0');
            };
        });

        document.getElementById('wbSeqDrawBtn').onclick = () => {
            const expr = document.getElementById('wbSeqFnInput').value.trim();
            const u0 = parseFloat(document.getElementById('wbSeqU0Input').value) || 0.5;
            const steps = Math.max(2, Math.min(7, parseInt(document.getElementById('wbSeqTermsInput').value, 10) || 4));
            close();
            drawRecursiveSequenceCobweb(expr, u0, steps);
        };
    }

    function drawRecursiveSequenceCobweb(expr, u0, steps) {
        if (!ctx || !canvas) return;
        drawCartesianAxes();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const obj = {
            t: 'cobweb',
            x: 0,
            y: 0,
            w,
            h,
            scale: 40,
            expr,
            u0,
            steps
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🌀 تم تمثيل حدود المتتالية الترجعية uₙ₊₁ = f(uₙ) انطلاقاً من u₀ = ${u0}!`, 'success');
        }
    }

    /**
     * و. بطاقات التنبيه الديداكتيكي السريعة (Didactic Callout Cards)
     */
    function openDidacticCalloutModal() {
        let modal = document.getElementById('wbDidacticCalloutModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbDidacticCalloutModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.72);backdrop-filter:blur(5px);z-index:10055;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }

        const presets = [
            { type: 'theorem', badge: '💡 خاصية / مبرهنة أساسية', color: '#1d4ed8', bg: '#eff6ff', text: 'إذا كانت الدالة f متصلة ورتيبة قطعا على مجال I فإنها تقبل دالة عكسية f⁻¹ معرفة على J = f(I).' },
            { type: 'warning', badge: '⚠️ انتبه: خطأ شائع يجب تفاديه!', color: '#dc2626', bg: '#fef2f2', text: 'لا تخلط بين اشتقاق دالة مركبة u(v(x)) واشتقاق الجداء: (f∘g)\'(x) = g\'(x) × f\'(g(x)).' },
            { type: 'method', badge: '📌 منهجية الإجابة في الامتحان الوطني', color: '#047857', bg: '#ecfdf5', text: 'لإثبات أن المستقيم (Δ): y = ax + b مقارب مائل بجوار +∞، نحسب النهاية: lim [f(x) - (ax + b)] = 0.' },
            { type: 'question', badge: '🎯 سؤال للتفكير والبحث الآني', color: '#7c3aed', bg: '#faf5ff', text: 'حدد مجموعة تعريف الدالة f(x) ثم ادرس اتصالها في النقطة x₀ قبل الشروع في حساب المشتقة.' }
        ];

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:14px;max-width:520px;width:100%;box-shadow:0 25px 50px rgba(0,0,0,0.35);border:1.5px solid #cbd5e1;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;">
                    <div style="font-weight:800;font-size:0.95rem;">📌 إدراج بطاقة تنبيه أو قاعدة ديداكتيكية على السبورة</div>
                    <button type="button" id="wbCalloutCloseX" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;">✕</button>
                </div>
                <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px;">
                    <div style="font-size:0.75rem;font-weight:800;color:#475569;">اختر نوع البطاقة التربوية:</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        ${presets.map((p, idx) => `<button type="button" class="wb-callout-type-btn" data-idx="${idx}" style="background:${p.bg};border:1.5px solid ${p.color};color:${p.color};border-radius:8px;padding:6px 8px;font-size:0.73rem;font-weight:800;cursor:pointer;text-align:right;">${p.badge}</button>`).join('')}
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">عنوان البطاقة:</label>
                        <input type="text" id="wbCalloutTitleInput" value="${presets[0].badge}" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:800;font-size:0.82rem;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block;font-size:0.75rem;font-weight:800;color:#1e293b;margin-bottom:3px;">محتوى التوجيه أو القاعدة الرياضية:</label>
                        <textarea id="wbCalloutBodyInput" rows="2" style="width:100%;padding:7px 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-weight:700;font-size:0.8rem;box-sizing:border-box;font-family:inherit;">${presets[0].text}</textarea>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;">
                        <button type="button" id="wbCalloutCancelBtn" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#475569;padding:7px 14px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;">إلغاء</button>
                        <button type="button" id="wbCalloutStampBtn" style="background:linear-gradient(135deg,#d97706,#b45309);border:none;color:#fff;padding:7px 18px;border-radius:8px;font-weight:800;font-size:0.82rem;cursor:pointer;">📌 تثبيت البطاقة على السبورة</button>
                    </div>
                </div>
            </div>
        `;

        let activePreset = presets[0];
        const close = () => { modal.style.display = 'none'; };
        document.getElementById('wbCalloutCloseX').onclick = close;
        document.getElementById('wbCalloutCancelBtn').onclick = close;

        modal.querySelectorAll('.wb-callout-type-btn').forEach(btn => {
            btn.onclick = () => {
                const idx = Number(btn.getAttribute('data-idx')) || 0;
                activePreset = presets[idx] || presets[0];
                document.getElementById('wbCalloutTitleInput').value = activePreset.badge;
                document.getElementById('wbCalloutBodyInput').value = activePreset.text;
            };
        });

        document.getElementById('wbCalloutStampBtn').onclick = () => {
            const title = document.getElementById('wbCalloutTitleInput').value.trim() || activePreset.badge;
            const body = document.getElementById('wbCalloutBodyInput').value.trim() || activePreset.text;
            close();
            stampDidacticCalloutToBoard(title, body, activePreset.color, activePreset.bg);
        };
    }

    function stampDidacticCalloutToBoard(title, body, borderColor, bgColor) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const cardW = Math.min(560, w - 60);
        const cardH = 82;
        const x0 = Math.floor((w - cardW) / 2);
        const y0 = 72;

        const obj = {
            t: 'callout',
            x: x0,
            y: y0,
            w: cardW,
            h: cardH,
            title,
            body,
            borderColor: borderColor || '#1d4ed8',
            bgColor: bgColor || '#eff6ff'
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📌 تم تثبيت البطاقة الديداكتيكية على السبورة بنجاح!', 'success');
        }
    }

    // =========================================================================
    // 10. Interactive Prerequisite & Formative Math Quiz (رائز المكتسبات القبلية والتقويم التكويني السريع)
    //     Strictly Diagnostic & Formative — Zero Participation/Grade Impact
    // =========================================================================
    const MATH_PREREQUISITE_QUIZ_BANKS = {
        tcs_1bac_foundations: {
            title: 'المكتسبات القبلية الأساسية (الإشارة، المميز Δ، الحساب المثلثي)',
            level: 'جذع مشترك / 1 و 2 باكالوريا',
            questions: [
                {
                    concept: 'إشارة الحدية ax + b',
                    q: 'ما هي إشارة التعبير 2x - 6 على المجال ]-∞, 3[ ؟',
                    options: [
                        'سالبة قطعا لأنها على يسار الجذر x = 3 وعكس إشارة a = 2',
                        'موجبة قطعا لأن المعامل a = 2 موجب',
                        'تنعدم على جميع عناصر المجال',
                        'سالبة فقط إذا كان x سالباً'
                    ],
                    correct: 0,
                    explanation: 'الحدية ax + b تنعدم في x = -b/a = 3. على يسار الجذر ]-∞, 3[ تكون إشارتها عكس إشارة a (أي سالبة لأن a = 2 > 0).',
                    pitfall: 'الخلط بين إشارة العدد x وإشارة التعبير ax + b، أو نسيان قاعدة (عكس إشارة a على يسار الجذر).'
                },
                {
                    concept: 'المميز Δ وإشارة ثلاثية الحدود ax² + bx + c',
                    q: 'إذا كان المميز Δ < 0 لثلاثية الحدود P(x) = -x² + 2x - 5، فإن إشارة P(x) على ℝ هي:',
                    options: [
                        'سالبة قطعا على ℝ بأكملها (نفس إشارة a = -1)',
                        'موجبة قطعا على ℝ بأكملها',
                        'تتغير حسب قيمة x',
                        'ليس لها إشارة لأن المعادلة لا تقبل حلولاً في ℝ'
                    ],
                    correct: 0,
                    explanation: 'بما أن Δ = 4 - 20 = -16 < 0، فإن ثلاثية الحدود لا تقبل جذوراً حقيقية، وإشارتها على ℝ بأكملها هي إشارة معامل أعلى درجة a = -1 < 0.',
                    pitfall: 'اعتقاد التلميذ أن عدم وجود حلول للمعادلة P(x)=0 يعني عدم إمكانية تحديد إشارة P(x).'
                },
                {
                    concept: 'متطابقات هامة ومرافق الجذر المربع',
                    q: 'ما هو مرافق التعبير A = √(x + 3) - 2 المستعمل لإزالة الشكل غير المحدد؟',
                    options: [
                        '√(x + 3) + 2   وحاصل ضربهما هو x - 1',
                        '√(x - 3) + 2   وحاصل ضربهما هو x - 7',
                        'x + 3 - 4   مباشرة دون ضرب',
                        '-√(x + 3) - 2'
                    ],
                    correct: 0,
                    explanation: 'مرافق (a - b) هو (a + b)، وحاصل الجداء يعطي a² - b² = (x + 3) - 2² = x + 3 - 4 = x - 1.',
                    pitfall: 'نسيان تربيع العدد الثاني (كتابة 2 بدل 4) أو تغيير الإشارة داخل الجذر المربع.'
                },
                {
                    concept: 'الحساب المثلثي الأساسي',
                    q: 'مهما يكن x من ℝ، فإن التعبير cos²(x) + sin²(x) يساوي دائماً:',
                    options: [
                        '1',
                        'cos(2x)',
                        '2 sin(x) cos(x)',
                        '0'
                    ],
                    correct: 0,
                    explanation: 'العلاقة الأساسية في الحساب المثلثي على الدائرة المثلثية (مبرهنة فيثاغورس): cos²(x) + sin²(x) = 1.',
                    pitfall: 'الخلط بين cos²(x) + sin²(x) = 1 وصيغة cos(2x) = cos²(x) - sin²(x).'
                },
                {
                    concept: 'مجموعة تعريف دالة جذرية ولاجذرية',
                    q: 'ما هو شرط انتماء العدد الحقيقي x إلى مجموعة تعريف الدالة f(x) = √(x - 1) / (x - 4) ؟',
                    options: [
                        'x - 1 ≥ 0   و   x - 4 ≠ 0   أي   [1, 4[ ∪ ]4, +∞[',
                        'x - 1 > 0 فقط',
                        'x ≠ 4 فقط',
                        ']1, 4['
                    ],
                    correct: 0,
                    explanation: 'ما بداخل الجذر المربع في البسط يجب أن يكون موجباً أو منعدماً (x ≥ 1)، والمقام يجب أن يخالف الصفر (x ≠ 4).',
                    pitfall: 'إغفال أحد الشرطين أو وضع قطعا (>) مكان (≥) لِما بداخل الجذر المربع الموجود في البسط.'
                }
            ]
        },
        limits_continuity: {
            title: 'النهايات والاتصال ومبرهنة القيم الوسيطية (2 باك)',
            level: 'الثانية باكالوريا علوم',
            questions: [
                {
                    concept: 'نهاية دالة حدودية ودالة جذرية عند ±∞',
                    q: 'نهاية الدالة الجذرية f(x) = (3x³ - 5x + 1) / (2x³ + x² - 4) عندما يؤول x إلى +∞ تساوي:',
                    options: [
                        '3 / 2   (نهاية خارج الحدين الأعلى درجة)',
                        '+∞   لأن البسط يؤول إلى +∞',
                        '0',
                        'شكل غير محدد لا يمكن حسابه'
                    ],
                    correct: 0,
                    explanation: 'عند ±∞ فقط، نهاية دالة جذرية هي نهاية خارج الحد الأعلى درجة في البسط على الحد الأعلى درجة في المقام: lim (3x³ / 2x³) = 3/2.',
                    pitfall: 'تطبيق قاعدة الحد الأعلى درجة عند عدد منتهٍ x → x₀ بدل بجوار ±∞ فقط!'
                },
                {
                    concept: 'الاتصال في نقطة x₀',
                    q: 'تكون الدالة f متصلة في النقطة x₀ إذا وفقط إذا كان:',
                    options: [
                        'lim (x→x₀) f(x) = f(x₀)',
                        'lim (x→x₀) f(x) = +∞',
                        'f معرفة فقط في x₀',
                        'f(x₀) = 0'
                    ],
                    correct: 0,
                    explanation: 'تعريف الاتصال في نقطة x₀ يقتضي أن تكون الدالة معرفة في x₀ وأن تكون نهايتها عند x₀ مساوية لصورة x₀.',
                    pitfall: 'الاكتفاء بحساب النهاية دون مقارنتها بصورة العدد f(x₀)، أو عدم التحقق من تساوي النهاية على اليمين واليسار.'
                },
                {
                    concept: 'مبرهنة القيم الوسيطية (TVI)',
                    q: 'لإثبات أن المعادلة f(x) = 0 تقبل حلاً وحيداً α في المجال ]a, b[ نتحقق من:',
                    options: [
                        'f متصلة على [a,b] + رتيبة قطعا على [a,b] + f(a)×f(b) < 0',
                        'f متصلة فقط على [a,b]',
                        'f(a) + f(b) = 0 فقط',
                        'f قابلة للاشتقاق عند a و b فقط'
                    ],
                    correct: 0,
                    explanation: 'الاتصال وشرط f(a)×f(b) < 0 يضمنان وجود حل على الأقل، والرتابة القطعية تضمن وحدانية هذا الحل.',
                    pitfall: 'نسيان شرط الرتابة القطعية عند السؤال عن "حل وحيد" أو نسيان ذكر الاتصال.'
                },
                {
                    concept: 'التأويل الهندسي للنهايات (المقاربات)',
                    q: 'إذا كان lim (x→+∞) f(x) = 2، فإن التأويل الهندسي هو أن المنحنى (Cf) يقبل:',
                    options: [
                        'مقارباً أفقياً معادلته y = 2 بجوار +∞',
                        'مقارباً عمودياً معادلته x = 2',
                        'فرعاً شلجمياً في اتجاه محور الأفاصيل',
                        'مماساً أفقياً في النقطة 2'
                    ],
                    correct: 0,
                    explanation: 'عندما يؤول x إلى ±∞ وتؤول f(x) إلى عدد منتهٍ b، فإن المستقيم ذا المعادلة y = b مقارب أفقي للمنحنى.',
                    pitfall: 'الخلط بين معادلة المقارب الأفقي (y = b) ومعادلة المقارب العمودي (x = a).'
                },
                {
                    concept: 'قابلية العكس ودالة الجذر من الرتبة n',
                    q: 'إذا كانت f متصلة وتناقصية قطعا على المجال [a, b] فإن صورة المجال f([a, b]) هي:',
                    options: [
                        '[ f(b) , f(a) ]   (ينعكس ترتيب الطرفين)',
                        '[ f(a) , f(b) ]',
                        '] -∞ , f(a) ]',
                        '[ a , b ]'
                    ],
                    correct: 0,
                    explanation: 'بما أن الدالة تناقصية قطعا، فإن a < b يستلزم f(a) > f(b)، وبالتالي الحد الأصغر للمجال الصورة هو f(b).',
                    pitfall: 'كتابة [f(a), f(b)] دون مراعاة أن الدالة تناقصية تعكس الترتيب.'
                }
            ]
        },
        derivatives_study: {
            title: 'الاشتقاق ودراسة الدوال والفروع اللانهائية',
            level: 'الأولى والثانية باكالوريا',
            questions: [
                {
                    concept: 'التأويل الهندسي للعدد المشتق',
                    q: 'إذا كانت f قابلة للاشتقاق في x₀ وكان f\'(x₀) = 0، فإن المنحنى (Cf) يقبل في النقطة A(x₀, f(x₀)):',
                    options: [
                        'مماساً أفقياً موازياً لمحور الأفاصيل معادلته y = f(x₀)',
                        'مقارباً أفقياً بجوار +∞',
                        'مماساً عمودياً موازياً لمحور الأراتيب',
                        'نقطة غير قابلة للرسم'
                    ],
                    correct: 0,
                    explanation: 'المعامل الموجه للمماس في x₀ هو f\'(x₀). عندما ينعدم يصبح المماس أفقياً ومعادلته y = f(x₀).',
                    pitfall: 'الخلط بين المماس الأفقي في نقطة (خاصية محلية) والمقارب الأفقي بجوار مالانهاية.'
                },
                {
                    concept: 'إشارة المشتقة ورتابة الدالة',
                    q: 'تكون الدالة f القابلة للاشتقاق على مجال I تزايدية على I إذا وفقط إذا كان:',
                    options: [
                        'لكل x من I :   f\'(x) ≥ 0',
                        'لكل x من I :   f(x) ≥ 0',
                        'lim f(x) = +∞',
                        'f\'\'(x) ≥ 0'
                    ],
                    correct: 0,
                    explanation: 'رتابة الدالة f ترتبط بإشارة مشتقتها f\'(x) وليس بإشارة f(x) نفسها.',
                    pitfall: 'دراسة إشارة f(x) بدل إشارة المشتقة f\'(x) لاستنتاج جدول التغيرات.'
                },
                {
                    concept: 'اشتقاق مركب دالتين (uⁿ)\' و (√u)\'',
                    q: 'مشتقة الدالة f(x) = √(u(x)) على مجال تكون فيه u موجبة قطعا وقابلة للاشتقاق هي:',
                    options: [
                        'u\'(x) / ( 2 √(u(x)) )',
                        '1 / ( 2 √(u(x)) )   دون ضرب في u\'(x)',
                        'u\'(x) × √(u(x))',
                        '2 u\'(x) √(u(x))'
                    ],
                    correct: 0,
                    explanation: 'حسب قاعدة اشتقاق مركب دالتين، نضرب دائماً في مشتقة ما بداخل الجذر u\'(x) في البسط.',
                    pitfall: 'نسيان الضرب في مشتقة الدالة الداخلية u\'(x) في البسط.'
                },
                {
                    concept: 'تقعر المنحنى ونقطة الانعطاف',
                    q: 'تكون النقطة I(x₀, f(x₀)) نقطة انعطاف للمنحنى (Cf) إذا:',
                    options: [
                        'انعدمت المشتقة الثانية f\'\'(x) في x₀ مع تغير إشارتها بجوار x₀',
                        'انعدمت المشتقة الأولى f\'(x) فقط',
                        'انعدمت الدالة f(x₀) = 0',
                        'كانت f\'\'(x₀) > 0'
                    ],
                    correct: 0,
                    explanation: 'نقطة الانعطاف هي النقطة التي يغير فيها المنحنى تقعره، أي تنعدم فيها f\'\' وتغير إشارتها على يمين ويسار x₀.',
                    pitfall: 'الاكتفاء بحل المعادلة f\'\'(x) = 0 دون التحقق من تغير إشارة f\'\'(x) بجوار الحل.'
                },
                {
                    concept: 'الوضع النسبي للمنحنى (Cf) والمستقيم (Δ): y = ax + b',
                    q: 'لدراسة الوضع النسبي للمنحنى (Cf) والمستقيم (Δ) ذي المعادلة y = ax + b ندرس:',
                    options: [
                        'إشارة الفرق f(x) - (ax + b)',
                        'إشارة المشتقة f\'(x)',
                        'نهاية f(x) / x',
                        'إشارة f(x) × (ax + b)'
                    ],
                    correct: 0,
                    explanation: 'إذا كان الفرق f(x) - y > 0 فإن (Cf) يوجد فوق المستقيم (Δ)، وإذا كان سالباً فإن (Cf) يوجد تحت (Δ).',
                    pitfall: 'حساب النهاية بدل دراسة إشارة الفرق f(x) - (ax + b) في جدول الإشارة.'
                }
            ]
        },
        sequences: {
            title: 'المتتاليات العددية والبرهان بالترجع والتقارب',
            level: 'الأولى والثانية باكالوريا',
            questions: [
                {
                    concept: 'مراحل البرهان بالترجع',
                    q: 'في مرحلة الوراثة للبرهان بالترجع على الخاصية P(n) لكل n ≥ n₀:',
                    options: [
                        'نفترض أن P(n) صحيحة لعدد n ثابت ونبرهن على صحة P(n+1)',
                        'نعوض n بقيمتين عدديتين فقط مثل n=0 و n=1',
                        'نفترض أن P(n+1) صحيحة ونستنتج P(n)',
                        'نحسب نهاية المتتالية مباشرة'
                    ],
                    correct: 0,
                    explanation: 'البرهان بالترجع يقوم على التحقق من الحد الأول n₀، ثم افتراض صحة الخاصية عند رتبة n والبرهنة على صحتها عند الرتبة الموالية n+1.',
                    pitfall: 'كتابة "نفترض أنه لكل n..." في الفرضية بدل تثبيت عدد طبيعي n، أو الانطلاق من النتيجة المطلوبة P(n+1).'
                },
                {
                    concept: 'رتابة متتالية عددية (Un)',
                    q: 'لدراسة رتابة المتتالية (Un) في الحالة العامة، ندرس إشارة:',
                    options: [
                        'الفرق   U_{n+1} - U_n',
                        'المجموع   U_{n+1} + U_n',
                        'الحد العام   U_n   لوحده',
                        'مشتقة الحد العام دائماً حتى لو كانت تراجعية'
                    ],
                    correct: 0,
                    explanation: 'إذا كان U_{n+1} - U_n ≥ 0 لكل n فإن المتتالية تزايدية، وإذا كان ≤ 0 فهي تناقصية.',
                    pitfall: 'محاولة اشتقاق متتالية معرفة بعلاقة تراجعية U_{n+1} = f(U_n) مباشرة بالنسبة لـ n.'
                },
                {
                    concept: 'مصاديق تقارب متتالية مطردة',
                    q: 'كل متتالية تناقصية ومصغورة بعدد حقيقي m هي متتالية:',
                    options: [
                        'متقاربة (تقبل نهاية منتهية L ≥ m)',
                        'متباعدة نحو -∞',
                        'نهايتها تساوي بالضرورة الصفر',
                        'ثابتة'
                    ],
                    correct: 0,
                    explanation: 'حسب مبرهنة التقارب المطرد: كل متتالية تزايدية ومكبورة متقاربة، وكل متتالية تناقصية ومصغورة متقاربة.',
                    pitfall: 'استنتاج أن النهاية تساوي العدد m مباشرة؛ العدد m هو فقط حاد سفلي أما النهاية فنحددها بحل المعادلة f(L) = L.'
                },
                {
                    concept: 'المتتالية الهندسية ونهاية qⁿ',
                    q: 'إذا كان أساس المتتالية الهندسية يحقق -1 < q < 1 (مثلاً q = 1/3)، فإن lim (n→+∞) qⁿ تساوي:',
                    options: [
                        '0',
                        '+∞',
                        '1',
                        'لا تقبل نهاية'
                    ],
                    correct: 0,
                    explanation: 'كلما كان الأساس q محصوراً قطعا بين -1 و 1، فإن qⁿ يؤول إلى 0 عندما يؤول n إلى +∞.',
                    pitfall: 'الخلط بين الحالة |q| < 1 (النهاية 0) والحالة q > 1 (النهاية +∞).'
                },
                {
                    concept: 'نهاية متتالية تراجعية U_{n+1} = f(U_n)',
                    q: 'إذا كانت (Un) متقاربة نحو L وكانت f متصلة في L و U_{n+1} = f(U_n)، فإن L يحقق:',
                    options: [
                        'المعادلة   f(L) = L',
                        'المعادلة   f\'(L) = 0',
                        'المعادلة   f(L) = 0',
                        'L = U₀'
                    ],
                    correct: 0,
                    explanation: 'بما أن المتتالية متقاربة والدالة f متصلة على المجال المستقر، فإن النهاية L هي حل للمعادلة f(x) = x.',
                    pitfall: 'حل المعادلة f(x) = 0 بدل المعادلة f(x) = x، أو إغفال ذكر شروط المبرهنة (اتصال f، استقرار المجال f(I)⊂I، تقارب المتتالية).'
                }
            ]
        },
        ln_exp_integrals: {
            title: 'الدوال اللوغاريتمية والأسية والحساب التكاملي (2 باك)',
            level: 'الثانية باكالوريا علوم',
            questions: [
                {
                    concept: 'مجموعة تعريف الدالة اللوغاريتمية النبيرية',
                    q: 'تكون الدالة f(x) = ln(u(x)) معرفة إذا وفقط إذا كان:',
                    options: [
                        'u(x) > 0   (موجباً قطعا)',
                        'u(x) ≥ 0',
                        'x > 0   فقط مهما كانت u(x)',
                        'u(x) ≠ 0'
                    ],
                    correct: 0,
                    explanation: 'دالة اللوغاريتم النبيري ln معرفـة فقط للأعداد الحقيقية الموجبة قطعا، لذا يجب أن يكون ما بداخل اللوغاريتم u(x) > 0.',
                    pitfall: 'كتابة x > 0 بدل حل المتراجحة u(x) > 0، أو قبول القيمة 0 داخل ln.'
                },
                {
                    concept: 'النهايات الاعتيادية لدالتي ln و exp',
                    q: 'ما هي قيمة النهايتين الأساسيتين:   lim (x→+∞) ln(x)/x   و   lim (x→0⁺) x·ln(x) ؟',
                    options: [
                        'كلاهما يساوي 0',
                        'الأولى 1 والثانية -∞',
                        'الأولى +∞ والثانية 0',
                        'شكلان غير محددين لا يمكن حسابهما'
                    ],
                    correct: 0,
                    explanation: 'حسب خاصيات التزايد المقارن، القوة x تغلب اللوغاريتم ln(x) بجوار +∞ وبجوار 0⁺، فتكون النهايتان معاً منعدمتين (0).',
                    pitfall: 'الخلط بين lim (x→+∞) ln(x)/x = 0 وبين lim (x→+∞) eˣ/x = +∞.'
                },
                {
                    concept: 'اشتقاق ln(|u(x)|) و e^{u(x)}',
                    q: 'مشتقة الدالة f(x) = e^{u(x)} ومشتقة الدالة g(x) = ln(u(x)) (حيث u>0) هما على التوالي:',
                    options: [
                        'f\'(x) = u\'(x)·e^{u(x)}   و   g\'(x) = u\'(x) / u(x)',
                        'f\'(x) = e^{u\'(x)}   و   g\'(x) = 1 / u(x)',
                        'f\'(x) = u(x)·e^{u(x)-1}   و   g\'(x) = u\'(x)·ln(u(x))',
                        'f\'(x) = e^{u(x)}   دون ضرب في u\'(x)'
                    ],
                    correct: 0,
                    explanation: 'مشتقة مركب الدالة الأسية هي u\'·e^u، ومشتقة مركب اللوغاريتم هي المشتقة على الدالة نفسها u\'/u.',
                    pitfall: 'نسيان الضرب في مشتقة الأس u\'(x) عند اشتقاق e^{u(x)} (مثلاً مشتقة e^{-x} هي -e^{-x}).'
                },
                {
                    concept: 'المكاملة بالأجزاء وحساب المساحة',
                    q: 'مساحة حيز المستوى المحصور بين المنحنى (Cf) ومحور الأفاصيل والمستقيمين x=a و x=b (مع a<b) هي:',
                    options: [
                        '∫_a^b |f(x)| dx × ||i|| × ||j||   (تُدرس إشارة f(x) لإزالة القيمة المطلقة)',
                        '∫_a^b f(x) dx   مباشرة دون قيمة مطلقة ودون وحدة المساحة',
                        'f(b) - f(a)',
                        '∫_a^b f\'(x) dx'
                    ],
                    correct: 0,
                    explanation: 'المساحة الهندسية موجبة دائماً، لذلك نضع القيمة المطلقة |f(x)| داخل التكامل ونضرب في وحدة المساحة u.a = ||i||×||j||.',
                    pitfall: 'نسيان القيمة المطلقة عندما يكون المنحنى تحت محور الأفاصيل (حيث تصبح f(x) < 0 أي |f(x)| = -f(x)) أو نسيان وحدة المساحة cm².'
                },
                {
                    concept: 'الدوال الأصلية الاعتيادية',
                    q: 'الدوال الأصلية للتعبير   u\'(x) / u(x)   على مجال تكون فيه u(x) غير منعدمة هي:',
                    options: [
                        'ln( |u(x)| ) + c',
                        '1 / u²(x) + c',
                        'u(x)·ln(u(x)) + c',
                        'e^{u(x)} + c'
                    ],
                    correct: 0,
                    explanation: 'بما أن مشتقة ln(|u(x)|) هي u\'(x)/u(x)، فإن الدوال الأصلية لـ u\'/u هي ln(|u|) + c.',
                    pitfall: 'نسيان القيمة المطلقة داخل اللوغاريتم عندما تكون u(x) سالبة قطعا على مجال التكامل.'
                }
            ]
        },
        complex_numbers: {
            title: 'الأعداد العقدية والشكل المثلثي والهندسة (2 باك)',
            level: 'الثانية باكالوريا علوم',
            questions: [
                {
                    concept: 'المعيار والشكل المثلثي لعدد عقدي',
                    q: 'ما هو معيار وعمدة العدد العقدي   z = 1 + i √3 ؟',
                    options: [
                        '|z| = 2   و   arg(z) ≡ π/3 [2π]',
                        '|z| = 4   و   arg(z) ≡ π/6 [2π]',
                        '|z| = √2   و   arg(z) ≡ π/4 [2π]',
                        '|z| = 2   و   arg(z) ≡ -π/3 [2π]'
                    ],
                    correct: 0,
                    explanation: '|z| = √(1² + (√3)²) = √4 = 2. بالتعميل بـ 2 نجد z = 2(1/2 + i √3/2) = 2(cos(π/3) + i sin(π/3)).',
                    pitfall: 'نسيان الجذر المربع عند حساب المعيار أو الخلط بين π/3 و π/6.'
                },
                {
                    concept: 'شرط الكتابة على الشكل المثلثي',
                    q: 'هل الكتابة   z = -2 ( cos(π/4) + i sin(π/4) )   تمثل شكلاً مثلثياً مباشراً للعدد z؟',
                    options: [
                        'لا، لأن العدد -2 سالب؛ يجب إدخال الإشارة السالبة باستعمال cos(π + θ) + i sin(π + θ)',
                        'نعم، معياره هو -2 وعمدته π/4',
                        'نعم، يكفي حذف الإشارة السالبة دون تغيير الزاوية',
                        'معياره 2 وعمدته -π/4'
                    ],
                    correct: 0,
                    explanation: 'المعيار r في الشكل المثلثي r(cos θ + i sin θ) يجب أن يكون موجباً قطعا (r > 0). وبما أن -cos θ - i sin θ = cos(θ+π) + i sin(θ+π) فإن العمدة تصبح 5π/4.',
                    pitfall: 'اعتبار العدد السالب المضروب في القوس معياراً للعدد العقدي!'
                },
                {
                    concept: 'المسافة والزاوية الموجهة باستعمال الألحاق',
                    q: 'المسافة AB وقياس الزاوية الموجهة (AB→ , AC→) يرتبطان بالخارج العقدي K = (z_C - z_A) / (z_B - z_A) عبر:',
                    options: [
                        'AC / AB = |K|   و   (AB→ , AC→) ≡ arg(K) [2π]',
                        'AB = |z_A - z_B| فقط ولا علاقة للزاوية بالعمدة',
                        '(AB→ , AC→) ≡ |K|',
                        'K = z_A + z_B + z_C'
                    ],
                    correct: 0,
                    explanation: 'معيار الخارج (z_C - z_A)/(z_B - z_A) يعطي النسبة AC/AB، وعمدته تعطي قياس الزاوية الموجهة (AB→, AC→).',
                    pitfall: 'عكس ترتيب المتجهتين بين البسط والمقام (البدء بالمتجهة الموجودة في المقام دائماً).'
                },
                {
                    concept: 'استقامية ثلاث نقط وتعامد متجهتين',
                    q: 'تكون النقط A و B و C مستقيمية إذا وفقط إذا كان الخارج   (z_C - z_A) / (z_B - z_A) :',
                    options: [
                        'عدداً حقيقياً (ينتمي إلى ℝ)',
                        'عدداً تخيلياً صرفاً (ينتمي إلى iℝ)',
                        'معياره يساوي 1',
                        'يساوي i'
                    ],
                    correct: 0,
                    explanation: 'استقامية النقط تعني أن الزاوية (AB→, AC→) تساوي 0 أو π بترديد 2π، أي أن الخارج عدد حقيقي. أما إذا كان تخيلياً صرفاً فالمستقيمان متعامدان.',
                    pitfall: 'الخلط بين شرط الاستقامية (عدد حقيقي ∈ ℝ) وشرط التعامد (عدد تخيلي صرف ∈ iℝ*).'
                },
                {
                    concept: 'التمثيل العقدي للدوران',
                    q: 'الكتابة العقدية للدوران R الذي مركزه Ω(ω) وزاويته θ هي:',
                    options: [
                        'z\' - ω = e^{iθ} (z - ω)',
                        'z\' = z + ω',
                        'z\' - ω = θ (z - ω)',
                        'z\' = e^{iθ} z'
                    ],
                    correct: 0,
                    explanation: 'صيغة الدوران: z\' - ω = e^{iθ}(z - ω). أما z\' = z + b فهي صيغة الإزاحة، و z\' - ω = k(z - ω) (مع k∈ℝ*) صيغة التحاكي.',
                    pitfall: 'الخلط بين الكتابة العقدية للدوران (ضرب في e^{iθ}) والكتابة العقدية للتحاكي (ضرب في عدد حقيقي k).'
                }
            ]
        }
    };

    const mathQuickQuizState = {
        bankKey: 'tcs_1bac_foundations',
        qIndex: 0,
        selectedOption: null,
        revealed: false,
        timerSeconds: 45,
        timerRemaining: 45,
        timerRunning: false,
        timerInterval: null,
        // Purely diagnostic concept status per question key ("bankKey:qIndex": 'mastered' | 'needs_review')
        diagnosticStatus: {}
    };

    function stopMathQuickQuizTimer() {
        if (mathQuickQuizState.timerInterval) {
            clearInterval(mathQuickQuizState.timerInterval);
            mathQuickQuizState.timerInterval = null;
        }
        mathQuickQuizState.timerRunning = false;
    }

    function openMathQuickQuizModal() {
        let modal = document.getElementById('wbMathQuickQuizModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'wbMathQuickQuizModal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.78);backdrop-filter:blur(5px);z-index:10075;display:flex;align-items:center;justify-content:center;padding:14px;direction:rtl;font-family:"Cairo",sans-serif;';
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        renderMathQuickQuizModalContent();
    }

    function renderMathQuickQuizModalContent() {
        const modal = document.getElementById('wbMathQuickQuizModal');
        if (!modal) return;

        const bank = MATH_PREREQUISITE_QUIZ_BANKS[mathQuickQuizState.bankKey] || MATH_PREREQUISITE_QUIZ_BANKS.tcs_1bac_foundations;
        const questions = bank.questions || [];
        if (mathQuickQuizState.qIndex >= questions.length) mathQuickQuizState.qIndex = 0;
        const currentQ = questions[mathQuickQuizState.qIndex];
        const statusKey = `${mathQuickQuizState.bankKey}:${mathQuickQuizState.qIndex}`;
        const currentDiag = mathQuickQuizState.diagnosticStatus[statusKey] || '';

        const letters = ['أ', 'ب', 'ج', 'د'];
        let masteredCount = 0;
        let reviewCount = 0;
        questions.forEach((_, idx) => {
            const st = mathQuickQuizState.diagnosticStatus[`${mathQuickQuizState.bankKey}:${idx}`];
            if (st === 'mastered') masteredCount++;
            else if (st === 'needs_review') reviewCount++;
        });

        modal.innerHTML = `
            <div style="background:#ffffff;border-radius:16px;max-width:740px;width:100%;max-height:92vh;overflow-y:auto;padding:18px 22px;box-shadow:0 25px 60px rgba(0,0,0,0.4);border:2px solid #f59e0b;">
                <!-- Top Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1.5px solid #fde68a;padding-bottom:10px;margin-bottom:10px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="background:linear-gradient(135deg,#b45309,#d97706);color:#fff;padding:5px 11px;border-radius:8px;font-weight:900;font-size:0.85rem;">⚡ رائز المكتسبات القبلية والتقويم التكويني</span>
                        <span style="background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;padding:3px 10px;border-radius:999px;font-size:0.72rem;font-weight:800;">🎯 تقويم تشخيصي وتكويني غير محتسب في النقط (الرياضيات تعتمد 100% على الفروض المحروسة)</span>
                    </div>
                    <button type="button" id="btnCloseQuickQuizModal" style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:4px 10px;font-size:0.85rem;font-weight:800;color:#475569;cursor:pointer;">✕ إغلاق</button>
                </div>

                <!-- Axis Selector & Timer Bar -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;background:#fffbeb;padding:8px 12px;border-radius:10px;border:1px solid #fde68a;">
                    <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px;">
                        <label style="font-size:0.78rem;font-weight:800;color:#92400e;white-space:nowrap;">📚 المحور الديداكتيكي:</label>
                        <select id="wbQuizBankSelect" style="flex:1;padding:6px 10px;border-radius:8px;border:1.5px solid #f59e0b;font-family:inherit;font-size:0.8rem;font-weight:800;color:#0f172a;background:#fff;">
                            ${Object.keys(MATH_PREREQUISITE_QUIZ_BANKS).map(k => `
                                <option value="${k}" ${k === mathQuickQuizState.bankKey ? 'selected' : ''}>${MATH_PREREQUISITE_QUIZ_BANKS[k].title}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span id="wbQuizTimerDisplay" style="background:#0f172a;color:#fde047;font-family:monospace;font-weight:900;font-size:0.95rem;padding:4px 10px;border-radius:8px;min-width:56px;text-align:center;">${String(Math.floor(mathQuickQuizState.timerRemaining / 60)).padStart(2, '0')}:${String(mathQuickQuizState.timerRemaining % 60).padStart(2, '0')}</span>
                        <button type="button" id="btnToggleQuizTimer" style="background:${mathQuickQuizState.timerRunning ? '#dc2626' : '#0284c7'};color:#fff;border:none;padding:5px 10px;border-radius:7px;font-size:0.74rem;font-weight:800;cursor:pointer;">${mathQuickQuizState.timerRunning ? '⏸ إيقاف' : '▶ عداد'}</button>
                        <button type="button" class="wb-quiz-dur-btn" data-sec="30" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:4px 7px;border-radius:6px;font-size:0.7rem;font-weight:800;cursor:pointer;">30ث</button>
                        <button type="button" class="wb-quiz-dur-btn" data-sec="45" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:4px 7px;border-radius:6px;font-size:0.7rem;font-weight:800;cursor:pointer;">45ث</button>
                        <button type="button" class="wb-quiz-dur-btn" data-sec="60" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:4px 7px;border-radius:6px;font-size:0.7rem;font-weight:800;cursor:pointer;">60ث</button>
                    </div>
                </div>

                <!-- Question Tabs (1..5) + Diagnostic Summary Pill -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${questions.map((qItem, idx) => {
                            const st = mathQuickQuizState.diagnosticStatus[`${mathQuickQuizState.bankKey}:${idx}`];
                            const badgeDot = st === 'mastered' ? '✅ ' : (st === 'needs_review' ? '🛠️ ' : '');
                            const isCurr = idx === mathQuickQuizState.qIndex;
                            return `<button type="button" class="wb-quiz-qtab-btn" data-qidx="${idx}" style="padding:5px 12px;border-radius:8px;border:1.5px solid ${isCurr ? '#d97706' : '#cbd5e1'};background:${isCurr ? '#fef3c7' : '#f8fafc'};color:${isCurr ? '#92400e' : '#334155'};font-weight:800;font-size:0.76rem;cursor:pointer;">${badgeDot}سؤال ${idx + 1}</button>`;
                        }).join('')}
                    </div>
                    <div style="font-size:0.73rem;font-weight:800;color:#475569;display:flex;gap:8px;align-items:center;">
                        <span style="color:#059669;">✅ متحكم فيه: ${masteredCount}</span>
                        <span style="color:#dc2626;">🛠️ يحتاج تذكيراً: ${reviewCount}</span>
                    </div>
                </div>

                <!-- Concept Tag & Question Card -->
                <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;border-radius:12px;padding:14px 16px;margin-bottom:12px;box-shadow:0 6px 18px rgba(15,23,42,0.18);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                        <span style="background:rgba(245,158,11,0.22);border:1px solid #f59e0b;color:#fde68a;padding:2px 10px;border-radius:999px;font-size:0.72rem;font-weight:800;">🎯 المفهوم المستهدف: ${currentQ.concept}</span>
                        <span style="font-size:0.7rem;color:#94a3b8;font-weight:700;">${bank.level}</span>
                    </div>
                    <div style="font-size:1rem;font-weight:900;line-height:1.65;color:#f8fafc;direction:rtl;">${currentQ.q}</div>
                </div>

                <!-- Options Grid -->
                <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:12px;">
                    ${currentQ.options.map((optText, oIdx) => {
                        const isSelected = mathQuickQuizState.selectedOption === oIdx;
                        const isCorrect = oIdx === currentQ.correct;
                        let bg = '#f8fafc';
                        let border = '#cbd5e1';
                        let textCol = '#0f172a';
                        let statusIcon = '';

                        if (mathQuickQuizState.revealed) {
                            if (isCorrect) {
                                bg = '#ecfdf5';
                                border = '#10b981';
                                textCol = '#065f46';
                                statusIcon = '✅ الجواب الصحيح';
                            } else if (isSelected && !isCorrect) {
                                bg = '#fef2f2';
                                border = '#ef4444';
                                textCol = '#991b1b';
                                statusIcon = '❌ اختيار غير صائب';
                            }
                        } else if (isSelected) {
                            bg = '#eff6ff';
                            border = '#2563eb';
                            textCol = '#1e3a8a';
                            statusIcon = '👈 اختيار القسم';
                        }

                        return `
                            <button type="button" class="wb-quiz-opt-btn" data-opt="${oIdx}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:right;padding:10px 14px;border-radius:10px;border:2px solid ${border};background:${bg};color:${textCol};font-family:inherit;font-size:0.84rem;font-weight:800;cursor:pointer;transition:all 0.15s;">
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <span style="width:26px;height:26px;border-radius:7px;background:#e2e8f0;color:#0f172a;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:0.8rem;flex-shrink:0;">${letters[oIdx] || (oIdx + 1)}</span>
                                    <span style="direction:rtl;">${optText}</span>
                                </div>
                                ${statusIcon ? `<span style="font-size:0.72rem;font-weight:900;white-space:nowrap;">${statusIcon}</span>` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Mathematical Justification & Common Pitfall Box (Shown when revealed) -->
                ${mathQuickQuizState.revealed ? `
                    <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
                        <div style="font-size:0.8rem;font-weight:900;color:#166534;margin-bottom:4px;">💡 التعليل الرياضي الدقيق:</div>
                        <div style="font-size:0.79rem;font-weight:700;color:#14532d;line-height:1.55;margin-bottom:6px;">${currentQ.explanation}</div>
                        <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:6px 10px;font-size:0.75rem;font-weight:800;color:#9f1239;">
                            ⚠️ <strong>الخطأ الشائع لدى التلاميذ:</strong> ${currentQ.pitfall}
                        </div>
                    </div>
                ` : ''}

                <!-- Formative Diagnostic Decision (Purely Pedagogical, No Grades) -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:12px;flex-wrap:wrap;">
                    <span style="font-size:0.76rem;font-weight:800;color:#334155;">🩺 تشخيص الأستاذ لدرجة تحكم القسم في هذا المفهوم:</span>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button type="button" id="btnDiagMastered" style="background:${currentDiag === 'mastered' ? '#059669' : '#ecfdf5'};color:${currentDiag === 'mastered' ? '#fff' : '#065f46'};border:1.5px solid #10b981;padding:5px 11px;border-radius:8px;font-size:0.74rem;font-weight:800;cursor:pointer;">✅ مكتسب متحكم فيه جماعياً</button>
                        <button type="button" id="btnDiagNeedsReview" style="background:${currentDiag === 'needs_review' ? '#dc2626' : '#fef2f2'};color:${currentDiag === 'needs_review' ? '#fff' : '#991b1b'};border:1.5px solid #ef4444;padding:5px 11px;border-radius:8px;font-size:0.74rem;font-weight:800;cursor:pointer;">🛠️ يحتاج تذكيراً سريعاً على السبورة</button>
                    </div>
                </div>

                <!-- Bottom Action Buttons -->
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid #e2e8f0;padding-top:10px;flex-wrap:wrap;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button type="button" id="btnRevealQuizAnswer" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:800;font-size:0.79rem;cursor:pointer;">
                            ${mathQuickQuizState.revealed ? '🙈 إخفاء الجواب والتعليل' : '👁️ كشف الجواب والتعليل الرياضي'}
                        </button>
                        <button type="button" id="btnStampQuizToBoard" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:800;font-size:0.79rem;cursor:pointer;">
                            📌 تثبيت السؤال وتعليله على السبورة للشرح
                        </button>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button type="button" id="btnPrevQuizQ" style="background:#f1f5f9;border:1px solid #cbd5e1;color:#334155;padding:6px 12px;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;">▶ السابق</button>
                        <button type="button" id="btnNextQuizQ" style="background:#fef3c7;border:1.5px solid #f59e0b;color:#92400e;padding:6px 14px;border-radius:8px;font-weight:800;font-size:0.78rem;cursor:pointer;">السؤال التالي ◀</button>
                    </div>
                </div>
            </div>
        `;

        // Wire up events
        const closeBtn = document.getElementById('btnCloseQuickQuizModal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                stopMathQuickQuizTimer();
                modal.style.display = 'none';
            };
        }

        const bankSel = document.getElementById('wbQuizBankSelect');
        if (bankSel) {
            bankSel.onchange = () => {
                stopMathQuickQuizTimer();
                mathQuickQuizState.bankKey = bankSel.value;
                mathQuickQuizState.qIndex = 0;
                mathQuickQuizState.selectedOption = null;
                mathQuickQuizState.revealed = false;
                mathQuickQuizState.timerRemaining = mathQuickQuizState.timerSeconds;
                renderMathQuickQuizModalContent();
            };
        }

        modal.querySelectorAll('.wb-quiz-qtab-btn').forEach(btn => {
            btn.onclick = () => {
                stopMathQuickQuizTimer();
                mathQuickQuizState.qIndex = parseInt(btn.getAttribute('data-qidx'), 10) || 0;
                mathQuickQuizState.selectedOption = null;
                mathQuickQuizState.revealed = false;
                mathQuickQuizState.timerRemaining = mathQuickQuizState.timerSeconds;
                renderMathQuickQuizModalContent();
            };
        });

        modal.querySelectorAll('.wb-quiz-opt-btn').forEach(btn => {
            btn.onclick = () => {
                mathQuickQuizState.selectedOption = parseInt(btn.getAttribute('data-opt'), 10);
                mathQuickQuizState.revealed = true;
                stopMathQuickQuizTimer();
                renderMathQuickQuizModalContent();
            };
        });

        modal.querySelectorAll('.wb-quiz-dur-btn').forEach(btn => {
            btn.onclick = () => {
                stopMathQuickQuizTimer();
                const sec = parseInt(btn.getAttribute('data-sec'), 10) || 45;
                mathQuickQuizState.timerSeconds = sec;
                mathQuickQuizState.timerRemaining = sec;
                renderMathQuickQuizModalContent();
            };
        });

        const toggleTimerBtn = document.getElementById('btnToggleQuizTimer');
        if (toggleTimerBtn) {
            toggleTimerBtn.onclick = () => {
                if (mathQuickQuizState.timerRunning) {
                    stopMathQuickQuizTimer();
                    renderMathQuickQuizModalContent();
                } else {
                    if (mathQuickQuizState.timerRemaining <= 0) {
                        mathQuickQuizState.timerRemaining = mathQuickQuizState.timerSeconds;
                    }
                    mathQuickQuizState.timerRunning = true;
                    renderMathQuickQuizModalContent();
                    mathQuickQuizState.timerInterval = setInterval(() => {
                        if (mathQuickQuizState.timerRemaining > 0) {
                            mathQuickQuizState.timerRemaining--;
                            const disp = document.getElementById('wbQuizTimerDisplay');
                            if (disp) {
                                disp.textContent = `${String(Math.floor(mathQuickQuizState.timerRemaining / 60)).padStart(2, '0')}:${String(mathQuickQuizState.timerRemaining % 60).padStart(2, '0')}`;
                            }
                        } else {
                            stopMathQuickQuizTimer();
                            mathQuickQuizState.revealed = true;
                            renderMathQuickQuizModalContent();
                            if (typeof window.showNotification === 'function') {
                                window.showNotification('⏰ انتهى وقت التفكير في السؤال! تم كشف الجواب والتعليل الرياضي للنقاش الجماعي.', 'info');
                            }
                        }
                    }, 1000);
                }
            };
        }

        const revealBtn = document.getElementById('btnRevealQuizAnswer');
        if (revealBtn) {
            revealBtn.onclick = () => {
                mathQuickQuizState.revealed = !mathQuickQuizState.revealed;
                stopMathQuickQuizTimer();
                renderMathQuickQuizModalContent();
            };
        }

        const stampBtn = document.getElementById('btnStampQuizToBoard');
        if (stampBtn) {
            stampBtn.onclick = () => {
                stopMathQuickQuizTimer();
                stampQuizQuestionToBoard(currentQ);
                modal.style.display = 'none';
            };
        }

        const masteredBtn = document.getElementById('btnDiagMastered');
        if (masteredBtn) {
            masteredBtn.onclick = () => {
                mathQuickQuizState.diagnosticStatus[statusKey] = 'mastered';
                renderMathQuickQuizModalContent();
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`✅ تم تسجيل المفهوم "${currentQ.concept}" كمكتسب متحكم فيه جماعياً لدى القسم.`, 'success');
                }
            };
        }

        const reviewBtn = document.getElementById('btnDiagNeedsReview');
        if (reviewBtn) {
            reviewBtn.onclick = () => {
                mathQuickQuizState.diagnosticStatus[statusKey] = 'needs_review';
                renderMathQuickQuizModalContent();
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`🛠️ تم تحديد المفهوم "${currentQ.concept}" كعنصر يحتاج تذكيراً سريعاً على السبورة قبل الشروع في الدرس.`, 'info');
                }
            };
        }

        const prevBtn = document.getElementById('btnPrevQuizQ');
        if (prevBtn) {
            prevBtn.onclick = () => {
                stopMathQuickQuizTimer();
                mathQuickQuizState.qIndex = (mathQuickQuizState.qIndex - 1 + questions.length) % questions.length;
                mathQuickQuizState.selectedOption = null;
                mathQuickQuizState.revealed = false;
                mathQuickQuizState.timerRemaining = mathQuickQuizState.timerSeconds;
                renderMathQuickQuizModalContent();
            };
        }

        const nextBtn = document.getElementById('btnNextQuizQ');
        if (nextBtn) {
            nextBtn.onclick = () => {
                stopMathQuickQuizTimer();
                mathQuickQuizState.qIndex = (mathQuickQuizState.qIndex + 1) % questions.length;
                mathQuickQuizState.selectedOption = null;
                mathQuickQuizState.revealed = false;
                mathQuickQuizState.timerRemaining = mathQuickQuizState.timerSeconds;
                renderMathQuickQuizModalContent();
            };
        }
    }

    function stampQuizQuestionToBoard(questionObj) {
        if (!canvas || !ctx || !questionObj) return;
        saveStateForUndo();
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const cardW = Math.min(620, w - 50);
        const cardH = 195;
        const x0 = Math.max(25, (w - cardW) / 2);
        const y0 = 85;

        const obj = {
            t: 'quiz_card',
            x: x0,
            y: y0,
            w: cardW,
            h: cardH,
            question: questionObj
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📌 تم تثبيت بطاقة السؤال القبلي وتعليله الرياضي على السبورة للشرح!', 'success');
        }
    }

    /**
     * وضع البث الصافي (Zen Broadcast Mode): إخفاء شريط الاستوديو لتوسيع مساحة السبورة أثناء مشاركة الشاشة
     */
    function toggleWhiteboardZenMode(forceState) {
        const bar = document.getElementById('whiteboardRemoteStudioBar');
        const btn = document.getElementById('btnToggleBoardZenMode');
        isZenMode = typeof forceState === 'boolean' ? forceState : !isZenMode;
        if (bar) {
            bar.style.display = isZenMode ? 'none' : 'flex';
        }
        if (btn) {
            btn.style.background = isZenMode ? '#0e7490' : '#ecfeff';
            btn.style.color = isZenMode ? '#ffffff' : '#0e7490';
            btn.style.borderColor = isZenMode ? '#0891b2' : '#67e8f9';
            btn.innerHTML = isZenMode ? '<span>🔙 إظهار الاستوديو</span>' : '<span>📺 بث صافي</span>';
        }
        setTimeout(() => resizeCanvas(true), 60);
        if (typeof window.showNotification === 'function') {
            window.showNotification(isZenMode ? '📺 تم تفعيل وضع البث الصافي لتوسيع مساحة الشرح للطلبة' : '🎓 تم إظهار شريط استوديو الحصة عن بعد', 'info');
        }
    }

    /**
     * تقييم التعابير الرياضية بأمان تام (بدون eval) للحاسبة العلمية العائمة
     */
    let calcDegMode = true;
    let calcExprValue = '';
    let calcLastResult = '';

    function safeEvaluateScientificMath(rawExpr, degMode = true) {
        if (window.WbSecurityMath && typeof window.WbSecurityMath.evaluateMathWithX === 'function') {
            return window.WbSecurityMath.evaluateMathWithX(rawExpr, 0, degMode);
        }
        return NaN;
    }

    /**
     * الحاسبة العلمية العائمة المدمجة للسبورة التفاعلية مع لصق النتيجة على السبورة
     */
    /**
     * وضع السبورة المقسمة (Split-Board Mode: عرض التمرين الثابت بجانب مساحة الحل)
     */
    let isSplitBoardMode = false;
    let splitSnapshotZoom = 1;
    let splitPaneOnLeft = false;

    function toggleWhiteboardSplitMode(forceState) {
        const pane = document.getElementById('whiteboardSplitExercisePane');
        const btn = document.getElementById('btnToggleBoardSplitMode');
        if (!pane) return;

        isSplitBoardMode = typeof forceState === 'boolean' ? forceState : !isSplitBoardMode;
        pane.style.display = isSplitBoardMode ? 'flex' : 'none';

        if (btn) {
            btn.style.background = isSplitBoardMode ? '#1d4ed8' : '#eff6ff';
            btn.style.color = isSplitBoardMode ? '#ffffff' : '#1d4ed8';
            btn.style.borderColor = isSplitBoardMode ? '#1e40af' : '#93c5fd';
            btn.innerHTML = isSplitBoardMode ? '<span>🪟 إغلاق التقسيم</span>' : '<span>🪟 تقسيم السبورة</span>';
        }

        // Resize the 3 canvas layers seamlessly after DOM reflow
        requestAnimationFrame(() => {
            resizeCanvas(true);
            setTimeout(() => resizeCanvas(true), 90);
        });

        if (typeof window.showNotification === 'function') {
            window.showNotification(
                isSplitBoardMode
                    ? '🪟 تم تفعيل وضع السبورة المقسمة: ركن التمرين ثابت أمام التلاميذ بينما تكتب الحل بحرية على السبورة!'
                    : '📐 تم العودة إلى وضع السبورة الكاملة',
                'info'
            );
        }
    }

    function swapWhiteboardSplitSide() {
        const wrapper = document.getElementById('whiteboardWorkspaceWrapper');
        const pane = document.getElementById('whiteboardSplitExercisePane');
        const canvasContainer = document.getElementById('whiteboardCanvasContainer');
        if (!wrapper || !pane || !canvasContainer) return;

        splitPaneOnLeft = !splitPaneOnLeft;
        if (splitPaneOnLeft) {
            wrapper.insertBefore(canvasContainer, pane);
        } else {
            wrapper.insertBefore(pane, canvasContainer);
        }
        requestAnimationFrame(() => resizeCanvas(true));
    }

    function switchWhiteboardSplitTab(tabName) {
        const textBody = document.getElementById('wbSplitTextBody');
        const snapBody = document.getElementById('wbSplitSnapshotBody');
        const btnText = document.getElementById('btnSplitTabText');
        const btnSnap = document.getElementById('btnSplitTabSnapshot');
        const isSnap = tabName === 'snapshot';

        if (textBody) textBody.style.display = isSnap ? 'none' : 'flex';
        if (snapBody) snapBody.style.display = isSnap ? 'flex' : 'none';
        if (btnText) {
            btnText.style.background = isSnap ? '#ffffff' : '#2563eb';
            btnText.style.color = isSnap ? '#1e40af' : '#ffffff';
        }
        if (btnSnap) {
            btnSnap.style.background = isSnap ? '#2563eb' : '#ffffff';
            btnSnap.style.color = isSnap ? '#ffffff' : '#1e40af';
        }
    }

    function pinCurrentBoardToSplitPane() {
        if (!canvas) return;
        if (!isSplitBoardMode) {
            toggleWhiteboardSplitMode(true);
        }
        const comp = createCompositedCanvas();
        const dataUrl = comp.toDataURL('image/png');
        const imgEl = document.getElementById('wbSplitSnapshotImg');
        const lblEl = document.getElementById('wbSplitSnapLabel');
        if (imgEl) {
            imgEl.src = dataUrl;
            splitSnapshotZoom = 1;
            imgEl.style.width = '100%';
            imgEl.style.maxWidth = '100%';
        }
        if (lblEl) {
            lblEl.textContent = isPdfOrWorksheetActive()
                ? `📄 صفحة PDF مثبتة (${currentPdfPageNum}/${pdfTotalPages})`
                : `📸 لقطة سبورة مثبتة (صفحة ${currentPageIndex + 1})`;
        }
        switchWhiteboardSplitTab('snapshot');
        if (typeof window.showNotification === 'function') {
            window.showNotification('📌 تم تثبيت نسخة من الوثيقة/السبورة الحالية في ركن التمرين! يمكنك الآن إضافة صفحة جديدة لحل التمرين.', 'success');
        }
    }

    function zoomSplitSnapshot(delta) {
        const imgEl = document.getElementById('wbSplitSnapshotImg');
        const badge = document.getElementById('wbSplitSnapZoomBadge');
        if (!imgEl) return;
        if (delta === 0) {
            splitSnapshotZoom = 1;
        } else {
            splitSnapshotZoom = Math.max(0.6, Math.min(2.6, Math.round((splitSnapshotZoom + delta) * 10) / 10));
        }
        const pct = Math.round(splitSnapshotZoom * 100);
        imgEl.style.maxWidth = splitSnapshotZoom > 1 ? 'none' : '100%';
        imgEl.style.width = `${pct}%`;
        if (badge) badge.textContent = `${pct}%`;
    }

    function loadSplitExercisePreset(presetKey) {
        const titleEl = document.getElementById('wbSplitExerciseTitle');
        const contentEl = document.getElementById('wbSplitExerciseContent');
        if (!titleEl || !contentEl) return;

        const presets = {
            func_ln: {
                title: 'التمرين 1: دراسة دالة لوغاريتمية (7 نقط)',
                body: `نعتبر الدالة العددية f المعرفة على ]0, +∞[ بما يلي:\nf(x) = x - 1 + ln(x) / x\n\n1) أ- احسب lim(x→0⁺) f(x) وأول النتيجة هندسياً.\n   ب- احسب lim(x→+∞) f(x) وبين أن المستقيم (Δ): y = x - 1 مقارب مائل لـ (Cf).\n2) أ- بين أنه لكل x من ]0, +∞[: f'(x) = (x² + 1 - ln(x)) / x²\n   ب- استنتج أن f تزايدية قطعا على ]0, +∞[ وضع جدول تغيراتها.\n3) أنشئ المقارب (Δ) والمنحنى (Cf) في معلم متعامد ممنظم.`
            },
            seq_rec: {
                title: 'التمرين 2: المتتالية الترجعية uₙ₊₁ = f(uₙ) (4 نقط)',
                body: `نعتبر المتتالية العددية (uₙ) المعرفة بحدها الأول u₀ = 2 ولكل n من ℕ:\nuₙ₊₁ = √(2uₙ + 3)\n\n1) احسب u₁ و u₂.\n2) بين بالترجع أنه لكل n من ℕ:  1 ≤ uₙ ≤ 3.\n3) بين أن المتتالية (uₙ) تزايدية قطعا واستنتج أنها متقاربة.\n4) حدد نهاية المتتالية (uₙ) بحل المعادلة f(x) = x.`
            },
            complex_geo: {
                title: 'التمرين 3: الأعداد العقدية في المستوى العقدي (5 نقط)',
                body: `1) حل في مجموعة الأعداد العقدية ℂ المعادلة:\n   z² - 2√3 z + 4 = 0\n2) نعتبر في المستوى العقدي النقط A و B و C التي ألحاقها:\n   a = √3 + i  و  b = √3 - i  و  c = 2i\n   أ- اكتب العدد العقدي a على الشكل المثلثي.\n   ب- احسب المعيار |a - c| و |b - a| واستنتج طبيعة المثلث ABC.`
            },
            space_sphere: {
                title: 'التمرين 4: الهندسة الفضائية والفلكة (S) (3 نقط)',
                body: `في الفضاء المنسوب إلى معلم متعامد ممنظم مباشر (O, i⃗, j⃗, k⃗)، نعتبر الفلكة (S) التي معادلتها:\nx² + y² + z² - 2x + 4y - 6z + 5 = 0\nوالمستوى (P) ذو المعادلة: x - 2y + 2z - 4 = 0\n\n1) حدد مثلث إحداثيات المركز Ω وشعاع الفلكة R.\n2) احسب المسافة d(Ω, (P)) واستنتج أن المستوى (P) يقطع الفلكة (S) وفق دائرة (C) يتم تحديد مركزها H وشعاعها r.`
            },
            prob_cond: {
                title: 'التمرين 5: الاحتمالات الشرطية وسحب الكرات (3 نقط)',
                body: `يحتوي كيس على 8 كرات لا يمكن التمييز بينها باللمس: 5 كرات حمراء و 3 كرات خضراء.\nنسحب عشوائياً وبالتتابع وبدون إحلال كرتين من الكيس.\nنعتبر الحدثين:\nA: "الكرة الأولى المسحوبة حمراء"\nB: "الكرة الثانية المسحوبة خضراء"\n\n1) أنشئ شجرة الاحتمالات الموافقة لهذه التجربة.\n2) احسب P(A) و P_A(B) ثم استنتج P(A ∩ B).\n3) باستعمال صيغة الاحتمالات الكلية، بين أن P(B) = 3/8.`
            }
        };

        const p = presets[presetKey];
        if (p) {
            titleEl.value = p.title;
            contentEl.value = p.body;
            switchWhiteboardSplitTab('text');
        }
    }

    function stampSplitExerciseToBoard() {
        if (!ctx || !canvas) return;
        const title = (document.getElementById('wbSplitExerciseTitle')?.value || 'تمرين تطبيقي').trim();
        const body = (document.getElementById('wbSplitExerciseContent')?.value || '').trim();
        if (!body) return;

        saveStateForUndo();
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const lines = body.split('\n').filter(Boolean);
        const cardW = Math.min(w - 40, 560);
        const cardH = Math.max(110, 52 + lines.length * 24);
        const obj = {
            t: 'callout',
            x: Math.max(20, w - cardW - 24),
            y: 66,
            w: cardW,
            h: cardH,
            badge: `📋 ${title}`,
            text: body,
            bg: '#eff6ff',
            border: '#2563eb',
            color: '#1e3a8a'
        };
        pushVectorObject(obj);
        drawVectorObjectOnCtx(obj);
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📌 تم ختم نص التمرين على السبورة بنجاح!', 'success');
        }
    }

    function clearAndStartSolutionBoard() {
        addPage();
        insertCurrentLessonHeaderOnBoard();
    }

    /**
     * الحاسبة العلمية العائمة المدمجة + محلل المعادلات والنظمات الفوري
     */
    let calcActiveTab = 'sci'; // 'sci' | 'quad' | 'sys'
    let quadState = { a: '1', b: '-5', c: '6' };
    let sysState = { a1: '2', b1: '1', c1: '7', a2: '1', b2: '-1', c2: '2' };

    function toggleBoardCalculatorWidget(forceState) {
        const host = document.getElementById('whiteboardCanvasContainer') || document.body;
        let widget = document.getElementById('wbScientificCalcWidget');

        if (widget && forceState === false) {
            widget.style.display = 'none';
            return;
        }
        if (widget && forceState !== true && widget.style.display !== 'none') {
            widget.style.display = 'none';
            return;
        }

        if (!widget) {
            widget = document.createElement('div');
            widget.id = 'wbScientificCalcWidget';
            widget.style.cssText = 'position:absolute;top:14px;right:14px;width:305px;background:rgba(15,23,42,0.97);backdrop-filter:blur(10px);border:1.5px solid #6366f1;border-radius:14px;box-shadow:0 16px 38px rgba(15,23,42,0.5);z-index:25;padding:10px;color:#ffffff;font-family:"Cairo",sans-serif;direction:ltr;user-select:none;';
            host.appendChild(widget);
        }

        widget.style.display = 'block';
        renderScientificCalcWidget(widget);
    }

    function solveQuadraticAnalytical(aNum, bNum, cNum) {
        if (window.WbSecurityMath && typeof window.WbSecurityMath.solveQuadraticAnalytical === 'function') {
            return window.WbSecurityMath.solveQuadraticAnalytical(aNum, bNum, cNum);
        }
        return null;
    }

    function solveLinearSystem2x2(a1, b1, c1, a2, b2, c2) {
        if (window.WbSecurityMath && typeof window.WbSecurityMath.solveLinearSystem2x2 === 'function') {
            return window.WbSecurityMath.solveLinearSystem2x2(a1, b1, c1, a2, b2, c2);
        }
        return null;
    }

    function renderScientificCalcWidget(widget) {
        if (!widget) return;

        const tabStyle = (t) => `flex:1;background:${calcActiveTab === t ? '#4f46e5' : '#1e293b'};color:${calcActiveTab === t ? '#fff' : '#94a3b8'};border:1px solid ${calcActiveTab === t ? '#818cf8' : '#334155'};border-radius:6px;padding:3px 4px;font-size:0.68rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;`;

        let bodyHtml = '';
        if (calcActiveTab === 'sci') {
            bodyHtml = `
                <div style="background:#020617;border:1px solid #334155;border-radius:9px;padding:8px 10px;margin-bottom:8px;text-align:right;">
                    <input type="text" id="wbCalcInput" value="${calcExprValue.replace(/"/g, '&quot;')}" placeholder="مثال: sin(30) + √(16)" style="width:100%;background:transparent;border:none;outline:none;color:#e2e8f0;font-family:monospace;font-size:0.9rem;font-weight:700;text-align:left;direction:ltr;box-sizing:border-box;">
                    <div id="wbCalcResultLine" style="font-family:monospace;font-size:1.15rem;font-weight:900;color:#34d399;min-height:22px;margin-top:2px;">${calcLastResult ? '= ' + calcLastResult : ''}</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:7px;">
                    <button type="button" class="wb-calc-key" data-val="sin(" style="background:#1e293b;color:#93c5fd;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">sin</button>
                    <button type="button" class="wb-calc-key" data-val="cos(" style="background:#1e293b;color:#93c5fd;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">cos</button>
                    <button type="button" class="wb-calc-key" data-val="tan(" style="background:#1e293b;color:#93c5fd;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">tan</button>
                    <button type="button" class="wb-calc-key" data-val="ln(" style="background:#1e293b;color:#c4b5fd;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">ln</button>

                    <button type="button" class="wb-calc-key" data-val="log(" style="background:#1e293b;color:#c4b5fd;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">log</button>
                    <button type="button" class="wb-calc-key" data-val="√(" style="background:#1e293b;color:#6ee7b7;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.78rem;font-weight:800;cursor:pointer;">√</button>
                    <button type="button" class="wb-calc-key" data-val="^2" style="background:#1e293b;color:#6ee7b7;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.74rem;font-weight:800;cursor:pointer;">x²</button>
                    <button type="button" class="wb-calc-key" data-val="^" style="background:#1e293b;color:#6ee7b7;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.78rem;font-weight:800;cursor:pointer;">xʸ</button>

                    <button type="button" class="wb-calc-key" data-val="(" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.8rem;font-weight:800;cursor:pointer;">(</button>
                    <button type="button" class="wb-calc-key" data-val=")" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.8rem;font-weight:800;cursor:pointer;">)</button>
                    <button type="button" class="wb-calc-key" data-val="π" style="background:#1e293b;color:#fde047;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.8rem;font-weight:800;cursor:pointer;">π</button>
                    <button type="button" class="wb-calc-key" data-val="e" style="background:#1e293b;color:#fde047;border:1px solid #334155;border-radius:6px;padding:5px 0;font-size:0.8rem;font-weight:800;cursor:pointer;">e</button>

                    <button type="button" class="wb-calc-key" data-val="7" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">7</button>
                    <button type="button" class="wb-calc-key" data-val="8" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">8</button>
                    <button type="button" class="wb-calc-key" data-val="9" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">9</button>
                    <button type="button" class="wb-calc-key" data-val="÷" style="background:#4338ca;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.9rem;font-weight:900;cursor:pointer;">÷</button>

                    <button type="button" class="wb-calc-key" data-val="4" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">4</button>
                    <button type="button" class="wb-calc-key" data-val="5" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">5</button>
                    <button type="button" class="wb-calc-key" data-val="6" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">6</button>
                    <button type="button" class="wb-calc-key" data-val="×" style="background:#4338ca;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.9rem;font-weight:900;cursor:pointer;">×</button>

                    <button type="button" class="wb-calc-key" data-val="1" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">1</button>
                    <button type="button" class="wb-calc-key" data-val="2" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">2</button>
                    <button type="button" class="wb-calc-key" data-val="3" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">3</button>
                    <button type="button" class="wb-calc-key" data-val="-" style="background:#4338ca;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.95rem;font-weight:900;cursor:pointer;">−</button>

                    <button type="button" class="wb-calc-key" data-val="0" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.85rem;font-weight:800;cursor:pointer;">0</button>
                    <button type="button" class="wb-calc-key" data-val="." style="background:#334155;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.95rem;font-weight:900;cursor:pointer;">.</button>
                    <button type="button" id="wbCalcBackBtn" style="background:#7f1d1d;color:#fecaca;border:none;border-radius:6px;padding:6px 0;font-size:0.8rem;font-weight:800;cursor:pointer;">⌫</button>
                    <button type="button" class="wb-calc-key" data-val="+" style="background:#4338ca;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:0.95rem;font-weight:900;cursor:pointer;">+</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:4px;direction:rtl;">
                    <button type="button" id="wbCalcClearBtn" style="background:#991b1b;color:#fff;border:none;border-radius:7px;padding:6px;font-size:0.74rem;font-weight:800;cursor:pointer;">C مسح</button>
                    <button type="button" id="wbCalcEvalBtn" style="background:#059669;color:#fff;border:none;border-radius:7px;padding:6px;font-size:0.88rem;font-weight:900;cursor:pointer;">=</button>
                    <button type="button" id="wbCalcStampBtn" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:7px;padding:6px;font-size:0.72rem;font-weight:800;cursor:pointer;">📌 لصق على السبورة</button>
                </div>
            `;
        } else if (calcActiveTab === 'quad') {
            const qRes = solveQuadraticAnalytical(parseFloat(quadState.a), parseFloat(quadState.b), parseFloat(quadState.c));
            bodyHtml = `
                <div style="direction:rtl;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:0.72rem;color:#93c5fd;font-weight:800;text-align:center;background:#0f172a;padding:4px;border-radius:6px;border:1px solid #334155;">
                        حل المعادلة: <span style="direction:ltr;display:inline-block;font-family:monospace;color:#fde047;">a·x² + b·x + c = 0</span> (في ℝ و ℂ)
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;direction:ltr;">
                        <div>
                            <label style="font-size:0.65rem;color:#cbd5e1;display:block;text-align:center;">a</label>
                            <input type="number" step="any" id="wbQuadA" value="${quadState.a}" style="width:100%;background:#020617;border:1px solid #475569;color:#fff;border-radius:6px;padding:5px;text-align:center;font-weight:800;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.65rem;color:#cbd5e1;display:block;text-align:center;">b</label>
                            <input type="number" step="any" id="wbQuadB" value="${quadState.b}" style="width:100%;background:#020617;border:1px solid #475569;color:#fff;border-radius:6px;padding:5px;text-align:center;font-weight:800;box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.65rem;color:#cbd5e1;display:block;text-align:center;">c</label>
                            <input type="number" step="any" id="wbQuadC" value="${quadState.c}" style="width:100%;background:#020617;border:1px solid #475569;color:#fff;border-radius:6px;padding:5px;text-align:center;font-weight:800;box-sizing:border-box;">
                        </div>
                    </div>
                    <div id="wbQuadResultBox" style="background:#020617;border:1px solid #334155;border-radius:8px;padding:8px;font-size:0.75rem;line-height:1.6;">
                        <div style="font-weight:900;color:#34d399;direction:ltr;text-align:center;">${qRes ? qRes.summary : ''}</div>
                        <div style="font-size:0.68rem;color:#cbd5e1;margin-top:3px;text-align:center;">${qRes && qRes.subSummary ? qRes.subSummary : ''}</div>
                    </div>
                    <button type="button" id="btnStampQuadToBoard" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:8px;padding:7px;font-size:0.74rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📌 ختم خطوات الحل والمميز Δ على السبورة</button>
                </div>
            `;
        } else {
            const sRes = solveLinearSystem2x2(
                parseFloat(sysState.a1), parseFloat(sysState.b1), parseFloat(sysState.c1),
                parseFloat(sysState.a2), parseFloat(sysState.b2), parseFloat(sysState.c2)
            );
            bodyHtml = `
                <div style="direction:rtl;display:flex;flex-direction:column;gap:7px;">
                    <div style="font-size:0.7rem;color:#93c5fd;font-weight:800;text-align:center;background:#0f172a;padding:4px;border-radius:6px;border:1px solid #334155;">
                        حل النظمة: <span style="direction:ltr;display:inline-block;font-family:monospace;color:#fde047;">a₁x + b₁y = c₁  |  a₂x + b₂y = c₂</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;direction:ltr;">
                        <input type="number" step="any" id="wbSysA1" value="${sysState.a1}" placeholder="a₁" style="background:#020617;border:1px solid #475569;color:#fff;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                        <input type="number" step="any" id="wbSysB1" value="${sysState.b1}" placeholder="b₁" style="background:#020617;border:1px solid #475569;color:#fff;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                        <input type="number" step="any" id="wbSysC1" value="${sysState.c1}" placeholder="c₁" style="background:#020617;border:1px solid #facc15;color:#fef08a;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                        <input type="number" step="any" id="wbSysA2" value="${sysState.a2}" placeholder="a₂" style="background:#020617;border:1px solid #475569;color:#fff;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                        <input type="number" step="any" id="wbSysB2" value="${sysState.b2}" placeholder="b₂" style="background:#020617;border:1px solid #475569;color:#fff;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                        <input type="number" step="any" id="wbSysC2" value="${sysState.c2}" placeholder="c₂" style="background:#020617;border:1px solid #facc15;color:#fef08a;border-radius:5px;padding:4px;text-align:center;font-weight:800;width:100%;box-sizing:border-box;">
                    </div>
                    <div style="background:#020617;border:1px solid #334155;border-radius:8px;padding:7px;font-size:0.74rem;line-height:1.5;text-align:center;">
                        <div style="font-weight:900;color:#34d399;direction:ltr;">${sRes.summary}</div>
                        <div style="font-size:0.68rem;color:#cbd5e1;direction:ltr;margin-top:2px;">${sRes.subSummary}</div>
                    </div>
                    <button type="button" id="btnStampSysToBoard" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;border-radius:8px;padding:7px;font-size:0.74rem;font-weight:800;cursor:pointer;font-family:'Cairo',sans-serif;">📌 ختم حل النظمة (طريقة المحددات) على السبورة</button>
                </div>
            `;
        }

        widget.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;direction:rtl;">
                <span style="font-size:0.78rem;font-weight:800;color:#c7d2fe;">🧮 الحاسبة ومحلل المعادلات</span>
                <div style="display:flex;align-items:center;gap:5px;">
                    <button type="button" id="wbCalcDegBtn" style="background:${calcDegMode ? '#4f46e5' : '#334155'};color:#fff;border:1px solid #818cf8;border-radius:5px;padding:1px 6px;font-size:0.65rem;font-weight:800;cursor:pointer;">${calcDegMode ? 'DEG' : 'RAD'}</button>
                    <button type="button" id="wbCalcCloseBtn" style="background:rgba(255,255,255,0.12);border:none;color:#cbd5e1;width:22px;height:22px;border-radius:50%;font-size:0.75rem;cursor:pointer;">✕</button>
                </div>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:8px;direction:rtl;">
                <button type="button" id="wbCalcTabSci" style="${tabStyle('sci')}">🧮 علمية</button>
                <button type="button" id="wbCalcTabQuad" style="${tabStyle('quad')}">📐 معادلة 2°</button>
                <button type="button" id="wbCalcTabSys" style="${tabStyle('sys')}">⚖️ نظمة 2×2</button>
            </div>
            ${bodyHtml}
        `;

        document.getElementById('wbCalcCloseBtn').onclick = () => { widget.style.display = 'none'; };
        document.getElementById('wbCalcDegBtn').onclick = () => {
            calcDegMode = !calcDegMode;
            renderScientificCalcWidget(widget);
        };
        document.getElementById('wbCalcTabSci').onclick = () => { calcActiveTab = 'sci'; renderScientificCalcWidget(widget); };
        document.getElementById('wbCalcTabQuad').onclick = () => { calcActiveTab = 'quad'; renderScientificCalcWidget(widget); };
        document.getElementById('wbCalcTabSys').onclick = () => { calcActiveTab = 'sys'; renderScientificCalcWidget(widget); };

        if (calcActiveTab === 'sci') {
            const inputEl = document.getElementById('wbCalcInput');
            const resEl = document.getElementById('wbCalcResultLine');
            const evaluateNow = () => {
                calcExprValue = (inputEl && inputEl.value) ? inputEl.value.trim() : '';
                const val = safeEvaluateScientificMath(calcExprValue, calcDegMode);
                if (!isNaN(val) && isFinite(val)) {
                    const rounded = Math.round(val * 1000000) / 1000000;
                    calcLastResult = String(rounded);
                    if (resEl) {
                        resEl.style.color = '#34d399';
                        resEl.textContent = '= ' + calcLastResult;
                    }
                } else {
                    calcLastResult = '';
                    if (resEl) {
                        resEl.style.color = '#f87171';
                        resEl.textContent = calcExprValue ? 'خطأ في الصيغة' : '';
                    }
                }
            };

            document.getElementById('wbCalcClearBtn').onclick = () => {
                calcExprValue = '';
                calcLastResult = '';
                if (inputEl) inputEl.value = '';
                if (resEl) resEl.textContent = '';
            };
            document.getElementById('wbCalcBackBtn').onclick = () => {
                if (inputEl) {
                    inputEl.value = inputEl.value.slice(0, -1);
                    calcExprValue = inputEl.value;
                }
            };
            document.getElementById('wbCalcEvalBtn').onclick = evaluateNow;
            document.getElementById('wbCalcStampBtn').onclick = () => {
                evaluateNow();
                if (!calcExprValue || !calcLastResult || !ctx || !canvas) return;
                saveStateForUndo();
                const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
                const textToStamp = `${calcExprValue} = ${calcLastResult}`;
                ctx.save();
                ctx.font = 'bold 18px monospace';
                const tw = ctx.measureText(textToStamp).width + 26;
                ctx.restore();
                const x0 = Math.max(20, (w - tw) / 2);
                const y0 = Math.max(70, Math.floor(h * 0.22));
                const obj = {
                    t: 'calc_result',
                    x: x0,
                    y: y0,
                    w: tw,
                    h: 38,
                    text: textToStamp
                };
                pushVectorObject(obj);
                drawVectorObjectOnCtx(obj);
                persistWhiteboardState();
                if (typeof window.showNotification === 'function') {
                    window.showNotification(`📌 تم لصق الحساب "${textToStamp}" على السبورة`, 'success');
                }
            };

            widget.querySelectorAll('.wb-calc-key').forEach(btn => {
                btn.onclick = () => {
                    const v = btn.getAttribute('data-val') || '';
                    if (inputEl) {
                        inputEl.value += v;
                        calcExprValue = inputEl.value;
                        inputEl.focus();
                    }
                };
            });

            if (inputEl) {
                inputEl.oninput = () => { calcExprValue = inputEl.value; };
                inputEl.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        evaluateNow();
                    } else if (e.key === 'Escape') {
                        widget.style.display = 'none';
                    }
                };
            }
        } else if (calcActiveTab === 'quad') {
            ['A', 'B', 'C'].forEach(k => {
                const el = document.getElementById('wbQuad' + k);
                if (el) {
                    el.oninput = () => {
                        quadState[k.toLowerCase()] = el.value;
                        renderScientificCalcWidget(widget);
                        const ref = document.getElementById('wbQuad' + k);
                        if (ref) { ref.focus(); }
                    };
                }
            });
            const stampBtn = document.getElementById('btnStampQuadToBoard');
            if (stampBtn) {
                stampBtn.onclick = () => {
                    const qRes = solveQuadraticAnalytical(parseFloat(quadState.a), parseFloat(quadState.b), parseFloat(quadState.c));
                    if (!qRes || !qRes.stampBody || !ctx || !canvas) return;
                    saveStateForUndo();
                    const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                    const cardW = Math.min(w - 50, 500);
                    const obj = {
                        t: 'callout',
                        x: Math.floor((w - cardW) / 2),
                        y: 80,
                        w: cardW,
                        h: 125,
                        badge: qRes.stampTitle,
                        text: qRes.stampBody,
                        bg: '#f0fdf4',
                        border: '#059669',
                        color: '#065f46'
                    };
                    pushVectorObject(obj);
                    drawVectorObjectOnCtx(obj);
                    persistWhiteboardState();
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('📌 تم ختم الحل الكامل للمعادلة على السبورة!', 'success');
                    }
                };
            }
        } else if (calcActiveTab === 'sys') {
            ['A1', 'B1', 'C1', 'A2', 'B2', 'C2'].forEach(k => {
                const el = document.getElementById('wbSys' + k);
                if (el) {
                    el.oninput = () => {
                        sysState[k.toLowerCase()] = el.value;
                        renderScientificCalcWidget(widget);
                        const ref = document.getElementById('wbSys' + k);
                        if (ref) { ref.focus(); }
                    };
                }
            });
            const stampSysBtn = document.getElementById('btnStampSysToBoard');
            if (stampSysBtn) {
                stampSysBtn.onclick = () => {
                    const sRes = solveLinearSystem2x2(
                        parseFloat(sysState.a1), parseFloat(sysState.b1), parseFloat(sysState.c1),
                        parseFloat(sysState.a2), parseFloat(sysState.b2), parseFloat(sysState.c2)
                    );
                    if (!sRes || !sRes.stampBody || !ctx || !canvas) return;
                    saveStateForUndo();
                    const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
                    const cardW = Math.min(w - 50, 500);
                    const obj = {
                        t: 'callout',
                        x: Math.floor((w - cardW) / 2),
                        y: 80,
                        w: cardW,
                        h: 130,
                        badge: sRes.stampTitle,
                        text: sRes.stampBody,
                        bg: '#eff6ff',
                        border: '#2563eb',
                        color: '#1e3a8a'
                    };
                    pushVectorObject(obj);
                    drawVectorObjectOnCtx(obj);
                    persistWhiteboardState();
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('📌 تم ختم حل النظمة بطريقة المحددات على السبورة!', 'success');
                    }
                };
            }
        }
    }

    // Window Exports
    window.initDistanceTeaching = initDistanceTeaching;
    window.persistWhiteboardState = persistWhiteboardState;
    window.compressWhiteboardIndexedDB = compressWhiteboardIndexedDB;
    window.replayVectorStrokesToCanvas = replayVectorStrokesToCanvas;
    window.getWhiteboardVectorStrokes = () => ({ pageVectorStrokes, pdfPageVectorStrokes });
    window.getBoardCurrentTool = () => currentTool;
    window.toggleWhiteboardZenMode = toggleWhiteboardZenMode;
    window.toggleWhiteboardSplitMode = toggleWhiteboardSplitMode;
    window.swapWhiteboardSplitSide = swapWhiteboardSplitSide;
    window.switchWhiteboardSplitTab = switchWhiteboardSplitTab;
    window.pinCurrentBoardToSplitPane = pinCurrentBoardToSplitPane;
    window.zoomSplitSnapshot = zoomSplitSnapshot;
    window.loadSplitExercisePreset = loadSplitExercisePreset;
    window.stampSplitExerciseToBoard = stampSplitExerciseToBoard;
    window.clearAndStartSolutionBoard = clearAndStartSolutionBoard;
    window.open3DSolidsStudioModal = open3DSolidsStudioModal;
    window.exportAllWhiteboardPagesToPDF = exportAllWhiteboardPagesToPDF;
    window.toggleBoardCalculatorWidget = toggleBoardCalculatorWidget;
    window.setBoardTool = setTool;
    window.setBoardColor = setColor;
    window.setBoardSize = setSize;
    window.setBoardBg = setBackground;
    window.toggleInteractiveRuler = toggleInteractiveRuler;
    window.toggleInteractiveProtractor = toggleInteractiveProtractor;
    window.toggleInteractiveSetSquare = toggleInteractiveSetSquare;
    window.toggleInteractiveCompass = toggleInteractiveCompass;
    window.openMathFormulaModal = openMathFormulaModal;
    window.stampKaTeXFormulaToCanvas = stampKaTeXFormulaToCanvas;
    window.drawCartesianAxes = drawCartesianAxes;
    window.drawTrigonometricCircle = drawTrigonometricCircle;
    window.drawComplexPlane = drawComplexPlane;
    window.openRecursiveSequenceModal = openRecursiveSequenceModal;
    window.openDidacticCalloutModal = openDidacticCalloutModal;
    window.openMathQuickQuizModal = openMathQuickQuizModal;
    window.stampQuizQuestionToBoard = stampQuizQuestionToBoard;
    window.toggleBoardCurtain = toggleBoardCurtain;
    window.toggleBoardVideoRecorder = toggleBoardVideoRecorder;
    window.openBoardLiveShareModal = openBoardLiveShareModal;
    window.drawMathCurve = drawMathCurve;
    window.openVariationTableModal = openVariationTableModal;
    window.stampVariationTableToCanvas = stampVariationTableToCanvas;
    window.openCustomFunctionPlotterModal = openCustomFunctionPlotterModal;
    window.drawSpaceOrProbTemplate = drawSpaceOrProbTemplate;
    window.drawBlankVariationTableOnBoard = drawBlankVariationTableOnBoard;
    window.insertCurrentLessonHeaderOnBoard = insertCurrentLessonHeaderOnBoard;
    window.openLessonHeaderModal = openLessonHeaderModal;
    window.toggleBoardExerciseTimer = toggleBoardExerciseTimer;
    window.startPauseBoardExerciseTimer = startPauseBoardExerciseTimer;
    window.setBoardExerciseTimerMinutes = setBoardExerciseTimerMinutes;
    window.saveBoardToLessonLog = saveBoardToLessonLog;
    window.insertMathSymbol = insertMathSymbol;
    window.addBoardPage = addPage;
    window.duplicateBoardPage = duplicateBoardPage;
    window.deleteBoardPage = deleteBoardPage;
    window.prevBoardPage = prevPage;
    window.nextBoardPage = nextPage;
    window.undoBoard = undo;
    window.redoBoard = redo;
    window.clearBoard = clearCanvas;
    window.exportBoardImage = exportBoardImage;
    window.printAnnotatedWhiteboardPages = printAnnotatedWhiteboardPages;

    // PDF Import, Sample Worksheet & Navigation Exports
    window.triggerWhiteboardPdfImport = triggerWhiteboardPdfImport;
    window.handleWhiteboardPdfFile = handleWhiteboardPdfFile;
    window.loadSampleMathPdfWorksheet = loadSampleMathPdfWorksheet;
    window.openLibraryPdfForWhiteboard = openLibraryPdfForWhiteboard;
    window.togglePdfThumbnailsSidebar = togglePdfThumbnailsSidebar;
    window.prevPdfPage = prevPdfPage;
    window.nextPdfPage = nextPdfPage;
    window.jumpToPdfPage = jumpToPdfPage;
    window.zoomWhiteboardPdf = zoomWhiteboardPdf;
    window.scrollWhiteboardPdfVertical = scrollWhiteboardPdfVertical;
    window.scrollWhiteboardPdfHorizontal = scrollWhiteboardPdfHorizontal;
    window.setPdfVerticalScrollFromSlider = setPdfVerticalScrollFromSlider;
    window.rotateWhiteboardPdf = rotateWhiteboardPdf;
    window.resetWhiteboardPdfView = resetWhiteboardPdfView;
    window.fitPdfPageWidth = fitPdfPageWidth;
    window.closeWhiteboardPdf = closeWhiteboardPdf;

    // Fullscreen Mode Export
    window.toggleWhiteboardFullscreen = toggleWhiteboardFullscreen;

    // 1. GeoGebra Interactive Integration Exports
    window.openGeoGebraModal = openGeoGebraModal;
    window.stampGeoGebraPlot = stampGeoGebraPlot;

    // 2. Proof Recorder & Step-by-Step Playback Exports
    window.toggleProofRecording = toggleProofRecording;
    window.startProofRecording = startProofRecording;
    window.stopProofRecording = stopProofRecording;
    window.playRecordedProof = playRecordedProof;
    window.pauseRecordedProof = pauseRecordedProof;
    window.resetProofPlayback = resetProofPlayback;
    window.seekProofPlayback = seekProofPlayback;
    window.setProofSpeed = setProofSpeed;
    window.closeProofPlaybackDock = closeProofPlaybackDock;
    window.saveProofToBankModal = saveProofToBankModal;
    window.openProofBankModal = openProofBankModal;
    window.loadBuiltinProof = loadBuiltinProof;
    window.loadSavedProofItem = loadSavedProofItem;
    window.deleteSavedProofItem = deleteSavedProofItem;

    // 3. Homework PDF/Image Student Annotation & Grading Exports
    window.openHomeworkCorrectionModal = openHomeworkCorrectionModal;
    window.loadSampleStudentHomework = loadSampleStudentHomework;
    window.handleStudentHomeworkUpload = handleStudentHomeworkUpload;
    window.toggleHomeworkStampPalette = toggleHomeworkStampPalette;
    window.selectHomeworkStamp = selectHomeworkStamp;
    window.placeHomeworkStamp = placeHomeworkStamp;
    window.stampScoreBadgeModal = stampScoreBadgeModal;
    window.exportCorrectedHomeworkCopy = exportCorrectedHomeworkCopy;
    window.closeHomeworkCorrectionMode = closeHomeworkCorrectionMode;

    // 4. Student Call-up, Bridges & Virtual Blackboard Collaboration Exports
    window.openStudentCallModal = openStudentCallModal;
    window.startStudentCallSession = startStudentCallSession;
    window.setCollabRole = setCollabRole;
    window.toggleStudentPenLock = toggleStudentPenLock;
    window.sendInstantMathGuidance = sendInstantMathGuidance;
    window.awardStudentParticipationPoint = awardStudentParticipationPoint;
    window.endStudentCallSession = endStudentCallSession;
    window.joinWhiteboardCollabRoom = joinWhiteboardCollabRoom;
    window.copyWhiteboardCollabLink = copyWhiteboardCollabLink;

    // 5. Docks, Freehand Pages Drawer & Pedagogical Bridges Exports
    window.toggleLeftToolsDock = toggleLeftToolsDock;
    window.toggleFreehandPagesDrawer = toggleFreehandPagesDrawer;
    window.jumpToFreehandPage = jumpToFreehandPage;
    window.openSaveBoardToLibraryModal = openSaveBoardToLibraryModal;
    window.openAttachBoardToTutoringModal = openAttachBoardToTutoringModal;

})(window);
