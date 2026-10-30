import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  Target,
  Layers,
  Sparkles,
  Printer,
  Download,
  FileSpreadsheet,
  Search,
  Activity,
  CheckCircle2,
  ArrowUpDown,
  Calendar,
  GraduationCap,
  School,
  Scale,
  AlertCircle,
  FileCheck,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  X,
  LineChart as LineChartIcon,
  Table as TableIcon,
  RefreshCw,
  FileText,
  SlidersHorizontal,
  ShieldAlert,
  Eye
} from 'lucide-react';
import html2canvas from 'html2canvas';
import AiRemediationView from './AiRemediationView';
import ComprehensiveAnalysisPdfExport, { ComprehensivePdfExportHandle } from './ComprehensiveAnalysisPdfExport';
import { AiComparativePerformanceModal } from './AiComparativePerformanceModal';
import BoxPlotChart, { BoxPlotItem } from './BoxPlotChart';
import ExamFrameworkModal from './ExamFrameworkModal';

// Helper to extract student exam grade reliably across flat and semester formats
function getStudentExamGrade(
  classGrades: any,
  studentId: string,
  semester: 's1' | 's2',
  examKey: 'f1' | 'f2' | 'f3' | 'f4'
): number | null {
  if (!classGrades || !classGrades[studentId]) return null;
  const stdRecord = classGrades[studentId];
  let val: any = undefined;

  if (semester === 's2') {
    if (stdRecord.s2 && stdRecord.s2[examKey] !== undefined) {
      val = stdRecord.s2[examKey];
    }
  } else {
    // S1: Check s1 namespace first, then fall back to root properties
    if (stdRecord.s1 && stdRecord.s1[examKey] !== undefined) {
      val = stdRecord.s1[examKey];
    } else if (stdRecord[examKey] !== undefined) {
      val = stdRecord[examKey];
    }
  }

  if (val === '' || val === undefined || val === null) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// Moroccan appreciation standard helper according to Ministerial directives
function getMoroccanAppreciation(mark: number | null): { text: string; color: string; bg: string; icon: any } {
  if (mark === null || isNaN(mark)) {
    return { text: 'غير مسجل', color: '#64748b', bg: '#f1f5f9', icon: AlertCircle };
  }
  if (mark >= 16) return { text: 'حسن جداً (ممتاز)', color: '#15803d', bg: '#dcfce7', icon: Award };
  if (mark >= 14) return { text: 'حسن (جيد جداً)', color: '#0369a1', bg: '#e0f2fe', icon: Award };
  if (mark >= 12) return { text: 'مستحسن (جيد)', color: '#0284c7', bg: '#f0f9ff', icon: CheckCircle2 };
  if (mark >= 10) return { text: 'متوسط (مستوفٍ)', color: '#4338ca', bg: '#e0e7ff', icon: CheckCircle2 };
  if (mark >= 8)  return { text: 'دون المتوسط', color: '#c2410c', bg: '#ffedd5', icon: AlertCircle };
  return { text: 'غير متمكن (تعثر حاد)', color: '#b91c1c', bg: '#fee2e2', icon: AlertTriangle };
}

// Distinct high-contrast palette for multi-student comparison curves
const STUDENT_PALETTE = [
  '#2563eb', // Blue
  '#16a34a', // Emerald
  '#d97706', // Amber
  '#9333ea', // Purple
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#4f46e5'  // Indigo
];

export interface StudentMetric {
  id: string;
  name: string;
  massar: string;
  className: string;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4?: number | null;
  avg: number | null;
  delta: number | null; // latest - first
  deltaPercent: number | null;
  trajectory: 'improving' | 'declining' | 'stable' | 'unknown';
  validExamsCount: number;
  bestMark: number | null;
  bestExamTitle: string;
  potentialGap: number;
  gapVsClass: number | null;
}

export default function Analysis() {
  const [db, setDb] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [semester, setSemester] = useState<'s1' | 's2'>('s1');
  const [activeTab, setActiveTab] = useState<'overview' | 'consolidated_annual' | 'comparison' | 'macro_trend' | 'distribution' | 'at_risk' | 'ai_remediation' | 'official_docs' | 'absence_vs_success' | 'guidance_stats'>('consolidated_annual');
  const [guidanceFilter, setGuidanceFilter] = useState<'all' | 'sm_elite' | 'pc_svt' | 'support_reorient'>('all');
  const [consolidatedMomentumFilter, setConsolidatedMomentumFilter] = useState<'all' | 'accelerating' | 'sustained_mastery' | 'recovering' | 'at_risk'>('all');
  const [detailedLabLens, setDetailedLabLens] = useState<'trajectory' | 'distribution' | 'boxplot' | 'potential'>('trajectory');
  const [absenceGradeChartMode, setAbsenceGradeChartMode] = useState<'brackets' | 'students' | 'classes'>('brackets');
  const [isSubTabChartReady, setIsSubTabChartReady] = useState<boolean>(true);
  const [showIconLaunchpad, setShowIconLaunchpad] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cohortFilter, setCohortFilter] = useState<'all' | 'improving' | 'declining' | 'top' | 'medium' | 'at_risk'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'chart_only' | 'table_only'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showClassMeanLine, setShowClassMeanLine] = useState<boolean>(true);
  const [sortField, setSortField] = useState<'name' | 'f1' | 'f2' | 'f3' | 'f4' | 'avg' | 'delta'>('delta');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // AI Comparative Analysis Modal State (Continuous Assessment vs Proctored Exams)
  const [isAiCompareModalOpen, setIsAiCompareModalOpen] = useState<boolean>(false);
  const [aiCompareStudentId, setAiCompareStudentId] = useState<string>('');
  const [aiCompareClassName, setAiCompareClassName] = useState<string>('');
  const [isExamFrameworkModalOpen, setIsExamFrameworkModalOpen] = useState<boolean>(false);
  const [boxPlotDimension, setBoxPlotDimension] = useState<'exams' | 'classes'>('exams');

  useEffect(() => {
    (window as any).openStudentAiComparativeModal = (className?: string, studentId?: string) => {
      if (className) setAiCompareClassName(className);
      if (studentId) setAiCompareStudentId(studentId);
      setIsAiCompareModalOpen(true);
    };
    (window as any).openExamFrameworkModal = () => {
      setIsExamFrameworkModalOpen(true);
    };
    return () => {
      delete (window as any).openStudentAiComparativeModal;
      delete (window as any).openExamFrameworkModal;
    };
  }, []);

  // Defer large chart rendering briefly on sub-tab switch with a lightweight loading indicator
  useEffect(() => {
    setIsSubTabChartReady(false);
    const t = setTimeout(() => setIsSubTabChartReady(true), 90);
    return () => clearTimeout(t);
  }, [activeTab]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pdfExportRef = useRef<ComprehensivePdfExportHandle>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadDb = () => {
      if (typeof window !== 'undefined' && (window as any).db) {
        setDb({ ...(window as any).db });
      } else {
        const localData = localStorage.getItem('absence_massar_v8_manual');
        if (localData) {
          try {
            setDb(JSON.parse(localData));
          } catch (e) {}
        }
      }
      if (typeof window !== 'undefined') {
        if ((window as any).activeSemester) {
          setSemester((window as any).activeSemester === 's2' ? 's2' : 's1');
        }
        const activeCls = (document.getElementById('annualClassSelect') as HTMLSelectElement)?.value
          || (document.getElementById('classSelect') as HTMLSelectElement)?.value
          || (document.getElementById('reportClassSelect') as HTMLSelectElement)?.value
          || (window as any).currentClass;
        if (activeCls && typeof activeCls === 'string' && activeCls.trim() !== '') {
          setSelectedClass(prev => (prev === 'all' ? activeCls : prev));
        }
      }
    };

    const handleAnnualClassChanged = (e: any) => {
      const cls = e?.detail?.className;
      if (cls && typeof cls === 'string') {
        setSelectedClass(cls);
      }
    };

    const handleSelectWorkspace = (e: any) => {
      const ws = e?.detail?.workspace;
      if (ws && typeof ws === 'string') {
        setActiveTab(ws as any);
      }
    };

    loadDb();

    window.addEventListener('analysisTabOpened', loadDb);
    window.addEventListener('dbUpdated', loadDb);
    window.addEventListener('annualClassChanged', handleAnnualClassChanged as EventListener);
    window.addEventListener('globalClassSynced', handleAnnualClassChanged as EventListener);
    window.addEventListener('selectAnalysisWorkspace', handleSelectWorkspace as EventListener);

    return () => {
      window.removeEventListener('analysisTabOpened', loadDb);
      window.removeEventListener('dbUpdated', loadDb);
      window.removeEventListener('annualClassChanged', handleAnnualClassChanged as EventListener);
      window.removeEventListener('globalClassSynced', handleAnnualClassChanged as EventListener);
      window.removeEventListener('selectAnalysisWorkspace', handleSelectWorkspace as EventListener);
    };
  }, []);

  const classNames = useMemo(() => {
    if (!db || !db.classes) return [];
    return Object.keys(db.classes);
  }, [db]);

  // Compute longitudinal student metrics
  const { studentMetrics, classAverages, classQuartiles, macroTrend } = useMemo(() => {
    if (!db || !db.classes) {
      return {
        studentMetrics: [],
        classAverages: { f1: null, f2: null, f3: null, f4: null, overall: null },
        classQuartiles: { f1: { q1: null, med: null, q3: null }, f2: { q1: null, med: null, q3: null }, f3: { q1: null, med: null, q3: null }, f4: { q1: null, med: null, q3: null } },
        macroTrend: { direction: 'stable', delta: 0, deltaPercent: 0, improvingPercent: 0, decliningPercent: 0, stablePercent: 0 }
      };
    }

    const targetClasses = selectedClass === 'all' ? classNames : [selectedClass];
    const metrics: StudentMetric[] = [];

    const f1Marks: number[] = [];
    const f2Marks: number[] = [];
    const f3Marks: number[] = [];
    const f4Marks: number[] = [];

    targetClasses.forEach(cName => {
      const classGrades = (db.grades && db.grades[cName]) ? db.grades[cName] : {};
      const students = (db.classes && db.classes[cName])
        ? (Array.isArray(db.classes[cName]) ? db.classes[cName] : (db.classes[cName].students || []))
        : [];

      students.forEach((std: any) => {
        const f1 = getStudentExamGrade(classGrades, std.id, semester, 'f1');
        const f2 = getStudentExamGrade(classGrades, std.id, semester, 'f2');
        const f3 = getStudentExamGrade(classGrades, std.id, semester, 'f3');
        const f4 = getStudentExamGrade(classGrades, std.id, semester, 'f4');

        if (f1 !== null) f1Marks.push(f1);
        if (f2 !== null) f2Marks.push(f2);
        if (f3 !== null) f3Marks.push(f3);
        if (f4 !== null) f4Marks.push(f4);

        const validGrades: number[] = [];
        if (f1 !== null) validGrades.push(f1);
        if (f2 !== null) validGrades.push(f2);
        if (f3 !== null) validGrades.push(f3);
        if (f4 !== null) validGrades.push(f4);

        const avg = validGrades.length > 0
          ? parseFloat((validGrades.reduce((a, b) => a + b, 0) / validGrades.length).toFixed(2))
          : null;

        let delta: number | null = null;
        let deltaPercent: number | null = null;
        let trajectory: 'improving' | 'declining' | 'stable' | 'unknown' = 'unknown';

        if (validGrades.length >= 2) {
          const firstGrade = validGrades[0];
          const latestGrade = validGrades[validGrades.length - 1];
          delta = parseFloat((latestGrade - firstGrade).toFixed(2));
          deltaPercent = firstGrade > 0 ? parseFloat(((delta / firstGrade) * 100).toFixed(1)) : (delta > 0 ? 100 : 0);

          if (delta >= 0.5) trajectory = 'improving';
          else if (delta <= -0.5) trajectory = 'declining';
          else trajectory = 'stable';
        }

        const examGradesWithTitles: { mark: number; title: string }[] = [];
        if (f1 !== null) examGradesWithTitles.push({ mark: f1, title: 'الفرض 1' });
        if (f2 !== null) examGradesWithTitles.push({ mark: f2, title: 'الفرض 2' });
        if (f3 !== null) examGradesWithTitles.push({ mark: f3, title: 'الفرض 3' });
        if (f4 !== null) examGradesWithTitles.push({ mark: f4, title: 'الفرض 4' });

        let bestMark: number | null = null;
        let bestExamTitle = 'لا يوجد';
        if (examGradesWithTitles.length > 0) {
          examGradesWithTitles.sort((a, b) => b.mark - a.mark);
          bestMark = examGradesWithTitles[0].mark;
          bestExamTitle = examGradesWithTitles[0].title;
        }

        const potentialGap = (bestMark !== null && avg !== null) ? parseFloat((bestMark - avg).toFixed(2)) : 0;

        metrics.push({
          id: String(std.id),
          name: std.name || 'تلميذ(ة)',
          massar: std.massar || std.id || '',
          className: cName,
          f1,
          f2,
          f3,
          f4,
          avg,
          delta,
          deltaPercent,
          trajectory,
          validExamsCount: validGrades.length,
          bestMark,
          bestExamTitle,
          potentialGap,
          gapVsClass: null // populated after class average calculation
        });
      });
    });

    // Compute Class Averages per Exam
    const avgF1 = f1Marks.length > 0 ? parseFloat((f1Marks.reduce((a, b) => a + b, 0) / f1Marks.length).toFixed(2)) : null;
    const avgF2 = f2Marks.length > 0 ? parseFloat((f2Marks.reduce((a, b) => a + b, 0) / f2Marks.length).toFixed(2)) : null;
    const avgF3 = f3Marks.length > 0 ? parseFloat((f3Marks.reduce((a, b) => a + b, 0) / f3Marks.length).toFixed(2)) : null;
    const avgF4 = f4Marks.length > 0 ? parseFloat((f4Marks.reduce((a, b) => a + b, 0) / f4Marks.length).toFixed(2)) : null;

    const allMarks = [...f1Marks, ...f2Marks, ...f3Marks, ...f4Marks];
    const avgOverall = allMarks.length > 0 ? parseFloat((allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(2)) : null;

    // Helper for quartiles
    const calcQuartiles = (arr: number[]) => {
      if (arr.length === 0) return { q1: null, med: null, q3: null };
      const s = [...arr].sort((a, b) => a - b);
      const q = (p: number) => {
        const idx = p * (s.length - 1);
        const l = Math.floor(idx);
        const u = Math.ceil(idx);
        return parseFloat((s[l] + (s[u] - s[l]) * (idx - l)).toFixed(2));
      };
      return { q1: q(0.25), med: q(0.5), q3: q(0.75) };
    };

    const classQuartiles = {
      f1: calcQuartiles(f1Marks),
      f2: calcQuartiles(f2Marks),
      f3: calcQuartiles(f3Marks),
      f4: calcQuartiles(f4Marks)
    };

    // Populate gapVsClass: مقارنة المعدل الدوري للتلميذ مع المعدل العام للقسم وفق المعايير الديداكتيكية والإحصائية
    metrics.forEach(m => {
      const studentBenchmark = m.avg !== null ? m.avg : m.bestMark;
      if (studentBenchmark !== null && avgOverall !== null) {
        m.gapVsClass = parseFloat((studentBenchmark - avgOverall).toFixed(2));
      }
    });

    // Macro Trend across exams
    let macroDelta = 0;
    let macroDirection: 'improving' | 'declining' | 'stable' = 'stable';
    if (avgF1 !== null) {
      const latestAvg = avgF4 !== null ? avgF4 : (avgF3 !== null ? avgF3 : (avgF2 !== null ? avgF2 : avgF1));
      macroDelta = parseFloat((latestAvg - avgF1).toFixed(2));
      if (macroDelta >= 0.3) macroDirection = 'improving';
      else if (macroDelta <= -0.3) macroDirection = 'declining';
    }

    // Calculate comprehensive statistical indicators for Note 142-08 compliance
    const evaluatedAverages = metrics.map(m => m.avg).filter((v): v is number => v !== null && !isNaN(v));
    const testedCount = evaluatedAverages.length;
    const sortedAverages = [...evaluatedAverages].sort((a, b) => a - b);
    
    let medianVal: number | null = null;
    if (sortedAverages.length > 0) {
      const mid = Math.floor(sortedAverages.length / 2);
      medianVal = sortedAverages.length % 2 !== 0 
        ? sortedAverages[mid] 
        : parseFloat(((sortedAverages[mid - 1] + sortedAverages[mid]) / 2).toFixed(2));
    }

    let minMarkVal: number | null = allMarks.length > 0 ? Math.min(...allMarks) : null;
    let maxMarkVal: number | null = allMarks.length > 0 ? Math.max(...allMarks) : null;

    let stdDevVal: number | null = null;
    if (evaluatedAverages.length > 0) {
      const evaluatedAvgMean = evaluatedAverages.reduce((acc, val) => acc + val, 0) / evaluatedAverages.length;
      const variance = evaluatedAverages.reduce((acc, val) => acc + Math.pow(val - evaluatedAvgMean, 2), 0) / evaluatedAverages.length;
      stdDevVal = parseFloat(Math.sqrt(variance).toFixed(2));
    }

    const passingCount = evaluatedAverages.filter(v => v >= 10).length;
    const passPctVal = testedCount > 0 ? Math.round((passingCount / testedCount) * 100) : 0;

    const studentsWithDelta = metrics.filter(m => m.delta !== null);
    const improvingCount = studentsWithDelta.filter(m => m.trajectory === 'improving').length;
    const decliningCount = studentsWithDelta.filter(m => m.trajectory === 'declining').length;
    const stableCount = studentsWithDelta.filter(m => m.trajectory === 'stable').length;
    const totalCount = studentsWithDelta.length || 1;

    const macroTrend = {
      direction: macroDirection,
      delta: macroDelta,
      deltaPercent: avgF1 ? parseFloat(((macroDelta / avgF1) * 100).toFixed(1)) : 0,
      improvingPercent: Math.round((improvingCount / totalCount) * 100),
      decliningPercent: Math.round((decliningCount / totalCount) * 100),
      stablePercent: Math.round((stableCount / totalCount) * 100)
    };

    return {
      studentMetrics: metrics,
      classAverages: { 
        f1: avgF1, 
        f2: avgF2, 
        f3: avgF3, 
        f4: avgF4,
        overall: avgOverall,
        testedCount,
        passPct: passPctVal,
        median: medianVal,
        stdDev: stdDevVal,
        minMark: minMarkVal,
        maxMark: maxMarkVal
      },
      classQuartiles,
      macroTrend
    };
  }, [db, selectedClass, semester, classNames]);

  // Cohort statistics summary
  const cohortStats = useMemo(() => {
    const total = studentMetrics.length;
    const evaluated = studentMetrics.filter(m => m.avg !== null);
    const totalEvaluated = evaluated.length;
    const top = evaluated.filter(m => m.avg! >= 14).length;
    const medium = evaluated.filter(m => m.avg! >= 10 && m.avg! < 14).length;
    const atRisk = evaluated.filter(m => m.avg! < 10).length;
    const passing = top + medium;
    const passPct = totalEvaluated > 0 ? Math.min(100, Math.max(0, Math.round((passing / totalEvaluated) * 100))) : 0;

    const improving = studentMetrics.filter(m => m.trajectory === 'improving').length;
    const declining = studentMetrics.filter(m => m.trajectory === 'declining').length;

    let bestStudent: { name: string; avg: number } | null = null;
    let lowestStudent: { name: string; avg: number } | null = null;
    const withAvg = [...evaluated].sort((a, b) => (b.avg || 0) - (a.avg || 0));
    if (withAvg.length > 0) {
      bestStudent = { name: withAvg[0].name, avg: withAvg[0].avg! };
      lowestStudent = { name: withAvg[withAvg.length - 1].name, avg: withAvg[withAvg.length - 1].avg! };
    }

    return {
      total,
      totalEvaluated,
      top,
      topPct: totalEvaluated > 0 ? Math.round((top / totalEvaluated) * 100) : 0,
      medium,
      medPct: totalEvaluated > 0 ? Math.round((medium / totalEvaluated) * 100) : 0,
      atRisk,
      atRiskPct: totalEvaluated > 0 ? Math.round((atRisk / totalEvaluated) * 100) : 0,
      passing,
      passPct,
      improving,
      declining,
      bestStudent,
      lowestStudent
    };
  }, [studentMetrics]);

  // Grade Brackets Distribution according to Moroccan Standard
  const distributionData = useMemo(() => {
    const brackets = [
      { label: 'ممتاز (16-20)', min: 16, max: 20, count: 0, color: '#15803d' },
      { label: 'جيد جداً (14-16)', min: 14, max: 16, count: 0, color: '#0284c7' },
      { label: 'حسن (12-14)', min: 12, max: 14, count: 0, color: '#3b82f6' },
      { label: 'متوسط (10-12)', min: 10, max: 12, count: 0, color: '#8b5cf6' },
      { label: 'دون العتبة (08-10)', min: 8, max: 10, count: 0, color: '#f59e0b' },
      { label: 'تعثر حاد (<08)', min: 0, max: 8, count: 0, color: '#ef4444' }
    ];

    studentMetrics.forEach(m => {
      if (m.avg !== null) {
        const val = m.avg;
        if (val >= 16) brackets[0].count++;
        else if (val >= 14) brackets[1].count++;
        else if (val >= 12) brackets[2].count++;
        else if (val >= 10) brackets[3].count++;
        else if (val >= 8) brackets[4].count++;
        else brackets[5].count++;
      }
    });

    const totalWithGrades = studentMetrics.filter(m => m.avg !== null).length;
    return brackets.map(b => ({
      ...b,
      pct: totalWithGrades > 0 ? Math.round((b.count / totalWithGrades) * 100) : 0
    }));
  }, [studentMetrics]);

  // Box-Plot (Boîte à moustaches) items for exam dispersion or inter-class comparison
  const boxPlotItems: BoxPlotItem[] = useMemo(() => {
    if (!db || !db.classes) return [];

    if (boxPlotDimension === 'exams') {
      const f1Vals = studentMetrics.map(s => s.f1).filter((v): v is number => v !== null);
      const f2Vals = studentMetrics.map(s => s.f2).filter((v): v is number => v !== null);
      const f3Vals = studentMetrics.map(s => s.f3).filter((v): v is number => v !== null);
      const f4Vals = studentMetrics.map(s => s.f4).filter((v): v is number => v !== null && v !== undefined);
      const avgVals = studentMetrics.map(s => s.avg).filter((v): v is number => v !== null);

      const items: BoxPlotItem[] = [];
      if (f1Vals.length > 0) items.push({ id: 'f1', name: 'الفرض 1', subTitle: 'المراقبة الأولى', values: f1Vals, color: '#2563eb' });
      if (f2Vals.length > 0) items.push({ id: 'f2', name: 'الفرض 2', subTitle: 'المراقبة الثانية', values: f2Vals, color: '#10b981' });
      if (f3Vals.length > 0) items.push({ id: 'f3', name: 'الفرض 3', subTitle: 'المراقبة الثالثة', values: f3Vals, color: '#8b5cf6' });
      if (f4Vals.length > 0) items.push({ id: 'f4', name: 'الفرض 4', subTitle: 'المراقبة الرابعة (ع. رياضية)', values: f4Vals, color: '#ec4899' });
      if (avgVals.length > 0) items.push({ id: 'avg', name: 'المعدل العام', subTitle: 'حصيلة الدورة', values: avgVals, color: '#f59e0b' });
      return items;
    } else {
      const palette = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1'];
      return classNames.map((cName, idx) => {
        const classGrades = (db.grades && db.grades[cName]) ? db.grades[cName] : {};
        const students = (db.classes && db.classes[cName])
          ? (Array.isArray(db.classes[cName]) ? db.classes[cName] : (db.classes[cName].students || []))
          : [];

        const classAvgs: number[] = [];
        students.forEach((std: any) => {
          const f1 = getStudentExamGrade(classGrades, std.id, semester, 'f1');
          const f2 = getStudentExamGrade(classGrades, std.id, semester, 'f2');
          const f3 = getStudentExamGrade(classGrades, std.id, semester, 'f3');
          const f4 = getStudentExamGrade(classGrades, std.id, semester, 'f4');
          const valid = [f1, f2, f3, f4].filter((v): v is number => v !== null);
          if (valid.length > 0) {
            classAvgs.push(parseFloat((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)));
          }
        });

        return {
          id: cName,
          name: cName,
          subTitle: `القسم: ${cName}`,
          values: classAvgs,
          color: palette[idx % palette.length]
        };
      }).filter(item => item.values.length > 0);
    }
  }, [db, boxPlotDimension, studentMetrics, classNames, semester]);

  // Detect if any student has an F4 mark recorded or if F4 average exists
  const hasF4 = useMemo(() => {
    return classAverages.f4 !== null || studentMetrics.some(s => s.f4 !== null && s.f4 !== undefined);
  }, [classAverages.f4, studentMetrics]);

  // Macro level trend chart data
  const macroTrendChartData = useMemo(() => {
    const list = [
      {
        name: 'الفرض 1',
        'المعدل العام': classAverages.f1,
        'الشريحة المتفوقة (Q3)': classQuartiles.f1.q3,
        'الوسيط (Median)': classQuartiles.f1.med,
        'شريحة التعثر (Q1)': classQuartiles.f1.q1
      },
      {
        name: 'الفرض 2',
        'المعدل العام': classAverages.f2,
        'الشريحة المتفوقة (Q3)': classQuartiles.f2.q3,
        'الوسيط (Median)': classQuartiles.f2.med,
        'شريحة التعثر (Q1)': classQuartiles.f2.q1
      },
      {
        name: 'الفرض 3',
        'المعدل العام': classAverages.f3,
        'الشريحة المتفوقة (Q3)': classQuartiles.f3.q3,
        'الوسيط (Median)': classQuartiles.f3.med,
        'شريحة التعثر (Q1)': classQuartiles.f3.q1
      }
    ];

    if (classAverages.f4 !== null) {
      list.push({
        name: 'الفرض 4 (ع. رياضية)',
        'المعدل العام': classAverages.f4,
        'الشريحة المتفوقة (Q3)': classQuartiles.f4?.q3 ?? null,
        'الوسيط (Median)': classQuartiles.f4?.med ?? null,
        'شريحة التعثر (Q1)': classQuartiles.f4?.q1 ?? null
      });
    }

    return list.filter(d => d['المعدل العام'] !== null);
  }, [classAverages, classQuartiles]);

  // Filtered & sorted student list
  const filteredStudents = useMemo(() => {
    return studentMetrics
      .filter(m => {
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const matchName = m.name.toLowerCase().includes(q);
          const matchMassar = m.massar.toLowerCase().includes(q);
          if (!matchName && !matchMassar) return false;
        }

        if (cohortFilter === 'top') return m.avg !== null && m.avg >= 14;
        if (cohortFilter === 'medium') return m.avg !== null && m.avg >= 10 && m.avg < 14;
        if (cohortFilter === 'at_risk') return m.avg !== null && m.avg < 10;
        if (cohortFilter === 'improving') return m.trajectory === 'improving';
        if (cohortFilter === 'declining') return m.trajectory === 'declining';
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (valA === null || valA === undefined) valA = sortAsc ? 999 : -999;
        if (valB === null || valB === undefined) valB = sortAsc ? 999 : -999;
        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [studentMetrics, searchQuery, cohortFilter, sortField, sortAsc]);

  // Multi-student comparison chart data
  const multiStudentChartData = useMemo(() => {
    const exams = [
      { key: 'f1', name: 'الفرض 1', classAvg: classAverages.f1 },
      { key: 'f2', name: 'الفرض 2', classAvg: classAverages.f2 },
      { key: 'f3', name: 'الفرض 3', classAvg: classAverages.f3 }
    ];

    if (hasF4) {
      exams.push({ key: 'f4', name: 'الفرض 4', classAvg: classAverages.f4 });
    }

    return exams.map(ex => {
      const point: any = { name: ex.name, 'معدل القسم': ex.classAvg };
      selectedStudentIds.forEach(id => {
        const std = studentMetrics.find(s => s.id === id);
        if (std) {
          point[std.name] = (std as any)[ex.key];
        }
      });
      return point;
    });
  }, [selectedStudentIds, studentMetrics, classAverages, hasF4]);

  const toggleStudentSelection = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(prev => prev.filter(id => id !== studentId));
    } else {
      if (selectedStudentIds.length >= 6) {
        setSelectedStudentIds(prev => [...prev.slice(1), studentId]);
      } else {
        setSelectedStudentIds(prev => [...prev, studentId]);
      }
    }
  };

  const handleExportCsv = () => {
    if (!studentMetrics || studentMetrics.length === 0) return;
    const bom = '\uFEFF';
    const headers = ['الرقم والاسم', 'القسم', 'الفرض 1', 'الفرض 2', 'الفرض 3', 'معدل الدورة', 'أفضل فرض (الذروة)', 'مسمى الفرض', 'الفارق عن معدل القسم', 'فجوة الطاقات الكامنة', 'مسار التطور'];
    const rows = studentMetrics.map(s => [
      `"${s.name}"`,
      `"${s.className}"`,
      s.f1 !== null ? s.f1 : '',
      s.f2 !== null ? s.f2 : '',
      s.f3 !== null ? s.f3 : '',
      s.avg !== null ? s.avg : '',
      s.bestMark !== null ? s.bestMark : '',
      `"${s.bestExamTitle}"`,
      s.gapVsClass !== null ? s.gapVsClass : '',
      s.potentialGap,
      `"${s.trajectory === 'improving' ? 'تصاعدي' : s.trajectory === 'declining' ? 'تراجعي' : 'مستقر'}"`
    ]);
    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تحليل_الفروض_${selectedClass}_${semester}.csv`;
    link.click();
  };

  // تصدير مباشر لبنية إكسيل مسار الرسمية المعتمدة
  const handleDirectMassarExcelExport = () => {
    if (!studentMetrics || studentMetrics.length === 0) return;
    const XLSXLib = typeof window !== 'undefined' ? (window as any).XLSX : null;
    if (XLSXLib && XLSXLib.utils) {
      const sheetData = studentMetrics.map((s, idx) => ({
        'الرقم الترتيبي': idx + 1,
        'رقم مسار (Code Massar)': s.massar || s.id,
        'الاسم والنسب': s.name,
        'القسم': s.className,
        'الفرض المحروس 1 (/20)': s.f1 !== null ? s.f1 : '',
        'الفرض المحروس 2 (/20)': s.f2 !== null ? s.f2 : '',
        'الفرض المحروس 3 (/20)': s.f3 !== null ? s.f3 : '',
        'معدل المراقبة المستمرة (/20)': s.avg !== null ? s.avg : '',
        'التقدير التربوي لمسار': getMoroccanAppreciation(s.avg).text
      }));
      const ws = XLSXLib.utils.json_to_sheet(sheetData);
      const wb = XLSXLib.utils.book_new();
      XLSXLib.utils.book_append_sheet(wb, ws, selectedClass === 'all' ? 'Massar_All' : selectedClass.slice(0, 28));
      XLSXLib.writeFile(wb, `Massar_Notes_${selectedClass}_${semester === 's1' ? 'S1' : 'S2'}.xlsx`);
    } else {
      handleExportCsv();
    }
  };

  // =========================================================================
  // حساب مقارنة نسب الغياب ونسب النجاح في الفروض الموحدة لكل قسم
  // Class-by-Class Longitudinal Comparison: Absence Rates vs. Exam Success
  // =========================================================================
  const classAbsenceSuccessComparison = useMemo(() => {
    if (!db || !db.classes) return [];

    return classNames.map(cName => {
      const students = Array.isArray(db.classes[cName])
        ? db.classes[cName]
        : (db.classes[cName]?.students || []);
      const studentCount = students.length;

      const classRecords = (db.records || []).filter((r: any) => r.className === cName);
      const absentRecords = classRecords.filter((r: any) => r.status === 'غائب' || r.status === 'مبرر');
      const totalAbsentHours = absentRecords.reduce((sum: number, r: any) => sum + (parseFloat(r.duration || r.hours) || 1), 0);
      const lateRecordsCount = classRecords.filter((r: any) => r.status === 'متأخر').length;

      // Calculate distinct recorded sessions
      const sessionSet = new Set(classRecords.map((r: any) => (r.date || '') + '|||' + (r.session || '')));
      const totalSessions = Math.max(1, sessionSet.size);
      const totalScheduledAttendances = studentCount * totalSessions;

      let absenceRatePercent = 0;
      if (totalScheduledAttendances > 0 && absentRecords.length > 0) {
        absenceRatePercent = parseFloat(((absentRecords.length / totalScheduledAttendances) * 100).toFixed(1));
      } else if (totalAbsentHours > 0) {
        absenceRatePercent = parseFloat((Math.min(100, (totalAbsentHours / Math.max(1, studentCount * 6)) * 10)).toFixed(1));
      }

      const attendanceRatePercent = Math.max(0, parseFloat((100 - absenceRatePercent).toFixed(1)));
      const avgAbsentHours = studentCount > 0 ? parseFloat((totalAbsentHours / studentCount).toFixed(1)) : 0;

      // Extract exam grades for this class
      const classGrades = (db.grades && db.grades[cName]) ? db.grades[cName] : {};
      let f1PassCount = 0;
      let f1TotalTested = 0;
      let f1GradeSum = 0;

      let f2PassCount = 0;
      let f2TotalTested = 0;
      let f2GradeSum = 0;

      let f3PassCount = 0;
      let f3TotalTested = 0;
      let f3GradeSum = 0;

      let overallPassCount = 0; // >= 10
      let overallDistinctionCount = 0; // >= 12
      let overallExcellenceCount = 0; // >= 14
      let overallAtRiskCount = 0; // < 10
      let overallTestedStudents = 0;
      let overallGradeSum = 0;

      students.forEach((std: any) => {
        const f1 = getStudentExamGrade(classGrades, std.id, semester, 'f1');
        const f2 = getStudentExamGrade(classGrades, std.id, semester, 'f2');
        const f3 = getStudentExamGrade(classGrades, std.id, semester, 'f3');
        const f4 = getStudentExamGrade(classGrades, std.id, semester, 'f4');

        if (f1 !== null) {
          f1TotalTested++;
          f1GradeSum += f1;
          if (f1 >= 10) f1PassCount++;
        }
        if (f2 !== null) {
          f2TotalTested++;
          f2GradeSum += f2;
          if (f2 >= 10) f2PassCount++;
        }
        if (f3 !== null) {
          f3TotalTested++;
          f3GradeSum += f3;
          if (f3 >= 10) f3PassCount++;
        }

        const validMarks = [f1, f2, f3, f4].filter(v => v !== null) as number[];
        if (validMarks.length > 0) {
          overallTestedStudents++;
          const stdExamAvg = validMarks.reduce((a, b) => a + b, 0) / validMarks.length;
          overallGradeSum += stdExamAvg;
          if (stdExamAvg >= 10) overallPassCount++;
          if (stdExamAvg >= 12) overallDistinctionCount++;
          if (stdExamAvg >= 14) overallExcellenceCount++;
          if (stdExamAvg < 10) overallAtRiskCount++;
        }
      });

      const f1SuccessRate = f1TotalTested > 0 ? parseFloat(((f1PassCount / f1TotalTested) * 100).toFixed(1)) : 0;
      const f1AvgGrade = f1TotalTested > 0 ? parseFloat((f1GradeSum / f1TotalTested).toFixed(2)) : 0;

      const f2SuccessRate = f2TotalTested > 0 ? parseFloat(((f2PassCount / f2TotalTested) * 100).toFixed(1)) : 0;
      const f2AvgGrade = f2TotalTested > 0 ? parseFloat((f2GradeSum / f2TotalTested).toFixed(2)) : 0;

      const f3SuccessRate = f3TotalTested > 0 ? parseFloat(((f3PassCount / f3TotalTested) * 100).toFixed(1)) : 0;
      const f3AvgGrade = f3TotalTested > 0 ? parseFloat((f3GradeSum / f3TotalTested).toFixed(2)) : 0;

      const overallSuccessRate = overallTestedStudents > 0
        ? parseFloat(((overallPassCount / overallTestedStudents) * 100).toFixed(1))
        : 0;
      const overallDistinctionRate = overallTestedStudents > 0
        ? parseFloat(((overallDistinctionCount / overallTestedStudents) * 100).toFixed(1))
        : 0;
      const overallExcellenceRate = overallTestedStudents > 0
        ? parseFloat(((overallExcellenceCount / overallTestedStudents) * 100).toFixed(1))
        : 0;
      const overallAtRiskRate = overallTestedStudents > 0
        ? parseFloat(((overallAtRiskCount / overallTestedStudents) * 100).toFixed(1))
        : 0;
      const overallExamAverage = overallTestedStudents > 0
        ? parseFloat((overallGradeSum / overallTestedStudents).toFixed(2))
        : 0;

      // Determine pedagogical impact index
      let impactCategory: 'high_negative' | 'moderate' | 'disciplined' = 'disciplined';
      if (absenceRatePercent >= 8 || (avgAbsentHours >= 6 && overallSuccessRate < 65)) {
        impactCategory = 'high_negative';
      } else if (absenceRatePercent >= 4 || overallSuccessRate < 75) {
        impactCategory = 'moderate';
      }

      return {
        className: cName,
        studentCount,
        totalAbsentHours,
        avgAbsentHours,
        absenceRatePercent,
        attendanceRatePercent,
        lateRecordsCount,
        f1TestedCount: f1TotalTested,
        f1SuccessRate,
        f1AvgGrade,
        f2TestedCount: f2TotalTested,
        f2SuccessRate,
        f2AvgGrade,
        f3TestedCount: f3TotalTested,
        f3SuccessRate,
        f3AvgGrade,
        overallTestedStudents,
        overallSuccessRate,
        overallDistinctionRate,
        overallExcellenceRate,
        overallAtRiskRate,
        overallExamAverage,
        impactCategory
      };
    });
  }, [db, classNames, semester]);

  const overallAbsenceSuccessKPIs = useMemo(() => {
    if (classAbsenceSuccessComparison.length === 0) {
      return {
        avgSuccessRate: 0,
        avgAbsenceRate: 0,
        topClassBySuccess: '-',
        bestDisciplinedClass: '-',
        totalTestedAllClasses: 0,
        totalAbsentHoursAllClasses: 0
      };
    }
    const totalTested = classAbsenceSuccessComparison.reduce((s, c) => s + c.overallTestedStudents, 0);
    const totalHours = classAbsenceSuccessComparison.reduce((s, c) => s + c.totalAbsentHours, 0);
    const avgSuccess = parseFloat((classAbsenceSuccessComparison.reduce((s, c) => s + c.overallSuccessRate, 0) / classAbsenceSuccessComparison.length).toFixed(1));
    const avgAbsence = parseFloat((classAbsenceSuccessComparison.reduce((s, c) => s + c.absenceRatePercent, 0) / classAbsenceSuccessComparison.length).toFixed(1));

    const sortedBySuccess = [...classAbsenceSuccessComparison].sort((a, b) => b.overallSuccessRate - a.overallSuccessRate);
    const sortedByDiscipline = [...classAbsenceSuccessComparison].sort((a, b) => a.absenceRatePercent - b.absenceRatePercent);

    return {
      avgSuccessRate: avgSuccess,
      avgAbsenceRate: avgAbsence,
      topClassBySuccess: sortedBySuccess[0]?.className || '-',
      bestDisciplinedClass: sortedByDiscipline[0]?.className || '-',
      totalTestedAllClasses: totalTested,
      totalAbsentHoursAllClasses: totalHours
    };
  }, [classAbsenceSuccessComparison]);

  // =========================================================================
  // التحليل الإحصائي المدمج: دمج مسار النقط السنوي (د1 + د2) مع مؤشرات التقدم الأكاديمي الحالي
  // Consolidated Statistical Analysis: Yearly Grade Trends + Current Academic Progress Metrics
  // =========================================================================
  const annualConsolidatedStats = useMemo(() => {
    if (!db || !db.classes) {
      return {
        stationsChartData: [],
        s1ClassAvg: null as number | null,
        s2ClassAvg: null as number | null,
        annualClassAvg: null as number | null,
        yearlyGrowthDelta: 0,
        annualPassPct: 0,
        annualExcellencePct: 0,
        annualStdDev: null as number | null,
        currentSemesterCompletionPct: 0,
        yearlyExamCompletionPct: 0,
        attendanceRatePct: 100,
        recordedSessionsCount: 0,
        momentumCounts: { accelerating: 0, sustained_mastery: 0, recovering: 0, at_risk: 0 },
        studentProgressRows: [] as any[],
        absenceGradeBrackets: [] as any[],
        studentAbsenceGradePoints: [] as any[],
        absenceGradeCorrelationR: null as number | null,
        zeroAbsenceAvgGrade: null as number | null,
        highAbsenceAvgGrade: null as number | null,
        attendanceGradeImpactDelta: null as number | null
      };
    }

    const targetClasses = selectedClass === 'all' ? classNames : [selectedClass];
    const stationBuckets: Record<string, number[]> = {
      s1_f1: [], s1_f2: [], s1_f3: [], s1_avg: [],
      s2_f1: [], s2_f2: [], s2_f3: [], s2_avg: [],
      annual_avg: []
    };

    const studentRows: any[] = [];
    let totalScheduledCurrentExams = 0;
    let totalCompletedCurrentExams = 0;
    let totalScheduledYearlyExams = 0;
    let totalCompletedYearlyExams = 0;

    // Attendance & Lesson progress for target classes
    const relevantRecords = (db.records || []).filter((r: any) =>
      selectedClass === 'all' ? true : r.className === selectedClass
    );
    const sessionSet = new Set(relevantRecords.map((r: any) => `${r.className || ''}|${r.date || ''}|${r.session || ''}`));
    const recordedSessionsCount = sessionSet.size;

    const studentAbsenceMap: Record<string, number> = {};
    relevantRecords.forEach((r: any) => {
      if (r.status === 'غائب' || r.status === 'مبرر') {
        const hrs = parseFloat(r.duration || r.hours) || 1;
        const key = `${r.className}___${r.studentId || r.name}`;
        studentAbsenceMap[key] = (studentAbsenceMap[key] || 0) + hrs;
      }
    });

    const momentumCounts = {
      accelerating: 0,
      sustained_mastery: 0,
      recovering: 0,
      at_risk: 0
    };

    targetClasses.forEach(cName => {
      const classGrades = (db.grades && db.grades[cName]) ? db.grades[cName] : {};
      const students = Array.isArray(db.classes[cName])
        ? db.classes[cName]
        : (db.classes[cName]?.students || []);

      students.forEach((std: any) => {
        const s1_f1 = getStudentExamGrade(classGrades, std.id, 's1', 'f1');
        const s1_f2 = getStudentExamGrade(classGrades, std.id, 's1', 'f2');
        const s1_f3 = getStudentExamGrade(classGrades, std.id, 's1', 'f3');
        const s1_f4 = getStudentExamGrade(classGrades, std.id, 's1', 'f4');

        const s2_f1 = getStudentExamGrade(classGrades, std.id, 's2', 'f1');
        const s2_f2 = getStudentExamGrade(classGrades, std.id, 's2', 'f2');
        const s2_f3 = getStudentExamGrade(classGrades, std.id, 's2', 'f3');
        const s2_f4 = getStudentExamGrade(classGrades, std.id, 's2', 'f4');

        if (s1_f1 !== null) stationBuckets.s1_f1.push(s1_f1);
        if (s1_f2 !== null) stationBuckets.s1_f2.push(s1_f2);
        if (s1_f3 !== null) stationBuckets.s1_f3.push(s1_f3);

        if (s2_f1 !== null) stationBuckets.s2_f1.push(s2_f1);
        if (s2_f2 !== null) stationBuckets.s2_f2.push(s2_f2);
        if (s2_f3 !== null) stationBuckets.s2_f3.push(s2_f3);

        const s1Valid = [s1_f1, s1_f2, s1_f3, s1_f4].filter((v): v is number => v !== null);
        const s2Valid = [s2_f1, s2_f2, s2_f3, s2_f4].filter((v): v is number => v !== null);

        const s1Avg = s1Valid.length > 0
          ? parseFloat((s1Valid.reduce((a, b) => a + b, 0) / s1Valid.length).toFixed(2))
          : null;
        const s2Avg = s2Valid.length > 0
          ? parseFloat((s2Valid.reduce((a, b) => a + b, 0) / s2Valid.length).toFixed(2))
          : null;

        if (s1Avg !== null) stationBuckets.s1_avg.push(s1Avg);
        if (s2Avg !== null) stationBuckets.s2_avg.push(s2Avg);

        let annualAvg: number | null = null;
        if (s1Avg !== null && s2Avg !== null) {
          annualAvg = parseFloat(((s1Avg + s2Avg) / 2).toFixed(2));
        } else if (s1Avg !== null) {
          annualAvg = s1Avg;
        } else if (s2Avg !== null) {
          annualAvg = s2Avg;
        }

        if (annualAvg !== null) stationBuckets.annual_avg.push(annualAvg);

        // Current Academic Progress tracking
        const currentSemMarks = semester === 's2' ? s2Valid : s1Valid;
        const currentSemAvg = semester === 's2' ? s2Avg : s1Avg;
        const currentExamCompletedCount = currentSemMarks.length;
        const yearlyExamCompletedCount = s1Valid.length + s2Valid.length;

        totalScheduledCurrentExams += 3;
        totalCompletedCurrentExams += Math.min(3, currentExamCompletedCount);
        totalScheduledYearlyExams += 6;
        totalCompletedYearlyExams += Math.min(6, yearlyExamCompletedCount);

        const allChronological = [s1_f1, s1_f2, s1_f3, s1_f4, s2_f1, s2_f2, s2_f3, s2_f4].filter((v): v is number => v !== null);
        const firstMark = allChronological.length > 0 ? allChronological[0] : null;
        const latestMark = allChronological.length > 0 ? allChronological[allChronological.length - 1] : null;

        let yearlyDelta: number | null = null;
        if (s1Avg !== null && s2Avg !== null) {
          yearlyDelta = parseFloat((s2Avg - s1Avg).toFixed(2));
        } else if (firstMark !== null && latestMark !== null && allChronological.length >= 2) {
          yearlyDelta = parseFloat((latestMark - firstMark).toFixed(2));
        }

        // Classify combined yearly + current academic momentum
        let momentumStatus: 'accelerating' | 'sustained_mastery' | 'recovering' | 'at_risk' = 'sustained_mastery';
        const effectiveCurrent = currentSemAvg ?? annualAvg ?? latestMark;
        const baselineMark = s1Avg ?? firstMark;

        if (effectiveCurrent !== null && effectiveCurrent < 10) {
          momentumStatus = 'at_risk';
          momentumCounts.at_risk++;
        } else if (baselineMark !== null && baselineMark < 10 && effectiveCurrent !== null && effectiveCurrent >= 10) {
          momentumStatus = 'recovering';
          momentumCounts.recovering++;
        } else if (yearlyDelta !== null && yearlyDelta >= 0.75) {
          momentumStatus = 'accelerating';
          momentumCounts.accelerating++;
        } else if (effectiveCurrent !== null && effectiveCurrent >= 10) {
          momentumStatus = 'sustained_mastery';
          momentumCounts.sustained_mastery++;
        } else {
          momentumStatus = 'at_risk';
          momentumCounts.at_risk++;
        }

        const absHours =
          studentAbsenceMap[`${cName}___${std.id}`] ||
          studentAbsenceMap[`${cName}___${std.name}`] ||
          0;

        studentRows.push({
          id: String(std.id),
          name: std.name || 'تلميذ(ة)',
          massar: std.massar || std.id || '',
          className: cName,
          s1_f1, s1_f2, s1_f3, s1Avg,
          s2_f1, s2_f2, s2_f3, s2Avg,
          annualAvg,
          currentSemAvg,
          latestMark,
          yearlyDelta,
          currentCompletionPct: Math.round((currentExamCompletedCount / 3) * 100),
          yearlyCompletionPct: Math.round((yearlyExamCompletedCount / 6) * 100),
          yearlyExamCompletedCount,
          absentHours: absHours,
          momentumStatus
        });
      });
    });

    const calcStationStats = (arr: number[], label: string, code: string) => {
      if (arr.length === 0) {
        return {
          code,
          name: label,
          'المعدل العام': null as number | null,
          'الشريحة المتفوقة (Q3)': null as number | null,
          'الوسيط (Median)': null as number | null,
          'شريحة التعثر (Q1)': null as number | null,
          'نسبة النجاح (%)': 0,
          count: 0
        };
      }
      const sorted = [...arr].sort((a, b) => a - b);
      const mean = parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2));
      const q = (p: number) => {
        const idx = p * (sorted.length - 1);
        const l = Math.floor(idx);
        const u = Math.ceil(idx);
        return parseFloat((sorted[l] + (sorted[u] - sorted[l]) * (idx - l)).toFixed(2));
      };
      const passPct = Math.round((arr.filter(v => v >= 10).length / arr.length) * 100);
      return {
        code,
        name: label,
        'المعدل العام': mean,
        'الشريحة المتفوقة (Q3)': q(0.75),
        'الوسيط (Median)': q(0.5),
        'شريحة التعثر (Q1)': q(0.25),
        'نسبة النجاح (%)': passPct,
        count: arr.length
      };
    };

    const rawStations = [
      calcStationStats(stationBuckets.s1_f1, 'د1 - فرض 1', 's1_f1'),
      calcStationStats(stationBuckets.s1_f2, 'د1 - فرض 2', 's1_f2'),
      calcStationStats(stationBuckets.s1_f3, 'د1 - فرض 3', 's1_f3'),
      calcStationStats(stationBuckets.s1_avg, 'معدل د1 (S1)', 's1_avg'),
      calcStationStats(stationBuckets.s2_f1, 'د2 - فرض 1', 's2_f1'),
      calcStationStats(stationBuckets.s2_f2, 'د2 - فرض 2', 's2_f2'),
      calcStationStats(stationBuckets.s2_f3, 'د2 - فرض 3', 's2_f3'),
      calcStationStats(stationBuckets.s2_avg, 'معدل د2 (S2)', 's2_avg'),
      calcStationStats(stationBuckets.annual_avg, 'المعدل السنوي', 'annual_avg')
    ];

    const stationsChartData = rawStations.filter(st => st['المعدل العام'] !== null);

    const s1ClassAvg = rawStations.find(s => s.code === 's1_avg')?.['المعدل العام'] ?? null;
    const s2ClassAvg = rawStations.find(s => s.code === 's2_avg')?.['المعدل العام'] ?? null;
    const annualClassAvg = rawStations.find(s => s.code === 'annual_avg')?.['المعدل العام'] ?? null;

    let yearlyGrowthDelta = 0;
    if (s1ClassAvg !== null && s2ClassAvg !== null) {
      yearlyGrowthDelta = parseFloat((s2ClassAvg - s1ClassAvg).toFixed(2));
    } else if (stationsChartData.length >= 2) {
      const firstVal = stationsChartData[0]['المعدل العام'] || 0;
      const lastVal = stationsChartData[stationsChartData.length - 1]['المعدل العام'] || 0;
      yearlyGrowthDelta = parseFloat((lastVal - firstVal).toFixed(2));
    }

    const annArr = stationBuckets.annual_avg;
    const annualPassPct = annArr.length > 0 ? Math.round((annArr.filter(v => v >= 10).length / annArr.length) * 100) : 0;
    const annualExcellencePct = annArr.length > 0 ? Math.round((annArr.filter(v => v >= 14).length / annArr.length) * 100) : 0;

    let annualStdDev: number | null = null;
    if (annArr.length > 0 && annualClassAvg !== null) {
      const variance = annArr.reduce((acc, v) => acc + Math.pow(v - annualClassAvg, 2), 0) / annArr.length;
      annualStdDev = parseFloat(Math.sqrt(variance).toFixed(2));
    }

    const currentSemesterCompletionPct = totalScheduledCurrentExams > 0
      ? Math.round((totalCompletedCurrentExams / totalScheduledCurrentExams) * 100)
      : 0;
    const yearlyExamCompletionPct = totalScheduledYearlyExams > 0
      ? Math.round((totalCompletedYearlyExams / totalScheduledYearlyExams) * 100)
      : 0;

    const matchingClassAbs = selectedClass === 'all'
      ? overallAbsenceSuccessKPIs.avgAbsenceRate
      : (classAbsenceSuccessComparison.find(c => c.className === selectedClass)?.absenceRatePercent ?? 0);
    const attendanceRatePct = parseFloat(Math.max(0, 100 - matchingClassAbs).toFixed(1));

    // Compute Absence Hours vs. Student Grade Averages Correlation
    const bracketDefs = [
      { key: '0h', label: '0 ساعة (مواظبة تامة)', min: 0, max: 0, grades: [] as number[], color: '#10b981' },
      { key: '1_2h', label: '1 - 2 س (غياب طفيف)', min: 0.1, max: 2.5, grades: [] as number[], color: '#3b82f6' },
      { key: '3_5h', label: '3 - 5 س (غياب متوسط)', min: 2.51, max: 5.5, grades: [] as number[], color: '#f59e0b' },
      { key: '6_9h', label: '6 - 9 س (غياب مرتفع)', min: 5.51, max: 9.5, grades: [] as number[], color: '#f97316' },
      { key: '10h_plus', label: '≥ 10 س (غياب حرج)', min: 9.51, max: 9999, grades: [] as number[], color: '#ef4444' }
    ];

    const evaluatedWithGrades = studentRows.filter(r => (r.annualAvg ?? r.currentSemAvg) !== null);
    evaluatedWithGrades.forEach(r => {
      const g = (r.annualAvg ?? r.currentSemAvg) as number;
      const h = r.absentHours || 0;
      if (h === 0) bracketDefs[0].grades.push(g);
      else if (h <= 2.5) bracketDefs[1].grades.push(g);
      else if (h <= 5.5) bracketDefs[2].grades.push(g);
      else if (h <= 9.5) bracketDefs[3].grades.push(g);
      else bracketDefs[4].grades.push(g);
    });

    const absenceGradeBrackets = bracketDefs.map(b => {
      const count = b.grades.length;
      const avgGrade = count > 0
        ? parseFloat((b.grades.reduce((s, v) => s + v, 0) / count).toFixed(2))
        : null;
      const passRate = count > 0
        ? Math.round((b.grades.filter(v => v >= 10).length / count) * 100)
        : 0;
      return {
        name: b.label,
        'معدل التلاميذ (/20)': avgGrade,
        'نسبة النجاح (%)': passRate,
        count,
        color: b.color
      };
    });

    // Individual student points sorted by absentHours descending (then grade) for visual clarity
    const studentAbsenceGradePoints = [...evaluatedWithGrades]
      .sort((a, b) => (b.absentHours - a.absentHours) || ((a.annualAvg ?? 0) - (b.annualAvg ?? 0)))
      .slice(0, 35)
      .map(r => ({
        name: r.name,
        className: r.className,
        'ساعات الغياب': r.absentHours,
        'المعدل الدراسي (/20)': r.annualAvg ?? r.currentSemAvg,
        passStatus: (r.annualAvg ?? r.currentSemAvg ?? 0) >= 10 ? 'مستوفٍ' : 'متعثر'
      }));

    // Pearson Correlation Coefficient r between absentHours and grade
    let absenceGradeCorrelationR: number | null = null;
    if (evaluatedWithGrades.length >= 3) {
      const n = evaluatedWithGrades.length;
      const xs = evaluatedWithGrades.map(r => r.absentHours || 0);
      const ys = evaluatedWithGrades.map(r => (r.annualAvg ?? r.currentSemAvg) as number);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0, denX = 0, denY = 0;
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - meanX;
        const dy = ys[i] - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      if (denX > 0 && denY > 0) {
        absenceGradeCorrelationR = parseFloat((num / Math.sqrt(denX * denY)).toFixed(2));
      }
    }

    const zeroAbsenceAvgGrade = absenceGradeBrackets[0]['معدل التلاميذ (/20)'];
    const highAbsGrades = [...bracketDefs[2].grades, ...bracketDefs[3].grades, ...bracketDefs[4].grades];
    const highAbsenceAvgGrade = highAbsGrades.length > 0
      ? parseFloat((highAbsGrades.reduce((a, b) => a + b, 0) / highAbsGrades.length).toFixed(2))
      : null;
    const attendanceGradeImpactDelta = (zeroAbsenceAvgGrade !== null && highAbsenceAvgGrade !== null)
      ? parseFloat((zeroAbsenceAvgGrade - highAbsenceAvgGrade).toFixed(2))
      : null;

    return {
      stationsChartData,
      s1ClassAvg,
      s2ClassAvg,
      annualClassAvg,
      yearlyGrowthDelta,
      annualPassPct,
      annualExcellencePct,
      annualStdDev,
      currentSemesterCompletionPct,
      yearlyExamCompletionPct,
      attendanceRatePct,
      recordedSessionsCount,
      momentumCounts,
      studentProgressRows: studentRows,
      absenceGradeBrackets,
      studentAbsenceGradePoints,
      absenceGradeCorrelationR,
      zeroAbsenceAvgGrade,
      highAbsenceAvgGrade,
      attendanceGradeImpactDelta
    };
  }, [db, selectedClass, classNames, semester, overallAbsenceSuccessKPIs, classAbsenceSuccessComparison]);

  // =========================================================================
  // منظومة التحليل الإحصائي السيكومتري المتقدم والتوجيه التربوي والمدرسي
  // Advanced Psychometric Statistical Analysis & Moroccan Pedagogical Guidance Engine
  // =========================================================================
  const advancedStatisticalAndGuidanceMatrix = useMemo(() => {
    const validStudents = studentMetrics.filter(s => s.avg !== null);
    const avgs = validStudents.map(s => s.avg as number).sort((a, b) => a - b);
    const n = avgs.length;

    const getQuantile = (sorted: number[], p: number): number | null => {
      if (sorted.length === 0) return null;
      const idx = p * (sorted.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      return parseFloat((sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)).toFixed(2));
    };

    const mean = n > 0 ? parseFloat((avgs.reduce((a, b) => a + b, 0) / n).toFixed(2)) : null;
    const median = getQuantile(avgs, 0.5);
    const q1 = getQuantile(avgs, 0.25);
    const q3 = getQuantile(avgs, 0.75);
    const iqr = q1 !== null && q3 !== null ? parseFloat((q3 - q1).toFixed(2)) : null;

    let stdDev: number | null = null;
    let variance: number | null = null;
    if (n > 0 && mean !== null) {
      const v = avgs.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / n;
      variance = parseFloat(v.toFixed(2));
      stdDev = parseFloat(Math.sqrt(v).toFixed(2));
    }

    // Coefficient of Variation CV = (stdDev / mean) * 100
    const cvPercent = mean && mean > 0 && stdDev !== null
      ? parseFloat(((stdDev / mean) * 100).toFixed(1))
      : null;

    let homogeneityStatus: { label: string; badge: string; color: string; advice: string } = {
      label: 'غير متاح',
      badge: 'بدون معطيات',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      advice: 'أدخل نقط الفروض لحساب معامل التجانس السيكومتري.'
    };

    if (cvPercent !== null) {
      if (cvPercent < 16) {
        homogeneityStatus = {
          label: 'قسم متجانس جداً',
          badge: `CV = ${cvPercent}% (تجانس عالٍ)`,
          color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
          advice: 'تقارب كبير في مستويات التلاميذ؛ يُنصح باعتماد إيقاع بيداغوجي موحد مع إدماج وضعيات توليفية للارتقاء بالجميع.'
        };
      } else if (cvPercent <= 26) {
        homogeneityStatus = {
          label: 'تجانس متوسط (طبيعي)',
          badge: `CV = ${cvPercent}% (تشتت معتدل)`,
          color: 'text-blue-800 bg-blue-50 border-blue-200',
          advice: 'توزيع طبيعي للفروق الفردية؛ يُوصى بتفعيل الدعم المندمج عقب كل فرض محروس لفائدة الفئة دون المعدل.'
        };
      } else {
        homogeneityStatus = {
          label: 'قسم غير متجانس (فوارق حادة)',
          badge: `CV = ${cvPercent}% (تشتت مرتفع)`,
          color: 'text-rose-800 bg-rose-50 border-rose-200',
          advice: 'تفاوت صارخ بين فئة متفوقة وفئة متعثرة؛ يستوجب إرساء «بيداغوجيا الفارقية» وتفويج المتعلمين إلى مجموعات حاجة (فوج دعم أساسيات / فوج إغناء وتميز).'
        };
      }
    }

    // Pearson Second Skewness Coefficient: Sk = 3 * (Mean - Median) / StdDev
    const skewness = mean !== null && median !== null && stdDev && stdDev > 0
      ? parseFloat(((3 * (mean - median)) / stdDev).toFixed(2))
      : null;

    let skewnessInterpretation = 'توزيع متماثل متوازن حول المعدل';
    if (skewness !== null) {
      if (skewness < -0.25) {
        skewnessInterpretation = 'التواء سالب (تمركز أغلبية القسم في الفئات المستحسنة والعليا مع وجود أقلية متعثرة تسحب المتوسط للأسفل)';
      } else if (skewness > 0.25) {
        skewnessInterpretation = 'التواء موجب (تمركز أغلبية النقط في الفئات الدنيا والمتوسطة مع وجود نخبة قليلة ترفع المعدل العام)';
      }
    }

    // Psychometric Exam Station Analysis (Difficulty Index P% & Discrimination Index D for F1..F4)
    const examKeys: Array<{ key: 'f1' | 'f2' | 'f3' | 'f4'; title: string }> = [
      { key: 'f1', title: 'الفرض المحروس 1' },
      { key: 'f2', title: 'الفرض المحروس 2' },
      { key: 'f3', title: 'الفرض المحروس 3' },
      { key: 'f4', title: 'الفرض المحروس 4' }
    ];

    const examPsychometrics = examKeys.map(({ key, title }) => {
      const marks = studentMetrics
        .map(s => (key === 'f4' ? (s.f4 ?? null) : s[key]))
        .filter((v): v is number => v !== null)
        .sort((a, b) => b - a); // Descending for top 27% vs bottom 27%

      if (marks.length === 0) return null;
      const exMean = parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2));
      const difficultyIdxPct = Math.round((exMean / 20) * 100); // Facilitation / Mastery index (0-100%)
      const k = Math.max(1, Math.round(marks.length * 0.27));
      const topGroupMean = marks.slice(0, k).reduce((a, b) => a + b, 0) / k;
      const bottomGroupMean = marks.slice(marks.length - k).reduce((a, b) => a + b, 0) / k;
      const discriminationIdx = parseFloat(((topGroupMean - bottomGroupMean) / 20).toFixed(2));

      let psychometricVerdict = 'متوازن ومميز بيداغوجياً';
      if (difficultyIdxPct < 42) psychometricVerdict = 'فرض مرتفع الصعوبة (يستوجب مراجعة تدرج الأسئلة)';
      else if (difficultyIdxPct > 78) psychometricVerdict = 'فرض ميسر جداً (ضعيف التحدي للفئة المتميزة)';
      else if (discriminationIdx >= 0.30) psychometricVerdict = 'قدرة تمييزية عالية جداً ومطابقة للمذكرة 142';
      else if (discriminationIdx < 0.18) psychometricVerdict = 'ضعيف التمييز بين الفئات (توزيع متقارب)';

      return {
        key,
        title,
        testedCount: marks.length,
        mean: exMean,
        difficultyIdxPct,
        discriminationIdx,
        topGroupMean: parseFloat(topGroupMean.toFixed(2)),
        bottomGroupMean: parseFloat(bottomGroupMean.toFixed(2)),
        psychometricVerdict
      };
    }).filter(Boolean) as Array<{
      key: string;
      title: string;
      testedCount: number;
      mean: number;
      difficultyIdxPct: number;
      discriminationIdx: number;
      topGroupMean: number;
      bottomGroupMean: number;
      psychometricVerdict: string;
    }>;

    // Helper to infer official Moroccan Math Coefficient & Level from className
    const resolveClassLevelAndCoef = (cName: string) => {
      const u = (cName || '').toUpperCase();
      if (u.includes('SM')) {
        return { level: u.includes('1BAC') ? '1BAC_SM' : '2BAC_SM', coef: 9, streamLabel: 'العلوم الرياضية (معامل 9)' };
      }
      if (u.includes('2BAC') && (u.includes('ECO') || u.includes('SGC'))) {
        return { level: '2BAC_ECO', coef: 4, streamLabel: 'العلوم الاقتصادية والتدبير (معامل 4)' };
      }
      if (u.includes('2BAC')) {
        return { level: '2BAC_EXP', coef: 7, streamLabel: 'العلوم الفيزيائية / علوم الحياة والأرض (معامل 7)' };
      }
      if (u.includes('1BAC') && (u.includes('ECO') || u.includes('SGC'))) {
        return { level: '1BAC_ECO', coef: 4, streamLabel: 'الأولى بكالوريا اقتصاد وتدبير (معامل 4)' };
      }
      if (u.includes('1BAC') && (u.includes('L') || u.includes('SH'))) {
        return { level: '1BAC_LIT', coef: 2, streamLabel: 'الأولى بكالوريا آداب وعلوم إنسانية (معامل 2)' };
      }
      if (u.includes('1BAC')) {
        return { level: '1BAC_EXP', coef: 7, streamLabel: 'الأولى بكالوريا علوم تجريبية (معامل 7)' };
      }
      if (u.includes('TCL') || u.includes('LSH')) {
        return { level: 'TCL', coef: 2, streamLabel: 'الجذع المشترك الأدبي والعلوم الإنسانية (معامل 2)' };
      }
      return { level: 'TCS', coef: 4, streamLabel: 'الجذع المشترك العلمي/التكنولوجي (معامل 4)' };
    };

    // Map absence hours from annualConsolidatedStats
    const absByStudentId: Record<string, number> = {};
    annualConsolidatedStats.studentProgressRows.forEach((r: any) => {
      absByStudentId[`${r.className}___${r.id}`] = r.absentHours || 0;
    });

    // Individual Student Orientation & Guidance Profiles
    let smEliteCount = 0;
    let pcSvtReadyCount = 0;
    let supportReorientCount = 0;

    const studentGuidanceList = validStudents.map(std => {
      const avg = std.avg as number;
      const marks = [std.f1, std.f2, std.f3, std.f4 ?? null].filter((v): v is number => v !== null);
      const stdVariance = marks.length > 1
        ? marks.reduce((acc, m) => acc + Math.pow(m - avg, 2), 0) / marks.length
        : 0;
      const regularityStd = parseFloat(Math.sqrt(stdVariance).toFixed(2));
      const zScore = mean !== null && stdDev && stdDev > 0
        ? parseFloat(((avg - mean) / stdDev).toFixed(2))
        : 0;

      const { level, coef, streamLabel } = resolveClassLevelAndCoef(std.className);
      const absentHours = absByStudentId[`${std.className}___${std.id}`] || 0;

      // Stability classification
      let stabilityLabel = 'أداء منتظم ومستقر';
      let stabilityColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      if (regularityStd > 2.8) {
        stabilityLabel = 'تذبذب حاد بين الفروض';
        stabilityColor = 'text-rose-700 bg-rose-50 border-rose-200';
      } else if (regularityStd > 1.6) {
        stabilityLabel = 'استقرار متوسط';
        stabilityColor = 'text-amber-700 bg-amber-50 border-amber-200';
      }

      // Compute Projected National Exam / Final Score based on average, trajectory delta, regularity, and absence penalty
      const deltaBoost = std.delta !== null ? Math.max(-1.5, Math.min(1.5, std.delta * 0.25)) : 0;
      const absencePenalty = absentHours >= 8 ? -1.2 : absentHours >= 4 ? -0.5 : 0;
      const regularityPenalty = regularityStd > 2.8 ? -0.6 : 0;
      const rawProjectedExam = Math.max(2, Math.min(19.75, avg + deltaBoost + absencePenalty + regularityPenalty));
      const projectedNationalExam = parseFloat(rawProjectedExam.toFixed(2));
      const weightedPoints = parseFloat((avg * coef).toFixed(1));

      // Academic Orientation & Guidance Decision based on Level & Psychometric Profile
      let recommendedTrack = '';
      let orientationTier: 'sm_elite' | 'pc_svt' | 'support_reorient' = 'pc_svt';
      let readinessIndexPct = Math.min(99, Math.max(15, Math.round((avg / 20) * 100 + (std.delta && std.delta > 0 ? 5 : 0) - (absentHours > 4 ? 8 : 0))));
      let counselorNote = '';
      let pedagogicalAction = '';

      if (level === 'TCS' || level === 'TCL') {
        if (avg >= 14.5 && std.trajectory !== 'declining' && regularityStd <= 2.5) {
          recommendedTrack = 'مؤهل بامتياز لشعبة العلوم الرياضية (1BAC SM)';
          orientationTier = 'sm_elite';
          smEliteCount++;
          counselorNote = 'بنية استدلالية صلبة وقدرة عالية على التجريد والبرهان الرياضي؛ يُنصح بالتوجيه نحو العلوم الرياضية.';
          pedagogicalAction = 'إغناء بمسائل أولمبياد الرياضيات وتمارين التوليف والبرهان بالخلف وفصل الحالات.';
        } else if (avg >= 11.5) {
          recommendedTrack = 'ملائم جداً لشعبة العلوم التجريبية (1BAC S.Exp) أو العلوم والتكنولوجيات';
          orientationTier = 'pc_svt';
          pcSvtReadyCount++;
          counselorNote = 'تحكم جيد في الآليات الجبرية والدوال العددية يؤهله للنجاح المريح في العلوم التجريبية أو التكنولوجية.';
          pedagogicalAction = 'تقوية مهارات حل المعادلات والمتراجحات وعموميات حول الدوال استعداداً للأولى بكالوريا.';
        } else if (avg >= 10.0) {
          recommendedTrack = 'شعبة العلوم الاقتصادية والتدبير (ECO) أو علوم تجريبية بشرط دعم قبلي';
          orientationTier = 'pc_svt';
          pcSvtReadyCount++;
          counselorNote = 'مستوى مستوفٍ للحد الأدنى؛ يلائمه مسلك العلوم الاقتصادية أو العلوم التجريبية مع مواكبة استدراكية.';
          pedagogicalAction = 'التركيز على الحساب العددي، النظمات، والدوال المرجعية لتفادي التعثر في السنة المقبلة.';
        } else {
          recommendedTrack = 'إعادة توجيه نحو مسالك أدبية/مهنية أو خطة استدراك مكثفة ومشروطة';
          orientationTier = 'support_reorient';
          supportReorientCount++;
          counselorNote = 'نقص واضح في المكتسبات الأساسية للرياضيات يجعل المسالك العلمية عالية المعامل محفوفة بمخاطر التعثر.';
          pedagogicalAction = 'إدماج فوري في خلايا الدعم المؤسساتي لاستدراك تعثرات الحساب الجبري والهندسة المستوية.';
        }
      } else if (level.startsWith('1BAC')) {
        if (level === '1BAC_SM') {
          if (avg >= 13.0) {
            recommendedTrack = 'الاستمرار في مسلك العلوم الرياضية (2BAC SM - أ / ب)';
            orientationTier = 'sm_elite';
            smEliteCount++;
            counselorNote = 'جاهزية عالية لمسايرة إيقاع الثانية بكالوريا علوم رياضية (معامل 9) والمنافسة على الأقسام التحضيرية CPGE.';
            pedagogicalAction = 'تعميق التحكم في المنطق، المتتاليات، النهايات والاشتقاق، والحسابيات.';
          } else if (avg >= 10.5) {
            recommendedTrack = 'علوم رياضية مع دعم منهجي، أو توجيه ذكي لمسلك العلوم الفيزيائية (2BAC PC)';
            orientationTier = 'pc_svt';
            pcSvtReadyCount++;
            counselorNote = 'التحويل لمسلك العلوم الفيزيائية (PC) قد يمنح المتعلم فرصة لتحقيق معدل بكالوريا مرتفع جداً بمجهود متوازن.';
            pedagogicalAction = 'موازنة الكفة بين طموح المسلك الرياضي وضمان ميزة «حسن جداً» في الامتحان الوطني.';
          } else {
            recommendedTrack = 'يُوصى بإعادة التوجيه نحو العلوم الفيزيائية (PC) أو علوم الحياة والأرض (SVT)';
            orientationTier = 'support_reorient';
            supportReorientCount++;
            counselorNote = 'الاستمرار في العلوم الرياضية مع معدل دون 10.5 يشكل مخاطرة كبيرة بسبب ثقل المعامل 9 في الامتحان الوطني.';
            pedagogicalAction = 'جلسة إرشاد مع المستشار في التوجيه التربوي لتأمين المسار الدراسي في مسلك ملائم.';
          }
        } else {
          // 1BAC_EXP / 1BAC_ECO / etc.
          if (avg >= 14.0 && std.trajectory !== 'declining') {
            recommendedTrack = 'تألق متميز في مسلك العلوم الفيزيائية (2BAC PC) وآفاق المدارس العليا';
            orientationTier = 'sm_elite';
            smEliteCount++;
            counselorNote = 'مؤشرات تحصيل ممتازة تؤهل التلميذ للتفوق في مسلك العلوم الفيزيائية واجتياز مباريات الهندسة والطب.';
            pedagogicalAction = 'التدريب المبكر على مسائل شاملة في دراسة الدوال والمتتاليات العددية.';
          } else if (avg >= 10.5) {
            recommendedTrack = 'مسار متوازن في مسلك العلوم الفيزيائية (PC) أو علوم الحياة والأرض (SVT)';
            orientationTier = 'pc_svt';
            pcSvtReadyCount++;
            counselorNote = 'مستوى مستقر يسمح بالنجاح المستحق في مسلكي PC أو SVT شريطة الانتظام في إنجاز سلاسل التمارين.';
            pedagogicalAction = 'تثبيت قواعد الاشتقاق، النهايات، والمتتاليات باعتبارها العمود الفقري لمقرر الثانية بكالوريا.';
          } else {
            recommendedTrack = 'مسلك علوم الحياة والأرض (SVT) مع برنامج دعم استباقي مكثف';
            orientationTier = 'support_reorient';
            supportReorientCount++;
            counselorNote = 'يحتاج إلى تدارك الثغرات المنهجية قبل الانتقال إلى قسم الامتحان الوطني الموحد (معامل 7).';
            pedagogicalAction = 'تخصيص كراسة استدراك صيفية في النهايات والاشتقاق وحل المعادلات.';
          }
        }
      } else {
        // 2BAC Streams -> National Exam & Post-Bac Higher Education Orientation
        if (avg >= 15.0 && projectedNationalExam >= 14.5) {
          recommendedTrack = 'الأقسام التحضيرية (CPGE MPSI/PCSI) · كليات الطب والصيدلة · مدارس المهندسين (ENSA/ENSAM)';
          orientationTier = 'sm_elite';
          smEliteCount++;
          counselorNote = `توقع الامتحان الوطني (${projectedNationalExam}/20) يؤهل التلميذ لولوج أرقى المعاهد والمدارس العليا ذات الاستقطاب المحدود.`;
          pedagogicalAction = 'الاشتغال على مواضيع الامتحانات الوطنية التجريبية ومباريات ولوج المدارس العليا.';
        } else if (avg >= 11.0) {
          recommendedTrack = 'المدارس الوطنية (ENSA/ENSAM) · كليات العلوم والتقنيات (FST) · المدارس العليا للتكنولوجيا (EST)';
          orientationTier = 'pc_svt';
          pcSvtReadyCount++;
          counselorNote = `توقع الامتحان الوطني (${projectedNationalExam}/20) يضمن استيفاءً مريحاً وفرصاً واسعة لولوج المعاهد التطبيقية والجامعية.`;
          pedagogicalAction = 'التركيز على منهجية التحرير النموذجي وفق الإطار المرجعي للامتحان الوطني لكسب نقط المنهجية كاملة.';
        } else {
          recommendedTrack = 'خطة إنقاذ استعجالية للامتحان الوطني الموحد (تأمين عتبة النجاح 10/20)';
          orientationTier = 'support_reorient';
          supportReorientCount++;
          counselorNote = `توقع الامتحان الوطني (${projectedNationalExam}/20) يستدعي تدخلاً فورياً لتفادي النزول عن عتبة الاستيفاء في مادة ذات معامل (${coef}).`;
          pedagogicalAction = 'حصر المراجعة في الأسئلة النمطية المضمونة في الإطار المرجعي (الاتصال والاشتقاق 11ن، المتتاليات 4ن، العقدية 3ن).';
        }
      }

      return {
        ...std,
        coef,
        level,
        streamLabel,
        regularityStd,
        stabilityLabel,
        stabilityColor,
        zScore,
        absentHours,
        projectedNationalExam,
        weightedPoints,
        recommendedTrack,
        orientationTier,
        readinessIndexPct,
        counselorNote,
        pedagogicalAction
      };
    });

    return {
      mean,
      median,
      q1,
      q3,
      iqr,
      stdDev,
      variance,
      cvPercent,
      homogeneityStatus,
      skewness,
      skewnessInterpretation,
      examPsychometrics,
      smEliteCount,
      pcSvtReadyCount,
      supportReorientCount,
      studentGuidanceList
    };
  }, [studentMetrics, annualConsolidatedStats]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPng = async () => {
    if (!containerRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `تقرير_تحليل_الفروض_${selectedClass}_${semester}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('PNG Export failed', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    if (typeof window !== 'undefined' && (window as any).db) {
      setDb({ ...(window as any).db });
    }
  };

  const handleOpenPdfSpec = () => {
    setIsExamFrameworkModalOpen(true);
  };

  const handleOpenMassarExport = () => {
    if (typeof window !== 'undefined' && (window as any).openMassarExportModal) {
      (window as any).openMassarExportModal();
    } else {
      handleDirectMassarExcelExport();
    }
  };

  const handleOpenAbsenceChart = () => {
    if (typeof window !== 'undefined' && (window as any).openGradesAbsenceImpactChartModal) {
      (window as any).openGradesAbsenceImpactChartModal();
    } else if (typeof window !== 'undefined' && (window as any).switchTab) {
      (window as any).switchTab('absence');
    }
  };

  const handleOpenCoefficients = () => {
    if (typeof window !== 'undefined' && (window as any).openMassarCoefficientsModal) {
      (window as any).openMassarCoefficientsModal();
    } else {
      setActiveTab('official_docs');
    }
  };

  if (!db || !db.classes) {
    return (
      <div className="p-12 text-center text-slate-500 font-medium" dir="rtl">
        <Activity className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        جاري تحميل وتحليل بيانات الفروض والمراقبة المستمرة...
      </div>
    );
  }

  const hasAnyGrades =
    studentMetrics.some(m => m.validExamsCount > 0) ||
    annualConsolidatedStats.stationsChartData.length > 0;

  const ANALYSIS_WORKSPACES = [
    {
      id: 'consolidated_annual',
      type: 'tab',
      title: 'مختبر التحليل الإحصائي والتفصيلي المدمج (السنوي + الفصلي + أثر الغياب)',
      subtitle: 'دمج شامل للتحليل الإحصائي السنوي مع مختبر التحليل التفصيلي وفئات التحكم والذروة وعلاقة الغياب بالتحصيل',
      icon: Activity,
      badge: annualConsolidatedStats.annualClassAvg !== null ? `مدمج ${annualConsolidatedStats.annualClassAvg}/20` : 'مختبر مدمج',
      badgeColor: 'bg-teal-100 text-teal-900',
      color: 'from-teal-600 to-indigo-700',
      group: 'المؤشرات والتحليلات الجماعية'
    },
    {
      id: 'guidance_stats',
      type: 'tab',
      title: 'مختبر السيكومتريا والتوجيه التربوي والمدرسي وتوقعات البكالوريا',
      subtitle: 'معامل التجانس (CV%)، التمييز السيكومتري للفروض، مصفوفة التوجيه المدرسي وتوقع الامتحان الوطني',
      icon: GraduationCap,
      badge: `${advancedStatisticalAndGuidanceMatrix.smEliteCount} تميز / توجيه`,
      badgeColor: 'bg-indigo-100 text-indigo-900',
      color: 'from-indigo-600 to-violet-700',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'absence_vs_success',
      type: 'tab',
      title: 'مقارنة الغياب ونسب النجاح بالفروض لكل قسم',
      subtitle: 'أثر المواظبة على نتائج الفروض الموحدة لكل قسم',
      icon: BarChart3,
      badge: `${overallAbsenceSuccessKPIs.avgSuccessRate}% نجاح`,
      badgeColor: 'bg-amber-100 text-amber-900',
      color: 'from-amber-500 to-orange-600',
      group: 'المؤشرات والتحليلات الجماعية'
    },
    {
      id: 'macro_trend',
      type: 'tab',
      title: 'الاتجاه العام وتطور المحطات',
      subtitle: 'الرصد الطولي لمسار تحصيل القسم عبر الفروض',
      icon: TrendingUp,
      badge: macroTrend.delta >= 0 ? `+${macroTrend.delta} ن` : `${macroTrend.delta} ن`,
      badgeColor: 'bg-violet-100 text-violet-800',
      color: 'from-violet-600 to-purple-700',
      group: 'المؤشرات والتحليلات الجماعية'
    },
    {
      id: 'distribution',
      type: 'tab',
      title: 'فئات التحكم والذروة التحصيلية',
      subtitle: 'هستوغرام التوزيع وسلالم التقدير الوزارية الرسمية',
      icon: Target,
      badge: `${cohortStats.passPct}% استيفاء`,
      badgeColor: 'bg-emerald-100 text-emerald-800',
      color: 'from-emerald-500 to-teal-700',
      group: 'المؤشرات والتحليلات الجماعية'
    },
    {
      id: 'comparison',
      type: 'tab',
      title: 'مقارنة الفروض ومسار التلاميذ',
      subtitle: 'تتبع التطور الفردي ومقارنة F1 وF2 وF3 والترتيب',
      icon: Users,
      badge: `${filteredStudents.length} تلميذ`,
      badgeColor: 'bg-sky-100 text-sky-800',
      color: 'from-sky-500 to-blue-600',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'at_risk',
      type: 'tab',
      title: 'رصد التعثر والتدخل الاستباقي',
      subtitle: 'كشف المتعثرين والتراجع المفاجئ والتنبيه المبكر (<10)',
      icon: AlertTriangle,
      badge: cohortStats.atRisk > 0 ? `${cohortStats.atRisk} بحاجة لدعم` : 'سليم',
      badgeColor: cohortStats.atRisk > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
      color: 'from-rose-500 to-red-600',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'ai_comparative',
      type: 'action',
      action: () => {
        setAiCompareClassName(selectedClass !== 'all' ? selectedClass : (classNames[0] || ''));
        if (studentMetrics.length > 0) setAiCompareStudentId(studentMetrics[0].id);
        setIsAiCompareModalOpen(true);
      },
      title: 'تحليل الذكاء الاصطناعي المقارن',
      subtitle: 'مقارنة المراقبة المستمرة بالفروض المحروسة وتوصيات شخصية',
      icon: Sparkles,
      badge: 'Gemini AI 🤖',
      badgeColor: 'bg-indigo-100 text-indigo-900',
      color: 'from-blue-600 via-indigo-600 to-purple-700',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'honors',
      type: 'action',
      action: () => {
        setActiveTab('comparison');
        setCohortFilter('top');
        setIsDropdownOpen(false);
      },
      title: 'لوحة التميز والتفوق الدراسي',
      subtitle: 'أصحاب الذروة التحصيلية والمعدلات المتميزة (≥ 14/20)',
      icon: Award,
      badge: `${cohortStats.top} متفوق`,
      badgeColor: 'bg-amber-100 text-amber-900',
      color: 'from-amber-400 to-amber-600',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'ai_remediation',
      type: 'tab',
      title: 'خطة المعالجة والدعم الذكية (AI)',
      subtitle: 'تشخيص تعثرات الرياضيات واقتراح أنشطة الدعم المخصصة',
      icon: Sparkles,
      badge: 'خطة ذكية AI',
      badgeColor: 'bg-purple-100 text-purple-800',
      color: 'from-purple-600 to-pink-600',
      group: 'التتبع الفردي والدعم البيداغوجي'
    },
    {
      id: 'official_docs',
      type: 'tab',
      title: 'المرجعيات الرسمية والمذكرات',
      subtitle: 'المذكرات الوزارية 142، أطر التقويم والمقررات الدراسية',
      icon: FileCheck,
      badge: 'المذكرة 142',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      color: 'from-emerald-600 to-green-700',
      group: 'المذكرات الرسمية والتقارير'
    },
    {
      id: 'spec_pdf',
      type: 'action',
      action: () => {
        handleOpenPdfSpec();
        setIsDropdownOpen(false);
      },
      title: 'بطاقة توصيف الفرض المحروس (PDF)',
      subtitle: 'جدول التخصيص والأطر المرجعية الرسمية للفرض',
      icon: FileCheck,
      badge: 'PDF رسمي',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      color: 'from-emerald-600 to-green-700',
      group: 'المذكرات الرسمية والتقارير'
    },
    {
      id: 'massar_excel',
      type: 'action',
      action: () => {
        handleOpenMassarExport();
        setIsDropdownOpen(false);
      },
      title: 'تصدير كشف مسار (Excel)',
      subtitle: 'كشف نقط رسمي متوافق 100% مع بوابة مسار الوزارية',
      icon: FileSpreadsheet,
      badge: 'Excel مسار',
      badgeColor: 'bg-teal-100 text-teal-800',
      color: 'from-teal-600 to-emerald-800',
      group: 'المذكرات الرسمية والتقارير'
    },
    {
      id: 'coefficients',
      type: 'action',
      action: () => {
        handleOpenCoefficients();
        setIsDropdownOpen(false);
      },
      title: 'معاملات وشعب الرياضيات',
      subtitle: 'دليل معاملات المادة بالسلك الثانوي التأهيلي لجميع الشعب',
      icon: Scale,
      badge: 'شعب ومقررات',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      color: 'from-indigo-600 to-blue-800',
      group: 'المذكرات الرسمية والتقارير'
    },
    {
      id: 'print_dossier',
      type: 'action',
      action: () => {
        handlePrint();
        setIsDropdownOpen(false);
      },
      title: 'التقرير التحليلي الشامل (محضر A4)',
      subtitle: 'محضر إحصائي رسمي جاهز للطباعة للإدارة والتفتيش التربوي',
      icon: Printer,
      badge: 'A4 رسمي',
      badgeColor: 'bg-slate-200 text-slate-800',
      color: 'from-slate-700 to-slate-900',
      group: 'المذكرات الرسمية والتقارير'
    },
    {
      id: 'comprehensive_pdf',
      type: 'action',
      action: () => {
        pdfExportRef.current?.exportPdf();
        setIsDropdownOpen(false);
      },
      title: 'تحميل ملف PDF الشامل (كافة الرسوم والجداول)',
      subtitle: 'تصدير كافة الرسوم البيانية والجداول والتشخيص في ملف PDF واحد ومنظم',
      icon: FileText,
      badge: 'PDF شامل',
      badgeColor: 'bg-rose-100 text-rose-800',
      color: 'from-rose-600 to-red-700',
      group: 'المذكرات الرسمية والتقارير'
    }
  ];

  const currentWorkspace =
    ANALYSIS_WORKSPACES.find(w => w.id === activeTab) || ANALYSIS_WORKSPACES[0];
  const CurrentIcon = currentWorkspace.icon;


  return (
    <div ref={containerRef} className="w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6 space-y-5 flex flex-col items-center" dir="rtl">
      {/* الترويسة الرسمية للمملكة المغربية عند الطباعة المباشرة A4 */}
      <div className="hidden print:block w-full border-b-2 border-blue-900 pb-3 mb-4 text-right">
        <div
          className="h-1 w-full rounded-full mb-2.5"
          style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)' }}
        />
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <div className="space-y-0.5 text-right w-1/3">
            <div className="font-black text-sm text-slate-950">المملكة المغربية</div>
            <div className="text-blue-900 font-extrabold">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            <div>{db?.teacherProfile?.academy || 'الأكاديمية الجهوية للتربية والتكوين'}</div>
            <div>{db?.teacherProfile?.directorate || 'المديرية الإقليمية'} · المؤسسة: {db?.teacherProfile?.school || 'الثانوية التأهيلية'}</div>
          </div>
          <div className="text-center w-1/3 flex flex-col items-center">
            <div className="font-black text-base text-blue-950">
              محضر التحليل البيداغوجي وتتبع نتائج المراقبة المستمرة
            </div>
            <div className="text-[11px] text-emerald-800 font-extrabold mt-0.5">
              مادة الرياضيات · السلك الثانوي التأهيلي · المذكرة الوزارية 142-08
            </div>
          </div>
          <div className="space-y-0.5 text-left w-1/3 flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-center flex flex-col items-center">
                <img
                  src={db?.teacherProfile?.schoolLogo || db?.teacherProfile?.institutionLogo || '/institution-logo.svg'}
                  alt=""
                  className="w-10 h-10 object-contain rounded-full border border-amber-500 p-0.5 bg-white shadow-xs"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/institution-logo.svg'; }}
                />
              </div>
              <div className="text-center flex flex-col items-center">
                <img
                  src={db?.teacherProfile?.teacherLogo || db?.teacherProfile?.photo || '/logo.svg'}
                  alt=""
                  className="w-10 h-10 object-contain rounded-full border border-blue-900 p-0.5 bg-white shadow-xs"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
                />
              </div>
            </div>
            <div>الأستاذ(ة): {db?.teacherProfile?.name || 'أستاذ مادة الرياضيات'}</div>
            <div>الموسم الدراسي: {db?.teacherProfile?.academicYear || '2026/2027'}</div>
            <div>القسم: {selectedClass === 'all' ? 'جميع الأقسام المسندة' : selectedClass} · الدورة: {semester === 's1' ? 'الأولى' : semester === 's2' ? 'الثانية' : 'السنوي'}</div>
          </div>
        </div>
      </div>

      {/* 1. Header & Controls Hub (Centered and Beautifully Balanced) */}
      <header className="bg-white/95 backdrop-blur-xs p-4 md:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 w-full text-center">
        {/* Centered Top Title & Educational Badges */}
        <div className="flex flex-col items-center justify-center text-center gap-3 w-full mx-auto">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* Teacher Logo */}
            <div className="flex items-center flex-shrink-0">
              <img
                src={db?.teacherProfile?.teacherLogo || db?.teacherProfile?.photo || '/logo.svg'}
                alt=""
                className="w-12 h-12 object-contain rounded-full border-2 border-blue-900 p-0.5 bg-white shadow-sm"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
              />
            </div>
            <div className="text-center sm:text-right">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-sans">
                تحليل وتتبع الأداء البيداغوجي وتطور الفروض
              </h1>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <span>تتبع تطور نتائج المراقبة المستمرة</span>
                <span className="text-slate-300">·</span>
                <span>تشخيص الفئات ومسار التحصيل</span>
                <span className="text-slate-300">·</span>
                <span>المطابقة مع المذكرات الوزارية لمديرية المناهج</span>
              </p>
            </div>
          </div>

          {/* Centered Badges */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>رياضيات الثانوي التأهيلي</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              <FileCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>المذكرة 142</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{studentMetrics.length} تلميذ(ة)</span>
            </span>
          </div>

          {/* Centered Quick Controls: Semester Switch, Class Dropdown & Export Actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap w-full mt-1 pt-3 border-t border-slate-100">
            {/* Semester Switcher */}
            <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSemester('s1')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  semester === 's1'
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>الدورة 1 (S1)</span>
              </button>
              <button
                type="button"
                onClick={() => setSemester('s2')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  semester === 's2'
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>الدورة 2 (S2)</span>
              </button>
            </div>

            {/* Class Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <School className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500">القسم:</span>
              <select
                className="bg-transparent text-xs md:text-sm font-black text-slate-800 outline-none cursor-pointer"
                value={selectedClass}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedClass(val);
                  if (val && val !== 'all') {
                    const annualSel = document.getElementById('annualClassSelect') as HTMLSelectElement | null;
                    if (annualSel && annualSel.value !== val) {
                      annualSel.value = val;
                      if (typeof (window as any).onAnnualClassChange === 'function') {
                        (window as any).onAnnualClassChange();
                      }
                    }
                  }
                }}
              >
                <option value="all">جميع الأقسام ({classNames.length})</option>
                {classNames.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons: Refresh, Spec Sheet, Excel, Print, PNG */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                title="تحديث وإعادة قراءة بيانات الفروض"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">تحديث</span>
              </button>
              {/* زر إطلاق تحليل الذكاء الاصطناعي المقارن بين المراقبة المستمرة والفروض المحروسة */}
              <button
                type="button"
                onClick={() => {
                  setAiCompareClassName(selectedClass !== 'all' ? selectedClass : (classNames[0] || ''));
                  if (studentMetrics.length > 0) setAiCompareStudentId(studentMetrics[0].id);
                  setIsAiCompareModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer ring-1 ring-white/30"
                title="مقارنة أداء التلميذ في فروض المراقبة المستمرة مع معدله في الفروض المحروسة وتقديم توصيات شخصية لتحسين مستواه"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                <span>مقارنة المراقبة بالفروض (AI)</span>
              </button>
              {/* زر تصدير PDF الشامل الموحد لكافة الرسوم البيانية والجداول */}
              <ComprehensiveAnalysisPdfExport
                ref={pdfExportRef}
                db={db}
                selectedClass={selectedClass}
                semester={semester}
                studentMetrics={studentMetrics}
                classAverages={classAverages}
                cohortStats={cohortStats}
                macroTrend={macroTrend}
                distributionData={distributionData}
                classAbsenceSuccessComparison={classAbsenceSuccessComparison}
                overallAbsenceSuccessKPIs={overallAbsenceSuccessKPIs}
              />
              <button
                type="button"
                onClick={handleOpenPdfSpec}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer shadow-2xs"
                title="معاينة واستخراج بطاقة توصيف الفرض المحروس وجدول التخصيص (المذكرة 142)"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">توصيف الفرض</span>
              </button>
              <button
                type="button"
                onClick={handleOpenMassarExport}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 transition-colors cursor-pointer shadow-2xs"
                title="تصدير كشف نقط الفروض بصيغة إكسيل مسار الرسمية"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Excel مسار</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                title="طباعة تقرير التحليل الإحصائي والمحضر البيداغوجي (A4)"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">طباعة</span>
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                disabled={isExporting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                title="تصدير لوحة التحليل كصورة PNG عالية الدقة"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'جاري التصدير...' : 'صورة PNG'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. اللائحة المنسدلة لواجهات وأدوات التحليل الفرعية (ممركزة في وسط الشاشة) */}
        <div className="pt-4 border-t border-slate-100 flex flex-col items-center justify-center w-full mx-auto" ref={dropdownRef}>
          <div className="text-center mb-2">
            <span className="text-xs font-black text-slate-600 inline-flex items-center justify-center gap-1.5 bg-slate-100/80 px-3.5 py-1 rounded-full border border-slate-200">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>واجهة التحليل الفرعية النشطة (انقر للاختيار من اللائحة المنسدلة):</span>
            </span>
          </div>

          {/* Main Centered Dropdown Selector Button */}
          <div className="relative w-full max-w-xl mx-auto">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between p-3 md:p-3.5 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/70 hover:from-blue-50 hover:to-indigo-50 border-2 border-blue-400/60 hover:border-blue-600 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group text-right"
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${currentWorkspace.color} text-white flex items-center justify-center shadow-md flex-shrink-0 group-hover:scale-105 transition-transform`}>
                  <CurrentIcon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="min-w-0 text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs sm:text-sm md:text-base text-slate-900 group-hover:text-blue-700 transition-colors">
                      {currentWorkspace.title}
                    </span>
                    <span className={`text-[10px] md:text-[11px] font-bold px-2.5 py-0.5 rounded-full ${currentWorkspace.badgeColor}`}>
                      {currentWorkspace.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {currentWorkspace.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mr-2 flex-shrink-0">
                <span className="text-xs font-bold text-blue-600 hidden sm:inline">تغيير الواجهة</span>
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            {/* Dropdown Menu Popup with Categorized Workspaces & Tools */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[460px] overflow-y-auto">
                <div className="p-2 space-y-3">
                  {/* Group 1: المؤشرات والمقارنات الجماعية */}
                  <div>
                    <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>المؤشرات والتحليلات الجماعية</span>
                    </div>
                    <div className="space-y-1">
                      {ANALYSIS_WORKSPACES.filter(w => w.group === 'المؤشرات والتحليلات الجماعية').map(item => {
                        const ItemIcon = item.icon;
                        const isSelected = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.type === 'action' && item.action) {
                                item.action();
                              } else {
                                setActiveTab(item.id as any);
                              }
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 border border-blue-200 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-xs flex-shrink-0`}>
                                <ItemIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 text-right">
                                <div className="text-xs font-black truncate">{item.title}</div>
                                <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 flex-shrink-0 ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 2: التتبع الفردي والدعم البيداغوجي */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      <span>التتبع الفردي والدعم البيداغوجي</span>
                    </div>
                    <div className="space-y-1">
                      {ANALYSIS_WORKSPACES.filter(w => w.group === 'التتبع الفردي والدعم البيداغوجي').map(item => {
                        const ItemIcon = item.icon;
                        const isSelected = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.type === 'action' && item.action) {
                                item.action();
                              } else {
                                setActiveTab(item.id as any);
                              }
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-purple-50 text-purple-900 border border-purple-200 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-xs flex-shrink-0`}>
                                <ItemIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 text-right">
                                <div className="text-xs font-black truncate">{item.title}</div>
                                <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 flex-shrink-0 ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 3: المذكرات والوثائق الرسمية والتصدير */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>المذكرات الرسمية والتقارير</span>
                    </div>
                    <div className="space-y-1">
                      {ANALYSIS_WORKSPACES.filter(w => w.group === 'المذكرات الرسمية والتقارير').map(item => {
                        const ItemIcon = item.icon;
                        const isSelected = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (item.type === 'action' && item.action) {
                                item.action();
                              } else {
                                setActiveTab(item.id as any);
                              }
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-xs flex-shrink-0`}>
                                <ItemIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 text-right">
                                <div className="text-xs font-black truncate">{item.title}</div>
                                <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 flex-shrink-0 ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Centered Streamlined Quick-Switch Pills (Merged Statistical Analysis + Detailed Lab) */}
          <div className="flex items-center justify-center gap-1.5 md:gap-2 flex-wrap mt-3.5 max-w-4xl mx-auto">
            <span className="text-[11px] font-black text-slate-400 ml-1">المختبرات المدمجة:</span>
            {[
              { id: 'consolidated_annual', label: 'مختبر التحليل الإحصائي والتفصيلي المدمج', icon: Activity },
              { id: 'guidance_stats', label: 'التحليل السيكومتري والتوجيه التربوي', icon: GraduationCap },
              { id: 'comparison', label: 'مقارنة الفروض ومسار التلاميذ', icon: Users },
              { id: 'at_risk', label: 'رصد التعثر والتدخل', icon: AlertTriangle },
              { id: 'ai_remediation', label: 'خطة المعالجة الذكية (AI)', icon: Sparkles }
            ].map(p => {
              const Icon = p.icon;
              const isActive = activeTab === p.id || (p.id === 'consolidated_annual' && activeTab === 'overview');
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(p.id as any);
                    setIsDropdownOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{p.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowIconLaunchpad(!showIconLaunchpad)}
              className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1"
              title="إظهار أو طي شبكة البطاقات الموسعة"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-400" />
              <span>{showIconLaunchpad ? 'طي الشبكة' : 'شبكة البطاقات'}</span>
            </button>
          </div>
        </div>

        {/* 3. Optional Expanded Grid (معروضة فقط عند طلب المستخدم عبر الزر أعلاه) */}
        {showIconLaunchpad && (
          <div className="pt-3 border-t border-slate-100 w-full animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                <h2 className="text-xs md:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>منظومة أدوات التحليل البيداغوجي (شبكة الـ 12 بطاقة الكاملة)</span>
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-3 mb-2">
              {ANALYSIS_WORKSPACES.map(w => {
                const WIcon = w.icon;
                const isCurrent = activeTab === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      if (w.type === 'action' && w.action) {
                        w.action();
                      } else {
                        setActiveTab(w.id as any);
                      }
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-gradient-to-br from-blue-50 to-indigo-50/70 border-blue-400 ring-2 ring-blue-300 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${w.color} text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform flex-shrink-0`}>
                        <WIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.badgeColor} font-mono`}>
                        {w.badge}
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <div className="font-black text-xs text-slate-900 group-hover:text-blue-700 transition-colors">
                        {w.title}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {w.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {activeTab === 'ai_remediation' ? (
        <div className="w-full">
          <AiRemediationView
            db={db}
            selectedClass={selectedClass}
            semester={semester}
            studentMetrics={studentMetrics}
            classAverages={classAverages}
          />
        </div>
      ) : !hasAnyGrades ? (
        <div className="w-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">
            لا توجد نقط مسجلة للفروض حالياً في {semester === 's1' ? 'الدورة الأولى' : 'الدورة الثانية'}
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
            يرجى إدخال نقط الفروض في تبويب «الفروض والمراقبة المستمرة» أو استيراد بيان النقط لتفعيل التحليل والمقارنة.
          </p>
        </div>
      ) : !isSubTabChartReady ? (
        <div className="w-full py-10 px-4 rounded-2xl border border-slate-200 bg-white/90 flex items-center justify-center gap-3 text-slate-600 text-xs font-bold shadow-2xs">
          <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
          <span>جاري تجهيز الرسوم البيانية والمؤشرات الإحصائية للتبويب...</span>
        </div>
      ) : (
        <>
          {/* =========================================================================
              WORKSPACE 0 & 1 MERGED: مختبر التحليل الإحصائي والتفصيلي المدمج
              Combines Consolidated Annual Statistical Analysis + Detailed Laboratory Analysis
             ========================================================================= */}
          {(activeTab === 'consolidated_annual' || activeTab === 'overview') && (
            <div className="w-full space-y-5">
              {/* Top Executive Banner + Pedagogical Diagnosis Unified */}
              <div className="bg-gradient-to-l from-teal-900 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm border border-teal-700/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 flex-shrink-0 shadow-inner">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base md:text-lg font-black tracking-tight">
                        مختبر التحليل الإحصائي والتفصيلي المدمج ({selectedClass === 'all' ? 'جميع الأقسام' : selectedClass})
                      </h2>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30">
                        المسار السنوي + فئات التحكم + أثر المواظبة
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-400/30">
                        {macroTrend.direction === 'improving'
                          ? `↗ منحنى تطور إيجابي (+${macroTrend.delta})`
                          : macroTrend.direction === 'declining'
                          ? `↘ تراجع يستدعي التدخل (${macroTrend.delta})`
                          : '↔ استقرار تحصيلي'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      بيئة إحصائية موحدة تدمج الحصيلة السنوية (د1 + د2) مع مختبر التحليل التفصيلي، توزيع فئات التحكم (المذكرة 142)، كشف الطاقات الكامنة، وعلاقة ساعات الغياب بالمعدلات
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof (window as any).switchAnnualAnalysisSubView === 'function') {
                        (window as any).switchAnnualAnalysisSubView('annual');
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 border border-sky-400/40 text-xs font-black transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                    title="الانتقال إلى القسم الثاني المتكامل: سجل الحصيلة السنوية وجدول التتبع التفاعلي"
                  >
                    <TableIcon className="w-3.5 h-3.5 text-sky-300" />
                    <span>2. سجل الحصيلة السنوية وجدول التتبع (د1 + د2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('comparison')}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-300" />
                    <span>مقارنة التلاميذ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai_remediation')}
                    className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>خطة دعم استباقية (AI)</span>
                  </button>
                </div>
              </div>

              {/* Unified 6-Card KPI Matrix (Annual + Active Semester + Mastery Cohorts + Attendance) */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {/* 1. Annual & Semester Average */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>المعدل السنوي والفصلي</span>
                    <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                      <GraduationCap className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {annualConsolidatedStats.annualClassAvg !== null
                      ? annualConsolidatedStats.annualClassAvg
                      : classAverages.overall !== null
                      ? classAverages.overall
                      : '--'}
                    <span className="text-xs font-normal text-slate-400 mr-1">/ 20</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between font-bold">
                    <span>د1: {annualConsolidatedStats.s1ClassAvg ?? '-'}</span>
                    <span>د2: {annualConsolidatedStats.s2ClassAvg ?? '-'}</span>
                  </div>
                </div>

                {/* 2. Yearly Grade Trend Delta & Homogeneity */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>منحى التطور والتجانس</span>
                    <span className={`p-1.5 rounded-lg ${annualConsolidatedStats.yearlyGrowthDelta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {annualConsolidatedStats.yearlyGrowthDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </span>
                  </div>
                  <div className={`text-2xl font-black font-mono mt-1 ${annualConsolidatedStats.yearlyGrowthDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {annualConsolidatedStats.yearlyGrowthDelta >= 0 ? `+${annualConsolidatedStats.yearlyGrowthDelta}` : annualConsolidatedStats.yearlyGrowthDelta}
                    <span className="text-xs font-normal text-slate-400 mr-1">نقطة</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
                    <span>الانحراف (σ): <strong className="font-mono text-slate-700">{annualConsolidatedStats.annualStdDev ?? '--'}</strong></span>
                    <span className="text-emerald-700 font-bold">↗ {macroTrend.improvingPercent}%</span>
                  </div>
                </div>

                {/* 3. Pass Rate & Excellence Cohort (Clickable) */}
                <button
                  type="button"
                  onClick={() => {
                    setCohortFilter('top');
                    setActiveTab('comparison');
                  }}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs text-right cursor-pointer hover:border-blue-300 transition-all group"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>الاستيفاء والتميز (≥14)</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-blue-700 mt-1">
                    {annualConsolidatedStats.annualPassPct}%
                    <span className="text-xs font-normal text-slate-400 mr-1 font-sans">نجاح</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2 flex items-center justify-between">
                    <span>المتفوقون (≥14):</span>
                    <strong className="text-amber-600 font-mono">{cohortStats.top} ({cohortStats.topPct}%)</strong>
                  </div>
                </button>

                {/* 4. At-Risk & Medium Cohorts (Clickable) */}
                <button
                  type="button"
                  onClick={() => {
                    setConsolidatedMomentumFilter(consolidatedMomentumFilter === 'at_risk' ? 'all' : 'at_risk');
                  }}
                  className={`p-4 rounded-2xl border shadow-xs text-right cursor-pointer transition-all ${
                    cohortStats.atRisk > 0 ? 'bg-rose-50/40 border-rose-200 hover:border-rose-400' : 'bg-white border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span className={cohortStats.atRisk > 0 ? 'text-rose-700' : ''}>التعثر وفئات الدعم (&lt;10)</span>
                    <span className={`p-1.5 rounded-lg ${cohortStats.atRisk > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-600 mt-1">
                    {cohortStats.atRisk}
                    <span className="text-xs font-normal text-slate-400 mr-1.5 font-sans">({cohortStats.atRiskPct}%)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2 flex items-center justify-between">
                    <span>المتوسطون (10-14):</span>
                    <strong className="text-amber-700 font-mono">{cohortStats.medium} ({cohortStats.medPct}%)</strong>
                  </div>
                </button>

                {/* 5. Current Assessment Progress & Peak Student */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 mb-1">
                    <span>إنجاز الفروض والذروة</span>
                    <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                      <FileCheck className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-700 mt-1">
                    {annualConsolidatedStats.currentSemesterCompletionPct}%
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2 flex items-center justify-between truncate" title={cohortStats.bestStudent?.name}>
                    <span>أعلى معدل:</span>
                    <strong className="font-mono text-amber-600">{cohortStats.bestStudent ? `${cohortStats.bestStudent.avg}/20` : '--'}</strong>
                  </div>
                </div>

                {/* 6. Attendance & Academic Momentum */}
                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
                    <span>المواظبة ودينامية التقدم</span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                      <Calendar className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-1">
                    {annualConsolidatedStats.attendanceRatePct}%
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2 flex items-center justify-between">
                    <span className="text-emerald-700 font-bold">🚀 تسارع: {annualConsolidatedStats.momentumCounts.accelerating}</span>
                    <span className="text-blue-700 font-bold">⚡ استدراك: {annualConsolidatedStats.momentumCounts.recovering}</span>
                  </div>
                </div>
              </div>

              {/* شريط المؤشرات السيكومترية المتقدمة والارتباط الإحصائي والتوجيه التربوي */}
              <div className="bg-gradient-to-l from-indigo-50/90 via-white to-teal-50/80 p-4 rounded-2xl border border-indigo-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>معامل التجانس والاختلاف (CV%)</span>
                      <Scale className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-1 flex items-center gap-1.5">
                      <span>{advancedStatisticalAndGuidanceMatrix.cvPercent !== null ? `${advancedStatisticalAndGuidanceMatrix.cvPercent}%` : '--'}</span>
                      <span className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${advancedStatisticalAndGuidanceMatrix.homogeneityStatus.color}`}>
                        {advancedStatisticalAndGuidanceMatrix.homogeneityStatus.label}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>المدى الربيعي (IQR) والوسيط</span>
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-1">
                      IQR: {advancedStatisticalAndGuidanceMatrix.iqr ?? '--'}
                      <span className="text-[11px] font-normal text-slate-500 mr-1.5">
                        (Med: {advancedStatisticalAndGuidanceMatrix.median ?? '--'})
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>معامل الارتباط (الغياب × النقط)</span>
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900 mt-1">
                      r = {annualConsolidatedStats.absenceGradeCorrelationR ?? '--'}
                      <span className="text-[10px] font-sans font-bold text-slate-500 mr-1.5">
                        {annualConsolidatedStats.absenceGradeCorrelationR !== null && annualConsolidatedStats.absenceGradeCorrelationR <= -0.35
                          ? '(ارتباط عكسي دال)'
                          : '(تأثير معتدل)'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
                      <span>خلاصة التوجيه المدرسي والمهني</span>
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xs font-black text-slate-900 mt-1 flex items-center gap-2">
                      <span className="text-emerald-700">{advancedStatisticalAndGuidanceMatrix.smEliteCount} نخبة/تميز</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-blue-700">{advancedStatisticalAndGuidanceMatrix.pcSvtReadyCount} مسار علمي</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-rose-700">{advancedStatisticalAndGuidanceMatrix.supportReorientCount} دعم/توجيه</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('guidance_stats')}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer inline-flex items-center justify-center gap-2 flex-shrink-0"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>فتح مختبر التوجيه التربوي والسيكومتريا</span>
                </button>
              </div>

              {/* Merged Multi-Lens Analytics Lab: Yearly Trajectory + Detailed Mastery Distribution + Potential Gap Discovery + Momentum Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left 2 Columns: Multi-Lens Visual Lab */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-teal-600" />
                          <span>
                            {detailedLabLens === 'trajectory'
                              ? 'منحنى المسار السنوي والفصلي المدمج لتطور النقط ونسب النجاح'
                              : detailedLabLens === 'distribution'
                              ? 'التوزيع التكراري لفئات المعدلات وسلم التقدير الوزاري (المذكرة 142)'
                              : 'مختبر الذروة التحصيلية وكشف الطاقات الكامنة للتلاميذ'}
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {detailedLabLens === 'trajectory'
                            ? 'يربط بين متوسطات الفروض عبر الدورتين، الشريحة المتفوقة (Q3)، الوسيط، ونسبة الاستيفاء في كل محطة تقويمية'
                            : detailedLabLens === 'distribution'
                            ? 'توزع تلاميذ القسم حسب سلم التقديرات الوزاري المغربي وعتبة الاستيفاء (10/20)'
                            : 'رصد الفارق بين أعلى نقطة حققها التلميذ في أي فرض ومعدله العام لاكتشاف فجوات الدافعية'}
                        </p>
                      </div>

                      {/* 3-Lens Switcher (Consolidating Annual Curve + Detailed Distribution + Peak Potential) */}
                      <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailedLabLens('trajectory')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            detailedLabLens === 'trajectory'
                              ? 'bg-white text-teal-800 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📈 المسار السنوي والفصلي
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailedLabLens('distribution')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            detailedLabLens === 'distribution'
                              ? 'bg-white text-emerald-800 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📊 فئات التحكم والتوزيع
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailedLabLens('boxplot')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            detailedLabLens === 'boxplot'
                              ? 'bg-white text-blue-800 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📦 الصندوق والساعدين (Box-Plot)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailedLabLens('potential')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                            detailedLabLens === 'potential'
                              ? 'bg-white text-amber-800 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🎯 الذروة والطاقات الكامنة
                        </button>
                      </div>
                    </div>

                    {/* Lens 1: Longitudinal Trajectory ComposedChart */}
                    {detailedLabLens === 'trajectory' && (
                      <>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={annualConsolidatedStats.stationsChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                              <defs>
                                <linearGradient id="consolidatedMeanGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.28} />
                                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 700 }} />
                              <YAxis yAxisId="left" domain={[0, 20]} stroke="#0f766e" tick={{ fontSize: 11 }} ticks={[0, 5, 10, 15, 20]} />
                              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 10 }} unit="%" />
                              <Tooltip
                                contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              <ReferenceLine yAxisId="left" y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'عتبة التحكم (10)', fill: '#ef4444', fontSize: 10, position: 'right' }} />
                              <Bar yAxisId="right" dataKey="نسبة النجاح (%)" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={22} />
                              <Area yAxisId="left" type="monotone" dataKey="المعدل العام" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#consolidatedMeanGrad)" />
                              <Line yAxisId="left" type="monotone" dataKey="الشريحة المتفوقة (Q3)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                              <Line yAxisId="left" type="monotone" dataKey="الوسيط (Median)" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
                              <Line yAxisId="left" type="monotone" dataKey="شريحة التعثر (Q1)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" dot={{ r: 2.5 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-4 text-center text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">الفرض 1 ({semester === 's1' ? 'د1' : 'د2'})</span>
                            <strong className="text-slate-800 font-mono text-sm">{classAverages.f1 !== null ? `${classAverages.f1}/20` : '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">الفرض 2 ({semester === 's1' ? 'د1' : 'د2'})</span>
                            <strong className="text-slate-800 font-mono text-sm">{classAverages.f2 !== null ? `${classAverages.f2}/20` : '-'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">الفرض 3 ({semester === 's1' ? 'د1' : 'د2'})</span>
                            <strong className="text-slate-800 font-mono text-sm">{classAverages.f3 !== null ? `${classAverages.f3}/20` : '-'}</strong>
                          </div>
                          <div>
                            <span className="text-teal-700 font-bold block text-[11px]">المعدل السنوي</span>
                            <strong className="text-teal-800 font-mono text-sm">{annualConsolidatedStats.annualClassAvg !== null ? `${annualConsolidatedStats.annualClassAvg}/20` : '-'}</strong>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Lens 2: Detailed Mastery Brackets Distribution Histogram */}
                    {detailedLabLens === 'distribution' && (
                      <>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                dataKey="label"
                                stroke="#64748b"
                                tick={{ fontSize: 10, fontWeight: 700 }}
                                angle={-12}
                                textAnchor="end"
                                interval={0}
                              />
                              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                              <Tooltip
                                contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                                formatter={(value: any, _name: any, item: any) => [`${value} تلميذ (${item.payload.pct}%)`, 'العدد']}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                {distributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {distributionData.map((b, idx) => (
                            <div key={idx} className="p-2 rounded-xl border border-slate-100 bg-slate-50/70 text-center">
                              <div className="text-[10px] font-bold text-slate-600 truncate">{b.label.split(' ')[0]}</div>
                              <div className="text-sm font-black font-mono mt-0.5" style={{ color: b.color }}>
                                {b.count} <span className="text-[10px] font-normal text-slate-400">({b.pct}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Lens 2.5: Tukey Box-Plot (Boîte à moustaches) */}
                    {detailedLabLens === 'boxplot' && (
                      <div className="pt-1">
                        <BoxPlotChart
                          items={boxPlotItems}
                          height={320}
                          title="مخطط الصندوق والساعدين (Boîte à moustaches) لتطور الفروض المحروسة"
                        />
                      </div>
                    )}

                    {/* Lens 3: Peak Achievement & Potential Gap Discovery */}
                    {detailedLabLens === 'potential' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200 px-3.5 py-2 rounded-xl text-xs">
                          <span className="font-bold text-amber-950">
                            التلاميذ ذوو الطاقات الكامنة (فارق الذروة عن المعدل العام ≥ 1.5 نقطة):
                          </span>
                          <span className="font-black font-mono text-amber-800">
                            {studentMetrics.filter(s => s.potentialGap >= 1.5).length} تلميذ(ة)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                          {studentMetrics
                            .filter(s => s.potentialGap >= 1.5)
                            .sort((a, b) => b.potentialGap - a.potentialGap)
                            .slice(0, 6)
                            .map(std => (
                              <div
                                key={std.id}
                                className="p-3 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/10"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-black text-xs text-slate-900 truncate">{std.name}</span>
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 font-mono">
                                    +{std.potentialGap} ن
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-600 bg-white p-1.5 rounded-lg border border-amber-100">
                                  <span>الذروة: <strong className="text-emerald-700 font-mono">{std.bestMark}/20</strong> ({std.bestExamTitle})</span>
                                  <span>المعدل: <strong className="font-mono text-slate-800">{std.avg}/20</strong></span>
                                </div>
                              </div>
                            ))}
                          {studentMetrics.filter(s => s.potentialGap >= 1.5).length === 0 && (
                            <div className="col-span-2 p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                              تجانس جيد بين نقط الفروض والمعدل العام لجميع التلاميذ (لا توجد فجوات تذبذب حادة).
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 1 Column: Current Academic Progress & Momentum Cohorts */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>مصفوفة دينامية التقدم الأكاديمي الحالي</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-4">
                      تصنيف التلاميذ وفق تقاطع المسار السنوي مع نتائج الفروض الحالية (انقر لتصفية السجل)
                    </p>

                    <div className="space-y-2.5">
                      {[
                        {
                          id: 'accelerating',
                          label: '🚀 تسارع تحصيلي مستمر',
                          desc: 'تطور إيجابي متواصل (+0.75 ن فأكثر)',
                          count: annualConsolidatedStats.momentumCounts.accelerating,
                          color: 'bg-emerald-500',
                          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        },
                        {
                          id: 'sustained_mastery',
                          label: '🛡️ تفوق وثبات أكاديمي',
                          desc: 'استقرار فوق عتبة التحكم (≥ 10/20)',
                          count: annualConsolidatedStats.momentumCounts.sustained_mastery,
                          color: 'bg-blue-600',
                          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200'
                        },
                        {
                          id: 'recovering',
                          label: '⚡ انتعاش واستدراك حالي',
                          desc: 'تجاوز عتبة التعثر السابقة إلى النجاح',
                          count: annualConsolidatedStats.momentumCounts.recovering,
                          color: 'bg-violet-600',
                          badgeBg: 'bg-violet-50 text-violet-800 border-violet-200'
                        },
                        {
                          id: 'at_risk',
                          label: '⚠️ تعثر أو تراجع يستوجب الدعم',
                          desc: 'معدل حالي دون 10/20 يحتاج لمعالجة',
                          count: annualConsolidatedStats.momentumCounts.at_risk,
                          color: 'bg-rose-500',
                          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200'
                        }
                      ].map(cohort => {
                        const totalStd = Math.max(1, annualConsolidatedStats.studentProgressRows.length);
                        const pct = Math.round((cohort.count / totalStd) * 100);
                        const isSelected = consolidatedMomentumFilter === cohort.id;
                        return (
                          <button
                            key={cohort.id}
                            type="button"
                            onClick={() => setConsolidatedMomentumFilter(isSelected ? 'all' : (cohort.id as any))}
                            className={`w-full p-3 rounded-xl border text-right transition-all cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-teal-500 bg-teal-50/40 border-teal-400'
                                : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-black text-slate-800">
                              <span>{cohort.label}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] border font-mono ${cohort.badgeBg}`}>
                                {cohort.count} ({pct}%)
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{cohort.desc}</p>
                            <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-2 overflow-hidden">
                              <div className={`${cohort.color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {consolidatedMomentumFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setConsolidatedMomentumFilter('all')}
                      className="mt-3 w-full py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 cursor-pointer transition-colors"
                    >
                      إظهار جميع الفئات ({annualConsolidatedStats.studentProgressRows.length} تلميذ)
                    </button>
                  )}
                </div>
              </div>

              {/* Dedicated Interactive Chart: Relationship Between Absence Hours, Student Grade Averages & Class Success */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-rose-600" />
                        <span>تحليل العلاقة بين عدد ساعات الغياب ومعدلات التلاميذ ونسب النجاح</span>
                      </h3>
                      {annualConsolidatedStats.absenceGradeCorrelationR !== null && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                          معامل الارتباط r = {annualConsolidatedStats.absenceGradeCorrelationR}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      يوضح الرسم البياني كيف تنعكس ساعات الغياب المسجلة على المعدل الدراسي ونسبة الاستيفاء فردياً وجماعياً
                    </p>
                  </div>

                  {/* 3-Mode Switcher: Brackets vs Individual Students vs Classes */}
                  <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setAbsenceGradeChartMode('brackets')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        absenceGradeChartMode === 'brackets'
                          ? 'bg-white text-teal-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📊 حسب فئات ساعات الغياب
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceGradeChartMode('students')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        absenceGradeChartMode === 'students'
                          ? 'bg-white text-teal-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      👤 مقارنة التلاميذ فردياً
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbsenceGradeChartMode('classes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        absenceGradeChartMode === 'classes'
                          ? 'bg-white text-amber-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🏫 مقارنة الأقسام ({classAbsenceSuccessComparison.length})
                    </button>
                  </div>
                </div>

                {/* Quick Summary Strip of Attendance Impact on Grades */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-900">معدل التلاميذ المواظبين (0 ساعة غياب)</div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">الفئة الأكثر انتظاماً في الحضور</div>
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-800">
                      {annualConsolidatedStats.zeroAbsenceAvgGrade !== null ? `${annualConsolidatedStats.zeroAbsenceAvgGrade}/20` : '--'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-rose-900">معدل ذوي الغياب المتكرر (≥ 3 ساعات)</div>
                      <div className="text-[10px] text-rose-700 mt-0.5">التلاميذ المتأثرون بهدر الحصص</div>
                    </div>
                    <div className="text-lg font-black font-mono text-rose-800">
                      {annualConsolidatedStats.highAbsenceAvgGrade !== null ? `${annualConsolidatedStats.highAbsenceAvgGrade}/20` : '--'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-amber-950">الأثر الصافي للمواظبة على المعدل</div>
                      <div className="text-[10px] text-amber-800 mt-0.5">الفارق النقطي بين المواظبين والمتغيبين</div>
                    </div>
                    <div className="text-lg font-black font-mono text-amber-900">
                      {annualConsolidatedStats.attendanceGradeImpactDelta !== null
                        ? `${annualConsolidatedStats.attendanceGradeImpactDelta > 0 ? '+' : ''}${annualConsolidatedStats.attendanceGradeImpactDelta} ن`
                        : '--'}
                    </div>
                  </div>
                </div>

                {/* Interactive Recharts Visualization */}
                <div className="h-72 w-full" dir="ltr">
                  {absenceGradeChartMode === 'brackets' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={annualConsolidatedStats.absenceGradeBrackets} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis yAxisId="left" domain={[0, 20]} stroke="#0f766e" tick={{ fontSize: 11 }} ticks={[0, 5, 10, 15, 20]} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#6366f1" tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                          formatter={(val: any, name: any, props: any) => [
                            val !== null ? `${val}${name.includes('%') ? '%' : ' / 20'} (${props?.payload?.count || 0} تلميذ)` : 'لا يوجد',
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                        <ReferenceLine yAxisId="left" y={10} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'عتبة التحكم 10/20', fill: '#dc2626', fontSize: 10, position: 'insideTopRight' }} />
                        <Bar yAxisId="left" dataKey="معدل التلاميذ (/20)" radius={[6, 6, 0, 0]} barSize={34}>
                          {annualConsolidatedStats.absenceGradeBrackets.map((entry: any, idx: number) => (
                            <Cell key={`abs-cell-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="نسبة النجاح (%)" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : absenceGradeChartMode === 'students' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={annualConsolidatedStats.studentAbsenceGradePoints} margin={{ top: 10, right: 20, left: 0, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="name"
                          stroke="#475569"
                          tick={{ fontSize: 10, fontWeight: 700 }}
                          angle={-25}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis yAxisId="left" domain={[0, 20]} stroke="#059669" tick={{ fontSize: 11 }} label={{ value: 'المعدل (/20)', angle: -90, position: 'insideLeft', fill: '#059669', fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#e11d48" tick={{ fontSize: 11 }} label={{ value: 'ساعات الغياب', angle: 90, position: 'insideRight', fill: '#e11d48', fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '12px' }} />
                        <ReferenceLine yAxisId="left" y={10} stroke="#dc2626" strokeDasharray="4 4" />
                        <Bar yAxisId="right" dataKey="ساعات الغياب" fill="#fb7185" radius={[4, 4, 0, 0]} barSize={16} />
                        <Line yAxisId="left" type="monotone" dataKey="المعدل الدراسي (/20)" stroke="#059669" strokeWidth={2.5} dot={{ r: 4, fill: '#059669' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={classAbsenceSuccessComparison} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="className" stroke="#475569" tick={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis yAxisId="left" domain={[0, 100]} stroke="#059669" tick={{ fontSize: 11 }} unit="%" />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 20]} stroke="#2563eb" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                        <Bar yAxisId="left" dataKey="successRate" name="نسبة النجاح (%)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={22} />
                        <Bar yAxisId="left" dataKey="absenceRate" name="نسبة الغياب (%)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={22} />
                        <Line yAxisId="right" type="monotone" dataKey="classAvg" name="معدل القسم (/20)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Consolidated Student Yearly Trend & Detailed Progress Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-teal-600" />
                      <span>السجل الإحصائي والتفصيلي الموحد للمسار السنوي والتقدم الأكاديمي الفردي</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      حصيلة شاملة غير مكررة لكل تلميذ تجمع معدل الدورة 1، معدل الدورة 2، المعدل السنوي، آخر فرض، ساعات الغياب، وبطاقة التقرير الفردي
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="بحث بالاسم أو مسار..."
                        className="pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                        <th className="py-3 px-3">التلميذ(ة)</th>
                        {selectedClass === 'all' && <th className="py-3 px-2 text-center">القسم</th>}
                        <th className="py-3 px-2 text-center">معدل د1 (S1)</th>
                        <th className="py-3 px-2 text-center">معدل د2 (S2)</th>
                        <th className="py-3 px-2 text-center bg-teal-50/60 text-teal-900">المعدل السنوي</th>
                        <th className="py-3 px-2 text-center">آخر فرض حالي</th>
                        <th className="py-3 px-2 text-center">تقدم الفروض</th>
                        <th className="py-3 px-2 text-center">ساعات الغياب</th>
                        <th className="py-3 px-2 text-center">الفارق السنوي (Δ)</th>
                        <th className="py-3 px-3 text-center">دينامية التقدم</th>
                        <th className="py-3 px-2 text-center">تقرير فردي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {annualConsolidatedStats.studentProgressRows
                        .filter(row => {
                          if (consolidatedMomentumFilter !== 'all' && row.momentumStatus !== consolidatedMomentumFilter) return false;
                          if (searchQuery.trim() !== '') {
                            const q = searchQuery.toLowerCase().trim();
                            return row.name.toLowerCase().includes(q) || row.massar.toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .map(row => {
                          const momentumBadge =
                            row.momentumStatus === 'accelerating'
                              ? { text: '🚀 تسارع تحصيلي', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
                              : row.momentumStatus === 'recovering'
                              ? { text: '⚡ استدراك ناجح', cls: 'bg-violet-50 text-violet-800 border-violet-200' }
                              : row.momentumStatus === 'sustained_mastery'
                              ? { text: '🛡️ تحكم مستقر', cls: 'bg-blue-50 text-blue-800 border-blue-200' }
                              : { text: '⚠️ بحاجة لدعم', cls: 'bg-rose-50 text-rose-800 border-rose-200' };

                          return (
                            <tr key={`${row.className}-${row.id}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{row.name}</td>
                              {selectedClass === 'all' && (
                                <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-500">{row.className}</td>
                              )}
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                                {row.s1Avg !== null ? row.s1Avg.toFixed(2) : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                                {row.s2Avg !== null ? row.s2Avg.toFixed(2) : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-black bg-teal-50/40 text-teal-900">
                                {row.annualAvg !== null ? row.annualAvg.toFixed(2) : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700">
                                {row.latestMark !== null ? row.latestMark.toFixed(2) : '-'}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-indigo-600 h-full rounded-full"
                                      style={{ width: `${row.yearlyCompletionPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-500">{row.yearlyExamCompletedCount}/6</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono">
                                {row.absentHours > 0 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold">{row.absentHours} س</span>
                                ) : (
                                  <span className="text-emerald-600 font-bold">0 س</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold">
                                {row.yearlyDelta !== null ? (
                                  <span className={row.yearlyDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                    {row.yearlyDelta >= 0 ? `+${row.yearlyDelta}` : row.yearlyDelta}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${momentumBadge.cls}`}>
                                  {momentumBadge.text}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof (window as any).jumpToIndividualReport === 'function') {
                                      (window as any).jumpToIndividualReport(row.id, row.className);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold cursor-pointer transition-colors"
                                  title="معاينة التقرير الفردي الموحد للتلميذ"
                                >
                                  📄 التقرير
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 2: مقارنة أداء التلاميذ والفروض (Student Progress & Comparisons)
             ========================================================================= */}
          {activeTab === 'comparison' && (
            <div className="w-full space-y-4">
              {/* Filter & Search Bar with Clean Icons */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Search Input Box */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم أو رقم مسار..."
                      className="w-full pr-10 pl-8 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('all')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          viewMode === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>الكل (رسم + جدول)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('table_only')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          viewMode === 'table_only' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>الجدول فقط</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('chart_only')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          viewMode === 'chart_only' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        <LineChartIcon className="w-3.5 h-3.5" />
                        <span>الرسم فقط</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowClassMeanLine(!showClassMeanLine)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                        showClassMeanLine
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>معدل القسم: {showClassMeanLine ? 'ظاهر' : 'مخفي'}</span>
                    </button>
                  </div>
                </div>

                {/* Cohort Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setCohortFilter('all')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>الجميع ({studentMetrics.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortFilter('top')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'top'
                        ? 'bg-blue-700 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>المتفوقون ≥14 ({cohortStats.top})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortFilter('medium')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'medium'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>المتوسطون 10-13.99 ({cohortStats.medium})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortFilter('at_risk')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'at_risk'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>المتعثرون &lt;10 ({cohortStats.atRisk})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortFilter('improving')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'improving'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>في تحسن ↗ ({cohortStats.improving})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCohortFilter('declining')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                      cohortFilter === 'declining'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>في تراجع ↘ ({cohortStats.declining})</span>
                  </button>
                </div>
              </div>

              {/* Multi-Student Interactive Comparison Chart (When visible) */}
              {(viewMode === 'all' || viewMode === 'chart_only') && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <LineChartIcon className="w-4 h-4 text-blue-600" />
                        <span>منحنى تطور التلاميذ المختارين مقارنة بالفروض ومعدل القسم</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        انقر على أي تلميذ في الجدول أدناه لعرض أو إخفاء مساره في هذا الرسم البياني (حتى 6 تلاميذ معاً)
                      </p>
                    </div>

                    {selectedStudentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds([])}
                        className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إلغاء تحديد الكل ({selectedStudentIds.length})</span>
                      </button>
                    )}
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={multiStudentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 20]} stroke="#94a3b8" tick={{ fontSize: 11 }} ticks={[0, 5, 10, 15, 20]} />
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'عتبة النجاح (10)', fill: '#ef4444', fontSize: 10, position: 'right' }} />

                        {showClassMeanLine && (
                          <Line
                            type="monotone"
                            dataKey="معدل القسم"
                            stroke="#94a3b8"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ r: 4, fill: '#94a3b8' }}
                          />
                        )}

                        {selectedStudentIds.map((id, idx) => {
                          const std = studentMetrics.find(s => s.id === id);
                          if (!std) return null;
                          const color = STUDENT_PALETTE[idx % STUDENT_PALETTE.length];
                          return (
                            <Line
                              key={std.id}
                              type="monotone"
                              dataKey={std.name}
                              stroke={color}
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: color }}
                              activeDot={{ r: 6 }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Student Table */}
              {(viewMode === 'all' || viewMode === 'table_only') && (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <TableIcon className="w-4 h-4 text-blue-600" />
                      <span>كشف نتائج وتطور التلاميذ ({filteredStudents.length} تلميذ)</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      اضغط على رأس أي عمود للترتيب تصاعدياً أو تنازلياً
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-center w-12">تحديد</th>
                          <th
                            className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              if (sortField === 'name') setSortAsc(!sortAsc);
                              else { setSortField('name'); setSortAsc(true); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1">
                              اسم التلميذ(ة)
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </span>
                          </th>
                          <th className="p-3 text-center">القسم</th>
                          <th
                            className="p-3 text-center cursor-pointer hover:bg-slate-100"
                            onClick={() => {
                              if (sortField === 'f1') setSortAsc(!sortAsc);
                              else { setSortField('f1'); setSortAsc(false); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1">
                              F1 (الفرض 1)
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </span>
                          </th>
                          <th
                            className="p-3 text-center cursor-pointer hover:bg-slate-100"
                            onClick={() => {
                              if (sortField === 'f2') setSortAsc(!sortAsc);
                              else { setSortField('f2'); setSortAsc(false); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1">
                              F2 (الفرض 2)
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </span>
                          </th>
                          <th
                            className="p-3 text-center cursor-pointer hover:bg-slate-100"
                            onClick={() => {
                              if (sortField === 'f3') setSortAsc(!sortAsc);
                              else { setSortField('f3'); setSortAsc(false); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1">
                              F3 (الفرض 3)
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </span>
                          </th>
                          {hasF4 && (
                            <th
                              className="p-3 text-center cursor-pointer hover:bg-slate-100 bg-pink-50/40 text-pink-900"
                              onClick={() => {
                                if (sortField === 'f4') setSortAsc(!sortAsc);
                                else { setSortField('f4'); setSortAsc(false); }
                              }}
                              title="الفرض المحروس الرابع (خاص بشعبة العلوم الرياضية وفق المذكرة 142-08)"
                            >
                              <span className="inline-flex items-center gap-1">
                                F4 (الفرض 4)
                                <ArrowUpDown className="w-3 h-3 text-pink-500" />
                              </span>
                            </th>
                          )}
                          <th
                            className="p-3 text-center cursor-pointer hover:bg-slate-100 bg-blue-50/50"
                            onClick={() => {
                              if (sortField === 'avg') setSortAsc(!sortAsc);
                              else { setSortField('avg'); setSortAsc(false); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1 text-blue-900 font-black">
                              المعدل
                              <ArrowUpDown className="w-3 h-3 text-blue-500" />
                            </span>
                          </th>
                          <th
                            className="p-3 text-center cursor-pointer hover:bg-slate-100"
                            onClick={() => {
                              if (sortField === 'delta') setSortAsc(!sortAsc);
                              else { setSortField('delta'); setSortAsc(false); }
                            }}
                          >
                            <span className="inline-flex items-center gap-1">
                              التطور (Δ)
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            </span>
                          </th>
                          <th className="p-3 text-center">أعلى فرض (الذروة)</th>
                          <th className="p-3 text-center">التقدير الرسمي</th>
                          <th className="p-3 text-center">تحليل AI المقارن</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map(std => {
                          const isSelected = selectedStudentIds.includes(std.id);
                          const apprec = getMoroccanAppreciation(std.avg);
                          const isZeroF1 = std.f1 !== null && std.f1 === 0;
                          const isZeroF2 = std.f2 !== null && std.f2 === 0;
                          const isZeroF3 = std.f3 !== null && std.f3 === 0;
                          const isZeroF4 = std.f4 !== null && std.f4 !== undefined && std.f4 === 0;

                          return (
                            <tr
                              key={std.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                isSelected ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleStudentSelection(std.id)}
                                  className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span>{std.name}</span>
                                  {std.massar && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({std.massar})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-center text-slate-500 font-semibold">{std.className}</td>
                              <td className="p-3 text-center font-mono font-bold">
                                {std.f1 !== null ? (
                                  <span className={isZeroF1 ? 'text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : ''}>
                                    {std.f1}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                {std.f2 !== null ? (
                                  <span className={isZeroF2 ? 'text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : ''}>
                                    {std.f2}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                {std.f3 !== null ? (
                                  <span className={isZeroF3 ? 'text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : ''}>
                                    {std.f3}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              {hasF4 && (
                                <td className="p-3 text-center font-mono font-bold bg-pink-50/20">
                                  {std.f4 !== null && std.f4 !== undefined ? (
                                    <span className={isZeroF4 ? 'text-rose-600 font-black bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200' : 'text-pink-700'}>
                                      {std.f4}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              )}
                              <td className="p-3 text-center font-mono font-black text-sm bg-blue-50/30">
                                {std.avg !== null ? (
                                  <span className={std.avg < 10 ? 'text-rose-600' : 'text-blue-700'}>
                                    {std.avg}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono font-bold">
                                {std.delta !== null ? (
                                  std.delta > 0 ? (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" /> +{std.delta}
                                    </span>
                                  ) : std.delta < 0 ? (
                                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                      <TrendingDown className="w-3 h-3" /> {std.delta}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                      <Scale className="w-3 h-3" /> 0.0
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono">
                                {std.bestMark !== null ? (
                                  <span className="font-bold text-amber-700 inline-flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5 text-amber-500" />
                                    <span>{std.bestMark}</span>
                                    <span className="text-[10px] text-slate-400">({std.bestExamTitle})</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-md inline-flex items-center gap-1"
                                  style={{ color: apprec.color, backgroundColor: apprec.bg }}
                                >
                                  <apprec.icon className="w-3 h-3" />
                                  <span>{apprec.text}</span>
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAiCompareClassName(std.className);
                                    setAiCompareStudentId(std.id);
                                    setIsAiCompareModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 border border-indigo-200 hover:from-indigo-100 hover:to-blue-100 transition-colors shadow-2xs cursor-pointer group"
                                  title="مقارنة أداء هذا التلميذ في فروض المراقبة المستمرة مع معدله في الفروض المحروسة وتقديم توصيات شخصية"
                                >
                                  <Sparkles className="w-3 h-3 text-indigo-600 group-hover:scale-110 transition-transform" />
                                  <span>مقارنة AI</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 3: الاتجاه العام وتطور المحطات (Longitudinal Macro Trend)
             ========================================================================= */}
          {activeTab === 'macro_trend' && (
            <div className="w-full space-y-5">
              {/* Diagnostic Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">مسار ومؤشر التوجه العام</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${
                        macroTrend.delta >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {macroTrend.delta >= 0 ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>منحنى تصاعدي إيجابي</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>منحنى تراجعي</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black font-mono tabular-nums text-slate-900">
                      {macroTrend.delta > 0 ? `+${macroTrend.delta}` : macroTrend.delta}
                    </span>
                    <span className="text-sm font-bold text-slate-500">نقطة فارق إجمالي</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    متوسط التغير الصافي بين نقطة الفرض الأول وآخر محطة تقويمية منجزة بالقسم.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">توزيع اتجاه التلاميذ</span>
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-black text-emerald-600 font-mono">
                        {macroTrend.improvingPercent}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span>تحسنوا (↗)</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div>
                      <div className="text-2xl font-black text-slate-700 font-mono">
                        {macroTrend.stablePercent}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-0.5">
                        <Scale className="w-3 h-3 text-slate-500" />
                        <span>استقروا (↔)</span>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div>
                      <div className="text-2xl font-black text-rose-600 font-mono">
                        {macroTrend.decliningPercent}%
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3 text-rose-500" />
                        <span>تراجعوا (↘)</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    نسبة المتعلمين الذين حققوا قفزة إيجابية في نقط الفروض المتتالية.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">مؤشر الاستقرار البيداغوجي</span>
                    <FileCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-900 font-mono">
                    {cohortStats.passPct}%
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    نسبة النجاح والاستيفاء التراكمية في الدورة الحالية مع الحفاظ على عتبة 10/20.
                  </p>
                </div>
              </div>

              {/* Longitudinal Full Area Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <LineChartIcon className="w-5 h-5 text-blue-600" />
                      <span>المسار الطولي للمعدل والوسيط والشرائح الإحصائية (Q1 / Median / Q3)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تطور منحنى تحصيل تلاميذ القسم عبر محطات المراقبة المستمرة الثلاث للدورة
                    </p>
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={macroTrendChartData} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorAvgFull" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12, fontWeight: 700 }} />
                      <YAxis domain={[0, 20]} stroke="#94a3b8" tick={{ fontSize: 11 }} ticks={[0, 4, 8, 10, 12, 16, 20]} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                      <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'عتبة النجاح (10)', fill: '#ef4444', fontSize: 11, position: 'right' }} />
                      <Area type="monotone" dataKey="المعدل العام" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorAvgFull)" />
                      <Line type="monotone" dataKey="الوسيط (Median)" stroke="#10b981" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="الشريحة المتفوقة (Q3)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="شريحة التعثر (Q1)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 4: فئات التحكم والذروة التحصيلية (Mastery Brackets & Peak Analysis)
             ========================================================================= */}
          {activeTab === 'distribution' && (
            <div className="w-full space-y-5">
              {/* Tukey 5-Number Box-Plot (Boîte à moustaches) Section */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/80 p-2.5 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-2 pr-2">
                    <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                    <span>منظور مخطط الصندوق والساعدين (Boîte à moustaches):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBoxPlotDimension('exams')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        boxPlotDimension === 'exams'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      📊 مقارنة فروض القسم (F1 / F2 / F3)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoxPlotDimension('classes')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        boxPlotDimension === 'classes'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      🏫 مقارنة التشتت بين الأقسام المسندة
                    </button>
                  </div>
                </div>

                <BoxPlotChart
                  items={boxPlotItems}
                  title={
                    boxPlotDimension === 'exams'
                      ? `مخطط الصندوق والساعدين لتطور الفروض المحروسة (${selectedClass === 'all' ? 'جميع الأقسام' : selectedClass})`
                      : 'مخطط الصندوق والساعدين لمقارنة التجانس والتشتت بين الأقسام المسندة'
                  }
                />
              </div>

              {/* Grade Brackets Distribution Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-600" />
                      <span>التوزيع التكراري لنقط ومعدلات التلاميذ</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تصنيف تحصيل المتعلمين وفق سلم التقديرات الوزاري المغربي لمادة الرياضيات بالسلك الثانوي التأهيلي
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                      معدل القسم: {classAverages.overall !== null ? `${classAverages.overall} / 20` : '--'}
                    </span>
                    <span className="px-3 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                      عتبة الاستيفاء: 10.00 / 20
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ top: 15, right: 15, left: -10, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        tick={{ fontSize: 11, fontWeight: 700 }}
                        angle={-10}
                        textAnchor="end"
                      />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                        formatter={(val: any, _name: any, item: any) => [`${val} تلميذ (${item.payload.pct}%)`, 'العدد']}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {distributionData.map((entry, index) => (
                          <Cell key={`dist-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Brackets Breakdown Table */}
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {distributionData.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 text-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-3.5 h-3.5 rounded-full mx-auto mb-1.5" style={{ backgroundColor: b.color }} />
                      <div className="text-[11px] font-bold text-slate-700 truncate">{b.label.split(' ')[0]}</div>
                      <div className="text-xl font-black font-mono mt-1" style={{ color: b.color }}>
                        {b.count} <span className="text-xs font-normal text-slate-400 font-sans">({b.pct}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak & Potential Gap Analysis Card (الذروة ومعدل القسم لاكتشاف الطاقات الكامنة) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      <span>تحليل الذروة التحصيلية وكشف الطاقات الكامنة للتلاميذ</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      رصد الفارق بين أعلى نقطة حققها التلميذ في أي فرض ومعدله العام لاكتشاف فجوات التذبذب الدراسي
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{studentMetrics.filter(s => s.potentialGap >= 2).length} تلميذ لديهم تفاوت ملحوظ (≥2 نقاط)</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {studentMetrics
                    .filter(s => s.potentialGap >= 1.5)
                    .sort((a, b) => b.potentialGap - a.potentialGap)
                    .slice(0, 6)
                    .map(std => (
                      <div
                        key={std.id}
                        className="p-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 shadow-2xs hover:shadow-xs transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-amber-500" />
                            <span>{std.name}</span>
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                            فارق: +{std.potentialGap}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2 text-slate-600 bg-white/80 p-2 rounded-lg border border-amber-100">
                          <span>أعلى نقطة: <strong className="text-emerald-700 font-mono font-black">{std.bestMark}/20</strong> ({std.bestExamTitle})</span>
                          <span>المعدل: <strong className="font-mono font-black text-slate-800">{std.avg}/20</strong></span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
                          💡 برهن على قدرة استيعابية عالية في {std.bestExamTitle} لكنه تراجع في باقي الفروض، مما يدل على وجود إمكانية تفوق تحتاج لتحفيز ومتابعة مستمرة.
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 5: رصد التعثر والتدخل الاستباقي (Early Alert & At-Risk Diagnostic)
             ========================================================================= */}
          {activeTab === 'at_risk' && (
            <div className="w-full space-y-5">
              {/* Alert Header Banner */}
              <div className="bg-gradient-to-l from-rose-50 via-white to-amber-50 p-5 rounded-2xl border border-rose-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-rose-500/25 flex-shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-rose-950 flex items-center gap-2">
                      <span>منظومة الرصد الاستباقي للتعثر والتدخل العلاجي</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        {cohortStats.atRisk} تلميذ(ة) دون العتبة
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      تشخيص مبكر للتعثرات الرياضية وفق التوجيهات التربوية الرسمية لوزارة التربية الوطنية لمنع الهدر المدرسي ومعالجة الفجوات المفاهيمية.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai_remediation')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>توليد خطة دعم مخصصة (AI)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>تصدير لائحة المتعثرين</span>
                  </button>
                </div>
              </div>

              {/* Diagnostic Metric Cards for Risk Categories */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>تعثر حاد (&lt; 08 / 20)</span>
                    <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                      <ShieldAlert className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-700 mt-1">
                    {studentMetrics.filter(s => s.avg !== null && s.avg < 8).length}
                    <span className="text-xs font-normal text-slate-400 mr-1.5 font-sans">تلميذ</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    يتطلب معالجة فورية وتفريد التعلمات في المكتسبات القبلية الضرورية للمقرر.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>دون عتبة الاستيفاء (08 - 09.99)</span>
                    <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-700 mt-1">
                    {studentMetrics.filter(s => s.avg !== null && s.avg >= 8 && s.avg < 10).length}
                    <span className="text-xs font-normal text-slate-400 mr-1.5 font-sans">تلميذ</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    قريب من عتبة النجاح، بحاجة لأنشطة تطبيقية مباشرة وسلاسل داعمة موجهة.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>تراجع مفاجئ (انخفاض ≥ 2.0 ن)</span>
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <TrendingDown className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-700 mt-1">
                    {studentMetrics.filter(s => s.delta !== null && s.delta <= -2).length}
                    <span className="text-xs font-normal text-slate-400 mr-1.5 font-sans">تلميذ</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    تلاميذ شهدت نقطهم انحداراً ملحوظاً، قد يرتبط بتراكم الغياب أو صعوبة الدرس.
                  </p>
                </div>
              </div>

              {/* Detailed Student At-Risk Diagnostic List */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-600" />
                    <span>كشف التلاميذ المستهدفين ببرنامج الدعم والاستدراك</span>
                  </h4>
                  <span className="text-xs text-slate-500">
                    مرتب حسب درجة التعثر والحاجة للدعم البيداغوجي
                  </span>
                </div>

                {studentMetrics.filter(s => (s.avg !== null && s.avg < 10) || (s.delta !== null && s.delta <= -2)).length === 0 ? (
                  <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <div className="font-bold text-sm">ممتاز! لا يوجد أي تلميذ في وضعية تعثر حادة بالقسم حالياً.</div>
                    <p className="text-xs text-emerald-700 mt-1">جميع التلاميذ مستوفون لعتبة النجاح أو لم تسجل حالات تراجع مقلقة.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {studentMetrics
                      .filter(s => (s.avg !== null && s.avg < 10) || (s.delta !== null && s.delta <= -2))
                      .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
                      .map(std => {
                        const isSevere = std.avg !== null && std.avg < 8;
                        const isSuddenDrop = std.delta !== null && std.delta <= -2;

                        return (
                          <div
                            key={std.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              isSevere
                                ? 'bg-gradient-to-br from-rose-50/60 to-white border-rose-200 shadow-2xs'
                                : 'bg-gradient-to-br from-amber-50/50 to-white border-amber-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div>
                                <span className="font-black text-xs text-slate-900 block truncate">
                                  {std.name}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {std.className}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isSevere
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : isSuddenDrop
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}
                              >
                                {isSevere ? 'تعثر حاد' : isSuddenDrop ? 'تراجع مفاجئ' : 'دون العتبة'}
                              </span>
                            </div>

                            {/* Marks Row */}
                            <div className="grid grid-cols-4 gap-1 p-2 bg-white/90 rounded-xl border border-slate-200/80 text-center my-2.5">
                              <div>
                                <span className="text-[9px] text-slate-400 block">ف1</span>
                                <span className="text-xs font-mono font-bold text-slate-800">
                                  {std.f1 !== null ? std.f1 : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">ف2</span>
                                <span className="text-xs font-mono font-bold text-slate-800">
                                  {std.f2 !== null ? std.f2 : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">ف3</span>
                                <span className="text-xs font-mono font-bold text-slate-800">
                                  {std.f3 !== null ? std.f3 : '-'}
                                </span>
                              </div>
                              <div className="border-r border-slate-200">
                                <span className="text-[9px] text-slate-500 font-bold block">المعدل</span>
                                <span
                                  className={`text-xs font-mono font-black ${
                                    isSevere ? 'text-rose-600' : 'text-amber-600'
                                  }`}
                                >
                                  {std.avg !== null ? std.avg : '-'}
                                </span>
                              </div>
                            </div>

                            {/* Error Symptoms / Pedagogical Action */}
                            <p className="text-[10px] text-slate-600 leading-relaxed mb-3">
                              {isSevere
                                ? '⚠️ يحتاج إلى دعم مكثف في الحساب الجبري وقواعد الاستدلال الرياضي الأساسية.'
                                : isSuddenDrop
                                ? '📉 تراجع ملحوظ بين الفروض؛ يُرجى فحص ملف الغياب والمواظبة أو صعوبة المحور.'
                                : '📌 بحاجة لتعزيز مهارات التطبيق المباشر والمعارف المألوفة لرفع المعدل فوق 10.'}
                            </p>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setActiveTab('ai_remediation')}
                                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-[11px] border border-purple-200 transition-colors"
                              >
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                <span>خطة دعم مخصصة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentIds([std.id]);
                                  setActiveTab('comparison');
                                }}
                                className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                                title="مقارنة مسار التلميذ في الجدول"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE: مقارنة نسب الغياب ونسب النجاح في الفروض الموحدة لكل قسم
              Class-by-Class Absence vs. Exam Success Rates Analytics
             ========================================================================= */}
          {activeTab === 'absence_vs_success' && (
            <div className="w-full space-y-5">
              {/* Official Moroccan Guidelines & Analytical Banner */}
              <div className="bg-gradient-to-l from-amber-700 via-orange-800 to-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 flex-shrink-0">
                      <BarChart3 className="w-6 h-6 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-black tracking-tight flex items-center gap-2">
                        <span>مقارنة نسب الغياب ونسب النجاح في الفروض الموحدة لكل قسم</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                          {semester === 's1' ? 'الدورة الأولى' : 'الدورة الثانية'}
                        </span>
                      </h3>
                      <p className="text-xs text-amber-100/80 mt-1">
                        دراسة بيانية إحصائية للعلاقة الترابطية بين مواظبة التلاميذ ونسب استيفاء عتبة النجاح (≥ 10/20) ونسب التفوق في الفروض المحروسة
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                      type="button"
                      onClick={() => setSemester(semester === 's1' ? 's2' : 's1')}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{semester === 's1' ? 'الانتقال للدورة 2' : 'الانتقال للدورة 1'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة التقرير المقارن</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Summary KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>متوسط نسبة النجاح الموحدة</span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl md:text-3xl font-black font-mono text-emerald-700 mt-1">
                    {overallAbsenceSuccessKPIs.avgSuccessRate}%
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>نسبة التلاميذ الحاصلين على ≥ 10/20</span>
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>معدل الغياب الإجمالي للأقسام</span>
                    <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-2xl md:text-3xl font-black font-mono text-rose-700 mt-1">
                    {overallAbsenceSuccessKPIs.avgAbsenceRate}%
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span>إجمالي الساعات المهدورة: {overallAbsenceSuccessKPIs.totalAbsentHoursAllClasses} س</span>
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>القسم الأعلى نجاحاً بالفروض</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Award className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-blue-700 mt-1 truncate">
                    {overallAbsenceSuccessKPIs.topClassBySuccess}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    أعلى معدل استيفاء وتفوق في الرياضيات
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>القسم الأكثر انضباطاً (أقل غياب)</span>
                    <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                      <GraduationCap className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xl md:text-2xl font-black text-teal-700 mt-1 truncate">
                    {overallAbsenceSuccessKPIs.bestDisciplinedClass}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    أعلى التزام بحصص وساعات الرياضيات
                  </p>
                </div>
              </div>

              {/* Chart 1: Dual-Axis Composed Chart (Class Success vs Absence Rates) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                      <span>المخطط البياني المقارن المركب: نسب النجاح مقابل نسبة الغياب لكل قسم</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      الأعمدة الخضراء والزرقاء تمثل نسب النجاح والاستحقاق (المحور الأيسر 0-100%)، والخط الأحمر يمثل نسبة الغياب (المحور الأيمن)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      نسبة النجاح (≥10)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      نسبة الاستحقاق (≥12)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      نسبة الغياب (%)
                    </span>
                  </div>
                </div>

                <div className="w-full h-80 pt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={classAbsenceSuccessComparison}
                      margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="className"
                        stroke="#64748b"
                        tick={{ fontSize: 11, fontWeight: 700 }}
                      />
                      <YAxis
                        yAxisId="left"
                        domain={[0, 100]}
                        stroke="#10b981"
                        unit="%"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'نسبة النجاح (%)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#10b981',
                          fontSize: 10
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        stroke="#ef4444"
                        unit="%"
                        tick={{ fontSize: 11 }}
                        label={{
                          value: 'نسبة الغياب (%)',
                          angle: 90,
                          position: 'insideRight',
                          fill: '#ef4444',
                          fontSize: 10
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 text-right min-w-[200px]" dir="rtl">
                                <div className="font-black text-sm text-amber-300 border-b border-slate-700 pb-1">
                                  قسم: {data.className}
                                </div>
                                <div className="text-slate-300">
                                  عدد التلاميذ: <span className="font-bold text-white">{data.studentCount}</span>
                                </div>
                                <div className="text-emerald-400 font-bold">
                                  نسبة النجاح بالفروض: {data.overallSuccessRate}%
                                </div>
                                <div className="text-sky-400 font-bold">
                                  نسبة الاستحقاق (≥12): {data.overallDistinctionRate}%
                                </div>
                                <div className="text-rose-400 font-bold">
                                  نسبة الغياب الإجمالية: {data.absenceRatePercent}% ({data.totalAbsentHours} س)
                                </div>
                                <div className="text-amber-300 text-[11px] pt-1 border-t border-slate-700">
                                  معدل الفروض العام: {data.overallExamAverage} / 20
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      <Bar
                        yAxisId="left"
                        dataKey="overallSuccessRate"
                        name="نسبة النجاح بالفروض (≥10/20)"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                        barSize={32}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="overallDistinctionRate"
                        name="نسبة الاستحقاق والتفوق (≥12/20)"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                        barSize={32}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="absenceRatePercent"
                        name="نسبة الغياب الإجمالية للقسم (%)"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#dc2626', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2 & Chart 3 Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Chart 2: Multi-Bar Success Rate per Exam (F1, F2, F3) vs Class Absence Rate */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>مقارنة نسب النجاح بكل فرض موحد مقابل معدل غياب القسم</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تتبع نسب استيفاء الفرض 1 والفرض 2 والفرض 3 مع معدل الغياب العام لكل قسم
                    </p>
                  </div>

                  <div className="w-full h-72" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={classAbsenceSuccessComparison}
                        margin={{ top: 15, right: 15, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="className"
                          stroke="#64748b"
                          tick={{ fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis domain={[0, 100]} stroke="#64748b" unit="%" tick={{ fontSize: 11 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 text-right" dir="rtl">
                                  <div className="font-bold text-amber-300 pb-1 border-b border-slate-700">
                                    {d.className}
                                  </div>
                                  <div>نجاح فرض 1: <span className="font-bold text-indigo-300">{d.f1SuccessRate}%</span></div>
                                  <div>نجاح فرض 2: <span className="font-bold text-purple-300">{d.f2SuccessRate}%</span></div>
                                  <div>نجاح فرض 3: <span className="font-bold text-pink-300">{d.f3SuccessRate}%</span></div>
                                  <div className="text-rose-400 font-bold pt-1 border-t border-slate-700">
                                    معدل الغياب: {d.absenceRatePercent}%
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="f1SuccessRate" name="الفرض 1 (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="f2SuccessRate" name="الفرض 2 (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="f3SuccessRate" name="الفرض 3 (%)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absenceRatePercent" name="نسبة الغياب (%)" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Correlation Curve: Average Exam Score vs. Student Absent Hours */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                  <div className="border-b border-slate-100 pb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-violet-600" />
                      <span>منحنى الارتباط: معدل الفروض الموحدة (/20) ومتوسط ساعات غياب التلميذ</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      انعكاس ساعات الغياب المهدورة لكل تلميذ على انخفاض المعدل النقطي العام للفروض
                    </p>
                  </div>

                  <div className="w-full h-72" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={classAbsenceSuccessComparison}
                        margin={{ top: 15, right: 15, left: 0, bottom: 20 }}
                      >
                        <defs>
                          <linearGradient id="colorAvgGrade" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="colorAbsentHours" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis
                          dataKey="className"
                          stroke="#64748b"
                          tick={{ fontSize: 11, fontWeight: 700 }}
                        />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 text-right" dir="rtl">
                                  <div className="font-bold text-amber-300 pb-1 border-b border-slate-700">
                                    {d.className}
                                  </div>
                                  <div className="text-purple-300">
                                    معدل الفروض العام: <span className="font-bold">{d.overallExamAverage} / 20</span>
                                  </div>
                                  <div className="text-rose-300">
                                    معدل ساعات الغياب / تلميذ: <span className="font-bold">{d.avgAbsentHours} س</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area
                          type="monotone"
                          dataKey="overallExamAverage"
                          name="معدل الفروض العام (/20)"
                          stroke="#8b5cf6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorAvgGrade)"
                        />
                        <Area
                          type="monotone"
                          dataKey="avgAbsentHours"
                          name="متوسط ساعات الغياب لكل تلميذ (س)"
                          stroke="#f43f5e"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorAbsentHours)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Comprehensive Class Comparison Analytics Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-blue-600" />
                      <span>جدول المقارنة الإحصائي التفصيلي بين الأقسام (نسب الغياب، نسب النجاح والأثر التربوي)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      مقارنة تركيبية شاملة لجميع الأقسام وفق مؤشرات المراقبة المستمرة لمادة الرياضيات
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-black">
                        <th className="py-3 px-3.5 text-center">القسم</th>
                        <th className="py-3 px-3 text-center">عدد التلاميذ</th>
                        <th className="py-3 px-3 text-center">مجموع س.الغياب</th>
                        <th className="py-3 px-3 text-center">نسبة الغياب</th>
                        <th className="py-3 px-3 text-center">نسبة المواظبة</th>
                        <th className="py-3 px-3 text-center">نجاح فرض 1</th>
                        <th className="py-3 px-3 text-center">نجاح فرض 2</th>
                        <th className="py-3 px-3 text-center">نجاح فرض 3</th>
                        <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-950">نسبة النجاح العامة</th>
                        <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-950">نسبة الاستحقاق (≥12)</th>
                        <th className="py-3 px-3 text-center">معدل القسم</th>
                        <th className="py-3 px-3.5 text-center">الأثر التربوي للغياب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classAbsenceSuccessComparison.map((cls) => {
                        return (
                          <tr key={cls.className} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 text-center font-bold text-slate-900 font-mono">
                              {cls.className}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {cls.studentCount}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-rose-600 font-bold">
                              {cls.totalAbsentHours} س
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                cls.absenceRatePercent >= 8
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : cls.absenceRatePercent >= 4
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {cls.absenceRatePercent}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                              {cls.attendanceRatePercent}%
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {cls.f1TestedCount > 0 ? `${cls.f1SuccessRate}%` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {cls.f2TestedCount > 0 ? `${cls.f2SuccessRate}%` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              {cls.f3TestedCount > 0 ? `${cls.f3SuccessRate}%` : '-'}
                            </td>
                            <td className="py-3 px-3 text-center bg-emerald-50/30 font-mono font-black text-emerald-700">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold">
                                {cls.overallSuccessRate}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center bg-blue-50/30 font-mono font-bold text-blue-700">
                              {cls.overallDistinctionRate}%
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-slate-900">
                              {cls.overallExamAverage > 0 ? `${cls.overallExamAverage}/20` : '-'}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {cls.impactCategory === 'high_negative' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>تأثير سلبي حاد (تدخل استعجالي)</span>
                                </span>
                              ) : cls.impactCategory === 'moderate' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>تأثير متوسط (متابعة داعمة)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>مواظبة جيدة واستقرار</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Moroccan Pedagogical Guidance on Attendance & Assessment */}
              <div className="bg-gradient-to-br from-slate-50 to-amber-50/40 p-5 rounded-2xl border border-amber-200/60 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>توجيهات تربوية وتدابير معالجة أثر الغياب على تحصيل مادة الرياضيات (السلك الثانوي التأهيلي)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-2xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>تسلسل المعارف الرياضية</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      نظراً للطبيعة التراكمية والتجريدية لمفاهيم الرياضيات بالسلك الثانوي التأهيلي (كالنهايات، الاتصال، الاشتقاق، والمتتاليات)، فإن غياب حصة واحدة يحدث ثغرة فورية تنعكس سلباً على نتائج الفرض الموالي.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-2xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>الدعم الاستدراكي المندمج</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      تفعيل أنشطة الدعم المندمج داخل الحصص وتوفير تمارين تطبيقية متدرجة عبر بطاقات الاستدراك لتعويض الحصص المهدورة قبل اجتياز الفرض المحروس الموالي وفق المذكرة 142.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-2xs space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>التنسيق مع الإدارة التربوية</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      استثمار بطاقات رصد الغياب وتصدير كشوفات المواظبة الفردية لإشعار أولياء الأمور عبر منصة مسار، ورصد التلاميذ الذين يتزامن غيابهم مع مواعيد الفروض المحروسة والأنشطة التقويمية.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 6: المرجعيات الرسمية وبطاقات التوصيف (Official Documents & Specs)
             ========================================================================= */}
          {activeTab === 'official_docs' && (
            <div className="w-full space-y-5">
              {/* Official Moroccan Guidelines Banner */}
              <div className="bg-gradient-to-l from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20 flex-shrink-0">
                    <FileCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black tracking-tight flex items-center gap-2">
                      <span>المرجعيات الرسمية والتوجيهات التربوية لمادة الرياضيات</span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        السلك الثانوي التأهيلي
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · مديرية المناهج
                    </p>
                  </div>
                </div>
              </div>

              {/* Three Cognitive Domains Framework (Note 142-08 & Secondary Math Guidelines) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span>المستويات المهارية المعتمدة في المراقبة المستمرة (المذكرة الوزارية 142-08 والتوجيهات التربوية)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    السلك الثانوي التأهيلي · مدة الفرض: ساعتان (2h00)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  تحدد المذكرة الوزارية رقم 142 والتوجيهات التربوية لمادة الرياضيات بالثانوي التأهيلي توزيعاً مهارياً متوازناً لمواضيع الفروض المحروسة:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-blue-900">1. استرداد المعارف وتطبيق مباشر</span>
                      <span className="text-xs font-mono font-black text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                        25% إلى 30% (5 - 6 ن)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      التعاريف، الخاصيات، المبرهنات الأساسية (مبرهنة القيم الوسيطية، قواعد الاشتقاق، صيغ الحساب المثلثي، نهايات مرجعية، والأشكال الجبرية للأعداد العقدية دون تعقيد).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-emerald-900">2. التطبيق في وضعيات مألوفة والاستدلال</span>
                      <span className="text-xs font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        50% إلى 55% (10 - 11 ن)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      دراسة تغيرات الدوال، رسم المنحنيات والمماسات والفروع اللانهائية، المتتاليات العددية وتقاربها، توظيف أنواع الاستدلال الرياضي (الترجع، الخلف، فصل الحالات، المضاد للعكس)، والحساب التكاملي.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-purple-900">3. الاستدلال وحل وضعيات مشكلة والتوليف</span>
                      <span className="text-xs font-mono font-black text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                        15% إلى 20% (3 - 4 ن)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      ترييض وضعيات غير مألوفة، الربط التركيبي بين مجالات الرياضيات (دوال، متتاليات، أعداد عقدية)، استثمار الدوال المساعدة، مسائل الاستمثال، وابتكار استراتيجيات البرهان.
                    </p>
                  </div>
                </div>

                {/* Additional criteria banner */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">📌 معايير التصحيح الوزارية:</span>
                    <span>سلامة المنهجية والاستدلال (70%) · دقة الحسابات والنتائج (20%) · جودة التحرير والرموز والنظافة (10% - نقطة مخصصة).</span>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200">
                    مطابقة تامة لمنظومة مسار
                  </div>
                </div>
              </div>

              {/* Direct Quick Tools Launch Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <button
                  type="button"
                  onClick={handleOpenPdfSpec}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition-all text-right cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">
                    بطاقة توصيف الفرض (PDF)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    استخراج جدول التخصيص والمواصفات الرسمية للمذكرة 142
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleOpenMassarExport}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 shadow-2xs hover:shadow-xs transition-all text-right cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">
                    تصدير إكسيل مسار
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    كشف نقط متطابق بصورة كاملة مع منظومة مسار الوزارية
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCoefficients}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all text-right cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">
                    دليل معاملات مسار
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    حاسبة معاملات مادة الرياضيات لجميع شعب ومسالك البكالوريا
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAbsenceChart}
                  className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-300 shadow-2xs hover:shadow-xs transition-all text-right cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">
                    أثر الغياب على النقط
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    التحليل البياني للعلاقة بين مواظبة التلميذ وتطور معدله
                  </p>
                </button>
              </div>

              {/* Massar Grade Entry Deadlines & Smartphone ICS Calendar Sync Card */}
              <div className="bg-gradient-to-l from-indigo-50 via-white to-teal-50 p-5 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span>الجدولة الرسمية لآجال مسك نقط المراقبة المستمرة في بوابة مسار ومزامنة الهواتف (ICS)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      وفق المقرر الوزاري لتنظيم السنة الدراسية — مع إمكانية تنزيل ملف التقويم الرقمي (.ics) لتنبيهات الهاتف الذكي
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && typeof (window as any).downloadMinisterialCalendarICS === 'function') {
                          (window as any).downloadMinisterialCalendarICS();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>مزامنة التقويم مع الهاتف (.ICS)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDirectMassarExcelExport}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>تصدير ملف مسار المباشر (.XLSX)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>الفرض المحروس 1 (الدورة 1 / 2)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200">يُمسك في مسار</span>
                    </div>
                    <p className="text-[11px] text-slate-500">آخر أجل لمسك النقط: أواخر نونبر (د1) / أواخر مارس (د2)</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>الفرض المحروس 2 (الدورة 1 / 2)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">يُمسك في مسار</span>
                    </div>
                    <p className="text-[11px] text-slate-500">آخر أجل لمسك النقط: أواخر دجنبر (د1) / منتصف ماي (د2)</p>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                      <span>الفرض 3 وحصر النتائج ومجالس الأقسام</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200">أجل حاسم</span>
                    </div>
                    <p className="text-[11px] text-slate-500">آخر أجل لمسك النقط واستصدار البيانات: منتصف يناير (د1) / أوائل يونيو (د2)</p>
                  </div>

                  <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-300">
                    <div className="flex items-center justify-between font-black text-amber-950 mb-1">
                      <span>🏠 الفرض المنزلي (DM)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200/80 text-amber-950 border border-amber-400 font-black">🚫 لا يُمسك في مسار</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      يُمنح للتلميذ ليحله في المنزل ثم يُجمع ويُصحح جماعياً في القسم (تقويم تكويني ودعم لا يدخل في حساب معدل مسار).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              WORKSPACE 7: مختبر السيكومتريا والتوجيه التربوي والمدرسي وتوقعات البكالوريا
              Advanced Psychometric Statistics & Moroccan Academic/Pedagogical Guidance Hub
             ========================================================================= */}
          {activeTab === 'guidance_stats' && (
            <div className="w-full space-y-5">
              {/* Header Banner */}
              <div className="bg-gradient-to-l from-indigo-950 via-slate-900 to-violet-950 text-white p-6 rounded-2xl shadow-sm border border-indigo-700/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 flex-shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base md:text-lg font-black tracking-tight">
                        مختبر التحليل السيكومتري المتقدم والتوجيه التربوي والمدرسي ({selectedClass === 'all' ? 'جميع الأقسام' : selectedClass})
                      </h2>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        المذكرة 142-08 · مسطرة التوجيه المدرسي والمهني
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      تشخيص إحصائي دقيق لتجانس القسم (CV%)، معامل الالتواء، صدق وتمييز الفروض المحروسة، مع مصفوفة التوجيه نحو الشعب والمسالك وتوقع نتائج الامتحان الوطني الموحد.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-300" />
                    <span>طباعة بطاقات التوجيه والسيكومتريا</span>
                  </button>
                </div>
              </div>

              {/* Section 1: 4 Deep Psychometric & Biometric Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Coefficient of Variation & Homogeneity */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>معامل الاختلاف والتجانس (CV%)</span>
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <Scale className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black font-mono text-slate-900">
                        {advancedStatisticalAndGuidanceMatrix.cvPercent !== null ? `${advancedStatisticalAndGuidanceMatrix.cvPercent}%` : '--'}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${advancedStatisticalAndGuidanceMatrix.homogeneityStatus.color}`}>
                        {advancedStatisticalAndGuidanceMatrix.homogeneityStatus.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      {advancedStatisticalAndGuidanceMatrix.homogeneityStatus.advice}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>σ = {advancedStatisticalAndGuidanceMatrix.stdDev ?? '--'}</span>
                    <span>σ² = {advancedStatisticalAndGuidanceMatrix.variance ?? '--'}</span>
                    <span>x̄ = {advancedStatisticalAndGuidanceMatrix.mean ?? '--'}</span>
                  </div>
                </div>

                {/* Card 2: Interquartile Range IQR & Box-Plot Dispersion */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>المدى الربيعي وتمركز النقط (IQR)</span>
                      <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                        <Layers className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black font-mono text-teal-700">
                        {advancedStatisticalAndGuidanceMatrix.iqr ?? '--'}
                      </span>
                      <span className="text-xs font-bold text-slate-500">نقطة (اتساع الـ 50% الوسطى)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      نصف تلاميذ القسم تتراوح معدلاتهم بين الربيع الأدنى <strong className="font-mono">{advancedStatisticalAndGuidanceMatrix.q1 ?? '--'}</strong> والربيع الأعلى <strong className="font-mono">{advancedStatisticalAndGuidanceMatrix.q3 ?? '--'}</strong> بوسيط قدره <strong className="font-mono">{advancedStatisticalAndGuidanceMatrix.median ?? '--'}/20</strong>.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Q1: {advancedStatisticalAndGuidanceMatrix.q1 ?? '--'}</span>
                    <span>Med: {advancedStatisticalAndGuidanceMatrix.median ?? '--'}</span>
                    <span>Q3: {advancedStatisticalAndGuidanceMatrix.q3 ?? '--'}</span>
                  </div>
                </div>

                {/* Card 3: Distribution Skewness (Pearson Sk) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>معامل الالتواء والتماثل (Skewness)</span>
                      <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                        <BarChart3 className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black font-mono text-purple-700">
                        {advancedStatisticalAndGuidanceMatrix.skewness ?? '--'}
                      </span>
                      <span className="text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        {advancedStatisticalAndGuidanceMatrix.skewness !== null
                          ? advancedStatisticalAndGuidanceMatrix.skewness < -0.25
                            ? 'التواء سالب (نحو الأعلى)'
                            : advancedStatisticalAndGuidanceMatrix.skewness > 0.25
                            ? 'التواء موجب (نحو الأدنى)'
                            : 'توزيع غوصي متماثل'
                          : 'غير متاح'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      {advancedStatisticalAndGuidanceMatrix.skewnessInterpretation}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>الفرق (x̄ - Med):</span>
                    <strong className="font-mono text-slate-700">
                      {advancedStatisticalAndGuidanceMatrix.mean !== null && advancedStatisticalAndGuidanceMatrix.median !== null
                        ? (advancedStatisticalAndGuidanceMatrix.mean - advancedStatisticalAndGuidanceMatrix.median).toFixed(2)
                        : '--'}
                    </strong>
                  </div>
                </div>

                {/* Card 4: Pearson Correlation Absence vs Grade */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                      <span>معامل ارتباط بيرسون (الغياب × التحصيل)</span>
                      <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                        <Activity className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black font-mono text-amber-700">
                        {annualConsolidatedStats.absenceGradeCorrelationR ?? '--'}
                      </span>
                      <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {annualConsolidatedStats.absenceGradeCorrelationR !== null
                          ? annualConsolidatedStats.absenceGradeCorrelationR <= -0.4
                            ? 'ارتباط عكسي قوي'
                            : annualConsolidatedStats.absenceGradeCorrelationR < -0.15
                            ? 'ارتباط عكسي متوسط'
                            : 'تأثير ضعيف / مواظبة مستقرة'
                          : 'بيانات غياب محدودة'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
                      معدل المواظبين تماماً (0 س): <strong className="font-mono text-emerald-700">{annualConsolidatedStats.zeroAbsenceAvgGrade ?? '--'}/20</strong> مقابل <strong className="font-mono text-rose-600">{annualConsolidatedStats.highAbsenceAvgGrade ?? '--'}/20</strong> لذوي الغياب المتكرر.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>نسبة المواظبة الإجمالية:</span>
                    <strong className="font-mono text-emerald-700">{annualConsolidatedStats.attendanceRatePct}%</strong>
                  </div>
                </div>
              </div>

              {/* Section 2: Psychometric Exam Validity (Difficulty P% & Discrimination D for F1-F4) */}
              {advancedStatisticalAndGuidanceMatrix.examPsychometrics.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <span>التحليل السيكومتري لمصداقية الفروض المحروسة (معامل اليسر/التحكم P% ومعامل التمييز D)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        يقيس معامل التمييز (D) قدرة الفرض المحروس على التفرقة بين الفئة المتمكنة (أعلى 27%) والفئة المتعثرة (أدنى 27%) طبقاً لمعايير القياس والتقويم التربوي.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                      المعيار المرجعي: 45% ≤ P ≤ 75% | D ≥ 0.25
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {advancedStatisticalAndGuidanceMatrix.examPsychometrics.map(ex => (
                      <div key={ex.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">{ex.title}</span>
                          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            x̄ = {ex.mean}/20
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 font-bold">مؤشر التحكم (P)</div>
                            <div className="text-sm font-black font-mono text-teal-700 mt-0.5">{ex.difficultyIdxPct}%</div>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200/80">
                            <div className="text-[10px] text-slate-500 font-bold">معامل التمييز (D)</div>
                            <div className="text-sm font-black font-mono text-indigo-700 mt-0.5">{ex.discriminationIdx}</div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 flex items-center justify-between font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-100">
                          <span>أعلى 27%: <strong className="text-emerald-700">{ex.topGroupMean}</strong></span>
                          <span>أدنى 27%: <strong className="text-rose-600">{ex.bottomGroupMean}</strong></span>
                        </div>

                        <div className="text-[11px] font-bold text-slate-700 bg-indigo-50/70 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                          📌 {ex.psychometricVerdict}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 3: Academic & Pedagogical Orientation Matrix per Student */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      <span>مصفوفة التوجيه التربوي والمدرسي وتوقعات الاستحقاق الوطني لكل متعلم(ة)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      توصيات آلية مبنية على المعدل الفصلي، معامل المادة، مؤشر الانتظام (σ)، الدرجة المعيارية (Z-Score)، وسجل المواظبة لمواكبة مجالس الأقسام والتوجيه.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'all', label: `الكل (${advancedStatisticalAndGuidanceMatrix.studentGuidanceList.length})`, color: 'bg-slate-800 text-white' },
                      { id: 'sm_elite', label: `مسار التميز / علوم رياضية ومعاهد عليا (${advancedStatisticalAndGuidanceMatrix.smEliteCount})`, color: 'bg-emerald-600 text-white' },
                      { id: 'pc_svt', label: `مسار علمي متوازن PC/SVT/ECO (${advancedStatisticalAndGuidanceMatrix.pcSvtReadyCount})`, color: 'bg-blue-600 text-white' },
                      { id: 'support_reorient', label: `يستوجب دعماً أو إعادة توجيه (${advancedStatisticalAndGuidanceMatrix.supportReorientCount})`, color: 'bg-rose-600 text-white' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setGuidanceFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          guidanceFilter === f.id
                            ? `${f.color} shadow-2xs`
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-black text-slate-600">
                        <th className="py-3 px-3">التلميذ(ة) والقسم</th>
                        <th className="py-3 px-2.5 text-center">المعدل والمعامل</th>
                        <th className="py-3 px-2.5 text-center">الدرجة المعيارية (Z)</th>
                        <th className="py-3 px-2.5 text-center">مؤشر الانتظام (σ)</th>
                        <th className="py-3 px-2.5 text-center">توقع الاستحقاق / الوطني</th>
                        <th className="py-3 px-3">قرار التوجيه المدرسي / المسلك المقترح</th>
                        <th className="py-3 px-3">التوصية البيداغوجية وخطة المواكبة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {advancedStatisticalAndGuidanceMatrix.studentGuidanceList
                        .filter(s => guidanceFilter === 'all' ? true : s.orientationTier === guidanceFilter)
                        .map(std => (
                          <tr key={`${std.className}-${std.id}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-black text-slate-900">{std.name}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{std.className}</span>
                                {std.absentHours > 0 && (
                                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                    غياب: {std.absentHours} س
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-2.5 text-center">
                              <div className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                                (std.avg ?? 0) >= 14
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : (std.avg ?? 0) >= 10
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {std.avg}/20
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold mt-1">
                                معامل {std.coef} ({std.weightedPoints} ن)
                              </div>
                            </td>

                            <td className="py-3 px-2.5 text-center font-mono">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                std.zScore >= 0.5
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : std.zScore <= -0.5
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {std.zScore > 0 ? `+${std.zScore}` : std.zScore}
                              </span>
                            </td>

                            <td className="py-3 px-2.5 text-center">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${std.stabilityColor}`}>
                                {std.stabilityLabel}
                              </span>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                σ = {std.regularityStd}
                              </div>
                            </td>

                            <td className="py-3 px-2.5 text-center">
                              <div className="font-mono font-black text-indigo-700 text-xs">
                                {std.projectedNationalExam}/20
                              </div>
                              <div className="text-[10px] text-slate-500">
                                جاهزية: <strong className="font-mono text-slate-700">{std.readinessIndexPct}%</strong>
                              </div>
                            </td>

                            <td className="py-3 px-3 max-w-xs">
                              <div className={`font-black text-xs ${
                                std.orientationTier === 'sm_elite'
                                  ? 'text-emerald-800'
                                  : std.orientationTier === 'pc_svt'
                                  ? 'text-blue-800'
                                  : 'text-rose-700'
                              }`}>
                                {std.recommendedTrack}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {std.counselorNote}
                              </p>
                            </td>

                            <td className="py-3 px-3 max-w-xs">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed">
                                {std.pedagogicalAction}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* نافذة الإطار المرجعي التفاعلي وشبكة تنقيط الفروض المحروسة */}
      <ExamFrameworkModal
        isOpen={isExamFrameworkModalOpen}
        onClose={() => setIsExamFrameworkModalOpen(false)}
        initialClass={selectedClass !== 'all' ? selectedClass : '2BAC_PC'}
      />

      {/* نافذة التحليل المقارن الذكي بين المراقبة المستمرة والفروض المحروسة والتوصيات المخصصة */}
      <AiComparativePerformanceModal
        isOpen={isAiCompareModalOpen}
        onClose={() => setIsAiCompareModalOpen(false)}
        initialStudentId={aiCompareStudentId}
        initialClassName={aiCompareClassName || (selectedClass !== 'all' ? selectedClass : '')}
        db={db}
        semester={semester}
      />
    </div>
  );
}
