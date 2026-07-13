/* Service worker de VinsLingo — hace que la app instalada abra y funcione SIN
 * conexión (los datos ya son locales en SQLite; esto cachea la "shell": HTML,
 * bundles JS, WASM, fuentes e iconos).
 *
 * Estrategia:
 *  - Navegaciones (index.html): network-first → fallback al HTML cacheado (SPA).
 *  - Assets same-origin (JS/CSS/WASM/fuentes/imágenes): cache-first.
 *  - Cross-origin (Supabase, Google TTS…): red directa, sin cachear (offline
 *    degrada con gracia, como ya hace la app).
 *
 * Cabeceras: se sirve la Response cacheada TAL CUAL (con sus COOP/COEP), así se
 * preserva el cross-origin isolation que necesita SharedArrayBuffer/SQLite-wasm.
 */
const CACHE = 'vinslingo-shell-v1';
const PRECACHE = [
  '/', '/index.html', '/manifest.json',
  '/favicon.ico', '/favicon-32.png', '/favicon-16.png',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // cross-origin → red directa

  // Navegación (carga de la app): network-first, fallback al HTML cacheado.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('/index.html', res.clone());
        return res;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Assets same-origin: cache-first (bundles con hash, WASM, fuentes, iconos).
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
