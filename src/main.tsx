import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import QuickProfileSparkline, { QuickProfileSparklineProps } from './QuickProfileSparkline.tsx';
import { initGlobalPedagogicalGovernanceHooks } from './services/indexedDbEngine.ts';
import { initPedagogicalStoreBridge } from './services/pedagogicalStore.ts';
import './index.css';

initGlobalPedagogicalGovernanceHooks();
initPedagogicalStoreBridge();

const Analysis = lazy(() => import('./Analysis.tsx'));
const DashboardView = lazy(() => import('./DashboardView.tsx'));
const ReportsEvolutionChart = lazy(() => import('./ReportsEvolutionChart.tsx'));
const AnnualRechartsComparison = lazy(() => import('./AnnualRechartsComparison.tsx'));
const WeekdayAbsenceDistributionCard = lazy(() => import('./WeekdayAbsenceDistributionCard.tsx'));
const StrategicRoadmapSuite = lazy(() => import('./StrategicRoadmapSuite.tsx'));

function LightweightChartLoader({ label = 'جاري تحميل الرسوم البيانية والمؤشرات...' }: { label?: string }) {
  return (
    <div
      className="w-full py-8 px-4 my-2 rounded-2xl border border-slate-200/80 bg-white/90 flex items-center justify-center gap-3 text-slate-600 text-xs font-bold shadow-2xs"
      dir="rtl"
    >
      <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin inline-block flex-shrink-0" />
      <span>{label}</span>
    </div>
  );
}

// Lazy-load html2canvas and jsPDF during browser idle time or on-demand for fast initial boot
const loadHeavyExportLibraries = async () => {
  const win = window as any;
  if (win.html2canvas && win.jsPDF) return { html2canvas: win.html2canvas, jsPDF: win.jsPDF };
  const [{ default: html2canvasMod }, { default: jsPDFMod }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  win.html2canvas = html2canvasMod;
  win.jsPDF = jsPDFMod;
  win.jspdf = { jsPDF: jsPDFMod };
  win.__lazyExportLibsLoaded = true;
  return { html2canvas: html2canvasMod, jsPDF: jsPDFMod };
};

(window as any).ensurePdfExportLibrariesLoaded = loadHeavyExportLibraries;
if (typeof window !== 'undefined') {
  const idleInit = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 2200));
  idleInit(() => {
    loadHeavyExportLibraries().catch(() => {});
  });
}

// Expose QuickProfileSparkline renderer for #dashStudentQuickProfileModal
let sparklineRoot: ReturnType<typeof createRoot> | null = null;
let currentSparklineEl: HTMLElement | null = null;

(window as unknown as { renderQuickProfileSparkline: (containerId: string, data: QuickProfileSparklineProps) => void }).renderQuickProfileSparkline = (containerId: string, data: QuickProfileSparklineProps) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!sparklineRoot || currentSparklineEl !== container) {
    if (sparklineRoot) {
      try {
        sparklineRoot.unmount();
      } catch (e) {
        // ignore unmount error on replaced nodes
      }
    }
    sparklineRoot = createRoot(container);
    currentSparklineEl = container;
  }

  sparklineRoot.render(
    <StrictMode>
      <QuickProfileSparkline {...data} />
    </StrictMode>
  );
};

(window as unknown as { unmountQuickProfileSparkline: () => void }).unmountQuickProfileSparkline = () => {
  if (sparklineRoot) {
    try {
      sparklineRoot.unmount();
    } catch (e) {}
    sparklineRoot = null;
    currentSparklineEl = null;
  }
};

const rootElement = document.getElementById('root-pwa-install');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

let annualRechartsRootInstance: ReturnType<typeof createRoot> | null = null;
export const initAnnualRechartsView = () => {
  const annualRechartsRoot = document.getElementById('react-annual-recharts-root');
  if (annualRechartsRoot && !annualRechartsRootInstance) {
    annualRechartsRootInstance = createRoot(annualRechartsRoot);
    annualRechartsRootInstance.render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل رسوم المقارنة المبيانية (Recharts) للدورة 1 والدورة 2..." />}>
          <AnnualRechartsComparison />
        </Suspense>
      </StrictMode>,
    );
  }
};

(window as unknown as { renderAnnualRechartsView: () => void }).renderAnnualRechartsView = initAnnualRechartsView;
window.addEventListener('annualTabOpened', initAnnualRechartsView);

let analysisRootInstance: ReturnType<typeof createRoot> | null = null;
export const initAnalysisView = () => {
  initAnnualRechartsView();
  const analysisRoot = document.getElementById('react-analysis-root');
  if (analysisRoot && !analysisRootInstance) {
    analysisRootInstance = createRoot(analysisRoot);
    analysisRootInstance.render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل منظومة التحليل الإحصائي والرسوم البيانية..." />}>
          <Analysis />
        </Suspense>
      </StrictMode>,
    );
  }
};

(window as unknown as { renderAnalysisView: () => void }).renderAnalysisView = initAnalysisView;
window.addEventListener('analysisTabOpened', initAnalysisView);

let dashboardViewRootInstance: ReturnType<typeof createRoot> | null = null;
export const initDashboardView = () => {
  const dashboardRoot = document.getElementById('react-dashboard-root');
  if (dashboardRoot && !dashboardViewRootInstance) {
    dashboardViewRootInstance = createRoot(dashboardRoot);
    dashboardViewRootInstance.render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل الرسوم البيانية للوحة القيادة..." />}>
          <DashboardView />
        </Suspense>
      </StrictMode>,
    );
  }
};

(window as unknown as { renderDashboardView: () => void }).renderDashboardView = initDashboardView;
window.addEventListener('dashboardTabOpened', initDashboardView);

let weekdayAbsenceRootInstance: ReturnType<typeof createRoot> | null = null;
export const initWeekdayAbsenceCard = () => {
  const weekdayRoot = document.getElementById('react-weekday-absence-root');
  if (weekdayRoot && !weekdayAbsenceRootInstance) {
    weekdayAbsenceRootInstance = createRoot(weekdayRoot);
    weekdayAbsenceRootInstance.render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل بطاقة ومبيان توزيع الغياب بحسب أيام الأسبوع..." />}>
          <WeekdayAbsenceDistributionCard />
        </Suspense>
      </StrictMode>,
    );
  }
  const roadmapRoot = document.getElementById('react-strategic-roadmap-root');
  if (roadmapRoot && !(window as any).__strategicRoadmapRootMounted) {
    (window as any).__strategicRoadmapRootMounted = true;
    createRoot(roadmapRoot).render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل منظومة اليقظة التربوية والمدقق القبلي لمسار..." />}>
          <StrategicRoadmapSuite />
        </Suspense>
      </StrictMode>,
    );
  }
};

(window as unknown as { renderWeekdayAbsenceCard: () => void }).renderWeekdayAbsenceCard = initWeekdayAbsenceCard;

let reportsEvolutionChartRootInstance: ReturnType<typeof createRoot> | null = null;
export const initReportsEvolutionChart = () => {
  initWeekdayAbsenceCard();
  const reportsEvolutionRoot = document.getElementById('react-reports-evolution-root');
  if (reportsEvolutionRoot && !reportsEvolutionChartRootInstance) {
    reportsEvolutionChartRootInstance = createRoot(reportsEvolutionRoot);
    reportsEvolutionChartRootInstance.render(
      <StrictMode>
        <Suspense fallback={<LightweightChartLoader label="جاري تحميل منحنيات تطور التقارير..." />}>
          <ReportsEvolutionChart />
        </Suspense>
      </StrictMode>,
    );
  }
};

(window as unknown as { renderReportsEvolutionChart: () => void }).renderReportsEvolutionChart = initReportsEvolutionChart;
window.addEventListener('reportsEvolutionTabOpened', initReportsEvolutionChart);

// Mount immediately only if the corresponding view is already visible on initial load
const annualEl = document.getElementById('annualPerformanceView');
if (annualEl && annualEl.style.display !== 'none') {
  initAnnualRechartsView();
  initAnalysisView();
}
const dashEl = document.getElementById('dashboardView');
if (dashEl && dashEl.style.display !== 'none') {
  initDashboardView();
}
const reportsEl = document.getElementById('reportsView');
if (reportsEl && reportsEl.style.display !== 'none') {
  initReportsEvolutionChart();
}




