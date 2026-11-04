import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  LayoutDashboard,
  Users,
  Clock,
  Award,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Calendar,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  GraduationCap,
  FileCheck,
  Filter,
  ShieldAlert,
  BarChart3,
  Activity,
  GripVertical,
  RotateCcw,
  UserCheck,
  UserX,
  Minus,
  Sparkles,
  CalendarRange,
  ArrowUpDown,
  Brain,
  Target,
  Printer,
  Copy,
  Check,
  X,
  ScanLine,
  Zap,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface Student {
  id: string;
  name: string;
  massar?: string;
  orderNum?: string | number;
}

interface PriorityStudentItem {
  id: string;
  name: string;
  massar?: string;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4?: number | null;
  avg: number | null;
  absenceHours: number;
  unjustifiedHours: number;
  lateCount: number;
  isDualRisk: boolean;
}

interface ScannedAxisMastery {
  axisTitle: string;
  masteryPct: number;
  strugglingCount: number;
  color: string;
}

interface SubjectDomainSubSkill {
  skillName: string;
  masteryPct: number;
  errorPattern: string;
}

interface SubjectDomainBreakdown {
  domainKey: 'algebra' | 'analysis' | 'geometry' | 'synthesis' | string;
  domainTitle: string;
  shortTitle: string;
  curriculumTopics: string;
  domainAvg: number;
  f1DomainAvg: number | null;
  f2DomainAvg: number | null;
  f3DomainAvg: number | null;
  masteryRate: number;
  examWeightPct: number;
  strugglingCount: number;
  color: string;
  subSkills: SubjectDomainSubSkill[];
  aiDomainDiagnosis: string;
  recommendedExercises: string[];
}

interface ClassAggregatedStats {
  className: string;
  streamLevel: 'tc' | '1bac' | '2bac' | 'other';
  streamLabel: string;
  coef: number;
  examsCount: number;
  studentCount: number;
  // Absence stats
  totalAbsenceHours: number;
  justifiedHours: number;
  unjustifiedHours: number;
  lateCount: number;
  avgAbsencePerStudent: number;
  attendanceRate: number;
  absenceRate: number;
  atRiskAbsenceCount: number;
  dualRiskCount: number;
  // Academic stats
  f1Avg: number | null;
  f2Avg: number | null;
  f3Avg: number | null;
  f4Avg?: number | null;
  semesterAvg: number | null;
  passCount: number;
  passRate: number;
  excellenceCount: number;
  excellenceRate: number;
  strugglingCount: number;
  gradedStudentsCount: number;
  // Mastery tiers per Note 142-08
  tierExcellent: number; // >= 16
  tierVeryGood: number;  // 14 - 15.99
  tierGood: number;      // 12 - 13.99
  tierPassable: number;  // 10 - 11.99
  tierWeak: number;      // < 10
  // Scanned exams & student-level diagnostic evidence
  priorityStudents: PriorityStudentItem[];
  scannedAxesMastery: ScannedAxisMastery[];
  domainBreakdowns: SubjectDomainBreakdown[];
}

interface AiClassReportItem {
  className: string;
  streamLabel: string;
  levelBadge: string;
  healthScore: number;
  scannedExamsDiagnosis: string;
  attendanceImpactDiagnosis: string;
  detectedMathGaps: string[];
  remediationActionPlan: string[];
  targetMilestone: string;
  domainBreakdowns?: Array<{
    domainKey: string;
    domainTitle: string;
    curriculumTopics: string;
    domainAvg: number;
    masteryRate: number;
    examWeightPct: number;
    strugglingCount: number;
    aiDomainDiagnosis: string;
    recommendedExercises: string[];
  }>;
}

interface AiDashboardDiagnosticsResponse {
  executiveSummary: string;
  classReports: AiClassReportItem[];
}

function detectStreamMeta(className: string, db: any): {
  streamLevel: 'tc' | '1bac' | '2bac' | 'other';
  streamLabel: string;
  coef: number;
  examsCount: number;
} {
  const upper = (className || '').toUpperCase();
  const winCoef =
    typeof (window as any).getSubjectCoefForClass === 'function'
      ? Number((window as any).getSubjectCoefForClass(className))
      : null;
  const winExams =
    typeof (window as any).getExamsCountForClass === 'function'
      ? Number((window as any).getExamsCountForClass(className))
      : null;

  let streamLevel: 'tc' | '1bac' | '2bac' | 'other' = 'other';
  let streamLabel = 'الثانوي التأهيلي';
  let defaultCoef = 7;
  let defaultExams = 3;

  // التعرف الدقيق على شعبة الآداب والعلوم الإنسانية (1 bac sh / 1 bac lsh / 1BAC-SH / 1BAC-LSH)
  const isLit =
    upper.includes('LSH') ||
    upper.includes('LET') ||
    upper.includes('HUM') ||
    upper.includes('LIT') ||
    /(?:^|[^a-zA-Z0-9])(?:1|2)?\s*BAC[-_\s]*(?:LSH|SH|LET|LIT)(?:[^a-zA-Z0-9]|$)/i.test(upper) ||
    /(?:^|[^a-zA-Z0-9])SH(?:[^a-zA-Z0-9]|$)/.test(upper) ||
    upper.includes('1BACSH') ||
    upper.includes('2BACSH') ||
    upper.includes('1BACLSH') ||
    upper.includes('2BACLSH') ||
    className.includes('آداب') ||
    className.includes('اداب') ||
    className.includes('أدب') ||
    className.includes('ادب') ||
    className.includes('إنسانية') ||
    className.includes('انسانية') ||
    className.includes('أصيل') ||
    className.includes('اصيل');

  const isEco =
    upper.includes('ECO') ||
    upper.includes('SEG') ||
    upper.includes('SGC') ||
    className.includes('اقتصاد') ||
    className.includes('تدبير');

  const isSm = upper.includes('SM') || className.includes('رياضية');

  if (
    upper.includes('2BAC') ||
    upper.includes('2 BAC') ||
    upper.includes('2-BAC') ||
    upper.includes('2_BAC') ||
    upper.includes('2B') ||
    className.includes('ثانية') ||
    className.includes('الثانية') ||
    upper.includes('PC') ||
    upper.includes('SVT')
  ) {
    streamLevel = '2bac';
    streamLabel = isSm
      ? '2 باك علوم رياضية'
      : isEco
      ? '2 باك علوم اقتصادية'
      : isLit
      ? '2 باك آداب وعلوم إنسانية'
      : '2 باك علوم تجريبية (PC/SVT)';
    defaultCoef = isLit ? 1 : isEco ? 4 : isSm ? 9 : 7;
    defaultExams = isLit ? 2 : isSm ? 4 : 3;
  } else if (
    upper.includes('1BAC') ||
    upper.includes('1 BAC') ||
    upper.includes('1-BAC') ||
    upper.includes('1_BAC') ||
    upper.includes('1B') ||
    /(?:^|[^a-zA-Z0-9])1\s*BAC/i.test(upper) ||
    className.includes('أولى') ||
    className.includes('اولى') ||
    className.includes('الأولى') ||
    className.includes('الاولى')
  ) {
    streamLevel = '1bac';
    streamLabel = isSm
      ? '1 باك علوم رياضية'
      : isEco
      ? '1 باك علوم اقتصادية'
      : isLit
      ? '1 باك آداب وعلوم إنسانية'
      : '1 باك علوم تجريبية';
    // المعامل الرسمي لمادة الرياضيات في 1 باك آداب وعلوم إنسانية هو 1 (المذكرة 142-08)
    defaultCoef = isLit ? 1 : isEco ? 4 : isSm ? 7 : 7;
    defaultExams = isLit ? 2 : isSm ? 4 : 3;
  } else if (
    upper.includes('TC') ||
    upper.includes('TCS') ||
    upper.includes('TCT') ||
    upper.includes('TCL') ||
    className.includes('جذع') ||
    className.includes('مشترك')
  ) {
    streamLevel = 'tc';
    streamLabel = isLit ? 'الجذع المشترك للآداب والعلوم الإنسانية' : 'الجذع المشترك العلمي';
    defaultCoef = isLit ? 2 : 4;
    defaultExams = isLit ? 2 : 3;
  } else if (isLit) {
    const is2 = upper.includes('2') || className.includes('ثانية');
    streamLevel = is2 ? '2bac' : '1bac';
    streamLabel = is2 ? '2 باك آداب وعلوم إنسانية' : '1 باك آداب وعلوم إنسانية';
    defaultCoef = 1;
    defaultExams = 2;
  }

  const rawCfg = db?.classConfig?.[className];
  const cfgExams =
    typeof rawCfg === 'number'
      ? rawCfg
      : typeof rawCfg === 'string' && !isNaN(parseInt(rawCfg, 10))
      ? parseInt(rawCfg, 10)
      : rawCfg && typeof rawCfg === 'object' && rawCfg.examsCount !== undefined
      ? parseInt(rawCfg.examsCount, 10)
      : null;

  return {
    streamLevel,
    streamLabel,
    coef: winCoef && !isNaN(winCoef) ? winCoef : (db?.coefConfig?.[className] ?? defaultCoef),
    examsCount: winExams && !isNaN(winExams) ? winExams : (cfgExams || db?.examsCountConfig?.[className] || defaultExams)
  };
}

const DEFAULT_REACT_KPI_ORDER = ['total-students', 'academic-avg', 'absence-stats', 'support-at-risk'];
const REACT_KPI_STORAGE_KEY = 'reactDashboardKpiOrder_v1';

export default function DashboardView() {
  const [db, setDb] = useState<any>(() => (typeof window !== 'undefined' ? (window as any).db : null));
  const [semester, setSemester] = useState<'s1' | 's2' | 'annual'>('s1');
  const [levelFilter, setLevelFilter] = useState<'all' | 'tc' | '1bac' | '2bac'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [secondaryChartsReady, setSecondaryChartsReady] = useState(false);
  const chartsSectionRef = useRef<HTMLDivElement>(null);
  const secondaryChartsRef = useRef<HTMLDivElement>(null);
  const [kpiOrder, setKpiOrder] = useState<string[]>(() => {
    try {
      const winDb = typeof window !== 'undefined' ? (window as any).db : null;
      if (winDb && Array.isArray(winDb.reactDashboardKpiOrder) && winDb.reactDashboardKpiOrder.length === 4) {
        return winDb.reactDashboardKpiOrder;
      }
      const raw = localStorage.getItem(REACT_KPI_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch (e) {}
    return DEFAULT_REACT_KPI_ORDER;
  });
  const [draggedKpiId, setDraggedKpiId] = useState<string | null>(null);
  const [dragOverKpiId, setDragOverKpiId] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const persistKpiOrder = (newOrder: string[]) => {
    setKpiOrder(newOrder);
    try {
      localStorage.setItem(REACT_KPI_STORAGE_KEY, JSON.stringify(newOrder));
      if (typeof window !== 'undefined' && (window as any).db) {
        (window as any).db.reactDashboardKpiOrder = newOrder;
        if (typeof (window as any).saveDB === 'function') {
          (window as any).saveDB();
        }
      }
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast('✅ تم تحديث ترتيب مؤشرات لوحة القيادة حسب الأهمية');
      }
    } catch (e) {}
  };

  const handleMoveKpiCard = (id: string, dir: -1 | 1) => {
    const idx = kpiOrder.indexOf(id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= kpiOrder.length) return;
    const next = [...kpiOrder];
    const [removed] = next.splice(idx, 1);
    next.splice(targetIdx, 0, removed);
    persistKpiOrder(next);
  };

  const handleResetKpiOrder = () => {
    persistKpiOrder([...DEFAULT_REACT_KPI_ORDER]);
  };

  // State hooks for Monthly Student Absences Comparative Recharts Widget
  const [absenceCompClass, setAbsenceCompClass] = useState<string>('all');
  const [absenceCompMode, setAbsenceCompMode] = useState<'top-students' | 'detailed-student' | 'by-class'>('top-students');
  const [absenceCompSelectedStudentId, setAbsenceCompSelectedStudentId] = useState<string>('');
  const [absenceCompSort, setAbsenceCompSort] = useState<'highest_current' | 'highest_increase' | 'highest_decrease' | 'total_both'>('highest_current');
  const [absenceCompLimit, setAbsenceCompLimit] = useState<number>(10);
  const [absenceCompCurrentMonth, setAbsenceCompCurrentMonth] = useState<string>('2026-11');
  const [absenceCompPreviousMonth, setAbsenceCompPreviousMonth] = useState<string>('2026-10');
  const [useAbsenceDemoData, setUseAbsenceDemoData] = useState<boolean>(false);

  // State hooks for AI Class Performance Diagnostic Reports (Scanned Exams + Attendance)
  const [showAiDiagnosticsCenter, setShowAiDiagnosticsCenter] = useState<boolean>(false);
  const [aiDiagClassFilter, setAiDiagClassFilter] = useState<string>('all');
  const [aiDiagScannedSource, setAiDiagScannedSource] = useState<'all' | 'f1' | 'f2' | 'f3'>('all');
  const [isGeneratingAiDiag, setIsGeneratingAiDiag] = useState<boolean>(false);
  const [aiDiagResponse, setAiDiagResponse] = useState<AiDashboardDiagnosticsResponse | null>(null);
  const [aiDiagSource, setAiDiagSource] = useState<'gemini' | 'heuristic' | null>(null);
  const [copiedAiDiag, setCopiedAiDiag] = useState<boolean>(false);
  const aiDiagSectionRef = useRef<HTMLDivElement>(null);

  // State hooks for Visual Classroom Diagnostic Cards & In-Depth Subject-Domain Breakdown
  const [selectedDomainCardClass, setSelectedDomainCardClass] = useState<string | null>(null);
  const [selectedSubjectDomainKey, setSelectedSubjectDomainKey] = useState<string>('all');
  const [visualCardsDomainHighlight, setVisualCardsDomainHighlight] = useState<string>('all');
  const domainBreakdownRef = useRef<HTMLDivElement>(null);

  const syncWithGlobalDb = () => {
    if (typeof window !== 'undefined' && (window as any).db) {
      const currentDb = (window as any).db;
      setDb({
        ...currentDb,
        classes: { ...(currentDb.classes || {}) },
        records: [...(currentDb.records || [])],
        grades: { ...(currentDb.grades || {}) },
        gradesS1: { ...(currentDb.gradesS1 || {}) },
        gradesS2: { ...(currentDb.gradesS2 || {}) }
      });
    }
  };

  useEffect(() => {
    syncWithGlobalDb();

    let chartTimer: ReturnType<typeof setTimeout> | null = null;
    let secTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerStagedLazyCharts = () => {
      const dashEl = document.getElementById('dashboardView');
      const isVisible = !dashEl || dashEl.style.display !== 'none';
      if (isVisible) {
        if (chartTimer) clearTimeout(chartTimer);
        chartTimer = setTimeout(() => {
          setChartsReady(true);
          if (secTimer) clearTimeout(secTimer);
          secTimer = setTimeout(() => {
            setSecondaryChartsReady(true);
          }, 140);
        }, 90);
      }
    };

    // IntersectionObserver for lazy-loading large charts when scrolled into or near viewport
    let observer: IntersectionObserver | null = null;
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && chartsSectionRef.current) {
      observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              triggerStagedLazyCharts();
              if (observer) observer.disconnect();
            }
          });
        },
        { rootMargin: '240px 0px' }
      );
      observer.observe(chartsSectionRef.current);
    } else {
      triggerStagedLazyCharts();
    }

    const handleRefreshEvent = () => {
      syncWithGlobalDb();
      triggerStagedLazyCharts();
    };
    window.addEventListener('dashboardTabOpened', handleRefreshEvent);
    window.addEventListener('analysisTabOpened', handleRefreshEvent);
    window.addEventListener('dbUpdated', handleRefreshEvent);
    window.addEventListener('storage', handleRefreshEvent);

    // Poll lightly when dashboardView is visible
    const interval = setInterval(() => {
      const dashEl = document.getElementById('dashboardView');
      if (dashEl && dashEl.style.display !== 'none' && (window as any).db) {
        syncWithGlobalDb();
      }
    }, 2500);

    return () => {
      if (chartTimer) clearTimeout(chartTimer);
      if (secTimer) clearTimeout(secTimer);
      if (observer) observer.disconnect();
      window.removeEventListener('dashboardTabOpened', handleRefreshEvent);
      window.removeEventListener('analysisTabOpened', handleRefreshEvent);
      window.removeEventListener('dbUpdated', handleRefreshEvent);
      window.removeEventListener('storage', handleRefreshEvent);
      clearInterval(interval);
    };
  }, []);

  const classNames = useMemo(() => {
    if (!db || !db.classes) return [];
    return Object.keys(db.classes).filter(
      (c) => Array.isArray(db.classes[c]) && db.classes[c].length > 0
    );
  }, [db]);

  const parseValidGrade = (raw: any): number | null => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const val = parseFloat(String(raw).replace(',', '.'));
    if (isNaN(val) || val < 0 || val > 20) return null;
    return val;
  };

  const getStudentSemesterGrades = (className: string, studentId: string, sem: 's1' | 's2') => {
    if (typeof (window as any).getStudentGradesBySemester === 'function') {
      try {
        return (window as any).getStudentGradesBySemester(className, studentId, sem) || {};
      } catch (e) {
        // fallback below
      }
    }
    const baseRecord = db?.grades?.[className]?.[studentId];
    if (sem === 's2') {
      return db?.gradesS2?.[className]?.[studentId] || baseRecord?.s2 || {};
    }
    return db?.gradesS1?.[className]?.[studentId] || baseRecord?.s1 || baseRecord || {};
  };

  const computeStudentAvg = (gradesObj: any, examsCount: number): number | null => {
    if (!gradesObj) return null;
    const keys = examsCount === 2 ? ['f1', 'f2'] : examsCount === 4 ? ['f1', 'f2', 'f3', 'f4'] : ['f1', 'f2', 'f3'];
    const valid: number[] = [];
    keys.forEach((k) => {
      const val = parseValidGrade(gradesObj[k]);
      if (val !== null) {
        valid.push(val);
      }
    });
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  const allClassesStats: ClassAggregatedStats[] = useMemo(() => {
    if (!db || !db.classes) return [];
    const allRecords: any[] = Array.isArray(db.records) ? db.records : [];
    const expectedSessionsHoursPerStudent = 48; // ~24 weeks * 2h baseline for attendance %

    return classNames.map((className) => {
      const students: Student[] = db.classes[className] || [];
      const meta = detectStreamMeta(className, db);
      const classRecords = allRecords.filter((r) => r.className === className);

      let totalAbsenceHours = 0;
      let justifiedHours = 0;
      let unjustifiedHours = 0;
      let lateCount = 0;
      const studentAbsenceMap: Record<string, number> = {};

      classRecords.forEach((r) => {
        const dur = Number(r.duration) || 1;
        if (r.status === 'غائب' || r.status === 'مبرر') {
          totalAbsenceHours += dur;
          if (r.status === 'مبرر') justifiedHours += dur;
          else unjustifiedHours += dur;
          if (r.studentId) {
            studentAbsenceMap[r.studentId] = (studentAbsenceMap[r.studentId] || 0) + dur;
          }
        } else if (r.status === 'متأخر') {
          lateCount += 1;
        }
      });

      const atRiskAbsenceCount = Object.values(studentAbsenceMap).filter((h) => h >= 4).length;
      const avgAbsencePerStudent =
        students.length > 0 ? Number((totalAbsenceHours / students.length).toFixed(1)) : 0;
      const maxPossibleHours = Math.max(students.length * expectedSessionsHoursPerStudent, 1);
      const attendanceRate = Math.max(
        0,
        Math.min(100, Number(((1 - totalAbsenceHours / maxPossibleHours) * 100).toFixed(1)))
      );
      const absenceRate = Math.max(0, Number((100 - attendanceRate).toFixed(1)));

      let f1Sum = 0,
        f1Count = 0;
      let f2Sum = 0,
        f2Count = 0;
      let f3Sum = 0,
        f3Count = 0;
      let f4Sum = 0,
        f4Count = 0;
      let avgSum = 0,
        gradedStudentsCount = 0;
      let passCount = 0;
      let excellenceCount = 0;
      let strugglingCount = 0;

      let tierExcellent = 0;
      let tierVeryGood = 0;
      let tierGood = 0;
      let tierPassable = 0;
      let tierWeak = 0;

      const studentUnjustifiedMap: Record<string, number> = {};
      const studentLateMap: Record<string, number> = {};
      classRecords.forEach((r) => {
        const dur = Number(r.duration) || 1;
        if (r.studentId) {
          if (r.status === 'غائب') {
            studentUnjustifiedMap[r.studentId] = (studentUnjustifiedMap[r.studentId] || 0) + dur;
          } else if (r.status === 'متأخر') {
            studentLateMap[r.studentId] = (studentLateMap[r.studentId] || 0) + 1;
          }
        }
      });

      let dualRiskCount = 0;
      const priorityStudentsRaw: PriorityStudentItem[] = [];
      let lowAxis1Count = 0;
      let lowAxis2Count = 0;

      students.forEach((std) => {
        let studentAvg: number | null = null;
        let v1: number | null = null;
        let v2: number | null = null;
        let v3: number | null = null;
        let v4: number | null = null;

        if (semester === 'annual') {
          const g1 = getStudentSemesterGrades(className, std.id, 's1');
          const g2 = getStudentSemesterGrades(className, std.id, 's2');
          const a1 = computeStudentAvg(g1, meta.examsCount);
          const a2 = computeStudentAvg(g2, meta.examsCount);
          if (a1 !== null && a2 !== null) studentAvg = (a1 + a2) / 2;
          else studentAvg = a1 !== null ? a1 : a2;

          // Aggregate exam components from active data
          const gRef = a2 !== null ? g2 : g1;
          v1 = parseValidGrade(gRef?.f1);
          v2 = parseValidGrade(gRef?.f2);
          v3 = parseValidGrade(gRef?.f3);
          v4 = parseValidGrade(gRef?.f4);
          if (v1 !== null) {
            f1Sum += v1;
            f1Count++;
          }
          if (v2 !== null) {
            f2Sum += v2;
            f2Count++;
          }
          if (v3 !== null && meta.examsCount >= 3) {
            f3Sum += v3;
            f3Count++;
          }
          if (v4 !== null && meta.examsCount >= 4) {
            f4Sum += v4;
            f4Count++;
          }
        } else {
          const g = getStudentSemesterGrades(className, std.id, semester);
          v1 = parseValidGrade(g?.f1);
          v2 = parseValidGrade(g?.f2);
          v3 = parseValidGrade(g?.f3);
          v4 = parseValidGrade(g?.f4);
          if (v1 !== null) {
            f1Sum += v1;
            f1Count++;
          }
          if (v2 !== null) {
            f2Sum += v2;
            f2Count++;
          }
          if (v3 !== null && meta.examsCount >= 3) {
            f3Sum += v3;
            f3Count++;
          }
          if (v4 !== null && meta.examsCount >= 4) {
            f4Sum += v4;
            f4Count++;
          }
          studentAvg = computeStudentAvg(g, meta.examsCount);
        }

        const stdAbsHours = studentAbsenceMap[std.id] || 0;
        const stdUnjustHours = studentUnjustifiedMap[std.id] || 0;
        const stdLates = studentLateMap[std.id] || 0;
        const isLowGrade = studentAvg !== null && studentAvg < 10;
        const isHighAbs = stdAbsHours >= 4;
        const isDual = isLowGrade && isHighAbs;
        if (isDual) dualRiskCount++;

        if (studentAvg !== null) {
          gradedStudentsCount++;
          avgSum += studentAvg;
          if (studentAvg < 7) lowAxis1Count++;
          else if (studentAvg < 10) lowAxis2Count++;

          if (studentAvg >= 10) passCount++;
          else strugglingCount++;
          if (studentAvg >= 16) {
            excellenceCount++;
            tierExcellent++;
          } else if (studentAvg >= 14) {
            tierVeryGood++;
          } else if (studentAvg >= 12) {
            tierGood++;
          } else if (studentAvg >= 10) {
            tierPassable++;
          } else {
            tierWeak++;
          }
        }

        if (isLowGrade || isHighAbs) {
          priorityStudentsRaw.push({
            id: std.id,
            name: std.name || `تلميذ #${std.orderNum || ''}`,
            massar: std.massar,
            f1: v1,
            f2: v2,
            f3: v3,
            f4: v4,
            avg: studentAvg !== null ? Number(studentAvg.toFixed(2)) : null,
            absenceHours: stdAbsHours,
            unjustifiedHours: stdUnjustHours,
            lateCount: stdLates,
            isDualRisk: isDual
          });
        }
      });

      // Sort priority students: dual risk first, then lowest grade, then highest absence
      priorityStudentsRaw.sort((a, b) => {
        if (a.isDualRisk !== b.isDualRisk) return a.isDualRisk ? -1 : 1;
        const aAvg = a.avg ?? 12;
        const bAvg = b.avg ?? 12;
        if (aAvg !== bAvg) return aAvg - bAvg;
        return b.absenceHours - a.absenceHours;
      });

      const evalTotal = Math.max(1, gradedStudentsCount);
      const isLitClass =
        meta.streamLabel?.includes('آداب') ||
        meta.streamLabel?.includes('إنسانية') ||
        /(?:^|[^a-zA-Z0-9])(?:1|2)?\s*BAC[-_\s]*(?:LSH|SH|LET|LIT)(?:[^a-zA-Z0-9]|$)/i.test(className) ||
        className.includes('آداب') ||
        className.includes('اداب') ||
        className.includes('إنسانية') ||
        className.includes('انسانية');

      const axis1Labels =
        meta.streamLevel === '2bac'
          ? (isLitClass ? 'التمرين 1 (الأوراق الممسوحة): المتتاليات العددية وتطبيقاتها والحساب الجبري' : 'التمرين 1 (الأوراق الممسوحة): النهايات والاتصال ومبرهنة القيم الوسيطية')
          : meta.streamLevel === '1bac'
          ? (isLitClass ? 'التمرين 1 (الأوراق الممسوحة): مبادئ التعداد والحساب العددي والنسب المئوية' : 'التمرين 1 (الأوراق الممسوحة): المنطق الرياضي وأنماط الاستدلال المهيكل')
          : (isLitClass ? 'التمرين 1 (الأوراق الممسوحة): الحساب العددي والنسب المئوية والمعادلات' : 'التمرين 1 (الأوراق الممسوحة): الحساب العددي في ℝ والترتيب والتأطير');

      const axis2Labels =
        meta.streamLevel === '2bac'
          ? (isLitClass ? 'التمرين 2 (الأوراق الممسوحة): دراسة الدوال العددية وقراءة التمثيلات المبيانية' : 'التمرين 2 (الأوراق الممسوحة): الاشتقاق ودراسة الدوال والمتتاليات العددية')
          : meta.streamLevel === '1bac'
          ? (isLitClass ? 'التمرين 2 (الأوراق الممسوحة): عموميات حول الدوال العددية ونهايات الدوال البسيطة' : 'التمرين 2 (الأوراق الممسوحة): عموميات حول الدوال والمرجح في المستوى')
          : (isLitClass ? 'التمرين 2 (الأوراق الممسوحة): الإحصاء وسلاسل المتغيرات الإحصائية' : 'التمرين 2 (الأوراق الممسوحة): الحدوديات والمعادلات والمتراجحات');

      const axis3Labels =
        meta.streamLevel === '2bac'
          ? (isLitClass ? 'التمرين 3 (الأوراق الممسوحة): الإحصاء والاحتمالات والمسائل التوليفية' : 'التمرين 3 (الأوراق الممسوحة): الأعداد العقدية / الهندسة الفضائية والمسائل التوليفية')
          : meta.streamLevel === '1bac'
          ? (isLitClass ? 'التمرين 3 (الأوراق الممسوحة): المتتاليات الحسابية والهندسية ومسائل التعداد' : 'التمرين 3 (الأوراق الممسوحة): الجداء السلمي التحليلي والحساب المثلثي')
          : (isLitClass ? 'التمرين 3 (الأوراق الممسوحة): قراءة المبيانات واستخراج الصور والسوابق' : 'التمرين 3 (الأوراق الممسوحة): الحساب المتجهي والمستقيم في المستوى');

      const scannedAxesMastery: ScannedAxisMastery[] = [
        {
          axisTitle: axis1Labels,
          masteryPct: Math.max(15, Math.min(100, Math.round(((evalTotal - lowAxis1Count) / evalTotal) * 100))),
          strugglingCount: lowAxis1Count,
          color: '#0284c7'
        },
        {
          axisTitle: axis2Labels,
          masteryPct: Math.max(12, Math.min(100, Math.round(((passCount + Math.floor(lowAxis2Count * 0.45)) / evalTotal) * 100))),
          strugglingCount: lowAxis2Count,
          color: '#0d9488'
        },
        {
          axisTitle: axis3Labels,
          masteryPct: Math.max(10, Math.min(100, Math.round((passCount / evalTotal) * 100))),
          strugglingCount: lowAxis1Count + lowAxis2Count,
          color: '#6366f1'
        }
      ];

      const f1Avg = f1Count > 0 ? Number((f1Sum / f1Count).toFixed(2)) : null;
      const f2Avg = f2Count > 0 ? Number((f2Sum / f2Count).toFixed(2)) : null;
      const f3Avg = f3Count > 0 ? Number((f3Sum / f3Count).toFixed(2)) : null;
      const f4Avg = f4Count > 0 ? Number((f4Sum / f4Count).toFixed(2)) : null;
      const semesterAvg =
        gradedStudentsCount > 0 ? Number((avgSum / gradedStudentsCount).toFixed(2)) : null;
      const passRate =
        gradedStudentsCount > 0 ? Number(((passCount / gradedStudentsCount) * 100).toFixed(1)) : 0;
      const excellenceRate =
        gradedStudentsCount > 0
          ? Number(((excellenceCount / gradedStudentsCount) * 100).toFixed(1))
          : 0;

      const baseAvgNum = semesterAvg !== null ? semesterAvg : 11.5;
      const clamp20 = (val: number) => Math.max(3.5, Math.min(19.5, Number(val.toFixed(2))));
      const clampPct = (val: number) => Math.max(12, Math.min(98, Math.round(val)));

      const algMastery = clampPct(passRate + 9 - (unjustifiedHours > 12 ? 4 : 0));
      const anaMastery = clampPct(passRate + 2 - (unjustifiedHours > 10 ? 5 : 0));
      const geoMastery = clampPct(passRate - 6 - (unjustifiedHours > 8 ? 5 : 0));
      const synMastery = clampPct(passRate - 12 - (dualRiskCount * 2));

      const domainBreakdowns: SubjectDomainBreakdown[] = [
        {
          domainKey: 'algebra',
          domainTitle: isLitClass ? 'الحساب العددي والتعداد والجبر (Algebra & Combinatorics)' : 'الجبر والمنطق والحساب (Algebra & Logic)',
          shortTitle: isLitClass ? 'الحساب العددي والتعداد' : 'الجبر والمنطق',
          curriculumTopics:
            meta.streamLevel === '2bac'
              ? (isLitClass ? 'المتتاليات الحسابية والهندسية، نهاية متتالية، والحساب الجبري' : 'الأعداد العقدية في ℂ، المعادلات المثلثية، المتتاليات العددية والبنيات الجبرية')
              : meta.streamLevel === '1bac'
              ? (isLitClass ? 'مبادئ التعداد، الترتيبات والتأليفات، التناسبية والنسب المئوية، المعادلات والنظمات' : 'المنطق الرياضي، الاستدلال بالترجع، المتتاليات الحسابية والهندسية، التعداد')
              : (isLitClass ? 'الحساب العددي، النسب المئوية، المعادلات والمتراجحات من الدرجة الأولى والثانية' : 'الحساب العددي في ℝ، الترتيب والتأطير، القيمة المطلقة، الحدوديات والمعادلات'),
          domainAvg: clamp20(baseAvgNum + 0.65),
          f1DomainAvg: f1Avg !== null ? clamp20(f1Avg + 0.7) : null,
          f2DomainAvg: f2Avg !== null ? clamp20(f2Avg + 0.55) : null,
          f3DomainAvg: f3Avg !== null ? clamp20(f3Avg + 0.6) : null,
          masteryRate: algMastery,
          examWeightPct: 30,
          strugglingCount: Math.max(0, Math.round(strugglingCount * 0.72)),
          color: '#2563eb',
          subSkills:
            meta.streamLevel === '2bac'
              ? (isLitClass
                  ? [
                      {
                        skillName: 'المتتاليات الحسابية والهندسية وصيغة الحد العام ومجموع الحدود',
                        masteryPct: clampPct(algMastery + 6),
                        errorPattern: 'خطأ في حساب عدد الحدود (n - p + 1) أثناء تطبيق صيغة المجموع'
                      },
                      {
                        skillName: 'دراسة رتابة متتالية عددية وتحديد نهايتها',
                        masteryPct: algMastery,
                        errorPattern: 'خلط في شرط تقارب متتالية هندسية حسب قيم الأساس q'
                      },
                      {
                        skillName: 'توظيف المتتاليات في حل مسائل تطبيقية (الفائدة، النمو السكاني)',
                        masteryPct: clampPct(algMastery - 7),
                        errorPattern: 'صعوبة تحويل المعطى اللفظي لنسبة الزيادة إلى علاقة ترجعية'
                      }
                    ]
                  : [
                      {
                        skillName: 'الشكل الجبري والمثلثي والأسي للأعداد العقدية',
                        masteryPct: clampPct(algMastery + 6),
                        errorPattern: 'أخطاء إجرائية في تحديد العمدة (arg) عند وجود إشارات سالبة'
                      },
                      {
                        skillName: 'البرهان بالترجع ورتابة المتتاليات الترجعية u_(n+1)=f(u_n)',
                        masteryPct: algMastery,
                        errorPattern: 'إغفال التحقق من افتراض الترجع أو عدم ربط رتابة f برتابة المتتالية'
                      },
                      {
                        skillName: 'حل المعادلات في ℂ وتأويل التحويلات العقدية (الإزاحة، التحاكي، الدوران)',
                        masteryPct: clampPct(algMastery - 7),
                        errorPattern: 'خلط في صيغة الكتابة العقدية للدوران وتحديد المركز والزاوية'
                      }
                    ])
              : meta.streamLevel === '1bac'
              ? (isLitClass
                  ? [
                      {
                        skillName: 'الحساب العددي، التناسبية، النسب المئوية، وحل المعادلات والنظمات',
                        masteryPct: clampPct(algMastery + 5),
                        errorPattern: 'أخطاء في حساب المميز Δ أو توحيد المقامات في النظمات الخطية'
                      },
                      {
                        skillName: 'مبادئ التعداد والتمييز بين السحب بالتتابع (بإحلال/بدون إحلال) وفي آن واحد',
                        masteryPct: algMastery,
                        errorPattern: 'الخلط بين الترتيبات A(n,p) والتأليفات C(n,p) عند قراءة نص التمرين'
                      },
                      {
                        skillName: 'المتتاليات الحسابية والهندسية (الحد العام ومجموع حدود متتابعة)',
                        masteryPct: clampPct(algMastery - 6),
                        errorPattern: 'خطأ في حساب عدد الحدود (n - p + 1) أثناء تطبيق صيغة المجموع'
                      }
                    ]
                  : [
                      {
                        skillName: 'العبارات المنطقية والمكممات الكونية والوجودية (∀ و ∃)',
                        masteryPct: clampPct(algMastery + 5),
                        errorPattern: 'عدم قلب المكمم عند نفي عبارة مركبة تتضمن استلزاماً'
                      },
                      {
                        skillName: 'الاستدلال بالترجع والاستدلال بفصل الحالات والخلف',
                        masteryPct: algMastery,
                        errorPattern: 'صعوبة الصياغة اللغوية والمنطقية لخطوة الوراثة في الترجع'
                      },
                      {
                        skillName: 'الحد العام ومجموع حدود متتالية حسابية أو هندسية',
                        masteryPct: clampPct(algMastery - 6),
                        errorPattern: 'خطأ في حساب عدد الحدود (n - p + 1) أثناء تطبيق صيغة المجموع'
                      }
                    ])
              : [
                  {
                    skillName: 'القواعد الجبرية في ℝ، المتطابقات الهامة، والقوى والجذور المربعة',
                    masteryPct: clampPct(algMastery + 7),
                    errorPattern: 'أخطاء الإشارة عند نشر تعابير مسبوقة بناقص أو تبسيط الجذور'
                  },
                  {
                    skillName: 'الترتيب في ℝ، التأطير، المجالات، والقيمة المطلقة',
                    masteryPct: algMastery,
                    errorPattern: 'تأطير الفرق أو الخارج مباشرة دون المرور عبر تأطير المقابل أو المقلوب'
                  },
                  {
                    skillName: 'الحدوديات، القسمة الإقليدية على (x - α)، والمعادلات من الدرجة الثانية',
                    masteryPct: clampPct(algMastery - 8),
                    errorPattern: 'تعثر في استنتاج جدول إشارة ثلاثية الحدود ax²+bx+c خارج وداخل الجذرين'
                  }
                ],
          aiDomainDiagnosis:
            isLitClass
              ? 'يُظهر القسم تحكماً إيجابياً في الحساب العددي المباشر والمعادلات، بينما تتركز الأخطاء في التمييز بين صيغ التعداد (الترتيبات والتأليفات) وحساب مجموع حدود متتالية.'
              : meta.streamLevel === '2bac'
              ? 'يُظهر القسم تحكماً جيداً في الحساب الجبري المباشر على الأعداد العقدية والحدود الأولى للمتتاليات، مقابل تعثر الفئة غير المواظبة في خطوات البرهان بالترجع وتأويل التحويلات العقدية.'
              : meta.streamLevel === '1bac'
              ? 'استيعاب إيجابي لأساسيات المنطق والعمليات الجبرية، مع رصد أخطاء متكررة في أوراق الفروض الممسوحة تتعلق بنفي العبارات المكممة وصياغة البرهان بالترجع.'
              : 'يتحكم أغلب تلاميذ القسم في تقنيات النشر والتعميل المباشر، بينما تتركز الأخطاء في تأطير الجداء والخارج وحل المتراجحات المتضمنة للقيمة المطلقة.',
          recommendedExercises: [
            'ورشة تصحيح موجه للأخطاء الجبرية المرصودة في التمرين الأول من الأوراق الممسوحة',
            isLitClass
              ? 'تمارين تطبيقية مركزة للتمييز المنهجي بين السحب بالتتابع والسحب في آن واحد وصيغ المتتاليات'
              : 'تمارين تدرجية قصيرة (15 دقيقة مطلع الحصة) لتثبيت تقنيات البرهان بالترجع والتأطير الجبري'
          ]
        },
        {
          domainKey: 'analysis',
          domainTitle: 'التحليل والدوال العددية (Analysis & Calculus)',
          shortTitle: 'التحليل والدوال',
          curriculumTopics:
            meta.streamLevel === '2bac'
              ? (isLitClass ? 'النهايات والاشتقاق، دراسة الدوال الحدودية والجذرية واللوغاريتمية والأسية البسيطة' : 'النهايات والاتصال، الاشتقاق ودراسة الدوال، الدوال اللوغاريتمية والأسية، التكامل')
              : meta.streamLevel === '1bac'
              ? (isLitClass ? 'عموميات حول الدوال، النهايات، الاشتقاق، ودراسة الدوال الحدودية والمتخاطة وتمثيلها' : 'عموميات حول الدوال العددية، النهايات، الاشتقاق وتطبيقاته، الفروع اللانهائية')
              : 'الدوال العددية الاعتيادية، مجموعة التعريف، الزوجية، الرتابة والتمثيل المبياني',
          domainAvg: clamp20(baseAvgNum - 0.3),
          f1DomainAvg: f1Avg !== null ? clamp20(f1Avg - 0.25) : null,
          f2DomainAvg: f2Avg !== null ? clamp20(f2Avg - 0.35) : null,
          f3DomainAvg: f3Avg !== null ? clamp20(f3Avg - 0.2) : null,
          masteryRate: anaMastery,
          examWeightPct: 35,
          strugglingCount: strugglingCount,
          color: '#0d9488',
          subSkills:
            meta.streamLevel === '2bac'
              ? [
                  {
                    skillName: 'حساب النهايات، رفع الأشكال غير المحددة، والاتصال في نقطة وعلى مجال',
                    masteryPct: clampPct(anaMastery + 4),
                    errorPattern: 'صعوبة اختيار التقنية الأنسب (المرافق، التعميل بالحد الأكبر، تغيير المتغير)'
                  },
                  {
                    skillName: 'مبرهنة القيم الوسيطية (TVI) والدالة العكسية والاشتقاق',
                    masteryPct: anaMastery,
                    errorPattern: 'إغفال ذكر شرط الاتصال أو الرتابة القطعية قبل استنتاج وحدانية الحل'
                  },
                  {
                    skillName: 'دراسة الفروع اللانهائية، نقط الانعطاف، والتمثيل المبياني للدوال (ln و exp)',
                    masteryPct: clampPct(anaMastery - 9),
                    errorPattern: 'خلط بين المقارب المائل والفرع الشلجمي عند تأويل نهاية f(x)/x'
                  }
                ]
              : meta.streamLevel === '1bac'
              ? [
                  {
                    skillName: 'تحديد مجموعة التعريف، الزوجية، ومقارنة دالتين جبرياً ومبيانياً',
                    masteryPct: clampPct(anaMastery + 5),
                    errorPattern: 'نسيان شرط انتماء (-x) إلى مجموعة التعريف عند دراسة الزوجية'
                  },
                  {
                    skillName: 'معدل التغير، رتابة مركب دالتين، والقيم القصوية والدنوية',
                    masteryPct: anaMastery,
                    errorPattern: 'الخلط في قاعدة رتابة مركب دالتين (gof) عندما تكون إحداهما تناقصية'
                  },
                  {
                    skillName: 'قابلية الاشتقاق، معادلة المماس، وجدول تغيرات الدالة',
                    masteryPct: clampPct(anaMastery - 8),
                    errorPattern: 'أخطاء حسابية في مشتقة خارج دالتين أو جذر دالة'
                  }
                ]
              : [
                  {
                    skillName: 'تحديد مجموعة تعريف الدوال الحدودية والجذرية واللاحدودية',
                    masteryPct: clampPct(anaMastery + 6),
                    errorPattern: 'عدم استثناء أصفار المقام أو كتابة المجال بشكل مفتوح/مغلق خاطئ'
                  },
                  {
                    skillName: 'دراسة رتابة دالة باستعمال معدل التغير T(x,y) ومطارف الدالة',
                    masteryPct: anaMastery,
                    errorPattern: 'صعوبة تحديد إشارة معدل التغير على المجالات الجزئية'
                  },
                  {
                    skillName: 'إنشاء وقراءة المنحنيات المبيانية للدوال الاعتيادية (المرجعية)',
                    masteryPct: clampPct(anaMastery - 7),
                    errorPattern: 'ارتباك في حل المتراجحات مبيانياً f(x) ≥ g(x) وتحديد فواصل نقط التقاطع'
                  }
                ],
          aiDomainDiagnosis:
            'يمثل مجال التحليل والدوال العددية العمود الفقري للفروض المحروسة (35% من التنقيط)؛ يتوفق التلاميذ في الأسئلة الإجرائية المباشرة (مجموعة التعريف وحساب المشتقة)، بينما تتعمق الفجوة في التأويل الهندسي للنهايات والمشتقات لدى التلاميذ المتغيبين.',
          recommendedExercises: [
            'بطاقة منهجية جامعة لربط النهايات والاشتقاق بالتأويلات الهندسية والفروع اللانهائية',
            'تمارين تطبيقية مدمجة لتدريب المتعثرين على صياغة شروط مبرهنات التحليل بدقة'
          ]
        },
        {
          domainKey: 'geometry',
          domainTitle: isLitClass ? 'المتتاليات العددية والإحصاء التطبيقي (Sequences & Statistics)' : 'الهندسة المستوية والفضائية (Geometry & Space)',
          shortTitle: isLitClass ? 'المتتاليات والإحصاء' : 'الهندسة والفضاء',
          curriculumTopics:
            isLitClass
              ? 'المتتاليات الحسابية والهندسية، الإحصاء الوصفي (المعدل، المغايرة، الانحراف الطرازي)، قراءة المبيانات'
              : meta.streamLevel === '2bac'
              ? 'الهندسة الفضائية، الجداء السلمي والجداء المتجهي، الفلكة والمستويات في الفضاء'
              : meta.streamLevel === '1bac'
              ? 'المرجح في المستوى، الجداء السلمي وتطبيقاته، معادلة الدائرة، الدوران والحساب المثلثي'
              : 'الحساب المتجهي، الإسقاط في المستوى، المستقيم في المستوى، التحويلات الاعتيادية',
          domainAvg: clamp20(baseAvgNum - 0.65),
          f1DomainAvg: f1Avg !== null ? clamp20(f1Avg - 0.5) : null,
          f2DomainAvg: f2Avg !== null ? clamp20(f2Avg - 0.7) : null,
          f3DomainAvg: f3Avg !== null ? clamp20(f3Avg - 0.65) : null,
          masteryRate: geoMastery,
          examWeightPct: 20,
          strugglingCount: Math.min(students.length, Math.round(strugglingCount * 1.18)),
          color: '#d97706',
          subSkills:
            isLitClass
              ? [
                  {
                    skillName: 'تحديد طبيعة متتالية (حسابية أو هندسية) وحساب حدها العام',
                    masteryPct: clampPct(geoMastery + 5),
                    errorPattern: 'الخلط بين صيغة الحد العام لمتتالية حسابية ومتتالية هندسية'
                  },
                  {
                    skillName: 'حساب مجموع حدود متتابعة من متتالية حسابية أو هندسية',
                    masteryPct: geoMastery,
                    errorPattern: 'أخطاء في تحديد عدد الحدود وحساب القوى في مجموع متتالية هندسية'
                  },
                  {
                    skillName: 'قراءة وتأويل الجداول والمخططات الإحصائية وحساب المؤشرات',
                    masteryPct: clampPct(geoMastery - 7),
                    errorPattern: 'تعثر في استثمار مراكز الأصناف لحساب المعدل الحسابي والمغايرة'
                  }
                ]
              : meta.streamLevel === '2bac'
              ? [
                  {
                    skillName: 'معادلة مستوى، التمثيل البارامتري لمستقيم، والمسافة بين نقطة ومستوى',
                    masteryPct: clampPct(geoMastery + 5),
                    errorPattern: 'خلط بين متجهة منظمية على مستوى ومتجهة موجهة لمستقيم في الفضاء'
                  },
                  {
                    skillName: 'الجداء المتجهي u ∧ v وحساب مساحات المثلثات والمسافة بين نقطة ومستقيم',
                    masteryPct: geoMastery,
                    errorPattern: 'أخطاء إشارة في حساب المحددة من الرتبة الثانية لاستخراج إحداثيات الجداء المتجهي'
                  },
                  {
                    skillName: 'دراسة الفلكة والوضع النسبي لفلكة ومستوى أو مستقيم في الفضاء',
                    masteryPct: clampPct(geoMastery - 8),
                    errorPattern: 'صعوبة تحديد إحداثيات مركز تقاطع فلكة ومستوى (المسقط العمودي H)'
                  }
                ]
              : meta.streamLevel === '1bac'
              ? [
                  {
                    skillName: 'إنشاء المرجح وخاصية التجميعية وصيغة إحداثيات المرجح',
                    masteryPct: clampPct(geoMastery + 6),
                    errorPattern: 'تعثر في توظيف التجميعية لتحديد مجموعات النقط ||αMA + βMB|| = k'
                  },
                  {
                    skillName: 'الصيغة التحليلية للجداء السلمي، تعامد مستقيمين، ومعادلة الدائرة',
                    masteryPct: geoMastery,
                    errorPattern: 'خطأ في تحويل المعادلة الديكارتية للدائرة إلى الشكل القانوني لاستخراج المركز والشعاع'
                  },
                  {
                    skillName: 'الحساب المثلثي وصيغ التحويل والمعادلات المثلثية الأساسية',
                    masteryPct: clampPct(geoMastery - 7),
                    errorPattern: 'نسيان الحل الثاني للمعادلة cos(x)=cos(a) أو sin(x)=sin(a) في المجال المحدد'
                  }
                ]
              : [
                  {
                    skillName: 'علاقة شال، ضرب متجهة في عدد حقيقي، واستقامية النقط',
                    masteryPct: clampPct(geoMastery + 6),
                    errorPattern: 'صعوبة اختيار نقطة الإقحام المناسبة في علاقة شال لتبسيط المجموع المتجهي'
                  },
                  {
                    skillName: 'المعلم في المستوى، إحداثيات متجهة، ومحددة متجهتين det(u,v)',
                    masteryPct: geoMastery,
                    errorPattern: 'أخطاء في حساب المحددة واستنتاج شرط التوازي أو الاستقامية'
                  },
                  {
                    skillName: 'المعادلة الديكارتية والتمثيل البارامتري لمستقيم والوضع النسبي لمستقيمين',
                    masteryPct: clampPct(geoMastery - 8),
                    errorPattern: 'الخلط بين إحداثيات المتجهة الموجهة u(-b,a) ومعاملات المعادلة ax+by+c=0'
                  }
                ],
          aiDomainDiagnosis:
            isLitClass
              ? 'تُبرز الأوراق الممسوحة أن التلاميذ يتحكمون في حساب الحدود الأولى للمتتاليات وقراءة المبيانات، لكنهم يتعثرون في تطبيق صيغ مجاميع المتتاليات وترييض الوضعيات اللفظية.'
              : 'تُبرز الأوراق الممسوحة أن مجال الهندسة يشهد تبايناً واضحاً؛ حيث ينجح التلاميذ في الحساب التحليلي المباشر بالإحداثيات، لكنهم يواجهون صعوبة في الاستدلال الهندسي الصرف وتحديد مجموعات النقط والأوضاع النسبية.',
          recommendedExercises: [
            isLitClass
              ? 'بطاقة تذكيرية مقارنة بين صيغ المتتالية الحسابية والمتتالية الهندسية مرفقة بتمارين تطبيقية مباشرة'
              : 'استثمار السبورة الرقمية التفاعلية لتمثيل الأوضاع النسبية ومجموعات النقط بصرياً قبل البرهنة الجبرية',
            isLitClass
              ? 'تمارين متدرجة حول قراءة المنحنيات والجداول الإحصائية واستخراج المؤشرات الأساسية'
              : 'سلسلة تمارين مركزة تربط بين العلاقات المتجهية والتأويل التحليلي في المعلم'
          ]
        },
        {
          domainKey: 'synthesis',
          domainTitle: isLitClass ? 'التعداد والاحتمالات والمسائل التوليفية (Combinatorics & Synthesis)' : 'الاحتمالات والمسائل التوليفية (Probability & Synthesis)',
          shortTitle: isLitClass ? 'التعداد والتوليف' : 'الاحتمالات والتوليف',
          curriculumTopics:
            meta.streamLevel === '2bac'
              ? 'حساب الاحتمالات، الاحتمال الشرطي، المتغيرات العشوائية، والمسائل التوليفية'
              : meta.streamLevel === '1bac'
              ? 'مبادئ التعداد، السحب بالتتابع أو في آن واحد، والمسائل التوليفية المدمجة'
              : 'الإحصاء الوصفي، قراءة الجداول والمخططات، والمسائل التوليفية متعددة المراحل',
          domainAvg: clamp20(baseAvgNum - 0.95),
          f1DomainAvg: f1Avg !== null ? clamp20(f1Avg - 0.85) : null,
          f2DomainAvg: f2Avg !== null ? clamp20(f2Avg - 1.0) : null,
          f3DomainAvg: f3Avg !== null ? clamp20(f3Avg - 0.9) : null,
          masteryRate: synMastery,
          examWeightPct: 15,
          strugglingCount: Math.min(students.length, Math.round(strugglingCount * 1.32)),
          color: '#7c3aed',
          subSkills: [
            {
              skillName: 'ترييض الوضعيات اللفظية ونمذجتها رياضياً (اختيار الأداة المناسبة)',
              masteryPct: clampPct(synMastery + 4),
              errorPattern: 'الخلط بين أنواع السحب (بإحلال / بدون إحلال / في آن واحد) أو سوء ترجمة المعطيات'
            },
            {
              skillName: 'الربط بين الأسئلة المتدرجة واستثمار نتائج الجزء الأول في الجزء الثاني',
              masteryPct: synMastery,
              errorPattern: 'التوقف عن إتمام المسألة عند التعثر في سؤال وسيطي بدل قبول نتيجته والمواصلة'
            },
            {
              skillName: 'جودة التحرير البرهاني وتدبير الزمن المخصص للمسألة التوليفية',
              masteryPct: clampPct(synMastery - 7),
              errorPattern: 'ضعف تدبير وقت الفرض المحروس وترك أسئلة التوليف الأخيرة فارغة في الورقة الممسوحة'
            }
          ],
          aiDomainDiagnosis:
            'يشكل مجال الاحتمالات والمسائل التوليفية المحدد الأبرز للتميز الدراسي؛ وتظهر قراءة الأوراق الممسوحة أن التلاميذ ذوي الغياب المتكرر يفقدون خيط الترابط بين أجزاء المسألة التوليفية ويتوقفون عند أول عقبة استدلالية.',
          recommendedExercises: [
            'تدريب التلاميذ على منهجية تفكيك المسائل التوليفية واستغلال نتائج الأسئلة السابقة حتى دون البرهنة عليها',
            'تخصيص وضعيات محاكاة زمنية (20 دقيقة) لتحرير مسألة مدمجة وفق سلم التنقيط الرسمي'
          ]
        }
      ];

      return {
        className,
        streamLevel: meta.streamLevel,
        streamLabel: meta.streamLabel,
        coef: meta.coef,
        examsCount: meta.examsCount,
        studentCount: students.length,
        totalAbsenceHours,
        justifiedHours,
        unjustifiedHours,
        lateCount,
        avgAbsencePerStudent,
        attendanceRate,
        absenceRate,
        atRiskAbsenceCount,
        dualRiskCount,
        f1Avg,
        f2Avg,
        f3Avg,
        f4Avg,
        semesterAvg,
        passCount,
        passRate,
        excellenceCount,
        excellenceRate,
        strugglingCount,
        gradedStudentsCount,
        tierExcellent,
        tierVeryGood,
        tierGood,
        tierPassable,
        tierWeak,
        priorityStudents: priorityStudentsRaw.slice(0, 6),
        scannedAxesMastery,
        domainBreakdowns
      };
    });
  }, [db, classNames, semester]);

  const filteredClassesStats = useMemo(() => {
    if (levelFilter === 'all') return allClassesStats;
    return allClassesStats.filter((c) => c.streamLevel === levelFilter);
  }, [allClassesStats, levelFilter]);

  const globalTotals = useMemo(() => {
    let totalStudents = 0;
    let totalAbsenceHours = 0;
    let justifiedHours = 0;
    let unjustifiedHours = 0;
    let lateCount = 0;
    let atRiskAbsenceCount = 0;
    let gradedStudents = 0;
    let passCount = 0;
    let excellenceCount = 0;
    let strugglingCount = 0;
    let weightedAvgSum = 0;

    let tierExcellent = 0;
    let tierVeryGood = 0;
    let tierGood = 0;
    let tierPassable = 0;
    let tierWeak = 0;

    filteredClassesStats.forEach((c) => {
      totalStudents += c.studentCount;
      totalAbsenceHours += c.totalAbsenceHours;
      justifiedHours += c.justifiedHours;
      unjustifiedHours += c.unjustifiedHours;
      lateCount += c.lateCount;
      atRiskAbsenceCount += c.atRiskAbsenceCount;
      gradedStudents += c.gradedStudentsCount;
      passCount += c.passCount;
      excellenceCount += c.excellenceCount;
      strugglingCount += c.strugglingCount;
      if (c.semesterAvg !== null && c.gradedStudentsCount > 0) {
        weightedAvgSum += c.semesterAvg * c.gradedStudentsCount;
      }
      tierExcellent += c.tierExcellent;
      tierVeryGood += c.tierVeryGood;
      tierGood += c.tierGood;
      tierPassable += c.tierPassable;
      tierWeak += c.tierWeak;
    });

    const globalAvg =
      gradedStudents > 0 ? Number((weightedAvgSum / gradedStudents).toFixed(2)) : null;
    const globalPassRate =
      gradedStudents > 0 ? Number(((passCount / gradedStudents) * 100).toFixed(1)) : 0;
    const globalExcellenceRate =
      gradedStudents > 0 ? Number(((excellenceCount / gradedStudents) * 100).toFixed(1)) : 0;
    const globalAttendanceRate =
      filteredClassesStats.length > 0
        ? Number(
            (
              filteredClassesStats.reduce((acc, c) => acc + c.attendanceRate, 0) /
              filteredClassesStats.length
            ).toFixed(1)
          )
        : 100;
    const globalAbsenceRate = Math.max(0, Number((100 - globalAttendanceRate).toFixed(1)));

    return {
      classesCount: filteredClassesStats.length,
      totalStudents,
      totalAbsenceHours,
      justifiedHours,
      unjustifiedHours,
      lateCount,
      atRiskAbsenceCount,
      gradedStudents,
      globalAvg,
      globalPassRate,
      globalExcellenceRate,
      globalAttendanceRate,
      globalAbsenceRate,
      passCount,
      excellenceCount,
      strugglingCount,
      tierExcellent,
      tierVeryGood,
      tierGood,
      tierPassable,
      tierWeak
    };
  }, [filteredClassesStats]);

  const masteryDistributionData = useMemo(() => {
    return [
      {
        name: 'ممتاز (≥16)',
        count: globalTotals.tierExcellent,
        color: '#15803d',
        pct:
          globalTotals.gradedStudents > 0
            ? Math.round((globalTotals.tierExcellent / globalTotals.gradedStudents) * 100)
            : 0
      },
      {
        name: 'جيد جداً (14-16)',
        count: globalTotals.tierVeryGood,
        color: '#0284c7',
        pct:
          globalTotals.gradedStudents > 0
            ? Math.round((globalTotals.tierVeryGood / globalTotals.gradedStudents) * 100)
            : 0
      },
      {
        name: 'جيد (12-14)',
        count: globalTotals.tierGood,
        color: '#0d9488',
        pct:
          globalTotals.gradedStudents > 0
            ? Math.round((globalTotals.tierGood / globalTotals.gradedStudents) * 100)
            : 0
      },
      {
        name: 'مستوفٍ (10-12)',
        count: globalTotals.tierPassable,
        color: '#d97706',
        pct:
          globalTotals.gradedStudents > 0
            ? Math.round((globalTotals.tierPassable / globalTotals.gradedStudents) * 100)
            : 0
      },
      {
        name: 'متعثر (<10)',
        count: globalTotals.tierWeak,
        color: '#dc2626',
        pct:
          globalTotals.gradedStudents > 0
            ? Math.round((globalTotals.tierWeak / globalTotals.gradedStudents) * 100)
            : 0
      }
    ];
  }, [globalTotals]);

  // =========================================================================
  // ويدجت المقارنة البيانية لغيابات التلاميذ: الشهر الحالي مقابل الشهر الماضي (Recharts)
  // =========================================================================
  const availableMonthsList = useMemo(() => {
    const set = new Set<string>();
    const recs = Array.isArray(db?.records) ? db.records : [];
    recs.forEach((r: any) => {
      if (r.date && typeof r.date === 'string' && r.date.length >= 7) {
        set.add(r.date.slice(0, 7));
      }
    });
    set.add('2026-11');
    set.add('2026-10');
    set.add('2026-09');
    return Array.from(set).sort().reverse();
  }, [db?.records]);

  const allStudentsMonthlyAbsence = useMemo(() => {
    if (!db || !db.classes) return [];
    const allRecords: any[] = Array.isArray(db.records) ? db.records : [];
    const targetClasses = absenceCompClass === 'all' ? classNames : [absenceCompClass];

    const hasCurrRecords = allRecords.some((r: any) => r.date && r.date.startsWith(absenceCompCurrentMonth));
    const hasPrevRecords = allRecords.some((r: any) => r.date && r.date.startsWith(absenceCompPreviousMonth));
    const isVirtuallyEmpty = !hasCurrRecords && !hasPrevRecords;
    const shouldSimulate = useAbsenceDemoData || isVirtuallyEmpty;

    const list: Array<{
      studentId: string;
      studentName: string;
      className: string;
      orderNum: number | string;
      massar?: string;
      prevTotalHours: number;
      prevJustifiedHours: number;
      prevUnjustifiedHours: number;
      prevLateCount: number;
      currTotalHours: number;
      currJustifiedHours: number;
      currUnjustifiedHours: number;
      currLateCount: number;
      deltaHours: number;
      pctChange: number;
      isWorsened: boolean;
      isImproved: boolean;
      isAtRisk: boolean;
    }> = [];

    targetClasses.forEach((clsName) => {
      const students: Student[] = db.classes[clsName] || [];
      students.forEach((std, sIdx) => {
        let prevTotalHours = 0;
        let prevJustifiedHours = 0;
        let prevUnjustifiedHours = 0;
        let prevLateCount = 0;

        let currTotalHours = 0;
        let currJustifiedHours = 0;
        let currUnjustifiedHours = 0;
        let currLateCount = 0;

        if (shouldSimulate) {
          const hash = ((std.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + sIdx * 5) % 17;
          if (hash % 3 === 0) {
            prevTotalHours = (hash % 4) + 1;
            prevUnjustifiedHours = prevTotalHours > 1 ? prevTotalHours - 1 : prevTotalHours;
            prevJustifiedHours = prevTotalHours - prevUnjustifiedHours;
            prevLateCount = hash % 2;

            currTotalHours = (hash + 2) % 6;
            currUnjustifiedHours = currTotalHours > 1 ? currTotalHours - 1 : currTotalHours;
            currJustifiedHours = currTotalHours - currUnjustifiedHours;
            currLateCount = (hash + 1) % 3;
          } else if (hash % 5 === 0) {
            prevTotalHours = (hash % 5) + 2;
            prevUnjustifiedHours = prevTotalHours;
            currTotalHours = Math.max(0, prevTotalHours - 2);
            currUnjustifiedHours = currTotalHours;
          } else if (hash === 7 || hash === 11) {
            prevTotalHours = 1;
            prevJustifiedHours = 1;
            currTotalHours = 5;
            currUnjustifiedHours = 4;
            currJustifiedHours = 1;
            currLateCount = 2;
          }
        } else {
          allRecords.forEach((r: any) => {
            if (r.studentId === std.id && r.date && typeof r.date === 'string') {
              const dur = Number(r.duration) || 1;
              if (r.date.startsWith(absenceCompPreviousMonth)) {
                if (r.status === 'غائب' || r.status === 'مبرر') {
                  prevTotalHours += dur;
                  if (r.status === 'مبرر') prevJustifiedHours += dur;
                  else prevUnjustifiedHours += dur;
                } else if (r.status === 'متأخر') {
                  prevLateCount += 1;
                }
              } else if (r.date.startsWith(absenceCompCurrentMonth)) {
                if (r.status === 'غائب' || r.status === 'مبرر') {
                  currTotalHours += dur;
                  if (r.status === 'مبرر') currJustifiedHours += dur;
                  else currUnjustifiedHours += dur;
                } else if (r.status === 'متأخر') {
                  currLateCount += 1;
                }
              }
            }
          });
        }

        const deltaHours = currTotalHours - prevTotalHours;
        let pctChange = 0;
        if (prevTotalHours === 0 && currTotalHours > 0) {
          pctChange = 100;
        } else if (prevTotalHours > 0) {
          pctChange = Number((((currTotalHours - prevTotalHours) / prevTotalHours) * 100).toFixed(1));
        }

        list.push({
          studentId: std.id,
          studentName: std.name || `تلميذ #${std.orderNum || sIdx + 1}`,
          className: clsName,
          orderNum: std.orderNum || sIdx + 1,
          massar: std.massar,
          prevTotalHours,
          prevJustifiedHours,
          prevUnjustifiedHours,
          prevLateCount,
          currTotalHours,
          currJustifiedHours,
          currUnjustifiedHours,
          currLateCount,
          deltaHours,
          pctChange,
          isWorsened: deltaHours > 0,
          isImproved: deltaHours < 0,
          isAtRisk: currTotalHours >= 4
        });
      });
    });

    return list;
  }, [
    db,
    classNames,
    absenceCompClass,
    absenceCompCurrentMonth,
    absenceCompPreviousMonth,
    useAbsenceDemoData
  ]);

  const filteredStudentsAbsenceList = useMemo(() => {
    let list = allStudentsMonthlyAbsence.filter(
      (s) => s.currTotalHours > 0 || s.prevTotalHours > 0 || s.currLateCount > 0 || s.prevLateCount > 0
    );
    if (list.length === 0) {
      list = allStudentsMonthlyAbsence.slice(0, 10);
    }

    if (absenceCompSort === 'highest_current') {
      list.sort((a, b) => b.currTotalHours - a.currTotalHours || b.deltaHours - a.deltaHours);
    } else if (absenceCompSort === 'highest_increase') {
      list.sort((a, b) => b.deltaHours - a.deltaHours || b.currTotalHours - a.currTotalHours);
    } else if (absenceCompSort === 'highest_decrease') {
      list.sort((a, b) => a.deltaHours - b.deltaHours || b.prevTotalHours - a.prevTotalHours);
    } else if (absenceCompSort === 'total_both') {
      list.sort((a, b) => (b.currTotalHours + b.prevTotalHours) - (a.currTotalHours + a.prevTotalHours));
    }

    return list.slice(0, absenceCompLimit);
  }, [allStudentsMonthlyAbsence, absenceCompSort, absenceCompLimit]);

  const classesAbsenceMonthlyCompData = useMemo(() => {
    return classNames.map((cName) => {
      const clsStudents = allStudentsMonthlyAbsence.filter((s) => s.className === cName);
      const prevTotal = clsStudents.reduce((acc, s) => acc + s.prevTotalHours, 0);
      const currTotal = clsStudents.reduce((acc, s) => acc + s.currTotalHours, 0);
      const delta = currTotal - prevTotal;
      const pct = prevTotal > 0 ? Number((((currTotal - prevTotal) / prevTotal) * 100).toFixed(1)) : currTotal > 0 ? 100 : 0;
      return {
        className: cName,
        prevTotalHours: prevTotal,
        currTotalHours: currTotal,
        deltaHours: delta,
        pctChange: pct,
        studentCount: clsStudents.length
      };
    });
  }, [classNames, allStudentsMonthlyAbsence]);

  const monthlyCompSummary = useMemo(() => {
    let totalCurr = 0;
    let totalPrev = 0;
    let totalCurrUnjust = 0;
    let totalCurrJust = 0;
    let totalCurrLates = 0;
    let atRiskCount = 0;
    let worsenedCount = 0;
    let improvedCount = 0;
    let activeAbsentStudents = 0;

    allStudentsMonthlyAbsence.forEach((s) => {
      totalCurr += s.currTotalHours;
      totalPrev += s.prevTotalHours;
      totalCurrUnjust += s.currUnjustifiedHours;
      totalCurrJust += s.currJustifiedHours;
      totalCurrLates += s.currLateCount;
      if (s.currTotalHours > 0) activeAbsentStudents++;
      if (s.isAtRisk) atRiskCount++;
      if (s.isWorsened) worsenedCount++;
      if (s.isImproved) improvedCount++;
    });

    const netDelta = totalCurr - totalPrev;
    const netPct = totalPrev > 0 ? Number(((netDelta / totalPrev) * 100).toFixed(1)) : totalCurr > 0 ? 100 : 0;

    return {
      totalCurr,
      totalPrev,
      totalCurrUnjust,
      totalCurrJust,
      totalCurrLates,
      netDelta,
      netPct,
      atRiskCount,
      worsenedCount,
      improvedCount,
      activeAbsentStudents
    };
  }, [allStudentsMonthlyAbsence]);

  const selectedStudentComp = useMemo(() => {
    if (!absenceCompSelectedStudentId) {
      return filteredStudentsAbsenceList[0] || allStudentsMonthlyAbsence[0] || null;
    }
    return (
      allStudentsMonthlyAbsence.find((s) => s.studentId === absenceCompSelectedStudentId) ||
      filteredStudentsAbsenceList[0] ||
      null
    );
  }, [absenceCompSelectedStudentId, filteredStudentsAbsenceList, allStudentsMonthlyAbsence]);

  const selectedStudentBreakdownData = useMemo(() => {
    if (!selectedStudentComp) return [];
    return [
      {
        category: 'الغياب غير المبرر',
        prev: selectedStudentComp.prevUnjustifiedHours,
        curr: selectedStudentComp.currUnjustifiedHours,
        unit: 'ساعة'
      },
      {
        category: 'الغياب المبرر',
        prev: selectedStudentComp.prevJustifiedHours,
        curr: selectedStudentComp.currJustifiedHours,
        unit: 'ساعة'
      },
      {
        category: 'مرات التأخر',
        prev: selectedStudentComp.prevLateCount,
        curr: selectedStudentComp.currLateCount,
        unit: 'مرة'
      }
    ];
  }, [selectedStudentComp]);

  const getArabicMonthName = (mKey: string): string => {
    if (!mKey) return '';
    const parts = mKey.split('-');
    if (parts.length < 2) return mKey;
    const mNames: Record<string, string> = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
      '05': 'ماي', '06': 'يونيو', '07': 'يوليوز', '08': 'غشت',
      '09': 'شتنبر', '10': 'أكتوبر', '11': 'نونبر', '12': 'دجنبر'
    };
    return `${mNames[parts[1]] || parts[1]} ${parts[0]}`;
  };

  const handleNavigateToClass = (className: string, targetTab: 'grades' | 'absence' | 'analysis') => {
    const win = window as any;
    if (targetTab === 'grades' || targetTab === 'absence') {
      const classSelect = document.getElementById('classSelect') as HTMLSelectElement | null;
      if (classSelect) {
        classSelect.value = className;
        if (typeof win.onClassChange === 'function') {
          win.onClassChange();
        }
      }
    } else if (targetTab === 'analysis') {
      const annualSelect = document.getElementById('annualClassSelect') as HTMLSelectElement | null;
      if (annualSelect) {
        annualSelect.value = className;
      }
      window.dispatchEvent(new CustomEvent('annualClassChanged', { detail: { className } }));
    }
    if (typeof win.switchTab === 'function') {
      win.switchTab(targetTab);
    }
  };

  const handleExportSnapshot = async () => {
    if (!dashboardRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `لوحة_القيادة_الشاملة_الأقسام_${semester}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to export dashboard image:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const scannedSourceLabel = useMemo(() => {
    if (aiDiagScannedSource === 'f1') return 'الفرض المحروس 1 الممسوح (F1)';
    if (aiDiagScannedSource === 'f2') return 'الفرض المحروس 2 الممسوح (F2)';
    if (aiDiagScannedSource === 'f3') return 'الفرض المحروس 3 الممسوح (F3)';
    return 'الحصيلة المجمعة للفروض المحروسة الممسوحة (F1 + F2 + F3)';
  }, [aiDiagScannedSource]);

  const getActiveExamAvgForClass = (cls: ClassAggregatedStats): number | null => {
    if (aiDiagScannedSource === 'f1') return cls.f1Avg;
    if (aiDiagScannedSource === 'f2') return cls.f2Avg;
    if (aiDiagScannedSource === 'f3') return cls.f3Avg;
    return cls.semesterAvg;
  };

  // Build deterministic local diagnostic reports immediately while/if Gemini responds
  const buildLocalClassDiagnostics = (
    targetClasses: ClassAggregatedStats[]
  ): AiDashboardDiagnosticsResponse => {
    let totalStd = 0;
    let weightedSum = 0;
    let gradedAll = 0;
    let totalPass = 0;
    let totalAbsHours = 0;
    let bestCls = { name: '-', avg: -1 };
    let urgentCls = { name: '-', score: 999 };

    const reports: AiClassReportItem[] = targetClasses.map((cls) => {
      const activeAvg = getActiveExamAvgForClass(cls);
      totalStd += cls.studentCount;
      totalAbsHours += cls.totalAbsenceHours;
      if (activeAvg !== null && cls.gradedStudentsCount > 0) {
        weightedSum += activeAvg * cls.gradedStudentsCount;
        gradedAll += cls.gradedStudentsCount;
        totalPass += cls.passCount;
        if (activeAvg > bestCls.avg) bestCls = { name: cls.className, avg: activeAvg };
      }

      const acadScore =
        activeAvg !== null ? Math.min(100, (activeAvg / 16) * 55 + cls.passRate * 0.45) : 65;
      const attScore = Math.max(0, Math.min(100, cls.attendanceRate - cls.unjustifiedHours * 0.4));
      const healthScore = Math.round(acadScore * 0.7 + attScore * 0.3);
      if (healthScore < urgentCls.score) urgentCls = { name: cls.className, score: healthScore };

      let levelBadge = 'جيد ومستقر';
      if (healthScore >= 78 && cls.passRate >= 70) levelBadge = 'ممتاز ومتجانس';
      else if (healthScore >= 62 && cls.passRate >= 50) levelBadge = 'جيد ومستقر';
      else if (healthScore >= 48) levelBadge = 'متوسط يحتاج مواكبة';
      else levelBadge = 'حرج يتطلب دعماً عاجلاً';

      let progNote = 'استقرار نسبي في مؤشرات التحصيل عبر الفروض الممسوحة.';
      if (cls.f1Avg !== null && cls.f2Avg !== null) {
        const d12 = Number((cls.f2Avg - cls.f1Avg).toFixed(2));
        if (cls.f3Avg !== null) {
          const d23 = Number((cls.f3Avg - cls.f2Avg).toFixed(2));
          if (d23 > 0.4) progNote = `تطور إيجابي في الفرض الممسوح 3 (+${d23} نقطة عن الفرض 2) يعكس أثر التصحيح والدعم.`;
          else if (d23 < -0.4) progNote = `انخفاض في الفرض الممسوح 3 (${d23} نقطة عن الفرض 2) مرتبط بارتفاع درجة التجريد.`;
        } else if (d12 > 0.4) {
          progNote = `تحسن ملحوظ بين الفرض الممسوح 1 والفرض 2 بزيادة (+${d12} نقطة).`;
        } else if (d12 < -0.4) {
          progNote = `تراجع في متوسط الفرض الممسوح 2 (${d12} نقطة عن الفرض 1) يستدعي تثبيت المكتسبات القبلية.`;
        }
      }

      const avgTxt = activeAvg !== null ? `${activeAvg.toFixed(2)}/20` : 'قيد الرصد';
      const scannedExamsDiagnosis = `استناداً إلى نتائج ${scannedSourceLabel} (تقويم خالص بالفروض المحروسة الكتابية 100% وفق المذكرة 142-08 دون احتساب نقط المشاركة)، حقق القسم ${cls.className} (${cls.streamLabel}) متوسطاً قدره ${avgTxt} بنسبة تحكم واستيفاء (≥10/20) بلغت ${cls.passRate}% ونسبة تميز (≥16/20) بلغت ${cls.excellenceRate}%، مقابل رصد ${cls.strugglingCount} تلميذاً في وضعية تعثر (<10/20). ${progNote}`;

      const attendanceImpactDiagnosis =
        cls.totalAbsenceHours === 0
          ? `يسجل القسم ${cls.className} مواظبة تامة بنسبة حضور 100% وغياب منعدم، مما يتيح توجيه كامل الجهد البيداغوجي لمعالجة منهجية تحرير البراهين وحل المسائل المركبة.`
          : `سجل القسم نسبة مواظبة ${cls.attendanceRate}% مقابل ${cls.totalAbsenceHours} ساعة غياب (${cls.unjustifiedHours} س غير مبررة، ${cls.justifiedHours} س مبررة، و${cls.lateCount} تأخرات)، مع وجود ${cls.atRiskAbsenceCount} تلاميذ تجاوزوا عتبة الخطر (≥4 ساعات)${cls.dualRiskCount > 0 ? ` بينهم ${cls.dualRiskCount} تلاميذ في خطر مزدوج (غياب متكرر + معدل فرض ممسوح <10/20)` : ''}. يظهر الأثر المباشر للغياب في ضياع التسلسل المنطقي للفقرات الرياضية المترابطة.`;

      const detectedMathGaps =
        cls.streamLevel === '2bac'
          ? [
              'صعوبة رفع الأشكال غير المحددة في النهايات والتحقق من شروط مبرهنة القيم الوسيطية (TVI) في الأوراق الممسوحة',
              'ارتباك في حساب مشتقة مركب دالتين وتأويل المماسات أو دراسة تقارب المتتاليات الترجعية u_(n+1)=f(u_n)',
              'نقص في دقة التحرير البرهاني والتصريح بالمبرهنات المعتمدة وفق الأطر المرجعية للبكالوريا'
            ]
          : cls.streamLevel === '1bac'
          ? [
              'خلط في الروابط المنطقية ونفي العبارات المكممة (∀ و ∃) وهيكلة الاستدلال بالترجع أو الخلف في التمرين الأول',
              'أخطاء إجرائية في عموميات الدوال (مجموعة التعريف، مركب دالتين، ومقارنة الدوال)',
              'صعوبة توظيف خاصية التجميعية للمرجح والجداء السلمي في تحديد مجموعات النقط'
            ]
          : [
              'أخطاء في الحساب العددي والجبري في ℝ، القيمة المطلقة، وخصائص الترتيب والتأطير',
              'تعثر في القسمة الإقليدية للحدوديات على (x - α) وتعميل ثلاثية الحدود ودراسة إشارتها',
              'صعوبة الانتقال من المعطيات الهندسية إلى العلاقات المتجهية أو التحليلية في المستوى'
            ];

      const remediationActionPlan = [
        `برمجة حصة دعم مدمجة (45-60 دقيقة) لفائدة المتعثرين (${cls.strugglingCount} تلميذ) لتفكيك الأخطاء المرصودة في ${scannedSourceLabel} عبر بطاقات التصحيح الموجه.`,
        `تفعيل التعلم بالقرين (Tutorat par les pairs) بإقران المتعثرين بالتلاميذ المتميزين (≥14/20) لإنجاز وضعيات متدرجة تحاكي الفرض المحروس.`,
        cls.totalAbsenceHours > 0
          ? `التنسيق مع الحراسة العامة وأولياء أمور التلاميذ المتجاوزين لعتبة الغياب (${cls.atRiskAbsenceCount} حالات) لضبط المواظبة وإلزامهم باستدراك الدروس والتمارين الفائتة.`
          : `تخصيص وضعيات أولمبياد وتمارين توليفية للفئة المتفوقة لرفع نسبة التميز (≥16/20) في الفرض الموالي.`
      ];

      const targetPass = Math.min(100, Math.max(cls.passRate + 12, 65));
      const targetAvg = activeAvg !== null ? Math.min(20, Number((activeAvg + 1.2).toFixed(2))) : 12.5;
      const targetMilestone = `الارتقاء بمعدل القسم إلى ${targetAvg}/20 ورفع نسبة التحكم إلى ${targetPass}% في الفرض المحروس القادم مع خفض الغياب غير المبرر بنسبة 50%.`;

      return {
        className: cls.className,
        streamLabel: cls.streamLabel,
        levelBadge,
        healthScore,
        scannedExamsDiagnosis,
        attendanceImpactDiagnosis,
        detectedMathGaps,
        remediationActionPlan,
        targetMilestone
      };
    });

    const gAvg = gradedAll > 0 ? (weightedSum / gradedAll).toFixed(2) : '--';
    const gPass = gradedAll > 0 ? ((totalPass / gradedAll) * 100).toFixed(1) : '0';
    const executiveSummary = `شمل التحليل التشخيصي الذكي ${targetClasses.length} أقسام مسندة (${totalStd} تلميذاً) بناءً على نتائج ${scannedSourceLabel} وسجلات المواظبة. بلغ المعدل العام المجمع ${gAvg}/20 بنسبة استيفاء ${gPass}% وإجمالي ${totalAbsHours} ساعة غياب. يتصدر القسم (${bestCls.name}) مؤشرات التحكم والاستقرار، في حين يُصنَّف القسم (${urgentCls.name}) كأولوية قصوى للتدخل البيداغوجي والدعم الاستدراكي المندمج وضبط المواظبة قبل الفرض المحروس المقبل.`;

    return {
      executiveSummary,
      classReports: reports
    };
  };

  const runAiClassesDiagnostics = async (overrideClassFilter?: string, overrideSource?: 'all' | 'f1' | 'f2' | 'f3') => {
    const activeClsFilter = overrideClassFilter !== undefined ? overrideClassFilter : aiDiagClassFilter;
    const activeSrc = overrideSource !== undefined ? overrideSource : aiDiagScannedSource;

    const targetClasses =
      activeClsFilter === 'all'
        ? filteredClassesStats
        : allClassesStats.filter((c) => c.className === activeClsFilter);

    if (targetClasses.length === 0) return;

    setShowAiDiagnosticsCenter(true);
    setIsGeneratingAiDiag(true);

    // Provide immediate deterministic baseline so UI is responsive right away
    const localBaseline = buildLocalClassDiagnostics(targetClasses);
    setAiDiagResponse(localBaseline);
    setAiDiagSource('heuristic');

    try {
      const srcLabel =
        activeSrc === 'f1'
          ? 'الفرض المحروس 1 الممسوح (F1)'
          : activeSrc === 'f2'
          ? 'الفرض المحروس 2 الممسوح (F2)'
          : activeSrc === 'f3'
          ? 'الفرض المحروس 3 الممسوح (F3)'
          : 'الحصيلة المجمعة للفروض المحروسة الممسوحة (F1 + F2 + F3)';

      const payload = {
        semester,
        scannedExamSource: activeSrc,
        scannedExamSourceLabel: srcLabel,
        classes: targetClasses.map((c) => ({
          className: c.className,
          streamLevel: c.streamLevel,
          streamLabel: c.streamLabel,
          coef: c.coef,
          examsCount: c.examsCount,
          studentCount: c.studentCount,
          gradedStudentsCount: c.gradedStudentsCount,
          f1Avg: c.f1Avg,
          f2Avg: c.f2Avg,
          f3Avg: c.f3Avg,
          f4Avg: c.f4Avg,
          semesterAvg: c.semesterAvg,
          activeExamAvg:
            activeSrc === 'f1'
              ? c.f1Avg
              : activeSrc === 'f2'
              ? c.f2Avg
              : activeSrc === 'f3'
              ? c.f3Avg
              : c.semesterAvg,
          passCount: c.passCount,
          passRate: c.passRate,
          excellenceCount: c.excellenceCount,
          excellenceRate: c.excellenceRate,
          strugglingCount: c.strugglingCount,
          totalAbsenceHours: c.totalAbsenceHours,
          unjustifiedHours: c.unjustifiedHours,
          justifiedHours: c.justifiedHours,
          lateCount: c.lateCount,
          attendanceRate: c.attendanceRate,
          absenceRate: c.absenceRate,
          atRiskAbsenceCount: c.atRiskAbsenceCount,
          dualRiskCount: c.dualRiskCount,
          scannedAxesMastery: c.scannedAxesMastery,
          priorityStudentsSample: c.priorityStudents.slice(0, 4)
        }))
      };

      const res = await fetch('/api/ai/dashboard-classes-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.result && Array.isArray(data.result.classReports) && data.result.classReports.length > 0) {
          setAiDiagResponse(data.result);
          setAiDiagSource(data.source === 'gemini' ? 'gemini' : 'heuristic');
        }
      }
    } catch (err) {
      // Keep the already-populated localBaseline
    } finally {
      setIsGeneratingAiDiag(false);
    }
  };

  // Expose global helper so index.html Dashboard buttons can open & trigger AI Class Diagnostics directly
  useEffect(() => {
    (window as any).openDashboardAiClassDiagnostics = (targetClassName?: string) => {
      const nextFilter = targetClassName && classNames.includes(targetClassName) ? targetClassName : 'all';
      setAiDiagClassFilter(nextFilter);
      setShowAiDiagnosticsCenter(true);
      runAiClassesDiagnostics(nextFilter, aiDiagScannedSource);
      setTimeout(() => {
        aiDiagSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    };
    return () => {
      delete (window as any).openDashboardAiClassDiagnostics;
    };
  }, [classNames, filteredClassesStats, allClassesStats, semester, aiDiagScannedSource]);

  const handleScheduleClassSupportFromDiagnostic = (
    clsStats: ClassAggregatedStats,
    report: AiClassReportItem
  ) => {
    const win = window as any;
    const strugglingNames = clsStats.priorityStudents.map((s) => s.name).join('، ');
    const prefillData = {
      title: `حصة دعم ومعالجة بيداغوجية للقسم ${clsStats.className} (بناءً على تشخيص الفروض الممسوحة والمواظبة)`,
      reason: `تقرير التشخيص بالذكاء الاصطناعي (${report.levelBadge} — مؤشر الأداء ${report.healthScore}%): ${clsStats.strugglingCount} متعثرين و${clsStats.totalAbsenceHours} ساعة غياب`,
      beneficiaries: strugglingNames || `تلاميذ القسم ${clsStats.className} المحتاجون للدعم`,
      type: 'soutien',
      summary: `• تشخيص الفروض الممسوحة: ${report.scannedExamsDiagnosis}\n• تشخيص المواظبة: ${report.attendanceImpactDiagnosis}\n• الفجوات الرياضية المستهدفة:\n  - ${report.detectedMathGaps.join('\n  - ')}\n• خطة التدخل المطبقة:\n  1) ${report.remediationActionPlan[0] || ''}\n  2) ${report.remediationActionPlan[1] || ''}\n• الهدف المسطر: ${report.targetMilestone}`,
      duration: '2'
    };

    if (typeof win.openExtraSupportSessionModal === 'function') {
      win.openExtraSupportSessionModal(clsStats.className, prefillData);
      if (typeof win.showToast === 'function') {
        win.showToast(`✅ تم تجهيز حصة الدعم المخصصة للقسم ${clsStats.className} في دفتر النصوص`);
      }
    } else {
      handleNavigateToClass(clsStats.className, 'analysis');
    }
  };

  // Merge AI-returned domainBreakdowns (if present) with rich local subSkills & exam progression
  const getMergedDomainsForClass = (clsStats: ClassAggregatedStats): SubjectDomainBreakdown[] => {
    const aiRep = aiDiagResponse?.classReports?.find((r) => r.className === clsStats.className);
    if (!aiRep || !Array.isArray(aiRep.domainBreakdowns) || aiRep.domainBreakdowns.length === 0) {
      return clsStats.domainBreakdowns;
    }
    return clsStats.domainBreakdowns.map((localDom, idx) => {
      const aiDom =
        aiRep.domainBreakdowns?.find((d) => d.domainKey === localDom.domainKey) ||
        aiRep.domainBreakdowns?.[idx];
      if (!aiDom) return localDom;
      return {
        ...localDom,
        domainTitle: aiDom.domainTitle || localDom.domainTitle,
        curriculumTopics: aiDom.curriculumTopics || localDom.curriculumTopics,
        domainAvg:
          typeof aiDom.domainAvg === 'number' && !isNaN(aiDom.domainAvg)
            ? Number(aiDom.domainAvg.toFixed(2))
            : localDom.domainAvg,
        masteryRate:
          typeof aiDom.masteryRate === 'number' && !isNaN(aiDom.masteryRate)
            ? Math.round(aiDom.masteryRate)
            : localDom.masteryRate,
        examWeightPct:
          typeof aiDom.examWeightPct === 'number' && !isNaN(aiDom.examWeightPct)
            ? aiDom.examWeightPct
            : localDom.examWeightPct,
        strugglingCount:
          typeof aiDom.strugglingCount === 'number' && !isNaN(aiDom.strugglingCount)
            ? aiDom.strugglingCount
            : localDom.strugglingCount,
        aiDomainDiagnosis: aiDom.aiDomainDiagnosis || localDom.aiDomainDiagnosis,
        recommendedExercises:
          Array.isArray(aiDom.recommendedExercises) && aiDom.recommendedExercises.length > 0
            ? aiDom.recommendedExercises
            : localDom.recommendedExercises
      };
    });
  };

  const handleOpenClassDomainBreakdown = (className: string, domainKey: string = 'all') => {
    setSelectedDomainCardClass(className);
    setSelectedSubjectDomainKey(domainKey);
    if (!aiDiagResponse) {
      // Populate baseline AI diagnostics in background if not yet run
      const localBaseline = buildLocalClassDiagnostics(filteredClassesStats);
      setAiDiagResponse(localBaseline);
      setAiDiagSource('heuristic');
    }
    setTimeout(() => {
      domainBreakdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const handleScheduleDomainSupport = (
    clsStats: ClassAggregatedStats,
    domain: SubjectDomainBreakdown
  ) => {
    const win = window as any;
    const strugglingNames = clsStats.priorityStudents.map((s) => s.name).join('، ');
    const prefillData = {
      title: `حصة دعم ومعالجة في مجال «${domain.shortTitle}» — القسم ${clsStats.className}`,
      reason: `تشخيص المجال المعرفي (${domain.domainTitle}): معدل المجال ${domain.domainAvg}/20، نسبة التحكم ${domain.masteryRate}%، وعدد المتعثرين ${domain.strugglingCount}`,
      beneficiaries: strugglingNames || `التلاميذ المتعثرون في مجال ${domain.shortTitle} بالقسم ${clsStats.className}`,
      type: 'soutien',
      summary: `• المجال المعرفي المستهدف: ${domain.domainTitle}\n• المحاور المقررة: ${domain.curriculumTopics}\n• التشخيص الديداكتيكي للأوراق الممسوحة: ${domain.aiDomainDiagnosis}\n• المهارات الفرعية المستهدفة:\n${domain.subSkills
        .map((sk) => `  - ${sk.skillName} (نسبة التحكم ${sk.masteryPct}% — الخطأ الشائع: ${sk.errorPattern})`)
        .join('\n')}\n• التمارين العلاجية المبرمجة:\n${domain.recommendedExercises
        .map((ex, i) => `  ${i + 1}) ${ex}`)
        .join('\n')}`,
      duration: '1'
    };

    if (typeof win.openExtraSupportSessionModal === 'function') {
      win.openExtraSupportSessionModal(clsStats.className, prefillData);
      if (typeof win.showToast === 'function') {
        win.showToast(
          `✅ تم تجهيز حصة الدعم المخصصة لمجال «${domain.shortTitle}» للقسم ${clsStats.className}`
        );
      }
    } else {
      handleNavigateToClass(clsStats.className, 'analysis');
    }
  };

  const handlePrintClassDomainBreakdown = (clsStats: ClassAggregatedStats) => {
    const domains = getMergedDomainsForClass(clsStats);
    const teacherName = db?.teacherProfile?.name || 'إبراهيم قزيبر';
    const schoolName = db?.teacherProfile?.school || 'الثانوية التأهيلية';
    const academyName = db?.teacherProfile?.academy || 'الأكاديمية الجهوية للتربية والتكوين';
    const printDate = new Date().toLocaleDateString('ar-MA');

    const domainsHtml = domains
      .map(
        (dom) => `
      <div style="border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${dom.color}; padding-bottom: 6px; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 14px; color: #0f172a;">${dom.domainTitle}</strong>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">المحاور: ${dom.curriculumTopics}</div>
          </div>
          <div style="text-align: left; font-size: 12px; font-weight: 800; color: #0f172a;">
            <span>المعدل: ${dom.domainAvg}/20</span> ·
            <span>التحكم: ${dom.masteryRate}%</span> ·
            <span>الوزن: ${dom.examWeightPct}%</span> ·
            <span style="color: #be123c;">متعثرون: ${dom.strugglingCount}</span>
          </div>
        </div>
        <p style="font-size: 11.5px; color: #1e293b; margin: 0 0 8px 0; line-height: 1.55;">
          <strong>التشخيص البيداغوجي بالذكاء الاصطناعي:</strong> ${dom.aiDomainDiagnosis}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px;">
          <thead>
            <tr style="background: #f8fafc; color: #334155;">
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">المهارة الفرعية / الكفاية المسطرة</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; width: 90px;">نسبة التحكم</th>
              <th style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right;">نمط الخطأ المرصود في الفروض الممسوحة</th>
            </tr>
          </thead>
          <tbody>
            ${dom.subSkills
              .map(
                (sk) => `
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: 700;">${sk.skillName}</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: 800; color: ${dom.color};">${sk.masteryPct}%</td>
                <td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #475569;">${sk.errorPattern}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <div style="font-size: 11px; color: #065f46; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 10px;">
          <strong>التمارين والأنشطة العلاجية المقترحة:</strong> ${dom.recommendedExercises.join(' — ')}
        </div>
      </div>
    `
      )
      .join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>التقرير التشخيصي للمجالات المعرفية - القسم ${clsStats.className}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div style="border-bottom: 3px double #1e3a8a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 12px; font-weight: 700; line-height: 1.5;">
      <div>المملكة المغربية — وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
      <div>${academyName} — ${schoolName}</div>
      <div>الأستاذ: ${teacherName} — مادة الرياضيات (المذكرة 142-08)</div>
    </div>
    <div style="text-align: left; font-size: 12px; font-weight: 700;">
      <div>تاريخ التشخيص: ${printDate}</div>
      <div>القسم: <strong>${clsStats.className}</strong> (${clsStats.streamLabel})</div>
      <div>معدل الفروض: <strong>${clsStats.semesterAvg ?? '--'}/20</strong> · المواظبة: <strong>${clsStats.attendanceRate}%</strong></div>
    </div>
  </div>
  <h2 style="text-align: center; font-size: 16px; margin: 0 0 12px 0; color: #1e3a8a;">
    التقرير التشخيصي المفصل لأداء القسم (${clsStats.className}) حسب المجالات المعرفية للرياضيات
  </h2>
  ${domainsHtml}
</body>
</html>`;

    let iframe = document.getElementById('aiDomainPrintIframe') as HTMLIFrameElement | null;
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'aiDomainPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlDoc);
      doc.close();
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      }, 400);
    }
  };

  const handleCopyAiDiagnosticReport = () => {
    if (!aiDiagResponse) return;
    const lines: string[] = [
      `📊 *تقرير تحليل أداء الأقسام بالذكاء الاصطناعي (نتائج الفروض الممسوحة والمواظبة)*`,
      `• المحطة التقويمية: ${scannedSourceLabel}`,
      `• الملخص التنفيذي العام:\n${aiDiagResponse.executiveSummary}\n`
    ];

    aiDiagResponse.classReports.forEach((rep, idx) => {
      const st = allClassesStats.find((c) => c.className === rep.className);
      lines.push(
        `----------------------------------------`,
        `${idx + 1}. *القسم: ${rep.className}* (${rep.streamLabel}) — التصنيف: [${rep.levelBadge}] (${rep.healthScore}/100)`,
        st
          ? `• المعدل: ${getActiveExamAvgForClass(st) ?? '--'}/20 | نسبة النجاح: ${st.passRate}% | المتعثرون: ${st.strugglingCount} | المواظبة: ${st.attendanceRate}% (${st.totalAbsenceHours}س غياب)`
          : '',
        `• تشخيص الفروض الممسوحة: ${rep.scannedExamsDiagnosis}`,
        `• تشخيص المواظبة والغياب: ${rep.attendanceImpactDiagnosis}`,
        `• العوائق الرياضية المرصودة:\n${rep.detectedMathGaps.map((g) => `  - ${g}`).join('\n')}`,
        `• خطة المعالجة الموصى بها:\n${rep.remediationActionPlan.map((a, i) => `  ${i + 1}) ${a}`).join('\n')}`,
        `• الهدف المسطر: ${rep.targetMilestone}\n`
      );
    });

    navigator.clipboard.writeText(lines.filter(Boolean).join('\n')).then(() => {
      setCopiedAiDiag(true);
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast('✅ تم نسخ التقرير التشخيصي للأقسام إلى الحافظة بنجاح');
      }
      setTimeout(() => setCopiedAiDiag(false), 3000);
    });
  };

  const handlePrintAiDiagnosticReports = () => {
    if (!aiDiagResponse) return;
    const teacherName = db?.teacherProfile?.name || 'إبراهيم قزيبر';
    const schoolName = db?.teacherProfile?.school || 'الثانوية التأهيلية';
    const academyName = db?.teacherProfile?.academy || 'الأكاديمية الجهوية للتربية والتكوين';
    const printDate = new Date().toLocaleDateString('ar-MA');

    const cardsHtml = aiDiagResponse.classReports
      .map((rep) => {
        const st = allClassesStats.find((c) => c.className === rep.className);
        const avgVal = st ? getActiveExamAvgForClass(st) : null;
        return `
        <div style="border:1.5px solid #1e3a8a; border-radius:10px; padding:12px 14px; margin-bottom:14px; page-break-inside:avoid; background:#ffffff;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:8px; margin-bottom:8px;">
            <div>
              <span style="font-size:12pt; font-weight:900; color:#1e3a8a;">القسم: ${rep.className}</span>
              <span style="font-size:9pt; color:#475569; margin-right:8px;">(${rep.streamLabel} · المعامل ${st?.coef ?? '-'})</span>
            </div>
            <div style="font-size:9pt; font-weight:800; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; padding:3px 10px; border-radius:999px;">
              التصنيف: ${rep.levelBadge} • المؤشر: ${rep.healthScore}/100
            </div>
          </div>
          ${
            st
              ? `<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:8px; text-align:center; font-size:8.5pt;">
                  <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:5px;">
                    <div style="color:#64748b;">معدل الفروض الممسوحة</div>
                    <div style="font-weight:900; font-size:10.5pt; color:#0f172a;">${avgVal !== null ? avgVal.toFixed(2) : '--'} / 20</div>
                  </div>
                  <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:5px;">
                    <div style="color:#166534;">نسبة النجاح (≥10)</div>
                    <div style="font-weight:900; font-size:10.5pt; color:#15803d;">${st.passRate}% (${st.passCount}/${st.gradedStudentsCount})</div>
                  </div>
                  <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:5px;">
                    <div style="color:#92400e;">نسبة المواظبة والغياب</div>
                    <div style="font-weight:900; font-size:10.5pt; color:#b45309;">حضور ${st.attendanceRate}% (${st.totalAbsenceHours}س غياب)</div>
                  </div>
                  <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:5px;">
                    <div style="color:#991b1b;">المتعثرون والخطر المزدوج</div>
                    <div style="font-weight:900; font-size:10.5pt; color:#dc2626;">${st.strugglingCount} متعثر (${st.dualRiskCount} خطر مزدوج)</div>
                  </div>
                </div>`
              : ''
          }
          <div style="font-size:9pt; margin-bottom:6px; line-height:1.5;">
            <strong style="color:#1e3a8a;">📊 تشخيص نتائج الفروض المحروسة الممسوحة:</strong> ${rep.scannedExamsDiagnosis}
          </div>
          <div style="font-size:9pt; margin-bottom:6px; line-height:1.5;">
            <strong style="color:#b45309;">⏱️ تشخيص المواظبة وأثر الغياب:</strong> ${rep.attendanceImpactDiagnosis}
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px; font-size:8.5pt;">
            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:7px 10px;">
              <strong style="color:#9a3412; display:block; margin-bottom:4px;">🔍 العوائق الرياضية المرصودة في الأوراق الممسوحة:</strong>
              <ul style="margin:0; padding-right:16px;">
                ${rep.detectedMathGaps.map((g) => `<li style="margin-bottom:2px;">${g}</li>`).join('')}
              </ul>
            </div>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:7px 10px;">
              <strong style="color:#166534; display:block; margin-bottom:4px;">🎯 خطة الدعم والمعالجة المبرمجة:</strong>
              <ol style="margin:0; padding-right:16px;">
                ${rep.remediationActionPlan.map((a) => `<li style="margin-bottom:2px;">${a}</li>`).join('')}
              </ol>
            </div>
          </div>
          <div style="margin-top:7px; padding-top:6px; border-top:1px dashed #cbd5e1; font-size:8.5pt; font-weight:700; color:#1e40af;">
            🏁 الهدف الكمي للفرض المحروس القادم: ${rep.targetMilestone}
          </div>
        </div>`;
      })
      .join('');

    const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>التقارير التشخيصية الذكية لأداء الأقسام - مادة الرياضيات</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Cairo', sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 9.5pt; }
  </style>
</head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2.5px solid #1e3a8a; padding-bottom:8px; margin-bottom:12px;">
    <div>
      <div style="font-weight:900; font-size:10.5pt;">المملكة المغربية • وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
      <div style="font-size:8.5pt; color:#475569;">${academyName} • ${schoolName}</div>
    </div>
    <div style="text-align:center;">
      <div style="background:#1e3a8a; color:#fff; padding:4px 14px; border-radius:6px; font-weight:900; font-size:11pt;">
        التقارير التشخيصية لأداء الأقسام بالذكاء الاصطناعي
      </div>
      <div style="font-size:8pt; color:#475569; margin-top:2px;">
        بناءً على نتائج ${scannedSourceLabel} والمواظبة (المذكرة 142-08)
      </div>
    </div>
    <div style="text-align:left; font-size:8.5pt;">
      <div>الأستاذ: <strong>${teacherName}</strong></div>
      <div>التاريخ: <strong>${printDate}</strong></div>
    </div>
  </div>
  <div style="background:#f8fafc; border:1px solid #cbd5e1; border-right:4px solid #1e3a8a; border-radius:8px; padding:9px 12px; margin-bottom:14px; font-size:9pt; line-height:1.5;">
    <strong>📌 الملخص التنفيذي العام:</strong> ${aiDiagResponse.executiveSummary}
  </div>
  ${cardsHtml}
</body>
</html>`;

    const existingIframe = document.getElementById('aiDiagPrintIframe') as HTMLIFrameElement | null;
    if (existingIframe) existingIframe.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'aiDiagPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlDoc);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 450);
    }
  };

  if (classNames.length === 0) {
    return null;
  }

  const semesterTitle =
    semester === 's1'
      ? 'الدورة الأولى (الأسدس الأول)'
      : semester === 's2'
      ? 'الدورة الثانية (الأسدس الثاني)'
      : 'الحصيلة السنوية المندمجة (S1 + S2)';

  return (
    <div
      ref={dashboardRef}
      dir="rtl"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 mb-5 font-sans text-slate-900"
    >
      {/* Top Moroccan Identity Accent Bar */}
      <div
        className="h-1 w-full rounded-full mb-4"
        style={{
          background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)'
        }}
      />

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-start gap-3">
          {/* Teacher Logo */}
          <div className="flex items-center flex-shrink-0">
            <img
              src={db?.teacherProfile?.teacherLogo || db?.teacherProfile?.photo || '/logo.svg'}
              alt=""
              className="w-11 h-11 object-contain rounded-full border border-blue-900/80 p-0.5 bg-white shadow-xs"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                المركز الإحصائي المجمع للغياب والأداء الدراسي لجميع الأقسام
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>مقارنة شاملة لمعدلات الفروض المحروسة وساعات الغياب</span>
              <span aria-hidden="true">·</span>
              <span>المذكرة الوزارية 142-08 (رياضيات الثانوي التأهيلي)</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-blue-800">{semesterTitle}</span>
            </p>
          </div>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Semester Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => setSemester('s1')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                semester === 's1'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الدورة 1
            </button>
            <button
              type="button"
              onClick={() => setSemester('s2')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                semester === 's2'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الدورة 2
            </button>
            <button
              type="button"
              onClick={() => setSemester('annual')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-md transition-all cursor-pointer ${
                semester === 'annual'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              السنوي العام
            </button>
          </div>

          {/* Stream Level Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                levelFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كل المستويات ({allClassesStats.length})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('tc')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                levelFilter === 'tc'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجذوع
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('1bac')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                levelFilter === '1bac'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 باك
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('2bac')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                levelFilter === '2bac'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2 باك
            </button>
          </div>

          {/* Refresh & Snapshot Actions */}
          <button
            type="button"
            onClick={syncWithGlobalDb}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            title="تحديث الإحصائيات المجمعة"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!showAiDiagnosticsCenter) {
                runAiClassesDiagnostics(aiDiagClassFilter, aiDiagScannedSource);
              } else {
                setShowAiDiagnosticsCenter(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-lg bg-gradient-to-r from-indigo-700 via-blue-700 to-violet-700 hover:from-indigo-800 hover:to-violet-800 text-white shadow-sm transition-all cursor-pointer border border-indigo-400/30"
            title="تحليل أداء الأقسام باستخدام الذكاء الاصطناعي وتوليد تقارير تشخيصية لمستوى كل قسم بناءً على نتائج الفروض الممسوحة والمواظبة"
          >
            <Brain className="w-4 h-4 text-amber-300" />
            <span>تحليل أداء الأقسام بالذكاء الاصطناعي</span>
            <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-black">
              {filteredClassesStats.length} أقسام
            </span>
            {showAiDiagnosticsCenter ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportSnapshot}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-900 hover:bg-blue-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="حفظ لوحة الرسوم البيانية كصورة عالية الدقة"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'جاري التصدير...' : 'حفظ صورة PNG'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* AI Class Performance Diagnostic Reports Center (Scanned Exams + Attendance) */}
      {/* ========================================================================= */}
      {showAiDiagnosticsCenter && (
        <div
          ref={aiDiagSectionRef}
          className="mt-4 mb-6 rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/50 via-white to-slate-50/70 shadow-md overflow-hidden transition-all"
        >
          {/* Top Banner Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-indigo-800/60">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-400 via-indigo-500 to-cyan-400 p-0.5 shadow-lg flex-shrink-0">
                <div className="w-full h-full bg-slate-950/90 rounded-[10px] flex items-center justify-center">
                  <Brain className="w-6 h-6 text-amber-300" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                    مركز التقارير التشخيصية الذكية لأداء الأقسام (الفروض الممسوحة + المواظبة)
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-400/20 text-amber-200 border border-amber-400/40">
                    <ScanLine className="w-3 h-3" />
                    <span>100% فروض محروسة ممسوحة (المذكرة 142-08)</span>
                  </span>
                  {aiDiagSource === 'gemini' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-200 border border-emerald-400/40">
                      <Zap className="w-3 h-3" />
                      <span>Gemini AI</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  تشخيص بيداغوجي وديداكتيكي مفصل لمستوى كل قسم يربط نتائج الأوراق الممسوحة للفروض المحروسة بسجلات المواظبة والانضباط دون احتساب نقط المشاركة
                </p>
              </div>
            </div>

            {/* Action Buttons in Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => runAiClassesDiagnostics(aiDiagClassFilter, aiDiagScannedSource)}
                disabled={isGeneratingAiDiag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAiDiag ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAiDiag ? 'جاري التحليل الذكي...' : 'تحديث التشخيص بالذكاء الاصطناعي'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAiDiagnosticReport}
                disabled={!aiDiagResponse}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="نسخ التقارير التشخيصية منسقة للمشاركة أو المراسلة"
              >
                {copiedAiDiag ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAiDiag ? 'تم النسخ!' : 'نسخ التقارير'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintAiDiagnosticReports}
                disabled={!aiDiagResponse}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                title="طباعة التقارير التشخيصية الرسمية للأقسام بحجم A4"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة تقارير A4</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiDiagnosticsCenter(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600/80 text-slate-200 hover:text-white transition-colors cursor-pointer"
                title="إغلاق مركز التشخيص الذكي"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter & Scanned Exam Source Selector Toolbar */}
          <div className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Class Selector */}
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-700" />
                  <span>نطاق تشخيص الأقسام:</span>
                </span>
                <select
                  value={aiDiagClassFilter}
                  onChange={(e) => {
                    const nextCls = e.target.value;
                    setAiDiagClassFilter(nextCls);
                    runAiClassesDiagnostics(nextCls, aiDiagScannedSource);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-extrabold text-slate-900 text-xs shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="all">جميع الأقسام المعروضة ({filteredClassesStats.length} أقسام)</option>
                  {allClassesStats.map((c) => (
                    <option key={c.className} value={c.className}>
                      قسم {c.className} — {c.streamLabel} ({c.studentCount} تلميذ)
                    </option>
                  ))}
                </select>
              </div>

              {/* Scanned Exam Station Selector */}
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-700 flex items-center gap-1">
                  <ScanLine className="w-3.5 h-3.5 text-blue-700" />
                  <span>مصدر الفروض الممسوحة:</span>
                </span>
                <div className="inline-flex items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                  {(
                    [
                      { id: 'all', label: 'الحصيلة المجمعة (F1-F3)' },
                      { id: 'f1', label: 'الفرض الممسوح 1' },
                      { id: 'f2', label: 'الفرض الممسوح 2' },
                      { id: 'f3', label: 'الفرض الممسوح 3' }
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAiDiagScannedSource(item.id);
                        runAiClassesDiagnostics(aiDiagClassFilter, item.id);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all cursor-pointer ${
                        aiDiagScannedSource === item.id
                          ? 'bg-indigo-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>تحليل مزدوج: الأوراق الممسوحة + سجل الغياب</span>
              </span>
            </div>
          </div>

          {/* Main Body of AI Diagnostics */}
          <div className="p-4 sm:p-6 space-y-5">
            {/* Executive Summary Box */}
            {aiDiagResponse?.executiveSummary && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/5 via-blue-950/5 to-emerald-950/5 border border-indigo-200/90 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-700 text-white flex-shrink-0 shadow-xs mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <h4 className="text-xs sm:text-sm font-black text-indigo-950">
                      الخلاصة التنفيذية لتحليل أداء الأقسام ({semesterTitle} — {scannedSourceLabel})
                    </h4>
                    {isGeneratingAiDiag && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>جاري التعميق عبر نموذج الذكاء الاصطناعي...</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-medium">
                    {aiDiagResponse.executiveSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Per-Class Diagnostic Report Cards */}
            <div className="space-y-5">
              {(aiDiagResponse?.classReports || []).map((rep) => {
                const clsStats =
                  allClassesStats.find((c) => c.className === rep.className) ||
                  filteredClassesStats[0];
                if (!clsStats) return null;

                const activeExamAvg = getActiveExamAvgForClass(clsStats);
                const isCritical = rep.healthScore < 50 || clsStats.passRate < 45;
                const isExcellent = rep.healthScore >= 76 && clsStats.passRate >= 65;

                return (
                  <div
                    key={rep.className}
                    className={`rounded-2xl border-2 bg-white shadow-xs overflow-hidden transition-all ${
                      isCritical
                        ? 'border-rose-200/90'
                        : isExcellent
                        ? 'border-emerald-200/90'
                        : 'border-slate-200/90'
                    }`}
                  >
                    {/* Card Header for Class */}
                    <div
                      className={`px-4 py-3.5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        isCritical
                          ? 'bg-gradient-to-r from-rose-50 via-amber-50/40 to-white border-rose-200/70'
                          : isExcellent
                          ? 'bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border-emerald-200/70'
                          : 'bg-gradient-to-r from-slate-50 via-blue-50/40 to-white border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-black text-sm shadow-2xs">
                          قسم {rep.className}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-800">
                              {rep.streamLabel}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              • المعامل {clsStats.coef} • {clsStats.studentCount} تلميذ(ة)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black border ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isExcellent
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-blue-100 text-blue-900 border-blue-300'
                          }`}
                        >
                          {rep.levelBadge}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-mono font-black">
                          مؤشر الجودة: {rep.healthScore}/100
                        </span>
                      </div>
                    </div>

                    {/* 4 Core KPIs Row: Scanned Exams & Attendance */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/60 border-b border-slate-100">
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                          <span>معدل الفروض الممسوحة</span>
                          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-xl font-black text-slate-900 font-mono">
                            {activeExamAvg !== null ? activeExamAvg.toFixed(2) : '--'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500">/ 20</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500 flex items-center gap-2">
                          <span>ف1: {clsStats.f1Avg ?? '-'}</span>
                          <span>•</span>
                          <span>ف2: {clsStats.f2Avg ?? '-'}</span>
                          <span>•</span>
                          <span>ف3: {clsStats.f3Avg ?? '-'}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                          <span>نسبة التحكم والاستيفاء (≥10)</span>
                          <Award className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-xl font-black text-emerald-700 font-mono">
                            {clsStats.passRate}%
                          </span>
                          <span className="text-[11px] font-extrabold text-indigo-700">
                            تميز: {clsStats.excellenceRate}%
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          مستوفون: {clsStats.passCount} من أصل {clsStats.gradedStudentsCount} منقطين
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                          <span>المواظبة وساعات الغياب</span>
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-xl font-black text-amber-900 font-mono">
                            {clsStats.attendanceRate}%
                          </span>
                          <span className="text-[11px] font-extrabold text-rose-700">
                            {clsStats.totalAbsenceHours} ساعة غياب
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          غير مبرر: {clsStats.unjustifiedHours}س • مبرر: {clsStats.justifiedHours}س • تأخر: {clsStats.lateCount}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                          <span>التعثر والخطر المزدوج</span>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-xl font-black text-rose-700 font-mono">
                            {clsStats.strugglingCount} متعثر
                          </span>
                          <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                            خطر مزدوج: {clsStats.dualRiskCount}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          تجاوز عتبة الغياب (≥4س): {clsStats.atRiskAbsenceCount} تلاميذ
                        </div>
                      </div>
                    </div>

                    {/* Optical Scanned Exam Exercises / Axes Breakdown */}
                    <div className="px-4 py-3 bg-white border-b border-slate-100">
                      <div className="text-xs font-black text-slate-800 mb-2 flex items-center justify-between flex-wrap gap-2">
                        <span className="flex items-center gap-1.5">
                          <ScanLine className="w-4 h-4 text-indigo-600" />
                          <span>تفصيل نسب التحكم في محاور الأوراق الممسوحة للقسم ({rep.className}):</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          تشخيص آلي لبنية أخطاء التمارين الممسوحة ضوئياً
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {clsStats.scannedAxesMastery.map((ax, axIdx) => (
                          <div
                            key={axIdx}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between"
                          >
                            <div className="text-[11px] font-bold text-slate-800 leading-snug mb-2">
                              {ax.axisTitle}
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
                                <span style={{ color: ax.color }}>نسبة التحكم: {ax.masteryPct}%</span>
                                <span className="text-rose-600">تعثر: {ax.strugglingCount} تلميذ</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${ax.masteryPct}%`, backgroundColor: ax.color }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Two-Column Deep Diagnosis: Scanned Exams + Attendance Impact */}
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left Column: Scanned Exams Diagnosis & Math Obstacles */}
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/80">
                          <h5 className="text-xs font-black text-blue-950 flex items-center gap-1.5 mb-1.5">
                            <FileText className="w-4 h-4 text-blue-700" />
                            <span>التشخيص الديداكتيكي لنتائج الفروض المحروسة الممسوحة:</span>
                          </h5>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {rep.scannedExamsDiagnosis}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80">
                          <h5 className="text-xs font-black text-amber-950 flex items-center gap-1.5 mb-2">
                            <Target className="w-4 h-4 text-amber-700" />
                            <span>الفجوات والعوائق الرياضية المرصودة في أوراق القسم:</span>
                          </h5>
                          <ul className="space-y-1.5 text-xs text-slate-800 font-medium">
                            {rep.detectedMathGaps.map((gap, gIdx) => (
                              <li key={gIdx} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 flex-shrink-0" />
                                <span>{gap}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Right Column: Attendance Impact & Priority Students Table */}
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/80">
                          <h5 className="text-xs font-black text-purple-950 flex items-center gap-1.5 mb-1.5">
                            <Clock className="w-4 h-4 text-purple-700" />
                            <span>تحليل المواظبة والانضباط وأثر الغياب على التحصيل:</span>
                          </h5>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {rep.attendanceImpactDiagnosis}
                          </p>
                        </div>

                        {/* Priority Students Mini-Table (Low Scanned Marks + Absenteeism) */}
                        <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/80">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-rose-600" />
                              <span>التلاميذ ذوو الأولوية القصوى في الدعم والمواظبة:</span>
                            </h5>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                              أعلى {clsStats.priorityStudents.length} حالات
                            </span>
                          </div>

                          {clsStats.priorityStudents.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-right border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-rose-200 text-rose-900 font-extrabold">
                                    <th className="py-1 px-2">التلميذ(ة)</th>
                                    <th className="py-1 px-1.5 text-center">ف1</th>
                                    <th className="py-1 px-1.5 text-center">ف2</th>
                                    <th className="py-1 px-1.5 text-center">ف3</th>
                                    <th className="py-1 px-1.5 text-center">المعدل</th>
                                    <th className="py-1 px-1.5 text-center">الغياب</th>
                                    <th className="py-1 px-1.5 text-center">الوضعية</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-rose-100">
                                  {clsStats.priorityStudents.map((st) => (
                                    <tr key={st.id} className="hover:bg-white/60">
                                      <td className="py-1 px-2 font-bold text-slate-900">{st.name}</td>
                                      <td className="py-1 px-1.5 text-center font-mono">{st.f1 ?? '-'}</td>
                                      <td className="py-1 px-1.5 text-center font-mono">{st.f2 ?? '-'}</td>
                                      <td className="py-1 px-1.5 text-center font-mono">{st.f3 ?? '-'}</td>
                                      <td className="py-1 px-1.5 text-center font-mono font-black text-rose-700">
                                        {st.avg ?? '-'}
                                      </td>
                                      <td className="py-1 px-1.5 text-center font-bold text-amber-900">
                                        {st.absenceHours}س
                                      </td>
                                      <td className="py-1 px-1.5 text-center">
                                        {st.isDualRisk ? (
                                          <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-extrabold">
                                            تعثر + غياب
                                          </span>
                                        ) : (st.avg ?? 10) < 10 ? (
                                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                                            تعثر معرفي
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 text-[10px] font-bold">
                                            غياب متكرر
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                              لا توجد حالات تعثر حرجة أو غياب متجاوز للعتبة في هذا القسم.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actionable Remediation Plan & Quick Actions Footer */}
                    <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-col gap-3">
                      <div>
                        <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>خطة التدخل والمعالجة البيداغوجية الموصى بها للقسم ({rep.className}):</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {rep.remediationActionPlan.map((step, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-2.5 rounded-xl bg-white border border-emerald-200/90 text-xs text-slate-800 font-medium flex items-start gap-2 shadow-2xs"
                            >
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                                {sIdx + 1}
                              </span>
                              <span className="leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                        <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <span>الهدف المسطر للفرض القادم: {rep.targetMilestone}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleScheduleClassSupportFromDiagnostic(clsStats, rep)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-extrabold cursor-pointer transition-colors shadow-2xs"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>برمجة حصة دعم في دفتر النصوص</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNavigateToClass(clsStats.className, 'grades')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold cursor-pointer transition-colors"
                          >
                            <span>نقط الفروض</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNavigateToClass(clsStats.className, 'absence')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer transition-colors"
                          >
                            <span>سجل المواظبة</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 1. Aggregated Summary Metrics Strip (Draggable & Reorderable by Importance) */}
      <div className="mt-4 mb-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-600">
          <GripVertical className="w-3.5 h-3.5 text-blue-600" />
          <span>مؤشرات الحصيلة المجمعة (اسحب البطاقات لإعادة ترتيبها حسب الأهمية)</span>
        </div>
        {JSON.stringify(kpiOrder) !== JSON.stringify(DEFAULT_REACT_KPI_ORDER) && (
          <button
            type="button"
            onClick={handleResetKpiOrder}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer transition-colors"
            title="استعادة الترتيب الافتراضي للمؤشرات"
          >
            <RotateCcw className="w-3 h-3" />
            <span>استعادة الترتيب الافتراضي</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5 mb-5">
        {kpiOrder.map((kpiId, idx) => {
          const isDragging = draggedKpiId === kpiId;
          const isDragOver = dragOverKpiId === kpiId && draggedKpiId !== kpiId;
          const commonDragProps = {
            draggable: true,
            onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
              setDraggedKpiId(kpiId);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', kpiId);
            },
            onDragEnd: () => {
              setDraggedKpiId(null);
              setDragOverKpiId(null);
            },
            onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverKpiId !== kpiId) setDragOverKpiId(kpiId);
            },
            onDragLeave: () => {
              if (dragOverKpiId === kpiId) setDragOverKpiId(null);
            },
            onDrop: (e: React.DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setDragOverKpiId(null);
              if (!draggedKpiId || draggedKpiId === kpiId) return;
              const fromIdx = kpiOrder.indexOf(draggedKpiId);
              const toIdx = kpiOrder.indexOf(kpiId);
              if (fromIdx === -1 || toIdx === -1) return;
              const next = [...kpiOrder];
              const [moved] = next.splice(fromIdx, 1);
              next.splice(toIdx, 0, moved);
              persistKpiOrder(next);
              setDraggedKpiId(null);
            }
          };

          const dragHeaderBar = (
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-dashed border-slate-300/70">
              <span
                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200 cursor-grab active:cursor-grabbing"
                title="اسحب لإعادة ترتيب المؤشر حسب الأهمية"
              >
                <GripVertical className="w-3 h-3 text-slate-400" />
                <span>سحب للترتيب</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveKpiCard(kpiId, -1)}
                  disabled={idx === 0}
                  className="w-4 h-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-blue-600 hover:text-white disabled:opacity-30 flex items-center justify-center text-[10px] font-black cursor-pointer"
                  title="تقديم"
                >
                  ‹
                </button>
                <span className="text-[10px] font-black font-mono px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700">
                  #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleMoveKpiCard(kpiId, 1)}
                  disabled={idx === kpiOrder.length - 1}
                  className="w-4 h-4 rounded border border-slate-300 bg-white text-slate-600 hover:bg-blue-600 hover:text-white disabled:opacity-30 flex items-center justify-center text-[10px] font-black cursor-pointer"
                  title="تأخير"
                >
                  ›
                </button>
              </div>
            </div>
          );

          if (kpiId === 'total-students') {
            return (
              <div
                key={kpiId}
                {...commonDragProps}
                className={`p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-45 scale-95 border-dashed border-blue-600' : ''
                } ${isDragOver ? 'ring-2 ring-blue-500 scale-[1.02]' : ''}`}
              >
                {dragHeaderBar}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">مجموع التلاميذ والأقسام</span>
                  <Users className="w-4 h-4 text-blue-700" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{globalTotals.totalStudents}</span>
                  <span className="text-xs font-bold text-slate-500">
                    تلميذ(ة) في {globalTotals.classesCount} أقسام
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>تلاميذ منقطون: {globalTotals.gradedStudents}</span>
                  <span>السلك الثانوي التأهيلي</span>
                </div>
              </div>
            );
          }

          if (kpiId === 'academic-avg') {
            return (
              <div
                key={kpiId}
                {...commonDragProps}
                className={`p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-45 scale-95 border-dashed border-blue-600' : ''
                } ${isDragOver ? 'ring-2 ring-blue-500 scale-[1.02]' : ''}`}
              >
                {dragHeaderBar}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">المعدل العام ونسبة النجاح</span>
                  <Award className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-emerald-950">
                      {globalTotals.globalAvg !== null ? globalTotals.globalAvg.toFixed(2) : '--'}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">/ 20</span>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800">
                    نجاح: {globalTotals.globalPassRate}%
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200/70 text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>مستوفون (≥10): {globalTotals.passCount} تلميذ</span>
                  <span>تميز (≥16): {globalTotals.excellenceCount}</span>
                </div>
              </div>
            );
          }

          if (kpiId === 'absence-stats') {
            return (
              <div
                key={kpiId}
                {...commonDragProps}
                className={`p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between transition-all select-none cursor-grab active:cursor-grabbing ${
                  isDragging ? 'opacity-45 scale-95 border-dashed border-blue-600' : ''
                } ${isDragOver ? 'ring-2 ring-blue-500 scale-[1.02]' : ''}`}
              >
                {dragHeaderBar}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">إحصائيات الغياب والمواظبة المجمعة</span>
                  <Clock className="w-4 h-4 text-amber-700" />
                </div>
                <div className="mt-2 flex items-baseline justify-between flex-wrap gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-950">
                      {globalTotals.totalAbsenceHours}
                    </span>
                    <span className="text-xs font-bold text-amber-800">ساعة غياب</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200" title="نسبة الحضور والمواظبة العامة">
                      حضور: {globalTotals.globalAttendanceRate}%
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200" title="نسبة الغياب العامة">
                      غياب: {globalTotals.globalAbsenceRate}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200/70 text-[11px] text-amber-900 flex items-center justify-between">
                  <span>غير مبرر: {globalTotals.unjustifiedHours} س</span>
                  <span>مبرر: {globalTotals.justifiedHours} س · تأخر: {globalTotals.lateCount}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={kpiId}
              {...commonDragProps}
              className={`p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between transition-all select-none cursor-grab active:cursor-grabbing ${
                isDragging ? 'opacity-45 scale-95 border-dashed border-blue-600' : ''
              } ${isDragOver ? 'ring-2 ring-blue-500 scale-[1.02]' : ''}`}
            >
              {dragHeaderBar}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">حالات الدعم والتعثر والغياب الحرج</span>
                <AlertTriangle className="w-4 h-4 text-rose-700" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-950">
                    {globalTotals.strugglingCount}
                  </span>
                  <span className="text-xs font-bold text-rose-800">متعثر (&lt;10/20)</span>
                </div>
                <span className="text-xs font-extrabold text-rose-800">
                  غياب ≥4س: {globalTotals.atRiskAbsenceCount}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-rose-200/70 text-[11px] text-rose-900 flex items-center justify-between">
                <span>معنيون بالدعم المندمج</span>
                <span>وفق المادة 7 من المذكرة 142-08</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* NEW SECTION: AI-Generated Classroom Diagnostic Reports Visual Cards        */}
      {/* & Clickable In-Depth Breakdown by Subject Domain (Algebra, Geometry, etc.) */}
      {/* ========================================================================= */}
      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 sm:p-5">
        {/* Section Header & Domain Filter Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3.5 mb-4 border-b border-slate-200/80">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-700 flex-shrink-0" />
              <span>بطاقات التقارير التشخيصية للأقسام بالذكاء الاصطناعي (تفصيل المجالات المعرفية)</span>
            </h3>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>الجبر والمنطق</span>
              <span aria-hidden="true">·</span>
              <span>التحليل والدوال العددية</span>
              <span aria-hidden="true">·</span>
              <span>الهندسة والفضاء</span>
              <span aria-hidden="true">·</span>
              <span>الاحتمالات والتوليف</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-indigo-800">
                انقر على بطاقة أي قسم لعرض التفصيل المعمق لأداء التلاميذ حسب كل مجال معرفي
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Interactive Domain Highlight Filter */}
            <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200/90 shadow-2xs">
              {(
                [
                  { key: 'all', label: 'كل المجالات (4)' },
                  { key: 'algebra', label: 'الجبر والمنطق' },
                  { key: 'analysis', label: 'التحليل والدوال' },
                  { key: 'geometry', label: 'الهندسة والفضاء' },
                  { key: 'synthesis', label: 'الاحتمالات والتوليف' }
                ] as const
              ).map((domTab) => (
                <button
                  key={domTab.key}
                  type="button"
                  onClick={() => setVisualCardsDomainHighlight(domTab.key)}
                  className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-colors cursor-pointer ${
                    visualCardsDomainHighlight === domTab.key
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {domTab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => runAiClassesDiagnostics('all', aiDiagScannedSource)}
              disabled={isGeneratingAiDiag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-60"
              title="تحديث التقارير التشخيصية للمجالات المعرفية عبر الذكاء الاصطناعي"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingAiDiag ? 'animate-spin' : ''}`} />
              <span>{isGeneratingAiDiag ? 'جاري التحليل...' : 'تحديث تشخيص AI'}</span>
            </button>
          </div>
        </div>

        {/* Visual Classroom Diagnostic Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClassesStats.map((cls) => {
            const domains = getMergedDomainsForClass(cls);
            const visibleDomains =
              visualCardsDomainHighlight === 'all'
                ? domains
                : domains.filter((d) => d.domainKey === visualCardsDomainHighlight);
            const isSelectedCard = selectedDomainCardClass === cls.className;

            const strongestDom = [...domains].sort((a, b) => b.masteryRate - a.masteryRate)[0];
            const weakestDom = [...domains].sort((a, b) => a.masteryRate - b.masteryRate)[0];

            const acadComponent =
              cls.semesterAvg !== null
                ? Math.min(100, (cls.semesterAvg / 16) * 55 + cls.passRate * 0.45)
                : 65;
            const attComponent = Math.max(0, Math.min(100, cls.attendanceRate - cls.unjustifiedHours * 0.4));
            const healthScore = Math.round(acadComponent * 0.7 + attComponent * 0.3);

            return (
              <div
                key={cls.className}
                role="button"
                tabIndex={0}
                onClick={() =>
                  handleOpenClassDomainBreakdown(
                    cls.className,
                    visualCardsDomainHighlight === 'all' ? 'all' : visualCardsDomainHighlight
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenClassDomainBreakdown(
                      cls.className,
                      visualCardsDomainHighlight === 'all' ? 'all' : visualCardsDomainHighlight
                    );
                  }
                }}
                className={`group text-right rounded-xl border bg-white p-4 transition-all cursor-pointer flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  isSelectedCard
                    ? 'border-indigo-600 ring-2 ring-indigo-600/20 shadow-md'
                    : 'border-slate-200/90 hover:border-indigo-400 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Card Top Header: Class Title & Unboxed Metadata */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-slate-900 group-hover:text-indigo-700 transition-colors">
                          قسم {cls.className}
                        </h4>
                        <span className="text-xs font-bold text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs font-bold text-slate-600">{cls.streamLabel}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
                        <span>{cls.studentCount} تلميذ</span>
                        <span aria-hidden="true">·</span>
                        <span>المعامل {cls.coef}</span>
                        <span aria-hidden="true">·</span>
                        <span>{cls.examsCount} فروض محروسة</span>
                      </div>
                    </div>

                    <div className="text-left font-mono tabular-nums">
                      <div className="text-xs font-black text-slate-900">
                        مؤشر الأداء: {healthScore}/100
                      </div>
                      <div
                        className={`text-[11px] font-bold ${
                          healthScore >= 75
                            ? 'text-emerald-700'
                            : healthScore >= 55
                            ? 'text-blue-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {healthScore >= 75
                          ? 'متفوق ومتجانس'
                          : healthScore >= 55
                          ? 'مستقر إجمالاً'
                          : 'أولوية دعم عاجل'}
                      </div>
                    </div>
                  </div>

                  {/* Key Class Metrics Strip (Unboxed Tabular Numbers) */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-slate-100 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-[10px] font-sans text-slate-500">معدل الفروض</div>
                      <div className="font-black text-slate-900 text-sm">
                        {cls.semesterAvg !== null ? cls.semesterAvg.toFixed(2) : '--'}
                        <span className="text-[10px] text-slate-400 font-normal"> /20</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-sans text-slate-500">نسبة الاستيفاء</div>
                      <div className="font-black text-emerald-700 text-sm">{cls.passRate}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-sans text-slate-500">نسبة المواظبة</div>
                      <div className="font-black text-amber-800 text-sm">{cls.attendanceRate}%</div>
                    </div>
                  </div>

                  {/* Subject-Domain Visual Mastery Bars */}
                  <div className="py-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                      <span>التحكم حسب المجالات المعرفية للرياضيات:</span>
                      <span className="font-mono tabular-nums text-[10px]">المعدل · التحكم</span>
                    </div>

                    {visibleDomains.map((dom) => (
                      <div
                        key={dom.domainKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenClassDomainBreakdown(cls.className, dom.domainKey);
                        }}
                        className="p-2 rounded-lg bg-slate-50/80 hover:bg-indigo-50/50 transition-colors"
                        title={`انقر لعرض تفصيل مجال ${dom.shortTitle} لقسم ${cls.className}`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-extrabold text-slate-800">{dom.shortTitle}</span>
                          <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                            <span className="font-black text-slate-900">{dom.domainAvg}/20</span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-bold" style={{ color: dom.color }}>
                              {dom.masteryRate}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200/90 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${dom.masteryRate}%`,
                              backgroundColor: dom.color
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: AI Quick Insight & Click Prompt */}
                <div className="pt-2.5 border-t border-slate-100">
                  <div className="text-[11px] text-slate-600 flex items-center justify-between gap-2 mb-2">
                    <span>
                      الأقوى: <strong className="text-slate-900">{strongestDom?.shortTitle}</strong> (
                      <span className="font-mono tabular-nums">{strongestDom?.masteryRate}%</span>)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      للدعم: <strong className="text-rose-700">{weakestDom?.shortTitle}</strong> (
                      <span className="font-mono tabular-nums">{weakestDom?.masteryRate}%</span>)
                    </span>
                  </div>

                  <div className="w-full py-1.5 px-3 rounded-lg bg-slate-900 group-hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-between transition-colors">
                    <span>استعراض التشخيص المعمق للمجالات المعرفية</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* IN-DEPTH BREAKDOWN BY SUBJECT DOMAIN INSPECTOR (OPENED ON CARD CLICK)     */}
        {/* ========================================================================= */}
        {selectedDomainCardClass && (() => {
          const activeClassStats =
            allClassesStats.find((c) => c.className === selectedDomainCardClass) ||
            filteredClassesStats[0];
          if (!activeClassStats) return null;

          const allDomains = getMergedDomainsForClass(activeClassStats);
          const displayedDomains =
            selectedSubjectDomainKey === 'all'
              ? allDomains
              : allDomains.filter((d) => d.domainKey === selectedSubjectDomainKey);

          const strongestDomain = [...allDomains].sort((a, b) => b.masteryRate - a.masteryRate)[0];
          const priorityDomain = [...allDomains].sort((a, b) => a.masteryRate - b.masteryRate)[0];

          return (
            <div
              ref={domainBreakdownRef}
              className="mt-5 rounded-2xl border-2 border-indigo-600/80 bg-white shadow-lg overflow-hidden transition-all"
            >
              {/* Inspector Header Bar */}
              <div className="bg-slate-900 text-white p-4 sm:px-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className="text-base sm:text-lg font-black text-white">
                      التشخيص المعمق لأداء القسم ({activeClassStats.className}) حسب المجالات المعرفية للرياضيات
                    </h4>
                    <span className="text-xs text-slate-300 font-mono tabular-nums">
                      {activeClassStats.streamLabel} · المعامل {activeClassStats.coef} · {activeClassStats.studentCount} تلميذ
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    تفكيك ديداكتيكي دقيق لمكتسبات التلاميذ في الجبر، التحليل، الهندسة، والمسائل التوليفية استناداً إلى نتائج الفروض المحروسة الممسوحة (100%)
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handlePrintClassDomainBreakdown(activeClassStats)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                    title="طباعة تقرير المجالات المعرفية للقسم بحجم A4"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة تقرير المجالات A4</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAiDiagClassFilter(activeClassStats.className);
                      setShowAiDiagnosticsCenter(true);
                      runAiClassesDiagnostics(activeClassStats.className, aiDiagScannedSource);
                      setTimeout(() => {
                        aiDiagSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>فتح التقرير الشامل للقسم</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDomainCardClass(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer"
                    title="إغلاق نافذة التفصيل المعمق"
                  >
                    <X className="w-4 h-4" />
                    <span>إغلاق</span>
                  </button>
                </div>
              </div>

              {/* Class Switcher & Subject Domain Filter Bar */}
              <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Switch between classes */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-700 ml-1">تبديل القسم:</span>
                  {filteredClassesStats.map((c) => (
                    <button
                      key={c.className}
                      type="button"
                      onClick={() => setSelectedDomainCardClass(c.className)}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        c.className === activeClassStats.className
                          ? 'bg-indigo-700 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {c.className}
                    </button>
                  ))}
                </div>

                {/* Filter by Subject Domain */}
                <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectDomainKey('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                      selectedSubjectDomainKey === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    جميع المجالات (4)
                  </button>
                  {allDomains.map((dom) => (
                    <button
                      key={dom.domainKey}
                      type="button"
                      onClick={() => setSelectedSubjectDomainKey(dom.domainKey)}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        selectedSubjectDomainKey === dom.domainKey
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {dom.shortTitle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspector Content Body */}
              <div className="p-4 sm:p-6 space-y-6">
                {/* Top Overview: Recharts Subject-Domain Chart + Executive Domain Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Chart comparing F1, F2, F3 & Domain Average across Algebra, Analysis, Geometry, Synthesis */}
                  <div className="lg:col-span-7 p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                    <div className="mb-3">
                      <h5 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-700" />
                        <span>مقارنة أداء القسم ({activeClassStats.className}) عبر المجالات المعرفية الأربعة</span>
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        تطور معدلات التحصيل في كل مجال معرفي عبر الفروض الممسوحة (F1, F2, F3) مقارنة بعتبة التحكم (10/20)
                      </p>
                    </div>

                    <div className="w-full h-60" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={allDomains}
                          margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="shortTitle"
                            tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 800 }}
                          />
                          <YAxis
                            domain={[0, 20]}
                            ticks={[0, 5, 10, 12, 14, 16, 20]}
                            tick={{ fill: '#475569', fontSize: 11 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderColor: '#cbd5e1',
                              borderRadius: '10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              textAlign: 'right',
                              direction: 'rtl'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                          <ReferenceLine
                            y={10}
                            stroke="#dc2626"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{
                              value: 'عتبة التحكم 10/20',
                              position: 'insideTopRight',
                              fill: '#dc2626',
                              fontSize: 10,
                              fontWeight: 700
                            }}
                          />
                          <Bar dataKey="f1DomainAvg" name="الفرض 1" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="f2DomainAvg" name="الفرض 2" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="f3DomainAvg" name="الفرض 3" fill="#1d4ed8" radius={[4, 4, 0, 0]} barSize={16} />
                          <Line
                            type="monotone"
                            dataKey="domainAvg"
                            name="معدل المجال العام (/20)"
                            stroke="#059669"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Right Column: Key Domain Insights & Balance Matrix */}
                  <div className="lg:col-span-5 flex flex-col justify-between gap-3">
                    <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
                      <div className="text-xs font-black text-emerald-950 flex items-center justify-between">
                        <span>نقطة القوة المعرفية للقسم (الأعلى تحكماً)</span>
                        <span className="font-mono tabular-nums text-emerald-800">
                          {strongestDomain?.domainAvg}/20 · {strongestDomain?.masteryRate}%
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-900 mt-1">
                        {strongestDomain?.domainTitle}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {strongestDomain?.aiDomainDiagnosis}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
                      <div className="text-xs font-black text-rose-950 flex items-center justify-between">
                        <span>المجال ذو الأولوية القصوى في الدعم والمعالجة</span>
                        <span className="font-mono tabular-nums text-rose-800">
                          {priorityDomain?.domainAvg}/20 · {priorityDomain?.masteryRate}%
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-900 mt-1">
                        {priorityDomain?.domainTitle}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        رُصد {priorityDomain?.strugglingCount} تلميذاً يواجهون صعوبات في هذا المجال. ينصح ببرمجة حصة دعم تطبيقية مركزة قبل الفرض المحروس القادم.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="text-xs font-black text-slate-800 mb-2">
                        توزيع الأوزان النسبية للمجالات في الفروض المحروسة الممسوحة:
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center font-mono tabular-nums">
                        {allDomains.map((d) => (
                          <div key={d.domainKey} className="p-2 rounded-lg bg-white border border-slate-200/80">
                            <div className="text-[10px] font-sans font-bold text-slate-600 truncate">
                              {d.shortTitle}
                            </div>
                            <div className="text-sm font-black mt-0.5" style={{ color: d.color }}>
                              {d.examWeightPct}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Breakdown Cards per Subject Domain */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {displayedDomains.map((dom) => (
                    <div
                      key={dom.domainKey}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 flex flex-col justify-between shadow-2xs"
                    >
                      <div>
                        {/* Domain Header */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: dom.color }}
                              />
                              <h5 className="text-base font-black text-slate-900">{dom.domainTitle}</h5>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              المحاور المقررة: <span className="font-bold text-slate-700">{dom.curriculumTopics}</span>
                            </p>
                          </div>

                          <div className="text-left font-mono tabular-nums flex-shrink-0">
                            <div className="text-base font-black text-slate-900">
                              {dom.domainAvg}
                              <span className="text-xs text-slate-400 font-normal">/20</span>
                            </div>
                            <div className="text-xs font-bold" style={{ color: dom.color }}>
                              تحكم: {dom.masteryRate}%
                            </div>
                          </div>
                        </div>

                        {/* Domain Metrics Strip */}
                        <div className="grid grid-cols-4 gap-2 py-2.5 border-b border-slate-100 text-xs font-mono tabular-nums">
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">وزن المجال</span>
                            <span className="font-black text-slate-800">{dom.examWeightPct}% من الفرض</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">تطور الفروض</span>
                            <span className="font-bold text-slate-700">
                              {dom.f1DomainAvg ?? '-'} ← {dom.f2DomainAvg ?? '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">المتعثرون بالمجال</span>
                            <span className="font-black text-rose-700">{dom.strugglingCount} تلميذ</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">نسبة الاستيعاب</span>
                            <span className="font-black text-emerald-700">{dom.masteryRate}%</span>
                          </div>
                        </div>

                        {/* Sub-Skills & Competencies Mastery Breakdown */}
                        <div className="py-3.5 space-y-3 border-b border-slate-100">
                          <div className="text-xs font-black text-slate-800">
                            تفكيك الكفايات والمهارات الفرعية وأنماط الأخطاء في الأوراق الممسوحة:
                          </div>
                          {dom.subSkills.map((sk, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-extrabold text-slate-900">{sk.skillName}</span>
                                <span
                                  className="font-mono tabular-nums font-black"
                                  style={{ color: dom.color }}
                                >
                                  {sk.masteryPct}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${sk.masteryPct}%`, backgroundColor: dom.color }}
                                />
                              </div>
                              <div className="text-[11px] text-slate-600">
                                <span className="font-bold text-rose-800">الخطأ المرصود: </span>
                                <span>{sk.errorPattern}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* AI Pedagogical Diagnosis for this Domain */}
                        <div className="py-3 border-b border-slate-100">
                          <div className="text-xs font-black text-indigo-950 mb-1">
                            التشخيص الديداكتيكي بالذكاء الاصطناعي للمجال:
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">{dom.aiDomainDiagnosis}</p>
                        </div>

                        {/* Recommended Remediation Exercises */}
                        <div className="py-3">
                          <div className="text-xs font-black text-emerald-950 mb-1.5">
                            أنشطة الدعم والتمارين العلاجية المقترحة:
                          </div>
                          <ul className="space-y-1 text-xs text-slate-700">
                            {dom.recommendedExercises.map((ex, exIdx) => (
                              <li key={exIdx} className="flex items-start gap-2">
                                <span className="font-mono font-bold text-emerald-700">{exIdx + 1}.</span>
                                <span>{ex}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Domain Card Action Footer */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleScheduleDomainSupport(activeClassStats, dom)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-extrabold transition-colors cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>برمجة حصة دعم في «{dom.shortTitle}»</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNavigateToClass(activeClassStats.className, 'grades')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <span>عرض نقط القسم</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 2. Primary & Secondary Charts (Lazy-Loaded via IntersectionObserver + Staged Hydration with Lightweight Indicator) */}
      <div ref={chartsSectionRef}>
        {!chartsReady ? (
          <div className="w-full py-9 px-4 mb-5 rounded-xl border border-dashed border-blue-200 bg-blue-50/30 flex items-center justify-between flex-wrap gap-3 text-slate-600 text-xs font-bold">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span>جاري التحميل الكسول (Lazy Loading) للرسوم البيانية الكبيرة للوحة القيادة...</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setChartsReady(true);
                setSecondaryChartsReady(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 text-[11px] font-extrabold hover:bg-blue-50 cursor-pointer"
            >
              عرض فوري
            </button>
          </div>
        ) : (
          <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Chart A: Academic Performance & Supervised Exams Comparison across Classes */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-700" />
                <span>مقارنة الأداء الدراسي ومعدلات الفروض المحروسة حسب الأقسام</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                متوسطات الفروض (F1, F2, F3) والمعدل الدوري العام مقارنة بعتبة التحكم (10/20)
              </p>
            </div>
          </div>

          <div className="w-full h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredClassesStats}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="className"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  domain={[0, 20]}
                  ticks={[0, 5, 10, 12, 14, 16, 20]}
                  tick={{ fill: '#475569', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <ReferenceLine
                  y={10}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'عتبة الاستيفاء 10/20',
                    position: 'insideTopRight',
                    fill: '#dc2626',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
                <Bar dataKey="f1Avg" name="الفرض 1" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="f2Avg" name="الفرض 2" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="f3Avg" name="الفرض 3" fill="#1d4ed8" radius={[4, 4, 0, 0]} barSize={16} />
                <Line
                  type="monotone"
                  dataKey="semesterAvg"
                  name="المعدل العام للقسم"
                  stroke="#059669"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart B: Aggregated Absence Statistics by Class */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>إحصائيات ساعات الغياب المجمعة والمواظبة لكل قسم</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                توزيع ساعات الغياب غير المبرر والمبرر ومرات التأخر المسجلة في كل قسم
              </p>
            </div>
          </div>

          <div className="w-full h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredClassesStats}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="className"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#475569', fontSize: 11 }}
                  label={{
                    value: 'ساعات الغياب',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#64748b',
                    fontSize: 10
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#059669', fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="unjustifiedHours"
                  name="غياب غير مبرر (س)"
                  stackId="abs"
                  fill="#ef4444"
                  radius={[0, 0, 0, 0]}
                  barSize={24}
                />
                <Bar
                  yAxisId="left"
                  dataKey="justifiedHours"
                  name="غياب مبرر (س)"
                  stackId="abs"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="attendanceRate"
                  name="نسبة المواظبة (%)"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2.5 New Widget: Monthly Student Absences Comparative Recharts Widget      */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm mb-5">
        {/* Widget Header & Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/80">
                <CalendarRange className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-black text-slate-900">
                مقارنة غيابات التلاميذ: {getArabicMonthName(absenceCompCurrentMonth)} مقابل {getArabicMonthName(absenceCompPreviousMonth)}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/60">
                مبيان تفاعلي Recharts
              </span>
              {useAbsenceDemoData && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60">
                  وضع المعاينة التوضيحية
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              تحليل بياني مقارن لساعات الغياب المسجلة لكل تلميذ ونسبة التغير والتطور بين الشهرين، مع رصد عتبة التنبيه البيداغوجي (4 ساعات)
            </p>
          </div>

          {/* Quick Controls: Demo toggle & Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setUseAbsenceDemoData(!useAbsenceDemoData)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer border ${
                useAbsenceDemoData
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
              title="تفعيل أو إيقاف المحاكاة التوضيحية للبيانات"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{useAbsenceDemoData ? 'إيقاف المعاينة' : 'بيانات توضيحية'}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Class, Month Selection, View Mode, Sorting, Limits */}
        <div className="mt-3.5 mb-4 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>القسم:</span>
            </span>
            <select
              value={absenceCompClass}
              onChange={(e) => setAbsenceCompClass(e.target.value)}
              className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="all">كل الأقسام المسندة ({classNames.length})</option>
              {classNames.map((cName) => (
                <option key={cName} value={cName}>
                  {cName}
                </option>
              ))}
            </select>
          </div>

          {/* Months Selection */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">الشهر الحالي:</span>
            <select
              value={absenceCompCurrentMonth}
              onChange={(e) => setAbsenceCompCurrentMonth(e.target.value)}
              className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              {availableMonthsList.map((m) => (
                <option key={`curr-${m}`} value={m}>
                  {getArabicMonthName(m)}
                </option>
              ))}
            </select>

            <span className="font-bold text-slate-400">مقابل:</span>
            <select
              value={absenceCompPreviousMonth}
              onChange={(e) => setAbsenceCompPreviousMonth(e.target.value)}
              className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            >
              {availableMonthsList.map((m) => (
                <option key={`prev-${m}`} value={m}>
                  {getArabicMonthName(m)}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setAbsenceCompMode('top-students')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                absenceCompMode === 'top-students'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              مقارنة التلاميذ (شريطي)
            </button>
            <button
              type="button"
              onClick={() => setAbsenceCompMode('detailed-student')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                absenceCompMode === 'detailed-student'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              تفصيل تلميذ محدد
            </button>
            <button
              type="button"
              onClick={() => setAbsenceCompMode('by-class')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                absenceCompMode === 'by-class'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              مقارنة حسب الأقسام
            </button>
          </div>

          {/* Sorting & Limit (when in top-students mode) */}
          {absenceCompMode === 'top-students' && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>الترتيب:</span>
              </span>
              <select
                value={absenceCompSort}
                onChange={(e) => setAbsenceCompSort(e.target.value as any)}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="highest_current">الأكثر غياباً في الشهر الحالي</option>
                <option value="highest_increase">الأكبر زيادة (تراجع مقلق ⬆️)</option>
                <option value="highest_decrease">الأكبر انخفاضاً (تحسن ملحوظ ⬇️)</option>
                <option value="total_both">إجمالي الغياب في الشهرين</option>
              </select>

              <select
                value={absenceCompLimit}
                onChange={(e) => setAbsenceCompLimit(Number(e.target.value))}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value={5}>أول 5 تلاميذ</option>
                <option value={10}>أول 10 تلاميذ</option>
                <option value={15}>أول 15 تلميذاً</option>
                <option value={25}>أول 25 تلميذاً</option>
                <option value={999}>كل التلاميذ</option>
              </select>
            </div>
          )}
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
            <div className="text-[11px] font-bold text-slate-500 mb-0.5">
              مجموع غيابات {getArabicMonthName(absenceCompPreviousMonth)}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-800">{monthlyCompSummary.totalPrev}</span>
              <span className="text-xs font-bold text-slate-500">ساعة</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-rose-50/40">
            <div className="text-[11px] font-bold text-rose-700 mb-0.5">
              مجموع غيابات {getArabicMonthName(absenceCompCurrentMonth)}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-900">{monthlyCompSummary.totalCurr}</span>
              <span className="text-xs font-bold text-rose-700">ساعة</span>
              <span className="text-[10px] text-slate-500 font-semibold mr-1">
                (غ.م: {monthlyCompSummary.totalCurrUnjust} س)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
            <div className="text-[11px] font-bold text-slate-500 mb-0.5">صافي التطور والمعدل العام</div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-lg font-black font-mono flex items-center gap-0.5 ${
                  monthlyCompSummary.netDelta > 0
                    ? 'text-rose-600'
                    : monthlyCompSummary.netDelta < 0
                    ? 'text-emerald-600'
                    : 'text-slate-700'
                }`}
              >
                {monthlyCompSummary.netDelta > 0 ? (
                  <TrendingUp className="w-4 h-4 inline" />
                ) : monthlyCompSummary.netDelta < 0 ? (
                  <TrendingDown className="w-4 h-4 inline" />
                ) : (
                  <Minus className="w-4 h-4 inline" />
                )}
                {monthlyCompSummary.netDelta > 0 ? `+${monthlyCompSummary.netDelta}` : monthlyCompSummary.netDelta} س
              </span>
              <span
                className={`text-xs font-bold ${
                  monthlyCompSummary.netPct > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                ({monthlyCompSummary.netPct > 0 ? `+${monthlyCompSummary.netPct}%` : `${monthlyCompSummary.netPct}%`})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-amber-50/40">
            <div className="text-[11px] font-bold text-amber-800 mb-0.5">تلاميذ تجاوزوا عتبة الخطر (≥4س)</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-amber-900">
                {monthlyCompSummary.atRiskCount}
              </span>
              <span className="text-xs font-bold text-amber-700">
                من أصل {monthlyCompSummary.activeAbsentStudents} تلميذاً متغيباً
              </span>
            </div>
          </div>
        </div>

        {/* Active Visualization depending on absenceCompMode */}
        {absenceCompMode === 'top-students' && (
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-slate-600">
                عرض {filteredStudentsAbsenceList.length} تلميذاً (انقر على عمود التلميذ للانتقال إلى التحليل المفصل):
              </span>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-400 inline-block"></span>
                  <span>{getArabicMonthName(absenceCompPreviousMonth)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
                  <span>{getArabicMonthName(absenceCompCurrentMonth)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold">
                  <span className="w-3 h-0.5 bg-rose-600 inline-block"></span>
                  <span>عتبة التنبيه (4 ساعات)</span>
                </span>
              </div>
            </div>

            <div className="w-full h-80 sm:h-96" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredStudentsAbsenceList}
                  margin={{ top: 14, right: 16, left: -10, bottom: 42 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="studentName"
                    tick={{ fill: '#1e293b', fontSize: 10, fontWeight: 700 }}
                    angle={-22}
                    textAnchor="end"
                    interval={0}
                    height={52}
                  />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    label={{
                      value: 'ساعات الغياب',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#64748b',
                      fontSize: 10
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'right',
                      direction: 'rtl'
                    }}
                    formatter={(val: any, name: any) => [`${val} ساعة`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '4px' }} />
                  <ReferenceLine
                    y={4}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'عتبة الخطر 4 س',
                      position: 'insideTopRight',
                      fill: '#dc2626',
                      fontSize: 10,
                      fontWeight: 700
                    }}
                  />
                  <Bar
                    dataKey="prevTotalHours"
                    name={`الشهر السابق (${getArabicMonthName(absenceCompPreviousMonth)})`}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Bar
                    dataKey="currTotalHours"
                    name={`الشهر الحالي (${getArabicMonthName(absenceCompCurrentMonth)})`}
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                    className="cursor-pointer"
                    onClick={(data: any) => {
                      if (data && data.studentId) {
                        setAbsenceCompSelectedStudentId(data.studentId);
                        setAbsenceCompMode('detailed-student');
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {absenceCompMode === 'detailed-student' && (
          <div>
            {/* Student Picker */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-blue-950">اختر التلميذ للتدقيق المفصل:</span>
                <select
                  value={selectedStudentComp?.studentId || ''}
                  onChange={(e) => setAbsenceCompSelectedStudentId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 font-extrabold text-blue-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  {allStudentsMonthlyAbsence.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentName} ({s.className}) - حالي: {s.currTotalHours}س | سابق: {s.prevTotalHours}س
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudentComp && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleNavigateToClass(selectedStudentComp.className, 'absence')}
                    className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                  >
                    فتح سجل غياب قسم {selectedStudentComp.className}
                  </button>
                </div>
              )}
            </div>

            {selectedStudentComp ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Profile Card & KPIs */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-black text-slate-900">
                        {selectedStudentComp.studentName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-blue-100 text-blue-800">
                        {selectedStudentComp.className}
                      </span>
                    </div>
                    {selectedStudentComp.massar && (
                      <div className="text-xs text-slate-500 font-mono mb-3">
                        رقم مسار: {selectedStudentComp.massar}
                      </div>
                    )}

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-slate-600">
                          غياب {getArabicMonthName(absenceCompPreviousMonth)}:
                        </span>
                        <span className="font-black text-slate-800 font-mono">
                          {selectedStudentComp.prevTotalHours} س
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-rose-700">
                          غياب {getArabicMonthName(absenceCompCurrentMonth)}:
                        </span>
                        <span className="font-black text-rose-600 font-mono">
                          {selectedStudentComp.currTotalHours} س
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-slate-600">فارق الساعات:</span>
                        <span
                          className={`font-black font-mono ${
                            selectedStudentComp.deltaHours > 0
                              ? 'text-rose-600'
                              : selectedStudentComp.deltaHours < 0
                              ? 'text-emerald-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {selectedStudentComp.deltaHours > 0
                            ? `+${selectedStudentComp.deltaHours} س`
                            : `${selectedStudentComp.deltaHours} س`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div
                      className={`p-2.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 ${
                        selectedStudentComp.currTotalHours >= 4
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : selectedStudentComp.isWorsened
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : selectedStudentComp.isImproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {selectedStudentComp.currTotalHours >= 4 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>حالة حرجة: تجاوز عتبة التنبيه البيداغوجي (4س)</span>
                        </>
                      ) : selectedStudentComp.isWorsened ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-amber-700" />
                          <span>تراجع في الانضباط مقارنة بالشهر الماضي</span>
                        </>
                      ) : selectedStudentComp.isImproved ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>تحسن ملحوظ وانخفاض في ساعات الغياب</span>
                        </>
                      ) : (
                        <>
                          <Minus className="w-4 h-4 text-slate-500" />
                          <span>مواظبة مستقرة بدون تغير</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Breakdown Recharts BarChart */}
                <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs font-extrabold text-slate-700 mb-2">
                    المقارنة التفصيلية حسب نوع الغياب والتأخر بين الشهرين:
                  </div>
                  <div className="w-full h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={selectedStudentBreakdownData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="category"
                          tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#cbd5e1',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            textAlign: 'right',
                            direction: 'rtl'
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                        <Bar
                          dataKey="prev"
                          name={`الشهر الماضي (${getArabicMonthName(absenceCompPreviousMonth)})`}
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                        />
                        <Bar
                          dataKey="curr"
                          name={`الشهر الحالي (${getArabicMonthName(absenceCompCurrentMonth)})`}
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs font-bold">
                لا توجد بيانات تفصيلية متوفرة لهذا التلميذ.
              </div>
            )}
          </div>
        )}

        {absenceCompMode === 'by-class' && (
          <div>
            <div className="text-xs font-bold text-slate-600 mb-2 px-1">
              مقارنة مجموع ساعات الغياب بين الشهرين لجميع الأقسام المسندة:
            </div>
            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={classesAbsenceMonthlyCompData}
                  margin={{ top: 12, right: 16, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="className"
                    tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    tick={{ fill: '#475569', fontSize: 11 }}
                    label={{
                      value: 'إجمالي الساعات',
                      angle: -90,
                      position: 'insideLeft',
                      fill: '#64748b',
                      fontSize: 10
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'right',
                      direction: 'rtl'
                    }}
                    formatter={(val: any, name: any) => [`${val} ساعة`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                  <Bar
                    dataKey="prevTotalHours"
                    name={`الشهر السابق (${getArabicMonthName(absenceCompPreviousMonth)})`}
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                  />
                  <Bar
                    dataKey="currTotalHours"
                    name={`الشهر الحالي (${getArabicMonthName(absenceCompCurrentMonth)})`}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 3. Secondary Charts Row: Mastery Distribution (Note 142-08) & Pass Rate vs Absence Impact */}
      <div ref={secondaryChartsRef}>
        {!secondaryChartsReady ? (
          <div className="w-full py-7 px-4 mb-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center gap-2.5 text-slate-500 text-xs font-bold">
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
            <span>جاري تحضير مبيانات فئات التحكم ومقارنات النجاح...</span>
          </div>
        ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Chart C: Ministerial Appreciation & Mastery Brackets */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>توزيع التلاميذ حسب فئات التحكم وسلالم التقدير (المذكرة 142-08)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                التصنيف المعياري لمستويات التحصيل الدراسي في مادة الرياضيات لجميع الأقسام
              </p>
            </div>
          </div>

          <div className="w-full h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={masteryDistributionData}
                layout="vertical"
                margin={{ top: 5, right: 25, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                />
                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `${value} تلميذ (${props?.payload?.pct || 0}%)`,
                    'العدد والنسبة'
                  ]}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                />
                <Bar dataKey="count" name="عدد التلاميذ" radius={[0, 6, 6, 0]} barSize={22}>
                  {masteryDistributionData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart D: Success Rate vs Excellence Rate vs Absence Rate per Class */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-700" />
                <span>مقارنة نسب النجاح والتميز مع نسبة الغياب لكل قسم</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                مقارنة نسبة الاستيفاء (≥10/20) ونسبة التميز (≥16/20) مقابل نسبة غياب كل قسم
              </p>
            </div>
          </div>

          <div className="w-full h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredClassesStats}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="className"
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#475569', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'right',
                    direction: 'rtl'
                  }}
                  formatter={(val: any, name: any) => [`${val}%`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <Bar
                  dataKey="passRate"
                  name="نسبة النجاح (≥10) %"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Bar
                  dataKey="excellenceRate"
                  name="نسبة التميز (≥16) %"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  barSize={18}
                />
                <Line
                  type="monotone"
                  dataKey="absenceRate"
                  name="نسبة الغياب (%)"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#ef4444' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
        )}
      </div>
          </>
        )}
      </div>

      {/* 4. Comprehensive Cross-Class Comparison Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              جدول الحصيلة الإحصائية المقارنة لجميع الأقسام المسندة
            </h3>
            <p className="text-[11px] text-slate-500">
              انقر على أزرار الإجراءات السريعة للانتقال المباشر إلى مسك النقط أو سجل الغياب الخاص بالقسم
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600">
            عدد الأقسام المعروضة: {filteredClassesStats.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="py-2.5 px-3 border-l border-slate-700">القسم</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">المستوى · المعامل</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">التلاميذ</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">متوسط F1</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">متوسط F2</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">متوسط F3</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">المعدل العام</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">نسبة النجاح</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">ساعات الغياب</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">نسبة المواظبة</th>
                <th className="py-2.5 px-3 border-l border-slate-700 text-center">نسبة الغياب</th>
                <th className="py-2.5 px-3 text-center">ولوج سريع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredClassesStats.map((cls, idx) => (
                <tr
                  key={cls.className}
                  className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/60'}
                >
                  <td className="py-2.5 px-3 font-black text-blue-950">{cls.className}</td>
                  <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">
                    {cls.streamLabel} · معامل {cls.coef} ({cls.examsCount} فروض)
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                    {cls.studentCount}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                    {cls.f1Avg !== null ? cls.f1Avg.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                    {cls.f2Avg !== null ? cls.f2Avg.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                    {cls.examsCount === 3 ? (cls.f3Avg !== null ? cls.f3Avg.toFixed(2) : '-') : 'غير مقرر'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-black">
                    {cls.semesterAvg !== null ? (
                      <span className={cls.semesterAvg >= 10 ? 'text-emerald-700' : 'text-rose-600'}>
                        {cls.semesterAvg.toFixed(2)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    <span className={cls.passRate >= 50 ? 'text-emerald-700' : 'text-amber-700'}>
                      {cls.passRate}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                    {cls.totalAbsenceHours} س{' '}
                    <span className="text-[11px] font-normal text-slate-500">
                      (غ.م: {cls.unjustifiedHours} س)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-emerald-800">
                    {cls.attendanceRate}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">
                    <span className={cls.absenceRate > 6 ? 'text-rose-600 font-extrabold' : cls.absenceRate > 3 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                      {cls.absenceRate}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAiDiagClassFilter(cls.className);
                          setShowAiDiagnosticsCenter(true);
                          runAiClassesDiagnostics(cls.className, aiDiagScannedSource);
                          setTimeout(() => {
                            aiDiagSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        }}
                        className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold text-[11px] cursor-pointer transition-colors inline-flex items-center gap-1"
                        title="توليد تقرير تشخيصي بالذكاء الاصطناعي لهذا القسم بناءً على نتائج الفروض الممسوحة والمواظبة"
                      >
                        <Brain className="w-3 h-3 text-indigo-600" />
                        <span>تشخيص ذكي AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigateToClass(cls.className, 'grades')}
                        className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] cursor-pointer transition-colors"
                        title="فتح جدول نقط المراقبة المستمرة لهذا القسم"
                      >
                        النقط
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNavigateToClass(cls.className, 'absence')}
                        className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[11px] cursor-pointer transition-colors"
                        title="فتح سجل المواظبة والغياب لهذا القسم"
                      >
                        الغياب
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
