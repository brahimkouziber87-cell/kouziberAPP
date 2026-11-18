/**
 * ============================================================================
 * محرك التحميل الكسول عند الطلب للمكتبات الخارجية والوحدات الثقيلة (Phase 1 Performance)
 * يمنع حجب التصيير الابتدائي (Render-Blocking) ويحمّل المكتبات فقط عند فتح التبويب أو الحاجة
 * ============================================================================
 */
(function (win) {
  'use strict';

  const _cdnPromises = Object.create(null);
  const _loadedCdnNames = new Set();
  const _legacyModulePromises = Object.create(null);
  const _loadedModuleUrls = new Set();

  function injectStylesheet(href) {
    return new Promise((resolve) => {
      const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
      if (existing) return resolve(true);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
  }

  function injectScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing && existing.dataset.loaded === 'true') {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve(true);
      };
      script.onerror = (err) => reject(err || new Error('Failed to load script: ' + src));
      document.head.appendChild(script);
    });
  }

  function ensureCdnLibrary(libName) {
    const key = String(libName || '').toLowerCase();
    if (!key) return Promise.resolve(false);

    if (key === 'xlsx' && typeof win.XLSX !== 'undefined') {
      _loadedCdnNames.add('xlsx');
      return Promise.resolve(win.XLSX);
    }
    if (key === 'chartjs' && typeof win.Chart !== 'undefined') {
      _loadedCdnNames.add('chartjs');
      return Promise.resolve(win.Chart);
    }
    if (key === 'html2pdf' && typeof win.html2pdf === 'function') {
      _loadedCdnNames.add('html2pdf');
      return Promise.resolve(win.html2pdf);
    }
    if (key === 'pdfjs' && win.pdfjsLib) {
      if (win.pdfjsLib.GlobalWorkerOptions && !win.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        win.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      _loadedCdnNames.add('pdfjs');
      return Promise.resolve(win.pdfjsLib);
    }
    if (key === 'katex' && typeof win.katex !== 'undefined' && typeof win.renderMathInElement === 'function') {
      _loadedCdnNames.add('katex');
      return Promise.resolve(win.katex);
    }

    if (_cdnPromises[key]) return _cdnPromises[key];

    let loaderPromise;
    if (key === 'xlsx') {
      loaderPromise = injectScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js')
        .then(() => {
          _loadedCdnNames.add('xlsx');
          return win.XLSX;
        });
    } else if (key === 'chartjs') {
      loaderPromise = injectScript('https://cdn.jsdelivr.net/npm/chart.js')
        .then(() => {
          _loadedCdnNames.add('chartjs');
          return win.Chart;
        });
    } else if (key === 'html2pdf') {
      loaderPromise = injectScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js')
        .then(() => {
          _loadedCdnNames.add('html2pdf');
          return win.html2pdf;
        });
    } else if (key === 'pdfjs') {
      loaderPromise = injectScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
        .then(() => {
          if (win.pdfjsLib && win.pdfjsLib.GlobalWorkerOptions) {
            win.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
          _loadedCdnNames.add('pdfjs');
          return win.pdfjsLib;
        });
    } else if (key === 'katex') {
      loaderPromise = Promise.all([
        injectStylesheet('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'),
        injectScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js')
      ])
        .then(() => injectScript('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'))
        .then(() => {
          _loadedCdnNames.add('katex');
          return win.katex;
        });
    } else {
      return Promise.resolve(null);
    }

    _cdnPromises[key] = loaderPromise.catch((err) => {
      delete _cdnPromises[key];
      console.warn('[LazyCdnLoader] Failed loading', key, err);
      return null;
    });
    return _cdnPromises[key];
  }

  function ensureLegacyModule(scriptUrl) {
    if (!scriptUrl) return Promise.resolve(false);
    if (_loadedModuleUrls.has(scriptUrl)) return Promise.resolve(true);
    if (_legacyModulePromises[scriptUrl]) return _legacyModulePromises[scriptUrl];

    _legacyModulePromises[scriptUrl] = injectScript(scriptUrl)
      .then(() => {
        _loadedModuleUrls.add(scriptUrl);
        return true;
      })
      .catch((err) => {
        delete _legacyModulePromises[scriptUrl];
        console.warn('[LazyModuleLoader] Failed loading module:', scriptUrl, err);
        return false;
      });
    return _legacyModulePromises[scriptUrl];
  }

  win.ensureCdnLibrary = ensureCdnLibrary;
  win.ensureXlsxLoaded = () => ensureCdnLibrary('xlsx');
  win.ensureChartJsLoaded = () => ensureCdnLibrary('chartjs');
  win.ensureHtml2PdfLoaded = () => ensureCdnLibrary('html2pdf');
  win.ensurePdfJsLoaded = () => ensureCdnLibrary('pdfjs');
  win.ensureKatexLoaded = () => ensureCdnLibrary('katex');
  win.ensureLegacyModule = ensureLegacyModule;

  win.getLazyPerformanceTelemetry = () => ({
    loadedCdnLibraries: Array.from(_loadedCdnNames),
    loadedLegacyModules: Array.from(_loadedModuleUrls),
    lazyModeActive: true
  });

  // ============================================================================
  // تحميل مسبق ذكي لأصول كل تبويب عند الانتقال إليه
  // ============================================================================
  const loadWhiteboardSubmodules = async () => {
    await ensureLegacyModule('/whiteboard/wb-security-math.js?v=4.2');
    await Promise.all([
      ensureLegacyModule('/whiteboard/wb-vector-engine.js?v=4.1'),
      ensureLegacyModule('/whiteboard/wb-collab-sync.js?v=4.1'),
      ensureLegacyModule('/whiteboard/wb-bridges.js?v=4.1')
    ]);
    return ensureLegacyModule('/distance-teaching.js?v=4.2');
  };

  win.ensureTabAssetsLoaded = function (tabName) {
    const t = String(tabName || '').trim();
    if (t === 'distanceTeaching' || t === 'whiteboard') {
      ensureCdnLibrary('katex');
      ensureCdnLibrary('pdfjs');
      return loadWhiteboardSubmodules();
    }
    if (t === 'lessonlog' || t === 'cahier' || t === 'lessonLog' || t === 'cahierTextes') {
      return ensureCdnLibrary('katex');
    }
    if (t === 'calendar') {
      return ensureCdnLibrary('pdfjs');
    }
    if (t === 'library' || t === 'reports' || t === 'annual' || t === 'analysis' || t === 'tutoring' || t === 'dashboard') {
      return ensureCdnLibrary('chartjs');
    }
    if (t === 'grades') {
      ensureLegacyModule('/quick-grade-scanner.js?v=3.9');
      return ensureCdnLibrary('xlsx');
    }
    if (t === 'absence') {
      return ensureLegacyModule('/diagnostic-evaluation.js?v=3.9');
    }
    return Promise.resolve(true);
  };

  // ============================================================================
  // وكلاء تحميل كسول للوحدات الثقيلة (Lazy Proxies) لضمان عمل الأزرار دون انتظار التحميل الابتدائي
  // ============================================================================
  function registerLazyProxy(fnName, loaderFn) {
    const proxyFn = async function () {
      const args = Array.prototype.slice.call(arguments);
      await loaderFn();
      const realFn = win[fnName];
      if (typeof realFn === 'function' && !realFn.__isLazyProxy) {
        return realFn.apply(this, args);
      }
      return undefined;
    };
    proxyFn.__isLazyProxy = true;
    if (typeof win[fnName] !== 'function') {
      win[fnName] = proxyFn;
    }
  }

  // 1. السبورة التفاعلية والتدريس عن بعد
  const loadDistanceTeachingBundle = () =>
    Promise.all([
      ensureCdnLibrary('katex'),
      ensureCdnLibrary('pdfjs'),
      loadWhiteboardSubmodules()
    ]);
  [
    'initDistanceTeaching',
    'drawBlankVariationTableOnBoard',
    'toggleProofRecording',
    'openHomeworkCorrectionModal',
    'openStudentCallModal',
    'openGeoGebraModal',
    'toggleWhiteboardZenMode',
    'toggleBoardCalculatorWidget',
    'setBoardTool',
    'setBoardColor',
    'setBoardSize',
    'setBoardBg',
    'openMathFormulaModal',
    'drawCartesianAxes',
    'drawTrigonometricCircle',
    'drawComplexPlane',
    'openRecursiveSequenceModal',
    'openDidacticCalloutModal',
    'openMathQuickQuizModal',
    'toggleBoardCurtain',
    'toggleBoardVideoRecorder',
    'openBoardLiveShareModal',
    'drawMathCurve',
    'openVariationTableModal',
    'openCustomFunctionPlotterModal',
    'drawSpaceOrProbTemplate',
    'insertCurrentLessonHeaderOnBoard',
    'toggleBoardExerciseTimer',
    'saveBoardToLessonLog',
    'addBoardPage',
    'duplicateBoardPage',
    'deleteBoardPage',
    'prevBoardPage',
    'nextBoardPage',
    'undoBoard',
    'redoBoard',
    'clearBoard',
    'exportBoardImage',
    'printAnnotatedWhiteboardPages',
    'triggerWhiteboardPdfImport',
    'loadSampleMathPdfWorksheet',
    'openLibraryPdfForWhiteboard',
    'toggleWhiteboardFullscreen',
    'openProofBankModal',
    'toggleLeftToolsDock',
    'toggleFreehandPagesDrawer',
    'openSaveBoardToLibraryModal',
    'openAttachBoardToTutoringModal',
    'joinWhiteboardCollabRoom',
    'jumpToFreehandPage',
    'selectHomeworkStamp',
    'toggleHomeworkStampPalette',
    'copyWhiteboardCollabLink',
    'toggleInteractiveRuler',
    'toggleInteractiveProtractor',
    'toggleInteractiveSetSquare',
    'toggleInteractiveCompass',
    'insertMathSymbol',
    'handleWhiteboardPdfFile',
    'togglePdfThumbnailsSidebar',
    'prevPdfPage',
    'nextPdfPage',
    'jumpToPdfPage',
    'zoomWhiteboardPdf',
    'scrollWhiteboardPdfVertical',
    'scrollWhiteboardPdfHorizontal',
    'setPdfVerticalScrollFromSlider',
    'rotateWhiteboardPdf',
    'resetWhiteboardPdfView',
    'fitPdfPageWidth',
    'closeWhiteboardPdf',
    'setBoardExerciseTimerMinutes',
    'startPauseBoardExerciseTimer',
    'stampScoreBadgeModal',
    'exportCorrectedHomeworkCopy',
    'closeHomeworkCorrectionMode',
    'setCollabRole',
    'toggleStudentPenLock',
    'sendInstantMathGuidance',
    'awardStudentParticipationPoint',
    'endStudentCallSession',
    'playRecordedProof',
    'pauseRecordedProof',
    'resetProofPlayback',
    'seekProofPlayback',
    'setProofSpeed',
    'saveProofToBankModal',
    'closeProofPlaybackDock',
    'toggleWhiteboardSplitMode',
    'swapWhiteboardSplitSide',
    'switchWhiteboardSplitTab',
    'pinCurrentBoardToSplitPane',
    'zoomSplitSnapshot',
    'loadSplitExercisePreset',
    'stampSplitExerciseToBoard',
    'clearAndStartSolutionBoard',
    'open3DSolidsStudioModal',
    'exportAllWhiteboardPagesToPDF'
  ].forEach((fn) => registerLazyProxy(fn, loadDistanceTeachingBundle));

  // 2. ماسح النقط السريع والإملاء الصوتي
  registerLazyProxy('openQuickGradeScannerModal', () =>
    ensureLegacyModule('/quick-grade-scanner.js?v=3.9')
  );

  // 3. التقرير الإداري الشامل PDF
  registerLazyProxy('openAdminComprehensivePdfModal', () =>
    Promise.all([
      ensureCdnLibrary('html2pdf'),
      ensureLegacyModule('/admin-comprehensive-pdf.js?v=3.9')
    ])
  );

  // 4. محضر مجلس القسم ومؤشر القيمة المضافة
  const loadCouncilAndVaModules = () =>
    Promise.all([
      ensureLegacyModule('/value-added-analytics.js?v=3.9'),
      ensureLegacyModule('/pedagogical-council-pv.js?v=3.9')
    ]);
  registerLazyProxy('openPedagogicalCouncilPvModal', loadCouncilAndVaModules);
  registerLazyProxy('openValueAddedAnalyticsModal', loadCouncilAndVaModules);

  // 5. التقويم التشخيصي وتصدير شبكته
  [
    'renderDiagnosticSection',
    'autoGenerateDiagnosticMarks',
    'toggleDiagnosticRemediationBox'
  ].forEach((fn) =>
    registerLazyProxy(fn, () => ensureLegacyModule('/diagnostic-evaluation.js?v=3.9'))
  );
  registerLazyProxy('exportDiagnosticExcelGrid', () =>
    Promise.all([
      ensureCdnLibrary('xlsx'),
      ensureLegacyModule('/diagnostic-evaluation.js?v=3.9')
    ])
  );

  // 6. معاينة وتصدير الفرض
  registerLazyProxy('openExamReportModal', () =>
    Promise.all([
      ensureCdnLibrary('chartjs'),
      ensureLegacyModule('/exam-report.js?v=3.9')
    ])
  );

  // تحميل استباقي صامت للمكتبات الأساسية في أوقات خمول المتصفح بعد الإقلاع (لا يحجب الإقلاع الأولي)
  win.addEventListener('load', function () {
    const scheduleIdle = win.requestIdleCallback || function (cb) { return setTimeout(cb, 3500); };
    scheduleIdle(function () {
      ensureCdnLibrary('chartjs');
    });
  });
})(window);
