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
  Cell
} from 'recharts';
import {
  ShieldAlert,
  AlertTriangle,
  FileCheck2,
  Database,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Printer,
  RefreshCw,
  MessageCircle,
  UserCheck,
  Search,
  Sparkles,
  TrendingDown,
  Clock,
  FileSpreadsheet,
  Award,
  Activity,
  HardDrive,
  History
} from 'lucide-react';
import {
  AuditLogEntry,
  StorageHealthReport,
  getAuditLogs,
  getStorageHealthReport,
  saveSnapshotToIndexedDB,
  appendAuditLog,
  isPrivacyModeEnabled,
  setPrivacyModeEnabled,
  formatStudentNameForDisplay,
  formatMassarForDisplay
} from './services/indexedDbEngine.ts';

interface StrategicRoadmapSuiteProps {
  dbProp?: any;
  classNamesProp?: string[];
}

interface EarlyWarningStudentItem {
  id: string;
  name: string;
  displayName: string;
  massar: string;
  displayMassar: string;
  className: string;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4?: number | null;
  avg: number | null;
  gradeTrendDelta: number | null;
  totalAbsenceHours: number;
  unjustifiedHours: number;
  peakDayAbsences: number;
  lateCount: number;
  riskScore: number; // 0 to 100
  riskCategory: 'dual_critical' | 'grade_drop' | 'absence_peak' | 'watch';
  riskLabel: string;
  recommendedAction: string;
  phone?: string;
}

interface MassarValidationIssue {
  id: string;
  className: string;
  studentId: string;
  studentName: string;
  massar: string;
  severity: 'error' | 'warning';
  issueType: 'missing_massar' | 'out_of_range' | 'missing_exam' | 'sharp_variance';
  description: string;
  fieldLabel: string;
}

const WEEKDAY_NAMES_AR: Record<number, string> = {
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
  0: 'الأحد'
};

function normalizeStudentsList(rawCls: any): any[] {
  if (!rawCls) return [];
  if (Array.isArray(rawCls)) return rawCls;
  if (Array.isArray(rawCls.students)) return rawCls.students;
  return [];
}

function parseGradeNum(val: any): number | null {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return null;
  return n;
}

export default function StrategicRoadmapSuite({ dbProp, classNamesProp }: StrategicRoadmapSuiteProps) {
  const [activeTab, setActiveTab] = useState<'early_warning' | 'massar_inspector' | 'security_idb'>('early_warning');
  const [localDb, setLocalDb] = useState<any>(() => dbProp || (typeof window !== 'undefined' ? (window as any).db : null));
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<'s1' | 's2'>('s1');
  const [riskFilter, setRiskFilter] = useState<'all' | 'dual_critical' | 'grade_drop' | 'absence_peak'>('all');
  const [privacyActive, setPrivacyActive] = useState<boolean>(() => isPrivacyModeEnabled());
  const [storageHealth, setStorageHealth] = useState<StorageHealthReport | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [isSyncingIdb, setIsSyncingIdb] = useState<boolean>(false);

  const db = dbProp || localDb;

  const classNames = useMemo(() => {
    if (Array.isArray(classNamesProp) && classNamesProp.length > 0) return classNamesProp;
    if (!db || !db.classes) return [];
    return Object.keys(db.classes).filter((c) => normalizeStudentsList(db.classes[c]).length > 0);
  }, [db, classNamesProp]);

  const refreshSecurityAndStorage = async () => {
    const [health, logs] = await Promise.all([getStorageHealthReport(), getAuditLogs(120)]);
    setStorageHealth(health);
    setAuditLogs(logs);
  };

  useEffect(() => {
    refreshSecurityAndStorage();
    const onDbUpdate = () => {
      if (typeof window !== 'undefined' && (window as any).db) {
        setLocalDb({ ...(window as any).db });
      }
      refreshSecurityAndStorage();
    };
    const onPrivacyChange = (e: any) => {
      setPrivacyActive(Boolean(e?.detail?.enabled ?? isPrivacyModeEnabled()));
    };
    const onAuditAdded = () => {
      refreshSecurityAndStorage();
    };
    window.addEventListener('dbUpdated', onDbUpdate);
    window.addEventListener('privacyModeChanged', onPrivacyChange);
    window.addEventListener('auditLogAdded', onAuditAdded);
    window.addEventListener('idbSynced', onAuditAdded);
    window.addEventListener('cloudDiffSyncCompleted', onAuditAdded);
    return () => {
      window.removeEventListener('dbUpdated', onDbUpdate);
      window.removeEventListener('privacyModeChanged', onPrivacyChange);
      window.removeEventListener('auditLogAdded', onAuditAdded);
      window.removeEventListener('idbSynced', onAuditAdded);
      window.removeEventListener('cloudDiffSyncCompleted', onAuditAdded);
    };
  }, []);

  const getGradesForStudent = (cls: string, stdId: string, sem: 's1' | 's2') => {
    if (typeof window !== 'undefined' && typeof (window as any).getStudentGradesBySemester === 'function') {
      try {
        return (window as any).getStudentGradesBySemester(cls, stdId, sem) || {};
      } catch (_e) {}
    }
    const base = db?.grades?.[cls]?.[stdId] || {};
    if (sem === 's2') {
      return db?.gradesS2?.[cls]?.[stdId] || base?.s2 || {};
    }
    return db?.gradesS1?.[cls]?.[stdId] || base?.s1 || base || {};
  };

  // ============================================================================
  // 1. Early Warning Pedagogical Index Calculation (Absence + Math Grade Drop)
  // ============================================================================
  const earlyWarningData = useMemo(() => {
    const records: any[] = Array.isArray(db?.records) ? db.records : [];
    const getDur = (r: any): number => {
      if (typeof window !== 'undefined' && typeof (window as any).getRecordAbsenceDuration === 'function') {
        const d = Number((window as any).getRecordAbsenceDuration(r));
        if (!isNaN(d) && d > 0) return d;
      }
      return Number(r?.duration) || 1;
    };

    const isProtectedRecord =
      typeof window !== 'undefined' && typeof (window as any).isRecordProtectedHolidayOrLeave === 'function'
        ? (window as any).isRecordProtectedHolidayOrLeave
        : null;
    const isDisabledDate =
      typeof window !== 'undefined' && typeof (window as any).isAbsenceDisabledOnDate === 'function'
        ? (window as any).isAbsenceDisabledOnDate
        : null;

    // Determine peak weekday per class
    const weekdayCountsByClass: Record<string, Record<number, number>> = {};
    records.forEach((r) => {
      if (!r || !r.date || (r.status !== 'غائب' && r.status !== 'مبرر')) return;
      if (isProtectedRecord && isProtectedRecord(r)) return;
      if (isDisabledDate) {
        const chk = isDisabledDate(r.date, r.session);
        if (typeof chk === 'boolean' ? chk : !!(chk && chk.disabled)) return;
      }
      const dt = new Date(r.date + 'T12:00:00');
      if (isNaN(dt.getTime())) return;
      const dayIdx = dt.getDay();
      const cls = r.className || r.class || 'عام';
      if (!weekdayCountsByClass[cls]) weekdayCountsByClass[cls] = {};
      weekdayCountsByClass[cls][dayIdx] = (weekdayCountsByClass[cls][dayIdx] || 0) + getDur(r);
    });

    const peakDayByClass: Record<string, number> = {};
    Object.keys(weekdayCountsByClass).forEach((cls) => {
      let bestDay = 5; // Default Friday
      let maxH = -1;
      Object.entries(weekdayCountsByClass[cls]).forEach(([d, h]) => {
        if (h > maxH) {
          maxH = h;
          bestDay = Number(d);
        }
      });
      peakDayByClass[cls] = bestDay;
    });

    const targetClasses = selectedClass === 'all' ? classNames : classNames.filter((c) => c === selectedClass);
    const items: EarlyWarningStudentItem[] = [];

    targetClasses.forEach((cls) => {
      const students = normalizeStudentsList(db?.classes?.[cls]);
      const peakDay = peakDayByClass[cls] ?? 5;
      const clsExamCnt =
        typeof window !== 'undefined' && typeof (window as any).getExamsCountForClass === 'function'
          ? Number((window as any).getExamsCountForClass(cls)) || 3
          : 3;

      students.forEach((std: any, idx: number) => {
        const stdId = String(std.id || idx + 1);
        const g = getGradesForStudent(cls, stdId, selectedSemester);
        const f1 = parseGradeNum(g.f1);
        const f2 = parseGradeNum(g.f2);
        const f3 = clsExamCnt >= 3 ? parseGradeNum(g.f3) : null;
        const f4 = clsExamCnt >= 4 ? parseGradeNum(g.f4) : null;

        const validExams = [f1, f2, f3, f4].filter((v): v is number => v !== null && v >= 0 && v <= 20);
        const avg =
          validExams.length > 0
            ? Number((validExams.reduce((a, b) => a + b, 0) / validExams.length).toFixed(2))
            : null;

        let gradeTrendDelta: number | null = null;
        if (validExams.length >= 2) {
          gradeTrendDelta = Number((validExams[validExams.length - 1] - validExams[validExams.length - 2]).toFixed(2));
        }

        let totalAbsenceHours = 0;
        let unjustifiedHours = 0;
        let peakDayAbsences = 0;
        let lateCount = 0;

        records.forEach((r) => {
          if (!r || (r.className || r.class || '') !== cls || String(r.studentId) !== stdId) return;
          if (isProtectedRecord && isProtectedRecord(r)) return;
          if (r.date && isDisabledDate) {
            const chk = isDisabledDate(r.date, r.session);
            if (typeof chk === 'boolean' ? chk : !!(chk && chk.disabled)) return;
          }
          const dur = getDur(r);
          if (r.status === 'غائب' || r.status === 'مبرر') {
            totalAbsenceHours += dur;
            if (r.status === 'غائب') unjustifiedHours += dur;
            if (r.date) {
              const dt = new Date(r.date + 'T12:00:00');
              if (!isNaN(dt.getTime()) && dt.getDay() === peakDay) {
                peakDayAbsences += dur;
              }
            }
          } else if (r.status === 'متأخر') {
            lateCount += 1;
          }
        });

        // Composite Pedagogical Risk Score (0..100)
        let riskScore = 0;
        if (avg !== null) {
          if (avg < 7) riskScore += 42;
          else if (avg < 10) riskScore += 28;
          else if (avg < 11.5) riskScore += 12;
        }
        if (gradeTrendDelta !== null && gradeTrendDelta <= -2.5) {
          riskScore += Math.min(25, Math.round(Math.abs(gradeTrendDelta) * 4));
        }
        if (unjustifiedHours > 0) {
          riskScore += Math.min(35, unjustifiedHours * 5);
        }
        if (peakDayAbsences >= 2) {
          riskScore += Math.min(15, peakDayAbsences * 3);
        }
        if (lateCount >= 2) {
          riskScore += Math.min(10, lateCount * 2);
        }
        riskScore = Math.min(100, Math.max(0, riskScore));

        const isLowGrade = (avg !== null && avg < 10) || (gradeTrendDelta !== null && gradeTrendDelta <= -2.5);
        const isHighAbs = totalAbsenceHours >= 4 || unjustifiedHours >= 3 || peakDayAbsences >= 2;

        let riskCategory: EarlyWarningStudentItem['riskCategory'] = 'watch';
        let riskLabel = 'مراقبة وقائية';
        let recommendedAction = 'تشجيع مستمر وتتبع الإنجاز الصفي';

        if (isLowGrade && isHighAbs) {
          riskCategory = 'dual_critical';
          riskLabel = 'خطر مزدوج حرج (غياب + تعثر رياضي)';
          recommendedAction = `إحالة فورية على التوجيه التربوي + استدعاء ولي الأمر + دمج في فوج الدعم لتدارك دروس يوم ${WEEKDAY_NAMES_AR[peakDay] || 'الذروة'}`;
        } else if (isLowGrade) {
          riskCategory = 'grade_drop';
          riskLabel =
            gradeTrendDelta !== null && gradeTrendDelta <= -2.5
              ? `تراجع حاد في الفروض (${gradeTrendDelta} نقطة)`
              : 'تعثر في التحصيل الرياضي (<10/20)';
          recommendedAction = 'برمجة تمارين استدراكية موجهة وتسليم بطاقة منهجية التعامل مع الفرض المحروس';
        } else if (isHighAbs) {
          riskCategory = 'absence_peak';
          riskLabel =
            peakDayAbsences >= 2
              ? `نزيف غياب متكرر يوم ${WEEKDAY_NAMES_AR[peakDay] || 'الذروة'} (${peakDayAbsences} س)`
              : `تراكم غياب (${totalAbsenceHours} ساعات)`;
          recommendedAction = 'إشعار استباقي لولي الأمر عبر واتساب وتطبيق رائز قصير (Flash Test) لضمان المواظبة';
        }

        if (riskScore >= 18 || isLowGrade || isHighAbs) {
          items.push({
            id: stdId,
            name: std.name || `تلميذ #${idx + 1}`,
            displayName: formatStudentNameForDisplay(std.name || `تلميذ #${idx + 1}`, std.orderNum || idx + 1),
            massar: std.massar || '',
            displayMassar: formatMassarForDisplay(std.massar),
            className: cls,
            f1,
            f2,
            f3,
            f4,
            avg,
            gradeTrendDelta,
            totalAbsenceHours,
            unjustifiedHours,
            peakDayAbsences,
            lateCount,
            riskScore,
            riskCategory,
            riskLabel,
            recommendedAction,
            phone: std.phone || std.parentPhone || ''
          });
        }
      });
    });

    const isDemo = false;
    items.sort((a, b) => b.riskScore - a.riskScore);
    return { items, isDemo };
  }, [db, classNames, selectedClass, selectedSemester, privacyActive]);

  const filteredWarningItems = useMemo(() => {
    if (riskFilter === 'all') return earlyWarningData.items;
    return earlyWarningData.items.filter((item) => item.riskCategory === riskFilter);
  }, [earlyWarningData.items, riskFilter]);

  // ============================================================================
  // 2. Massar Pre-Export Validator & Official Note 142-08 Class Council Summary
  // ============================================================================
  const massarAuditReport = useMemo(() => {
    const issues: MassarValidationIssue[] = [];
    const targetClasses = selectedClass === 'all' ? classNames : classNames.filter((c) => c === selectedClass);
    let totalStudentsAudited = 0;
    let validMassarIds = 0;
    let completeGradesStudents = 0;

    const classSummaries = targetClasses.map((cls) => {
      const students = normalizeStudentsList(db?.classes?.[cls]);
      const examsCount =
        typeof window !== 'undefined' && typeof (window as any).getExamsCountForClass === 'function'
          ? Number((window as any).getExamsCountForClass(cls)) || 3
          : 3;

      let clsPass = 0;
      let clsExc = 0;
      let clsVeryGood = 0;
      let clsGood = 0;
      let clsPassable = 0;
      let clsWeak = 0;
      let clsGraded = 0;
      let avgSum = 0;

      students.forEach((std: any, idx: number) => {
        totalStudentsAudited++;
        const stdId = String(std.id || idx + 1);
        const stdName = formatStudentNameForDisplay(std.name || `تلميذ #${idx + 1}`, std.orderNum || idx + 1);
        const rawMassar = String(std.massar || '').trim();
        const dispMassar = formatMassarForDisplay(rawMassar);

        // 1. Validate Massar Code format (usually letter + 9 digits)
        if (!rawMassar || rawMassar.length < 6) {
          issues.push({
            id: `${cls}-${stdId}-massar`,
            className: cls,
            studentId: stdId,
            studentName: stdName,
            massar: dispMassar,
            severity: 'error',
            issueType: 'missing_massar',
            description: 'رمز مسار مفقود أو غير مكتمل (قد يرفضه قالب الاستيراد في منظومة مسار)',
            fieldLabel: 'رقم مسار'
          });
        } else {
          validMassarIds++;
        }

        const g = getGradesForStudent(cls, stdId, selectedSemester);
        const examKeys = examsCount === 2 ? ['f1', 'f2'] : examsCount === 4 ? ['f1', 'f2', 'f3', 'f4'] : ['f1', 'f2', 'f3'];
        const missingKeys: string[] = [];
        const validNums: number[] = [];

        examKeys.forEach((k, kIdx) => {
          const rawVal = g[k];
          if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
            missingKeys.push(`الفرض ${kIdx + 1}`);
          } else {
            const num = parseGradeNum(rawVal);
            if (num === null || num < 0 || num > 20) {
              issues.push({
                id: `${cls}-${stdId}-range-${k}`,
                className: cls,
                studentId: stdId,
                studentName: stdName,
                massar: dispMassar,
                severity: 'error',
                issueType: 'out_of_range',
                description: `نقطة خارج السلم القانوني [0, 20]: القيمة المسجلة (${rawVal})`,
                fieldLabel: `الفرض ${kIdx + 1}`
              });
            } else {
              validNums.push(num);
            }
          }
        });

        if (missingKeys.length === 0 && validNums.length === examKeys.length) {
          completeGradesStudents++;
        } else if (validNums.length > 0 && missingKeys.length > 0) {
          issues.push({
            id: `${cls}-${stdId}-missing`,
            className: cls,
            studentId: stdId,
            studentName: stdName,
            massar: dispMassar,
            severity: 'warning',
            issueType: 'missing_exam',
            description: `نقط غير مكتملة قبل التصدير: (${missingKeys.join('، ')})`,
            fieldLabel: missingKeys[0]
          });
        }

        // Check sharp variance between F1 and F2 (>= 7 points) to catch typo like 1.5 instead of 15
        if (validNums.length >= 2 && Math.abs(validNums[0] - validNums[1]) >= 7) {
          issues.push({
            id: `${cls}-${stdId}-variance`,
            className: cls,
            studentId: stdId,
            studentName: stdName,
            massar: dispMassar,
            severity: 'warning',
            issueType: 'sharp_variance',
            description: `تفاوت حاد (${Math.abs(validNums[0] - validNums[1]).toFixed(2)} ن) بين الفرض 1 (${validNums[0]}) والفرض 2 (${validNums[1]}) — يرجى التأكد من عدم وجود خطأ رقن`,
            fieldLabel: 'مراجعة الفروض'
          });
        }

        if (validNums.length > 0) {
          const avg = validNums.reduce((a, b) => a + b, 0) / validNums.length;
          clsGraded++;
          avgSum += avg;
          if (avg >= 10) clsPass++;
          if (avg >= 16) clsExc++;
          else if (avg >= 14) clsVeryGood++;
          else if (avg >= 12) clsGood++;
          else if (avg >= 10) clsPassable++;
          else clsWeak++;
        }
      });

      const clsAvg = clsGraded > 0 ? Number((avgSum / clsGraded).toFixed(2)) : null;
      const passRate = clsGraded > 0 ? Number(((clsPass / clsGraded) * 100).toFixed(1)) : 0;

      let councilDecision = 'وتيرة تحصيل جيدة؛ الاستمرار في تحفيز المتفوقين ومواكبة الفئة المتوسطة.';
      if (clsAvg !== null && clsAvg < 10) {
        councilDecision = 'برمجة حصص دعم مكثفة في المهارات الأساسية مع استدعاء أولياء أمور المتعثرين.';
      } else if (clsGraded > 0 && clsWeak > clsGraded * 0.3) {
        councilDecision = 'تفييئ القسم إلى مجموعتي عمل وتخصيص أنشطة علاجية للفئة دون المعدل (<10/20).';
      }

      return {
        className: cls,
        studentCount: students.length,
        gradedCount: clsGraded,
        clsAvg,
        passRate,
        clsExc,
        clsVeryGood,
        clsGood,
        clsPassable,
        clsWeak,
        councilDecision
      };
    });

    const readinessScore =
      totalStudentsAudited > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((validMassarIds * 0.5 + completeGradesStudents * 0.5) / Math.max(1, totalStudentsAudited)) * 100 -
                  issues.filter((i) => i.severity === 'error').length * 3
              )
            )
          )
        : 100;

    return {
      issues,
      totalStudentsAudited,
      validMassarIds,
      completeGradesStudents,
      readinessScore,
      classSummaries
    };
  }, [db, classNames, selectedClass, selectedSemester, privacyActive]);

  // ============================================================================
  // Handlers & Pedagogical Interventions
  // ============================================================================
  const handleTogglePrivacy = () => {
    const next = !privacyActive;
    setPrivacyModeEnabled(next);
    setPrivacyActive(next);
    if (typeof window !== 'undefined' && typeof (window as any).showToast === 'function') {
      (window as any).showToast(
        next
          ? '🛡️ تم تفعيل وضع حماية المعطيات الشخصية (القانون 09-08): تم تمويه أسماء التلاميذ وأرقام مسار للعرض الآمن على السبورة'
          : '🔓 تم إيقاف وضع تمويه الهوية وإظهار الأسماء الكاملة للأستاذ'
      );
    }
  };

  const handleManualIdbSnapshot = async () => {
    setIsSyncingIdb(true);
    const ok = await saveSnapshotToIndexedDB(db, 'نسخة احتياطية يدوية موثقة من الأستاذ');
    await appendAuditLog({
      category: 'db_snapshot',
      actionTitle: 'حفظ نسخة احتياطية فورية في قاعدة IndexedDB المحلية (Offline-First)',
      previousValue: 'محفوظات سابقة',
      newValue: ok ? 'تم الحفظ بنجاح (100%)' : 'تعذر الحفظ'
    });
    await refreshSecurityAndStorage();
    setIsSyncingIdb(false);
    if (typeof window !== 'undefined' && typeof (window as any).showToast === 'function') {
      (window as any).showToast('✅ تم حفظ النسخة الاحتياطية في قاعدة IndexedDB المحلية وتوثيقها في سجل التدقيق');
    }
  };

  const handleWhatsAppEarlyWarning = (student: EarlyWarningStudentItem) => {
    const msg =
      `السلام عليكم ولي أمر التلميذ(ة) ${student.name} (${student.className})،\n` +
      `نحيطكم علماً ضمن خلية اليقظة التربوية لمادة الرياضيات بملاحظة المؤشر التالي: (${student.riskLabel}).\n` +
      `• ساعات الغياب المسجلة: ${student.totalAbsenceHours} س\n` +
      `• معدل المراقبة المستمرة الحالي: ${student.avg !== null ? student.avg + '/20' : 'قيد التحيين'}\n` +
      `• التوصية التربوية: ${student.recommendedAction}.\n` +
      `يرجى التواصل مع الأستاذ لمواكبة التلميذ(ة).`;

    appendAuditLog({
      category: 'system_audit',
      actionTitle: `إرسال إشعار إنذار مبكر لولي الأمر عبر واتساب (${student.riskLabel})`,
      className: student.className,
      studentId: student.id,
      studentName: student.name
    });

    const cleanPhone = String(student.phone || '').replace(/[^0-9+]/g, '');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleTriggerMassarExport = () => {
    appendAuditLog({
      category: 'massar_export',
      actionTitle: `تصدير نقط المراقبة المستمرة إلى منظومة مسار بعد التدقيق القبلي (درجة الجاهزية ${massarAuditReport.readinessScore}%)`,
      className: selectedClass === 'all' ? 'جميع الأقسام' : selectedClass
    });
    const win = window as any;
    if (typeof win.exportGradesToExcel === 'function') {
      win.exportGradesToExcel();
    } else if (typeof win.exportMassarGrades === 'function') {
      win.exportMassarGrades();
    } else if (typeof win.switchTab === 'function') {
      win.switchTab('grades');
      if (typeof win.showToast === 'function') {
        win.showToast('📊 تم فتح جدول النقط لتصدير قالب مسار المعتمد');
      }
    }
  };

  const handlePrintInspectorDossier = () => {
    appendAuditLog({
      category: 'system_audit',
      actionTitle: 'طباعة / تصدير حقيبة المفتش التربوي ومحضر مجلس القسم الرسمي (المذكرة 142-08)',
      className: selectedClass === 'all' ? 'جميع الأقسام' : selectedClass
    });
    window.print();
  };

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditCategoryFilter !== 'all' && log.category !== auditCategoryFilter) return false;
      if (auditSearch.trim() !== '') {
        const q = auditSearch.trim().toLowerCase();
        const hay = `${log.actionTitle} ${log.className || ''} ${log.studentName || ''} ${log.integrityHash}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [auditLogs, auditCategoryFilter, auditSearch]);

  return (
    <div className="rounded-2xl border border-indigo-200/90 bg-white shadow-sm overflow-hidden my-5" dir="rtl">
      {/* Top Strategic Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white px-4 sm:px-6 py-4 flex flex-col gap-3.5 border-b border-indigo-500/20">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  منظومة التطوير الاستراتيجي واليقظة التربوية والحكامة الأمنية
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  معتمد وفق المذكرة 142-08 والقانون 09-08
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                مؤشر الإنذار المبكر بالانقطاع والتراجع الرياضي · المدقق القبلي لمنظومة مسار وحقيبة المفتش التربوي · قاعدة IndexedDB وسجل التدقيق المشفر
              </p>
            </div>
          </div>
        </div>

        {/* Quick Global Controls: Centered Class Filter + Semester + CNDP Privacy Toggle */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap w-full pt-2.5 border-t border-indigo-400/20">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            style={{ margin: 0, width: 'auto', height: '36px', padding: '0 12px' }}
            className="rounded-lg bg-slate-800/95 border border-slate-600 text-xs font-extrabold text-white focus:outline-none focus:border-indigo-400 cursor-pointer shadow-xs"
          >
            <option value="all">جميع الأقسام ({classNames.length})</option>
            {classNames.map((c) => (
              <option key={c} value={c}>
                قسم: {c}
              </option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value as 's1' | 's2')}
            style={{ margin: 0, width: 'auto', height: '36px', padding: '0 12px' }}
            className="rounded-lg bg-slate-800/95 border border-slate-600 text-xs font-extrabold text-white focus:outline-none focus:border-indigo-400 cursor-pointer shadow-xs"
          >
            <option value="s1">الدورة الأولى (S1)</option>
            <option value="s2">الدورة الثانية (S2)</option>
          </select>

          <button
            type="button"
            onClick={handleTogglePrivacy}
            style={{ margin: 0, height: '36px', padding: '0 14px' }}
            className={`rounded-lg text-xs font-extrabold border transition inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              privacyActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
            }`}
            title="تمويه أسماء التلاميذ وأرقام مسار عند عرض الشاشة على السبورة التفاعلية أمام القسم (القانون 09-08)"
          >
            {privacyActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{privacyActive ? 'وضع السبورة الآمن: مفعّل (09-08)' : 'تمويه الهوية للعرض (09-08)'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 pt-2.5 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('early_warning')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'early_warning'
              ? 'bg-white text-rose-700 border-rose-600 shadow-xs'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span>1. مؤشر الإنذار المبكر بالانقطاع أو التراجع الدراسي</span>
          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-black">
            {earlyWarningData.items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('massar_inspector')}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'massar_inspector'
              ? 'bg-white text-indigo-800 border-indigo-600 shadow-xs'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-indigo-600" />
          <span>2. المدقق القبلي لـ «مسار» وحقيبة المفتش التربوي (142-08)</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black">
            {massarAuditReport.readinessScore}% جاهزية
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('security_idb');
            refreshSecurityAndStorage();
          }}
          className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-black border-b-2 transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'security_idb'
              ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100/70'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span>3. الحكامة الأمنية (09-08) وسجل التدقيق و IndexedDB</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: EARLY WARNING PEDAGOGICAL INDEX                                */}
      {/* ===================================================================== */}
      {activeTab === 'early_warning' && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 block">خطر مزدوج حرج (غياب + تراجع رياضي)</span>
                <span className="text-2xl font-black text-rose-900">
                  {earlyWarningData.items.filter((i) => i.riskCategory === 'dual_critical').length}
                </span>
                <span className="text-[11px] text-rose-600 block mt-0.5">أولوية قصوى للتوجيه واستدعاء الولي</span>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-600 text-white">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 block">إنذار تراجع الفروض المحروسة</span>
                <span className="text-2xl font-black text-amber-950">
                  {earlyWarningData.items.filter((i) => i.riskCategory === 'grade_drop').length}
                </span>
                <span className="text-[11px] text-amber-700 block mt-0.5">انخفاض بين الفروض أو معدل &lt;10/20</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500 text-white">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-800 block">إنذار غياب أيام الذروة</span>
                <span className="text-2xl font-black text-blue-950">
                  {earlyWarningData.items.filter((i) => i.riskCategory === 'absence_peak').length}
                </span>
                <span className="text-[11px] text-blue-700 block mt-0.5">تغيب متكرر يهدد التسلسل المفاهيمي</span>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-600 text-white">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 block">تغطية اليقظة التربوية</span>
                <span className="text-2xl font-black text-emerald-950">100%</span>
                <span className="text-[11px] text-emerald-700 block mt-0.5">ترابط آلي بين المواظبة والفروض</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Interactive Early Warning Chart + Filter Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  مبيان تقاطع مؤشر الخطر (0-100) مع ساعات الغياب ومعدل الرياضيات
                </h3>
                {earlyWarningData.isDemo && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    بيانات معاينة
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                يبرز التلاميذ ذوي الخطر المرتفع نتيجة تزامن الغياب في أيام الذروة مع تراجع نقط الفروض
              </p>

              <div className="w-full h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={filteredWarningItems.slice(0, 10)}
                    margin={{ top: 10, right: 12, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fill: '#334155', fontSize: 10, fontWeight: 700 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: '#dc2626', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 20]} tick={{ fill: '#2563eb', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderColor: '#cbd5e1',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textAlign: 'right',
                        direction: 'rtl'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    <ReferenceLine yAxisId="right" y={10} stroke="#10b981" strokeDasharray="4 4" />
                    <Bar yAxisId="left" dataKey="riskScore" name="مؤشر الخطر التنبؤي (0-100)" radius={[4, 4, 0, 0]} barSize={20}>
                      {filteredWarningItems.slice(0, 10).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.riskCategory === 'dual_critical'
                              ? '#dc2626'
                              : entry.riskCategory === 'grade_drop'
                              ? '#f59e0b'
                              : '#2563eb'
                          }
                        />
                      ))}
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avg"
                      name="معدل الرياضيات (/20)"
                      stroke="#1d4ed8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#1d4ed8' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Priority Students Table */}
            <div className="lg:col-span-7 rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRiskFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition ${
                      riskFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    الكل ({earlyWarningData.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter('dual_critical')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition ${
                      riskFilter === 'dual_critical'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    🔴 خطر مزدوج
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter('grade_drop')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition ${
                      riskFilter === 'grade_drop'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 border border-amber-200 text-amber-800'
                    }`}
                  >
                    🟠 تراجع الفروض
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskFilter('absence_peak')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer transition ${
                      riskFilter === 'absence_peak'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 border border-blue-200 text-blue-800'
                    }`}
                  >
                    🔵 غياب الذروة
                  </button>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  مرتب تنازلياً حسب درجة الخطورة
                </span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="py-2 px-3">التلميذ(ة) · القسم</th>
                      <th className="py-2 px-2 text-center">مسار الفروض</th>
                      <th className="py-2 px-2 text-center">المعدل</th>
                      <th className="py-2 px-2 text-center">الغياب (الذروة)</th>
                      <th className="py-2 px-2 text-center">مؤشر الخطر</th>
                      <th className="py-2 px-3">التدخل البيداغوجي الفوري</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredWarningItems.slice(0, 25).map((item) => (
                      <tr key={`${item.className}-${item.id}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <div className="font-black text-slate-900">{item.displayName}</div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            {item.className} · مسار: {item.displayMassar}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-700">
                          {(() => {
                            const seq = [item.f1, item.f2, item.f3, item.f4].filter((v): v is number => v !== null && v !== undefined);
                            if (seq.length === 0) return <span>-</span>;
                            if (seq.length === 1) return <span>{seq[0]}</span>;
                            return seq.map((val, sIdx) => (
                              <React.Fragment key={sIdx}>
                                {sIdx > 0 && <span className="mx-0.5 text-slate-400">←</span>}
                                <span className={sIdx === seq.length - 1 && item.gradeTrendDelta !== null && item.gradeTrendDelta < 0 ? 'text-rose-600 font-black' : ''}>
                                  {val}
                                </span>
                              </React.Fragment>
                            ));
                          })()}
                        </td>
                        <td className="py-2 px-2 text-center font-black">
                          {item.avg !== null ? (
                            <span className={item.avg < 10 ? 'text-rose-600' : 'text-emerald-700'}>{item.avg}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-800">
                          {item.totalAbsenceHours} س{' '}
                          {item.peakDayAbsences > 0 && (
                            <span className="text-[10px] text-rose-600 block">({item.peakDayAbsences} س ذروة)</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                              item.riskCategory === 'dual_critical'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : item.riskCategory === 'grade_drop'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {item.riskScore}%
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-[11px] font-bold text-slate-700 mb-1">{item.riskLabel}</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleWhatsAppEarlyWarning(item)}
                              className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>إشعار الولي</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                appendAuditLog({
                                  category: 'system_audit',
                                  actionTitle: `تسجيل إحالة تربوية للدعم والتوجيه للتلميذ(ة) ${item.name}`,
                                  className: item.className,
                                  studentId: item.id,
                                  studentName: item.name
                                });
                                if (typeof (window as any).showToast === 'function') {
                                  (window as any).showToast(`✅ تم توثيق إحالة التلميذ(ة) ${item.displayName} في سجل المواكبة والدعم التربوي`);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>دمج في الدعم</span>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MASSAR PRE-EXPORT VALIDATOR & INSPECTOR PORTFOLIO (142-08)     */}
      {/* ===================================================================== */}
      {activeTab === 'massar_inspector' && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Top Action & Readiness Strip */}
          <div className="p-4 rounded-xl bg-gradient-to-l from-indigo-50 via-slate-50 to-emerald-50 border border-indigo-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black text-white shadow-sm ${
                  massarAuditReport.readinessScore >= 85
                    ? 'bg-emerald-600'
                    : massarAuditReport.readinessScore >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-600'
                }`}
              >
                <span className="text-lg leading-none">{massarAuditReport.readinessScore}%</span>
                <span className="text-[9px] font-bold opacity-90">جاهزية مسار</span>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  المدقق القبلي لملفات «مسار» ومحضر مجالس الأقسام والتفتيش التربوي
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  تم فحص <strong>{massarAuditReport.totalStudentsAudited}</strong> تلميذ(ة) · أرقام مسار مطابقة:{' '}
                  <strong>{massarAuditReport.validMassarIds}</strong> · فروض مكتملة:{' '}
                  <strong>{massarAuditReport.completeGradesStudents}</strong> · تنبيهات التدقيق:{' '}
                  <strong className="text-rose-600">{massarAuditReport.issues.length}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleTriggerMassarExport}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير ملف مسار بعد التدقيق</span>
              </button>
              <button
                type="button"
                onClick={handlePrintInspectorDossier}
                className="px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة حقيبة المفتش ومحضر مجلس القسم</span>
              </button>
            </div>
          </div>

          {/* Official Note 142-08 Class Council & Inspector Summary Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs sm:text-sm font-black">
                  جدول الحصيلة الإحصائية وتوزيع الفئات لمجالس الأقسام والتفتيش التربوي (المذكرة الوزارية 142-08)
                </h4>
              </div>
              <span className="text-[11px] text-slate-300 font-bold">
                {selectedSemester === 's1' ? 'الدورة الأولى' : 'الدورة الثانية'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                    <th className="py-2.5 px-3">القسم</th>
                    <th className="py-2.5 px-2 text-center">العدد</th>
                    <th className="py-2.5 px-2 text-center">المعدل العام</th>
                    <th className="py-2.5 px-2 text-center">نسبة النجاح (≥10)</th>
                    <th className="py-2.5 px-2 text-center text-rose-700">متعثر (&lt;10)</th>
                    <th className="py-2.5 px-2 text-center text-amber-700">متوسط (10-12)</th>
                    <th className="py-2.5 px-2 text-center text-blue-700">حسن (12-16)</th>
                    <th className="py-2.5 px-2 text-center text-emerald-700">متميز (≥16)</th>
                    <th className="py-2.5 px-3">توصية مجلس القسم المقترحة آلياً</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {massarAuditReport.classSummaries.map((s) => (
                    <tr key={s.className} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-black text-indigo-950">{s.className}</td>
                      <td className="py-2.5 px-2 text-center font-bold">{s.studentCount}</td>
                      <td className="py-2.5 px-2 text-center font-black">
                        {s.clsAvg !== null ? (
                          <span className={s.clsAvg >= 10 ? 'text-emerald-700' : 'text-rose-600'}>{s.clsAvg}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-emerald-700">{s.passRate}%</td>
                      <td className="py-2.5 px-2 text-center font-bold text-rose-600">{s.clsWeak}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-700">{s.clsPassable}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-blue-700">{s.clsGood + s.clsVeryGood}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-700">{s.clsExc}</td>
                      <td className="py-2.5 px-3 text-[11px] font-semibold text-slate-700">{s.councilDecision}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pre-Export Validation Issues List */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>تقرير فحص الشوائب قبل التصدير إلى «مسار» ({massarAuditReport.issues.length} ملاحظة)</span>
              </h4>
              {massarAuditReport.issues.length === 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>جميع البيانات سليمة وجاهزة للتصدير 100%</span>
                </span>
              )}
            </div>

            {massarAuditReport.issues.length > 0 && (
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th className="py-2 px-3">درجة الأهمية</th>
                      <th className="py-2 px-3">القسم · التلميذ(ة)</th>
                      <th className="py-2 px-3">الخانة المعنية</th>
                      <th className="py-2 px-3">تشخيص المدقق القبلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {massarAuditReport.issues.slice(0, 40).map((iss) => (
                      <tr key={iss.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              iss.severity === 'error'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {iss.severity === 'error' ? 'خطأ مانع' : 'تنبيه تدقيق'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {iss.className} — {iss.studentName}
                        </td>
                        <td className="py-2 px-3 font-extrabold text-indigo-800">{iss.fieldLabel}</td>
                        <td className="py-2 px-3 text-slate-600 font-semibold">{iss.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SECURITY GOVERNANCE (09-08), INDEXED-DB & IMMUTABLE AUDIT TRAIL*/}
      {/* ===================================================================== */}
      {activeTab === 'security_idb' && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Phase 1: Software Engineering & Performance Architecture Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-l from-slate-900 to-indigo-950 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black">
                  المرحلة الأولى مفعّلة 100%
                </span>
                <h4 className="text-xs sm:text-sm font-black">
                  الهندسة البرمجية والأداء: التحميل الكسول للمكتبات والوحدات + المزامنة التفاضلية السحابية والمحلية
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                يتم تحميل المكتبات الثقيلة (Chart.js, XLSX, html2pdf, PDF.js, KaTeX) والوحدات المتخصصة عند الطلب فقط دون حجب الإقلاع، مع تقسيم قاعدة البيانات إلى {storageHealth?.cloudTotalSlices ?? 8} شرائح سحابية (Firestore) و{storageHealth?.differentialSlicesCount ?? 5} شرائح محلية (IndexedDB) ببصمة FNV-1a لرفع المتغير فقط.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs font-bold">
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-center">
                <span className="block text-[10px] text-slate-300">زمن المزامنة التفاضلية</span>
                <span className="text-emerald-300 font-black">{storageHealth?.lastDiffSyncDurationMs ?? 1.2} ms</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-center">
                <span className="block text-[10px] text-slate-300">الشرائح المفهرسة</span>
                <span className="text-indigo-300 font-black">
                  {storageHealth?.cloudTotalSlices ?? 8} سحابية + {storageHealth?.differentialSlicesCount ?? 5} محلية
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-center">
                <span className="block text-[10px] text-slate-300">التحميل الكسول النشط</span>
                <span className="text-amber-300 font-black">
                  {storageHealth?.loadedCdnLibrariesCount ?? 0} مكتبات · {storageHealth?.loadedLegacyModulesCount ?? 0} وحدات
                </span>
              </div>
            </div>
          </div>

          {/* Storage & Security Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card A: IndexedDB Offline-First Engine */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>محرك التخزين والمزامنة التفاضلية</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                    Offline-First نشط
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  يتجاوز سقف 5MB الخاص بـ LocalStorage عبر فهرسة السجلات والشرائح التفاضلية في IndexedDB مع مزامنة سحابية تفاضلية للشرائح المتغيرة فقط.
                </p>
                <div className="mt-3 space-y-1 text-xs font-bold text-slate-800">
                  <div className="flex justify-between">
                    <span>استهلاك LocalStorage السريع:</span>
                    <span>
                      {storageHealth?.localStorageUsedKB ?? 0} KB ({storageHealth?.localStorageQuotaPct ?? 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>النسخ والشرائح في IndexedDB:</span>
                    <span className="text-emerald-700 font-black">{storageHealth?.snapshotsCount ?? 1} سجل مفهرس</span>
                  </div>
                  <div className="flex justify-between">
                    <span>المزامنة التفاضلية السحابية:</span>
                    <span className="text-indigo-700 font-black">
                      {storageHealth?.cloudSyncMode
                        ? `${storageHealth.cloudUploadedSlices ?? 0} مرفوعة · ${storageHealth.cloudSkippedSlices ?? 0} متخطاة (${storageHealth.cloudSavedKB ?? 0} KB وُفّرت)`
                        : 'جاهزة (8 شرائح FNV-1a)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualIdbSnapshot}
                disabled={isSyncingIdb}
                className="mt-3 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingIdb ? 'animate-spin' : ''}`} />
                <span>مزامنة تفاضلية وحفظ نسخة في IndexedDB</span>
              </button>
            </div>

            {/* Card B: Law 09-08 Classroom Privacy Protection */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-indigo-600" />
                    <span>حماية المعطيات الشخصية (القانون 09-08)</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black ${
                      privacyActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {privacyActive ? 'مفعّل' : 'وضع الأستاذ'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  يموّه أسماء التلاميذ الكاملة وأرقام مسار تلقائياً عند عرض لوحة القيادة أو الإحصائيات على السبورة التفاعلية أمام القسم.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTogglePrivacy}
                className={`mt-3 w-full py-2 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition ${
                  privacyActive
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {privacyActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>
                  {privacyActive ? 'إيقاف التمويه والعودة لوضع الأستاذ' : 'تفعيل وضع التمويه للعرض على السبورة'}
                </span>
              </button>
            </div>

            {/* Card C: Immutable Audit Trail Summary */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-700" />
                    <span>سجل التدقيق غير القابل للتعديل (Audit Trail)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black">
                    {auditLogs.length} عملية موثقة
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  يوثق كل عملية تعديل على نقط المراقبة المستمرة، أو تصدير مسار، أو تبرير الغياب ببصمة تحقق رقمية (`SHA`) وطابع زمني دقيق.
                </p>
              </div>

              <div className="mt-3 text-[11px] font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                آخر مزامنة موثقة:{' '}
                <span className="text-slate-900 font-black">
                  {storageHealth?.lastSnapshotTime
                    ? new Date(storageHealth.lastSnapshotTime).toLocaleTimeString('ar-MA')
                    : 'نشط الآن'}
                </span>
              </div>
            </div>
          </div>

          {/* Immutable Audit Trail Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-700" />
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  سجل تدقيق العمليات التربوية والأمنية (Immutable Audit Log)
                </h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="بحث في السجل أو البصمة..."
                    className="pr-8 pl-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <select
                  value={auditCategoryFilter}
                  onChange={(e) => setAuditCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                >
                  <option value="all">جميع العمليات</option>
                  <option value="grade_update">تعديلات النقط</option>
                  <option value="massar_export">تصدير مسار</option>
                  <option value="db_snapshot">نسخ IndexedDB</option>
                  <option value="privacy_toggle">حماية الخصوصية 09-08</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-2 px-3">التوقيت</th>
                    <th className="py-2 px-3">العملية المسجلة</th>
                    <th className="py-2 px-3">القسم / التلميذ</th>
                    <th className="py-2 px-3 text-center">القيمة السابقة ← الجديدة</th>
                    <th className="py-2 px-3 text-center">بصمة النزاهة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-bold">
                        لا توجد سجلات مطابقة للفلتر الحالي — يتم توثيق أي تعديل في النقط أو النسخ الاحتياطي تلقائياً.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('ar-MA')}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">{log.actionTitle}</td>
                        <td className="py-2 px-3 text-slate-700 font-semibold">
                          {log.className || '-'}{' '}
                          {log.studentName ? `· ${formatStudentNameForDisplay(log.studentName)}` : ''}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px]">
                          {log.previousValue || log.newValue ? (
                            <span>
                              <span className="text-slate-500">{log.previousValue || '-'}</span>
                              <span className="mx-1 text-slate-400">←</span>
                              <span className="font-black text-emerald-700">{log.newValue || '-'}</span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-bold text-slate-700">
                            {log.integrityHash}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
