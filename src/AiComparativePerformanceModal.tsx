import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Brain,
  TrendingUp,
  TrendingDown,
  Scale,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  Copy,
  Check,
  User,
  GraduationCap,
  Users,
  Home,
  Target,
  ArrowRight,
  BookOpen,
  Calendar,
  Zap,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';

export interface StudentAiComparativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
  initialClassName?: string;
  db: any;
  semester?: 's1' | 's2' | 'annual';
}

export interface ComparativeAnalysisResult {
  gapValue: number;
  gapClassification: 'continuous_higher' | 'proctored_higher' | 'balanced_high' | 'balanced_moderate' | 'struggling_both';
  gapTitle: string;
  comparativeSummary: string;
  cognitiveDiagnosis: string;
  studentStrengths: string[];
  growthAreas: string[];
  recommendationsForStudent: string[];
  recommendationsForTeacher: string[];
  recommendationsForParent: string[];
  actionPlan: Array<{
    phase: string;
    action: string;
    expectedOutcome: string;
  }>;
  predictedEvolution: string;
}

export const AiComparativePerformanceModal: React.FC<StudentAiComparativeModalProps> = ({
  isOpen,
  onClose,
  initialStudentId,
  initialClassName,
  db,
  semester = 's1'
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(initialClassName || '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<ComparativeAnalysisResult | null>(null);
  const [analysisSource, setAnalysisSource] = useState<'gemini' | 'heuristic' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'parent' | 'plan'>('student');
  const [copiedWA, setCopiedWA] = useState<boolean>(false);

  // Sync state when props change
  useEffect(() => {
    if (initialClassName) setSelectedClass(initialClassName);
    if (initialStudentId) setSelectedStudentId(initialStudentId);
  }, [initialClassName, initialStudentId]);

  // Extract class list
  const classList = useMemo(() => {
    if (!db || !db.classes) return [];
    return Object.keys(db.classes);
  }, [db]);

  // If selectedClass is empty, set default
  useEffect(() => {
    if (!selectedClass && classList.length > 0) {
      setSelectedClass(classList[0]);
    }
  }, [selectedClass, classList]);

  // Students in selected class
  const classStudents = useMemo(() => {
    if (!db || !db.classes || !selectedClass || !db.classes[selectedClass]) return [];
    const entry = db.classes[selectedClass];
    return Array.isArray(entry) ? entry : (entry.students || []);
  }, [db, selectedClass]);

  // If selectedStudentId is empty, set first student
  useEffect(() => {
    if (classStudents.length > 0) {
      const exists = classStudents.some((s: any) => String(s.id) === String(selectedStudentId));
      if (!exists) {
        setSelectedStudentId(String(classStudents[0].id));
      }
    }
  }, [selectedClass, classStudents, selectedStudentId]);

  // Target Student Object
  const currentStudent = useMemo(() => {
    return classStudents.find((s: any) => String(s.id) === String(selectedStudentId)) || null;
  }, [classStudents, selectedStudentId]);

  // Compute student stats
  const studentMetrics = useMemo(() => {
    if (!currentStudent || !selectedClass) return null;
    const stdId = String(currentStudent.id);

    // 1. Proctored Exams
    const classGrades = (db.grades && db.grades[selectedClass]) ? db.grades[selectedClass] : {};
    const stdRecord = classGrades[stdId] || {};

    const parseMarkVal = (v: any): number | null => {
      if (v === undefined || v === null || String(v).trim() === '') return null;
      const num = parseFloat(String(v).replace(',', '.'));
      return isNaN(num) || num < 0 || num > 20 ? null : parseFloat(num.toFixed(2));
    };

    const getMarkForSem = (semKey: 's1' | 's2', exKey: 'f1' | 'f2' | 'f3' | 'f4'): number | null => {
      if (semKey === 's2') {
        const raw = stdRecord?.s2?.[exKey] ?? db.gradesS2?.[selectedClass]?.[stdId]?.[exKey];
        return parseMarkVal(raw);
      }
      const raw = stdRecord?.s1?.[exKey] ?? db.gradesS1?.[selectedClass]?.[stdId]?.[exKey] ?? stdRecord?.[exKey];
      return parseMarkVal(raw);
    };

    let f1: number | null = null;
    let f2: number | null = null;
    let f3: number | null = null;
    let f4: number | null = null;

    if (semester === 's2') {
      f1 = getMarkForSem('s2', 'f1');
      f2 = getMarkForSem('s2', 'f2');
      f3 = getMarkForSem('s2', 'f3');
      f4 = getMarkForSem('s2', 'f4');
    } else if (semester === 'annual') {
      const avgPair = (a: number | null, b: number | null) =>
        a !== null && b !== null ? parseFloat(((a + b) / 2).toFixed(2)) : (a ?? b);
      f1 = avgPair(getMarkForSem('s1', 'f1'), getMarkForSem('s2', 'f1'));
      f2 = avgPair(getMarkForSem('s1', 'f2'), getMarkForSem('s2', 'f2'));
      f3 = avgPair(getMarkForSem('s1', 'f3'), getMarkForSem('s2', 'f3'));
      f4 = avgPair(getMarkForSem('s1', 'f4'), getMarkForSem('s2', 'f4'));
    } else {
      f1 = getMarkForSem('s1', 'f1');
      f2 = getMarkForSem('s1', 'f2');
      f3 = getMarkForSem('s1', 'f3');
      f4 = getMarkForSem('s1', 'f4');
    }

    const validProctored = [f1, f2, f3, f4].filter((v): v is number => v !== null && !isNaN(v));
    const proctoredAvg = validProctored.length > 0
      ? parseFloat((validProctored.reduce((a, b) => a + b, 0) / validProctored.length).toFixed(2))
      : null;

    // 2. Attendance & Incidents
    const records = (db.records || []).filter(
      (r: any) => String(r.studentId) === stdId && r.className === selectedClass
    );
    let absentHours = 0;
    let justifiedHours = 0;
    let unexcusedHours = 0;
    let missedHwCount = 0;

    records.forEach((r: any) => {
      const dur = r.duration || 1;
      if (r.status === 'غائب') {
        absentHours += dur;
        unexcusedHours += dur;
      } else if (r.status === 'مبرر') {
        absentHours += dur;
        justifiedHours += dur;
      }
      if (r.homework === 'لم ينجز') {
        missedHwCount++;
      }
    });

    const beh = (db.behaviors && db.behaviors[selectedClass] && db.behaviors[selectedClass][stdId]) || {
      status: 'منضبط',
      note: ''
    };

    // Calculate a standard Moroccan Continuous Assessment / Activities Score (out of 20)
    // Starts at 15/20 base for regular student; penalized by missed homework, absence, behavior
    let activitiesScore = 15;
    activitiesScore -= Math.min(6, missedHwCount * 1.5);
    activitiesScore -= Math.min(5, unexcusedHours * 0.5);
    if (beh.status === 'مشوش') activitiesScore -= 3;
    else if (beh.status === 'تنبيه') activitiesScore -= 1.5;
    else if (beh.status === 'منضبط') activitiesScore += 1.5;

    // Harmonize with proctored average if present
    if (proctoredAvg !== null) {
      activitiesScore = parseFloat(((activitiesScore * 0.45) + (proctoredAvg * 0.55)).toFixed(2));
    }
    activitiesScore = Math.max(3, Math.min(19.5, parseFloat(activitiesScore.toFixed(2))));

    const effectiveProctored = proctoredAvg !== null ? proctoredAvg : activitiesScore;
    const gap = parseFloat((effectiveProctored - activitiesScore).toFixed(2));

    return {
      f1,
      f2,
      f3,
      f4,
      proctoredAvg,
      activitiesScore,
      gap,
      absentHours,
      justifiedHours,
      unexcusedHours,
      missedHwCount,
      behaviorStatus: beh.status || 'منضبط',
      behaviorNote: beh.note || ''
    };
  }, [currentStudent, selectedClass, db, semester]);

  // Function to run the AI comparison
  const runAiComparison = async () => {
    if (!currentStudent || !studentMetrics) return;
    setLoading(true);
    setErrorMsg(null);

    const payload = {
      studentId: String(currentStudent.id),
      studentName: currentStudent.name || 'التلميذ(ة)',
      className: selectedClass,
      semester,
      subject: 'مادة الرياضيات',
      proctoredExams: {
        f1: studentMetrics.f1,
        f2: studentMetrics.f2,
        f3: studentMetrics.f3,
        f4: studentMetrics.f4,
        average: studentMetrics.proctoredAvg,
        count: [studentMetrics.f1, studentMetrics.f2, studentMetrics.f3, studentMetrics.f4].filter(v => v !== null).length
      },
      continuousAssessment: {
        activitiesScore: studentMetrics.activitiesScore,
        missedHomeworkCount: studentMetrics.missedHwCount,
        absentHours: studentMetrics.absentHours,
        justifiedAbsentHours: studentMetrics.justifiedHours,
        behaviorStatus: studentMetrics.behaviorStatus,
        behaviorNote: studentMetrics.behaviorNote
      },
      classContext: {
        totalStudentsInClass: classStudents.length
      }
    };

    try {
      const response = await fetch('/api/ai-compare-student-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`تعذر الاتصال بخادم الذكاء الاصطناعي (${response.status})`);
      }

      const data = await response.json();
      if (data && data.result) {
        setAnalysisResult(data.result);
        setAnalysisSource(data.source === 'gemini' ? 'gemini' : 'heuristic');
      } else {
        throw new Error('لم يتم استلام استجابة صالحة من نموذج التحليل');
      }
    } catch (err: any) {
      console.error('AI Comparative Analysis Error:', err);
      setErrorMsg(err?.message || 'حدث خطأ أثناء إجراء التحليل');
    } finally {
      setLoading(false);
    }
  };

  // Auto trigger analysis on initial load if student changed and no result
  useEffect(() => {
    if (isOpen && currentStudent) {
      runAiComparison();
    }
  }, [isOpen, selectedStudentId, selectedClass]);

  // Copy WhatsApp report for parents
  const copyWhatsAppReport = () => {
    if (!currentStudent || !studentMetrics || !analysisResult) return;
    const pAvgStr = studentMetrics.proctoredAvg !== null ? `${studentMetrics.proctoredAvg}/20` : 'غير محدد';
    const cAvgStr = `${studentMetrics.activitiesScore}/20`;
    const gapStr = studentMetrics.gap > 0 ? `+${studentMetrics.gap}` : `${studentMetrics.gap}`;

    const text = `السلام عليكم ورحمة الله وبركاته،
ولي أمر التلميذ(ة): *${currentStudent.name}*
القسم: *${selectedClass}* | مادة الرياضيات

📊 *تقرير التحليل البيداغوجي الذكي لمستوى التلميذ:*
• معدل الفروض المحروسة الكتابية: *${pAvgStr}*
• معدل أنشطة المراقبة والواجبات المنزلية: *${cAvgStr}*
• مؤشر الفجوة التحصيلية: *${gapStr}* (${analysisResult.gapTitle})

🔍 *التشخيص والملاحظات:*
${analysisResult.comparativeSummary}

💡 *توصيات وتوجيهات خاصة لولي الأمر:*
${analysisResult.recommendationsForParent.map((r, i) => `${i + 1}. ${r}`).join('\n')}

🎯 *نصائح للتلميذ بالمنزل:*
${analysisResult.recommendationsForStudent.slice(0, 2).map((r, i) => `• ${r}`).join('\n')}

مع تحيات أستاذ المادة وإدارة المؤسسة.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 3000);
    });
  };

  // Print official comparative report card
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 md:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-black tracking-wide">
                  تحليل الذكاء الاصطناعي المقارن
                </h3>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-200 border border-cyan-400/30 px-2 py-0.5 rounded-full font-bold">
                  المراقبة المستمرة vs الفروض المحروسة
                </span>
                {analysisSource === 'gemini' && (
                  <span className="text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> Gemini AI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                مقارنة دقيقة للأداء، رصد الفجوة البيداغوجية، وتقديم توصيات مخصصة لتحسين المستوى (المذكرة 142-08)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Student Switcher Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 md:px-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>القسم:</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {classList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>التلميذ(ة):</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[200px]"
              >
                {classStudents.map((s: any) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name} {s.massar ? `(${s.massar})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runAiComparison}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'جاري التحليل بالذكاء الاصطناعي...' : 'إعادة توليد التحليل'}</span>
            </button>

            <button
              type="button"
              onClick={copyWhatsAppReport}
              disabled={!analysisResult}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="نسخ تقرير التوصيات لإرساله لولي الأمر عبر واتساب"
            >
              {copiedWA ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWA ? 'تم النسخ بنجاح!' : 'نسخ لواتساب'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 print:p-0">
          
          {/* Quick Metrics & Comparison Dashboard */}
          {studentMetrics && currentStudent && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              
              {/* Proctored Exam Score Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span>معدل الفروض المحروسة الكتابية</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-blue-200/60 text-blue-800 px-2 py-0.5 rounded-md">
                    F1, F2, F3
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black font-mono text-blue-950">
                    {studentMetrics.proctoredAvg !== null ? studentMetrics.proctoredAvg : '—'}
                  </span>
                  <span className="text-xs font-bold text-slate-500">/ 20</span>
                </div>
                <div className="text-[11px] text-blue-800 flex items-center gap-2 border-t border-blue-200/60 pt-1.5">
                  <span>ف1: <strong>{studentMetrics.f1 !== null ? studentMetrics.f1 : '-'}</strong></span>
                  <span>ف2: <strong>{studentMetrics.f2 !== null ? studentMetrics.f2 : '-'}</strong></span>
                  <span>ف3: <strong>{studentMetrics.f3 !== null ? studentMetrics.f3 : '-'}</strong></span>
                </div>
              </div>

              {/* Continuous Assessment & Activities Score Card */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50/60 border border-purple-200/80 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    <span>فروض وأنشطة المراقبة المستمرة</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-md">
                    أنشطة + واجبات
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black font-mono text-purple-950">
                    {studentMetrics.activitiesScore}
                  </span>
                  <span className="text-xs font-bold text-slate-500">/ 20</span>
                </div>
                <div className="text-[11px] text-purple-800 flex items-center gap-2 border-t border-purple-200/60 pt-1.5">
                  <span>الواجبات: <strong>{studentMetrics.missedHwCount === 0 ? 'منضبط' : `${studentMetrics.missedHwCount} إهمال`}</strong></span>
                  <span>الغياب: <strong>{studentMetrics.absentHours}س</strong></span>
                  <span>السلوك: <strong>{studentMetrics.behaviorStatus}</strong></span>
                </div>
              </div>

              {/* Performance Gap & Classification Card */}
              <div className={`rounded-xl p-3.5 flex flex-col justify-between border shadow-2xs ${
                Math.abs(studentMetrics.gap) < 1.5
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : studentMetrics.gap > 0
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    <span>مؤشر الفجوة التحصيلية (Δ)</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/70 shadow-2xs">
                    {studentMetrics.gap > 0 ? 'تفاضل لصالح المحروس' : (studentMetrics.gap < 0 ? 'تفاضل لصالح المراقبة' : 'توازن تام')}
                  </span>
                </div>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black font-mono">
                    {studentMetrics.gap > 0 ? `+${studentMetrics.gap}` : studentMetrics.gap}
                  </span>
                  <span className="text-xs font-bold opacity-75">نقطة فارق</span>
                </div>
                <div className="text-[11px] font-semibold border-t border-black/10 pt-1.5 line-clamp-1">
                  {analysisResult?.gapTitle || 'جاري تحليل الأثر البيداغوجي...'}
                </div>
              </div>

            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-8 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 animate-pulse">
                <Brain className="w-6 h-6 animate-spin" />
              </div>
              <h4 className="text-sm font-black text-slate-800">
                الذكاء الاصطناعي يقوم بالمقارنة والتشخيص البيداغوجي...
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يتم قياس الفجوة بين الأداء الصفي/المنزلي والنتائج المحروسة واستخراج التوصيات الشخصية المناسبة لتحسين المستوى.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && !loading && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 flex items-center gap-3 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Analysis Results Display */}
          {analysisResult && !loading && (
            <div className="space-y-4">
              
              {/* Comparative Summary & Cognitive Diagnosis */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    <span>التقرير المقارن والتشخيص المعرفي للتلميذ:</span>
                  </h4>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {analysisResult.gapTitle}
                  </span>
                </div>

                <p className="text-xs md:text-sm text-slate-700 leading-relaxed text-justify">
                  {analysisResult.comparativeSummary}
                </p>

                {analysisResult.cognitiveDiagnosis && (
                  <div className="bg-slate-50 border-r-4 border-indigo-500 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-800 block mb-1">🔍 التفسير والتشخيص الديداكتيكي:</strong>
                    {analysisResult.cognitiveDiagnosis}
                  </div>
                )}
              </div>

              {/* Strengths & Growth Areas Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Strengths */}
                <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs">
                  <h5 className="text-xs font-black text-emerald-900 flex items-center gap-2 mb-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>مواطن القوة والجاهزية المرصودة:</span>
                  </h5>
                  <ul className="space-y-2 text-xs text-emerald-950 font-medium">
                    {analysisResult.studentStrengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Growth Areas */}
                <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4 shadow-2xs">
                  <h5 className="text-xs font-black text-amber-900 flex items-center gap-2 mb-2.5">
                    <Target className="w-4 h-4 text-amber-600" />
                    <span>مجالات التطوير ذات الأولوية:</span>
                  </h5>
                  <ul className="space-y-2 text-xs text-amber-950 font-medium">
                    {analysisResult.growthAreas.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              {/* Personalized Targeted Recommendations (Tabs: Student, Teacher, Parent, Plan) */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                
                {/* Tabs Bar */}
                <div className="flex border-b border-slate-200 bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() => setActiveTab('student')}
                    className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                      activeTab === 'student'
                        ? 'border-blue-600 text-blue-700 bg-white shadow-2xs'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>توصيات للتلميذ(ة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('teacher')}
                    className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                      activeTab === 'teacher'
                        ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>إجراءات الأستاذ(ة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('parent')}
                    className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                      activeTab === 'parent'
                        ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Home className="w-4 h-4" />
                    <span>إرشادات لولي الأمر</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('plan')}
                    className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                      activeTab === 'plan'
                        ? 'border-purple-600 text-purple-700 bg-white shadow-2xs'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>خطة العمل الإجرائية</span>
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="p-4 md:p-5">
                  {activeTab === 'student' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-black text-blue-900 mb-1">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>نصائح واستراتيجيات عملية موجهة لـ {currentStudent?.name}:</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {analysisResult.recommendationsForStudent.map((rec, idx) => (
                          <div key={idx} className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex flex-col justify-between">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-2">
                              {idx + 1}
                            </span>
                            <p className="text-xs text-blue-950 font-medium leading-relaxed">
                              {rec}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'teacher' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-900 mb-1">
                        <Brain className="w-4 h-4 text-indigo-600" />
                        <span>إجراءات الدعم البيداغوجي الموصى بها داخل الفصل:</span>
                      </div>
                      <div className="space-y-2.5">
                        {analysisResult.recommendationsForTeacher.map((rec, idx) => (
                          <div key={idx} className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-950 font-medium flex items-start gap-3">
                            <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'parent' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-900 mb-1">
                        <Home className="w-4 h-4 text-emerald-600" />
                        <span>توجيهات وإرشادات المواكبة الأسرية بالمنزل:</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {analysisResult.recommendationsForParent.map((rec, idx) => (
                          <div key={idx} className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 font-medium flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'plan' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-black text-purple-900 mb-1">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span>خطة العمل البيداغوجية المتدرجة لتحسين المستوى:</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {analysisResult.actionPlan.map((step, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full inline-block mb-1.5">
                                {step.phase}
                              </span>
                              <p className="text-xs font-bold text-slate-800 leading-relaxed mb-2">
                                {step.action}
                              </p>
                            </div>
                            <div className="border-t border-slate-200 pt-2 text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              <span>الأثر: {step.expectedOutcome}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Predicted Evolution Banner */}
              {analysisResult.predictedEvolution && (
                <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs font-bold shadow-md">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span>المسار المتوقع: {analysisResult.predictedEvolution}</span>
                  </div>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-cyan-200">
                    أفق التحسن 🎯
                  </span>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>منظومة التقويم البيداغوجي والذكاء الاصطناعي</span>
            <span>&bull;</span>
            <span>المملكة المغربية - وزارة التربية الوطنية</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-colors cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>

      </div>
    </div>
  );
};
