const VERSION = 'v21';
const CACHE_NAME = 'arnold';
const CACHE = `${CACHE_NAME}-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles.css',
  './app.js',
  './commands.js',
  './history.js',
  './store.js',
  './db.js',
  './seed.js',
  './quotes.json',
  './icon.svg',
  './assets/arnold.jpg',
  './splash/splash-1290x2796.png',
  './splash/splash-1284x2778.png',
  './splash/splash-1242x2688.png',
  './splash/splash-1242x2208.png',
  './splash/splash-1179x2556.png',
  './splash/splash-1170x2532.png',
  './splash/splash-1125x2436.png',
  './splash/splash-828x1792.png',
  './splash/splash-750x1334.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' bypasses the browser HTTP cache so a version bump
      // never re-precaches a stale file from GitHub Pages' max-age=600.
      .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const oldKeys = keys.filter((k) => k.startsWith(CACHE_NAME + '-') && k !== CACHE);
    const wasUpdate = oldKeys.length > 0; // any leftover shell cache => this is an upgrade
    await Promise.all(oldKeys.map((k) => caches.delete(k)));
    await self.clients.claim();
    // On an upgrade, tell live clients to reload so they pick up the new
    // shell on this launch instead of the next one (the two-reload problem).
    if (wasUpdate) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.postMessage({ type: 'RELOAD' }));
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Gate on a successful same-origin response so a 404/5xx/opaque
        // response never poisons the cache for future requests.
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
