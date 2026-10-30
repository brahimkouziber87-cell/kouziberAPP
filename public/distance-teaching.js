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
        radius: 120     // px (approx 6 cm at 20px/cm)
    };

    let exerciseTimerState = {
        secondsLeft: 300,
        running: false,
        intervalId: null
    };

    let cachedProofBaseImg = null;
    let cachedProofBaseSrc = '';

    let activeGeoInteraction = null; // { tool: 'ruler'|'protractor'|'setSquare'|'compass', mode: 'move'|'rotate'|'resize'|'ray'|'compass_arc', startX, startY, origX, origY, origAngle, origLength, origSize, origRadius }
    let laserPointerPos = null;      // Decoupled 120fps laser pointer overlay pos: { x, y }
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
    let collabBroadcastChannel = null;
    try {
        if (typeof window !== 'undefined' && window.BroadcastChannel) {
            collabBroadcastChannel = new BroadcastChannel('math_whiteboard_collab');
        }
    } catch (e) {}

    // Multi-page Whiteboard State (Vector Stroke Serialization + Raster fallback)
    let pageDataUrls = [''];
    let pageVectorStrokes = [[]]; // [{ t: tool, c: color, s: size, pts: [[x,y], ...] }] (~4-8KB per page)
    let pdfPageVectorStrokes = {}; // Map: pageNum -> array of vector strokes
    let currentVectorStroke = null;
    let currentPageIndex = 0;

    // Undo / Redo Stacks (stores dataURLs of the ink canvas with memory optimization)
    let undoStack = [];
    let redoStack = [];
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

                    updateToolbarUI();
                    updatePageIndicator();
                    drawBackground();
                    renderGeometricToolsOverlay();

                    if (!isPdfOrWorksheetActive() && !isDrawing) {
                        if (pageDataUrls[currentPageIndex]) {
                            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
                        } else if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
                            replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
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
            }
            const maxIdleUndo = options.aggressive ? 3 : 6;
            if (undoStack.length > maxIdleUndo) {
                const removed = undoStack.length - maxIdleUndo;
                stats.undoTrimmed += removed;
                undoStack = undoStack.slice(-maxIdleUndo);
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
                    updatedAt: Date.now()
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(lsLightweight));
            } catch (e) {}
        } catch (err) {}

        return stats;
    }

    /**
     * إعادة رسم المسارات المتجهية المحفوظة (Vector Stroke Serialization Replay) بدقة عالية وحجم لا يتجاوز بضعة كيلوبايتات
     */
    function replayVectorStrokesToCanvas(strokesList) {
        if (!ctx || !canvas || !Array.isArray(strokesList) || strokesList.length === 0) return;
        clearInkCanvasInternal();
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

        // Capture current canvas ink if canvas has valid size using WebP for low memory footprint
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
            updatedAt: Date.now()
        };

        // 1. Save full state and multi-page annotations to IndexedDB
        savePayloadToIndexedDB(payload);

        // 2. Fallback lightweight mirror to localStorage (Vector Strokes + active page only)
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
                updatedAt: payload.updatedAt
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lsPayload));
        } catch (e) {}

        flashPersistBadge();
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
            if (restoreAfterResize && activeDataUrl) {
                restoreDataUrlToInkCanvas(activeDataUrl);
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
        }

        targetCtx.restore();
    }

    /**
     * حفظ لقطة قبل الرسم للتراجع (Undo) مع ضغط أمثل لتوفير ذاكرة التخزين RAM
     */
    function saveStateForUndo() {
        if (!ctx || !canvas) return;
        try {
            const snapshot = canvas.toDataURL('image/webp', 0.85);
            undoStack.push(snapshot);
            if (undoStack.length > MAX_HISTORY) undoStack.shift();
            redoStack = [];
        } catch (e) {
            try {
                const snapshot = canvas.toDataURL('image/png');
                undoStack.push(snapshot);
                if (undoStack.length > MAX_HISTORY) undoStack.shift();
                redoStack = [];
            } catch (err) {}
        }
    }

    /**
     * ربط أحداث الفأرة واللمس والتكبير بعجلة الفأرة مع دعم الأدوات الهندسية والحفظ الفوري
     */
    function bindCanvasEvents() {
        let shapeSnapshotImg = null;

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

            // 1. Check if clicking on an interactive geometric tool (Ruler, Protractor, Set Square, Compass)
            const geoHit = hitTestGeometricTools(pos.x, pos.y);
            if (geoHit) {
                if (geoHit.mode === 'close') {
                    if (geoHit.tool === 'ruler') toggleInteractiveRuler(false);
                    if (geoHit.tool === 'protractor') toggleInteractiveProtractor(false);
                    if (geoHit.tool === 'setSquare') toggleInteractiveSetSquare(false);
                    if (geoHit.tool === 'compass') toggleInteractiveCompass(false);
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
                if (geoHit.mode === 'draw_edge' && geoHit.tool === 'ruler') {
                    drawFullRulerEdgeToInk();
                    return;
                }
                const targetState = geoHit.tool === 'ruler' ? rulerState : (geoHit.tool === 'protractor' ? protractorState : (geoHit.tool === 'compass' ? compassState : setSquareState));
                activeGeoInteraction = {
                    tool: geoHit.tool,
                    mode: geoHit.mode,
                    startX: pos.x,
                    startY: pos.y,
                    origX: targetState.x,
                    origY: targetState.y,
                    origAngle: targetState.angle || 0,
                    origLength: targetState.length || 440,
                    origSize: targetState.size || 260,
                    origRadius: targetState.radius || 120,
                    startPointerAngle: Math.atan2(pos.y - targetState.y, pos.x - targetState.x)
                };
                canvas.style.cursor = geoHit.mode === 'rotate' ? 'grabbing' : 'move';
                return;
            }

            if (currentTool === 'pan') {
                isPanning = true;
                panStartX = pos.x - pdfPanOffset.x;
                panStartY = pos.y - pdfPanOffset.y;
                canvas.style.cursor = 'grabbing';
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
                laserPointerPos = { x: pos.x, y: pos.y };
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
            if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
                currentVectorStroke = {
                    t: currentTool,
                    c: strokeColor,
                    s: currentSize,
                    pts: [[qx, qy]]
                };
            } else {
                currentVectorStroke = {
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

            // Active geometric tool transformation (moving, rotating, resizing, measuring angle)
            if (activeGeoInteraction) {
                e.preventDefault();
                const target = activeGeoInteraction.tool === 'ruler' ? rulerState : (activeGeoInteraction.tool === 'protractor' ? protractorState : (activeGeoInteraction.tool === 'compass' ? compassState : setSquareState));
                if (activeGeoInteraction.mode === 'move') {
                    target.x = activeGeoInteraction.origX + (pos.x - activeGeoInteraction.startX);
                    target.y = activeGeoInteraction.origY + (pos.y - activeGeoInteraction.startY);
                } else if (activeGeoInteraction.mode === 'rotate') {
                    const currentPointerAngle = Math.atan2(pos.y - target.y, pos.x - target.x);
                    let newAngle = activeGeoInteraction.origAngle + (currentPointerAngle - activeGeoInteraction.startPointerAngle);
                    // Snap to famous angles unless Shift is held
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
                pdfPanOffset.x = pos.x - panStartX;
                pdfPanOffset.y = pos.y - panStartY;
                drawBackground();
                syncPdfVerticalSliderUI();
                return;
            }

            if (currentTool === 'laser') {
                laserPointerPos = { x: pos.x, y: pos.y };
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
                } else {
                    if (currentTool === 'pan') canvas.style.cursor = 'grab';
                    else if (currentTool === 'text') canvas.style.cursor = 'text';
                    else if (currentTool === 'laser') canvas.style.cursor = 'pointer';
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
                renderGeometricToolsOverlay();
                return;
            }
            if (!isDrawing) return;
            isDrawing = false;
            strokePoints = [];

            if (currentVectorStroke) {
                if (isPdfOrWorksheetActive()) {
                    if (!Array.isArray(pdfPageVectorStrokes[currentPdfPageNum])) {
                        pdfPageVectorStrokes[currentPdfPageNum] = [];
                    }
                    pdfPageVectorStrokes[currentPdfPageNum].push(currentVectorStroke);
                } else {
                    while (pageVectorStrokes.length <= currentPageIndex) {
                        pageVectorStrokes.push([]);
                    }
                    pageVectorStrokes[currentPageIndex].push(currentVectorStroke);
                }
                currentVectorStroke = null;
            }

            if (proofRecording.isRecording && currentRecordedStroke) {
                currentRecordedStroke.endTime = Date.now() - proofRecording.startTime;
                proofRecording.strokes.push(currentRecordedStroke);
                currentRecordedStroke = null;
                updateProofRecordingUI();
            }

            ctx.restore();
            // Solid, non-stuttering persistence only on stroke finish
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

        // Wheel zoom/scroll when PDF is active, or rotate geometric tools when hovering over them
        canvas.addEventListener('wheel', (e) => {
            const pos = getCoords(e);
            const hoverHit = hitTestGeometricTools(pos.x, pos.y);
            if (hoverHit) {
                e.preventDefault();
                const target = hoverHit.tool === 'ruler' ? rulerState : (hoverHit.tool === 'protractor' ? protractorState : setSquareState);
                const stepDeg = e.shiftKey ? 5 : 1;
                const deltaRad = ((e.deltaY < 0 ? stepDeg : -stepDeg) * Math.PI) / 180;
                target.angle += deltaRad;
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
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const step = 40; // 1 وحدة = 40px

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        // 1. شبكة الإحداثيات المتعامدة الخفيفة (Faint Orthonormal Coordinate Grid)
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let x = cx % step; x < w; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = cy % step; y < h; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // 2. المحاور الرئيسية
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = 2.2;
        ctx.font = 'bold 12px "Cairo", sans-serif';

        // محور الأفاصيل (Ox)
        ctx.beginPath();
        ctx.moveTo(25, cy);
        ctx.lineTo(w - 25, cy);
        ctx.stroke();

        // سهم محور الأفاصيل
        ctx.beginPath();
        ctx.moveTo(w - 25, cy);
        ctx.lineTo(w - 38, cy - 6);
        ctx.lineTo(w - 38, cy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('(x)', w - 20, cy - 8);

        // محور الأراتيب (Oy)
        ctx.beginPath();
        ctx.moveTo(cx, h - 25);
        ctx.lineTo(cx, 25);
        ctx.stroke();

        // سهم محور الأراتيب
        ctx.beginPath();
        ctx.moveTo(cx, 25);
        ctx.lineTo(cx - 6, 38);
        ctx.lineTo(cx + 6, 38);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('(y)', cx + 10, 28);

        // 3. تدريجات وأرقام الوحدات
        ctx.lineWidth = 1.4;
        ctx.font = 'bold 10px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // تدريجات الأفاصيل الموجبة والسالبة
        let val = 1;
        for (let x = cx + step; x < w - 45; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, cy - 4);
            ctx.lineTo(x, cy + 4);
            ctx.stroke();
            ctx.fillText(String(val), x, cy + 6);
            val++;
        }
        val = -1;
        for (let x = cx - step; x > 40; x -= step) {
            ctx.beginPath();
            ctx.moveTo(x, cy - 4);
            ctx.lineTo(x, cy + 4);
            ctx.stroke();
            ctx.fillText(String(val), x, cy + 6);
            val--;
        }

        // تدريجات الأراتيب الموجبة والسالبة
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        val = 1;
        for (let y = cy - step; y > 35; y -= step) {
            ctx.beginPath();
            ctx.moveTo(cx - 4, y);
            ctx.lineTo(cx + 4, y);
            ctx.stroke();
            ctx.fillText(String(val), cx - 7, y);
            val++;
        }
        val = -1;
        for (let y = cy + step; y < h - 35; y += step) {
            ctx.beginPath();
            ctx.moveTo(cx - 4, y);
            ctx.lineTo(cx + 4, y);
            ctx.stroke();
            ctx.fillText(String(val), cx - 7, y);
            val--;
        }

        // أصل المعلم O
        ctx.font = 'bold 13px "Cairo", sans-serif';
        ctx.fillText('O', cx - 8, cy + 14);

        // متجهتا الأساس i⃗ (أحمر) و j⃗ (أخضر)
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + step, cy);
        ctx.stroke();
        // سهم i⃗
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(cx + step, cy);
        ctx.lineTo(cx + step - 7, cy - 4);
        ctx.lineTo(cx + step - 7, cy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('i⃗', cx + step / 2, cy - 10);

        ctx.strokeStyle = '#059669';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - step);
        ctx.stroke();
        // سهم j⃗
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.moveTo(cx, cy - step);
        ctx.lineTo(cx - 4, cy - step + 7);
        ctx.lineTo(cx + 4, cy - step + 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillText('j⃗', cx + 18, cy - step / 2);

        ctx.restore();
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
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const R = Math.min(cx, cy) * 0.65;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const isDarkBg = (currentBg === 'green' || currentBg === 'dark');
        const axisColor = (isDarkBg && (currentColor === '#1e3a8a' || currentColor === '#0f172a')) ? '#f8fafc' : currentColor;
        ctx.strokeStyle = axisColor;
        ctx.fillStyle = axisColor;
        ctx.lineWidth = 2;
        ctx.font = 'bold 12px "Cairo", sans-serif';

        ctx.beginPath();
        ctx.moveTo(cx - R - 35, cy);
        ctx.lineTo(cx + R + 35, cy);
        ctx.moveTo(cx, cy + R + 35);
        ctx.lineTo(cx, cy - R - 35);
        ctx.stroke();
        ctx.fillText('cos(x)', cx + R + 8, cy - 8);
        ctx.fillText('sin(x)', cx + 8, cy - R - 15);

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isDarkBg ? '#38bdf8' : '#2563eb';
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.stroke();

        const angles = [
            { rad: 0, label: '0' },
            { rad: Math.PI / 6, label: 'π/6' },
            { rad: Math.PI / 4, label: 'π/4' },
            { rad: Math.PI / 3, label: 'π/3' },
            { rad: Math.PI / 2, label: 'π/2' },
            { rad: (2 * Math.PI) / 3, label: '2π/3' },
            { rad: (3 * Math.PI) / 4, label: '3π/4' },
            { rad: (5 * Math.PI) / 6, label: '5π/6' },
            { rad: Math.PI, label: 'π' }
        ];

        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px sans-serif';
        angles.forEach(a => {
            const px = cx + R * Math.cos(a.rad);
            const py = cy - R * Math.sin(a.rad);

            ctx.beginPath();
            ctx.arc(px, py, 4, 0, 2 * Math.PI);
            ctx.fill();

            const tx = cx + (R + 18) * Math.cos(a.rad);
            const ty = cy - (R + 18) * Math.sin(a.rad);
            ctx.fillText(a.label, tx - 10, ty + 4);
        });

        ctx.restore();
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
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);
        const scale = 40;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        // رسم المقاربات إذا كانت دالة متخاطة أو دالة مقلوب
        if (curveType === 'homographic') {
            // f(x) = (2x - 1) / (x - 1) => المقارب العمودي: x = 1، المقارب الأفقي: y = 2
            const asympX = cx + 1 * scale;
            const asympY = cy - 2 * scale;

            ctx.save();
            ctx.lineWidth = 1.6;
            ctx.setLineDash([5, 4]);

            // مقارب عمودي x = 1 (أحمر)
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(asympX, 20);
            ctx.lineTo(asympX, h - 20);
            ctx.stroke();

            // مقارب أفقي y = 2 (أزرق)
            ctx.strokeStyle = '#2563eb';
            ctx.beginPath();
            ctx.moveTo(20, asympY);
            ctx.lineTo(w - 20, asympY);
            ctx.stroke();

            ctx.font = 'bold 11px "Cairo", sans-serif';
            ctx.fillStyle = '#ef4444';
            ctx.fillText('المقارب العمودي: x = 1', asympX + 8, 40);
            ctx.fillStyle = '#2563eb';
            ctx.fillText('المقارب الأفقي: y = 2', w - 160, asympY - 8);
            ctx.restore();
        }

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = Math.max(2.5, currentSize);
        ctx.beginPath();

        let started = false;
        const xMin = -cx / scale;
        const xMax = (w - cx) / scale;
        const step = 0.04;

        for (let x = xMin; x <= xMax; x += step) {
            let y = null;
            if (curveType === 'parabola') y = x * x;
            else if (curveType === 'homographic') {
                if (Math.abs(x - 1) > 0.12) y = (2 * x - 1) / (x - 1);
            }
            else if (curveType === 'sqrt') { if (x >= 0) y = Math.sqrt(x); }
            else if (curveType === 'inv') { if (Math.abs(x) > 0.08) y = 1 / x; }
            else if (curveType === 'sin') y = Math.sin(x);
            else if (curveType === 'cos') y = Math.cos(x);
            else if (curveType === 'tan') { if (Math.abs(Math.cos(x)) > 0.1) y = Math.tan(x); }
            else if (curveType === 'cube') y = x * x * x;
            else if (curveType === 'abs') y = Math.abs(x);
            else if (curveType === 'ln') { if (x > 0.05) y = Math.log(x); }
            else if (curveType === 'exp') y = Math.exp(x);
            else if (curveType === 'gaussian') y = 2.5 * Math.exp(-x * x);
            else if (curveType === 'tangent') {
                // رسم منحنى شلجم ومماسه عند x = 1: y = 2x - 1
                y = 2 * x - 1;
            }

            if (y !== null && !isNaN(y) && isFinite(y)) {
                const px = cx + x * scale;
                const py = cy - y * scale;
                if (py >= -100 && py <= h + 100) {
                    if (!started) {
                        ctx.moveTo(px, py);
                        started = true;
                    } else {
                        ctx.lineTo(px, py);
                    }
                } else {
                    started = false;
                }
            } else {
                started = false;
            }
        }

        ctx.stroke();

        ctx.font = 'bold 14px "Cairo", sans-serif';
        ctx.fillStyle = currentColor;
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
            tangent: '(T) : y = 2x - 1 (مماس Cf عند النقطة 1)'
        };
        ctx.fillText(labels[curveType] || 'Cf', 60, 60);
        ctx.restore();
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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `bold ${Math.max(24, currentSize * 7)}px "Cairo", serif`;
        ctx.fillStyle = currentColor;
        // Random slight offset around center so multiple symbols don't stack on exact same pixel
        const offsetX = Math.floor((Math.random() - 0.5) * 80);
        const offsetY = Math.floor((Math.random() - 0.5) * 50);
        ctx.fillText(sym, w / 2 - 20 + offsetX, h / 2 + offsetY);
        ctx.restore();
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
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = `bold ${Math.max(17, currentSize * 5)}px "Cairo", sans-serif`;
            ctx.fillStyle = currentColor;
            ctx.fillText(val, x, y + Math.max(14, currentSize * 3));
            ctx.restore();
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
        pdfZoom = 1.0;
        pdfRotation = 0;
        pdfPanOffset = { x: 0, y: 0 };

        activatePdfWorkspaceUI(currentPdfFileName, pdfTotalPages);

        clearInkCanvasInternal();
        undoStack = [];
        redoStack = [];

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
        undoStack = [];
        redoStack = [];

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
        g.fillText('المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة', pageW - 50, 60);
        g.fillStyle = '#1e3a8a';
        g.font = 'bold 13px "Cairo", sans-serif';
        g.fillText('مادة الرياضيات | السلك الثانوي التأهيلي | الأستاذ: إبراهيم قزيبر', pageW - 50, 84);
        g.fillStyle = '#475569';
        g.font = 'bold 12px "Cairo", sans-serif';
        g.fillText(`الفرض المحروس النموذجي رقم 1 - الصفحة ${pageNumber} من 3 (الموسم الدراسي 2026/2027)`, pageW - 50, 108);

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
        const resources = (window.db && (window.db.resources || window.db.library)) || [];
        const pdfResources = Array.isArray(resources)
            ? resources.filter(r => r && ((r.type && r.type.includes('pdf')) || (r.name && r.name.toLowerCase().endsWith('.pdf')) || (r.dataUrl && r.dataUrl.startsWith('data:application/pdf'))))
            : [];

        if (pdfResources.length === 0) {
            // If no PDF is in the digital library yet, offer to load the sample worksheet or open file dialog
            if (typeof window.showNotification === 'function') {
                window.showNotification('لا توجد ملفات PDF مرفوعة في المكتبة حالياً؛ تم فتح نافذة اختيار ملف PDF من جهازك.', 'info');
            }
            triggerWhiteboardPdfImport();
            return;
        }

        // Load the latest PDF resource from the library
        const chosen = pdfResources[0];
        if (chosen.dataUrl) {
            fetch(chosen.dataUrl)
                .then(res => res.arrayBuffer())
                .then(buf => loadPdfFromArrayBuffer(buf, chosen.title || chosen.name || 'ملف_المكتبة.pdf'))
                .catch(() => triggerWhiteboardPdfImport());
        } else {
            triggerWhiteboardPdfImport();
        }
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

            // استعادة شروحات وحلول الأستاذ الخاصة بهذه الصفحة
            if (pdfPageDataUrls[pageNum]) {
                restoreDataUrlToInkCanvas(pdfPageDataUrls[pageNum]);
            } else {
                clearInkCanvasInternal();
            }

            updatePdfUI();
            updatePageIndicator();
            highlightActiveThumbnail(pageNum);

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

    function scrollWhiteboardPdfVertical(deltaY) {
        if (!isPdfOrWorksheetActive()) return;
        const bounds = getPdfVerticalScrollBounds();
        // Positive deltaY means moving down the page (towards bottom -> decrease pdfPanOffset.y)
        pdfPanOffset.y = Math.max(bounds.minOffsetY, Math.min(bounds.maxOffsetY, pdfPanOffset.y - Number(deltaY || 0)));
        drawBackground();
        syncPdfVerticalSliderUI();
    }

    function scrollWhiteboardPdfHorizontal(deltaX) {
        if (!isPdfOrWorksheetActive()) return;
        const w = lastValidWidth || (canvas && parseFloat(canvas.style.width)) || 800;
        const pageW = (pdfRenderPos && pdfRenderPos.width) ? pdfRenderPos.width : w;
        const maxShiftX = Math.max(200, Math.abs(pageW - w) + 120);
        pdfPanOffset.x = Math.max(-maxShiftX, Math.min(maxShiftX, pdfPanOffset.x + Number(deltaX || 0)));
        drawBackground();
    }

    function setPdfVerticalScrollFromSlider(sliderVal) {
        if (!isPdfOrWorksheetActive()) return;
        const pct = Math.max(0, Math.min(100, Number(sliderVal) || 0)) / 100;
        const bounds = getPdfVerticalScrollBounds();
        pdfPanOffset.y = Math.round(bounds.minOffsetY * pct);
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
        restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex] || '');
        updatePageIndicator();

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

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!isContainerVisible()) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            } else if (isPdfOrWorksheetActive() && (e.key === 'ArrowDown' || e.key === 'PageDown')) {
                e.preventDefault();
                scrollWhiteboardPdfVertical(e.key === 'PageDown' ? 260 : 100);
            } else if (isPdfOrWorksheetActive() && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
                e.preventDefault();
                scrollWhiteboardPdfVertical(e.key === 'PageUp' ? -260 : -100);
            } else if (e.key === 'Escape') {
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
    // إدارة صفحات السبورة الاعتيادية (Whiteboard Multi-Pages)
    // ====================================================================

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

        clearInkCanvasInternal();
        drawBackground();
        undoStack = [];
        redoStack = [];
        updatePageIndicator();
        persistWhiteboardState();

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
            if (pageDataUrls[currentPageIndex]) {
                restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
            } else if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
                replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
            } else {
                clearInkCanvasInternal();
            }
            undoStack = [];
            redoStack = [];
            updatePageIndicator();
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
            if (pageDataUrls[currentPageIndex]) {
                restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
            } else if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
                replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
            } else {
                clearInkCanvasInternal();
            }
            undoStack = [];
            redoStack = [];
            updatePageIndicator();
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
        undoStack = [];
        redoStack = [];
        updatePageIndicator();
        persistWhiteboardState();
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
        if (pageDataUrls[currentPageIndex]) {
            restoreDataUrlToInkCanvas(pageDataUrls[currentPageIndex]);
        } else if (Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
            replayVectorStrokesToCanvas(pageVectorStrokes[currentPageIndex]);
        } else {
            clearInkCanvasInternal();
        }
        undoStack = [];
        redoStack = [];
        updatePageIndicator();
        persistWhiteboardState();
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
        if (!isPdfOrWorksheetActive() && Array.isArray(pageVectorStrokes[currentPageIndex]) && pageVectorStrokes[currentPageIndex].length > 0) {
            pageVectorStrokes[currentPageIndex].pop();
        }
        const prevUrl = undoStack.pop();
        restoreDataUrlToInkCanvas(prevUrl, () => {
            persistWhiteboardState();
        });
    }

    function redo() {
        if (redoStack.length === 0 || !canvas) return;
        const currentUrl = canvas.toDataURL('image/webp', 0.85);
        undoStack.push(currentUrl);
        const nextUrl = redoStack.pop();
        restoreDataUrlToInkCanvas(nextUrl, () => {
            persistWhiteboardState();
        });
    }

    /**
     * مسح رسومات الصفحة الحالية فوراً بدون نوافذ منبثقة معطلة، مع إمكانية التراجع (Undo)
     */
    function clearCanvas() {
        if (!ctx || !canvas) return;
        saveStateForUndo();
        clearInkCanvasInternal();

        if (isPdfOrWorksheetActive()) {
            pdfPageDataUrls[currentPdfPageNum] = '';
            pdfPageVectorStrokes[currentPdfPageNum] = [];
            updateThumbnailAnnotationBadge(currentPdfPageNum, false);
        } else {
            pageDataUrls[currentPageIndex] = '';
            pageVectorStrokes[currentPageIndex] = [];
        }

        persistWhiteboardState();

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

    // ====================================================================
    // شريط الأدوات وتغيير الأنماط والألوان والسمك (Toolbar & Customization)
    // ====================================================================

    function setTool(tool) {
        currentTool = tool;
        if (canvas) {
            if (tool === 'pan') canvas.style.cursor = 'grab';
            else if (tool === 'text') canvas.style.cursor = 'text';
            else if (tool === 'laser') canvas.style.cursor = 'pointer';
            else canvas.style.cursor = 'crosshair';
        }
        updateToolbarUI();
        persistWhiteboardState();
    }

    function setColor(color) {
        currentColor = color;
        if (currentTool === 'eraser' || currentTool === 'pan') {
            currentTool = 'pen';
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
            if (currentColor === '#1e3a8a' || currentColor === '#0f172a') {
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
        // 0. Check Compass first (if visible)
        if (compassState.visible) {
            const loc = toLocalToolCoords(px, py, compassState);
            const r = compassState.radius || 120;
            // Close handle at top hinge (r/2, -108)
            if (Math.hypot(loc.x - (r / 2 + 24), loc.y - (-105)) <= 14) {
                return { tool: 'compass', mode: 'close' };
            }
            // Stamp circle button at (r/2, -55)
            if (Math.abs(loc.x - r / 2) <= 46 && Math.abs(loc.y - (-55)) <= 13) {
                return { tool: 'compass', mode: 'stamp_compass_circle' };
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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = Math.max(2, currentSize);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();

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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = Math.max(2, currentSize);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // رسم ضلعي التعامد
        ctx.beginPath();
        ctx.moveTo(hEnd.x, hEnd.y);
        ctx.lineTo(origin.x, origin.y);
        ctx.lineTo(vEnd.x, vEnd.y);
        ctx.stroke();

        // رسم رمز الزاوية القائمة
        ctx.beginPath();
        ctx.moveTo(sq1.x, sq1.y);
        ctx.lineTo(sqCorner.x, sqCorner.y);
        ctx.lineTo(sq2.x, sq2.y);
        ctx.stroke();

        // نقطة دائرية في منتصف رمز التعامد
        const dot = toWorldToolCoords(sqSize / 2, -sqSize / 2, setSquareState);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = Math.max(2, currentSize);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw angle rays
        ctx.beginPath();
        ctx.moveTo(baseEnd.x, baseEnd.y);
        ctx.lineTo(origin.x, origin.y);
        ctx.lineTo(rayEnd.x, rayEnd.y);
        ctx.stroke();

        // Draw angle arc
        ctx.beginPath();
        const startWorldAngle = protractorState.angle - rayRad;
        const endWorldAngle = protractorState.angle;
        ctx.arc(origin.x, origin.y, 34, startWorldAngle, endWorldAngle);
        ctx.stroke();

        // Draw degree label
        const midRad = rayRad / 2;
        const labelPos = toWorldToolCoords(52 * Math.cos(midRad), -52 * Math.sin(midRad), protractorState);
        ctx.font = 'bold 14px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg}°`, labelPos.x, labelPos.y);

        ctx.restore();
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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = Math.max(2, currentSize);
        ctx.lineCap = 'round';

        // رسم الدائرة
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // رسم نقطة المركز O
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // رسم شعاع متقطع خفيف مع القياس
        const px = cx + r * Math.cos(compassState.angle || 0);
        const py = cy + r * Math.sin(compassState.angle || 0);
        ctx.save();
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();

        ctx.font = 'bold 12px "Cairo", sans-serif';
        ctx.fillText(`R = ${rCm} cm`, (cx + px) / 2 - 20, (cy + py) / 2 - 8);

        ctx.restore();
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification(`🧭 تم رسم دائرة بالبركار (الشعاع R = ${rCm} cm)`, 'success');
        }
    }

    /**
     * رسم المسطرة والمنقلة والكوس والبركار ومؤشر الليزر على طبقة الأدوات (#whiteboardToolsCanvas)
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
        if (laserPointerPos) {
            drawLaserPointer(toolsCtx, laserPointerPos.x, laserPointerPos.y);
        }
        if (studentCallState.active && studentCursorPos) {
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
        tCtx.strokeStyle = 'rgba(217, 119, 6, 0.55)';
        tCtx.lineWidth = 1.6;
        tCtx.setLineDash([6, 4]);
        tCtx.beginPath();
        tCtx.arc(0, 0, r, 0, Math.PI * 2);
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

        // Radius badge & Stamp Circle button at (r/2, -55)
        tCtx.fillStyle = '#d97706';
        tCtx.beginPath();
        if (typeof tCtx.roundRect === 'function') {
            tCtx.roundRect(hingeX - 44, -67, 88, 22, 8);
        } else {
            tCtx.rect(hingeX - 44, -67, 88, 22);
        }
        tCtx.fill();
        tCtx.fillStyle = '#ffffff';
        tCtx.font = 'bold 9.5px "Cairo", sans-serif';
        tCtx.fillText(`⭕ رسم (${rCm}cm)`, hingeX, -56);

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

    /* ====================================================================
     * استوديو ومحرر صيغ اللاتخ الرياضية الاحترافي (KaTeX / LaTeX Math Studio Pro)
     * ==================================================================== */
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
        modal.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
        modal.style.backdropFilter = 'blur(6px)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '14px';

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 860px; max-height: 90vh; box-shadow: 0 25px 60px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #6d28d9, #4f46e5); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.35rem; background: rgba(255,255,255,0.2); width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">∑</span>
                        <div>
                            <div style="font-weight: 800; font-size: 1rem;">استوديو محرر صيغ الرياضيات باللاتخ (LaTeX / KaTeX Studio)</div>
                            <div style="font-size: 0.72rem; color: #e0e7ff;">كتابة، معاينة، وتصدير المعادلات الرياضية للسلك الثانوي التأهيلي</div>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('whiteboardMathFormulaModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" title="إغلاق">✕</button>
                </div>

                <!-- Body -->
                <div style="padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; flex: 1;">
                    <!-- Category Tabs for Symbol Palettes -->
                    <div style="display: flex; gap: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; flex-wrap: wrap;">
                        <button type="button" class="wb-latex-tab-btn active" data-cat="analysis" style="background:#ede9fe; color:#6d28d9; border:none; padding:5px 12px; border-radius:7px; font-weight:800; font-size:0.76rem; cursor:pointer;">📈 التحليل والدوال</button>
                        <button type="button" class="wb-latex-tab-btn" data-cat="algebra" style="background:#f1f5f9; color:#475569; border:none; padding:5px 12px; border-radius:7px; font-weight:800; font-size:0.76rem; cursor:pointer;">🧮 الجبر والمنطق والمجموعات</button>
                        <button type="button" class="wb-latex-tab-btn" data-cat="geometry" style="background:#f1f5f9; color:#475569; border:none; padding:5px 12px; border-radius:7px; font-weight:800; font-size:0.76rem; cursor:pointer;">📐 الهندسة والفضاء والمتجهات</button>
                        <button type="button" class="wb-latex-tab-btn" data-cat="complex_prob" style="background:#f1f5f9; color:#475569; border:none; padding:5px 12px; border-radius:7px; font-weight:800; font-size:0.76rem; cursor:pointer;">🎲 العقدية والاحتمالات</button>
                        <button type="button" class="wb-latex-tab-btn" data-cat="theorems" style="background:#f1f5f9; color:#475569; border:none; padding:5px 12px; border-radius:7px; font-weight:800; font-size:0.76rem; cursor:pointer;">📜 مبرهنات المقرر المغربي</button>
                    </div>

                    <!-- Palette 1: Analysis -->
                    <div id="palette_analysis" class="wb-latex-palette" style="display: flex; flex-wrap: wrap; gap: 5px;">
                        <button type="button" class="wb-sym-btn" data-tex="\\frac{a}{b}" title="كسر اعتيادي">a/b كسر</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\sqrt{x}" title="جذر مربع">√x</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\sqrt[n]{x}" title="جذر من الرتبة n">ⁿ√x</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\lim_{x \\to x_0} f(x) = L" title="نهاية في نقطة">lim(x→x₀)</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\lim_{x \\to +\\infty} f(x)" title="نهاية عند +∞">lim(+∞)</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\lim_{x \\to 0^+} \\frac{\\sin(x)}{x} = 1" title="نهاية على اليمين">lim(0⁺)</button>
                        <button type="button" class="wb-sym-btn" data-tex="f'(x)" title="مشتقة أولى">f'(x)</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\frac{df}{dx}" title="مشتقة Leibniz">df/dx</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\int_a^b f(t)\\,dt" title="تكامل محدد">∫ₐᵇ f(t)dt</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\int f(x)\\,dx" title="دالة أصلية">∫ f(x)dx</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\sum_{k=1}^n u_k" title="مجموع حدود">∑ uₖ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\prod_{k=1}^n x_k" title="جداء حدود">∏ xₖ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\ln(x)" title="لوغاريتم نبيري">ln(x)</button>
                        <button type="button" class="wb-sym-btn" data-tex="e^x" title="دالة أسية">eˣ</button>
                        <button type="button" class="wb-sym-btn" data-tex="|x|" title="قيمة مطلقة">|x|</button>
                        <button type="button" class="wb-sym-btn" data-tex="u_{n+1} = f(u_n)" title="متتالية ترجعية">uₙ₊₁=f(uₙ)</button>
                        <button type="button" class="wb-sym-btn" data-tex="(u_n)_{n \\in \\mathbb{N}}" title="متتالية عددية">(uₙ)</button>
                    </div>

                    <!-- Palette 2: Algebra & Logic -->
                    <div id="palette_algebra" class="wb-latex-palette" style="display: none; flex-wrap: wrap; gap: 5px;">
                        <button type="button" class="wb-sym-btn" data-tex="\\forall x \\in \\mathbb{R}" title="مهما يكن">∀x ∈ ℝ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\exists x \\in \\mathbb{R}" title="يوجد على الأقل">∃x ∈ ℝ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\exists! x \\in \\mathbb{R}" title="يوجد عنصر وحيد">∃!x</button>
                        <button type="button" class="wb-sym-btn" data-tex="P \\implies Q" title="استلزام منطقي">P ⟹ Q</button>
                        <button type="button" class="wb-sym-btn" data-tex="P \\iff Q" title="تكافؤ منطقي">P ⟺ Q</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\mathbb{R}" title="مجموعة الأعداد الحقيقية">ℝ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\mathbb{N}" title="مجموعة الأعداد الصحيحة الطبيعية">ℕ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\mathbb{Z}" title="مجموعة الأعداد الصحيحة النسبية">ℤ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\mathbb{Q}" title="مجموعة الأعداد الجذرية">ℚ</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\mathbb{C}" title="مجموعة الأعداد العقدية">ℂ</button>
                        <button type="button" class="wb-sym-btn" data-tex="x \\in E" title="انتماء">x ∈ E</button>
                        <button type="button" class="wb-sym-btn" data-tex="A \\subset B" title="تضمن">A ⊂ B</button>
                        <button type="button" class="wb-sym-btn" data-tex="A \\cap B" title="تقاطع مجموعتين">A ∩ B</button>
                        <button type="button" class="wb-sym-btn" data-tex="A \\cup B" title="اتحاد مجموعتين">A ∪ B</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\emptyset" title="مجموعة فارغة">∅</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\Delta = b^2 - 4ac" title="مميز المعادلة">Δ = b² - 4ac</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\begin{cases} ax + by = c \\\\ a'x + b'y = c' \\end{cases}" title="نظمة معادلتين">نظمة معادلتين</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" title="مصفوفة">مصفوفة</button>
                    </div>

                    <!-- Palette 3: Geometry & Vectors -->
                    <div id="palette_geometry" class="wb-latex-palette" style="display: none; flex-wrap: wrap; gap: 5px;">
                        <button type="button" class="wb-sym-btn" data-tex="\\vec{u}" title="متجهة">u⃗</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\overrightarrow{AB}" title="متجهة بين نقطتين">AB⃗</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\|\\vec{u}\\|" title="منظم متجهة">||u⃗||</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\vec{u} \\cdot \\vec{v}" title="جداء سلمي">u⃗ · v⃗</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\vec{u} \\wedge \\vec{v}" title="جداء متجهي في الفضاء">u⃗ ∧ v⃗</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\det(\\vec{u}, \\vec{v})" title="محددة متجهتين">det(u⃗, v⃗)</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\vec{u} \\perp \\vec{v}" title="تعامد">u⃗ ⊥ v⃗</button>
                        <button type="button" class="wb-sym-btn" data-tex="(D) \\parallel (D')" title="توازي">D ∥ D'</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\widehat{BAC}" title="زاوية هندسية">BAĈ</button>
                        <button type="button" class="wb-sym-btn" data-tex="(\\vec{u}, \\vec{v}) \\equiv \\theta \\ [2\\pi]" title="زاوية موجهة">θ [2π]</button>
                        <button type="button" class="wb-sym-btn" data-tex="(P): ax + by + cz + d = 0" title="معادلة ديكارتية لمستوى">معادلة مستوى (P)</button>
                        <button type="button" class="wb-sym-btn" data-tex="(S): (x-a)^2 + (y-b)^2 + (z-c)^2 = R^2" title="معادلة فلكة">معادلة فلكة (S)</button>
                        <button type="button" class="wb-sym-btn" data-tex="d(\\Omega, (P)) = \\frac{|ax_\\Omega + by_\\Omega + cz_\\Omega + d|}{\\sqrt{a^2 + b^2 + c^2}}" title="مسافة نقطة عن مستوى">مسافة نقطة ومستوى</button>
                    </div>

                    <!-- Palette 4: Complex & Probability -->
                    <div id="palette_complex_prob" class="wb-latex-palette" style="display: none; flex-wrap: wrap; gap: 5px;">
                        <button type="button" class="wb-sym-btn" data-tex="z = a + i b" title="الشكل الجبري">z = a + ib</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\bar{z} = a - i b" title="مرافق عدد عقدي">z̄ مرافق</button>
                        <button type="button" class="wb-sym-btn" data-tex="|z| = \\sqrt{a^2 + b^2}" title="معيار عدد عقدي">|z| معيار</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\arg(z) \\equiv \\theta \\ [2\\pi]" title="عمدة عدد عقدي">arg(z)</button>
                        <button type="button" class="wb-sym-btn" data-tex="z = r e^{i\\theta}" title="شكل أسي">r e^(iθ)</button>
                        <button type="button" class="wb-sym-btn" data-tex="z = r(\\cos\\theta + i\\sin\\theta)" title="شكل مثلثي">الشكل المثلثي</button>
                        <button type="button" class="wb-sym-btn" data-tex="C_n^k = \\frac{n!}{k!(n-k)!}" title="التأليفات التوافقية">Cₙᵏ توافيق</button>
                        <button type="button" class="wb-sym-btn" data-tex="A_n^k = \\frac{n!}{(n-k)!}" title="الترتيبات بدون تكرار">Aₙᵏ ترتيبات</button>
                        <button type="button" class="wb-sym-btn" data-tex="n!" title="عاملي">n!</button>
                        <button type="button" class="wb-sym-btn" data-tex="P(A \\cup B) = P(A) + P(B) - P(A \\cap B)" title="احتمال الاتحاد">P(A ∪ B)</button>
                        <button type="button" class="wb-sym-btn" data-tex="P_B(A) = \\frac{P(A \\cap B)}{P(B)}" title="الاحتمال الشرطي">P_B(A) شرطي</button>
                        <button type="button" class="wb-sym-btn" data-tex="E(X) = \\sum_{i=1}^n x_i P(X = x_i)" title="الأمل الرياضي">E(X) الأمل</button>
                        <button type="button" class="wb-sym-btn" data-tex="V(X) = E(X^2) - (E(X))^2" title="المغايرة">V(X) المغايرة</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\sigma(X) = \\sqrt{V(X)}" title="الانحراف المعياري">σ(X)</button>
                    </div>

                    <!-- Palette 5: Official Moroccan Theorems -->
                    <div id="palette_theorems" class="wb-latex-palette" style="display: none; flex-wrap: wrap; gap: 5px;">
                        <button type="button" class="wb-sym-btn" data-tex="f \\text{ متصلة ورتيبة قطعا على } [a,b] \\implies \\exists! \\alpha \\in ]a,b[: f(\\alpha)=0" title="مبرهنة القيم الوسيطية">TVI القيم الوسيطية</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\lim_{x \\to x_0} \\frac{f(x) - f(x_0)}{x - x_0} = f'(x_0)" title="قابلية الاشتقاق">تعريف الاشتقاق</button>
                        <button type="button" class="wb-sym-btn" data-tex="(T) : y = f'(x_0)(x - x_0) + f(x_0)" title="معادلة المماس">معادلة المماس (T)</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\int_a^b u(t)v'(t)\\,dt = [u(t)v(t)]_a^b - \\int_a^b u'(t)v(t)\\,dt" title="التكامل بالأجزاء">التكامل بالأجزاء</button>
                        <button type="button" class="wb-sym-btn" data-tex="(\\cos\\theta + i\\sin\\theta)^n = \\cos(n\\theta) + i\\sin(n\\theta)" title="مبرهنة دي موافر">صيغة De Moivre</button>
                        <button type="button" class="wb-sym-btn" data-tex="u_n = u_p \\cdot q^{n-p} \\quad \\left(S_n = u_p \\frac{1 - q^{n-p+1}}{1 - q}\\right)" title="المتتالية الهندسية">المتتالية الهندسية العامة</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\frac{z_C - z_A}{z_B - z_A} = r e^{i\\theta} \\implies \\begin{cases} \\frac{AC}{AB} = r \\\\ (\\overrightarrow{AB}, \\overrightarrow{AC}) \\equiv \\theta \\ [2\\pi] \\end{cases}" title="طبيعة المثلث في المستوى العقدي">طبيعة المثلث عقدي</button>
                        <button type="button" class="wb-sym-btn" data-tex="\\vec{n} = \\overrightarrow{AB} \\wedge \\overrightarrow{AC} \\implies (ABC): ax + by + cz + d = 0" title="معادلة مستوى محدد بثلاث نقط">مستوى بـ 3 نقط</button>
                    </div>

                    <!-- LaTeX Input Area -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label for="wbFormulaLatexInput" style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">
                                ✏️ كود الصيغة (LaTeX Code):
                            </label>
                            <span style="font-size: 0.7rem; color: #64748b;">(انقر على أي رمز أعلاه لإدراجه تلقائياً في موضع المؤشر)</span>
                        </div>
                        <textarea id="wbFormulaLatexInput" rows="3" style="width: 100%; direction: ltr; font-family: 'Courier New', monospace; font-size: 0.94rem; font-weight: bold; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; outline: none; resize: vertical; background: #fafafa; color: #0f172a; transition: 0.2s;" placeholder="\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1">\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1</textarea>
                    </div>

                    <!-- Live KaTeX Preview Box -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">
                                👁️ المعاينة البصرية الحية (KaTeX Live Render):
                            </span>
                            <span id="wbFormulaSyntaxBadge" style="font-size: 0.68rem; padding: 2px 8px; border-radius: 5px; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #86efac;">صيغة سليمة ✓</span>
                        </div>
                        <div id="wbFormulaPreviewBox" style="min-height: 85px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 14px 18px; font-size: 1.4rem; overflow-x: auto; box-shadow: inset 0 2px 4px rgba(0,0,0,0.03);"></div>
                    </div>

                    <!-- Customization Controls: Size & Color & Mode -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: #f8fafc; padding: 8px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <!-- Font Size -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.78rem; font-weight: 800; color: #334155;">حجم الرندرة:</span>
                            <select id="wbFormulaFontSize" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 0.78rem; background: #fff; cursor: pointer;">
                                <option value="20">صغير (20px)</option>
                                <option value="28" selected>متوسط قياسي (28px)</option>
                                <option value="36">كبير بوضوح (36px)</option>
                                <option value="46">عريض جداً للسبورة (46px)</option>
                            </select>
                        </div>

                        <!-- Display Mode Toggle -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.78rem; font-weight: 800; color: #334155;">نمط العرض:</span>
                            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; font-weight: 700; color: #475569; cursor: pointer;">
                                <input type="checkbox" id="wbFormulaDisplayMode" checked style="accent-color: #6d28d9; cursor: pointer;">
                                <span>نمط بارز مستقل (Display Mode)</span>
                            </label>
                        </div>

                        <!-- Color Picker -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-size: 0.78rem; font-weight: 800; color: #334155;">اللون:</span>
                            <button type="button" class="wb-f-clr" data-clr="#1e3a8a" style="width: 20px; height: 20px; border-radius: 50%; background: #1e3a8a; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="أزرق"></button>
                            <button type="button" class="wb-f-clr" data-clr="#dc2626" style="width: 20px; height: 20px; border-radius: 50%; background: #dc2626; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="أحمر"></button>
                            <button type="button" class="wb-f-clr" data-clr="#16a34a" style="width: 20px; height: 20px; border-radius: 50%; background: #16a34a; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="أخضر"></button>
                            <button type="button" class="wb-f-clr" data-clr="#7c3aed" style="width: 20px; height: 20px; border-radius: 50%; background: #7c3aed; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="بنفسجي"></button>
                            <button type="button" class="wb-f-clr" data-clr="#0f172a" style="width: 20px; height: 20px; border-radius: 50%; background: #0f172a; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="أسود"></button>
                            <input type="color" id="wbFormulaColor" value="#1e3a8a" style="width: 24px; height: 24px; border: none; cursor: pointer; border-radius: 4px; background: transparent;" title="لون مخصص">
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-wrap: wrap; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button type="button" id="btnCopyLatexCode" class="btn-secondary" style="padding: 7px 14px; font-size: 0.78rem; font-weight: 800; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                            <span>📋 نسخ كود LaTeX</span>
                        </button>
                        <button type="button" id="btnDownloadLatexPng" class="btn-secondary" style="padding: 7px 14px; font-size: 0.78rem; font-weight: 800; background: #ffffff; border: 1px solid #93c5fd; color: #0284c7; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;" title="تحميل الصيغة كصورة شفافة عالية الدقة لوضعها في امتحانات أو وثائق وورد">
                            <span>💾 تحميل صورة شفافة (PNG)</span>
                        </button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="document.getElementById('whiteboardMathFormulaModal').style.display='none'" class="btn-secondary" style="padding: 7px 16px; font-size: 0.8rem; font-weight: 700; border-radius: 8px;">إلغاء</button>
                        <button type="button" id="btnInsertFormulaToBoard" class="btn-primary" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; border: none; padding: 7px 22px; font-size: 0.84rem; font-weight: 800; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(109,40,217,0.3); display: inline-flex; align-items: center; gap: 6px;">
                            <span>➕ إدراج على السبورة التفاعلية</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Styling for palette buttons
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .wb-sym-btn {
                background: #f8fafc;
                border: 1px solid #cbd5e1;
                color: #1e293b;
                padding: 4px 9px;
                border-radius: 6px;
                font-size: 0.74rem;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.15s ease;
                font-family: 'Cairo', 'KaTeX_Main', serif;
            }
            .wb-sym-btn:hover {
                background: #ede9fe;
                border-color: #a7f3d0;
                color: #6d28d9;
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(styleEl);

        const input = document.getElementById('wbFormulaLatexInput');
        const previewBox = document.getElementById('wbFormulaPreviewBox');
        const colorInput = document.getElementById('wbFormulaColor');
        const sizeSelect = document.getElementById('wbFormulaFontSize');
        const displayModeCheckbox = document.getElementById('wbFormulaDisplayMode');
        const syntaxBadge = document.getElementById('wbFormulaSyntaxBadge');
        const insertBtn = document.getElementById('btnInsertFormulaToBoard');
        const copyBtn = document.getElementById('btnCopyLatexCode');
        const downloadPngBtn = document.getElementById('btnDownloadLatexPng');

        function renderFormulaPreview() {
            const tex = input.value.trim();
            const color = colorInput.value;
            const isDisplay = displayModeCheckbox ? displayModeCheckbox.checked : true;
            previewBox.style.color = color;

            if (!tex) {
                previewBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem; font-weight: 700;">اكتب صيغة رياضية أو اختر رمزا من اللوحات أعلاه للمعاينة...</span>';
                if (syntaxBadge) {
                    syntaxBadge.textContent = 'بانتظار الإدخال';
                    syntaxBadge.style.background = '#f1f5f9';
                    syntaxBadge.style.color = '#64748b';
                    syntaxBadge.style.borderColor = '#cbd5e1';
                }
                return;
            }

            if (window.katex && typeof window.katex.renderToString === 'function') {
                try {
                    const html = window.katex.renderToString(tex, {
                        displayMode: isDisplay,
                        throwOnError: true
                    });
                    previewBox.innerHTML = html;
                    if (syntaxBadge) {
                        syntaxBadge.textContent = 'صيغة سليمة ✓';
                        syntaxBadge.style.background = '#dcfce7';
                        syntaxBadge.style.color = '#15803d';
                        syntaxBadge.style.borderColor = '#86efac';
                    }
                    return;
                } catch (e) {
                    // Try soft render without throwing
                    try {
                        previewBox.innerHTML = window.katex.renderToString(tex, { displayMode: isDisplay, throwOnError: false });
                        if (syntaxBadge) {
                            syntaxBadge.textContent = 'تنبيه في التركيب ⚠️';
                            syntaxBadge.style.background = '#fef3c7';
                            syntaxBadge.style.color = '#b45309';
                            syntaxBadge.style.borderColor = '#fcd34d';
                        }
                        return;
                    } catch (e2) {}
                }
            }
            previewBox.textContent = tex;
        }

        input._renderPreview = renderFormulaPreview;
        input.addEventListener('input', renderFormulaPreview);
        colorInput.addEventListener('input', renderFormulaPreview);
        sizeSelect.addEventListener('change', renderFormulaPreview);
        if (displayModeCheckbox) displayModeCheckbox.addEventListener('change', renderFormulaPreview);

        // Category Tab Switchers
        modal.querySelectorAll('.wb-latex-tab-btn').forEach(tabBtn => {
            tabBtn.addEventListener('click', function () {
                modal.querySelectorAll('.wb-latex-tab-btn').forEach(b => {
                    b.style.background = '#f1f5f9';
                    b.style.color = '#475569';
                    b.classList.remove('active');
                });
                this.style.background = '#ede9fe';
                this.style.color = '#6d28d9';
                this.classList.add('active');

                const targetCat = this.getAttribute('data-cat');
                modal.querySelectorAll('.wb-latex-palette').forEach(p => {
                    p.style.display = 'none';
                });
                const activePalette = document.getElementById(`palette_${targetCat}`);
                if (activePalette) activePalette.style.display = 'flex';
            });
        });

        // Quick Symbol Insertion into Textarea
        modal.querySelectorAll('.wb-sym-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const texToAdd = this.getAttribute('data-tex');
                if (!texToAdd) return;
                insertTextIntoTextarea(input, texToAdd);
                renderFormulaPreview();
            });
        });

        // Color Palette Shortcuts
        modal.querySelectorAll('.wb-f-clr').forEach(btn => {
            btn.addEventListener('click', function () {
                const clr = this.getAttribute('data-clr');
                if (clr) {
                    colorInput.value = clr;
                    renderFormulaPreview();
                }
            });
        });

        // Insert into Whiteboard
        insertBtn.addEventListener('click', () => {
            const tex = input.value.trim();
            if (!tex) {
                if (typeof window.showNotification === 'function') {
                    window.showNotification('يرجى كتابة صيغة رياضية أولاً', 'warning');
                }
                return;
            }
            const color = colorInput.value;
            const size = parseInt(sizeSelect.value, 10) || 28;
            stampKaTeXFormulaToCanvas(tex, color, size);
            modal.style.display = 'none';
        });

        // Copy LaTeX Code
        copyBtn.addEventListener('click', () => {
            const tex = input.value.trim();
            if (!tex) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(tex).then(() => {
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('📋 تم نسخ كود LaTeX إلى الحافظة بنجاح!', 'success');
                    }
                });
            } else {
                input.select();
                document.execCommand('copy');
                if (typeof window.showNotification === 'function') {
                    window.showNotification('📋 تم نسخ كود LaTeX!', 'success');
                }
            }
        });

        // Download as Transparent PNG
        downloadPngBtn.addEventListener('click', () => {
            const tex = input.value.trim();
            if (!tex) return;
            if (window.html2canvas && previewBox) {
                window.html2canvas(previewBox, {
                    backgroundColor: null,
                    scale: 3
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `formule_math_${Date.now()}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    if (typeof window.showNotification === 'function') {
                        window.showNotification('💾 تم تحميل الصيغة الرياضية كصورة شفافة عالية الدقة!', 'success');
                    }
                }).catch(() => {
                    exportFormulaSvgAsPng(tex, colorInput.value, parseInt(sizeSelect.value, 10) || 28);
                });
            } else {
                exportFormulaSvgAsPng(tex, colorInput.value, parseInt(sizeSelect.value, 10) || 28);
            }
        });

        renderFormulaPreview();
    }

    function insertTextIntoTextarea(textarea, textToInsert) {
        if (!textarea) return;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const oldVal = textarea.value;
        const newVal = oldVal.substring(0, start) + (start > 0 && oldVal[start - 1] !== ' ' && oldVal[start - 1] !== '\n' ? ' ' : '') + textToInsert + ' ' + oldVal.substring(end);
        textarea.value = newVal;
        const newCursorPos = start + textToInsert.length + 1;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }

    function exportFormulaSvgAsPng(latex, color, fontSize) {
        if (!window.katex || typeof window.katex.renderToString !== 'function') return;
        try {
            const mathHtml = window.katex.renderToString(latex, { displayMode: true, throwOnError: false });
            const svgW = 800;
            const svgH = 180;
            const svgString = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
                    <foreignObject width="100%" height="100%">
                        <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fontSize || 28}px; color:${color || '#1e3a8a'}; display:flex; align-items:center; justify-content:center; height:100%; font-family:'KaTeX_Main', serif;">
                            ${mathHtml}
                        </div>
                    </foreignObject>
                </svg>
            `;
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = function () {
                const c = document.createElement('canvas');
                c.width = svgW;
                c.height = svgH;
                const cCtx = c.getContext('2d');
                if (cCtx) {
                    cCtx.drawImage(img, 0, 0);
                    const link = document.createElement('a');
                    link.download = `formule_math_${Date.now()}.png`;
                    link.href = c.toDataURL('image/png');
                    link.click();
                }
                URL.revokeObjectURL(url);
            };
            img.src = url;
        } catch (e) {}
    }

    function stampKaTeXFormulaToCanvas(latex, color, fontSize, targetX, targetY) {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;
        const posX = targetX !== undefined ? targetX : w / 2;
        const posY = targetY !== undefined ? targetY : h / 2;
        const clr = color || currentColor;
        const fSize = fontSize || 28;

        const previewBox = document.getElementById('wbFormulaPreviewBox');
        if (window.html2canvas && previewBox && previewBox.innerHTML.trim().length > 0) {
            window.html2canvas(previewBox, {
                backgroundColor: null,
                scale: 2
            }).then(renderedCanvas => {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                const drawW = Math.min(renderedCanvas.width / 2, w * 0.85);
                const drawH = (renderedCanvas.height / renderedCanvas.width) * drawW;
                ctx.drawImage(renderedCanvas, posX - drawW / 2, posY - drawH / 2, drawW, drawH);
                ctx.restore();
                persistWhiteboardState();

                if (typeof window.showNotification === 'function') {
                    window.showNotification('✨ تم إدراج الصيغة الرياضية عالية الدقة على السبورة بنجاح!', 'success');
                }
            }).catch(() => {
                fallbackSvgStampKaTeX(latex, clr, fSize, posX, posY, w, h);
            });
            return;
        }

        fallbackSvgStampKaTeX(latex, clr, fSize, posX, posY, w, h);
    }

    function fallbackSvgStampKaTeX(latex, clr, fSize, posX, posY, w, h) {
        if (window.katex && typeof window.katex.renderToString === 'function') {
            try {
                const mathHtml = window.katex.renderToString(latex, { displayMode: true, throwOnError: false });
                const svgW = 760;
                const svgH = 160;
                const svgString = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">
                        <foreignObject width="100%" height="100%">
                            <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${fSize}px; color:${clr}; display:flex; align-items:center; justify-content:center; height:100%; font-family:'KaTeX_Main', serif;">
                                ${mathHtml}
                            </div>
                        </foreignObject>
                    </svg>
                `;
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = function () {
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(img, posX - 190, posY - 40, 380, 80);
                    ctx.restore();
                    URL.revokeObjectURL(url);
                    persistWhiteboardState();
                };
                img.src = url;

                if (typeof window.showNotification === 'function') {
                    window.showNotification('✨ تم إدراج الصيغة الرياضية على السبورة!', 'success');
                }
                return;
            } catch (err) {}
        }

        // Fallback: Unicode text drawing
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `bold ${fSize}px "Cairo", serif`;
        ctx.fillStyle = clr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(latex, posX, posY);
        ctx.restore();
        persistWhiteboardState();
    }

    /* ====================================================================
     * استوديو برمجية جيوجبرا التفاعلية للرياضيات (GeoGebra Dynamic Math Studio Pro)
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
        modal.style.backgroundColor = 'rgba(15, 23, 42, 0.78)';
        modal.style.backdropFilter = 'blur(6px)';
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.padding = '12px';

        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 1060px; height: 88vh; box-shadow: 0 25px 60px rgba(0,0,0,0.35); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.35rem; background: rgba(255,255,255,0.2); width: 34px; height: 34px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center;">🌐</span>
                        <div>
                            <div style="font-weight: 800; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                                <span>استوديو برمجية جيوجبرا الديناميكية (GeoGebra Math Studio)</span>
                                <span style="background: rgba(255,255,255,0.22); font-size: 0.68rem; padding: 1px 8px; border-radius: 5px; font-weight: 800;">السلك الثانوي التأهيلي</span>
                            </div>
                            <div style="font-size: 0.7rem; color: #dbeafe;">رسم المنحنيات، الهندسة المستوية والفضائية 3D، ومحاكيات الامتحانات الوطنية</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" id="btnWbGeoGebraStamp" style="background: #059669; border: none; color: #fff; padding: 6px 14px; border-radius: 7px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 6px rgba(5,150,105,0.3); transition: 0.2s;">
                            <span>📸 إدراج المعلم والمنحنى في السبورة</span>
                        </button>
                        <button type="button" id="btnWbGeoGebraFullscreen" style="background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 6px 10px; border-radius: 7px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="ملء الشاشة">
                            <span>⛶ تكبير</span>
                        </button>
                        <button type="button" onclick="document.getElementById('whiteboardGeoGebraModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" title="إغلاق">✕</button>
                    </div>
                </div>

                <!-- Apps Switcher & Curriculum Selector Bar -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 8px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                    <!-- GeoGebra Core Modes -->
                    <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                        <span style="font-size: 0.74rem; font-weight: 800; color: #475569;">الأوضاع التفاعلية:</span>
                        <button type="button" class="wb-ggb-mode-btn active" data-url="https://www.geogebra.org/graphing?embed" style="background:#2563eb; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.73rem; font-weight:800; cursor:pointer;">📈 رسم الدوال (Graphing)</button>
                        <button type="button" class="wb-ggb-mode-btn" data-url="https://www.geogebra.org/geometry?embed" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:4px 10px; border-radius:6px; font-size:0.73rem; font-weight:800; cursor:pointer;">📐 هندسة مستوية (Geometry)</button>
                        <button type="button" class="wb-ggb-mode-btn" data-url="https://www.geogebra.org/3d?embed" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:4px 10px; border-radius:6px; font-size:0.73rem; font-weight:800; cursor:pointer;">🧊 هندسة فضائية 3D</button>
                        <button type="button" class="wb-ggb-mode-btn" data-url="https://www.geogebra.org/classic?embed" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:4px 10px; border-radius:6px; font-size:0.73rem; font-weight:800; cursor:pointer;">🧮 كلاسيك / CAS</button>
                    </div>

                    <!-- Moroccan Secondary Math Curated Applets Dropdown -->
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 0.74rem; font-weight: 800; color: #1e3a8a;">🎓 محاكيات المقرر المغربي:</span>
                        <select id="wbGeoGebraCurriculumSelect" style="padding: 4px 10px; border-radius: 7px; border: 1.5px solid #93c5fd; background: #eff6ff; color: #1e40af; font-size: 0.74rem; font-weight: 800; outline: none; cursor: pointer;">
                            <option value="">-- اختر محاكاة تفاعلية للدرس --</option>
                            <option value="https://www.geogebra.org/m/c8zvwzrk">النهايات والاتصال ومبرهنة القيم الوسيطية (2BAC SM/PC)</option>
                            <option value="https://www.geogebra.org/m/mkvkud6x">دراسة الدوال والمماسات والفروع اللانهائية (2BAC)</option>
                            <option value="https://www.geogebra.org/m/WqX7pS8r">الحساب التكاملي وحساب مساحات الحيز (2BAC)</option>
                            <option value="https://www.geogebra.org/m/f2y4xwqj">الأعداد العقدية والتحويلات النقطية (2BAC SM)</option>
                            <option value="https://www.geogebra.org/m/nss32q4z">المتتاليات العددية وسلوك التقارب بالسلم Cobweb (1BAC/2BAC)</option>
                            <option value="https://www.geogebra.org/m/bqk77e9g">الهندسة الفضائية 3D: معادلة الفلكة والمستوى (2BAC PC)</option>
                            <option value="https://www.geogebra.org/m/j4xydrq4">الدائرة المثلثية والأفاصيل المنحنية (TCS / 1BAC)</option>
                        </select>
                    </div>
                </div>

                <!-- Quick Presets for Instant Stamping to Whiteboard -->
                <div style="display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: #ffffff; border-bottom: 1px solid #e2e8f0; overflow-x: auto; flex-wrap: nowrap;">
                    <span style="font-size: 0.72rem; font-weight: 800; color: #475569; white-space: nowrap;">⚡ نماذج مباشرة للسبورة:</span>
                    <button type="button" class="wb-ggb-preset-btn" data-type="homographic" style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">متخاطة ومقاربات f(x)=(2x-1)/(x-1)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="ln" style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">دالة اللوغاريتم ln(x)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="exp" style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">الدالة الأسية exp(x)</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="tangent" style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">مماس المنحنى ومعادلته</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="circle" style="background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">الدائرة المثلثية مع الزوايا</button>
                    <button type="button" class="wb-ggb-preset-btn" data-type="sphere3d" style="background:#faf5ff; border:1px solid #e9d5ff; color:#7e22ce; padding:3px 8px; border-radius:5px; font-size:0.71rem; font-weight:700; cursor:pointer; white-space:nowrap;">فلكة ومستوى في الفضاء</button>
                </div>

                <!-- GeoGebra Embed Frame -->
                <div id="wbGeoGebraContainer" style="flex: 1; position: relative; background: #ffffff;">
                    <iframe id="wbGeoGebraIframe" src="https://www.geogebra.org/graphing?embed" style="width: 100%; height: 100%; border: none; display: block;" allow="fullscreen; autoplay"></iframe>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const iframe = document.getElementById('wbGeoGebraIframe');
        const curriculumSelect = document.getElementById('wbGeoGebraCurriculumSelect');
        const stampBtn = document.getElementById('btnWbGeoGebraStamp');
        const fsBtn = document.getElementById('btnWbGeoGebraFullscreen');

        // Mode Switching (Graphing, Geometry, 3D, CAS)
        modal.querySelectorAll('.wb-ggb-mode-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                modal.querySelectorAll('.wb-ggb-mode-btn').forEach(b => {
                    b.style.background = '#eff6ff';
                    b.style.color = '#1d4ed8';
                    b.style.border = '1px solid #bfdbfe';
                    b.classList.remove('active');
                });
                this.style.background = '#2563eb';
                this.style.color = '#ffffff';
                this.style.border = 'none';
                this.classList.add('active');

                if (curriculumSelect) curriculumSelect.value = '';
                const targetUrl = this.getAttribute('data-url');
                if (iframe && targetUrl) iframe.src = targetUrl;
            });
        });

        // Curriculum Applet Selection
        if (curriculumSelect) {
            curriculumSelect.addEventListener('change', function () {
                if (!this.value) return;
                modal.querySelectorAll('.wb-ggb-mode-btn').forEach(b => {
                    b.style.background = '#eff6ff';
                    b.style.color = '#1d4ed8';
                    b.style.border = '1px solid #bfdbfe';
                    b.classList.remove('active');
                });
                if (iframe) iframe.src = this.value;
            });
        }

        // Fullscreen Toggle for GeoGebra inside Modal
        if (fsBtn) {
            fsBtn.addEventListener('click', function () {
                const container = document.getElementById('wbGeoGebraContainer');
                if (!container) return;
                if (!document.fullscreenElement) {
                    container.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }

        // Presets Stamping
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

        // Direct Stamp Button
        if (stampBtn) {
            stampBtn.addEventListener('click', function () {
                drawCartesianAxes();
                drawMathCurve('homographic');
                modal.style.display = 'none';
                if (typeof window.showNotification === 'function') {
                    window.showNotification('📸 تم نسخ المعلم والمنحنى المرجعي بنجاح إلى السبورة التفاعلية!', 'success');
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
        } else if (type === 'sphere3d') {
            drawSpaceOrProbTemplate('sphere_plane');
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
                                        <div style="font-size: 0.8rem; font-weight: 800; color: #1e293b;">${item.title}</div>
                                        <div style="font-size: 0.66rem; color: #64748b;">تاريخ التسجيل: ${item.date} | المدة: ${Math.round(item.duration / 1000)} ثانية</div>
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
                            ${studentOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
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

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

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

        ctx.font = 'bold 12px "Cairo", sans-serif';
        const textWidth = ctx.measureText(`${icon} ${label}`).width;
        const padX = 8;
        const boxW = textWidth + padX * 2;
        const boxH = 26;
        const boxX = x - boxW / 2;
        const boxY = y - boxH / 2;

        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = bgClr;
        ctx.strokeStyle = borderClr;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        } else {
            ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = textClr;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${icon} ${label}`, boxX + boxW / 2, boxY + boxH / 2);

        ctx.restore();
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

            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.font = 'bold 16px "Cairo", sans-serif';

            const posX = w - 40;
            const posY = 130;

            ctx.beginPath();
            ctx.arc(posX, posY, 22, 0, Math.PI * 2);
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(score, posX, posY);

            ctx.restore();
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
        if (!canvas || !bgCanvas) return;
        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const h = lastValidHeight || parseFloat(canvas.style.height) || 600;

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const oCtx = offscreen.getContext('2d');

        oCtx.drawImage(bgCanvas, 0, 0, w, h);
        oCtx.drawImage(canvas, 0, 0, w, h);

        const dataUrl = offscreen.toDataURL('image/png');
        const link = document.createElement('a');
        const sName = (homeworkCorrectionState.currentStudent || 'تلميذ').replace(/[\s()]/g, '_');
        link.download = `تصحيح_فرض_${sName}_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();

        if (typeof window.showNotification === 'function') {
            window.showNotification('💾 تم تصدير ورقة التلميذ المصححة مع الملاحظات بنجاح!', 'success');
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
                for (const cKey in window.db.classes) {
                    const c = window.db.classes[cKey];
                    const arr = Array.isArray(c) ? c : (c && Array.isArray(c.students) ? c.students : []);
                    arr.forEach(s => {
                        if (s && s.name) found.push(`${s.name} (${cKey})`);
                    });
                }
                if (found.length > 0) studentList = found;
            }
        } catch (e) {}

        modal.style.display = 'flex';
        modal.innerHTML = `
            <div style="background: #ffffff; border-radius: 14px; width: 100%; max-width: 540px; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1.5px solid #cbd5e1; display: flex; flex-direction: column; overflow: hidden; font-family: 'Cairo', sans-serif; direction: rtl;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: linear-gradient(135deg, #ea580c, #c2410c); color: #ffffff;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.25rem;">👥</span>
                        <span style="font-weight: 800; font-size: 0.98rem;">دعوة تلميذ(ة) للصعود إلى السبورة التفاعلية (حل تشاركي)</span>
                    </div>
                    <button type="button" onclick="document.getElementById('whiteboardStudentCallModal').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                </div>

                <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <label style="font-size: 0.78rem; font-weight: 800; color: #1e293b;">🧑‍🎓 اختر التلميذ(ة) المراد صعوده(ا) للسبورة:</label>
                            <button type="button" id="btnRandomPickStudentWb" style="background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; border-radius: 6px; padding: 3px 9px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">🎲 قرعة عشوائية</button>
                        </div>
                        <select id="wbCallStudentSelect" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 0.82rem; background: #fff; color: #1e293b;">
                            ${studentList.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                    </div>

                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 10px 14px; font-size: 0.74rem; color: #9a3412;">
                        💡 <strong>الميزة الديداكتيكية:</strong> يتيح هذا الوضع للتلميذ الكتابة على السبورة بقلم مميز (أخضر زمردي) مع إمكانية تحكم الأستاذ الكاملة: قفل القلم للشرح، إرسال توجيهات رياضية فورية، ومنح نقطة مشاركة صفية (+1) تُسجّل مباشرة!
                    </div>

                    <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                        <button type="button" onclick="document.getElementById('whiteboardStudentCallModal').style.display='none'" style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 0.78rem; cursor: pointer;">إلغاء</button>
                        <button type="button" id="btnStartStudentCallNow" style="background: linear-gradient(135deg, #ea580c, #c2410c); border: none; color: #fff; padding: 6px 18px; border-radius: 6px; font-weight: 800; font-size: 0.8rem; cursor: pointer;">🚀 بدء صعود التلميذ(ة) الآن</button>
                    </div>
                </div>
            </div>
        `;

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

        const startBtn = document.getElementById('btnStartStudentCallNow');
        if (startBtn) {
            startBtn.addEventListener('click', function () {
                const sName = document.getElementById('wbCallStudentSelect').value;
                modal.style.display = 'none';
                startStudentCallSession(sName);
            });
        }
    }

    function startStudentCallSession(studentName) {
        studentCallState.active = true;
        studentCallState.studentName = studentName || 'أمين الإدريسي';
        studentCallState.studentRole = 'student';
        studentCallState.isLocked = false;

        const banner = document.getElementById('wbStudentCallBanner');
        if (banner) banner.style.display = 'flex';

        const nameLbl = document.getElementById('wbActiveStudentName');
        if (nameLbl) nameLbl.textContent = `التلميذ(ة): ${studentCallState.studentName}`;

        const statusLbl = document.getElementById('wbStudentPenStatus');
        if (statusLbl) statusLbl.textContent = 'حالة القلم: متاح للكتابة 🟢';

        setCollabRole('student');

        if (typeof window.showNotification === 'function') {
            window.showNotification(`🧑‍🎓 صعد(ت) التلميذ(ة) ${studentCallState.studentName} إلى السبورة! القلم نشط الآن.`, 'success');
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
        const btn = document.getElementById('btnToggleStudentLock');
        const status = document.getElementById('wbStudentPenStatus');
        if (btn) {
            btn.textContent = studentCallState.isLocked ? '🔓 فتح القلم' : '🔒 قفل القلم';
            btn.style.background = studentCallState.isLocked ? '#dc2626' : '#334155';
        }
        if (status) {
            status.textContent = studentCallState.isLocked ? 'حالة القلم: مقفل للشرح 🔴' : 'حالة القلم: متاح للكتابة 🟢';
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
                    ${prompts.map(p => `<button type="button" class="wb-guidance-preset-btn" data-msg="${p}" style="text-align:right;background:#faf5ff;border:1px solid #d8b4fe;color:#5b21b6;border-radius:8px;padding:6px 10px;font-size:0.78rem;font-weight:700;cursor:pointer;">💡 ${p}</button>`).join('')}
                </div>
                <input type="text" id="wbGuidanceCustomInput" value="${prompts[0]}" style="width:100%;padding:8px 12px;border:1.5px solid #c084fc;border-radius:8px;font-family:inherit;font-size:0.82rem;font-weight:700;color:#0f172a;margin-bottom:12px;box-sizing:border-box;outline:none;">
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
        studentCallState.participationCount++;
        const sName = studentCallState.studentName;

        try {
            if (window.db) {
                window.db.behaviors = window.db.behaviors || {};
                const today = new Date().toISOString().slice(0, 10);
                window.db.behaviors[today] = window.db.behaviors[today] || [];
                window.db.behaviors[today].push({
                    studentName: sName,
                    type: 'participation',
                    points: 1,
                    note: 'مشاركة ممتازة على السبورة التفاعلية'
                });
            }
        } catch (e) {}

        if (typeof window.showNotification === 'function') {
            window.showNotification(`⭐ تم منح نقطة مشاركة صفية (+1) للتلميذ(ة): ${sName}!`, 'success');
        }
    }

    function endStudentCallSession() {
        const sName = studentCallState.studentName;
        studentCallState.active = false;
        studentCallState.studentName = '';
        studentCallState.studentRole = 'teacher';
        studentCallState.isLocked = false;
        studentCursorPos = null;

        const banner = document.getElementById('wbStudentCallBanner');
        if (banner) banner.style.display = 'none';

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
        const col1W = 105;
        const mainW = tableW - col1W;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        // خلفية الجدول البيضاء الواضحة
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x0, y0, tableW, tableH, 8);
        } else {
            ctx.rect(x0, y0, tableW, tableH);
        }
        ctx.fill();
        ctx.stroke();

        // عنوان الدالة أعلى الجدول
        if (cfg.fnName) {
            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 14px "Cairo", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`جدول تغيرات الدالة: ${cfg.fnName}`, x0 + tableW / 2, y0 - 10);
        }

        const r1H = 38; // صف x
        const r2H = 44; // صف f'(x)
        const r3H = tableH - r1H - r2H; // صف تغيرات f(x)

        // الخطوط الأفقية والعمود الأول
        ctx.beginPath();
        ctx.moveTo(x0, y0 + r1H);
        ctx.lineTo(x0 + tableW, y0 + r1H);
        ctx.moveTo(x0, y0 + r1H + r2H);
        ctx.lineTo(x0 + tableW, y0 + r1H + r2H);
        ctx.moveTo(x0 + col1W, y0);
        ctx.lineTo(x0 + col1W, y0 + tableH);
        ctx.stroke();

        // عناوين الصفوف على اليسار (النسق المغربي/الفرنسي من اليسار لليمين)
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px "Cairo", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('x', x0 + col1W / 2, y0 + r1H / 2);
        ctx.fillText("f'(x)", x0 + col1W / 2, y0 + r1H + r2H / 2);
        ctx.fillText('f(x)', x0 + col1W / 2, y0 + r1H + r2H + r3H / 2);

        // توزيع قيم x
        const xArr = cfg.xVals.length > 0 ? cfg.xVals : ['-∞', '+∞'];
        const padX = 28;
        const usableW = mainW - padX * 2;
        ctx.font = 'bold 13px "Cairo", sans-serif';
        xArr.forEach((val, i) => {
            const px = x0 + col1W + padX + (xArr.length === 1 ? usableW / 2 : (i / (xArr.length - 1)) * usableW);
            ctx.fillStyle = '#1e3a8a';
            ctx.fillText(val, px, y0 + r1H / 2);
        });

        // توزيع إشارات المشتقة f'(x) والخطوط العمودية للأصفار والقيم الممنوعة
        const sArr = cfg.signs || [];
        sArr.forEach((sig, i) => {
            const px = x0 + col1W + padX + (sArr.length === 1 ? usableW / 2 : (i / (sArr.length - 1)) * usableW);
            const py = y0 + r1H + r2H / 2;
            if (sig === '0') {
                ctx.save();
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                ctx.moveTo(px, y0 + r1H);
                ctx.lineTo(px, y0 + r1H + r2H);
                ctx.stroke();
                ctx.restore();
                ctx.fillStyle = '#dc2626';
                ctx.fillText('0', px, py);
            } else if (sig === '||') {
                // خط مزدوج للقيمة الممنوعة (Double barre)
                ctx.save();
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(px - 3, y0 + r1H);
                ctx.lineTo(px - 3, y0 + tableH);
                ctx.moveTo(px + 3, y0 + r1H);
                ctx.lineTo(px + 3, y0 + tableH);
                ctx.stroke();
                ctx.restore();
            } else {
                ctx.fillStyle = sig === '+' ? '#059669' : '#dc2626';
                ctx.font = 'bold 17px sans-serif';
                ctx.fillText(sig, px, py);
                ctx.font = 'bold 13px "Cairo", sans-serif';
            }
        });

        // رسم أسهم الرتابة والنهايات في خانة f(x)
        const arrList = cfg.arrows || [];
        const yList = cfg.yVals || [];
        const topY = y0 + r1H + r2H + 22;
        const botY = y0 + tableH - 22;
        const midY = (topY + botY) / 2;

        const segCount = Math.max(1, arrList.length);
        const segW = usableW / segCount;

        let yValIdx = 0;
        arrList.forEach((ar, i) => {
            const sx1 = x0 + col1W + padX + i * segW;
            const sx2 = sx1 + segW;
            if (ar === '||') return;

            const isUp = ar.includes('↗') || ar === '+' || ar === 'up';
            const startYPos = isUp ? botY : topY;
            const endYPos = isUp ? topY : botY;

            // قيمة البداية في أول سهم
            if (i === 0 && yList[yValIdx] !== undefined) {
                ctx.fillStyle = '#0f172a';
                ctx.fillText(yList[yValIdx], sx1, startYPos);
                yValIdx++;
            }

            // رسم السهم المائل
            const ax1 = sx1 + 22;
            const ay1 = isUp ? botY - 6 : topY + 6;
            const ax2 = sx2 - 22;
            const ay2 = isUp ? topY + 6 : botY - 6;

            ctx.save();
            ctx.strokeStyle = isUp ? '#059669' : '#dc2626';
            ctx.fillStyle = isUp ? '#059669' : '#dc2626';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(ax1, ay1);
            ctx.lineTo(ax2, ay2);
            ctx.stroke();

            const ang = Math.atan2(ay2 - ay1, ax2 - ax1);
            ctx.beginPath();
            ctx.moveTo(ax2, ay2);
            ctx.lineTo(ax2 - 9 * Math.cos(ang - Math.PI / 6), ay2 - 9 * Math.sin(ang - Math.PI / 6));
            ctx.lineTo(ax2 - 9 * Math.cos(ang + Math.PI / 6), ay2 - 9 * Math.sin(ang + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // قيمة النهاية أو المطراف
            if (yList[yValIdx] !== undefined) {
                ctx.fillStyle = '#0f172a';
                ctx.fillText(yList[yValIdx], sx2, endYPos);
                yValIdx++;
            } else {
                ctx.fillText('', sx2, midY);
            }
        });

        ctx.restore();
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📊 تم إدراج جدول الإشارة والتغيرات على السبورة بنجاح!', 'success');
        }
    }

    /* ====================================================================
     * 6. راسم الدوال المخصصة مع المماس وحساب التكامل (Custom Function Plotter)
     * ==================================================================== */
    function evalMathExprSafe(exprStr, xVal) {
        try {
            let s = String(exprStr || '')
                .replace(/\^/g, '**')
                .replace(/\bln\s*\(/g, 'Math.log(')
                .replace(/\bsin\s*\(/g, 'Math.sin(')
                .replace(/\bcos\s*\(/g, 'Math.cos(')
                .replace(/\btan\s*\(/g, 'Math.tan(')
                .replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
                .replace(/\babs\s*\(/g, 'Math.abs(')
                .replace(/\bexp\s*\(/g, 'Math.exp(')
                .replace(/\bpi\b/gi, 'Math.PI')
                .replace(/(\d)([x(])/gi, '$1*$2');
            const fn = new Function('x', `return (${s});`);
            const res = fn(xVal);
            return (typeof res === 'number' && isFinite(res)) ? res : NaN;
        } catch (e) {
            return NaN;
        }
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
            const cx = Math.floor(w / 2);
            const cy = Math.floor(h / 2);
            const scale = 40;

            ctx.save();
            ctx.globalCompositeOperation = 'source-over';

            // 1. تظليل حيز التكامل
            if (withIntegral && intA !== intB) {
                const a = Math.min(intA, intB);
                const b = Math.max(intA, intB);
                ctx.save();
                ctx.fillStyle = 'rgba(124, 58, 237, 0.22)';
                ctx.beginPath();
                ctx.moveTo(cx + a * scale, cy);
                for (let x = a; x <= b; x += 0.05) {
                    const y = evalMathExprSafe(expr, x);
                    if (!isNaN(y) && Math.abs(y) < 30) {
                        ctx.lineTo(cx + x * scale, cy - y * scale);
                    }
                }
                ctx.lineTo(cx + b * scale, cy);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            // 2. رسم منحنى الدالة C_f
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = Math.max(2.6, currentSize);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            let penDown = false;
            let prevPy = null;
            for (let px = 30; px < w - 30; px += 2) {
                const x = (px - cx) / scale;
                const y = evalMathExprSafe(expr, x);
                if (isNaN(y) || Math.abs(y) > 25) {
                    penDown = false;
                    prevPy = null;
                    continue;
                }
                const py = cy - y * scale;
                if (py < 10 || py > h - 10 || (prevPy !== null && Math.abs(py - prevPy) > h * 0.45)) {
                    penDown = false;
                }
                if (!penDown) {
                    ctx.moveTo(px, py);
                    penDown = true;
                } else {
                    ctx.lineTo(px, py);
                }
                prevPy = py;
            }
            ctx.stroke();

            // 3. رسم المماس (T) في النقطة x0
            if (withTangent) {
                const y0 = evalMathExprSafe(expr, x0);
                const eps = 0.0001;
                const dy = (evalMathExprSafe(expr, x0 + eps) - evalMathExprSafe(expr, x0 - eps)) / (2 * eps);
                if (!isNaN(y0) && !isNaN(dy)) {
                    ctx.save();
                    ctx.strokeStyle = '#dc2626';
                    ctx.fillStyle = '#dc2626';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 4]);
                    const dxSpan = 2.2;
                    const xA = x0 - dxSpan;
                    const yA = y0 + dy * (xA - x0);
                    const xB = x0 + dxSpan;
                    const yB = y0 + dy * (xB - x0);
                    ctx.beginPath();
                    ctx.moveTo(cx + xA * scale, cy - yA * scale);
                    ctx.lineTo(cx + xB * scale, cy - yB * scale);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.arc(cx + x0 * scale, cy - y0 * scale, 4.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.font = 'bold 12px "Cairo", sans-serif';
                    const mRound = Math.round(dy * 100) / 100;
                    const pRound = Math.round((y0 - dy * x0) * 100) / 100;
                    ctx.fillText(`(T): y = ${mRound}x ${pRound >= 0 ? '+ ' + pRound : pRound}`, cx + x0 * scale + 10, cy - y0 * scale - 10);
                    ctx.restore();
                }
            }

            ctx.font = 'bold 13px "Cairo", sans-serif';
            ctx.fillStyle = currentColor;
            ctx.fillText(`(Cf): f(x) = ${expr}`, 45, 48);

            ctx.restore();
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
        const cx = Math.floor(w / 2);
        const cy = Math.floor(h / 2);

        const isDarkBg = (currentBg === 'green' || currentBg === 'dark');
        const mainClr = (isDarkBg && (currentColor === '#1e3a8a' || currentColor === '#0f172a')) ? '#f8fafc' : currentColor;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = mainClr;
        ctx.fillStyle = mainClr;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.font = 'bold 13px "Cairo", sans-serif';

        if (templateType === 'cube3d') {
            // مكعب ABCDEFGH في معلم فضائي (O, i, j, k) مع الأحرف المخفية المتقطعة
            const s = 130;
            const dx = 55;
            const dy = -45;
            // Front face: A(bottom-left), B(bottom-right), F(top-right), E(top-left)
            const D = { x: cx - 40, y: cy + 50 };
            const C = { x: D.x + s, y: D.y };
            const H = { x: D.x, y: D.y - s };
            const G = { x: C.x, y: C.y - s };

            const A = { x: D.x - dx, y: D.y - dy };
            const B = { x: C.x - dx, y: C.y - dy };
            const E = { x: H.x - dx, y: H.y - dy };
            const F = { x: G.x - dx, y: G.y - dy };

            // Hidden edges from D (dashed)
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(D.x, D.y); ctx.lineTo(A.x, A.y);
            ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y);
            ctx.moveTo(D.x, D.y); ctx.lineTo(H.x, H.y);
            ctx.stroke();
            ctx.restore();

            // Visible edges (solid)
            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(F.x, F.y); ctx.lineTo(E.x, E.y); ctx.closePath();
            ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(G.x, G.y); ctx.lineTo(F.x, F.y);
            ctx.moveTo(E.x, E.y); ctx.lineTo(H.x, H.y); ctx.lineTo(G.x, G.y);
            ctx.stroke();

            // Labels
            ctx.fillText('A', A.x - 16, A.y + 14);
            ctx.fillText('B', B.x + 8, B.y + 14);
            ctx.fillText('C', C.x + 10, C.y + 6);
            ctx.fillText('D', D.x - 14, D.y - 6);
            ctx.fillText('E', E.x - 16, E.y - 6);
            ctx.fillText('F', F.x + 8, F.y + 4);
            ctx.fillText('G', G.x + 10, G.y - 6);
            ctx.fillText('H', H.x - 14, H.y - 8);
        } else if (templateType === 'tetrahedron') {
            // رباعي الأوجه ABCD مع حرف خلفي متقطع [BC]
            const A = { x: cx, y: cy - 110 };
            const B = { x: cx - 120, y: cy + 75 };
            const D = { x: cx + 15, y: cy + 115 };
            const C = { x: cx + 125, y: cy + 55 };

            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
            ctx.moveTo(A.x, A.y); ctx.lineTo(D.x, D.y);
            ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y);
            ctx.moveTo(B.x, B.y); ctx.lineTo(D.x, D.y);
            ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y);
            ctx.stroke();

            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
            ctx.stroke();
            ctx.restore();

            ctx.fillText('A', A.x - 5, A.y - 10);
            ctx.fillText('B', B.x - 18, B.y + 10);
            ctx.fillText('D', D.x - 5, D.y + 18);
            ctx.fillText('C', C.x + 10, C.y + 8);
        } else if (templateType === 'sphere_plane') {
            // فلكة (S) مركزها Ω يقطعها مستوى (P) وفق دائرة (C) مركزها H
            const R = 105;
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.stroke();

            // خط استواء الفلكة المتقطع
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.ellipse(cx, cy, R, 28, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // المستوى القاطع (P) والدائرة (C) في الأعلى
            const hy = cy - 52;
            const rSec = Math.sqrt(R * R - 52 * 52);
            ctx.save();
            ctx.fillStyle = 'rgba(2, 132, 199, 0.16)';
            ctx.strokeStyle = '#0284c7';
            ctx.beginPath();
            ctx.ellipse(cx, hy, rSec, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // المركز Ω والمسقط العمودي H
            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
            ctx.arc(cx, hy, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, hy);
            ctx.lineTo(cx + rSec, hy);
            ctx.stroke();

            ctx.fillText('Ω', cx - 18, cy + 5);
            ctx.fillText('H', cx - 18, hy + 4);
            ctx.fillText('M', cx + rSec + 8, hy + 4);
            ctx.fillText('(S)', cx - R - 28, cy - R + 20);
        } else if (templateType === 'prob_tree') {
            // شجرة الاحتمالات المتوازنة (الحدثان A و Ā والاحتمالات الشرطية B و B̄)
            const root = { x: cx - 180, y: cy };
            const nA = { x: cx - 30, y: cy - 85 };
            const nAb = { x: cx - 30, y: cy + 85 };

            const nAB = { x: cx + 140, y: cy - 130 };
            const nABb = { x: cx + 140, y: cy - 40 };
            const nAbB = { x: cx + 140, y: cy + 40 };
            const nAbBb = { x: cx + 140, y: cy + 130 };

            ctx.beginPath();
            ctx.moveTo(root.x, root.y); ctx.lineTo(nA.x - 16, nA.y);
            ctx.moveTo(root.x, root.y); ctx.lineTo(nAb.x - 16, nAb.y);

            ctx.moveTo(nA.x + 16, nA.y); ctx.lineTo(nAB.x - 16, nAB.y);
            ctx.moveTo(nA.x + 16, nA.y); ctx.lineTo(nABb.x - 16, nABb.y);

            ctx.moveTo(nAb.x + 16, nAb.y); ctx.lineTo(nAbB.x - 16, nAbB.y);
            ctx.moveTo(nAb.x + 16, nAb.y); ctx.lineTo(nAbBb.x - 16, nAbBb.y);
            ctx.stroke();

            ctx.fillStyle = '#1e3a8a';
            ctx.font = 'bold 15px "Cairo", sans-serif';
            ctx.fillText('Ω', root.x - 22, root.y + 5);
            ctx.fillText('A', nA.x - 5, nA.y + 5);
            ctx.fillText('Ā', nAb.x - 5, nAb.y + 5);

            ctx.fillStyle = '#059669';
            ctx.fillText('B', nAB.x, nAB.y + 5);
            ctx.fillText('B̄', nABb.x, nABb.y + 5);
            ctx.fillText('B', nAbB.x, nAbB.y + 5);
            ctx.fillText('B̄', nAbBb.x, nAbBb.y + 5);

            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('P(A)', (root.x + nA.x) / 2 - 20, (root.y + nA.y) / 2 - 8);
            ctx.fillText('P(Ā)', (root.x + nAb.x) / 2 - 20, (root.y + nAb.y) / 2 + 18);
            ctx.fillText('P_A(B)', (nA.x + nAB.x) / 2 - 15, (nA.y + nAB.y) / 2 - 8);
            ctx.fillText('P_A(B̄)', (nA.x + nABb.x) / 2 - 15, (nA.y + nABb.y) / 2 + 16);
            ctx.fillText('P_Ā(B)', (nAb.x + nAbB.x) / 2 - 15, (nAb.y + nAbB.y) / 2 - 8);
            ctx.fillText('P_Ā(B̄)', (nAb.x + nAbBb.x) / 2 - 15, (nAb.y + nAbBb.y) / 2 + 16);
        }

        ctx.restore();
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('🧊 تم إدراج القالب الهندسي/الاحتمالي على السبورة بنجاح!', 'success');
        }
    }

    /* ====================================================================
     * 8. التكامل مع القسم ودفتر النصوص ومؤقت التمارين (Classroom Integration)
     * ==================================================================== */
    function insertCurrentLessonHeaderOnBoard() {
        if (!ctx || !canvas) return;
        saveStateForUndo();

        const w = lastValidWidth || parseFloat(canvas.style.width) || 800;
        const todayStr = new Date().toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        let className = '2BAC-PC-1';
        let lessonTitle = 'الاتصال والاشتقاق ودراسة الدوال العددية';

        try {
            const logClassEl = document.getElementById('lessonLogClassSelect') || document.getElementById('classSelect') || document.getElementById('logClass');
            const logTopicEl = document.getElementById('lessonLogNumber') || document.getElementById('lessonLogTitle') || document.getElementById('logTopic');
            if (logClassEl && logClassEl.value) className = logClassEl.value;
            else if (window.db && window.db.classes && Object.keys(window.db.classes).length > 0) {
                className = Object.keys(window.db.classes)[0];
            }
            if (logTopicEl && logTopicEl.value.trim()) lessonTitle = logTopicEl.value.trim();
        } catch (e) {}

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        // شريط ترويسة الدرس أعلى السبورة
        ctx.fillStyle = 'rgba(239, 246, 255, 0.94)';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(24, 14, w - 48, 44, 10);
        } else {
            ctx.rect(24, 14, w - 48, 44);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 14px "Cairo", sans-serif';
        ctx.textBaseline = 'middle';

        ctx.textAlign = 'right';
        ctx.fillText(`📅 ${todayStr}   |   🏫 القسم: ${className}`, w - 38, 36);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#047857';
        ctx.fillText(`📘 الدرس: ${lessonTitle}`, 38, 36);

        ctx.restore();
        persistWhiteboardState();
        if (typeof window.showNotification === 'function') {
            window.showNotification('📌 تم إدراج ترويسة الحصة والدرس أعلى السبورة!', 'success');
        }
    }

    function updateBoardExerciseTimerUI() {
        const disp = document.getElementById('wbExerciseTimerDisplay') || document.getElementById('wbTimerDisplay');
        if (disp) {
            const m = String(Math.floor(exerciseTimerState.secondsLeft / 60)).padStart(2, '0');
            const s = String(exerciseTimerState.secondsLeft % 60).padStart(2, '0');
            disp.textContent = `${m}:${s}`;
            disp.style.color = exerciseTimerState.secondsLeft <= 30 ? '#f87171' : '#fde047';
        }
        const btn = document.getElementById('btnWbTimerStartPause');
        if (btn) {
            btn.textContent = exerciseTimerState.running ? '⏸ إيقاف مؤقت' : '▶️ تشغيل';
            btn.style.background = exerciseTimerState.running ? '#d97706' : '#16a34a';
        }
    }

    function toggleBoardExerciseTimer() {
        const overlay = document.getElementById('wbExerciseTimerOverlay');
        if (!overlay) return;
        const isVisible = overlay.style.display === 'flex';
        overlay.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            updateBoardExerciseTimerUI();
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
            const summaryNote = `تم إنجاز الحصة وشرح الفقرات والتمارين التطبيقية على السبورة التفاعلية (${pageCount} صفحات سبورة مسجلة).`;
            const logNoteEl = document.getElementById('lessonLogSummary') || document.getElementById('lessonLogNotes') || document.getElementById('logNotes') || document.getElementById('logActivities') || document.getElementById('logTopic');
            if (logNoteEl) {
                logNoteEl.value = logNoteEl.value
                    ? `${logNoteEl.value} — ${summaryNote}`
                    : summaryNote;
            }
            if (window.db) {
                window.db.whiteboardLogs = window.db.whiteboardLogs || [];
                window.db.whiteboardLogs.unshift({
                    date: new Date().toISOString().slice(0, 10),
                    pages: pageCount,
                    note: summaryNote
                });
                if (typeof window.saveData === 'function') {
                    window.saveData();
                }
            }
            if (typeof window.showNotification === 'function') {
                window.showNotification('📓 تم إرسال وتوثيق ملخص السبورة التفاعلية في دفتر النصوص بنجاح!', 'success');
            }
        } catch (e) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('📓 تم حفظ ملخص السبورة.', 'info');
            }
        }
    }

    // Window Exports
    window.initDistanceTeaching = initDistanceTeaching;
    window.persistWhiteboardState = persistWhiteboardState;
    window.compressWhiteboardIndexedDB = compressWhiteboardIndexedDB;
    window.replayVectorStrokesToCanvas = replayVectorStrokesToCanvas;
    window.getWhiteboardVectorStrokes = () => ({ pageVectorStrokes, pdfPageVectorStrokes });
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
    window.drawMathCurve = drawMathCurve;
    window.openVariationTableModal = openVariationTableModal;
    window.stampVariationTableToCanvas = stampVariationTableToCanvas;
    window.openCustomFunctionPlotterModal = openCustomFunctionPlotterModal;
    window.drawSpaceOrProbTemplate = drawSpaceOrProbTemplate;
    window.insertCurrentLessonHeaderOnBoard = insertCurrentLessonHeaderOnBoard;
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

    // 4. Student Call-up & Virtual Blackboard Collaboration Exports
    window.openStudentCallModal = openStudentCallModal;
    window.startStudentCallSession = startStudentCallSession;
    window.setCollabRole = setCollabRole;
    window.toggleStudentPenLock = toggleStudentPenLock;
    window.sendInstantMathGuidance = sendInstantMathGuidance;
    window.awardStudentParticipationPoint = awardStudentParticipationPoint;
    window.endStudentCallSession = endStudentCallSession;

})(window);
