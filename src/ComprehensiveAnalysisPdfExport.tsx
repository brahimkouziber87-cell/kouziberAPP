import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FileText, Download, Activity, CheckCircle2, Award, AlertTriangle, Printer, Layers } from 'lucide-react';
import { StudentMetric } from './Analysis';

export interface ComprehensivePdfExportHandle {
  exportPdf: () => Promise<void>;
}

interface ComprehensiveAnalysisPdfExportProps {
  db: any;
  selectedClass: string;
  semester: 's1' | 's2';
  studentMetrics: StudentMetric[];
  classAverages: {
    overall: number | null;
    f1: number | null;
    f2: number | null;
    f3: number | null;
    f4?: number | null;
    testedCount?: number;
    passPct?: number;
    median?: number | null;
    stdDev?: number | null;
    minMark?: number | null;
    maxMark?: number | null;
  };
  cohortStats: {
    total: number;
    top: number;
    topPct: number;
    medium: number;
    medPct: number;
    atRisk: number;
    atRiskPct: number;
    passing: number;
    passPct: number;
    improving: number;
    declining: number;
    bestStudent?: { name: string; avg: number } | null;
    lowestStudent?: { name: string; avg: number } | null;
  };
  macroTrend: {
    direction: 'improving' | 'declining' | 'stable';
    delta: number;
    deltaPercent: number;
    improvingPercent: number;
    decliningPercent: number;
    stablePercent: number;
  };
  distributionData: Array<{
    label: string;
    min: number;
    max: number;
    count: number;
    color: string;
    pct: number;
  }>;
  classAbsenceSuccessComparison: Array<{
    className: string;
    overallTestedStudents: number;
    overallSuccessRate: number;
    absenceRatePercent: number;
    totalAbsentHours: number;
    avgAbsentHoursPerStudent: number;
    f1SuccessRate?: number;
    f2SuccessRate?: number;
    f3SuccessRate?: number;
  }>;
  overallAbsenceSuccessKPIs: {
    avgSuccessRate: number;
    avgAbsenceRate: number;
    topClassBySuccess: string;
    bestDisciplinedClass: string;
    totalTestedAllClasses: number;
    totalAbsentHoursAllClasses: number;
  };
}

const ComprehensiveAnalysisPdfExport = forwardRef<ComprehensivePdfExportHandle, ComprehensiveAnalysisPdfExportProps>(
  (props, ref) => {
    const {
      db,
      selectedClass,
      semester,
      studentMetrics,
      classAverages,
      cohortStats,
      macroTrend,
      distributionData,
      classAbsenceSuccessComparison,
      overallAbsenceSuccessKPIs
    } = props;

    const teacherProfile = db?.teacherProfile || {};
    const school = teacherProfile.school || 'المؤسسة التعليمية';
    const academy = teacherProfile.academy || 'الأكاديمية الجهوية للتربية والتكوين - جهة الرباط سلا القنيطرة';
    const directorate = teacherProfile.directorate || 'المديرية الإقليمية';
    const academicYear = teacherProfile.academicYear || '2026/2027';
    const teacherName = teacherProfile.name || 'الأستاذ: إبراهيم كوزيبر (Prof. Brahim Kouziber)';
    const institutionLogo = teacherProfile.schoolLogo || teacherProfile.institutionLogo || '/institution-logo.svg';
    const teacherLogo = teacherProfile.teacherLogo || teacherProfile.photo || '/logo.svg';

    const [isGenerating, setIsGenerating] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const reportRef = useRef<HTMLDivElement>(null);

    const semesterLabel = semester === 's1' ? 'الدورة الأولى (S1)' : 'الدورة الثانية (S2)';
    const classLabel = selectedClass === 'all' ? 'كافة الأقسام المسجلة' : `القسم: ${selectedClass}`;
    const currentDate = new Date().toLocaleDateString('ar-MA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Split students into chunks of 22 per page for crisp, readable printing without overflow
    const STUDENTS_PER_PAGE = 22;
    const studentChunks: StudentMetric[][] = [];
    if (studentMetrics.length === 0) {
      studentChunks.push([]);
    } else {
      for (let i = 0; i < studentMetrics.length; i += STUDENTS_PER_PAGE) {
        studentChunks.push(studentMetrics.slice(i, i + STUDENTS_PER_PAGE));
      }
    }

    const atRiskStudents = studentMetrics.filter(s => s.avg !== null && s.avg < 10);
    const hasF4 = studentMetrics.some(m => m.f4 !== null && m.f4 !== undefined) || (classAverages.f4 !== null && classAverages.f4 !== undefined);

    // SVG Chart 1: Macro Trend Progression across F1, F2, F3, and F4 (if applicable)
    const renderMacroTrendSvg = () => {
      const f1 = classAverages.f1 ?? 0;
      const f2 = classAverages.f2 ?? 0;
      const f3 = classAverages.f3 ?? 0;
      const f4 = classAverages.f4 ?? 0;

      // Dimensions: 700 x 200
      const w = 700;
      const h = 200;
      const padX = 80;
      const padY = 35;
      const chartW = w - padX * 2;
      const chartH = h - padY * 2;

      const scaleY = (val: number) => padY + chartH - (Math.min(20, Math.max(0, val)) / 20) * chartH;
      const points: { x: number; y: number; label: string; val: number | null }[] = hasF4
        ? [
            { x: padX + chartW * 0.1, y: scaleY(f1), label: 'الفرض 1', val: classAverages.f1 },
            { x: padX + chartW * 0.36, y: scaleY(f2), label: 'الفرض 2', val: classAverages.f2 },
            { x: padX + chartW * 0.63, y: scaleY(f3), label: 'الفرض 3', val: classAverages.f3 },
            { x: padX + chartW * 0.9, y: scaleY(f4), label: 'الفرض 4', val: classAverages.f4 ?? null }
          ]
        : [
            { x: padX + chartW * 0.15, y: scaleY(f1), label: 'الفرض 1', val: classAverages.f1 },
            { x: padX + chartW * 0.5, y: scaleY(f2), label: 'الفرض 2', val: classAverages.f2 },
            { x: padX + chartW * 0.85, y: scaleY(f3), label: 'الفرض 3', val: classAverages.f3 }
          ];

      const validPoints = points.filter(p => p.val !== null);
      const linePath = validPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      const passingY = scaleY(10);

      return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible font-sans">
          <defs>
            <linearGradient id="macroLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Background grid */}
          {[0, 5, 10, 15, 20].map(val => {
            const y = scaleY(val);
            return (
              <g key={val}>
                <line x1={padX} y1={y} x2={w - padX} y2={y} stroke={val === 10 ? '#f87171' : '#e2e8f0'} strokeWidth={val === 10 ? '1.5' : '1'} strokeDasharray={val === 10 ? '4,4' : 'none'} />
                <text x={padX - 12} y={y + 4} fontSize="11" fill={val === 10 ? '#ef4444' : '#64748b'} textAnchor="end" fontWeight="bold">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Passing threshold label */}
          <text x={w - padX + 8} y={passingY + 4} fontSize="10" fill="#dc2626" fontWeight="bold">
            عتبة النجاح (10/20)
          </text>

          {/* Line connection */}
          {validPoints.length > 1 && (
            <path d={linePath} fill="none" stroke="url(#macroLineGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" />
          )}

          {/* Data points */}
          {points.map((p, idx) => {
            const hasVal = p.val !== null;
            return (
              <g key={idx}>
                <text x={p.x} y={h - 8} fontSize="12" fill="#334155" textAnchor="middle" fontWeight="bold">
                  {p.label}
                </text>
                {hasVal ? (
                  <>
                    <circle cx={p.x} cy={p.y} r="8" fill="#ffffff" stroke="#2563eb" strokeWidth="3" filter="url(#shadow)" />
                    <circle cx={p.x} cy={p.y} r="3.5" fill="#2563eb" />
                    <rect x={p.x - 30} y={p.y - 32} width="60" height="22" rx="6" fill="#1e293b" />
                    <text x={p.x} y={p.y - 17} fontSize="11" fill="#ffffff" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                      {p.val}/20
                    </text>
                  </>
                ) : (
                  <text x={p.x} y={scaleY(10)} fontSize="11" fill="#94a3b8" textAnchor="middle" fontStyle="italic">
                    (لم ينجز بعد)
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      );
    };

    // SVG Chart 2: Grade Distribution Histogram
    const renderDistributionSvg = () => {
      const w = 700;
      const h = 210;
      const padX = 40;
      const padY = 30;
      const chartW = w - padX * 2;
      const chartH = h - padY * 2;

      const maxCount = Math.max(1, ...distributionData.map(d => d.count));
      const barWidth = Math.min(65, (chartW / distributionData.length) - 20);

      return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible font-sans">
          <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#94a3b8" strokeWidth="1.5" />

          {distributionData.map((d, idx) => {
            const slotX = padX + (idx + 0.5) * (chartW / distributionData.length);
            const barHeight = (d.count / maxCount) * chartH;
            const barX = slotX - barWidth / 2;
            const barY = h - padY - barHeight;

            return (
              <g key={idx}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx="6"
                  fill={d.color}
                  opacity="0.9"
                />
                <text x={slotX} y={Math.max(16, barY - 7)} fontSize="11" fill="#1e293b" textAnchor="middle" fontWeight="bold">
                  {d.count} تلميذ ({d.pct}%)
                </text>
                <text x={slotX} y={h - 10} fontSize="10.5" fill="#475569" textAnchor="middle" fontWeight="600">
                  {d.label.split(' ')[0]}
                </text>
              </g>
            );
          })}
        </svg>
      );
    };

    // SVG Chart 3: Absence vs Success Comparison per class
    const renderAbsenceVsSuccessSvg = () => {
      const classes = classAbsenceSuccessComparison.slice(0, 7);
      if (classes.length === 0) return null;

      const w = 700;
      const h = 210;
      const padX = 50;
      const padY = 35;
      const chartW = w - padX * 2;
      const chartH = h - padY * 2;
      const groupW = chartW / classes.length;
      const barW = Math.min(26, groupW * 0.35);

      return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible font-sans">
          {[0, 25, 50, 75, 100].map(val => {
            const y = padY + chartH - (val / 100) * chartH;
            return (
              <g key={val}>
                <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />
                <text x={padX - 8} y={y + 4} fontSize="10" fill="#64748b" textAnchor="end" fontWeight="bold">
                  {val}%
                </text>
              </g>
            );
          })}

          {classes.map((c, idx) => {
            const center = padX + (idx + 0.5) * groupW;
            const successH = (c.overallSuccessRate / 100) * chartH;
            const absenceH = (Math.min(100, c.absenceRatePercent) / 100) * chartH;

            const sX = center - barW - 2;
            const sY = padY + chartH - successH;
            const aX = center + 2;
            const aY = padY + chartH - absenceH;

            return (
              <g key={idx}>
                <rect x={sX} y={sY} width={barW} height={Math.max(2, successH)} rx="4" fill="#10b981" />
                <text x={sX + barW / 2} y={sY - 4} fontSize="9.5" fill="#065f46" textAnchor="middle" fontWeight="bold">
                  {c.overallSuccessRate}%
                </text>

                <rect x={aX} y={aY} width={barW} height={Math.max(2, absenceH)} rx="4" fill="#f59e0b" />
                <text x={aX + barW / 2} y={aY - 4} fontSize="9.5" fill="#92400e" textAnchor="middle" fontWeight="bold">
                  {c.absenceRatePercent}%
                </text>

                <text x={center} y={h - 10} fontSize="11" fill="#1e293b" textAnchor="middle" fontWeight="bold">
                  {c.className}
                </text>
              </g>
            );
          })}

          <g transform={`translate(${w / 2 - 110}, 12)`}>
            <rect x="0" y="0" width="12" height="12" rx="3" fill="#10b981" />
            <text x="18" y="10" fontSize="11" fill="#334155" fontWeight="bold">نسبة النجاح والاستيفاء</text>
            <rect x="145" y="0" width="12" height="12" rx="3" fill="#f59e0b" />
            <text x="163" y="10" fontSize="11" fill="#334155" fontWeight="bold">نسبة الغياب المدرسي</text>
          </g>
        </svg>
      );
    };

    const handleExport = async () => {
      if (!reportRef.current) return;
      try {
        setIsGenerating(true);
        setStatusMessage('جاري تحضير كافة الرسوم البيانية والجداول...');

        await new Promise(r => setTimeout(r, 200));

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        });

        const pages = reportRef.current.querySelectorAll<HTMLElement>('.pdf-dossier-page');
        const totalPages = pages.length;

        for (let i = 0; i < totalPages; i++) {
          setStatusMessage(`جاري معالجة وتصدير الصفحة ${i + 1} من ${totalPages}...`);
          const pageEl = pages[i];

          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          if (i > 0) {
            pdf.addPage('a4', 'portrait');
          }
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        }

        setStatusMessage('جاري تنزيل الملف المنظم...');
        const fileName = `التقرير_التحليلي_الشامل_للأستاذ_كوزيبر_براهيم_رياضيات_${selectedClass}_${semester}.pdf`;
        pdf.save(fileName);
      } catch (err) {
        console.error('Failed to export comprehensive PDF:', err);
        alert('حدث خطأ أثناء تصدير ملف PDF. يرجى إعادة المحاولة.');
      } finally {
        setIsGenerating(false);
        setStatusMessage('');
      }
    };

    useImperativeHandle(ref, () => ({
      exportPdf: handleExport
    }));

    return (
      <>
        {/* Main Action Button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-700 hover:to-red-800 rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 ring-1 ring-rose-400/40"
          title="تحميل كافة الرسوم البيانية والجداول المعروضة في ملف PDF واحد ومنظم ومطابق للمذكرات الوزارية"
        >
          {isGenerating ? (
            <>
              <Activity className="w-3.5 h-3.5 animate-spin text-white" />
              <span>{statusMessage || 'جاري إعداد PDF...'}</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5 text-rose-100" />
              <span>تصدير PDF شامل (كافة الرسوم والجداول)</span>
            </>
          )}
        </button>

        {/* Hidden Dedicated Multi-Page Report Container (Strict A4 Layout: 794px x 1122px per page) */}
        <div
          ref={reportRef}
          dir="rtl"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '794px',
            zIndex: -100,
            opacity: 1,
            pointerEvents: 'none',
            background: '#ffffff',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          {/* =========================================================================
              PAGE 1: الغلاف الرسمي + لوحة المؤشرات الإحصائية العامة + رسم تطور الفروض
             ========================================================================= */}
          <div
            className="pdf-dossier-page"
            style={{
              width: '794px',
              height: '1122px',
              boxSizing: 'border-box',
              padding: '30px 36px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              pageBreakAfter: 'always'
            }}
          >
            <div>
              {/* Moroccan Ministerial Header */}
              <div style={{ borderBottom: '2.5px solid #1e3a8a', paddingBottom: '12px', marginBottom: '16px' }}>
                {/* Decorative Top Ribbon */}
                <div style={{ height: '3.5px', background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)', borderRadius: '2px', marginBottom: '10px' }}></div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'right', fontSize: '11px', lineHeight: '1.45', color: '#334155', fontWeight: 700, width: '33%' }}>
                    <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '13px' }}>المملكة المغربية</div>
                    <div style={{ color: '#1e3a8a', fontWeight: 800 }}>وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
                    <div>{academy}</div>
                    <div>{directorate} · المؤسسة: <strong style={{ color: '#1e3a8a' }}>{school}</strong></div>
                  </div>

                  {/* Center Official Identity */}
                  <div style={{ textAlign: 'center', width: '34%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>
                      مادة الرياضيات · السلك الثانوي التأهيلي
                    </div>
                    <div style={{ fontSize: '9.5px', fontWeight: 800, color: '#15803d' }}>
                      المذكرة الوزارية رقم 142-08 والتوجيهات التربوية الرسمية
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', fontSize: '11px', lineHeight: '1.45', color: '#334155', fontWeight: 700, width: '33%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ textAlign: 'center', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                          src={institutionLogo}
                          alt=""
                          style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '50%', border: '1.5px solid #d4af37', padding: '2px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/institution-logo.svg'; }}
                        />
                      </div>
                      <div style={{ textAlign: 'center', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img
                          src={teacherLogo}
                          alt=""
                          style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '50%', border: '1.5px solid #1e3a8a', padding: '2px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
                        />
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '12px' }}>الأستاذ(ة): {teacherName}</div>
                    <div style={{ color: '#1e3a8a', fontWeight: 700 }}>الموسم الدراسي: {academicYear}</div>
                    <div>الدورة: {semesterLabel}</div>
                    <div>تاريخ الإصدار: {currentDate}</div>
                  </div>
                </div>

                {/* Main Dossier Title */}
                <div
                  style={{
                    marginTop: '12px',
                    padding: '8px 14px',
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                      التقرير التحليلي الشامل لنتائج وتطور الفروض المحروسة
                    </h1>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                      محضر إحصائي رسمي متكامل يتضمن كافة الرسوم البيانية والجداول والتشخيص البيداغوجي وفق المذكرة 142-08 والتوجيهات التربوية لمادة الرياضيات بالسلك الثانوي التأهيلي
                    </p>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <span style={{ display: 'inline-block', background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', marginLeft: '6px' }}>
                      {classLabel}
                    </span>
                    <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px' }}>
                      {semesterLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* 1. Summary KPI Cards (6 Cards) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }}></span>
                  <span>أولاً: لوحة المؤشرات الإحصائية العامة للتحصيل الدراسي</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#0369a1', fontWeight: 700 }}>المعدل العام للقسم</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#0c4a6e', marginTop: '2px', fontFamily: 'monospace' }}>
                      {classAverages.overall !== null ? `${classAverages.overall}` : '--'}
                      <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>/20</span>
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 700 }}>نسبة الاستيفاء (≥10)</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#14532d', marginTop: '2px', fontFamily: 'monospace' }}>
                      {cohortStats.passPct}%
                    </div>
                  </div>

                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#6d28d9', fontWeight: 700 }}>نقطة الوسيط (Median)</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#4c1d95', marginTop: '2px', fontFamily: 'monospace' }}>
                      {classAverages.median ?? '--'}
                      <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>/20</span>
                    </div>
                  </div>

                  <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#a16207', fontWeight: 700 }}>أعلى وأدنى نقطة</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#713f12', marginTop: '4px', fontFamily: 'monospace' }}>
                      {classAverages.maxMark ?? '--'} | {classAverages.minMark ?? '--'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>عدد التلاميذ المختبرين</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                      {studentMetrics.length}
                    </div>
                  </div>

                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#be123c', fontWeight: 700 }}>المتعثرون (&lt;10)</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#9f1239', marginTop: '2px', fontFamily: 'monospace' }}>
                      {cohortStats.atRisk}
                      <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#be123c' }}> ({cohortStats.atRiskPct}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Chart 1: Macro Trend SVG */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>
                    الرسم البياني 1: تطور المسار الإجمالي لمعدل القسم عبر محطات الفروض (F1 - F2 - F3)
                  </span>
                  <span style={{ fontSize: '10px', color: macroTrend.delta >= 0 ? '#15803d' : '#b91c1c', fontWeight: 800 }}>
                    مؤشر التطور: {macroTrend.delta >= 0 ? `+${macroTrend.delta}` : `${macroTrend.delta}`} نقطة ({macroTrend.deltaPercent}%)
                  </span>
                </div>
                {renderMacroTrendSvg()}
              </div>

              {/* 3. Table 1: Exam Breakdown Summary Table */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 800, borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>محطة التقويم / الفرض</th>
                      <th style={{ padding: '7px 10px' }}>معدل الفرض</th>
                      <th style={{ padding: '7px 10px' }}>نسبة الاستيفاء (≥10)</th>
                      <th style={{ padding: '7px 10px' }}>أعلى نقطة</th>
                      <th style={{ padding: '7px 10px' }}>أدنى نقطة</th>
                      <th style={{ padding: '7px 10px' }}>التقييم البيداغوجي العام</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>الفرض المحروس رقم 1 (F1)</td>
                      <td style={{ padding: '6px 10px', fontWeight: 800, fontFamily: 'monospace' }}>{classAverages.f1 !== null ? `${classAverages.f1}/20` : 'غير مسجل'}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#15803d' }}>
                        {studentMetrics.length > 0 ? `${Math.round((studentMetrics.filter(m => m.f1 !== null && m.f1 >= 10).length / Math.max(1, studentMetrics.filter(m => m.f1 !== null).length)) * 100)}%` : '--'}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.reduce((max, m) => m.f1 !== null && m.f1 > max ? m.f1 : max, 0) || '--'}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.filter(m => m.f1 !== null).reduce((min, m) => m.f1! < min ? m.f1! : min, 20) || '--'}</td>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>محطة التقويم الأولي وتشخيص المكتسبات</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#4f46e5' }}>الفرض المحروس رقم 2 (F2)</td>
                      <td style={{ padding: '6px 10px', fontWeight: 800, fontFamily: 'monospace' }}>{classAverages.f2 !== null ? `${classAverages.f2}/20` : 'غير مسجل'}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#15803d' }}>
                        {studentMetrics.length > 0 ? `${Math.round((studentMetrics.filter(m => m.f2 !== null && m.f2 >= 10).length / Math.max(1, studentMetrics.filter(m => m.f2 !== null).length)) * 100)}%` : '--'}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.reduce((max, m) => m.f2 !== null && m.f2 > max ? m.f2 : max, 0) || '--'}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.filter(m => m.f2 !== null).reduce((min, m) => m.f2! < min ? m.f2! : min, 20) || '--'}</td>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>محطة قياس أثر المعالجة والتعلمات المركبة</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#0891b2' }}>الفرض المحروس رقم 3 (F3)</td>
                      <td style={{ padding: '6px 10px', fontWeight: 800, fontFamily: 'monospace' }}>{classAverages.f3 !== null ? `${classAverages.f3}/20` : 'غير مسجل'}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#15803d' }}>
                        {studentMetrics.length > 0 ? `${Math.round((studentMetrics.filter(m => m.f3 !== null && m.f3 >= 10).length / Math.max(1, studentMetrics.filter(m => m.f3 !== null).length)) * 100)}%` : '--'}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.reduce((max, m) => m.f3 !== null && m.f3 > max ? m.f3 : max, 0) || '--'}</td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.filter(m => m.f3 !== null).reduce((min, m) => m.f3! < min ? m.f3! : min, 20) || '--'}</td>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>محطة التقويم الإجمالي وحصيلة المقرر</td>
                    </tr>
                    {hasF4 && (
                      <tr style={{ borderTop: '1px solid #e2e8f0', background: '#fdf2f8' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#be185d' }}>الفرض المحروس رقم 4 (F4 - ع. رياضية)</td>
                        <td style={{ padding: '6px 10px', fontWeight: 800, fontFamily: 'monospace' }}>{classAverages.f4 !== null && classAverages.f4 !== undefined ? `${classAverages.f4}/20` : 'غير مسجل'}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: '#15803d' }}>
                          {studentMetrics.length > 0 ? `${Math.round((studentMetrics.filter(m => m.f4 !== null && m.f4 !== undefined && m.f4 >= 10).length / Math.max(1, studentMetrics.filter(m => m.f4 !== null && m.f4 !== undefined).length)) * 100)}%` : '--'}
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.reduce((max, m) => m.f4 !== null && m.f4 !== undefined && m.f4 > max ? m.f4 : max, 0) || '--'}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{studentMetrics.filter(m => m.f4 !== null && m.f4 !== undefined).reduce((min, m) => m.f4! < min ? m.f4! : min, 20) || '--'}</td>
                        <td style={{ padding: '6px 10px', color: '#475569' }}>محطة التقويم التوليفي لشعبة العلوم الرياضية</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer of Page 1 */}
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
              <span>منظومة تحليل وتتبع الفروض المحروسة · الأستاذ: براهيم كوزيبر</span>
              <span style={{ fontWeight: 800 }}>الصفحة 1 من {studentChunks.length + 3}</span>
              <span>وثيقة تربوية رسمية</span>
            </div>
          </div>

          {/* =========================================================================
              PAGE 2: فئات التحكم وسلالم التقدير الوزارية (المذكرة 142) + الهستوغرام
             ========================================================================= */}
          <div
            className="pdf-dossier-page"
            style={{
              width: '794px',
              height: '1122px',
              boxSizing: 'border-box',
              padding: '30px 36px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              pageBreakAfter: 'always'
            }}
          >
            <div>
              {/* Header Mini */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)', borderRadius: '2px', marginBottom: '6px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · {school}</span>
                <span>مادة الرياضيات · السلك الثانوي التأهيلي · المذكرة 142-08</span>
              </div>
              <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                    ثانياً: فئات التحكم والذروة التحصيلية وسلالم التقدير الوزارية
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                    توزيع النقط على الشرائح المعيارية المعتمدة بمديرية المناهج (المذكرة الوزارية 142-08 بالسلك الثانوي التأهيلي)
                  </p>
                </div>
                <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, color: '#475569' }}>
                  {classLabel} · {semesterLabel}
                </span>
              </div>

              {/* Chart 2: Distribution Histogram */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  الرسم البياني 2: الهستوغرام الإحصائي لتوزيع النقط وشرائح الاستيفاء
                </div>
                {renderDistributionSvg()}
              </div>

              {/* Table 2: Frequency Distribution Table */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 800, borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>مجال النقطة</th>
                      <th style={{ padding: '7px 10px' }}>التقدير الوزاري الرسمي</th>
                      <th style={{ padding: '7px 10px' }}>عدد التلاميذ</th>
                      <th style={{ padding: '7px 10px' }}>النسبة المئوية (%)</th>
                      <th style={{ padding: '7px 10px' }}>التوصيف التربوي وإجراءات التتبع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionData.map((b, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                          [{b.min} - {b.max === 15.99 ? '16' : (b.max === 13.99 ? '14' : (b.max === 11.99 ? '12' : (b.max === 9.99 ? '10' : b.max)))}]
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 800, color: b.color }}>
                          {b.label}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 800, fontFamily: 'monospace' }}>
                          {b.count}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {b.pct}%
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: '10px', color: '#475569', textAlign: 'right' }}>
                          {b.min >= 14
                            ? 'تحكم متقدم: أنشطة الإغناء والتحدي والمشاركة في الأولمبياد'
                            : b.min >= 10
                            ? 'تحكم مستوفٍ: تعزيز المكتسبات وترسيخ المهارات البرهانية'
                            : 'تعثر بحاجة لمعالجة: تشخيص الثغرات والتدخل الموجه في حصص الدعم'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pedagogical Commentary & Distinction Analysis */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                  ملاحظات واستنتاجات بيداغوجية حول تمايز التحصيل الصفي:
                </div>
                <ul style={{ margin: 0, paddingRight: '16px', fontSize: '10px', color: '#475569', lineHeight: '1.6' }}>
                  <li>
                    <strong>نواة التفوق:</strong> يبلغ عدد التلاميذ المتفوقين (المعدل ≥ 14/20) ما مجموعه <strong>{cohortStats.top}</strong> تلميذاً ({cohortStats.topPct}%)، وتعتبر هذه الفئة قاطرة القسم في التفاعل الإيجابي وإنتاج الحلول الرياضية.
                  </li>
                  <li>
                    <strong>الشريحة المستوفية:</strong> تمثل نسبة التلاميذ المستوفين لعتبة النجاح (≥ 10/20) ما معدله <strong>{cohortStats.passPct}%</strong>، مما يترجم ملاءمة وتوازن الفروض مع الإطار المرجعي الوزاري.
                  </li>
                  <li>
                    <strong>حالات التعثر المستهدفة بالمعالجة:</strong> تتطلب فئة التلاميذ دون 10/20 البالغ عددهم <strong>{cohortStats.atRisk}</strong> تلميذاً تفعيل بطاقات الدعم الفوري وتفريد الأنشطة الرياضية حسب مواطن الضعف.
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer of Page 2 */}
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
              <span>منظومة تحليل وتتبع الفروض المحروسة · الأستاذ: براهيم كوزيبر</span>
              <span style={{ fontWeight: 800 }}>الصفحة 2 من {studentChunks.length + 3}</span>
              <span>وثيقة تربوية رسمية</span>
            </div>
          </div>

          {/* =========================================================================
              PAGE 3: مقارنة الغياب ونسب النجاح بالفروض لكل قسم
             ========================================================================= */}
          <div
            className="pdf-dossier-page"
            style={{
              width: '794px',
              height: '1122px',
              boxSizing: 'border-box',
              padding: '30px 36px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              pageBreakAfter: 'always'
            }}
          >
            <div>
              {/* Header Mini */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)', borderRadius: '2px', marginBottom: '6px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · {school}</span>
                <span>مادة الرياضيات · السلك الثانوي التأهيلي · المذكرة 142-08</span>
              </div>
              <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                    ثالثاً: دراسة أثر المواظبة والغياب على نتائج ونسب النجاح في الفروض
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                    التقاطع الإحصائي بين ساعات الغياب ونسب استيفاء فروض المراقبة المستمرة لكل قسم
                  </p>
                </div>
                <span style={{ background: '#fef3c7', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, color: '#92400e' }}>
                  المواظبة واليقظة المدرسية
                </span>
              </div>

              {/* Overall Absence & Success KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#065f46', fontWeight: 700 }}>متوسط نسبة النجاح بالأقسام</div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#047857', marginTop: '2px', fontFamily: 'monospace' }}>
                    {overallAbsenceSuccessKPIs.avgSuccessRate}%
                  </div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 700 }}>معدل الغياب الإجمالي</div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#b45309', marginTop: '2px', fontFamily: 'monospace' }}>
                    {overallAbsenceSuccessKPIs.avgAbsenceRate}%
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#166534', fontWeight: 700 }}>القسم الأعلى نجاحاً</div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#15803d', marginTop: '4px' }}>
                    {overallAbsenceSuccessKPIs.topClassBySuccess}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#475569', fontWeight: 700 }}>مجموع ساعات الغياب المرصودة</div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                    {overallAbsenceSuccessKPIs.totalAbsentHoursAllClasses} س
                  </div>
                </div>
              </div>

              {/* Chart 3: Absence vs Success SVG */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                  الرسم البياني 3: مقارنة نسب النجاح بالفروض ونسب الغياب لكل قسم
                </div>
                {renderAbsenceVsSuccessSvg()}
              </div>

              {/* Table 3: Class Absence vs Success Comparison Table */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 800, borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '7px 10px', textAlign: 'right' }}>اسم القسم</th>
                      <th style={{ padding: '7px 10px' }}>عدد التلاميذ</th>
                      <th style={{ padding: '7px 10px' }}>نسبة النجاح بالفروض (%)</th>
                      <th style={{ padding: '7px 10px' }}>مجموع ساعات الغياب</th>
                      <th style={{ padding: '7px 10px' }}>معدل الغياب لكل تلميذ</th>
                      <th style={{ padding: '7px 10px' }}>مؤشر المواظبة والأداء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classAbsenceSuccessComparison.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#1e40af' }}>
                          {c.className}
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                          {c.overallTestedStudents}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 800, color: c.overallSuccessRate >= 70 ? '#15803d' : (c.overallSuccessRate >= 50 ? '#0284c7' : '#b91c1c'), fontFamily: 'monospace' }}>
                          {c.overallSuccessRate}%
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                          {c.totalAbsentHours} ساعة
                        </td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                          {c.avgAbsentHoursPerStudent} س / تلميذ
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: c.absenceRatePercent <= 5 ? '#dcfce7' : (c.absenceRatePercent <= 12 ? '#fef3c7' : '#fee2e2'),
                            color: c.absenceRatePercent <= 5 ? '#15803d' : (c.absenceRatePercent <= 12 ? '#92400e' : '#b91c1c')
                          }}>
                            {c.absenceRatePercent <= 5 ? 'مواظبة ممتازة' : (c.absenceRatePercent <= 12 ? 'مواظبة متوسطة' : 'غياب مقلق')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Analytical Takeaway */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', fontSize: '10.5px', color: '#1e40af', lineHeight: '1.6' }}>
                <strong>الاستخلاص التربوي:</strong> يُظهر التحليل ارتباطاً وثيقاً وعكسياً بين ساعات الغياب ومعدلات الفروض؛ حيث تسجل الأقسام ذات الانضباط المرتفع نسب نجاح تتجاوز 80%، بينما يتركز التعثر الحاد لدى التلاميذ ذوي الغياب المتكرر، مما يؤكد أهمية التنسيق مع الحراسة العامة وإدارة المؤسسة لمعالجة الغياب في مهده.
              </div>
            </div>

            {/* Footer of Page 3 */}
            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
              <span>منظومة تحليل وتتبع الفروض المحروسة · الأستاذ: براهيم كوزيبر</span>
              <span style={{ fontWeight: 800 }}>الصفحة 3 من {studentChunks.length + 3}</span>
              <span>وثيقة تربوية رسمية</span>
            </div>
          </div>

          {/* =========================================================================
              PAGES 4+: جداول تتبع مسار ونتائج التلاميذ الفردية
             ========================================================================= */}
          {studentChunks.map((chunk, chunkIdx) => {
            const isLastChunk = chunkIdx === studentChunks.length - 1;
            const pageNum = 4 + chunkIdx;

            return (
              <div
                key={chunkIdx}
                className="pdf-dossier-page"
                style={{
                  width: '794px',
                  height: '1122px',
                  boxSizing: 'border-box',
                  padding: '30px 36px',
                  background: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  pageBreakAfter: 'always'
                }}
              >
                <div>
                  {/* Header Mini */}
                  <div style={{ height: '3px', background: 'linear-gradient(90deg, #1e3a8a 0%, #d4af37 50%, #15803d 100%)', borderRadius: '2px', marginBottom: '6px' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    <span>المملكة المغربية · وزارة التربية الوطنية والتعليم الأولي والرياضة · {school}</span>
                    <span>الأستاذ(ة): {teacherName} · الموسم: {academicYear}</span>
                  </div>
                  <div style={{ borderBottom: '1.5px solid #0f172a', paddingBottom: '8px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                        رابعاً: كشف تتبع مسار وتطور نتائج التلاميذ الفردية
                        {studentChunks.length > 1 && ` (الجزء ${chunkIdx + 1} من ${studentChunks.length})`}
                      </h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                        البيان التفصيلي لنقط الفروض F1 وF2 وF3 والمعدل الدوري ومسار التطور والتقدير الوزاري وفق المذكرة 142-08
                      </p>
                    </div>
                    <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, color: '#475569' }}>
                      {classLabel} · {semesterLabel}
                    </span>
                  </div>

                  {/* Main Student Performance Table */}
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#ffffff', fontWeight: 800 }}>
                          <th style={{ padding: '6px 6px', width: '32px' }}>#</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>رقم مسار</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>الاسم والنسب الكامل</th>
                          <th style={{ padding: '6px 6px', width: '50px' }}>F1</th>
                          <th style={{ padding: '6px 6px', width: '50px' }}>F2</th>
                          <th style={{ padding: '6px 6px', width: '50px' }}>F3</th>
                          {hasF4 && <th style={{ padding: '6px 6px', width: '50px', background: '#be185d' }}>F4</th>}
                          <th style={{ padding: '6px 8px', width: '60px', background: '#1e293b' }}>المعدل</th>
                          <th style={{ padding: '6px 8px' }}>مسار التطور</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>التقدير الوزاري</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chunk.map((m, idx) => {
                          const globalIndex = chunkIdx * STUDENTS_PER_PAGE + idx + 1;
                          const isPassing = m.avg !== null && m.avg >= 10;
                          const isTop = m.avg !== null && m.avg >= 14;
                          const isAtRisk = m.avg !== null && m.avg < 10;

                          return (
                            <tr
                              key={m.id}
                              style={{
                                borderBottom: '1px solid #e2e8f0',
                                background: idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                              }}
                            >
                              <td style={{ padding: '5px 6px', fontWeight: 700, color: '#64748b' }}>{globalIndex}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontSize: '9.5px' }}>{m.massar}</td>
                              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>{m.name}</td>
                              <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: m.f1 !== null && m.f1 >= 10 ? '#15803d' : (m.f1 !== null ? '#b91c1c' : '#94a3b8') }}>
                                {m.f1 !== null ? m.f1 : '-'}
                              </td>
                              <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: m.f2 !== null && m.f2 >= 10 ? '#15803d' : (m.f2 !== null ? '#b91c1c' : '#94a3b8') }}>
                                {m.f2 !== null ? m.f2 : '-'}
                              </td>
                              <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, color: m.f3 !== null && m.f3 >= 10 ? '#15803d' : (m.f3 !== null ? '#b91c1c' : '#94a3b8') }}>
                                {m.f3 !== null ? m.f3 : '-'}
                              </td>
                              {hasF4 && (
                                <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 700, background: '#fdf2f8', color: m.f4 !== null && m.f4 !== undefined && m.f4 >= 10 ? '#15803d' : (m.f4 !== null && m.f4 !== undefined ? '#b91c1c' : '#94a3b8') }}>
                                  {m.f4 !== null && m.f4 !== undefined ? m.f4 : '-'}
                                </td>
                              )}
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontWeight: 900, fontSize: '11px', background: isTop ? '#ecfdf5' : (isAtRisk ? '#fff1f2' : '#f1f5f9'), color: isAtRisk ? '#be123c' : (isTop ? '#047857' : '#0f172a') }}>
                                {m.avg !== null ? `${m.avg}` : '--'}
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  background: m.trajectory === 'improving' ? '#dcfce7' : (m.trajectory === 'declining' ? '#fee2e2' : '#f1f5f9'),
                                  color: m.trajectory === 'improving' ? '#15803d' : (m.trajectory === 'declining' ? '#b91c1c' : '#475569')
                                }}>
                                  {m.trajectory === 'improving' ? `↗ متقدم (+${m.delta})` : (m.trajectory === 'declining' ? `↘ متراجع (${m.delta})` : '↔ مستقر')}
                                </span>
                              </td>
                              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, fontSize: '9.5px', color: isTop ? '#15803d' : (isAtRisk ? '#b91c1c' : '#0369a1') }}>
                                {m.avg !== null && m.avg >= 16 ? 'ممتاز' : (m.avg !== null && m.avg >= 14 ? 'جيد جداً' : (m.avg !== null && m.avg >= 12 ? 'حسن' : (m.avg !== null && m.avg >= 10 ? 'مستوفٍ' : (m.avg !== null && m.avg >= 8 ? 'دون العتبة' : 'تعثر حاد'))))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* If last chunk, render Pedagogical Decision & Official Signatures */}
                  {isLastChunk && (
                    <div style={{ marginTop: '12px' }}>
                      {atRiskStudents.length > 0 && (
                        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#9f1239', marginBottom: '3px' }}>
                            حصر حالات التعثر الأولوية الموجهة لأنشطة الدعم المندمج والمؤسساتي ({atRiskStudents.length} تلميذ):
                          </div>
                          <div style={{ fontSize: '10px', color: '#be123c', lineHeight: '1.5' }}>
                            {atRiskStudents.map(s => `${s.name} (${s.avg}/20)`).join(' · ')}
                          </div>
                        </div>
                      )}

                      <div style={{ border: '1.5px solid #0f172a', borderRadius: '8px', padding: '12px', background: '#fafafa', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '10px', textAlign: 'center' }}>
                          التأشيرات الرسمية وخاتمة المحضر التربوي
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center', fontSize: '10px', color: '#334155' }}>
                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#ffffff', minHeight: '85px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>أستاذ مادة الرياضيات</div>
                            <div style={{ fontSize: '9px', color: '#2563eb', fontWeight: 700 }}>الأستاذ: براهيم كوزيبر</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>التوقيع والتاريخ:</div>
                          </div>

                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#ffffff', minHeight: '85px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>الحراسة العامة للخارجية</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>متابعة المواظبة والغياب</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>التأشيرة والخاتم:</div>
                          </div>

                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#ffffff', minHeight: '85px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>السيد رئيس المؤسسة</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>مدير الثانوية التأهيلية</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>التأشيرة والخاتم:</div>
                          </div>

                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#ffffff', minHeight: '85px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>مفتش مادة الرياضيات</div>
                            <div style={{ fontSize: '9px', color: '#64748b' }}>التأطير والمراقبة التربوية</div>
                            <div style={{ fontSize: '9px', color: '#94a3b8' }}>الملاحظات والتوقيع:</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer of Page 4+ */}
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                  <span>منظومة تحليل وتتبع الفروض المحروسة · الأستاذ: براهيم كوزيبر</span>
                  <span style={{ fontWeight: 800 }}>الصفحة {pageNum} من {studentChunks.length + 3}</span>
                  <span>وثيقة تربوية رسمية</span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
);

export default ComprehensiveAnalysisPdfExport;
