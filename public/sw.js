// Service Worker for "الأستاذ الرقمي | منظومة التدبير التربوي"
const CACHE_NAME = 'prof-digital-v3.5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=3.5',
  '/app.js?v=3.5',
  '/manifest.json',
  '/logo.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon.ico',
  '/lucide-icons.js?v=3.5',
  '/secondary-math-curriculum.js?v=3.5',
  '/attendance-slip.js?v=3.5',
  '/resources.js?v=3.5',
  '/tutoring-advanced.js?v=3.5',
  '/timetable-sync.js?v=3.5',
  '/annual-calendar.js?v=3.5',
  '/pedagogical-roadmap.js?v=3.5',
  '/google-calendar-sync.js?v=3.5',
  '/math-remediation-ai.js?v=3.5',
  '/ai-prompt-templates.js?v=3.5',
  '/smart-exam-alerts.js?v=3.5',
  '/student-portfolio.js?v=3.5',
  '/admin-followup-alerts.js?v=3.5',
  '/weekday-absence-plan.js?v=3.5',
  '/weekly-absence-summary.js?v=3.5',
  '/onboarding-guide.js?v=3.5',
  '/absence-heatmap.js?v=3.5',
  '/absence-periodic-analytics.js?v=3.5',
  '/diagnostic-evaluation.js?v=3.5',
  '/interactive-teaching.js?v=3.5',
  '/distance-teaching.js?v=3.5',
  '/pedagogical-sharing.js?v=3.5',
  '/voice-search.js?v=3.5',
  '/upcoming-exams-timeline.js?v=3.5',
  '/exam-report.js?v=3.5',
  '/academic-evolution-card.js?v=3.5',
  '/grades-absence-impact-chart.js?v=3.5',
  '/teacher-profile.js?v=3.5',
  '/desktop-app.js?v=3.5',
  '/chunked-pdf-engine.js?v=3.5',
  '/firebase-setup.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Some static assets failed to precache', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_ALL_CACHES' || event.data.type === 'BUMP_VERSION_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip API proxy, Vite internal, and WebSocket requests
  if (url.pathname.startsWith('/api/') || url.pathname.includes('@vite') || url.pathname.includes('node_modules')) {
    return;
  }

  // True Network-First with Cache Fallback so updates are always live when online
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return cachedResponse;
        });
      })
  );
});
