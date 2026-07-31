/* ═══════════════════════════════════════════════
   sw.js — Service Worker para Arcade Hub
   Estrategias diferenciadas:
   - cache-first: HTML, CSS, JS, y demás assets estáticos
   - network-first: metadata.json (cambia con cada actualización)
   ═══════════════════════════════════════════════ */

const STATIC_CACHE = 'arcadehub-static-v7';
const META_CACHE = 'arcadehub-meta-v1';

const FILES = [
  './',
  './index.html',
  './games.js',
  './shared/base.css',
  './shared/audio.js',
  './shared/achievements.js',
  './shared/effects.js',
  './shared/help.js',
  './shared/display.js',
  './shared/dom.js',
  './shared/loop.js',
  './shared/input.js',
  // Pong
  './games/pong/index.html',
  './games/pong/style.css',
  './games/pong/script.js',
  // Breakout
  './games/breakout/index.html',
  './games/breakout/style.css',
  './games/breakout/script.js',
  // Snake
  './games/snake/index.html',
  './games/snake/style.css',
  './games/snake/script.js',
  // Dino Runner
  './games/dino-runner/index.html',
  './games/dino-runner/style.css',
  './games/dino-runner/script.js',
  // Asteroids
  './games/asteroids/index.html',
  './games/asteroids/style.css',
  './games/asteroids/script.js',
  // Space Invaders
  './games/space-invaders/index.html',
  './games/space-invaders/style.css',
  './games/space-invaders/script.js',
  // Flappy Bird
  './games/flappy-bird/index.html',
  './games/flappy-bird/style.css',
  './games/flappy-bird/script.js',
  // Pac-Man
  './games/pacman/index.html',
  './games/pacman/style.css',
  './games/pacman/script.js',
  // Tetris
  './games/tetris/index.html',
  './games/tetris/style.css',
  './games/tetris/script.js',
  // Frogger
  './games/frogger/index.html',
  './games/frogger/style.css',
  './games/frogger/script.js',
  // Galaga
  './games/galaga/index.html',
  './games/galaga/style.css',
  './games/galaga/script.js',
  // Centipede
  './games/centipede/index.html',
  './games/centipede/style.css',
  './games/centipede/script.js',
  // Dig Dug
  './games/digdug/index.html',
  './games/digdug/style.css',
  './games/digdug/script.js',
  // Missile Command
  './games/missile-command/index.html',
  './games/missile-command/style.css',
  './games/missile-command/script.js',
  // Neon Nexus
  './games/neon-nexus/index.html',
  './games/neon-nexus/style.css',
  './games/neon-nexus/script.js',
  // Cell Swarm
  './games/cell-swarm/index.html',
  './games/cell-swarm/style.css',
  './games/cell-swarm/script.js',
  // Donkey Kong
  './games/donkey-kong/index.html',
  './games/donkey-kong/style.css',
  './games/donkey-kong/script.js',
  // Defender
  './games/defender/index.html',
  './games/defender/style.css',
  './games/defender/script.js',
  // Joust
  './games/joust/index.html',
  './games/joust/style.css',
  './games/joust/script.js',
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
