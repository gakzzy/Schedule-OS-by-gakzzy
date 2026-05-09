// ═══════════════════════════════════════════════════════════
// SCHEDULE OS — Service Worker v5.2.0
// CACHE_NAME is tied to APP_VERSION — updating APP_VERSION
// in app.html automatically invalidates all user caches.
// ═══════════════════════════════════════════════════════════

const APP_VERSION  = '5.2.0';
const CACHE_STATIC = `sos-static-v${APP_VERSION}`;
const CACHE_PAGES  = `sos-pages-v${APP_VERSION}`;

const APP_SHELL = [
  '/app.html',
  '/index.html',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(APP_SHELL).catch(err =>
        console.warn('[SW] Shell cache partial fail:', err.message)
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches, claim all clients ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_PAGES)
          .map(k => { console.log('[SW] Removing old cache:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: APP_VERSION }))
      ))
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Skip external services — they manage their own caching
  const EXTERNAL = [
    'firebase','googleapis','gstatic','firebaseio',
    'emailjs','cdnjs','jsdelivr','fonts.goo',
    'anthropic','brevo','tawk',
  ];
  if (EXTERNAL.some(s => url.hostname.includes(s))) return;

  // HTML: Network First — always try to get fresh HTML
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_PAGES).then(c => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: Cache First
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|json|txt|xml)$/)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_STATIC).then(c => c.put(req, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // Default: Network First
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// ── Messages from app ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }
});
