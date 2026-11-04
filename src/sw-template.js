// Service worker template. vite.config.ts fills in the build version and the precache list.
/* eslint-disable */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `chess-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('chess-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Only same-origin GETs; Firebase and other services go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Pages: network first so a new deploy shows up, cached page when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(new URL('./', self.registration.scope).href, copy));
          return response;
        })
        .catch(() => caches.match(new URL('./', self.registration.scope).href, { ignoreVary: true })),
    );
    return;
  }

  // Assets: cache first (file names change with each build), network as fallback.
  // Match by URL only: the page's crossorigin requests carry an Origin header that the
  // precache requests did not, and a `Vary` header would otherwise make them miss.
  event.respondWith(
    caches.match(request.url, { ignoreVary: true }).then((cached) => cached || fetch(request)),
  );
});
