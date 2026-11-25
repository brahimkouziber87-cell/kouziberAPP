import React, { useState, useMemo, useEffect } from 'react';
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
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  MessageCircle,
  FileText,
  User,
  Filter,
  TrendingUp,
  BookOpen,
} from 'lucide-react';

interface StudentDayAbsence {
  id: string;
  name: string;
  className: string;
  totalHours: number;
  unjustifiedHours: number;
  justifiedHours: number;
  incidents: number;
  lastDate: string;
}

interface WeekdayStatItem {
  dayIdx: number;
  dayName: string;
  shortName: string;
  totalHours: number;
  unjustifiedHours: number;
  justifiedHours: number;
  lateCount: number;
  incidentCount: number;
  uniqueStudentsCount: number;
  percentOfTotal: number;
  rank: number;
  isPeak: boolean;
  isSecondPeak: boolean;
  students: StudentDayAbsence[];
}

const WEEKDAY_NAMES_AR: Record<number, { full: string; short: string }> = {
  1: { full: 'الإثنين', short: 'الإثنين' },
  2: { full: 'الثلاثاء', short: 'الثلاثاء' },
  3: { full: 'الأربعاء', short: 'الأربعاء' },
  4: { full: 'الخميس', short: 'الخميس' },
  5: { full: 'الجمعة', short: 'الجمعة' },
  6: { full: 'السبت', short: 'السبت' },
  0: { full: 'الأحد', short: 'الأحد' },
};

const SCHOOL_DAYS_ORDER = [1, 2, 3, 4, 5, 6];

const PREVIEW_WEEKDAY_DATA: WeekdayStatItem[] = [
  {
    dayIdx: 1,
    dayName: 'الإثنين',
    shortName: 'الإثنين',
    totalHours: 7,
    unjustifiedHours: 5,
    justifiedHours: 2,
    lateCount: 3,
    incidentCount: 5,
    uniqueStudentsCount: 4,
    percentOfTotal: 17.5,
    rank: 2,
    isPeak: false,
    isSecondPeak: true,
    students: [
      { id: 'd1', name: 'ياسين العمراني', className: 'جذع مشترك علمي 1', totalHours: 3, unjustifiedHours: 3, justifiedHours: 0, incidents: 2, lastDate: '2026-11-09' },
      { id: 'd2', name: 'سلمى المنصوري', className: 'جذع مشترك علمي 1', totalHours: 2, unjustifiedHours: 0, justifiedHours: 2, incidents: 1, lastDate: '2026-11-02' },
    ],
  },
  {
    dayIdx: 2,
    dayName: 'الثلاثاء',
    shortName: 'الثلاثاء',
    totalHours: 3,
    unjustifiedHours: 2,
    justifiedHours: 1,
    lateCount: 1,
    incidentCount: 2,
    uniqueStudentsCount: 2,
    percentOfTotal: 7.5,
    rank: 5,
    isPeak: false,
    isSecondPeak: false,
    students: [],
  },
  {
    dayIdx: 3,
    dayName: 'الأربعاء',
    shortName: 'الأربعاء',
    totalHours: 4,
    unjustifiedHours: 3,
    justifiedHours: 1,
    lateCount: 2,
    incidentCount: 3,
    uniqueStudentsCount: 3,
    percentOfTotal: 10.0,
    rank: 4,
    isPeak: false,
    isSecondPeak: false,
    students: [],
  },
  {
    dayIdx: 4,
    dayName: 'الخميس',
    shortName: 'الخميس',
    totalHours: 2,
    unjustifiedHours: 1,
    justifiedHours: 1,
    lateCount: 1,
    incidentCount: 2,
    uniqueStudentsCount: 2,
    percentOfTotal: 5.0,
    rank: 6,
    isPeak: false,
    isSecondPeak: false,
    students: [],
  },
  {
    dayIdx: 5,
    dayName: 'الجمعة',
    shortName: 'الجمعة',
    totalHours: 6,
    unjustifiedHours: 4,
    justifiedHours: 2,
    lateCount: 2,
    incidentCount: 4,
    uniqueStudentsCount: 4,
    percentOfTotal: 15.0,
    rank: 3,
    isPeak: false,
    isSecondPeak: false,
    students: [
      { id: 'd3', name: 'حمزة الإدريسي', className: 'الأولى بكالوريا علوم 1', totalHours: 4, unjustifiedHours: 4, justifiedHours: 0, incidents: 2, lastDate: '2026-11-06' },
    ],
  },
  {
    dayIdx: 6,
    dayName: 'السبت',
    shortName: 'السبت',
    totalHours: 18,
    unjustifiedHours: 14,
    justifiedHours: 4,
    lateCount: 5,
    incidentCount: 11,
    uniqueStudentsCount: 7,
    percentOfTotal: 45.0,
    rank: 1,
    isPeak: true,
    isSecondPeak: false,
    students: [
      { id: 'd4', name: 'أمين التازي', className: 'جذع مشترك علمي 1', totalHours: 6, unjustifiedHours: 6, justifiedHours: 0, incidents: 3, lastDate: '2026-11-14' },
      { id: 'd5', name: 'عمر البقالي', className: 'جذع مشترك علمي 1', totalHours: 4, unjustifiedHours: 4, justifiedHours: 0, incidents: 2, lastDate: '2026-11-14' },
      { id: 'd6', name: 'آية بنجلون', className: 'الأولى بكالوريا علوم 1', totalHours: 4, unjustifiedHours: 2, justifiedHours: 2, incidents: 2, lastDate: '2026-11-07' },
    ],
  },
];

function getSafeStudentsList(classesObj: any, className: string): any[] {
  if (!classesObj || !className || !classesObj[className]) return [];
  const raw = classesObj[className];
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.students)) return raw.students;
  return [];
}

export const WeekdayAbsenceDistributionCard: React.FC<{
  dbProp?: any;
  classNamesProp?: string[];
}> = ({ dbProp, classNamesProp }) => {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '30days' | 'month' | 's1' | 's2'>('all');
  const [activeDayIdx, setActiveDayIdx] = useState<number | null>(null);
  const [showDemoWhenEmpty, setShowDemoWhenEmpty] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    const handleSync = () => setRefreshTick((t) => t + 1);
    window.addEventListener('dbUpdated', handleSync);
    window.addEventListener('dashboardTabOpened', handleSync);
    window.addEventListener('reportsEvolutionTabOpened', handleSync);
    return () => {
      window.removeEventListener('dbUpdated', handleSync);
      window.removeEventListener('dashboardTabOpened', handleSync);
      window.removeEventListener('reportsEvolutionTabOpened', handleSync);
    };
  }, []);

  const {
    classNames,
    daysData,
    grandTotalHours,
    grandTotalUnjustified,
    grandTotalJustified,
    grandTotalLates,
    averageDayHours,
    peakDay,
    secondPeakDay,
    weekendConcentrationPct,
    isUsingPreviewData,
  } = useMemo(() => {
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const db = dbProp || win.db || {};
    const classesObj = db.classes || {};
    const resolvedClassNames =
      Array.isArray(classNamesProp) && classNamesProp.length > 0
        ? classNamesProp
        : Object.keys(classesObj).filter((c) => getSafeStudentsList(classesObj, c).length > 0);

    const allRecords: any[] = Array.isArray(db.records) ? db.records : [];
    const nowObj = typeof win.getAppNow === 'function' ? win.getAppNow() : new Date();
    const curYear = nowObj.getFullYear();
    const curMonthPrefix = `${curYear}-${String(nowObj.getMonth() + 1).padStart(2, '0')}`;
    const d30 = new Date(nowObj.getFullYear(), nowObj.getMonth(), nowObj.getDate() - 30);
    const thirtyDaysAgo = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, '0')}-${String(d30.getDate()).padStart(2, '0')}`;

    const isProtectedRecord =
      typeof win.isRecordProtectedHolidayOrLeave === 'function' ? win.isRecordProtectedHolidayOrLeave : null;
    const isDisabledDate =
      typeof win.isAbsenceDisabledOnDate === 'function' ? win.isAbsenceDisabledOnDate : null;
    const getDuration =
      typeof win.getRecordAbsenceDuration === 'function'
        ? win.getRecordAbsenceDuration
        : (rec: any) =>
            rec?.part === 'h1' || rec?.part === 'h2' ? 1 : parseFloat(rec?.duration ?? rec?.hours) || 1;

    const buckets: Record<
      number,
      {
        dayIdx: number;
        totalHours: number;
        unjustifiedHours: number;
        justifiedHours: number;
        lateCount: number;
        incidentCount: number;
        studentsMap: Record<string, StudentDayAbsence>;
      }
    > = {};

    for (let i = 0; i <= 6; i++) {
      buckets[i] = {
        dayIdx: i,
        totalHours: 0,
        unjustifiedHours: 0,
        justifiedHours: 0,
        lateCount: 0,
        incidentCount: 0,
        studentsMap: {},
      };
    }

    let totalHours = 0;
    let totalUnjustified = 0;
    let totalJustified = 0;
    let totalLates = 0;

    for (let i = 0; i < allRecords.length; i++) {
      const rec = allRecords[i];
      if (!rec || !rec.date || typeof rec.date !== 'string') continue;

      const recClass = rec.className || rec.class || '';
      if (selectedClass !== 'all' && recClass !== selectedClass) continue;

      // Time period filter
      const dStr = rec.date.slice(0, 10);
      if (selectedPeriod === 'month' && !dStr.startsWith(curMonthPrefix)) continue;
      if (selectedPeriod === '30days' && dStr < thirtyDaysAgo) continue;
      if (selectedPeriod === 's1') {
        const mNum = parseInt(dStr.slice(5, 7), 10);
        if (mNum >= 2 && mNum <= 7) continue;
      }
      if (selectedPeriod === 's2') {
        const mNum = parseInt(dStr.slice(5, 7), 10);
        if (mNum >= 9 || mNum <= 1) continue;
      }

      if (isProtectedRecord && isProtectedRecord(rec)) continue;
      if (isDisabledDate) {
        const chk = isDisabledDate(dStr, rec.session);
        if (typeof chk === 'boolean' ? chk : !!(chk && chk.disabled)) continue;
      }

      const parts = dStr.split('-');
      if (parts.length !== 3) continue;
      const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (isNaN(dt.getTime())) continue;
      const dayIdx = dt.getDay();

      if (rec.status === 'متأخر') {
        buckets[dayIdx].lateCount += 1;
        totalLates += 1;
        continue;
      }

      if (rec.status !== 'غائب' && rec.status !== 'مبرر') continue;

      const dur = Number(getDuration(rec)) || 1;
      const b = buckets[dayIdx];
      b.totalHours = Number((b.totalHours + dur).toFixed(1));
      b.incidentCount += 1;
      totalHours = Number((totalHours + dur).toFixed(1));

      if (rec.status === 'غائب') {
        b.unjustifiedHours = Number((b.unjustifiedHours + dur).toFixed(1));
        totalUnjustified = Number((totalUnjustified + dur).toFixed(1));
      } else {
        b.justifiedHours = Number((b.justifiedHours + dur).toFixed(1));
        totalJustified = Number((totalJustified + dur).toFixed(1));
      }

      const cls = rec.className || rec.class || 'القسم';
      const stdId = String(rec.studentId || '');
      const stdKey = `${cls}__${stdId}`;
      if (!b.studentsMap[stdKey]) {
        const classStudents = getSafeStudentsList(classesObj, cls);
        const foundStd = classStudents.find((s: any) => String(s.id) === stdId);
        b.studentsMap[stdKey] = {
          id: stdId,
          name: foundStd?.name || rec.studentName || `تلميذ #${stdId}`,
          className: cls,
          totalHours: 0,
          unjustifiedHours: 0,
          justifiedHours: 0,
          incidents: 0,
          lastDate: dStr,
        };
      }
      const stEntry = b.studentsMap[stdKey];
      stEntry.totalHours = Number((stEntry.totalHours + dur).toFixed(1));
      if (rec.status === 'غائب') {
        stEntry.unjustifiedHours = Number((stEntry.unjustifiedHours + dur).toFixed(1));
      } else {
        stEntry.justifiedHours = Number((stEntry.justifiedHours + dur).toFixed(1));
      }
      stEntry.incidents += 1;
      if (dStr > stEntry.lastDate) stEntry.lastDate = dStr;
    }

    // Check if we should display preview data when no real absences exist
    if (totalHours === 0 && showDemoWhenEmpty) {
      const previewTotal = 40;
      const previewAvg = Number((previewTotal / 6).toFixed(1));
      const pPeak = PREVIEW_WEEKDAY_DATA.find((d) => d.isPeak) || PREVIEW_WEEKDAY_DATA[5];
      const pSecond = PREVIEW_WEEKDAY_DATA.find((d) => d.isSecondPeak) || PREVIEW_WEEKDAY_DATA[0];
      return {
        classNames: resolvedClassNames,
        daysData: PREVIEW_WEEKDAY_DATA,
        grandTotalHours: previewTotal,
        grandTotalUnjustified: 29,
        grandTotalJustified: 11,
        grandTotalLates: 14,
        averageDayHours: previewAvg,
        peakDay: pPeak,
        secondPeakDay: pSecond,
        weekendConcentrationPct: 60.0,
        isUsingPreviewData: true,
      };
    }

    const activeDayIndices = [...SCHOOL_DAYS_ORDER];
    if (buckets[0].totalHours > 0 || buckets[0].lateCount > 0) {
      activeDayIndices.push(0);
    }

    const processed: WeekdayStatItem[] = activeDayIndices.map((idx) => {
      const b = buckets[idx];
      const pct = totalHours > 0 ? Number(((b.totalHours / totalHours) * 100).toFixed(1)) : 0;
      const students = Object.values(b.studentsMap).sort(
        (a, c) => c.totalHours - a.totalHours || c.incidents - a.incidents
      );
      return {
        dayIdx: idx,
        dayName: WEEKDAY_NAMES_AR[idx]?.full || '',
        shortName: WEEKDAY_NAMES_AR[idx]?.short || '',
        totalHours: b.totalHours,
        unjustifiedHours: b.unjustifiedHours,
        justifiedHours: b.justifiedHours,
        lateCount: b.lateCount,
        incidentCount: b.incidentCount,
        uniqueStudentsCount: students.length,
        percentOfTotal: pct,
        rank: 0,
        isPeak: false,
        isSecondPeak: false,
        students,
      };
    });

    const sorted = [...processed].sort(
      (a, b) => b.totalHours - a.totalHours || b.incidentCount - a.incidentCount
    );
    sorted.forEach((item, rIdx) => {
      const target = processed.find((p) => p.dayIdx === item.dayIdx);
      if (target) {
        target.rank = rIdx + 1;
        target.isPeak = rIdx === 0 && target.totalHours > 0;
        target.isSecondPeak = rIdx === 1 && target.totalHours > 0;
      }
    });

    const pDay = sorted[0] && sorted[0].totalHours > 0 ? sorted[0] : null;
    const sDay = sorted[1] && sorted[1].totalHours > 0 ? sorted[1] : null;
    const friHours = buckets[5]?.totalHours || 0;
    const satHours = buckets[6]?.totalHours || 0;
    const weekendPct =
      totalHours > 0 ? Number((((friHours + satHours) / totalHours) * 100).toFixed(1)) : 0;
    const nonZeroDays = processed.filter((d) => d.totalHours > 0).length;
    const avgHours = nonZeroDays > 0 ? Number((totalHours / nonZeroDays).toFixed(1)) : 0;

    return {
      classNames: resolvedClassNames,
      daysData: processed,
      grandTotalHours: totalHours,
      grandTotalUnjustified: totalUnjustified,
      grandTotalJustified: totalJustified,
      grandTotalLates: totalLates,
      averageDayHours: avgHours,
      peakDay: pDay,
      secondPeakDay: sDay,
      weekendConcentrationPct: weekendPct,
      isUsingPreviewData: false,
    };
  }, [dbProp, classNamesProp, selectedClass, selectedPeriod, showDemoWhenEmpty, refreshTick]);

  const focusedDay = useMemo(() => {
    if (activeDayIdx !== null) {
      return daysData.find((d) => d.dayIdx === activeDayIdx) || peakDay || daysData[0];
    }
    return peakDay || daysData[0];
  }, [activeDayIdx, daysData, peakDay]);

  const pedagogicalRecommendations = useMemo(() => {
    if (!focusedDay || focusedDay.totalHours === 0) return [];
    const idx = focusedDay.dayIdx;
    const dName = focusedDay.dayName;

    if (idx === 5 || idx === 6) {
      return [
        {
          domain: 'قرار بيداغوجي وديداكتيكي (مادة الرياضيات)',
          action: `برمجة روائز قصيرة تقويمية (Flash Test — 10 دقائق) أو حصة تطبيقات موجهة ومصححة جماعياً يوم ${dName} لتعزيز القيمة البيداغوجية للحصة والحد من ظاهرة تمديد عطلة نهاية الأسبوع.`,
        },
        {
          domain: 'تدبير زمن التعلمات والمقرر',
          action: `تفادي تقديم المفاهيم الرياضية التأسيسية الجديدة بمعزل عن أوراق عمل داعمة يوم ${dName}، مع ربط الحضور بنقطة المواظبة والأنشطة المندمجة.`,
        },
        {
          domain: 'إجراء إداري وتواصلي استباقي',
          action: `إشعار أولياء أمور التلاميذ المتكرري الغياب يوم ${dName} (${focusedDay.uniqueStudentsCount} تلميذ) وتفعيل بطاقة المتابعة مع الحراسة العامة قبل نهاية الأسبوع.`,
        },
      ];
    }

    if (idx === 1) {
      return [
        {
          domain: 'قرار بيداغوجي وديداكتيكي (مادة الرياضيات)',
          action: `استهلال حصة يوم الإثنين بنشاط تذكيري سريع (5 دقائق) ومراقبة الواجبات المنزلية الأسبوعية لضمان انخراط التلاميذ منذ الساعة الأولى للأسبوع.`,
        },
        {
          domain: 'تدبير الفروض والواجبات',
          action: `تجنب تكليف التلاميذ بسلاسل تمارين مطولة جداً خلال عطلة نهاية الأسبوع قد تدفع المتعثرين للتغيب يوم الإثنين هرباً من المراقبة، واعتماد تمارين متدرجة.`,
        },
        {
          domain: 'إجراء إداري وتواصلي',
          action: `مراسلة أولياء أمور التلاميذ المسجلين في قائمة تكرار غياب يوم الإثنين لضبط مواظبتهم الصباحية.`,
        },
      ];
    }

    return [
      {
        domain: 'قرار بيداغوجي وديداكتيكي (مادة الرياضيات)',
        action: `اعتماد التعلم التعاوني الثنائي والعمل بالمجموعات الصغرى خلال حصة يوم ${dName} لتخفيف العبء الذهني لمنتصف الأسبوع ورفع الدافعية.`,
      },
      {
        domain: 'تنسيق تربوي ومؤسساتي',
        action: `مراجعة جدولة الفروض المحروسة مع أساتذة المواد الأخرى لتفادي تزامن فروض متعددة تدفع بعض التلاميذ للتغيب الانتقائي يوم ${dName}.`,
      },
      {
        domain: 'مواكبة فردية للمتغيبين',
        action: `تفعيل الدعم الاستدراكي الفوري للتلاميذ الـ (${focusedDay.uniqueStudentsCount}) الذين تضرر تحصيلهم جراء الغياب يوم ${dName}.`,
      },
    ];
  }, [focusedDay]);

  const handleTriggerStudentAction = (
    student: StudentDayAbsence,
    action: 'wa' | 'summons' | 'profile'
  ) => {
    const win = window as any;
    if (action === 'profile') {
      if (typeof win.openStudentQuickModal === 'function') {
        win.openStudentQuickModal(student.className, student.id);
      }
      return;
    }
    if (typeof win.openDashboardDecisionModal === 'function') {
      win.openDashboardDecisionModal(student.id, student.className, action);
    }
  };

  const handleOpenPreventativePlan = () => {
    const win = window as any;
    const targetSection = document.getElementById('dashWeekdayAbsenceSection');
    if (targetSection && typeof win.toggleDashboardPreventativePlan === 'function') {
      win.toggleDashboardPreventativePlan(focusedDay?.dayIdx ?? null);
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (typeof win.switchTab === 'function') {
      win.switchTab('dashboard');
      setTimeout(() => {
        if (typeof win.toggleDashboardPreventativePlan === 'function') {
          win.toggleDashboardPreventativePlan(focusedDay?.dayIdx ?? null);
        }
      }, 200);
    }
  };

  return (
    <div
      id="weekdayAbsenceInteractiveCard"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-5 text-right"
      dir="rtl"
    >
      {/* Top Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 flex-shrink-0 mt-0.5">
            <Calendar className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              توزيع الغياب بحسب أيام الأسبوع وتشخيص أيام الذروة (Weekly Peak-Day Decision Analytics)
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
              <span>مبيان تفاعلي مزدوج</span>
              <span aria-hidden="true">·</span>
              <span>
                {peakDay
                  ? `ذروة الغياب: يوم ${peakDay.dayName} (${peakDay.totalHours} س — ${peakDay.percentOfTotal}%)`
                  : 'انضباط تام بدون غيابات مسجلة'}
              </span>
              {isUsingPreviewData && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-bold">
                    وضع المعاينة التربوية (تُعوض تلقائياً فور تسجيل الغياب)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex items-center gap-2.5 flex-nowrap overflow-x-auto max-w-full shrink-0 py-0.5">
          <div className="inline-flex items-center gap-2 bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-blue-300 shadow-2xs rounded-xl px-3 h-9 shrink-0 transition-all">
            <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ width: 'auto', margin: 0, padding: '0 2px', height: '100%', border: 'none', background: 'transparent', boxShadow: 'none' }}
              className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
              aria-label="تصفية حسب القسم"
            >
              <option value="all">جميع الأقسام المسندة</option>
              {classNames.map((c) => (
                <option key={c} value={c}>
                  قسم {c}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 h-9 shrink-0 shadow-2xs">
            {[
              { id: 'all', label: 'الموسم الكامل' },
              { id: '30days', label: 'آخر 30 يوماً' },
              { id: 'month', label: 'الشهر الحالي' },
              { id: 's1', label: 'د1' },
              { id: 's2', label: 'د2' },
            ].map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedPeriod(period.id as any)}
                style={{ margin: 0, padding: '0 10px', height: '26px' }}
                className={`inline-flex items-center justify-center text-[11px] font-extrabold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedPeriod === period.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          {isUsingPreviewData && (
            <button
              type="button"
              onClick={() => setShowDemoWhenEmpty(false)}
              style={{ margin: 0, padding: '0 10px', height: '36px' }}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs transition-colors"
            >
              إخفاء المعاينة
            </button>
          )}
        </div>
      </div>

      {/* Top 4 Executive KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-rose-800">يوم الذروة الأول (#1 Peak)</div>
            <div className="text-lg font-black text-rose-950 mt-0.5 tabular-nums">
              {peakDay ? `يوم ${peakDay.dayName}` : 'لا يوجد'}
            </div>
            <div className="text-[11px] font-semibold text-rose-700 mt-0.5 tabular-nums">
              {peakDay
                ? `${peakDay.totalHours} ساعة (${peakDay.percentOfTotal}% من الأسبوع)`
                : '0 ساعة غياب'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-amber-900">يوم الذروة الثاني (#2)</div>
            <div className="text-lg font-black text-amber-950 mt-0.5 tabular-nums">
              {secondPeakDay ? `يوم ${secondPeakDay.dayName}` : 'لا يوجد'}
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5 tabular-nums">
              {secondPeakDay
                ? `${secondPeakDay.totalHours} ساعة (${secondPeakDay.percentOfTotal}% من الأسبوع)`
                : '0 ساعة غياب'}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-600">إجمالي الساعات (غير مبرر / مبرر)</div>
            <div className="text-lg font-black text-slate-900 mt-0.5 tabular-nums">
              {grandTotalHours} ساعة
            </div>
            <div className="text-[11px] font-semibold text-slate-600 mt-0.5 tabular-nums">
              غير مبرر: <span className="text-rose-700 font-bold">{grandTotalUnjustified} س</span> · مبرر:{' '}
              <span className="text-emerald-700 font-bold">{grandTotalJustified} س</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-200/70 text-slate-700 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-indigo-900">تركز نهاية الأسبوع (الجمعة + السبت)</div>
            <div className="text-lg font-black text-indigo-950 mt-0.5 tabular-nums">
              {weekendConcentrationPct}%
            </div>
            <div className="text-[11px] font-semibold text-indigo-700 mt-0.5 tabular-nums">
              المتوسط اليومي للأسبوع: {averageDayHours} س/يوم
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Split Grid: Interactive Recharts Chart (7 cols) + Weekday Cards & Pedagogical Decision Hub (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left/Right 7 Cols: Interactive Recharts Chart + Clickable Weekday Strip */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h4 className="text-xs sm:text-sm font-black text-slate-900">
                الرسم البياني التفاعلي لتوزيع ساعات الغياب وتحديد أيام الذروة
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                انقر على أي عمود في المبيان أو بطاقة يوم أسفله لمعاينة التلاميذ المعنيين والقرارات التربوية المقترحة
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                يوم الذروة (#1)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                المرتبة #2
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                مبرر
              </span>
            </div>
          </div>

          <div className="w-full h-[270px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={daysData}
                margin={{ top: 12, right: 16, left: 0, bottom: 6 }}
                onClick={(state: any) => {
                  const payload = state?.activePayload?.[0]?.payload as WeekdayStatItem | undefined;
                  if (payload && typeof payload.dayIdx === 'number') {
                    setActiveDayIdx(payload.dayIdx);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="dayName"
                  tick={{ fontSize: 11.5, fontWeight: 800, fill: '#1e293b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  yAxisId="hours"
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  unit=" س"
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 10.5, fontWeight: 700, fill: '#6366f1' }}
                  axisLine={{ stroke: '#c7d2fe' }}
                  unit="%"
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
                  formatter={(value: any, name: any) => {
                    if (String(name).includes('%')) return [`${value}%`, name];
                    return [`${value} ساعة`, name];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as WeekdayStatItem | undefined;
                    if (!row) return '';
                    const tag = row.isPeak
                      ? ' — ذروة الغياب الأسبوعية (#1)'
                      : row.isSecondPeak
                      ? ' — ثاني أعلى يوم غياب (#2)'
                      : '';
                    return `يوم ${row.dayName}${tag} (إجمالي: ${row.totalHours} س · ${row.uniqueStudentsCount} تلميذ)`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                {averageDayHours > 0 && (
                  <ReferenceLine
                    yAxisId="hours"
                    y={averageDayHours}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    label={{
                      value: `المتوسط (${averageDayHours} س)`,
                      position: 'insideTopLeft',
                      fill: '#dc2626',
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  />
                )}
                <Bar
                  yAxisId="hours"
                  dataKey="unjustifiedHours"
                  name="ساعات غياب غير مبرر"
                  stackId="abs"
                  barSize={30}
                  cursor="pointer"
                >
                  {daysData.map((entry) => (
                    <Cell
                      key={`unjust-${entry.dayIdx}`}
                      fill={
                        entry.isPeak
                          ? '#dc2626'
                          : entry.isSecondPeak
                          ? '#f59e0b'
                          : '#475569'
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="hours"
                  dataKey="justifiedHours"
                  name="ساعات غياب مبرر"
                  stackId="abs"
                  fill="#38bdf8"
                  radius={[6, 6, 0, 0]}
                  barSize={30}
                  cursor="pointer"
                />
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="percentOfTotal"
                  name="نسبة التركز الأسبوعي (%)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive 6-Day Statistical Mini Cards Strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 pt-3 border-t border-slate-200/80">
            {daysData.map((day) => {
              const isSelected = focusedDay?.dayIdx === day.dayIdx;
              return (
                <button
                  key={day.dayIdx}
                  type="button"
                  onClick={() => setActiveDayIdx(day.dayIdx)}
                  className={`text-right p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : day.isPeak
                      ? 'bg-rose-50/80 text-slate-900 border-rose-300 hover:bg-rose-50'
                      : day.isSecondPeak
                      ? 'bg-amber-50/80 text-slate-900 border-amber-300 hover:bg-amber-50'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black">{day.dayName}</span>
                    {day.isPeak && (
                      <span
                        className={`text-[10px] font-extrabold ${
                          isSelected ? 'text-rose-300' : 'text-rose-700'
                        }`}
                      >
                        ذروة #1
                      </span>
                    )}
                    {!day.isPeak && day.isSecondPeak && (
                      <span
                        className={`text-[10px] font-extrabold ${
                          isSelected ? 'text-amber-300' : 'text-amber-700'
                        }`}
                      >
                        #2
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between tabular-nums">
                    <span className="text-base font-black">{day.totalHours} س</span>
                    <span
                      className={`text-[10.5px] font-bold ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {day.percentOfTotal}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right/Left 5 Cols: Pedagogical Decision Support & Students List for Focused/Peak Day */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>
                    قرارات التدخل التربوي الموجهة ليوم {focusedDay?.dayName || 'الذروة'}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {focusedDay?.isPeak
                    ? 'اليوم الأعلى غياباً في الأسبوع — أولوية قصوى للتدخل البيداغوجي والإداري'
                    : `تشخيص مخصص ليوم ${focusedDay?.dayName || ''} (${focusedDay?.totalHours || 0} ساعة غياب)`}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenPreventativePlan}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                title="فتح الخطة الوقائية الأسبوعية الكاملة"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>الخطة الوقائية</span>
              </button>
            </div>

            {/* Actionable Pedagogical Recommendations */}
            {pedagogicalRecommendations.length > 0 ? (
              <div className="space-y-2.5 mb-4">
                {pedagogicalRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-right"
                  >
                    <div className="text-[11px] font-black text-slate-800 mb-0.5">
                      0{idx + 1}. {rec.domain}
                    </div>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed m-0">
                      {rec.action}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-extrabold text-emerald-900">
                  انضباط تام يوم {focusedDay?.dayName}
                </div>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  لم تسجل أي ساعات غياب في هذا اليوم ضمن النطاق المحدد.
                </p>
              </div>
            )}

            {/* Students with Recurring Absences on Focused Day */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-slate-800">
                  التلاميذ الأكثر غياباً يوم {focusedDay?.dayName} ({focusedDay?.students.length || 0})
                </span>
                <span className="text-[10.5px] text-slate-500">تدخل فوري بنقرة واحدة</span>
              </div>

              {focusedDay && focusedDay.students.length > 0 ? (
                <div className="space-y-1.5 max-h-[165px] overflow-y-auto pr-0.5">
                  {focusedDay.students.slice(0, 6).map((st) => (
                    <div
                      key={`${st.className}_${st.id}`}
                      className="p-2 rounded-lg border border-slate-200/80 hover:border-slate-300 bg-white flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {st.name}
                        </div>
                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1.5 tabular-nums">
                          <span>{st.className}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-rose-700 font-bold">{st.totalHours} س</span>
                          <span aria-hidden="true">·</span>
                          <span>{st.incidents} مرات</span>
                        </div>
                      </div>

                      {!isUsingPreviewData && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTriggerStudentAction(st, 'wa')}
                            className="p-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                            title="مراسلة ولي الأمر عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerStudentAction(st, 'summons')}
                            className="p-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                            title="استدعاء ولي الأمر / إشعار إداري"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerStudentAction(st, 'profile')}
                            className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                            title="البطاقة السريعة للتلميذ"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center text-[11px] text-slate-500">
                  لا توجد حالات غياب فردية مسجلة في يوم {focusedDay?.dayName}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekdayAbsenceDistributionCard;
