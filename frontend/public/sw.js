// ClassBreak service worker — offline shell only.
//
// POLICY (see AGENTS.md §5):
//  - Cache static build assets (same-origin, hashed) and the app shell.
//  - NEVER cache API responses (/api/*): lessons/feeds/tutor output can be
//    user-specific and cost money to regenerate; offline access to learning
//    content is handled by IndexedDB "downloaded" lessons instead.
//  - No third-party caching at all.

const CACHE = 'classbreak-static-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // never touch mutations

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no cross-origin caching
  if (url.pathname.startsWith('/api/')) return;    // API always network

  // SPA navigations: network-first, fall back to cached shell for offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets & shell: cache-first, refresh in background.
  event.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
