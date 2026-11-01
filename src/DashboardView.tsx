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
  ArrowUpDown
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface Student {
  id: string;
  name: string;
  massar?: string;
  orderNum?: string | number;
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

  const isLit =
    upper.includes('LSH') ||
    upper.includes('LET') ||
    upper.includes('HUM') ||
    className.includes('آداب') ||
    className.includes('أدب') ||
    className.includes('إنسانية');

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
    className.includes('ثانية') ||
    upper.includes('PC') ||
    upper.includes('SVT')
  ) {
    streamLevel = '2bac';
    streamLabel = isSm ? '2 باك علوم رياضية' : isEco ? '2 باك علوم اقتصادية' : isLit ? '2 باك آداب وإنسانية' : '2 باك علوم تجريبية (PC/SVT)';
    defaultCoef = isLit ? 2 : isEco ? 4 : isSm ? 9 : 7;
    defaultExams = isLit ? 2 : isSm ? 4 : 3;
  } else if (
    upper.includes('1BAC') ||
    upper.includes('1 BAC') ||
    className.includes('أولى')
  ) {
    streamLevel = '1bac';
    streamLabel = isSm ? '1 باك علوم رياضية' : isEco ? '1 باك علوم اقتصادية' : isLit ? '1 باك آداب وإنسانية' : '1 باك علوم تجريبية';
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
    streamLabel = isLit ? 'الجذع المشترك للآداب' : 'الجذع المشترك العلمي';
    defaultCoef = isLit ? 2 : 4;
    defaultExams = isLit ? 2 : 3;
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

      students.forEach((std) => {
        let studentAvg: number | null = null;
        if (semester === 'annual') {
          const g1 = getStudentSemesterGrades(className, std.id, 's1');
          const g2 = getStudentSemesterGrades(className, std.id, 's2');
          const a1 = computeStudentAvg(g1, meta.examsCount);
          const a2 = computeStudentAvg(g2, meta.examsCount);
          if (a1 !== null && a2 !== null) studentAvg = (a1 + a2) / 2;
          else studentAvg = a1 !== null ? a1 : a2;

          // Aggregate exam components from active data
          const gRef = a2 !== null ? g2 : g1;
          const v1 = parseValidGrade(gRef?.f1);
          const v2 = parseValidGrade(gRef?.f2);
          const v3 = parseValidGrade(gRef?.f3);
          const v4 = parseValidGrade(gRef?.f4);
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
          const v1 = parseValidGrade(g?.f1);
          const v2 = parseValidGrade(g?.f2);
          const v3 = parseValidGrade(g?.f3);
          const v4 = parseValidGrade(g?.f4);
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

        if (studentAvg !== null) {
          gradedStudentsCount++;
          avgSum += studentAvg;
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
      });

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
        tierWeak
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
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
