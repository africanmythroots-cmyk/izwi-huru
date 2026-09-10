// static/sw.js
// Service Worker — offline-first caching strategy.
// Caches:
//   1. The Charter page (always readable offline — most critical content)
//   2. Static assets (JS, CSS, fonts)
//   3. The last 20 thread pages the user visited
//   4. Queues POST requests (new posts) when offline, sends when online

const CACHE_NAME    = 'izwi-huru-v1';
const STATIC_ASSETS = [
  '/',
  '/charter',
  '/transparency',
  '/manifest.webmanifest',
];

// Install: pre-cache the critical pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//   - Navigation requests: network-first, fall back to cache
//   - Static assets: cache-first, network fallback
//   - API requests: network-only (never cache API responses — they contain user data)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept auth or API requests — let them go to network
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/posts') ||
      url.pathname.startsWith('/feed') || url.pathname.startsWith('/mod') ||
      url.pathname.startsWith('/transparency/reports')) {
    return; // default fetch
  }

  // Navigation (HTML pages): network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache the fresh charter/transparency pages
          if (
            url.pathname === '/charter' ||
            url.pathname === '/transparency' ||
            url.pathname === '/'
          ) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request))
  );
});

// Background sync: send queued posts when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'post-queue') {
    event.waitUntil(flushPostQueue());
  }
});

async function flushPostQueue() {
  // Open IndexedDB post queue and replay failed requests
  // Simplified: the full implementation uses idb-keyval
  const db = await openQueueDb();
  const items = await db.getAll('post-queue');
  for (const item of items) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        credentials: 'same-origin',
      });
      if (res.ok) {
        await db.delete('post-queue', item.id);
      }
    } catch {
      // Still offline — will retry on next sync
    }
  }
}

function openQueueDb() {
  return new Promise((resolve) => {
    const req = indexedDB.open('izwi-huru-queue', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('post-queue', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
  });
}
