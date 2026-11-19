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
    assert.equal(G.getStreamOfficialConfig('1BAC آداب وعلوم إنسانية').coefficient, 2);

    const semAvg = G.calculateStudentSemesterAverage({ f1: 14, f2: 16, f3: 15, act: 18 }, { includeActivity: true, activityWeight: 0.25 });
    assert.equal(semAvg, 15.75);

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
        { code: '2BAC-LSH-1', coef: 2, exams: 2 }
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

