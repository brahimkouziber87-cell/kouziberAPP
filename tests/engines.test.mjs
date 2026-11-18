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

test('End-to-End Companion Document Bridge UI & Moroccan Qualifying Secondary Stream Matrix', () => {
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




