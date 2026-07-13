const VERSION = 'v26';
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
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache with a version query: cache:'reload' bypasses the browser HTTP
    // cache but NOT GitHub Pages' CDN edge (max-age=600), so fetching a new
    // sw.js right after a deploy can still fill this version's cache with the
    // previous deploy's files. A per-version URL is a guaranteed edge miss.
    // Store under the clean URL so runtime cache lookups keep matching.
    await Promise.all(SHELL.map(async (url) => {
      const res = await fetch(new Request(`${url}?swv=${VERSION}`, { cache: 'reload' }));
      // A non-OK response must abort the install (like addAll would) rather
      // than poison the shell cache; the browser retries the install later.
      if (!res.ok) throw new Error(`precache failed: ${url} → ${res.status}`);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
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
  event.respondWith((async () => {
    // Navigations must match the precached shell regardless of query string
    // ('/?utm=…' would otherwise miss './' and die offline).
    const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // Gate on a successful same-origin response so a 404/5xx/opaque
      // response never poisons the cache for future requests.
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      // Offline navigation to an un-precached URL still gets the app shell;
      // everything else gets a real network-error Response (respondWith must
      // never resolve with undefined or reject with a bare error).
      if (req.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return Response.error();
    }
  })());
});
