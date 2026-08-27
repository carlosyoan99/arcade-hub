/* ═══════════════════════════════════════════════
   sw.js — Service Worker para Arcade Hub
   Estrategias diferenciadas:
   - cache-first: HTML, CSS, JS, y demás assets estáticos
   - network-first: metadata.json (cambia con cada actualización)
   ═══════════════════════════════════════════════ */

const STATIC_CACHE = 'arcadehub-static-v19';
const META_CACHE = 'arcadehub-meta-v1';

const FILES = [
  './',
  './asset/hub-cards.js',
  './games.js',
  './games/asteroids/index.html',
  './games/asteroids/script.js',
  './games/asteroids/style.css',
  './games/breakout/index.html',
  './games/breakout/script.js',
  './games/breakout/style.css',
  './games/cell-swarm/index.html',
  './games/cell-swarm/script.js',
  './games/cell-swarm/style.css',
  './games/centipede/index.html',
  './games/centipede/script.js',
  './games/centipede/style.css',
  './games/defender/index.html',
  './games/defender/script.js',
  './games/defender/style.css',
  './games/digdug/index.html',
  './games/digdug/script.js',
  './games/digdug/style.css',
  './games/dino-runner/index.html',
  './games/dino-runner/script.js',
  './games/dino-runner/style.css',
  './games/donkey-kong/index.html',
  './games/donkey-kong/script.js',
  './games/donkey-kong/style.css',
  './games/flappy-bird/index.html',
  './games/flappy-bird/script.js',
  './games/flappy-bird/style.css',
  './games/frogger/index.html',
  './games/frogger/script.js',
  './games/frogger/style.css',
  './games/galaga/index.html',
  './games/galaga/script.js',
  './games/galaga/style.css',
  './games/joust/index.html',
  './games/joust/script.js',
  './games/joust/style.css',
  './games/missile-command/index.html',
  './games/missile-command/script.js',
  './games/missile-command/style.css',
  './games/neon-nexus/index.html',
  './games/neon-nexus/script.js',
  './games/neon-nexus/style.css',
  './games/pacman/index.html',
  './games/pacman/script.js',
  './games/pacman/style.css',
  './games/pong/index.html',
  './games/pong/script.js',
  './games/pong/style.css',
  './games/snake/index.html',
  './games/snake/script.js',
  './games/snake/style.css',
  './games/space-invaders/index.html',
  './games/space-invaders/script.js',
  './games/space-invaders/style.css',
  './games/tetris/index.html',
  './games/tetris/script.js',
  './games/tetris/style.css',
  './index.html',
  './shared/achievements.js',
  './shared/audio.js',
  './shared/base.css',
  './shared/display.js',
  './shared/dom.js',
  './shared/effects.js',
  './shared/help.js',
  './shared/input.js',
  './shared/loop.js',
  './shared/music.js',
  './shared/scores.js',
  './shared/shell.js',
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
