import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  MessageCircle,
  GraduationCap,
  ArrowUpDown,
  Search,
  ShieldAlert,
  Sparkles,
  Activity,
  Layers,
  Target,
  Compass
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

// Bac Readiness Index Data Interface (Point 4)
interface StudentBacReadinessData {
  id: string;
  name: string;
  massar: string;
  orderNum?: string;
  // Raw metrics
  s1Avg: number | null;
  s2Avg: number | null;
  annualAvg: number | null;
  firstExamMark: number | null;
  lastExamMark: number | null;
  examSlope: number; // lastExam - firstExam
  totalAbsenceHours: number;
  unjustifiedHours: number;
  lateCount: number;
  missedHw: number;
  totalSessionsCount: number;
  // 3 Normalized Pillar Scores (0-100%)
  gradesPillarScore: number;     // Weight 50% (Exam average + progression momentum)
  attendancePillarScore: number; // Weight 25% (Discipline & presence)
  homeworkPillarScore: number;   // Weight 25% (Problem sets & homework completion)
  // Composite Bac Readiness Index (0-100%)
  readinessIndex: number;
  readinessStatus: 'excellence' | 'ready' | 'fragile' | 'at_risk';
  readinessLabel: string;
  readinessColor: string;
  readinessBg: string;
  predictedBacRange: string;
  mathPrescription: string;
}

// Official Indigo & Gold (النيلي والذهبي) Visual Identity Palette
const INDIGO_GOLD_THEME = {
  indigoDeep: '#1e1b4b',     // Indigo 950
  indigoRoyal: '#312e81',    // Indigo 900 (Primary Brand Indigo)
  indigoPrimary: '#3730a3',  // Indigo 800
  indigoVibrant: '#4338ca',  // Indigo 700
  indigoMedium: '#4f46e5',   // Indigo 600
  indigoSoft: '#6366f1',     // Indigo 500
  indigoLight: '#818cf8',    // Indigo 400
  indigoTint: '#e0e7ff',     // Indigo 100
  goldDeep: '#78350f',       // Amber 900
  goldBronze: '#92400e',     // Amber 800
  goldRich: '#b45309',       // Amber 700
  goldPrimary: '#d97706',    // Amber 600 (Primary Brand Gold)
  goldBright: '#f59e0b',     // Amber 500
  goldWarm: '#fbbf24',       // Amber 400
  goldLight: '#fde68a',      // Amber 200
  goldTint: '#fef3c7'        // Amber 100
};

function openWhatsAppSafely(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Appreciation helper conforming to Moroccan Ministry of National Education standards aligned with Indigo & Gold
function getMoroccanAppreciation(mark: number | null): { text: string; short: string; color: string; bg: string } {
  if (mark === null || isNaN(mark)) {
    return { text: 'غير مسجل', short: 'غير مسجل', color: '#64748b', bg: '#f1f5f9' };
  }
  if (mark >= 16) {
    return { text: 'ممتاز (Très Bien)', short: 'ممتاز', color: '#b45309', bg: '#fef3c7' };
  }
  if (mark >= 14) {
    return { text: 'حسن جداً (Bien)', short: 'حسن جداً', color: '#312e81', bg: '#e0e7ff' };
  }
  if (mark >= 12) {
    return { text: 'حسن (Assez Bien)', short: 'حسن', color: '#4338ca', bg: '#eef2ff' };
  }
  if (mark >= 10) {
    return { text: 'مستحسن / متوسط (Moyen)', short: 'متوسط', color: '#d97706', bg: '#fffbeb' };
  }
  if (mark >= 8) {
    return { text: 'دون المتوسط (Insuffisant)', short: 'هش (8-9.99)', color: '#92400e', bg: '#ffedd5' };
  }
  return { text: 'ضعيف / متعثر (Faible)', short: 'متعثر (<8)', color: '#dc2626', bg: '#fee2e2' };
}

function detectClassCertificationTarget(className: string): {
  badge: string;
  examTitle: string;
  coefLabel: string;
  description: string;
} {
  const norm = (className || '').toUpperCase();
  if (norm.includes('2BAC') || norm.includes('2 BAC') || norm.includes('الثانية') || norm.includes('ثانية باك') || norm.includes('2B')) {
    const isSM = norm.includes('SM') || norm.includes('رياضية');
    return {
      badge: 'الامتحان الوطني الموحد للبكالوريا',
      examTitle: 'مؤشر الجاهزية للامتحان الوطني الموحد للبكالوريا (مادة الرياضيات)',
      coefLabel: isSM ? 'المعامل الرسمي: 9 (علوم رياضية)' : 'المعامل الرسمي: 7 (علوم تجريبية / تقنية)',
      description: 'تنبؤ استباقي بجاهزية تلاميذ السنة الثانية بكالوريا لاجتياز الامتحان الوطني في الرياضيات بناءً على (تطور نقط الفروض المحروسة 50% + المواظبة 25% + التزام سلاسل التمارين 25%).'
    };
  }
  if (norm.includes('1BAC') || norm.includes('1 BAC') || norm.includes('الأولى') || norm.includes('أولى باك') || norm.includes('1B')) {
    return {
      badge: 'الأولى بكالوريا • الاستحقاق الإشهادي والترقية',
      examTitle: 'مؤشر الجاهزية الإشهادية والتمكن الرياضي (السنة الأولى بكالوريا)',
      coefLabel: 'تأهيل مباشر لسلك الثانية بكالوريا',
      description: 'قياس مدى تملك الكفايات الرياضية الأساسية (النهايات، الاشتقاق، المتتاليات، التحليل) اللازمة للنجاح في الامتحانات الإشهادية والعبور الآمن للثانية بكالوريا.'
    };
  }
  return {
    badge: 'التأهيل العلمي والتوجيه السليم',
    examTitle: 'مؤشر الجاهزية الرياضية والتمكن من الكفايات الأساسية',
    coefLabel: 'السلك الثانوي التأهيلي - مادة الرياضيات',
    description: 'مؤشر تركيبي يدمج (نسبة المواظبة + تطور نقط الفروض المحروسة + نسبة إنجاز سلاسل التمارين المنزلية) للتنبؤ المبكر بالتلاميذ المهددين بالتعثر قبل نهاية الدورة.'
  };
}

type ViewModeType =
  | 'exam_levels_evolution'
  | 'bac_readiness'
  | 'individual'
  | 'class_all'
  | 'failure_risk'
  | 'class_progression';

export default function ReportsEvolutionChart() {
  const [db, setDb] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [semester, setSemester] = useState<'s1' | 's2' | 'annual'>('s1');
  const [viewMode, setViewMode] = useState<ViewModeType>('exam_levels_evolution');

  // State for "exam_levels_evolution" (منحنى تطور مستويات التلاميذ في الفروض المحروسة لكل قسم على حدة)
  const [evoScope, setEvoScope] = useState<'annual_all' | 's1' | 's2'>('annual_all');
  const [evoSubChart, setEvoSubChart] = useState<'levels_curve' | 'stats_curve' | 'trajectories_curve'>('levels_curve');
  const [trajectoryGroupFilter, setTrajectoryGroupFilter] = useState<'improvers' | 'decliners' | 'top5' | 'struggling'>('improvers');
  const [evoTableSearch, setEvoTableSearch] = useState<string>('');

  // State for "bac_readiness" (Point 4: مؤشر الجاهزية للامتحان الوطني والجهوي)
  const [bacFilterStatus, setBacFilterStatus] = useState<'all' | 'at_risk' | 'fragile' | 'ready' | 'excellence'>('all');
  const [bacSortBy, setBacSortBy] = useState<'readiness_asc' | 'readiness_desc' | 'grades_asc' | 'hw_asc'>('readiness_asc');
  const [bacChartMode, setBacChartMode] = useState<'composed' | 'pillars'>('composed');
  const [bacSearchQuery, setBacSearchQuery] = useState<string>('');

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
          console.error('Error parsing localStorage db:', e);
        }
      }
    }
  };

  useEffect(() => {
    loadDb();

    const handleTabOpened = (e: any) => {
      loadDb();
      if (e && e.detail) {
        if (e.detail.className && e.detail.className !== '__ALL__') {
          setSelectedClass(e.detail.className);
        }
        if (e.detail.studentId) setSelectedStudentId(e.detail.studentId);
        if (e.detail.viewMode) setViewMode(e.detail.viewMode);
      } else {
        // Also check #reportClassSelect in DOM if present
        const reportSelect = document.getElementById('reportClassSelect') as HTMLSelectElement | null;
        if (reportSelect && reportSelect.value && reportSelect.value !== '__ALL__') {
          setSelectedClass(reportSelect.value);
        }
      }
    };

    const handleDbUpdated = () => {
      loadDb();
    };

    const handleSelectStudent = (e: any) => {
      if (e && e.detail) {
        if (e.detail.className) setSelectedClass(e.detail.className);
        if (e.detail.studentId) setSelectedStudentId(e.detail.studentId);
        if (e.detail.viewMode) setViewMode(e.detail.viewMode);
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
        const reportSelect = document.getElementById('reportClassSelect') as HTMLSelectElement | null;
        if (reportSelect && reportSelect.value && classes.includes(reportSelect.value)) {
          setSelectedClass(reportSelect.value);
        } else {
          setSelectedClass(classes[0]);
        }
      }
    }
  }, [db, selectedClass]);

  // Helper to change class and optionally sync with #reportClassSelect
  const handleSelectClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    const reportSelect = document.getElementById('reportClassSelect') as HTMLSelectElement | null;
    if (reportSelect && reportSelect.value !== newClass) {
      reportSelect.value = newClass;
      if (typeof (window as any).renderReport === 'function') {
        try {
          (window as any).renderReport();
        } catch (e) {
          console.warn(e);
        }
      }
    }
  };

  // Students list of the currently selected class
  const students: Student[] = useMemo(() => {
    if (!db || !db.classes || !selectedClass || !db.classes[selectedClass]) return [];
    const rawList = db.classes[selectedClass];
    const list: Student[] = Array.isArray(rawList) ? rawList : rawList.students || [];
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

  // Determine active exam keys for this class (e.g. ['f1', 'f2', 'f3'] or with 'f4')
  const examKeys = useMemo(() => {
    if (!db || !selectedClass) return ['f1', 'f2', 'f3'];
    let count = 3;
    if (typeof window !== 'undefined' && typeof (window as any).getExamsCountForClass === 'function') {
      count = Number((window as any).getExamsCountForClass(selectedClass)) || 3;
    } else if (db.classConfig && db.classConfig[selectedClass] !== undefined) {
      const cfg = db.classConfig[selectedClass];
      count = typeof cfg === 'object' ? parseInt(cfg.examsCount, 10) || 3 : parseInt(cfg, 10) || 3;
    } else if (db.examsCount && db.examsCount[selectedClass]) {
      count = parseInt(db.examsCount[selectedClass], 10) || 3;
    }
    if (count === 2) return ['f1', 'f2'];
    if (count === 4) return ['f1', 'f2', 'f3', 'f4'];
    return ['f1', 'f2', 'f3'];
  }, [db, selectedClass]);

  // Helper to extract student mark safely
  const getStudentMark = (stdId: string, examKey: string, sem: 's1' | 's2' | 'annual', clsName = selectedClass): number | null => {
    if (!db || !clsName) return null;
    const record = db.grades?.[clsName]?.[stdId];
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
          : db.gradesS1?.[clsName]?.[stdId]?.[examKey] !== undefined
          ? db.gradesS1[clsName][stdId][examKey]
          : record?.[examKey];
      return parseMark(s1Val);
    }

    if (sem === 's2') {
      const s2Val =
        record?.s2?.[examKey] !== undefined
          ? record.s2[examKey]
          : db.gradesS2?.[clsName]?.[stdId]?.[examKey];
      return parseMark(s2Val);
    }

    const m1 = getStudentMark(stdId, examKey, 's1', clsName);
    const m2 = getStudentMark(stdId, examKey, 's2', clsName);
    if (m1 !== null && m2 !== null) return parseFloat(((m1 + m2) / 2).toFixed(2));
    if (m1 !== null) return m1;
    if (m2 !== null) return m2;
    return null;
  };

  // Helper to calculate student's overall average in the selected semester
  const getStudentOverallAvg = (stdId: string, sem: 's1' | 's2' | 'annual', clsName = selectedClass): number | null => {
    const marks: number[] = [];
    examKeys.forEach(k => {
      const m = getStudentMark(stdId, k, sem, clsName);
      if (m !== null) marks.push(m);
    });
    if (marks.length === 0) return null;
    const sum = marks.reduce((acc, v) => acc + v, 0);
    return parseFloat((sum / marks.length).toFixed(2));
  };

  // =========================================================================
  // NEW FEATURE 1: منحنى تطور مستويات التلاميذ في الفروض المحروسة لكل قسم على حدة
  // =========================================================================
  const classExamLevelsEvolution = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        milestones: [] as any[],
        studentRows: [] as any[],
        trajectoryChartData: [] as any[],
        selectedTrajectoryStudents: [] as any[],
        summary: {
          firstExamAvg: null as number | null,
          lastExamAvg: null as number | null,
          netAvgDelta: null as number | null,
          improvedStudentsCount: 0,
          declinedStudentsCount: 0,
          stableStudentsCount: 0,
          latestPassRate: 0,
          latestExcellenceCount: 0
        }
      };
    }

    // Build chronological exam milestones based on evoScope
    const examDefs: Array<{ id: string; sem: 's1' | 's2'; key: string; label: string; shortLabel: string }> = [];
    const examNamesAr: Record<string, string> = {
      f1: 'الفرض المحروس 1',
      f2: 'الفرض المحروس 2',
      f3: 'الفرض المحروس 3',
      f4: 'الفرض المحروس 4'
    };

    if (evoScope === 's1' || evoScope === 'annual_all') {
      examKeys.forEach((k, idx) => {
        examDefs.push({
          id: `s1_${k}`,
          sem: 's1',
          key: k,
          label: evoScope === 'annual_all' ? `د1 - الفرض ${idx + 1}` : examNamesAr[k] || k,
          shortLabel: `د1-ف${idx + 1}`
        });
      });
    }
    if (evoScope === 's2' || evoScope === 'annual_all') {
      examKeys.forEach((k, idx) => {
        examDefs.push({
          id: `s2_${k}`,
          sem: 's2',
          key: k,
          label: evoScope === 'annual_all' ? `د2 - الفرض ${idx + 1}` : examNamesAr[k] || k,
          shortLabel: `د2-ف${idx + 1}`
        });
      });
    }

    // Calculate milestone statistics & student mastery level counts for each exam
    const milestones: any[] = [];
    examDefs.forEach(def => {
      const marks: number[] = [];
      let excellentCount = 0; // >= 14
      let masteredCount = 0;  // 10 - 13.99
      let fragileCount = 0;   // 8 - 9.99
      let strugglingCount = 0; // < 8

      students.forEach(s => {
        const m = getStudentMark(s.id, def.key, def.sem);
        if (m !== null) {
          marks.push(m);
          if (m >= 14) excellentCount++;
          else if (m >= 10) masteredCount++;
          else if (m >= 8) fragileCount++;
          else strugglingCount++;
        }
      });

      const sortedMarks = [...marks].sort((a, b) => a - b);
      const count = marks.length;
      const avg = count > 0 ? parseFloat((marks.reduce((a, b) => a + b, 0) / count).toFixed(2)) : null;
      const median =
        count > 0
          ? count % 2 === 1
            ? sortedMarks[Math.floor(count / 2)]
            : parseFloat(((sortedMarks[count / 2 - 1] + sortedMarks[count / 2]) / 2).toFixed(2))
          : null;
      const max = count > 0 ? sortedMarks[count - 1] : null;
      const min = count > 0 ? sortedMarks[0] : null;
      const passCount = excellentCount + masteredCount;
      const passRate = count > 0 ? Math.round((passCount / count) * 100) : null;

      milestones.push({
        id: def.id,
        name: def.label,
        shortName: def.shortLabel,
        count,
        hasData: count > 0,
        'معدل القسم': avg,
        'الوسيط الحسابي': median,
        'أعلى نقطة': max,
        'أدنى نقطة': min,
        'عتبة النجاح (10)': 10,
        'نسبة التحكم (%)': passRate,
        'فئة التميز (≥14)': excellentCount,
        'فئة التحكم (10-13.99)': masteredCount,
        'فئة الهشاشة (8-9.99)': fragileCount,
        'فئة التعثر (<8)': strugglingCount
      });
    });

    // Filter milestones that actually have recorded marks (or keep all if none have data yet so chart axes render cleanly)
    const activeMilestones = milestones.some(m => m.hasData)
      ? milestones.filter(m => m.hasData)
      : milestones;

    // Evaluate per-student trajectory across the exams in scope
    let improvedStudentsCount = 0;
    let declinedStudentsCount = 0;
    let stableStudentsCount = 0;

    const studentRows = students.map(s => {
      const marksMap: Record<string, number | null> = {};
      const validMarks: Array<{ id: string; label: string; val: number }> = [];

      examDefs.forEach(def => {
        const m = getStudentMark(s.id, def.key, def.sem);
        marksMap[def.id] = m;
        if (m !== null) {
          validMarks.push({ id: def.id, label: def.shortLabel, val: m });
        }
      });

      const firstMark = validMarks.length > 0 ? validMarks[0].val : null;
      const lastMark = validMarks.length > 0 ? validMarks[validMarks.length - 1].val : null;
      const avgMark =
        validMarks.length > 0
          ? parseFloat((validMarks.reduce((acc, item) => acc + item.val, 0) / validMarks.length).toFixed(2))
          : null;
      const delta =
        validMarks.length >= 2 && firstMark !== null && lastMark !== null
          ? parseFloat((lastMark - firstMark).toFixed(2))
          : null;

      let status: 'improving' | 'declining' | 'stable' | 'none' = 'none';
      if (delta !== null) {
        if (delta >= 0.5) {
          status = 'improving';
          improvedStudentsCount++;
        } else if (delta <= -0.5) {
          status = 'declining';
          declinedStudentsCount++;
        } else {
          status = 'stable';
          stableStudentsCount++;
        }
      }

      const startLevel = getMoroccanAppreciation(firstMark);
      const currentLevel = getMoroccanAppreciation(lastMark);

      return {
        id: s.id,
        name: s.name,
        massar: s.massar || '-',
        orderNum: s.orderNum,
        marksMap,
        firstMark,
        lastMark,
        avgMark,
        delta,
        status,
        startLevel,
        currentLevel
      };
    });

    // Pick 5 representative students for the Multi-Student Trajectory LineChart based on trajectoryGroupFilter
    const withMarks = studentRows.filter(r => r.avgMark !== null);
    let selectedTrajectoryStudents = [...withMarks];
    if (trajectoryGroupFilter === 'improvers') {
      selectedTrajectoryStudents.sort((a, b) => (b.delta ?? -99) - (a.delta ?? -99));
    } else if (trajectoryGroupFilter === 'decliners') {
      selectedTrajectoryStudents.sort((a, b) => (a.delta ?? 99) - (b.delta ?? 99));
    } else if (trajectoryGroupFilter === 'top5') {
      selectedTrajectoryStudents.sort((a, b) => (b.avgMark ?? 0) - (a.avgMark ?? 0));
    } else if (trajectoryGroupFilter === 'struggling') {
      selectedTrajectoryStudents.sort((a, b) => (a.avgMark ?? 99) - (b.avgMark ?? 99));
    }
    selectedTrajectoryStudents = selectedTrajectoryStudents.slice(0, 5);

    const trajectoryChartData = activeMilestones.map(ms => {
      const point: Record<string, any> = {
        name: ms.name,
        'معدل القسم': ms['معدل القسم'],
        'عتبة النجاح (10)': 10
      };
      selectedTrajectoryStudents.forEach(st => {
        point[st.name] = st.marksMap[ms.id];
      });
      return point;
    });

    const milestonesWithAvg = activeMilestones.filter(m => m['معدل القسم'] !== null);
    const firstExamAvg = milestonesWithAvg.length > 0 ? milestonesWithAvg[0]['معدل القسم'] : null;
    const lastExamAvg = milestonesWithAvg.length > 0 ? milestonesWithAvg[milestonesWithAvg.length - 1]['معدل القسم'] : null;
    const netAvgDelta =
      firstExamAvg !== null && lastExamAvg !== null ? parseFloat((lastExamAvg - firstExamAvg).toFixed(2)) : null;
    const latestMs = milestonesWithAvg.length > 0 ? milestonesWithAvg[milestonesWithAvg.length - 1] : null;

    return {
      examDefs,
      milestones: activeMilestones,
      studentRows,
      trajectoryChartData,
      selectedTrajectoryStudents,
      summary: {
        firstExamAvg,
        lastExamAvg,
        netAvgDelta,
        improvedStudentsCount,
        declinedStudentsCount,
        stableStudentsCount,
        latestPassRate: latestMs ? latestMs['نسبة التحكم (%)'] || 0 : 0,
        latestExcellenceCount: latestMs ? latestMs['فئة التميز (≥14)'] || 0 : 0
      }
    };
  }, [students, examKeys, evoScope, trajectoryGroupFilter, db, selectedClass]);

  // =========================================================================
  // NEW FEATURE 2 (Point 4): مؤشر الجاهزية للامتحان الوطني والجهوي (Bac Readiness Index)
  // =========================================================================
  const classBacReadinessAnalytics = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        list: [] as StudentBacReadinessData[],
        summary: {
          avgReadiness: 0,
          excellenceCount: 0,
          readyCount: 0,
          fragileCount: 0,
          atRiskCount: 0,
          total: 0
        }
      };
    }

    const list: StudentBacReadinessData[] = students.map(s => {
      // 1. Attendance & Homework Records
      let totalAbsenceHours = 0;
      let unjustifiedHours = 0;
      let justifiedHours = 0;
      let lateCount = 0;
      let missedHw = 0;
      let totalSessionsCount = 0;

      if (db && Array.isArray(db.records)) {
        db.records.forEach((r: any) => {
          if (r.studentId === s.id && r.className === selectedClass) {
            totalSessionsCount++;
            const dur = parseFloat(r.duration || r.hours) || 1;
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

      // 2. Exam Grades & Trajectory Slope across all available exams
      const s1Avg = getStudentOverallAvg(s.id, 's1');
      const s2Avg = getStudentOverallAvg(s.id, 's2');
      const annualAvg = getStudentOverallAvg(s.id, 'annual');

      const chronologicalMarks: number[] = [];
      examKeys.forEach(k => {
        const m1 = getStudentMark(s.id, k, 's1');
        if (m1 !== null) chronologicalMarks.push(m1);
      });
      examKeys.forEach(k => {
        const m2 = getStudentMark(s.id, k, 's2');
        if (m2 !== null) chronologicalMarks.push(m2);
      });

      const firstExamMark = chronologicalMarks.length > 0 ? chronologicalMarks[0] : null;
      const lastExamMark = chronologicalMarks.length > 0 ? chronologicalMarks[chronologicalMarks.length - 1] : null;
      const examSlope =
        chronologicalMarks.length >= 2 && firstExamMark !== null && lastExamMark !== null
          ? parseFloat((lastExamMark - firstExamMark).toFixed(2))
          : 0;

      // 3. Calculate Pillar 1: Grades & Progression Score (0 - 100%) [Weight: 50%]
      const baseGradePct = annualAvg !== null ? (annualAvg / 20) * 100 : 50;
      // Momentum adjustment: +2.5% per point of improvement, -3% per point of decline (capped at ±14%)
      const momentumAdj = Math.max(-14, Math.min(14, examSlope >= 0 ? examSlope * 2.5 : examSlope * 3.0));
      const gradesPillarScore = Math.round(Math.max(5, Math.min(100, baseGradePct + momentumAdj)));

      // 4. Calculate Pillar 2: Attendance & Discipline Score (0 - 100%) [Weight: 25%]
      const rawAttendancePenalty = unjustifiedHours * 4.5 + justifiedHours * 1.5 + lateCount * 1.5;
      const attendancePillarScore = Math.round(Math.max(0, Math.min(100, 100 - rawAttendancePenalty)));

      // 5. Calculate Pillar 3: Problem Sets & Homework Completion Score (0 - 100%) [Weight: 25%]
      const rawHwPenalty = missedHw * 14;
      const homeworkPillarScore = Math.round(Math.max(0, Math.min(100, 100 - rawHwPenalty)));

      // Composite Bac Readiness Index = 50% Grades/Progression + 25% Attendance + 25% Homework
      let composite = Math.round(
        gradesPillarScore * 0.50 + attendancePillarScore * 0.25 + homeworkPillarScore * 0.25
      );

      // Guardrail: If exam average is severely low (< 7/20), readiness cannot exceed 44% even with 100% attendance
      if (annualAvg !== null && annualAvg < 7 && composite > 44) {
        composite = 44;
      }
      // If exam average is < 10/20, readiness cannot exceed 54% (fragile threshold)
      if (annualAvg !== null && annualAvg < 10 && composite > 54) {
        composite = 54;
      }

      const readinessIndex = Math.max(5, Math.min(99, composite));

      let readinessStatus: 'excellence' | 'ready' | 'fragile' | 'at_risk' = 'ready';
      let readinessLabel = 'جاهزية مقبولة ومستقرة';
      let readinessColor = '#0284c7';
      let readinessBg = '#e0f2fe';
      let predictedBacRange = '11.00 - 13.75 / 20';
      let mathPrescription = 'تكثيف الاشتغال على المسائل التوليفية والامتحانات الإشهادية السابقة لتثبيت المنهجية.';

      if (readinessIndex >= 75) {
        readinessStatus = 'excellence';
        readinessLabel = 'جاهزية عالية للتميز الإشهادي';
        readinessColor = '#15803d';
        readinessBg = '#dcfce7';
        predictedBacRange = '14.50 - 19.50 / 20';
        mathPrescription = 'توجيه نحو مسائل التعمق والتحديات الرياضية (الأعداد العقدية، التكامل، والمسائل البارامترية).';
      } else if (readinessIndex >= 55) {
        readinessStatus = 'ready';
        readinessLabel = 'جاهزية مقبولة (تحكم مستقر)';
        readinessColor = '#0284c7';
        readinessBg = '#e0f2fe';
        predictedBacRange = '10.50 - 14.00 / 20';
        if (homeworkPillarScore < 75) {
          mathPrescription = 'تحصيل جيد في الفروض، لكن يلزم الانضباط التام في إنجاز سلاسل التمارين المنزلية لرفع سرعة الحل.';
        } else if (examSlope < 0) {
          mathPrescription = 'معالجة التراجع الطفيف في الفرض الأخير عبر مراجعة مركزة لوحدتي الدوال والمتتاليات.';
        }
      } else if (readinessIndex >= 40) {
        readinessStatus = 'fragile';
        readinessLabel = 'جاهزية هشة (إنذار مبكر)';
        readinessColor = '#d97706';
        readinessBg = '#fef3c7';
        predictedBacRange = '07.50 - 10.25 / 20';
        if (attendancePillarScore < 75) {
          mathPrescription = `الغياب المتكرر (${totalAbsenceHours}س) أحدث فجوات في تراكم المفاهيم؛ يلزم استدراك الدروس المفقودة فوراً.`;
        } else if (homeworkPillarScore < 75) {
          mathPrescription = `إهمال سلاسل التمارين (${missedHw} مرات) يضعف مهارة البرهان؛ إلزام التلميذ بحل تمارين تطبيقية متدرجة.`;
        } else {
          mathPrescription = 'إدماج في مجموعات الدعم الموجه للتركيز على الأسئلة الكلاسيكية المضمونة في الامتحان الإشهادي.';
        }
      } else {
        readinessStatus = 'at_risk';
        readinessLabel = 'خطر تعثر إشهادي حاد';
        readinessColor = '#dc2626';
        readinessBg = '#fee2e2';
        predictedBacRange = 'أقل من 07.50 / 20';
        mathPrescription = 'تدخل استدراكي عاجل: خطة دعم فردية في القواعد الأساسية (النهايات، الاشتقاق، حل المعادلات) + إشعار ولي الأمر.';
      }

      return {
        id: s.id,
        name: s.name,
        massar: s.massar || '-',
        orderNum: s.orderNum,
        s1Avg,
        s2Avg,
        annualAvg,
        firstExamMark,
        lastExamMark,
        examSlope,
        totalAbsenceHours,
        unjustifiedHours,
        lateCount,
        missedHw,
        totalSessionsCount,
        gradesPillarScore,
        attendancePillarScore,
        homeworkPillarScore,
        readinessIndex,
        readinessStatus,
        readinessLabel,
        readinessColor,
        readinessBg,
        predictedBacRange,
        mathPrescription
      };
    });

    const total = list.length;
    const avgReadiness =
      total > 0 ? Math.round(list.reduce((acc, item) => acc + item.readinessIndex, 0) / total) : 0;
    const excellenceCount = list.filter(i => i.readinessStatus === 'excellence').length;
    const readyCount = list.filter(i => i.readinessStatus === 'ready').length;
    const fragileCount = list.filter(i => i.readinessStatus === 'fragile').length;
    const atRiskCount = list.filter(i => i.readinessStatus === 'at_risk').length;

    return {
      list,
      summary: {
        avgReadiness,
        excellenceCount,
        readyCount,
        fragileCount,
        atRiskCount,
        total
      }
    };
  }, [students, selectedClass, db, examKeys]);

  const filteredBacReadinessList = useMemo(() => {
    let list = [...classBacReadinessAnalytics.list];
    if (bacFilterStatus !== 'all') {
      list = list.filter(item => item.readinessStatus === bacFilterStatus);
    }
    if (bacSearchQuery.trim()) {
      const q = bacSearchQuery.trim().toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(q) || item.massar.toLowerCase().includes(q));
    }
    if (bacSortBy === 'readiness_asc') {
      list.sort((a, b) => a.readinessIndex - b.readinessIndex);
    } else if (bacSortBy === 'readiness_desc') {
      list.sort((a, b) => b.readinessIndex - a.readinessIndex);
    } else if (bacSortBy === 'grades_asc') {
      list.sort((a, b) => (a.annualAvg ?? 99) - (b.annualAvg ?? 99));
    } else if (bacSortBy === 'hw_asc') {
      list.sort((a, b) => a.homeworkPillarScore - b.homeworkPillarScore);
    }
    return list;
  }, [classBacReadinessAnalytics.list, bacFilterStatus, bacSearchQuery, bacSortBy]);

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
      const delta = s1Avg !== null && s2Avg !== null ? parseFloat((s2Avg - s1Avg).toFixed(2)) : null;

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
    const delta = s1OverallAvg !== null && s2OverallAvg !== null ? parseFloat((s2OverallAvg - s1OverallAvg).toFixed(2)) : null;
    const deltaPercent = s1OverallAvg !== null && s2OverallAvg !== null && s1OverallAvg > 0 ? parseFloat((((s2OverallAvg - s1OverallAvg) / s1OverallAvg) * 100).toFixed(1)) : null;

    const s1PassCount = s1OverallList.filter(m => m >= 10).length;
    const s2PassCount = s2OverallList.filter(m => m >= 10).length;
    const s1PassRate = s1OverallList.length > 0 ? Math.round((s1PassCount / s1OverallList.length) * 100) : 0;
    const s2PassRate = s2OverallList.length > 0 ? Math.round((s2PassCount / s2OverallList.length) * 100) : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (delta !== null) {
      if (delta > 0.2) trend = 'improving';
      else if (delta < -0.2) trend = 'declining';
    }

    if (s1OverallAvg !== null || s2OverallAvg !== null) {
      examData.push({
        key: 'overall',
        name: 'المعدل العام للأسدس',
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
      annualOverallAvg: s1OverallAvg !== null && s2OverallAvg !== null ? parseFloat(((s1OverallAvg + s2OverallAvg) / 2).toFixed(2)) : (s1OverallAvg ?? s2OverallAvg),
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
      const clsStudents: Student[] = Array.isArray(clsRaw) ? clsRaw : clsRaw?.students || [];

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
      const delta = s1Avg !== null && s2Avg !== null ? parseFloat((s2Avg - s1Avg).toFixed(2)) : null;

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
      const delta = stdMark !== null && cStat.avg !== null ? parseFloat((stdMark - cStat.avg).toFixed(2)) : null;

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

    const stdOverall = getStudentOverallAvg(currentStudent.id, semester);
    const classOverallStat = classExamStats['overall'] || { avg: null, max: null, min: null };
    const overallDelta =
      stdOverall !== null && classOverallStat.avg !== null ? parseFloat((stdOverall - classOverallStat.avg).toFixed(2)) : null;

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
    const averagesList = students
      .map(s => ({
        id: s.id,
        avg: getStudentOverallAvg(s.id, semester)
      }))
      .filter(item => item.avg !== null);

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
      text:
        diff > 0
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

    const data = students
      .map(s => {
        const avg = getStudentOverallAvg(s.id, semester);
        return {
          id: s.id,
          name: s.name,
          'معدل التلميذ': avg,
          'معدل القسم': classOverall,
          'عتبة النجاح': 10
        };
      })
      .filter(d => d['معدل التلميذ'] !== null);

    data.sort((a, b) => (b['معدل التلميذ'] as number) - (a['معدل التلميذ'] as number));
    return data;
  }, [students, semester, classExamStats]);

  // Failure Probability Index
  const classFailureRiskList: StudentFailureRiskData[] = useMemo(() => {
    if (!students || students.length === 0) return [];

    return students.map(s => {
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

      let academicBaseRisk = 45;
      if (annualAvg !== null) {
        if (annualAvg >= 16) academicBaseRisk = 3;
        else if (annualAvg >= 14) academicBaseRisk = 8;
        else if (annualAvg >= 12) academicBaseRisk = 16;
        else if (annualAvg >= 10) academicBaseRisk = 30 - (annualAvg - 10) * 7;
        else if (annualAvg >= 8) academicBaseRisk = 56 - (annualAvg - 8) * 13;
        else if (annualAvg >= 5) academicBaseRisk = 78 - (annualAvg - 5) * 7.3;
        else academicBaseRisk = 80 + (5 - annualAvg) * 2.8;
      }

      let absenceImpact = unjustifiedHours * 2.5 + justifiedHours * 1.2;
      if (totalAbsenceHours >= 8) absenceImpact += 8;
      if (totalAbsenceHours >= 16) absenceImpact += 14;

      let trajectoryImpact = 0;
      if (deltaTrajectory !== null) {
        if (deltaTrajectory < -2.5) trajectoryImpact = 18;
        else if (deltaTrajectory < -0.5) trajectoryImpact = Math.abs(deltaTrajectory) * 4.5;
        else if (deltaTrajectory > 2.0) trajectoryImpact = -14;
        else if (deltaTrajectory > 0.5) trajectoryImpact = -(deltaTrajectory * 3.5);
      }

      const behaviorImpact = Math.min(10, missedHw * 1.5) + Math.min(5, lateCount * 0.5);

      let rawRisk = academicBaseRisk + absenceImpact + trajectoryImpact + behaviorImpact;

      if (totalAbsenceHours >= 10 && rawRisk < 45) rawRisk = 45;
      if (annualAvg !== null && annualAvg < 10 && rawRisk < 52) {
        rawRisk = Math.max(rawRisk, 52 + (10 - annualAvg) * 4);
      }

      const failureRiskScore = Math.max(3, Math.min(98, Math.round(rawRisk)));

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
    const avgRisk = Math.round(classFailureRiskList.reduce((acc, s) => acc + s.failureRiskScore, 0) / total);

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

  const filteredSortedRiskList = useMemo(() => {
    let list = [...classFailureRiskList];

    if (riskSearchQuery.trim()) {
      const q = riskSearchQuery.trim().toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.massar.toLowerCase().includes(q));
    }

    if (riskFilterLevel === 'critical') {
      list = list.filter(s => s.riskLevel === 'critical');
    } else if (riskFilterLevel === 'high') {
      list = list.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical');
    } else if (riskFilterLevel === 'declining') {
      list = list.filter(s => s.trajectoryDirection === 'declining');
    }

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
      link.download = `منحنى_تطور_الفروض_ومؤشر_الجاهزية_${selectedClass}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Official Print Report Handler with Official Footer
  const handlePrintOfficialEvolutionReport = () => {
    const certInfo = detectClassCertificationTarget(selectedClass);
    const milestones = classExamLevelsEvolution.milestones;
    const bacRows = filteredBacReadinessList;

    const milestonesTableRows = milestones
      .map(
        m => `
        <tr>
          <td style="border:1px solid #334155;padding:6px;font-weight:bold;">${m.name}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;font-weight:900;color:#1d4ed8;">${m['معدل القسم'] ?? '—'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${m['الوسيط الحسابي'] ?? '—'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;color:#15803d;font-weight:bold;">${m['أعلى نقطة'] ?? '—'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;color:#dc2626;font-weight:bold;">${m['أدنى نقطة'] ?? '—'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;font-weight:bold;">${m['نسبة التحكم (%)'] !== null ? `${m['نسبة التحكم (%)']}%` : '—'}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${m['فئة التميز (≥14)']}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${m['فئة التحكم (10-13.99)']}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${m['فئة الهشاشة (8-9.99)']}</td>
          <td style="border:1px solid #334155;padding:6px;text-align:center;">${m['فئة التعثر (<8)']}</td>
        </tr>
      `
      )
      .join('');

    const bacTableRows = bacRows
      .slice(0, 40)
      .map(
        (r, i) => `
        <tr>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${i + 1}</td>
          <td style="border:1px solid #334155;padding:5px;font-weight:bold;">${r.name}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${r.annualAvg ?? '—'} / 20</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${r.gradesPillarScore}%</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${r.attendancePillarScore}% (${r.totalAbsenceHours}س)</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${r.homeworkPillarScore}%</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:900;color:${r.readinessColor};">${r.readinessIndex}%</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:bold;color:${r.readinessColor};">${r.readinessLabel}</td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <div style="font-family:'Cairo',sans-serif;direction:rtl;color:#0f172a;padding:10px;">
        <div style="border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;font-size:11px;">
          <div style="line-height:1.5;font-weight:700;">
            <div>المملكة المغربية</div>
            <div>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            <div>السلك الثانوي التأهيلي • مادة الرياضيات</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:16px;font-weight:900;color:#1e3a8a;">تقرير تطور مستويات الفروض المحروسة ومؤشر الجاهزية الإشهادية</div>
            <div style="font-size:12px;font-weight:800;color:#0f766e;margin-top:2px;">القسم: ${selectedClass} (${certInfo.badge})</div>
          </div>
          <div style="text-align:left;line-height:1.5;font-weight:700;">
            <div>الأستاذ: إبراهيم قزيبر</div>
            <div>المادة: الرياضيات</div>
            <div>عدد التلاميذ: ${students.length}</div>
          </div>
        </div>

        <h4 style="margin:8px 0 6px 0;font-size:13px;color:#1e3a8a;">1. جدول تطور مستويات التلاميذ عبر الفروض المحروسة (${selectedClass}):</h4>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px;">
          <thead>
            <tr style="background:#f1f5f9;font-weight:900;">
              <th style="border:1px solid #1e293b;padding:6px;">الفرض المحروس</th>
              <th style="border:1px solid #1e293b;padding:6px;">معدل القسم</th>
              <th style="border:1px solid #1e293b;padding:6px;">الوسيط</th>
              <th style="border:1px solid #1e293b;padding:6px;">أعلى نقطة</th>
              <th style="border:1px solid #1e293b;padding:6px;">أدنى نقطة</th>
              <th style="border:1px solid #1e293b;padding:6px;">نسبة التحكم (≥10)</th>
              <th style="border:1px solid #1e293b;padding:6px;">التميز (≥14)</th>
              <th style="border:1px solid #1e293b;padding:6px;">التحكم (10-13.99)</th>
              <th style="border:1px solid #1e293b;padding:6px;">الهشاشة (8-9.99)</th>
              <th style="border:1px solid #1e293b;padding:6px;">التعثر (&lt;8)</th>
            </tr>
          </thead>
          <tbody>${milestonesTableRows}</tbody>
        </table>

        <h4 style="margin:10px 0 6px 0;font-size:13px;color:#0f766e;">2. كشف مؤشر الجاهزية للامتحان الوطني والجهوي (Bac Readiness Index - متوسط القسم: ${classBacReadinessAnalytics.summary.avgReadiness}%):</h4>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f0fdfa;font-weight:900;">
              <th style="border:1px solid #1e293b;padding:5px;width:26px;">#</th>
              <th style="border:1px solid #1e293b;padding:5px;text-align:right;">اسم التلميذ(ة)</th>
              <th style="border:1px solid #1e293b;padding:5px;">معدل الفروض</th>
              <th style="border:1px solid #1e293b;padding:5px;">كفاية الفروض (50%)</th>
              <th style="border:1px solid #1e293b;padding:5px;">المواظبة (25%)</th>
              <th style="border:1px solid #1e293b;padding:5px;">سلاسل التمارين (25%)</th>
              <th style="border:1px solid #1e293b;padding:5px;">مؤشر الجاهزية</th>
              <th style="border:1px solid #1e293b;padding:5px;">التصنيف الإشهادي</th>
            </tr>
          </thead>
          <tbody>${bacTableRows}</tbody>
        </table>

        <div style="margin-top:18px;padding-top:8px;border-top:1.5px solid #cbd5e1;text-align:center;font-size:11px;font-weight:800;color:#1e3a8a;">
          منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر
        </div>
      </div>
    `;

    if (typeof (window as any).openCustomPrintPreviewModal === 'function') {
      (window as any).openCustomPrintPreviewModal(htmlContent, {
        title: `تطور_الفروض_ومؤشر_الجاهزية_${selectedClass}`,
        orientation: 'portrait',
        subtitle: `تقرير تطور مستويات الفروض المحروسة ومؤشر الجاهزية الإشهادية (${selectedClass})`
      });
    } else {
      window.print();
    }
  };

  // Send WhatsApp for Bac Readiness
  const handleSendBacReadinessWhatsApp = (student: StudentBacReadinessData) => {
    const certInfo = detectClassCertificationTarget(selectedClass);
    const text = encodeURIComponent(
      `السلام عليكم ورحمة الله، ولي أمر التلميذ(ة) *${student.name}* (القسم: ${selectedClass}).\n\n` +
        `في إطار التتبع التربوي الاستباقي لـ *${certInfo.badge}* في مادة الرياضيات، نحيطكم علماً بملخص مؤشر الجاهزية الإشهادية لابنكم/ابنتكم:\n` +
        `• *مؤشر الجاهزية التركيبي:* ${student.readinessIndex}% (${student.readinessLabel})\n` +
        `• *معدل الفروض المحروسة:* ${student.annualAvg !== null ? `${student.annualAvg} / 20` : 'قيد الرصد'} (كفاية الفروض: ${student.gradesPillarScore}%)\n` +
        `• *نسبة المواظبة والحضور:* ${student.attendancePillarScore}% (مجموع الغياب: ${student.totalAbsenceHours} ساعة)\n` +
        `• *الالتزام بسلاسل التمارين المنزلية:* ${student.homeworkPillarScore}%\n\n` +
        `📌 *التوجيه البيداغوجي الموصى به:* ${student.mathPrescription}\n\n` +
        `مع تحيات: منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر`
    );
    openWhatsAppSafely(`https://wa.me/?text=${text}`);
  };

  // إرسال تنبيه واستدعاء واتساب لولي أمر التلميذ (Risk Index)
  const handleSendRiskWhatsApp = (student: StudentFailureRiskData) => {
    const text = encodeURIComponent(
      `السلام عليكم ورحمة الله، ولي أمر التلميذ(ة) ${student.name} (${selectedClass}).\n` +
        `نحيطكم علماً بأن المنظومة البيداغوجية لمادة الرياضيات قد رصدت مؤشر خطورة تعثر دراسي (${student.failureRiskScore}%) ناتج عن:\n` +
        `- تسجيل (${student.totalAbsenceHours} ساعة غياب تراكمية منها ${student.unjustifiedHours}س غير مبررة).\n` +
        `- معدل الفروض المحروسة: ${student.annualAvg !== null ? `${student.annualAvg} / 20` : 'دون المعدل'}.\n` +
        (student.deltaTrajectory !== null && student.deltaTrajectory < 0
          ? `- تراجع النتيجة بين الدورتين بمقدار (${student.deltaTrajectory} نقطة).\n`
          : '') +
        `نهيب بكم الحضور للمؤسسة للتواصل مع الأستاذ وتدارك الأمر لضمان نجاح التلميذ.\n- منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر`
    );
    openWhatsAppSafely(`https://wa.me/?text=${text}`);
  };

  const handleEnrollInTutoring = (student: { id: string; name: string }) => {
    if (typeof (window as any).addStudentToTutoringDirect === 'function') {
      (window as any).addStudentToTutoringDirect(selectedClass, student.id);
    }
  };

  const handleOpenPortfolio = (student: { id: string }) => {
    if (typeof (window as any).openStudentDigitalPortfolio === 'function') {
      (window as any).openStudentDigitalPortfolio(selectedClass, student.id);
    }
  };

  const handleOpenAiCompare = (student: { id: string }) => {
    if (typeof (window as any).openStudentAiComparativeModal === 'function') {
      (window as any).openStudentAiComparativeModal(selectedClass, student.id);
    } else if (typeof (window as any).switchTab === 'function') {
      (window as any).switchTab('annual');
      setTimeout(() => {
        if (typeof (window as any).openStudentAiComparativeModal === 'function') {
          (window as any).openStudentAiComparativeModal(selectedClass, student.id);
        }
      }, 300);
    }
  };

  // If no database or no classes
  if (!db || !db.classes || Object.keys(db.classes).length === 0) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center shadow-sm" dir="rtl">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">لا توجد أقسام مسجلة حتى الآن</h3>
        <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm">
          يرجى استيراد أو إضافة لائحة التلاميذ والأقسام أولاً لتفعيل المنحنى البياني للفروض المحروسة ومؤشر الجاهزية الإشهادية.
        </p>
      </div>
    );
  }

  const classNames = Object.keys(db.classes);
  const studentOverallAvg = currentStudent ? getStudentOverallAvg(currentStudent.id, semester) : null;
  const classOverallAvg = classExamStats['overall']?.avg ?? null;
  const studentAppreciation = getMoroccanAppreciation(studentOverallAvg);
  const deltaOverall =
    studentOverallAvg !== null && classOverallAvg !== null ? parseFloat((studentOverallAvg - classOverallAvg).toFixed(2)) : null;
  const certTargetInfo = detectClassCertificationTarget(selectedClass);

  // Filtered rows for exam_levels_evolution table
  const filteredEvoStudentRows = classExamLevelsEvolution.studentRows.filter(r => {
    if (!evoTableSearch.trim()) return true;
    const q = evoTableSearch.trim().toLowerCase();
    return r.name.toLowerCase().includes(q) || r.massar.toLowerCase().includes(q);
  });

  // Custom Tooltip for Individual Evolution Chart
  const CustomIndividualTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const studentVal = payload.find((p: any) => p.dataKey === 'نقطة التلميذ')?.value;
      const classVal = payload.find((p: any) => p.dataKey === 'معدل القسم')?.value;
      const maxVal = payload.find((p: any) => p.dataKey === 'أعلى نقطة بالقسم')?.value;
      const minVal = payload.find((p: any) => p.dataKey === 'أدنى نقطة بالقسم')?.value;
      const diff =
        studentVal !== undefined && classVal !== undefined && studentVal !== null && classVal !== null
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
            <div className="flex justify-between items-center text-indigo-950 font-bold bg-indigo-50/90 border border-indigo-200/70 px-2.5 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#312e81] ring-2 ring-[#fbbf24] inline-block"></span>
                نقطة التلميذ (النيلي):
              </span>
              <span className="text-sm font-extrabold font-mono text-[#312e81]">
                {studentVal !== null && studentVal !== undefined ? `${studentVal} / 20` : 'غير مدخل'}
              </span>
            </div>

            <div className="flex justify-between items-center text-amber-900 font-semibold bg-amber-50/80 border border-amber-200/70 px-2.5 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#d97706] inline-block"></span>
                معدل القسم (الذهبي):
              </span>
              <span className="font-bold font-mono text-[#b45309]">
                {classVal !== null && classVal !== undefined ? `${classVal} / 20` : 'غير متاح'}
              </span>
            </div>

            {diff !== null && (
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 px-2">
                <span className="text-slate-600">الفارق عن القسم:</span>
                <span className={`font-extrabold flex items-center gap-0.5 ${diff >= 0 ? 'text-[#312e81]' : 'text-rose-600'}`}>
                  {diff >= 0 ? `+${diff} نقطة (تفوق)` : `${diff} نقطة (دون المعدل)`}
                </span>
              </div>
            )}

            {showMinMaxRange && maxVal !== undefined && minVal !== undefined && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between px-2">
                <span>
                  أعلى: <b className="text-[#4338ca]">{maxVal}</b>
                </span>
                <span>
                  أدنى: <b className="text-[#92400e]">{minVal}</b>
                </span>
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
              <strong className="text-rose-600 font-bold">
                {data.totalAbsenceHours} ساعة ({data.unjustifiedHours}س غير مبرر)
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">معدل الفروض السنوي:</span>
              <strong className={data.annualAvg !== null && data.annualAvg >= 10 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                {data.annualAvg !== null ? `${data.annualAvg} / 20` : 'غير مسجل'}
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">مسار التطور (S1 ➔ S2):</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  data.deltaTrajectory === null
                    ? 'text-slate-400'
                    : data.deltaTrajectory > 0
                    ? 'text-emerald-600'
                    : data.deltaTrajectory < 0
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {data.s1Avg ?? '-'} ➔ {data.s2Avg ?? '-'}
                {data.deltaTrajectory !== null && (
                  <span>({data.deltaTrajectory >= 0 ? `+${data.deltaTrajectory}` : data.deltaTrajectory})</span>
                )}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded-lg text-[11px]">
              <div className="font-bold text-slate-800 mb-1">التشخيص:</div>
              <div className="text-slate-600 leading-relaxed">{data.primaryFactor}</div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Indigo & Gold trajectory palette for multi-student evolution curves
  const trajectoryColors = [
    INDIGO_GOLD_THEME.indigoRoyal,   // #312e81 - النيلي الملكي الغامق
    INDIGO_GOLD_THEME.goldPrimary,   // #d97706 - الذهبي الكهرماني الأصيل
    INDIGO_GOLD_THEME.indigoMedium,  // #4f46e5 - النيلي الساطع
    INDIGO_GOLD_THEME.goldRich,      // #b45309 - الذهبي البرونزي الدافئ
    INDIGO_GOLD_THEME.indigoSoft     // #6366f1 - النيلي المتوسط
  ];

  return (
    <div className="space-y-5" dir="rtl" ref={containerRef}>
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-900/15">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-md">
              {viewMode === 'bac_readiness' ? (
                <Target className="w-6 h-6 text-amber-300" />
              ) : viewMode === 'exam_levels_evolution' ? (
                <TrendingUp className="w-6 h-6 text-amber-300" />
              ) : viewMode === 'class_progression' ? (
                <Activity className="w-6 h-6 text-amber-300" />
              ) : viewMode === 'failure_risk' ? (
                <ShieldAlert className="w-6 h-6 text-amber-300" />
              ) : (
                <TrendingUp className="w-6 h-6 text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-[#1e1b4b]">
                  {viewMode === 'exam_levels_evolution'
                    ? `منحنى تطور مستويات التلاميذ في الفروض المحروسة (${selectedClass})`
                    : viewMode === 'bac_readiness'
                    ? `${certTargetInfo.examTitle} (${selectedClass})`
                    : viewMode === 'class_progression'
                    ? 'تحليل تطور معدلات الأقسام عبر الفروض ومقارنة الأسدسين (Recharts)'
                    : viewMode === 'failure_risk'
                    ? 'رسم مؤشر احتمالية التعثر والربط التلقائي بالغياب وتطور الفروض'
                    : 'منحنى تطور معدلات المراقبة المستمرة مقارنة بمعدل القسم'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r from-[#312e81] to-[#4338ca] text-amber-200 border border-amber-400/40 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#fbbf24]"></span>
                  <span>الهوية البصرية: النيلي والذهبي</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                <span>القسم النشط: <strong className="text-[#312e81]">{selectedClass}</strong></span>
                <span aria-hidden="true">·</span>
                <span>عدد التلاميذ: <strong className="text-slate-800">{students.length}</strong></span>
                <span aria-hidden="true">·</span>
                <span className="text-[#b45309] font-semibold">{certTargetInfo.badge}</span>
                <span aria-hidden="true">·</span>
                <span>{certTargetInfo.coefLabel}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Image Export & Official Print */}
          <div className="flex items-center gap-2.5 self-end lg:self-center flex-wrap">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50/50 text-[#312e81] shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="تصدير المنحنى والبطاقة كصورة PNG عالية الدقة"
            >
              <Download className="w-4 h-4 text-[#d97706]" />
              <span>{isExporting ? 'جاري التصدير...' : 'تصدير كصورة'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintOfficialEvolutionReport}
              className="px-3.5 py-2 text-xs font-bold rounded-lg border border-amber-300/80 bg-gradient-to-r from-[#312e81] to-[#3730a3] hover:from-[#1e1b4b] hover:to-[#312e81] text-amber-100 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              title="طباعة التقرير الرسمي لتطور الفروض ومؤشر الجاهزية (A4)"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>طباعة التقرير الرسمي (A4)</span>
            </button>

            <button
              type="button"
              onClick={loadDb}
              className="p-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4 text-[#312e81]" />
            </button>
          </div>
        </div>

        {/* Interactive Class Switcher Bar (لكل قسم على حدة) */}
        <div className="pt-3 pb-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-[#1e1b4b] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#d97706]" />
              <span>اختيار القسم لعرض منحناه البياني على حدة:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap bg-indigo-50/60 p-1 rounded-xl border border-indigo-100">
              {classNames.map(cls => {
                const count = Array.isArray(db.classes[cls]) ? db.classes[cls].length : db.classes[cls]?.students?.length || 0;
                const isActive = selectedClass === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => handleSelectClassChange(cls)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#312e81] text-amber-200 border border-amber-400/50 shadow-sm'
                        : 'text-slate-700 hover:bg-white hover:text-[#312e81]'
                    }`}
                  >
                    {cls} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* View Mode Switching Tabs */}
        <div className="flex gap-2 pt-3 pb-1 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('exam_levels_evolution')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'exam_levels_evolution'
                ? 'bg-[#312e81] text-amber-200 border border-amber-400/40 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-[#312e81]'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>منحنى تطور مستويات الفروض المحروسة للقسم (Recharts)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('bac_readiness')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'bac_readiness'
                ? 'bg-[#b45309] text-white border border-amber-300 shadow-sm'
                : 'bg-amber-50/80 text-[#92400e] hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>مؤشر الجاهزية للامتحان الوطني والجهوي (Bac Readiness)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'individual'
                ? 'bg-[#3730a3] text-amber-200 border border-amber-400/40 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-[#312e81]'
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>منحنى التلميذ الفردي</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('class_all')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'class_all'
                ? 'bg-[#4338ca] text-amber-200 border border-amber-400/40 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-[#312e81]'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>توزيع معدلات القسم</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('class_progression')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'class_progression'
                ? 'bg-[#312e81] text-amber-200 border border-amber-400/40 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-[#312e81]'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>مقارنة الأسدسين (S1 vs S2)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('failure_risk')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'failure_risk'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            <span>مؤشر احتمالية التعثر ({classRiskSummary.criticalCount})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW MODE 1: منحنى تطور مستويات التلاميذ في الفروض المحروسة لكل قسم على حدة */}
      {/* ========================================================================= */}
      {viewMode === 'exam_levels_evolution' && (
        <div className="space-y-5">
          {/* Sub-controls Bar */}
          <div className="bg-white rounded-2xl p-4 border border-indigo-900/15 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Scope Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1e1b4b]">نطاق الفروض المحروسة:</span>
              <div className="flex bg-indigo-50/60 p-1 rounded-lg border border-indigo-100">
                <button
                  type="button"
                  onClick={() => setEvoScope('annual_all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoScope === 'annual_all' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-600 hover:text-[#312e81]'
                  }`}
                >
                  المسار السنوي الكامل (فروض د1 + د2)
                </button>
                <button
                  type="button"
                  onClick={() => setEvoScope('s1')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoScope === 's1' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-600 hover:text-[#312e81]'
                  }`}
                >
                  فروض الأسدس الأول (S1)
                </button>
                <button
                  type="button"
                  onClick={() => setEvoScope('s2')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoScope === 's2' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-600 hover:text-[#312e81]'
                  }`}
                >
                  فروض الأسدس الثاني (S2)
                </button>
              </div>
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1e1b4b]">نمط المنحنى البياني (النيلي والذهبي):</span>
              <div className="flex bg-amber-50/70 p-1 rounded-lg border border-amber-200/70">
                <button
                  type="button"
                  onClick={() => setEvoSubChart('levels_curve')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoSubChart === 'levels_curve' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-700 hover:text-[#312e81]'
                  }`}
                >
                  تطور فئات المستويات ومعدل القسم
                </button>
                <button
                  type="button"
                  onClick={() => setEvoSubChart('stats_curve')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoSubChart === 'stats_curve' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-700 hover:text-[#312e81]'
                  }`}
                >
                  منحنى المعدل والوسيط والمدى
                </button>
                <button
                  type="button"
                  onClick={() => setEvoSubChart('trajectories_curve')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    evoSubChart === 'trajectories_curve' ? 'bg-[#312e81] text-amber-200 shadow-sm' : 'text-slate-700 hover:text-[#312e81]'
                  }`}
                >
                  منحنيات مسارات التلاميذ عبر الفروض
                </button>
              </div>
            </div>
          </div>

          {/* KPI Strip for Class Exam Evolution (Indigo & Gold accented) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-xs">
              <div className="text-xs font-bold text-[#312e81]">تطور معدل القسم عبر الفروض</div>
              <div className="text-xl font-black text-[#1e1b4b] font-mono mt-1">
                {classExamLevelsEvolution.summary.firstExamAvg ?? '—'} ➔ {classExamLevelsEvolution.summary.lastExamAvg ?? '—'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                الفارق الصافي:{' '}
                <strong
                  className={
                    (classExamLevelsEvolution.summary.netAvgDelta ?? 0) >= 0 ? 'text-[#d97706]' : 'text-rose-600'
                  }
                >
                  {classExamLevelsEvolution.summary.netAvgDelta !== null
                    ? `${classExamLevelsEvolution.summary.netAvgDelta >= 0 ? '+' : ''}${classExamLevelsEvolution.summary.netAvgDelta} نقطة`
                    : 'قيد الرصد'}
                </strong>
              </div>
            </div>

            <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/80 shadow-xs">
              <div className="text-xs font-bold text-[#b45309]">تلاميذ في مسار تصاعدي (تحسن)</div>
              <div className="text-xl font-black text-[#d97706] font-mono mt-1">
                {classExamLevelsEvolution.summary.improvedStudentsCount}{' '}
                <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">تحسن بمقدار +0.5 نقطة فأكثر بين الفروض</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-rose-700">تلاميذ في مسار تنازلي (تراجع)</div>
              <div className="text-xl font-black text-rose-600 font-mono mt-1">
                {classExamLevelsEvolution.summary.declinedStudentsCount}{' '}
                <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">يحتاجون لدعم فوري قبل الفرض الموالي</div>
            </div>

            <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200/80 shadow-xs">
              <div className="text-xs font-bold text-[#312e81]">نسبة التحكم في آخر فرض مرصود</div>
              <div className="text-xl font-black text-[#312e81] font-mono mt-1">
                {classExamLevelsEvolution.summary.latestPassRate}%
              </div>
              <div className="text-[11px] text-slate-600 mt-1">
                فئة التميز الذهبي (≥14): <strong className="text-[#b45309]">{classExamLevelsEvolution.summary.latestExcellenceCount} تلميذ</strong>
              </div>
            </div>
          </div>

          {/* Recharts Visualization Card */}
          <div className="bg-white rounded-2xl p-5 border border-indigo-900/15 shadow-sm">
            {evoSubChart === 'levels_curve' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-[#1e1b4b] flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-[#d97706]" />
                      <span>منحنى تطور مستويات التلاميذ ومعدل التحصيل عبر الفروض المحروسة ({selectedClass})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يوضح تطور أعداد التلاميذ في كل مستوى معياري مع منحنى معدل القسم (بالنيلي الملكي) ومنحنى الوسيط الحسابي (بالذهبي الكهرماني).
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="flex items-center gap-1.5 text-[#312e81]">
                      <span className="w-3 h-3 rounded-full bg-[#312e81] ring-2 ring-[#fbbf24] inline-block"></span>
                      منحنى المعدل (نيلي)
                    </span>
                    <span className="flex items-center gap-1.5 text-[#b45309]">
                      <span className="w-3 h-3 rounded-full bg-[#d97706] inline-block"></span>
                      منحنى الوسيط والتميز (ذهبي)
                    </span>
                  </div>
                </div>

                <div className="w-full h-96" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={classExamLevelsEvolution.milestones}
                      margin={{ top: 20, right: 25, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="goldExcellenceBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#b45309" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="indigoMasteryBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#312e81" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="amberFragileBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.75} />
                        </linearGradient>
                        <linearGradient id="indigoStrugglingBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#475569" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }}
                        axisLine={{ stroke: '#c7d2fe' }}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fill: '#312e81', fontSize: 11 }}
                        label={{
                          value: 'عدد التلاميذ في كل مستوى',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#312e81',
                          fontSize: 11,
                          fontWeight: 'bold'
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 20]}
                        ticks={[0, 5, 10, 15, 20]}
                        tick={{ fill: '#b45309', fontSize: 11, fontWeight: 700 }}
                        label={{
                          value: 'المعدل والوسيط (/20)',
                          angle: 90,
                          position: 'insideRight',
                          fill: '#b45309',
                          fontSize: 11,
                          fontWeight: 'bold'
                        }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white/98 p-3.5 rounded-xl shadow-xl border border-indigo-200 text-right text-xs min-w-[245px]" dir="rtl">
                                <div className="font-black text-[#1e1b4b] border-b border-indigo-100 pb-1.5 mb-2 flex justify-between items-center">
                                  <span>{label}</span>
                                  <span className="text-[#312e81] bg-indigo-50 px-2 py-0.5 rounded font-mono">
                                    المعدل: {d['معدل القسم'] ?? '—'} / 20
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[#b45309] font-bold">
                                    <span>فئة التميز الذهبي (≥ 14/20):</span>
                                    <span>{d['فئة التميز (≥14)']} تلميذ</span>
                                  </div>
                                  <div className="flex justify-between text-[#312e81] font-bold">
                                    <span>فئة التحكم النيلي (10 - 13.99):</span>
                                    <span>{d['فئة التحكم (10-13.99)']} تلميذ</span>
                                  </div>
                                  <div className="flex justify-between text-[#d97706] font-bold">
                                    <span>فئة الهشاشة (8 - 9.99):</span>
                                    <span>{d['فئة الهشاشة (8-9.99)']} تلميذ</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600 font-bold">
                                    <span>فئة التعثر (&lt; 8/20):</span>
                                    <span>{d['فئة التعثر (<8)']} تلميذ</span>
                                  </div>
                                  <div className="pt-1.5 mt-1 border-t border-slate-100 flex justify-between font-extrabold text-[#1e1b4b]">
                                    <span>الوسيط الحسابي:</span>
                                    <span className="text-[#d97706] font-mono">{d['الوسيط الحسابي'] ?? '—'} / 20</span>
                                  </div>
                                  <div className="flex justify-between font-extrabold text-[#1e1b4b]">
                                    <span>نسبة التحكم الكلية (≥10):</span>
                                    <span className="text-[#312e81] font-mono">{d['نسبة التحكم (%)'] ?? 0}%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={38} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <ReferenceLine yAxisId="right" y={10} stroke="#d97706" strokeDasharray="5 4" strokeWidth={1.8} />
                      <Bar yAxisId="left" dataKey="فئة التميز (≥14)" fill="url(#goldExcellenceBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="left" dataKey="فئة التحكم (10-13.99)" fill="url(#indigoMasteryBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="left" dataKey="فئة الهشاشة (8-9.99)" fill="url(#amberFragileBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar yAxisId="left" dataKey="فئة التعثر (<8)" fill="url(#indigoStrugglingBarGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="الوسيط الحسابي"
                        stroke="#d97706"
                        strokeWidth={3}
                        strokeDasharray="6 3"
                        dot={{ r: 5, fill: '#d97706', stroke: '#fffbeb', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#fbbf24', stroke: '#78350f', strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="معدل القسم"
                        stroke="#312e81"
                        strokeWidth={4}
                        dot={{ r: 6.5, fill: '#312e81', stroke: '#fbbf24', strokeWidth: 2.5 }}
                        activeDot={{ r: 8.5, fill: '#fbbf24', stroke: '#312e81', strokeWidth: 2.5 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {evoSubChart === 'stats_curve' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-[#1e1b4b] flex items-center gap-2">
                      <Activity className="w-5 h-5 text-[#312e81]" />
                      <span>منحنى تطور المعدل والوسيط الحسابي والمدى عبر الفروض المحروسة ({selectedClass})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      مقارنة تطور المعدل الحسابي (المنحنى النيلي الملكي) والوسيط الحسابي (المنحنى الذهبي) وأعلى/أدنى نقطة مسجلة في كل فرض محروس.
                    </p>
                  </div>
                </div>

                <div className="w-full h-96" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={classExamLevelsEvolution.milestones}
                      margin={{ top: 20, right: 25, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="indigoPrimaryCurveFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#312e81" stopOpacity={0.38} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="goldSecondaryCurveFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.03} />
                        </linearGradient>
                        <linearGradient id="indigoUpperBoundFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }} />
                      <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} label={{ value: 'عتبة التحكم 10/20', fill: '#b45309', fontSize: 11, fontWeight: 'bold' }} />
                      <Area
                        type="monotone"
                        dataKey="أعلى نقطة"
                        stroke="#4f46e5"
                        fill="url(#indigoUpperBoundFill)"
                        strokeWidth={2.2}
                        dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 1.5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="معدل القسم"
                        stroke="#312e81"
                        fill="url(#indigoPrimaryCurveFill)"
                        strokeWidth={3.8}
                        dot={{ r: 6, fill: '#312e81', stroke: '#fbbf24', strokeWidth: 2.5 }}
                        activeDot={{ r: 8, fill: '#fbbf24', stroke: '#312e81', strokeWidth: 2.5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="الوسيط الحسابي"
                        stroke="#d97706"
                        fill="url(#goldSecondaryCurveFill)"
                        strokeWidth={3.2}
                        dot={{ r: 5, fill: '#d97706', stroke: '#fffbeb', strokeWidth: 2 }}
                        activeDot={{ r: 7, fill: '#f59e0b', stroke: '#312e81', strokeWidth: 2 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="أدنى نقطة"
                        stroke="#92400e"
                        fill="none"
                        strokeDasharray="4 3"
                        strokeWidth={2.2}
                        dot={{ r: 3.5, fill: '#92400e', stroke: '#fef3c7', strokeWidth: 1.5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {evoSubChart === 'trajectories_curve' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-[#1e1b4b] flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#d97706]" />
                      <span>منحنيات مسارات التلاميذ عبر الفروض المحروسة مقارنة بمعدل القسم ({selectedClass})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      تتبع منحنيات التلاميذ المختارين بتدرجات النيلي والذهبي عبر الفروض المتتالية ومقارنتها بالمنحنى المرجعي لمعدل القسم.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-indigo-50/70 p-1 rounded-lg border border-indigo-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setTrajectoryGroupFilter('improvers')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        trajectoryGroupFilter === 'improvers' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      أكثر التلاميذ تطوراً
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrajectoryGroupFilter('decliners')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        trajectoryGroupFilter === 'decliners' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      أكثر التلاميذ تراجعاً
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrajectoryGroupFilter('top5')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        trajectoryGroupFilter === 'top5' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      أوائل القسم
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrajectoryGroupFilter('struggling')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                        trajectoryGroupFilter === 'struggling' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      المتعثرون للدعم
                    </button>
                  </div>
                </div>

                <div className="w-full h-96" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={classExamLevelsEvolution.trajectoryChartData}
                      margin={{ top: 20, right: 25, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }} />
                      <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} />
                      <Line
                        type="monotone"
                        dataKey="معدل القسم"
                        stroke="#1e1b4b"
                        strokeWidth={3.5}
                        strokeDasharray="6 4"
                        dot={{ r: 6, fill: '#fbbf24', stroke: '#1e1b4b', strokeWidth: 2 }}
                      />
                      {classExamLevelsEvolution.selectedTrajectoryStudents.map((st, idx) => {
                        const strokeColor = trajectoryColors[idx % trajectoryColors.length];
                        const isIndigo = idx % 2 === 0;
                        return (
                          <Line
                            key={st.id}
                            type="monotone"
                            dataKey={st.name}
                            stroke={strokeColor}
                            strokeWidth={2.8}
                            dot={{
                              r: 4.5,
                              fill: strokeColor,
                              stroke: isIndigo ? '#fde68a' : '#ffffff',
                              strokeWidth: 1.8
                            }}
                            activeDot={{
                              r: 7,
                              fill: isIndigo ? '#fbbf24' : '#312e81',
                              stroke: strokeColor,
                              strokeWidth: 2
                            }}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {/* Per-Student Supervised Exams Evolution Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>جدول تطور مستويات التلاميذ عبر الفروض المحروسة لقسم ({selectedClass})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  انقر على أي تلميذ لمعاينة منحناه الفردي التفصيلي مقارنة بمعدل القسم.
                </p>
              </div>
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث باسم التلميذ أو رقم مسار..."
                  value={evoTableSearch}
                  onChange={e => setEvoTableSearch(e.target.value)}
                  className="w-full text-xs pr-8 pl-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 border-b border-slate-200 font-extrabold z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">التلميذ(ة)</th>
                    {classExamLevelsEvolution.examDefs?.map(def => (
                      <th key={def.id} className="py-2.5 px-2 text-center">
                        {def.shortLabel}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center bg-blue-50/60 text-blue-900">المعدل</th>
                    <th className="py-2.5 px-3 text-center">فارق التطور (Δ)</th>
                    <th className="py-2.5 px-3 text-center">تحول المستوى</th>
                    <th className="py-2.5 px-3 text-center">منحنى التلميذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvoStudentRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedStudentId(row.id);
                        setViewMode('individual');
                      }}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-extrabold text-slate-900">
                        <div>{row.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{row.massar}</div>
                      </td>
                      {classExamLevelsEvolution.examDefs?.map(def => {
                        const val = row.marksMap[def.id];
                        return (
                          <td
                            key={def.id}
                            className={`py-2 px-2 text-center font-mono font-bold ${
                              val === null
                                ? 'text-slate-300'
                                : val >= 14
                                ? 'text-emerald-700'
                                : val >= 10
                                ? 'text-blue-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {val ?? '—'}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-center font-mono font-black bg-blue-50/30 text-slate-900">
                        {row.avgMark ?? '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-extrabold">
                        {row.delta !== null ? (
                          <span
                            className={
                              row.delta > 0
                                ? 'text-emerald-600'
                                : row.delta < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }
                          >
                            {row.delta > 0 ? `+${row.delta} ↗` : row.delta < 0 ? `${row.delta} ↘` : '0.00 ➡'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-[11px] font-bold text-slate-700">
                        <span>{row.startLevel.short}</span>
                        <span className="mx-1 text-slate-400">➔</span>
                        <span style={{ color: row.currentLevel.color }}>{row.currentLevel.short}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedStudentId(row.id);
                            setViewMode('individual');
                          }}
                          className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] cursor-pointer"
                        >
                          معاينة المنحنى
                        </button>
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
      {/* VIEW MODE 2 (Point 4): مؤشر الجاهزية للامتحان الوطني والجهوي (Bac Readiness) */}
      {/* ========================================================================= */}
      {viewMode === 'bac_readiness' && (
        <div className="space-y-5">
          {/* Explainer & Formula Banner */}
          <div className="bg-white rounded-2xl p-5 border border-teal-200 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-teal-700" />
                  <span>{certTargetInfo.examTitle}</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{certTargetInfo.description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 px-3 py-2 rounded-xl border border-teal-200">
                <span>المعادلة التركيبية:</span>
                <span>50% فروض محروسة</span>
                <span>·</span>
                <span>25% مواظبة</span>
                <span>·</span>
                <span>25% سلاسل تمارين</span>
              </div>
            </div>

            {/* KPI Cards for Bac Readiness */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold text-slate-600">متوسط جاهزية القسم</div>
                <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                  {classBacReadinessAnalytics.summary.avgReadiness}%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">من أصل {classBacReadinessAnalytics.summary.total} تلميذ</div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="text-xs font-bold text-emerald-800">جاهزية للتميز (≥ 75%)</div>
                <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                  {classBacReadinessAnalytics.summary.excellenceCount}
                </div>
                <div className="text-[11px] text-emerald-700 mt-0.5">مرشحون لميزة حسن/ممتاز</div>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200">
                <div className="text-xs font-bold text-sky-800">جاهزية مستقرة (55-74%)</div>
                <div className="text-2xl font-black text-sky-700 font-mono mt-1">
                  {classBacReadinessAnalytics.summary.readyCount}
                </div>
                <div className="text-[11px] text-sky-700 mt-0.5">تحكم مقبول قابل للتطوير</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                <div className="text-xs font-bold text-amber-800">جاهزية هشة (40-54%)</div>
                <div className="text-2xl font-black text-amber-700 font-mono mt-1">
                  {classBacReadinessAnalytics.summary.fragileCount}
                </div>
                <div className="text-[11px] text-amber-700 mt-0.5">إنذار مبكر قبل الامتحان</div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200">
                <div className="text-xs font-bold text-rose-800">خطر تعثر إشهادي (&lt; 40%)</div>
                <div className="text-2xl font-black text-rose-700 font-mono mt-1">
                  {classBacReadinessAnalytics.summary.atRiskCount}
                </div>
                <div className="text-[11px] text-rose-700 mt-0.5">يستوجب خطة استدراك عاجلة</div>
              </div>
            </div>
          </div>

          {/* Recharts Visualization of Bac Readiness Index */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-teal-600" />
                  <span>المخطط البياني لمؤشر الجاهزية للامتحان الإشهادي ومكوناته الثلاثة ({selectedClass})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  يقارن مؤشر الجاهزية التركيبي لكل تلميذ (%) مع كفاية الفروض المحروسة ونسبة المواظبة وإنجاز سلاسل التمارين.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setBacChartMode('composed')}
                    className={`px-3 py-1 rounded font-bold cursor-pointer ${
                      bacChartMode === 'composed' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    المؤشر التركيبي + المكونات
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacChartMode('pillars')}
                    className={`px-3 py-1 rounded font-bold cursor-pointer ${
                      bacChartMode === 'pillars' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    مقارنة الركائز الثلاث
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full h-96" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                {bacChartMode === 'composed' ? (
                  <ComposedChart data={filteredBacReadinessList} margin={{ top: 20, right: 20, bottom: 50, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
                      interval={0}
                      height={65}
                    />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#475569', fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d: StudentBacReadinessData = payload[0].payload;
                          return (
                            <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-200 text-right text-xs min-w-[240px]" dir="rtl">
                              <div className="font-black text-slate-900 border-b border-slate-100 pb-1.5 mb-2 flex justify-between items-center">
                                <span>{d.name}</span>
                                <span style={{ color: d.readinessColor }} className="font-black font-mono">
                                  الجاهزية: {d.readinessIndex}%
                                </span>
                              </div>
                              <div className="space-y-1 text-slate-700">
                                <div className="flex justify-between">
                                  <span>التصنيف الإشهادي:</span>
                                  <strong style={{ color: d.readinessColor }}>{d.readinessLabel}</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>1. كفاية وتطور الفروض (50%):</span>
                                  <strong className="font-mono text-blue-700">{d.gradesPillarScore}% (المعدل: {d.annualAvg ?? '—'})</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>2. المواظبة والانضباط (25%):</span>
                                  <strong className="font-mono text-emerald-700">{d.attendancePillarScore}% ({d.totalAbsenceHours}س غياب)</strong>
                                </div>
                                <div className="flex justify-between">
                                  <span>3. إنجاز سلاسل التمارين (25%):</span>
                                  <strong className="font-mono text-purple-700">{d.homeworkPillarScore}%</strong>
                                </div>
                                <div className="pt-1.5 mt-1 border-t border-slate-100 text-[11px] text-slate-600">
                                  <strong>التوقع الإشهادي:</strong> {d.predictedBacRange}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <ReferenceLine y={75} stroke="#b45309" strokeDasharray="4 4" label={{ value: 'عتبة التميز (75%)', fill: '#b45309', fontSize: 10 }} />
                    <ReferenceLine y={55} stroke="#d97706" strokeDasharray="4 4" label={{ value: 'عتبة الأمان الإشهادي (55%)', fill: '#d97706', fontSize: 10 }} />
                    <Bar dataKey="readinessIndex" name="مؤشر الجاهزية للامتحان (%)" radius={[5, 5, 0, 0]} maxBarSize={34}>
                      {filteredBacReadinessList.map((entry, idx) => (
                        <Cell key={`bac-cell-${idx}`} fill={entry.readinessColor} fillOpacity={0.88} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="gradesPillarScore" name="كفاية الفروض المحروسة (%)" stroke="#312e81" strokeWidth={3} dot={{ r: 4, fill: '#312e81', stroke: '#fbbf24', strokeWidth: 1.5 }} />
                    <Line type="monotone" dataKey="homeworkPillarScore" name="إنجاز سلاسل التمارين (%)" stroke="#d97706" strokeWidth={2.5} strokeDasharray="4 3" dot={{ r: 3.5, fill: '#d97706' }} />
                  </ComposedChart>
                ) : (
                  <BarChart data={filteredBacReadinessList} margin={{ top: 20, right: 20, bottom: 50, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      tick={{ fill: '#1e1b4b', fontSize: 10, fontWeight: 700 }}
                      interval={0}
                      height={65}
                    />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#312e81', fontSize: 11 }} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar dataKey="gradesPillarScore" name="كفاية وتطور الفروض (50%)" fill="#312e81" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="attendancePillarScore" name="نسبة المواظبة (25%)" fill="#d97706" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="homeworkPillarScore" name="سلاسل التمارين المنزلية (25%)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Early Warning Table & Actionable Interventions for Bac Readiness */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className="text-sm font-black text-slate-900">
                  جدول التنبؤ المبكر والجاهزية للامتحان الإشهادي ({filteredBacReadinessList.length} تلميذ)
                </h4>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setBacFilterStatus('all')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      bacFilterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    الكل ({classBacReadinessAnalytics.summary.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacFilterStatus('at_risk')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      bacFilterStatus === 'at_risk' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    خطر حاد ({classBacReadinessAnalytics.summary.atRiskCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacFilterStatus('fragile')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      bacFilterStatus === 'fragile' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    جاهزية هشة ({classBacReadinessAnalytics.summary.fragileCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacFilterStatus('excellence')}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      bacFilterStatus === 'excellence' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    التميز ({classBacReadinessAnalytics.summary.excellenceCount})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={bacSortBy}
                  onChange={(e: any) => setBacSortBy(e.target.value)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 cursor-pointer"
                >
                  <option value="readiness_asc">الأكثر تهديداً بالتعثر أولاً (تصاعدي)</option>
                  <option value="readiness_desc">الأعلى جاهزية للامتحان أولاً (تنازلي)</option>
                  <option value="grades_asc">الأدنى معدلاً في الفروض أولاً</option>
                  <option value="hw_asc">الأقل إنجازاً لسلاسل التمارين أولاً</option>
                </select>
                <div className="relative min-w-[190px]">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث عن تلميذ..."
                    value={bacSearchQuery}
                    onChange={e => setBacSearchQuery(e.target.value)}
                    className="w-full text-xs pr-8 pl-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-700 border-b border-slate-200 font-extrabold z-10">
                  <tr>
                    <th className="py-2.5 px-2.5 text-center w-9">#</th>
                    <th className="py-2.5 px-3">التلميذ(ة)</th>
                    <th className="py-2.5 px-2 text-center">معدل الفروض</th>
                    <th className="py-2.5 px-2 text-center" title="وزن 50%: المعدل + دينامية التطور">كفاية الفروض (50%)</th>
                    <th className="py-2.5 px-2 text-center" title="وزن 25%: الحضور والانضباط">المواظبة (25%)</th>
                    <th className="py-2.5 px-2 text-center" title="وزن 25%: إنجاز سلاسل التمارين المنزلية">سلاسل التمارين (25%)</th>
                    <th className="py-2.5 px-3 text-center">مؤشر الجاهزية</th>
                    <th className="py-2.5 px-3">التشخيص والوصفة البيداغوجية للامتحان</th>
                    <th className="py-2.5 px-2.5 text-center">إجراءات استباقية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBacReadinessList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-2.5 px-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.massar} · توقع: {item.predictedBacRange}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-black">
                        <span className={item.annualAvg !== null && item.annualAvg >= 10 ? 'text-blue-700' : 'text-rose-600'}>
                          {item.annualAvg ?? '—'}
                        </span>
                        {item.examSlope !== 0 && (
                          <div className={`text-[10px] ${item.examSlope > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.examSlope > 0 ? `+${item.examSlope} ↗` : `${item.examSlope} ↘`}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                        {item.gradesPillarScore}%
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                        <div>{item.attendancePillarScore}%</div>
                        {item.totalAbsenceHours > 0 && (
                          <div className="text-[10px] text-rose-600">{item.totalAbsenceHours}س غياب</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                        <div>{item.homeworkPillarScore}%</div>
                        {item.missedHw > 0 && (
                          <div className="text-[10px] text-amber-700">{item.missedHw} بدون واجب</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="font-black font-mono text-sm" style={{ color: item.readinessColor }}>
                          {item.readinessIndex}%
                        </div>
                        <div className="text-[10px] font-bold" style={{ color: item.readinessColor }}>
                          {item.readinessLabel}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-[270px] leading-relaxed">
                        {item.mathPrescription}
                      </td>
                      <td className="py-2.5 px-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSendBacReadinessWhatsApp(item)}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md cursor-pointer"
                            title="إرسال تقرير الجاهزية الإشهادية لولي الأمر عبر واتساب"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnrollInTutoring(item)}
                            className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-md cursor-pointer"
                            title="إدراج في حصة الدعم الاستدراكي للامتحان"
                          >
                            <GraduationCap className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(item.id);
                              setViewMode('individual');
                            }}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-md cursor-pointer"
                            title="معاينة منحنى الفروض الفردي للتلميذ"
                          >
                            <TrendingUp className="w-4 h-4" />
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
      {/* Controls Bar for Remaining Modes (individual, class_all, failure_risk)     */}
      {/* ========================================================================= */}
      {(viewMode === 'individual' || viewMode === 'class_all' || viewMode === 'failure_risk') && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {viewMode === 'failure_risk' ? (
            <>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-amber-600" />
                  تصفية الحالات:
                </label>
                <select
                  value={riskFilterLevel}
                  onChange={(e: any) => setRiskFilterLevel(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer"
                >
                  <option value="all">جميع التلاميذ ({classFailureRiskList.length})</option>
                  <option value="critical">الخطر الحرج فقط ({classRiskSummary.criticalCount})</option>
                  <option value="high">الخطر المرتفع والحرج ({classRiskSummary.criticalCount + classRiskSummary.highCount})</option>
                  <option value="declining">المتراجعون بين الدورتين ({classRiskSummary.decliningCount})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                  ترتيب القائمة:
                </label>
                <select
                  value={riskSortBy}
                  onChange={(e: any) => setRiskSortBy(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer"
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

              {viewMode === 'individual' ? (
                <div className="md:col-span-2">
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
                    onChange={e => setSelectedStudentId(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer"
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
                      onChange={e => setShowBenchmark10(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>عتبة النجاح (10/20)</span>
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE: مؤشر احتمالية التعثر والربط بالغياب (Failure Risk Mode)       */}
      {/* ========================================================================= */}
      {viewMode === 'failure_risk' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm">
              <div className="text-xs font-bold text-rose-800 flex items-center justify-between">
                <span>خطر تعثر حرج (≥ 70%)</span>
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
              </div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {classRiskSummary.criticalCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  تلميذ ({Math.round((classRiskSummary.criticalCount / Math.max(classRiskSummary.total, 1)) * 100)}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">يستلزم تدخلاً استدراكياً عاجلاً</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
              <div className="text-xs font-bold text-amber-800">خطر مرتفع (45% - 69%)</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {classRiskSummary.highCount} <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">بحاجة لدعم ومواكبة فردية</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm">
              <div className="text-xs font-bold text-indigo-800">تراجع بين الدورتين</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {classRiskSummary.decliningCount} <span className="text-xs font-normal text-slate-500">تلميذ</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">انحدار في نتائج المراقبة المستمرة</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
              <div className="text-xs font-bold text-emerald-800">وضعية آمنة (&lt; 25%)</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {classRiskSummary.safeCount}{' '}
                <span className="text-xs font-normal text-slate-500">
                  تلميذ ({Math.round((classRiskSummary.safeCount / Math.max(classRiskSummary.total, 1)) * 100)}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">مواظبة جيدة وتحكم سليم</div>
            </div>
          </div>

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
              </div>

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
                    <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'عتبة النجاح (10/20)', fill: '#059669', fontSize: 11, position: 'top' }} />
                    <ReferenceLine x={8} stroke="#ea580c" strokeDasharray="4 4" strokeWidth={2} label={{ value: 'عتبة الغياب المقلق (8س)', fill: '#c2410c', fontSize: 11, position: 'insideTopRight' }} />
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
                        <Cell key={`cell-${index}`} fill={entry.riskColor} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {riskChartType === 'composed' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredSortedRiskList} margin={{ top: 20, right: 20, bottom: 45, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} interval={0} height={60} />
                    <YAxis yAxisId="left" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#dc2626', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 25]} ticks={[0, 5, 10, 15, 20, 25]} tick={{ fill: '#2563eb', fontSize: 11 }} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="failureRiskScore"
                      name="مؤشر احتمالية التعثر (%)"
                      radius={[4, 4, 0, 0]}
                      onClick={data => {
                        if (data) setSelectedRiskStudent(data);
                      }}
                      className="cursor-pointer"
                    >
                      {filteredSortedRiskList.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.riskColor} fillOpacity={0.85} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="totalAbsenceHours" name="ساعات الغياب التراكمية (س)" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 4, fill: '#ea580c' }} />
                    <Line yAxisId="right" type="monotone" dataKey="annualAvg" name="معدل الفروض السنوي (/20)" stroke="#2563eb" strokeWidth={2.8} dot={{ r: 5, fill: '#2563eb' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {selectedRiskStudent && (
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-700">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg"
                    style={{ backgroundColor: selectedRiskStudent.riskColor }}
                  >
                    {selectedRiskStudent.failureRiskScore}%
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">{selectedRiskStudent.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      مسار: {selectedRiskStudent.massar} · {selectedRiskStudent.quadrantName} · القسم: {selectedClass}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSendRiskWhatsApp(selectedRiskStudent)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>إشعار الأسرة (WhatsApp)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEnrollInTutoring(selectedRiskStudent)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>إلحاق بالدعم والاستدراك</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenPortfolio(selectedRiskStudent)}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>ملف الإنجاز الرقمي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAiCompare(selectedRiskStudent)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>مقارنة المراقبة بالفروض (AI)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE: المنحنى الفردي للتلميذ ومقارنته بالقسم (Individual Mode)       */}
      {/* ========================================================================= */}
      {viewMode === 'individual' && currentStudent && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-indigo-900/15 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1e1b4b] to-[#312e81] text-amber-300 border border-amber-400/50 flex items-center justify-center text-xl font-black shadow-sm">
                  {currentStudent.name.trim().charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#1e1b4b]">{currentStudent.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                    <span>القسم: <strong className="text-[#312e81]">{selectedClass}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span style={{ color: studentAppreciation.color }} className="font-bold">
                      {studentAppreciation.text}
                    </span>
                    {studentRankInfo.rank && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          الرتبة: <strong className="text-[#b45309] font-extrabold">{studentRankInfo.rank}</strong> من {studentRankInfo.total}
                        </span>
                      </>
                    )}
                    {progressionInfo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={progressionInfo.isPositive ? 'text-[#312e81] font-bold' : progressionInfo.isNeutral ? 'text-[#d97706] font-bold' : 'text-rose-700 font-bold'}>
                          {progressionInfo.text}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-stretch md:self-auto justify-around border-t md:border-t-0 md:border-r border-slate-100 pt-3 md:pt-0 md:pr-4">
                <div className="text-center px-2">
                  <span className="text-[11px] text-slate-400 font-bold block">معدل التلميذ (النيلي)</span>
                  <span className={`text-xl font-black font-mono ${studentOverallAvg !== null && studentOverallAvg >= 10 ? 'text-[#312e81]' : 'text-rose-600'}`}>
                    {studentOverallAvg !== null ? `${studentOverallAvg} / 20` : '-'}
                  </span>
                </div>
                <div className="text-center px-2 border-r border-slate-100">
                  <span className="text-[11px] text-slate-400 font-bold block">معدل القسم (الذهبي)</span>
                  <span className="text-xl font-black font-mono text-[#d97706]">
                    {classOverallAvg !== null ? `${classOverallAvg} / 20` : '-'}
                  </span>
                </div>
                <div className="text-center px-2 border-r border-slate-100">
                  <span className="text-[11px] text-slate-400 font-bold block">الفارق</span>
                  <span className={`text-xl font-black font-mono ${deltaOverall !== null && deltaOverall >= 0 ? 'text-[#312e81]' : 'text-rose-600'}`}>
                    {deltaOverall !== null ? (deltaOverall >= 0 ? `+${deltaOverall}` : deltaOverall) : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-indigo-900/15 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-[#1e1b4b] flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#d97706]" />
                  منحنى مسار الفروض المحروسة للتلميذ (بالنيلي الملكي) مقارنة بمتوسط القسم (بالذهبي) ({selectedClass})
                </h3>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBenchmark10}
                    onChange={e => setShowBenchmark10(e.target.checked)}
                    className="rounded text-[#312e81] cursor-pointer"
                  />
                  <span>عتبة النجاح (10/20)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMinMaxRange}
                    onChange={e => setShowMinMaxRange(e.target.checked)}
                    className="rounded text-[#312e81] cursor-pointer"
                  />
                  <span>أعلى وأدنى نقطة بالقسم</span>
                </label>
              </div>
            </div>

            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={individualChartData} margin={{ top: 15, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#c7d2fe' }} />
                  <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#c7d2fe' }} />
                  <Tooltip content={<CustomIndividualTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                  {showBenchmark10 && <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} />}
                  {showMinMaxRange && (
                    <>
                      <Line type="monotone" dataKey="أعلى نقطة بالقسم" stroke="#6366f1" strokeDasharray="3 3" strokeWidth={1.8} dot={{ r: 3.5, fill: '#6366f1' }} />
                      <Line type="monotone" dataKey="أدنى نقطة بالقسم" stroke="#92400e" strokeDasharray="3 3" strokeWidth={1.8} dot={{ r: 3.5, fill: '#92400e' }} />
                    </>
                  )}
                  <Line
                    type="monotone"
                    dataKey="معدل القسم"
                    stroke="#d97706"
                    strokeWidth={3.2}
                    strokeDasharray="6 4"
                    dot={{ r: 5.5, fill: '#d97706', stroke: '#fffbeb', strokeWidth: 2 }}
                    activeDot={{ r: 7.5, fill: '#fbbf24', stroke: '#78350f', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="نقطة التلميذ"
                    stroke="#312e81"
                    strokeWidth={4}
                    dot={{ r: 6.5, fill: '#312e81', stroke: '#fbbf24', strokeWidth: 2.5 }}
                    activeDot={{ r: 8.5, fill: '#fbbf24', stroke: '#312e81', strokeWidth: 2.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE: توزيع معدلات كافة تلاميذ القسم (Class All Mode)             */}
      {/* ========================================================================= */}
      {viewMode === 'class_all' && (
        <div className="bg-white rounded-2xl p-5 border border-indigo-900/15 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-5 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-[#1e1b4b] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#d97706]" />
                توزيع معدلات المراقبة المستمرة لجميع تلاميذ القسم ({selectedClass})
              </h3>
              <p className="text-xs text-slate-500">
                مقارنة كل تلميذ بمعدل القسم الإجمالي ({classOverallAvg ?? '-'} / 20) وعتبة النجاح (10/20) وفق الهوية البصرية (النيلي والذهبي)
              </p>
            </div>
          </div>

          {allStudentsChartData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">لا توجد نقط مسجلة لتلاميذ هذا القسم حتى الآن.</div>
          ) : (
            <div className="w-full h-96" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allStudentsChartData} margin={{ top: 15, right: 15, left: -10, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fill: '#1e1b4b', fontSize: 10, fontWeight: 600 }} interval={0} height={60} />
                  <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} />
                  <Tooltip />
                  {showBenchmark10 && <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} />}
                  {classOverallAvg !== null && <ReferenceLine y={classOverallAvg} stroke="#d97706" strokeWidth={2.2} strokeDasharray="4 3" />}
                  <Bar
                    dataKey="معدل التلميذ"
                    radius={[4, 4, 0, 0]}
                    onClick={node => {
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
                        fill={
                          entry['معدل التلميذ'] >= 14
                            ? '#d97706'
                            : entry['معدل التلميذ'] >= 10
                            ? '#312e81'
                            : '#92400e'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE: تطور معدلات الأقسام ومقارنة الأسدسين (Class Progression)      */}
      {/* ========================================================================= */}
      {viewMode === 'class_progression' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-4 border border-indigo-900/15 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#1e1b4b]">طريقة المقارنة:</span>
              <button
                type="button"
                onClick={() => setProgressionSubMode('single_class')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  progressionSubMode === 'single_class' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-indigo-50'
                }`}
              >
                مقارنة الأسدسين لقسم واحد ({selectedClass})
              </button>
              <button
                type="button"
                onClick={() => setProgressionSubMode('all_classes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  progressionSubMode === 'all_classes' ? 'bg-[#b45309] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-amber-50'
                }`}
              >
                مقارنة جميع الأقسام معاً ({classNames.length} أقسام)
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-indigo-50/70 p-1 rounded-lg border border-indigo-100 text-xs">
              <button
                type="button"
                onClick={() => setProgressionChartType('composed')}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                  progressionChartType === 'composed' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                }`}
              >
                مركب (أعمدة + منحنى التطور)
              </button>
              <button
                type="button"
                onClick={() => setProgressionChartType('bars')}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                  progressionChartType === 'bars' ? 'bg-[#312e81] text-amber-200 shadow-xs' : 'text-slate-600'
                }`}
              >
                أعمدة متوازية (نيلي وذهبي)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-indigo-900/15 shadow-sm">
            {progressionSubMode === 'single_class' ? (
              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={classProgressionAnalytics.examComparisonChartData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#c7d2fe' }} />
                    <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} axisLine={{ stroke: '#c7d2fe' }} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} />
                    <Bar dataKey="الأسدس الأول (S1)" fill="#312e81" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    <Bar dataKey="الأسدس الثاني (S2)" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    {progressionChartType === 'composed' && (
                      <Line
                        type="monotone"
                        dataKey="الأسدس الثاني (S2)"
                        stroke="#1e1b4b"
                        strokeWidth={3}
                        dot={{ r: 5, fill: '#fbbf24', stroke: '#1e1b4b', strokeWidth: 2 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full h-96" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allClassesProgressionData} margin={{ top: 20, right: 20, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#1e1b4b', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: '#c7d2fe' }} />
                    <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tick={{ fill: '#312e81', fontSize: 11 }} axisLine={{ stroke: '#c7d2fe' }} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.8} />
                    <Bar dataKey="الأسدس الأول (S1)" fill="#312e81" radius={[6, 6, 0, 0]} maxBarSize={38} />
                    <Bar dataKey="الأسدس الثاني (S2)" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={38} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
