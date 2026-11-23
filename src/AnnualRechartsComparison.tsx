import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Award,
  BarChart3,
  Users,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Filter,
  Layers,
} from 'lucide-react';

interface StudentProgressionItem {
  id: string | number;
  name: string;
  className: string;
  s1Avg: number;
  s2Avg: number;
  annualAvg: number;
  delta: number;
  s1Rank?: number;
  s2Rank?: number;
}

interface ClassComparisonItem {
  className: string;
  shortName: string;
  studentCount: number;
  s1Avg: number;
  s2Avg: number;
  annualAvg: number;
  delta: number;
  improvedCount: number;
  improvedRate: number;
  passRateS1: number;
  passRateS2: number;
}

interface ExamComparisonItem {
  examLabel: string;
  s1Avg: number;
  s2Avg: number;
  delta: number;
}

const FALLBACK_CLASSES: ClassComparisonItem[] = [
  {
    className: 'لا توجد أقسام مسجلة',
    shortName: '—',
    studentCount: 0,
    s1Avg: 0,
    s2Avg: 0,
    annualAvg: 0,
    delta: 0,
    improvedCount: 0,
    improvedRate: 0,
    passRateS1: 0,
    passRateS2: 0,
  },
];

const FALLBACK_EXAMS: ExamComparisonItem[] = [
  { examLabel: 'الفرض 1', s1Avg: 0, s2Avg: 0, delta: 0 },
  { examLabel: 'الفرض 2', s1Avg: 0, s2Avg: 0, delta: 0 },
  { examLabel: 'الفرض 3', s1Avg: 0, s2Avg: 0, delta: 0 },
  { examLabel: 'الأنشطة المندمجة', s1Avg: 0, s2Avg: 0, delta: 0 },
];

const FALLBACK_PROGRESSING_STUDENTS: StudentProgressionItem[] = [];

function computeNumericAverage(gradesObj: Record<string, any> | undefined, examKeys: string[]): number | null {
  if (!gradesObj || typeof gradesObj !== 'object') return null;
  let fSum = 0;
  let fCount = 0;
  for (const k of examKeys) {
    const raw = gradesObj[k];
    if (
      raw !== undefined &&
      raw !== null &&
      raw !== '' &&
      String(raw).toUpperCase() !== 'ABS' &&
      String(raw).trim() !== 'غ' &&
      String(raw).trim() !== 'إ'
    ) {
      const val = parseFloat(String(raw).replace(',', '.'));
      if (!isNaN(val) && val >= 0 && val <= 20) {
        fSum += val;
        fCount++;
      }
    }
  }
  return fCount > 0 ? fSum / fCount : null;
}

export const AnnualRechartsComparison: React.FC<{
  forcedClass?: string;
  compactMode?: boolean;
}> = ({ forcedClass, compactMode = false }) => {
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (forcedClass && forcedClass !== 'all') return forcedClass;
    const sel = document.getElementById('annualClassSelect') as HTMLSelectElement | null;
    return sel?.value || '';
  });
  const [leftChartMode, setLeftChartMode] = useState<'classes' | 'exams'>('classes');
  const [progressionSort, setProgressionSort] = useState<'delta' | 's2'>('delta');
  const [studentLimit, setStudentLimit] = useState<number>(10);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    if (forcedClass && forcedClass !== 'all') {
      setSelectedClass(forcedClass);
    }
  }, [forcedClass]);

  useEffect(() => {
    const syncState = () => {
      const sel = document.getElementById('annualClassSelect') as HTMLSelectElement | null;
      if (!forcedClass || forcedClass === 'all') {
        if (sel && sel.value) {
          setSelectedClass(sel.value);
        }
      }
      setRefreshTick((t) => t + 1);
    };

    const onClassSelectChange = () => syncState();
    const sel = document.getElementById('annualClassSelect');
    sel?.addEventListener('change', onClassSelectChange);
    window.addEventListener('annualClassChanged', syncState);
    window.addEventListener('dbUpdated', syncState);
    window.addEventListener('annualTabOpened', syncState);
    window.addEventListener('analysisTabOpened', syncState);

    return () => {
      sel?.removeEventListener('change', onClassSelectChange);
      window.removeEventListener('annualClassChanged', syncState);
      window.removeEventListener('dbUpdated', syncState);
      window.removeEventListener('annualTabOpened', syncState);
      window.removeEventListener('analysisTabOpened', syncState);
    };
  }, [forcedClass]);

  const {
    isFallback,
    activeClassName,
    classComparisonData,
    examComparisonData,
    positiveStudents,
    activeClassSummary,
  } = useMemo(() => {
    const win = window as any;
    const db = win.db;
    if (!db || !db.classes || typeof db.classes !== 'object') {
      return {
        isFallback: true,
        activeClassName: FALLBACK_CLASSES[0].className,
        classComparisonData: FALLBACK_CLASSES,
        examComparisonData: FALLBACK_EXAMS,
        positiveStudents: FALLBACK_PROGRESSING_STUDENTS,
        activeClassSummary: FALLBACK_CLASSES[0],
      };
    }

    const classNames = Object.keys(db.classes).filter((c) => {
      const list = Array.isArray(db.classes[c]) ? db.classes[c] : db.classes[c]?.students || [];
      return list.length > 0;
    });

    if (classNames.length === 0) {
      return {
        isFallback: true,
        activeClassName: FALLBACK_CLASSES[0].className,
        classComparisonData: FALLBACK_CLASSES,
        examComparisonData: FALLBACK_EXAMS,
        positiveStudents: FALLBACK_PROGRESSING_STUDENTS,
        activeClassSummary: FALLBACK_CLASSES[0],
      };
    }

    const resolvedActiveClass =
      selectedClass && classNames.includes(selectedClass) ? selectedClass : classNames[0];

    const getGradesHelper = (cName: string, st: any, sem: 1 | 2): Record<string, any> => {
      const semKey = sem === 2 ? 's2' : 's1';
      if (typeof win.getStudentGradesBySemester === 'function') {
        try {
          return win.getStudentGradesBySemester(cName, st.id, semKey) || {};
        } catch {
          // fallback below
        }
      }
      const record = db.grades?.[cName]?.[st.id] || {};
      if (sem === 2) {
        const s2Direct = db.gradesS2?.[cName]?.[st.id] || {};
        const s2Sub = record.s2 || st.grades?.s2 || {};
        return {
          f1: s2Sub.f1 !== undefined ? s2Sub.f1 : s2Direct.f1,
          f2: s2Sub.f2 !== undefined ? s2Sub.f2 : s2Direct.f2,
          f3: s2Sub.f3 !== undefined ? s2Sub.f3 : s2Direct.f3,
          f4: s2Sub.f4 !== undefined ? s2Sub.f4 : s2Direct.f4,
        };
      }
      const s1Direct = db.gradesS1?.[cName]?.[st.id] || {};
      const s1Sub = record.s1 || st.grades?.s1 || {};
      return {
        f1: s1Sub.f1 !== undefined ? s1Sub.f1 : (s1Direct.f1 !== undefined ? s1Direct.f1 : record.f1),
        f2: s1Sub.f2 !== undefined ? s1Sub.f2 : (s1Direct.f2 !== undefined ? s1Direct.f2 : record.f2),
        f3: s1Sub.f3 !== undefined ? s1Sub.f3 : (s1Direct.f3 !== undefined ? s1Direct.f3 : record.f3),
        f4: s1Sub.f4 !== undefined ? s1Sub.f4 : (s1Direct.f4 !== undefined ? s1Direct.f4 : record.f4),
      };
    };

    const getExamKeysForClass = (cName: string): string[] => {
      let count = 3;
      if (typeof win.getExamsCountForClass === 'function') {
        try {
          count = Number(win.getExamsCountForClass(cName)) || 3;
        } catch {
          count = 3;
        }
      } else if (db.settings?.examsCountByClass?.[cName]) {
        count = Number(db.settings.examsCountByClass[cName]) || 3;
      }
      return ['f1', 'f2', 'f3', 'f4'].slice(0, Math.max(1, Math.min(4, count)));
    };

    const computedClasses: ClassComparisonItem[] = [];
    let hasAnyRealData = false;

    const activeClassAllStudents: StudentProgressionItem[] = [];

    for (const cName of classNames) {
      const rawList = Array.isArray(db.classes[cName]) ? db.classes[cName] : db.classes[cName]?.students || [];
      const examKeys = getExamKeysForClass(cName);

      let sumS1 = 0;
      let cntS1 = 0;
      let passS1 = 0;

      let sumS2 = 0;
      let cntS2 = 0;
      let passS2 = 0;

      let sumAnnual = 0;
      let cntAnnual = 0;
      let improvedCount = 0;
      let comparableBothCount = 0;

      rawList.forEach((st: any) => {
        const g1 = getGradesHelper(cName, st, 1);
        const g2 = getGradesHelper(cName, st, 2);

        const avg1 = computeNumericAverage(g1, examKeys);
        const avg2 = computeNumericAverage(g2, examKeys);

        if (avg1 !== null) {
          sumS1 += avg1;
          cntS1++;
          if (avg1 >= 10) passS1++;
          hasAnyRealData = true;
        }
        if (avg2 !== null) {
          sumS2 += avg2;
          cntS2++;
          if (avg2 >= 10) passS2++;
          hasAnyRealData = true;
        }

        if (avg1 !== null && avg2 !== null) {
          const ann = (avg1 + avg2) / 2;
          const delta = Number((avg2 - avg1).toFixed(2));
          sumAnnual += ann;
          cntAnnual++;
          comparableBothCount++;
          if (delta > 0) improvedCount++;

          if (cName === resolvedActiveClass) {
            activeClassAllStudents.push({
              id: st.id,
              name: st.name || 'تلميذ',
              className: cName,
              s1Avg: Number(avg1.toFixed(2)),
              s2Avg: Number(avg2.toFixed(2)),
              annualAvg: Number(ann.toFixed(2)),
              delta,
            });
          }
        } else if (cName === resolvedActiveClass && (avg1 !== null || avg2 !== null)) {
          const s1Val = avg1 !== null ? Number(avg1.toFixed(2)) : 0;
          const s2Val = avg2 !== null ? Number(avg2.toFixed(2)) : 0;
          const annVal = avg1 !== null && avg2 !== null ? (s1Val + s2Val) / 2 : avg1 !== null ? s1Val : s2Val;
          activeClassAllStudents.push({
            id: st.id,
            name: st.name || 'تلميذ',
            className: cName,
            s1Avg: s1Val,
            s2Avg: s2Val,
            annualAvg: Number(annVal.toFixed(2)),
            delta: avg1 !== null && avg2 !== null ? Number((s2Val - s1Val).toFixed(2)) : 0,
          });
        }
      });

      const s1ClassAvg = cntS1 > 0 ? Number((sumS1 / cntS1).toFixed(2)) : 0;
      const s2ClassAvg = cntS2 > 0 ? Number((sumS2 / cntS2).toFixed(2)) : 0;
      const annualClassAvg =
        cntAnnual > 0
          ? Number((sumAnnual / cntAnnual).toFixed(2))
          : cntS1 > 0 && cntS2 > 0
          ? Number(((s1ClassAvg + s2ClassAvg) / 2).toFixed(2))
          : cntS1 > 0
          ? s1ClassAvg
          : s2ClassAvg;

      const classDelta =
        cntS1 > 0 && cntS2 > 0 ? Number((s2ClassAvg - s1ClassAvg).toFixed(2)) : 0;

      computedClasses.push({
        className: cName,
        shortName: cName.length > 16 ? cName.slice(0, 15) + '…' : cName,
        studentCount: rawList.length,
        s1Avg: s1ClassAvg,
        s2Avg: s2ClassAvg,
        annualAvg: annualClassAvg,
        delta: classDelta,
        improvedCount,
        improvedRate:
          comparableBothCount > 0 ? Number(((improvedCount / comparableBothCount) * 100).toFixed(1)) : 0,
        passRateS1: cntS1 > 0 ? Number(((passS1 / cntS1) * 100).toFixed(1)) : 0,
        passRateS2: cntS2 > 0 ? Number(((passS2 / cntS2) * 100).toFixed(1)) : 0,
      });
    }

    if (!hasAnyRealData) {
      return {
        isFallback: true,
        activeClassName: resolvedActiveClass || FALLBACK_CLASSES[0].className,
        classComparisonData: FALLBACK_CLASSES,
        examComparisonData: FALLBACK_EXAMS,
        positiveStudents: FALLBACK_PROGRESSING_STUDENTS,
        activeClassSummary: FALLBACK_CLASSES[0],
      };
    }

    // Compute per-exam S1 vs S2 averages for the active class
    const activeRawStudents = Array.isArray(db.classes[resolvedActiveClass])
      ? db.classes[resolvedActiveClass]
      : db.classes[resolvedActiveClass]?.students || [];
    const activeExamKeys = getExamKeysForClass(resolvedActiveClass);
    const examLabelsMap: Record<string, string> = {
      f1: 'الفرض 1',
      f2: 'الفرض 2',
      f3: 'الفرض 3',
      f4: 'الفرض 4',
    };

    const computedExams: ExamComparisonItem[] = [];
    for (const key of activeExamKeys) {
      let sum1 = 0;
      let c1 = 0;
      let sum2 = 0;
      let c2 = 0;
      activeRawStudents.forEach((st: any) => {
        const g1 = getGradesHelper(resolvedActiveClass, st, 1);
        const g2 = getGradesHelper(resolvedActiveClass, st, 2);
        const v1 = parseFloat(String(g1?.[key]).replace(',', '.'));
        const v2 = parseFloat(String(g2?.[key]).replace(',', '.'));
        if (!isNaN(v1) && v1 >= 0 && v1 <= 20) {
          sum1 += v1;
          c1++;
        }
        if (!isNaN(v2) && v2 >= 0 && v2 <= 20) {
          sum2 += v2;
          c2++;
        }
      });
      if (c1 > 0 || c2 > 0) {
        const a1 = c1 > 0 ? Number((sum1 / c1).toFixed(2)) : 0;
        const a2 = c2 > 0 ? Number((sum2 / c2).toFixed(2)) : 0;
        computedExams.push({
          examLabel: examLabelsMap[key] || key,
          s1Avg: a1,
          s2Avg: a2,
          delta: c1 > 0 && c2 > 0 ? Number((a2 - a1).toFixed(2)) : 0,
        });
      }
    }

    const posStudents = activeClassAllStudents.filter((s) => s.delta > 0);
    const sortedPos = [...posStudents].sort((a, b) =>
      progressionSort === 'delta' ? b.delta - a.delta : b.s2Avg - a.s2Avg
    );

    const activeSummary =
      computedClasses.find((c) => c.className === resolvedActiveClass) || computedClasses[0];

    return {
      isFallback: false,
      activeClassName: resolvedActiveClass,
      classComparisonData: computedClasses,
      examComparisonData: computedExams.length > 0 ? computedExams : FALLBACK_EXAMS,
      positiveStudents: sortedPos,
      activeClassSummary: activeSummary,
    };
  }, [selectedClass, progressionSort, refreshTick]);

  const displayedPositiveStudents = useMemo(() => {
    const sorted = [...positiveStudents].sort((a, b) =>
      progressionSort === 'delta' ? b.delta - a.delta : b.s2Avg - a.s2Avg
    );
    return sorted.slice(0, studentLimit).map((item) => ({
      ...item,
      shortName: item.name.split(' ').slice(0, 2).join(' '),
    }));
  }, [positiveStudents, progressionSort, studentLimit]);

  const topImprover = useMemo(() => {
    if (positiveStudents.length === 0) return null;
    return [...positiveStudents].sort((a, b) => b.delta - a.delta)[0];
  }, [positiveStudents]);

  const handleSelectStudentOnAnnualTable = (studentId: string | number) => {
    const win = window as any;
    if (typeof win.selectStudentForAnnualChart === 'function') {
      try {
        win.selectStudentForAnnualChart(String(studentId));
      } catch {
        // ignore if student is preview-only
      }
    }
  };

  const handleFilterTableByImproved = () => {
    const filterEl = document.getElementById('annualFilterSelect') as HTMLSelectElement | null;
    const win = window as any;
    if (filterEl) {
      filterEl.value = 'improved';
      if (typeof win.renderAnnualPerformanceTable === 'function') {
        win.renderAnnualPerformanceTable();
      }
      const tableEl = document.getElementById('annualPerformanceTable');
      tableEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSwitchActiveClass = (cName: string) => {
    if (isFallback) return;
    setSelectedClass(cName);
    const sel = document.getElementById('annualClassSelect') as HTMLSelectElement | null;
    const win = window as any;
    if (sel && sel.value !== cName) {
      sel.value = cName;
      if (typeof win.onAnnualClassChange === 'function') {
        win.onAnnualClassChange();
      }
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 md:p-5 mb-4 text-right"
      dir="rtl"
    >
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base md:text-lg font-black text-slate-900">
                لوحة المقارنة المبيانية المباشرة (Recharts): الدورة الأولى مقابل الدورة الثانية وإبراز التطور الإيجابي
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TrendingUp className="w-3.5 h-3.5" />
                تحليل مبياني تفاعلي (د1 ↔ د2)
              </span>
              {isFallback && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Sparkles className="w-3 h-3" />
                  معاينة توضيحية (تُحدَّث تلقائياً فور مسك نقط د1 ود2)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              مقارنة مبيانية مباشرة لمعدلات القسم والفروض بين الدورة الأولى والدورة الثانية مع تشخيص التلاميذ ذوي الطفرة التحصيلية الإيجابية (Δ = د2 - د1 &gt; 0)
            </p>
          </div>
        </div>

        {/* Quick Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isFallback && classComparisonData.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600">القسم النشط:</span>
              <select
                value={activeClassName}
                onChange={(e) => handleSwitchActiveClass(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer"
              >
                {classComparisonData.map((c) => (
                  <option key={c.className} value={c.className}>
                    {c.className}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleFilterTableByImproved}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors shadow-2xs cursor-pointer"
            title="تصفية جدول الحصيلة السنوية لإظهار التلاميذ ذوي التطور الإيجابي فقط"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>تصفية الجدول: المتطورون إيجابياً ({positiveStudents.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip for Selected Class */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-sky-800">معدل القسم في الدورة 1 (S1)</div>
            <div className="text-xl font-black text-sky-950 mt-0.5">
              {activeClassSummary.s1Avg.toFixed(2)}
              <span className="text-xs font-bold text-sky-600 mr-1">/ 20</span>
            </div>
            <div className="text-[11px] font-semibold text-sky-700 mt-0.5">
              نسبة الحاصلين على المعدل: {activeClassSummary.passRateS1}%
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-700 flex items-center justify-center font-black text-xs">
            د1
          </div>
        </div>

        <div className="rounded-xl bg-indigo-50/70 border border-indigo-200/80 p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-indigo-800">معدل القسم في الدورة 2 (S2)</div>
            <div className="text-xl font-black text-indigo-950 mt-0.5">
              {activeClassSummary.s2Avg.toFixed(2)}
              <span className="text-xs font-bold text-indigo-600 mr-1">/ 20</span>
            </div>
            <div className="text-[11px] font-semibold text-indigo-700 mt-0.5">
              نسبة الحاصلين على المعدل: {activeClassSummary.passRateS2}%
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-700 flex items-center justify-center font-black text-xs">
            د2
          </div>
        </div>

        <div
          className={`rounded-xl p-3 flex items-center justify-between border ${
            activeClassSummary.delta >= 0
              ? 'bg-emerald-50/80 border-emerald-200'
              : 'bg-rose-50/80 border-rose-200'
          }`}
        >
          <div>
            <div
              className={`text-[11px] font-bold ${
                activeClassSummary.delta >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              فارق تطور معدل القسم (د2 - د1)
            </div>
            <div
              className={`text-xl font-black mt-0.5 ${
                activeClassSummary.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
              dir="ltr"
            >
              {activeClassSummary.delta > 0 ? `+${activeClassSummary.delta.toFixed(2)}` : activeClassSummary.delta.toFixed(2)}
            </div>
            <div
              className={`text-[11px] font-semibold mt-0.5 ${
                activeClassSummary.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              المعدل السنوي العام: {activeClassSummary.annualAvg.toFixed(2)} / 20
            </div>
          </div>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              activeClassSummary.delta >= 0
                ? 'bg-emerald-500/15 text-emerald-700'
                : 'bg-rose-500/15 text-rose-700'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-xl bg-amber-50/80 border border-amber-200/90 p-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-900">التلاميذ ذوو التطور الإيجابي</div>
            <div className="text-xl font-black text-amber-950 mt-0.5">
              {positiveStudents.length}
              <span className="text-xs font-bold text-amber-700 mr-1">
                تلميذ ({activeClassSummary.improvedRate}%)
              </span>
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5 truncate max-w-[190px]">
              {topImprover
                ? `أعلى قفزة: ${topImprover.name} (+${topImprover.delta.toFixed(2)})`
                : 'في انتظار استكمال نقط الدورتين'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Dual Recharts Grid */}
      <div className={`grid grid-cols-1 ${compactMode ? 'xl:grid-cols-2' : 'lg:grid-cols-12'} gap-4`}>
        {/* Chart 1: Direct Comparison of Class Averages (S1 vs S2) */}
        <div
          className={`${
            compactMode ? '' : 'lg:col-span-6'
          } bg-slate-50/70 rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                <span>
                  {leftChartMode === 'classes'
                    ? 'مقارنة مباشرة لمعدلات الأقسام: الدورة 1 مقابل الدورة 2'
                    : `مقارنة فروض (${activeClassName}): الدورة 1 مقابل الدورة 2`}
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {leftChartMode === 'classes'
                  ? 'مقارنة شاملة لمعدل الدورة الأولى (أزرق) والدورة الثانية (نيلي) والمعدل السنوي (أخضر) لكل قسم'
                  : 'رصد تطور تحصيل القسم في كل فرض مستمر والأنشطة المندمجة بين الدورتين'}
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setLeftChartMode('classes')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                  leftChartMode === 'classes'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                مقارنة الأقسام (د1 ↔ د2)
              </button>
              <button
                type="button"
                onClick={() => setLeftChartMode('exams')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                  leftChartMode === 'exams'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                مقارنة الفروض (د1 ↔ د2)
              </button>
            </div>
          </div>

          <div className="w-full h-[290px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {leftChartMode === 'classes' ? (
                <ComposedChart
                  data={classComparisonData}
                  margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 20]}
                    ticks={[0, 5, 10, 12, 15, 20]}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      direction: 'rtl',
                      textAlign: 'right',
                    }}
                    formatter={(value: any, name: any) => [`${Number(value).toFixed(2)} / 20`, name]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as ClassComparisonItem | undefined;
                      if (!row) return label;
                      const sign = row.delta > 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2);
                      return `${row.className} (التطور: ${sign} | المتحسنون: ${row.improvedCount})`;
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }}
                  />
                  <ReferenceLine
                    y={10}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: 'عتبة المعدل (10)',
                      position: 'insideTopLeft',
                      fill: '#dc2626',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                  <Bar
                    dataKey="s1Avg"
                    name="معدل الدورة الأولى (د1)"
                    fill="#0ea5e9"
                    radius={[6, 6, 0, 0]}
                    barSize={26}
                  />
                  <Bar
                    dataKey="s2Avg"
                    name="معدل الدورة الثانية (د2)"
                    fill="#4f46e5"
                    radius={[6, 6, 0, 0]}
                    barSize={26}
                  />
                  <Line
                    type="monotone"
                    dataKey="annualAvg"
                    name="المعدل السنوي العام"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart
                  data={examComparisonData}
                  margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="examLabel"
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    domain={[0, 20]}
                    ticks={[0, 5, 10, 12, 15, 20]}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      direction: 'rtl',
                      textAlign: 'right',
                    }}
                    formatter={(value: any, name: any) => [`${Number(value).toFixed(2)} / 20`, name]}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as ExamComparisonItem | undefined;
                      if (!row) return label;
                      const sign = row.delta > 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2);
                      return `${row.examLabel} (فارق د2 - د1: ${sign})`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                  <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 4" />
                  <Bar
                    dataKey="s1Avg"
                    name="معدل الفرض في الدورة 1"
                    fill="#0284c7"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  />
                  <Bar
                    dataKey="s2Avg"
                    name="معدل الفرض في الدورة 2"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={28}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Highlighting Students with Positive Progression (التلاميذ ذوو التطور الإيجابي) */}
        <div
          className={`${
            compactMode ? '' : 'lg:col-span-6'
          } bg-emerald-50/40 rounded-2xl border border-emerald-200/80 p-4 flex flex-col justify-between`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-black text-emerald-950 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>إبراز التلاميذ ذوي التطور الإيجابي (د1 ← د2)</span>
              </h4>
              <p className="text-[11px] text-emerald-800/80 mt-0.5">
                مقارنة معدل الدورة 1 ومعدل الدورة 2 للتلاميذ الذين حققوا طفرة إيجابية (+Δ) — انقر على أي عمود لعرض مسار التلميذ
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-xl bg-white p-1 border border-emerald-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setProgressionSort('delta')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                    progressionSort === 'delta'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  الأعلى تطوراً (+Δ)
                </button>
                <button
                  type="button"
                  onClick={() => setProgressionSort('s2')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                    progressionSort === 's2'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`}
                >
                  الأعلى معدلاً (د2)
                </button>
              </div>

              <select
                value={studentLimit}
                onChange={(e) => setStudentLimit(Number(e.target.value))}
                className="bg-white border border-emerald-200 rounded-xl px-2 py-1 text-[11px] font-extrabold text-emerald-900 cursor-pointer"
                title="عدد التلاميذ المعروضين في المبيان"
              >
                <option value={8}>أفضل 8</option>
                <option value={12}>أفضل 12</option>
                <option value={20}>أفضل 20</option>
              </select>
            </div>
          </div>

          {displayedPositiveStudents.length > 0 ? (
            <div className="w-full h-[290px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={displayedPositiveStudents}
                  margin={{ top: 12, right: 16, left: 0, bottom: 24 }}
                  onClick={(state: any) => {
                    const stId = state?.activePayload?.[0]?.payload?.id;
                    if (stId) handleSelectStudentOnAnnualTable(stId);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    angle={-20}
                    textAnchor="end"
                    height={48}
                    tick={{ fontSize: 10.5, fontWeight: 800, fill: '#064e3b' }}
                    axisLine={{ stroke: '#a7f3d0' }}
                  />
                  <YAxis
                    yAxisId="grade"
                    domain={[0, 20]}
                    ticks={[0, 5, 10, 12, 15, 20]}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#065f46' }}
                    axisLine={{ stroke: '#a7f3d0' }}
                  />
                  <YAxis
                    yAxisId="delta"
                    orientation="right"
                    domain={[0, 'dataMax + 2']}
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#d97706' }}
                    axisLine={{ stroke: '#fde68a' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#064e3b',
                      borderColor: '#059669',
                      borderRadius: '12px',
                      color: '#ecfdf5',
                      fontSize: '12px',
                      direction: 'rtl',
                      textAlign: 'right',
                    }}
                    formatter={(value: any, name: any) => {
                      if (String(name).includes('فارق')) {
                        return [`+${Number(value).toFixed(2)} نقطة`, name];
                      }
                      return [`${Number(value).toFixed(2)} / 20`, name];
                    }}
                    labelFormatter={(_, payload) => {
                      const st = payload?.[0]?.payload as StudentProgressionItem | undefined;
                      if (!st) return '';
                      return `🌟 ${st.name} — تطور إيجابي: +${st.delta.toFixed(2)} (المعدل السنوي: ${st.annualAvg.toFixed(2)})`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '4px' }} />
                  <ReferenceLine yAxisId="grade" y={10} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar
                    yAxisId="grade"
                    dataKey="s1Avg"
                    name="معدل الدورة 1 (S1)"
                    fill="#94a3b8"
                    radius={[5, 5, 0, 0]}
                    barSize={18}
                    cursor="pointer"
                  />
                  <Bar
                    yAxisId="grade"
                    dataKey="s2Avg"
                    name="معدل الدورة 2 (S2)"
                    fill="#10b981"
                    radius={[5, 5, 0, 0]}
                    barSize={18}
                    cursor="pointer"
                  >
                    {displayedPositiveStudents.map((entry, idx) => (
                      <Cell
                        key={`cell-${entry.id}-${idx}`}
                        fill={entry.delta >= 2 ? '#059669' : '#10b981'}
                      />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="delta"
                    type="monotone"
                    dataKey="delta"
                    name="فارق التطور الإيجابي (+Δ)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 1.5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[290px] flex flex-col items-center justify-center text-center p-6 bg-white/70 rounded-xl border border-dashed border-emerald-200">
              <Users className="w-8 h-8 text-emerald-500 mb-2" />
              <div className="text-sm font-bold text-slate-700">
                لا يوجد بعد تلاميذ بفارق تطور إيجابي مسجل في هذا القسم
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                بمجرد مسك نقط الدورة الأولى والدورة الثانية في سجل النقط، سيبرز هذا المبيان تلقائياً جميع التلاميذ الذين تحسنت معدلاتهم في الدورة الثانية.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Honour Roll Strip: Top Positively Progressing Students Cards */}
      {positiveStudents.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>لوحة شرف التطور الإيجابي في القسم ({positiveStudents.length} تلميذ متحسن بين د1 ود2):</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              انقر على بطاقة التلميذ لعرض منحنى تطوره الفردي أسفله
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {positiveStudents.slice(0, 6).map((st, idx) => (
              <button
                key={st.id}
                type="button"
                onClick={() => handleSelectStudentOnAnnualTable(st.id)}
                className="text-right group rounded-xl p-2.5 bg-gradient-to-bl from-emerald-50/90 via-white to-teal-50/60 border border-emerald-200/90 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                    {idx + 1}
                  </span>
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black"
                    dir="ltr"
                  >
                    <ArrowUpRight className="w-3 h-3" />+{st.delta.toFixed(2)}
                  </span>
                </div>

                <div className="font-extrabold text-xs text-slate-900 truncate mt-1.5 group-hover:text-emerald-800">
                  {st.name}
                </div>

                <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-600 mt-1 pt-1 border-t border-emerald-100">
                  <span>د1: {st.s1Avg.toFixed(2)}</span>
                  <span className="text-emerald-700 font-black">د2: {st.s2Avg.toFixed(2)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnualRechartsComparison;
