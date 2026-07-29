/* ═══════════════════════════════════════════════
   sw.js — Service Worker para Arcade Hub
   Estrategias diferenciadas:
   - cache-first: HTML, CSS, JS, y demás assets estáticos
   - network-first: metadata.json (cambia con cada actualización)
   ═══════════════════════════════════════════════ */

const STATIC_CACHE = 'arcadehub-static-v3';
const META_CACHE = 'arcadehub-meta-v1';

const FILES = [
  './',
  './index.html',
  './games.js',
  './shared/base.css',
  './shared/audio.js',
  './shared/achievements.js',
  './shared/effects.js',
  './games/pong/index.html',
  './games/breakout/index.html',
  './games/snake/index.html',
  './games/dino-runner/index.html',
  './games/asteroids/index.html',
  './games/space-invaders/index.html',
  './games/flappy-bird/index.html',
  './games/pacman/index.html',
  './games/tetris/index.html',
  './games/frogger/index.html',
  './games/galaga/index.html',
  './games/centipede/index.html',
  './games/digdug/index.html',
  './games/missile-command/index.html',
  './games/neon-nexus/index.html',
  './games/cell-swarm/index.html',
  './games/donkey-kong/index.html',
  './games/defender/index.html',
  './games/joust/index.html',
];

// ── Instalación: precachear assets estáticos ──
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// ── Activación: limpiar caches antiguas ──
const CACHE_KEYS = [STATIC_CACHE, META_CACHE];
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !CACHE_KEYS.includes(key)).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// ── Estrategias diferenciadas por tipo de asset ──
function isMetadata(url) {
  return url.pathname.endsWith('/metadata.json');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptar requests del mismo origen
  if (url.origin !== self.location.origin) return;

  // ── metadata.json: network-first ──
  // Busca en red primero. Si falla (offline), sirve la copia en caché.
  if (isMetadata(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(META_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // ── Assets estáticos (HTML, CSS, JS, etc.): cache-first ──
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
