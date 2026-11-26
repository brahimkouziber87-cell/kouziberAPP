import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();

function createDomSandbox(html = '<!doctype html><html dir="rtl" lang="ar"><body><div id="appExtractedModalsHost"></div></body></html>', extra = {}) {
    const dom = new JSDOM(html, { url: 'https://localhost:3000/' });
    const win = dom.window;
    const store = {};
    const memoryStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
    };

    Object.defineProperty(win, 'localStorage', { value: memoryStorage, configurable: true });

    const sandbox = {
        window: win,
        self: win,
        document: win.document,
        navigator: win.navigator,
        localStorage: memoryStorage,
        console,
        Math,
        Date,
        Number,
        String,
        Boolean,
        Array,
        Object,
        JSON,
        RegExp,
        Error,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        ...extra
    };

    Object.assign(win, extra);
    vm.createContext(sandbox);
    return { dom, win, sandbox };
}

function runPublicScript(sandbox, relPath) {
    const code = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
}

test('WbSecurityMath: zero-eval math parser evaluates expressions accurately and blocks injections', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/whiteboard/wb-security-math.js');
    const M = win.WbSecurityMath;

    assert.equal(M.evaluateMathWithX('2 + 3 * 4', 0, false), 14);
    assert.equal(M.evaluateMathWithX('2x^2 - 3x + 1', 2, false), 3);
    assert.equal(M.evaluateMathWithX('3(x+1)', 4, false), 15);
    assert.ok(Math.abs(M.evaluateMathWithX('sin(30)', 0, true) - 0.5) < 1e-9);
    assert.ok(Math.abs(M.evaluateMathWithX('cos(pi)', 0, false) + 1) < 1e-9);
    assert.equal(M.evaluateMathWithX('2^3^2', 0, false), 512);
    assert.equal(M.evaluateMathWithX('sqrt(16) + log(100)', 0, false), 6);

    // Invalid domains and code injection attempts must return NaN
    assert.ok(Number.isNaN(M.evaluateMathWithX('ln(-5)', 0, false)));
    assert.ok(Number.isNaN(M.evaluateMathWithX('sqrt(-9)', 0, false)));
    assert.ok(Number.isNaN(M.evaluateMathWithX('1/0', 0, false)));
    assert.ok(Number.isNaN(M.evaluateMathWithX('alert(1)', 0, false)));
    assert.ok(Number.isNaN(M.evaluateMathWithX('process.exit(1)', 0, false)));
});

test('WbSecurityMath: analytical quadratic solver handles real2, real1, complex2, and degenerate cases', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/whiteboard/wb-security-math.js');
    const { solveQuadraticAnalytical } = win.WbSecurityMath;

    const real2 = solveQuadraticAnalytical(1, -5, 6);
    assert.equal(real2.type, 'real2');
    assert.equal(real2.delta, 1);
    assert.equal(real2.x1, 2);
    assert.equal(real2.x2, 3);

    const real1 = solveQuadraticAnalytical(1, -4, 4);
    assert.equal(real1.type, 'real1');
    assert.equal(real1.delta, 0);
    assert.equal(real1.x0, 2);

    const complex2 = solveQuadraticAnalytical(1, 2, 5);
    assert.equal(complex2.type, 'complex2');
    assert.equal(complex2.delta, -16);
    assert.equal(complex2.re, -1);
    assert.equal(complex2.im, 2);

    const deg1 = solveQuadraticAnalytical(0, 2, -8);
    assert.equal(deg1.type, 'deg1');
    assert.equal(deg1.x, 4);

    const deg0Impossible = solveQuadraticAnalytical(0, 0, 5);
    assert.equal(deg0Impossible.type, 'deg0');
});

test('WbSecurityMath: 2x2 linear Cramer solver handles unique, infinite, and inconsistent systems', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/whiteboard/wb-security-math.js');
    const { solveLinearSystem2x2 } = win.WbSecurityMath;

    // 2x + y = 7 and x - y = 2 => (3, 1)
    const unique = solveLinearSystem2x2(2, 1, 7, 1, -1, 2);
    assert.equal(unique.ok, true);
    assert.equal(unique.D, -3);
    assert.equal(unique.x, 3);
    assert.equal(unique.y, 1);

    // Dependent: x + y = 2 and 2x + 2y = 4
    const infinite = solveLinearSystem2x2(1, 1, 2, 2, 2, 4);
    assert.equal(infinite.ok, false);
    assert.equal(infinite.D, 0);
    assert.match(infinite.summary, /ما لا نهاية/);

    // Parallel inconsistent: x + y = 2 and x + y = 5
    const noSol = solveLinearSystem2x2(1, 1, 2, 1, 1, 5);
    assert.equal(noSol.ok, false);
    assert.equal(noSol.D, 0);
    assert.match(noSol.summary, /ليس لها حل/);
});

test('WbSecurityMath: escapeHtml, sanitizeRoomCode, and academic year label work safely', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/whiteboard/wb-security-math.js');
    const M = win.WbSecurityMath;

    assert.equal(M.escapeHtml('<script>"test"</script>'), '&lt;script&gt;&quot;test&quot;&lt;/script&gt;');
    assert.equal(M.sanitizeRoomCode('  math bac 2026!@# '), 'MATHBAC2026');
    assert.equal(M.sanitizeRoomCode(''), 'MATH-BAC-2026');

    win.db = { academicYear: '2026/2027' };
    assert.equal(M.getAcademicYearLabel(), '2026/2027');
});

test('Annual Calendar Engine: calculates Moroccan school days, holidays, absence blocks, and Arabic timetable sessions accurately', () => {
    const mockNow = new Date('2026-11-16T10:00:00');
    const { win, sandbox } = createDomSandbox(undefined, {
        getAppNow: () => new Date(mockNow.getTime()),
        db: {
            classes: { '2BAC-PC-1': {} },
            archivedClasses: [],
            timetable: {
                'الإثنين': { m1: '2BAC-PC-1 - رياضيات', e1: '2BAC-PC-1 - رياضيات' },
                'الأربعاء': { m1: '2BAC-PC-1 - رياضيات' }
            },
            schoolYearHolidays: [],
            schoolYearMilestones: [],
            teacherLeaves: [],
            calendarEvents: {},
            homeworkAgenda: {}
        }
    });

    runPublicScript(sandbox, 'public/annual-calendar.js');

    // Official holidays checks
    const holidays = win.getOfficialHolidays();
    assert.ok(Array.isArray(holidays) && holidays.length >= 10);

    // 2026-11-18 is Eid Al Istiqlal (holiday)
    const istiq = win.getOfficialHolidayForDate('2026-11-18');
    assert.ok(istiq);
    assert.equal(win.isAbsenceDisabledOnDate('2026-11-18'), true);

    // 2026-11-16 is regular school Monday
    assert.equal(win.isAbsenceDisabledOnDate('2026-11-16'), false);

    // Resumption date after holiday ends on Sunday 2026-10-25 -> Monday 2026-10-26 (and Saturday -> Monday skip)
    const interim1 = win.getOfficialHolidayForDate('2026-10-20');
    assert.ok(interim1);
    assert.equal(win.getHolidayResumptionDateStr(interim1.endDate), '2026-10-26');
    assert.equal(win.getHolidayResumptionDateStr('2026-10-24'), '2026-10-26');

    // True academic year metrics (2026-09-01 to 2027-06-30 = 303 calendar days)
    const metrics = win.calculateTrueAcademicYearMetrics(2026, '2026-09-01', '2027-06-30');
    assert.equal(metrics.totalCalendarDays, 303);
    assert.equal(metrics.elapsedSchoolDays + metrics.remainingSchoolDays, metrics.netSchoolDaysTotal);
    assert.ok(metrics.sundaysCount >= 43);
    assert.ok(metrics.netWeekdayHolidays > 20);
    assert.ok(metrics.progressPct > 0 && metrics.progressPct < 100);

    // Arabic timetable keys should yield 3 exact (non-estimated) weekly sessions for 2BAC-PC-1
    assert.equal(metrics.classBreakdown.length, 1);
    assert.equal(metrics.classBreakdown[0].weeklySessions, 3);
    assert.equal(metrics.classBreakdown[0].isEstimated, false);
    assert.ok(metrics.classBreakdown[0].remainingSessions > 0);
});

test('Extracted Modals Module: index.html + modals-templates.js mount all 40+ modals cleanly with zero duplicate IDs', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const { dom, win, sandbox } = createDomSandbox(indexHtml);
    runPublicScript(sandbox, 'public/modals-templates.js');

    const mounted = win.mountExtractedModals();
    assert.equal(mounted, true);

    const expectedModalIds = [
        // Phase 1 & Phase 3 Block A (File Preview, Data Management, Settings & System Modals)
        'filePreviewModal',
        'driveFoldersManagerModal',
        'batchAiClassificationModal',
        'unifiedAnnualPdfModal',
        'dataManagementModal',
        'importPreviewModal',
        'wipeAndResetModal',
        'systemDeduplicationModal',
        'appTimeSyncModal',
        'onboardingGuideModal',
        'teacherSettingsModal',
        'purgeOldArchiveModal',
        // Phase 1 & Phase 3 Block B (Lesson Log, PDF, Math Symbols, Curriculum & Tutoring Modals)
        'cahierDeTextesPdfModal',
        'lessonLogDetailModal',
        'reorderLessonAxesModal',
        'linkSessionsToAxisModal',
        'universalPdfPreviewModal',
        'combinedMathSymbolsAndSvgModal',
        'mathSymbolsPaletteModal',
        'massarCoefficientsModal',
        'allClassesCurriculumModal',
        'tutoringSessionModal',
        'tutoringAttendancePeriodPrintModal',
        // Previously Extracted Bottom Modals
        'calendarWhatsappModal',
        'calendarDaily8AmAlertModal',
        'dashStudentQuickProfileModal',
        'dashboardDecisionModal',
        'schoolYearDatesModal',
        'weatherCitySelectModal',
        'studentWhatsAppReminderModal',
        'massarExportModal',
        'massarImportModal',
        'batchMassarImportModal',
        'batchMassarSummaryModal',
        'quickAddStudentModal',
        'timetableCalendarSyncModal',
        'quickAddSessionHomeworkModal',
        'officialHolidayModal',
        'academicMilestoneModal',
        'teacherLeaveModal',
        'decreeAiImportModal',
        'ministerialCalendarSyncModal',
        'mathRemediationAiModal',
        'aiPromptTemplatesModal',
        'promptTestVariableModal',
        'editPromptTemplateModal',
        'voiceSearchMainModal'
    ];

    for (const id of expectedModalIds) {
        assert.ok(dom.window.document.getElementById(id), `Missing extracted modal: ${id}`);
    }

    // Ensure zero duplicate IDs across entire mounted document
    const allWithIds = dom.window.document.querySelectorAll('[id]');
    const seen = new Set();
    const duplicates = [];
    for (const el of allWithIds) {
        if (seen.has(el.id)) duplicates.push(el.id);
        seen.add(el.id);
    }
    assert.deepEqual(duplicates, []);
});

test('Core Engine 1 — GradesCalculator: conditional formatting, Moroccan stream coefficients, and statistical metrics', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    const G = win.GradesCalculator;

    assert.equal(G.getGradeConditionalStyle('').category, 'empty');
    assert.equal(G.getGradeConditionalStyle(16.5).category, 'excellent');
    assert.equal(G.getGradeConditionalStyle(12.5).category, 'good');
    assert.equal(G.getGradeConditionalStyle(10.0).category, 'medium');
    assert.equal(G.getGradeConditionalStyle(8.5).category, 'warning');
    assert.equal(G.getGradeConditionalStyle(6.0).category, 'struggling');

    assert.equal(G.getStreamOfficialConfig('2BAC علوم رياضية أ').coefficient, 9);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم فيزيائية 1').coefficient, 7);
    assert.equal(G.getStreamOfficialConfig('جذع مشترك علمي 2').coefficient, 4);
    assert.equal(G.getStreamOfficialConfig('جذع مشترك آداب وعلوم إنسانية').coefficient, 2);
    assert.equal(G.getStreamOfficialConfig('1BAC آداب وعلوم إنسانية').coefficient, 1);
    assert.equal(G.getStreamOfficialConfig('1BAC آداب وعلوم إنسانية').weeklyHours, 2);
    assert.equal(G.getStreamOfficialConfig('1BAC آداب وعلوم إنسانية').examDurationHours, 1);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم وتكنولوجيات كهربائية STE').weeklyHours, 5);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم وتكنولوجيات كهربائية STE').annualHours, 170);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم وتكنولوجيات ميكانيكية STM').coefficient, 7);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم وتكنولوجيات ميكانيكية STM').weeklyHours, 5);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم وتكنولوجيات ميكانيكية STM').annualHours, 170);
    assert.equal(G.getStreamOfficialConfig('1BAC شعبة الفنون التطبيقية').coefficient, 4);
    assert.equal(G.getStreamOfficialConfig('1BAC شعبة الفنون التطبيقية').weeklyHours, 3);
    assert.equal(G.getStreamOfficialConfig('1BAC شعبة الفنون التطبيقية').annualHours, 102);
    assert.equal(G.getStreamOfficialConfig('1BAC شعبة الفنون التطبيقية').examsPerSemester, 3);
    assert.equal(G.getStreamOfficialConfig('1BAC شعبة الفنون التطبيقية').examDurationHours, 1);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم تجريبية خيار فرنسية').coefficient, 7);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم تجريبية خيار فرنسية').weeklyHours, 5);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم تجريبية خيار فرنسية').annualHours, 170);
    assert.equal(G.getStreamOfficialConfig('جذع مشترك تكنولوجي 1').coefficient, 4);
    assert.equal(G.getStreamOfficialConfig('جذع مشترك تكنولوجي 1').weeklyHours, 5);
    assert.equal(G.getStreamOfficialConfig('جذع مشترك تكنولوجي 1').annualHours, 170);
    assert.equal(G.getStreamOfficialConfig('TCT-1').coefficient, 4);
    assert.equal(G.getStreamOfficialConfig('1LSH-1').coefficient, 1);
    assert.equal(G.getStreamOfficialConfig('2LSH-2').coefficient, 1);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم رياضية SM').coefficient, 9);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم رياضية SM').weeklyHours, 7);
    assert.equal(G.getStreamOfficialConfig('2BAC علوم رياضية SM').annualHours, 238);
    assert.equal(G.getStreamOfficialConfig('1BAC علوم اقتصادية وتدبير ECO').annualHours, 136);
    assert.equal(G.getStreamOfficialConfig('2BAC آداب وعلوم إنسانية LSH').annualHours, 68);

    const semAvg = G.calculateStudentSemesterAverage({ f1: 14, f2: 16, f3: 15, act: 18 }, { includeActivity: true, activityWeight: 0.25 });
    assert.equal(semAvg, 15.75);

    // المذكرة الوزارية 142-08 ومسار: الاعتماد الحصري على الفروض المحروسة بدون أنشطة مندمجة
    const pureNote142Avg = G.calculateStudentSemesterAverage({ f1: 14, f2: 16, f3: 15, act: 18 });
    assert.equal(pureNote142Avg, 15); // (14 + 16 + 15) / 3 = 15.00

    const stats = G.calculateClassStatisticalMetrics([6, 9, 10, 12, 14, 15]);
    assert.equal(stats.count, 6);
    assert.equal(stats.mean, 11);
    assert.equal(stats.median, 11);
    assert.equal(stats.passCount, 4);
    assert.equal(stats.strugglingCount, 1);
    assert.equal(stats.excellentCount, 2);
});

test('Core Engine 2 — MassarIO: Excel serial dates, Moroccan CNE codes, French comma grades, and CSV export', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/massar-io.js');
    const M = win.MassarIO;

    assert.equal(M.parseMassarDate('2009-05-14').fullDate, '14/05/2009');
    assert.equal(M.parseMassarDate('14/05/2009').birthYear, '2009');
    assert.equal(M.parseMassarDate(39947).birthYear, '2009');

    assert.equal(M.isMassarCode('R130045678'), true);
    assert.equal(M.isMassarCode('INVALID'), false);
    assert.equal(M.normalizeGroupValue('الفوج 1'), 'G1');
    assert.equal(M.normalizeGroupValue('Groupe 2'), 'G2');
    assert.equal(M.parseMassarGradeValue('15,75'), 15.75);
    assert.equal(M.parseMassarGradeValue('25'), undefined);

    const check = M.validateMassarImportRow({ name: 'أحمد العلوي', massarCode: 'r130045678', group: '1', f1: '14,5' });
    assert.equal(check.valid, true);
    assert.equal(check.normalizedMassarCode, 'R130045678');
    assert.equal(check.normalizedGroup, 'G1');

    const csv = M.buildMassarCsvExport([{ name: 'أحمد العلوي', massarCode: 'R130045678', group: 'G1', grades: { s1: { f1: 14, f2: 16, act: 15 } } }], '2BAC-1', 's1');
    assert.ok(csv.includes('R130045678;أحمد العلوي;G1;14;16;;15;15'));
});

test('Core Engine 3 & 4 — AbsenceManager & LessonLogEngine: holiday exemptions, attendance risk, and curriculum pacing', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/absence-manager.js');
    runPublicScript(sandbox, 'public/core/lesson-log-engine.js');

    const holidays = [{ name: 'عيد الاستقلال', start: '2026-11-18', end: '2026-11-18' }];
    const summary = win.AbsenceManager.calculateStudentAbsenceSummary([
        { date: '2026-11-18', hours: 2, justified: false }, // Exempt holiday
        { date: '2026-11-19', hours: 4, justified: false },
        { date: '2026-11-20', hours: 2, justified: true }
    ], { holidays });

    assert.equal(summary.exemptedCount, 1);
    assert.equal(summary.unjustifiedHours, 4);
    assert.equal(summary.justifiedHours, 2);
    assert.equal(summary.totalHours, 6);
    assert.equal(summary.risk.level, 'warning');

    const pacing = win.LessonLogEngine.computeCurriculumPacingMetrics({
        completedHours: 50,
        plannedAnnualHours: 100,
        elapsedWeeks: 16,
        totalTeachingWeeks: 32
    });
    assert.equal(pacing.actualCompletionPct, 50);
    assert.equal(pacing.expectedCompletionPct, 50);
    assert.equal(pacing.status, 'on_track');

    const matched = win.LessonLogEngine.matchCurriculumLessonsWithLogs(
        [{ title: 'الاتصال والاشتقاق', hours: 4 }],
        [{ lesson: 'الاتصال والاشتقاق', duration: 4 }]
    );
    assert.equal(matched[0].state, 'completed');

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    const brief = win.LessonLogEngine.buildCompanionAppPedagogicalBrief({
        className: '2BAC-SM-1',
        semester: 's1',
        completedLessons: ['الاتصال', 'الاشتقاق'],
        strugglingCount: 6
    });
    assert.equal(brief.cycle, 'QUALIFYING_SECONDARY_MOROCCO');
    assert.equal(brief.coefficient, 9);
    assert.equal(brief.recommendedDocumentType, 'سلسلة دعم ومعالجة مركزة');

    const importedDoc = win.LessonLogEngine.normalizeImportedCompanionDocument({
        title: 'الفرض المحروس رقم 1 - الدورة الأولى',
        type: 'devoir',
        level: '2BAC-PC',
        axis: 'الاتصال والنهايات'
    });
    assert.equal(importedDoc.docType, 'فرض محروس');
    assert.equal(importedDoc.durationHours, 2);
});

test('Core Engine 5 — PrintPreviewEngine: non-blocking showConfirmDialog & showInputDialog resolve Promises and invoke callbacks cleanly', async () => {
    const { dom, win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/print-preview-engine.js');

    let confirmedCount = 0;
    const promiseAccept = win.showConfirmDialog('هل أنت متأكد من حذف هذا السجل؟', () => {
        confirmedCount += 1;
    });

    const dialogEl = dom.window.document.getElementById('appUnifiedConfirmDialogBackdrop');
    assert.ok(dialogEl, 'Confirm dialog should be mounted in DOM');
    assert.equal(dialogEl.getAttribute('role'), 'dialog');

    const acceptBtn = dom.window.document.getElementById('btnUnifiedConfirmAccept');
    assert.ok(acceptBtn);
    acceptBtn.click();

    const result = await promiseAccept;
    assert.equal(result, true);
    assert.equal(confirmedCount, 1);
    assert.equal(dom.window.document.getElementById('appUnifiedConfirmDialogBackdrop'), null);

    let submittedVal = '';
    const inputPromise = win.showInputDialog('أدخل اسم الفئة:', 'أولمبياد', (v) => {
        submittedVal = v;
    });
    const inputField = dom.window.document.getElementById('appUnifiedInputDialogField');
    assert.ok(inputField);
    inputField.value = 'أولمبياد الرياضيات';
    dom.window.document.getElementById('btnUnifiedInputAccept').click();

    const inputRes = await inputPromise;
    assert.equal(inputRes, 'أولمبياد الرياضيات');
    assert.equal(submittedVal, 'أولمبياد الرياضيات');
});

test('Phase 3 Core Engines (6..9): TimetableEngine, BehaviorHomeworkEngine, ArchiveDedupEngine & InspectionDossierEngine', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/timetable-engine.js');
    runPublicScript(sandbox, 'public/core/behavior-homework-engine.js');
    runPublicScript(sandbox, 'public/core/archive-dedup-engine.js');
    runPublicScript(sandbox, 'public/core/inspection-dossier-engine.js');

    // 1. TimetableEngine
    const tt = {
        'Monday': { m1: '2BAC-SM-1 - رياضيات', m2: '2BAC-PC-1 - رياضيات' },
        'الأربعاء': { m1: '2BAC-SM-1 - رياضيات' }
    };
    const load = win.TimetableEngine.calculateWeeklyTeachingHours(tt, 2);
    assert.equal(load.totalWeeklySlots, 3);
    assert.equal(load.totalWeeklyHours, 6);
    assert.equal(load.byClass['2BAC-SM-1'], 4);

    const conflicts = win.TimetableEngine.detectTimetableConflicts(tt, [
        { day: 'الإثنين', slot: 'm1', className: 'حصة دعم' }
    ]);
    assert.equal(conflicts.hasConflicts, true);
    assert.equal(conflicts.conflictCount, 1);

    // 2. BehaviorHomeworkEngine
    const disc = win.BehaviorHomeworkEngine.evaluateStudentDisciplineScore({ behaviorStatus: 'تنبيه' }, 2, 4);
    assert.equal(disc.score, 14); // 20 - 2 - 2*1 - 4*0.5 = 14

    // 3. ArchiveDedupEngine
    const dupCheck = win.ArchiveDedupEngine.detectDuplicateStudentsInClass([
        { id: '1', name: 'أحمد الإدريسي', massarCode: 'R130011223', grades: { s1: { f1: 15 } } },
        { id: '2', name: 'احمد الادريسي', massarCode: 'R130011223', phone: '0612345678', grades: { s1: { f2: 17 } } }
    ]);
    assert.equal(dupCheck.hasDuplicates, true);
    const merged = win.ArchiveDedupEngine.mergeDuplicateStudentRecords(
        dupCheck.duplicateGroups[0].primaryStudent,
        dupCheck.duplicateGroups[0].duplicateStudent
    );
    assert.equal(merged.phone, '0612345678');
    assert.equal(merged.grades.s1.f1, 15);
    assert.equal(merged.grades.s1.f2, 17);

    // 4. InspectionDossierEngine
    const dossierHtml = win.InspectionDossierEngine.renderOfficialInspectionDossierHtml({
        currentSemester: 's1',
        teacherProfile: { name: 'الأستاذ إبراهيم قزيبر', academicYear: '2026/2027' },
        timetable: tt,
        classes: {
            '2BAC-SM-1': {
                students: [
                    { name: 'سلمى بنعلي', massarCode: 'R130099887', grades: { s1: { f1: 16, f2: 18 } } },
                    { name: 'يوسف العلمي', massarCode: 'R130099888', grades: { s1: { f1: 7, f2: 8 } } }
                ]
            }
        }
    });
    assert.ok(dossierHtml.includes('ملف التفتيش التربوي وحصيلة مجالس الأقسام'));
    assert.ok(dossierHtml.includes('2BAC-SM-1'));
    assert.ok(dossierHtml.includes('يوسف العلمي'));
});

test('End-to-End Companion Document Bridge UI & Moroccan Qualifying Secondary Stream Matrix', async () => {
    const { dom, win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/lesson-log-engine.js');

    // Verify all Qualifying Secondary streams (General & BIOF)
    const streamsToCheck = [
        { code: 'TCS-1', coef: 4, exams: 3 },
        { code: 'TCL-2', coef: 2, exams: 2 },
        { code: '1BAC-SM-1', coef: 9, exams: 4 },
        { code: '1BAC-SE-BIOF-1', coef: 7, exams: 3 },
        { code: '2BAC-SMA-1', coef: 9, exams: 4 },
        { code: '2BAC-PC-BIOF-2', coef: 7, exams: 3 },
        { code: '2BAC-SVT-1', coef: 7, exams: 3 },
        { code: '2BAC-ECO-1', coef: 4, exams: 3 },
        { code: '1BAC-LSH-1', coef: 1, exams: 2 },
        { code: '2BAC-LSH-1', coef: 1, exams: 2 }
    ];
    for (const item of streamsToCheck) {
        const cfg = win.GradesCalculator.getStreamOfficialConfig(item.code);
        assert.equal(cfg.coefficient, item.coef, `Expected coef ${item.coef} for ${item.code}`);
        assert.equal(cfg.examsPerSemester, item.exams, `Expected ${item.exams} exams for ${item.code}`);
    }

    // Set up sample class database and open Companion Document Bridge Modal
    win.db = {
        currentClass: '2BAC-SM-1',
        currentSemester: 's1',
        classes: {
            '2BAC-SM-1': {
                students: [
                    { name: 'آية بنسعيد', grades: { s1: { f1: 17, f2: 18, act: 19 } } },
                    { name: 'حمزة الفاسي', grades: { s1: { f1: 8, f2: 9, act: 11 } } }
                ],
                lessonLog: [
                    { lesson: 'الاتصال والاشتقاق', duration: 4 },
                    { lesson: 'المتتاليات العددية', duration: 6 }
                ]
            }
        },
        lessonLogs: {},
        customResources: []
    };

    const brief = win.openCompanionDocumentBridgeModal('2BAC-SM-1');
    assert.ok(brief);
    assert.equal(brief.className, '2BAC-SM-1');
    assert.equal(brief.coefficient, 9);

    const modalEl = dom.window.document.getElementById('companionDocBridgeModalBackdrop');
    assert.ok(modalEl, 'Companion Bridge modal should mount in DOM');

    const exportTextarea = dom.window.document.getElementById('companionBridgeExportTextarea');
    assert.ok(exportTextarea.value.includes('PEDAGOGICAL_COMPANION_BRIDGE_V1'));
    assert.ok(exportTextarea.value.includes('المتتاليات العددية'));

    // Simulate importing a produced exam from the Companion App into Lesson Log & Digital Library
    const titleInput = dom.window.document.getElementById('companionImportTitleInput');
    const typeSelect = dom.window.document.getElementById('companionImportTypeSelect');
    const axisInput = dom.window.document.getElementById('companionImportAxisInput');
    const importBtn = dom.window.document.getElementById('btnImportCompanionDocToLog');

    titleInput.value = 'الفرض المحروس رقم 2 - المتتاليات والأعداد العقدية';
    typeSelect.value = 'exam';
    axisInput.value = 'المتتاليات العددية';
    importBtn.click();

    assert.equal(win.db.lessonLogs['2BAC-SM-1'].length, 1);
    assert.equal(win.db.lessonLogs['2BAC-SM-1'][0].title, 'الفرض المحروس رقم 2 - المتتاليات والأعداد العقدية');
    assert.equal(win.db.lessonLogs['2BAC-SM-1'][0].type, 'فرض محروس');
    assert.equal(win.db.customResources.length, 1);
    assert.equal(win.db.customResources[0].category, 'فرض محروس');

    // Verify .json file import UI elements exist in the modal
    const fileInputEl = dom.window.document.getElementById('companionImportJsonFileInput');
    const selectFileBtnEl = dom.window.document.getElementById('btnSelectCompanionJsonFile');
    const dropzoneEl = dom.window.document.getElementById('companionImportJsonDropzone');
    assert.ok(fileInputEl && fileInputEl.accept.includes('.json'), 'JSON file input should exist with .json accept filter');
    assert.ok(selectFileBtnEl, 'Select JSON file button should exist');
    assert.ok(dropzoneEl, 'JSON dropzone should exist');

    // Verify importing a batch .json file (bundle with multiple produced documents)
    const bundleJson = JSON.stringify({
        protocol: 'PEDAGOGICAL_COMPANION_BRIDGE_V1',
        className: '2BAC-SM-1',
        semester: 's1',
        documents: [
            { title: 'سلسلة تمارين الدوال اللوغاريتمية', type: 'series', axis: 'الدوال اللوغاريتمية', durationHours: 2, exercisesCount: 8 },
            { title: 'درس الحسابيات في Z', type: 'lesson', axis: 'الحسابيات', durationHours: 4, notes: 'التطابقات بترديد n' }
        ]
    });
    const fakeJsonFile = {
        name: 'companion-pack.json',
        text: async () => bundleJson
    };
    const fileOutcome = await win.LessonLogEngine.readAndImportCompanionJsonFile(fakeJsonFile, '2BAC-SM-1');
    assert.equal(fileOutcome.ok, true);
    assert.equal(fileOutcome.count, 2);
    assert.equal(win.db.lessonLogs['2BAC-SM-1'].length, 3);
    assert.equal(win.db.customResources.length, 3);

    // Verify invalid JSON & exported-brief-only rejection messages
    const invalidOutcome = win.LessonLogEngine.importCompanionJsonFileContent('{not-valid-json', '2BAC-SM-1');
    assert.equal(invalidOutcome.ok, false);
    assert.ok(invalidOutcome.error.includes('غير صالحة'));

    const briefOnlyOutcome = win.LessonLogEngine.importCompanionJsonFileContent(exportTextarea.value, '2BAC-SM-1');
    assert.equal(briefOnlyOutcome.ok, false);
    assert.ok(briefOnlyOutcome.error.includes('بطاقة تشخيصية مصدرة'));
});

test('AI Pedagogical Notes Generator & Qualitative Report Summarizer in notesView', async () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.equal(indexHtml.includes('id="headerCompanionDocBridgeBtn"'), false, 'Top header bridge button should be removed');
    assert.equal(indexHtml.includes('id="aiPedagogicalNotesSummaryCard"'), true, 'AI Notes Summary Card should exist in notesView');
    assert.equal(indexHtml.includes('id="btnGenerateSingleNoteWithAi"'), true, 'AI Single Note button should exist in Note Editor');

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html><body>
        <select id="notesClassSelect"><option value="2BAC-PC-1" selected>2BAC-PC-1</option></select>
        <select id="notesStudentSelect"><option value="st_1" selected>سلمى الإدريسي</option></select>
        <select id="newNoteCategorySelect"><option value="auto" selected>auto</option><option value="pedagogical">pedagogical</option></select>
        <select id="newNoteSentimentSelect"><option value="auto" selected>auto</option><option value="positive">positive</option></select>
        <textarea id="newNoteText"></textarea>
        <div id="aiGeneratedSingleNotePreviewBox" style="display:none;"></div>
        <button id="btnGenerateSingleNoteWithAi"></button>
        <div id="aiPedagogicalNotesSummaryCard" style="display:none;">
            <select id="aiSummaryScopeSelect"><option value="class" selected>class</option></select>
            <select id="aiSummaryFocusSelect"><option value="comprehensive" selected>comprehensive</option></select>
            <button id="btnRunAiNotesSummary"></button>
            <div id="aiNotesSummaryResultContainer" style="display:none;"></div>
        </div>
    </body></html>`);

    // Mock fetch to simulate /api/ai/pedagogical-notes-assistant
    sandbox.fetch = async (_url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.mode === 'generate_note') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    source: 'gemini_ai',
                    mode: 'generate_note',
                    formalNote: 'تتميز التلميذة سلمى الإدريسي بتحصيل ممتاز في الرياضيات وانضباط مثالي.',
                    conciseMassarNote: 'نتائج ممتازة وانضباط مثالي، واصلي التألق.',
                    actionableRecommendation: 'تكليفها بتمارين التعمق وأولمبياد الرياضيات.',
                    category: 'pedagogical',
                    sentiment: 'positive'
                })
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                source: 'gemini_ai',
                mode: 'summarize_report',
                executiveSummary: 'خلاصة تركيبية شاملة لأداء القسم 2BAC-PC-1.',
                pedagogicalAxisSynthesis: 'تمكن جيد من الدوال والمتتاليات.',
                behavioralAndAttendanceSynthesis: 'انضباط عام إيجابي مع حالات غياب محدودة.',
                strategicRecommendations: ['تنظيم حصص دعم للفئة المتعثرة', 'تتبع دفاتر التمارين'],
                readyToPrintReportText: 'التقرير التركيبي النوعي للقسم 2BAC-PC-1'
            })
        };
    };

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/behavior-homework-engine.js');

    win.db = {
        currentClass: '2BAC-PC-1',
        currentSemester: 's1',
        classes: {
            '2BAC-PC-1': [
                { id: 'st_1', name: 'سلمى الإدريسي', grades: { s1: { f1: 18, f2: 17, act: 19 } } }
            ]
        },
        notes: {
            '2BAC-PC-1': [
                { id: 'n1', text: 'تفاعل ممتاز مع درس الاتصال', category: 'pedagogical', sentiment: 'positive' }
            ]
        }
    };

    const singleNoteRes = await win.generateOrRefineNoteWithAI();
    assert.ok(singleNoteRes);
    assert.equal(dom.window.document.getElementById('newNoteText').value, 'تتميز التلميذة سلمى الإدريسي بتحصيل ممتاز في الرياضيات وانضباط مثالي.');

    win.applyAiGeneratedNoteVariant('massar');
    assert.equal(dom.window.document.getElementById('newNoteText').value, 'نتائج ممتازة وانضباط مثالي، واصلي التألق.');

    const summaryRes = await win.summarizeNotesWithAI();
    assert.ok(summaryRes);
    assert.ok(dom.window.document.getElementById('aiNotesSummaryResultContainer').innerHTML.includes('خلاصة تركيبية شاملة لأداء القسم 2BAC-PC-1'));

    win.saveAiSummaryAsPinnedClassNote();
    assert.equal(win.db.notes['2BAC-PC-1'].length, 2);
    assert.equal(win.db.notes['2BAC-PC-1'][0].pinned, true);
    assert.equal(win.db.notes['2BAC-PC-1'][0].isAiSummaryReport, true);
});

test('Supervised Exams & Exam Report: bug fixes, makeup normalization, dispersion stats, progression & auto-diagnostics', async () => {
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.equal(indexHtml.includes('id="examReportStreamNormBadge"'), true);
    assert.equal(indexHtml.includes('id="examStatMedian"'), true);
    assert.equal(indexHtml.includes('id="examStatStdDev"'), true);
    assert.equal(indexHtml.includes('id="examStatCV"'), true);
    assert.equal(indexHtml.includes('id="examReportProgressionStrip"'), true);
    assert.equal(indexHtml.includes('id="btnAutoGenerateExamDiagnostics"'), true);

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html><body>
        <select id="reportClassSelect"><option value="2BAC-SM-1" selected>2BAC-SM-1</option></select>
        <select id="examReportSemester"><option value="s1" selected>s1</option><option value="s2">s2</option></select>
        <select id="examReportNumber">
            <option value="1" selected>1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
        </select>
        <span id="examReportStatusBadge"></span>
        <span id="examReportStreamNormBadge"></span>
        <input id="examReportPassDate" value="2026-11-10" />
        <input id="examReportCorrectionDate" value="2026-11-17" />
        <select id="examReportDuration"><option value="2h" selected>2h</option></select>
        <input id="examReportCoef" value="9" />
        <textarea id="examReportTopics">الاتصال والاشتقاق</textarea>
        <input id="examReportGradingScale" value="" />
        <textarea id="examReportDifficulties"></textarea>
        <textarea id="examReportRemediation"></textarea>
        <div id="examStatTotal"></div><div id="examStatPresent"></div><div id="examStatAbsent"></div>
        <div id="examStatMax"></div><div id="examStatMin"></div><div id="examStatAvg"></div>
        <div id="examStatPassRate"></div><div id="examStatFailRate"></div>
        <div id="examStatMedian"></div><div id="examStatStdDev"></div><div id="examStatCV"></div>
        <div id="distCount_veryLow"></div><div id="distPct_veryLow"></div><div id="distBar_veryLow"></div>
        <div id="distCount_low"></div><div id="distPct_low"></div><div id="distBar_low"></div>
        <div id="distCount_medium"></div><div id="distPct_medium"></div><div id="distBar_medium"></div>
        <div id="distCount_good"></div><div id="distPct_good"></div><div id="distBar_good"></div>
        <div id="distCount_excellent"></div><div id="distPct_excellent"></div><div id="distBar_excellent"></div>
        <div id="examReportPieChartContainer"></div>
        <div id="examReportProgressionStrip"></div>
        <table><tbody id="examReportRosterTbody"></tbody></table>
        <table><tbody id="examReportRankedTbody"></tbody></table>
        <div id="examReportAbsentsContainer"></div>
        <span id="examReportAbsentsCountBadge"></span>
    </body></html>`);

    let capturedPrintHtml = '';
    win.openCustomPrintPreviewModal = (html) => { capturedPrintHtml = html; };
    win.showNotification = () => {};
    win.showToast = () => {};
    win.saveDB = () => {};
    win.saveData = () => {};

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/exam-report.js');

    win.db = {
        currentClass: '2BAC-SM-1',
        teacherProfile: { name: 'ذ. إبراهيم قزيبر', school: 'الثانوية التأهيلية المرجعية' },
        classes: {
            '2BAC-SM-1': [
                { id: 's1', name: 'تلميذ 1', massar: 'M1001' },
                { id: 's2', name: 'تلميذ 2', massarCode: 'M1002' },
                { id: 's3', name: 'تلميذ 3', cne: 'M1003' },
                { id: 's4', name: 'تلميذ 4', massar: 'M1004' }
            ]
        },
        grades: {
            '2BAC-SM-1': {
                s1: { s1: { f1: '16,5', f2: 17 } },
                s2: { s1: { f1: 12, f2: 14 } },
                s3: { s1: { f1: '7,5', f2: 9 } },
                s4: { s1: { f1: 'غ', f2: 11 } }
            }
        }
    };

    win.loadOrBuildReportForForm('2BAC-SM-1');

    // Verify comma decimal parsing & stats + dispersion metrics
    assert.equal(dom.window.document.getElementById('examStatPresent').textContent, '3');
    assert.equal(dom.window.document.getElementById('examStatAbsent').textContent, '1');
    assert.equal(dom.window.document.getElementById('examStatAvg').textContent, '12/20');
    assert.equal(dom.window.document.getElementById('examStatMedian').textContent, '12/20');
    assert.ok(dom.window.document.getElementById('examStatStdDev').textContent !== '--');
    assert.ok(dom.window.document.getElementById('examStatCV').textContent.includes('%'));
    assert.ok(dom.window.document.getElementById('examReportStreamNormBadge').textContent.includes('4 فروض/دورة'));
    assert.ok(dom.window.document.getElementById('examReportStreamNormBadge').textContent.includes('معامل 9'));

    // Verify progression strip shows F1..F4 for 2BAC-SM-1
    const prog = win.computeExamProgressionForClass('2BAC-SM-1', 's1');
    assert.equal(prog.length, 4);
    assert.equal(prog[0].avgMark, 12);
    assert.equal(prog[1].avgMark, 12.75);
    assert.equal(prog[1].delta, 0.75);

    // Verify auto diagnostics generator fills difficulties and remediation
    const diag = win.generateAutoExamPedagogicalDiagnostics();
    assert.ok(diag.difficulties.includes('12/20'));
    assert.ok(diag.remediation.includes('فرض محروس تعويضي'));
    assert.equal(dom.window.document.getElementById('examReportDifficulties').value, diag.difficulties);

    // Verify makeup exam key normalization ('1' -> 'f1') & convocation print without ReferenceError
    win.quickUpdateMakeupJustification('s4', 'justified_admin');
    const makeupKeyExpected = '2BAC-SM-1__s1__f1__s4';
    assert.ok(win.db.makeupExams[makeupKeyExpected], 'Makeup registry should store under normalized f1 key');
    assert.equal(win.db.makeupExams[makeupKeyExpected].justification, 'justified_admin');

    win.printOfficialMakeupExamConvocation();
    assert.ok(capturedPrintHtml.includes('محضر واستدعاء اجتياز الفرض المحروس التعويضي رقم 1'));
    assert.ok(capturedPrintHtml.includes('وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل'));
    assert.ok(capturedPrintHtml.includes('تلميذ 4'));

    // Apply makeup mark via inline input (selecting '1' in #examReportNumber must write to 'f1')
    const inlineInput = dom.window.document.getElementById('inlineMakeupMark_s4');
    assert.ok(inlineInput);
    inlineInput.value = '13.5';
    win.applyMakeupExamMarkInline('s4');
    assert.equal(win.db.grades['2BAC-SM-1'].s4.s1.f1, 13.5);
    assert.equal(dom.window.document.getElementById('examStatAbsent').textContent, '0');
    assert.equal(dom.window.document.getElementById('examStatPresent').textContent, '4');

    // Verify companion JSON export payload & cleanup safety
    const companionPayload = win.exportExamFeedbackToCompanionJson();
    assert.equal(companionPayload.protocol, 'PEDAGOGICAL_COMPANION_BRIDGE_V1');
    assert.equal(companionPayload.kind, 'exam_feedback');
    assert.equal(companionPayload.examKey, 'f1');

    win.cleanupExamReportMemory();
    win.printOfficialExamReport();
    assert.ok(capturedPrintHtml.includes('بطاقة تقرير وتتبع الفرض المحروس رقم 1'));
    assert.ok(capturedPrintHtml.includes('وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل'));
});

test('Tablet Report Pane & Custom Print Preview: auto-opens print preview modal, applies selected margins live & in @page, and prevents XSS', () => {
    const appCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

    // Extract key self-contained functions from public/app.js for direct VM execution
    const extractFnBlock = (startMarker, endMarker) => {
        const startIdx = appCode.indexOf(startMarker);
        assert.ok(startIdx !== -1, `Missing marker: ${startMarker}`);
        const endIdx = appCode.indexOf(endMarker, startIdx);
        assert.ok(endIdx !== -1, `Missing end marker: ${endMarker}`);
        return appCode.slice(startIdx, endIdx);
    };

    const marginsHelpersBlock = extractFnBlock(
        'function getStudentPrintModeOptions()',
        'function resolveSelectedReportStudent()'
    );
    const tabletReportBlock = extractFnBlock(
        'function onTabletReportMarginPresetChange(',
        'function closeTabletReport()'
    );
    const printPreviewBlock = extractFnBlock(
        'function printDocumentDirectly(',
        '// محول اعتراض نوافذ الطباعة الفارغة'
    );

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <select id="reportClassSelect"><option value="2BAC-PC-1" selected>2BAC-PC-1</option></select>
        <select id="reportStudentSelect"><option value="st_42" selected>st_42</option></select>
        <div id="studentBehaviorDetails">
            <div id="printBehaviorArea">
                <div class="student-print-official-header" style="display:none;">الترويسة الرسمية</div>
                <div class="student-unified-identity-card">التلميذ التجريبي</div>
                <div class="student-print-inline-chart-box" style="display:none;"><svg><polyline points="0,0 10,10" /></svg><span>مبيان تطور نقط الفروض</span></div>
                <div class="student-print-visas-section" style="display:none;">التأشيرات</div>
                <button class="no-print">زر لا يُطبع</button>
            </div>
        </div>
        <div id="tabletReportPane"><div id="tabletReportContent"></div></div>
    </body></html>`);

    Object.defineProperty(win, 'innerWidth', { value: 1280, configurable: true });
    const mockDb = {
        settings: {
            printModePageSize: 'a4',
            printModeMarginsPreset: 'normal',
            printModeMarginTop: 10,
            printModeMarginRight: 10,
            printModeMarginBottom: 10,
            printModeMarginLeft: 10,
            printModeOptProgressChart: true,
            printModeOptAbsenceChart: true
        },
        classes: {
            '2BAC-PC-1': [
                { id: 'st_42', name: 'ياسين <img src=x onerror=alert(1)>', orderNum: 7, massar: 'R130042424' }
            ]
        },
        behaviors: {
            '2BAC-PC-1': {
                st_42: { status: 'منضبط', note: 'ملاحظة <script>evil()</script> جيدة' }
            }
        },
        grades: {
            '2BAC-PC-1': {
                st_42: { f1: 15, f2: 16 }
            }
        }
    };

    const escapeHtmlImpl = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    Object.assign(sandbox, {
        db: mockDb,
        MOROCCAN_GOOGLE_FONTS_LINK: 'https://fonts.googleapis.com/css2?family=Cairo',
        escapeHtml: escapeHtmlImpl,
        saveDB: () => {},
        saveData: () => {},
        applyTypographySettings: () => {},
        getSelectedPrintFontFamily: () => "'Cairo', 'Amiri', sans-serif",
        getSelectedHandwritingFontFamily: () => "'Aref Ruqaa', serif",
        getStudentClassRecordsFast: () => [],
        getRecordAbsenceDuration: () => 0,
        calculateStudentAvg: () => 15.5,
        getSubjectCoefForClass: () => 7,
        renderReport: () => {},
        updateStudentProgressChart: () => {},
        showAppToast: () => {}
    });
    win.db = mockDb;
    win.escapeHtml = escapeHtmlImpl;

    vm.runInContext(marginsHelpersBlock + '\n' + tabletReportBlock + '\n' + printPreviewBlock, sandbox, {
        filename: 'tablet-report-print-preview.vm.js'
    });

    // 1. Render tabletReportPane and verify XSS escaping + new print button, margin selector, and include-charts toggle
    win.showTabletReport('2BAC-PC-1', 'st_42');
    const contentEl = dom.window.document.getElementById('tabletReportContent');
    assert.ok(contentEl.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'), 'Student name should be HTML-escaped in tabletReportPane');
    assert.ok(contentEl.innerHTML.includes('&lt;script&gt;evil()&lt;/script&gt;'), 'Behavior note should be HTML-escaped in tabletReportPane');
    assert.equal(contentEl.querySelector('img'), null, 'No raw injected <img> element should exist');

    const tabletMarginSel = dom.window.document.getElementById('tabletReportPrintMarginsSelect');
    const tabletPrintBtn = dom.window.document.getElementById('btnTabletPrintIndividualReport');
    const tabletChartsChk = dom.window.document.getElementById('tabletReportIncludeChartsCheckbox');
    assert.ok(tabletMarginSel, 'Margin selector should exist inside tabletReportPane');
    assert.ok(tabletPrintBtn, 'Print individual report button should exist inside tabletReportPane');
    assert.ok(tabletPrintBtn.textContent.includes('طباعة التقرير الفردي'));
    assert.ok(tabletChartsChk, 'Include charts checkbox should exist inside tabletReportPane');
    assert.equal(tabletChartsChk.checked, true, 'Include charts should default to checked');
    assert.ok(contentEl.textContent.includes('تضمين المخططات البيانية'));

    // 2. Uncheck 'تضمين المخططات البيانية' and choose narrow margins (6mm) before opening preview
    tabletChartsChk.checked = false;
    win.onTabletReportIncludeChartsChange(false);
    assert.equal(mockDb.settings.printModeOptProgressChart, false);
    assert.equal(mockDb.settings.printModeOptAbsenceChart, false);

    tabletMarginSel.value = 'narrow';
    win.onTabletReportMarginPresetChange('narrow');
    assert.equal(mockDb.settings.printModeMarginsPreset, 'narrow');

    const opened = win.openTabletIndividualReportPrintPreview('2BAC-PC-1', 'st_42');
    assert.equal(opened, true, 'openTabletIndividualReportPrintPreview should open preview modal');

    const modalEl = dom.window.document.getElementById('customReportPreviewModal');
    assert.ok(modalEl, 'Custom Print Preview Modal should open automatically');

    const previewMarginSel = dom.window.document.getElementById('selCustomPreviewMargins');
    const previewChartsChk = dom.window.document.getElementById('chkCustomPreviewIncludeCharts');
    const sheetEl = dom.window.document.getElementById('customReportPrintableSheet');
    const chartBoxInSheet = sheetEl.querySelector('.student-print-inline-chart-box');
    assert.ok(previewMarginSel, 'Margin selector should exist inside Print Preview Modal');
    assert.ok(previewChartsChk, 'Include charts checkbox should exist inside Print Preview Modal toolbar');
    assert.equal(previewChartsChk.checked, false, 'Preview charts toggle should inherit unchecked state from tabletReportPane');
    assert.equal(chartBoxInSheet.style.display, 'none', 'Chart box should be hidden when include-charts is unchecked');
    assert.equal(previewMarginSel.value, 'narrow', 'Preview margin selector should inherit tabletReportPane preset');
    assert.equal(sheetEl.style.paddingTop, '6mm', 'Live preview sheet top padding should reflect 6mm narrow margin');
    assert.equal(sheetEl.style.paddingRight, '6mm', 'Live preview sheet right padding should reflect 6mm narrow margin');
    assert.equal(sheetEl.style.paddingBottom, '6mm', 'Live preview sheet bottom padding should reflect 6mm narrow margin');
    assert.equal(sheetEl.style.paddingLeft, '6mm', 'Live preview sheet left padding should reflect 6mm narrow margin');
    assert.equal(sheetEl.querySelector('.no-print'), null, 'No-print buttons must be stripped from preview clone');

    // 3. Switch to custom margins inside preview modal and verify live sheet update + @page injection + chart exclusion
    previewMarginSel.value = 'custom';
    previewMarginSel.onchange();
    const topInp = dom.window.document.getElementById('inpCustomPreviewMarginTop');
    const rightInp = dom.window.document.getElementById('inpCustomPreviewMarginRight');
    const bottomInp = dom.window.document.getElementById('inpCustomPreviewMarginBottom');
    const leftInp = dom.window.document.getElementById('inpCustomPreviewMarginLeft');
    topInp.value = '12';
    topInp.onchange();
    rightInp.value = '8';
    rightInp.onchange();
    bottomInp.value = '14';
    bottomInp.onchange();
    leftInp.value = '9';
    leftInp.onchange();

    assert.equal(sheetEl.style.padding, '12mm 8mm 14mm 9mm', 'Sheet padding should update live for custom margins');
    assert.equal(mockDb.settings.printModeMarginTop, 12);
    assert.equal(mockDb.settings.printModeMarginLeft, 9);

    // Capture written HTML in print iframe (charts excluded)
    let printedDocHtml = '';
    const fakeIframe = dom.window.document.createElement('iframe');
    fakeIframe.id = 'globalAppPrintIframe';
    Object.defineProperty(fakeIframe, 'contentWindow', {
        value: {
            document: {
                open() {},
                write(str) { printedDocHtml = str; },
                close() {}
            },
            focus() {},
            print() {}
        }
    });
    dom.window.document.body.appendChild(fakeIframe);

    dom.window.document.getElementById('btnDirectPrintCustomPreview').click();
    assert.ok(printedDocHtml.includes('margin: 12mm 8mm 14mm 9mm !important;'), 'printDocumentDirectly must emit exact custom @page margins');
    assert.equal(printedDocHtml.includes('student-print-inline-chart-box'), false, 'Disabled chart block must be stripped from printed document');

    // 4. Re-enable 'تضمين المخططات البيانية' live inside preview modal and verify sync + inclusion in printed HTML
    previewChartsChk.checked = true;
    previewChartsChk.onchange();
    assert.equal(chartBoxInSheet.style.display, 'block', 'Chart box should become visible live when re-enabled');
    assert.equal(tabletChartsChk.checked, true, 'tabletReportPane checkbox should sync back to checked');
    assert.equal(mockDb.settings.printModeOptProgressChart, true);

    // 5. Verify Official Header & Official Visas toggles between tabletReportPane and Print Preview Modal
    const tabletHeaderChk = dom.window.document.getElementById('tabletReportOfficialHeaderCheckbox');
    const tabletVisasChk = dom.window.document.getElementById('tabletReportOfficialVisasCheckbox');
    const previewHeaderChk = dom.window.document.getElementById('chkCustomPreviewOfficialHeader');
    const previewVisasChk = dom.window.document.getElementById('chkCustomPreviewOfficialVisas');
    assert.ok(tabletHeaderChk && tabletVisasChk, 'Official header and visas checkboxes must exist in tabletReportPane');
    assert.ok(previewHeaderChk && previewVisasChk, 'Official header and visas checkboxes must exist in Print Preview Modal toolbar');

    previewHeaderChk.checked = false;
    previewHeaderChk.onchange();
    previewVisasChk.checked = false;
    previewVisasChk.onchange();
    assert.equal(tabletHeaderChk.checked, false, 'tabletReportPane header checkbox should sync with preview');
    assert.equal(tabletVisasChk.checked, false, 'tabletReportPane visas checkbox should sync with preview');

    dom.window.document.getElementById('btnDirectPrintCustomPreview').click();
    assert.equal(printedDocHtml.includes('student-print-inline-chart-box'), true, 'Re-enabled chart block must be included in printed document');
    assert.equal(printedDocHtml.includes('student-print-official-header'), false, 'Disabled official header must be stripped from printed document');
    assert.equal(printedDocHtml.includes('student-print-visas-section'), false, 'Disabled official visas section must be stripped from printed document');

    // 6. Verify #studentPrintModeControlBar in index.html contains #barPrintOptProgressChart ('تضمين المخططات البيانية للأداء')
    const indexHtmlCode = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(indexHtmlCode.includes('id="barPrintOptProgressChart"'), '#barPrintOptProgressChart must exist inside #studentPrintModeControlBar in index.html');
    assert.ok(indexHtmlCode.includes('تضمين المخططات البيانية للأداء'), 'Label تضمين المخططات البيانية للأداء must exist in #studentPrintModeControlBar');

    // 7. Verify toggleStudentAttendancePrintComponent automatic chart & section rearrangement (zero empty spaces)
    const reflowBlock = extractFnBlock(
        'function applyPrintModePageSetupToDOM()',
        'function setStudentAttendancePrintPreset('
    );
    vm.runInContext(reflowBlock, sandbox, { filename: 'toggle-reflow.vm.js' });

    const chartCont = dom.window.document.createElement('div');
    chartCont.id = 'studentChartContainer';
    chartCont.innerHTML = `
        <div id="studentChartsGrid" style="display:grid;">
            <div id="studentProgressChartCard"></div>
            <div id="studentAttendanceChartCard"></div>
        </div>
    `;
    dom.window.document.body.appendChild(chartCont);

    // Hide progressChart only -> attendanceCard moves to order 1 and grid becomes 1fr (no empty column)
    mockDb.settings.printModeOptProgressChart = false;
    mockDb.settings.printModeOptAbsenceChart = true;
    win.reflowStudentReportChartsAndSections();
    assert.equal(dom.window.document.getElementById('studentProgressChartCard').style.display, 'none');
    assert.equal(dom.window.document.getElementById('studentAttendanceChartCard').style.display, 'block');
    assert.equal(dom.window.document.getElementById('studentAttendanceChartCard').style.order, '1');
    assert.equal(dom.window.document.getElementById('studentChartsGrid').style.gridTemplateColumns, '1fr');

    // Hide both charts via toggleStudentAttendancePrintComponent('progressChart', false) -> entire container collapses with 0px margin
    win.toggleStudentAttendancePrintComponent('progressChart', false);
    assert.equal(chartCont.style.display, 'none');
    assert.equal(chartCont.style.marginBottom, '0px');
    const inlineChartInPrintArea = dom.window.document.querySelector('#printBehaviorArea .student-print-inline-chart-box');
    assert.equal(inlineChartInPrintArea.style.display, 'none');
    assert.equal(inlineChartInPrintArea.style.marginBottom, '0px');

    // Re-enable via toggleStudentAttendancePrintComponent('progressChart', true) -> charts expand & rearrange back
    win.toggleStudentAttendancePrintComponent('progressChart', true);
    assert.equal(chartCont.style.display, 'block');
    assert.equal(chartCont.style.marginBottom, '18px');
    assert.equal(inlineChartInPrintArea.style.display, 'block');
});

test('Dashboard AI Class Diagnostics & Classroom Privacy Mode (Law 09-08): computes class comparisons, opens printable modal, and toggles privacy blur', () => {
    const appJsCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const startIdx = appJsCode.indexOf('function toggleClassroomPrivacyMode(');
    assert.ok(startIdx !== -1, 'toggleClassroomPrivacyMode must exist in app.js');
    const endIdx = appJsCode.indexOf('window.printDashboardAiClassDiagnostics = printDashboardAiClassDiagnostics;');
    assert.ok(endIdx !== -1, 'printDashboardAiClassDiagnostics must exist in app.js');
    const blockCode = appJsCode.slice(startIdx, endIdx + 'window.printDashboardAiClassDiagnostics = printDashboardAiClassDiagnostics;'.length);

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <button id="btnPrivacy" onclick="window.toggleClassroomPrivacyMode && window.toggleClassroomPrivacyMode()">خصوصية 09-08</button>
    </body></html>`);

    const mockDb = {
        settings: {},
        classes: {
            '2BAC-SM-1': [
                { id: 's1', name: 'سلمى العلوي', massar: 'R110011001' },
                { id: 's2', name: 'يوسف الإدريسي', massar: 'R110011002' }
            ],
            'TCS-1': [
                { id: 's3', name: 'أمين التازي', massar: 'R110011003' }
            ]
        },
        grades: {
            '2BAC-SM-1': { s1: { avg: 16.5 }, s2: { avg: 14.5 } },
            'TCS-1': { s3: { avg: 8.5 } }
        },
        records: [
            { class: 'TCS-1', studentId: 's3', status: 'غائب' }
        ],
        behaviors: {}
    };

    let previewCalledWith = null;
    Object.assign(sandbox, {
        db: mockDb,
        activeSemester: 's1',
        escapeHtml: (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        saveDB: () => {},
        showAppToast: () => {},
        calculateStudentAvg: (gObj) => (gObj && typeof gObj.avg === 'number' ? gObj.avg : null),
        getRecordAbsenceDuration: () => 2,
        openCustomPrintPreviewModal: (html, opts) => { previewCalledWith = { html, opts }; }
    });
    win.db = mockDb;

    vm.runInContext(blockCode, sandbox, { filename: 'diagnostics-privacy.vm.js' });

    // 1. Verify Law 09-08 Classroom Privacy Mode toggle
    const active1 = win.toggleClassroomPrivacyMode();
    assert.equal(active1, true);
    assert.equal(dom.window.document.body.classList.contains('classroom-privacy-0908-active'), true);
    assert.equal(mockDb.settings.classroomPrivacyMode0908, true);
    assert.ok(dom.window.document.getElementById('classroomPrivacy0908Style'), 'Privacy CSS style tag should be injected');

    const active2 = win.toggleClassroomPrivacyMode();
    assert.equal(active2, false);
    assert.equal(dom.window.document.body.classList.contains('classroom-privacy-0908-active'), false);

    // 2. Verify AI Class Diagnostics computation, modal rendering, and print preview integration
    const diagnostics = win.openDashboardAiClassDiagnostics();
    assert.equal(diagnostics.length, 2);
    const sm1 = diagnostics.find(d => d.className === '2BAC-SM-1');
    const tcs1 = diagnostics.find(d => d.className === 'TCS-1');
    assert.equal(sm1.mean, 15.5);
    assert.equal(sm1.passRate, 100);
    assert.equal(tcs1.mean, 8.5);
    assert.equal(tcs1.strugglingCount, 1);
    assert.equal(tcs1.totalAbsentHours, 2);

    const diagModal = dom.window.document.getElementById('dashboardAiClassDiagnosticsModal');
    assert.ok(diagModal, 'Diagnostics modal must render in DOM');
    assert.ok(diagModal.textContent.includes('2BAC-SM-1'));
    assert.ok(diagModal.textContent.includes('TCS-1'));

    const printed = win.printDashboardAiClassDiagnostics();
    assert.equal(printed, true);
    assert.ok(previewCalledWith, 'printDashboardAiClassDiagnostics should open Custom Print Preview Modal');
    assert.ok(previewCalledWith.html.includes('وزارة التربية الوطنية والتعليم الأولي والتكوين المهني والتأهيل'));
});

test('Student Print Report: renders empty incident dates with unified formatting in studentAttendancePrintComponent and AI Trend Indicator above print chart', () => {
    const appJsCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    assert.ok(appJsCode.includes('id="studentAttendancePrintComponent"'), 'studentAttendancePrintComponent ID must exist in app.js');
    assert.ok(appJsCode.includes('class="incident-log-empty-date-row"'), 'incident-log-empty-date-row class must exist in app.js');
    assert.ok(appJsCode.includes('id="studentPrintAiTrendIndicator"'), 'studentPrintAiTrendIndicator ID must exist in app.js');
    assert.ok(appJsCode.includes('مؤشر الأداء الذكي (AI Trend Indicator)'), 'AI Trend Indicator title must exist in app.js');

    // Extract computeAiTrendAnalysis logic and verify upward, downward, fluctuating, and single-point cases
    const fnStart = appJsCode.indexOf('const computeAiTrendAnalysis = (pts, studentAvg, clsAvg) => {');
    const fnEnd = appJsCode.indexOf('window.computeStudentAiTrendIndicator = computeAiTrendAnalysis;');
    assert.ok(fnStart !== -1 && fnEnd !== -1, 'computeAiTrendAnalysis must be defined and exposed');
    const fnCode = appJsCode.slice(fnStart, fnEnd + 'window.computeStudentAiTrendIndicator = computeAiTrendAnalysis;'.length);

    const { win, sandbox } = createDomSandbox('<!DOCTYPE html><html dir="rtl" lang="ar"><body></body></html>');
    vm.runInContext(fnCode, sandbox, { filename: 'ai-trend-indicator.vm.js' });

    assert.equal(typeof win.computeStudentAiTrendIndicator, 'function');

    // 1. Upward trajectory
    const upward = win.computeStudentAiTrendIndicator(
        [{ label: 'الفرض الأول', val: 12.0 }, { label: 'الفرض الثاني', val: 15.5 }, { label: 'الفرض الثالث', val: 17.0 }],
        14.83,
        13.0
    );
    assert.equal(upward.direction, 'upward');
    assert.ok(upward.badgeText.includes('اتجاه تصاعدي مستمر'));
    assert.ok(upward.noteText.includes('+5.00'));

    // 2. Downward trajectory
    const downward = win.computeStudentAiTrendIndicator(
        [{ label: 'الفرض الأول', val: 14.0 }, { label: 'الفرض الثاني', val: 10.5 }],
        12.25,
        12.5
    );
    assert.equal(downward.direction, 'downward');
    assert.ok(downward.badgeText.includes('اتجاه تنازلي'));
    assert.ok(downward.noteText.includes('3.50'));

    // 3. Fluctuating trajectory
    const fluctuating = win.computeStudentAiTrendIndicator(
        [{ label: 'الفرض الأول', val: 11.0 }, { label: 'الفرض الثاني', val: 15.0 }, { label: 'الفرض الثالث', val: 12.0 }],
        12.67,
        12.0
    );
    assert.equal(fluctuating.direction, 'fluctuating');
    assert.ok(fluctuating.badgeText.includes('أداء متذبذب'));
});

test('Security & Gmail Hardening: PBKDF2 password hashing, URL protocol guard, quick-lock reauth enforcement, in-memory OAuth token, RS256 server JWT & Electron sandbox', async () => {
    const appJsCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const firebaseCode = fs.readFileSync(path.join(ROOT, 'public/firebase-setup.js'), 'utf8');
    const calendarCode = fs.readFileSync(path.join(ROOT, 'public/google-calendar-sync.js'), 'utf8');
    const resourcesCode = fs.readFileSync(path.join(ROOT, 'public/resources.js'), 'utf8');
    const serverCode = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
    const electronMainCode = fs.readFileSync(path.join(ROOT, 'electron/main.cjs'), 'utf8');

    // 1. Verify openSafeExternalUrl strictly blocks javascript:/data: and allows https:/mailto:
    const urlStart = appJsCode.indexOf('window.openSafeExternalUrl = function');
    const urlEnd = appJsCode.indexOf('window.notifySafeToast = function', urlStart);
    assert.ok(urlStart !== -1 && urlEnd > urlStart, 'openSafeExternalUrl must exist in public/app.js');

    const clickedAnchors = [];
    const { dom: urlDom, win: urlWin, sandbox: urlSandbox } = createDomSandbox('<!DOCTYPE html><html><body></body></html>');
    urlSandbox.URL = globalThis.URL;
    const origCreateEl = urlDom.window.document.createElement.bind(urlDom.window.document);
    urlDom.window.document.createElement = (tag) => {
        const el = origCreateEl(tag);
        if (String(tag).toLowerCase() === 'a') {
            el.click = () => clickedAnchors.push({ href: el.href, rel: el.rel, target: el.target });
        }
        return el;
    };
    vm.runInContext(appJsCode.slice(urlStart, urlEnd), urlSandbox, { filename: 'safe-url.vm.js' });

    assert.equal(urlWin.openSafeExternalUrl('javascript:alert(1)'), null, 'Must block javascript: URLs');
    assert.equal(urlWin.openSafeExternalUrl('data:text/html,<script>alert(1)</script>'), null, 'Must block data: URLs');
    assert.ok(urlWin.openSafeExternalUrl('https://men.gov.ma/test') !== null, 'Must allow https: URLs');
    assert.ok(urlWin.openSafeExternalUrl('mailto:teacher@example.com') !== null, 'Must allow mailto: URLs');
    assert.equal(clickedAnchors.length, 2);
    assert.equal(clickedAnchors[0].rel, 'noopener noreferrer');
    assert.equal(clickedAnchors[0].target, '_blank');

    // 2 & 3. Verify PBKDF2-SHA256 teacher password hashing, legacy compatibility, and strict Google reauth lock
    const secStart = appJsCode.indexOf('function constantTimeStringEqual(a, b) {');
    const secEndMarker = 'window.unlockViaGoogleReauth = unlockViaGoogleReauth;';
    const secEnd = appJsCode.indexOf(secEndMarker, secStart);
    assert.ok(secStart !== -1 && secEnd > secStart, 'PBKDF2 & quick-lock helpers must exist in public/app.js');

    const { dom: lockDom, win: lockWin, sandbox: lockSandbox } = createDomSandbox(`<!DOCTYPE html><html><body>
        <div id="quickLockScreenModal" style="display:flex;"></div>
        <div id="quickUnlockErrorMsg" style="display:none;"></div>
        <input id="quickUnlockPasswordInput" />
    </body></html>`);
    Object.defineProperty(lockWin, 'crypto', { value: globalThis.crypto, configurable: true });
    lockSandbox.TextEncoder = globalThis.TextEncoder;
    lockSandbox.Uint8Array = globalThis.Uint8Array;
    lockSandbox.db = { teacherProfile: { email: 'teacher@gmail.com', password: '' }, settings: {} };
    lockSandbox.saveDB = () => {};
    lockSandbox.showNotification = () => {};
    vm.runInContext(appJsCode.slice(secStart, secEnd + secEndMarker.length), lockSandbox, { filename: 'security-lock.vm.js' });

    const hashed = await lockWin.hashTeacherPasswordSecure('Math@2026!Strong');
    assert.ok(hashed.startsWith('pbkdf2$100000$'), 'Password hash must use PBKDF2 with 100,000 iterations');
    assert.equal(await lockWin.verifyPasswordMatch('Math@2026!Strong', hashed), true, 'Correct password must match PBKDF2 hash');
    assert.equal(await lockWin.verifyPasswordMatch('WrongPassword123', hashed), false, 'Wrong password must fail PBKDF2 hash');

    const legacySha = await lockWin.hashPasswordSHA256('LegacyPass2025');
    assert.equal(await lockWin.verifyPasswordMatch('LegacyPass2025', legacySha), true, 'Legacy SHA-256 hash must still verify for smooth auto-migration');
    assert.equal(await lockWin.verifyPasswordMatch('LegacyPass2025', 'LegacyPass2025'), true, 'Legacy plaintext must still verify for smooth auto-migration');
    assert.equal(await lockWin.verifyPasswordMatch('WrongPass', 'LegacyPass2025'), false);

    // 3a. Must NOT unlock from localStorage flags alone when Google OAuth fails
    lockWin.localStorage.setItem('gdrive_authenticated', 'true');
    lockWin.localStorage.setItem('gdrive_last_email', 'teacher@gmail.com');
    lockWin.handleGoogleSignInOfficial = async () => null;
    lockWin.getVerifiedFirebaseAuthUser = () => null;
    await lockWin.unlockViaGoogleReauth();
    assert.equal(lockDom.window.document.getElementById('quickLockScreenModal').style.display, 'flex', 'Quick lock must stay locked when Google OAuth fails even if localStorage flags are set');

    // 3b. Must NOT unlock if a different Google email signs in
    lockWin.handleGoogleSignInOfficial = async () => 'ya29.real_oauth_token_sample_1234567890';
    lockWin.getVerifiedFirebaseAuthUser = () => ({ email: 'other.user@gmail.com' });
    await lockWin.unlockViaGoogleReauth();
    assert.equal(lockDom.window.document.getElementById('quickLockScreenModal').style.display, 'flex', 'Quick lock must reject mismatched Google account');

    // 3c. Must unlock ONLY when verified Google account matches owner email
    lockWin.getVerifiedFirebaseAuthUser = () => ({ email: 'teacher@gmail.com' });
    await lockWin.unlockViaGoogleReauth();
    assert.equal(lockDom.window.document.getElementById('quickLockScreenModal').style.display, 'none', 'Quick lock must unlock when verified Google account matches owner');

    // 4. Verify Gmail / OAuth hardening invariants in firebase-setup.js, google-calendar-sync.js, and resources.js
    assert.equal(firebaseCode.includes('brahim.kouziber87@gmail.com'), false, 'No hardcoded personal email allowed in firebase-setup.js');
    assert.equal(/sessionStorage\.(set|get)Item\(\s*['"]gdrive_access_token['"]/.test(firebaseCode), false, 'firebase-setup.js must not store/read OAuth token in sessionStorage');
    assert.equal(/sessionStorage\.(set|get)Item\(\s*['"]gdrive_access_token['"]/.test(calendarCode), false, 'google-calendar-sync.js must not read OAuth token from sessionStorage');
    assert.equal(/sessionStorage\.(set|get)Item\(\s*['"]gdrive_access_token['"]/.test(resourcesCode), false, 'resources.js must not read OAuth token from sessionStorage');
    assert.equal(firebaseCode.includes("'direct_gmail_token_' + Date.now()"), false, 'Must not fabricate direct_gmail_token_* tokens');
    assert.ok(firebaseCode.includes('window.getVerifiedFirebaseAuthUser'), 'Must expose verified Firebase auth user helper');
    assert.ok(firebaseCode.includes('showConfirmDialog'), 'handleClearAllBackups must require user confirmation via showConfirmDialog');

    // 5. Verify server.ts RS256 Firebase JWT verification, 100k PBKDF2 shares, no req.query.pin, and WebSocket hardening
    assert.ok(serverCode.includes("crypto.createVerify('RSA-SHA256')"), 'server.ts must cryptographically verify Firebase ID tokens using RSA-SHA256');
    assert.ok(serverCode.includes('securetoken@system.gserviceaccount.com'), 'server.ts must fetch official Google X.509 certificates for Firebase ID tokens');
    assert.ok(serverCode.includes('const SHARE_PBKDF2_ITERATIONS = 100000;'), 'server.ts must use 100,000 PBKDF2 iterations for new encrypted shares');
    assert.equal(serverCode.includes('req.query.pin'), false, 'server.ts must never read share PIN from URL query parameters');
    assert.ok(serverCode.includes('maxPayload: 2 * 1024 * 1024'), 'WebSocket server must enforce maxPayload limit');
    assert.ok(serverCode.includes('Cross-origin WebSocket rejected'), 'WebSocket server must block cross-origin upgrades (CSWSH)');
    assert.ok(serverCode.includes("const senderRole = currentPeer ? currentPeer.role : 'student';"), 'Unjoined WebSocket peers must default to student role');

    // 6. Verify zero hardcoded personal emails & zero javascript:void(0) URIs across core app files
    const indexHtmlCode = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const idbCode = fs.readFileSync(path.join(ROOT, 'src/services/indexedDbEngine.ts'), 'utf8');
    const tutoringAdvCode = fs.readFileSync(path.join(ROOT, 'public/tutoring-advanced.js'), 'utf8');
    assert.equal(indexHtmlCode.includes('brahim.kouziber87@gmail.com'), false, 'No hardcoded personal email allowed in index.html');
    assert.equal(idbCode.includes('brahim.kouziber87@gmail.com'), false, 'No hardcoded personal email allowed in indexedDbEngine.ts');
    assert.equal(resourcesCode.includes('javascript:void(0)'), false, 'No javascript:void(0) URIs allowed in resources.js');
    assert.equal(tutoringAdvCode.includes('javascript:void(0)'), false, 'No javascript:void(0) URIs allowed in tutoring-advanced.js');

    // 7. Verify Firestore rules default-deny & verified email boundary
    const rulesCode = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    assert.ok(rulesCode.includes('allow read, write: if false;'), 'firestore.rules must include global default-deny');
    assert.ok(rulesCode.includes('request.auth.token.email_verified == true'), 'firestore.rules must require verified email');
    assert.ok(!rulesCode.includes('!isSignedIn()'), 'firestore.rules must never bypass auth with !isSignedIn()');

    // 8. Verify Electron BrowserWindow sandbox hardening
    assert.ok(/sandbox:\s*true/.test(electronMainCode), 'electron/main.cjs must enable renderer sandbox: true');
    assert.ok(/contextIsolation:\s*true/.test(electronMainCode), 'electron/main.cjs must keep contextIsolation: true');
    assert.ok(/nodeIntegration:\s*false/.test(electronMainCode), 'electron/main.cjs must keep nodeIntegration: false');
});

test('Gmail Account Linking Lifecycle: confirmGmailQuickSwitch, activateDirectGmailSession, GIS OAuth verification, header badge & teacherProfile sync', async () => {
    const firebaseCode = fs.readFileSync(path.join(ROOT, 'public/firebase-setup.js'), 'utf8');

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <div id="loginScreen" style="display:flex;">
            <input id="loginDriveEmailInput" value="" />
            <div id="loginDriveSyncStatus" style="display:none;"></div>
        </div>
        <div id="headerDriveSyncBadge" class="header-chip"><span id="headerDriveSyncText">ربط البريد الموثّق</span></div>
        <div id="backupStatus">غير مسجل الدخول</div>
        <button id="backupLoginBtn" style="display:flex;"></button>
        <button id="backupLogoutBtn" style="display:none;"></button>
        <div id="backupActionBtns" style="display:none;"></div>
        <input id="teacherEmail" value="" />
    </body></html>`);

    // Extract the helper and Gmail linking blocks from public/firebase-setup.js
    const helpersStart = firebaseCode.indexOf('function safeStringify(obj, space)');
    const helpersEnd = firebaseCode.indexOf('// الحد الأقصى الآمن لحجم الوثيقة في Firestore');
    const tokenBlockStart = firebaseCode.indexOf('let cachedAccessToken = null;');
    const tokenBlockEnd = firebaseCode.indexOf('async function getBackupFileMetadata(accessToken)');
    const modalBlockStart = firebaseCode.indexOf('window.openGmailQuickSwitchModal = (prefillEmail = \'\') => {');
    const modalBlockEnd = firebaseCode.indexOf('// Auto-restore remembered email hint on load');

    assert.ok(helpersStart !== -1 && helpersEnd > helpersStart);
    assert.ok(tokenBlockStart !== -1 && tokenBlockEnd > tokenBlockStart);
    assert.ok(modalBlockStart !== -1 && modalBlockEnd > modalBlockStart);

    sandbox.auth = { currentUser: null };
    sandbox.provider = { setCustomParameters: () => {} };
    sandbox.basicGoogleProvider = { setCustomParameters: () => {} };
    sandbox.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    sandbox.unescape = globalThis.unescape;
    sandbox.CustomEvent = dom.window.CustomEvent;
    win.db = { teacherProfile: { name: 'ذ. أستاذ الرياضيات', email: '', password: '' } };
    win.checkForDriveUpdates = async () => ({ status: 'no_cloud_backup' });
    win.showAppToast = () => {};

    const combinedCode = [
        firebaseCode.slice(helpersStart, helpersEnd),
        firebaseCode.slice(tokenBlockStart, tokenBlockEnd),
        firebaseCode.slice(modalBlockStart, modalBlockEnd)
    ].join('\n');

    vm.runInContext(combinedCode, sandbox, { filename: 'gmail-linking-lifecycle.vm.js' });

    // 1. Open Gmail Quick Switch Modal, enter an email, and call confirmGmailQuickSwitch()
    win.openGmailQuickSwitchModal();
    const modalInp = dom.window.document.getElementById('gmailQuickSwitchInput');
    assert.ok(modalInp, 'gmailQuickSwitchInput must be created in DOM');
    modalInp.value = 'math.teacher2026@gmail.com';

    await win.confirmGmailQuickSwitch();

    assert.equal(win.localStorage.getItem('gdrive_last_email'), 'math.teacher2026@gmail.com');
    assert.equal(win.db.teacherProfile.email, 'math.teacher2026@gmail.com', 'teacherProfile.email must update when Gmail is linked');
    assert.equal(dom.window.document.getElementById('teacherEmail').value, 'math.teacher2026@gmail.com');
    assert.ok(win._directGmailUser && win._directGmailUser.email === 'math.teacher2026@gmail.com');
    assert.equal(dom.window.document.getElementById('headerDriveSyncBadge').classList.contains('synced'), true, 'Header badge must show synced class when Gmail is linked');
    assert.equal(dom.window.document.getElementById('headerDriveSyncText').textContent, 'Gmail: math.teacher2026 ✓');
    assert.equal(dom.window.document.getElementById('backupStatus').innerText, 'تم تسجيل الدخول كـ: math.teacher2026@gmail.com');
    // Unverified direct Gmail link must NOT be treated as a verified Firebase/OAuth user for lock-screen bypass
    assert.equal(win.getVerifiedFirebaseAuthUser(), null);
    // getGoogleDriveToken(false) must return null (never the email address string) when no OAuth token is active
    assert.equal(await win.getGoogleDriveToken(false), null, 'getGoogleDriveToken must never return an email address as an OAuth Bearer token');

    // 2. Activate session with a real Google OAuth access token (GIS / OAuth flow)
    const sampleOAuthToken = 'ya29.a0AfB_byCRealGoogleOAuthAccessTokenForDriveAndFirestore123456789';
    win.activateDirectGmailSession('math.teacher2026@gmail.com', true, 'أستاذ الرياضيات', sampleOAuthToken, { explicitLink: true });
    assert.equal(win.hasActiveDriveToken(), true);
    assert.equal(await win.getGoogleDriveToken(false), sampleOAuthToken, 'getGoogleDriveToken must return the real OAuth token when active');
    assert.ok(win.getVerifiedFirebaseAuthUser(), 'Real OAuth token session must be recognized as verified');
    assert.equal(win.getVerifiedFirebaseAuthUser().email, 'math.teacher2026@gmail.com');
    assert.equal(dom.window.document.getElementById('headerDriveSyncText').textContent, 'Google Drive: متزامن ✓');

    // 3. Verify zero blocking browser dialogs (alert/confirm/prompt) and zero platform strings across all public JS files
    const publicDir = path.join(ROOT, 'public');
    const collectJsFiles = (dir) => {
        const out = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...collectJsFiles(full));
            else if (entry.name.endsWith('.js')) out.push(full);
        }
        return out;
    };
    for (const file of collectJsFiles(publicDir)) {
        const rel = path.relative(ROOT, file);
        const src = fs.readFileSync(file, 'utf8');
        assert.equal(/(?:^|[^a-zA-Z0-9_$.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/.test(src), false, `No blocking alert/confirm/prompt allowed in ${rel}`);
        assert.equal(src.includes('AI Studio'), false, `No platform string allowed in ${rel}`);
    }
});

test('Multi-Class Unified Report Filter: selects 2 or more classes and aggregates combined reports, discipline KPIs, and absence data', () => {
    const appCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const multiStart = appCode.indexOf('function resolveReportTargetClasses(classSpec)');
    const multiEnd = appCode.indexOf('function populateReportStudentSelect(className)');
    const disciplineStart = appCode.indexOf('function updateClassDisciplineRate(className, dateFrom, dateTo)');
    const disciplineEnd = appCode.indexOf('function updateAttendancePieChart(className, counts)');
    const absStart = appCode.indexOf('function resolveTargetClassForAbsenceReport(explicitClass = null)');
    const absEnd = appCode.indexOf('function buildUnifiedClassAbsenceAndLatenessReportHtml(dataObj)');

    assert.ok(multiStart !== -1 && multiEnd !== -1, 'Multi-class report functions must exist in public/app.js');
    assert.ok(disciplineStart !== -1 && disciplineEnd !== -1, 'updateClassDisciplineRate must exist in public/app.js');
    assert.ok(absStart !== -1 && absEnd !== -1, 'computeUnifiedClassAbsenceAndLatenessData must exist in public/app.js');

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html><body>
        <div id="reportsView" style="display:block;">
            <span id="reportMultiClassActiveCountBadge"></span>
            <button id="btnToggleReportMultiClassPicker"></button>
            <select id="reportClassSelect">
                <option value="">-- اختر القسم --</option>
                <option value="__ALL__">جميع الأقسام</option>
                <option value="__MULTI__">أقسام متعددة</option>
            </select>
            <div id="reportMultiClassPickerPanel" style="display:none;">
                <div id="reportMultiClassPickerItems"></div>
                <div id="reportMultiClassMergedSummary"></div>
            </div>
            <input type="date" id="reportDateFrom" value="2026-09-01" />
            <input type="date" id="reportDateTo" value="2027-07-10" />
            <span id="reportTotalAbsent">0</span>
            <span id="reportTotalLate">0</span>
            <span id="reportTotalHw">0</span>
            <span id="reportAttendanceRateBadge"></span>
            <span id="reportAbsentRateBadge"></span>
            <span id="reportLateRateBadge"></span>
            <span id="reportHwRateBadge"></span>
            <span id="reportPassRateBadge"></span>
            <div id="disciplineRateCard">
                <span id="classDisciplineRate"></span>
                <span id="classAttendanceSessionsCount"></span>
                <span id="classAbsenceRateDetail"></span>
                <span id="classAbsenceHoursCount"></span>
                <span id="classHwRateDetail"></span>
                <span id="classHwCountText"></span>
                <span id="classPassRateDetail"></span>
                <span id="classPassCountText"></span>
                <span id="classExcellenceRateDetail"></span>
                <span id="classExcellenceCountText"></span>
                <span id="classAtRiskRateDetail"></span>
                <span id="classAtRiskCountText"></span>
            </div>
            <div id="atRiskStudentsCard"><div class="table-responsive"><table><tbody id="atRiskTableBody"></tbody></table></div><div id="atRiskEmptyMsg"></div></div>
            <table><tbody id="reportTableBody"></tbody></table>
            <div id="aiSupportPlanCard"></div>
        </div>
    </body></html>`);

    const mockDb = {
        classes: {
            '2BAC-PC-1': [
                { id: 's1', orderNum: 1, name: 'أحمد العلمي', massar: 'G1001' },
                { id: 's2', orderNum: 2, name: 'سلمى بنعلي', massar: 'G1002' }
            ],
            '2BAC-PC-2': [
                { id: 's3', orderNum: 1, name: 'يوسف المرابط', massar: 'G2001' },
                { id: 's4', orderNum: 2, name: 'مريم التازي', massar: 'G2002' }
            ],
            '1BAC-SM-1': [
                { id: 's5', orderNum: 1, name: 'عمر الفاسي', massar: 'G3001' }
            ]
        },
        records: [
            { id: 'r1', className: '2BAC-PC-1', studentId: 's1', date: '2026-10-12', session: '08:30 - 10:30', status: 'غائب', duration: 2, hours: 2 },
            { id: 'r2', className: '2BAC-PC-2', studentId: 's3', date: '2026-10-14', session: '10:30 - 12:30', status: 'غائب', duration: 2, hours: 2 },
            { id: 'r3', className: '2BAC-PC-2', studentId: 's4', date: '2026-10-15', session: '14:30 - 16:30', status: 'متأخر', duration: 1, hours: 1 },
            { id: 'r4', className: '1BAC-SM-1', studentId: 's5', date: '2026-10-16', session: '08:30 - 10:30', status: 'غائب', duration: 4, hours: 4 }
        ],
        grades: {
            '2BAC-PC-1': { s1: { f1: 14, f2: 16 }, s2: { f1: 12, f2: 12 } },
            '2BAC-PC-2': { s3: { f1: 8, f2: 9 }, s4: { f1: 15, f2: 17 } },
            '1BAC-SM-1': { s5: { f1: 18, f2: 19 } }
        },
        behaviors: {},
        teacherProfile: { name: 'ذ. أستاذ الرياضيات' }
    };

    sandbox.db = mockDb;
    win.db = mockDb;
    sandbox.getSortedClasses = () => ['2BAC-PC-1', '2BAC-PC-2', '1BAC-SM-1'];
    win.getSortedClasses = sandbox.getSortedClasses;
    sandbox.escapeHtml = (s) => String(s || '');
    win.escapeHtml = sandbox.escapeHtml;
    sandbox.lucideIcon = () => '';
    win.lucideIcon = sandbox.lucideIcon;
    sandbox.incrementClassUsage = () => {};
    sandbox.isRecordProtectedHolidayOrLeave = () => false;
    sandbox.getClassRecordsFast = (cls) => mockDb.records.filter(r => r.className === cls);
    sandbox.getStudentClassRecordsFast = (stdId, cls) => mockDb.records.filter(r => String(r.studentId) === String(stdId) && r.className === cls);
    sandbox.getTotalAbsentHours = (stdId, cls) => mockDb.records.filter(r => String(r.studentId) === String(stdId) && r.className === cls && (r.status === 'غائب' || r.status === 'مبرر')).reduce((s, r) => s + (r.hours || 1), 0);
    sandbox.calculateStudentAvg = (g) => {
        const vals = ['f1', 'f2'].map(k => parseFloat(g && g[k])).filter(v => !isNaN(v));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    sandbox.updateAttendancePieChart = () => {};
    sandbox.updateAbsenceByDayChart = () => {};
    sandbox.updateMonthlyAbsenceEvolutionChart = () => {};
    sandbox.updateReportGradesComparisonChart = () => {};
    sandbox.updateGradesDistributionChart = () => {};
    sandbox.updateStudentClassification = () => {};
    sandbox.populateReportStudentSelect = () => {};
    sandbox.CustomEvent = dom.window.CustomEvent;

    const snippet = [
        'window._selectedReportMultiClasses = [];',
        appCode.slice(multiStart, multiEnd),
        appCode.slice(disciplineStart, disciplineEnd),
        appCode.slice(absStart, absEnd)
    ].join('\n');

    vm.runInContext(snippet, sandbox, { filename: 'multi-class-report.vm.js' });

    // Select 2 classes: 2BAC-PC-1 and 2BAC-PC-2 (excluding 1BAC-SM-1)
    win.refreshReportClassDropdown();
    win.toggleReportMultiClassItem('2BAC-PC-1');
    win.toggleReportMultiClassItem('2BAC-PC-2');

    const selectEl = dom.window.document.getElementById('reportClassSelect');
    assert.equal(selectEl.value, '__MULTI__', 'Selecting 2 classes in multi-class picker must set reportClassSelect to __MULTI__');

    const resolved = win.resolveReportTargetClasses('__MULTI__');
    assert.equal(resolved.mode, 'multi');
    assert.equal(resolved.isMulti, true);
    assert.deepEqual(Array.from(resolved.classes), ['2BAC-PC-1', '2BAC-PC-2']);
    assert.equal(resolved.label, '2BAC-PC-1 + 2BAC-PC-2');

    // Verify combined report table and totals only include the 2 selected classes (4 students, 4 absent hours, 1 late)
    assert.equal(dom.window.document.getElementById('reportTotalAbsent').textContent, '4', 'Combined absent hours for 2BAC-PC-1 + 2BAC-PC-2 must be 4 (excluding 1BAC-SM-1)');
    assert.equal(dom.window.document.getElementById('reportTotalLate').textContent, '1', 'Combined late count for 2BAC-PC-1 + 2BAC-PC-2 must be 1');
    const renderedRows = dom.window.document.querySelectorAll('#reportTableBody tr');
    assert.equal(renderedRows.length, 4, 'Combined report table must render all 4 students from the 2 selected classes');

    // Verify official absence & lateness report data aggregates the 2 selected classes
    const absReport = win.computeUnifiedClassAbsenceAndLatenessData();
    assert.equal(absReport.meta.className, '2BAC-PC-1 + 2BAC-PC-2');
    assert.equal(absReport.totals.studentsCount, 4);
    assert.equal(absReport.totals.totalAbsentHours, 4);
    assert.equal(absReport.totals.totalLateCount, 1);
});

test('Secret PIN Re-Entry & Login Screen Direct Gmail Linking: verifies PIN re-entry across logout, blank/email username, Eastern Arabic digits, and saveAndCloseTeacherSettings', async () => {
    const appJsCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const firebaseCode = fs.readFileSync(path.join(ROOT, 'public/firebase-setup.js'), 'utf8');

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <div id="loginScreen" style="display:flex;">
            <input id="loginDriveEmailInput" value="" />
            <div id="loginDriveSyncStatus" style="display:none;"></div>
            <form id="setupForm" style="display:block;">
                <input id="setupName" value="الأستاذ إبراهيم" />
                <input id="setupUsername" value="brahim" />
                <input id="setupPassword" value="1234" />
            </form>
            <form id="loginForm" style="display:none;">
                <input id="loginUsername" value="" />
                <input id="loginPassword" value="" />
                <p id="loginError" style="display:none;"></p>
            </form>
        </div>
        <div id="teacherSettingsModal" style="display:none;">
            <input id="settingsTeacherName" value="الأستاذ إبراهيم" />
            <input id="settingsUsername" value="brahim" />
            <input id="settingsOldPassword" value="" />
            <input id="settingsNewPassword" value="" />
        </div>
        <div id="headerDriveSyncBadge" class="header-chip"><span id="headerDriveSyncText">ربط البريد الموثّق</span></div>
        <div id="backupStatus">غير مسجل الدخول</div>
        <button id="backupLoginBtn" style="display:flex;"></button>
        <button id="backupLogoutBtn" style="display:none;"></button>
        <div id="backupActionBtns" style="display:none;"></div>
        <input id="teacherEmail" value="" />
    </body></html>`);

    Object.defineProperty(win, 'crypto', { value: globalThis.crypto, configurable: true });
    sandbox.TextEncoder = globalThis.TextEncoder;
    sandbox.Uint8Array = globalThis.Uint8Array;
    sandbox.db = {
        teacherProfile: { name: 'أستاذ مادة الرياضيات', username: '', email: '', password: '' },
        classes: {},
        settings: {}
    };
    win.db = sandbox.db;
    sandbox.saveDB = () => {};
    sandbox.performDBSave = () => { sandbox.db._lastSavedTimestamp = Date.now(); };
    sandbox.updateTeacherNameInHeader = () => {};
    sandbox.autoSaveTeacherSettings = () => {};
    sandbox.showAppToast = () => {};
    sandbox.notifySafeToast = () => {};
    win.notifySafeToast = sandbox.notifySafeToast;

    // Extract PBKDF2 hashing + login/setup + password settings functions from public/app.js
    const secStart = appJsCode.indexOf('function constantTimeStringEqual(a, b) {');
    const secEnd = appJsCode.indexOf('window.verifyPasswordMatch = verifyPasswordMatch;') + 'window.verifyPasswordMatch = verifyPasswordMatch;'.length;
    const authStart = appJsCode.indexOf('function getPreferredLoginUsername() {');
    const authEnd = appJsCode.indexOf('function updateTeacherNameInHeader() {');
    const pwdStart = appJsCode.indexOf('async function updateTeacherPassword() {');
    const pwdEnd = appJsCode.indexOf('function openTeacherSettings(initialTab = \'settingsPersonal\') {');
    const closeStart = appJsCode.indexOf('async function saveAndCloseTeacherSettings() {');
    const closeEnd = appJsCode.indexOf('document.addEventListener(\'keydown\', (e) => {');

    assert.ok(secStart !== -1 && authStart !== -1 && pwdStart !== -1 && closeStart !== -1);

    vm.runInContext([
        appJsCode.slice(secStart, secEnd),
        appJsCode.slice(authStart, authEnd),
        appJsCode.slice(pwdStart, pwdEnd),
        appJsCode.slice(closeStart, closeEnd)
    ].join('\n'), sandbox, { filename: 'pin-reentry-test.vm.js' });

    // 1. Initial setup sets PBKDF2 password and logs in
    await sandbox.handleSetup();
    assert.ok(sandbox.db.teacherProfile.password.startsWith('pbkdf2$100000$'));
    assert.equal(dom.window.document.getElementById('loginScreen').style.display, 'none');

    // 2. Logout and re-enter the exact same PIN (even when #loginUsername was cleared or has spaces/Arabic digits)
    sandbox.logout();
    assert.equal(dom.window.document.getElementById('loginScreen').style.display, 'flex');
    assert.equal(dom.window.document.getElementById('loginUsername').value, 'brahim', 'Logout must pre-fill loginUsername so user only needs to enter PIN');

    // Clear loginUsername to simulate user only typing their PIN on their device after Gmail linking
    dom.window.document.getElementById('loginUsername').value = '';
    dom.window.document.getElementById('loginPassword').value = ' 1234 ';
    await sandbox.handleLogin();
    assert.equal(dom.window.document.getElementById('loginScreen').style.display, 'none', 'Re-entering valid PIN with blank username must succeed');

    // 3. Logout and re-enter PIN using Eastern Arabic numerals (١٢٣٤) and full teacher name
    sandbox.logout();
    dom.window.document.getElementById('loginUsername').value = 'الأستاذ إبراهيم';
    dom.window.document.getElementById('loginPassword').value = '١٢٣٤';
    await sandbox.handleLogin();
    assert.equal(dom.window.document.getElementById('loginScreen').style.display, 'none', 'Re-entering valid PIN in Eastern Arabic numerals with teacher name must succeed');

    // 4. Change PIN in Settings and click "تم وحفظ" (saveAndCloseTeacherSettings) without clicking separate password button
    dom.window.document.getElementById('teacherSettingsModal').style.display = 'flex';
    dom.window.document.getElementById('settingsOldPassword').value = '1234';
    dom.window.document.getElementById('settingsNewPassword').value = '5678';
    await sandbox.saveAndCloseTeacherSettings();
    assert.equal(dom.window.document.getElementById('teacherSettingsModal').style.display, 'none');
    assert.equal(await win.verifyPasswordMatch('5678', sandbox.db.teacherProfile.password), true, 'saveAndCloseTeacherSettings must persist new PIN when filled');

    // 5. Logout and login with new PIN 5678
    sandbox.logout();
    dom.window.document.getElementById('loginPassword').value = '5678';
    await sandbox.handleLogin();
    assert.equal(dom.window.document.getElementById('loginScreen').style.display, 'none', 'New PIN saved via saveAndCloseTeacherSettings must work on re-entry');
});

test('Zeroed-Out Clean Initialization: No pre-seeded demo classes, students, grades, admin slips, or teacher profile items', () => {
    const appJsPath = path.join(ROOT, 'public/app.js');
    const appJsCode = fs.readFileSync(appJsPath, 'utf8');

    const { win, sandbox } = createDomSandbox('<!DOCTYPE html><html><body></body></html>');
    sandbox.db = {
        teacherProfile: { name: '', password: '' },
        classes: {},
        grades: {},
        records: []
    };
    win.db = sandbox.db;

    const sanitizeStart = appJsCode.indexOf('function sanitizeAndSyncSecondaryMathDB() {');
    const sanitizeEnd = appJsCode.indexOf('sanitizeAndSyncSecondaryMathDB();') + 'sanitizeAndSyncSecondaryMathDB();'.length;
    assert.ok(sanitizeStart !== -1 && sanitizeEnd > sanitizeStart);
    vm.runInContext(appJsCode.slice(sanitizeStart, sanitizeEnd), sandbox, { filename: 'zero-init-test.vm.js' });

    assert.equal(Object.keys(sandbox.db.classes).length, 0, 'Fresh database must have 0 pre-seeded classes');
    assert.equal(Object.keys(sandbox.db.grades).length, 0, 'Fresh database must have 0 pre-seeded grades');

    runPublicScript(sandbox, 'public/admin-followup-alerts.js');
    if (typeof win.getAdminFollowUpMetrics === 'function') {
        const metrics = win.getAdminFollowUpMetrics();
        assert.equal(metrics.totalCount, 0, 'Fresh database must have 0 pre-seeded admin follow-up slips');
    }
    assert.equal((sandbox.db.adminFollowUpSlips || []).length, 0, 'adminFollowUpSlips must remain empty');

    runPublicScript(sandbox, 'public/teacher-profile.js');
    const tp = sandbox.db.teacherProfile;
    assert.equal((tp.qualifications || []).length, 0, 'qualifications must start empty');
    assert.equal((tp.achievements || []).length, 0, 'achievements must start empty');
    assert.equal((tp.careerStations || []).length, 0, 'careerStations must start empty');
    assert.equal((tp.trainings || []).length, 0, 'trainings must start empty');
});

test('Whiteboard Lesson Header Engine & Curriculum Sync: multi-theme rendering, curriculum lookup & Studio modal', () => {
    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html><body>
        <select id="lessonLogClassSelect"><option value="2BAC-PC-1" selected>2BAC-PC-1</option></select>
        <input id="lessonLogNumber" value="">
        <input id="lessonLogTitle" value="">
        <input id="lessonLogSessionNum" value="4">
        <select id="lessonLogSessionType"><option value="exercices" selected>exercices</option></select>
        <canvas id="whiteboardCanvas" width="900" height="600"></canvas>
    </body></html>`);

    sandbox.db = {
        teacherProfile: { name: 'محمد أمين', school: 'ثانوية الخوارزمي التأهيلية' },
        classes: { '2BAC-PC-1': [], '1BAC-SM-1': [], 'TCS-1': [] },
        lessonLogs: {
            '2BAC-PC-1': [
                {
                    number: 'الدوال اللوغاريتمية',
                    axes: [{ title: 'النهايات الأساسية للدالة ln واشتقاقها' }],
                    sessionNum: '4',
                    sessionType: 'exercices',
                    objective: 'توظيف النهايات الاعتيادية في حساب النهايات'
                }
            ]
        }
    };
    win.db = sandbox.db;
    win.currentClass = '2BAC-PC-1';

    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/whiteboard/wb-vector-engine.js');

    assert.equal(typeof win.getSecondaryMathLessonsForClass, 'function', 'getSecondaryMathLessonsForClass must be exported');
    const bacPcInfo = win.getSecondaryMathLessonsForClass('2BAC-PC-1');
    assert.equal(bacPcInfo.levelId, '2BAC_EXP');
    assert.ok(bacPcInfo.allLessons.length >= 8, '2BAC_EXP must return official curriculum lessons');

    const smInfo = win.getSecondaryMathLessonsForClass('1BAC-SM-1');
    assert.equal(smInfo.levelId, '1BAC_SM');
    assert.ok(smInfo.allLessons.length >= 8, '1BAC_SM must return official curriculum lessons');

    const tcsInfo = win.getSecondaryMathLessonsForClass('TCS-1');
    assert.equal(tcsInfo.levelId, 'TCS');
    assert.ok(tcsInfo.allLessons.length >= 8, 'TCS must return official curriculum lessons');

    const drawnTexts = [];
    const mockCtx = {
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        rect() {},
        roundRect() {},
        clip() {},
        fill() {},
        stroke() {},
        fillRect() {},
        measureText(str) {
            return { width: String(str || '').length * 7 };
        },
        fillText(txt) {
            drawnTexts.push(String(txt));
        }
    };

    const themes = ['academic', 'chalkboard', 'workshop', 'compact'];
    const backgrounds = ['white', 'green', 'dark'];
    for (const styleTheme of themes) {
        for (const currentBg of backgrounds) {
            drawnTexts.length = 0;
            const obj = {
                t: 'lesson_header',
                x: 24,
                y: 12,
                w: 760,
                h: styleTheme === 'compact' ? 50 : 88,
                todayStr: 'الأحد 22 نونبر 2026',
                className: '2BAC-PC-1',
                levelLabel: 'الثانية باك علوم تجريبية',
                lessonTitle: 'الدوال اللوغاريتمية',
                axisTitle: 'النهايات الأساسية للدالة ln واشتقاقها',
                objective: 'حساب النهايات',
                sessionNum: '4',
                sessionTypeLabel: 'تمارين تطبيقية',
                teacherName: 'محمد أمين',
                schoolName: 'ثانوية الخوارزمي التأهيلية',
                styleTheme,
                showInstitutionalMeta: true
            };
            win.WbVectorEngine.drawVectorObject(mockCtx, obj, { currentBg, isPdfActive: false });
            assert.ok(drawnTexts.some(t => t.includes('الدوال اللوغاريتمية')), `Theme ${styleTheme} on bg ${currentBg} must render lessonTitle`);
            const bounds = win.WbVectorEngine.getObjectBounds(obj, { currentBg, isPdfActive: false });
            assert.equal(bounds.x, 24);
            assert.equal(bounds.w, 760);
        }
    }
    void dom;
});

test('Moroccan Curriculum & Note 142-08 Audit: all 10 tracks balance hours cleanly & Absence Heatmap exposes click handler', () => {
    const { win, sandbox } = createDomSandbox('<!DOCTYPE html><html dir="rtl" lang="ar"><body><div id="heatmapGridContainer"></div></body></html>');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/absence-heatmap.js');

    const curric = win.MOROCCAN_SECONDARY_MATH_CURRICULUM;
    assert.ok(curric && Array.isArray(Object.keys(curric)));

    const requiredTracks = ['TCS', 'TCL', '1BAC_SM', '1BAC_EXP', '1BAC_ECO', '1BAC_LSH', '2BAC_SM', '2BAC_EXP', '2BAC_ECO', '2BAC_LSH'];
    for (const trackKey of requiredTracks) {
        const track = curric[trackKey];
        assert.ok(track, `Missing track ${trackKey}`);
        assert.ok(Number.isFinite(track.totalOfficialHours), `${trackKey} must define totalOfficialHours`);
        assert.equal(track.annualHours, track.totalOfficialHours, `${trackKey} annualHours must equal totalOfficialHours`);
        assert.ok(Number.isFinite(track.netLessonsHours), `${trackKey} must define netLessonsHours`);
        assert.ok(Number.isFinite(track.evalAndSupportHours), `${trackKey} must define evalAndSupportHours`);
        assert.equal(
            track.netLessonsHours + track.evalAndSupportHours,
            track.totalOfficialHours,
            `${trackKey}: netLessonsHours + evalAndSupportHours must equal totalOfficialHours`
        );
        const s1Hours = (track.semesters.s1.lessons || []).reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
        const s2Hours = (track.semesters.s2.lessons || []).reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
        assert.equal(
            s1Hours + s2Hours,
            track.netLessonsHours,
            `${trackKey}: sum of lesson hours (${s1Hours + s2Hours}) must match netLessonsHours (${track.netLessonsHours})`
        );
    }

    assert.equal(curric['1BAC_EXP'].coefficient, 7);
    assert.equal(curric['1BAC_SM'].coefficient, 9);
    assert.equal(curric['2BAC_SM'].coefficient, 9);
    assert.equal(curric['2BAC_SM'].weeklyHours, 7);
    assert.equal(curric['2BAC_SM'].examsPerSemester, 4);
    assert.equal((curric['2BAC_SM'].semesters.s1.examSchedule || []).length, 4);
    assert.equal((curric['2BAC_SM'].semesters.s2.examSchedule || []).length, 4);
    assert.ok(curric['2BAC_ECO'].cadreReferentiel.examType.includes('2h') && !curric['2BAC_ECO'].cadreReferentiel.examType.includes('2h30'));
    assert.equal(win.getCurriculumLevelForClass('PC-1'), '2BAC_EXP');
    assert.equal(win.getCurriculumLevelForClass('SVT-2'), '2BAC_EXP');
    assert.equal(win.getCurriculumLevelForClass('SMA-1'), '2BAC_SM');
    assert.equal(win.getCurriculumLevelForClass('SE-1'), '1BAC_EXP');
    assert.equal(win.getCurriculumLevelForClass('SGC-1'), '2BAC_ECO');
    assert.equal(win.getCurriculumLevelForClass('TCT-1'), 'TCS');

    assert.equal(typeof win.showHeatmapCellDetails, 'function');
    assert.equal(typeof win.onHeatmapCellClick, 'function');
    assert.equal(win.onHeatmapCellClick, win.showHeatmapCellDetails);
});

test('Individual Student Report Audit: stdRecords ReferenceError fix, track annual hours parity, lessonLogs[className], XSS sanitization & Sep-Aug school year', () => {
    const appJsCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const extractFnBlock = (startMarker, endMarker) => {
        const startIdx = appJsCode.indexOf(startMarker);
        assert.ok(startIdx !== -1, `Missing marker: ${startMarker}`);
        const endIdx = appJsCode.indexOf(endMarker, startIdx);
        assert.ok(endIdx !== -1, `Missing end marker: ${endMarker}`);
        return appJsCode.slice(startIdx, endIdx);
    };

    const heatmapAndReportBlock = extractFnBlock(
        'function _getFallbackAcademicWeeks(',
        'function updateClassDisciplineRate('
    );
    const detailedAbsenceBlock = extractFnBlock(
        'function buildStudentDetailedAbsenceReportHtml(',
        'window.buildStudentDetailedAbsenceReportHtml = buildStudentDetailedAbsenceReportHtml;'
    );

    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <select id="reportClassSelect"><option value="2BAC-SM-1" selected>2BAC-SM-1</option></select>
        <select id="reportStudentSelect"><option value="st/42" selected>st/42</option></select>
        <input id="reportDateFrom" value="2026-09-01" />
        <input id="reportDateTo" value="2026-12-31" />
        <div id="studentChartContainer">
            <span id="studentAttendanceChartBadge"></span>
            <div id="studentChartsGrid">
                <div id="studentProgressChartCard"></div>
                <div id="studentAttendanceChartCard"></div>
            </div>
            <canvas id="studentProgressChart"></canvas>
            <canvas id="studentAttendanceChart"></canvas>
        </div>
        <div id="studentBehaviorDetails" style="display:none;"></div>
        <button id="btnPrintBehavior" style="display:none;"></button>
        <button id="btnShareBehavior" style="display:none;"></button>
        <button id="btnExportStudentPDF" style="display:none;"></button>
    </body></html>`);

    const escapeHtmlImpl = (str) => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const mockDb = {
        settings: {
            printModeOptProgressChart: true,
            printModeOptAbsenceChart: true,
            printModeOptMonthMatrix: true,
            printModeOptIncidentsLog: true
        },
        teacherProfile: {
            name: 'الأستاذ <script>alert(9)</script>',
            academy: 'الرباط سلا القنيطرة',
            directorate: 'سلا',
            school: 'ثانوية الخوارزمي <b>التأهيلية</b>',
            academicYear: ''
        },
        classes: {
            '2BAC-SM-1': {
                students: [
                    { id: 'st/42', name: 'آدم <img src=x onerror=alert(1)>', orderNum: 12, massar: 'R140042001' }
                ]
            }
        },
        lessonLogs: {
            '2BAC-SM-1': [
                { date: '2026-10-14', sessionNum: '3', title: 'الاشتقاق <script>bad()</script>' }
            ]
        },
        behaviors: {
            '2BAC-SM-1': {
                'st/42': { status: 'تنبيه', note: 'ملاحظة صفية <img src=x onerror=alert(2)>' }
            }
        },
        notes: {
            '2BAC-SM-1': [
                { studentId: 'st/42', date: '2026-10-15', text: 'دفتر التتبع <script>xss()</script>' }
            ]
        },
        grades: {
            '2BAC-SM-1': {
                'st/42': {
                    s1: { f1: 14, f2: 16, f3: 15, f4: 17, act: 18 },
                    s2: { f1: 11, f2: 12 }
                }
            }
        },
        records: [
            {
                id: 'r1',
                className: '2BAC-SM-1',
                studentId: 'st/42',
                date: '2026-10-12',
                status: 'غائب',
                hours: 2,
                session: '08:00 - 10:00',
                notes: 'غياب <script>x()</script>'
            },
            {
                id: 'r2',
                className: '2BAC-SM-1',
                studentId: 'st/42',
                date: '2027-02-10',
                status: 'مبرر',
                hours: 2,
                session: '14:00 - 16:00'
            }
        ]
    };

    Object.assign(sandbox, {
        CustomEvent: win.CustomEvent,
        db: mockDb,
        activeSemester: 's1',
        escapeHtml: escapeHtmlImpl,
        getActiveSemester: () => sandbox.activeSemester,
        getStudentGradesBySemester: (c, sid, sem) => mockDb.grades[c]?.[sid]?.[sem] || {},
        getExamsCountForClass: () => 4,
        getSubjectCoefForClass: () => 9,
        calculateStudentAvg: (g) => {
            const vals = [g.f1, g.f2, g.f3, g.f4].map(Number).filter(n => !isNaN(n));
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        },
        getWeeklyHoursForClass: (cls) => (cls.includes('SM') ? 7 : 4),
        getStudentClassRecordsFast: (sid, cls) => mockDb.records.filter(r => r.className === cls && r.studentId === sid),
        getRecordAbsenceDuration: (rec) => Number(rec.hours) || 1,
        isRecordProtectedHolidayOrLeave: () => false,
        getStudentPrintModeOptions: () => ({
            officialHeader: true,
            progressChart: true,
            absenceChart: true,
            officialVisas: true,
            monthMatrix: true,
            weekGrid: false,
            incidentsLog: true
        }),
        isStudentPrintModeEnabled: () => false,
        getClassColorTheme: () => ({ solid: '#1e3a8a' }),
        getAppNow: () => new Date('2026-08-15T10:00:00Z'),
        formatLocalDate: () => '2026-10-16',
        generateStudentMonthlyAbsenceChartDataUrl: () => ({ dataUrl: 'data:image/png;base64,AAAA' }),
        getDualLogosHTML: () => '',
        saveDB: () => {},
        showAppToast: () => {}
    });
    win.db = mockDb;

    vm.runInContext(heatmapAndReportBlock + '\n' + detailedAbsenceBlock, sandbox, {
        filename: 'individual-student-report-audit.vm.js'
    });

    // 1. Call updateStudentProgressChart — must succeed without ReferenceError: stdRecords is not defined
    (win.updateStudentProgressChart || sandbox.updateStudentProgressChart)();
    const detailsEl = dom.window.document.getElementById('studentBehaviorDetails');
    const html = detailsEl.innerHTML;
    assert.equal(detailsEl.style.display, 'block');
    assert.ok(html.includes('الدورة الأولى'), 'Active semester label must display in grades section header');
    assert.ok(html.includes('الأنشطة المندمجة:'), 'Integrated activities score should be displayed');
    assert.ok(html.includes('15.50 / 20'), 'Note 142-08 average of continuous exams (14,16,15,17) must stay 15.50');
    assert.ok(html.includes('الاشتقاق &lt;script&gt;bad()&lt;/script&gt;'), 'Canonical db.lessonLogs[className] title must appear safely escaped');
    assert.equal(detailsEl.querySelector('img[src="x"]'), null, 'No raw <img> XSS injection allowed');
    assert.equal(detailsEl.querySelector('script'), null, 'No raw <script> XSS injection allowed');

    // 2. Verify track annual hours parity: 4h total absence out of 238h (7h*34) => ((238-4)/238)*100 = 98.3%
    const attBadgeText = dom.window.document.getElementById('studentAttendanceChartBadge').textContent;
    assert.equal(attBadgeText, 'المواظبة: 98.3% (4س غياب)');
    assert.ok(html.includes('238 ساعة سنوية'), 'Heatmap analytics card must compute dynamic 238h for 2BAC-SM');
    assert.ok(html.includes('98.3%'), 'Heatmap analytics attendance rate must match header badge (98.3%)');

    // 3. Verify Sep-Aug school year calculation in August -> 2025 / 2026
    assert.ok(html.includes('2025/2026') || html.includes('2025 / 2026'), 'August date must resolve to previous academic year 2025/2026');

    // 4. Verify outside-period toggle handles studentId containing slashes cleanly
    const toggleContainer = dom.window.document.getElementById('allTimeAbsenceDatesContainer_st_42');
    assert.ok(toggleContainer, 'Sanitized container ID must exist for st/42');
    assert.equal(toggleContainer.style.display, 'none');
    (win.toggleAllTimeAbsenceDates || sandbox.toggleAllTimeAbsenceDates)('st/42', '2BAC-SM-1');
    assert.equal(toggleContainer.style.display, 'block');

    // 5. Verify buildStudentDetailedAbsenceReportHtml XSS escaping & dynamic academicYear override
    mockDb.teacherProfile.academicYear = '2026 / 2027 (رسمي)';
    const detailedHtml = (win.buildStudentDetailedAbsenceReportHtml || sandbox.buildStudentDetailedAbsenceReportHtml)(mockDb.classes['2BAC-SM-1'].students[0], '2BAC-SM-1', '2026-09-01', '2026-12-31');
    assert.ok(detailedHtml.includes('2026 / 2027 (رسمي)'), 'Detailed absence report must honor teacherProfile.academicYear');
    assert.ok(!detailedHtml.includes('<script>alert(9)</script>'), 'Teacher profile XSS must be escaped');
    assert.ok(!detailedHtml.includes('<img src=x onerror=alert(1)>'), 'Student name XSS must be escaped');
});

test('Supervised Exam Report Extended Audit: Note 142-08 handlers, competition ranking (1,1,3), zero grades, stream norms & timetable conflicts', () => {
    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <select id="examReportClassSelect"><option value="2BAC-SM-1" selected>2BAC-SM-1</option></select>
        <select id="reportClassSelect"><option value="2BAC-SM-1" selected>2BAC-SM-1</option></select>
        <select id="examReportSemester"><option value="s1" selected>s1</option><option value="s2">s2</option></select>
        <select id="examReportNumber"><option value="1" selected>1</option><option value="2">2</option></select>
        <span id="examReportStatusBadge"></span>
        <span id="examReportStreamNormBadge"></span>
        <input id="examReportPassDate" value="2026-11-10" />
        <input id="examReportCorrectionDate" value="2026-11-17" />
        <select id="examReportDuration"><option value="1h">1h</option><option value="2h" selected>2h</option><option value="3h">3h</option><option value="4h">4h</option></select>
        <input id="examReportCoef" value="" />
        <textarea id="examReportTopics"></textarea>
        <input id="examReportGradingScale" value="" />
        <textarea id="examReportDifficulties"></textarea>
        <textarea id="examReportRemediation"></textarea>
        <div id="examStatTotal"></div><div id="examStatPresent"></div><div id="examStatAbsent"></div>
        <div id="examStatMax"></div><div id="examStatMin"></div><div id="examStatAvg"></div>
        <div id="examStatPassRate"></div><div id="examStatFailRate"></div>
        <div id="examStatMedian"></div><div id="examStatStdDev"></div><div id="examStatCV"></div>
        <div id="distCount_veryLow"></div><div id="distPct_veryLow"></div><div id="distBar_veryLow"></div>
        <div id="distCount_low"></div><div id="distPct_low"></div><div id="distBar_low"></div>
        <div id="distCount_medium"></div><div id="distPct_medium"></div><div id="distBar_medium"></div>
        <div id="distCount_good"></div><div id="distPct_good"></div><div id="distBar_good"></div>
        <div id="distCount_excellent"></div><div id="distPct_excellent"></div><div id="distBar_excellent"></div>
        <div id="examReportPieChartContainer"></div>
        <div id="examReportProgressionStrip"></div>
        <table><tbody id="examReportRosterTbody"></tbody></table>
        <table><tbody id="examReportRankedTbody"></tbody></table>
        <div id="examReportAbsentsContainer"></div>
        <span id="examReportAbsentsCountBadge"></span>
    </body></html>`);

    let specCalled = null;
    let capturedConvocationHtml = '';
    win.showNotification = () => {};
    win.showToast = () => {};
    win.saveDB = () => {};
    win.openSpecificationTableFromCurriculum = (trackKey, sem, num) => {
        specCalled = { trackKey, sem, num };
    };
    win.openCustomPrintPreviewModal = (html) => {
        capturedConvocationHtml = html;
    };
    win.parseOfficialWeightsTo20Scale = (w) => `سلم 20/20 (${JSON.stringify(w).slice(0, 20)})`;

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/exam-report.js');

    win.db = {
        currentClass: '2BAC-SM-1',
        teacherProfile: { name: 'أستاذ مادة الرياضيات', school: 'الثانوية التأهيلية المرجعية' },
        timetable: {
            'الإثنين': { m1: '2BAC-SM-1 - رياضيات', m2: '2BAC-PC-1 - رياضيات' }
        },
        classes: {
            '2BAC-SM-1': {
                students: [
                    { id: 's1', name: 'تلميذ أ', massar: 'M1' },
                    { id: 's2', name: 'تلميذ ب', massar: 'M2' },
                    { id: 's3', name: 'تلميذ ج', massar: 'M3' },
                    { id: 's4', name: 'تلميذ د', massar: 'M4' },
                    { id: 's5', name: 'تلميذ متغيب', massar: 'M5' }
                ]
            }
        },
        grades: {
            '2BAC-SM-1': {
                s1: { s1: { f1: 17 } },
                s2: { s1: { f1: '17,0' } },
                s3: { s1: { f1: 14 } },
                s4: { s1: { f1: 0 } },
                s5: { s1: { f1: 'غ' } }
            }
        }
    };

    // 1. Note 142-08 handlers run cleanly without ReferenceError
    win.prefillOfficialNote142ExamContent();
    assert.equal(dom.window.document.getElementById('examReportCoef').value, '9');
    assert.ok(dom.window.document.getElementById('examReportTopics').value.length > 0);
    const origOpenSpec = win.openSpecificationTableFromCurriculum;
    assert.equal(typeof origOpenSpec, 'function', 'secondary-math-curriculum.js should export openSpecificationTableFromCurriculum');
    win.openSpecificationTableFromCurriculum = (trackKey, sem, num) => {
        specCalled = { trackKey, sem, num };
    };
    win.openCurrentExamSpecificationTable();
    assert.deepEqual(specCalled, { trackKey: '2BAC_SM', sem: 's1', num: 1 });

    // 2. Competition ranking (1, 1, 3, 4) & zero grade preservation
    win.loadOrBuildReportForForm('2BAC-SM-1');
    assert.equal(dom.window.document.getElementById('examStatPresent').textContent, '4');
    assert.equal(dom.window.document.getElementById('examStatMax').textContent, '17');
    assert.equal(dom.window.document.getElementById('examStatMin').textContent, '0');
    const rankedRows = Array.from(dom.window.document.querySelectorAll('#examReportRankedTbody tr'));
    assert.equal(rankedRows.length, 4);
    assert.match(rankedRows[0].textContent, /1/);
    assert.match(rankedRows[1].textContent, /1/);
    assert.match(rankedRows[2].textContent, /3/);
    assert.match(rankedRows[3].textContent, /4/);

    // 3. GradesCalculator stream norms (SM / PC / ECO / LSH)
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('2BAC-SM-1').examsPerSemester, 4);
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('2BAC-PC-1').examsPerSemester, 3);
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('1BAC-ECO-1').examsPerSemester, 3);
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('2BAC-LSH-1').examsPerSemester, 2);

    // 4. Makeup convocation slip & timetable conflict detection
    win.quickUpdateMakeupJustification('s5', 'justified_admin');
    win.printOfficialMakeupExamConvocation();
    assert.ok(capturedConvocationHtml.includes('تلميذ متغيب'));
    assert.ok(capturedConvocationHtml.includes('الفرض المحروس التعويضي'));

    // Monday 08:30 (m1 = 2BAC-SM-1) -> class_session_match (no conflict for 2BAC-SM-1)
    const matchRes = win.evaluateMakeupSlotConflict('2026-11-16', '08:30', 60, '2BAC-SM-1');
    assert.equal(matchRes.hasConflict, false);
    assert.equal(matchRes.status, 'class_session_match');

    // Monday 10:30 (m2 = 2BAC-PC-1) -> conflict for 2BAC-SM-1
    const clashRes = win.evaluateMakeupSlotConflict('2026-11-16', '10:30', 60, '2BAC-SM-1');
    assert.equal(clashRes.hasConflict, true);
    assert.equal(clashRes.status, 'conflict');

    // Sunday -> weekend conflict
    const sundayRes = win.evaluateMakeupSlotConflict('2026-11-15', '10:00', 60, '2BAC-SM-1');
    assert.equal(sundayRes.hasConflict, true);
});

test('Reports Unified Helpers Audit (app.js): period filtering, holiday exclusion, comma-decimal grades & object class normalization', () => {
    const appCode = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const extractFnBlock = (startMarker, endMarker) => {
        const startIdx = appCode.indexOf(startMarker);
        assert.ok(startIdx !== -1, `Missing marker: ${startMarker}`);
        const endIdx = appCode.indexOf(endMarker, startIdx);
        assert.ok(endIdx !== -1, `Missing end marker: ${endMarker}`);
        return appCode.slice(startIdx, endIdx);
    };

    const avgBlock = extractFnBlock('function calculateSemesterAvg(', 'function calculateStudentProgressionIndex(');
    const multiBlock = extractFnBlock('function resolveReportTargetClasses(classSpec)', 'function renderReportMultiClassPicker()');

    const { win, sandbox } = createDomSandbox();
    const mockDb = {
        classes: {
            '2BAC-PC-1': {
                students: [
                    { id: 'st1', name: 'تلميذ كائن', orderNum: 1 }
                ]
            },
            '1BAC-SM-1': [
                { id: 'st2', name: 'تلميذ مصفوفة', orderNum: 1 }
            ]
        },
        records: [
            { id: 'r1', className: '2BAC-PC-1', studentId: 'st1', date: '2026-10-10', status: 'غائب', duration: 2 },
            { id: 'r2', className: '2BAC-PC-1', studentId: 'st1', date: '2026-11-18', status: 'غائب', duration: 2 },
            { id: 'r3', className: '2BAC-PC-1', studentId: 'st1', date: '2026-12-20', status: 'غائب', duration: 2 }
        ]
    };

    Object.assign(sandbox, {
        db: mockDb,
        activeSemester: 's1',
        getSortedClasses: () => ['2BAC-PC-1', '1BAC-SM-1'],
        getExamsCountForClass: (cls) => (cls.includes('SM') ? 4 : 3),
        isRecordProtectedHolidayOrLeave: (r) => r.date === '2026-11-18',
        getClassRecordsFast: (cls) => mockDb.records.filter(r => r.className === cls)
    });
    win.db = mockDb;

    vm.runInContext(avgBlock + '\n' + multiBlock, sandbox, { filename: 'app-report-helpers-audit.vm.js' });

    // 1. Comma-decimal & zero grade parsing in calculateStudentAvg
    const avgComma = win.calculateStudentAvg({ f1: '14,50', f2: '0', f3: '15,50' }, '2BAC-PC-1', 's1');
    assert.equal(avgComma, 10);

    // 2. Object-wrapped { students: [] } normalization across all classes
    const combinedStudents = win.getCombinedStudentsForClasses('__ALL__');
    assert.equal(combinedStudents.length, 2);
    assert.equal(combinedStudents[0].name, 'تلميذ كائن');
    assert.equal(combinedStudents[1].name, 'تلميذ مصفوفة');

    // 3. Period filtering + protected holiday exclusion
    const filteredRecords = win.getCombinedRecordsForClasses('2BAC-PC-1', '2026-10-01', '2026-11-30')
        .filter(r => !sandbox.isRecordProtectedHolidayOrLeave(r));
    assert.equal(filteredRecords.length, 1);
    assert.equal(filteredRecords[0].id, 'r1');
});

test('Standalone Report Modules Audit: sparse Pearson correlation guard, comma decimals in PDF dataset & Olympiad candidate extraction', () => {
    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <div id="gradesAbsenceImpactCard"></div>
        <div id="dashMathOlympiadCard"></div>
    </body></html>`);

    win.showToast = () => {};
    win.showAppToast = () => {};
    win.getAppNow = () => new Date('2026-11-20T10:00:00Z');
    win.isRecordProtectedHolidayOrLeave = (r) => r.status === 'عطلة رسمية' || r.date === '2026-11-18';
    win.isAbsenceDisabledOnDate = (d) => d === '2026-11-18';
    win.getExamsCountForClass = (cls) => (cls.includes('SM') ? 4 : 3);
    win.getSortedClasses = () => ['2BAC-SM-1'];

    win.db = {
        classes: {
            '2BAC-SM-1': {
                students: [
                    { id: 'st1', name: 'نخبة أولمبياد', massar: 'R1300111', orderNum: 1 }
                ]
            }
        },
        grades: {
            '2BAC-SM-1': {
                st1: {
                    s1: { f1: '18,5', f2: '17,75', f3: 18, f4: '19,25' }
                }
            }
        },
        records: [
            { id: 'r1', className: '2BAC-SM-1', studentId: 'st1', date: '2026-11-18', status: 'غائب', duration: 2 },
            { id: 'r2', className: '2BAC-SM-1', studentId: 'st1', date: '2026-11-10', status: 'غائب', duration: 2 }
        ]
    };

    runPublicScript(sandbox, 'public/grades-absence-impact-chart.js');
    runPublicScript(sandbox, 'public/admin-comprehensive-pdf.js');
    runPublicScript(sandbox, 'public/academic-evolution-card.js');

    // 1. Sparse correlation guard in grades-absence-impact-chart.js (< 2 students -> no NaN, shows '--')
    win.renderGradesAbsenceImpactChart('2BAC-SM-1');
    const impactHtml = dom.window.document.getElementById('gradesAbsenceImpactCard').innerHTML;
    assert.ok(impactHtml.includes('بيانات غير كافية'));
    assert.ok(impactHtml.includes('يتطلب تلميذين على الأقل'));
    assert.equal(impactHtml.includes('NaN'), false);

    // 2. Comma decimals, 4-exam average, & protected holiday exclusion in admin-comprehensive-pdf.js
    const adminDataset = win.buildAdminComprehensiveDataset({ semester: 's1', classFilter: '2BAC-SM-1' });
    assert.equal(adminDataset.totals.studentsCount, 1);
    assert.equal(adminDataset.totals.absentHours, 2, 'Protected holiday 2026-11-18 must be excluded');
    const row = adminDataset.classSummaries[0].students[0];
    assert.equal(row.s1.avg, 18.38);

    // 3. Olympiad candidate extraction in academic-evolution-card.js
    win.renderMathOlympiadClubCard();
    const olympiadHtml = dom.window.document.getElementById('dashMathOlympiadCard').innerHTML;
    assert.ok(olympiadHtml.includes('نخبة أولمبياد'));
    assert.ok(olympiadHtml.includes('19.25'));
});

test('Official Supervised Exam Report — Page 2 retains all student marks, merit rankings, and absents even when subsequent exams (f2/f3/f4) are ungraded and reportClassSelect is __ALL__', () => {
    const { win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl"><body>
        <select id="reportClassSelect"><option value="__ALL__" selected>جميع الأقسام</option><option value="2BAC-PC-1">2BAC-PC-1</option></select>
        <select id="examReportSemester"><option value="s1" selected>s1</option></select>
        <select id="examReportNumber"><option value="1" selected>1</option></select>
        <div id="examReportProgressionStrip"></div>
    </body></html>`);

    win.db = {
        classes: {
            '2BAC-PC-1': [
                { id: 's1', name: 'سلمى بنعلي', massar: 'G1300101' },
                { id: 's2', name: 'ياسين المرابط', massar: 'G1300102' },
                { id: 's3', name: 'آية الإدريسي', massar: 'G1300103' }
            ]
        },
        grades: {
            '2BAC-PC-1': {
                s1: { s1: { f1: 17.5 } }, // f2 and f3 are intentionally ungraded!
                s2: { s1: { f1: 8.5 } },
                s3: { s1: { f1: 'غ' } }
            }
        }
    };

    let capturedHtml = '';
    let capturedOpts = null;
    win.openCustomPrintPreviewModal = (html, opts) => {
        capturedHtml = html;
        capturedOpts = opts;
    };

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/exam-report.js');

    win.cleanupExamReportMemory();
    win.printOfficialExamReport(false);

    assert.ok(capturedHtml.includes('report-page-1'), 'Must contain Page 1');
    assert.ok(capturedHtml.includes('report-page-2'), 'Must contain Page 2');
    assert.equal(capturedHtml.includes('[object Object]'), false, 'Grading scale must never render [object Object]');

    const page2Split = capturedHtml.split('class="report-page report-page-2"')[1] || '';
    assert.ok(page2Split.includes('سلمى بنعلي'), 'Page 2 must contain student 1');
    assert.ok(page2Split.includes('17.50'), 'Page 2 must display student 1 grade 17.50 in both roster and merit tables');
    assert.ok(page2Split.includes('ممتاز (Très bien)'), 'Page 2 merit table must contain appreciation for 17.50');
    assert.ok(page2Split.includes('ياسين المرابط'), 'Page 2 must contain struggling student 2');
    assert.ok(page2Split.includes('8.50'), 'Page 2 must display student 2 grade 8.50');
    assert.ok(page2Split.includes('آية الإدريسي'), 'Page 2 must list absent student 3');
    assert.equal(page2Split.includes('لا توجد نقط مسجلة'), false, 'Page 2 merit table must not be empty');
    assert.ok(capturedOpts && capturedOpts.margins && capturedOpts.margins.top === 6, 'Must pass 6mm narrow top/bottom margins to preview modal');
    assert.ok(capturedHtml.includes('40% المستوى المهاري 1'), 'Scientific exam report must display Note 142-08 p.9 40%/45%/10%-20% criteria');
});

test('Comprehensive Moroccan Math Pedagogical & Note 142-08 Audit: 100% weight sums, SM 4-exam Massar CSV, Remediation alignment, Lit/Art 60/40 criteria & 2BAC orientation', () => {
    const { win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl"><body>
        <select id="reportClassSelect"><option value="2BAC-LSH-1" selected>2BAC-LSH-1</option></select>
        <select id="examReportSemester"><option value="s1" selected>s1</option></select>
        <select id="examReportNumber"><option value="1" selected>1</option></select>
        <div id="examReportProgressionStrip"></div>
    </body></html>`);

    win.db = {
        classes: {
            '2BAC-LSH-1': {
                students: [
                    { id: 'l1', name: 'خديجة بنجلون', massar: 'G1300201' }
                ]
            },
            '2BAC-PC-1': {
                students: [
                    { id: 'p1', name: 'عمر التازي', massar: 'G1300301' }
                ]
            }
        },
        grades: {
            '2BAC-LSH-1': { l1: { s1: { f1: '15,5', f2: '14,5' } } },
            '2BAC-PC-1': { p1: { s1: { f1: '13,5', f2: '14,5', f3: 14 } } }
        },
        records: []
    };

    let capturedLitHtml = '';
    win.openCustomPrintPreviewModal = (html) => { capturedLitHtml = html; };

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/massar-io.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/math-remediation-ai.js');
    runPublicScript(sandbox, 'public/exam-report.js');
    runPublicScript(sandbox, 'public/pedagogical-council-pv.js');

    // 1. Every single track in MOROCCAN_SECONDARY_MATH_CURRICULUM has 100%-balanced officialWeights, domains, and taxonomyLevels
    const curr = win.MOROCCAN_SECONDARY_MATH_CURRICULUM;
    assert.ok(curr && Object.keys(curr).length >= 10);
    for (const [trackKey, track] of Object.entries(curr)) {
        if (track.specificationTable) {
            const domSum = (track.specificationTable.domains || []).reduce((acc, d) => acc + Number(d.weight || 0), 0);
            const taxSum = (track.specificationTable.taxonomyLevels || []).reduce((acc, t) => acc + Number(t.weight || 0), 0);
            assert.equal(domSum, 100, `Domains sum must equal 100% for ${trackKey}`);
            assert.equal(taxSum, 100, `Taxonomy sum must equal 100% for ${trackKey}`);
        }
        for (const semKey of ['s1', 's2']) {
            const sched = track.semesters?.[semKey]?.examSchedule || [];
            for (const ex of sched) {
                const matches = [...String(ex.officialWeights || '').matchAll(/(\d+)\s*%/g)].map(m => Number(m[1]));
                if (matches.length > 0) {
                    const sum = matches.reduce((a, b) => a + b, 0);
                    assert.equal(sum, 100, `Exam ${ex.num} (${semKey}) officialWeights must sum to 100% for ${trackKey}, got ${sum}%`);
                }
            }
        }
    }

    // 2. MassarIO CSV export: pure Note 142-08 average (ignores act) + 4th exam column for SM
    const smCsv = win.MassarIO.buildMassarCsvExport(
        [{ name: 'سارة العلمي', massarCode: 'R130088991', group: 'G1', grades: { s1: { f1: 14, f2: 16, f3: 18, f4: 12, act: 20 } } }],
        '2BAC-SM-1',
        's1'
    );
    assert.ok(smCsv.includes('الفرض 4'), 'SM CSV export must include الفرض 4 column');
    assert.ok(smCsv.includes('R130088991;سارة العلمي;G1;14;16;18;12;20;15'), 'SM average must be pure (14+16+18+12)/4 = 15, ignoring act=20');

    // 3. Exam Report for Literary track displays Note 142-08 p.9 60% / 40% criteria (no Level 3)
    win.cleanupExamReportMemory();
    win.printOfficialExamReport(false);
    assert.ok(capturedLitHtml.includes('60% المستوى المهاري 1'), 'Literary exam report must display 60%/40% Note 142-08 p.9 criteria');
    assert.equal(capturedLitHtml.includes('المستوى المهاري 3'), false, 'Literary exam report must not include Level 3');

    // 4. computeClassExamStats handles object-wrapped class & comma-decimal grades cleanly
    const remStats = win.computeClassExamStats('2BAC-LSH-1', 's1');
    assert.equal(remStats.evaluatedCount, 1);
    assert.equal(remStats.classAverage, 15);
    assert.equal(remStats.exam1Avg, '15.50');

    // 5. Pedagogical Council PV gives track-accurate orientation for 2BAC_LSH, 2BAC_ARTS, and 2BAC_ECO
    win.recognizeMathCurriculumForClass = (cls) => {
        if (cls.includes('LSH')) return { branchCode: '2BAC_LSH', levelLabel: 'الثانية بكالوريا آداب', examsPerSemester: 2, examDuration: 'ساعة واحدة', coef: 1 };
        if (cls.includes('ART')) return { branchCode: '2BAC_ARTS', levelLabel: 'الثانية بكالوريا فنون تطبيقية', examsPerSemester: 2, examDuration: 'ساعة واحدة', coef: 4 };
        return { branchCode: '2BAC_ECO', levelLabel: 'الثانية بكالوريا اقتصاد', examsPerSemester: 3, examDuration: 'ساعتان', coef: 4 };
    };
    const pvLsh = win.getCouncilClassStatistics('2BAC-LSH-1', 's1');
    assert.ok(pvLsh.students[0].orientationAdvice.includes('كليات الآداب'));
    assert.equal(pvLsh.students[0].orientationAdvice.includes('للمهندسين'), false);

    const pvEco = win.getCouncilClassStatistics('2BAC-PC-1', 's1');
    assert.ok(pvEco.students[0].orientationAdvice.includes('ENCG') || pvEco.students[0].orientationAdvice.includes('الاقتصادية'));

    // 6. ART (singular/plural) & LET shorthands in GradesCalculator
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('1BAC-ART-1').code, 'ART');
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('2BAC-ART-1').examDurationHours, 1);
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('1BAC-LET-1').code, 'BAC_LSH');
    assert.equal(win.GradesCalculator.getStreamOfficialConfig('2BAC-LET-1').coefficient, 1);

    // 7. Ministerial Decrees Library: 2BAC-ARTS is continuous assessment (no National Math Exam) + URL guard in PDF modal
    runPublicScript(sandbox, 'public/ministerial-decrees-library.js');
    const artsRef = win.resolveLessonLegalReference('2BAC-ARTS-1', { number: 'الاشتقاق ودراسة الدوال', sessionType: 'cours' });
    assert.equal(artsRef.decreeId, 'note_orientations_2007');
    assert.equal(artsRef.coefficient, 4);
    assert.equal(artsRef.weeklyHours, 3);

    win.openOfficialPdfViewerModal('javascript:alert(1)', 'XSS', 'bad.pdf');
    assert.equal(win.document.getElementById('officialPdfViewerModal'), null, 'Dangerous javascript: URL must be rejected');
    win.openOfficialPdfViewerModal('/assets/aistudio/n14208_evalped_08_a6af9323.pdf', 'المذكرة 142-08', 'n142.pdf');
    const pdfModal = win.document.getElementById('officialPdfViewerModal');
    assert.ok(pdfModal && pdfModal.style.display === 'flex', 'Valid official PDF modal must open cleanly');

    // 8. Official Note 142-08 weights-to-20 parser produces exact 20-point scale
    const parsed20 = win.parseOfficialWeightsTo20Scale('الحدوديات (20%) + المعادلات (35%) + الحساب المثلثي (30%) + الإحصاء (15%)');
    assert.equal(parsed20.totalPct, 100);
    assert.equal(parsed20.items.reduce((s, it) => s + it.points20, 0), 20);
});

test('Calendar Print Hub, Month & Agenda Print Audit: unifies all live sources, pads calendar grids, strips global preview CSS & prevents XSS', () => {
    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <span id="currentMonthYear">نونبر 2026</span>
        <select id="monthlyCalMonthSelect"><option value="10" selected>نونبر</option></select>
        <select id="monthlyCalYearSelect"><option value="2026" selected>2026</option></select>
    </body></html>`);

    const capturedPreviews = [];
    win.db = {
        teacherProfile: {
            name: 'ذ. محمد التازي <script>alert(1)</script>',
            academy: 'الرباط سلا القنيطرة',
            directorate: 'سلا',
            school: 'ثانوية الخوارزمي <b>التأهيلية</b>',
            academicYear: '2026 / 2027'
        },
        officialHolidays: [
            { id: 'hol_ind', title: 'عيد الاستقلال', startDate: '2026-11-18', endDate: '2026-11-18', categoryLabel: 'عطلة وطنية', daysCount: 1 }
        ],
        teacherLeaves: [
            { id: 'lv_1', type: 'medical', title: 'رخصة طبية قصيرة', startDate: '2026-11-12', endDate: '2026-11-12', daysCount: 1, reason: 'شهادة طبية', disableStudentAbsence: true }
        ],
        academicMilestones: [
            { id: 'ms_1', title: 'إجراء الفرض الأول <img src=x onerror=alert(2)>', startDate: '2026-11-10', endDate: '2026-11-10', category: 'exam', categoryLabel: 'محطة تقويمية', targetLevels: '2BAC-SM-1', timeSlot: '08:30 - 10:30' }
        ],
        upcomingExams: [
            { id: 'ex_1', title: 'الفرض المحروس 1', date: '2026-11-20', correctionDate: '2026-11-25', className: '2BAC-SM-1', timeSlot: '10:30 - 12:30' },
            { id: 'ex_dup', milestoneId: 'ms_1', title: 'إجراء الفرض الأول <img src=x onerror=alert(2)>', date: '2026-11-10', className: '2BAC-SM-1' }
        ],
        agenda: [
            { id: 'ag_1', date: '2026-11-14', text: 'مجلس التنسيق التربوي <script>bad()</script>', type: 'مجلس قسم / تعليمي', className: '2BAC-PC-1', timeSlot: '15:00' }
        ],
        homeworkAgenda: {
            '2BAC-SM-1': [
                { id: 'hw_1', title: 'سلسلة النهايات والاتصال', dueDate: '2026-11-22', topic: 'الاتصال' }
            ]
        },
        calendarEvents: [
            { id: 'ev_custom', date: '2026-11-28', title: 'لقاء تربوي مع المفتش', type: 'meeting', className: 'جميع الأقسام' },
            { id: 'hol_ind', date: '2026-11-18', title: 'عيد الاستقلال', isOfficial: true }
        ]
    };
    win.getAppNow = () => new Date('2026-11-15T09:00:00Z');
    win.getTimetableSessionsForDate = (dateStr) => {
        if (dateStr === '2026-11-09') {
            return { sessions: [{ startTime: '08:30', className: '2BAC-SM-1', room: 'Q4' }] };
        }
        return { sessions: [] };
    };
    win.openCustomPrintPreviewModal = (html, opts) => {
        capturedPreviews.push({ html, opts });
    };
    win.renderCalendar = () => {};
    win.renderSchoolYearProgress = () => {};

    runPublicScript(sandbox, 'public/annual-calendar.js');

    // 1. Month print HTML unifies all live sources, renders detailed days table & escapes XSS
    const novDetailedHtml = win.buildMonthlyCalendarPrintHtml({
        year: 2026,
        month: 10,
        includeDetailedDaysTable: true,
        detailedDaysMode: 'all'
    });
    assert.ok(novDetailedHtml.includes('عيد الاستقلال'), 'Must include official holidays');
    assert.ok(novDetailedHtml.includes('رخصة طبية قصيرة'), 'Must include teacher leaves');
    assert.ok(novDetailedHtml.includes('إجراء الفرض الأول &lt;img src=x onerror=alert(2)&gt;'), 'Must escape milestone XSS');
    assert.ok(novDetailedHtml.includes('الفرض المحروس 1'), 'Must include upcomingExams');
    assert.ok(novDetailedHtml.includes('تصحيح الفرض: الفرض المحروس 1'), 'Must include exam correctionDate');
    assert.ok(novDetailedHtml.includes('مجلس التنسيق التربوي &lt;script&gt;bad()&lt;/script&gt;'), 'Must include and escape db.agenda');
    assert.ok(novDetailedHtml.includes('سلسلة النهايات والاتصال'), 'Must include db.homeworkAgenda');
    assert.ok(novDetailedHtml.includes('لقاء تربوي مع المفتش'), 'Must include custom calendarEvents');
    assert.ok(novDetailedHtml.includes('08:30 2BAC-SM-1 (Q4)'), 'Detailed days table must include timetable sessions');
    assert.equal(novDetailedHtml.includes('<script>alert(1)</script>'), false, 'No unescaped script tags allowed');
    assert.equal(novDetailedHtml.includes('<img src=x onerror=alert(2)>'), false, 'No unescaped img tags allowed');

    // Deduplication: holiday 'عيد الاستقلال' must appear only once in the month agenda summary table (one <tr> item)
    const novBodyOnly = win.buildMonthlyCalendarPrintHtml({ year: 2026, month: 10, returnInnerOnly: true });
    assert.equal((novBodyOnly.match(/عيد الاستقلال/g) || []).length, 2, 'Holiday should appear once in grid cell + once in agenda table (not duplicated from calendarEvents)');

    // Weekday alignment check for October 2026 (Oct 1 is Thursday -> 4 leading empty cells before day 1)
    const octHtml = win.buildMonthlyCalendarPrintHtml({ year: 2026, month: 9, returnInnerOnly: true });
    const firstRowMatch = octHtml.match(/<tbody>\s*<tr[^>]*>([\s\S]*?)<\/tr>/i);
    assert.ok(firstRowMatch, 'First calendar week row must exist');
    const emptyLeadingCells = (firstRowMatch[1].match(/<td[^>]*><\/td>/g) || []).length;
    assert.equal(emptyLeadingCells, 4, 'October 2026 starts on Thursday (dow=4), requiring 4 leading padding cells');

    // 2. Pedagogical Agenda Print supports month / upcoming / year scopes & filtering
    const agendaMonthHtml = win.buildPedagogicalAgendaPrintHtml({ scope: 'month', year: 2026, month: 10 });
    assert.ok(agendaMonthHtml.includes('سلسلة النهايات والاتصال'));
    assert.ok(agendaMonthHtml.includes('الفرض المحروس 1'));
    const agendaUpcomingHtml = win.buildPedagogicalAgendaPrintHtml({ scope: 'upcoming', year: 2026, month: 10 });
    assert.equal(agendaUpcomingHtml.includes('مجلس التنسيق التربوي'), false, 'Past agenda item (Nov 14 < Nov 15) must be excluded in upcoming scope');
    assert.ok(agendaUpcomingHtml.includes('سلسلة النهايات والاتصال'), 'Future item (Nov 22) must remain in upcoming scope');

    const agendaClassFilteredHtml = win.buildPedagogicalAgendaPrintHtml({ scope: 'month', year: 2026, month: 10, className: 'TCL-9' });
    assert.ok(agendaClassFilteredHtml.includes('عيد الاستقلال'), 'Class filter should retain all-classes holidays');
    assert.equal(agendaClassFilteredHtml.includes('سلسلة النهايات والاتصال'), false, 'Class filter must exclude 2BAC-SM-1 homework');

    const agendaFilteredEmptyHtml = win.buildPedagogicalAgendaPrintHtml({ scope: 'month', year: 2026, month: 10, category: 'homework', className: 'TCL-9' });
    assert.ok(agendaFilteredEmptyHtml.includes('لا توجد مواعيد أو فروض أو واجبات مسجلة'), 'Empty category+class filter must render clean empty state');

    // 3. Print Hub Modal: mounts controls, syncs selected Month/Year, triggers stripped preview CSS, and closes on Escape
    win.openCalendarPrintHubModal();
    const hub = dom.window.document.getElementById('calendarPrintHubModal');
    assert.ok(hub, 'calendarPrintHubModal must mount in DOM');
    const monthSel = dom.window.document.getElementById('calPrintHubMonthSelect');
    const yearSel = dom.window.document.getElementById('calPrintHubYearSelect');
    assert.equal(monthSel.value, '10');
    assert.equal(yearSel.value, '2026');

    monthSel.value = '9';
    monthSel.dispatchEvent(new dom.window.Event('change'));
    assert.ok(dom.window.document.getElementById('calPrintHubActiveLabel').textContent.includes('أكتوبر 2026'));
    assert.ok(dom.window.document.getElementById('calPrintHubMonthCardTitle').textContent.includes('أكتوبر 2026'));

    dom.window.document.getElementById('btnPrintHubMonthlyDetailed').click();
    assert.equal(dom.window.document.getElementById('calendarPrintHubModal'), null, 'Hub modal must close after selecting a print action');
    assert.equal(capturedPreviews.length, 1);
    assert.ok(capturedPreviews[0].opts.title.includes('أكتوبر 2026'));
    assert.equal(capturedPreviews[0].html.includes('@page'), false, 'openOrPrintCalendarDocument must strip @page rule before passing to preview modal');
    assert.equal(/\bbody\s*\{/i.test(capturedPreviews[0].html), false, 'openOrPrintCalendarDocument must strip global body CSS before passing to preview modal');

    // Reopen hub and test Pedagogical Agenda button + Escape key dismissal
    win.openCalendarPrintHubModal();
    dom.window.document.getElementById('calPrintHubAgendaScope').value = 'year';
    dom.window.document.getElementById('btnPrintHubAgenda').click();
    assert.equal(capturedPreviews.length, 2);
    assert.ok(capturedPreviews[1].html.includes('الأجندة البيداغوجية الشاملة'));
    assert.equal(capturedPreviews[1].html.includes('@page'), false);

    win.openCalendarPrintHubModal();
    assert.ok(dom.window.document.getElementById('calendarPrintHubModal'));
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(dom.window.document.getElementById('calendarPrintHubModal'), null, 'Escape key must close calendarPrintHubModal');
});

test('Monthly Detailed Schedule Print, Blank-Print Pipeline Fixes, CSS Media Rules & PDF Clone Audit', () => {
    const { dom, win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <span id="currentMonthYear">نونبر 2026</span>
        <select id="monthlyCalMonthSelect"><option value="10" selected>نونبر</option></select>
        <select id="monthlyCalYearSelect"><option value="2026" selected>2026</option></select>
        <div id="calendarView" style="display: block;"></div>
    </body></html>`);

    const capturedPreviews = [];
    win.db = {
        teacherProfile: { name: 'ذ. رشيد الحسني <script>xss()</script>', academicYear: '2026 / 2027' },
        officialHolidays: [
            { id: 'hol_ind', title: 'عيد الاستقلال', startDate: '2026-11-18', endDate: '2026-11-18', categoryLabel: 'عطلة وطنية', daysCount: 1, notes: 'عطلة مؤداة عنها' }
        ],
        teacherLeaves: [
            { id: 'lv_1', type: 'medical', title: 'رخصة طبية', startDate: '2026-11-12', endDate: '2026-11-12', daysCount: 1, reason: 'شهادة طبية' }
        ],
        academicMilestones: [
            { id: 'ms_1', title: 'الفرض الأول <img src=x onerror=alert(1)>', startDate: '2026-11-10', endDate: '2026-11-10', category: 'exam', targetLevels: '2BAC-SM-1', timeSlot: '08:30 - 10:30' }
        ],
        upcomingExams: [
            { id: 'ex_1', title: 'الفرض المحروس 1', date: '2026-11-20', className: '2BAC-SM-1', timeSlot: '10:30 - 12:30' }
        ],
        agenda: [
            { id: 'ag_1', date: '2026-11-14', text: 'مجلس التنسيق', type: 'اجتماع', className: '2BAC-PC-1', timeSlot: '15:00' }
        ],
        homeworkAgenda: {
            '2BAC-SM-1': [{ id: 'hw_1', title: 'سلسلة الدوال', dueDate: '2026-11-23', topic: 'الاشتقاق' }]
        },
        calendarEvents: []
    };
    win.getAppNow = () => new Date('2026-11-15T09:00:00Z');
    win.getTimetableSessionsForDate = (dateStr) => {
        if (dateStr === '2026-11-09') {
            return { sessions: [{ startTime: '08:30', endTime: '10:30', hours: 2, className: '2BAC-SM-1', room: 'Q4', hasHomework: true }] };
        }
        if (dateStr === '2026-11-18') {
            // Even if timetable returns a session on a holiday, detailed schedule marks the day exempt
            return { sessions: [{ startTime: '10:30', endTime: '12:30', hours: 2, className: '2BAC-PC-1', room: 'Q2' }] };
        }
        return { sessions: [] };
    };
    win.openCustomPrintPreviewModal = (html, opts) => capturedPreviews.push({ html, opts });
    win.renderCalendar = () => {};
    win.renderSchoolYearProgress = () => {};

    runPublicScript(sandbox, 'public/annual-calendar.js');

    // 1. stripGlobalBodyAndPageCssForPreview removes nested @media print, @page, *, html, body
    const dirtyHtml = `<style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 6mm; }
        .cal-keep { color: #1e3a8a; }
        @media print { body { padding: 0; } }
    </style><div>محتوى رسمي</div>`;
    const stripped = win.stripGlobalBodyAndPageCssForPreview(dirtyHtml);
    assert.equal(stripped.includes('@page'), false, 'stripGlobalBodyAndPageCssForPreview must strip @page');
    assert.equal(/\*\s*\{/.test(stripped), false, 'stripGlobalBodyAndPageCssForPreview must strip * { ... }');
    assert.equal(/\b(?:html|body)\s*\{/i.test(stripped), false, 'stripGlobalBodyAndPageCssForPreview must strip html/body CSS rules');
    assert.equal(/@media\s+print/i.test(stripped), false, 'stripGlobalBodyAndPageCssForPreview must strip @media print');
    assert.ok(stripped.includes('.cal-keep'), 'stripGlobalBodyAndPageCssForPreview must retain scoped class CSS');

    // 2. buildMonthlyDetailedSchedulePrintHtml supports 'all', 'events_only', 'sessions_only', weekly dividers, hours & XSS safety
    const fullSchedHtml = win.buildMonthlyDetailedSchedulePrintHtml({ year: 2026, month: 10, detailedDaysMode: 'all', includeMiniGrid: true });
    assert.ok(fullSchedHtml.includes('جدول أيام ومواعيد شهر نونبر 2026 التفصيلي'));
    assert.ok(fullSchedHtml.includes('الأسبوع التربوي 1'), 'Must group days by pedagogical weeks');
    assert.ok(fullSchedHtml.includes('2BAC-SM-1: 2 س'), 'Must summarize class hours breakdown');
    assert.ok(fullSchedHtml.includes('08:30–10:30'), 'Must show formatted session time range');
    assert.ok(fullSchedHtml.includes('📚 واجب'), 'Must indicate homework badge on scheduled session');
    assert.ok(fullSchedHtml.includes('معفى تلقائياً من الحصص والغياب'), 'Must exempt holiday/leave rows');
    assert.ok(fullSchedHtml.includes('ملاحظات الإنجاز'), 'Must render notes tracking column by default');
    assert.ok(fullSchedHtml.includes('نظرة شاملة على شبكة شهر نونبر 2026'), 'Must render mini-grid when includeMiniGrid=true');
    assert.ok(fullSchedHtml.includes('&lt;script&gt;xss()&lt;/script&gt;'), 'Must escape teacher name XSS');
    assert.equal(fullSchedHtml.includes('<img src=x onerror=alert(1)>'), false, 'Must escape milestone XSS');

    const sessionsOnlyHtml = win.buildMonthlyDetailedSchedulePrintHtml({ year: 2026, month: 10, detailedDaysMode: 'sessions_only', includeNotesColumn: false, returnInnerOnly: true });
    assert.ok(sessionsOnlyHtml.includes('2026-11-09'), 'sessions_only must retain Nov 9 session day');
    assert.equal(sessionsOnlyHtml.includes('2026-11-18'), false, 'sessions_only must exclude exempt holiday days');
    assert.equal(sessionsOnlyHtml.includes('2026-11-20'), false, 'sessions_only must exclude days with no timetable sessions');
    assert.equal(sessionsOnlyHtml.includes('ملاحظات الإنجاز'), false, 'includeNotesColumn=false must omit notes column');

    const eventsOnlyHtml = win.buildMonthlyDetailedSchedulePrintHtml({ year: 2026, month: 10, detailedDaysMode: 'events_only', returnInnerOnly: true });
    assert.ok(eventsOnlyHtml.includes('2026-11-09') && eventsOnlyHtml.includes('2026-11-18') && eventsOnlyHtml.includes('2026-11-23'), 'events_only must include session, holiday, and homework days');
    assert.equal(eventsOnlyHtml.includes('2026-11-01'), false, 'events_only must exclude empty Sunday Nov 1');

    // 3. Universal PDF builder & Print Hub Modal wiring for detailed monthly schedule
    const univSched = win.buildActiveCalendarUniversalPdfHTML({ calendarDocKind: 'monthly_schedule', year: 2026, month: 10 });
    assert.ok(univSched.includes('جدول أيام ومواعيد شهر نونبر 2026 التفصيلي'));
    const univAgenda = win.buildActiveCalendarUniversalPdfHTML({ calendarDocKind: 'agenda', scope: 'month', year: 2026, month: 10 });
    assert.ok(univAgenda.includes('الأجندة البيداغوجية الشاملة'));

    win.openCalendarPrintHubModal();
    const schedModeSel = dom.window.document.getElementById('calPrintHubScheduleMode');
    const schedBtn = dom.window.document.getElementById('btnPrintHubMonthlySchedule');
    assert.ok(schedModeSel && schedBtn, 'Print Hub Card 4 must expose schedule filter selector and print button');
    schedModeSel.value = 'sessions_only';
    schedBtn.click();
    assert.equal(capturedPreviews.length, 1);
    assert.ok(capturedPreviews[0].opts.title.includes('جدول أيام ومواعيد شهر نونبر 2026'));
    assert.ok(capturedPreviews[0].html.includes('أيام الحصص الدراسية فقط'));

    // 4. beforeprint / afterprint toggles printing-calendar-view automatically when calendarView is visible
    win.dispatchEvent(new dom.window.Event('beforeprint'));
    assert.ok(dom.window.document.body.classList.contains('printing-calendar-view'), 'beforeprint must add printing-calendar-view when #calendarView is active');
    win.dispatchEvent(new dom.window.Event('afterprint'));
    assert.equal(dom.window.document.body.classList.contains('printing-calendar-view'), false, 'afterprint must clean up auto printing-calendar-view');

    // 5. Static audit of style.css and app.js blank-print & PDF-clone pipeline fixes
    const cssText = fs.readFileSync(path.join(ROOT, 'public/style.css'), 'utf8');
    assert.ok(cssText.includes('#customReportPreviewScrollStage') && /#customReportPreviewScrollStage[\s\S]*display:\s*block\s*!important/.test(cssText), 'style.css must reset preview flex scroll stage to block in @media print');
    assert.ok(/body\.printing-calendar-view\s+#calendarView\s+\.card[\s\S]*break-inside:\s*auto\s*!important/.test(cssText), 'style.css must disable .card break-inside:avoid in calendar print mode');

    const appJsText = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    assert.ok(appJsText.includes('left:-12000px; top:0; width:${frameWidthCss}; height:${frameHeightCss}; border:0; opacity:1; visibility:visible;'), 'printDocumentDirectly must render visible page-sized off-screen iframe');
    assert.equal(/globalAppPrintIframe[\s\S]{0,400}visibility:\s*hidden/.test(appJsText), false, 'printDocumentDirectly must never hide iframe with visibility:hidden or 0x0 dimensions');
    assert.ok(appJsText.includes('customReportPdfExportClone') && appJsText.includes('scrollX: 0, scrollY: 0'), 'PDF export must clone sheet into clean top-left container with scrollX:0, scrollY:0');
});

test('Moroccan Pedagogical Guidelines (2007) & Ministerial Note 142-08 Deep Alignment: STE/STM coef 7, Applied Arts coef 4, hardened getCurriculumLevelForClass & extractClassLevelTrack', () => {
    const { win, sandbox } = createDomSandbox();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');

    // 1. Verify getCurriculumLevelForClass safely routes all Moroccan tracks without false substring matches
    const getLvl = win.getCurriculumLevelForClass;
    assert.equal(getLvl('TCS-1'), 'TCS');
    assert.equal(getLvl('TCT-2'), 'TCS');
    assert.equal(getLvl('TCL-1'), 'TCL');
    assert.equal(getLvl('2TCL-1'), 'TCL', 'Tronc commun literary with leading 2 must stay TCL');
    assert.equal(getLvl('1TCS-2'), 'TCS', 'Tronc commun scientific with leading 1 must stay TCS');
    assert.equal(getLvl('1BAC-SE-1'), '1BAC_EXP');
    assert.equal(getLvl('1BAC-STE-1'), '1BAC_EXP');
    assert.equal(getLvl('1BAC-STM-1'), '1BAC_EXP');
    assert.equal(getLvl('1BAC-SM-1'), '1BAC_SM');
    assert.equal(getLvl('1BAC-ECO-1'), '1BAC_ECO');
    assert.equal(getLvl('1BAC-LSH-1'), '1BAC_LSH');
    assert.equal(getLvl('1BAC-SH-2'), '1BAC_LSH');
    assert.equal(getLvl('1BAC-ARTS-1'), '1BAC_LSH');
    assert.equal(getLvl('2BAC-PC-1'), '2BAC_EXP');
    assert.equal(getLvl('2BAC-SVT-2'), '2BAC_EXP');
    assert.equal(getLvl('2BAC-AGRO-1'), '2BAC_EXP');
    assert.equal(getLvl('2BAC-STE-1'), '2BAC_EXP');
    assert.equal(getLvl('2BAC-STM-1'), '2BAC_EXP');
    assert.equal(getLvl('2BAC-SMA-1'), '2BAC_SM');
    assert.equal(getLvl('2BAC-SMB-1'), '2BAC_SM');
    assert.equal(getLvl('2BAC-ECO-1'), '2BAC_ECO');
    assert.equal(getLvl('2BAC-SGC-1'), '2BAC_ECO');
    assert.equal(getLvl('2BAC-LSH-1'), '2BAC_LSH');
    assert.equal(getLvl('2BAC-SH-1'), '2BAC_LSH');
    assert.equal(getLvl('2BAC-ARTS-1'), '2BAC_LSH');
    assert.equal(getLvl('1BAC-ENGLISH-BIOF'), '1BAC_EXP', 'Word containing SH inside ENGLISH must not misclassify as Literary LSH');
    assert.equal(getLvl('2BAC-ENGLISH-BIOF'), '2BAC_EXP', 'Word containing SH inside ENGLISH must not misclassify as Literary LSH');

    // 2. Verify React source files align STE/STM coefficient to 7 (never 6) and default exam counts to 3 (4 only for SM, 2 for Lit)
    const dashSrc = fs.readFileSync(path.join(ROOT, 'src/DashboardView.tsx'), 'utf8');
    const repEvoSrc = fs.readFileSync(path.join(ROOT, 'src/ReportsEvolutionChart.tsx'), 'utf8');
    const trendsSrc = fs.readFileSync(path.join(ROOT, 'src/AcademicYearPerformanceTrends.tsx'), 'utf8');
    const pdfExportSrc = fs.readFileSync(path.join(ROOT, 'src/ComprehensiveAnalysisPdfExport.tsx'), 'utf8');
    const aiRemSrc = fs.readFileSync(path.join(ROOT, 'src/AiRemediationView.tsx'), 'utf8');
    const analysisSrc = fs.readFileSync(path.join(ROOT, 'src/Analysis.tsx'), 'utf8');
    const appJsSrc = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

    assert.equal(dashSrc.includes('isTech ? 6'), false, 'DashboardView.tsx must never assign coefficient 6 to STE/STM');
    assert.ok(dashSrc.includes('isTech ? 7'), 'DashboardView.tsx must assign official Note 142-08 coefficient 7 to STE/STM');
    assert.equal(repEvoSrc.includes('المعامل الرسمي: 6'), false, 'ReportsEvolutionChart.tsx must never display coefficient 6 for STE/STM');
    assert.ok(repEvoSrc.includes('المعامل الرسمي: 7 (علوم وتكنولوجيات STE/STM - 3 فروض)'), 'ReportsEvolutionChart.tsx must display coefficient 7 for 2BAC STE/STM');
    assert.ok(repEvoSrc.includes('المعامل الرسمي: 7 (1 باك علوم وتكنولوجيات STE/STM - 3 فروض)'), 'ReportsEvolutionChart.tsx must display coefficient 7 for 1BAC STE/STM');
    assert.equal(trendsSrc.includes("if (upper.includes('2BAC') || upper.includes('SM')"), false, 'AcademicYearPerformanceTrends.tsx must not default all 2BAC classes to 4 exams');

    // 3. Verify 2-exam Literary tracks (hasF3 / hasF3Exam / hasF3Column) & track-aware diagnostics
    assert.ok(pdfExportSrc.includes("hasF4 ? 'F1 - F2 - F3 - F4' : hasF3 ? 'F1 - F2 - F3' : 'F1 - F2'"), 'ComprehensiveAnalysisPdfExport.tsx must support 2-exam Literary tracks (F1 - F2)');
    assert.ok(aiRemSrc.includes('isLitOrEco') && aiRemSrc.includes('hasF3Exam'), 'AiRemediationView.tsx must use curriculum-track aware diagnostics and hasF3Exam');
    assert.ok(analysisSrc.includes('hasF3Column') && analysisSrc.includes('hasF4Column'), 'Analysis.tsx must conditionally render F3 and F4 columns based on class exam count');
    assert.ok(appJsSrc.includes('let studentAvgsList = [];') && appJsSrc.includes('calculateStudentAvg(stdGrades, className)'), 'buildReportsPdfHTML in app.js must compute class statistics from student continuous assessment averages');

    // 4. Verify Deep Audit Fixes across React Analytics, ExamFrameworkModal, DashboardView, Council Digest, and Roadmap
    const examModalSrc = fs.readFileSync(path.join(ROOT, 'src/ExamFrameworkModal.tsx'), 'utf8');
    const councilSrc = fs.readFileSync(path.join(ROOT, 'src/PedagogicalCouncilOrientationView.tsx'), 'utf8');
    const roadmapSrc = fs.readFileSync(path.join(ROOT, 'src/StrategicRoadmapSuite.tsx'), 'utf8');

    // 4a. Analysis.tsx classAbsenceSuccessComparison aliases & dynamic yearlyExpectedExams (4 / 6 / 8)
    assert.ok(analysisSrc.includes('successRate: overallSuccessRate') && analysisSrc.includes('avgAbsentHoursPerStudent: avgAbsentHours'), 'Analysis.tsx must expose successRate, absenceRate, classAvg, and avgAbsentHoursPerStudent aliases for charts and PDF export');
    assert.ok(analysisSrc.includes('const yearlyExpectedExams = classExamsCount * 2;') && analysisSrc.includes('/{row.yearlyExpectedExams || 6}'), 'Analysis.tsx must compute dynamic yearlyExpectedExams (4 for Lit, 6 for Standard, 8 for SM) instead of hardcoding /6');

    // 4b. ExamFrameworkModal.tsx Note 142-08 exam counts (2 for Lit, 4 for SM, 3 for others), skill targets (60%/40% vs 40-45%/40-45%/10-20%), and 2BAC_PC domain alignment
    assert.equal(examModalSrc.includes("domain: 'التحليل ودراسة الدوال'"), false, 'ExamFrameworkModal.tsx must not use stale domain label التحليل ودراسة الدوال in 2BAC_PC defaults');
    assert.ok(examModalSrc.includes("const isLiteraryPreset = selectedLevel === 'TCL' || selectedLevel === '1BAC_LSH' || selectedLevel === '2BAC_LSH';"), 'ExamFrameworkModal.tsx must restrict all Literary tracks (TCL, 1BAC_LSH, 2BAC_LSH) to 2 exams per semester');
    assert.ok(examModalSrc.includes('المذكرة 142-08: ~60%') && examModalSrc.includes('المذكرة 142-08: 10%-20%'), 'ExamFrameworkModal.tsx must display Note 142-08 page 9 skill distribution targets per track');

    // 4c. DashboardView.tsx official annual teaching hours (34 weeks: 238h SM, 170h Sci/Tech, 136h Eco, 102h Art, 68h Lit)
    assert.ok(dashSrc.includes('const annualHours = weeklyHours * 34;') && dashSrc.includes("semester === 'annual' ? meta.annualHours : Math.max(17, Math.round(meta.annualHours / 2))"), 'DashboardView.tsx must compute expected session hours from official 2007 Pedagogical Guidelines weekly/annual hours');

    // 4d. PedagogicalCouncilOrientationView.tsx dynamic F3/F4 columns in printed council digest
    assert.ok(councilSrc.includes('configuredExamsCount >= 3') && councilSrc.includes('configuredExamsCount >= 4'), 'PedagogicalCouncilOrientationView.tsx must dynamically include F3/F4 in printed council digest');

    // 4e. StrategicRoadmapSuite.tsx full exam sequence in early warning table & ReportsEvolutionChart.tsx 2BAC LSH certification clarity
    assert.ok(roadmapSrc.includes('[item.f1, item.f2, item.f3, item.f4].filter'), 'StrategicRoadmapSuite.tsx must display full completed exam sequence F1..F4 in Early Warning table');
    assert.ok(repEvoSrc.includes('المراقبة المستمرة والأحرار') && repEvoSrc.includes('معامل 1 للمتمدرسين - فرضان في كل دورة'), 'ReportsEvolutionChart.tsx must distinguish 2BAC LSH regular school assessment from free-candidate national exam');
});

test('Camera & Gemini Vision AI Handwritten Notes and Pedagogical Plans Scanner: modal UI, vision transcription endpoint, notes & lesson log saving', async () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
    const indexHtmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // 1. Verify server.ts endpoint and Gemini multimodal inlineData configuration
    assert.ok(serverSrc.includes('app.post("/api/ai/transcribe-handwritten-notes"'), 'server.ts must expose POST /api/ai/transcribe-handwritten-notes');
    assert.ok(serverSrc.includes('inlineData: {') && serverSrc.includes('mimeType,') && serverSrc.includes('data: cleanBase64'), 'server.ts must pass multimodal inlineData to Gemini');

    // 2. Verify index.html buttons and script tag
    assert.ok(indexHtmlSrc.includes('id="btnOpenCameraNotesScannerHeader"'), 'index.html must include camera scanner button in notesView header');
    assert.ok(indexHtmlSrc.includes('id="btnScanHandwrittenNoteWithCamera"'), 'index.html must include camera scanner button in note editor');
    assert.ok(indexHtmlSrc.includes('id="btnOpenCameraPlanScannerHeader"'), 'index.html must include camera scanner button in lessonLogView header');
    assert.ok(indexHtmlSrc.includes('src="/camera-notes-scanner.js'), 'index.html must load /camera-notes-scanner.js');

    // 3. Execute camera-notes-scanner.js in DOM sandbox and test transcription -> notes, lesson log, and homework saving
    const { win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <div id="notesView" style="display: block;">
            <select id="notesClassSelect"><option value="2BAC-PC-1" selected>2BAC-PC-1</option></select>
            <select id="newNoteCategorySelect"><option value="pedagogical">pedagogical</option><option value="behavioral">behavioral</option></select>
            <select id="newNoteSentimentSelect"><option value="positive">positive</option><option value="guidance">guidance</option><option value="alert">alert</option></select>
            <textarea id="newNoteText"></textarea>
        </div>
        <div id="lessonLogView" style="display: none;">
            <select id="lessonLogClassSelect"><option value="2BAC-PC-1" selected>2BAC-PC-1</option></select>
            <input id="lessonLogDate" value="2026-11-26" />
            <input id="lessonLogNumber" value="" />
            <select id="lessonLogSessionType"><option value="cours">cours</option><option value="exercices">exercices</option></select>
            <textarea id="lessonLogSummary"></textarea>
            <input id="lessonLogHomework" value="" />
        </div>
    </body></html>`);

    win.db = {
        classes: {
            '2BAC-PC-1': [
                { id: 101, name: 'أحمد العلمي' },
                { id: 102, name: 'سلمى بنعلي' }
            ]
        },
        notes: { '2BAC-PC-1': [] },
        lessonLogs: { '2BAC-PC-1': [] },
        homeworkAgenda: { '2BAC-PC-1': [] }
    };
    win.saveDB = () => {};
    win.renderNotes = () => {};
    win.renderLessonLogs = () => {};
    win.renderHomeworkAgenda = () => {};
    win.notifySafeToast = () => {};

    // Mock fetch to simulate Gemini Vision AI response
    const mockGeminiVisionResponse = {
        source: 'gemini_vision_ai',
        detectedType: 'mixed',
        documentTitle: 'جذاذة وملاحظات درس الاتصال والاشتقاق',
        rawTranscription: 'الدرس: الاتصال والاشتقاق - مبرهنة القيم الوسيطية. ملاحظة: تفوق التلميذ أحمد العلمي في البرهان الرياضي.',
        organizedSummary: 'حصة بناء مفهوم الاتصال ومبرهنة القيم الوسيطية مع رصد تفاعل التلاميذ.',
        notes: [
            {
                text: 'تفوق التلميذ أحمد العلمي في توظيف مبرهنة القيم الوسيطية والبرهان الرياضي.',
                category: 'pedagogical',
                sentiment: 'positive',
                studentName: 'أحمد العلمي'
            },
            {
                text: 'ضرورة إنجاز التمارين التطبيقية لتثبيت حساب النهايات.',
                category: 'pedagogical',
                sentiment: 'guidance',
                studentName: ''
            }
        ],
        lessonPlan: {
            lessonTitle: 'الاتصال والاشتقاق ودراسة الدوال',
            sessionType: 'cours',
            duration: '2',
            axes: [
                { title: 'مبرهنة القيم الوسيطية', content: 'تقديم المبرهنة والتأويل الهندسي وتطبيقها على المعادلة f(x)=0' }
            ],
            summaryContent: 'إرساء مبرهنة القيم الوسيطية وحل تمرين تطبيقي على السبورة.',
            homework: 'إنجاز التمرين 4 و 5 ص 42 حول مبرهنة القيم الوسيطية',
            observations: 'تفاعل جيد للقسم'
        },
        homeworkItem: {
            title: 'إنجاز التمرين 4 و 5 ص 42 حول مبرهنة القيم الوسيطية',
            type: 'homework',
            topic: 'الاتصال والاشتقاق',
            dueDate: '2026-11-30'
        }
    };

    win.fetch = async () => ({
        ok: true,
        json: async () => mockGeminiVisionResponse
    });
    sandbox.fetch = win.fetch;

    runPublicScript(sandbox, 'public/camera-notes-scanner.js');
    const doc = win.document;

    // Open modal
    win.openHandwrittenCameraScannerModal('auto', '2BAC-PC-1');
    const modal = doc.getElementById('handwrittenCameraScannerModal');
    assert.ok(modal, 'handwrittenCameraScannerModal must be created in DOM');
    assert.equal(modal.style.display, 'flex', 'Modal must be visible when opened');

    // Provide custom hint and trigger Gemini analysis
    const hintInput = doc.getElementById('cameraScannerCustomHintInput');
    hintInput.value = 'جذاذة درس الاتصال والاشتقاق';
    await win.analyzeHandwrittenImageWithGemini();

    // Verify raw transcription populated
    const rawTextarea = doc.getElementById('cameraScannerRawTranscriptionText');
    assert.ok(rawTextarea.value.includes('مبرهنة القيم الوسيطية'), 'Transcribed text must populate in modal');

    // Verify batch saving extracted notes matches student 'أحمد العلمي' (id 101) and general class note ('all')
    const savedCount = win.saveAllExtractedNotesFromScanner();
    assert.equal(savedCount, 2, 'Must save 2 extracted notes into db.notes');
    assert.equal(win.db.notes['2BAC-PC-1'].length, 2);
    assert.equal(win.db.notes['2BAC-PC-1'][0].studentId, '101', 'First note must match student أحمد العلمي (ID 101)');
    assert.equal(win.db.notes['2BAC-PC-1'][0].sentiment, 'positive');
    assert.equal(win.db.notes['2BAC-PC-1'][1].studentId, 'all', 'Second note must be saved as class-level note');

    // Verify filling lesson log form
    win.fillLessonLogFormFromScanner();
    assert.equal(doc.getElementById('lessonLogNumber').value, 'الاتصال والاشتقاق ودراسة الدوال');
    assert.ok(doc.getElementById('lessonLogSummary').value.includes('مبرهنة القيم الوسيطية'));
    assert.ok(doc.getElementById('lessonLogHomework').value.includes('التمرين 4 و 5'));

    // Verify direct saving to lesson logs and homework agenda
    const savedLesson = win.saveExtractedLessonPlanDirectly();
    assert.ok(savedLesson && savedLesson.number === 'الاتصال والاشتقاق ودراسة الدوال');
    assert.equal(win.db.lessonLogs['2BAC-PC-1'].length, 1);

    const savedHw = win.saveExtractedHomeworkToAgenda();
    assert.ok(savedHw && savedHw.title.includes('التمرين 4 و 5'));
    assert.equal(win.db.homeworkAgenda['2BAC-PC-1'].length, 1);
});

test('End-to-End Multi-Class Realistic Simulation Across All 14 Moroccan Qualifying Secondary Tracks: Grades, Massar CSV, Curriculum Pacing, Notes PDF, Analysis PDF & Camera Scanner Object-Wrapped Classes', async () => {
    const { win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <div id="notesView" style="display: block;">
            <select id="notesClassSelect"></select>
            <select id="newNoteCategorySelect"><option value="pedagogical">pedagogical</option></select>
            <select id="newNoteSentimentSelect"><option value="positive">positive</option></select>
            <textarea id="newNoteText"></textarea>
        </div>
        <div id="lessonLogView" style="display: none;">
            <select id="lessonLogClassSelect"></select>
            <input id="lessonLogDate" value="2026-11-26" />
            <input id="lessonLogNumber" value="" />
            <select id="lessonLogSessionType"><option value="cours">cours</option></select>
            <textarea id="lessonLogSummary"></textarea>
            <input id="lessonLogHomework" value="" />
        </div>
    </body></html>`);

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/massar-io.js');
    runPublicScript(sandbox, 'public/core/absence-manager.js');
    runPublicScript(sandbox, 'public/core/lesson-log-engine.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/camera-notes-scanner.js');

    const ALL_14_CLASSES = [
        { name: 'TCS-1', expectedCode: 'TCS', coef: 4, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: 'TCS' },
        { name: 'TCT-1', expectedCode: 'TCS', coef: 4, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: 'TCS' },
        { name: 'TCL-1', expectedCode: 'LIT', coef: 2, exams: 2, duration: 1, weeklyH: 2, annualH: 68, currKey: 'TCL' },
        { name: '1BAC-SM-1', expectedCode: 'SM', coef: 9, exams: 4, duration: 2, weeklyH: 7, annualH: 238, currKey: '1BAC_SM' },
        { name: '1BAC-SE-1', expectedCode: 'SE', coef: 7, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: '1BAC_EXP' },
        { name: '1BAC-STE-1', expectedCode: 'TECH', coef: 7, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: '1BAC_EXP' },
        { name: '1BAC-ECO-1', expectedCode: 'ECO', coef: 4, exams: 3, duration: 2, weeklyH: 4, annualH: 136, currKey: '1BAC_ECO' },
        { name: '1BAC-LSH-1', expectedCode: 'BAC_LSH', coef: 1, exams: 2, duration: 1, weeklyH: 2, annualH: 68, currKey: '1BAC_LSH' },
        { name: '1BAC-ARTS-1', expectedCode: 'ART', coef: 4, exams: 3, duration: 1, weeklyH: 3, annualH: 102, currKey: '1BAC_LSH' },
        { name: '2BAC-SMA-1', expectedCode: 'SM', coef: 9, exams: 4, duration: 2, weeklyH: 7, annualH: 238, currKey: '2BAC_SM' },
        { name: '2BAC-PC-1', expectedCode: 'PC', coef: 7, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: '2BAC_EXP' },
        { name: '2BAC-SVT-1', expectedCode: 'SVT', coef: 7, exams: 3, duration: 2, weeklyH: 5, annualH: 170, currKey: '2BAC_EXP' },
        { name: '2BAC-ECO-1', expectedCode: 'ECO', coef: 4, exams: 3, duration: 2, weeklyH: 4, annualH: 136, currKey: '2BAC_ECO' },
        { name: '2BAC-LSH-1', expectedCode: 'BAC_LSH', coef: 1, exams: 2, duration: 1, weeklyH: 2, annualH: 68, currKey: '2BAC_LSH' }
    ];

    win.db = { classes: {}, grades: {}, gradesS1: {}, gradesS2: {}, notes: {}, lessonLogs: {}, homeworkAgenda: {}, records: [] };
    win.saveDB = () => {};
    win.renderNotes = () => {};
    win.renderLessonLogs = () => {};
    win.renderHomeworkAgenda = () => {};
    win.notifySafeToast = () => {};

    for (const cls of ALL_14_CLASSES) {
        // 1. Official Stream Config & Curriculum parity
        const cfg = win.GradesCalculator.getStreamOfficialConfig(cls.name);
        assert.equal(cfg.code, cls.expectedCode, `Track code mismatch for ${cls.name}`);
        assert.equal(cfg.coefficient, cls.coef, `Coefficient mismatch for ${cls.name}`);
        assert.equal(cfg.examsPerSemester, cls.exams, `Exams per semester mismatch for ${cls.name}`);
        assert.equal(cfg.examDurationHours, cls.duration, `Exam duration mismatch for ${cls.name}`);
        assert.equal(cfg.weeklyHours, cls.weeklyH, `Weekly hours mismatch for ${cls.name}`);
        assert.equal(cfg.annualHours, cls.annualH, `Annual hours mismatch for ${cls.name}`);

        const currLvl = win.getCurriculumLevelForClass(cls.name);
        assert.equal(currLvl, cls.currKey, `Curriculum level key mismatch for ${cls.name}`);

        // 2. Populate realistic students (test both Array and { students: [...] } object shapes)
        const studentsArr = [
            { id: `${cls.name}_1`, name: 'ياسين المرابط', massar: 'R130011223', group: '1', grades: { s1: { f1: '16,5', f2: '15,5', f3: '14,0', f4: '18,0' } } },
            { id: `${cls.name}_2`, name: 'مريم الإدريسي', massar: 'G140099887', group: '2', grades: { s1: { f1: '11,0', f2: '13,0', f3: '9,0', f4: '10,0' } } },
            { id: `${cls.name}_3`, name: 'حمزة التازي', massar: 'K150044556', group: '1', grades: { s1: { f1: '07,5', f2: '08,5', f3: '06,5', f4: '07,0' } } }
        ];
        win.db.classes[cls.name] = cls.exams === 2 ? { students: studentsArr } : studentsArr;

        // 3. Verify GradesCalculator semester average strictly respects cls.exams (2, 3, or 4) even if extra f3/f4 keys exist
        const st1Grades = studentsArr[0].grades.s1;
        const st1Avg = win.GradesCalculator.calculateStudentSemesterAverage(st1Grades, { examCount: cls.exams });
        if (cls.exams === 2) {
            assert.equal(st1Avg, 16.0, `${cls.name} (2 exams) must average only F1 (16.5) and F2 (15.5) = 16.0`);
        } else if (cls.exams === 3) {
            assert.equal(st1Avg, 15.33, `${cls.name} (3 exams) must average F1, F2, F3 = 15.33`);
        } else if (cls.exams === 4) {
            assert.equal(st1Avg, 16.0, `${cls.name} (4 exams) must average F1, F2, F3, F4 = 16.0`);
        }

        // 4. Verify Massar CSV export columns & student.massar fallback & exact examCount average
        const csv = win.MassarIO.buildMassarCsvExport(win.db.classes[cls.name], cls.name, 's1');
        const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
        const headerCols = lines[0].split(';');
        assert.equal(lines.length, 4, `Massar CSV for ${cls.name} must contain header + 3 student rows`);
        assert.ok(lines[1].includes('R130011223'), `Massar CSV for ${cls.name} must export st.massar CNE code`);

        if (cls.exams === 2) {
            assert.equal(headerCols.includes('الفرض 3'), false, `2-exam Literary class ${cls.name} CSV must NOT include الفرض 3`);
            assert.equal(headerCols.includes('الفرض 4'), false, `2-exam Literary class ${cls.name} CSV must NOT include الفرض 4`);
            assert.ok(lines[1].endsWith(';16'), `2-exam Literary class ${cls.name} CSV average for st1 must be 16`);
        } else if (cls.exams === 3) {
            assert.equal(headerCols.includes('الفرض 3'), true, `3-exam class ${cls.name} CSV must include الفرض 3`);
            assert.equal(headerCols.includes('الفرض 4'), false, `3-exam class ${cls.name} CSV must NOT include الفرض 4`);
            assert.ok(lines[1].endsWith(';15,33'), `3-exam class ${cls.name} CSV average for st1 must be 15,33`);
        } else if (cls.exams === 4) {
            assert.equal(headerCols.includes('الفرض 3'), true, `4-exam SM class ${cls.name} CSV must include الفرض 3`);
            assert.equal(headerCols.includes('الفرض 4'), true, `4-exam SM class ${cls.name} CSV must include الفرض 4`);
            assert.ok(lines[1].endsWith(';16'), `4-exam SM class ${cls.name} CSV average for st1 must be 16`);
        }

        // 5. Verify LessonLogEngine curriculum pacing & companion brief for each class
        const pacing = win.LessonLogEngine.computeCurriculumPacingMetrics({
            completedHours: Math.round(cls.annualH / 2),
            plannedAnnualHours: cls.annualH,
            elapsedWeeks: 17,
            totalTeachingWeeks: 34
        });
        assert.equal(pacing.status, 'on_track', `Curriculum pacing at week 17/34 must be on_track for ${cls.name}`);
        const brief = win.LessonLogEngine.buildCompanionAppPedagogicalBrief({
            className: cls.name,
            semester: 's1',
            classMean: 12.5,
            passRate: 78,
            strugglingCount: 2
        });
        assert.equal(brief.coefficient, cls.coef);
        assert.equal(brief.streamCode, cls.expectedCode);
    }

    // 6. Verify Camera Scanner matches student names even when db.classes[className] is an object { students: [...] } (like TCL-1)
    win.fetch = async () => ({
        ok: true,
        json: async () => ({
            source: 'gemini_vision_ai',
            detectedType: 'notes',
            documentTitle: 'ملاحظات قسم الجذع المشترك الأدبي',
            rawTranscription: 'تحسن ملحوظ للتلميذة مريم الإدريسي في الحساب العددي.',
            organizedSummary: 'تحسن ملحوظ للتلميذة مريم الإدريسي.',
            notes: [
                { text: 'تحسن ملحوظ للتلميذة مريم الإدريسي في الحساب العددي.', category: 'pedagogical', sentiment: 'positive', studentName: 'مريم الإدريسي' }
            ],
            lessonPlan: { lessonTitle: 'الإحصاء', sessionType: 'cours', duration: '1', axes: [], summaryContent: 'الإحصاء', homework: '', observations: '' },
            homeworkItem: { title: '', type: 'homework', topic: '', dueDate: '2026-11-30' }
        })
    });
    sandbox.fetch = win.fetch;

    win.openHandwrittenCameraScannerModal('notes', 'TCL-1');
    win.document.getElementById('cameraScannerCustomHintInput').value = 'ملاحظات TCL-1';
    await win.analyzeHandwrittenImageWithGemini();
    const savedTclNotes = win.saveAllExtractedNotesFromScanner();
    assert.equal(savedTclNotes, 1);
    assert.equal(win.db.notes['TCL-1'][0].studentId, 'TCL-1_2', 'Camera scanner must resolve studentId from { students: [...] } class structure');
});

test('Personalized Student Pedagogical Remediation Plan: integrates diagnostic 4-domain scores + statistical student record (grades, value-added, absences, homework, behavior), Gemini AI generation, notes & lesson log saving', async () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
    const indexHtmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const diagEvalSrc = fs.readFileSync(path.join(ROOT, 'public/diagnostic-evaluation.js'), 'utf8');
    const aiRemViewSrc = fs.readFileSync(path.join(ROOT, 'src/AiRemediationView.tsx'), 'utf8');

    assert.ok(serverSrc.includes('app.post("/api/ai/student-personalized-remediation-plan"'), 'server.ts must expose POST /api/ai/student-personalized-remediation-plan');
    assert.ok(indexHtmlSrc.includes('id="btnOpenPersonalizedStudentRemediationPlan"'), 'index.html must include personalized student remediation button in diagnosticReportCard');
    assert.ok(indexHtmlSrc.includes('src="/student-remediation-plan.js'), 'index.html must load /student-remediation-plan.js');
    assert.ok(diagEvalSrc.includes('openStudentPersonalizedRemediationModal'), 'diagnostic-evaluation.js must render per-student personalized remediation trigger');
    assert.ok(aiRemViewSrc.includes('openStudentPersonalizedRemediationModal'), 'AiRemediationView.tsx must expose per-student personalized remediation trigger');

    const { win, sandbox } = createDomSandbox(`<!DOCTYPE html><html dir="rtl" lang="ar"><body>
        <select id="reportClassSelect"><option value="1BAC-SE-1" selected>1BAC-SE-1</option></select>
    </body></html>`);

    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/student-remediation-plan.js');

    win.db = {
        classes: {
            '1BAC-SE-1': [
                { id: 'st_1', name: 'سفيان المنصوري', massar: 'D130055443', orderNum: 1 }
            ]
        },
        diagnostic: {
            '1BAC-SE-1': {
                'st_1': { d1: 1.5, d2: 3.5, d3: 1.25, d4: 2.75, total: 9.0 }
            }
        },
        grades: {
            '1BAC-SE-1': {
                'st_1': { s1: { f1: 8.5, f2: 9.5, f3: 9.0 }, s2: { f1: 10.5 } }
            }
        },
        records: [
            { class: '1BAC-SE-1', studentId: 'st_1', date: '2026-10-12', status: 'غائب', hours: 2, homework: 'لم ينجز' },
            { class: '1BAC-SE-1', studentId: 'st_1', date: '2026-10-19', status: 'غائب', hours: 2, homework: 'لم ينجز' },
            { class: '1BAC-SE-1', studentId: 'st_1', date: '2026-10-25', status: 'مبرر', hours: 2 },
            { class: '1BAC-SE-1', studentId: 'st_1', date: '2026-11-02', status: 'متأخر', hours: 1 }
        ],
        behaviors: {
            '1BAC-SE-1': {
                'st_1': { status: 'تنبيه', note: 'شرود الذهن أثناء الشرح' }
            }
        },
        notes: { '1BAC-SE-1': [] },
        lessonLogs: { '1BAC-SE-1': [] }
    };
    win.saveDB = () => {};
    win.renderNotes = () => {};
    win.renderLessonLogs = () => {};
    win.notifySafeToast = () => {};

    // 1. Verify unified diagnostic + statistical record extraction
    const rec = win.buildStudentDiagnosticAndStatisticalRecord('1BAC-SE-1', 'st_1');
    assert.ok(rec, 'Record must be extracted');
    assert.equal(rec.studentName, 'سفيان المنصوري');
    assert.equal(rec.diagnostic.total, 9.0);
    assert.equal(rec.diagnostic.d3, 1.25, 'Weakest domain d3 (Algebra & Analysis = 1.25/5) must be preserved');
    assert.equal(rec.statistics.s1Avg, 9.0);
    assert.equal(rec.statistics.s2Avg, 10.5);
    assert.equal(rec.statistics.currentAvg, 9.75);
    assert.equal(rec.statistics.valueAddedDelta, 0.75, 'Value-added delta = 9.75 - 9.0 = +0.75');
    assert.equal(rec.statistics.totalAbsentHours, 6, '4h unjustified + 2h justified = 6h');
    assert.equal(rec.statistics.unjustifiedHours, 4);
    assert.equal(rec.statistics.lateCount, 1);
    assert.equal(rec.statistics.missedHomeworkCount, 2);
    assert.equal(rec.statistics.behaviorStatus, 'تنبيه');

    // 2. Open modal and verify local plan prioritizes d3 (1.25/5) and d1 (1.5/5)
    const initialPlan = win.openStudentPersonalizedRemediationModal('1BAC-SE-1', 'st_1');
    assert.ok(initialPlan, 'Initial personalized plan must be built');
    assert.ok(initialPlan.priorityDomains[0].domainName.includes('الجبر والتحليل'), 'First priority domain must be Algebra & Analysis (1.25/5)');
    assert.ok(initialPlan.priorityDomains[1].domainName.includes('الحسابيات والأنشطة العددية'), 'Second priority domain must be Arithmetic & Numerical (1.5/5)');
    assert.equal(initialPlan.weeklyActionPlan.length, 3);

    const modalEl = win.document.getElementById('studentPersonalizedRemediationModal');
    assert.ok(modalEl && modalEl.style.display === 'flex', 'Modal must be open and visible');

    // 3. Test saving plan into student pedagogical notes & db.remediationPlans
    const savedNoteOk = win.saveStudentRemediationToNotes();
    assert.equal(savedNoteOk, true);
    assert.equal(win.db.notes['1BAC-SE-1'].length, 1);
    assert.equal(win.db.notes['1BAC-SE-1'][0].studentId, 'st_1');
    assert.ok(win.db.remediationPlans['1BAC-SE-1']['st_1'], 'Full plan must be stored in db.remediationPlans');

    // 4. Test scheduling remediation session in lesson logs (Cahier de Textes)
    const scheduledLog = win.scheduleStudentRemediationInLessonLog();
    assert.ok(scheduledLog && scheduledLog.sessionType === 'soutien');
    assert.equal(win.db.lessonLogs['1BAC-SE-1'].length, 1);
    assert.ok(win.db.lessonLogs['1BAC-SE-1'][0].title.includes('سفيان المنصوري'));

    // 5. Simulate realistic multi-class personalized remediation across all 14 tracks (including __ALL__ selector resolution, r.className + r.duration records, holiday exemption, and track-adapted exercises for TCS, TCL/LSH, and BAC Sci)
    win.isRecordProtectedHolidayOrLeave = (r) => Boolean(r && r.isHoliday);
    win.db.classes['TCS-1'] = [{ id: 'tcs_st1', name: 'آية بنسودة', massar: 'J130088112', orderNum: 1 }];
    win.db.classes['1BAC-LSH-1'] = { students: [{ id: 'lsh_st1', name: 'عمر الفاسي', massar: 'K140077221', orderNum: 1 }] };
    win.db.diagnostic['TCS-1'] = { 'tcs_st1': { d1: 3.5, d2: 3.0, d3: 1.0, d4: 1.5, total: 9.0 } };
    win.db.diagnostic['1BAC-LSH-1'] = { 'lsh_st1': { d1: 1.25, d2: 1.5, d3: 3.0, d4: 2.0, total: 7.75 } };
    win.db.records.push(
        { className: 'TCS-1', studentId: 'tcs_st1', date: '2026-10-14', status: 'غائب', duration: 2 },
        { className: 'TCS-1', studentId: 'tcs_st1', date: '2026-11-06', status: 'غائب', duration: 2, isHoliday: true }
    );

    // 5a. __ALL__ selector resolution must automatically fall back to first valid class in db.classes
    win.document.getElementById('reportClassSelect').innerHTML = '<option value="__ALL__" selected>جميع الأقسام</option>';
    const allFallbackPlan = win.openStudentPersonalizedRemediationModal('__ALL__', '');
    assert.ok(allFallbackPlan, 'Opening personalized remediation modal with __ALL__ must resolve to first valid class');

    // 5b. TCS-1 must count r.className + r.duration (2h) while excluding protected holiday record, and use Tronc Commun curriculum exercises (no f\'(x) derivative)
    const tcsRec = win.buildStudentDiagnosticAndStatisticalRecord('TCS-1', 'tcs_st1');
    assert.equal(tcsRec.statistics.totalAbsentHours, 2, 'TCS-1 must read r.className + r.duration and exclude holiday records');
    const tcsPlan = win.buildLocalPersonalizedRemediationPlan(tcsRec);
    assert.ok(tcsPlan.priorityDomains[0].customExercise.includes('P(x) = x² - 5x + 6'), 'TCS-1 d3 remediation must use Tronc Commun polynomial/domain exercise instead of Bac derivative');

    // 5c. 1BAC-LSH-1 ({ students: [...] }) must use Literary percentage/proportion & coordinate graphing exercises
    const lshRec = win.buildStudentDiagnosticAndStatisticalRecord('1BAC-LSH-1', 'lsh_st1');
    assert.equal(lshRec.examCount, 2, '1BAC-LSH-1 must resolve to 2 exams per semester');
    const lshPlan = win.buildLocalPersonalizedRemediationPlan(lshRec);
    assert.ok(lshPlan.priorityDomains[0].customExercise.includes('250 درهماً') && lshPlan.priorityDomains[0].customExercise.includes('20%'), 'Literary d1 remediation must use percentages and numerical operations');
    assert.ok(lshPlan.priorityDomains[1].domainName.includes('المعلم في المستوى والتمثيل المبياني'), 'Literary d2 remediation must target coordinate plane & graphs instead of vector/trigonometric circle');
});

test('Realistic Report Print & Preview Anti-Clipping Audit: 45-student large class tables, direct print iframe styles, custom preview modal, universal PDF preview & chunked PDF engine never clip tables horizontally or vertically', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const styleSrc = fs.readFileSync(path.join(ROOT, 'public/style.css'), 'utf8');
    const chunkedSrc = fs.readFileSync(path.join(ROOT, 'public/chunked-pdf-engine.js'), 'utf8');
    const examRepSrc = fs.readFileSync(path.join(ROOT, 'public/exam-report.js'), 'utf8');
    const evolSrc = fs.readFileSync(path.join(ROOT, 'public/academic-evolution-card.js'), 'utf8');

    // 1. Verify CSS & Print Styles do not clip .monthly-absence-single-page, .monthly-absence-class-sheet, .chunked-pdf-page-container, or #reportsView .card
    assert.equal(styleSrc.includes('max-height: 297mm !important;\n        page-break-after: always !important;\n        break-after: page !important;\n        page-break-inside: avoid !important;\n        break-inside: avoid !important;\n        box-sizing: border-box !important;\n        overflow: hidden !important;'), false, 'style.css @media print must not lock page containers to max-height: 297mm with overflow: hidden');
    assert.ok(styleSrc.includes('#reportsView .card') && styleSrc.includes('page-break-inside: auto !important;'), '#reportsView .card must allow page-break-inside: auto so multi-page report tables are never clipped');
    assert.equal(appSrc.includes('max-height: 1123px; margin: 0 auto; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;'), false, 'app.js must not hardcode max-height: 1123px; overflow: hidden on report pages');
    assert.equal(appSrc.includes("avoid: ['tr', '.page-break-avoid', '.full-report-a4-sheet']"), false, 'fullReportPrintModal must not put .full-report-a4-sheet in pagebreak.avoid');
    assert.equal(chunkedSrc.includes('max-height: 1123px; margin: 0 auto; padding: ${pagePad}; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;'), false, 'chunked-pdf-engine.js must not clip sheetPage with max-height: 1123px; overflow: hidden');
    assert.ok(evolSrc.includes('min-height: 297mm; height: auto;'), 'academic-evolution-card.js .page-wrap must use min-height: 297mm; height: auto');
    assert.equal(examRepSrc.includes('border: 1.2px solid #cbd5e1; border-radius: 5px; overflow: hidden;'), false, 'exam-report.js dual tables must use overflow: visible');

    // 2. Load full index.html DOM sandbox with modals and test realistic 45-student class across all report preview & print engines
    const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const { win, sandbox } = createDomSandbox(indexHtml);
    const doc = win.document;

    runPublicScript(sandbox, 'public/modals-templates.js');
    win.mountExtractedModals();
    runPublicScript(sandbox, 'public/core/grades-calculator.js');
    runPublicScript(sandbox, 'public/core/absence-manager.js');
    runPublicScript(sandbox, 'public/core/lesson-log-engine.js');
    runPublicScript(sandbox, 'public/secondary-math-curriculum.js');
    runPublicScript(sandbox, 'public/app.js');
    runPublicScript(sandbox, 'public/exam-report.js');
    runPublicScript(sandbox, 'public/pedagogical-council-pv.js');
    runPublicScript(sandbox, 'public/chunked-pdf-engine.js');

    // Populate a large 45-student class (2BAC-PC-1) with grades, absences, behaviors, and lesson logs
    const largeClassStudents = Array.from({ length: 45 }, (_, i) => ({
        id: `pc_std_${i + 1}`,
        orderNum: i + 1,
        name: `التلميذ النموذجي رقم ${i + 1} بن عبد الله المغربي`,
        massar: `R1300${String(10000 + i + 1)}`
    }));
    const gradesMap = {};
    const behaviorsMap = {};
    const diagMap = {};
    const recordsList = [];
    largeClassStudents.forEach((s, idx) => {
        const f1 = +(8 + (idx % 12) + 0.5).toFixed(2);
        const f2 = +(9 + ((idx * 3) % 11)).toFixed(2);
        const f3 = +(10 + ((idx * 7) % 10)).toFixed(2);
        gradesMap[s.id] = { f1, f2, f3, s1: { f1, f2, f3 }, s2: { f1, f2, f3 } };
        behaviorsMap[s.id] = { status: idx % 9 === 0 ? 'تنبيه' : 'منضبط', note: 'مواظب على الحضور' };
        diagMap[s.id] = { d1: 3.5, d2: 4.0, d3: 3.0, d4: 3.5, total: 14.0 };
        if (idx % 3 === 0) {
            recordsList.push({
                studentId: s.id,
                className: '2BAC-PC-1',
                date: `2026-11-${String((idx % 25) + 1).padStart(2, '0')}`,
                timeSlot: '08:00 - 10:00',
                status: idx % 6 === 0 ? 'مبرر' : 'غائب',
                duration: 2,
                homework: idx % 5 === 0 ? 'لم ينجز' : 'منجز',
                notes: 'حصة الرياضيات'
            });
        }
    });

    win.db.teacherProfile = {
        name: 'ذ. محمد أمين',
        school: 'ثانوية الخوارزمي التأهيلية',
        academy: 'الرباط سلا القنيطرة',
        directorate: 'الرباط',
        academicYear: '2026 / 2027'
    };
    win.db.classes = { '2BAC-PC-1': largeClassStudents };
    win.db.grades = { '2BAC-PC-1': gradesMap };
    win.db.behaviors = { '2BAC-PC-1': behaviorsMap };
    win.db.diagnostic = { '2BAC-PC-1': diagMap };
    win.db.records = recordsList;
    win.db.lessonLogs = {
        '2BAC-PC-1': Array.from({ length: 12 }, (_, i) => ({
            id: `log_${i + 1}`,
            sessionNum: i + 1,
            date: `2026-10-${String((i % 25) + 1).padStart(2, '0')}`,
            timeSlot: '08:00 - 10:00',
            duration: '2',
            sessionType: i % 3 === 0 ? 'exercices' : 'cours',
            number: 'الاتصال والاشتقاق ودراسة الدوال',
            axes: [{ title: 'اتصال دالة في نقطة ومبرهنة القيم الوسيطية' }],
            homework: 'تمارين ص 45'
        }))
    };

    // 3. Test Universal PDF Preview Modal across all document types for 45-student class
    win.openUniversalPdfPreviewModal('monthly_absence', '2BAC-PC-1');
    const univSheet = doc.getElementById('universalPdfPrintableSheet');
    assert.ok(univSheet, 'universalPdfPrintableSheet must exist');

    const docTypesToVerify = [
        { type: 'monthly_absence', expectedRows: 45 },
        { type: 'absence', expectedRows: 45 },
        { type: 'grades', expectedRows: 45 },
        { type: 'annual', expectedRows: 45 },
        { type: 'diagnostic', expectedRows: 45 },
        { type: 'notes', expectedRows: 45 },
        { type: 'lessonlog', expectedRows: 12 },
        { type: 'reports', expectedRows: 1 },
        { type: 'heatmap', expectedRows: 6 },
        { type: 'specification', expectedRows: 4 }
    ];

    const docTypeSel = doc.getElementById('universalPdfDocType');
    for (const item of docTypesToVerify) {
        docTypeSel.value = item.type;
        win.onUniversalPdfDocTypeChanged();
        const html = univSheet.innerHTML;
        assert.ok(html.length > 500, `Document type ${item.type} must render rich HTML content`);
        assert.equal(html.includes('max-height: 1123px'), false, `Document type ${item.type} must not have max-height: 1123px clipping`);
        const tbodyRows = univSheet.querySelectorAll('table tbody tr');
        assert.ok(
            tbodyRows.length >= item.expectedRows,
            `Document type ${item.type} must render all ${item.expectedRows} rows without truncation (got ${tbodyRows.length})`
        );
        if (item.expectedRows === 45) {
            assert.ok(html.includes('التلميذ النموذجي رقم 1'), `${item.type} must include first student #1`);
            assert.ok(html.includes('التلميذ النموذجي رقم 45'), `${item.type} must include last student #45 without clipping`);
        }
    }

    // 4. Test Supervised Exam Report (2-page official Note 142-08 report) with 45 students in Custom Print Preview & Direct Print
    const repClsSel = doc.getElementById('reportClassSelect');
    if (repClsSel) {
        repClsSel.innerHTML = '<option value="2BAC-PC-1" selected>2BAC-PC-1</option>';
        repClsSel.value = '2BAC-PC-1';
    }
    win.cleanupExamReportMemory();
    win.printOfficialExamReport(false);
    const customSheet = doc.getElementById('customReportPrintableSheet');
    assert.ok(customSheet, 'customReportPrintableSheet must be mounted by printOfficialExamReport(false)');
    const examReportHtml = customSheet.innerHTML;
    assert.ok(examReportHtml.includes('التلميذ النموذجي رقم 1') && examReportHtml.includes('التلميذ النموذجي رقم 45'), 'Exam report must render all 45 students in both roster and merit tables');
    assert.ok(examReportHtml.includes('@media print'), 'openCustomPrintPreviewModal must preserve @media print rules for clean pagination');
    assert.equal(customSheet.querySelectorAll('.print-table tbody tr').length, 90, 'Exam report preview must contain 45 roster rows + 45 merit rows = 90 rows');

    // Test printDocumentDirectly (via btnDirectPrintCustomPreview) preserves @media print and anti-clipping table CSS
    doc.getElementById('btnDirectPrintCustomPreview').click();
    const directIframe = doc.getElementById('globalAppPrintIframe');
    assert.ok(directIframe, 'globalAppPrintIframe must be created');
    const iframeHtml = directIframe.contentWindow.document.documentElement.innerHTML;
    assert.ok(iframeHtml.includes('@media print'), 'printDocumentDirectly must preserve @media print rules');
    assert.ok(iframeHtml.includes('page-break-inside: auto !important;'), 'printDocumentDirectly must enforce page-break-inside: auto on tables');
    assert.ok(iframeHtml.includes('التلميذ النموذجي رقم 45'), 'printDocumentDirectly must contain all 45 students');

    // 5. Test printUniversalDoc iframe generation
    docTypeSel.value = 'monthly_absence';
    win.onUniversalPdfDocTypeChanged();
    win.printUniversalDoc();
    const univIframe = doc.getElementById('universalDocPrintIframe');
    assert.ok(univIframe, 'universalDocPrintIframe must be created');
    const univIframeHtml = univIframe.contentWindow.document.documentElement.innerHTML;
    assert.ok(univIframeHtml.includes('height: auto !important;'), 'printUniversalDoc must use height: auto !important on page containers');
    assert.ok(univIframeHtml.includes('overflow: visible !important;'), 'printUniversalDoc must use overflow: visible !important so tables are never clipped');
    assert.ok(univIframeHtml.includes('التلميذ النموذجي رقم 45'), 'printUniversalDoc must contain all 45 students');

    // 6. Test Pedagogical Council PV report with 45 students
    const pvHtml = win.buildPedagogicalCouncilPvHTML('2BAC-PC-1', 's1');
    assert.ok(pvHtml.includes('التلميذ النموذجي رقم 1') && pvHtml.includes('التلميذ النموذجي رقم 45'), 'Pedagogical Council PV must include all 45 students without truncation');
});





