/* ═══════════════════════════════════════════════
   sw.js — Service Worker para Arcade Hub
   Cachea todos los archivos del hub para jugar
   sin conexión a internet.
   ═══════════════════════════════════════════════ */

const CACHE = 'arcadehub-v1';

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
];

// Instalación: precachear todos los archivos
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  // Forzar activación inmediata sin esperar a que se cierren las pestañas
  self.skipWaiting();
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  // Tomar control de todas las pestañas abiertas
  self.clients.claim();
});

// Estrategia: cache-first (todo es estático)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Si está en caché, devolverlo. Si no, buscar en la red.
      return cached || fetch(event.request);
    }),
  );
});
