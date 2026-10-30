import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  BarChart2,
  Activity,
  Award
} from 'lucide-react';

export interface QuickProfileSparklineProps {
  className: string;
  studentId: string;
  studentName?: string;
  s1Grades?: Record<string, any>;
  s2Grades?: Record<string, any>;
  examCount?: number;
  annualAvg?: number | null;
  delta?: number | null;
  trend?: string;
  trendText?: string;
  trendBadge?: string;
  trendColor?: string;
  trendBg?: string;
}

interface ExamPoint {
  id: string;
  name: string;        // 'د1-ف1', 'د1-ف2', 'د1-ف3', 'د2-ف1', 'د2-ف2', 'د2-ف3'
  fullTitle: string;   // 'الدورة 1 - الفرض الأول', etc.
  semester: 's1' | 's2';
  grade: number | null;
  displayGrade: string;
  appreciation: string;
  color: string;
}

function parseGrade(val: any): number | null {
  if (val === undefined || val === null || val === '' || isNaN(parseFloat(val))) {
    return null;
  }
  const n = parseFloat(val);
  return (n >= 0 && n <= 20) ? n : null;
}

function getAppreciation(mark: number | null): { text: string; color: string } {
  if (mark === null) return { text: 'غير مسجل', color: '#94a3b8' };
  if (mark >= 16) return { text: 'ممتاز', color: '#15803d' };
  if (mark >= 14) return { text: 'جيد جداً', color: '#0284c7' };
  if (mark >= 12) return { text: 'جيد', color: '#0369a1' };
  if (mark >= 10) return { text: 'مستوفٍ', color: '#4338ca' };
  if (mark >= 8) return { text: 'دون المعدل', color: '#c2410c' };
  return { text: 'تعثر', color: '#b91c1c' };
}

export default function QuickProfileSparkline({
  s1Grades = {},
  s2Grades = {},
  examCount = 3,
  annualAvg = null,
  delta = null,
  trend = 'neutral',
  trendText = '',
  trendBadge = '',
  trendColor = '#64748b',
  trendBg = '#f1f5f9'
}: QuickProfileSparklineProps) {
  const [viewMode, setViewMode] = useState<'line' | 'bar'>('line');

  const examKeys = useMemo(() => {
    return examCount === 2 ? ['f1', 'f2'] : ['f1', 'f2', 'f3'];
  }, [examCount]);

  const examTitles: Record<string, string> = {
    f1: 'فرض 1',
    f2: 'فرض 2',
    f3: 'فرض 3'
  };

  const data: ExamPoint[] = useMemo(() => {
    const list: ExamPoint[] = [];

    // S1 Exams
    examKeys.forEach(k => {
      const g = parseGrade(s1Grades[k]);
      const app = getAppreciation(g);
      list.push({
        id: `s1_${k}`,
        name: `د1-${examTitles[k] || k}`,
        fullTitle: `الدورة الأولى: ${examTitles[k] || k}`,
        semester: 's1',
        grade: g,
        displayGrade: g !== null ? g.toFixed(2) : '-',
        appreciation: app.text,
        color: app.color
      });
    });

    // S2 Exams
    examKeys.forEach(k => {
      const g = parseGrade(s2Grades[k]);
      const app = getAppreciation(g);
      list.push({
        id: `s2_${k}`,
        name: `د2-${examTitles[k] || k}`,
        fullTitle: `الدورة الثانية: ${examTitles[k] || k}`,
        semester: 's2',
        grade: g,
        displayGrade: g !== null ? g.toFixed(2) : '-',
        appreciation: app.text,
        color: app.color
      });
    });

    return list;
  }, [s1Grades, s2Grades, examKeys]);

  const validPoints = useMemo(() => data.filter(d => d.grade !== null), [data]);
  const hasAnyGrade = validPoints.length > 0;

  const maxGrade = useMemo(() => {
    if (validPoints.length === 0) return null;
    return Math.max(...validPoints.map(d => d.grade!));
  }, [validPoints]);

  const minGrade = useMemo(() => {
    if (validPoints.length === 0) return null;
    return Math.min(...validPoints.map(d => d.grade!));
  }, [validPoints]);

  const avgGrade = useMemo(() => {
    if (validPoints.length === 0) return null;
    const sum = validPoints.reduce((acc, d) => acc + d.grade!, 0);
    return sum / validPoints.length;
  }, [validPoints]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: ExamPoint = payload[0].payload;
      if (item.grade === null) {
        return (
          <div className="bg-slate-900 text-white p-2 rounded-lg text-xs shadow-lg border border-slate-700">
            <div className="font-bold text-slate-200">{item.fullTitle}</div>
            <div className="text-slate-400 mt-1">لم يتم تسجيل النقطة بعد</div>
          </div>
        );
      }
      const diffFrom10 = item.grade - 10;
      return (
        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-xl border border-slate-700 min-w-[145px]">
          <div className="font-bold text-slate-100 border-b border-slate-700 pb-1 mb-1.5">
            {item.fullTitle}
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-400">النقطة:</span>
            <span
              className="font-extrabold text-sm"
              style={{ color: item.grade >= 10 ? '#4ade80' : '#f87171' }}
            >
              {item.displayGrade} / 20
            </span>
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-slate-400">التقدير:</span>
            <span className="font-bold" style={{ color: item.color }}>
              {item.appreciation}
            </span>
          </div>
          <div
            className="text-[10px] font-semibold mt-1"
            style={{ color: diffFrom10 >= 0 ? '#86efac' : '#fca5a5' }}
          >
            {diffFrom10 >= 0
              ? `+${diffFrom10.toFixed(2)} فوق عتبة 10`
              : `${diffFrom10.toFixed(2)} دون عتبة 10`}
          </div>
        </div>
      );
    }
    return null;
  };

  if (!hasAnyGrade) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 my-2 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>منحنى الفروض المصغر (Sparkline)</span>
        </div>
        <div className="text-[11px] text-slate-500">
          لم يتم إدخال نقط الفروض بعد لهذا التلميذ لعرض الرسم البياني المصغر.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2.5 my-2 shadow-sm">
      {/* Top Header Controls & Metrics */}
      <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>منحنى تطور النقط (Sparkline)</span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
            {validPoints.length} فروض
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setViewMode('line')}
              className={`px-1.5 py-0.5 rounded transition ${
                viewMode === 'line'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض منحنى المساحة"
            >
              انسيابي
            </button>
            <button
              type="button"
              onClick={() => setViewMode('bar')}
              className={`px-1.5 py-0.5 rounded transition ${
                viewMode === 'bar'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="عرض أعمدة الفروض"
            >
              أعمدة
            </button>
          </div>

          {/* General Trajectory Badge */}
          {trendBadge && (
            <span
              className="text-[11px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: trendBg, color: trendColor }}
            >
              {trend.includes('up') ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend.includes('down') ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              <span>{trendBadge}</span>
            </span>
          )}
        </div>
      </div>

      {/* Sparkline Chart Component */}
      <div className="w-full h-[115px] direction-ltr" style={{ direction: 'ltr' }}>
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'line' ? (
            <AreaChart data={data} margin={{ top: 8, right: 10, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="quickSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 700 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 20]}
                ticks={[0, 10, 20]}
                tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Pass Threshold Reference Line at 10 */}
              <ReferenceLine
                y={10}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{
                  value: 'عتبة 10',
                  fill: '#64748b',
                  fontSize: 9,
                  position: 'insideRight'
                }}
              />
              <ReferenceArea {...({ y1: 10, y2: 20, fill: '#22c55e', fillOpacity: 0.035 } as any)} />
              <ReferenceArea {...({ y1: 0, y2: 10, fill: '#ef4444', fillOpacity: 0.035 } as any)} />
              <Area
                type="monotone"
                dataKey="grade"
                stroke="#4f46e5"
                strokeWidth={2.5}
                fill="url(#quickSparklineGrad)"
                connectNulls={true}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!cx || !cy || payload.grade === null) return null;
                  const isPass = payload.grade >= 10;
                  return (
                    <circle
                      key={`dot-${payload.id}`}
                      cx={cx}
                      cy={cy}
                      r={3.5}
                      fill={isPass ? '#16a34a' : '#dc2626'}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{ r: 5, stroke: '#4f46e5', strokeWidth: 2, fill: '#ffffff' }}
              />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 10, left: -28, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9.5, fill: '#475569', fontWeight: 700 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 20]}
                ticks={[0, 10, 20]}
                tick={{ fontSize: 9, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={10} stroke="#94a3b8" strokeDasharray="3 3" />
              <ReferenceArea {...({ y1: 10, y2: 20, fill: '#22c55e', fillOpacity: 0.035 } as any)} />
              <ReferenceArea {...({ y1: 0, y2: 10, fill: '#ef4444', fillOpacity: 0.035 } as any)} />
              <Bar dataKey="grade" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {data.map(entry => (
                  <Cell
                    key={`cell-${entry.id}`}
                    fill={
                      entry.grade === null
                        ? '#cbd5e1'
                        : entry.grade >= 14
                        ? '#059669'
                        : entry.grade >= 10
                        ? '#4f46e5'
                        : '#dc2626'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Sparkline Summary Footnote Badges */}
      <div className="flex items-center justify-between gap-1 pt-1.5 mt-1 border-t border-slate-100 text-[11px] text-slate-600 flex-wrap">
        <div className="flex items-center gap-2">
          <span>
            أعلى نقطة:{' '}
            <strong className="text-emerald-700 font-extrabold">
              {maxGrade !== null ? `${maxGrade.toFixed(2)}/20` : '-'}
            </strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            أدنى نقطة:{' '}
            <strong className="text-rose-700 font-extrabold">
              {minGrade !== null ? `${minGrade.toFixed(2)}/20` : '-'}
            </strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            المعدل:{' '}
            <strong className="text-indigo-700 font-extrabold">
              {avgGrade !== null ? `${avgGrade.toFixed(2)}/20` : '-'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
            ≥ 10 مستوفٍ
          </span>
          <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block"></span>
            &lt; 10 دون العتبة
          </span>
        </div>
      </div>
    </div>
  );
}
