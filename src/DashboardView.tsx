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
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Calendar,
  RefreshCw,
  Download,
  ArrowUpRight,
  GraduationCap,
  FileCheck,
  Filter,
  ShieldAlert,
  BarChart3,
  Activity,
  GripVertical,
  RotateCcw
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
  f4Avg: number | null;
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

  if (
    upper.includes('2BAC') ||
    upper.includes('2 BAC') ||
    className.includes('ثانية') ||
    upper.includes('PC') ||
    upper.includes('SVT')
  ) {
    streamLevel = '2bac';
    streamLabel = 'الثانية باكالوريا';
    const isSm = upper.includes('SM') || className.includes('رياضية');
    defaultCoef = isLit ? 2 : isSm ? 9 : 7;
    defaultExams = isLit ? 2 : isSm ? 4 : 3;
  } else if (
    upper.includes('1BAC') ||
    upper.includes('1 BAC') ||
    className.includes('أولى')
  ) {
    streamLevel = '1bac';
    streamLabel = 'الأولى باكالوريا';
    const isSm = upper.includes('SM') || className.includes('رياضية');
    defaultCoef = isLit ? 2 : isSm ? 9 : 7;
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
    streamLabel = 'الجذع المشترك';
    defaultCoef = isLit ? 2 : 4;
    defaultExams = isLit ? 2 : 3;
  }

  return {
    streamLevel,
    streamLabel,
    coef: winCoef && !isNaN(winCoef) ? winCoef : (db?.coefConfig?.[className] ?? defaultCoef),
    examsCount: winExams && !isNaN(winExams) ? winExams : (db?.examsCountConfig?.[className] ?? defaultExams)
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
                <Bar dataKey="f1Avg" name="الفرض 1" fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="f2Avg" name="الفرض 2" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="f3Avg" name="الفرض 3" fill="#1d4ed8" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="f4Avg" name="الفرض 4 (ع. رياضية)" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={14} />
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
