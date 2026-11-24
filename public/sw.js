// Service Worker for "الأستاذ الرقمي | منظومة التدبير التربوي"
const CACHE_NAME = 'prof-digital-v4.8.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/modals-templates.js?v=4.8.0',
  '/core/grades-calculator.js?v=4.8.0',
  '/core/massar-io.js?v=4.8.0',
  '/core/absence-manager.js?v=4.8.0',
  '/core/lesson-log-engine.js?v=4.8.0',
  '/core/print-preview-engine.js?v=4.8.0',
  '/core/timetable-engine.js?v=4.8.0',
  '/core/behavior-homework-engine.js?v=4.8.0',
  '/core/archive-dedup-engine.js?v=4.8.0',
  '/core/inspection-dossier-engine.js?v=4.8.0',
  '/style.css?v=4.8.2',
  '/app.js?v=4.8.0',
  '/manifest.json',
  '/logo.svg',
  '/logo.png',
  '/institution-logo.svg',
  '/promptcraft-ai-logo.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/favicon.ico',
  '/lazy-cdn-loader.js?v=3.9',
  '/lucide-icons.js?v=3.9',
  '/quick-grade-scanner.js?v=3.9',
  '/secondary-math-curriculum.js?v=4.8.0',
  '/latex-math-engine.js?v=4.8.0',
  '/attendance-slip.js?v=3.9',
  '/resources.js?v=4.6',
  '/tutoring-advanced.js?v=3.9',
  '/timetable-sync.js?v=3.9',
  '/annual-calendar.js?v=3.9',
  '/pedagogical-roadmap.js?v=3.9',
  '/google-calendar-sync.js?v=3.9',
  '/math-remediation-ai.js?v=3.9',
  '/ai-prompt-templates.js?v=3.9',
  '/smart-exam-alerts.js?v=3.9',
  '/vendor-qrcode.js?v=3.9.5',
  '/student-portfolio.js?v=3.9.7',
  '/admin-followup-alerts.js?v=3.9',
  '/weekday-absence-plan.js?v=3.9',
  '/weekly-absence-summary.js?v=3.9',
  '/onboarding-guide.js?v=3.9',
  '/absence-heatmap.js?v=3.9',
  '/absence-periodic-analytics.js?v=3.9',
  '/collective-absence-evolution.js?v=3.9',
  '/diagnostic-evaluation.js?v=3.9',
  '/interactive-teaching.js?v=3.9',
  '/whiteboard/wb-security-math.js?v=4.2',
  '/whiteboard/wb-vector-engine.js?v=4.1',
  '/whiteboard/wb-collab-sync.js?v=4.1',
  '/whiteboard/wb-bridges.js?v=4.1',
  '/distance-teaching.js?v=4.2',
  '/pedagogical-sharing.js?v=3.9',
  '/voice-search.js?v=3.9',
  '/upcoming-exams-timeline.js?v=3.9',
  '/exam-report.js?v=3.9',
  '/academic-evolution-card.js?v=3.9',
  '/grades-absence-impact-chart.js?v=3.9',
  '/teacher-profile.js?v=3.9',
  '/desktop-app.js?v=3.9',
  '/chunked-pdf-engine.js?v=3.9.6',
  '/pedagogical-council-pv.js?v=3.9',
  '/value-added-analytics.js?v=3.9',
  '/ministerial-decrees-library.js?v=3.9',
  '/admin-comprehensive-pdf.js?v=3.9',
  '/firebase-setup.js?v=4.6'
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

// Background Sync & Periodic Sync listeners: notify active clients to push hourly/pending Firestore backups when online
function notifyClientsToRunFirestoreSync(messageType) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      try {
        client.postMessage({ type: messageType });
      } catch (e) {}
    });
  });
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'firestore-periodic-sync' || event.tag === 'firestore-hourly-backup') {
    event.waitUntil(
      notifyClientsToRunFirestoreSync(
        event.tag === 'firestore-hourly-backup'
          ? 'TRIGGER_FIRESTORE_HOURLY_BACKUP'
          : 'TRIGGER_FIRESTORE_BACKGROUND_SYNC'
      )
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'firestore-hourly-backup') {
    event.waitUntil(notifyClientsToRunFirestoreSync('TRIGGER_FIRESTORE_HOURLY_BACKUP'));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip cross-origin requests (Google OAuth/Firebase/CDNs), API proxy, Vite internal, and node_modules
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('node_modules')
  ) {
    return;
  }

  // Cache-First fast-path for immutable static icons & vector assets
  if (/\.(png|svg|ico|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // True Network-First with Cache Fallback and cache: 'no-cache' to prevent stale JS/HTML disk cache
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
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
        return caches.match(event.request, { ignoreSearch: false }).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html').then((idx) => idx || new Response('Offline', { status: 503, statusText: 'Offline' }));
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
