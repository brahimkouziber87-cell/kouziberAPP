import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  GraduationCap,
  Filter,
  Sparkles,
  Award,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  BarChart3,
  Activity,
  Printer
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  massar?: string;
  orderNum?: string | number;
}

interface AcademicYearPerformanceTrendsProps {
  db: any;
  classNames: string[];
  onNavigateToClass?: (className: string, targetTab: 'grades' | 'absence') => void;
}

interface MilestonePoint {
  key: string;
  shortLabel: string;
  fullLabel: string;
  semesterLabel: string;
  semester: 's1' | 's2';
  examKey: 'f1' | 'f2' | 'f3' | 'f4';
  avgMark: number | null;
  topQuartileAvg: number | null;
  minMark: number | null;
  passRate: number;
  excellenceRate: number;
  gradedCount: number;
}

interface ClassAnnualTrendRow {
  className: string;
  studentCount: number;
  examsCount: number;
  s1Avg: number | null;
  s2Avg: number | null;
  annualAvg: number | null;
  delta: number | null;
  s1PassRate: number;
  s2PassRate: number;
  progressingCount: number;
  decliningCount: number;
}

interface StudentTrajectoryItem {
  id: string;
  name: string;
  massar: string;
  className: string;
  s1Avg: number | null;
  s2Avg: number | null;
  annualAvg: number | null;
  firstMark: number | null;
  latestMark: number | null;
  netDelta: number;
  marksCount: number;
  trajectory: 'rising' | 'stable' | 'declining';
}

function parseMark(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '' || raw === 'غ' || raw === 'ABS') return null;
  const n = parseFloat(String(raw).replace(',', '.'));
  if (isNaN(n) || n < 0 || n > 20) return null;
  return n;
}

function getStudentSemGradesSafe(db: any, className: string, studentId: string, sem: 's1' | 's2') {
  if (typeof window !== 'undefined' && typeof (window as any).getStudentGradesBySemester === 'function') {
    try {
      const res = (window as any).getStudentGradesBySemester(className, studentId, sem);
      if (res && typeof res === 'object') return res;
    } catch (_) {
      // fallback below
    }
  }
  const baseRecord = db?.grades?.[className]?.[studentId] || {};
  if (sem === 's2') {
    const s2Direct = db?.gradesS2?.[className]?.[studentId] || {};
    const s2Sub = baseRecord?.s2 || {};
    return {
      f1: s2Sub.f1 !== undefined ? s2Sub.f1 : s2Direct.f1,
      f2: s2Sub.f2 !== undefined ? s2Sub.f2 : s2Direct.f2,
      f3: s2Sub.f3 !== undefined ? s2Sub.f3 : s2Direct.f3,
      f4: s2Sub.f4 !== undefined ? s2Sub.f4 : s2Direct.f4
    };
  }
  const s1Direct = db?.gradesS1?.[className]?.[studentId] || {};
  const s1Sub = baseRecord?.s1 || {};
  return {
    f1: s1Sub.f1 !== undefined ? s1Sub.f1 : (s1Direct.f1 !== undefined ? s1Direct.f1 : baseRecord.f1),
    f2: s1Sub.f2 !== undefined ? s1Sub.f2 : (s1Direct.f2 !== undefined ? s1Direct.f2 : baseRecord.f2),
    f3: s1Sub.f3 !== undefined ? s1Sub.f3 : (s1Direct.f3 !== undefined ? s1Direct.f3 : baseRecord.f3),
    f4: s1Sub.f4 !== undefined ? s1Sub.f4 : (s1Direct.f4 !== undefined ? s1Direct.f4 : baseRecord.f4)
  };
}

function getExamsCountSafe(className: string): number {
  if (typeof window !== 'undefined' && typeof (window as any).getExamsCountForClass === 'function') {
    const n = Number((window as any).getExamsCountForClass(className));
    if (n >= 2 && n <= 4) return n;
  }
  const upper = (className || '').toUpperCase();
  if (
    upper.includes('LSH') ||
    upper.includes('SH') ||
    className.includes('آداب') ||
    className.includes('إنسانية')
  ) {
    return 2;
  }
  if (upper.includes('2BAC') || upper.includes('SM') || className.includes('ثانية')) {
    return 4;
  }
  return 3;
}

export default function AcademicYearPerformanceTrends({
  db,
  classNames,
  onNavigateToClass
}: AcademicYearPerformanceTrendsProps) {
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'trajectory' | 'semesters' | 'cohorts'>('trajectory');
  const [cohortFilter, setCohortFilter] = useState<'all' | 'rising' | 'declining' | 'stable'>('all');
  const [useDemoSimulation, setUseDemoSimulation] = useState<boolean>(false);

  const targetClasses = useMemo(() => {
    if (selectedClass === 'all') return classNames;
    return classNames.includes(selectedClass) ? [selectedClass] : classNames;
  }, [classNames, selectedClass]);

  const maxExamsInScope = useMemo(() => {
    if (targetClasses.length === 0) return 3;
    return Math.max(...targetClasses.map((c) => getExamsCountSafe(c)), 3);
  }, [targetClasses]);

  const analyticsData = useMemo(() => {
    const milestonesDef: Array<{
      key: string;
      shortLabel: string;
      fullLabel: string;
      semesterLabel: string;
      semester: 's1' | 's2';
      examKey: 'f1' | 'f2' | 'f3' | 'f4';
    }> = [
      { key: 's1_f1', shortLabel: 'ف1 (د1)', fullLabel: 'الفرض المحروس 1 - الدورة الأولى', semesterLabel: 'الدورة 1', semester: 's1', examKey: 'f1' },
      { key: 's1_f2', shortLabel: 'ف2 (د1)', fullLabel: 'الفرض المحروس 2 - الدورة الأولى', semesterLabel: 'الدورة 1', semester: 's1', examKey: 'f2' },
      ...(maxExamsInScope >= 3
        ? [{ key: 's1_f3', shortLabel: 'ف3 (د1)', fullLabel: 'الفرض المحروس 3 - الدورة الأولى', semesterLabel: 'الدورة 1', semester: 's1' as const, examKey: 'f3' as const }]
        : []),
      ...(maxExamsInScope >= 4
        ? [{ key: 's1_f4', shortLabel: 'ف4 (د1)', fullLabel: 'الفرض المحروس 4 - الدورة الأولى', semesterLabel: 'الدورة 1', semester: 's1' as const, examKey: 'f4' as const }]
        : []),
      { key: 's2_f1', shortLabel: 'ف1 (د2)', fullLabel: 'الفرض المحروس 1 - الدورة الثانية', semesterLabel: 'الدورة 2', semester: 's2', examKey: 'f1' },
      { key: 's2_f2', shortLabel: 'ف2 (د2)', fullLabel: 'الفرض المحروس 2 - الدورة الثانية', semesterLabel: 'الدورة 2', semester: 's2', examKey: 'f2' },
      ...(maxExamsInScope >= 3
        ? [{ key: 's2_f3', shortLabel: 'ف3 (د2)', fullLabel: 'الفرض المحروس 3 - الدورة الثانية', semesterLabel: 'الدورة 2', semester: 's2' as const, examKey: 'f3' as const }]
        : []),
      ...(maxExamsInScope >= 4
        ? [{ key: 's2_f4', shortLabel: 'ف4 (د2)', fullLabel: 'الفرض المحروس 4 - الدورة الثانية', semesterLabel: 'الدورة 2', semester: 's2' as const, examKey: 'f4' as const }]
        : [])
    ];

    const milestoneBuckets: Record<string, number[]> = {};
    milestonesDef.forEach((m) => {
      milestoneBuckets[m.key] = [];
    });

    const classTrends: ClassAnnualTrendRow[] = [];
    const studentTrajectories: StudentTrajectoryItem[] = [];

    let totalRealGradesCount = 0;

    // First pass: check if real grades exist
    targetClasses.forEach((cName) => {
      const students: Student[] = Array.isArray(db?.classes?.[cName]) ? db.classes[cName] : [];
      const examsCount = getExamsCountSafe(cName);
      const validKeys = examsCount === 2 ? ['f1', 'f2'] : examsCount === 4 ? ['f1', 'f2', 'f3', 'f4'] : ['f1', 'f2', 'f3'];
      students.forEach((std) => {
        const g1 = getStudentSemGradesSafe(db, cName, std.id, 's1');
        const g2 = getStudentSemGradesSafe(db, cName, std.id, 's2');
        validKeys.forEach((k) => {
          if (parseMark(g1[k]) !== null) totalRealGradesCount++;
          if (parseMark(g2[k]) !== null) totalRealGradesCount++;
        });
      });
    });

    const isSimulating = useDemoSimulation || totalRealGradesCount === 0;

    targetClasses.forEach((cName, clsIdx) => {
      const students: Student[] = Array.isArray(db?.classes?.[cName]) ? db.classes[cName] : [];
      const examsCount = getExamsCountSafe(cName);
      const validKeys = (examsCount === 2 ? ['f1', 'f2'] : examsCount === 4 ? ['f1', 'f2', 'f3', 'f4'] : ['f1', 'f2', 'f3']) as Array<'f1' | 'f2' | 'f3' | 'f4'>;

      let clsS1Sum = 0;
      let clsS1Cnt = 0;
      let clsS1Pass = 0;
      let clsS2Sum = 0;
      let clsS2Cnt = 0;
      let clsS2Pass = 0;
      let clsRising = 0;
      let clsDeclining = 0;

      students.forEach((std, stdIdx) => {
        const g1 = getStudentSemGradesSafe(db, cName, std.id, 's1');
        const g2 = getStudentSemGradesSafe(db, cName, std.id, 's2');

        const s1Marks: number[] = [];
        const s2Marks: number[] = [];
        const chronologicalMarks: number[] = [];

        validKeys.forEach((k, kIdx) => {
          let m1 = parseMark(g1[k]);
          let m2 = parseMark(g2[k]);

          if (isSimulating && m1 === null && m2 === null) {
            // Deterministic pedagogical curve per student
            const seed = ((stdIdx * 17 + clsIdx * 31 + kIdx * 7) % 100) / 100;
            const baseAbility = 8.5 + seed * 9.2;
            const trendSlope = (stdIdx % 5 === 0 ? -0.45 : stdIdx % 3 === 0 ? 0.65 : 0.25);
            m1 = Math.max(4, Math.min(19.5, Number((baseAbility + kIdx * trendSlope).toFixed(2))));
            m2 = Math.max(4.5, Math.min(19.75, Number((baseAbility + (kIdx + validKeys.length) * trendSlope * 0.85).toFixed(2))));
          }

          if (m1 !== null) {
            s1Marks.push(m1);
            chronologicalMarks.push(m1);
            if (milestoneBuckets[`s1_${k}`]) milestoneBuckets[`s1_${k}`].push(m1);
          }
          if (m2 !== null) {
            s2Marks.push(m2);
            chronologicalMarks.push(m2);
            if (milestoneBuckets[`s2_${k}`]) milestoneBuckets[`s2_${k}`].push(m2);
          }
        });

        const s1Avg = s1Marks.length > 0 ? Number((s1Marks.reduce((a, b) => a + b, 0) / s1Marks.length).toFixed(2)) : null;
        const s2Avg = s2Marks.length > 0 ? Number((s2Marks.reduce((a, b) => a + b, 0) / s2Marks.length).toFixed(2)) : null;
        const annualAvg =
          s1Avg !== null && s2Avg !== null
            ? Number(((s1Avg + s2Avg) / 2).toFixed(2))
            : s1Avg !== null
            ? s1Avg
            : s2Avg;

        if (s1Avg !== null) {
          clsS1Sum += s1Avg;
          clsS1Cnt++;
          if (s1Avg >= 10) clsS1Pass++;
        }
        if (s2Avg !== null) {
          clsS2Sum += s2Avg;
          clsS2Cnt++;
          if (s2Avg >= 10) clsS2Pass++;
        }

        if (chronologicalMarks.length >= 2) {
          const firstMark = chronologicalMarks[0];
          const latestMark = chronologicalMarks[chronologicalMarks.length - 1];
          const netDelta =
            s1Avg !== null && s2Avg !== null
              ? Number((s2Avg - s1Avg).toFixed(2))
              : Number((latestMark - firstMark).toFixed(2));

          let trajectory: 'rising' | 'stable' | 'declining' = 'stable';
          if (netDelta >= 0.75) {
            trajectory = 'rising';
            clsRising++;
          } else if (netDelta <= -0.75) {
            trajectory = 'declining';
            clsDeclining++;
          }

          studentTrajectories.push({
            id: std.id,
            name: std.name || `تلميذ #${std.orderNum || stdIdx + 1}`,
            massar: std.massar || '',
            className: cName,
            s1Avg,
            s2Avg,
            annualAvg,
            firstMark,
            latestMark,
            netDelta,
            marksCount: chronologicalMarks.length,
            trajectory
          });
        }
      });

      const clsS1Avg = clsS1Cnt > 0 ? Number((clsS1Sum / clsS1Cnt).toFixed(2)) : null;
      const clsS2Avg = clsS2Cnt > 0 ? Number((clsS2Sum / clsS2Cnt).toFixed(2)) : null;
      const clsAnnualAvg =
        clsS1Avg !== null && clsS2Avg !== null
          ? Number(((clsS1Avg + clsS2Avg) / 2).toFixed(2))
          : clsS1Avg !== null
          ? clsS1Avg
          : clsS2Avg;
      const clsDelta =
        clsS1Avg !== null && clsS2Avg !== null ? Number((clsS2Avg - clsS1Avg).toFixed(2)) : null;

      classTrends.push({
        className: cName,
        studentCount: students.length,
        examsCount,
        s1Avg: clsS1Avg,
        s2Avg: clsS2Avg,
        annualAvg: clsAnnualAvg,
        delta: clsDelta,
        s1PassRate: clsS1Cnt > 0 ? Number(((clsS1Pass / clsS1Cnt) * 100).toFixed(1)) : 0,
        s2PassRate: clsS2Cnt > 0 ? Number(((clsS2Pass / clsS2Cnt) * 100).toFixed(1)) : 0,
        progressingCount: clsRising,
        decliningCount: clsDeclining
      });
    });

    const milestones: MilestonePoint[] = milestonesDef.map((m) => {
      const vals = milestoneBuckets[m.key] || [];
      if (vals.length === 0) {
        return {
          ...m,
          avgMark: null,
          topQuartileAvg: null,
          minMark: null,
          passRate: 0,
          excellenceRate: 0,
          gradedCount: 0
        };
      }
      const sorted = [...vals].sort((a, b) => b - a);
      const topQCount = Math.max(1, Math.ceil(sorted.length * 0.25));
      const topQAvg = Number(
        (sorted.slice(0, topQCount).reduce((a, b) => a + b, 0) / topQCount).toFixed(2)
      );
      const avgMark = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      const minMark = Number(sorted[sorted.length - 1].toFixed(2));
      const passCount = vals.filter((v) => v >= 10).length;
      const excCount = vals.filter((v) => v >= 16).length;

      return {
        ...m,
        avgMark,
        topQuartileAvg: topQAvg,
        minMark,
        passRate: Number(((passCount / vals.length) * 100).toFixed(1)),
        excellenceRate: Number(((excCount / vals.length) * 100).toFixed(1)),
        gradedCount: vals.length
      };
    });

    const activeMilestones = milestones.filter((m) => m.gradedCount > 0);
    const s1Milestones = activeMilestones.filter((m) => m.semester === 's1' && m.avgMark !== null);
    const s2Milestones = activeMilestones.filter((m) => m.semester === 's2' && m.avgMark !== null);

    const overallS1Avg =
      s1Milestones.length > 0
        ? Number(
            (
              s1Milestones.reduce((acc, m) => acc + (m.avgMark || 0), 0) / s1Milestones.length
            ).toFixed(2)
          )
        : null;
    const overallS2Avg =
      s2Milestones.length > 0
        ? Number(
            (
              s2Milestones.reduce((acc, m) => acc + (m.avgMark || 0), 0) / s2Milestones.length
            ).toFixed(2)
          )
        : null;

    const overallS1PassRate =
      s1Milestones.length > 0
        ? Number(
            (
              s1Milestones.reduce((acc, m) => acc + m.passRate, 0) / s1Milestones.length
            ).toFixed(1)
          )
        : 0;
    const overallS2PassRate =
      s2Milestones.length > 0
        ? Number(
            (
              s2Milestones.reduce((acc, m) => acc + m.passRate, 0) / s2Milestones.length
            ).toFixed(1)
          )
        : 0;

    let netProgressionDelta: number | null = null;
    if (overallS1Avg !== null && overallS2Avg !== null) {
      netProgressionDelta = Number((overallS2Avg - overallS1Avg).toFixed(2));
    } else if (activeMilestones.length >= 2) {
      const firstM = activeMilestones[0].avgMark || 0;
      const lastM = activeMilestones[activeMilestones.length - 1].avgMark || 0;
      netProgressionDelta = Number((lastM - firstM).toFixed(2));
    }

    const risingCount = studentTrajectories.filter((s) => s.trajectory === 'rising').length;
    const stableCount = studentTrajectories.filter((s) => s.trajectory === 'stable').length;
    const decliningCount = studentTrajectories.filter((s) => s.trajectory === 'declining').length;

    return {
      milestones,
      classTrends,
      studentTrajectories,
      overallS1Avg,
      overallS2Avg,
      overallS1PassRate,
      overallS2PassRate,
      netProgressionDelta,
      risingCount,
      stableCount,
      decliningCount,
      isSimulating,
      totalRealGradesCount
    };
  }, [db, targetClasses, maxExamsInScope, useDemoSimulation]);

  const filteredCohorts = useMemo(() => {
    const list = analyticsData.studentTrajectories.filter((item) => {
      if (cohortFilter === 'all') return true;
      return item.trajectory === cohortFilter;
    });
    return [...list].sort((a, b) => {
      if (cohortFilter === 'declining') return a.netDelta - b.netDelta;
      return b.netDelta - a.netDelta;
    });
  }, [analyticsData.studentTrajectories, cohortFilter]);

  const handleOpenStudentPortfolio = (className: string, studentId: string) => {
    if (typeof window !== 'undefined' && typeof (window as any).openStudentDigitalPortfolio === 'function') {
      (window as any).openStudentDigitalPortfolio(className, studentId);
    } else if (onNavigateToClass) {
      onNavigateToClass(className, 'grades');
    }
  };

  const handleEnrollInRemedial = (className: string, studentId: string, studentName: string) => {
    if (typeof window !== 'undefined' && typeof (window as any).addStudentToTutoringDirect === 'function') {
      (window as any).addStudentToTutoringDirect(className, studentId);
      if (typeof (window as any).showToast === 'function') {
        (window as any).showToast(`✅ تم إدراج التلميذ(ة) «${studentName}» في لائحة الدعم التربوي`);
      }
    } else if (onNavigateToClass) {
      onNavigateToClass(className, 'grades');
    }
  };

  const handlePrintAnnualTrendsReport = () => {
    const scopeTitle = selectedClass === 'all' ? `جميع الأقسام المسندة (${classNames.length})` : `القسم: ${selectedClass}`;
    const printDate = new Date().toLocaleDateString('ar-MA');
    const teacherName = db?.teacherProfile?.name || 'الأستاذ إبراهيم قزيبر';
    const schoolName = db?.teacherProfile?.school || 'الثانوية التأهيلية';

    const milestonesRows = analyticsData.milestones
      .filter((m) => m.gradedCount > 0)
      .map(
        (m) => `
        <tr>
          <td style="border:1px solid #334155;padding:5px;font-weight:800;">${m.fullLabel}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${m.gradedCount}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:900;color:#1e3a8a;">${m.avgMark !== null ? m.avgMark.toFixed(2) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;color:#0284c7;font-weight:700;">${m.topQuartileAvg !== null ? m.topQuartileAvg.toFixed(2) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;color:#059669;font-weight:800;">${m.passRate}%</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;color:#4f46e5;font-weight:700;">${m.excellenceRate}%</td>
        </tr>`
      )
      .join('');

    const classRows = analyticsData.classTrends
      .map(
        (c) => `
        <tr>
          <td style="border:1px solid #334155;padding:5px;font-weight:900;">${c.className}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${c.studentCount}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:700;">${c.s1Avg !== null ? c.s1Avg.toFixed(2) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:700;color:#312e81;">${c.s2Avg !== null ? c.s2Avg.toFixed(2) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:900;color:#047857;">${c.annualAvg !== null ? c.annualAvg.toFixed(2) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;font-weight:800;color:${(c.delta || 0) >= 0 ? '#047857' : '#be123c'};">${c.delta !== null ? (c.delta > 0 ? `+${c.delta.toFixed(2)}` : c.delta.toFixed(2)) : '—'}</td>
          <td style="border:1px solid #334155;padding:5px;text-align:center;">${c.progressingCount} متطور / ${c.decliningCount} متراجع</td>
        </tr>`
      )
      .join('');

    const htmlContent = `
      <div style="direction:rtl;font-family:'Cairo',sans-serif;color:#0f172a;padding:4mm;">
        <div style="border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:11px;font-weight:800;line-height:1.5;">
            <div>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
            <div>المؤسسة: ${schoolName} · المادة: الرياضيات</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:15px;font-weight:900;color:#1e3a8a;">حصيلة مسار تطور التحصيل الدراسي السنوي (S1 → S2)</div>
            <div style="font-size:11px;font-weight:700;color:#475569;">${scopeTitle}</div>
          </div>
          <div style="font-size:11px;font-weight:800;text-align:left;line-height:1.5;">
            <div>الأستاذ: ${teacherName}</div>
            <div>التاريخ: ${printDate}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;text-align:center;">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#f8fafc;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">معدل الأسدوس الأول (S1)</div>
            <div style="font-size:14px;font-weight:900;color:#0f172a;">${analyticsData.overallS1Avg !== null ? `${analyticsData.overallS1Avg.toFixed(2)} / 20` : '—'}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#f8fafc;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">معدل الأسدوس الثاني (S2)</div>
            <div style="font-size:14px;font-weight:900;color:#1e3a8a;">${analyticsData.overallS2Avg !== null ? `${analyticsData.overallS2Avg.toFixed(2)} / 20` : '—'}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#f8fafc;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">صافي التطور السنوي</div>
            <div style="font-size:14px;font-weight:900;color:${(analyticsData.netProgressionDelta || 0) >= 0 ? '#047857' : '#be123c'};">${analyticsData.netProgressionDelta !== null ? (analyticsData.netProgressionDelta > 0 ? `+${analyticsData.netProgressionDelta.toFixed(2)}` : analyticsData.netProgressionDelta.toFixed(2)) : '—'}</div>
          </div>
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#f8fafc;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">حركية التلاميذ</div>
            <div style="font-size:11px;font-weight:800;color:#0f172a;">${analyticsData.risingCount} متطور · ${analyticsData.stableCount} مستقر · ${analyticsData.decliningCount} متراجع</div>
          </div>
        </div>

        <h4 style="margin:8px 0 5px 0;font-size:12px;font-weight:900;color:#1e3a8a;">1. جدول تطور نتائج محطات المراقبة المستمرة:</h4>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px;">
          <thead>
            <tr style="background:#f1f5f9;font-weight:900;">
              <th style="border:1px solid #334155;padding:5px;text-align:right;">محطة التقويم</th>
              <th style="border:1px solid #334155;padding:5px;">المصنفون</th>
              <th style="border:1px solid #334155;padding:5px;">المعدل العام (/20)</th>
              <th style="border:1px solid #334155;padding:5px;">متوسط الربع الأعلى</th>
              <th style="border:1px solid #334155;padding:5px;">نسبة التحكم (≥10)</th>
              <th style="border:1px solid #334155;padding:5px;">نسبة التميز (≥16)</th>
            </tr>
          </thead>
          <tbody>${milestonesRows}</tbody>
        </table>

        <h4 style="margin:8px 0 5px 0;font-size:12px;font-weight:900;color:#0f766e;">2. مقارنة نتائج الأسدوسين الأول والثاني حسب الأقسام:</h4>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:14px;">
          <thead>
            <tr style="background:#f0fdfa;font-weight:900;">
              <th style="border:1px solid #334155;padding:5px;text-align:right;">القسم</th>
              <th style="border:1px solid #334155;padding:5px;">التلاميذ</th>
              <th style="border:1px solid #334155;padding:5px;">معدل الدورة 1</th>
              <th style="border:1px solid #334155;padding:5px;">معدل الدورة 2</th>
              <th style="border:1px solid #334155;padding:5px;">المعدل السنوي</th>
              <th style="border:1px solid #334155;padding:5px;">فارق التطور (Δ)</th>
              <th style="border:1px solid #334155;padding:5px;">حركية المسارات</th>
            </tr>
          </thead>
          <tbody>${classRows}</tbody>
        </table>

        <div class="official-universal-bottom-bar" style="margin-top:16px;padding-top:6px;border-top:1.5px solid #cbd5e1;text-align:center;font-size:10.5px;font-weight:800;color:#1e3a8a;">
          منظومة التدبير التربوي -مادة الرياضيات- الأستاذ إبراهيم قزيبر
        </div>
      </div>
    `;

    if (typeof window !== 'undefined' && typeof (window as any).openCustomPrintPreviewModal === 'function') {
      (window as any).openCustomPrintPreviewModal(htmlContent, {
        title: `حصيلة_التطور_السنوي_${selectedClass === 'all' ? 'الشاملة' : selectedClass}`,
        orientation: 'portrait',
        subtitle: `تقرير رسمي مقارن لمسار التحصيل الدراسي السنوي بين الأسدوسين (${scopeTitle})`
      });
    } else if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white mb-5">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <GraduationCap className="w-5 h-5 text-indigo-700 shrink-0" />
            <h3 className="text-base font-black text-slate-900">
              مسار تطور التحصيل الدراسي السنوي عبر محطات التقويم (S1 → S2)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
            <span>تحليل طولي لنتائج الفروض المحروسة</span>
            <span aria-hidden="true">·</span>
            <span>مقارنة الأسدوسين الأول والثاني</span>
            <span aria-hidden="true">·</span>
            <span>تصنيف مسارات التقدم والتعثر</span>
            {analyticsData.isSimulating && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 font-bold">
                  معاينة توضيحية (تُستبدل تلقائياً فور مسك النقط)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Class Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">القسم:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">جميع الأقسام المسندة ({classNames.length})</option>
              {classNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('trajectory')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'trajectory'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المنحنى السنوي للفروض
            </button>
            <button
              type="button"
              onClick={() => setViewMode('semesters')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'semesters'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مقارنة الأسدوسين (S1/S2)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cohorts')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'cohorts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مسارات التلاميذ ({analyticsData.studentTrajectories.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintAnnualTrendsReport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="طباعة وتصدير حصيلة التطور السنوي كوثيقة رسمية A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الحصيلة</span>
          </button>

          {analyticsData.totalRealGradesCount > 0 && (
            <button
              type="button"
              onClick={() => setUseDemoSimulation(!useDemoSimulation)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                useDemoSimulation
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
              title="التبديل بين النقط الفعلية المسجلة ومحاكاة العام الدراسي الكامل"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{useDemoSimulation ? 'عرض النقط الفعلية' : 'محاكاة العام الكامل'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-500 mb-1">
            معدل الأسدوس الأول (الدورة 1)
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-slate-900 font-mono tabular-nums">
              {analyticsData.overallS1Avg !== null ? `${analyticsData.overallS1Avg.toFixed(2)} / 20` : '—'}
            </span>
            <span className="text-xs font-semibold text-slate-600 font-mono tabular-nums">
              تحكم: {analyticsData.overallS1PassRate}%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-500 mb-1">
            معدل الأسدوس الثاني (الدورة 2)
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-black text-indigo-950 font-mono tabular-nums">
              {analyticsData.overallS2Avg !== null ? `${analyticsData.overallS2Avg.toFixed(2)} / 20` : '—'}
            </span>
            <span className="text-xs font-semibold text-indigo-700 font-mono tabular-nums">
              تحكم: {analyticsData.overallS2PassRate}%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-500 mb-1">
            صافي التطور البيداغوجي السنوي
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-xl font-black font-mono tabular-nums flex items-center gap-1 ${
                (analyticsData.netProgressionDelta || 0) > 0
                  ? 'text-emerald-700'
                  : (analyticsData.netProgressionDelta || 0) < 0
                  ? 'text-rose-600'
                  : 'text-slate-700'
              }`}
            >
              {analyticsData.netProgressionDelta !== null ? (
                <>
                  {analyticsData.netProgressionDelta > 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : analyticsData.netProgressionDelta < 0 ? (
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {analyticsData.netProgressionDelta > 0
                      ? `+${analyticsData.netProgressionDelta.toFixed(2)}`
                      : analyticsData.netProgressionDelta.toFixed(2)}
                  </span>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="text-xs text-slate-500">نقطة بين المحطتين</span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-500 mb-1">
            حركية مسارات التلاميذ خلال السنة
          </div>
          <div className="flex items-center justify-between text-xs font-bold mt-1 font-mono tabular-nums">
            <span className="text-emerald-700 flex items-center gap-0.5" title="تلاميذ تحسنت نتائجهم بـ +0.75 نقطة أو أكثر">
              <ArrowUpRight className="w-3.5 h-3.5" />
              متطورون: {analyticsData.risingCount}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600" title="تلاميذ ذوو أداء مستقر">
              مستقرون: {analyticsData.stableCount}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-rose-600 flex items-center gap-0.5" title="تلاميذ تراجعت نتائجهم بـ -0.75 نقطة أو أكثر">
              <ArrowDownRight className="w-3.5 h-3.5" />
              متراجعون: {analyticsData.decliningCount}
            </span>
          </div>
        </div>
      </div>

      {/* Mode 1: Longitudinal Academic Year Trajectory Chart */}
      {viewMode === 'trajectory' && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2 px-1 text-xs">
            <span className="font-bold text-slate-700">
              منحنى تطور المعدل العام، الربع الأعلى للمتفوقين، ونسبة الاستيفاء (≥10/20) عبر محطات المراقبة المستمرة:
            </span>
            <div className="flex items-center gap-3 text-slate-600">
              <span>المحور الأيسر: النقطة (/20)</span>
              <span aria-hidden="true">·</span>
              <span>المحور الأيمن: نسبة الاستيفاء (%)</span>
            </div>
          </div>

          <div className="w-full h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={analyticsData.milestones}
                margin={{ top: 12, right: 18, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="annualAvgAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis
                  yAxisId="mark"
                  domain={[0, 20]}
                  ticks={[0, 5, 10, 12, 14, 16, 20]}
                  tick={{ fill: '#334155', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: '#059669', fontSize: 11 }}
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
                    const item = payload?.[0]?.payload as MilestonePoint | undefined;
                    return item ? `${item.fullLabel} (${item.gradedCount} تلميذ)` : String(_label);
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '6px' }} />
                <ReferenceLine
                  yAxisId="mark"
                  y={10}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'عتبة التحكم 10/20',
                    position: 'insideTopRight',
                    fill: '#dc2626',
                    fontSize: 10,
                    fontWeight: 700
                  }}
                />
                <Bar
                  yAxisId="pct"
                  dataKey="passRate"
                  name="نسبة التحكم ≥10 (%)"
                  fill="#10b981"
                  fillOpacity={0.28}
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
                <Area
                  yAxisId="mark"
                  type="monotone"
                  dataKey="avgMark"
                  name="المعدل العام للفصل (/20)"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fill="url(#annualAvgAreaGrad)"
                  dot={{ r: 5, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls
                />
                <Line
                  yAxisId="mark"
                  type="monotone"
                  dataKey="topQuartileAvg"
                  name="متوسط الربع الأعلى للمتفوقين (/20)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 4, fill: '#0284c7' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mode 2: Semester 1 vs Semester 2 Comparison by Class */}
      {viewMode === 'semesters' && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2 px-1 text-xs">
            <span className="font-bold text-slate-700">
              مقارنة معدل الأسدوس الأول (S1) ومعدل الأسدوس الثاني (S2) والمعدل السنوي حسب الأقسام:
            </span>
            <span className="text-slate-500">
              انقر على أي قسم في الجدول أدناه لفتح سجل النقط المباشر
            </span>
          </div>

          <div className="w-full h-72 mb-4" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analyticsData.classTrends}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="className"
                  tick={{ fill: '#1e293b', fontSize: 11, fontWeight: 700 }}
                />
                <YAxis domain={[0, 20]} ticks={[0, 5, 10, 12, 14, 16, 20]} tick={{ fill: '#475569', fontSize: 11 }} />
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
                <ReferenceLine y={10} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="s1Avg" name="معدل الدورة الأولى (S1)" fill="#64748b" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="s2Avg" name="معدل الدورة الثانية (S2)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="annualAvg" name="المعدل السنوي العام" fill="#059669" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <th className="py-2 px-3">القسم</th>
                  <th className="py-2 px-3 text-center">التلاميذ</th>
                  <th className="py-2 px-3 text-center">معدل الدورة 1 (S1)</th>
                  <th className="py-2 px-3 text-center">معدل الدورة 2 (S2)</th>
                  <th className="py-2 px-3 text-center">المعدل السنوي</th>
                  <th className="py-2 px-3 text-center">فارق التطور (Δ)</th>
                  <th className="py-2 px-3 text-center">متطورون ↗ / متراجعون ↘</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                {analyticsData.classTrends.map((row) => (
                  <tr
                    key={row.className}
                    onClick={() => onNavigateToClass && onNavigateToClass(row.className, 'grades')}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 font-sans font-black text-slate-900">{row.className}</td>
                    <td className="py-2 px-3 text-center text-slate-700">{row.studentCount}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-700">
                      {row.s1Avg !== null ? row.s1Avg.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-indigo-800">
                      {row.s2Avg !== null ? row.s2Avg.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-black text-emerald-800">
                      {row.annualAvg !== null ? row.annualAvg.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {row.delta !== null ? (
                        <span
                          className={
                            row.delta > 0
                              ? 'text-emerald-700'
                              : row.delta < 0
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }
                        >
                          {row.delta > 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-emerald-700 font-bold">{row.progressingCount} ↗</span>
                      <span className="mx-1.5 text-slate-300">/</span>
                      <span className="text-rose-600 font-bold">{row.decliningCount} ↘</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 3: Student Trajectory Cohorts */}
      {viewMode === 'cohorts' && (
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setCohortFilter('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  cohortFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                الكل ({analyticsData.studentTrajectories.length})
              </button>
              <button
                type="button"
                onClick={() => setCohortFilter('rising')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  cohortFilter === 'rising' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                مسار تصاعدي ↗ ({analyticsData.risingCount})
              </button>
              <button
                type="button"
                onClick={() => setCohortFilter('stable')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  cohortFilter === 'stable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                مسار مستقر ━ ({analyticsData.stableCount})
              </button>
              <button
                type="button"
                onClick={() => setCohortFilter('declining')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  cohortFilter === 'declining' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                مسار متراجع للدعم ↘ ({analyticsData.decliningCount})
              </button>
            </div>

            <span className="text-xs text-slate-500">
              انقر على «ملف الإنجاز» لمعاينة التطور الفردي المفصل للتلميذ
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80">
            <table className="w-full text-right border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2 px-3">التلميذ(ة)</th>
                  <th className="py-2 px-3 text-center">القسم</th>
                  <th className="py-2 px-3 text-center">معدل د1 (S1)</th>
                  <th className="py-2 px-3 text-center">معدل د2 (S2)</th>
                  <th className="py-2 px-3 text-center">المعدل السنوي</th>
                  <th className="py-2 px-3 text-center">صافي التغير (Δ)</th>
                  <th className="py-2 px-3 text-center">المنحى العام</th>
                  <th className="py-2 px-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCohorts.slice(0, 40).map((std) => (
                  <tr key={`${std.className}-${std.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {std.name}
                      {std.massar && (
                        <span className="text-[11px] text-slate-400 font-mono mr-1.5">
                          ({std.massar})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-semibold text-slate-700">
                      {std.className}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums font-bold text-slate-700">
                      {std.s1Avg !== null ? std.s1Avg.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums font-bold text-indigo-800">
                      {std.s2Avg !== null ? std.s2Avg.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums font-black text-slate-900">
                      {std.annualAvg !== null ? std.annualAvg.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`py-2 px-3 text-center font-mono tabular-nums font-black ${
                        std.netDelta > 0
                          ? 'text-emerald-700'
                          : std.netDelta < 0
                          ? 'text-rose-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {std.netDelta > 0 ? `+${std.netDelta.toFixed(2)}` : std.netDelta.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {std.trajectory === 'rising' ? (
                        <span className="text-emerald-700">تطور إيجابي ↗</span>
                      ) : std.trajectory === 'declining' ? (
                        <span className="text-rose-600">تراجع يحتاج دعماً ↘</span>
                      ) : (
                        <span className="text-slate-600">مستقر ━</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenStudentPortfolio(std.className, std.id)}
                          className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          ملف الإنجاز
                        </button>
                        {(std.trajectory === 'declining' || (std.annualAvg !== null && std.annualAvg < 10)) && (
                          <button
                            type="button"
                            onClick={() => handleEnrollInRemedial(std.className, std.id, std.name)}
                            className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
                            title="إدراج مباشر في برنامج الدعم التربوي الاستدراكي"
                          >
                            + دعم
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCohorts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-bold">
                      لا توجد بيانات مطابقة لهذا التصنيف حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
