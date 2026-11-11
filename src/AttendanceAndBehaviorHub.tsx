import React, { useState, useMemo } from 'react';
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
  ReferenceLine
} from 'recharts';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  ShieldAlert,
  UserCheck,
  PlusCircle,
  MessageCircle,
  FileText,
  Trash2,
  Search,
  Award,
  BookOpen,
  User
} from 'lucide-react';

export interface BehaviorLogEntry {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  category: 'disruption' | 'tardiness' | 'homework_neglect' | 'warning' | 'positive';
  statusLabel: 'مشوش' | 'تنبيه' | 'منضبط';
  severity: 'normal' | 'moderate' | 'critical';
  note: string;
  date: string;
  timestamp: number;
}

interface AttendanceAndBehaviorHubProps {
  db: any;
  classNames: string[];
  onRefreshDb: () => void;
}

const CATEGORY_META: Record<
  BehaviorLogEntry['category'],
  {
    label: string;
    statusMap: 'مشوش' | 'تنبيه' | 'منضبط';
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  disruption: {
    label: 'تشويش وعرقلة الدرس (Disruption)',
    statusMap: 'مشوش',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-800',
    badgeBorder: 'border-rose-200'
  },
  tardiness: {
    label: 'تأخر عن الحصة (Tardiness)',
    statusMap: 'تنبيه',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200'
  },
  homework_neglect: {
    label: 'إهمال الواجب أو اللوازم (Homework/Supplies)',
    statusMap: 'تنبيه',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-800',
    badgeBorder: 'border-orange-200'
  },
  warning: {
    label: 'تنبيه انضباطي (Disciplinary Warning)',
    statusMap: 'تنبيه',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200'
  },
  positive: {
    label: 'انضباط متميز ومشاركة فعالة (Positive)',
    statusMap: 'منضبط',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200'
  }
};

const QUICK_REMARK_PRESETS: Array<{
  category: BehaviorLogEntry['category'];
  severity: BehaviorLogEntry['severity'];
  text: string;
}> = [
  {
    category: 'disruption',
    severity: 'critical',
    text: 'تشويش وحديث جانبي متكرر يعرقل بناء الدرس والتركيز داخل الفصل.'
  },
  {
    category: 'tardiness',
    severity: 'moderate',
    text: 'تأخر متكرر عن موعد انطلاق حصة الرياضيات دون مبرر إداري.'
  },
  {
    category: 'homework_neglect',
    severity: 'moderate',
    text: 'عدم إنجاز سلسلة التمارين المنزلية المقررة أو نسيان دفتر الدروس واللوازم الهندسية.'
  },
  {
    category: 'warning',
    severity: 'normal',
    text: 'عدم الانتباه وتشتت التركيز أثناء شرح البرهان الرياضي وتصحيح التمارين.'
  },
  {
    category: 'positive',
    severity: 'normal',
    text: 'انضباط مثالي ومشاركة متميزة في إنجاز التمارين التطبيقية على السبورة.'
  }
];

function inferCategoryFromNote(status: string, note: string): BehaviorLogEntry['category'] {
  const n = (note || '').toLowerCase();
  if (n.includes('تأخر') || n.includes('تاخر') || n.includes('متأخر')) return 'tardiness';
  if (n.includes('واجب') || n.includes('تمارين') || n.includes('دفتر') || n.includes('أدوات') || n.includes('لوازم')) {
    return 'homework_neglect';
  }
  if (status === 'مشوش' || n.includes('تشويش') || n.includes('شغب') || n.includes('عرقلة')) {
    return 'disruption';
  }
  if (status === 'تنبيه') return 'warning';
  return 'positive';
}

export default function AttendanceAndBehaviorHub({
  db,
  classNames,
  onRefreshDb
}: AttendanceAndBehaviorHubProps) {
  // ============================================================================
  // 1. STATE FOR 30-DAY ATTENDANCE TRENDS CHART
  // ============================================================================
  const [trendClassFilter, setTrendClassFilter] = useState<string>('all');
  const [trendChartMode, setTrendChartMode] = useState<'attendance-rate' | 'absence-breakdown'>('attendance-rate');

  // ============================================================================
  // 2. STATE FOR BEHAVIOR & DISCIPLINARY REMARKS TRACKER
  // ============================================================================
  const [formClass, setFormClass] = useState<string>(() => classNames[0] || '');
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formCategory, setFormCategory] = useState<BehaviorLogEntry['category']>('disruption');
  const [formSeverity, setFormSeverity] = useState<BehaviorLogEntry['severity']>('moderate');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formNote, setFormNote] = useState<string>('');
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
  const [logFilterClass, setLogFilterClass] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Keep formClass valid when classNames load
  const activeFormClass = useMemo(() => {
    if (formClass && classNames.includes(formClass)) return formClass;
    return classNames[0] || '';
  }, [formClass, classNames]);

  const studentsInFormClass = useMemo(() => {
    if (!db?.classes || !activeFormClass) return [];
    const raw = db.classes[activeFormClass];
    return Array.isArray(raw) ? raw : [];
  }, [db?.classes, activeFormClass]);

  const activeFormStudentId = useMemo(() => {
    if (formStudentId && studentsInFormClass.some((s: any) => String(s.id) === String(formStudentId))) {
      return formStudentId;
    }
    return studentsInFormClass[0]?.id ? String(studentsInFormClass[0].id) : '';
  }, [formStudentId, studentsInFormClass]);

  // ============================================================================
  // 3. O(R) SINGLE-PASS INDEXING FOR 30-DAY ATTENDANCE TRENDS
  // ============================================================================
  const thirtyDayAnalytics = useMemo(() => {
    const allRecords: any[] = Array.isArray(db?.records) ? db.records : [];
    const targetClasses = trendClassFilter === 'all' ? classNames : [trendClassFilter];
    const targetClassSet = new Set(targetClasses);

    // Total enrolled students across target classes
    let enrolledStudents = 0;
    targetClasses.forEach((c) => {
      const list = db?.classes?.[c];
      if (Array.isArray(list)) enrolledStudents += list.length;
    });
    const safeEnrolled = Math.max(enrolledStudents, 1);

    // Determine anchor end date: either latest record date in db.records or today
    let maxRecordDateStr = '';
    const recordsByDate = new Map<
      string,
      {
        unjustifiedHours: number;
        justifiedHours: number;
        absentStudentsSet: Set<string>;
        lateCount: number;
        presentOrTotalRecords: number;
      }
    >();

    const isProtectedRecord =
      typeof window !== 'undefined' && typeof (window as any).isRecordProtectedHolidayOrLeave === 'function'
        ? (window as any).isRecordProtectedHolidayOrLeave
        : null;
    const isProtectedDate =
      typeof window !== 'undefined' && typeof (window as any).isAbsenceDisabledOnDate === 'function'
        ? (window as any).isAbsenceDisabledOnDate
        : null;

    for (let i = 0; i < allRecords.length; i++) {
      const r = allRecords[i];
      if (!r || !r.date || typeof r.date !== 'string') continue;
      if (trendClassFilter !== 'all' && !targetClassSet.has(r.className)) continue;
      if (isProtectedRecord && isProtectedRecord(r)) continue;
      if (isProtectedDate) {
        const chk = isProtectedDate(r.date, r.session);
        if (typeof chk === 'boolean' ? chk : !!(chk && chk.disabled)) continue;
      }

      const dStr = r.date.slice(0, 10);
      if (dStr > maxRecordDateStr) maxRecordDateStr = dStr;

      let bucket = recordsByDate.get(dStr);
      if (!bucket) {
        bucket = {
          unjustifiedHours: 0,
          justifiedHours: 0,
          absentStudentsSet: new Set<string>(),
          lateCount: 0,
          presentOrTotalRecords: 0
        };
        recordsByDate.set(dStr, bucket);
      }

      const dur = Number(r.duration) || 1;
      bucket.presentOrTotalRecords += 1;

      if (r.status === 'غائب') {
        bucket.unjustifiedHours += dur;
        if (r.studentId) bucket.absentStudentsSet.add(`${r.className}_${r.studentId}`);
      } else if (r.status === 'مبرر') {
        bucket.justifiedHours += dur;
        if (r.studentId) bucket.absentStudentsSet.add(`${r.className}_${r.studentId}`);
      } else if (r.status === 'متأخر') {
        bucket.lateCount += 1;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const anchorDateStr = maxRecordDateStr && maxRecordDateStr <= todayStr ? todayStr : (maxRecordDateStr || todayStr);
    // If all records are older than 30 days from todayStr, anchor on maxRecordDateStr so existing records are visible
    const latestRecTime = maxRecordDateStr ? new Date(maxRecordDateStr + 'T12:00:00').getTime() : 0;
    const todayTime = new Date(todayStr + 'T12:00:00').getTime();
    const useLatestRecordAnchor =
      maxRecordDateStr && Math.abs(todayTime - latestRecTime) > 25 * 24 * 3600 * 1000;
    const baseEndDate = new Date((useLatestRecordAnchor ? maxRecordDateStr : anchorDateStr) + 'T12:00:00');

    const dailyPoints: Array<{
      date: string;
      shortDate: string;
      dayLabel: string;
      attendanceRate: number;
      ma7AttendanceRate: number;
      absenceRate: number;
      unjustifiedHours: number;
      justifiedHours: number;
      totalAbsenceHours: number;
      absentStudentsCount: number;
      lateCount: number;
    }> = [];

    for (let offset = 29; offset >= 0; offset--) {
      const d = new Date(baseEndDate.getTime() - offset * 24 * 3600 * 1000);
      const isoDate = d.toISOString().slice(0, 10);
      const shortDate = isoDate.slice(5); // MM-DD
      const dayLabel = d.toLocaleDateString('ar-MA', { weekday: 'short', month: 'numeric', day: 'numeric' });

      const bucket = recordsByDate.get(isoDate);
      const unjustifiedHours = bucket ? Number(bucket.unjustifiedHours.toFixed(1)) : 0;
      const justifiedHours = bucket ? Number(bucket.justifiedHours.toFixed(1)) : 0;
      const totalAbsenceHours = Number((unjustifiedHours + justifiedHours).toFixed(1));
      const absentStudentsCount = bucket ? bucket.absentStudentsSet.size : 0;
      const lateCount = bucket ? bucket.lateCount : 0;

      // Daily attendance rate based on absent students vs enrolled (or hours ratio)
      const effectiveAbsentRatio =
        absentStudentsCount > 0
          ? absentStudentsCount / safeEnrolled
          : totalAbsenceHours / (safeEnrolled * 2);
      const attendanceRate = Math.max(
        0,
        Math.min(100, Number(((1 - effectiveAbsentRatio) * 100).toFixed(1)))
      );
      const absenceRate = Number((100 - attendanceRate).toFixed(1));

      dailyPoints.push({
        date: isoDate,
        shortDate,
        dayLabel,
        attendanceRate,
        ma7AttendanceRate: attendanceRate,
        absenceRate,
        unjustifiedHours,
        justifiedHours,
        totalAbsenceHours,
        absentStudentsCount,
        lateCount
      });
    }

    // Compute 7-Day Moving Average (MA_7) and Linear Regression Slope (beta_1)
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    const n = dailyPoints.length;

    let total30Unjustified = 0;
    let total30Justified = 0;
    let total30Lates = 0;
    let peakDay = { date: '-', hours: 0, label: 'لا يوجد غياب' };

    for (let i = 0; i < n; i++) {
      const windowStart = Math.max(0, i - 6);
      let winSum = 0;
      for (let j = windowStart; j <= i; j++) {
        winSum += dailyPoints[j].attendanceRate;
      }
      dailyPoints[i].ma7AttendanceRate = Number((winSum / (i - windowStart + 1)).toFixed(1));

      const y = dailyPoints[i].attendanceRate;
      sumX += i;
      sumY += y;
      sumXY += i * y;
      sumX2 += i * i;

      total30Unjustified += dailyPoints[i].unjustifiedHours;
      total30Justified += dailyPoints[i].justifiedHours;
      total30Lates += dailyPoints[i].lateCount;

      if (dailyPoints[i].totalAbsenceHours > peakDay.hours) {
        peakDay = {
          date: dailyPoints[i].date,
          hours: dailyPoints[i].totalAbsenceHours,
          label: dailyPoints[i].dayLabel
        };
      }
    }

    const avgAttendance30d = n > 0 ? Number((sumY / n).toFixed(1)) : 100;
    const denominator = n * sumX2 - sumX * sumX;
    const slopePerDay = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const slope30dDelta = Number((slopePerDay * 30).toFixed(2));

    return {
      dailyPoints,
      avgAttendance30d,
      total30AbsenceHours: Number((total30Unjustified + total30Justified).toFixed(1)),
      total30Unjustified: Number(total30Unjustified.toFixed(1)),
      total30Justified: Number(total30Justified.toFixed(1)),
      total30Lates,
      slope30dDelta,
      peakDay,
      startDateStr: dailyPoints[0]?.date || '',
      endDateStr: dailyPoints[dailyPoints.length - 1]?.date || ''
    };
  }, [db?.records, db?.classes, classNames, trendClassFilter]);

  // ============================================================================
  // 4. UNIFIED DISCIPLINARY REMARKS & BEHAVIOR LOGS AGGREGATION
  // ============================================================================
  const allBehaviorLogs = useMemo(() => {
    const winDb = (typeof window !== 'undefined' ? (window as any).db : db) || db || {};
    const explicitLogs: BehaviorLogEntry[] = Array.isArray(winDb.behaviorLogs)
      ? [...winDb.behaviorLogs]
      : [];

    const existingKeys = new Set(
      explicitLogs.map((l) => `${l.className}__${l.studentId}__${l.note || l.statusLabel}`)
    );

    // Also synthesize entries from existing db.behaviors[className][studentId] and tardiness records
    const behaviorsObj = winDb.behaviors || {};
    Object.keys(behaviorsObj).forEach((clsName) => {
      const clsBeh = behaviorsObj[clsName] || {};
      const stdList: any[] = Array.isArray(winDb.classes?.[clsName]) ? winDb.classes[clsName] : [];

      Object.keys(clsBeh).forEach((stdId) => {
        const entry = clsBeh[stdId];
        if (!entry) return;
        const status = entry.status || 'منضبط';
        const note = (entry.note || '').trim();
        if (status === 'منضبط' && !note) return;

        const dedupKey = `${clsName}__${stdId}__${note || status}`;
        if (existingKeys.has(dedupKey)) return;
        existingKeys.add(dedupKey);

        const stdObj = stdList.find((s) => String(s.id) === String(stdId));
        const cat = entry.category || inferCategoryFromNote(status, note);
        const sev: BehaviorLogEntry['severity'] =
          entry.severity || (status === 'مشوش' ? 'critical' : status === 'تنبيه' ? 'moderate' : 'normal');

        explicitLogs.push({
          id: `beh-${clsName}-${stdId}`,
          studentId: String(stdId),
          studentName: stdObj?.name || `تلميذ #${stdId}`,
          className: clsName,
          category: cat,
          statusLabel: status === 'مشوش' ? 'مشوش' : status === 'تنبيه' ? 'تنبيه' : 'منضبط',
          severity: sev,
          note: note || (status === 'مشوش' ? 'سلوك مشوش مسجل في الحصة' : 'تنبيه سلوكي مسجل'),
          date: entry.date || new Date().toISOString().slice(0, 10),
          timestamp: entry.timestamp || Date.now() - 3600000
        });
      });
    });

    // Sort newest first
    explicitLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return explicitLogs;
  }, [db]);

  const behaviorCounters = useMemo(() => {
    let disruption = 0;
    let tardiness = 0;
    let homeworkWarning = 0;
    let positive = 0;
    let critical = 0;

    allBehaviorLogs.forEach((item) => {
      if (item.category === 'disruption') disruption++;
      else if (item.category === 'tardiness') tardiness++;
      else if (item.category === 'homework_neglect' || item.category === 'warning') homeworkWarning++;
      else if (item.category === 'positive') positive++;

      if (item.severity === 'critical') critical++;
    });

    return {
      total: allBehaviorLogs.length,
      disruption,
      tardiness,
      homeworkWarning,
      positive,
      critical
    };
  }, [allBehaviorLogs]);

  const filteredBehaviorLogs = useMemo(() => {
    return allBehaviorLogs.filter((item) => {
      if (logFilterCategory !== 'all') {
        if (logFilterCategory === 'warning_hw') {
          if (item.category !== 'warning' && item.category !== 'homework_neglect') return false;
        } else if (item.category !== logFilterCategory) {
          return false;
        }
      }
      if (logFilterClass !== 'all' && item.className !== logFilterClass) return false;
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.trim().toLowerCase();
        const matchName = (item.studentName || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        const matchClass = (item.className || '').toLowerCase().includes(q);
        if (!matchName && !matchNote && !matchClass) return false;
      }
      return true;
    });
  }, [allBehaviorLogs, logFilterCategory, logFilterClass, logSearchQuery]);

  // ============================================================================
  // 5. HANDLERS FOR LOGGING & MANAGING DISCIPLINARY REMARKS
  // ============================================================================
  const handleLogDisciplinaryRemark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFormClass || !activeFormStudentId) return;

    const win = window as any;
    if (!win.db) return;

    const stdObj = studentsInFormClass.find((s: any) => String(s.id) === String(activeFormStudentId));
    const studentName = stdObj?.name || `تلميذ #${activeFormStudentId}`;
    const catMeta = CATEGORY_META[formCategory];
    const cleanNote =
      formNote.trim() ||
      (formCategory === 'disruption'
        ? 'تشويش وعرقلة السير العادي للحصة الدراسية'
        : formCategory === 'tardiness'
        ? 'تأخر عن موعد انطلاق حصة الرياضيات'
        : formCategory === 'homework_neglect'
        ? 'إهمال إنجاز الواجب المنزلي أو عدم إحضار اللوازم'
        : formCategory === 'warning'
        ? 'تنبيه انضباطي مسجل داخل الفصل'
        : 'انضباط متميز ومشاركة إيجابية فعالة');

    const newEntry: BehaviorLogEntry = {
      id: `remark_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      studentId: String(activeFormStudentId),
      studentName,
      className: activeFormClass,
      category: formCategory,
      statusLabel: catMeta.statusMap,
      severity: formSeverity,
      note: cleanNote,
      date: formDate || new Date().toISOString().slice(0, 10),
      timestamp: Date.now()
    };

    if (typeof win.upsertStudentBehaviorAndLog === 'function') {
      win.upsertStudentBehaviorAndLog(activeFormClass, String(activeFormStudentId), {
        status: catMeta.statusMap,
        note: cleanNote,
        category: formCategory,
        severity: formSeverity,
        date: newEntry.date,
        logEntry: newEntry
      });
    } else {
      if (!Array.isArray(win.db.behaviorLogs)) win.db.behaviorLogs = [];
      win.db.behaviorLogs.unshift(newEntry);

      if (!win.db.behaviors) win.db.behaviors = {};
      if (!win.db.behaviors[activeFormClass]) win.db.behaviors[activeFormClass] = {};
      win.db.behaviors[activeFormClass][activeFormStudentId] = {
        status: catMeta.statusMap,
        note: cleanNote,
        category: formCategory,
        severity: formSeverity,
        date: newEntry.date,
        timestamp: newEntry.timestamp
      };

      if (typeof win.recordAdminAction === 'function') {
        win.recordAdminAction({
          actionType: 'behavior_update',
          title: `تدوين ملاحظة انضباطية (${catMeta.label.split(' (')[0]}) — ${studentName}`,
          studentId: String(activeFormStudentId),
          studentName,
          className: activeFormClass,
          details: cleanNote,
          meta: { status: catMeta.statusMap, category: formCategory, severity: formSeverity }
        });
      }

      if (typeof win.saveDB === 'function') win.saveDB();
      if (typeof win.renderDashboard === 'function') win.renderDashboard();
    }

    setFormNote('');
    onRefreshDb();
    window.dispatchEvent(new CustomEvent('dbUpdated'));

    if (typeof win.showToast === 'function') {
      win.showToast(`تم تسجيل الملاحظة الانضباطية للتلميذ (${studentName}) بنجاح`);
    } else if (typeof win.showNotification === 'function') {
      win.showNotification(`تم تسجيل الملاحظة الانضباطية للتلميذ (${studentName}) بنجاح`, 'success');
    }
  };

  const handleDeleteBehaviorLog = (entry: BehaviorLogEntry) => {
    const win = window as any;
    if (!win.db) return;

    if (Array.isArray(win.db.behaviorLogs)) {
      win.db.behaviorLogs = win.db.behaviorLogs.filter((l: any) => l.id !== entry.id);
    }

    // If this was the active status on db.behaviors[className][studentId], reset it if no other logs remain
    const remainingForStudent = (win.db.behaviorLogs || []).filter(
      (l: any) => l.className === entry.className && String(l.studentId) === String(entry.studentId)
    );
    if (remainingForStudent.length === 0) {
      if (win.db.behaviors?.[entry.className]?.[entry.studentId]) {
        win.db.behaviors[entry.className][entry.studentId] = {
          status: 'منضبط',
          note: ''
        };
      }
    } else {
      const latest = remainingForStudent[0];
      if (win.db.behaviors?.[entry.className]) {
        win.db.behaviors[entry.className][entry.studentId] = {
          status: latest.statusLabel || 'منضبط',
          note: latest.note || '',
          category: latest.category,
          severity: latest.severity,
          date: latest.date,
          timestamp: latest.timestamp
        };
      }
    }

    if (typeof win.saveDB === 'function') win.saveDB();
    if (typeof win.renderDashboard === 'function') win.renderDashboard();
    onRefreshDb();
    window.dispatchEvent(new CustomEvent('dbUpdated'));
  };

  const handleOpenQuickProfile = (className: string, studentId: string) => {
    const win = window as any;
    if (typeof win.openStudentQuickModal === 'function') {
      win.openStudentQuickModal(className, studentId);
    }
  };

  const handleOpenDecisionAction = (
    studentId: string,
    className: string,
    action: 'wa' | 'summons' | 'behavior'
  ) => {
    const win = window as any;
    if (typeof win.openDashboardDecisionModal === 'function') {
      win.openDashboardDecisionModal(studentId, className, action);
    }
  };

  return (
    <div className="space-y-5 mb-5" dir="rtl">
      {/* ===================================================================== */}
      {/* PART 1: 30-DAY ATTENDANCE TRENDS CHART                                */}
      {/* ===================================================================== */}
      <div
        id="dashThirtyDayAttendanceTrendsSection"
        className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80 flex-shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                منحنى اتجاهات المواظبة والغياب خلال آخر 30 يوماً (30-Day Attendance Trends)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>تحليل زمني يومي لنسبة الحضور، المتوسط المتحرك لـ 7 أيام (MA₇)، وساعات الغياب والتأخر</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-600">
                  {thirtyDayAnalytics.startDateStr} → {thirtyDayAnalytics.endDateStr}
                </span>
              </p>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-600">القسم:</span>
              <select
                value={trendClassFilter}
                onChange={(e) => setTrendClassFilter(e.target.value)}
                className="bg-transparent font-extrabold text-slate-900 focus:outline-hidden cursor-pointer"
              >
                <option value="all">جميع الأقسام المسندة ({classNames.length})</option>
                {classNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTrendChartMode('attendance-rate')}
                className={`px-2.5 py-1 text-xs font-extrabold rounded-md transition-colors cursor-pointer ${
                  trendChartMode === 'attendance-rate'
                    ? 'bg-white text-blue-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نسبة المواظبة والمنحنى المتحرك (MA₇)
              </button>
              <button
                type="button"
                onClick={() => setTrendChartMode('absence-breakdown')}
                className={`px-2.5 py-1 text-xs font-extrabold rounded-md transition-colors cursor-pointer ${
                  trendChartMode === 'absence-breakdown'
                    ? 'bg-white text-rose-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ساعات الغياب والتأخرات اليومية
              </button>
            </div>
          </div>
        </div>

        {/* 30-Day Mathematical Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="text-[11px] font-bold text-slate-500">متوسط نسبة المواظبة (30 يوماً)</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-emerald-700 font-mono">
                {thirtyDayAnalytics.avgAttendance30d}%
              </span>
              <span
                className={`text-xs font-bold inline-flex items-center gap-0.5 ${
                  thirtyDayAnalytics.slope30dDelta > 0.2
                    ? 'text-emerald-700'
                    : thirtyDayAnalytics.slope30dDelta < -0.2
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}
                title="معامل الانحدار الخطي لاتجاه المواظبة خلال 30 يوماً"
              >
                {thirtyDayAnalytics.slope30dDelta > 0.2 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : thirtyDayAnalytics.slope30dDelta < -0.2 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  {thirtyDayAnalytics.slope30dDelta > 0
                    ? `+${thirtyDayAnalytics.slope30dDelta}%`
                    : `${thirtyDayAnalytics.slope30dDelta}%`}
                </span>
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-rose-50/30">
            <div className="text-[11px] font-bold text-rose-800">إجمالي ساعات الغياب (30 يوماً)</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-rose-900 font-mono">
                {thirtyDayAnalytics.total30AbsenceHours}
              </span>
              <span className="text-xs font-bold text-rose-700">ساعة</span>
              <span className="text-[11px] text-slate-500">
                (غ.م: {thirtyDayAnalytics.total30Unjustified}س · مبرر: {thirtyDayAnalytics.total30Justified}س)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-amber-50/30">
            <div className="text-[11px] font-bold text-amber-800">حالات التأخر المرصودة (30 يوماً)</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-amber-900 font-mono">
                {thirtyDayAnalytics.total30Lates}
              </span>
              <span className="text-xs font-bold text-amber-700">تأخر مسجل</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="text-[11px] font-bold text-slate-500">يوم الذروة في الغياب (30 يوماً)</div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-black text-slate-900 truncate">
                {thirtyDayAnalytics.peakDay.hours > 0 ? thirtyDayAnalytics.peakDay.label : 'مواظبة منتظمة'}
              </span>
              {thirtyDayAnalytics.peakDay.hours > 0 && (
                <span className="text-xs font-extrabold text-rose-600 font-mono">
                  {thirtyDayAnalytics.peakDay.hours} س
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 30-Day Recharts Visualization */}
        <div className="w-full h-72 sm:h-80" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            {trendChartMode === 'attendance-rate' ? (
              <ComposedChart
                data={thirtyDayAnalytics.dailyPoints}
                margin={{ top: 10, right: 18, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
                  interval={2}
                />
                <YAxis
                  domain={[50, 100]}
                  unit="%"
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
                  labelFormatter={(_label, payload) => {
                    const p = payload?.[0]?.payload;
                    return p ? `${p.dayLabel} (${p.date})` : _label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <ReferenceLine
                  y={90}
                  stroke="#059669"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'عتبة الانتظام 90%',
                    position: 'insideBottomRight',
                    fill: '#059669',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
                <Bar
                  dataKey="attendanceRate"
                  name="نسبة الحضور اليومية (%)"
                  fill="#93c5fd"
                  radius={[3, 3, 0, 0]}
                  barSize={12}
                />
                <Line
                  type="monotone"
                  dataKey="ma7AttendanceRate"
                  name="المتوسط المتحرك 7 أيام (MA₇ %)"
                  stroke="#1d4ed8"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            ) : (
              <ComposedChart
                data={thirtyDayAnalytics.dailyPoints}
                margin={{ top: 10, right: 18, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
                  interval={2}
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
                  allowDecimals={false}
                  tick={{ fill: '#d97706', fontSize: 11 }}
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
                  labelFormatter={(_label, payload) => {
                    const p = payload?.[0]?.payload;
                    return p ? `${p.dayLabel} (${p.date})` : _label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="unjustifiedHours"
                  name="غياب غير مبرر (س)"
                  stackId="abs30"
                  fill="#ef4444"
                  barSize={12}
                />
                <Bar
                  yAxisId="left"
                  dataKey="justifiedHours"
                  name="غياب مبرر (س)"
                  stackId="abs30"
                  fill="#38bdf8"
                  radius={[3, 3, 0, 0]}
                  barSize={12}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="lateCount"
                  name="مرات التأخر"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#d97706' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PART 2: STUDENT BEHAVIOR & DISCIPLINARY REMARKS TRACKING HUB          */}
      {/* ===================================================================== */}
      <div
        id="dashBehaviorTrackingHubSection"
        className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-start gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/80 flex-shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                منظومة تتبع السلوك وتدوين الملاحظات الانضباطية (Behavior & Disciplinary Remarks)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                توثيق فوري لحالات التشويش، التأخر عن الحصة، إهمال الواجبات واللوازم، أو التميز السلوكي مع عرضها المركزي في لوحة القيادة
              </p>
            </div>
          </div>

          {/* Summary Counters inline */}
          <div className="flex items-center gap-3 flex-wrap text-xs font-bold text-slate-600">
            <span>
              إجمالي الملاحظات: <strong className="text-slate-900 font-mono">{behaviorCounters.total}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-700">
              تشويش: <strong className="font-mono">{behaviorCounters.disruption}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700">
              تأخر: <strong className="font-mono">{behaviorCounters.tardiness}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-700">
              تنبيه/واجب: <strong className="font-mono">{behaviorCounters.homeworkWarning}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700">
              تميز: <strong className="font-mono">{behaviorCounters.positive}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-4">
          {/* Left/Right Column 1: Quick Disciplinary Remark Logging Form (5 cols) */}
          <form
            onSubmit={handleLogDisciplinaryRemark}
            className="lg:col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3.5"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-purple-700" />
                  <span>تدوين ملاحظة سلوكية أو انضباطية جديدة</span>
                </span>
                <span className="text-[11px] text-slate-500">حفظ فوري في السجل</span>
              </div>

              {/* Class & Student Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">القسم الدراسي:</label>
                  <select
                    value={activeFormClass}
                    onChange={(e) => {
                      setFormClass(e.target.value);
                      setFormStudentId('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {classNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">التلميذ(ة):</label>
                  <select
                    value={activeFormStudentId}
                    onChange={(e) => setFormStudentId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    {studentsInFormClass.map((std: any, idx: number) => (
                      <option key={std.id} value={std.id}>
                        {idx + 1}. {std.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remark Category & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    نوع الملاحظة الانضباطية:
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as BehaviorLogEntry['category'];
                      setFormCategory(nextCat);
                      if (nextCat === 'disruption') setFormSeverity('critical');
                      else if (nextCat === 'positive') setFormSeverity('normal');
                      else setFormSeverity('moderate');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="disruption">تشويش وعرقلة الدرس (Disruption)</option>
                    <option value="tardiness">تأخر عن الحصة (Tardiness)</option>
                    <option value="homework_neglect">إهمال الواجب أو اللوازم (Homework)</option>
                    <option value="warning">تنبيه انضباطي عام (Warning)</option>
                    <option value="positive">انضباط متميز ومشاركة (Positive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الحصة:</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Severity Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">درجة المتابعة:</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormSeverity('normal')}
                    className={`py-1 px-2 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer ${
                      formSeverity === 'normal'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ملاحظة عادية
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSeverity('moderate')}
                    className={`py-1 px-2 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer ${
                      formSeverity === 'moderate'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تنبيه مسجل
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSeverity('critical')}
                    className={`py-1 px-2 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer ${
                      formSeverity === 'critical'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    حرج (استدعاء ولي الأمر)
                  </button>
                </div>
              </div>

              {/* Quick Templates */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  قوالب سريعة جاهزة (انقر للملء التلقائي):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REMARK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormCategory(preset.category);
                        setFormSeverity(preset.severity);
                        setFormNote(preset.text);
                      }}
                      className="text-[11px] font-bold px-2 py-1 rounded-md bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-900 border border-slate-200 transition-colors cursor-pointer text-right"
                    >
                      {preset.text.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Note Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  تفاصيل الملاحظة السلوكية / التربوية:
                </label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="اكتب وصفاً دقيقاً للملاحظة السلوكية أو اختر من القوالب أعلاه..."
                  className="w-full p-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>تسجيل الملاحظة الانضباطية وعرضها في لوحة القيادة</span>
            </button>
          </form>

          {/* Column 2: Dashboard Disciplinary Remarks Feed & Filters (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { key: 'all', label: `الكل (${behaviorCounters.total})` },
                    { key: 'disruption', label: `تشويش (${behaviorCounters.disruption})` },
                    { key: 'tardiness', label: `تأخر (${behaviorCounters.tardiness})` },
                    { key: 'warning_hw', label: `تنبيه/واجب (${behaviorCounters.homeworkWarning})` },
                    { key: 'positive', label: `تميز (${behaviorCounters.positive})` }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setLogFilterCategory(tab.key)}
                      className={`px-2.5 py-1 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                        logFilterCategory === tab.key
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={logFilterClass}
                    onChange={(e) => setLogFilterClass(e.target.value)}
                    className="px-2 py-1 rounded-md bg-white border border-slate-300 text-xs font-bold text-slate-800"
                  >
                    <option value="all">كل الأقسام</option>
                    {classNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="بحث باسم التلميذ..."
                      className="pr-7 pl-2 py-1 rounded-md bg-white border border-slate-300 text-xs font-semibold text-slate-800 w-36 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Remarks List */}
              {filteredBehaviorLogs.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/40">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <div className="text-sm font-black text-slate-800">
                    لا توجد ملاحظات انضباطية مسجلة تطابق معايير البحث الحالية
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    يمكنك استخدام النموذج الجانبي لتدوين أي ملاحظة حول التشويش أو التأخر أو إهمال الواجبات ليتم تتبعها هنا.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {filteredBehaviorLogs.map((entry) => {
                    const meta = CATEGORY_META[entry.category] || CATEGORY_META.warning;
                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickProfile(entry.className, entry.studentId)}
                              className="text-sm font-black text-slate-900 hover:text-blue-700 cursor-pointer"
                            >
                              {entry.studentName}
                            </button>
                            <span className="text-xs font-extrabold text-blue-800">{entry.className}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className={`text-xs font-extrabold ${meta.badgeText}`}>
                              {meta.label.split(' (')[0]}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-[11px] font-mono text-slate-500">{entry.date}</span>
                          </div>
                          <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                            {entry.note}
                          </p>
                        </div>

                        {/* Quick Pedagogical & Administrative Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickProfile(entry.className, entry.studentId)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="فتح البطاقة السريعة للتلميذ"
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>البطاقة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionAction(entry.studentId, entry.className, 'wa')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="إشعار ولي الأمر عبر واتساب"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionAction(entry.studentId, entry.className, 'summons')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="إصدار استدعاء إداري لولي الأمر"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>استدعاء</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBehaviorLog(entry)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف الملاحظة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
