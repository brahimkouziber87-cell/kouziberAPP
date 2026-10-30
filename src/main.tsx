import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import App from './App.tsx';
import QuickProfileSparkline, { QuickProfileSparklineProps } from './QuickProfileSparkline.tsx';
import './index.css';

const Analysis = lazy(() => import('./Analysis.tsx'));
const DashboardView = lazy(() => import('./DashboardView.tsx'));
const ReportsEvolutionChart = lazy(() => import('./ReportsEvolutionChart.tsx'));

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

// Expose html2canvas and jsPDF globally for high-performance PDF export features
(window as unknown as { html2canvas: typeof html2canvas }).html2canvas = html2canvas;
(window as unknown as { jsPDF: typeof jsPDF; jspdf: { jsPDF: typeof jsPDF } }).jsPDF = jsPDF;
(window as unknown as { jsPDF: typeof jsPDF; jspdf: { jsPDF: typeof jsPDF } }).jspdf = { jsPDF };

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

let analysisRootInstance: ReturnType<typeof createRoot> | null = null;
export const initAnalysisView = () => {
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

let reportsEvolutionChartRootInstance: ReturnType<typeof createRoot> | null = null;
export const initReportsEvolutionChart = () => {
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


