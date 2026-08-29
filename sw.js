/* ═══════════════════════════════════════════════
   sw.js — Service Worker para Arcade Hub
   Estrategias diferenciadas:
   - cache-first: HTML, CSS, JS, y demás assets estáticos
   - network-first: metadata.json (cambia con cada actualización)
   ═══════════════════════════════════════════════ */

const STATIC_CACHE = 'arcadehub-static-v28';
const META_CACHE = 'arcadehub-meta-v1';

const FILES = [
  './',
  './asset/hub-cards.js',
  './games.js',
  './games/asteroids/index.html',
  './games/asteroids/script.js',
  './games/asteroids/style.css',
  './games/bomberman/index.html',
  './games/bomberman/script.js',
  './games/bomberman/style.css',
  './games/breakout/index.html',
  './games/breakout/script.js',
  './games/breakout/style.css',
  './games/burger-time/index.html',
  './games/burger-time/script.js',
  './games/burger-time/style.css',
  './games/cell-swarm/index.html',
  './games/cell-swarm/script.js',
  './games/cell-swarm/style.css',
  './games/centipede/index.html',
  './games/centipede/script.js',
  './games/centipede/style.css',
  './games/columns/index.html',
  './games/columns/script.js',
  './games/columns/style.css',
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
  './games/double-dragon/index.html',
  './games/double-dragon/script.js',
  './games/double-dragon/style.css',
  './games/flappy-bird/index.html',
  './games/flappy-bird/script.js',
  './games/flappy-bird/style.css',
  './games/frogger/index.html',
  './games/frogger/script.js',
  './games/frogger/style.css',
  './games/galaga/index.html',
  './games/galaga/script.js',
  './games/galaga/style.css',
  './games/gradius/index.html',
  './games/gradius/script.js',
  './games/gradius/style.css',
  './games/joust/index.html',
  './games/joust/script.js',
  './games/joust/style.css',
  './games/missile-command/index.html',
  './games/missile-command/script.js',
  './games/missile-command/style.css',
  './games/moon-patrol/index.html',
  './games/moon-patrol/script.js',
  './games/moon-patrol/style.css',
  './games/neon-nexus/index.html',
  './games/neon-nexus/script.js',
  './games/neon-nexus/style.css',
  './games/out-run/index.html',
  './games/out-run/script.js',
  './games/out-run/style.css',
  './games/pacman/index.html',
  './games/pacman/script.js',
  './games/pacman/style.css',
  './games/paperboy/index.html',
  './games/paperboy/script.js',
  './games/paperboy/style.css',
  './games/pole-position/index.html',
  './games/pole-position/script.js',
  './games/pole-position/style.css',
  './games/pong/index.html',
  './games/pong/script.js',
  './games/pong/style.css',
  './games/puyo-puyo/index.html',
  './games/puyo-puyo/script.js',
  './games/puyo-puyo/style.css',
  './games/qbert/index.html',
  './games/qbert/script.js',
  './games/qbert/style.css',
  './games/raiden/index.html',
  './games/raiden/script.js',
  './games/raiden/style.css',
  './games/snake/index.html',
  './games/snake/script.js',
  './games/snake/style.css',
  './games/space-invaders/index.html',
  './games/space-invaders/script.js',
  './games/space-invaders/style.css',
  './games/tempest/index.html',
  './games/tempest/script.js',
  './games/tempest/style.css',
  './games/tetris/index.html',
  './games/tetris/script.js',
  './games/tetris/style.css',
  './index.html',
  './shared/achievements.js',
  './shared/audio.js',
  './shared/base.css',
  './shared/collide.js',
  './shared/display.js',
  './shared/dom.js',
  './shared/effects.js',
  './shared/help.js',
  './shared/input.js',
  './shared/loop.js',
  './shared/music.js',
  './shared/scores.js',
  './shared/settings.js',
  './shared/shell.js',
];

// ── Instalación: precachear assets estáticos ──
// Se cachea archivo por archivo (allSettled) para que un solo 404 no
// tumbe todo el precache; el install completa con el resto ya cacheado.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(FILES.map((file) => cache.add(file)))),
  );
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
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Sin copia en caché y sin red: nunca resolver undefined.
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }),
        ),
    );
    return;
  }

  // ── Assets estáticos (HTML, CSS, JS, etc.): cache-first ──
  // Con fallback offline: en navegaciones sin red se sirve el hub cacheado;
  // el resto devuelve un 503 por defecto (nunca resolve undefined).
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).catch(async () => {
          if (event.request.mode === 'navigate') {
            const home = await caches.match('./');
            if (home) return home;
          }
          return new Response('Recurso no disponible sin conexión', { status: 503 });
        }),
    ),
  );
});
