// Schedule OS Service Worker v5.1
// Provides offline support by caching the app shell

const CACHE_NAME = 'schedule-os-v5.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('SW: cache addAll partial fail', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and Firebase/external requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('emailjs') ||
      url.hostname.includes('cdnjs') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('fonts.goo')) return;

  // Network first strategy
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Background sync for pending saves (future)
self.addEventListener('sync', event => {
  if (event.tag === 'background-save') {
    console.log('SW: background sync triggered');
  }
});
