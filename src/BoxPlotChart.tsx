import React, { useMemo, useState } from 'react';
import { HelpCircle, Info, Sparkles } from 'lucide-react';

export interface BoxPlotItem {
  id: string;
  name: string;
  subTitle?: string;
  values: number[];
  color?: string;
}

export interface BoxPlotChartProps {
  items: BoxPlotItem[];
  title?: string;
  description?: string;
  height?: number;
}

interface BoxPlotStats {
  id: string;
  name: string;
  subTitle?: string;
  count: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
  iqr: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: number[];
  color: string;
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return parseFloat((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

export const BoxPlotChart: React.FC<BoxPlotChartProps> = ({
  items,
  title = 'مخطط الصندوق والساعدين (Boîte à moustaches)',
  description = 'التمثيل البياني المعياري الخماسي لوسائط الموضع (الوسيط والأرباع) ووسائط التشتت (المدى الربيعي والامتداد) لتحصيل المتعلمين',
  height = 360,
}) => {
  const [hoveredBox, setHoveredBox] = useState<BoxPlotStats | null>(null);
  const [showFormulaInfo, setShowFormulaInfo] = useState<boolean>(false);

  const colors = [
    '#2563eb', // blue
    '#10b981', // emerald
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
  ];

  const statsList: BoxPlotStats[] = useMemo(() => {
    return items
      .filter(item => item.values && item.values.length > 0)
      .map((item, idx) => {
        const valid = item.values.filter(v => typeof v === 'number' && !isNaN(v) && v >= 0 && v <= 20);
        if (valid.length === 0) {
          return {
            id: item.id,
            name: item.name,
            subTitle: item.subTitle,
            count: 0,
            min: 0,
            q1: 0,
            median: 0,
            mean: 0,
            q3: 0,
            max: 0,
            iqr: 0,
            lowerWhisker: 0,
            upperWhisker: 0,
            outliers: [],
            color: item.color || colors[idx % colors.length],
          };
        }

        const sorted = [...valid].sort((a, b) => a - b);
        const count = sorted.length;
        const min = sorted[0];
        const max = sorted[count - 1];
        const sum = sorted.reduce((a, b) => a + b, 0);
        const mean = parseFloat((sum / count).toFixed(2));

        const q1 = calculatePercentile(sorted, 0.25);
        const median = calculatePercentile(sorted, 0.50);
        const q3 = calculatePercentile(sorted, 0.75);
        const iqr = parseFloat((q3 - q1).toFixed(2));

        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;

        // Whiskers extend to the minimum and maximum data points within the fences
        const nonOutliers = sorted.filter(v => v >= lowerFence && v <= upperFence);
        const lowerWhisker = nonOutliers.length > 0 ? nonOutliers[0] : min;
        const upperWhisker = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : max;

        // Points outside fences
        const outliers = sorted.filter(v => v < lowerFence || v > upperFence);

        return {
          id: item.id,
          name: item.name,
          subTitle: item.subTitle,
          count,
          min,
          q1,
          median,
          mean,
          q3,
          max,
          iqr,
          lowerWhisker,
          upperWhisker,
          outliers,
          color: item.color || colors[idx % colors.length],
        };
      });
  }, [items]);

  if (statsList.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 text-xs font-bold" dir="rtl">
        لا توجد معطيات كافية لرسم مخطط الصندوق والساعدين حالياً. يرجى مسك النقط أولاً.
      </div>
    );
  }

  // SVG Geometry Settings
  const svgWidth = 800;
  const svgHeight = height;
  const margin = { top: 30, right: 70, bottom: 50, left: 60 };
  const innerWidth = svgWidth - margin.left - margin.right;
  const innerHeight = svgHeight - margin.top - margin.bottom;

  // Grade scale is 0 to 20
  const yScale = (grade: number) => {
    const clamped = Math.max(0, Math.min(20, grade));
    return margin.top + innerHeight - (clamped / 20) * innerHeight;
  };

  const yThreshold = yScale(10); // 10/20 threshold

  const boxWidth = Math.min(65, Math.max(30, (innerWidth / (statsList.length + 1)) * 0.65));
  const colStep = innerWidth / (statsList.length + 1);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span>{title}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              Boîte à Moustaches (Tukey 5-Number)
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFormulaInfo(!showFormulaInfo)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
            title="شرح دلالات ومصطلحات المخطط الإحصائي"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>الدلالات الرياضية للمخطط</span>
          </button>
        </div>
      </div>

      {/* Educational & Mathematical Annotation Panel */}
      {showFormulaInfo && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-slate-700 space-y-2 leading-relaxed">
          <div className="font-black text-blue-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-700" />
            <span>القواعد الإحصائية الرسمية لمخطط الصندوق والساعدين (Tukey Boxplot):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-blue-100">
              <strong className="text-slate-900 block mb-0.5">الصندوق (Box):</strong>
              يمثل 50% من التلاميذ في الوسط، محصور بين الربيع الأول <span className="font-mono font-bold text-amber-600">Q₁ (25%)</span> والربيع الثالث <span className="font-mono font-bold text-purple-600">Q₃ (75%)</span>.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-blue-100">
              <strong className="text-slate-900 block mb-0.5">الوسيط (Médiane):</strong>
              الخط الأفقي داخل الصندوق؛ يقسم المتعلمين إلى نصفين متساويين (50% حققوا أقل منه و50% حققوا أكثر منه).
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-blue-100">
              <strong className="text-slate-900 block mb-0.5">الساعدان (Whiskers):</strong>
              يمتدان إلى أدنى وأعلى نقطة داخل المجال المعتدل <span className="font-mono">[Q₁ - 1.5×IQR, Q₃ + 1.5×IQR]</span>.
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-blue-100">
              <strong className="text-slate-900 block mb-0.5">النقاط الشاذة (Outliers):</strong>
              النقط المنعزلة (خارج الساعدين) تبرز حالات استثنائية (تفوق بارز أو تعثر حاد جداً عن مسار القسم).
            </div>
          </div>
        </div>
      )}

      {/* Responsive SVG Graphic */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none font-sans"
          style={{ minWidth: '600px' }}
        >
          {/* Background Grid Lines & Moroccan Scale Ticks */}
          {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(val => {
            const y = yScale(val);
            const isThreshold = val === 10;
            return (
              <g key={`grid-${val}`}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke={isThreshold ? '#ef4444' : '#f1f5f9'}
                  strokeWidth={isThreshold ? 1.5 : 1}
                  strokeDasharray={isThreshold ? '4 4' : undefined}
                />
                {/* Y-axis tick label (Left and Right) */}
                <text
                  x={margin.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight={isThreshold ? '800' : '600'}
                  fill={isThreshold ? '#dc2626' : '#94a3b8'}
                  fontFamily="monospace"
                >
                  {val.toFixed(0)}
                </text>
                <text
                  x={svgWidth - margin.right + 10}
                  y={y + 4}
                  textAnchor="start"
                  fontSize="11"
                  fontWeight={isThreshold ? '800' : '600'}
                  fill={isThreshold ? '#dc2626' : '#94a3b8'}
                  fontFamily="monospace"
                >
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Threshold Label (عتبة النجاح 10/20) */}
          <g>
            <rect
              x={svgWidth - margin.right - 105}
              y={yThreshold - 10}
              width="100"
              height="20"
              rx="4"
              fill="#fee2e2"
              stroke="#fca5a5"
              strokeWidth="0.8"
            />
            <text
              x={svgWidth - margin.right - 55}
              y={yThreshold + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#b91c1c"
            >
              عتبة النجاح (10/20)
            </text>
          </g>

          {/* Box Plots for each item */}
          {statsList.map((stat, idx) => {
            const cx = margin.left + (idx + 1) * colStep;
            const xLeft = cx - boxWidth / 2;
            const xRight = cx + boxWidth / 2;

            const yMin = yScale(stat.min);
            const yMax = yScale(stat.max);
            const yQ1 = yScale(stat.q1);
            const yMedian = yScale(stat.median);
            const yQ3 = yScale(stat.q3);
            const yMean = yScale(stat.mean);
            const yLowerWhisker = yScale(stat.lowerWhisker);
            const yUpperWhisker = yScale(stat.upperWhisker);

            const isHovered = hoveredBox?.id === stat.id;

            return (
              <g
                key={`box-${stat.id}`}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredBox(stat)}
                onMouseLeave={() => setHoveredBox(null)}
              >
                {/* Whisker Line (Vertical Center) */}
                <line
                  x1={cx}
                  y1={yLowerWhisker}
                  x2={cx}
                  y2={yUpperWhisker}
                  stroke={stat.color}
                  strokeWidth="2"
                  strokeDasharray={stat.count < 3 ? '2 2' : undefined}
                />

                {/* Lower Whisker End Cap */}
                <line
                  x1={cx - boxWidth * 0.28}
                  y1={yLowerWhisker}
                  x2={cx + boxWidth * 0.28}
                  y2={yLowerWhisker}
                  stroke={stat.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* Upper Whisker End Cap */}
                <line
                  x1={cx - boxWidth * 0.28}
                  y1={yUpperWhisker}
                  x2={cx + boxWidth * 0.28}
                  y2={yUpperWhisker}
                  stroke={stat.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                {/* The Interquartile Box (Q1 to Q3) */}
                <rect
                  x={xLeft}
                  y={yQ3}
                  width={boxWidth}
                  height={Math.max(2, yQ1 - yQ3)}
                  rx="6"
                  fill={stat.color}
                  fillOpacity={isHovered ? 0.35 : 0.2}
                  stroke={stat.color}
                  strokeWidth={isHovered ? 2.5 : 1.8}
                />

                {/* Median Line (Bold) */}
                <line
                  x1={xLeft}
                  y1={yMedian}
                  x2={xRight}
                  y2={yMedian}
                  stroke={stat.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Mean Diamond Marker (♦) */}
                <polygon
                  points={`${cx},${yMean - 4} ${cx + 4},${yMean} ${cx},${yMean + 4} ${cx - 4},${yMean}`}
                  fill="#ffffff"
                  stroke={stat.color}
                  strokeWidth="2"
                  title={`المعدل الحسابي: ${stat.mean}`}
                />

                {/* Outliers */}
                {stat.outliers.map((outVal, oIdx) => {
                  const yOut = yScale(outVal);
                  return (
                    <circle
                      key={`outlier-${stat.id}-${oIdx}`}
                      cx={cx}
                      cy={yOut}
                      r="3.5"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    >
                      <title>{`نقطة شاذة (Outlier): ${outVal} / 20`}</title>
                    </circle>
                  );
                })}

                {/* Column Label on X-axis */}
                <text
                  x={cx}
                  y={svgHeight - margin.bottom + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  fill="#1e293b"
                >
                  {stat.name}
                </text>
                {stat.subTitle && (
                  <text
                    x={cx}
                    y={svgHeight - margin.bottom + 34}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#64748b"
                  >
                    {stat.subTitle}
                  </text>
                )}
                <text
                  x={cx}
                  y={svgHeight - margin.bottom + 46}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#94a3b8"
                  fontFamily="monospace"
                >
                  ({stat.count} تلميذ)
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Tooltip Card on Hover or Legend breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
        {statsList.map(stat => {
          const isSelected = hoveredBox?.id === stat.id;
          const isHomogeneous = stat.iqr <= 3.5;
          const isHighDispersion = stat.iqr >= 5.5;

          return (
            <div
              key={`legend-${stat.id}`}
              onMouseEnter={() => setHoveredBox(stat)}
              onMouseLeave={() => setHoveredBox(null)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-400 bg-blue-50/50 shadow-xs'
                  : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span className="font-black text-xs text-slate-900">{stat.name}</span>
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {stat.count} تلميذ
                </span>
              </div>

              {/* 5-Number Summary Table */}
              <div className="grid grid-cols-5 gap-1 text-center bg-white p-2 rounded-lg border border-slate-200/80 font-mono text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Min</span>
                  <strong className="text-slate-700">{stat.min}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Q1</span>
                  <strong className="text-amber-600">{stat.q1}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Med</span>
                  <strong className="text-blue-700 font-black">{stat.median}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Q3</span>
                  <strong className="text-purple-600">{stat.q3}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans">Max</span>
                  <strong className="text-emerald-700">{stat.max}</strong>
                </div>
              </div>

              {/* Dispersion Metrics & Pedagogical Interpretation */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  المدى الربيعي <strong className="font-mono font-bold text-slate-800">IQR = {stat.iqr}</strong>
                </span>
                <span>
                  المعدل <strong className="font-mono font-bold text-blue-800">{stat.mean}</strong>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isHomogeneous
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : isHighDispersion
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {isHomogeneous ? 'قسم متجانس' : isHighDispersion ? 'تفاوت وتشتت حاد' : 'تجانس متوسط'}
                </span>
              </div>

              {stat.outliers.length > 0 && (
                <div className="mt-2 text-[10px] text-rose-600 flex items-center gap-1 font-bold">
                  <Sparkles className="w-3 h-3 text-rose-500" />
                  <span>
                    يوجد {stat.outliers.length} نقط شاذة استثنائية ({stat.outliers.join(', ')})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoxPlotChart;
