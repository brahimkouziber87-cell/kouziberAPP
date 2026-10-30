import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Cell,
  ScatterChart,
  Scatter,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Users,
  BookOpen,
  Printer,
  Download,
  ChevronRight,
  ChevronLeft,
  Filter,
  BarChart3,
  RefreshCw,
  Eye,
  Info,
  MessageCircle,
  GraduationCap,
  ArrowUpDown,
  Search,
  ShieldAlert,
  Sparkles,
  Activity,
  Layers,
  HelpCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';

// Types for student and grades structure
interface Student {
  id: string;
  name: string;
  massar?: string;
  orderNum?: string;
}

// Student Risk Analysis Data Interface
interface StudentFailureRiskData {
  id: string;
  name: string;
  massar: string;
  orderNum?: string;
  // Absence Metrics
  totalAbsenceHours: number;
  unjustifiedHours: number;
  justifiedHours: number;
  lateCount: number;
  missedHw: number;
  // Exam Trajectory Metrics
  s1Avg: number | null;
  s2Avg: number | null;
  annualAvg: number | null;
  deltaTrajectory: number | null; // s2Avg - s1Avg
  trajectoryDirection: 'improving' | 'declining' | 'stable' | 'unknown';
  // Calculated Risk Index (0-100%)
  failureRiskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'safe';
  riskLabel: string;
  riskColor: string;
  riskBg: string;
  // Pedagogical Diagnosis & Recommendations
  primaryFactor: string;
  recommendedIntervention: string;
  quadrantName: string;
  // Chart coordinates
  xAbsence: number;
  yGrade: number;
  zRisk: number;
}

// Appreciation helper conforming to Moroccan Ministry of National Education standards (Massar)
function getMoroccanAppreciation(mark: number | null): { text: string; color: string; bg: string } {
  if (mark === null || isNaN(mark)) {
    return { text: 'غير مسجل', color: '#64748b', bg: '#f1f5f9' };
  }
  if (mark >= 16) {
    return { text: 'حسن جداً (Très Bien)', color: '#15803d', bg: '#dcfce7' };
  }
  if (mark >= 14) {
    return { text: 'حسن (Bien)', color: '#0369a1', bg: '#e0f2fe' };
  }
  if (mark >= 12) {
    return { text: 'مستحسن (Assez Bien)', color: '#0f766e', bg: '#ccfbf1' };
  }
  if (mark >= 10) {
    return { text: 'متوسط / مستوفٍ (Passable)', color: '#d97706', bg: '#fef3c7' };
  }
  if (mark >= 8) {
    return { text: 'دون المتوسط (Insuffisant)', color: '#ea580c', bg: '#ffedd5' };
  }
  return { text: 'ضعيف / متعثر (Faible)', color: '#dc2626', bg: '#fee2e2' };
}

export default function ReportsEvolutionChart() {
  const [db, setDb] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [semester, setSemester] = useState<'s1' | 's2' | 'annual'>('s1');
  const [viewMode, setViewMode] = useState<'individual' | 'class_all' | 'failure_risk' | 'class_progression'>('individual');
  
  // Class Progression & S1 vs S2 Comparison view state
  const [progressionSubMode, setProgressionSubMode] = useState<'single_class' | 'all_classes'>('single_class');
  const [progressionChartType, setProgressionChartType] = useState<'composed' | 'bars'>('composed');

  // Failure Risk view state
  const [riskChartType, setRiskChartType] = useState<'scatter' | 'composed' | 'table'>('scatter');
  const [riskSortBy, setRiskSortBy] = useState<'risk_desc' | 'absence_desc' | 'grade_asc' | 'name'>('risk_desc');
  const [riskFilterLevel, setRiskFilterLevel] = useState<'all' | 'critical' | 'high' | 'declining'>('all');
  const [riskSearchQuery, setRiskSearchQuery] = useState<string>('');
  const [selectedRiskStudent, setSelectedRiskStudent] = useState<StudentFailureRiskData | null>(null);

  const [showMinMaxRange, setShowMinMaxRange] = useState<boolean>(false);
  const [showBenchmark10, setShowBenchmark10] = useState<boolean>(true);
  const [searchStudentTerm, setSearchStudentTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load database from window or localStorage
  const loadDb = () => {
    if (typeof window !== 'undefined' && (window as any).db) {
      setDb({ ...(window as any).db });
    } else {
      const localData = localStorage.getItem('absence_massar_v8_manual');
      if (localData) {
        try {
          setDb(JSON.parse(localData));
        } catch (e) {
          console.error("Error parsing localStorage db:", e);
        }
      }
    }
  };

  useEffect(() => {
    loadDb();

    const handleTabOpened = (e: any) => {
      loadDb();
      if (e && e.detail) {
        if (e.detail.className) setSelectedClass(e.detail.className);
        if (e.detail.studentId) setSelectedStudentId(e.detail.studentId);
        if (e.detail.viewMode) setViewMode(e.detail.viewMode);
      }
    };

    const handleDbUpdated = () => {
      loadDb();
    };

    const handleSelectStudent = (e: any) => {
      if (e && e.detail) {
        if (e.detail.className) setSelectedClass(e.detail.className);
        if (e.detail.studentId) setSelectedStudentId(e.detail.studentId);
      }
    };

    window.addEventListener('reportsEvolutionTabOpened', handleTabOpened);
    window.addEventListener('dbUpdated', handleDbUpdated);
    window.addEventListener('selectStudentEvolution', handleSelectStudent);

    return () => {
      window.removeEventListener('reportsEvolutionTabOpened', handleTabOpened);
      window.removeEventListener('dbUpdated', handleDbUpdated);
      window.removeEventListener('selectStudentEvolution', handleSelectStudent);
    };
  }, []);

  // Set default class when db is loaded
  useEffect(() => {
    if (db && db.classes) {
      const classes = Object.keys(db.classes);
      if (classes.length > 0 && (!selectedClass || !classes.includes(selectedClass))) {
        setSelectedClass(classes[0]);
      }
    }
  }, [db, selectedClass]);

  // Students list of the currently selected class
  const students: Student[] = useMemo(() => {
    if (!db || !db.classes || !selectedClass || !db.classes[selectedClass]) return [];
    const rawList = db.classes[selectedClass];
    const list: Student[] = Array.isArray(rawList) ? rawList : (rawList.students || []);
    return list;
  }, [db, selectedClass]);

  // Set default student when class changes
  useEffect(() => {
    if (students.length > 0) {
      const exists = students.some(s => s.id === selectedStudentId);
      if (!exists) {
        setSelectedStudentId(students[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [students, selectedStudentId]);

  // Helper to resolve active exam keys for any given class (supports 2, 3, or 4 exams per Note 142-08)
  const getExamKeysForClass = (clsName: string): string[] => {
    if (!db || !clsName) return ['f1', 'f2', 'f3'];
    let count = 3;
    const upper = clsName.toUpperCase();
    const isSm = upper.includes('SM') || clsName.includes('رياضية');
    const isLit = upper.includes('LSH') || upper.includes('TCL') || clsName.includes('آداب') || clsName.includes('إنسانية');

    if (typeof window !== 'undefined' && typeof (window as any).getExamsCountForClass === 'function') {
      count = Number((window as any).getExamsCountForClass(clsName)) || (isSm ? 4 : isLit ? 2 : 3);
    } else if (db.classConfig && db.classConfig[clsName] !== undefined) {
      const cfg = db.classConfig[clsName];
      count = typeof cfg === 'object' ? (parseInt(cfg.examsCount, 10) || 3) : (parseInt(cfg, 10) || 3);
    } else if (db.examsCount && db.examsCount[clsName]) {
      count = parseInt(db.examsCount[clsName], 10) || 3;
    } else if (isSm) {
      count = 4;
    } else if (isLit) {
      count = 2;
    }
    if (count === 2) return ['f1', 'f2'];
    if (count === 4) return ['f1', 'f2', 'f3', 'f4'];
    return ['f1', 'f2', 'f3'];
  };

  // Determine active exam keys for the currently selected class
  const examKeys = useMemo(() => {
    return getExamKeysForClass(selectedClass);
  }, [db, selectedClass]);

  // Helper to extract student mark safely (handles comma decimals, [0,20] bounds, and nested/root semester structures)
  const getStudentMark = (stdId: string, examKey: string, sem: 's1' | 's2' | 'annual', targetClass: string = selectedClass): number | null => {
    if (!db || !targetClass) return null;
    const record = db.grades?.[targetClass]?.[stdId];
    const parseMark = (raw: any): number | null => {
      if (raw === undefined || raw === null || String(raw).trim() === '') return null;
      const val = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(val) || val < 0 || val > 20) return null;
      return parseFloat(val.toFixed(2));
    };

    if (sem === 's1') {
      const s1Val =
        record?.s1?.[examKey] !== undefined
          ? record.s1[examKey]
          : db.gradesS1?.[targetClass]?.[stdId]?.[examKey] !== undefined
          ? db.gradesS1[targetClass][stdId][examKey]
          : record?.[examKey];
      return parseMark(s1Val);
    }

    if (sem === 's2') {
      const s2Val =
        record?.s2?.[examKey] !== undefined
          ? record.s2[examKey]
          : db.gradesS2?.[targetClass]?.[stdId]?.[examKey];
      return parseMark(s2Val);
    }

    // Annual: average of s1 and s2 for this exam
    const m1 = getStudentMark(stdId, examKey, 's1', targetClass);
    const m2 = getStudentMark(stdId, examKey, 's2', targetClass);
    if (m1 !== null && m2 !== null) return parseFloat(((m1 + m2) / 2).toFixed(2));
    if (m1 !== null) return m1;
    if (m2 !== null) return m2;
    return null;
  };

  // Helper to calculate student's overall average in the selected semester
  const getStudentOverallAvg = (stdId: string, sem: 's1' | 's2' | 'annual', targetClass: string = selectedClass): number | null => {
    const keys = targetClass === selectedClass ? examKeys : getExamKeysForClass(targetClass);
    const marks: number[] = [];
    keys.forEach(k => {
      const m = getStudentMark(stdId, k, sem, targetClass);
      if (m !== null) marks.push(m);
    });
    if (marks.length === 0) return null;
    const sum = marks.reduce((acc, v) => acc + v, 0);
    return parseFloat((sum / marks.length).toFixed(2));
  };

  // Compute Class-Wide Statistics for each exam and overall
  const classExamStats = useMemo(() => {
    if (!students || students.length === 0) return {};

    const stats: Record<string, { avg: number | null; max: number | null; min: number | null; count: number }> = {};

    examKeys.forEach(k => {
      const marks: number[] = [];
      students.forEach(s => {
        const m = getStudentMark(s.id, k, semester);
        if (m !== null) marks.push(m);
      });
      if (marks.length > 0) {
        const sum = marks.reduce((acc, v) => acc + v, 0);
        stats[k] = {
          avg: parseFloat((sum / marks.length).toFixed(2)),
          max: Math.max(...marks),
          min: Math.min(...marks),
          count: marks.length
        };
      } else {
        stats[k] = { avg: null, max: null, min: null, count: 0 };
      }
    });

    // Overall CC average for class
    const overallMarks: number[] = [];
    students.forEach(s => {
      const avg = getStudentOverallAvg(s.id, semester);
      if (avg !== null) overallMarks.push(avg);
    });
    if (overallMarks.length > 0) {
      const sum = overallMarks.reduce((acc, v) => acc + v, 0);
      stats['overall'] = {
        avg: parseFloat((sum / overallMarks.length).toFixed(2)),
        max: Math.max(...overallMarks),
        min: Math.min(...overallMarks),
        count: overallMarks.length
      };
    } else {
      stats['overall'] = { avg: null, max: null, min: null, count: 0 };
    }

    return stats;
  }, [students, examKeys, semester, db, selectedClass]);

  // Memoized Class Progression Analytics across exams and comparing S1 vs S2
  const classProgressionAnalytics = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        s1OverallAvg: null,
        s2OverallAvg: null,
        annualOverallAvg: null,
        delta: null,
        deltaPercent: null,
        trend: 'stable' as const,
        s1PassRate: 0,
        s2PassRate: 0,
        s1PassCount: 0,
        s2PassCount: 0,
        totalStudents: 0,
        examComparisonChartData: [] as any[],
        s1Distribution: { excellent: 0, good: 0, average: 0, struggling: 0 },
        s2Distribution: { excellent: 0, good: 0, average: 0, struggling: 0 }
      };
    }

    const examLabels: Record<string, { name: string; short: string }> = {
      f1: { name: 'الفرض 1', short: 'F1' },
      f2: { name: 'الفرض 2', short: 'F2' },
      f3: { name: 'الفرض 3', short: 'F3' },
      f4: { name: 'الفرض 4', short: 'F4' }
    };

    // Calculate S1 & S2 averages for each exam
    const examData: any[] = [];
    examKeys.forEach(k => {
      const s1Marks: number[] = [];
      const s2Marks: number[] = [];

      students.forEach(s => {
        const m1 = getStudentMark(s.id, k, 's1');
        if (m1 !== null) s1Marks.push(m1);
        const m2 = getStudentMark(s.id, k, 's2');
        if (m2 !== null) s2Marks.push(m2);
      });

      const s1Avg = s1Marks.length > 0 ? parseFloat((s1Marks.reduce((a, b) => a + b, 0) / s1Marks.length).toFixed(2)) : null;
      const s2Avg = s2Marks.length > 0 ? parseFloat((s2Marks.reduce((a, b) => a + b, 0) / s2Marks.length).toFixed(2)) : null;
      const delta = (s1Avg !== null && s2Avg !== null) ? parseFloat((s2Avg - s1Avg).toFixed(2)) : null;

      examData.push({
        key: k,
        name: examLabels[k]?.name || k,
        shortName: examLabels[k]?.short || k,
        'الأسدس الأول (S1)': s1Avg,
        'الأسدس الثاني (S2)': s2Avg,
        'فارق التطور': delta,
        'عتبة النجاح (10)': 10,
        s1Count: s1Marks.length,
        s2Count: s2Marks.length
      });
    });

    // Overall class averages in S1 & S2
    const s1OverallList: number[] = [];
    const s2OverallList: number[] = [];
    const s1Dist = { excellent: 0, good: 0, average: 0, struggling: 0 };
    const s2Dist = { excellent: 0, good: 0, average: 0, struggling: 0 };

    students.forEach(s => {
      const avg1 = getStudentOverallAvg(s.id, 's1');
      if (avg1 !== null) {
        s1OverallList.push(avg1);
        if (avg1 >= 16) s1Dist.excellent++;
        else if (avg1 >= 12) s1Dist.good++;
        else if (avg1 >= 10) s1Dist.average++;
        else s1Dist.struggling++;
      }
      const avg2 = getStudentOverallAvg(s.id, 's2');
      if (avg2 !== null) {
        s2OverallList.push(avg2);
        if (avg2 >= 16) s2Dist.excellent++;
        else if (avg2 >= 12) s2Dist.good++;
        else if (avg2 >= 10) s2Dist.average++;
        else s2Dist.struggling++;
      }
    });

    const s1OverallAvg = s1OverallList.length > 0 ? parseFloat((s1OverallList.reduce((a, b) => a + b, 0) / s1OverallList.length).toFixed(2)) : null;
    const s2OverallAvg = s2OverallList.length > 0 ? parseFloat((s2OverallList.reduce((a, b) => a + b, 0) / s2OverallList.length).toFixed(2)) : null;
    const delta = (s1OverallAvg !== null && s2OverallAvg !== null) ? parseFloat((s2OverallAvg - s1OverallAvg).toFixed(2)) : null;
    const deltaPercent = (s1OverallAvg !== null && s2OverallAvg !== null && s1OverallAvg > 0) ? parseFloat((((s2OverallAvg - s1OverallAvg) / s1OverallAvg) * 100).toFixed(1)) : null;

    const s1PassCount = s1OverallList.filter(m => m >= 10).length;
    const s2PassCount = s2OverallList.filter(m => m >= 10).length;
    const s1PassRate = s1OverallList.length > 0 ? Math.round((s1PassCount / s1OverallList.length) * 100) : 0;
    const s2PassRate = s2OverallList.length > 0 ? Math.round((s2PassCount / s2OverallList.length) * 100) : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (delta !== null) {
      if (delta > 0.2) trend = 'improving';
      else if (delta < -0.2) trend = 'declining';
    }

    // Add overall average entry to the chart
    if (s1OverallAvg !== null || s2OverallAvg !== null) {
      examData.push({
        key: 'overall',
        name: 'المعدل العام للأسدس ⭐',
        shortName: 'المعدل العام',
        'الأسدس الأول (S1)': s1OverallAvg,
        'الأسدس الثاني (S2)': s2OverallAvg,
        'فارق التطور': delta,
        'عتبة النجاح (10)': 10,
        s1Count: s1OverallList.length,
        s2Count: s2OverallList.length,
        isOverall: true
      });
    }

    return {
      s1OverallAvg,
      s2OverallAvg,
      annualOverallAvg: (s1OverallAvg !== null && s2OverallAvg !== null) ? parseFloat(((s1OverallAvg + s2OverallAvg) / 2).toFixed(2)) : (s1OverallAvg ?? s2OverallAvg),
      delta,
      deltaPercent,
      trend,
      s1PassRate,
      s2PassRate,
      s1PassCount,
      s2PassCount,
      totalStudents: students.length,
      examComparisonChartData: examData,
      s1Distribution: s1Dist,
      s2Distribution: s2Dist
    };
  }, [students, examKeys, db, selectedClass]);

  // Cross-class comparison data comparing all classes across S1 and S2
  const allClassesProgressionData = useMemo(() => {
    const classList = Object.keys(db?.classes || {});
    if (classList.length === 0) return [];

    return classList.map(clsName => {
      const clsRaw = db.classes?.[clsName];
      const clsStudents: Student[] = Array.isArray(clsRaw) ? clsRaw : (clsRaw?.students || []);
      
      const s1Marks: number[] = [];
      const s2Marks: number[] = [];

      clsStudents.forEach(s => {
        const m1 = getStudentOverallAvg(s.id, 's1', clsName);
        if (m1 !== null) s1Marks.push(m1);
        const m2 = getStudentOverallAvg(s.id, 's2', clsName);
        if (m2 !== null) s2Marks.push(m2);
      });

      const s1Avg = s1Marks.length > 0 ? parseFloat((s1Marks.reduce((a, b) => a + b, 0) / s1Marks.length).toFixed(2)) : null;
      const s2Avg = s2Marks.length > 0 ? parseFloat((s2Marks.reduce((a, b) => a + b, 0) / s2Marks.length).toFixed(2)) : null;
      const delta = (s1Avg !== null && s2Avg !== null) ? parseFloat((s2Avg - s1Avg).toFixed(2)) : null;

      const s1Pass = s1Marks.filter(m => m >= 10).length;
      const s2Pass = s2Marks.filter(m => m >= 10).length;
      const s1Rate = s1Marks.length > 0 ? Math.round((s1Pass / s1Marks.length) * 100) : 0;
      const s2Rate = s2Marks.length > 0 ? Math.round((s2Pass / s2Marks.length) * 100) : 0;

      return {
        name: clsName,
        'الأسدس الأول (S1)': s1Avg,
        'الأسدس الثاني (S2)': s2Avg,
        'فارق التطور': delta,
        'نسبة النجاح S1 (%)': s1Rate,
        'نسبة النجاح S2 (%)': s2Rate,
        totalStudents: clsStudents.length
      };
    });
  }, [db]);

  // Selected student object
  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  // Compute individual chart data points for the selected student vs class average
  const individualChartData = useMemo(() => {
    if (!currentStudent) return [];

    const examLabels: Record<string, { name: string; short: string }> = {
      f1: { name: 'الفرض المحروس 1', short: 'F1' },
      f2: { name: 'الفرض المحروس 2', short: 'F2' },
      f3: { name: 'الفرض المحروس 3', short: 'F3' },
      f4: { name: 'الفرض المحروس 4', short: 'F4' }
    };

    const points: any[] = [];

    examKeys.forEach(k => {
      const stdMark = getStudentMark(currentStudent.id, k, semester);
      const cStat = classExamStats[k] || { avg: null, max: null, min: null };
      const delta = (stdMark !== null && cStat.avg !== null) ? parseFloat((stdMark - cStat.avg).toFixed(2)) : null;

      points.push({
        key: k,
        name: examLabels[k]?.name || k,
        shortName: examLabels[k]?.short || k,
        'نقطة التلميذ': stdMark,
        'معدل القسم': cStat.avg,
        'أعلى نقطة بالقسم': cStat.max,
        'أدنى نقطة بالقسم': cStat.min,
        'عتبة النجاح': 10,
        delta: delta
      });
    });

    // Append Overall Average Milestone
    const stdOverall = getStudentOverallAvg(currentStudent.id, semester);
    const classOverallStat = classExamStats['overall'] || { avg: null, max: null, min: null };
    const overallDelta = (stdOverall !== null && classOverallStat.avg !== null)
      ? parseFloat((stdOverall - classOverallStat.avg).toFixed(2))
      : null;

    points.push({
      key: 'overall',
      name: 'معدل المراقبة المستمرة',
      shortName: 'المعدل العام',
      'نقطة التلميذ': stdOverall,
      'معدل القسم': classOverallStat.avg,
      'أعلى نقطة بالقسم': classOverallStat.max,
      'أدنى نقطة بالقسم': classOverallStat.min,
      'عتبة النجاح': 10,
      delta: overallDelta
    });

    return points;
  }, [currentStudent, examKeys, semester, classExamStats]);

  // Rank of current student in class
  const studentRankInfo = useMemo(() => {
    if (!currentStudent || !students || students.length === 0) return { rank: null, total: 0 };
    const averagesList = students.map(s => ({
      id: s.id,
      avg: getStudentOverallAvg(s.id, semester)
    })).filter(item => item.avg !== null);

    averagesList.sort((a, b) => (b.avg as number) - (a.avg as number));

    const idx = averagesList.findIndex(item => item.id === currentStudent.id);
    return {
      rank: idx !== -1 ? idx + 1 : null,
      total: averagesList.length,
      classSize: students.length
    };
  }, [currentStudent, students, semester]);

  // Progression analysis between exams for the current student
  const progressionInfo = useMemo(() => {
    if (!currentStudent || individualChartData.length < 2) return null;
    const examMarks = individualChartData
      .filter(p => p.key !== 'overall' && p['نقطة التلميذ'] !== null)
      .map(p => ({ name: p.name, mark: p['نقطة التلميذ'] as number }));

    if (examMarks.length < 2) return null;
    const first = examMarks[0];
    const last = examMarks[examMarks.length - 1];
    const diff = parseFloat((last.mark - first.mark).toFixed(2));

    return {
      diff,
      isPositive: diff > 0,
      isNeutral: diff === 0,
      text: diff > 0
        ? `تحسن بمقدار +${diff} نقطة (من ${first.mark} إلى ${last.mark})`
        : diff < 0
          ? `تراجع بمقدار ${diff} نقطة (من ${first.mark} إلى ${last.mark})`
          : `استقرار في التحصيل (${last.mark} نقطة)`
    };
  }, [currentStudent, individualChartData]);

  // Data for All-Students Class Distribution Mode
  const allStudentsChartData = useMemo(() => {
    if (!students || students.length === 0) return [];
    const classOverall = classExamStats['overall']?.avg || 0;

    const data = students.map(s => {
      const avg = getStudentOverallAvg(s.id, semester);
      return {
        id: s.id,
        name: s.name,
        'معدل التلميذ': avg,
        'معدل القسم': classOverall,
        'عتبة النجاح': 10
      };
    }).filter(d => d['معدل التلميذ'] !== null);

    data.sort((a, b) => (b['معدل التلميذ'] as number) - (a['معدل التلميذ'] as number));
    return data;
  }, [students, semester, classExamStats]);

  // =========================================================================
  // حساب مؤشر احتمالية التعثر (Failure Probability Index) والربط التلقائي
  // بين ساعات الغياب التراكمية وتطور معدلات الفروض عبر الدورتين
  // =========================================================================
  const classFailureRiskList: StudentFailureRiskData[] = useMemo(() => {
    if (!students || students.length === 0) return [];

    return students.map(s => {
      // 1. حساب الغيابات من سجلات db.records
      let totalAbsenceHours = 0;
      let unjustifiedHours = 0;
      let justifiedHours = 0;
      let lateCount = 0;
      let missedHw = 0;

      if (db && Array.isArray(db.records)) {
        db.records.forEach((r: any) => {
          if (r.studentId === s.id && r.className === selectedClass) {
            const dur = r.duration || 1;
            if (r.status === 'غائب') {
              totalAbsenceHours += dur;
              unjustifiedHours += dur;
            } else if (r.status === 'مبرر') {
              totalAbsenceHours += dur;
              justifiedHours += dur;
            } else if (r.status === 'متأخر') {
              lateCount++;
            }
            if (r.homework === 'لم ينجز') {
              missedHw++;
            }
          }
        });
      }

      // 2. حساب معدلات الفروض ومسار التطور عبر الدورتين S1 و S2
      const s1Avg = getStudentOverallAvg(s.id, 's1');
      const s2Avg = getStudentOverallAvg(s.id, 's2');

      let annualAvg: number | null = null;
      let deltaTrajectory: number | null = null;
      let trajectoryDirection: 'improving' | 'declining' | 'stable' | 'unknown' = 'unknown';

      if (s1Avg !== null && s2Avg !== null) {
        annualAvg = parseFloat(((s1Avg + s2Avg) / 2).toFixed(2));
        deltaTrajectory = parseFloat((s2Avg - s1Avg).toFixed(2));
        if (deltaTrajectory > 0.5) trajectoryDirection = 'improving';
        else if (deltaTrajectory < -0.5) trajectoryDirection = 'declining';
        else trajectoryDirection = 'stable';
      } else if (s1Avg !== null) {
        annualAvg = s1Avg;
      } else if (s2Avg !== null) {
        annualAvg = s2Avg;
      }

      // 3. خوارزمية مؤشر احتمالية التعثر (Academic Failure Risk Score: 0 - 100%)
      // أ. الأساس الأكاديمي للنتائج (Academic Baseline Risk)
      let academicBaseRisk = 45;
      if (annualAvg !== null) {
        if (annualAvg >= 16) academicBaseRisk = 3;
        else if (annualAvg >= 14) academicBaseRisk = 8;
        else if (annualAvg >= 12) academicBaseRisk = 16;
        else if (annualAvg >= 10) academicBaseRisk = 30 - ((annualAvg - 10) * 7); // 16% - 30%
        else if (annualAvg >= 8) academicBaseRisk = 56 - ((annualAvg - 8) * 13); // 30% - 56%
        else if (annualAvg >= 5) academicBaseRisk = 78 - ((annualAvg - 5) * 7.3); // 56% - 78%
        else academicBaseRisk = 80 + ((5 - annualAvg) * 2.8); // 80% - 94%
      }

      // ب. أثر الغياب التراكمي (Cumulative Absence Amplification)
      let absenceImpact = (unjustifiedHours * 2.5) + (justifiedHours * 1.2);
      if (totalAbsenceHours >= 8) absenceImpact += 8;
      if (totalAbsenceHours >= 16) absenceImpact += 14;

      // ج. أثر مسار التطور عبر الدورتين (Trajectory Momentum)
      let trajectoryImpact = 0;
      if (deltaTrajectory !== null) {
        if (deltaTrajectory < -2.5) trajectoryImpact = 18; // تراجع حاد مقلق
        else if (deltaTrajectory < -0.5) trajectoryImpact = Math.abs(deltaTrajectory) * 4.5;
        else if (deltaTrajectory > 2.0) trajectoryImpact = -14; // تحسن ملحوظ يقلص الخطر
        else if (deltaTrajectory > 0.5) trajectoryImpact = -(deltaTrajectory * 3.5);
      }

      // د. أثر إهمال الواجبات والتأخرات
      const behaviorImpact = Math.min(10, missedHw * 1.5) + Math.min(5, lateCount * 0.5);

      let rawRisk = academicBaseRisk + absenceImpact + trajectoryImpact + behaviorImpact;

      // حواجز أمان إحصائية (Floor constraints):
      if (totalAbsenceHours >= 10 && rawRisk < 45) rawRisk = 45;
      if (annualAvg !== null && annualAvg < 10 && rawRisk < 52) {
        rawRisk = Math.max(rawRisk, 52 + (10 - annualAvg) * 4);
      }

      const failureRiskScore = Math.max(3, Math.min(98, Math.round(rawRisk)));

      // تصنيف مستوى الخطر والتدخل
      let riskLevel: 'critical' | 'high' | 'medium' | 'safe' = 'safe';
      let riskLabel = 'منخفض (وضعية تحكم آمنة)';
      let riskColor = '#10b981';
      let riskBg = '#ecfdf5';
      let primaryFactor = 'مواظبة منتظمة وتحصيل سليم مستقر';
      let recommendedIntervention = 'الاستمرار في التعزيز الإيجابي وتثبيت المكتسبات';

      if (failureRiskScore >= 70) {
        riskLevel = 'critical';
        riskLabel = 'حرج جداً (خطر تعثر وشيك)';
        riskColor = '#dc2626';
        riskBg = '#fee2e2';
        if (totalAbsenceHours >= 8 && annualAvg !== null && annualAvg < 10) {
          primaryFactor = `تراكم انقطاعات (${totalAbsenceHours}س) ومعدل دون العتبة (${annualAvg}/20)`;
          recommendedIntervention = 'استدعاء فوري لولي الأمر + برنامج دعم استدراكي مكثف';
        } else if (totalAbsenceHours >= 8) {
          primaryFactor = `غيابات متكررة كثيفة (${totalAbsenceHours}س) تهدد بانهيار المسار الدراسي`;
          recommendedIntervention = 'تفعيل مسطرة المتابعة الإدارية واليقظة وإشعار الأسرة عبر واتساب';
        } else {
          primaryFactor = `تعثر دراسي معرفي حاد في الفروض (${annualAvg !== null ? annualAvg : '-'} / 20)`;
          recommendedIntervention = 'خطة دعم بيداغوجي فردي لمعالجة الثغرات المفاهيمية';
        }
      } else if (failureRiskScore >= 45) {
        riskLevel = 'high';
        riskLabel = 'مرتفع (بحاجة لتدخل استدراكي)';
        riskColor = '#ea580c';
        riskBg = '#ffedd5';
        if (trajectoryDirection === 'declining' && deltaTrajectory !== null) {
          primaryFactor = `تراجع واضح بين الدورتين (فارق ${deltaTrajectory} نقطة)`;
          recommendedIntervention = 'جلسة استماع وتحفيز ومعالجة مسببات التراجع';
        } else if (totalAbsenceHours >= 4) {
          primaryFactor = `غياب تراكمي (${totalAbsenceHours}س) يؤثر على تسلسل الفهم`;
          recommendedIntervention = 'استدراك دفاتر الدروس وتكليف بتمارين تطبيقية موجهة';
        } else {
          primaryFactor = `تحصيل قريب من عتبة التعثر (${annualAvg !== null ? annualAvg : '-'} / 20)`;
          recommendedIntervention = 'إلحاق بحصص الدعم والمواكبة ومجموعات الأقران';
        }
      } else if (failureRiskScore >= 25) {
        riskLevel = 'medium';
        riskLabel = 'متوسط (متابعة وقائية)';
        riskColor = '#d97706';
        riskBg = '#fef3c7';
        primaryFactor = 'تحكم متوسط يستلزم اليقظة لتفادي التراجع';
        recommendedIntervention = 'متابعة دورية لإنجاز الواجبات والتركيز الصفي';
      }

      // تحديد المنطقة الرباعية (Quadrant Mapping)
      let quadrantName = 'منطقة الأمان والمواظبة';
      if (totalAbsenceHours >= 8 && (annualAvg === null || annualAvg < 10)) {
        quadrantName = 'منطقة الخطر الداهم (غياب كثيف + تعثر)';
      } else if (totalAbsenceHours >= 8 && annualAvg !== null && annualAvg >= 10) {
        quadrantName = 'منطقة المواظبة الهشة (نقط مقبولة مع غياب مقلق)';
      } else if (totalAbsenceHours < 8 && annualAvg !== null && annualAvg < 10) {
        quadrantName = 'منطقة التعثر المعرفي (مواظب مع صعوبات تعلم)';
      }

      return {
        id: s.id,
        name: s.name,
        massar: s.massar || '-',
        orderNum: s.orderNum,
        totalAbsenceHours,
        unjustifiedHours,
        justifiedHours,
        lateCount,
        missedHw,
        s1Avg,
        s2Avg,
        annualAvg,
        deltaTrajectory,
        trajectoryDirection,
        failureRiskScore,
        riskLevel,
        riskLabel,
        riskColor,
        riskBg,
        primaryFactor,
        recommendedIntervention,
        quadrantName,
        xAbsence: totalAbsenceHours,
        yGrade: annualAvg !== null ? annualAvg : 0,
        zRisk: failureRiskScore
      };
    });
  }, [students, selectedClass, db, examKeys]);

  // إحصائيات لوحة مؤشر التعثر للقسم
  const classRiskSummary = useMemo(() => {
    if (classFailureRiskList.length === 0) {
      return { total: 0, criticalCount: 0, highCount: 0, mediumCount: 0, safeCount: 0, avgRisk: 0, decliningCount: 0 };
    }
    const total = classFailureRiskList.length;
    const criticalCount = classFailureRiskList.filter(s => s.riskLevel === 'critical').length;
    const highCount = classFailureRiskList.filter(s => s.riskLevel === 'high').length;
    const mediumCount = classFailureRiskList.filter(s => s.riskLevel === 'medium').length;
    const safeCount = classFailureRiskList.filter(s => s.riskLevel === 'safe').length;
    const decliningCount = classFailureRiskList.filter(s => s.trajectoryDirection === 'declining').length;
    const avgRisk = Math.round(
      classFailureRiskList.reduce((acc, s) => acc + s.failureRiskScore, 0) / total
    );

    return {
      total,
      criticalCount,
      highCount,
      mediumCount,
      safeCount,
      decliningCount,
      avgRisk
    };
  }, [classFailureRiskList]);

  // فلترة وترتيب قائمة مؤشر التعثر
  const filteredSortedRiskList = useMemo(() => {
    let list = [...classFailureRiskList];

    // فلترة البحث
    if (riskSearchQuery.trim()) {
      const q = riskSearchQuery.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.massar.toLowerCase().includes(q));
    }

    // فلترة مستوى الخطر
    if (riskFilterLevel === 'critical') {
      list = list.filter(s => s.riskLevel === 'critical');
    } else if (riskFilterLevel === 'high') {
      list = list.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical');
    } else if (riskFilterLevel === 'declining') {
      list = list.filter(s => s.trajectoryDirection === 'declining');
    }

    // الترتيب
    if (riskSortBy === 'risk_desc') {
      list.sort((a, b) => b.failureRiskScore - a.failureRiskScore);
    } else if (riskSortBy === 'absence_desc') {
      list.sort((a, b) => b.totalAbsenceHours - a.totalAbsenceHours);
    } else if (riskSortBy === 'grade_asc') {
      list.sort((a, b) => (a.annualAvg ?? 99) - (b.annualAvg ?? 99));
    } else if (riskSortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }

    return list;
  }, [classFailureRiskList, riskSearchQuery, riskFilterLevel, riskSortBy]);

  // تعيين أول تلميذ في بطاقة الفحص عند التحميل
  useEffect(() => {
    if (filteredSortedRiskList.length > 0 && !selectedRiskStudent) {
      setSelectedRiskStudent(filteredSortedRiskList[0]);
    }
  }, [filteredSortedRiskList, selectedRiskStudent]);

  // Navigation handlers
  const handlePrevStudent = () => {
    if (!students || students.length === 0) return;
    const currentIndex = students.findIndex(s => s.id === selectedStudentId);
    if (currentIndex > 0) {
      setSelectedStudentId(students[currentIndex - 1].id);
    } else {
      setSelectedStudentId(students[students.length - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (!students || students.length === 0) return;
    const currentIndex = students.findIndex(s => s.id === selectedStudentId);
    if (currentIndex < students.length - 1 && currentIndex !== -1) {
      setSelectedStudentId(students[currentIndex + 1].id);
    } else {
      setSelectedStudentId(students[0].id);
    }
  };

  // Export Chart Card as Image (PNG)
  const handleExportPNG = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `تحليل_المراقبة_المستمرة_ومؤشر_التعثر_${selectedClass}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export PNG failed:", err);
      alert("تعذر تصدير الصورة، يرجى المحاولة لاحقاً.");
    } finally {
      setIsExporting(false);
    }
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // إرسال تنبيه واستدعاء واتساب لولي أمر التلميذ
  const handleSendRiskWhatsApp = (student: StudentFailureRiskData) => {
    const text = encodeURIComponent(
      `السلام عليكم ورحمة الله، ولي أمر التلميذ(ة) ${student.name} (${selectedClass}).\n` +
      `نحيطكم علماً بأن المنظومة البيداغوجية لمادة الرياضيات قد رصدت مؤشر خطورة تعثر دراسي (${student.failureRiskScore}%) ناتج عن:\n` +
      `- تسجيل (${student.totalAbsenceHours} ساعة غياب تراكمية منها ${student.unjustifiedHours}س غير مبررة).\n` +
      `- معدل الفروض المحروسة: ${student.annualAvg !== null ? `${student.annualAvg} / 20` : 'دون المعدل'}.\n` +
      (student.deltaTrajectory !== null && student.deltaTrajectory < 0 ? `- تراجع النتيجة بين الدورتين بمقدار (${student.deltaTrajectory} نقطة).\n` : '') +
      `نهيب بكم الحضور للمؤسسة للتواصل مع الأستاذ وتدارك الأمر لضمان نجاح التلميذ.\n- أستاذ المادة.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // إلحاق التلميذ بحصص الدعم والاستدراك
  const handleEnrollInTutoring = (student: StudentFailureRiskData) => {
    if (typeof (window as any).addStudentToTutoringDirect === 'function') {
      (window as any).addStudentToTutoringDirect(selectedClass, student.id);
    } else {
      alert(`تم تسجيل التلميذ "${student.name}" في لائحة الدعم والاستدراك.`);
    }
  };

  // فتح ملف الإنجاز الرقمي للتلميذ
  const handleOpenPortfolio = (student: StudentFailureRiskData) => {
    if (typeof (window as any).openStudentDigitalPortfolio === 'function') {
      (window as any).openStudentDigitalPortfolio(selectedClass, student.id);
    }
  };

  // فتح تحليل الذكاء الاصطناعي المقارن بين المراقبة المستمرة والفروض المحروسة
  const handleOpenAiCompare = (student: StudentFailureRiskData) => {
    if (typeof (window as any).openStudentAiComparativeModal === 'function') {
      (window as any).openStudentAiComparativeModal(selectedClass, student.id);
    } else {
      if (typeof (window as any).switchTab === 'function') {
        (window as any).switchTab('annual');
        setTimeout(() => {
          if (typeof (window as any).openStudentAiComparativeModal === 'function') {
            (window as any).openStudentAiComparativeModal(selectedClass, student.id);
          }
        }, 300);
      }
    }
  };

  // Filter students for dropdown search
  const filteredStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return students;
    const term = searchStudentTerm.trim().toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(term) || (s.massar && s.massar.toLowerCase().includes(term))
    );
  }, [students, searchStudentTerm]);

  // If no database or no classes
  if (!db || !db.classes || Object.keys(db.classes).length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center shadow-sm" dir="rtl">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">لا توجد أقسام مسجلة حتى الآن</h3>
        <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm">
          يرجى استيراد أو إضافة لائحة التلاميذ والأقسام أولاً لتفعيل المنحنى البياني ومؤشر احتمالية التعثر.
        </p>
      </div>
    );
  }

  const classNames = Object.keys(db.classes);
  const studentOverallAvg = currentStudent ? getStudentOverallAvg(currentStudent.id, semester) : null;
  const classOverallAvg = classExamStats['overall']?.avg ?? null;
  const studentAppreciation = getMoroccanAppreciation(studentOverallAvg);
  const deltaOverall = (studentOverallAvg !== null && classOverallAvg !== null)
    ? parseFloat((studentOverallAvg - classOverallAvg).toFixed(2))
    : null;

  // Custom Tooltip for Individual Evolution Chart
  const CustomIndividualTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const studentVal = payload.find((p: any) => p.dataKey === 'نقطة التلميذ')?.value;
      const classVal = payload.find((p: any) => p.dataKey === 'معدل القسم')?.value;
      const maxVal = payload.find((p: any) => p.dataKey === 'أعلى نقطة بالقسم')?.value;
      const minVal = payload.find((p: any) => p.dataKey === 'أدنى نقطة بالقسم')?.value;
      const diff = (studentVal !== undefined && classVal !== undefined && studentVal !== null && classVal !== null)
        ? parseFloat((studentVal - classVal).toFixed(2))
        : null;

      const app = getMoroccanAppreciation(studentVal);

      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-200 text-right min-w-[220px]" dir="rtl">
          <div className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-2 flex items-center justify-between text-sm">
            <span>{label}</span>
            <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: app.bg, color: app.color }}>
              {app.text}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-blue-700 font-bold bg-blue-50/60 px-2 py-1 rounded">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                نقطة التلميذ:
              </span>
              <span className="text-sm font-extrabold">{studentVal !== null && studentVal !== undefined ? `${studentVal} / 20` : 'غير مدخل'}</span>
            </div>

            <div className="flex justify-between items-center text-amber-700 font-semibold px-2 py-1">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                معدل القسم:
              </span>
              <span className="font-bold">{classVal !== null && classVal !== undefined ? `${classVal} / 20` : 'غير متاح'}</span>
            </div>

            {diff !== null && (
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 px-2">
                <span className="text-slate-600">الفارق عن القسم:</span>
                <span className={`font-extrabold flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {diff >= 0 ? `+${diff} نقطة (أعلى)` : `${diff} نقطة (أدنى)`}
                </span>
              </div>
            )}

            {showMinMaxRange && maxVal !== undefined && minVal !== undefined && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between px-2">
                <span>أعلى: <b className="text-emerald-700">{maxVal}</b></span>
                <span>أدنى: <b className="text-rose-700">{minVal}</b></span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Scatter Risk Chart
  const CustomScatterRiskTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: StudentFailureRiskData = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-300 text-right min-w-[260px] text-xs" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
            <span className="font-black text-slate-900 text-sm">{data.name}</span>
            <span
              className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: data.riskBg, color: data.riskColor, border: `1px solid ${data.riskColor}40` }}
            >
              احتمالية التعثر: {data.failureRiskScore}%
            </span>
          </div>

          <div className="space-y-1.5 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">ساعات الغياب التراكمية:</span>
              <strong className="text-rose-600 font-bold">{data.totalAbsenceHours} ساعة ({data.unjustifiedHours}س غير مبرر)</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">معدل الفروض السنوي:</span>
              <strong className={data.annualAvg !== null && data.annualAvg >= 10 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {data.annualAvg !== null ? `${data.annualAvg} / 20` : 'غير مسجل'}
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">مسار التطور (S1 ➔ S2):</span>
              <span className={`font-bold flex items-center gap-1 ${
                data.deltaTrajectory === null ? 'text-slate-400' : data.deltaTrajectory > 0 ? 'text-emerald-600' : data.deltaTrajectory < 0 ? 'text-rose-600' : 'text-amber-600'
              }`}>
                {data.s1Avg ?? '-'} ➔ {data.s2Avg ?? '-'}
                {data.deltaTrajectory !== null && (
                  <span>({data.deltaTrajectory >= 0 ? `+${data.deltaTrajectory}` : data.deltaTrajectory})</span>
                )}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded-lg text-[11px]">
              <div className="font-bold text-slate-800 mb-1">💡 التشخيص:</div>
              <div className="text-slate-600 leading-relaxed">{data.primaryFactor}</div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5" dir="rtl" ref={containerRef}>
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-rose-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              {viewMode === 'class_progression' ? <Activity className="w-6 h-6 text-emerald-200" /> : viewMode === 'failure_risk' ? <ShieldAlert className="w-6 h-6 text-amber-200" /> : <TrendingUp className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-slate-900">
                  {viewMode === 'class_progression'
                    ? 'تحليل تطور معدلات الأقسام عبر الفروض ومقارنة الأسدسين (Recharts)'
                    : viewMode === 'failure_risk'
                    ? 'رسم مؤشر احتمالية التعثر والربط التلقائي بالغياب وتطور الفروض'
                    : 'منحنى تطور معدلات المراقبة المستمرة مقارنة بمعدل القسم'}
                </h2>
                <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-full">
                  Recharts تفاعلي
                </span>
                {viewMode === 'class_progression' && (
                  <span className="text-xs px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    مقارنة S1 مقابل S2
                  </span>
                )}
                {viewMode === 'failure_risk' && (
                  <span className="text-xs px-2.5 py-0.5 bg-rose-100 text-rose-800 font-extrabold rounded-full flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    خوارزمية الذكاء التشخيصي
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {viewMode === 'class_progression'
                  ? 'رسم بياني تفاعلي يقيس التطور البيداغوجي لمعدلات الأقسام عبر مختلف الفروض المحروسة مع مقارنة دقيقة بين الأسدس الأول والأسدس الثاني ونسب النجاح.'
                  : viewMode === 'failure_risk'
                  ? 'نمذجة رياضية تربوية تربط ساعات الغياب المتراكمة بدينامية نقط الفروض عبر الدورتين لتوقع احتمالية التعثر الدراسي المبكر وتوجيه الدعم.'
                  : 'تتبع مسار التحصيل الدراسي لكل تلميذ عبر فروض المراقبة المستمرة ومقارنة علاماته بمعدل القسم الإجمالي وعتبة النجاح (10/20).'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Image Export & Print */}
          <div className="flex items-center gap-2.5 self-end lg:self-center flex-wrap">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="تصدير المنحنى والبطاقة كصورة PNG عالية الدقة"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>{isExporting ? 'جاري التصدير...' : 'تصدير كصورة'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="طباعة التقرير والمنحنى البياني"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة</span>
            </button>

            <button
              type="button"
              onClick={loadDb}
              className="p-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* View Mode Switching Tabs (الثلاثة أنماط الأساسية) */}
        <div className="flex gap-2 pt-4 pb-2 border-b border-slate-100 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`px-4 py-2 text-xs md:text-sm font-extrabold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'individual'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>منحنى تطور التلميذ الفردي</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('class_all')}
            className={`px-4 py-2 text-xs md:text-sm font-extrabold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'class_all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>توزيع معدلات القسم</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('failure_risk')}
            className={`px-4 py-2 text-xs md:text-sm font-extrabold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'failure_risk'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md shadow-rose-500/20'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>مؤشر احتمالية التعثر والربط بالغياب (Risk Index)</span>
            {classRiskSummary.criticalCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-rose-700 text-xs font-black flex items-center justify-center">
                {classRiskSummary.criticalCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setViewMode('class_progression')}
            className={`px-4 py-2 text-xs md:text-sm font-extrabold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'class_progression'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>تطور معدلات الأقسام ومقارنة الأسدسين (Recharts) 📊</span>
          </button>
        </div>

        {/* Filters & Navigation Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 items-center">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              القسم:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
            >
              {classNames.map(c => (
                <option key={c} value={c}>
                  {c} ({Array.isArray(db.classes[c]) ? db.classes[c].length : (db.classes[c]?.students?.length || 0)} تلميذ)
                </option>
              ))}
            </select>
          </div>

          {/* Conditional Controls based on View Mode */}
          {viewMode === 'failure_risk' ? (
            <>
              {/* Risk Sub-Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-rose-600" />
                  شكل الرسم البياني:
                </label>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRiskChartType('scatter')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      riskChartType === 'scatter' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مخطط الارتباط التشتتي
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskChartType('composed')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      riskChartType === 'composed' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    المخطط المزدوج
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskChartType('table')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      riskChartType === 'table' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    جدول التشخيص
                  </button>
                </div>
              </div>

              {/* Risk Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  تصفية الحالات:
                </label>
                <select
                  value={riskFilterLevel}
                  onChange={(e: any) => setRiskFilterLevel(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">جميع التلاميذ ({classFailureRiskList.length})</option>
                  <option value="critical">🚨 الخطر الحرج فقط ({classRiskSummary.criticalCount})</option>
                  <option value="high">⚠️ الخطر المرتفع والحرج ({classRiskSummary.criticalCount + classRiskSummary.highCount})</option>
                  <option value="declining">📉 المتراجعون بين الدورتين ({classRiskSummary.decliningCount})</option>
                </select>
              </div>

              {/* Risk Sort */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                  ترتيب القائمة:
                </label>
                <select
                  value={riskSortBy}
                  onChange={(e: any) => setRiskSortBy(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="risk_desc">احتمالية التعثر (الأعلى أولاً)</option>
                  <option value="absence_desc">ساعات الغياب (الأكثر غياباً)</option>
                  <option value="grade_asc">معدل الفروض (الأدنى أولاً)</option>
                  <option value="name">أبجدياً بالاسم</option>
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Semester Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  الدورة / الأسدوس:
                </label>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSemester('s1')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      semester === 's1' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الدورة الأولى (S1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemester('s2')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      semester === 's2' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الدورة الثانية (S2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSemester('annual')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      semester === 'annual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    المقارنة السنوية
                  </button>
                </div>
              </div>

              {/* Student Selector (Active in Individual Mode) */}
              {viewMode === 'individual' ? (
                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>اختيار التلميذ:</span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({students.findIndex(s => s.id === selectedStudentId) + 1} من {students.length})
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevStudent}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="التلميذ السابق"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="التلميذ التالي"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer"
                  >
                    {students.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        {idx + 1}. {s.name} {s.massar ? `(${s.massar})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-4">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBenchmark10}
                      onChange={(e) => setShowBenchmark10(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>عتبة النجاح (10/20)</span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VIEW MODE: مؤشر احتمالية التعثر والربط بالغياب (Failure Risk Mode)       */}
      {/* ========================================================================= */}
      {viewMode === 'failure_risk' && (
        <div className="space-y-5">
          {/* بطاقات المؤشرات الإحصائية العامة للقسم */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-rose-200 border-r-4 border-r-rose-600 shadow-sm">
              <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
                <span>خطر تعثر حرج (≥ 70%)</span>
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
              </div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {classRiskSummary.criticalCount} <span className="text-xs font-normal text-slate-500">تلميذ ({Math.round((classRiskSummary.criticalCount / Math.max(classRiskSummary.total, 1)) * 100)}%)</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">يستلزم تدخلاً استدراكياً عاجلاً</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200 border-r-4 border-r-amber-500 shadow-sm">
              <div className="text-xs font-bold text-amber-800">خطر مرتفع (45% - 69%)</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {classRiskSummary.highCount} <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">بحاجة لدعم ومواكبة فردية</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-indigo-200 border-r-4 border-r-indigo-500 shadow-sm">
              <div className="text-xs font-bold text-indigo-800">تراجع بين الدورتين (📉)</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {classRiskSummary.decliningCount} <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">انحدار في نتائج المراقبة المستمرة</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-emerald-200 border-r-4 border-r-emerald-500 shadow-sm">
              <div className="text-xs font-bold text-emerald-800">وضعية آمنة (&lt; 25%)</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {classRiskSummary.safeCount} <span className="text-xs font-normal text-slate-500">تلميذ ({Math.round((classRiskSummary.safeCount / Math.max(classRiskSummary.total, 1)) * 100)}%)</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">مواظبة جيدة وتحكم سليم</div>
            </div>
          </div>

          {/* الرسوم البيانية التفاعلية لمؤشر احتمالية التعثر */}
          {riskChartType === 'scatter' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-600" />
                    خريطة الارتباط التشتتي رباعية المناطق: ساعات الغياب vs معدل الفروض
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    كل نقطة تمثل تلميذاً؛ يعبر المحور الأفقي (X) عن ساعات الغياب التراكمية، والمحور العمودي (Y) عن معدل الفروض.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> حرج (&ge; 70%)
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> مرتفع (45-69%)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> آمن (&lt; 25%)
                  </span>
                </div>
              </div>

              {/* Recharts Scatter Chart with Quadrants */}
              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      dataKey="xAbsence"
                      name="ساعات الغياب"
                      unit="س"
                      label={{ value: 'ساعات الغياب التراكمية (س)', position: 'insideBottom', offset: -25, fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                      tick={{ fill: '#475569', fontSize: 11 }}
                      domain={[0, 'dataMax + 4']}
                    />
                    <YAxis
                      type="number"
                      dataKey="yGrade"
                      name="معدل الفروض"
                      domain={[0, 20]}
                      ticks={[0, 5, 10, 15, 20]}
                      label={{ value: 'معدل الفروض (/20)', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b', fontSize: 12, fontWeight: 'bold' }}
                      tick={{ fill: '#475569', fontSize: 11 }}
                    />
                    <ZAxis type="number" dataKey="zRisk" range={[60, 280]} name="احتمالية التعثر" />
                    <Tooltip content={<CustomScatterRiskTooltip />} />

                    {/* خطوط وعتبات التوجيه المرجعية */}
                    <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'عتبة النجاح (10/20)', fill: '#059669', fontSize: 11, position: 'top' }} />
                    <ReferenceLine x={8} stroke="#ea580c" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'عتبة الغياب المقلق (8س)', fill: '#c2410c', fontSize: 11, position: 'insideTopRight' }} />

                    {/* مناطق ومربعات التشخيص البيداغوجي */}
                    <ReferenceArea {...({ x1: 8, y1: 0, y2: 10, fill: '#fee2e2', fillOpacity: 0.4 } as any)} />
                    <ReferenceArea {...({ x1: 0, x2: 8, y1: 10, y2: 20, fill: '#dcfce7', fillOpacity: 0.25 } as any)} />

                    <Scatter
                      name="التلاميذ"
                      data={filteredSortedRiskList}
                      onClick={(node: any) => {
                        if (node && node.payload) setSelectedRiskStudent(node.payload);
                      }}
                      className="cursor-pointer"
                    >
                      {filteredSortedRiskList.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.riskColor}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* شرح المناطق الأربعة للخريطة التشتتية */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                  <div className="font-extrabold text-emerald-800 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    1. منطقة الأمان والمواظبة (أعلى اليمين)
                  </div>
                  <div className="text-slate-600 text-[11px] leading-relaxed">
                    معدل فوق 10/20 وغياب أقل من 8س. نسبة الخطر منخفضة (&lt;25%).
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200">
                  <div className="font-extrabold text-amber-800 flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    2. منطقة المواظبة الهشة (أعلى اليسار)
                  </div>
                  <div className="text-slate-600 text-[11px] leading-relaxed">
                    معدل مقبول لكن مع غياب تراكمي مكثف قد ينذر بهبوط مفاجئ.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-orange-50/70 border border-orange-200">
                  <div className="font-extrabold text-orange-800 flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                    3. منطقة التعثر المعرفي (أسفل اليمين)
                  </div>
                  <div className="text-slate-600 text-[11px] leading-relaxed">
                    حضور منضبط دون غيابات، لكن النتائج متعثرة تستلزم دعماً بيداغوجياً.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200">
                  <div className="font-extrabold text-rose-800 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    4. منطقة الخطر الداهم (أسفل اليسار)
                  </div>
                  <div className="text-slate-600 text-[11px] leading-relaxed">
                    غياب كثيف ومعدل دون العتبة (احتمالية تعثر &gt;70%). تدخّل عاجل!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* الرسم البياني المزدوج: مؤشر احتمالية التعثر % + ساعات الغياب + معدل الفروض */}
          {riskChartType === 'composed' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    المخطط المزدوج المتكامل: مؤشر التعثر (%) مقارنة بساعات الغياب ومعدل الفروض
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    العمود الملون يعبر عن احتمالية التعثر % (محور أيسر)، والخط الأحمر يوضح ساعات الغياب، والخط الأزرق يوضح معدل الفروض.
                  </p>
                </div>
              </div>

              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredSortedRiskList} margin={{ top: 20, right: 20, bottom: 45, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }}
                      interval={0}
                      height={60}
                    />
                    {/* Left Y Axis for Risk Score (0-100%) */}
                    <YAxis
                      yAxisId="left"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fill: '#dc2626', fontSize: 11 }}
                      label={{ value: 'مؤشر التعثر (%)', angle: -90, position: 'insideLeft', fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }}
                    />
                    {/* Right Y Axis for Grades (0-20) and Absence Hours */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 25]}
                      ticks={[0, 5, 10, 15, 20, 25]}
                      tick={{ fill: '#2563eb', fontSize: 11 }}
                      label={{ value: 'النقطة / ساعات الغياب', angle: 90, position: 'insideRight', fill: '#2563eb', fontSize: 11, fontWeight: 'bold' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const std: StudentFailureRiskData = payload[0].payload;
                          return (
                            <div className="bg-white p-3 rounded-xl shadow-xl border border-slate-200 text-right text-xs" dir="rtl">
                              <div className="font-extrabold text-slate-900 mb-1">{std.name}</div>
                              <div className="text-rose-600 font-black">احتمالية التعثر: {std.failureRiskScore}% ({std.riskLabel.split(' ')[0]})</div>
                              <div className="text-slate-600 font-semibold mt-1">ساعات الغياب: {std.totalAbsenceHours}س</div>
                              <div className="text-blue-600 font-semibold">معدل الفروض: {std.annualAvg !== null ? `${std.annualAvg} / 20` : '-'}</div>
                              <div className="text-indigo-600 text-[11px] mt-1">المسار (S1➔S2): {std.s1Avg ?? '-'} ➔ {std.s2Avg ?? '-'}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />

                    {/* Bar for Failure Risk Score */}
                    <Bar
                      yAxisId="left"
                      dataKey="failureRiskScore"
                      name="مؤشر احتمالية التعثر (%)"
                      radius={[4, 4, 0, 0]}
                      onClick={(data) => {
                        if (data) setSelectedRiskStudent(data);
                      }}
                      className="cursor-pointer"
                    >
                      {filteredSortedRiskList.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.riskColor} fillOpacity={0.85} />
                      ))}
                    </Bar>

                    {/* Line for Absence Hours */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalAbsenceHours"
                      name="ساعات الغياب التراكمية (س)"
                      stroke="#ea580c"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#ea580c' }}
                    />

                    {/* Line for Exam Average */}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="annualAvg"
                      name="معدل الفروض السنوي (/20)"
                      stroke="#2563eb"
                      strokeWidth={2.8}
                      dot={{ r: 5, fill: '#2563eb' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* بطاقة الفحص والتشخيص الفردي للتلميذ المحدد + إجراءات فورية */}
          {selectedRiskStudent && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg"
                    style={{ backgroundColor: selectedRiskStudent.riskColor }}
                  >
                    {selectedRiskStudent.failureRiskScore}%
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-black text-white">{selectedRiskStudent.name}</h4>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                        مسار: {selectedRiskStudent.massar}
                      </span>
                      <span
                        className="text-xs font-extrabold px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: selectedRiskStudent.riskBg, color: selectedRiskStudent.riskColor }}
                      >
                        {selectedRiskStudent.riskLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedRiskStudent.quadrantName} • القسم: {selectedClass}
                    </p>
                  </div>
                </div>

                {/* أزرار التدخل البيداغوجي المباشر */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSendRiskWhatsApp(selectedRiskStudent)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    title="مراسلة ولي الأمر عبر واتساب بتنبيه فوري حول مؤشر التعثر والغياب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إشعار الأسرة (WhatsApp)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnrollInTutoring(selectedRiskStudent)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    title="إدراج فوري في لائحة الدعم والاستدراك"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>إلحاق بالدعم والاستدراك</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenPortfolio(selectedRiskStudent)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    title="فتح ملف الإنجاز الرقمي الكامل للتلميذ"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>ملف الإنجاز الرقمي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAiCompare(selectedRiskStudent)}
                    className="px-3 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    title="تحليل الذكاء الاصطناعي المقارن: مقارنة المراقبة بالفروض المحروسة وتوصيات شخصية"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                    <span>مقارنة المراقبة بالفروض (AI)</span>
                  </button>
                </div>
              </div>

              {/* تفاصيل العوامل المساهمة في حساب مؤشر التعثر */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-slate-400 block mb-1">أثر الغياب التراكمي:</span>
                  <div className="text-base font-black text-rose-400">
                    {selectedRiskStudent.totalAbsenceHours} ساعة
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    ({selectedRiskStudent.unjustifiedHours}س غير مبرر + {selectedRiskStudent.justifiedHours}س مبرر)
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-slate-400 block mb-1">معدل الفروض المحروسة:</span>
                  <div className={`text-base font-black ${selectedRiskStudent.annualAvg !== null && selectedRiskStudent.annualAvg >= 10 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedRiskStudent.annualAvg !== null ? `${selectedRiskStudent.annualAvg} / 20` : 'دون نقط'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {getMoroccanAppreciation(selectedRiskStudent.annualAvg).text.split(' ')[0]}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-slate-400 block mb-1">دينامية التطور (S1 ➔ S2):</span>
                  <div className={`text-base font-black ${
                    selectedRiskStudent.deltaTrajectory === null ? 'text-slate-400' : selectedRiskStudent.deltaTrajectory > 0 ? 'text-emerald-400' : selectedRiskStudent.deltaTrajectory < 0 ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {selectedRiskStudent.s1Avg ?? '-'} ➔ {selectedRiskStudent.s2Avg ?? '-'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {selectedRiskStudent.deltaTrajectory !== null
                      ? selectedRiskStudent.deltaTrajectory > 0 ? `تحسن (+${selectedRiskStudent.deltaTrajectory})` : selectedRiskStudent.deltaTrajectory < 0 ? `تراجع (${selectedRiskStudent.deltaTrajectory})` : 'مستقر'
                      : 'فصل واحد متوفر'}
                  </div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <span className="text-slate-400 block mb-1">إهمال الواجبات والتأخرات:</span>
                  <div className="text-base font-black text-amber-400">
                    {selectedRiskStudent.missedHw} إخلال بالواجب
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    و {selectedRiskStudent.lateCount} حالات تأخر مرصودة
                  </div>
                </div>
              </div>

              {/* التوصية والتدخل البيداغوجي */}
              <div className="mt-4 p-3.5 bg-slate-800/90 rounded-xl border border-slate-700 flex items-start gap-3 text-xs leading-relaxed">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-extrabold text-indigo-300 mb-0.5">التوصية البيداغوجية المخصصة:</div>
                  <div className="text-slate-300">{selectedRiskStudent.recommendedIntervention} — {selectedRiskStudent.primaryFactor}.</div>
                </div>
              </div>
            </div>
          )}

          {/* الجدول التحليلي الكامل لمؤشر احتمالية التعثر لجميع التلاميذ */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  الجدول التحليلي المقارن لمؤشر احتمالية التعثر وعوامل الارتباط ({filteredSortedRiskList.length} تلميذ)
                </h3>
              </div>

              {/* Search within table */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث عن تلميذ..."
                  value={riskSearchQuery}
                  onChange={(e) => setRiskSearchQuery(e.target.value)}
                  className="w-full text-xs pr-8 pl-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-extrabold">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">التلميذ(ة)</th>
                    <th className="py-2.5 px-3 text-center">الغياب التراكمي</th>
                    <th className="py-2.5 px-3 text-center">معدل الفروض</th>
                    <th className="py-2.5 px-3 text-center">مسار S1 ➔ S2</th>
                    <th className="py-2.5 px-3 text-center">مؤشر التعثر %</th>
                    <th className="py-2.5 px-3 text-center">مستوى الخطر</th>
                    <th className="py-2.5 px-3">العامل المحوري المسبب</th>
                    <th className="py-2.5 px-3 text-center">إجراءات التدخل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSortedRiskList.map((std, idx) => (
                    <tr
                      key={std.id}
                      onClick={() => setSelectedRiskStudent(std)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        selectedRiskStudent?.id === std.id ? 'bg-rose-50/40 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900">{std.name}</div>
                        <div className="text-[10px] text-slate-400">{std.massar}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-black text-xs ${std.totalAbsenceHours >= 8 ? 'bg-rose-100 text-rose-800' : std.totalAbsenceHours > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'}`}>
                          {std.totalAbsenceHours}س
                        </span>
                        {std.unjustifiedHours > 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{std.unjustifiedHours}س غير مبرر</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-black text-xs ${std.annualAvg !== null && std.annualAvg >= 10 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {std.annualAvg !== null ? `${std.annualAvg}` : '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-bold text-[11px] ${
                          std.deltaTrajectory === null ? 'text-slate-400' : std.deltaTrajectory > 0 ? 'text-emerald-600' : std.deltaTrajectory < 0 ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {std.s1Avg ?? '-'} ➔ {std.s2Avg ?? '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="w-12 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${std.failureRiskScore}%`, backgroundColor: std.riskColor }}
                            ></div>
                          </div>
                          <span className="font-black text-xs" style={{ color: std.riskColor }}>
                            {std.failureRiskScore}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                          style={{ backgroundColor: std.riskBg, color: std.riskColor }}
                        >
                          {std.riskLabel.split(' ')[0]}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[200px] truncate" title={std.primaryFactor}>
                        {std.primaryFactor}
                      </td>
                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSendRiskWhatsApp(std)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="إرسال تنبيه واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnrollInTutoring(std)}
                            className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                            title="إلحاق بالدعم والاستدراك"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPortfolio(std)}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"
                            title="ملف الإنجاز الرقمي"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAiCompare(std)}
                            className="p-1 text-purple-600 hover:bg-purple-50 rounded cursor-pointer"
                            title="مقارنة المراقبة المستمرة بالفروض المحروسة بالذكاء الاصطناعي"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
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
      )}

      {/* ========================================================================= */}
      {/* 2. VIEW MODE: المنحنى الفردي للتلميذ ومقارنته بالقسم (Individual Mode)       */}
      {/* ========================================================================= */}
      {viewMode === 'individual' && currentStudent && (
        <div className="space-y-5">
          {/* Individual Student KPI & Status Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-md shadow-blue-500/20">
                  {currentStudent.name.trim().charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900">{currentStudent.name}</h3>
                    {currentStudent.massar && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {currentStudent.massar}
                      </span>
                    )}
                    <span
                      className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: studentAppreciation.bg, color: studentAppreciation.color }}
                    >
                      {studentAppreciation.text}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    <span>القسم: <strong className="text-slate-700">{selectedClass}</strong></span>
                    {studentRankInfo.rank && (
                      <span>
                        الرتبة: <strong className="text-blue-600 font-extrabold">{studentRankInfo.rank}</strong> من {studentRankInfo.total}
                      </span>
                    )}
                    {progressionInfo && (
                      <span className="flex items-center gap-1 font-semibold">
                        {progressionInfo.isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        ) : progressionInfo.isNeutral ? (
                          <Minus className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span className={progressionInfo.isPositive ? 'text-emerald-700' : progressionInfo.isNeutral ? 'text-amber-700' : 'text-rose-700'}>
                          {progressionInfo.text}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3 self-stretch md:self-auto justify-around border-t md:border-t-0 md:border-r border-slate-100 pt-3 md:pt-0 md:pr-4">
                <div className="text-center px-2">
                  <span className="text-[11px] text-slate-400 font-bold block">معدل التلميذ</span>
                  <span className={`text-xl font-black ${studentOverallAvg !== null && studentOverallAvg >= 10 ? 'text-blue-700' : 'text-rose-600'}`}>
                    {studentOverallAvg !== null ? `${studentOverallAvg} / 20` : '-'}
                  </span>
                </div>
                <div className="text-center px-2 border-r border-slate-100">
                  <span className="text-[11px] text-slate-400 font-bold block">معدل القسم</span>
                  <span className="text-xl font-black text-amber-700">
                    {classOverallAvg !== null ? `${classOverallAvg} / 20` : '-'}
                  </span>
                </div>
                <div className="text-center px-2 border-r border-slate-100">
                  <span className="text-[11px] text-slate-400 font-bold block">الفارق</span>
                  <span className={`text-xl font-black ${deltaOverall !== null && deltaOverall >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {deltaOverall !== null ? (deltaOverall >= 0 ? `+${deltaOverall}` : deltaOverall) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Line Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  منحنى مسار المراقبة المستمرة مقارنة بمتوسط القسم
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الخط الأزرق يوضح علامات التلميذ في الفروض، والخط البرتقالي المتقطع يمثل معدل القسم الإجمالي.
                </p>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBenchmark10}
                    onChange={(e) => setShowBenchmark10(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>عتبة النجاح (10/20)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMinMaxRange}
                    onChange={(e) => setShowMinMaxRange(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>أعلى وأدنى نقطة بالقسم</span>
                </label>
              </div>
            </div>

            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={individualChartData} margin={{ top: 15, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 20]}
                    ticks={[0, 5, 10, 15, 20]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'النقطة (/20)', angle: -90, position: 'insideLeft', offset: 10, fill: '#94a3b8', fontSize: 11 }}
                  />
                  <Tooltip content={<CustomIndividualTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />

                  {showBenchmark10 && (
                    <ReferenceLine
                      y={10}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: 'عتبة النجاح (10)', fill: '#059669', fontSize: 11, position: 'right' }}
                    />
                  )}

                  {showMinMaxRange && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="أعلى نقطة بالقسم"
                        stroke="#10b981"
                        strokeDasharray="2 2"
                        strokeWidth={1.5}
                        dot={{ r: 3, fill: '#10b981' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="أدنى نقطة بالقسم"
                        stroke="#f43f5e"
                        strokeDasharray="2 2"
                        strokeWidth={1.5}
                        dot={{ r: 3, fill: '#f43f5e' }}
                      />
                    </>
                  )}

                  <Line
                    type="monotone"
                    dataKey="معدل القسم"
                    stroke="#f97316"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 5, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                    name="معدل القسم"
                    animationDuration={1200}
                  />

                  <Line
                    type="monotone"
                    dataKey="نقطة التلميذ"
                    stroke="#2563eb"
                    strokeWidth={3.8}
                    dot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 9, stroke: '#1d4ed8', strokeWidth: 2 }}
                    name="نقطة التلميذ"
                    animationDuration={1200}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'individual' && !currentStudent && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">تتبع مسار التلميذ ومنحنى تطور الفروض (Recharts)</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {students.length === 0
              ? 'لم يتم تسجيل أو استيراد تلاميذ في هذا القسم بعد. يرجى استيراد لائحة مسار من قسم إدارة الأقسام.'
              : 'يرجى اختيار تلميذ من القائمة المنسدلة أعلاه لعرض منحنى بياني تفاعلي لتطور نقطه عبر جميع الفروض الماضية وتحديد نسب التحسن أو التراجع.'}
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW MODE: توزيع معدلات كافة تلاميذ القسم (Class All Mode)             */}
      {/* ========================================================================= */}
      {viewMode === 'class_all' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                توزيع معدلات المراقبة المستمرة لجميع تلاميذ القسم ({selectedClass})
              </h3>
              <p className="text-xs text-slate-500">
                مقارنة كل تلميذ بمعدل القسم الإجمالي ({classOverallAvg ?? '-'} / 20) وعتبة النجاح (10/20) - مرتبة تنازلياً
              </p>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              إجمالي التلاميذ بالرسم: {allStudentsChartData.length} تلميذ
            </div>
          </div>

          {allStudentsChartData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">لا توجد نقط مسجلة لتلاميذ هذا القسم حتى الآن.</div>
          ) : (
            <div className="w-full h-96" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allStudentsChartData} margin={{ top: 15, right: 15, left: -10, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }}
                    interval={0}
                    height={60}
                  />
                  <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const std = payload[0].payload;
                        const mark = std['معدل التلميذ'];
                        const cAvg = std['معدل القسم'];
                        const app = getMoroccanAppreciation(mark);
                        return (
                          <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-right text-xs" dir="rtl">
                            <div className="font-bold text-slate-900 mb-1">{std.name}</div>
                            <div className="text-blue-700 font-extrabold mb-1">
                              المعدل: {mark} / 20 ({app.text.split(' ')[0]})
                            </div>
                            <div className="text-amber-700 font-bold mb-1">معدل القسم: {cAvg} / 20</div>
                            <div className={`font-bold ${mark >= cAvg ? 'text-emerald-600' : 'text-rose-600'}`}>
                              الفارق: {mark >= cAvg ? `+${(mark - cAvg).toFixed(2)}` : (mark - cAvg).toFixed(2)}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {showBenchmark10 && (
                    <ReferenceLine
                      y={10}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: 'عتبة النجاح (10)', fill: '#059669', fontSize: 10, position: 'top' }}
                    />
                  )}

                  {classOverallAvg !== null && (
                    <ReferenceLine
                      y={classOverallAvg}
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{ value: `معدل القسم (${classOverallAvg})`, fill: '#ea580c', fontSize: 10, position: 'top' }}
                    />
                  )}

                  <Bar
                    dataKey="معدل التلميذ"
                    radius={[4, 4, 0, 0]}
                    onClick={(node) => {
                      if (node && node.id) {
                        setSelectedStudentId(node.id);
                        setViewMode('individual');
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {allStudentsChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry['معدل التلميذ'] >= (classOverallAvg || 10) ? '#2563eb' : entry['معدل التلميذ'] >= 10 ? '#0284c7' : '#f43f5e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-[11px] text-slate-400 text-center mt-2">
            💡 يمكنك النقر على عمود أي تلميذ للانتقال مباشرة إلى منحنى مساره الفردي التفصيلي.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VIEW MODE: تطور معدلات الأقسام ومقارنة الأسدسين (Recharts Class Progression) */}
      {/* ========================================================================= */}
      {viewMode === 'class_progression' && (
        <div className="space-y-5">
          {/* Controls Bar for Class Progression */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">طريقة المقارنة:</span>
              <button
                type="button"
                onClick={() => setProgressionSubMode('single_class')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  progressionSubMode === 'single_class'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                مقارنة الأسدسين لقسم واحد ({selectedClass})
              </button>
              <button
                type="button"
                onClick={() => setProgressionSubMode('all_classes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  progressionSubMode === 'all_classes'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                مقارنة جميع الأقسام معاً ({classNames.length} أقسام)
              </button>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center">
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
                <span className="text-[11px] font-bold text-slate-500 px-1">نوع المخطط:</span>
                <button
                  type="button"
                  onClick={() => setProgressionChartType('composed')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    progressionChartType === 'composed'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  مركب (أعمدة + خط)
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionChartType('bars')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    progressionChartType === 'bars'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  أعمدة متوازية
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          {progressionSubMode === 'single_class' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                  <span>معدل الأسدس الأول (S1)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">
                  {classProgressionAnalytics.s1OverallAvg !== null ? `${classProgressionAnalytics.s1OverallAvg} / 20` : 'غير متوفر'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>نسبة النجاح (≥10):</span>
                  <span className="font-bold text-blue-700">{classProgressionAnalytics.s1PassRate}% ({classProgressionAnalytics.s1PassCount} تلميذ)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1 flex items-center justify-between">
                  <span>معدل الأسدس الثاني (S2)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                </div>
                <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">
                  {classProgressionAnalytics.s2OverallAvg !== null ? `${classProgressionAnalytics.s2OverallAvg} / 20` : 'غير متوفر'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>نسبة النجاح (≥10):</span>
                  <span className="font-bold text-emerald-700">{classProgressionAnalytics.s2PassRate}% ({classProgressionAnalytics.s2PassCount} تلميذ)</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">فارق التطور البيداغوجي (S2 - S1)</div>
                <div className="flex items-center gap-2">
                  <div className={`text-xl md:text-2xl font-black font-mono ${
                    classProgressionAnalytics.delta !== null && classProgressionAnalytics.delta > 0
                      ? 'text-emerald-600'
                      : classProgressionAnalytics.delta !== null && classProgressionAnalytics.delta < 0
                      ? 'text-rose-600'
                      : 'text-slate-700'
                  }`}>
                    {classProgressionAnalytics.delta !== null
                      ? `${classProgressionAnalytics.delta > 0 ? '+' : ''}${classProgressionAnalytics.delta}`
                      : '-'}
                  </div>
                  {classProgressionAnalytics.delta !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold flex items-center gap-0.5 ${
                      classProgressionAnalytics.delta > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : classProgressionAnalytics.delta < 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {classProgressionAnalytics.delta > 0 ? '↗️ تقدم' : classProgressionAnalytics.delta < 0 ? '↘️ تراجع' : '➡️ استقرار'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {classProgressionAnalytics.deltaPercent !== null ? `نسبة التغير: ${classProgressionAnalytics.deltaPercent}%` : 'مقارنة الدورتين'}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">المعدل السنوي الإجمالي للقسم</div>
                <div className="text-xl md:text-2xl font-black text-indigo-700 font-mono">
                  {classProgressionAnalytics.annualOverallAvg !== null ? `${classProgressionAnalytics.annualOverallAvg} / 20` : '-'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  إجمالي تلاميذ القسم: {classProgressionAnalytics.totalStudents} تلميذ
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">إجمالي الأقسام المقارنة</div>
                <div className="text-xl md:text-2xl font-black text-slate-900 font-mono">{classNames.length} أقسام</div>
                <div className="text-[11px] text-slate-500 mt-1">مقارنة شاملة بين S1 و S2</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">أعلى قسم أداءً في S2</div>
                <div className="text-base md:text-lg font-black text-emerald-700 truncate">
                  {allClassesProgressionData.reduce((prev, cur) => ((cur['الأسدس الثاني (S2)'] || 0) > (prev['الأسدس الثاني (S2)'] || 0) ? cur : prev), allClassesProgressionData[0] || {})?.name || '-'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">بناءً على نقط الفروض</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">أكبر تطور بيداغوجي</div>
                <div className="text-base md:text-lg font-black text-blue-700 truncate">
                  {allClassesProgressionData.reduce((prev, cur) => ((cur['فارق التطور'] || 0) > (prev['فارق التطور'] || 0) ? cur : prev), allClassesProgressionData[0] || {})?.name || '-'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">فارق إيجابي بين الدورتين</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-slate-500 mb-1">عتبة النجاح المستهدفة</div>
                <div className="text-xl md:text-2xl font-black text-amber-600 font-mono">10.00 / 20</div>
                <div className="text-[11px] text-slate-500 mt-1">المعيار الوزاري المعتمد</div>
              </div>
            </div>
          )}

          {/* Main Interactive Recharts Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  {progressionSubMode === 'single_class'
                    ? `رسم تطور معدلات الفروض ومقارنة الأسدسين 1 و 2 لقسم (${selectedClass})`
                    : `مقارنة تطور معدلات كافة الأقسام جنباً إلى جنب بين الأسدس 1 و 2`}
                </h3>
                <p className="text-xs text-slate-500">
                  {progressionSubMode === 'single_class'
                    ? 'تحليل تطور التحصيل عبر الفروض المحروسة F1، F2، F3 والمعدل العام بين الدورة 1 والدورة 2 مع رصد فارق التطور وعتبة النجاح (10/20).'
                    : 'نظرة شمولية مقارنة لكافة الأقسام لتحديد الفصول التي حققت تقدماً نوعياً وتلك التي تتطلب تدخلاً ومعالجة بيداغوجية.'}
                </p>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block"></span>
                  <span className="text-slate-700">الأسدس الأول (S1)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
                  <span className="text-slate-700">الأسدس الثاني (S2)</span>
                </div>
                {progressionSubMode === 'single_class' && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-1 bg-amber-500 inline-block"></span>
                    <span className="text-slate-700">عتبة 10/20</span>
                  </div>
                )}
              </div>
            </div>

            {progressionSubMode === 'single_class' ? (
              classProgressionAnalytics.examComparisonChartData.length === 0 ? (
                <div className="text-center py-12 text-slate-500">لا توجد نقط مسجلة لهذا القسم في الدورتين.</div>
              ) : (
                <div className="w-full h-96" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={classProgressionAnalytics.examComparisonChartData}
                      margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis
                        domain={[0, 20]}
                        ticks={[0, 5, 10, 15, 20]}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const s1Val = data['الأسدس الأول (S1)'];
                            const s2Val = data['الأسدس الثاني (S2)'];
                            const deltaVal = data['فارق التطور'];
                            return (
                              <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-200 text-right text-xs" dir="rtl">
                                <div className="font-black text-slate-900 border-b border-slate-100 pb-1 mb-2">
                                  {data.name}
                                </div>
                                <div className="flex items-center justify-between gap-4 mb-1">
                                  <span className="text-blue-700 font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    الأسدس الأول (S1):
                                  </span>
                                  <span className="font-black font-mono text-slate-900">
                                    {s1Val !== null ? `${s1Val} / 20` : 'غير مسجل'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 mb-1.5">
                                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    الأسدس الثاني (S2):
                                  </span>
                                  <span className="font-black font-mono text-slate-900">
                                    {s2Val !== null ? `${s2Val} / 20` : 'غير مسجل'}
                                  </span>
                                </div>
                                {deltaVal !== null && (
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-4">
                                    <span className="font-bold text-slate-600">فارق التطور (S2 - S1):</span>
                                    <span className={`font-black font-mono ${deltaVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {deltaVal >= 0 ? `+${deltaVal}` : deltaVal} {deltaVal >= 0 ? '↗️' : '↘️'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine
                        y={10}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: 'عتبة النجاح (10)', fill: '#d97706', fontSize: 10, position: 'top' }}
                      />
                      <Bar dataKey="الأسدس الأول (S1)" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={45} />
                      <Bar dataKey="الأسدس الثاني (S2)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={45} />
                      {progressionChartType === 'composed' && (
                        <Line
                          type="monotone"
                          dataKey="الأسدس الثاني (S2)"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#059669', strokeWidth: 1.5, stroke: '#ffffff' }}
                          activeDot={{ r: 6 }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={allClassesProgressionData}
                    margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis
                      domain={[0, 20]}
                      ticks={[0, 5, 10, 15, 20]}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-200 text-right text-xs" dir="rtl">
                              <div className="font-black text-slate-900 border-b border-slate-100 pb-1 mb-2">
                                قسم: {d.name} ({d.totalStudents} تلميذ)
                              </div>
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <span className="text-blue-700 font-bold">الأسدس الأول (S1):</span>
                                <span className="font-black font-mono text-slate-900">
                                  {d['الأسدس الأول (S1)'] !== null ? `${d['الأسدس الأول (S1)']} / 20` : '-'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <span className="text-emerald-700 font-bold">الأسدس الثاني (S2):</span>
                                <span className="font-black font-mono text-slate-900">
                                  {d['الأسدس الثاني (S2)'] !== null ? `${d['الأسدس الثاني (S2)']} / 20` : '-'}
                                </span>
                              </div>
                              {d['فارق التطور'] !== null && (
                                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-4">
                                  <span className="font-bold text-slate-600">فارق التطور:</span>
                                  <span className={`font-black font-mono ${d['فارق التطور'] >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {d['فارق التطور'] >= 0 ? `+${d['فارق التطور']}` : d['فارق التطور']} {d['فارق التطور'] >= 0 ? '↗️' : '↘️'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={10}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: 'عتبة النجاح (10)', fill: '#d97706', fontSize: 10, position: 'top' }}
                    />
                    <Bar dataKey="الأسدس الأول (S1)" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="الأسدس الثاني (S2)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Distribution & Pedagogical Breakdown */}
          {progressionSubMode === 'single_class' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-600" />
                  مقارنة هرم توزيع فئات التلاميذ بين الأسدسين ({selectedClass})
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="text-emerald-700">المتفوقون (≥ 16 / 20)</span>
                      <span>S1: {classProgressionAnalytics.s1Distribution.excellent} تلميذ | S2: {classProgressionAnalytics.s2Distribution.excellent} تلميذ</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                      <div className="bg-blue-600 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s1Distribution.excellent / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                      <div className="bg-emerald-500 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s2Distribution.excellent / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="text-blue-700">المتمكنون (12 - 15.99)</span>
                      <span>S1: {classProgressionAnalytics.s1Distribution.good} تلميذ | S2: {classProgressionAnalytics.s2Distribution.good} تلميذ</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                      <div className="bg-blue-600 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s1Distribution.good / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                      <div className="bg-emerald-500 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s2Distribution.good / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="text-amber-700">المتوسطون (10 - 11.99)</span>
                      <span>S1: {classProgressionAnalytics.s1Distribution.average} تلميذ | S2: {classProgressionAnalytics.s2Distribution.average} تلميذ</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                      <div className="bg-blue-600 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s1Distribution.average / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                      <div className="bg-emerald-500 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s2Distribution.average / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span className="text-rose-700">المتعثرون دون المعدل (&lt; 10)</span>
                      <span>S1: {classProgressionAnalytics.s1Distribution.struggling} تلميذ | S2: {classProgressionAnalytics.s2Distribution.struggling} تلميذ</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                      <div className="bg-rose-400 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s1Distribution.struggling / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                      <div className="bg-rose-600 h-2.5" style={{ width: `${Math.min(100, (classProgressionAnalytics.s2Distribution.struggling / (classProgressionAnalytics.totalStudents || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    الاستخلاص البيداغوجي لمسار القسم وتوجيهات الأستاذ
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {classProgressionAnalytics.trend === 'improving'
                      ? `يسجل قسم ${selectedClass} تطوراً إيجابياً ملموساً (+${classProgressionAnalytics.delta ?? 0}) بين الأسدسين الأول والثاني، مع تحسن في نسبة النجاح العامة وتناقص فئة المتعثرين، مما يعكس نجاعة أنشطة المعالجة والاستدراك المنفذة.`
                      : classProgressionAnalytics.trend === 'declining'
                      ? `يسجل قسم ${selectedClass} تراجعاً طفيفاً (-${Math.abs(classProgressionAnalytics.delta ?? 0)}) في معدل الأسدس الثاني مقارنة بالأول، مما يستدعي تكثيف أنشطة الدعم البيداغوجي الموجه في المفاهيم الأكثر تعقيداً وربطها بجدول الحصص الأسبوعي.`
                      : `استقرار متوازن في المردودية العامة لقسم ${selectedClass} بين الأسدسين. يوصى بالحفاظ على وتيرة العمل وتفعيل بيداغوجيا الأقران لدعم المتعثرين دون عتبة 10/20.`}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-bold">
                    💡 يمكنك تصدير المنحنى أو طباعته مباشرة من شريط الأدوات العلوي.
                  </span>
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تصدير تقرير المقارنة</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
